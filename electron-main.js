// electron-main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');
const store = new Store();
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');
const fs = require('fs');

// KOREKSI: Menggunakan path temp yang cross-platform
const tempDir = app.getPath('temp');
fs.appendFileSync(path.join(tempDir, 'starbox-debug.log'), `[${new Date().toISOString()}] ${process.argv.join(' ')}\n`);

// Setup logging
const userDataPath = app.getPath('userData');
const logPath = path.join(userDataPath, 'starbox.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
console.log = (...args) => {
  logStream.write(`[LOG] ${new Date().toISOString()}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
};
console.error = (...args) => {
  logStream.write(`[ERR] ${new Date().toISOString()}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
};

// Parsing argumen
let runDeviceFlag = false;
let uid = null;
let service = null;
const args = process.defaultApp ? process.argv.slice(2) : process.argv.slice(1);

args.forEach(arg => {
  if (arg === '--run-device') runDeviceFlag = true;
  else if (arg.startsWith('--uid=')) uid = arg.split('=')[1];
  else if (arg.startsWith('--service=')) service = arg.split('=')[1];
});

console.log('🧾 Parsed args:', { runDeviceFlag, uid, service });
console.log("Main file jalan dari:", __dirname);

// Mapping layanan
const services = {
  wa: { name: 'WhatsApp', url: 'https://web.whatsapp.com', icon: 'wa-icon.png' },
  telegram: { name: 'Telegram', url: 'https://web.telegram.org/k/', icon: 'telegram-icon.webp' },
  gmail: { name: 'Gmail', url: 'https://mail.google.com', icon: 'gmail-icon.png' },
  shopee: { name: 'Shopee', url: 'https://shopee.co.id/buyer/login', icon: 'shopee-icon.png' },
  shopee_affiliate: { name: 'Shopee Affiliate', url: 'https://affiliate.shopee.co.id/', icon: 'shopee-affiliate-icon.png' }
};

const DB_PATH = path.join(userDataPath, 'db', 'devices.json');
const deviceWindows = {}; // Untuk melacak window yang terbuka
const monitorWindows = {}; // Untuk melacak window monitor automasi
const AUTO_SENDER_SERVICES = new Set(['wa']);

function getDeviceConfig(uid) {
  if (!uid || !fs.existsSync(DB_PATH)) return null;
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data.devices?.find(d => d.uid === uid) || null;
  } catch (err) {
    console.warn('⚠️ getDeviceConfig gagal:', err.message);
    return null;
  }
}

function allowAutoSenderForService(service = '') {
  return AUTO_SENDER_SERVICES.has((service || '').toLowerCase());
}


function installInputGuards(win) {
  if (win.__starboxInputGuardInstalled) return;
  win.__starboxInputGuardInstalled = true;

  win.webContents.on('before-input-event', (event, input) => {
    if (input?.isTrusted) {
      event.preventDefault();
    }
  });

  const injectGuards = () => {
    win.webContents.executeJavaScript(`
      (function () {
        if (window.__starboxGuardApplied) return;
        window.__starboxGuardApplied = true;

        const disablePointer = () => {
          if (document.body) {
            document.body.style.pointerEvents = 'none';
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'default';
          }
        };

        disablePointer();

        const observer = new MutationObserver(disablePointer);
        observer.observe(document.documentElement, { childList: true, subtree: true });

        const cancelEvent = (event) => {
          if (event.isTrusted) {
            event.stopPropagation();
            event.preventDefault();
          }
        };

        ['contextmenu', 'wheel', 'touchstart', 'touchend'].forEach(evt => {
          window.addEventListener(evt, cancelEvent, true);
        });
      })();
    `).catch(() => {});
  };

  win.webContents.on('dom-ready', injectGuards);
  win.webContents.on('did-finish-load', injectGuards);
  win.webContents.on('did-navigate', injectGuards);
}

function normalizePhoneNumber(phone = '') {
  if (!phone) return '';
  const digits = `${phone}`.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

function getDeviceService(uid) {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const device = data.devices?.find(d => d.uid === uid);
    return device?.service ?? null;
  } catch (err) {
    console.warn('⚠️ Gagal membaca service device:', err?.message);
    return null;
  }
}

function waitForLoad(win, timeout = 20000) {
  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      win.webContents.removeListener('did-finish-load', onFinish);
      win.webContents.removeListener('did-fail-load', onFail);
    };

    const onFinish = () => {
      cleanup();
      resolve(true);
    };

    const onFail = (event, errorCode, errorDescription) => {
      console.warn(`⚠️ Navigasi gagal: ${errorCode} - ${errorDescription}`);
      cleanup();
      resolve(false);
    };

    const timer = setTimeout(() => {
      console.warn('⚠️ waitForLoad timeout tercapai.');
      cleanup();
      resolve(false);
    }, timeout);

    win.webContents.once('did-finish-load', onFinish);
    win.webContents.once('did-fail-load', onFail);
  });
}

