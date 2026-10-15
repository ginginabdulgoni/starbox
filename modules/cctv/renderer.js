// ═══════════════════════════════════════════════════════════════════════════════
// Modul CCTV — sisi renderer
// Dimuat oleh core (index.html) setelah renderer.js. Semua komunikasi ke main
// process lewat window.electronAPI.modules, yang hanya meneruskan channel
// yang dideklarasikan di manifest.json modul ini.
// ═══════════════════════════════════════════════════════════════════════════════

const cctvApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    getCameras:    call('cctv-get-cameras'),
    saveCamera:    call('cctv-save-camera'),
    deleteCamera:  call('cctv-delete-camera'),
    startStream:   call('cctv-start-stream'),
    stopStream:    call('cctv-stop-stream'),
    streamStatus:  call('cctv-stream-status'),
    snapshot:      call('cctv-snapshot'),
    checkFfmpeg:   call('cctv-check-ffmpeg'),
    installFfmpeg: call('cctv-install-ffmpeg'),
    onFfmpegInstallProgress: (cb) => m.on('cctv-ffmpeg-install-progress', cb),
    scanOnvif:     call('cctv-scan-onvif'),
    probeOnvif:    call('cctv-probe-onvif'),
    onScanProgress: (cb) => m.on('cctv-scan-progress', cb),
    ptzMove:       call('cctv-ptz-move'),
    ptzStop:       call('cctv-ptz-stop'),
    ptzPresets:    call('cctv-ptz-presets'),
    ptzGotoPreset: call('cctv-ptz-goto-preset'),
    ptzSetPreset:  call('cctv-ptz-set-preset'),
  };
})();

let _cctvCameras    = [];
let _cctvLayout     = 4;       // 1, 4, 9, 16
let _cctvStreaming  = new Map(); // uid → { port, type, refreshTimer }
let _hlsInstances  = new Map(); // uid → Hls instance
let _cctvSearchQuery = "";

let _cctvAutoConnectDone = false;

function updateCctvMetrics() {
  const total = _cctvCameras.length;
  const live = _cctvStreaming.size;
  const rtsp = _cctvCameras.filter((c) => c.type === 'rtsp' || (c.url && c.url.startsWith('rtsp://')) || c.onvifIp).length;
  const layoutLabel = _cctvLayout === 1 ? '1×1 (Single)' : _cctvLayout === 4 ? '2×2 (Quad)' : _cctvLayout === 9 ? '3×3 (Grid)' : '4×4 (Matrix)';

  const elTotal = document.getElementById('metricCctvTotal');
  const elLive = document.getElementById('metricCctvLive');
  const elRtsp = document.getElementById('metricCctvRtsp');
  const elLayout = document.getElementById('metricCctvLayout');

  if (elTotal) elTotal.textContent = total;
  if (elLive) elLive.textContent = live;
  if (elRtsp) elRtsp.textContent = rtsp;
  if (elLayout) elLayout.textContent = layoutLabel;
}

function cctvFilterSearch() {
  const input = document.getElementById('cctvSearchInput');
  _cctvSearchQuery = (input?.value || '').toLowerCase().trim();
  cctvRenderGrid();
}
window.cctvFilterSearch = cctvFilterSearch;
window.updateCctvMetrics = updateCctvMetrics;

async function cctvInit() {
  await cctvCheckFfmpeg();
  await cctvLoadCameras();
  updateCctvMetrics();
  cctvRenderGrid();
  // First access this session: auto-connect all registered cameras
  if (!_cctvAutoConnectDone && _cctvCameras.length > 0) {
    _cctvAutoConnectDone = true;
    for (const cam of _cctvCameras) {
      if (!_cctvStreaming.has(cam.uid)) {
        cctvConnect(cam.uid);
      }
    }
  }
}

function bindAndroidWhatsAppUrlSync(baseInputId, callbackInputId) {
  const baseInput = document.getElementById(baseInputId);
  const callbackInput = document.getElementById(callbackInputId);
  if (!baseInput || !callbackInput) return;
  if (baseInput.dataset.callbackSyncBound === "true") return;
  baseInput.dataset.callbackSyncBound = "true";

  const syncCallbackFromBase = () => {
    const normalizedCallback = getNormalizedCallbackInput(
      baseInput.value,
      callbackInput.value
    );
    if (!sanitizePendingUrl(callbackInput.value) && normalizedCallback) {
      callbackInput.value = normalizedCallback;
    }
  };

  baseInput.addEventListener("blur", syncCallbackFromBase);
  baseInput.addEventListener("change", syncCallbackFromBase);
}

async function cctvCheckFfmpeg() {
  const dot    = document.getElementById('cctvStatusDot');
  const text   = document.getElementById('cctvStatusText');
  const btn        = document.getElementById('cctvInstallFfmpegBtn');
  const tutorialBtn = document.getElementById('cctvFfmpegTutorialBtn');
  const banner = document.getElementById('cctvFfmpegMissingBanner');
  try {
    const r = await cctvApi.checkFfmpeg();
    if (r.available) {
      if (dot)         dot.style.background = '#22c55e';
      if (text)        text.textContent = 'ffmpeg tersedia';
      if (btn)         btn.style.display = 'none';
      if (tutorialBtn) tutorialBtn.style.display = 'none';
      if (banner)      banner.style.display = 'none';
    } else {
      if (dot)         dot.style.background = '#f59e0b';
      if (text)        text.textContent = 'ffmpeg tidak ditemukan';
      if (btn)         btn.style.display = 'inline-flex';
      if (tutorialBtn) tutorialBtn.style.display = 'inline-flex';
      if (banner)      banner.style.display = 'flex';
    }
  } catch {
    if (dot)         dot.style.background = '#666';
    if (text)        text.textContent = '';
    if (btn)         btn.style.display = 'none';
    if (tutorialBtn) tutorialBtn.style.display = 'none';
    if (banner)      banner.style.display = 'none';
  }
}

