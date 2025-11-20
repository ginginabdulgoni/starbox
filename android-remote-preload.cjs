// android-remote-preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  androidRemote: {
    // Power controls
    wake: (uid) => ipcRenderer.invoke("android-remote-wake", uid),
    unlock: (uid) => ipcRenderer.invoke("android-remote-unlock", uid),

    // Navigation controls
    pressBack: (uid) => ipcRenderer.invoke("android-remote-press-back", uid),
    pressHome: (uid) => ipcRenderer.invoke("android-remote-press-home", uid),
    pressRecent: (uid) => ipcRenderer.invoke("android-remote-press-recent", uid),

    // Screen controls
    rotate: (uid) => ipcRenderer.invoke("android-remote-rotate", uid),
    screenshot: (uid) => ipcRenderer.invoke("android-remote-screenshot", uid),

    // Recording controls
    startRecording: (uid) => ipcRenderer.invoke("android-remote-start-recording", uid),
    stopRecording: (uid) => ipcRenderer.invoke("android-remote-stop-recording", uid),

    // Volume controls
    volumeUp: (uid) => ipcRenderer.invoke("android-remote-volume-up", uid),
    volumeDown: (uid) => ipcRenderer.invoke("android-remote-volume-down", uid),

    // Event listeners
    onStatusUpdate: (callback) => {
      ipcRenderer.on("android-remote-status", (_event, data) => callback(data));
    },
  },
});
