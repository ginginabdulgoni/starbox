console.log('Testing electron module...');

try {
  const electron = require('electron');
  console.log('electron type:', typeof electron);
  console.log('electron value:', electron);
  console.log('Is string?:', typeof electron === 'string');

  if (typeof electron === 'string') {
    console.log('❌ ERROR: electron is a string (path), not an object!');
    console.log('Path:', electron);
  } else {
    console.log('electron.app type:', typeof electron.app);
    console.log('electron.ipcMain type:', typeof electron.ipcMain);
    console.log('electron.BrowserWindow type:', typeof electron.BrowserWindow);

    const { app, ipcMain } = electron;
    console.log('Test - ipcMain available:', !!ipcMain);
    console.log('Test - app available:', !!app);

    if (ipcMain) {
      console.log('✅ ipcMain is loaded correctly');
    } else {
      console.log('❌ ipcMain is undefined');
    }
  }
} catch (error) {
  console.error('Error loading electron:', error.message);
  console.error(error.stack);
}

process.exit(0);
