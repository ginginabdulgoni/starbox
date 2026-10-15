const { contextBridge, ipcRenderer } = require('electron');

let moduleBridge = { invoke: [], send: [], events: [] };
try {
  moduleBridge = ipcRenderer.sendSync('modules-get-bridge') || moduleBridge;
} catch (_) {}

contextBridge.exposeInMainWorld('electronAPI', {
  check: () => '✅ Preload berhasil',
  loadDevices: (dbType) => ipcRenderer.invoke('load-devices', dbType),
  addDevice: (payload) => ipcRenderer.invoke('add-device', payload),
  deleteDevice: (uid) => ipcRenderer.invoke('delete-device', uid),
  runDevice: (uid, service) => ipcRenderer.send('run-device', uid, service),
  stopDevice: (uid) => ipcRenderer.send('stop-device', uid),
  runDeviceInNewWindow: (uid, service) => ipcRenderer.invoke('start-device-new-window', uid, service),
  sendWhatsappMessages: (uid, messages, options) =>
    ipcRenderer.invoke('send-whatsapp-messages', uid, messages, options),
  focusDevice: (uid) => ipcRenderer.send('focus-device', uid),
  getDeviceSourceId: (uid) => ipcRenderer.invoke('get-device-source-id', uid),
  showSaveDialogRecording: (name) => ipcRenderer.invoke('show-save-dialog-recording', name),
  saveConfig: (config) => ipcRenderer.send('save-config', config),
  loadConfig: () => ipcRenderer.sendSync('load-config'),
  getLoginItemSettings: () => ipcRenderer.sendSync('get-login-item-settings'),
  setLoginItemSettings: (val) => ipcRenderer.send('set-login-item-settings', val),
  setDND: (active) => ipcRenderer.send('set-dnd', active),
  broadcastDND: (active) => ipcRenderer.send('broadcast-dnd', active),
  invoke: ipcRenderer.invoke,
  send: ipcRenderer.send,
  on: ipcRenderer.on,
  editDevice: (payload) => ipcRenderer.invoke('edit-device', payload),
  toggleRemoteEnabled: (uid, enabled) => ipcRenderer.invoke('toggle-remote-enabled', uid, enabled),
  onDeviceStatusUpdated: (callback) => {
    ipcRenderer.on('device-status-updated', (event, uid, status) => {
      if (typeof callback === 'function') {
        callback(uid, status);
      }
    });
  },
  log: (message) => ipcRenderer.send('log-message', message),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  ensureMonitorWindow: (uid) => ipcRenderer.send('ensure-monitor-window', uid),
  closeMonitorWindow: (uid) => ipcRenderer.send('close-monitor-window', uid),
  updateAutomationMonitor: (uid, payload) =>
    ipcRenderer.send('automation-monitor-update', uid, payload),
  isDeviceRunning: (uid) => ipcRenderer.invoke('is-device-running', uid),
  setInputGuardState: (uid, enabled) => ipcRenderer.invoke('set-input-guard-state', uid, enabled),
  onTriggerFetchPending: (callback) => {
    ipcRenderer.on('trigger-fetch-pending', (event, uid) => {
      if (typeof callback === 'function') {
        callback(uid);
      }
    });
  },
  onControlAutomation: (callback) => {
    ipcRenderer.on('control-automation', (event, uid, state) => {
      if (typeof callback === 'function') {
        callback(uid, state);
      }
    });
  },
  onAutomationSettingsUpdated: (callback) => {
    ipcRenderer.on('automation-settings-updated', (event, uid, settings) => {
      if (typeof callback === 'function') {
        callback(uid, settings);
      }
    });
  },
    auth: {
      getSession: () => ipcRenderer.invoke('auth-get-session'),
      login: (credentials) => ipcRenderer.invoke('auth-login', credentials),
      register: (payload) => ipcRenderer.invoke('auth-register', payload),
      logout: () => ipcRenderer.invoke('auth-logout'),
      refreshPackage: () => ipcRenderer.invoke('auth-refresh-package'),
      changePassword: (payload) => ipcRenderer.invoke('auth-change-password', payload),
      onSessionChanged: (callback) => {
      if (typeof callback !== 'function') return undefined;
      const listener = (_event, session) => callback(session);
      ipcRenderer.on('auth-session-updated', listener);
      return () => ipcRenderer.removeListener('auth-session-updated', listener);
    },
  },

  location: {
    get: () => ipcRenderer.invoke('get-user-location'),
    save: (payload) => ipcRenderer.invoke('save-user-location', payload),
    setVisibility: (visible) => ipcRenderer.invoke('set-location-visibility', visible),
  },

  community: {
    getMapPoints: () => ipcRenderer.invoke('get-community-map-points'),
  },

  // Remox – SSH / Telnet Terminal Manager
  resourceMonitor: {
    get: () => ipcRenderer.invoke('resource-monitor-get'),
    getProcesses: (limit) => ipcRenderer.invoke('resource-monitor-processes', limit),
    killProcess: (pid) => ipcRenderer.invoke('resource-monitor-kill', pid),
    cleanScan: () => ipcRenderer.invoke('system-clean-scan'),
    cleanRun: (ids) => ipcRenderer.invoke('system-clean-run', ids),
  },

  // MikroTik Manager
  resolveAssetUrl: (assetName) =>
    ipcRenderer.invoke('resolve-asset-url', assetName),
  getCountryCodes: () => ipcRenderer.invoke('get-country-codes'),
  isDevBuild: () => ipcRenderer.invoke('is-dev-build'),
  platform: () => process.platform,
  checkLatestVersion: (channel = 'stable') =>
    ipcRenderer.invoke('check-latest-version', channel),
  downloadVersion: (payload = {}) =>
    ipcRenderer.invoke('download-version', payload),
  onVersionDownloadProgress: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('version-download-progress', (_event, data) =>
      callback(data)
    );
  },

  // Logs API
  logs: {
    get: () => ipcRenderer.invoke('get-logs'),
    clear: () => ipcRenderer.invoke('clear-logs')
  },

  // Cron Job Manager API
  cron: {
    loadJobs: () => ipcRenderer.invoke('cron-load-jobs'),
    addJob: (job) => ipcRenderer.invoke('cron-add-job', job),
    editJob: (id, updates) => ipcRenderer.invoke('cron-edit-job', { id, updates }),
    deleteJob: (id) => ipcRenderer.invoke('cron-delete-job', id),
    toggleJob: (id, enabled) => ipcRenderer.invoke('cron-toggle-job', { id, enabled }),
    runNow: (id) => ipcRenderer.invoke('cron-run-now', id),
    getHistory: (id) => ipcRenderer.invoke('cron-get-history', id),
    clearHistory: (id) => ipcRenderer.invoke('cron-clear-history', id),
    validateExpr: (expr) => ipcRenderer.invoke('cron-validate-expr', expr),
    onJobExecuted: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('cron-job-executed', fn);
      return () => ipcRenderer.removeListener('cron-job-executed', fn);
    },
  },

  // StarCapture – Screenshot & Screen Recording
  // Remote Control API – kontrol StarBox di komputer lain
  // Modul (CCTV, dst.) – channel hanya diteruskan bila dideklarasikan di
  // manifest modul yang sedang aktif (lihat module-loader.js).
  modules: {
    getRendererConfigSync: () => ipcRenderer.sendSync('modules-get-renderer-config'),
    list: () => ipcRenderer.invoke('modules-list'),
    setEnabled: (id, enabled) => ipcRenderer.invoke('modules-set-enabled', id, enabled),
    relaunch: () => ipcRenderer.invoke('restart-app'),
    catalog: () => ipcRenderer.invoke('modules-catalog'),
    install: (id) => ipcRenderer.invoke('modules-install', id),
    uninstall: (id) => ipcRenderer.invoke('modules-uninstall', id),
    onInstallProgress: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('modules-install-progress', fn);
      return () => ipcRenderer.removeListener('modules-install-progress', fn);
    },
    invoke: (channel, ...args) => {
      if (!moduleBridge.invoke.includes(channel)) {
        return Promise.reject(new Error(`Channel modul tidak diizinkan: ${channel}`));
      }
      return ipcRenderer.invoke(channel, ...args);
    },
    send: (channel, ...args) => {
      if (!(moduleBridge.send || []).includes(channel)) return;
      ipcRenderer.send(channel, ...args);
    },
    on: (channel, cb) => {
      if (typeof cb !== 'function' || !moduleBridge.events.includes(channel)) return () => {};
      const fn = (_e, ...args) => cb(...args);
      ipcRenderer.on(channel, fn);
      return () => ipcRenderer.removeListener(channel, fn);
    },
  },

  remote: {
    /** Ambil status koneksi dan daftar client online milik user yang sama */
    getClients: () => ipcRenderer.invoke('remote:get-clients'),

    /** Paksa refresh daftar client dari server */
    refreshClients: () => ipcRenderer.send('remote:refresh-clients'),

    /** Kirim command ke client target dan tunggu hasilnya */
    sendCommand: (toClientId, command, payload) =>
      ipcRenderer.invoke('remote:send-command', { toClientId, command, payload }),

    /** Kirim command tanpa menunggu hasil (fire-and-forget) */
    fireCommand: (toClientId, command, payload) =>
      ipcRenderer.send('remote:fire-command', { toClientId, command, payload }),

    /** Buka window Remote Control */
    openWindow: () => ipcRenderer.invoke('remote:open-window'),

    /** Buka window monitor remote per device */
    openMonitorWindow: (payload) =>
      ipcRenderer.invoke('remote:open-monitor-window', payload),

    /** Event: daftar client berubah (client online/offline) */
    onClientsUpdated: (cb) =>
      ipcRenderer.on('remote:clients-updated', (_e, data) => cb(data)),

    /** Event: status koneksi ke server berubah */
    onConnectionChanged: (cb) =>
      ipcRenderer.on('remote:connection-changed', (_e, data) => cb(data)),

    /** Event: update metadata monitor window (jika window lama dipakai ulang) */
    onMonitorMetaUpdate: (cb) =>
      ipcRenderer.on('remote:monitor:update-meta', (_e, data) => cb(data)),
  },

  stardesk: {
    /** Ambil semua device milik user (online + offline) dari remote server */
    getMyDevices: () => ipcRenderer.invoke('stardesk:get-my-devices'),

    /** Status agent lokal – apakah sedang terhubung ke remote server */
    getAgentStatus: () => ipcRenderer.invoke('stardesk:agent-status'),

    /** Ganti nama device ini */
    renameDevice: (deviceName) => ipcRenderer.invoke('stardesk:rename-device', { deviceName }),

    /** Generate OTP agar user lain bisa remote masuk ke device ini */
    generateOtp: () => ipcRenderer.invoke('stardesk:generate-otp'),

    /** Hubungkan ke perangkat orang lain dengan Device ID + OTP */
    connectByCode: (clientId, code) => ipcRenderer.invoke('stardesk:connect-by-code', { clientId, code }),

    /** Hubungkan ke perangkat orang lain dengan Device ID + PIN permanen */
    connectByPin: (clientId, pin) => ipcRenderer.invoke('stardesk:connect-by-pin', { clientId, pin }),

    /** Ambil pengaturan StarDesk lokal (PIN, permission toggles) */
    getSettings: () => ipcRenderer.invoke('stardesk:get-settings'),

    /** Simpan pengaturan StarDesk lokal */
    saveSettings: (settings) => ipcRenderer.invoke('stardesk:save-settings', settings),

    /** Ambil PIN guest (auto-generate jika belum ada) */
    getGuestPin: () => ipcRenderer.invoke('stardesk:guest-pin-get'),

    /** Refresh PIN guest (generate baru) */
    refreshGuestPin: () => ipcRenderer.invoke('stardesk:guest-pin-refresh'),

    /** Buka jendela preview layar perangkat ini */
    openSelfPreview: () => ipcRenderer.invoke('stardesk:open-self-preview'),

    /** Buka jendela remote viewer untuk perangkat lain */
    openRemoteViewer: (targetClientId, deviceName) =>
      ipcRenderer.invoke('stardesk:open-remote-viewer', { targetClientId, deviceName }),

    /** Event: device lain dalam akun user yang sama online */
    onDeviceOnline: (cb) =>
      ipcRenderer.on('remote:clients-updated', (_e, data) => cb(data)),
  },
});

