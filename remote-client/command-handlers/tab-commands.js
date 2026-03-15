"use strict";

/**
 * Command handlers untuk operasi tab/webContents:
 * get_tabs, open_tab, focus_tab, reload_tab, close_tab,
 * navigate_url, get_current_url, get_title, open_monitor, close_monitor,
 * capture_tab, move_tab, scroll_tab, tap_tab, type_tab, key_tab
 *
 * "Tab" di sini = BrowserView atau WebContents dalam sebuah device window.
 * Setiap device window (BrowserWindow) bisa memiliki satu WebContents utama.
 */

const logger = require("../utils/logger");

const KEYCODE_BY_CODE = {
  Space: "Space",
  Minus: "Minus",
  Equal: "Equal",
  BracketLeft: "BracketLeft",
  BracketRight: "BracketRight",
  Backslash: "Backslash",
  Semicolon: "Semicolon",
  Quote: "Quote",
  Backquote: "Backquote",
  Comma: "Comma",
  Period: "Period",
  Slash: "Slash",
  Enter: "Enter",
  Backspace: "Backspace",
  Tab: "Tab",
  Escape: "Escape",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

function normalizeKeyCode(key = "", code = "") {
  if (typeof code === "string" && code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (KEYCODE_BY_CODE[code]) return KEYCODE_BY_CODE[code];
  }

  if (key === " ") return "Space";
  if (key === "ArrowUp") return "Up";
  if (key === "ArrowDown") return "Down";
  if (key === "ArrowLeft") return "Left";
  if (key === "ArrowRight") return "Right";
  if (key === "Esc") return "Escape";
  if (typeof key === "string" && key.length === 1) return key.toUpperCase();
  return key || "";
}

function focusWebContentsForInput(webContents) {
  if (!webContents || webContents.isDestroyed()) return;

  const ownerWindow =
    typeof webContents.getOwnerBrowserWindow === "function"
      ? webContents.getOwnerBrowserWindow()
      : null;

  if (ownerWindow && !ownerWindow.isDestroyed()) {
    try {
      if (ownerWindow.isMinimized()) ownerWindow.restore();
    } catch {}
    try {
      if (typeof ownerWindow.show === "function") ownerWindow.show();
    } catch {}
    try {
      ownerWindow.focus();
    } catch {}
  }

  try {
    if (typeof webContents.focus === "function") webContents.focus();
  } catch {}
}

function getInputSurfaceSize(webContents) {
  if (!webContents || webContents.isDestroyed()) return null;

  const ownerWindow =
    typeof webContents.getOwnerBrowserWindow === "function"
      ? webContents.getOwnerBrowserWindow()
      : null;

  if (ownerWindow && !ownerWindow.isDestroyed() && typeof ownerWindow.getContentBounds === "function") {
    const bounds = ownerWindow.getContentBounds();
    if (Number.isFinite(bounds?.width) && Number.isFinite(bounds?.height) && bounds.width > 0 && bounds.height > 0) {
      return { width: bounds.width, height: bounds.height };
    }
  }

  if (typeof webContents.getBounds === "function") {
    const bounds = webContents.getBounds();
    if (Number.isFinite(bounds?.width) && Number.isFinite(bounds?.height) && bounds.width > 0 && bounds.height > 0) {
      return { width: bounds.width, height: bounds.height };
    }
  }

  return null;
}

function resolveInputPoint(payload, webContents, { requirePoint = true } = {}) {
  const rawX = Number(payload?.x);
  const rawY = Number(payload?.y);

  if ((!Number.isFinite(rawX) || !Number.isFinite(rawY)) && requirePoint) {
    throw new Error("x dan y wajib berupa angka");
  }

  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
    return { x: 0, y: 0 };
  }

  const srcW = Number(payload?.frame_width);
  const srcH = Number(payload?.frame_height);
  const surface = getInputSurfaceSize(webContents);

  let pointX = rawX;
  let pointY = rawY;

  if (
    surface &&
    Number.isFinite(srcW) &&
    Number.isFinite(srcH) &&
    srcW > 0 &&
    srcH > 0
  ) {
    pointX = (rawX * surface.width) / srcW;
    pointY = (rawY * surface.height) / srcH;
  }

  if (surface) {
    pointX = Math.max(0, Math.min(surface.width - 1, Math.round(pointX)));
    pointY = Math.max(0, Math.min(surface.height - 1, Math.round(pointY)));
  } else {
    pointX = Math.max(0, Math.round(pointX));
    pointY = Math.max(0, Math.round(pointY));
  }

  return { x: pointX, y: pointY };
}

