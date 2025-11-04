// electron-main.js
const { app, BrowserWindow, ipcMain, screen, clipboard } = require("electron");
const Store = require("electron-store");
const store = new Store();
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const path = require("path");
const fs = require("fs");

// KOREKSI: Menggunakan path temp yang cross-platform
const tempDir = app.getPath("temp");
fs.appendFileSync(
  path.join(tempDir, "starbox-debug.log"),
  `[${new Date().toISOString()}] ${process.argv.join(" ")}\n`
);

// Setup logging
const userDataPath = app.getPath("userData");
const logPath = path.join(userDataPath, "starbox.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });
console.log = (...args) => {
  logStream.write(
    `[LOG] ${new Date().toISOString()}: ${args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
      .join(" ")}\n`
  );
};
console.error = (...args) => {
  logStream.write(
    `[ERR] ${new Date().toISOString()}: ${args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
      .join(" ")}\n`
  );
};

// Parsing argumen
let runDeviceFlag = false;
let uid = null;
let service = null;
const args = process.defaultApp ? process.argv.slice(2) : process.argv.slice(1);

args.forEach((arg) => {
  if (arg === "--run-device") runDeviceFlag = true;
  else if (arg.startsWith("--uid=")) uid = arg.split("=")[1];
  else if (arg.startsWith("--service=")) service = arg.split("=")[1];
});

console.log("🧾 Parsed args:", { runDeviceFlag, uid, service });
console.log("Main file jalan dari:", __dirname);

// Mapping layanan
const services = {
  wa: {
    name: "WhatsApp",
    url: "https://web.whatsapp.com",
    icon: "wa-icon.png",
  },
  telegram: {
    name: "Telegram",
    url: "https://web.telegram.org/k/",
    icon: "telegram-icon.webp",
  },
  gmail: {
    name: "Gmail",
    url: "https://mail.google.com",
    icon: "gmail-icon.png",
  },
  shopee: {
    name: "Shopee",
    url: "https://shopee.co.id/buyer/login",
    icon: "shopee-icon.png",
  },
  shopee_affiliate: {
    name: "Shopee Affiliate",
    url: "https://affiliate.shopee.co.id/",
    icon: "shopee-affiliate-icon.png",
  },
};

const DB_PATH = path.join(userDataPath, "db", "devices.json");
const deviceWindows = {}; // Untuk melacak window yang terbuka
const monitorWindows = {}; // Untuk melacak window monitor automasi
const monitorWindowState = {
  collapsed: false,
  contentHidden: false,
};
const MONITOR_DIMENSIONS = Object.freeze({
  expandedWidth: 420,
  collapsedWidth: 260,
  expandedHeight: 520,
  minHeight: 360,
  headerHeight: 80,
  screenGap: 16,
});

function calculateMonitorPositionFromParent(parentBounds, width, height) {
  if (!parentBounds) return { x: undefined, y: undefined };
  try {
    if (!app.isReady()) {
      return {
        x: parentBounds.x + parentBounds.width + MONITOR_DIMENSIONS.screenGap,
        y: parentBounds.y,
      };
    }

    const display = screen.getDisplayMatching(parentBounds);
    const workArea = display?.workArea || display?.bounds;
    const gap = MONITOR_DIMENSIONS.screenGap;

    let x = parentBounds.x + parentBounds.width + gap;
    let y = parentBounds.y;

    if (workArea) {
      const areaLeft = workArea.x;
      const areaRight = workArea.x + workArea.width;
      const areaTop = workArea.y;
      const areaBottom = workArea.y + workArea.height;

      if (x + width > areaRight) {
        x = parentBounds.x - width - gap;
      }

      if (x < areaLeft) {
        x = areaLeft + Math.max(0, Math.floor((workArea.width - width) / 2));
      }

      if (y < areaTop) {
        y = areaTop;
      }
      if (y + height > areaBottom) {
        y = areaBottom - height - gap;
      }
      if (y < areaTop) {
        y = areaTop;
      }
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  } catch {
    return {
      x: parentBounds.x + parentBounds.width + MONITOR_DIMENSIONS.screenGap,
      y: parentBounds.y,
    };
  }
}

function getMonitorBaseMetrics(parentWindow = null) {
  const parentBounds =
    parentWindow && !parentWindow.isDestroyed()
      ? parentWindow.getBounds()
      : null;

  const baseWidth = parentBounds
    ? Math.max(
        MONITOR_DIMENSIONS.expandedWidth,
        Math.round(parentBounds.width * 0.28)
      )
    : MONITOR_DIMENSIONS.expandedWidth;

  const baseHeight = parentBounds
    ? Math.max(
        MONITOR_DIMENSIONS.expandedHeight,
        parentBounds.height,
        MONITOR_DIMENSIONS.minHeight
      )
    : Math.max(MONITOR_DIMENSIONS.expandedHeight, MONITOR_DIMENSIONS.minHeight);

  const width = monitorWindowState.collapsed
    ? MONITOR_DIMENSIONS.collapsedWidth
    : baseWidth;
  const height = monitorWindowState.contentHidden
    ? MONITOR_DIMENSIONS.headerHeight
    : baseHeight;

  const position = calculateMonitorPositionFromParent(
    parentBounds,
    width,
    height
  );

  return {
    width,
    height,
    baseWidth,
    baseHeight,
    parentBounds,
    ...position,
  };
}

function syncMonitorWindowLayout(monitor, options = {}) {
  if (!monitor || monitor.isDestroyed()) return;

  const currentBounds = monitor.getBounds();
  const nextBounds = {
    x: options.x ?? currentBounds.x,
    y: options.y ?? currentBounds.y,
    width: currentBounds.width,
    height: currentBounds.height,
  };

  const expandedWidth = Math.max(
    MONITOR_DIMENSIONS.expandedWidth,
    options.baseWidth || monitor.__expandedWidth || currentBounds.width
  );
  const expandedHeight = Math.max(
    MONITOR_DIMENSIONS.minHeight,
    options.baseHeight || monitor.__expandedHeight || currentBounds.height,
    MONITOR_DIMENSIONS.minHeight
  );

  if (monitorWindowState.collapsed) {
    nextBounds.width = MONITOR_DIMENSIONS.collapsedWidth;
  } else {
    monitor.__expandedWidth = Math.max(expandedWidth, currentBounds.width);
    nextBounds.width = monitor.__expandedWidth;
  }

  if (monitorWindowState.contentHidden) {
    if (!monitor.__expandedHeight) {
      monitor.__expandedHeight = Math.max(
        currentBounds.height,
        MONITOR_DIMENSIONS.minHeight
      );
    }
    nextBounds.height = MONITOR_DIMENSIONS.headerHeight;
  } else {
    monitor.__expandedHeight = Math.max(expandedHeight, currentBounds.height);
    nextBounds.height = monitor.__expandedHeight;
  }

  monitor.__isAdjusting = true;
  monitor.setBounds(nextBounds);
  monitor.__isAdjusting = false;
}
const AUTO_SENDER_SERVICES = new Set(["wa"]);

function normalizeDeviceRecord(device) {
  if (!device || !device.token) return false;
  if (!device.uid) {
    device.uid = device.token;
  }
  delete device.token;
  return true;
}

function normalizeDeviceList(data) {
  if (!data) return false;
  let modified = false;
  if (!Array.isArray(data.devices)) {
    data.devices = Array.isArray(data.devices) ? data.devices : [];
    modified = true;
  }
  data.devices.forEach((device) => {
    if (normalizeDeviceRecord(device)) {
      modified = true;
    }
  });
  return modified;
}

function getDeviceConfig(uid) {
  if (!uid || !fs.existsSync(DB_PATH)) return null;
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = JSON.parse(raw);
    const modified = normalizeDeviceList(data);
    if (modified) {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }
    return data.devices?.find((d) => d.uid === uid || d.token === uid) || null;
  } catch (err) {
    console.warn("⚠️ getDeviceConfig gagal:", err.message);
    return null;
  }
}

function allowAutoSenderForService(service = "") {
  return AUTO_SENDER_SERVICES.has((service || "").toLowerCase());
}

function sanitizePendingUrl(url = "") {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function normalizeAutomationPriority(value) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.max(0, Math.floor(num));
  }
  return 9999;
}