// Guard MediaSession action handler for browsers that do not support PIP actions.
// WhatsApp Web registers "enterpictureinpicture" which throws on older Chromium/Electron.
try {
  const injectMediaSessionShim = () => {
    const shim = `
      (() => {
        try {
          const ms = navigator.mediaSession;
          if (!ms || typeof ms.setActionHandler !== 'function') return;
          const original = ms.setActionHandler.bind(ms);
          const unsupported = new Set(['enterpictureinpicture', 'leavepictureinpicture']);
          ms.setActionHandler = function(action, handler) {
            const normalized = typeof action === 'string' ? action.toLowerCase() : action;
            if (unsupported.has(normalized)) {
              console.debug('[Starbox] Ignoring unsupported MediaSession action:', normalized);
              return;
            }
            try {
              return original(action, handler);
            } catch (err) {
              const msg = err && err.message;
              if (msg && msg.includes('setActionHandler')) {
                console.debug('[Starbox] Swallowed MediaSession error for action', normalized, '-', msg);
                return;
              }
              throw err;
            }
          };
        } catch (err) {
          console.debug('[Starbox] MediaSession shim failed:', err?.message || err);
        }
      })();
    `;
    const blob = new Blob([shim], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('script');
    el.src = url;
    (document.documentElement || document.head || document.body).appendChild(el);
    el.onload = () => {
      el.remove();
      URL.revokeObjectURL(url);
    };
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectMediaSessionShim, { once: true });
    } else {
      injectMediaSessionShim();
    }
  }
} catch (err) {
  console.debug('[Starbox] Failed to install MediaSession shim:', err?.message || err);
}