/**
 * get_tabs – ambil daftar tab (device window yang sedang running)
 * payload: {}
 */
async function handleGetTabs(payload, bridge) {
  const runningUids = bridge.getRunningDeviceUids();
  const tabs = [];

  for (const uid of runningUids) {
    try {
      const info = await bridge.getTabInfo(uid);
      tabs.push({ uid, ...info });
    } catch {
      tabs.push({ uid, url: null, title: null, loading: false });
    }
  }

  return { tabs };
}

/**
 * open_tab – jalankan device (buka window/tab baru)
 * payload: { uid }
 */
async function handleOpenTab(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  const device = await bridge.getDeviceConfig(uid);
  if (!device) throw new Error(`Device ${uid} tidak ditemukan`);

  await bridge.ipc.invoke("start-device", uid, device.service);
  return { message: "Tab dibuka", uid };
}

/**
 * focus_tab – fokuskan device window
 * payload: { uid }
 */
async function handleFocusTab(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  if (!bridge.isDeviceRunning(uid)) {
    throw new Error(`Device ${uid} tidak sedang berjalan`);
  }

  await bridge.ipc.invoke("focus-device", uid);
  return { message: "Tab difokuskan", uid };
}

/**
 * reload_tab – reload webContents device
 * payload: { uid }
 */
async function handleReloadTab(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }
  focusWebContentsForInput(webContents);

  webContents.reload();
  return { message: "Tab di-reload", uid };
}

/**
 * close_tab – tutup device window (stop)
 * payload: { uid }
 */
async function handleCloseTab(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  await bridge.ipc.invoke("stop-device", uid);
  return { message: "Tab ditutup", uid };
}

/**
 * open_monitor – buka window monitor automation untuk device running
 * payload: { uid }
 */
async function handleOpenMonitor(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  await bridge.ipc.invoke("ensure-monitor-window", uid);
  return { message: "Window monitor dibuka", uid };
}

/**
 * close_monitor – tutup window monitor automation untuk device
 * payload: { uid }
 */
async function handleCloseMonitor(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  await bridge.ipc.invoke("close-monitor-window", uid);
  return { message: "Window monitor ditutup", uid };
}

/**
 * capture_tab – ambil snapshot JPEG dari webContents untuk remote view.
 * payload: { uid, quality?: number }
 */
async function handleCaptureTab(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }

  const quality = Number.isFinite(Number(payload?.quality))
    ? Math.max(30, Math.min(85, Number(payload.quality)))
    : 55;

  const maxWidth = Number(payload?.max_width);
  const maxHeight = Number(payload?.max_height);

  let image = await webContents.capturePage();
  const sourceSize = image.getSize();

  if (sourceSize.width > 0 && sourceSize.height > 0) {
    let scale = 1;
    if (Number.isFinite(maxWidth) && maxWidth > 0) {
      scale = Math.min(scale, maxWidth / sourceSize.width);
    }
    if (Number.isFinite(maxHeight) && maxHeight > 0) {
      scale = Math.min(scale, maxHeight / sourceSize.height);
    }

    // Hanya downscale agar efisien bandwidth/CPU tanpa menurunkan ketajaman karena upscale.
    if (scale > 0 && scale < 1) {
      image = image.resize({
        width: Math.max(1, Math.round(sourceSize.width * scale)),
        height: Math.max(1, Math.round(sourceSize.height * scale)),
        quality: "good",
      });
    }
  }

  const size = image.getSize();
  const jpegBuffer = image.toJPEG(quality);

  return {
    uid,
    width: size.width,
    height: size.height,
    title: webContents.getTitle(),
    url: webContents.getURL(),
    image_base64: jpegBuffer.toString("base64"),
  };
}