function installInputGuards(win) {
  if (win.__starboxInputGuardInstalled) return;
  win.__starboxInputGuardInstalled = true;

  win.webContents.on("before-input-event", (event, input) => {
    if (input?.isTrusted) {
      event.preventDefault();
    }
  });

  const injectGuards = () => {
    win.webContents
      .executeJavaScript(
        `
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
    `
      )
      .catch(() => {});
  };

  win.webContents.on("dom-ready", injectGuards);
  win.webContents.on("did-finish-load", injectGuards);
  win.webContents.on("did-navigate", injectGuards);
}

function normalizePhoneNumber(phone = "") {
  if (!phone) return "";
  const digits = `${phone}`.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith("62")) {
    return digits;
  }
  if (digits.startsWith("8")) {
    return `62${digits}`;
  }
  return digits;
}

function getDeviceService(uid) {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    const modified = normalizeDeviceList(data);
    if (modified) {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }
    const device = data.devices?.find((d) => d.uid === uid || d.token === uid);
    return device?.service ?? null;
  } catch (err) {
    console.warn("⚠️ Gagal membaca service device:", err?.message);
    return null;
  }
}

function waitForLoad(win, timeout = 20000) {
  return new Promise((resolve) => {
    if (!win || win.isDestroyed()) {
      resolve(false);
      return;
    }

    if (!win.webContents.isLoadingMainFrame()) {
      resolve(true);
      return;
    }

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      win.webContents.removeListener("did-finish-load", onFinish);
      win.webContents.removeListener("did-fail-load", onFail);
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
      console.info("ℹ️ waitForLoad timeout, melanjutkan proses.");
      cleanup();
      resolve(true);
    }, timeout);

    win.webContents.once("did-finish-load", onFinish);
    win.webContents.once("did-fail-load", onFail);
  });
}

