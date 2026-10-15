// android-sync-manager.js
//
// Multi-device synchronized remote control ("StarSync"). Pushes the bundled
// scrcpy-server.jar (assets/scrcpy-server.jar, Genymobile/scrcpy, Apache-2.0 —
// see assets/scrcpy-server.NOTICE.txt) to each selected device via ADB, runs
// it in-process on the device, and talks directly to its socket protocol —
// NOT via the external `scrcpy` CLI that the existing single-device remote
// window (electron-main.js createScrcpyWindow) depends on. Those two
// features are fully independent.
//
// Wire protocol below (handshake order, video framing, control message byte
// layout) was read directly from scrcpy v4.1 server source
// (server/src/main/java/com/genymobile/scrcpy/{Server,Options}.java,
// device/{DesktopConnection,Streamer}.java, control/{ControlMessage,
// ControlMessageReader}.java) — NOT reconstructed from memory. The bundled
// jar MUST stay at exactly this version: Options.parse() rejects the
// connection outright if the client-supplied version string
// (SCRCPY_VERSION below) does not match the jar's own build version.
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const SCRCPY_VERSION = '4.1';
const DEVICE_JAR_PATH = '/data/local/tmp/scrcpy-server.jar';
const SOCKET_NAME = 'scrcpy'; // DesktopConnection.getSocketName(-1) with scid=-1 ("none")
const DEVICE_NAME_FIELD_LENGTH = 64;
const H264_CODEC_ID = 0x68323634; // 'h264' ASCII, VideoCodec.H264.getId()
const INJECT_TEXT_MAX_LENGTH = 300; // ControlMessageReader.INJECT_TEXT_MAX_LENGTH

// ControlMessage.TYPE_*
const CTRL_TYPE_INJECT_KEYCODE = 0;
const CTRL_TYPE_INJECT_TEXT = 1;
const CTRL_TYPE_INJECT_TOUCH_EVENT = 2;
const CTRL_TYPE_ROTATE_DEVICE = 11;
const CTRL_TYPE_START_APP = 16;

// MotionEvent.ACTION_*
const MOTION_ACTION_DOWN = 0;
const MOTION_ACTION_UP = 1;
const MOTION_ACTION_MOVE = 2;

function getFreeTcpPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Incrementally slices complete frames out of a growing Buffer. TCP delivers
 * data in arbitrary chunks with no relation to scrcpy's own message
 * boundaries, so every multi-byte field must tolerate arriving split across
 * several 'data' events.
 */
class ByteStreamReader {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  push(buf) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, buf]) : buf;
  }

  get length() {
    return this.buffer.length;
  }

  /** Returns the first `n` bytes without consuming them, or null if not enough data yet. */
  peek(n) {
    if (this.buffer.length < n) return null;
    return this.buffer.subarray(0, n);
  }

  /** Returns a Buffer of exactly `n` bytes and consumes them, or null if not enough data yet. */
  take(n) {
    const out = this.peek(n);
    if (!out) return null;
    this.buffer = this.buffer.subarray(n);
    return out;
  }
}

class AndroidSyncSession {
  constructor(adbId, androidManager) {
    this.adbId = adbId;
    this.androidManager = androidManager;
    this.localPort = null;
    this.shellProcess = null;
    this.videoSocket = null;
    this.controlSocket = null;
    this.videoReader = new ByteStreamReader();
    this.deviceName = '';
    this.width = 0;
    this.height = 0;
    this.status = 'idle'; // idle | connecting | streaming | error | closed
    this.onFrame = null; // (naluBuffer, {pts, keyFrame, config}) => void
    this.onConfig = null; // ({codec, width, height}) => void
    this.onStatus = null; // (status, detail) => void
    this.onLog = null; // (level: 'info'|'warn', text) => void — scrcpy-server's own log lines
    this._videoHandshakeDone = false;
    this._videoCodecRead = false;
    this._videoSessionMetaRead = false;
    this._closed = false;
  }