async function ensureDeviceWindow(uid, serviceHint) {
  let win = deviceWindows[uid];
  if (win && !win.isDestroyed()) {
    return win;
  }

  const service = serviceHint || getDeviceService(uid) || 'wa';
  win = createDeviceWindow(uid, service);
  if (!win) {
    throw new Error(`Gagal membuat jendela baru untuk UID ${uid}`);
  }

  await waitForLoad(win, 25000);
  return win;
}

async function ensureMonitorWindow(uid, parentWindow) {
  let monitor = monitorWindows[uid];
  if (monitor && !monitor.isDestroyed()) {
    const parentBounds = parentWindow.getBounds();
    const currentBounds = monitor.getBounds();
    monitor.setBounds({
      x: parentBounds.x + parentBounds.width,
      y: parentBounds.y,
      width: currentBounds.width,
      height: parentBounds.height
    });
    monitor.showInactive();
    return monitor;
  }

  const parentBounds = parentWindow.getBounds();
  const monitorWidth = 340;
  const monitorHeight = Math.min(380, parentBounds.height);

  monitor = new BrowserWindow({
    width: monitorWidth,
    height: monitorHeight,
    title: 'WA Auto Sender Monitor',
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    movable: false,
    skipTaskbar: true,
    parent: parentWindow,
    modal: false,
    show: false,
    backgroundColor: '#0f172a',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'monitor-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  monitor.__allowForceClose = false;

  monitor.setMenuBarVisibility(false);
  monitor.setAlwaysOnTop(true, 'screen-saver');

  const positionMonitor = () => {
    if (monitor.isDestroyed()) return;
    const bounds = parentWindow.getBounds();
    const targetX = bounds.x + bounds.width - monitorWidth;
    const targetY = bounds.y + bounds.height - monitorHeight;
    monitor.setBounds({
      x: targetX,
      y: targetY,
      width: monitorWidth,
      height: monitorHeight
    });
  };

  parentWindow.on('move', positionMonitor);
  parentWindow.on('resize', positionMonitor);

  parentWindow.on('closed', () => {
    if (monitor && !monitor.isDestroyed()) {
      monitor.__allowForceClose = true;
      monitor.close();
    }
  });

  monitor.on('close', (event) => {
    if (!monitor.__allowForceClose) {
      event.preventDefault();
    }
  });

  monitor.on('closed', () => {
    parentWindow.removeListener('move', positionMonitor);
    parentWindow.removeListener('resize', positionMonitor);
    delete monitorWindows[uid];
  });

  monitor.on('focus', () => {
    if (!parentWindow.isDestroyed()) {
      parentWindow.focus();
    }
  });

  await monitor.loadFile(path.join(app.getAppPath(), 'automation-monitor.html'));
  positionMonitor();
  monitor.showInactive();

  monitorWindows[uid] = monitor;
  return monitor;
}

  
async function sendWhatsappMessages(uid, queue = []) {
  const config = getDeviceConfig(uid) || {};
  if (!config.autoSender) {
    console.warn(`⚠️ Auto sender tidak aktif untuk UID ${uid}`);
    return [];
  }

  const service = config.service || getDeviceService(uid) || 'wa';
  const win = await ensureDeviceWindow(uid, service);

  const normalizedQueue = queue
    .map(item => ({
      ...item,
      phone: normalizePhoneNumber(item.phone)
    }))
    .filter(item => item.phone && item.message);

  if (!normalizedQueue.length) {
    return [];
  }

  win.focus();
  win.show();

  const userAgent = win.webContents.getUserAgent();
  const initialUrl = win.webContents.getURL() || services.wa.url;
  const results = [];

  const queueState = normalizedQueue.map(item => ({
    id: item.id ?? item.phone,
    phone: item.phone,
    message: item.message,
    status: item.status ?? 'pending'
  }));

  const monitor = await ensureMonitorWindow(uid, win);
  const sendMonitorUpdate = (activeId = null, typing = false) => {
    if (!monitor || monitor.isDestroyed()) return;
    monitor.webContents.send('automation-update', {
      queue: queueState,
      activeId: activeId != null ? String(activeId) : null,
      typing: Boolean(typing)
    });
  };

  if (monitor.webContents.isLoading()) {
    monitor.webContents.once('dom-ready', () => {
      sendMonitorUpdate(null, false);
    });
  } else {
    sendMonitorUpdate(null, false);
  }

  try {
    for (const item of normalizedQueue) {
      const entryIndex = queueState.findIndex(entry => String(entry.id) === String(item.id ?? item.phone));
      if (entryIndex !== -1) queueState[entryIndex].status = 'sending';
      sendMonitorUpdate(item.id ?? item.phone, true);

      const targetUrl = `https://web.whatsapp.com/send?phone=${item.phone}&text=${encodeURIComponent(item.message)}&app_absent=0`;

      try {
        console.log(`🤖 Mengirim pesan ke ${item.phone} untuk UID ${uid}`);
        await win.loadURL(targetUrl, { userAgent });
        await waitForLoad(win, 20000);
        await new Promise(res => setTimeout(res, 900));

        const success = await win.webContents.executeJavaScript(`
          (async () => {
            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            const sendSelectors = [
              '[data-testid="compose-btn-send"]',
              'footer [data-testid="conversation-compose-box"] [data-testid="compose-btn-send"]',
              'span[data-icon="send"]'
            ];
            const inputSelectors = [
              '[data-testid="conversation-compose-box-input"]',
              'div[contenteditable="true"][data-tab="10"]',
              'div[contenteditable="true"][data-tab="9"]',
              'div[contenteditable="true"][role="textbox"]'
            ];

            for (let attempt = 0; attempt < 24; attempt++) {
              const sendButton = sendSelectors
                .map(selector => document.querySelector(selector))
                .find(Boolean);
              if (sendButton) {
                sendButton.click();
                return true;
              }

              const input = inputSelectors
                .map(selector => document.querySelector(selector))
                .find(Boolean);
              if (input) {
                input.focus();
                const enterEvent = new KeyboardEvent('keydown', {
                  key: 'Enter',
                  code: 'Enter',
                  keyCode: 13,
                  which: 13,
                  bubbles: true
                });
                input.dispatchEvent(enterEvent);
              }

              await sleep(350);
            }
            return false;
          })();
        `, true);

        if (success) {
          console.log(`✅ Pesan ${item.id || item.message.slice(0, 20)} terkirim.`);
          results.push({ ...item, status: 'done' });
          if (entryIndex !== -1) queueState[entryIndex].status = 'done';
        } else {
          console.warn(`⚠️ Gagal mengirim pesan ke ${item.phone}`);
          results.push({ ...item, status: 'done' });
          if (entryIndex !== -1) queueState[entryIndex].status = 'done';
        }
      } catch (err) {
        console.error(`❌ Error saat mengirim pesan ke ${item.phone}:`, err);
        results.push({ ...item, status: 'done', error: err?.message });
        if (entryIndex !== -1) queueState[entryIndex].status = 'done';
      }

      sendMonitorUpdate(null, false);
      await new Promise(res => setTimeout(res, 600));
    }
  } finally {
    sendMonitorUpdate(null, false);
  }

  try {
    await win.loadURL(initialUrl || services.wa.url, { userAgent });
    await waitForLoad(win, 15000);
  } catch (err) {
    console.warn('⚠️ Gagal mengembalikan jendela ke URL awal:', err);
  }

  return results;
}


// Helper function untuk mendapatkan path aset yang benar
function getAssetPath(assetName) {
  if (process.env.NODE_ENV === 'development' || process.defaultApp) {
    return path.join(__dirname, 'assets', assetName);
  }
  return path.join(process.resourcesPath, 'assets', assetName);
}

function updateDeviceStatus(uid, status) {
  if (!fs.existsSync(DB_PATH)) return console.error('devices.json tidak ditemukan:', DB_PATH);
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const index = data.devices.findIndex(d => d.uid === uid);
    if (index !== -1) {
      data.devices[index].status = status;
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      console.log(`🔄 Device ${uid} status updated to ${status}`);
    } else {
      console.warn(`⚠️ Device ${uid} tidak ditemukan di devices.json!`);
    }
  } catch (err) {
    console.error('❌ Error saat update status device:', err);
  }
}

function createDeviceWindow(uid, service) {
  const selected = services[service] || services.wa;

  let deviceName = selected.name;
  let mode = 'desktop';
  let autoSenderEnabled = false;
  let pendingUrl = '';

  const config = getDeviceConfig(uid);
  if (config) {
    if (config.name) deviceName = config.name;
    if (config.mode) mode = config.mode;
    autoSenderEnabled = Boolean(config.autoSender && allowAutoSenderForService(config.service || service));
    pendingUrl = autoSenderEnabled ? (config.pendingUrl || '') : '';
  }

const isMobile = mode?.startsWith('mobile');
let width = 1000;
let height = 700;
let userAgent = '';

switch (mode) {
  case 'mobile-iphone':
    width = 375;
    userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
    break;
  case 'mobile-android':
    width = 390;
    userAgent = 'Mozilla/5.0 (Linux; Android 11; Pixel 2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36';
    break;
  case 'mobile-browser-desktop':
    width = 480;
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36';
    break;
  case 'mobile-ipad':
    width = 768;
    height = 1024;
    userAgent = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A5341f Safari/604.1';
    break;
  case 'mobile-galaxy-s8':
    width = 360;
    height = 740;
    userAgent = 'Mozilla/5.0 (Linux; Android 7.0; SM-G950U Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36';
    break;
  case 'mobile-pixel-5':
    width = 393;
    height = 851;
    userAgent = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36';
    break;
  case 'desktop-mini':
    width = 800;
    height = 600;
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
    break;
  case 'desktop-wide':
    width = 1280;
    height = 800;
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
    break;
  default:
    width = 1000;
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
    break;
}

const win = new BrowserWindow({
  width: width,
  height: height,
  title: deviceName,
  autoHideMenuBar: true,
  icon: getAssetPath(selected.icon),
  show: false,
  webPreferences: {
    contextIsolation: true,
    partition: `persist:${uid}`
  }
});

win.webContents.on('page-title-updated', (e) => {
  e.preventDefault(); // 🔒 cegah perubahan title
  win.setTitle(deviceName + ' - Starbox'); // 🔄 pastikan title tetap sesuai device
});
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    console.log('🟢 Window ready to show!');
  });