async function ensureDeviceWindow(uid, serviceHint, options = {}) {
  let win = deviceWindows[uid];
  if (win && !win.isDestroyed()) {
    if (options.autoShow === false) {
      return win;
    }
    if (!win.isVisible()) {
      win.show();
    }
    win.focus();
    return win;
  }

  const service = serviceHint || getDeviceService(uid) || "wa";
  win = createDeviceWindow(uid, service, options);
  if (!win) {
    throw new Error(`Gagal membuat jendela baru untuk UID ${uid}`);
  }

  await waitForLoad(win, 25000);
  return win;
}

async function ensureMonitorWindow(uid, parentWindow) {
  let monitor = monitorWindows[uid];
  if (monitor && !monitor.isDestroyed()) {
    if (!monitor.isVisible()) {
      monitor.show();
    }
    monitor.focus();
    return monitor;
  }

  const metrics = getMonitorBaseMetrics(parentWindow);
  const monitorOptions = {
    width: metrics.width,
    height: metrics.height,
    title: "WA Auto Sender Monitor",
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    closable: true,
    movable: true,
    skipTaskbar: false,
    parent: null,
    modal: false,
    show: false,
    backgroundColor: "#0f172a",
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), "monitor-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };
  if (Number.isFinite(metrics.x)) {
    monitorOptions.x = Math.round(metrics.x);
  }
  if (Number.isFinite(metrics.y)) {
    monitorOptions.y = Math.round(metrics.y);
  }

  monitor = new BrowserWindow(monitorOptions);

  monitor.__expandedWidth = metrics.baseWidth;
  monitor.__expandedHeight = metrics.baseHeight;
  monitor.__isAdjusting = false;

  monitor.setMenuBarVisibility(false);
  monitor.on("closed", () => {
    delete monitorWindows[uid];
  });

  monitor.on("resize", () => {
    if (monitor.__isAdjusting) return;
    const { width, height } = monitor.getBounds();
    if (!monitorWindowState.collapsed) {
      monitor.__expandedWidth = Math.max(
        width,
        MONITOR_DIMENSIONS.expandedWidth
      );
    }
    if (!monitorWindowState.contentHidden) {
      monitor.__expandedHeight = Math.max(height, MONITOR_DIMENSIONS.minHeight);
    }
  });

  monitor.once("ready-to-show", () => {
    if (monitor.isDestroyed()) return;
    syncMonitorWindowLayout(monitor, {
      x: metrics.x,
      y: metrics.y,
      baseWidth: metrics.baseWidth,
      baseHeight: metrics.baseHeight,
    });
    const keepParentFocus =
      parentWindow && !parentWindow.isDestroyed() && parentWindow.isVisible();
    if (keepParentFocus && typeof monitor.showInactive === "function") {
      monitor.showInactive();
      parentWindow.focus();
    } else {
      monitor.show();
      monitor.focus();
    }
  });

  if (parentWindow && !parentWindow.isDestroyed()) {
    parentWindow.once("closed", () => {
      if (!monitor.isDestroyed()) {
        monitor.close();
      }
    });
  }

  await monitor.loadFile(
    path.join(app.getAppPath(), "automation-monitor.html")
  );

  monitorWindows[uid] = monitor;

  // Kirimkan payload awal agar informasi device langsung tampil.
  setImmediate(() => {
    sendAutomationMonitorPayload(
      uid,
      {
        queue: [],
        counts: { total: 0, pending: 0, done: 0 },
      },
      parentWindow
    ).catch(() => {});
  });

  return monitor;
}

function toggleMonitorWidth() {
  const nextCollapsed = !monitorWindowState.collapsed;

  Object.values(monitorWindows).forEach((monitor) => {
    if (!monitor || monitor.isDestroyed()) return;
    const bounds = monitor.getBounds();
    if (nextCollapsed) {
      monitor.__expandedWidth = Math.max(
        monitor.__expandedWidth || bounds.width,
        MONITOR_DIMENSIONS.expandedWidth
      );
    } else if (!monitor.__expandedWidth) {
      monitor.__expandedWidth = Math.max(
        bounds.width,
        MONITOR_DIMENSIONS.expandedWidth
      );
    }
  });

  monitorWindowState.collapsed = nextCollapsed;

  Object.values(monitorWindows).forEach((monitor) => {
    if (!monitor || monitor.isDestroyed()) return;
    syncMonitorWindowLayout(monitor);
  });
}

