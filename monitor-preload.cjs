const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monitorAPI', {
  onAutomationUpdate: (callback) => {
    ipcRenderer.on('automation-update', (event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    });
  },
  toggleWidth: () => ipcRenderer.send('monitor-toggle-width'),
  copyText: (value) => ipcRenderer.invoke('monitor-copy-text', value),
  triggerFetchPending: (uid) => ipcRenderer.send('monitor-trigger-fetch-pending', uid),
  controlAutomation: (uid, state) => ipcRenderer.send('monitor-control-automation', uid, state)
});