win.webContents.once('did-finish-load', () => {
  win.show();
  win.focus();
});




win.loadURL(selected.url, {
  userAgent
});


  if (autoSenderEnabled) {
    installInputGuards(win);
    win.__autoSenderEnabled = true;
    win.__pendingUrl = pendingUrl;
  } else {
    win.__autoSenderEnabled = false;
    win.__pendingUrl = pendingUrl;
  }

  deviceWindows[uid] = win;
  updateDeviceStatus(uid, 'active');

  win.on('close', () => {
    console.log(`[WIN] Window close event untuk UID ${uid}`);
    updateDeviceStatus(uid, 'stopped');
  });

  win.on('closed', () => {
    console.log(`[WIN] Window closed event untuk UID ${uid}`);
    const monitor = monitorWindows[uid];
    if (monitor && !monitor.isDestroyed()) {
      try {
        monitor.__allowForceClose = true;
        monitor.close();
      } catch (err) {
        console.warn(`⚠️ Gagal menutup monitor untuk UID ${uid}:`, err.message);
      }
    }
    delete monitorWindows[uid];
    delete deviceWindows[uid];
  });

  return win;
}


function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, // ukuran default, tetap diperlukan untuk inisialisasi
    height: 800,
    title: 'Starbox Emulator',
    autoHideMenuBar: true,
    icon: getAssetPath('starbox.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), 'preload.cjs')

    }
  });
    mainWindow.maximize();
    mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
   // Optional: buka DevTools hanya di development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