async function sendAutomationMonitorPayload(
  uid,
  payload = {},
  preferredWindow = null
) {
  if (!uid) return;

  const config = getDeviceConfig(uid) || {};
  if (!config.autoSender) return;

  const autoOpen = Boolean(payload?.autoOpenMonitor);
  const parentWindow = preferredWindow || deviceWindows[uid];
  if (!parentWindow || parentWindow.isDestroyed()) return;

  let monitor = monitorWindows[uid];
  if (!monitor || monitor.isDestroyed()) {
    if (!autoOpen) {
      return;
    }
    monitor = await ensureMonitorWindow(uid, parentWindow);
  }

  if (!monitor || monitor.isDestroyed()) return;

  const rawQueue = Array.isArray(payload.queue) ? payload.queue : [];
  const sanitizedQueue = rawQueue.map((item, index) => {
    const entry = item || {};
    const baseId = entry.id ?? entry.phone ?? index;
    return {
      id: baseId != null ? String(baseId) : String(index),
      phone: entry.phone ?? "",
      message: entry.message ?? "",
      status: (entry.status || "pending").toLowerCase(),
      priority: normalizeAutomationPriority(entry.priority),
    };
  });

  const total = sanitizedQueue.length;
  const done = sanitizedQueue.filter((item) => item.status === "done").length;
  const pending = sanitizedQueue.filter(
    (item) => item.status !== "done"
  ).length;

  const normalizedCounts =
    payload.counts && typeof payload.counts === "object"
      ? {
          total: Number(payload.counts.total ?? total) || total,
          pending: Number(payload.counts.pending ?? pending) || pending,
          done: Number(payload.counts.done ?? done) || done,
        }
      : { total, pending, done };

  const remaining = { ...payload };
  delete remaining.queue;
  delete remaining.counts;
  delete remaining.autoOpenMonitor;

  const activeId =
    "activeId" in remaining && remaining.activeId != null
      ? String(remaining.activeId)
      : null;
  const typing = "typing" in remaining ? Boolean(remaining.typing) : false;
  const error = "error" in remaining ? remaining.error : null;
  const lastFetch = "lastFetch" in remaining ? remaining.lastFetch : null;
  const serviceOverride =
    "service" in remaining ? remaining.service : undefined;
  const deviceNameOverride =
    "deviceName" in remaining ? remaining.deviceName : undefined;
  const pendingUrlOverride =
    "pendingUrl" in remaining ? remaining.pendingUrl : undefined;

  delete remaining.activeId;
  delete remaining.typing;
  delete remaining.error;
  delete remaining.lastFetch;
  delete remaining.service;
  delete remaining.deviceName;
  delete remaining.pendingUrl;

  monitor.webContents.send("automation-update", {
    uid,
    service: serviceOverride || config.service || "",
    deviceName: deviceNameOverride || config.name || uid,
    pendingUrl:
      typeof pendingUrlOverride === "string"
        ? pendingUrlOverride
        : config.pendingUrl || parentWindow.__pendingUrl || "",
    queue: sanitizedQueue,
    counts: normalizedCounts,
    activeId,
    typing,
    error,
    lastFetch,
    ...remaining,
  });
}

async function sendWhatsappMessages(uid, queue = [], options = {}) {
  const config = getDeviceConfig(uid) || {};
  if (!config.autoSender) {
    console.warn(`⚠️ Auto sender tidak aktif untuk UID ${uid}`);
    return [];
  }

  const shouldFocusWindow = !options?.silent;
  const service = config.service || getDeviceService(uid) || "wa";
  const win = await ensureDeviceWindow(uid, service, {
    autoShow: shouldFocusWindow,
  });

  const sanitizedPendingUrl = sanitizePendingUrl(
    options.pendingUrl || config.pendingUrl || ""
  );
  const updateStatusUrl = sanitizedPendingUrl
    ? `${sanitizedPendingUrl}/schedule/updatestatusmessage`
    : null;

  const normalizedQueue = queue
    .map((item) => ({
      ...item,
      phone: normalizePhoneNumber(item.phone),
      priority: normalizeAutomationPriority(item.priority),
    }))
    .filter((item) => item.phone && item.message);

  if (!normalizedQueue.length) {
    return [];
  }

  if (shouldFocusWindow) {
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  }

  const userAgent = win.webContents.getUserAgent();
  const initialUrl = win.webContents.getURL() || services.wa.url;
  const results = [];

  const queueState = normalizedQueue.map((item) => ({
    id: item.id ?? item.phone,
    phone: item.phone,
    message: item.message,
    status: item.status ?? "pending",
    priority: normalizeAutomationPriority(item.priority),
  }));

  const existingMonitor =
    monitorWindows[uid] && !monitorWindows[uid].isDestroyed()
      ? monitorWindows[uid]
      : null;
  const monitor = shouldFocusWindow
    ? await ensureMonitorWindow(uid, win)
    : existingMonitor;
  const pushMonitorUpdate = (activeId = null, typing = false, extra = {}) => {
    if (!monitor || monitor.isDestroyed()) return;
    sendAutomationMonitorPayload(
      uid,
      {
        queue: queueState,
        activeId: activeId != null ? String(activeId) : null,
        typing: Boolean(typing),
        ...extra,
      },
      win
    ).catch(() => {});
  };

  if (monitor && !monitor.isDestroyed()) {
    if (monitor.webContents.isLoading()) {
      monitor.webContents.once("dom-ready", () => {
        pushMonitorUpdate(null, false);
      });
    } else {
      pushMonitorUpdate(null, false);
    }
  }

  try {
    for (const item of normalizedQueue) {
      const entryIndex = queueState.findIndex(
        (entry) => String(entry.id) === String(item.id ?? item.phone)
      );
      if (entryIndex !== -1) queueState[entryIndex].status = "sending";
      pushMonitorUpdate(item.id ?? item.phone, true);

      const targetUrl = `https://web.whatsapp.com/send?phone=${
        item.phone
      }&text=${encodeURIComponent(item.message)}&app_absent=0`;

      try {
        console.log(`🤖 Mengirim pesan ke ${item.phone} untuk UID ${uid}`);
        await win.loadURL(targetUrl, { userAgent });
        await waitForLoad(win, 20000);
        await new Promise((res) => setTimeout(res, 900));

        const success = await win.webContents.executeJavaScript(
          `
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
        `,
          true
        );

        if (success) {
          console.log(
            `✅ Pesan ${item.id || item.message.slice(0, 20)} terkirim.`
          );
          results.push({ ...item, status: "done" });
          if (entryIndex !== -1) queueState[entryIndex].status = "done";
        } else {
          console.warn(`⚠️ Gagal mengirim pesan ke ${item.phone}`);
          results.push({ ...item, status: "done" });
          if (entryIndex !== -1) queueState[entryIndex].status = "done";
        }
      } catch (err) {
        console.error(`❌ Error saat mengirim pesan ke ${item.phone}:`, err);
        results.push({ ...item, status: "done", error: err?.message });
        if (entryIndex !== -1) queueState[entryIndex].status = "done";
      }

      if (updateStatusUrl) {
        const messageId = item.id ?? item.phone;
        if (messageId) {
          try {
            await fetch(updateStatusUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "done",
                id: messageId,
                uid,
              }),
            });
          } catch (err) {
            console.error("⚠️ Gagal memperbarui status pesan:", {
              endpoint: updateStatusUrl,
              id: messageId,
              error: err?.message || err,
            });
          }
        }
      }

      pushMonitorUpdate(null, false);
      await new Promise((res) => setTimeout(res, 600));
    }
  } finally {
    pushMonitorUpdate(null, false);
  }

  try {
    await win.loadURL(initialUrl || services.wa.url, { userAgent });
    await waitForLoad(win, 15000);
  } catch (err) {
    console.warn("⚠️ Gagal mengembalikan jendela ke URL awal:", err);
  }

  return results;
}

