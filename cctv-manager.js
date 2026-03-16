'use strict';

const fs     = require('fs');
const path   = require('path');
const http   = require('http');
const https  = require('https');
const net    = require('net');
const dgram  = require('dgram');
const crypto = require('crypto');
const os     = require('os');
const { spawn } = require('child_process');

const BOUNDARY = 'starboxcctv';

class CctvManager {
  constructor(dbPath, toolsPath = null) {
    this.dbPath      = dbPath;
    this.streams     = new Map(); // uid -> { server, ffmpeg, port, clients, status, error }
    this.toolsPath   = toolsPath;
    this._ffmpegBinOverride = null;
  }

  // ── DB ──────────────────────────────────────────────────────────────────────
  _readDb() {
    try {
      if (!fs.existsSync(this.dbPath)) return { cameras: [] };
      return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
    } catch { return { cameras: [] }; }
  }
  _writeDb(data) {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  getCameras() { return this._readDb().cameras || []; }

  saveCamera(camera) {
    const data = this._readDb();
    data.cameras = data.cameras || [];
    const idx = data.cameras.findIndex(c => c.uid === camera.uid);
    if (idx >= 0) data.cameras[idx] = camera;
    else data.cameras.push(camera);
    this._writeDb(data);
    return camera;
  }

  deleteCamera(uid) {
    const data = this._readDb();
    data.cameras = (data.cameras || []).filter(c => c.uid !== uid);
    this._writeDb(data);
  }

  // ── Port ─────────────────────────────────────────────────────────────────────
  async getFreePort(start = 18600) {
    const used = new Set([...this.streams.values()].map(s => s.port));
    for (let p = start; p < start + 200; p++) {
      if (used.has(p)) continue;
      if (await this._portFree(p)) return p;
    }
    throw new Error('No free ports');
  }
  _portFree(port) {
    return new Promise(resolve => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.once('listening', () => s.close(() => resolve(true)));
      s.listen(port, '127.0.0.1');
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  setFfmpegBin(binPath) {
    this._ffmpegBinOverride = binPath;
  }

  _ffmpegBin() {
    if (this._ffmpegBinOverride) return this._ffmpegBinOverride;
    if (process.platform === 'win32') {
      // Check portable install in toolsPath first
      if (this.toolsPath) {
        const portable = this._findPortableFfmpegWin();
        if (portable) return portable;
      }
      return 'ffmpeg.exe';
    }
    // Homebrew on macOS or system path
    const candidates = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg'];
    for (const c of candidates) {
      if (c === 'ffmpeg') return c; // fallback PATH
      try { if (fs.existsSync(c)) return c; } catch {}
    }
    return 'ffmpeg';
  }

  _findPortableFfmpegWin() {
    if (!this.toolsPath) return null;
    const ffmpegDir = path.join(this.toolsPath, 'ffmpeg');
    if (!fs.existsSync(ffmpegDir)) return null;
    // Search recursively up to 2 levels for ffmpeg.exe
    const walk = (dir, depth) => {
      if (depth > 2) return null;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory() && entry.name.toLowerCase() === 'ffmpeg.exe') {
            return path.join(dir, entry.name);
          }
        }
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const found = walk(path.join(dir, entry.name), depth + 1);
            if (found) return found;
          }
        }
      } catch {}
      return null;
    };
    return walk(ffmpegDir, 0);
  }

  _injectCreds(rawUrl, username, password) {
    if (!username || rawUrl.includes('@')) return rawUrl;
    try {
      const u = new URL(rawUrl);
      u.username = encodeURIComponent(username);
      u.password = encodeURIComponent(password || '');
      return u.toString();
    } catch { return rawUrl; }
  }

  // ── RTSP → MJPEG proxy ────────────────────────────────────────────────────
  async startStream(camera) {
    const uid = camera.uid;
    if (this.streams.has(uid)) return { port: this.streams.get(uid).port };

    const port    = await this.getFreePort();
    const clients = new Set();
    let   buf     = Buffer.alloc(0);

    const streamUrl = this._injectCreds(camera.url, camera.username, camera.password);
    const ffmpegBin = this._ffmpegBin();

    // Build args depending on stream type
    const args = [];
    if ((camera.type || 'rtsp') === 'rtsp') {
      args.push('-rtsp_transport', 'tcp');
    }
    args.push(
      '-i', streamUrl,
      '-f', 'mpjpeg',
      '-q:v', '5',
      '-r', String(camera.fps || 15),
      'pipe:1'
    );

    const ffmpeg = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    ffmpeg.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (true) {
        const s = buf.indexOf(Buffer.from([0xff, 0xd8]));
        if (s === -1) { buf = Buffer.alloc(0); break; }
        const e = buf.indexOf(Buffer.from([0xff, 0xd9]), s + 2);
        if (e === -1) { if (s > 0) buf = buf.slice(s); break; }
        const frame = buf.slice(s, e + 2);
        buf = buf.slice(e + 2);
        const hdr = `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
        const pkt = Buffer.concat([Buffer.from(hdr), frame, Buffer.from('\r\n')]);
        const dead = [];
        clients.forEach(res => { try { res.write(pkt); } catch { dead.push(res); } });
        dead.forEach(r => clients.delete(r));
      }
    });

    ffmpeg.stderr.on('data', (d) => {
      const msg = d.toString();
      if (info) info.ffmpegLog = (info.ffmpegLog || '') + msg;
    });

    const info = { server: null, ffmpeg, port, clients, status: 'connecting', ffmpegLog: '' };
    this.streams.set(uid, info);

    ffmpeg.on('error', (err) => {
      info.status = 'error';
      info.error  = err.message;
      console.error(`[CCTV] ffmpeg error ${uid}:`, err.message);
    });

    ffmpeg.on('exit', (code) => {
      console.log(`[CCTV] ffmpeg exit ${uid} code=${code}`);
      info.status = code === 0 ? 'stopped' : 'error';
      clients.forEach(res => { try { res.end(); } catch {} });
      clients.clear();
      try { info.server && info.server.close(); } catch {}
      this.streams.delete(uid);
    });

    const server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Connection': 'keep-alive',
      });
      clients.add(res);
      req.on('close', () => clients.delete(res));
    });

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });

    info.server = server;
    info.status = 'streaming';

    return { port };
  }

  stopStream(uid) {
    const info = this.streams.get(uid);
    if (!info) return;
    try { info.ffmpeg.kill('SIGTERM'); } catch {}
  }

  stopAll() {
    for (const uid of this.streams.keys()) this.stopStream(uid);
  }

  getStreamStatus(uid) {
    const info = this.streams.get(uid);
    if (!info) return { active: false };
    return { active: true, port: info.port, status: info.status };
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────
  async takeSnapshot(camera, outputPath) {
    const streamUrl = this._injectCreds(camera.url, camera.username, camera.password);
    const args = [];
    if ((camera.type || 'rtsp') === 'rtsp') args.push('-rtsp_transport', 'tcp');
    args.push('-i', streamUrl, '-vframes', '1', '-y', outputPath);

    return new Promise((resolve, reject) => {
      const ff = spawn(this._ffmpegBin(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      ff.stderr.on('data', d => stderr += d.toString());
      ff.on('error', reject);
      ff.on('exit', code => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`ffmpeg snapshot failed (code ${code}): ${stderr.slice(-400)}`));
      });
    });
  }

  // ── Check ffmpeg ─────────────────────────────────────────────────────────
  checkFfmpeg() {
    return new Promise(resolve => {
      const ff = spawn(this._ffmpegBin(), ['-version'], { stdio: 'ignore' });
      ff.on('error', () => resolve({ available: false }));
      ff.on('exit', code => resolve({ available: code === 0, path: this._ffmpegBin() }));
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ONVIF Support
  // ══════════════════════════════════════════════════════════════════════════

  // ── WS-Security header ────────────────────────────────────────────────────
  _wsSecHeader(username, password) {
    if (!username) return '';
    const nonce   = crypto.randomBytes(16);
    const created = new Date().toISOString();
    const digest  = crypto.createHash('sha1')
      .update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(password || '')]))
      .digest('base64');
    return `<s:Header>
  <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" s:mustUnderstand="1">
    <UsernameToken>
      <Username>${username}</Username>
      <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password>
      <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</Nonce>
      <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>
    </UsernameToken>
  </Security>
</s:Header>`;
  }

  // ── Generic SOAP POST ──────────────────────────────────────────────────────
  _soapPost(url, body, timeoutMs = 5000, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      let parsed;
      try { parsed = new URL(url); } catch (e) { return reject(e); }
      const mod = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname || '/onvif/device_service',
        method:   'POST',
        headers: {
          'Content-Type':   'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          ...extraHeaders,
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      };
      const req = mod.request(options, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          // Check for SOAP fault
          if (data.includes('Fault') && data.includes('NotAuthorized')) {
            return reject(new Error('NotAuthorized'));
          }
          resolve(data);
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('SOAP timeout')); });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // ── Try common ONVIF device service paths ─────────────────────────────────
  async _findDevicePath(ip, port) {
    const candidates = [
      '/onvif/device_service',
      '/onvif/Device',
      '/onvif/device',
      '/onvif/devicemgmt',
      '/onvif/services',
      '/api/onvif/device',
    ];
    const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
      xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><s:Body><tds:GetSystemDateAndTime/></s:Body></s:Envelope>`;
    for (const p of candidates) {
      try {
        const url = `http://${ip}:${port}${p}`;
        const xml = await this._soapPost(url, body, 2000);
        if (xml && (xml.includes('GetSystemDateAndTimeResponse') || xml.includes('UTCDateTime') || xml.includes('Envelope'))) {
          return p;
        }
      } catch {}
    }
    return '/onvif/device_service';
  }

  // ── XML value extractor ──────────────────────────────────────────────────
  _xmlVal(xml, tag) {
    const re = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : '';
  }
  _xmlAttr(xml, attr) {
    const re = new RegExp(`${attr}="([^"]*)"`, 'i');
    const m = xml.match(re);
    return m ? m[1] : '';
  }

  // ── GetDeviceInformation ──────────────────────────────────────────────────
  async getOnvifDeviceInfo(ip, port = 80, username = '', password = '') {
    const devPath = await this._findDevicePath(ip, port);
    const url     = `http://${ip}:${port}${devPath}`;

    const tryAuth = async (secHeader, extraHeaders = {}) => {
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  ${secHeader}
  <s:Body><tds:GetDeviceInformation/></s:Body>
</s:Envelope>`;
      const xml = await this._soapPost(url, body, 4000, extraHeaders);
      const manufacturer = this._xmlVal(xml, 'Manufacturer');
      if (!manufacturer && xml.includes('Fault')) throw new Error('fault');
      return {
        manufacturer,
        model:    this._xmlVal(xml, 'Model'),
        firmware: this._xmlVal(xml, 'FirmwareVersion'),
        serial:   this._xmlVal(xml, 'SerialNumber'),
        hardware: this._xmlVal(xml, 'HardwareId'),
        devPath,
      };
    };

    // 1. Try without auth (some cameras allow GetDeviceInfo unauthenticated)
    try { return await tryAuth(''); } catch {}

    if (username) {
      // 2. Try WS-Security digest
      try { return await tryAuth(this._wsSecHeader(username, password)); } catch {}

      // 3. Try HTTP Basic auth
      const basicAuth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      try { return await tryAuth('', { 'Authorization': basicAuth }); } catch {}
    }

    return null;
  }

  // ── GetProfiles → GetStreamUri ────────────────────────────────────────────
  async getOnvifStreamUri(ip, port = 80, username = '', password = '', devPath = null) {
    if (!devPath) devPath = await this._findDevicePath(ip, port);
    const deviceUrl = `http://${ip}:${port}${devPath}`;
    const basicAuth = username
      ? 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
      : null;

    const authVariants = [
      { sec: this._wsSecHeader(username, password), extra: {} },
      { sec: '', extra: basicAuth ? { 'Authorization': basicAuth } : {} },
      { sec: '', extra: {} },
    ];

    for (const { sec, extra } of authVariants) {
      try {
        // 1. GetCapabilities
        const capBody = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  ${sec}
  <s:Body><tds:GetCapabilities><tds:Category>Media</tds:Category></tds:GetCapabilities></s:Body>
</s:Envelope>`;
        let mediaUrl = deviceUrl.replace('device_service', 'media_service')
                                .replace('/Device', '/media_service')
                                .replace('/device', '/media_service');
        try {
          const capXml = await this._soapPost(deviceUrl, capBody, 3000, extra);
          const xAddr  = this._xmlVal(capXml, 'XAddr');
          if (xAddr) mediaUrl = xAddr;
        } catch {}

        // 2. GetProfiles
        const profBody = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  ${sec}
  <s:Body><trt:GetProfiles/></s:Body>
</s:Envelope>`;
        let profileToken = 'MainStream';
        try {
          const profXml = await this._soapPost(mediaUrl, profBody, 3000, extra);
          const tokMatch = profXml.match(/token="([^"]+)"/i);
          if (tokMatch) profileToken = tokMatch[1];
        } catch {}

        // 3. GetStreamUri
        const streamBody = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  ${sec}
  <s:Body>
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Stream>RTP-Unicast</tt:Stream>
        <tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>${profileToken}</trt:ProfileToken>
    </trt:GetStreamUri>
  </s:Body>
</s:Envelope>`;
        const streamXml = await this._soapPost(mediaUrl, streamBody, 4000, extra);
        const uri = this._xmlVal(streamXml, 'Uri');
        if (uri) return { uri, profileToken };
      } catch {}
    }

    throw new Error('No stream URI returned from any auth method');
  }

  // ── PTZ ──────────────────────────────────────────────────────────────────────

  // Try 3 auth methods. Retries on both NotAuthorized AND SOAP timeout
  // (some cameras timeout on WS-Security but respond fine to HTTP Basic).
  async _ptzSoapPost(url, bodyFn, username, password, timeoutMs = 4000) {
    const basic = username
      ? 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
      : null;
    const authVariants = [
      { sec: this._wsSecHeader(username, password), extra: {} },
      { sec: '', extra: basic ? { Authorization: basic } : {} },
      { sec: '', extra: {} },
    ];
    let lastErr;
    for (const { sec, extra } of authVariants) {
      try {
        const xml = await this._soapPost(url, bodyFn(sec), timeoutMs, extra);
        if (xml && xml.includes('NotAuthorized')) throw new Error('NotAuthorized');
        return xml;
      } catch (e) {
        lastErr = e;
        // Retry on auth errors and timeouts — skip for real network errors
        const retryable = e.message === 'NotAuthorized' || e.message === 'SOAP timeout';
        if (!retryable) throw e;
      }
    }
    throw lastErr;
  }

  // Find working PTZ service URL: probe candidate paths, normalize IP
  async _getPtzServiceUrl(ip, port, username, password, devPath) {
    if (!devPath) devPath = await this._findDevicePath(ip, port);
    const deviceUrl = `http://${ip}:${port}${devPath}`;

    // 1. Try GetCapabilities to get the declared PTZ XAddr
    try {
      const xml = await this._ptzSoapPost(
        deviceUrl,
        (sec) => `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  ${sec}
  <s:Body><tds:GetCapabilities><tds:Category>PTZ</tds:Category></tds:GetCapabilities></s:Body>
</s:Envelope>`,
        username, password, 3000,
      );
      const xAddr = this._xmlVal(xml, 'XAddr');
      if (xAddr) {
        // Normalize: replace whatever host is in XAddr with actual ip:port
        try {
          const u = new URL(xAddr);
          return `http://${ip}:${port}${u.pathname}`;
        } catch { return xAddr; }
      }
    } catch {}

    // 2. Probe common PTZ paths — return first that responds (even auth error = path exists)
    const candidates = [
      '/onvif/ptz_service',
      '/onvif/PTZ',
      '/onvif/ptz',
      devPath,          // some cameras serve PTZ on the same endpoint
      '/onvif/services',
    ];
    const testBody = (sec) => `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  ${sec}
  <s:Body><tptz:GetNodes/></s:Body>
</s:Envelope>`;
    const basic = username
      ? 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
      : null;
    for (const p of candidates) {
      const url = `http://${ip}:${port}${p}`;
      for (const extra of [{}, basic ? { Authorization: basic } : {}]) {
        try {
          const xml = await this._soapPost(url, testBody(''), 2000, extra);
          // Any response (even auth fault) means the path exists
          if (xml && xml.includes('Envelope')) return url;
        } catch {}
      }
    }

    // 3. Last resort fallback
    return deviceUrl.replace('device_service', 'ptz_service');
  }

  async ptzContinuousMove(ip, port, username, password, profileToken, pan, tilt, zoom, ptzUrl) {
    if (!ptzUrl) ptzUrl = await this._getPtzServiceUrl(ip, port, username, password);
    await this._ptzSoapPost(ptzUrl, (sec) => `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  ${sec}
  <s:Body>
    <tptz:ContinuousMove>
      <tptz:ProfileToken>${profileToken}</tptz:ProfileToken>
      <tptz:Velocity>
        <tt:PanTilt x="${pan}" y="${tilt}"/>
        <tt:Zoom x="${zoom}"/>
      </tptz:Velocity>
    </tptz:ContinuousMove>
  </s:Body>
</s:Envelope>`, username, password);
    return { success: true };
  }

  async ptzStop(ip, port, username, password, profileToken, ptzUrl) {
    if (!ptzUrl) ptzUrl = await this._getPtzServiceUrl(ip, port, username, password);
    await this._ptzSoapPost(ptzUrl, (sec) => `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  ${sec}
  <s:Body>
    <tptz:Stop>
      <tptz:ProfileToken>${profileToken}</tptz:ProfileToken>
      <tptz:PanTilt>true</tptz:PanTilt>
      <tptz:Zoom>true</tptz:Zoom>
    </tptz:Stop>
  </s:Body>
</s:Envelope>`, username, password);
    return { success: true };
  }

  async ptzGetPresets(ip, port, username, password, profileToken, ptzUrl) {
    if (!ptzUrl) ptzUrl = await this._getPtzServiceUrl(ip, port, username, password);
    const xml = await this._ptzSoapPost(ptzUrl, (sec) => `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  ${sec}
  <s:Body>
    <tptz:GetPresets>
      <tptz:ProfileToken>${profileToken}</tptz:ProfileToken>
    </tptz:GetPresets>
  </s:Body>
</s:Envelope>`, username, password, 4000);
    const presets = [];
    const re = /token="([^"]+)"[\s\S]*?<(?:[^:>]+:)?Name>([^<]*)<\/(?:[^:>]+:)?Name>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      presets.push({ token: m[1], name: m[2] || `Preset ${presets.length + 1}` });
    }
    if (!presets.length) {
      const tokRe = /token="([^"]+)"/g;
      let i = 0;
      while ((m = tokRe.exec(xml)) !== null) presets.push({ token: m[1], name: `Preset ${++i}` });
    }
    return presets;
  }

  async ptzGotoPreset(ip, port, username, password, profileToken, presetToken, ptzUrl) {
    if (!ptzUrl) ptzUrl = await this._getPtzServiceUrl(ip, port, username, password);
    await this._ptzSoapPost(ptzUrl, (sec) => `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  ${sec}
  <s:Body>
    <tptz:GotoPreset>
      <tptz:ProfileToken>${profileToken}</tptz:ProfileToken>
      <tptz:PresetToken>${presetToken}</tptz:PresetToken>
    </tptz:GotoPreset>
  </s:Body>
</s:Envelope>`, username, password);
    return { success: true };
  }

  async ptzSetPreset(ip, port, username, password, profileToken, presetName, ptzUrl) {
    if (!ptzUrl) ptzUrl = await this._getPtzServiceUrl(ip, port, username, password);
    const nameEl = presetName ? `<tptz:PresetName>${presetName}</tptz:PresetName>` : '';
    const xml = await this._ptzSoapPost(ptzUrl, (sec) => `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  ${sec}
  <s:Body>
    <tptz:SetPreset>
      <tptz:ProfileToken>${profileToken}</tptz:ProfileToken>
      ${nameEl}
    </tptz:SetPreset>
  </s:Body>
</s:Envelope>`, username, password);
    const m = xml.match(/<(?:[^:>]+:)?PresetToken>([^<]+)<\/(?:[^:>]+:)?PresetToken>/);
    return { success: true, token: m ? m[1] : null };
  }

  // ── Probe single IP ───────────────────────────────────────────────────────
  async probeOnvifDevice(ip, port = 80, username = '', password = '') {
    // Quick TCP check first
    const open = await this._tcpOpen(ip, port, 1500);
    if (!open) return null;

    try {
      const info = await this.getOnvifDeviceInfo(ip, port, username, password);
      const devPath = info?.devPath || null;
      let streamUri = null, profileToken = null;
      try {
        const s = await this.getOnvifStreamUri(ip, port, username, password, devPath);
        streamUri    = s.uri;
        profileToken = s.profileToken;
      } catch {}
      return { ip, port, info, streamUri, profileToken };
    } catch { return null; }
  }

  _tcpOpen(ip, port, timeoutMs) {
    return new Promise(resolve => {
      const s = new net.Socket();
      s.setTimeout(timeoutMs);
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('timeout', () => { s.destroy(); resolve(false); });
      s.once('error',   () => resolve(false));
      s.connect(port, ip);
    });
  }

  // ── WS-Discovery (UDP multicast) ─────────────────────────────────────────
  discoverOnvifWsDiscovery(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const found = new Map(); // XAddrs → device info
      const msgId = `uuid:${crypto.randomUUID()}`;
      const probe = `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>${msgId}</w:MessageID>
    <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>`;

      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sock.bind(() => {
        try { sock.setBroadcast(true); } catch {}
        const buf = Buffer.from(probe);
        sock.send(buf, 0, buf.length, 3702, '239.255.255.250');

        sock.on('message', (msg) => {
          const xml   = msg.toString();
          const xaddrs = this._xmlVal(xml, 'XAddrs');
          const types  = this._xmlVal(xml, 'Types');
          const scopes = this._xmlVal(xml, 'Scopes');
          if (!xaddrs) return;
          xaddrs.split(/\s+/).forEach(addr => {
            if (!found.has(addr)) {
              found.set(addr, { xaddr: addr, types, scopes });
            }
          });
        });

        setTimeout(() => {
          sock.close();
          resolve(Array.from(found.values()));
        }, timeoutMs);
      });

      sock.on('error', () => { try { sock.close(); } catch {} resolve([]); });
    });
  }

  // ── Get local subnets ──────────────────────────────────────────────────────
  _getLocalSubnets() {
    const subnets = new Set();
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
      for (const addr of iface) {
        if (addr.family !== 'IPv4' || addr.internal) continue;
        const parts = addr.address.split('.');
        subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
    return Array.from(subnets);
  }

  // ── Parse custom subnet/range input ─────────────────────────────────────
  // Accepts:
  //   "192.168.100"          → 192.168.100.1–254
  //   "192.168.100.0/24"     → 192.168.100.1–254
  //   "192.168.100.1-50"     → 192.168.100.1–50
  //   "192.168.100.1-192.168.100.50" → same
  //   "192.168.100.1"        → single IP
  _parseSubnetInput(input) {
    input = (input || '').trim();
    if (!input) return null; // use auto-detect

    // Single IP
    if (/^\d+\.\d+\.\d+\.\d+$/.test(input)) return [input];

    // "192.168.100" (just 3 octets)
    if (/^\d+\.\d+\.\d+$/.test(input)) return { subnet: input, from: 1, to: 254 };

    // "192.168.100.0/24" or "192.168.100.0/16" etc.
    const cidrMatch = input.match(/^(\d+\.\d+\.\d+)\.\d+\/(\d+)$/);
    if (cidrMatch) return { subnet: cidrMatch[1], from: 1, to: 254 };

    // "192.168.100.1-50" (last-octet range)
    const rangeShort = input.match(/^(\d+\.\d+\.\d+)\.(\d+)-(\d+)$/);
    if (rangeShort) return { subnet: rangeShort[1], from: parseInt(rangeShort[2]), to: parseInt(rangeShort[3]) };

    // "192.168.100.1-192.168.100.50"
    const rangeFull = input.match(/^(\d+\.\d+\.\d+)\.(\d+)-\d+\.\d+\.\d+\.(\d+)$/);
    if (rangeFull) return { subnet: rangeFull[1], from: parseInt(rangeFull[2]), to: parseInt(rangeFull[3]) };

    return null;
  }

  _expandSubnetSpec(spec) {
    // spec = { subnet, from, to } or [ip1, ip2, ...]
    if (Array.isArray(spec)) return spec;
    if (!spec) return null;
    const ips = [];
    for (let i = spec.from; i <= spec.to; i++) ips.push(`${spec.subnet}.${i}`);
    return ips;
  }

  // ── Full ONVIF scan ────────────────────────────────────────────────────────
  async scanOnvif({ username = '', password = '', onProgress = null, subnetInput = '' } = {}) {
    const results = [];
    const emit = (msg, progress = null) => {
      if (typeof onProgress === 'function') onProgress({ message: msg, progress });
    };

    // Phase 1: WS-Discovery
    emit('Mengirim WS-Discovery multicast...', 5);
    const discovered = await this.discoverOnvifWsDiscovery(3000);
    emit(`WS-Discovery: ${discovered.length} perangkat ditemukan`, 20);

    const probed = new Set();

    for (const dev of discovered) {
      try {
        const u = new URL(dev.xaddr);
        const ip   = u.hostname;
        const port = parseInt(u.port) || 80;
        const key  = `${ip}:${port}`;
        if (probed.has(key)) continue;
        probed.add(key);

        emit(`Probing ${ip}:${port}...`);
        const info = await this.getOnvifDeviceInfo(ip, port, username, password);
        let streamUri = null;
        try {
          const s = await this.getOnvifStreamUri(ip, port, username, password, info?.devPath);
          streamUri = s.uri;
        } catch {}
        results.push({ ip, port, info, streamUri, source: 'ws-discovery' });
        emit(`✓ ${ip} — ${info?.manufacturer || ''} ${info?.model || ''}`, null);
      } catch {}
    }

    // Phase 2: TCP scan
    // Use manual subnet if provided, otherwise auto-detect
    const customSpec = this._parseSubnetInput(subnetInput);
    let   ipsToScan;
    if (customSpec) {
      ipsToScan = this._expandSubnetSpec(customSpec);
      emit(`Memindai ${subnetInput} pada port ONVIF...`, 25);
    } else {
      const subnets = this._getLocalSubnets();
      ipsToScan = [];
      for (const s of subnets) {
        for (let i = 1; i <= 254; i++) ipsToScan.push(`${s}.${i}`);
      }
      emit(`Memindai subnet lokal ${this._getLocalSubnets().join(', ')}...`, 25);
    }

    const onvifPorts = [80, 835, 8080, 8554, 8899, 2020];
    const total = ipsToScan.length;
    let   done  = 0;

    const CONCURRENCY = 50;
    const tasks = ipsToScan.map(ip => async () => {
      done++;
      const pct = 25 + Math.round((done / total) * 70);
      if (done % 10 === 0) emit(`Memindai ${ip}... (${done}/${total})`, pct);

      for (const port of onvifPorts) {
        const key = `${ip}:${port}`;
        if (probed.has(key)) continue;
        const open = await this._tcpOpen(ip, port, 400);
        if (!open) continue;
        probed.add(key);
        emit(`Perangkat ditemukan di ${ip}:${port}, mengidentifikasi...`, pct);
        try {
          const info = await this.getOnvifDeviceInfo(ip, port, username, password);
          let streamUri = null;
          try {
            const s = await this.getOnvifStreamUri(ip, port, username, password);
            streamUri = s.uri;
          } catch {}
          results.push({ ip, port, info, streamUri, source: 'tcp-scan' });
          emit(`✓ ${ip}:${port} — ${info?.manufacturer || 'ONVIF'} ${info?.model || ''}`, pct);
        } catch {}
      }
    });

    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      await Promise.all(tasks.slice(i, i + CONCURRENCY).map(t => t()));
    }

    emit(`Selesai. ${results.length} perangkat ONVIF ditemukan.`, 100);
    return results;
  }
}

module.exports = CctvManager;