async function cctvInstallFfmpeg() {
  const allBtns = [
    document.getElementById('cctvInstallFfmpegBtn'),
    document.getElementById('cctvInstallFfmpegBannerBtn'),
  ];
  allBtns.forEach(b => { if (b) { b.disabled = true; b.textContent = 'Menginstall...'; } });

  const plat = process.platform;
  const desc = plat === 'win32'
    ? 'Mengunduh FFmpeg portable (~90 MB)...'
    : plat === 'darwin'
      ? 'Menginstall FFmpeg via Homebrew...'
      : 'Menginstall FFmpeg via apt...';

  // Buffer progress messages before Swal DOM is ready
  const _msgBuffer = [];
  let _logEl = null, _barEl = null, _pctEl = null;

  const _flushBuffer = () => {
    if (!_logEl) return;
    for (const msg of _msgBuffer) {
      const line = document.createElement('div');
      line.textContent = msg;
      _logEl.appendChild(line);
    }
    _msgBuffer.length = 0;
    _logEl.scrollTop = _logEl.scrollHeight;
  };

  const _appendLog = (msg) => {
    if (!_logEl) { _msgBuffer.push(msg); return; }
    const line = document.createElement('div');
    line.textContent = msg;
    _logEl.appendChild(line);
    _logEl.scrollTop = _logEl.scrollHeight;
  };

  let unsubscribe = null;
  try {
    Swal.fire({
      title: 'Install FFmpeg / RTSP',
      html: `<p style="margin-bottom:8px;font-size:0.9rem;">${desc}</p>
             <div style="margin-bottom:8px;">
               <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px;">
                 <span id="ffmpegPhaseLabel">Memulai...</span>
                 <span id="ffmpegPctLabel">0%</span>
               </div>
               <div style="background:#333;border-radius:4px;height:8px;overflow:hidden;">
                 <div id="ffmpegProgressBar" style="background:#3b82f6;height:100%;width:0%;transition:width 0.3s;"></div>
               </div>
             </div>
             <div style="text-align:left;max-height:160px;overflow-y:auto;font-size:0.75rem;
                  font-family:monospace;background:#111;padding:8px;border-radius:6px;" id="ffmpegInstallLog">
             </div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        _logEl  = document.getElementById('ffmpegInstallLog');
        _barEl  = document.getElementById('ffmpegProgressBar');
        _pctEl  = document.getElementById('ffmpegPctLabel');
        _flushBuffer();
      },
    });

    unsubscribe = cctvApi.onFfmpegInstallProgress((data) => {
      if (data.message) _appendLog(data.message);
      if (data.phase === 'download' && data.pct >= 0) {
        if (_barEl)  _barEl.style.width  = `${data.pct}%`;
        if (_pctEl)  _pctEl.textContent  = `${data.pct}%`;
        const phaseEl = document.getElementById('ffmpegPhaseLabel');
        if (phaseEl) phaseEl.textContent = 'Mengunduh...';
      } else if (data.phase === 'extract') {
        if (_barEl)  _barEl.style.width  = '95%';
        if (_pctEl)  _pctEl.textContent  = '95%';
        const phaseEl = document.getElementById('ffmpegPhaseLabel');
        if (phaseEl) phaseEl.textContent = 'Mengekstrak...';
      } else if (data.phase === 'done') {
        if (_barEl)  _barEl.style.width  = '100%';
        if (_barEl)  _barEl.style.background = '#22c55e';
        if (_pctEl)  _pctEl.textContent  = '100%';
        const phaseEl = document.getElementById('ffmpegPhaseLabel');
        if (phaseEl) phaseEl.textContent = 'Selesai!';
      } else if (data.phase === 'error') {
        if (_barEl)  _barEl.style.background = '#ef4444';
        const phaseEl = document.getElementById('ffmpegPhaseLabel');
        if (phaseEl) phaseEl.textContent = 'Error';
      } else if (data.phase === 'install') {
        // brew/apt: indeterminate — animate bar
        if (_barEl && !_barEl._anim) {
          _barEl._anim = true;
          _barEl.style.transition = 'none';
          _barEl.style.width = '30%';
          _barEl.style.background = 'linear-gradient(90deg,#3b82f6,#8b5cf6)';
        }
        const phaseEl = document.getElementById('ffmpegPhaseLabel');
        if (phaseEl) phaseEl.textContent = 'Menginstall...';
      }
    });

    const result = await cctvApi.installFfmpeg();
    if (unsubscribe) unsubscribe();

    if (result.success) {
      await Swal.fire({ icon: 'success', title: 'FFmpeg Terinstall', text: 'FFmpeg / RTSP siap digunakan.', confirmButtonText: 'OK' });
      await cctvCheckFfmpeg();
    } else {
      const opts = { icon: 'error', title: 'Gagal Install FFmpeg', text: result.message || 'Terjadi kesalahan.', confirmButtonText: 'OK' };
      if (result.manualUrl) opts.footer = `<a href="${result.manualUrl}" target="_blank">Download Manual</a>`;
      await Swal.fire(opts);
    }
  } catch (err) {
    if (unsubscribe) unsubscribe();
    Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonText: 'OK' });
  } finally {
    allBtns.forEach(b => { if (b) { b.disabled = false; b.innerHTML = '<i class="bi bi-download"></i> Install FFmpeg'; } });
  }
}

async function cctvLoadCameras() {
  try {
    const r = await cctvApi.getCameras();
    _cctvCameras = r.cameras || [];
  } catch (e) {
    console.error('[CCTV] load cameras error', e);
    _cctvCameras = [];
  }
}

function cctvSetLayout(n) {
  _cctvLayout = n;
  const grid = document.getElementById('cctvGrid');
  if (grid) {
    grid.className = `cctv-grid cctv-grid-${n}`;
  }
  [1,4,9,16].forEach(x => {
    const btn = document.getElementById(`cctvLayout${x}`);
    if (btn) btn.classList.toggle('active', x === n);
  });
  updateCctvMetrics();
  cctvRenderGrid();
}

function cctvRenderGrid() {
  const grid = document.getElementById('cctvGrid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.className = `cctv-grid cctv-grid-${_cctvLayout}`;

  let displayedCams = _cctvCameras;
  if (_cctvSearchQuery) {
    const q = _cctvSearchQuery.toLowerCase();
    displayedCams = _cctvCameras.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.url || '').toLowerCase().includes(q) ||
      (c.onvifIp || '').toLowerCase().includes(q)
    );
  }

  const totalCells = _cctvLayout;
  for (let i = 0; i < totalCells; i++) {
    const cam = displayedCams[i] || null;
    grid.appendChild(cam ? cctvBuildCell(cam) : cctvBuildEmptyCell(i));
  }

  // If more cameras than cells, show the rest as extra cells below
  if (displayedCams.length > totalCells) {
    for (let i = totalCells; i < displayedCams.length; i++) {
      grid.appendChild(cctvBuildCell(displayedCams[i]));
    }
  }

  updateCctvMetrics();
}

function cctvBuildEmptyCell(idx) {
  const div = document.createElement('div');
  div.className = 'cctv-cell';
  div.innerHTML = `
    <div class="cctv-empty-cell">
      <i class="bi bi-camera-video-off"></i>
      <span>Slot ${idx + 1}</span>
    </div>`;
  return div;
}

function cctvBuildCell(cam) {
  const div = document.createElement('div');
  div.className = 'cctv-cell';
  div.id = `cctvCell_${cam.uid}`;
  div.setAttribute('data-uid', cam.uid);

  const streamInfo = _cctvStreaming.get(cam.uid);
  const isStreaming = !!streamInfo;

  if (isStreaming) {
    div.classList.add('streaming');
    if (cam.type === 'hls') {
      div.innerHTML = `
        <video id="cctvVideo_${cam.uid}" autoplay muted playsinline style="width:100%;height:100%;object-fit:contain;background:#000;"></video>
        <span class="cctv-live-badge">● LIVE</span>`;
    } else if (cam.type === 'snapshot') {
      const src = cam.url + (cam.url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      div.innerHTML = `
        <img id="cctvImg_${cam.uid}" src="${src}" style="width:100%;height:100%;object-fit:contain;background:#000;" alt="${cam.name}">
        <span class="cctv-live-badge">● LIVE</span>`;
    } else if (cam.type === 'http-mjpeg') {
      div.innerHTML = `
        <canvas id="cctvCanvas_${cam.uid}" style="width:100%;height:100%;object-fit:contain;background:#000;display:block;"></canvas>
        <div id="cctvStreamStatus_${cam.uid}" style="display:none;"></div>
        <span id="cctvLiveBadge_${cam.uid}" class="cctv-live-badge">● LIVE</span>`;
    } else {
      // RTSP proxy via localhost — use canvas reader
      div.innerHTML = `
        <canvas id="cctvCanvas_${cam.uid}" style="width:100%;height:100%;object-fit:contain;background:#000;display:block;"></canvas>
        <div id="cctvStreamStatus_${cam.uid}" style="display:none;"></div>
        <span id="cctvLiveBadge_${cam.uid}" class="cctv-live-badge">● LIVE</span>`;
    }
  } else {
    div.innerHTML = `
      <div class="cctv-placeholder">
        <i class="bi bi-camera-video" style="color:#222;"></i>
        <span style="font-size:0.8rem;color:#444;">${cam.name}</span>
        <button onclick="cctvConnect('${cam.uid}')" style="background:var(--color-primary);color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:0.8rem;">
          <i class="bi bi-play-fill"></i> Hubungkan
        </button>
      </div>`;
  }

  const hasPtz = !!(cam.onvifIp && cam.onvifToken);

  // Overlay
  div.innerHTML += `
    <div class="cctv-overlay">
      <span class="cctv-label">${cam.name}</span>
      <div class="cctv-actions">
        ${isStreaming ? `<button onclick="cctvDisconnect('${cam.uid}')">⏹ Stop</button>` : `<button onclick="cctvConnect('${cam.uid}')">▶ Live</button>`}
        ${isStreaming ? `<button onclick="cctvReload('${cam.uid}')" title="Reload stream">↺</button>` : ''}
        ${hasPtz ? `<button onclick="cctvOpenPtz('${cam.uid}')" title="PTZ Control" style="background:#7c3aed;">🎮 PTZ</button>` : ''}
        <button onclick="cctvSnapshot('${cam.uid}')">📷</button>
        <button onclick="cctvFullscreen('${cam.uid}')">⛶</button>
        <button onclick="cctvOpenEditModal('${cam.uid}')">✏</button>
        <button onclick="cctvDeleteCamera('${cam.uid}')" style="color:#fca5a5;">🗑</button>
      </div>
    </div>`;

  // Double click → fullscreen
  div.addEventListener('dblclick', () => cctvFullscreen(cam.uid));

  // If HLS, init after DOM insert
  if (isStreaming && cam.type === 'hls') {
    setTimeout(() => cctvInitHls(cam), 50);
  }

  // If snapshot, start refresh timer
  if (isStreaming && cam.type === 'snapshot') {
    cctvStartSnapshotRefresh(cam);
  }

  // If RTSP proxy or direct MJPEG, start canvas reader
  if (isStreaming && (cam.type === 'rtsp' || cam.type === 'http-mjpeg')) {
    setTimeout(() => cctvStartCanvasStream(cam), 50);
  }

  return div;
}

// ── Connect / Disconnect ─────────────────────────────────────────────────────

async function cctvConnect(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;

  const cell = document.getElementById(`cctvCell_${uid}`);
  if (cell) {
    cell.innerHTML = `<div class="cctv-placeholder"><i class="bi bi-arrow-repeat" style="color:var(--color-primary);animation:spin 1s linear infinite;font-size:2rem;"></i><span style="font-size:0.8rem;color:#888;">Menghubungkan...</span></div>`;
  }

  try {
    if (cam.type === 'http-mjpeg') {
      // Direct MJPEG — no proxy needed
      _cctvStreaming.set(uid, { port: null, type: 'http-mjpeg' });
    } else if (cam.type === 'snapshot') {
      _cctvStreaming.set(uid, { port: null, type: 'snapshot' });
    } else if (cam.type === 'hls') {
      _cctvStreaming.set(uid, { port: null, type: 'hls' });
    } else {
      // RTSP → ffmpeg proxy
      const r = await cctvApi.startStream(cam);
      if (!r.success) throw new Error(r.message || 'Gagal memulai stream');
      _cctvStreaming.set(uid, { port: r.port, type: 'rtsp' });
    }
    cctvRenderGrid();
  } catch (err) {
    _cctvStreaming.delete(uid);
    if (cell) {
      cell.innerHTML = `
        <div class="cctv-placeholder">
          <i class="bi bi-exclamation-triangle" style="color:#ef4444;font-size:2rem;"></i>
          <span style="font-size:0.75rem;color:#ef4444;text-align:center;padding:0 10px;">${err.message}</span>
          <button onclick="cctvConnect('${uid}')" style="background:#ef4444;color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:0.78rem;">Coba Lagi</button>
        </div>`;
    }
    console.error('[CCTV] connect error', err);
  }
}

async function cctvReload(uid) {
  const info = _cctvStreaming.get(uid);
  if (!info) { return cctvConnect(uid); }
  // Abort current stream so reconnect loop restarts immediately
  if (info.abortCtrl) { try { info.abortCtrl.abort(); } catch (_e) {} }
}

async function cctvDisconnect(uid) {
  const info = _cctvStreaming.get(uid);
  if (info && info.refreshTimer) clearInterval(info.refreshTimer);
  if (info && info.abortCtrl) { try { info.abortCtrl.abort(); } catch (_e) {} }
  // destroy HLS instance
  const hls = _hlsInstances.get(uid);
  if (hls) { try { hls.destroy(); } catch (_e) {} _hlsInstances.delete(uid); }
  _cctvStreaming.delete(uid);
  await cctvApi.stopStream(uid);
  cctvRenderGrid();
}

// ── HLS ──────────────────────────────────────────────────────────────────────

function cctvInitHls(cam) {
  const video = document.getElementById(`cctvVideo_${cam.uid}`);
  if (!video) return;

  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(cam.url);
    hls.attachMedia(video);
    _hlsInstances.set(cam.uid, hls);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = cam.url;
  }
}

// ── Snapshot refresh ─────────────────────────────────────────────────────────

function cctvStartSnapshotRefresh(cam) {
  const info = _cctvStreaming.get(cam.uid);
  if (!info) return;
  const intervalSec = cam.refreshSec || 5;
  const timer = setInterval(() => {
    const img = document.getElementById(`cctvImg_${cam.uid}`);
    if (!img) { clearInterval(timer); return; }
    img.src = cam.url + (cam.url.includes('?') ? '&' : '?') + '_t=' + Date.now();
  }, intervalSec * 1000);
  info.refreshTimer = timer;
}

// ── Canvas MJPEG reader ───────────────────────────────────────────────────────

function _classifyStreamError(err) {
  if (!err) return 'Stream terputus';
  const msg = (err.message || '').toLowerCase();
  if (msg === 'read_timeout')                    return 'Timeout / RTO (tdk ada data)';
  if (msg.includes('failed to fetch') ||
      msg.includes('err_connection_refused') ||
      msg.includes('econnrefused'))              return 'Koneksi ditolak (ECONNREFUSED)';
  if (msg.includes('timed_out') ||
      msg.includes('err_connection_timed_out'))  return 'Koneksi timeout (RTO)';
  if (msg.includes('http 401'))                  return 'Autentikasi gagal (401)';
  if (msg.includes('http 403'))                  return 'Akses ditolak (403)';
  if (msg.includes('http 404'))                  return 'Stream tdk ditemukan (404)';
  if (msg.includes('http 5'))                    return `Error server (${err.message})`;
  if (msg.includes('network'))                   return 'Jaringan terputus';
  return (err.message || 'Stream terputus').slice(0, 50);
}

function cctvSetStreamStatus(uid, msg, type) {
  const el = document.getElementById(`cctvStreamStatus_${uid}`);
  if (!el) return;
  if (!msg) { el.style.display = 'none'; return; }
  const bg = type === 'error' ? 'rgba(239,68,68,0.88)' : 'rgba(30,27,46,0.88)';
  const ic = type === 'error' ? '⚠ ' : type === 'connecting' ? '↻ ' : '';
  el.style.cssText = `position:absolute;bottom:28px;left:0;right:0;text-align:center;padding:4px 8px;background:${bg};color:#fff;font-size:0.68rem;font-weight:600;display:block;z-index:3;pointer-events:none;letter-spacing:0.01em;`;
  el.textContent = ic + msg;
}

// Returns { stopped: bool, error? }
// stopped=true  → AbortError from user disconnect, do NOT reconnect
// stopped=false → stream ended/error, reconnect is OK
async function cctvDrawCanvasFromUrl(canvas, url, outerAbortCtrl, uid) {
  const ctx = canvas.getContext('2d');
  const JPEG_SOI = 0xFF, JPEG_EOI_BYTE = 0xD9, JPEG_START = 0xD8;
  const FREEZE_TIMEOUT_MS = 15000; // abort stream if no data for 15s

  let lastFrameTs = Date.now();
  let frameCount  = 0;

  // Watchdog: if no data for FREEZE_TIMEOUT_MS, abort the fetch
  let freezeTimer = setTimeout(() => outerAbortCtrl.abort('freeze'), FREEZE_TIMEOUT_MS);
  const resetFreeze = () => {
    clearTimeout(freezeTimer);
    freezeTimer = setTimeout(() => outerAbortCtrl.abort('freeze'), FREEZE_TIMEOUT_MS);
  };

  // Live badge — update every second
  const badgeTimer = setInterval(() => {
    const badge = document.getElementById(`cctvLiveBadge_${uid}`);
    if (!badge) { clearInterval(badgeTimer); return; }
    const idle = Math.round((Date.now() - lastFrameTs) / 1000);
    if (idle < 3) {
      badge.textContent = '● LIVE';
      badge.style.color = '#22c55e';
    } else {
      badge.textContent = `⚠ ${idle}s idle`;
      badge.style.color = '#f59e0b';
    }
  }, 1000);

  const cleanup = () => {
    clearInterval(badgeTimer);
    clearTimeout(freezeTimer);
  };

  try {
    const resp = await fetch(url, { signal: outerAbortCtrl.signal });
    if (!resp.ok) { cleanup(); return { error: new Error(`HTTP ${resp.status}`), stopped: false }; }

    const reader = resp.body.getReader();
    let buf = new Uint8Array(0);

    const append = (chunk) => {
      const merged = new Uint8Array(buf.length + chunk.length);
      merged.set(buf);
      merged.set(chunk, buf.length);
      buf = merged;
    };

    const findFrame = () => {
      let start = -1;
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i] === JPEG_SOI && buf[i + 1] === JPEG_START) { start = i; break; }
      }
      if (start < 0) { buf = new Uint8Array(0); return null; }
      for (let i = start + 2; i < buf.length - 1; i++) {
        if (buf[i] === JPEG_SOI && buf[i + 1] === JPEG_EOI_BYTE) {
          const frame = buf.slice(start, i + 2);
          buf = buf.slice(i + 2);
          return frame;
        }
      }
      if (start > 0) buf = buf.slice(start);
      return null;
    };

    while (true) {
      const { value, done } = await reader.read(); // AbortSignal cancels this properly
      if (done) { cleanup(); return { error: new Error('Stream terputus oleh server'), stopped: false }; }
      resetFreeze();
      append(value);
      let frame;
      while ((frame = findFrame()) !== null) {
        try {
          const blob = new Blob([frame], { type: 'image/jpeg' });
          const bmp  = await createImageBitmap(blob);
          canvas.width  = bmp.width;
          canvas.height = bmp.height;
          ctx.drawImage(bmp, 0, 0);
          bmp.close();
          frameCount++;
          lastFrameTs = Date.now();
          if (frameCount === 1) cctvSetStreamStatus(uid, '', '');
        } catch (_e) { /* skip bad frame */ }
      }
    }
  } catch (err) {
    cleanup();
    if (err.name === 'AbortError') {
      // Distinguish freeze-abort vs user-disconnect-abort
      const isFrozen = outerAbortCtrl.signal.reason === 'freeze';
      if (isFrozen) return { error: new Error('Stream beku (15s tdk ada data)'), stopped: false };
      return { stopped: true }; // user disconnected
    }
    return { error: err, stopped: false };
  }
}

