const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monitorAPI', {
  onAutomationUpdate: (callback) => {
    ipcRenderer.on('automation-update', (event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    });
  }
});
