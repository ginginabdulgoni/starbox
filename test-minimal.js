// Minimal Electron test
const electron = require('electron');
console.log('Type:', typeof electron);
console.log('Has app?:', !!electron.app);
console.log('Has ipcMain?:', !!electron.ipcMain);

if (electron.app) {
  electron.app.whenReady().then(() => {
    console.log('✅ Electron loaded successfully!');
    electron.app.quit();
  });
} else {
  console.log('❌ Electron is:', electron);
  process.exit(1);
}
