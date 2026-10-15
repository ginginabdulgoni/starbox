const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scOverlayAPI', {
  getMode:        ()       => ipcRenderer.invoke('starcapture:overlay-get-mode'),
  confirm:        (rect)   => ipcRenderer.send('starcapture:area-confirmed', rect),       // recording
  confirmCapture: (rect)   => ipcRenderer.send('starcapture:capture-confirmed', rect),    // screenshot-overlay
  cancel:         ()       => ipcRenderer.send('starcapture:overlay-cancel'),
  close:          ()       => ipcRenderer.send('starcapture:overlay-close'),
  copyImage:      (dataUrl) => ipcRenderer.invoke('starcapture:overlay-copy', dataUrl),
  saveImage:      (dataUrl) => ipcRenderer.invoke('starcapture:overlay-save', dataUrl),
  onShowImage: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('starcapture:overlay-show-image', (_e, dataUrl) => cb(dataUrl));
  },
});