/**
 * move_tab – kirim pergerakan mouse ke koordinat tab target.
 * payload: { uid, x, y }
 */
async function handleMoveTab(payload, bridge) {
  const { uid } = payload;

  if (!uid) throw new Error("uid wajib diisi");

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }
  const { x: pointX, y: pointY } = resolveInputPoint(payload, webContents, { requirePoint: true });
  webContents.sendInputEvent({ type: "mouseMove", x: pointX, y: pointY });
  return { uid, x: pointX, y: pointY, message: "Pointer dipindahkan" };
}

/**
 * scroll_tab – kirim scroll wheel ke tab target.
 * payload: { uid, delta_x?, delta_y, x?, y? }
 */
async function handleScrollTab(payload, bridge) {
  const { uid } = payload;
  const deltaY = Number(payload?.delta_y);
  const deltaX = Number(payload?.delta_x || 0);

  if (!uid) throw new Error("uid wajib diisi");
  if (!Number.isFinite(deltaY)) {
    throw new Error("delta_y wajib berupa angka");
  }

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }
  const { x: pointX, y: pointY } = resolveInputPoint(payload, webContents, { requirePoint: false });
  const wheelX = Math.round(deltaX);
  const wheelY = Math.round(deltaY);

  webContents.sendInputEvent({
    type: "mouseWheel",
    x: pointX,
    y: pointY,
    deltaX: wheelX,
    deltaY: wheelY,
  });

  return {
    uid,
    x: pointX,
    y: pointY,
    deltaX: wheelX,
    deltaY: wheelY,
    message: "Scroll terkirim",
  };
}

/**
 * tap_tab – kirim klik mouse ke koordinat tab target.
 * payload: { uid, x, y }
 */
async function handleTapTab(payload, bridge) {
  const { uid } = payload;

  if (!uid) throw new Error("uid wajib diisi");

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }

  focusWebContentsForInput(webContents);
  const { x: pointX, y: pointY } = resolveInputPoint(payload, webContents, { requirePoint: true });

  webContents.sendInputEvent({ type: "mouseMove", x: pointX, y: pointY });
  webContents.sendInputEvent({
    type: "mouseDown",
    x: pointX,
    y: pointY,
    button: "left",
    clickCount: 1,
  });
  webContents.sendInputEvent({
    type: "mouseUp",
    x: pointX,
    y: pointY,
    button: "left",
    clickCount: 1,
  });

  return { uid, x: pointX, y: pointY, message: "Klik berhasil dikirim" };
}

/**
 * type_tab – ketik teks ke elemen aktif pada tab target.
 * payload: { uid, text }
 */
async function handleTypeTab(payload, bridge) {
  const { uid, text } = payload;
  if (!uid) throw new Error("uid wajib diisi");
  if (typeof text !== "string" || !text.length) {
    throw new Error("text wajib diisi");
  }

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }
  focusWebContentsForInput(webContents);

  await webContents.executeJavaScript(
    `(() => {
      const el = document.activeElement;
      if (!el) return false;
      const value = ${JSON.stringify(text)};
      const isInput = el.tagName === "INPUT" || el.tagName === "TEXTAREA";
      const isEditable = el.isContentEditable === true;
      if (!isInput && !isEditable) return false;
      if (isInput) {
        const start = typeof el.selectionStart === "number" ? el.selectionStart : el.value.length;
        const end = typeof el.selectionEnd === "number" ? el.selectionEnd : el.value.length;
        const next = el.value.slice(0, start) + value + el.value.slice(end);
        el.value = next;
        const caret = start + value.length;
        if (typeof el.setSelectionRange === "function") el.setSelectionRange(caret, caret);
      } else {
        document.execCommand("insertText", false, value);
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })();`,
    true
  );

  return { uid, message: "Teks berhasil dikirim" };
}