ipcMain.on('save-config', (event, config) => {
  store.set('config', config);
});

ipcMain.on('load-config', (event) => {
  event.returnValue = store.get('config') || {};
});

// IPC Handlers
ipcMain.handle('add-device', (event, payload = {}) => {
  const { name, service, autoRun, mode, autoSender, pendingUrl } = payload;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  let devices = [];
  if (fs.existsSync(DB_PATH)) {
    try {
      devices = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')).devices || [];
    } catch (e) {
      console.error('❌ Error parsing JSON:', e);
    }
  }

  const sameServiceCount = devices.filter(d => d.service === service).length;
  if (sameServiceCount >= 3) {
    return {
      success: false,
      message: `❌ Maksimal 3 device diperbolehkan untuk service '${service}'.`
    };
  }

  const serviceKey = (service || '').toLowerCase();
  const enableAutoSender = allowAutoSenderForService(serviceKey) && !!autoSender;
  const normalizedPendingUrl = enableAutoSender ? (pendingUrl || '').trim() : '';

  const newDevice = {
    uid: uuidv4(),
    name,
    service,
    status: 'stopped',
    os_type: os.platform(),
    created_at: new Date().toISOString(),
    autoRun: !!autoRun,
    mode: mode || 'desktop',
    autoSender: enableAutoSender,
    pendingUrl: normalizedPendingUrl
  };

  devices.push(newDevice);
  fs.writeFileSync(DB_PATH, JSON.stringify({ devices }, null, 2));

  return {
    success: true,
    device: newDevice,
    message: '✅ Device berhasil ditambahkan.'
  };
});


