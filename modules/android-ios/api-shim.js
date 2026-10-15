// API Android / iOS lewat bridge modul (window.electronAPI.modules).
// Dipakai renderer modul, android-emulator.html dan ios-simulator.html.
const androidEmuApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    checkInstallation: call("android-check-installation"),
    getVersions: call("android-get-versions"),
    getStatus: call("android-get-status"),
    getDeviceInfo: call("android-get-device-info"),
    download: call("android-download"),
    start: call("android-start"),
    stop: call("android-stop"),
    fixIssues: call("android-fix-issues"),
    killAdb: call("android-kill-adb"),
    accelStatus: call("android-accel-status"),
    enableAcceleration: call("android-enable-acceleration"),
    onDownloadProgress: (cb) => m.on("android-download-progress", cb),
    onStartProgress: (cb) => m.on("android-start-progress", cb),
    onFixProgress: (cb) => m.on("android-fix-progress", cb),
  };
})();

const androidRemoteApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    getDevices: call("android-remote-load"),
    addDevice: call("android-remote-add"),
    editDevice: call("android-remote-edit"),
    updateDevice: call("android-remote-update"),
    deleteDevice: call("android-remote-delete"),
    updateStatus: call("android-remote-update-status"),
    listAdbDevices: call("android-list-physical-devices"),
    runAction: call("android-remote-run-action"),
    openDisplay: call("android-remote-open-display"),
    closeDisplay: call("android-remote-close-display"),
    checkScrcpy: call("scrcpy-check"),
    installScrcpy: call("scrcpy-install"),
    sendShortcut: call("android-remote-send-shortcut"),
    captureScreenshot: call("android-remote-screenshot"),
    scanLocalWifi: call("android-scan-local-wifi"),
    connectManualAdb: call("android-connect-manual-adb"),
    cancelAction: call("android-remote-cancel-action"),
    onStatusUpdated: (cb) => m.on("android-remote-status-updated", cb),
    onWifiScanProgress: (cb) => m.on("adb-wifi-scan-progress", cb),
    onScrcpyInstallProgress: (cb) => m.on("scrcpy-install-progress", cb),
  };
})();

const iosApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    checkAvailability: call("ios-check-availability"),
    getDevices: call("ios-get-devices"),
    boot: call("ios-boot"),
    shutdown: call("ios-shutdown"),
    shutdownAll: call("ios-shutdown-all"),
    installApp: call("ios-install-app"),
    launchApp: call("ios-launch-app"),
    uninstallApp: call("ios-uninstall-app"),
    openURL: call("ios-open-url"),
    getScreenshot: call("ios-get-screenshot"),
    eraseDevice: call("ios-erase-device"),
    isBooted: call("ios-is-booted"),
    onBootProgress: (cb) => m.on("ios-boot-progress", cb),
  };
})();

window.androidEmuApi = androidEmuApi;
window.androidRemoteApi = androidRemoteApi;
window.iosApi = iosApi;
