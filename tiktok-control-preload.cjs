const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tiktokControl", {
  init: (uid) => ipcRenderer.invoke("tiktok-control-init", uid),
  toggle: (uid, feature, enabled, payload = {}) =>
    ipcRenderer.invoke("tiktok-control-toggle", uid, feature, enabled, payload),
  updateSettings: (uid, payload = {}) =>
    ipcRenderer.invoke("tiktok-control-settings", uid, payload),
  importCsv: (uid) => ipcRenderer.invoke("tiktok-control-import-csv", uid),
  saveSampleCsv: () => ipcRenderer.invoke("tiktok-control-save-sample"),
  onUpdate: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("tiktok-control-update", handler);
    return () => ipcRenderer.removeListener("tiktok-control-update", handler);
  },
});
