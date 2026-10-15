// ═══════════════════════════════════════════════════════════════════════════════
// Modul CCTV — sisi main process
// Dipindah dari electron-main.js. Data kamera tetap di <userData>/cctv-cameras.json
// dan FFmpeg portable di <userData>/tools agar instalasi lama langsung terbaca.
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const CctvManager = require('./cctv-manager');

let cctvManager = null;

function register(ctx) {
  const { ipcMain, app, BrowserWindow, dialog } = ctx.electron;
  const { requireShared } = ctx;

  const cctvDbPath    = path.join(ctx.paths.userData, 'cctv-cameras.json');
  const cctvToolsPath = path.join(ctx.paths.userData, 'tools');
  cctvManager = new CctvManager(cctvDbPath, cctvToolsPath);
  // Restore portable ffmpeg path if already installed
  if (process.platform === 'win32') {
    const portableBin = cctvManager._findPortableFfmpegWin();
    if (portableBin) cctvManager.setFfmpegBin(portableBin);
  }

  // ── CCTV ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('cctv-get-cameras', () => {
    return { cameras: cctvManager.getCameras() };
  });

  ipcMain.handle('cctv-save-camera', (_e, camera) => {
    const saved = cctvManager.saveCamera(camera);
    return { success: true, camera: saved };
  });

  ipcMain.handle('cctv-delete-camera', (_e, uid) => {
    cctvManager.stopStream(uid);
    cctvManager.deleteCamera(uid);
    return { success: true };
  });

  ipcMain.handle('cctv-start-stream', async (_e, camera) => {
    try {
      const result = await cctvManager.startStream(camera);
      return { success: true, port: result.port };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('cctv-stop-stream', (_e, uid) => {
    cctvManager.stopStream(uid);
    return { success: true };
  });

  ipcMain.handle('cctv-stream-status', (_e, uid) => {
    return cctvManager.getStreamStatus(uid);
  });

  ipcMain.handle('cctv-snapshot', async (_e, camera) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Simpan Screenshot CCTV',
        defaultPath: `cctv-${camera.name || 'snapshot'}-${Date.now()}.jpg`,
        filters: [{ name: 'JPEG Image', extensions: ['jpg'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      const outPath = await cctvManager.takeSnapshot(camera, result.filePath);
      return { success: true, path: outPath };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('cctv-check-ffmpeg', async () => {
    return cctvManager.checkFfmpeg();
  });

  // ── FFmpeg auto-install (semua platform) ─────────────────────────────────────
  ipcMain.handle('cctv-install-ffmpeg', async (event) => {
    const win  = BrowserWindow.fromWebContents(event.sender);
    const plat = process.platform;
    const send = (phase, pct, message) => {
      win?.webContents?.send('cctv-ffmpeg-install-progress', { phase, pct, message });
    };

    try {
      // ── Windows: download portable zip ──────────────────────────────────────
      if (plat === 'win32') {
        const toolsDir  = path.join(app.getPath('userData'), 'tools');
        const ffmpegDir = path.join(toolsDir, 'ffmpeg');
        const zipPath   = path.join(toolsDir, 'ffmpeg-download.zip');
        fs.mkdirSync(ffmpegDir, { recursive: true });

        const existing = cctvManager._findPortableFfmpegWin();
        if (existing) {
          cctvManager.setFfmpegBin(existing);
          return { success: true, path: existing, cached: true };
        }

        send('download', 0, 'Memulai download FFmpeg untuk Windows...');
        const downloadUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

        await new Promise((resolve, reject) => {
          const doGet = (url, hops = 0) => {
            if (hops > 10) { reject(new Error('Terlalu banyak redirect')); return; }
            const mod  = url.startsWith('https') ? require('https') : require('http');
            const file = fs.createWriteStream(zipPath);
            let downloaded = 0, total = 0, lastPct = -1;
            const req = mod.get(url, { timeout: 120000 }, (res) => {
              if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                file.close(); fs.unlink(zipPath, () => {});
                const loc = res.headers.location;
                if (!loc) { reject(new Error('Redirect tanpa Location')); return; }
                doGet(loc.startsWith('http') ? loc : new URL(loc, url).href, hops + 1);
                return;
              }
              if (res.statusCode !== 200) {
                file.close(); fs.unlink(zipPath, () => {});
                reject(new Error(`HTTP ${res.statusCode}`)); return;
              }
              total = parseInt(res.headers['content-length'] || '0', 10);
              send('download', 0, total > 0 ? `Total: ${(total / 1024 / 1024).toFixed(1)} MB` : 'Mengunduh FFmpeg...');
              // Manually track progress then pipe to file
              res.on('data', (chunk) => {
                downloaded += chunk.length;
                const pct = total > 0 ? Math.round((downloaded / total) * 100) : -1;
                // Only send progress every 1% change to avoid flooding IPC
                if (pct !== lastPct) {
                  lastPct = pct;
                  const mb = (downloaded / 1024 / 1024).toFixed(1);
                  const totalMb = total > 0 ? `/${(total / 1024 / 1024).toFixed(1)} MB` : ' MB';
                  send('download', pct >= 0 ? pct : 0, `Mengunduh: ${mb}${totalMb}${pct >= 0 ? ` (${pct}%)` : ''}`);
                }
                file.write(chunk);
              });
              res.on('end', () => { file.end(); });
              file.on('finish', () => { resolve(); });
            });
            req.on('error', (e) => { file.close(); fs.unlink(zipPath, () => {}); reject(e); });
            req.on('timeout', () => { req.destroy(); file.close(); fs.unlink(zipPath, () => {}); reject(new Error('Download timeout — koneksi terlalu lambat')); });
          };
          doGet(downloadUrl);
        });

        send('extract', 0, 'Mengekstrak FFmpeg...');
        const extractZipLib = requireShared('extract-zip');
        await extractZipLib(zipPath, { dir: ffmpegDir });
        fs.unlink(zipPath, () => {});

        const binPath = cctvManager._findPortableFfmpegWin();
        if (!binPath) throw new Error('ffmpeg.exe tidak ditemukan setelah ekstrak.');
        cctvManager.setFfmpegBin(binPath);
        send('done', 100, 'FFmpeg berhasil diinstall!');
        return { success: true, path: binPath };
      }

      // ── macOS: brew install ffmpeg ───────────────────────────────────────────
      if (plat === 'darwin') {
        const brewCheck = spawnSync('brew', ['--version'], { timeout: 5000 });
        if (brewCheck.error) {
          return {
            success: false,
            message: 'Homebrew tidak ditemukan. Install Homebrew dulu di https://brew.sh, lalu jalankan: brew install ffmpeg',
            manualUrl: 'https://brew.sh',
          };
        }
        send('install', 0, 'Menginstall FFmpeg via Homebrew...');
        await new Promise((resolve, reject) => {
          const child = spawn('brew', ['install', 'ffmpeg'], { stdio: ['ignore', 'pipe', 'pipe'] });
          child.stdout.on('data', (d) => send('install', -1, d.toString().trim()));
          child.stderr.on('data', (d) => send('install', -1, d.toString().trim()));
          child.on('error', reject);
          child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`brew exit code ${code}`)));
        });
        send('done', 100, 'FFmpeg berhasil diinstall via Homebrew!');
        return { success: true };
      }

      // ── Linux: apt install ffmpeg ────────────────────────────────────────────
      send('install', 0, 'Menginstall FFmpeg via apt...');
      await new Promise((resolve, reject) => {
        const child = spawn('sudo', ['apt-get', 'install', '-y', 'ffmpeg'], { stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', (d) => send('install', -1, d.toString().trim()));
        child.stderr.on('data', (d) => send('install', -1, d.toString().trim()));
        child.on('error', reject);
        child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`apt exit code ${code}`)));
      });
      send('done', 100, 'FFmpeg berhasil diinstall via apt!');
      return { success: true };

    } catch (err) {
      send('error', 0, `Gagal: ${err.message}`);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('cctv-scan-onvif', async (event, opts = {}) => {
    const { username = '', password = '', subnetInput = '' } = opts;
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
      const results = await cctvManager.scanOnvif({
        username, password, subnetInput,
        onProgress: (payload) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('cctv-scan-progress', payload);
          }
        },
      });
      return { success: true, devices: results };
    } catch (err) {
      return { success: false, message: err.message, devices: [] };
    }
  });

  ipcMain.handle('cctv-probe-onvif', async (_e, ip, port, username, password) => {
    try {
      const result = await cctvManager.probeOnvifDevice(ip, port || 80, username || '', password || '');
      return { success: !!result, device: result };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('cctv-ptz-move', async (_e, { ip, port, username, password, profileToken, pan, tilt, zoom, ptzUrl }) => {
    try {
      await cctvManager.ptzContinuousMove(ip, port || 80, username || '', password || '', profileToken, pan || 0, tilt || 0, zoom || 0, ptzUrl || null);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('cctv-ptz-stop', async (_e, { ip, port, username, password, profileToken, ptzUrl }) => {
    try {
      await cctvManager.ptzStop(ip, port || 80, username || '', password || '', profileToken, ptzUrl || null);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('cctv-ptz-presets', async (_e, { ip, port, username, password, profileToken, ptzUrl }) => {
    try {
      const presets = await cctvManager.ptzGetPresets(ip, port || 80, username || '', password || '', profileToken, ptzUrl || null);
      return { success: true, presets };
    } catch (err) {
      return { success: false, message: err.message, presets: [] };
    }
  });

  ipcMain.handle('cctv-ptz-goto-preset', async (_e, { ip, port, username, password, profileToken, presetToken, ptzUrl }) => {
    try {
      await cctvManager.ptzGotoPreset(ip, port || 80, username || '', password || '', profileToken, presetToken, ptzUrl || null);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('cctv-ptz-set-preset', async (_e, { ip, port, username, password, profileToken, presetName, ptzUrl }) => {
    try {
      const r = await cctvManager.ptzSetPreset(ip, port || 80, username || '', password || '', profileToken, presetName || '', ptzUrl || null);
      return { success: true, token: r.token };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

function getStats() {
  return { cctvStreams: cctvManager?.streams?.size || 0 };
}

function shutdown() {
  if (cctvManager) cctvManager.stopAll();
}

module.exports = { register, getStats, shutdown };