ipcMain.handle('start-device', async (event, uid, service) => {
  try {
    console.log(`⚡ Mulai device dari renderer: ${uid} (${service})`);
    startDevice(uid, service);
    return { success: true };
  } catch (err) {
    console.error(`❌ Gagal menjalankan ${uid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('edit-device', (event, payload = {}) => {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(raw);

    const index = data.devices.findIndex(d => d.uid === payload.uid);
    if (index !== -1) {
      const device = data.devices[index];
      const allowAuto = allowAutoSenderForService(device.service);

      device.name = payload.name;
      device.autoRun = !!payload.autoRun;
      device.mode = payload.mode || device.mode || 'desktop';
      device.autoSender = allowAuto && !!payload.autoSender;
      device.pendingUrl = device.autoSender ? (payload.pendingUrl || '').trim() : '';

      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return { success: true };
    } else {
      return { success: false, message: 'Device tidak ditemukan' };
    }
  } catch (err) {
    return { success: false, message: err.message };
  }
});
ipcMain.on('run-device', async (event, uid, service) => {
  console.log(`🔁 Restarting device ${uid} (${service})...`);
  await stopDevice(uid);
  setTimeout(() => {
    startDevice(uid, service);
  }, 300); // Delay kecil agar tidak race condition
});



function stopDevice(uid) {
  return new Promise((resolve) => {
    const win = deviceWindows[uid];

    if (!win || win.isDestroyed()) {
      console.warn(`⚠️ Attempted to stop device ${uid} but no active window was found.`);
      updateDeviceStatus(uid, 'stopped');
      delete deviceWindows[uid];
      resolve();
      return;
    }

    const handleClosed = () => {
      console.log(`🪟 Jendela ${uid} ditutup.`);
      win.removeListener('closed', handleClosed);
      resolve();
    };

    win.once('closed', handleClosed);

    try {
      win.close();
    } catch (err) {
      console.error(`❌ Gagal menutup jendela ${uid}:`, err);
      win.removeListener('closed', handleClosed);
      resolve();
    }
  });
}
function startDevice(uid, service) {
  if (!uid) {
    console.warn('⚠️ startDevice dipanggil tanpa UID, operasi dibatalkan.');
    return;
  }

  if (!app.isReady()) {
    console.log(`⌛ App belum siap. Menunggu untuk menjalankan device ${uid}.`);
    app.whenReady().then(() => startDevice(uid, service));
    return;
  }

  const existingWindow = deviceWindows[uid];
  if (existingWindow && !existingWindow.isDestroyed()) {
    console.log(`🔁 Device ${uid} sudah memiliki jendela aktif. Fokuskan kembali.`);
    existingWindow.focus();
    return;
  }

  console.log(`🚀 Menjalankan device ${uid} (${service}) sebagai jendela baru.`);
  updateDeviceStatus(uid, 'starting');

  try {
    createDeviceWindow(uid, service);
  } catch (err) {
    console.error(`❌ Gagal membuat jendela untuk device ${uid}:`, err);
    updateDeviceStatus(uid, 'stopped');
    throw err;
  }
}



ipcMain.on('stop-device', (event, uid) => {
    const win = deviceWindows[uid];
    if (win) {
        console.log(`🔌 Stopping device ${uid} by closing its window.`);
        win.close(); // Ini akan memicu event 'close' dan 'closed'
    } else {
        console.warn(`⚠️ Attempted to stop device ${uid} but no window was found.`);
        updateDeviceStatus(uid, 'stopped'); // Failsafe
    }
});

ipcMain.on('focus-device', (event, uid) => {
  const win = deviceWindows[uid];
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  } else {
    console.warn(`⚠️ Tidak menemukan jendela untuk UID ${uid} saat mencoba fokus.`);
  }
});


ipcMain.handle('load-devices', () => {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // Jika file tidak ada, buat file kosong
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ devices: [] }, null, 2));
    return { devices: [] };
  }

  // Baca isi file
  const rawData = fs.readFileSync(DB_PATH, 'utf8');
  const data = JSON.parse(rawData);

  // Tambahkan default attribute jika belum ada
  let modifiedAny = false;
  (data.devices || []).forEach((device) => {
    if (!('autoRun' in device)) {
      device.autoRun = false;
      modifiedAny = true;
    }

    if (!('mode' in device)) {
      device.mode = 'desktop';
      modifiedAny = true;
    }

    if (!('autoSender' in device)) {
      device.autoSender = false;
      modifiedAny = true;
    }

    if (!('pendingUrl' in device)) {
      device.pendingUrl = '';
      modifiedAny = true;
    }
  });

  if (modifiedAny) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  return data;
});


ipcMain.handle('delete-device', (event, uid) => {
  if (!fs.existsSync(DB_PATH)) {
    return { success: false, message: 'Database tidak ditemukan.' };
  }

  // 1. Baca data dari database terlebih dahulu
  let data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  
  // 2. Cari perangkat yang akan dihapus
  const deviceToDelete = data.devices.find(d => d.uid === uid);

  // Jika perangkat tidak ditemukan sama sekali
  if (!deviceToDelete) {
    return { success: false, message: 'Device tidak ditemukan di database.' };
  }
  
  // 3. Validasi berdasarkan status perangkat
  //    (Asumsi status aktif adalah 'running', 'active', atau 'starting')
  const isActive = ['running', 'active', 'starting'].includes(deviceToDelete.status);
  
  if (isActive) {
    console.warn(`Operasi Dibatalkan: Device ${uid} berstatus '${deviceToDelete.status}' dan tidak bisa dihapus.`);
    return { success: false, message: `Device sedang berjalan (status: ${deviceToDelete.status}). Hentikan dulu.` };
  }

  // --- Jika status aman, lanjutkan proses penghapusan ---
  
  const initialLength = data.devices.length;
  data.devices = data.devices.filter(d => d.uid !== uid);

  if (data.devices.length < initialLength) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    console.log(`🗑️ Device ${uid} dihapus dari database`);
    
    const sessionPath = path.join(userDataPath, 'db', 'sessions', uid);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🗑️ Folder sesi ${uid} dihapus`);
    }
    return { success: true };
  }

  // Fallback jika terjadi kondisi aneh
  return { success: false, message: 'Gagal memfilter device dari database.' };
});

