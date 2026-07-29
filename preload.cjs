const { contextBridge, ipcRenderer } = require('electron');

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

  android: {
    checkInstallation: () => ipcRenderer.invoke('android-check-installation'),
    getStatus: (uid) => ipcRenderer.invoke('android-get-status', uid),
    download: (uid) => ipcRenderer.invoke('android-download', uid),
    start: (uid, options = {}) => ipcRenderer.invoke('android-start', uid, options),
    stop: (uid) => ipcRenderer.invoke('android-stop', uid),
    fixIssues: (uid) => ipcRenderer.invoke('android-fix-issues', uid),
    killAdb: () => ipcRenderer.invoke('android-kill-adb'),
    accelStatus: () => ipcRenderer.invoke('android-accel-status'),
    enableAcceleration: () => ipcRenderer.invoke('android-enable-acceleration'),
    onDownloadProgress: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('android-download-progress', (_event, data) => callback(data));
    },
    onStartProgress: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('android-start-progress', (_event, data) => callback(data));
    },
    onFixProgress: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('android-fix-progress', (_event, data) => callback(data));
    },
  },

  androidRemote: {
    getDevices: () => ipcRenderer.invoke('android-remote-load'),
    addDevice: (payload) => ipcRenderer.invoke('android-remote-add', payload),
    editDevice: (payload) => ipcRenderer.invoke('android-remote-edit', payload),
    updateDevice: (uid, updates) => ipcRenderer.invoke('android-remote-update', uid, updates),
    deleteDevice: (uid) => ipcRenderer.invoke('android-remote-delete', uid),
    updateStatus: (uid, status) =>
      ipcRenderer.invoke('android-remote-update-status', uid, status),
      listAdbDevices: () => ipcRenderer.invoke('android-list-physical-devices'),
      runAction: (uid, action, payload) =>
        ipcRenderer.invoke('android-remote-run-action', uid, action, payload),
      openDisplay: (uid) => ipcRenderer.invoke('android-remote-open-display', uid),
      closeDisplay: (uid) => ipcRenderer.invoke('android-remote-close-display', uid),
      checkScrcpy: () => ipcRenderer.invoke('scrcpy-check'),
      installScrcpy: () => ipcRenderer.invoke('scrcpy-install'),
    sendShortcut: (uid, shortcutId) =>
      ipcRenderer.invoke('android-remote-send-shortcut', uid, shortcutId),
    captureScreenshot: (uid) =>
      ipcRenderer.invoke('android-remote-screenshot', uid),
    scanLocalWifi: (options) => ipcRenderer.invoke('android-scan-local-wifi', options),
    connectManualAdb: (options) => ipcRenderer.invoke('android-connect-manual-adb', options),
    cancelAction: (uid) =>
      ipcRenderer.invoke('android-remote-cancel-action', uid),
    onStatusUpdated: (callback) => {
      if (typeof callback !== 'function') return;
      const listener = (_event, updates) => callback(updates);
      ipcRenderer.on('android-remote-status-updated', listener);
      return () =>
        ipcRenderer.removeListener('android-remote-status-updated', listener);
    },
    onWifiScanProgress: (callback) => {
      if (typeof callback !== 'function') return;
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('adb-wifi-scan-progress', listener);
      return () =>
        ipcRenderer.removeListener('adb-wifi-scan-progress', listener);
    },
    onScrcpyInstallProgress: (callback) => {
      if (typeof callback !== 'function') return;
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('scrcpy-install-progress', listener);
      return () =>
        ipcRenderer.removeListener('scrcpy-install-progress', listener);
    },
  },

  // iOS Simulator APIs
  ios: {
    checkAvailability: () => ipcRenderer.invoke('ios-check-availability'),
    getDevices: () => ipcRenderer.invoke('ios-get-devices'),
    boot: (udid) => ipcRenderer.invoke('ios-boot', udid),
    shutdown: (udid) => ipcRenderer.invoke('ios-shutdown', udid),
    shutdownAll: () => ipcRenderer.invoke('ios-shutdown-all'),
    installApp: (udid, appPath) => ipcRenderer.invoke('ios-install-app', udid, appPath),
    launchApp: (udid, bundleId) => ipcRenderer.invoke('ios-launch-app', udid, bundleId),
    uninstallApp: (udid, bundleId) => ipcRenderer.invoke('ios-uninstall-app', udid, bundleId),
    openURL: (udid, url) => ipcRenderer.invoke('ios-open-url', udid, url),
    getScreenshot: (udid, outputPath) => ipcRenderer.invoke('ios-get-screenshot', udid, outputPath),
    eraseDevice: (udid) => ipcRenderer.invoke('ios-erase-device', udid),
    isBooted: (udid) => ipcRenderer.invoke('ios-is-booted', udid),
    onBootProgress: (callback) => {
      ipcRenderer.on('ios-boot-progress', (event, data) => {
        if (typeof callback === 'function') {
          callback(data);
        }
      });
    }
  },

  // WhatsApp Gateway APIs
  whatsappGateway: {
    getDevices: () => ipcRenderer.invoke('wa-get-devices'),
    createDevice: (deviceId, name) => ipcRenderer.invoke('wa-create-device', deviceId, name),
    startDevice: (deviceId) => ipcRenderer.invoke('wa-start-device', deviceId),
    stopDevice: (deviceId, options = {}) =>
      ipcRenderer.invoke('wa-stop-device', deviceId, options),
    deleteDevice: (deviceId) => ipcRenderer.invoke('wa-delete-device', deviceId),
    sendMessage: (deviceId, phone, message, options = {}) =>
      ipcRenderer.invoke('wa-send-message', deviceId, phone, message, options),
    getStatus: (deviceId) => ipcRenderer.invoke('wa-get-status', deviceId),
    getDeviceProfile: (deviceId) => ipcRenderer.invoke('wa-get-profile', deviceId),

    // Auto-reply
    getAutoReplies: (deviceId) => ipcRenderer.invoke('wa-get-auto-replies', deviceId),
    addAutoReply: (deviceId, keyword, replyMessage, scope, matchType) => ipcRenderer.invoke('wa-add-auto-reply', deviceId, keyword, replyMessage, scope, matchType),
    deleteAutoReply: (replyId) => ipcRenderer.invoke('wa-delete-auto-reply', replyId),
    toggleAutoReply: (replyId, isActive) => ipcRenderer.invoke('wa-toggle-auto-reply', replyId, isActive),
    setAutoReplyEnabled: (deviceId, enabled) => ipcRenderer.invoke('wa-set-auto-reply-enabled', deviceId, enabled),
    setAutoRejectCalls: (deviceId, enabled) => ipcRenderer.invoke('wa-set-auto-reject-calls', deviceId, enabled),

    // Schedule
    getSchedules: (deviceId) => ipcRenderer.invoke('wa-get-schedules', deviceId),
    addSchedule: (deviceId, scheduleName, cronExpression, message, recipients) =>
      ipcRenderer.invoke('wa-add-schedule', deviceId, scheduleName, cronExpression, message, recipients),
    deleteSchedule: (scheduleId) => ipcRenderer.invoke('wa-delete-schedule', scheduleId),

    // Logs
    getMessageLogs: (deviceId, limit) => ipcRenderer.invoke('wa-get-message-logs', deviceId, limit),
    clearLogs: (deviceId, days) => ipcRenderer.invoke('wa-clear-logs', deviceId, days),
    openWhatsAppWeb: (deviceId) => ipcRenderer.invoke('wa-open-web', deviceId),
    sendTyping: (deviceId, phone) => ipcRenderer.invoke('wa-send-typing', deviceId, phone),

    // Event listeners
    onQRCode: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('wa-qr-code', (_event, deviceId, qr) => callback(deviceId, qr));
    },
    onConnected: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('wa-connected', (_event, deviceId, phone) => callback(deviceId, phone));
    },
    onStatusChange: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('wa-status-change', (_event, deviceId, status) => callback(deviceId, status));
    },
    onScheduleStatus: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('wa-schedule-status', (_event, scheduleId, status) => callback(scheduleId, status));
    },
    onMessageReceived: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('wa-message-received', (_event, deviceId, from, message) => callback(deviceId, from, message));
    }
  },

  // Remox – SSH / Telnet Terminal Manager
  remox: {
    loadConnections: () => ipcRenderer.invoke('remox:load-connections'),
    saveConnection: (conn) => ipcRenderer.invoke('remox:save-connection', conn),
    deleteConnection: (id) => ipcRenderer.invoke('remox:delete-connection', id),
    connect: (opts) => ipcRenderer.invoke('remox:connect', opts),
    sendData: (opts) => ipcRenderer.send('remox:send-data', opts),
    resize: (opts) => ipcRenderer.send('remox:resize', opts),
    disconnect: (sessionId) => ipcRenderer.invoke('remox:disconnect', sessionId),
    ping: (opts) => ipcRenderer.invoke('remox:ping', opts),
    launchRdp: (opts) => ipcRenderer.invoke('remox:launch-rdp', opts),
    cloudSync: () => ipcRenderer.invoke('remox:cloud-sync'),
    pullFromCloud: () => ipcRenderer.invoke('remox:pull-from-cloud'),
    onData: (cb) => {
      const listener = (_e, d) => cb(d);
      ipcRenderer.on('remox:data', listener);
      return () => ipcRenderer.removeListener('remox:data', listener);
    },
    onStatus: (cb) => {
      const listener = (_e, d) => cb(d);
      ipcRenderer.on('remox:status', listener);
      return () => ipcRenderer.removeListener('remox:status', listener);
    },
  },

  resourceMonitor: {
    get: () => ipcRenderer.invoke('resource-monitor-get'),
    getProcesses: (limit) => ipcRenderer.invoke('resource-monitor-processes', limit),
    killProcess: (pid) => ipcRenderer.invoke('resource-monitor-kill', pid),
    cleanScan: () => ipcRenderer.invoke('system-clean-scan'),
    cleanRun: (ids) => ipcRenderer.invoke('system-clean-run', ids),
  },

  // MikroTik Manager
  mikrotik: {
    loadDevices:         ()       => ipcRenderer.invoke('mikrotik:load-devices'),
    saveDevice:          (device) => ipcRenderer.invoke('mikrotik:save-device', device),
    deleteDevice:        (id)     => ipcRenderer.invoke('mikrotik:delete-device', id),
    scanNetwork:         ()       => ipcRenderer.invoke('mikrotik:scan-network'),
    openWebUI:           (opts)   => ipcRenderer.invoke('mikrotik:open-webui', opts),
    openWebUIProxy:      (opts)   => ipcRenderer.invoke('mikrotik:open-webui-proxy', opts),
    openSSH:             (opts)   => ipcRenderer.invoke('mikrotik:open-ssh', opts),
    launchWinbox:        (opts)   => ipcRenderer.invoke('mikrotik:launch-winbox', opts),
    startProxy:          (opts)   => ipcRenderer.invoke('mikrotik:start-proxy', opts),
    stopProxy:           (opts)   => ipcRenderer.invoke('mikrotik:stop-proxy', opts),
    startWinboxTunnel:   (opts)   => ipcRenderer.invoke('mikrotik:start-winbox-tunnel', opts),
    stopWinboxTunnel:    (opts)   => ipcRenderer.invoke('mikrotik:stop-winbox-tunnel', opts),
    getWinboxTunnelPort: (opts)   => ipcRenderer.invoke('mikrotik:get-winbox-tunnel-port', opts),
    syncToServer:        ()       => ipcRenderer.invoke('mikrotik:sync-to-server'),
  },

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

  virtualOS: {
    list: () => ipcRenderer.invoke('os-vm-list'),
    save: (payload) => ipcRenderer.invoke('os-vm-upsert', payload),
    delete: (id) => ipcRenderer.invoke('os-vm-delete', id),
    start: (id) => ipcRenderer.invoke('os-vm-start', id),
    stop: (id) => ipcRenderer.invoke('os-vm-stop', id),
    restart: (id) => ipcRenderer.invoke('os-vm-restart', id),
    snapshot: (id, name) => ipcRenderer.invoke('os-vm-snapshot', id, name),
    snapshotRestore: (id, snapshotId) => ipcRenderer.invoke('os-vm-snapshot-restore', id, snapshotId),
    snapshotDelete: (id, snapshotId) => ipcRenderer.invoke('os-vm-snapshot-delete', id, snapshotId),
    pause: (id) => ipcRenderer.invoke('os-vm-pause', id),
    resume: (id) => ipcRenderer.invoke('os-vm-resume', id),
    browseIsoFile: () => ipcRenderer.invoke('browse-iso-file'),
    downloadIso: (opts) => ipcRenderer.invoke('download-iso', opts),
    listCachedIsos: () => ipcRenderer.invoke('list-cached-isos'),
    onIsoDownloadProgress: (cb) => {
      const l = (_e, d) => cb(d);
      ipcRenderer.on('iso-download-progress', l);
      return () => ipcRenderer.removeListener('iso-download-progress', l);
    },
    forceStop: (id) => ipcRenderer.invoke('os-vm-force-stop', id),
    killAllQemu: () => ipcRenderer.invoke('os-vm-kill-all-qemu'),
    checkQemu: () => ipcRenderer.invoke('os-vm-check-qemu'),
    installQemu: () => ipcRenderer.invoke('os-vm-install-qemu'),
    onQemuInstallProgress: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('qemu-install-progress', fn);
      return () => ipcRenderer.removeListener('qemu-install-progress', fn);
    },
    openVncWindow: (opts) => ipcRenderer.invoke('open-vnc-window', opts),
    focusVncWindow: (vmId) => ipcRenderer.invoke('focus-vnc-window', vmId),
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
  starCapture: {
    screenshotFull:     ()            => ipcRenderer.invoke('starcapture:screenshot-full'),
    screenshotWindow:   ()            => ipcRenderer.invoke('starcapture:screenshot-window'),
    screenshotArea:     ()            => ipcRenderer.invoke('starcapture:screenshot-area'),
    getScreenSources:   ()            => ipcRenderer.invoke('starcapture:get-screen-sources'),
    getAreaForRecord:   ()            => ipcRenderer.invoke('starcapture:get-area-for-record'),
    copyImage:          (dataUrl)     => ipcRenderer.invoke('starcapture:copy-image', dataUrl),
    saveImage:          (opts)        => ipcRenderer.invoke('starcapture:save-image', opts),
    saveVideo:          (opts)        => ipcRenderer.invoke('starcapture:save-video', opts),
    openFile:           (filePath)    => ipcRenderer.invoke('starcapture:open-file', filePath),
    getShortcuts:       ()            => ipcRenderer.invoke('starcapture:get-shortcuts'),
    setShortcuts:       (s)           => ipcRenderer.invoke('starcapture:set-shortcuts', s),
    onShortcut: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const fn = (_e, mode) => cb(mode);
      ipcRenderer.on('starcapture:shortcut', fn);
      return () => ipcRenderer.removeListener('starcapture:shortcut', fn);
    },
    onCancelled: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const fn = () => cb();
      ipcRenderer.on('starcapture:cancelled', fn);
      return () => ipcRenderer.removeListener('starcapture:cancelled', fn);
    },
  },

  // Remote Control API – kontrol StarBox di komputer lain
  cctv: {
    getCameras:   ()         => ipcRenderer.invoke('cctv-get-cameras'),
    saveCamera:   (camera)   => ipcRenderer.invoke('cctv-save-camera', camera),
    deleteCamera: (uid)      => ipcRenderer.invoke('cctv-delete-camera', uid),
    startStream:  (camera)   => ipcRenderer.invoke('cctv-start-stream', camera),
    stopStream:   (uid)      => ipcRenderer.invoke('cctv-stop-stream', uid),
    streamStatus: (uid)      => ipcRenderer.invoke('cctv-stream-status', uid),
    snapshot:     (camera)   => ipcRenderer.invoke('cctv-snapshot', camera),
    checkFfmpeg:  ()         => ipcRenderer.invoke('cctv-check-ffmpeg'),
    installFfmpeg: ()        => ipcRenderer.invoke('cctv-install-ffmpeg'),
    onFfmpegInstallProgress: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('cctv-ffmpeg-install-progress', fn);
      return () => ipcRenderer.removeListener('cctv-ffmpeg-install-progress', fn);
    },
    scanOnvif:    (opts)     => ipcRenderer.invoke('cctv-scan-onvif', opts),
    probeOnvif:   (ip, port, user, pass) => ipcRenderer.invoke('cctv-probe-onvif', ip, port, user, pass),
    onScanProgress: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('cctv-scan-progress', fn);
      return () => ipcRenderer.removeListener('cctv-scan-progress', fn);
    },
    ptzMove:      (opts) => ipcRenderer.invoke('cctv-ptz-move', opts),
    ptzStop:      (opts) => ipcRenderer.invoke('cctv-ptz-stop', opts),
    ptzPresets:   (opts) => ipcRenderer.invoke('cctv-ptz-presets', opts),
    ptzGotoPreset:(opts) => ipcRenderer.invoke('cctv-ptz-goto-preset', opts),
    ptzSetPreset: (opts) => ipcRenderer.invoke('cctv-ptz-set-preset', opts),
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
