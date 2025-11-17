const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  check: () => '✅ Preload berhasil',
  loadDevices: () => ipcRenderer.invoke('load-devices'),
  addDevice: (payload) => ipcRenderer.invoke('add-device', payload),
  deleteDevice: (uid) => ipcRenderer.invoke('delete-device', uid),
  runDevice: (uid, service) => ipcRenderer.send('run-device', uid, service),
  stopDevice: (uid) => ipcRenderer.send('stop-device', uid),
  sendWhatsappMessages: (uid, messages, options) =>
    ipcRenderer.invoke('send-whatsapp-messages', uid, messages, options),
  focusDevice: (uid) => ipcRenderer.send('focus-device', uid),
  saveConfig: (config) => ipcRenderer.send('save-config', config),
  loadConfig: () => ipcRenderer.sendSync('load-config'),
  invoke: ipcRenderer.invoke,
  send: ipcRenderer.send,
  on: ipcRenderer.on,
  editDevice: (payload) => ipcRenderer.invoke('edit-device', payload),
  onDeviceStatusUpdated: (callback) => {
    ipcRenderer.on('device-status-updated', (event, uid) => {
      if (typeof callback === 'function') {
        callback(uid);
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
    auth: {
      getSession: () => ipcRenderer.invoke('auth-get-session'),
      login: (credentials) => ipcRenderer.invoke('auth-login', credentials),
      register: (payload) => ipcRenderer.invoke('auth-register', payload),
      logout: () => ipcRenderer.invoke('auth-logout'),
      refreshPackage: () => ipcRenderer.invoke('auth-refresh-package'),
      onSessionChanged: (callback) => {
      if (typeof callback !== 'function') return undefined;
      const listener = (_event, session) => callback(session);
      ipcRenderer.on('auth-session-updated', listener);
      return () => ipcRenderer.removeListener('auth-session-updated', listener);
    },
  },

  android: {
    checkInstallation: () => ipcRenderer.invoke('android-check-installation'),
    download: (uid) => ipcRenderer.invoke('android-download', uid),
    start: (uid, options = {}) => ipcRenderer.invoke('android-start', uid, options),
    stop: (uid) => ipcRenderer.invoke('android-stop', uid),
    fixIssues: (uid) => ipcRenderer.invoke('android-fix-issues', uid),
    killAdb: () => ipcRenderer.invoke('android-kill-adb'),
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

  resolveAssetUrl: (assetName) =>
    ipcRenderer.invoke('resolve-asset-url', assetName),
  getCountryCodes: () => ipcRenderer.invoke('get-country-codes'),
  isDevBuild: () => ipcRenderer.invoke('is-dev-build'),
  platform: () => process.platform,
  checkLatestVersion: (channel = 'stable') =>
    ipcRenderer.invoke('check-latest-version', channel),

  // Logs API
  logs: {
    get: () => ipcRenderer.invoke('get-logs'),
    clear: () => ipcRenderer.invoke('clear-logs')
  }
});
