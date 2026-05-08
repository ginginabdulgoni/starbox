const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hubAPI', {
  onOpenTab:      (cb) => ipcRenderer.on('hub-open-tab',      (_e, data) => cb(data)),
  onFocusTab:     (cb) => ipcRenderer.on('hub-focus-tab',     (_e, uid)  => cb(uid)),
  onCloseTab:     (cb) => ipcRenderer.on('hub-close-tab',     (_e, uid)  => cb(uid)),
  onSetLayout:    (cb) => ipcRenderer.on('hub-set-layout',    (_e, uid, hasSidePanel) => cb(uid, hasSidePanel)),
  onWindowResized:(cb) => ipcRenderer.on('hub-window-resized',() => cb()),
  onTabStatus:    (cb) => ipcRenderer.on('hub-tab-status',   (_e, uid, status) => cb(uid, status)),
  onTabTitle:     (cb) => ipcRenderer.on('hub-tab-title',    (_e, uid, title)  => cb(uid, title)),
  sendViewBounds:  (list) => ipcRenderer.send('hub-view-bounds', list),
  notifyClose:     (uid)  => ipcRenderer.send('hub-tab-closed',  uid),
  notifyPopOut:    (uid)  => ipcRenderer.send('hub-tab-pop-out', uid),
  switchTab:       (uid)  => ipcRenderer.send('hub-switch-tab',  uid),
  notifyLayoutMode:(mode) => ipcRenderer.send('hub-layout-mode', mode),
  updateViewBounds:(bounds) => ipcRenderer.send('hub-view-bounds', bounds),
  getDevices:      ()     => ipcRenderer.invoke('hub-get-devices'),
  startDevice:     (uid)  => ipcRenderer.invoke('hub-start-device', uid),
});