// Helper function untuk mendapatkan path aset yang benar
function getAssetPath(assetName) {
  if (process.env.NODE_ENV === "development" || process.defaultApp) {
    return path.join(__dirname, "assets", assetName);
  }
  return path.join(process.resourcesPath, "assets", assetName);
}

function updateDeviceStatus(uid, status) {
  if (!fs.existsSync(DB_PATH))
    return console.error("devices.json tidak ditemukan:", DB_PATH);
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    const modified = normalizeDeviceList(data);
    let index = -1;
    if (Array.isArray(data.devices)) {
      index = data.devices.findIndex((d) => d.uid === uid || d.token === uid);
    }
    if (modified) {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }
    if (index !== -1) {
      data.devices[index].status = status;
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      console.log(`🔄 Device ${uid} status updated to ${status}`);
    } else {
      console.warn(`⚠️ Device ${uid} tidak ditemukan di devices.json!`);
    }
  } catch (err) {
    console.error("❌ Error saat update status device:", err);
  }
}

function createDeviceWindow(uid, service, options = {}) {
  const { autoShow = true } = options;
  const selected = services[service] || services.wa;

  let deviceName = selected.name;
  let mode = "desktop";
  let autoSenderEnabled = false;
  let pendingUrl = "";

  const config = getDeviceConfig(uid);
  if (config) {
    if (config.name) deviceName = config.name;
    if (config.mode) mode = config.mode;
    autoSenderEnabled = Boolean(
      config.autoSender && allowAutoSenderForService(config.service || service)
    );
    pendingUrl = autoSenderEnabled ? config.pendingUrl || "" : "";
  }

  const isMobile = mode?.startsWith("mobile");
  let width = 1000;
  let height = 700;
  let userAgent = "";

  switch (mode) {
    case "mobile-iphone":
      width = 375;
      userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
      break;
    case "mobile-android":
      width = 390;
      userAgent =
        "Mozilla/5.0 (Linux; Android 11; Pixel 2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-browser-desktop":
      width = 480;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-ipad":
      width = 768;
      height = 1024;
      userAgent =
        "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A5341f Safari/604.1";
      break;
    case "mobile-galaxy-s8":
      width = 360;
      height = 740;
      userAgent =
        "Mozilla/5.0 (Linux; Android 7.0; SM-G950U Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-pixel-5":
      width = 393;
      height = 851;
      userAgent =
        "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "desktop-mini":
      width = 800;
      height = 600;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-wide":
      width = 1280;
      height = 800;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    default:
      width = 1000;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
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
      partition: `persist:${uid}`,
    },
  });

  win.webContents.on("page-title-updated", (e) => {
    e.preventDefault(); // 🔒 cegah perubahan title
    win.setTitle(deviceName + " - Starbox V1.2.1103"); // 🔄 pastikan title tetap sesuai device
  });
  win.once("ready-to-show", () => {
    if (autoShow) {
      win.show();
      win.focus();
    }
    console.log("🟢 Window ready to show!");
    if (autoSenderEnabled && autoShow) {
      ensureMonitorWindow(uid, win).catch(() => {});
    }
  });
  win.webContents.once("did-finish-load", () => {
    if (autoShow) {
      win.show();
      win.focus();
    }
  });

  win.loadURL(selected.url, {
    userAgent,
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
  updateDeviceStatus(uid, "active");

  if (autoSenderEnabled) {
    ensureMonitorWindow(uid, win).catch(() => {});
  }

  win.on("close", () => {
    console.log(`[WIN] Window close event untuk UID ${uid}`);
    updateDeviceStatus(uid, "stopped");
  });

  win.on("closed", () => {
    console.log(`[WIN] Window closed event untuk UID ${uid}`);
    const monitor = monitorWindows[uid];
    if (monitor && !monitor.isDestroyed()) {
      try {
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
    title: "Starbox Emulator",
    autoHideMenuBar: true,
    icon: getAssetPath("starbox.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), "preload.cjs"),
    },
  });
  mainWindow.maximize();
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  // Optional: buka DevTools hanya di development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
}

ipcMain.on("save-config", (event, config) => {
  store.set("config", config);
});

ipcMain.on("load-config", (event) => {
  event.returnValue = store.get("config") || {};
});

// IPC Handlers
ipcMain.handle("add-device", (event, payload = {}) => {
  const { name, service, autoRun, mode, autoSender, pendingUrl } = payload;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  let data = { devices: [] };
  if (fs.existsSync(DB_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) || { devices: [] };
    } catch (e) {
      console.error("❌ Error parsing JSON:", e);
      data = { devices: [] };
    }
  }

  if (!Array.isArray(data.devices)) {
    data.devices = [];
  }

  const normalized = normalizeDeviceList(data);
  if (normalized) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  const devices = data.devices;

  const serviceKey = (service || "").toLowerCase();
  const sameServiceCount = devices.filter((d) => d.service === service).length;
  if (sameServiceCount >= 3) {
    return {
      success: false,
      message: `❌ Maksimal 3 device diperbolehkan untuk service '${service}'.`,
    };
  }

  const enableAutoSender =
    allowAutoSenderForService(serviceKey) && !!autoSender;
  const normalizedPendingUrl = enableAutoSender
    ? (pendingUrl || "").trim()
    : "";

  const newDevice = {
    uid: uuidv4(),
    name,
    service,
    status: "stopped",
    os_type: os.platform(),
    created_at: new Date().toISOString(),
    autoRun: !!autoRun,
    mode: mode || "desktop",
    autoSender: enableAutoSender,
    pendingUrl: normalizedPendingUrl,
  };

  devices.push(newDevice);
  fs.writeFileSync(DB_PATH, JSON.stringify({ devices }, null, 2));

  return {
    success: true,
    device: newDevice,
    message: "✅ Device berhasil ditambahkan.",
  };
});

ipcMain.handle("start-device", async (event, uid, service) => {
  try {
    console.log(`⚡ Mulai device dari renderer: ${uid} (${service})`);
    startDevice(uid, service);
    return { success: true };
  } catch (err) {
    console.error(`❌ Gagal menjalankan ${uid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("edit-device", (event, payload = {}) => {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = JSON.parse(raw);
    const normalized = normalizeDeviceList(data);

    const index = data.devices.findIndex(
      (d) => d.uid === payload.uid || d.token === payload.uid
    );
    if (index !== -1) {
      const device = data.devices[index];
      const allowAuto = allowAutoSenderForService(device.service);

      device.name = payload.name;
      device.autoRun = !!payload.autoRun;
      device.mode = payload.mode || device.mode || "desktop";
      device.autoSender = allowAuto && !!payload.autoSender;
      device.pendingUrl = device.autoSender
        ? (payload.pendingUrl || "").trim()
        : "";

      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return { success: true };
    } else {
      if (normalized) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
      return { success: false, message: "Device tidak ditemukan" };
    }
  } catch (err) {
    return { success: false, message: err.message };
  }
});
ipcMain.on("run-device", async (event, uid, service) => {
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
      console.warn(
        `⚠️ Attempted to stop device ${uid} but no active window was found.`
      );
      updateDeviceStatus(uid, "stopped");
      delete deviceWindows[uid];
      resolve();
      return;
    }

    const handleClosed = () => {
      console.log(`🪟 Jendela ${uid} ditutup.`);
      win.removeListener("closed", handleClosed);
      resolve();
    };

    win.once("closed", handleClosed);

    try {
      win.close();
    } catch (err) {
      console.error(`❌ Gagal menutup jendela ${uid}:`, err);
      win.removeListener("closed", handleClosed);
      resolve();
    }
  });
}
function startDevice(uid, service) {
  if (!uid) {
    console.warn("⚠️ startDevice dipanggil tanpa UID, operasi dibatalkan.");
    return;
  }

  if (!app.isReady()) {
    console.log(`⌛ App belum siap. Menunggu untuk menjalankan device ${uid}.`);
    app.whenReady().then(() => startDevice(uid, service));
    return;
  }

  const existingWindow = deviceWindows[uid];
  if (existingWindow && !existingWindow.isDestroyed()) {
    console.log(
      `🔁 Device ${uid} sudah memiliki jendela aktif. Fokuskan kembali.`
    );
    existingWindow.focus();
    return;
  }

  console.log(
    `🚀 Menjalankan device ${uid} (${service}) sebagai jendela baru.`
  );
  updateDeviceStatus(uid, "starting");

  try {
    createDeviceWindow(uid, service);
  } catch (err) {
    console.error(`❌ Gagal membuat jendela untuk device ${uid}:`, err);
    updateDeviceStatus(uid, "stopped");
    throw err;
  }
}

ipcMain.on("stop-device", (event, uid) => {
  const win = deviceWindows[uid];
  if (win) {
    console.log(`🔌 Stopping device ${uid} by closing its window.`);
    win.close(); // Ini akan memicu event 'close' dan 'closed'
  } else {
    console.warn(`⚠️ Attempted to stop device ${uid} but no window was found.`);
    updateDeviceStatus(uid, "stopped"); // Failsafe
  }
});

ipcMain.on("focus-device", (event, uid) => {
  const win = deviceWindows[uid];
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  } else {
    console.warn(
      `⚠️ Tidak menemukan jendela untuk UID ${uid} saat mencoba fokus.`
    );
  }
});

ipcMain.on("ensure-monitor-window", async (event, uid) => {
  if (!uid) return;
  const config = getDeviceConfig(uid) || {};
  if (!config.autoSender) return;
  const parentWindow = deviceWindows[uid];
  if (!parentWindow || parentWindow.isDestroyed()) return;
  try {
    await ensureMonitorWindow(uid, parentWindow);
  } catch (err) {
    console.warn(`⚠️ Gagal memastikan monitor untuk UID ${uid}:`, err?.message);
  }
});

ipcMain.on("close-monitor-window", (event, uid) => {
  if (!uid) return;
  const monitor = monitorWindows[uid];
  if (monitor && !monitor.isDestroyed()) {
    monitor.close();
  }
});

ipcMain.on("monitor-toggle-width", () => {
  toggleMonitorWidth();
});

ipcMain.on("monitor-toggle-content", (event, isHidden) => {
  const hideContent = !!isHidden;
  monitorWindowState.contentHidden = hideContent;

  Object.values(monitorWindows).forEach((monitor) => {
    if (!monitor || monitor.isDestroyed()) return;
    const bounds = monitor.getBounds();
    if (hideContent) {
      monitor.__expandedHeight = Math.max(
        monitor.__expandedHeight || bounds.height,
        MONITOR_DIMENSIONS.minHeight
      );
    } else if (!monitor.__expandedHeight) {
      monitor.__expandedHeight = Math.max(
        bounds.height,
        MONITOR_DIMENSIONS.expandedHeight,
        MONITOR_DIMENSIONS.minHeight
      );
    }
    syncMonitorWindowLayout(monitor);
  });
});

ipcMain.handle("monitor-copy-text", (_event, rawValue = "") => {
  const value =
    typeof rawValue === "string"
      ? rawValue.trim()
      : String(rawValue ?? "").trim();
  if (!value) {
    return false;
  }
  try {
    clipboard.writeText(value);
    return true;
  } catch (err) {
    console.warn(
      "⚠️ Gagal menyalin teks monitor ke clipboard:",
      err?.message || err
    );
    return false;
  }
});
ipcMain.on("automation-monitor-update", async (event, uid, payload = {}) => {
  if (!uid) return;
  try {
    await sendAutomationMonitorPayload(uid, payload);
  } catch (err) {
    console.warn(
      `⚠️ Gagal meneruskan pembaruan monitor untuk UID ${uid}:`,
      err?.message
    );
  }
});

ipcMain.handle("load-devices", () => {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // Jika file tidak ada, buat file kosong
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ devices: [] }, null, 2));
    return { devices: [] };
  }

  // Baca isi file dengan fallback aman
  let data = { devices: [] };
  let parsedSuccessfully = false;
  try {
    const rawData = fs.readFileSync(DB_PATH, "utf8");
    if (rawData && rawData.trim().length > 0) {
      data = JSON.parse(rawData);
      parsedSuccessfully = true;
    }
  } catch (err) {
    console.error(
      "⚠️ Gagal membaca devices.json, menggunakan data kosong:",
      err?.message || err
    );
  }

  if (!parsedSuccessfully) {
    data = { devices: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  // Normalisasi struktur lama yang masih menggunakan token
  let modifiedAny = normalizeDeviceList(data);

  // Tambahkan default attribute jika belum ada
  (data.devices || []).forEach((device) => {
    if (!("autoRun" in device)) {
      device.autoRun = false;
      modifiedAny = true;
    }

    if (!("mode" in device)) {
      device.mode = "desktop";
      modifiedAny = true;
    }

    if (!("autoSender" in device)) {
      device.autoSender = false;
      modifiedAny = true;
    }

    if (!("pendingUrl" in device)) {
      device.pendingUrl = "";
      modifiedAny = true;
    }
  });

  if (modifiedAny) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  return data;
});

ipcMain.handle("delete-device", (event, uid) => {
  if (!fs.existsSync(DB_PATH)) {
    return { success: false, message: "Database tidak ditemukan." };
  }

  // 1. Baca data dari database terlebih dahulu
  let data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const normalized = normalizeDeviceList(data);

  // 2. Cari perangkat yang akan dihapus
  const deviceToDelete = (data.devices || []).find(
    (d) => d.uid === uid || d.token === uid
  );

  // Jika perangkat tidak ditemukan sama sekali
  if (!deviceToDelete) {
    if (normalized) {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }
    return { success: false, message: "Device tidak ditemukan di database." };
  }

  // 3. Validasi berdasarkan status perangkat
  //    (Asumsi status aktif adalah 'running', 'active', atau 'starting')
  const isActive = ["running", "active", "starting"].includes(
    deviceToDelete.status
  );

  if (isActive) {
    console.warn(
      `Operasi Dibatalkan: Device ${uid} berstatus '${deviceToDelete.status}' dan tidak bisa dihapus.`
    );
    return {
      success: false,
      message: `Device sedang berjalan (status: ${deviceToDelete.status}). Hentikan dulu.`,
    };
  }

  // --- Jika status aman, lanjutkan proses penghapusan ---

  const initialLength = data.devices.length;
  data.devices = data.devices.filter((d) => {
    const deviceUid = d.uid || d.token;
    return deviceUid !== uid;
  });

  if (data.devices.length < initialLength || normalized) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  if (data.devices.length < initialLength) {
    console.log(`🗑️ Device ${uid} dihapus dari database`);

    const sessionPath = path.join(userDataPath, "db", "sessions", uid);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🗑️ Folder sesi ${uid} dihapus`);
    }
    return { success: true };
  }

  // Fallback jika terjadi kondisi aneh
  return { success: false, message: "Gagal memfilter device dari database." };
});

ipcMain.handle(
  "send-whatsapp-messages",
  async (event, uid, messages, options = {}) => {
    try {
      const results = await sendWhatsappMessages(
        uid,
        Array.isArray(messages) ? messages : [],
        options
      );
      return results;
    } catch (err) {
      console.error("❌ Gagal mengeksekusi automasi WhatsApp:", err);
      throw err;
    }
  }
);

ipcMain.handle("get-system-info", () => {
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
      cpu: cpus.length ? cpus[0].model : "unknown CPU",
    };
  } catch (err) {
    console.error("⚠️ get-system-info gagal:", err);
    return {
      username: "unknown",
      hostname: os.hostname(),
      platform: os.platform(),
    };
  }
});

