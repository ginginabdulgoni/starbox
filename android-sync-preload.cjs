// android-sync-preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

function on(channel, callback) {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("androidSync", {
  listDevices: () => ipcRenderer.invoke("android-sync-list-devices"),
  // Boots a StarBox-registered device that isn't running yet (reuses the
  // same "android-start" channel the normal Android page uses) so it can be
  // selected in the picker before it has an adbId. Always headless — the
  // grid tile IS the display, so the native QEMU window must not also pop
  // up (that's the "double screen" for the same device otherwise).
  startDevice: (uid, options = {}) => ipcRenderer.invoke("android-start", uid, { headless: true, ...options }),
  // Actually stops the emulator (same channel the main Android page's Stop
  // button uses) — separate from disconnect(), which only tears down the
  // StarSync video/control session and leaves the emulator running.
  stopDevice: (uid) => ipcRenderer.invoke("android-stop", uid),
  connect: (adbId, options) => ipcRenderer.invoke("android-sync-connect", adbId, options),
  disconnect: (adbId) => ipcRenderer.invoke("android-sync-disconnect", adbId),
  disconnectAll: () => ipcRenderer.invoke("android-sync-disconnect-all"),
  touch: (adbId, evt) => ipcRenderer.invoke("android-sync-touch", adbId, evt),
  text: (adbId, text) => ipcRenderer.invoke("android-sync-text", adbId, text),
  nav: (adbId, keycode) => ipcRenderer.invoke("android-sync-nav", adbId, keycode),
  rotate: (adbId) => ipcRenderer.invoke("android-sync-rotate", adbId),
  reboot: (adbId) => ipcRenderer.invoke("android-sync-reboot", adbId),
  waitBoot: (adbId, timeoutMs) => ipcRenderer.invoke("android-sync-wait-boot", adbId, timeoutMs),
  launchApp: (adbId, packageName) => ipcRenderer.invoke("android-sync-launch-app", adbId, packageName),

  // Virtual SIM (local emulator telephony simulation via the emulator's own
  // console — emulator-only, no effect/meaning for a physical phone).
  simSendSms: (adbId, from, text) => ipcRenderer.invoke("android-sim-send-sms", adbId, from, text),
  simCall: (adbId, number) => ipcRenderer.invoke("android-sim-call", adbId, number),
  simAcceptCall: (adbId, number) => ipcRenderer.invoke("android-sim-accept-call", adbId, number),
  simCancelCall: (adbId, number) => ipcRenderer.invoke("android-sim-cancel-call", adbId, number),
  simSetNetwork: (adbId, opts) => ipcRenderer.invoke("android-sim-set-network", adbId, opts),
  simSetGps: (adbId, lat, lon, altitude) => ipcRenderer.invoke("android-sim-set-gps", adbId, lat, lon, altitude),
  simStartGpsRoute: (adbId, waypoints, options) =>
    ipcRenderer.invoke("android-sim-start-gps-route", adbId, waypoints, options),
  simStopGpsRoute: (adbId) => ipcRenderer.invoke("android-sim-stop-gps-route", adbId),
  simSetPhoneNumber: (adbId, number) => ipcRenderer.invoke("android-sim-set-phone-number", adbId, number),
  onGpsUpdate: (callback) => on("android-sim-gps-update", callback),

  // Virtual camera: host webcam passthrough is launch-time only (needs a
  // restart), the virtual-scene image swap is live (needs the device to
  // have been started with camera mode 'virtualscene').
  listWebcams: () => ipcRenderer.invoke("android-camera-list-webcams"),
  pickCameraImage: () => ipcRenderer.invoke("android-camera-pick-image"),
  setSceneImage: (adbId, target, imagePath) =>
    ipcRenderer.invoke("android-camera-set-scene-image", adbId, target, imagePath),

  // Device Profile: spoof manufacturer/model/brand — rootable ('google_apis'
  // variant) emulators only, see android-manager.js applyDeviceProfile().
  listDeviceProfilePresets: () => ipcRenderer.invoke("android-device-profile-list-presets"),
  applyDeviceProfile: (adbId, profile) => ipcRenderer.invoke("android-device-profile-apply", adbId, profile),
  installPlayStore: (adbId) => ipcRenderer.invoke("android-device-profile-install-playstore", adbId),
  onDeviceProfileProgress: (callback) => on("android-device-profile-progress", callback),

  onFrame: (callback) => on("android-sync-frame", callback),
  onConfig: (callback) => on("android-sync-config", callback),
  onStatus: (callback) => on("android-sync-status", callback),
  onLog: (callback) => on("android-sync-log", callback),
});
