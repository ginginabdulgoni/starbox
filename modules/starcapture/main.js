// ═══════════════════════════════════════════════════════════════════════════════
// Modul StarCapture — sisi main process (screenshot & rekam layar)
//
// Dipindah dari electron-main.js: shortcut global, overlay pilih area (multi
// layar), screenshot penuh/jendela/area, sumber rekam layar, simpan & clipboard.
// Shortcut tetap disimpan di electron-store core (kunci starCaptureShortcuts).
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const { globalShortcut, desktopCapturer, screen, clipboard, nativeImage } = require("electron");

let ctx = null;
const getStore = () => ctx.services.getStore();
let registerShortcuts = () => {};

function register(context) {
  ctx = context;
  const { ipcMain, app, BrowserWindow, dialog, shell } = context.electron;

  let scOverlayWindow = null;
  let scCurrentMode   = 'screenshot'; // 'screenshot' | 'record'
  let scPendingResolve = null;        // resolves when overlay confirms/cancels

  // ═══════════════════════════════════════════════════════════════
  // ── STARCAPTURE – Screenshot & Screen Recording ────────────────
  // ═══════════════════════════════════════════════════════════════

  // ── Global Shortcuts ─────────────────────────────────────────
  const SC_SHORTCUTS_KEY = 'starCaptureShortcuts';
  const SC_SHORTCUT_DEFAULTS = { screenshot: 'CommandOrControl+Shift+S', record: 'CommandOrControl+Shift+R' };

  function scGetShortcuts() {
    try {
      const saved = getStore() && getStore().get(SC_SHORTCUTS_KEY);
      return Object.assign({}, SC_SHORTCUT_DEFAULTS, saved || {});
    } catch { return { ...SC_SHORTCUT_DEFAULTS }; }
  }

  function registerStarCaptureShortcuts() {
    globalShortcut.unregisterAll();
    const shortcuts = scGetShortcuts();
    // Screenshot shortcut → direct overlay capture flow (preview stays on screen)
    if (shortcuts.screenshot) {
      try {
        globalShortcut.register(shortcuts.screenshot, () => scStartOverlayCaptureFlow());
      } catch (e) { console.warn(`⚠️ Screenshot shortcut [${shortcuts.screenshot}] failed: ${e.message}`); }
    }
    // Record shortcut → send to renderer as before
    if (shortcuts.record) {
      try {
        globalShortcut.register(shortcuts.record, () => {
          const wins = BrowserWindow.getAllWindows();
          if (wins.length) wins[0].webContents.send('starcapture:shortcut', 'record');
        });
      } catch (e) { console.warn(`⚠️ Record shortcut [${shortcuts.record}] failed: ${e.message}`); }
    }
    console.log('✅ StarCapture shortcuts registered:', shortcuts);
  }

  // ── Multi-display capture helpers ────────────────────────────
  // Map<displayId, { image: NativeImage, bounds, scaleFactor }>
  let scPreCapturedDisplays = null;
  let scOverlayMinX = 0, scOverlayMinY = 0;

  async function scCaptureAllDisplaysPre() {
    const displays = screen.getAllDisplays();
    const result = new Map();
    // Capture each display separately at its exact native resolution
    // so thumbnailSize matches 1:1 and no scale correction is needed
    for (let i = 0; i < displays.length; i++) {
      const d = displays[i];
      const physW = Math.round(d.bounds.width  * d.scaleFactor);
      const physH = Math.round(d.bounds.height * d.scaleFactor);
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: physW, height: physH },
      });
      // Try display_id match first, then index fallback
      let src = sources.find(s => String(s.display_id) === String(d.id));
      if (!src && i < sources.length) src = sources[i];
      if (!src) src = sources[0];
      if (src) result.set(d.id, { image: src.thumbnail, bounds: d.bounds, scaleFactor: d.scaleFactor });
    }
    return result;
  }

  function scCropFromDisplayMap(rect) {
    if (!scPreCapturedDisplays) return null;
    // rect.displayX/Y = CSS pixels inside overlay (relative to overlay top-left)
    const screenLogX = scOverlayMinX + rect.displayX;
    const screenLogY = scOverlayMinY + rect.displayY;

    // Find the display containing the center of selection
    let entry = null;
    for (const [, e] of scPreCapturedDisplays) {
      const { bounds } = e;
      if (screenLogX >= bounds.x && screenLogX < bounds.x + bounds.width &&
          screenLogY >= bounds.y && screenLogY < bounds.y + bounds.height) {
        entry = e; break;
      }
    }
    if (!entry) {
      const primary = screen.getPrimaryDisplay();
      entry = scPreCapturedDisplays.get(primary.id) || [...scPreCapturedDisplays.values()][0];
    }
    if (!entry) return null;

    const { image, bounds, scaleFactor } = entry;
    const actual = image.getSize();

    // Coordinates relative to this display's top-left (in logical pixels)
    const relLogX = rect.displayX + scOverlayMinX - bounds.x;
    const relLogY = rect.displayY + scOverlayMinY - bounds.y;

    // thumbnail was captured at exact native resolution, so no scale correction needed
    const cropX = Math.max(0, Math.round(relLogX * scaleFactor));
    const cropY = Math.max(0, Math.round(relLogY * scaleFactor));
    const cropW = Math.min(actual.width  - cropX, Math.round(rect.displayW * scaleFactor));
    const cropH = Math.min(actual.height - cropY, Math.round(rect.displayH * scaleFactor));

    if (cropW < 1 || cropH < 1) return null;
    const cropped = image.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
    return scImageToBase64(cropped);
  }

  // ── Overlay capture flow (screenshot shortcut) ───────────────
  async function scStartOverlayCaptureFlow() {
    if (scOverlayWindow && !scOverlayWindow.isDestroyed()) return; // already open
    // Pre-capture ALL displays before overlay opens (no minimize — overlay appears on top)
    scPreCapturedDisplays = await scCaptureAllDisplaysPre();
    scCurrentMode = 'screenshot-overlay';
    scOpenOverlayWindow();
  }

  let scPendingMainWins = [];

  function scOpenOverlayWindow() {
    const displays = screen.getAllDisplays();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of displays) {
      minX = Math.min(minX, d.bounds.x);  minY = Math.min(minY, d.bounds.y);
      maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
      maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
    }
    // Store overlay origin for multi-display crop calculation
    scOverlayMinX = minX; scOverlayMinY = minY;

    scOverlayWindow = new BrowserWindow({
      x: minX, y: minY, width: maxX - minX, height: maxY - minY,
      frame: false, transparent: true, alwaysOnTop: true,
      fullscreen: false, skipTaskbar: true, resizable: false,
      movable: false, hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'starcapture-overlay-preload.cjs'),
        contextIsolation: true, nodeIntegration: false,
      },
    });
    scOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
    scOverlayWindow.setVisibleOnAllWorkspaces(true);
    scOverlayWindow.loadFile(path.join(__dirname, 'starcapture-overlay.html'));
    scOverlayWindow.on('closed', () => {
      scOverlayWindow = null;
      scPreCapturedDisplays = null;
      // Restore main windows when overlay closes
      for (const w of scPendingMainWins) { try { if (!w.isDestroyed()) { w.restore(); w.focus(); } } catch {} }
      scPendingMainWins = [];
      if (scPendingResolve) { scPendingResolve(null); scPendingResolve = null; }
    });
  }

  ipcMain.handle('starcapture:get-shortcuts', () => scGetShortcuts());

  ipcMain.handle('starcapture:set-shortcuts', (_, shortcuts) => {
    try {
      if (getStore()) getStore().set(SC_SHORTCUTS_KEY, shortcuts);
      registerStarCaptureShortcuts();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });


  // ── Screenshot helpers ───────────────────────────────────────
  async function scCaptureFullScreen() {
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.size;
    const sf = display.scaleFactor;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * sf), height: Math.round(height * sf) },
    });
    if (!sources.length) return null;
    return sources[0].thumbnail; // NativeImage
  }

  async function scCaptureActiveWindow() {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 3840, height: 2160 },
      fetchWindowIcons: false,
    });
    // Prefer first non-minimized visible window (filter out StarBox itself)
    const filtered = sources.filter(s => s.name && !s.name.includes('StarBox'));
    const src = filtered.length ? filtered[0] : sources[0];
    if (!src) return null;
    return src.thumbnail;
  }

  function scImageToBase64(img) {
    if (!img) return null;
    const buf = img.toPNG();
    return 'data:image/png;base64,' + buf.toString('base64');
  }

  // ── Overlay window (for page-button flows: area screenshot and area record) ──
  function scOpenOverlay(mode) {
    return new Promise((resolve) => {
      if (scOverlayWindow && !scOverlayWindow.isDestroyed()) scOverlayWindow.close();
      scCurrentMode    = mode;
      scPendingResolve = resolve;
      scPendingMainWins = [];
      scOpenOverlayWindow();
    });
  }

  function scCloseOverlay() {
    if (scOverlayWindow && !scOverlayWindow.isDestroyed()) scOverlayWindow.close();
    scOverlayWindow = null;
  }

  // ── IPC: Overlay ──────────────────────────────────────────────
  ipcMain.handle('starcapture:overlay-get-mode', () => scCurrentMode);

  // Used by recording (page button) — close overlay and resolve with rect
  ipcMain.on('starcapture:area-confirmed', (_, rect) => {
    scCloseOverlay();
    if (scPendingResolve) { scPendingResolve(rect); scPendingResolve = null; }
  });

  // Used by screenshot-overlay flow — crop correct display and send image back to overlay
  ipcMain.on('starcapture:capture-confirmed', async (_, rect) => {
    if (!scPreCapturedDisplays || !scOverlayWindow || scOverlayWindow.isDestroyed()) {
      scCloseOverlay(); return;
    }
    try {
      const dataUrl = scCropFromDisplayMap(rect);
      if (!dataUrl) throw new Error('Failed to crop display');
      scOverlayWindow.webContents.send('starcapture:overlay-show-image', dataUrl);
    } catch (e) {
      console.error('[StarCapture] crop error:', e);
      scCloseOverlay();
    }
  });

  ipcMain.on('starcapture:overlay-cancel', () => {
    scCloseOverlay();
    if (scPendingResolve) { scPendingResolve(null); scPendingResolve = null; }
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) wins[0].webContents.send('starcapture:cancelled');
  });

  ipcMain.on('starcapture:overlay-close', () => {
    scCloseOverlay();
  });

  ipcMain.handle('starcapture:overlay-copy', async (_, dataUrl) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      clipboard.writeImage(img);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('starcapture:overlay-save', async (_, dataUrl) => {
    const win = scOverlayWindow && !scOverlayWindow.isDestroyed() ? scOverlayWindow : BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(win, {
      title: 'Simpan Screenshot',
      defaultPath: path.join(app.getPath('pictures'), `screenshot-${Date.now()}.png`),
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
      return { ok: true, filePath: result.filePath };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── IPC: Screenshot ─────────────────────────────────────────
  ipcMain.handle('starcapture:screenshot-full', async () => {
    const img = await scCaptureFullScreen();
    return scImageToBase64(img);
  });

  ipcMain.handle('starcapture:screenshot-window', async () => {
    const img = await scCaptureActiveWindow();
    return scImageToBase64(img);
  });

  ipcMain.handle('starcapture:screenshot-area', async () => {
    // Page-button area screenshot: overlay appears on top (no minimize)
    // Pre-capture ALL displays before overlay opens
    scPreCapturedDisplays = await scCaptureAllDisplaysPre();

    const rect = await scOpenOverlay('screenshot');
    if (!rect) return null;

    // Crop from the correct display
    const dataUrl = scCropFromDisplayMap(rect);
    scPreCapturedDisplays = null;
    return dataUrl;
  });


  // ── IPC: Recording source ID ─────────────────────────────────
  ipcMain.handle('starcapture:get-screen-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    return sources.map(s => ({ id: s.id, name: s.name }));
  });

  ipcMain.handle('starcapture:get-area-for-record', async () => {
    const mainWins = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
    mainWins.forEach(w => w.minimize());
    await new Promise(r => setTimeout(r, 250));

    const rect = await scOpenOverlay('record');
    mainWins.forEach(w => { try { w.restore(); w.focus(); } catch {} });
    return rect; // { x, y, w, h, displayX, displayY, displayW, displayH }
  });

  // ── IPC: Save / Clipboard ────────────────────────────────────
  ipcMain.handle('starcapture:copy-image', (_, dataUrl) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      clipboard.writeImage(img);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('starcapture:save-image', async (_, { dataUrl, defaultName }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Screenshot',
      defaultPath: path.join(app.getPath('pictures'), defaultName || `screenshot-${Date.now()}.png`),
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('starcapture:save-video', async (_, { buffer, format, defaultName }) => {
    const ext = format === 'webm' ? 'webm' : 'webm'; // save as webm, user can convert
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Recording',
      defaultPath: path.join(app.getPath('videos'), defaultName || `recording-${Date.now()}.${ext}`),
      filters: [
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    try {
      const uint8 = Buffer.from(buffer);
      fs.writeFileSync(result.filePath, uint8);
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('starcapture:open-file', (_, filePath) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  registerShortcuts = registerStarCaptureShortcuts;
}

/** Dipanggil core setelah app siap. */
function start() {
  registerShortcuts();
}

function shutdown() {
  globalShortcut.unregisterAll();
}

module.exports = { register, start, shutdown };