ipcMain.handle('send-whatsapp-messages', async (event, uid, messages) => {
  try {
    const results = await sendWhatsappMessages(uid, Array.isArray(messages) ? messages : []);
    return results;
  } catch (err) {
    console.error('❌ Gagal mengeksekusi automasi WhatsApp:', err);
    throw err;
  }
});

ipcMain.handle('get-system-info', () => {
  try {
    const userInfo = os.userInfo();
    const cpus = os.cpus() || [];
    return {
      username: userInfo.username,
      homedir: userInfo.homedir,
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpu: cpus.length ? cpus[0].model : 'unknown CPU'
    };
  } catch (err) {
    console.error('⚠️ get-system-info gagal:', err);
    return { username: 'unknown', hostname: os.hostname(), platform: os.platform() };
  }
});

args.forEach(arg => {
  if (arg === '--run-device') runDeviceFlag = true;
  else if (arg.startsWith('--uid=')) uid = arg.split('=')[1];
  else if (arg.startsWith('--service=')) service = arg.split('=')[1];
});

app.whenReady().then(() => {
  // ⛔ Jalankan langsung CLI jika diminta
  if (runDeviceFlag && uid && service) {
    console.log(`🖥️ CLI mode: Jalankan device ${uid}`);
    createDeviceWindow(uid, service);
    return;
  }

  // ✅ Buat window utama
  createMainWindow();

  // Pastikan DB file ada
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ devices: [] }, null, 2));
    console.log('📁 File devices.json dibuat.');
    return;
  }

  // Baca dan jalankan device
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const { devices } = JSON.parse(raw);

    const autoRunDevices = devices.filter(d => d.autoRun === true);
    console.log(`🔍 Ditemukan ${autoRunDevices.length} device dengan autoRun: true`);

    const limitedDevices = autoRunDevices.slice(0, 10);

    limitedDevices.forEach(device => {
      console.log(`🚀 Auto-running ${device.name} (${device.uid})...`);
      startDevice(device.uid, device.service);
      updateDeviceStatus(device.uid, 'active'); // ✅ langsung ubah status di memori/backend
    });

    if (autoRunDevices.length > 10) {
      console.warn(`⚠️ Melewati ${autoRunDevices.length - 10} device lainnya karena batas autorun.`);
    }
  } catch (err) {
    console.error('❌ Gagal membaca atau menjalankan autoRun device:', err);
  }
});




app.on('window-all-closed', () => {
  console.log('🛑 Menutup semua jendela, akan menghentikan semua device...');

  const uids = Object.keys(deviceWindows);
  if (uids.length === 0) {
    console.log('📭 Tidak ada jendela device aktif.');
    app.quit();
    return;
  }

  uids.forEach(uid => {
    const win = deviceWindows[uid];
    if (win && !win.isDestroyed()) {
      try {
        win.destroy();
      } catch (err) {
        console.warn(`⚠️ Gagal menghentikan jendela ${uid}:`, err.message);
      }
    }
    updateDeviceStatus(uid, 'stopped');
    delete deviceWindows[uid];
  });

  app.quit();
});


app.on('activate', () => {
  // Di macOS, buka kembali window utama jika di-klik di dock dan tidak ada window terbuka.
  if (BrowserWindow.getAllWindows().length === 0 && !runDeviceFlag) {
    createMainWindow();
  }
});
