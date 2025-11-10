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
    onDownloadProgress: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('android-download-progress', (_event, data) => callback(data));
    },
    onStartProgress: (callback) => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('android-start-progress', (_event, data) => callback(data));
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
  }
});