/**
 * key_tab – kirim event keyboard langsung ke tab target.
 * payload: { uid, key, code?, modifiers?, text?, event_type? }
 */
async function handleKeyTab(payload, bridge) {
  const { uid } = payload;
  const key = String(payload?.key || "");
  const code = String(payload?.code || "");
  const text = typeof payload?.text === "string" ? payload.text : "";

  if (!uid) throw new Error("uid wajib diisi");
  if (!key && !text) throw new Error("key atau text wajib diisi");

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }
  focusWebContentsForInput(webContents);

  const rawModifiers = Array.isArray(payload?.modifiers) ? payload.modifiers : [];
  const modifiers = rawModifiers
    .map((m) => String(m || "").toLowerCase())
    .filter((m) => ["shift", "control", "alt", "meta"].includes(m));
  const hasComboModifier = modifiers.includes("control") || modifiers.includes("alt") || modifiers.includes("meta");
  const keyCode = normalizeKeyCode(key, code);
  const eventType = String(payload?.event_type || "down").toLowerCase();
  const canInsertTextDirect = !hasComboModifier && !!text;

  if (!keyCode) {
    if (canInsertTextDirect) {
      webContents.insertText(text);
      return { uid, eventType, message: "Teks terkirim" };
    }
    throw new Error(`keyCode tidak valid untuk key='${key}' code='${code}'`);
  }

  if (eventType === "up") {
    webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
    return { uid, keyCode, eventType, message: "Key up terkirim" };
  }

  // Untuk karakter biasa tanpa modifier combo, insert langsung agar stabil di input WhatsApp.
  if (!hasComboModifier && text && text.length === 1 && key !== "Enter" && key !== "Tab") {
    webContents.insertText(text);
    return { uid, keyCode, eventType, message: "Karakter terkirim" };
  }

  webContents.sendInputEvent({ type: "keyDown", keyCode, modifiers });

  if (!hasComboModifier && text && text.length) {
    for (const ch of text) {
      webContents.sendInputEvent({ type: "char", keyCode: ch, modifiers: [] });
    }
  }

  webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
  return { uid, keyCode, eventType, message: "Key event terkirim" };
}

/**
 * navigate_url – arahkan webContents ke URL baru
 * payload: { uid, url }
 */
async function handleNavigateUrl(payload, bridge) {
  const { uid, url } = payload;
  if (!uid || !url) throw new Error("uid dan url wajib diisi");

  // Validasi URL dasar
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL tidak valid: ${url}`);
  }

  // Hanya izinkan http/https untuk keamanan
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Hanya URL http/https yang diizinkan");
  }

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }

  webContents.loadURL(url);
  return { message: "Navigasi ke URL berhasil", uid, url };
}

/**
 * get_current_url – ambil URL aktif webContents
 * payload: { uid }
 */
async function handleGetCurrentUrl(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }

  return { uid, url: webContents.getURL() };
}

/**
 * get_title – ambil judul halaman aktif
 * payload: { uid }
 */
async function handleGetTitle(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }

  return { uid, title: webContents.getTitle() };
}

module.exports = {
  get_tabs:        handleGetTabs,
  open_tab:        handleOpenTab,
  focus_tab:       handleFocusTab,
  reload_tab:      handleReloadTab,
  close_tab:       handleCloseTab,
  open_monitor:    handleOpenMonitor,
  close_monitor:   handleCloseMonitor,
  capture_tab:     handleCaptureTab,
  move_tab:        handleMoveTab,
  scroll_tab:      handleScrollTab,
  tap_tab:         handleTapTab,
  type_tab:        handleTypeTab,
  key_tab:         handleKeyTab,
  navigate_url:    handleNavigateUrl,
  get_current_url: handleGetCurrentUrl,
  get_title:       handleGetTitle,
};