async function cctvStartCanvasStream(cam) {
  const RETRY_DELAYS = [3000, 5000, 8000, 10000, 15000];
  let attempt = 0;

  while (_cctvStreaming.has(cam.uid)) {
    const info = _cctvStreaming.get(cam.uid);
    if (!info) return;

    // ── For RTSP: restart ffmpeg proxy on every attempt ──────────────────────
    if (cam.type === 'rtsp') {
      cctvSetStreamStatus(cam.uid, attempt > 0 ? `↻ Memulai ulang stream (${attempt})...` : 'Memulai ffmpeg...', 'connecting');
      try {
        const r = await cctvApi.startStream(cam);
        if (!r.success) throw new Error(r.message || 'Gagal memulai proxy');
        info.port = r.port; // update port in case it changed
      } catch (err) {
        attempt++;
        const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
        for (let i = Math.round(delay / 1000); i > 0; i--) {
          if (!_cctvStreaming.has(cam.uid)) return;
          cctvSetStreamStatus(cam.uid, `ffmpeg gagal: ${err.message} — retry ${i}s`, 'error');
          await new Promise(r => setTimeout(r, 1000));
        }
        continue;
      }
      // Small delay to let ffmpeg initialize before we fetch
      await new Promise(r => setTimeout(r, 500));
    }

    const url    = cam.type === 'http-mjpeg' ? cam.url : `http://127.0.0.1:${info.port}/`;
    const canvas = document.getElementById(`cctvCanvas_${cam.uid}`);
    if (!canvas) return;

    // Create a fresh AbortController for this attempt
    const abortCtrl = new AbortController();
    info.abortCtrl  = abortCtrl;

    cctvSetStreamStatus(cam.uid, attempt > 0 ? `Menghubungkan ulang (${attempt})...` : 'Menghubungkan...', 'connecting');

    const { error, stopped } = await cctvDrawCanvasFromUrl(canvas, url, abortCtrl, cam.uid);

    if (stopped || !_cctvStreaming.has(cam.uid)) return;

    // Stream ended / errored — check ffmpeg log for details, then reconnect
    attempt++;
    let errMsg = _classifyStreamError(error);

    // Try to get ffmpeg error log from proxy
    try {
      const st = await cctvApi.streamStatus(cam.uid);
      if (st && st.ffmpegLog) {
        const log = st.ffmpegLog.slice(-300); // last 300 chars
        if (log.includes('Connection refused'))      errMsg = 'RTSP: Koneksi ditolak';
        else if (log.includes('401 Unauthorized'))   errMsg = 'RTSP: Auth gagal (401)';
        else if (log.includes('No route to host'))   errMsg = 'RTSP: Host tidak terjangkau';
        else if (log.includes('Connection timed out')) errMsg = 'RTSP: Timeout';
        else if (log.includes('Invalid data'))       errMsg = 'RTSP: URL/format tidak valid';
        else if (log.includes('No such file'))       errMsg = 'ffmpeg tidak ditemukan';
      }
    } catch {}

    const delay    = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
    const delaySec = Math.round(delay / 1000);
    console.warn(`[CCTV] ${cam.name} — ${errMsg}, retry in ${delaySec}s (attempt ${attempt})`);

    for (let i = delaySec; i > 0; i--) {
      if (!_cctvStreaming.has(cam.uid)) return;
      cctvSetStreamStatus(cam.uid, `${errMsg} — reconnect ${i}s`, 'error');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── Snapshot save ─────────────────────────────────────────────────────────────

async function cctvSnapshot(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  try {
    const r = await cctvApi.snapshot(cam);
    if (r.success) {
      cctvToast(`Screenshot disimpan ke: ${r.path}`, 'success');
    } else if (!r.canceled) {
      cctvToast(`Gagal: ${r.message}`, 'error');
    }
  } catch (err) {
    cctvToast(`Error: ${err.message}`, 'error');
  }
}

// ── Fullscreen ────────────────────────────────────────────────────────────────

function cctvFullscreen(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  const info = _cctvStreaming.get(uid);
  const fsEl    = document.getElementById('cctvFullscreen');
  const fsImg   = document.getElementById('cctvFsImg');
  const fsVid   = document.getElementById('cctvFsVideo');
  const fsTitle = document.getElementById('cctvFsTitle');

  if (fsTitle) fsTitle.textContent = cam.name;
  fsImg.style.display  = 'none';
  fsVid.style.display  = 'none';

  if (!info) {
    fsEl.style.display = 'flex';
    return;
  }

  if (cam.type === 'hls') {
    fsVid.style.display = 'block';
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(cam.url);
      hls.attachMedia(fsVid);
    } else {
      fsVid.src = cam.url;
    }
  } else if (cam.type === 'snapshot') {
    fsImg.src = cam.url + (cam.url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    fsImg.style.display = 'block';
  } else {
    // RTSP proxy or direct MJPEG — use canvas
    let fsCanvas = document.getElementById('cctvFsCanvas');
    if (!fsCanvas) {
      fsCanvas = document.createElement('canvas');
      fsCanvas.id = 'cctvFsCanvas';
      fsCanvas.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;background:#000;';
      fsImg.parentNode.insertBefore(fsCanvas, fsImg);
    }
    fsCanvas.style.display = 'block';
    const streamUrl = cam.type === 'http-mjpeg' ? cam.url : `http://127.0.0.1:${info.port}/`;
    // abort any previous fs stream
    if (window._cctvFsAbort) { try { window._cctvFsAbort.abort(); } catch (_e) {} }
    window._cctvFsAbort = new AbortController();
    cctvDrawCanvasFromUrl(fsCanvas, streamUrl, window._cctvFsAbort.signal, '__fs__');
  }

  fsEl.style.display = 'flex';
}

function cctvCloseFullscreen() {
  const fsEl     = document.getElementById('cctvFullscreen');
  const fsVid    = document.getElementById('cctvFsVideo');
  const fsImg    = document.getElementById('cctvFsImg');
  const fsCanvas = document.getElementById('cctvFsCanvas');
  if (fsVid) { fsVid.pause(); fsVid.src = ''; }
  if (fsImg) { fsImg.src = ''; fsImg.style.display = 'none'; }
  if (fsCanvas)  fsCanvas.style.display = 'none';
  if (window._cctvFsAbort) { try { window._cctvFsAbort.abort(); } catch (_e) {} window._cctvFsAbort = null; }
  if (fsEl)  fsEl.style.display = 'none';
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function cctvOpenAddModal() {
  document.getElementById('cctvModalTitle').textContent = 'Tambah Kamera';
  document.getElementById('cctvEditUid').value = '';
  document.getElementById('cctvName').value     = '';
  document.getElementById('cctvType').value     = 'rtsp';
  document.getElementById('cctvUrl').value      = '';
  document.getElementById('cctvUsername').value = '';
  document.getElementById('cctvPassword').value = '';
  document.getElementById('cctvFps').value      = '15';
  document.getElementById('cctvRefreshSec').value = '5';
  document.getElementById('cctvNotes').value    = '';
  const onvifIpEl2 = document.getElementById('cctvOnvifIp');
  if (onvifIpEl2) onvifIpEl2.value = '';
  const onvifPortEl2 = document.getElementById('cctvOnvifPort');
  if (onvifPortEl2) onvifPortEl2.value = '';
  const onvifTokenEl2 = document.getElementById('cctvOnvifToken');
  if (onvifTokenEl2) onvifTokenEl2.value = '';
  cctvOnTypeChange();
  document.getElementById('cctvModal').style.display = 'flex';
}

function cctvOpenEditModal(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  document.getElementById('cctvModalTitle').textContent = 'Edit Kamera';
  document.getElementById('cctvEditUid').value = cam.uid;
  document.getElementById('cctvName').value     = cam.name || '';
  document.getElementById('cctvType').value     = cam.type || 'rtsp';
  document.getElementById('cctvUrl').value      = cam.url || '';
  document.getElementById('cctvUsername').value = cam.username || '';
  document.getElementById('cctvPassword').value = cam.password || '';
  document.getElementById('cctvFps').value      = String(cam.fps || 15);
  document.getElementById('cctvRefreshSec').value = String(cam.refreshSec || 5);
  document.getElementById('cctvNotes').value    = cam.notes || '';
  const onvifIpEl = document.getElementById('cctvOnvifIp');
  if (onvifIpEl) onvifIpEl.value = cam.onvifIp || '';
  const onvifPortEl = document.getElementById('cctvOnvifPort');
  if (onvifPortEl) onvifPortEl.value = String(cam.onvifPort || '');
  const onvifTokenEl = document.getElementById('cctvOnvifToken');
  if (onvifTokenEl) onvifTokenEl.value = cam.onvifToken || '';
  cctvOnTypeChange();
  document.getElementById('cctvModal').style.display = 'flex';
}

function cctvCloseModal() {
  document.getElementById('cctvModal').style.display = 'none';
}

// Auto-fill ONVIF IP from stream URL
function cctvAutoFillOnvif() {
  const url  = (document.getElementById('cctvUrl') || {}).value || '';
  const ipEl  = document.getElementById('cctvOnvifIp');
  const portEl = document.getElementById('cctvOnvifPort');
  const tokenEl = document.getElementById('cctvOnvifToken');

  // Extract IP from rtsp://user:pass@IP:PORT/... or http://IP:PORT/...
  const m = url.match(/(?:rtsp|http|https):\/\/(?:[^@]+@)?(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?/i);
  if (m && ipEl) {
    if (!ipEl.value) ipEl.value = m[1];
    // Only pre-fill port if ONVIF port field is default 80 (don't overwrite if user set it)
    if (portEl && (portEl.value === '80' || !portEl.value)) {
      portEl.value = '80'; // ONVIF port is separate from RTSP port — keep 80 as default
    }
  }
  if (tokenEl && !tokenEl.value) tokenEl.value = 'MainStream';
  if (ipEl && !ipEl.value) { cctvToast('Tidak bisa deteksi IP dari URL — isi manual', 'error'); }
}

function cctvOnTypeChange() {
  const type = document.getElementById('cctvType').value;
  const brandHelper = document.getElementById('cctvBrandHelper');
  const credFields  = document.getElementById('cctvCredFields');
  const fpsField    = document.getElementById('cctvFpsField');
  const snapField   = document.getElementById('cctvSnapshotInterval');
  const urlHint     = document.getElementById('cctvUrlHint');

  const hints = {
    'rtsp':       'Contoh: rtsp://192.168.1.100:554/stream1',
    'http-mjpeg': 'Contoh: http://192.168.1.100/mjpeg',
    'hls':        'Contoh: http://192.168.1.100/stream.m3u8',
    'snapshot':   'Contoh: http://192.168.1.100/snapshot.jpg',
  };
  if (urlHint) urlHint.textContent = hints[type] || '';

  if (brandHelper) brandHelper.style.display = type === 'rtsp' ? 'block' : 'none';
  if (credFields)  credFields.style.display  = (type === 'rtsp' || type === 'http-mjpeg') ? 'flex' : 'none';
  if (fpsField)    fpsField.style.display    = type === 'rtsp' ? 'block' : 'none';
  if (snapField)   snapField.style.display   = type === 'snapshot' ? 'block' : 'none';
}

function cctvApplyTemplate(tpl) {
  if (!tpl) return;
  document.getElementById('cctvUrl').value = tpl;
}

async function cctvSaveCamera() {
  const name = (document.getElementById('cctvName').value || '').trim();
  const url  = (document.getElementById('cctvUrl').value  || '').trim();
  if (!name) { cctvToast('Nama kamera wajib diisi', 'error'); return; }
  if (!url)  { cctvToast('URL stream wajib diisi', 'error'); return; }

  const existingUid = document.getElementById('cctvEditUid').value;
  const camera = {
    uid:          existingUid || crypto.randomUUID(),
    name,
    type:         document.getElementById('cctvType').value,
    url,
    username:     document.getElementById('cctvUsername').value,
    password:     document.getElementById('cctvPassword').value,
    fps:          parseInt(document.getElementById('cctvFps').value) || 15,
    refreshSec:   parseInt(document.getElementById('cctvRefreshSec').value) || 5,
    notes:        document.getElementById('cctvNotes').value,
    onvifIp:      (document.getElementById('cctvOnvifIp')    || {}).value || '',
    onvifPort:    parseInt((document.getElementById('cctvOnvifPort') || {}).value) || 0,
    onvifToken:   (document.getElementById('cctvOnvifToken') || {}).value || '',
  };

  try {
    await cctvApi.saveCamera(camera);
    if (existingUid) {
      const idx = _cctvCameras.findIndex(c => c.uid === existingUid);
      if (idx >= 0) _cctvCameras[idx] = camera;
    } else {
      _cctvCameras.push(camera);
    }
    cctvCloseModal();
    cctvRenderGrid();
    cctvToast(`Kamera "${name}" disimpan`, 'success');
  } catch (err) {
    cctvToast(`Gagal simpan: ${err.message}`, 'error');
  }
}

async function cctvDeleteCamera(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  if (!confirm(`Hapus kamera "${cam.name}"?`)) return;
  await cctvDisconnect(uid);
  await cctvApi.deleteCamera(uid);
  _cctvCameras = _cctvCameras.filter(c => c.uid !== uid);
  cctvRenderGrid();
  cctvToast(`Kamera "${cam.name}" dihapus`, 'success');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function cctvToast(msg, type = 'info') {
  const colors = { success: '#22c55e', error: '#ef4444', info: '#6366f1' };
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:24px;right:24px;background:${colors[type]||colors.info};color:#fff;padding:10px 18px;border-radius:8px;font-size:0.85rem;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:340px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── PTZ Panel ─────────────────────────────────────────────────────────────────

let _ptzCam = null;         // current camera for PTZ
let _ptzPresets = [];       // loaded presets

function cctvOpenPtz(uid) {
  _ptzCam = _cctvCameras.find(c => c.uid === uid);
  if (!_ptzCam) return;

  let panel = document.getElementById('cctvPtzPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cctvPtzPanel';
    panel.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:10000;background:#1e1b2e;border:1px solid #4c1d95;
      border-radius:14px;padding:20px 24px;min-width:320px;
      box-shadow:0 8px 40px rgba(0,0,0,0.6);color:#fff;font-family:inherit;`;
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <span style="font-weight:700;font-size:1rem;">🎮 PTZ — ${_ptzCam.name}</span>
      <button onclick="cctvClosePtz()" style="background:none;border:none;color:#aaa;font-size:1.3rem;cursor:pointer;line-height:1;">✕</button>
    </div>

    <!-- Speed -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:0.8rem;color:#aaa;">
      <span>Kecepatan:</span>
      <input id="ptzSpeed" type="range" min="1" max="10" value="5" style="flex:1;">
      <span id="ptzSpeedVal">0.5</span>
    </div>

    <!-- D-pad + Zoom -->
    <div style="display:flex;gap:16px;align-items:center;justify-content:center;margin-bottom:14px;">
      <!-- D-pad -->
      <div style="display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:4px;">
        <button class="ptz-btn" onmousedown="cctvPtzDir('ul')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('ul')" ontouchend="cctvPtzHalt()">↖</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('u')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('u')"  ontouchend="cctvPtzHalt()">↑</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('ur')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('ur')" ontouchend="cctvPtzHalt()">↗</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('l')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('l')"  ontouchend="cctvPtzHalt()">←</button>
        <button class="ptz-btn" onclick="cctvPtzHalt()" style="background:#3f3465;font-size:0.7rem;">■</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('r')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('r')"  ontouchend="cctvPtzHalt()">→</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('dl')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('dl')" ontouchend="cctvPtzHalt()">↙</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('d')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('d')"  ontouchend="cctvPtzHalt()">↓</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('dr')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('dr')" ontouchend="cctvPtzHalt()">↘</button>
      </div>
      <!-- Zoom -->
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="ptz-btn" style="height:60px;font-size:1.1rem;" onmousedown="cctvPtzDir('zi')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('zi')" ontouchend="cctvPtzHalt()">🔍+</button>
        <button class="ptz-btn" style="height:60px;font-size:1.1rem;" onmousedown="cctvPtzDir('zo')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('zo')" ontouchend="cctvPtzHalt()">🔍−</button>
      </div>
    </div>

    <!-- Presets -->
    <div id="ptzPresetArea" style="border-top:1px solid #3f3465;padding-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:0.82rem;color:#aaa;">Preset Posisi</span>
        <button onclick="cctvPtzLoadPresets()" style="background:#4c1d95;border:none;color:#fff;padding:3px 10px;border-radius:5px;cursor:pointer;font-size:0.75rem;">🔄 Muat</button>
      </div>
      <div id="ptzPresetList" style="display:flex;flex-wrap:wrap;gap:6px;min-height:30px;">
        <span style="font-size:0.75rem;color:#666;">Klik "Muat" untuk daftar preset kamera</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <input id="ptzNewPresetName" type="text" placeholder="Nama preset baru..." style="flex:1;background:#2d2446;border:1px solid #4c1d95;color:#fff;padding:5px 8px;border-radius:6px;font-size:0.78rem;">
        <button onclick="cctvPtzSavePreset()" style="background:#7c3aed;border:none;color:#fff;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78rem;white-space:nowrap;">💾 Simpan</button>
      </div>
    </div>

    <div id="ptzStatus" style="font-size:0.72rem;color:#aaa;margin-top:8px;text-align:center;min-height:16px;"></div>`;

  // Speed label sync
  const speedInput = panel.querySelector('#ptzSpeed');
  if (speedInput) {
    speedInput.addEventListener('input', () => {
      document.getElementById('ptzSpeedVal').textContent = (speedInput.value / 10).toFixed(1);
    });
  }

  // Add PTZ button styles if not already added
  if (!document.getElementById('ptzBtnStyle')) {
    const s = document.createElement('style');
    s.id = 'ptzBtnStyle';
    s.textContent = `.ptz-btn{width:44px;height:44px;background:#2d2446;border:1px solid #4c1d95;color:#fff;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:background 0.1s;user-select:none;} .ptz-btn:active,.ptz-btn:hover{background:#6d28d9;}`;
    document.head.appendChild(s);
  }

  panel.style.display = 'block';
}

function cctvClosePtz() {
  cctvPtzHalt();
  const panel = document.getElementById('cctvPtzPanel');
  if (panel) panel.style.display = 'none';
  _ptzCam = null;
}

function _ptzParams() {
  return { ip: _ptzCam.onvifIp, port: _ptzCam.onvifPort || 80, username: _ptzCam.username || '', password: _ptzCam.password || '', profileToken: _ptzCam.onvifToken };
}

function _ptzStatus(msg) {
  const el = document.getElementById('ptzStatus');
  if (el) el.textContent = msg;
}

async function cctvPtzDir(dir) {
  if (!_ptzCam) return;
  const speed = parseFloat((document.getElementById('ptzSpeed') || { value: '5' }).value) / 10;
  const dirMap = {
    u:  [0,  speed, 0],  d:  [0, -speed, 0],
    l:  [-speed, 0, 0],  r:  [speed,  0, 0],
    ul: [-speed, speed, 0], ur: [speed, speed, 0],
    dl: [-speed,-speed, 0], dr: [speed,-speed, 0],
    zi: [0, 0,  speed],  zo: [0, 0, -speed],
  };
  const [pan, tilt, zoom] = dirMap[dir] || [0, 0, 0];
  try {
    const r = await cctvApi.ptzMove({ ..._ptzParams(), pan, tilt, zoom });
    if (!r.success) _ptzStatus(`Error: ${r.message}`);
    else _ptzStatus('');
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

async function cctvPtzHalt() {
  if (!_ptzCam) return;
  try {
    await cctvApi.ptzStop(_ptzParams());
  } catch {}
}

async function cctvPtzLoadPresets() {
  if (!_ptzCam) return;
  _ptzStatus('Memuat preset...');
  const listEl = document.getElementById('ptzPresetList');
  if (listEl) listEl.innerHTML = '<span style="font-size:0.75rem;color:#aaa;">Memuat...</span>';
  try {
    const r = await cctvApi.ptzPresets(_ptzParams());
    if (!r.success) { _ptzStatus(`Gagal: ${r.message}`); return; }
    _ptzPresets = r.presets || [];
    _ptzStatus(_ptzPresets.length ? `${_ptzPresets.length} preset` : 'Tidak ada preset');
    if (listEl) {
      listEl.innerHTML = _ptzPresets.length
        ? _ptzPresets.map(p => `<button onclick="cctvPtzGoto('${p.token}')" style="padding:4px 10px;background:#2d2446;border:1px solid #4c1d95;color:#fff;border-radius:6px;cursor:pointer;font-size:0.75rem;" title="${p.name}">${p.name}</button>`).join('')
        : '<span style="font-size:0.75rem;color:#666;">Tidak ada preset tersimpan</span>';
    }
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

async function cctvPtzGoto(presetToken) {
  if (!_ptzCam) return;
  _ptzStatus('Bergerak ke preset...');
  try {
    const r = await cctvApi.ptzGotoPreset({ ..._ptzParams(), presetToken });
    _ptzStatus(r.success ? '✓ Posisi preset diterapkan' : `Gagal: ${r.message}`);
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

async function cctvPtzSavePreset() {
  if (!_ptzCam) return;
  const name = (document.getElementById('ptzNewPresetName') || {}).value || '';
  _ptzStatus('Menyimpan preset...');
  try {
    const r = await cctvApi.ptzSetPreset({ ..._ptzParams(), presetName: name });
    if (r.success) {
      _ptzStatus(`✓ Preset "${name || r.token}" disimpan`);
      if (document.getElementById('ptzNewPresetName')) document.getElementById('ptzNewPresetName').value = '';
      cctvPtzLoadPresets();
    } else {
      _ptzStatus(`Gagal: ${r.message}`);
    }
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

// Expose globally
window.cctvSetLayout       = cctvSetLayout;
window.cctvConnect         = cctvConnect;
window.cctvReload          = cctvReload;
window.cctvDisconnect      = cctvDisconnect;
window.cctvSnapshot        = cctvSnapshot;
window.cctvFullscreen      = cctvFullscreen;
window.cctvCloseFullscreen = cctvCloseFullscreen;
window.cctvOpenAddModal    = cctvOpenAddModal;
window.cctvOpenEditModal   = cctvOpenEditModal;
window.cctvCloseModal      = cctvCloseModal;
window.cctvAutoFillOnvif   = cctvAutoFillOnvif;
window.cctvOnTypeChange    = cctvOnTypeChange;
window.cctvApplyTemplate   = cctvApplyTemplate;
window.cctvSaveCamera      = cctvSaveCamera;
window.cctvDeleteCamera    = cctvDeleteCamera;

// ── ONVIF Scan ────────────────────────────────────────────────────────────────

let _cctvScanUnlisten = null;
let _cctvScanRunning  = false;

function cctvOpenScanModal() {
  document.getElementById('cctvScanModal').style.display = 'flex';
  cctvPopulateSubnetChips();
}

function cctvPopulateSubnetChips() {
  const chips = document.getElementById('cctvSubnetChips');
  if (!chips) return;
  // Show common subnet quick-pick chips
  const commonSubnets = ['192.168.0', '192.168.1', '192.168.2', '192.168.10', '192.168.100', '10.0.0', '172.16.0'];
  chips.innerHTML = commonSubnets.map(s =>
    `<button onclick="cctvSetSubnet('${s}')"
      style="padding:3px 10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:5px;color:var(--color-muted);cursor:pointer;font-size:0.75rem;font-family:monospace;white-space:nowrap;"
      title="Scan ${s}.1-254">${s}.x</button>`
  ).join('');
}

function cctvSetSubnet(subnet) {
  const input = document.getElementById('cctvScanSubnet');
  if (input) input.value = subnet;
  // Highlight active chip
  document.querySelectorAll('#cctvSubnetChips button').forEach(btn => {
    const active = btn.textContent.startsWith(subnet);
    btn.style.background      = active ? 'var(--color-primary)' : 'var(--color-bg)';
    btn.style.color           = active ? '#fff' : 'var(--color-muted)';
    btn.style.borderColor     = active ? 'var(--color-primary)' : 'var(--color-border)';
  });
}

function cctvCloseScanModal() {
  document.getElementById('cctvScanModal').style.display = 'none';
  if (_cctvScanUnlisten) { _cctvScanUnlisten(); _cctvScanUnlisten = null; }
}

async function cctvStartScan() {
  if (_cctvScanRunning) return;
  _cctvScanRunning = true;

  const btn  = document.getElementById('cctvScanBtn');
  const prog = document.getElementById('cctvScanProgress');
  const msg  = document.getElementById('cctvScanMsg');
  const pct  = document.getElementById('cctvScanPct');
  const bar  = document.getElementById('cctvScanBar');
  const res  = document.getElementById('cctvScanResults');
  const empty = document.getElementById('cctvScanEmpty');

  const username    = (document.getElementById('cctvScanUser').value   || '').trim();
  const password    = document.getElementById('cctvScanPass').value   || '';
  const subnetInput = (document.getElementById('cctvScanSubnet').value || '').trim();

  if (btn)   { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Scanning...'; }
  if (prog)  prog.style.display = 'block';
  if (empty) empty.style.display = 'none';
  if (res)   res.innerHTML = '';

  // Listen for progress events
  if (_cctvScanUnlisten) _cctvScanUnlisten();
  _cctvScanUnlisten = cctvApi.onScanProgress((data) => {
    if (msg) msg.textContent = data.message || '';
    if (data.progress != null) {
      if (pct) pct.textContent = data.progress + '%';
      if (bar) bar.style.width = data.progress + '%';
    }
  });

  try {
    const r = await cctvApi.scanOnvif({ username, password, subnetInput });
    const devices = r.devices || [];

    if (devices.length === 0) {
      if (res) res.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;color:var(--color-muted);gap:8px;">
          <i class="bi bi-camera-video-off" style="font-size:2rem;"></i>
          <span style="font-size:0.85rem;">Tidak ada perangkat ONVIF ditemukan di jaringan ini</span>
          <span style="font-size:0.75rem;opacity:.7;">Pastikan kamera dan komputer dalam satu subnet</span>
        </div>`;
    } else {
      if (res) res.innerHTML = devices.map(d => cctvBuildScanResultCard(d, username, password)).join('');
    }
  } catch (err) {
    if (res) res.innerHTML = `<div style="padding:16px;color:#ef4444;font-size:0.85rem;">Error: ${err.message}</div>`;
  } finally {
    _cctvScanRunning = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-search"></i> Scan Lagi'; }
    if (_cctvScanUnlisten) { _cctvScanUnlisten(); _cctvScanUnlisten = null; }
  }
}

function cctvBuildScanResultCard(d, username, password) {
  const info  = d.info || {};
  const label = [info.manufacturer, info.model].filter(Boolean).join(' ') || 'ONVIF Device';
  const rtsp  = d.streamUri || '';

  return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:8px;background:var(--color-bg);margin-bottom:8px;border:1px solid var(--color-border);">
    <div style="padding:8px;background:var(--color-primary)22;border-radius:8px;flex-shrink:0;">
      <i class="bi bi-camera-video-fill" style="color:var(--color-primary);font-size:1.1rem;"></i>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;font-size:0.9rem;">${label}</div>
      <div style="font-size:0.75rem;color:var(--color-muted);margin-top:2px;">${d.ip}:${d.port} · ${d.source === 'ws-discovery' ? 'WS-Discovery' : 'TCP Scan'}</div>
      ${info.firmware ? `<div style="font-size:0.72rem;color:var(--color-muted);">FW: ${info.firmware}${info.serial ? ' · S/N: ' + info.serial : ''}</div>` : ''}
      ${rtsp ? `<div style="font-size:0.72rem;color:#22c55e;margin-top:3px;font-family:monospace;word-break:break-all;">${rtsp}</div>` : '<div style="font-size:0.72rem;color:#f59e0b;margin-top:3px;">Stream URI tidak tersedia (coba dengan credentials)</div>'}
    </div>
    <button onclick="cctvAddFromScan('${d.ip}',${d.port},'${encodeURIComponent(rtsp)}','${encodeURIComponent(label)}','${encodeURIComponent(username)}','${encodeURIComponent(password)}','${encodeURIComponent(d.profileToken||'')}')"
      style="flex-shrink:0;padding:6px 14px;background:var(--color-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">
      + Tambah
    </button>
  </div>`;
}

function cctvAddFromScan(ip, port, rtspEnc, labelEnc, userEnc, passEnc, profileTokenEnc) {
  const rtsp  = decodeURIComponent(rtspEnc);
  const label = decodeURIComponent(labelEnc);
  const user  = decodeURIComponent(userEnc);
  const pass  = decodeURIComponent(passEnc);
  const token = profileTokenEnc ? decodeURIComponent(profileTokenEnc) : '';

  // Pre-fill add modal
  document.getElementById('cctvModalTitle').textContent = 'Tambah Kamera ONVIF';
  document.getElementById('cctvEditUid').value       = '';
  document.getElementById('cctvName').value          = label || `Kamera ${ip}`;
  document.getElementById('cctvType').value          = 'rtsp';
  document.getElementById('cctvUrl').value           = rtsp || `rtsp://${ip}:554/stream1`;
  document.getElementById('cctvUsername').value      = user;
  document.getElementById('cctvPassword').value      = pass;
  document.getElementById('cctvFps').value           = '15';
  document.getElementById('cctvRefreshSec').value    = '5';
  document.getElementById('cctvNotes').value         = `ONVIF ${ip}:${port}`;
  // Store ONVIF metadata for PTZ
  const onvifIpEl = document.getElementById('cctvOnvifIp');
  if (onvifIpEl) { onvifIpEl.value = ip; }
  const onvifPortEl = document.getElementById('cctvOnvifPort');
  if (onvifPortEl) { onvifPortEl.value = port; }
  const onvifTokenEl = document.getElementById('cctvOnvifToken');
  if (onvifTokenEl) { onvifTokenEl.value = token; }
  cctvOnTypeChange();

  // Close scan modal, open add modal
  cctvCloseScanModal();
  document.getElementById('cctvModal').style.display = 'flex';
}

window.cctvOpenScanModal   = cctvOpenScanModal;
window.cctvCloseScanModal  = cctvCloseScanModal;
window.cctvStartScan       = cctvStartScan;
window.cctvAddFromScan     = cctvAddFromScan;
window.cctvSetSubnet       = cctvSetSubnet;

function cctvToggleScanPass(btn) {
  const input = document.getElementById('cctvScanPass');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) { icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye'; }
}
window.cctvToggleScanPass  = cctvToggleScanPass;
window.cctvOpenPtz         = cctvOpenPtz;
window.cctvClosePtz        = cctvClosePtz;
window.cctvPtzDir          = cctvPtzDir;
window.cctvPtzHalt         = cctvPtzHalt;
window.cctvPtzLoadPresets  = cctvPtzLoadPresets;
window.cctvPtzGoto         = cctvPtzGoto;
window.cctvPtzSavePreset   = cctvPtzSavePreset;

// ── Lifecycle ─────────────────────────────────────────────────────────────────
// Hook into switchPage
(function() {
  const _origSwitchPage = window.switchPage;
  if (typeof _origSwitchPage === 'function') {
    window.switchPage = async function(page, ...args) {
      await _origSwitchPage(page, ...args);
      if (page === 'cctv') cctvInit();
    };
  }
})();