  setStatus(status, detail) {
    this.status = status;
    if (typeof this.onStatus === 'function') {
      try {
        this.onStatus(status, detail);
      } catch (_) {}
    }
  }

  /**
   * Relay scrcpy-server's own on-device log lines (e.g. "WARN: No app found
   * for package ...") to whoever's listening. Only WARN/ERROR lines are
   * forwarded — INFO noise (boot messages, frame stats) isn't actionable for
   * the user and would just flood the UI. This is fire-and-forget feedback:
   * the control protocol itself has no ack/response for things like
   * START_APP, so without this a bad package name failed completely
   * silently from the renderer's point of view.
   */
  emitServerLog(text) {
    if (!text || typeof this.onLog !== 'function') return;
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      // scrcpy-server prefixes every line with its own level, independent of
      // which OS stream (stdout/stderr) it happened to land on — match on
      // that instead of trusting the stream.
      if (!trimmed || !/\bWARN\b|\bERROR\b/.test(trimmed)) return;
      try {
        this.onLog(/\bERROR\b/.test(trimmed) ? 'error' : 'warn', trimmed);
      } catch (_) {}
    });
  }

  adbArgs(args) {
    return ['-s', this.adbId, ...args];
  }

  spawnAdb(args, options = {}) {
    return spawn(this.androidManager.getADBBinary(), this.adbArgs(args), {
      env: this.androidManager.getProcessEnv(),
      ...options,
    });
  }

  runAdb(args, { timeout = 20000 } = {}) {
    return new Promise((resolve, reject) => {
      const proc = this.spawnAdb(args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`adb ${args.join(' ')} timeout`));
      }, timeout);
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr.trim() || `adb ${args.join(' ')} exited with code ${code}`));
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /** Push the bundled scrcpy-server.jar and launch it (video+control, or control-only). */
  async start(serverJarPath, { video = true } = {}) {
    this.setStatus('connecting', 'Mendorong scrcpy-server ke device...');
    await this.runAdb(['push', serverJarPath, DEVICE_JAR_PATH]);

    this.localPort = await getFreeTcpPort();
    await this.runAdb(['forward', `tcp:${this.localPort}`, `localabstract:${SOCKET_NAME}`]);

    this.setStatus('connecting', 'Menjalankan scrcpy-server di device...');
    const launchArgs = [
      `CLASSPATH=${DEVICE_JAR_PATH}`,
      'app_process',
      '/',
      'com.genymobile.scrcpy.Server',
      SCRCPY_VERSION,
      'log_level=info',
      'tunnel_forward=true',
      'audio=false',
      `video=${video ? 'true' : 'false'}`,
      'control=true',
      'cleanup=true',
      'stay_awake=true',
      'clipboard_autosync=false',
      'send_device_meta=true',
      'send_frame_meta=true',
      'send_dummy_byte=true',
      'send_stream_meta=true',
      'video_bit_rate=8000000',
      'max_size=1280',
      'max_fps=30',
    ];
    this.shellProcess = this.spawnAdb(['shell', ...launchArgs], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.shellProcess.stdout.on('data', (d) => {
      const text = d.toString().trim();
      console.log(`[sync ${this.adbId}] ${text}`);
      this.emitServerLog(text);
    });
    this.shellProcess.stderr.on('data', (d) => {
      const text = d.toString().trim();
      console.warn(`[sync ${this.adbId}] ${text}`);
      this.emitServerLog(text);
    });
    this.shellProcess.on('exit', (code, signal) => {
      if (!this._closed) {
        this.setStatus('error', `scrcpy-server berhenti (code ${code}, signal ${signal || 'none'})`);
      }
    });

    // Server side accept() order is fixed: video first (if enabled), then
    // audio (always disabled here), then control — the client must connect
    // in that same order for tunnel_forward mode to hand out the right
    // socket to the right accept() call.
    if (video) {
      this.videoSocket = await this.connectSocket();
      this.videoSocket.on('data', (chunk) => this.handleVideoData(chunk));
      this.videoSocket.on('error', (err) => this.setStatus('error', `Video socket error: ${err.message}`));
      this.videoSocket.on('close', () => {
        if (!this._closed) this.setStatus('error', 'Video socket tertutup');
      });
    }

    this.controlSocket = await this.connectSocket();
    this.controlSocket.on('error', (err) => this.setStatus('error', `Control socket error: ${err.message}`));
    this.controlSocket.on('close', () => {
      if (!this._closed) this.setStatus('error', 'Control socket tertutup');
    });
    // Drain (but ignore) server->client control messages (e.g. clipboard
    // sync acks) so the socket's read buffer never backs up.
    this.controlSocket.on('data', () => {});

    // If control connected first (video disabled), it carries the dummy
    // byte + device-name handshake instead of the video socket.
    if (!video) {
      await this.readControlOnlyHandshake();
      this.setStatus('streaming', 'Control-only tersambung.');
    }
  }

  /**
   * The on-device server needs a moment (app_process JVM boot + dexopt of
   * scrcpy-server.jar, observed ~1-3s on a cold start) before it reaches
   * DesktopConnection.open() and starts accept()-ing on its LocalServerSocket.
   * `adb forward` accepts a TCP connection immediately regardless, then
   * closes it right away if nothing is listening on the device-side abstract
   * socket yet — so a single connect attempt racing that startup window
   * connects successfully but is torn down within milliseconds. Retry until
   * a connection survives a short grace period without closing.
   */
  connectSocketOnce() {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: '127.0.0.1', port: this.localPort });
      const onError = (err) => {
        sock.removeListener('connect', onConnect);
        reject(err);
      };
      const onConnect = () => {
        sock.removeListener('error', onError);
        let closedEarly = false;
        const onEarlyClose = () => {
          closedEarly = true;
        };
        sock.once('close', onEarlyClose);
        setTimeout(() => {
          sock.removeListener('close', onEarlyClose);
          if (closedEarly) {
            reject(new Error('Socket closed immediately after connect (device-side listener not ready yet)'));
          } else {
            resolve(sock);
          }
        }, 150);
      };
      sock.once('error', onError);
      sock.once('connect', onConnect);
    });
  }

  async connectSocket({ maxAttempts = 30, delayMs = 300 } = {}) {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.connectSocketOnce();
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw new Error(`Gagal konek ke scrcpy-server setelah ${maxAttempts} percobaan: ${lastErr?.message || 'unknown'}`);
  }

  /** Consumes [1 dummy byte][64-byte device name] from the control socket (control-only mode). */
  readControlOnlyHandshake() {
    return new Promise((resolve, reject) => {
      const reader = new ByteStreamReader();
      const onData = (chunk) => {
        reader.push(chunk);
        // Wait until both the dummy byte AND the full device-name field have
        // arrived before consuming anything — partial consumption here would
        // permanently desync the parser if the two fields split across
        // separate TCP chunks.
        if (reader.length < 1 + DEVICE_NAME_FIELD_LENGTH) return;
        reader.take(1); // dummy byte, discarded
        const nameBuf = reader.take(DEVICE_NAME_FIELD_LENGTH);
        this.deviceName = nameBuf.toString('utf8').replace(/\0+$/, '');
        this.controlSocket.removeListener('data', onData);
        // Re-attach the real drain listener now that handshake is done.
        this.controlSocket.on('data', () => {});
        resolve();
      };
      this.controlSocket.on('data', onData);
      this.controlSocket.once('error', reject);
    });
  }

  handleVideoData(chunk) {
    this.videoReader.push(chunk);
    // 1) optional dummy byte (once)
    // 2) 64-byte device name (once)
    // 3) 4-byte codec id (once)
    // 4) 12-byte session meta: flags(4) + width(4) + height(4) (once, may repeat on resize)
    // 5) repeating: 12-byte frame meta (ptsAndFlags u64 BE, packetSize u32 BE) + packet bytes
    for (;;) {
      if (!this._videoHandshakeDone) {
        // Same split-chunk hazard as readControlOnlyHandshake(): don't
        // consume the dummy byte until the device-name field is fully here too.
        if (this.videoReader.length < 1 + DEVICE_NAME_FIELD_LENGTH) return;
        this.videoReader.take(1);
        const nameBuf = this.videoReader.take(DEVICE_NAME_FIELD_LENGTH);
        this.deviceName = nameBuf.toString('utf8').replace(/\0+$/, '');
        this._videoHandshakeDone = true;
        continue;
      }
      if (!this._videoCodecRead) {
        const codecBuf = this.videoReader.take(4);
        if (!codecBuf) return;
        const codecId = codecBuf.readUInt32BE(0);
        if (codecId !== H264_CODEC_ID) {
          this.setStatus('error', `Codec video tidak didukung (id 0x${codecId.toString(16)}, hanya h264)`);
          return;
        }
        this._videoCodecRead = true;
        continue;
      }
      if (!this._videoSessionMetaRead) {
        const metaBuf = this.videoReader.take(12);
        if (!metaBuf) return;
        this.width = metaBuf.readUInt32BE(4);
        this.height = metaBuf.readUInt32BE(8);
        this._videoSessionMetaRead = true;
        this.setStatus('streaming', `${this.width}x${this.height}`);
        if (typeof this.onConfig === 'function') {
          this.onConfig({ codec: 'h264', width: this.width, height: this.height });
        }
        continue;
      }
      // Peek (don't consume) the header first — the packet payload may not
      // have fully arrived yet, and consuming the header early would desync
      // the parser permanently on the next 'data' event.
      const frameHeader = this.videoReader.peek(12);
      if (!frameHeader) return;
      const packetSize = frameHeader.readUInt32BE(8);
      if (this.videoReader.length < 12 + packetSize) return; // wait for more data
      this.videoReader.take(12);
      const ptsAndFlags = frameHeader.readBigUInt64BE(0);
      const packet = this.videoReader.take(packetSize);
      const PACKET_FLAG_CONFIG = 1n << 62n;
      const PACKET_FLAG_KEY_FRAME = 1n << 61n;
      const config = (ptsAndFlags & PACKET_FLAG_CONFIG) !== 0n;
      const keyFrame = (ptsAndFlags & PACKET_FLAG_KEY_FRAME) !== 0n;
      const pts = config ? 0n : ptsAndFlags & ~PACKET_FLAG_KEY_FRAME;
      if (typeof this.onFrame === 'function') {
        this.onFrame(packet, { pts, config, keyFrame });
      }
    }
  }

  sendTouch({ action, x, y, screenWidth, screenHeight, pointerId = 1 }) {
    if (!this.controlSocket || this.controlSocket.destroyed) return;
    const buf = Buffer.alloc(32);
    let o = 0;
    buf.writeUInt8(CTRL_TYPE_INJECT_TOUCH_EVENT, o); o += 1;
    buf.writeUInt8(action, o); o += 1;
    buf.writeBigUInt64BE(BigInt(pointerId), o); o += 8;
    buf.writeInt32BE(Math.round(x), o); o += 4;
    buf.writeInt32BE(Math.round(y), o); o += 4;
    buf.writeUInt16BE(screenWidth, o); o += 2;
    buf.writeUInt16BE(screenHeight, o); o += 2;
    // u16 fixed-point pressure: 0xFFFF == 1.0. Full pressure on down/move, 0 on up.
    buf.writeUInt16BE(action === MOTION_ACTION_UP ? 0x0000 : 0xffff, o); o += 2;
    buf.writeInt32BE(0, o); o += 4; // actionButton (0 = touch, not a mouse button)
    buf.writeInt32BE(0, o); o += 4; // buttons
    this.controlSocket.write(buf);
  }

  sendText(text) {
    if (!this.controlSocket || this.controlSocket.destroyed) return;
    const textBuf = Buffer.from(String(text), 'utf8').subarray(0, INJECT_TEXT_MAX_LENGTH);
    const buf = Buffer.alloc(1 + 4 + textBuf.length);
    buf.writeUInt8(CTRL_TYPE_INJECT_TEXT, 0);
    buf.writeUInt32BE(textBuf.length, 1);
    textBuf.copy(buf, 5);
    this.controlSocket.write(buf);
  }

  sendKeycode(keycode, action) {
    if (!this.controlSocket || this.controlSocket.destroyed) return;
    const buf = Buffer.alloc(14);
    buf.writeUInt8(CTRL_TYPE_INJECT_KEYCODE, 0);
    buf.writeUInt8(action, 1);
    buf.writeInt32BE(keycode, 2);
    buf.writeInt32BE(0, 6); // repeat
    buf.writeInt32BE(0, 10); // metaState
    this.controlSocket.write(buf);
  }

  /** Down+up in one shot, like a normal key press. */
  pressKeycode(keycode) {
    this.sendKeycode(keycode, MOTION_ACTION_DOWN);
    this.sendKeycode(keycode, MOTION_ACTION_UP);
  }

  sendStartApp(packageName) {
    if (!this.controlSocket || this.controlSocket.destroyed) return;
    const nameBuf = Buffer.from(String(packageName), 'utf8').subarray(0, 255);
    const buf = Buffer.alloc(1 + 1 + nameBuf.length);
    buf.writeUInt8(CTRL_TYPE_START_APP, 0);
    buf.writeUInt8(nameBuf.length, 1);
    nameBuf.copy(buf, 2);
    this.controlSocket.write(buf);
  }

  sendRotate() {
    if (!this.controlSocket || this.controlSocket.destroyed) return;
    this.controlSocket.write(Buffer.from([CTRL_TYPE_ROTATE_DEVICE]));
  }

  async close() {
    if (this._closed) return;
    this._closed = true;
    this.setStatus('closed');
    try { this.videoSocket && this.videoSocket.destroy(); } catch (_) {}
    try { this.controlSocket && this.controlSocket.destroy(); } catch (_) {}
    try { this.shellProcess && this.shellProcess.kill(); } catch (_) {}
    if (this.localPort) {
      try { await this.runAdb(['forward', '--remove', `tcp:${this.localPort}`], { timeout: 5000 }); } catch (_) {}
    }
  }
}