args.forEach((arg) => {
  if (arg === "--run-device") runDeviceFlag = true;
  else if (arg.startsWith("--uid=")) uid = arg.split("=")[1];
  else if (arg.startsWith("--service=")) service = arg.split("=")[1];
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
    console.log("📁 File devices.json dibuat.");
    return;
  }

  // Baca dan jalankan device
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const { devices } = JSON.parse(raw);

    const autoRunDevices = devices.filter((d) => d.autoRun === true);
    console.log(
      `🔍 Ditemukan ${autoRunDevices.length} device dengan autoRun: true`
    );

    const limitedDevices = autoRunDevices.slice(0, 10);

    limitedDevices.forEach((device) => {
      console.log(`🚀 Auto-running ${device.name} (${device.uid})...`);
      startDevice(device.uid, device.service);
      updateDeviceStatus(device.uid, "active"); // ✅ langsung ubah status di memori/backend
    });

    if (autoRunDevices.length > 10) {
      console.warn(
        `⚠️ Melewati ${
          autoRunDevices.length - 10
        } device lainnya karena batas autorun.`
      );
    }
  } catch (err) {
    console.error("❌ Gagal membaca atau menjalankan autoRun device:", err);
  }
});

app.on("window-all-closed", () => {
  console.log("🛑 Menutup semua jendela, akan menghentikan semua device...");

  const uids = Object.keys(deviceWindows);
  if (uids.length === 0) {
    console.log("📭 Tidak ada jendela device aktif.");
    app.quit();
    return;
  }

  uids.forEach((uid) => {
    const win = deviceWindows[uid];
    if (win && !win.isDestroyed()) {
      try {
        win.destroy();
      } catch (err) {
        console.warn(`⚠️ Gagal menghentikan jendela ${uid}:`, err.message);
      }
    }
    updateDeviceStatus(uid, "stopped");
    delete deviceWindows[uid];
  });

  app.quit();
});

app.on("activate", () => {
  // Di macOS, buka kembali window utama jika di-klik di dock dan tidak ada window terbuka.
  if (BrowserWindow.getAllWindows().length === 0 && !runDeviceFlag) {
    createMainWindow();
  }
});
