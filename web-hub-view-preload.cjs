/**
 * web-hub-view-preload.cjs
 * Diinjek ke setiap BrowserView di Web Hub.
 * Tugasnya: intercept Notification API & unread badge lalu kirim ke main process.
 */
const { ipcRenderer } = require('electron');

// ─── Intercept Notification API ───────────────────────────────────────────────
const OriginalNotification = window.Notification;

class PatchedNotification extends OriginalNotification {
  constructor(title, options) {
    super(title, options);
    // Kirim badge increment ke main
    ipcRenderer.send('hub-view-badge', { action: 'increment' });
  }
  static get permission() { return OriginalNotification.permission; }
  static requestPermission(...args) { return OriginalNotification.requestPermission(...args); }
}
window.Notification = PatchedNotification;

// ─── Watch document.title untuk angka unread (pola: "(3) WhatsApp") ──────────
let _lastBadge = 0;
function extractBadgeFromTitle(title) {
  const m = title.match(/^\((\d+)\)/);
  return m ? parseInt(m[1], 10) : 0;
}

const titleObserver = new MutationObserver(() => {
  const badge = extractBadgeFromTitle(document.title);
  if (badge !== _lastBadge) {
    _lastBadge = badge;
    ipcRenderer.send('hub-view-badge', { action: 'set', count: badge });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  titleObserver.observe(document.querySelector('title') || document.head, {
    subtree: true, characterData: true, childList: true,
  });
  // Check awal
  _lastBadge = extractBadgeFromTitle(document.title);
  if (_lastBadge > 0) ipcRenderer.send('hub-view-badge', { action: 'set', count: _lastBadge });
});

// ─── Clipboard Sync ──────────────────────────────────────────────────
// Saat user copy di tab ini — kirim teks ke main untuk history
document.addEventListener('copy', () => {
  // Baca dari clipboard setelah copy event selesai
  setTimeout(() => {
    navigator.clipboard.readText().then(text => {
      if (text && text.trim()) {
        ipcRenderer.send('hub-clipboard-copy', text);
      }
    }).catch(() => {}); // izin clipboard bisa ditolak
  }, 50);
});

// Dengarkan broadcast clipboard dari tab lain
ipcRenderer.on('hub-clipboard-broadcast', (_e, text) => {
  // Tulis ke clipboard OS — user bisa langsung Ctrl+V
  navigator.clipboard.writeText(text).catch(() => {});
});