class AndroidSyncManager {
  constructor(androidManager, serverJarPath) {
    this.androidManager = androidManager;
    this.serverJarPath = serverJarPath;
    this.sessions = new Map(); // adbId -> AndroidSyncSession
  }

  getSession(adbId) {
    return this.sessions.get(adbId) || null;
  }

  getActiveSessions() {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'streaming');
  }

  async connect(adbId, { video = true, onFrame, onConfig, onStatus, onLog } = {}) {
    if (!fs.existsSync(this.serverJarPath)) {
      throw new Error(`scrcpy-server.jar tidak ditemukan di ${this.serverJarPath}`);
    }
    const existing = this.sessions.get(adbId);
    if (existing) {
      await existing.close();
      this.sessions.delete(adbId);
    }
    const session = new AndroidSyncSession(adbId, this.androidManager);
    session.onFrame = onFrame || null;
    session.onConfig = onConfig || null;
    session.onStatus = onStatus || null;
    session.onLog = onLog || null;
    this.sessions.set(adbId, session);
    try {
      await session.start(this.serverJarPath, { video });
      return session;
    } catch (err) {
      await session.close();
      this.sessions.delete(adbId);
      throw err;
    }
  }

  async disconnect(adbId) {
    const session = this.sessions.get(adbId);
    if (!session) return;
    await session.close();
    this.sessions.delete(adbId);
  }

  async disconnectAll() {
    await Promise.all(Array.from(this.sessions.keys()).map((adbId) => this.disconnect(adbId)));
  }
}

module.exports = { AndroidSyncManager, AndroidSyncSession, MOTION_ACTION_DOWN, MOTION_ACTION_UP, MOTION_ACTION_MOVE };
