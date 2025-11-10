const { app, ipcMain } = require('electron');

console.log('app:', typeof app);
console.log('ipcMain:', typeof ipcMain);

if (ipcMain) {
  console.log('✅ Electron loaded correctly!');
  console.log('✅ ipcMain.on:', typeof ipcMain.on);
  app.quit();
} else {
  console.log('❌ Electron NOT loaded correctly!');
  process.exit(1);
}
