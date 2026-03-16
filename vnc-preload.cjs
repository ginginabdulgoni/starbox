const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vncAPI', {
  // Recording
  getSourceId:    () => ipcRenderer.invoke('get-vnc-source-id'),
  showSaveDialog: (name) => ipcRenderer.invoke('show-save-dialog-recording', name),
  saveFile:       (filePath, arr) => ipcRenderer.invoke('save-recording-file', filePath, arr),

  // VM lifecycle controls
  stop:      (id) => ipcRenderer.invoke('os-vm-stop', id),
  restart:   (id) => ipcRenderer.invoke('os-vm-restart', id),
  forceStop: (id) => ipcRenderer.invoke('os-vm-force-stop', id),
  pause:     (id) => ipcRenderer.invoke('os-vm-pause', id),
  resume:    (id) => ipcRenderer.invoke('os-vm-resume', id),
  snapshot:  (id, name) => ipcRenderer.invoke('os-vm-snapshot', id, name),
});
