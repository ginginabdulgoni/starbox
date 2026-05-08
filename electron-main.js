// electron-main.js
const electron = require("electron");
console.log("✅ Electron loaded:", !!electron);
console.log("✅ Electron.app:", !!electron.app);
console.log("✅ Electron.ipcMain:", !!electron.ipcMain);

const app = electron.app;

// Prevent Chromium from throttling hidden/background renderer processes.
// This ensures the StarDesk stream sender window keeps capturing at full rate
// even when the StarBox main window is minimized or the app is backgrounded.
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

const BrowserWindow = electron.BrowserWindow;
const BrowserView = electron.BrowserView;
const ipcMain = electron.ipcMain;
const screen = electron.screen;
const clipboard = electron.clipboard;
const net = electron.net;
const dialog = electron.dialog;
const shell = electron.shell;
const desktopCapturer = electron.desktopCapturer;
const globalShortcut = electron.globalShortcut;
const nativeImage = electron.nativeImage;
const nodeNet = require("net");
const https = require("https");
const WebSocket = require("ws");
const { spawn, spawnSync } = require("child_process");

const Store = require("electron-store");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const path = require("path");
const Module = require("module");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { machineIdSync } = require("node-machine-id");
const { VirtualOSStorage } = require("./vm-storage");
const RemoteClient = require("./remote-client");

function ensureDefaultPath() {
  // Tambah path umum supaya binary seperti adb/scrcpy ditemukan di build production
  const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
  const current = process.env.PATH || "";
  const parts = current.split(path.delimiter).filter(Boolean);
  extraPaths.forEach((p) => {
    if (!parts.includes(p)) {
      parts.push(p);
    }
  });
  process.env.PATH = parts.join(path.delimiter);
}

ensureDefaultPath();

// Stub optional native dependency that causes issues on Windows builds
const __originalModuleLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "extract-file-icon") {
    return {
      default: () => null,
      getIcon: () => null,
    };
  }
  return __originalModuleLoad(request, parent, isMain);
};

const isPackaged = app ? app.isPackaged : false;
if (isPackaged) {
  const unpacked = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules"
  );
  const packed = path.join(process.resourcesPath, "node_modules");
  Module.globalPaths.push(unpacked);
  Module.globalPaths.push(packed);

  console.log("[StarBox Resolver] enabled at:", unpacked);

  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function (request, parent, isMain, options) {
    try {
      return originalResolveFilename(request, parent, isMain, options);
    } catch (e) {
      const try1 = path.join(unpacked, request);
      if (fs.existsSync(try1)) return try1;

      const try2 = path.join(unpacked, request, "index.js");
      if (fs.existsSync(try2)) return try2;

      const try3 = path.join(unpacked, request + ".js");
      if (fs.existsSync(try3)) return try3;

      throw e;
    }
  };
}
// Development mode - no special module resolution needed
const AndroidManager = require("./android-manager");
const iOSManager = require("./ios-manager");
const CctvManager = require("./cctv-manager");
const BaileysManager = require("./baileys-manager");
const cronParser = require("cron-parser");
const { version: packageVersion } = require("./package.json");
let windowManager = null;
try {
  ({ windowManager } = require("node-window-manager"));
} catch (err) {
  console.warn(
    "⚠️ node-window-manager gagal dimuat, fitur deteksi window OS dinonaktifkan:",
    err?.message || err
  );
  windowManager = {
    getWindows: () => [],
  };
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

const APP_VERSION = packageVersion || "dev";
const APP_VERSION_LABEL = `V${APP_VERSION}`;
const APP_BRAND_TITLE = `Starbox ${APP_VERSION_LABEL}`;
const IS_DEV_BUILD =
  process.env.NODE_ENV === "development" ||
  (!app.isPackaged && process.env.NODE_ENV !== "production");
const SHOULD_MIRROR_CONSOLE = IS_DEV_BUILD;
const DEFAULT_API_BASE_URL = IS_DEV_BUILD
  ? "http://starbox.test"
  : "https://starbox.weagate.com";

const USER_AGENT_REPORT_URL =
  process.env.STARBOX_USER_AGENT_URL ||
  `${DEFAULT_API_BASE_URL}/api/report/user-agent`;
const PACKAGE_INFO_URL =
  process.env.STARBOX_PACKAGE_URL || `${DEFAULT_API_BASE_URL}/api/package`;
const SYSTEM_REPORT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MACHINE_ID_STORE_KEY = "systemMachineId";
const AUTH_BASE_URL =
  process.env.STARBOX_AUTH_BASE_URL || `${DEFAULT_API_BASE_URL}/api/auth`;
const AUTH_SESSION_STORE_KEY = "authSession";
const GUEST_SERVICE_DEVICE_LIMIT = 2;
const LOG_RETENTION_DAYS = 7; // auto-purge logs older than this many days
const CHROME_VERSION_STORE_KEY = "latestChromeUserAgentVersion";
const CHROME_VERSION_UPDATED_AT_KEY = "latestChromeUserAgentVersionUpdatedAt";
const DEFAULT_CHROME_VERSION = "142.0.7444.176";
const CHROME_VERSION_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CHROME_VERSION_API_URL =
  "https://cdn.jsdelivr.net/gh/berstend/chrome-versions/data/stable/all/version/latest.json";
const PLATFORM_TO_CHROME_KEY = {
  win32: "windows",
  darwin: "mac",
  linux: "linux",
};
const WHATSAPP_USER_AGENT_PREFIX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/";
const WHATSAPP_USER_AGENT_SUFFIX = " Safari/537.36";

function logDev(...args) {
  if (!IS_DEV_BUILD) return;
  if (global.__starboxDevLog) {
    global.__starboxDevLog(...args);
    return;
  }
  console.log(...args);
}

function warnDev(...args) {
  if (!IS_DEV_BUILD) return;
  if (global.__starboxDevLog) {
    global.__starboxDevLog(...args);
    return;
  }
  console.warn(...args);
}

// Log only to console, not to file
function logConsoleOnly(...args) {
  const message = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
    .join(" ");
  if (SHOULD_MIRROR_CONSOLE && originalConsoleLog) {
    try {
      originalConsoleLog(message);
    } catch {
      process.stdout.write(message + "\n");
    }
  }
}

function generateAvdName(uid = "") {
  const base =
    (uid || uuidv4())
      .toString()
      .replace(/[^a-zA-Z0-9]+/g, "")
      .slice(0, 12) || `AVD${Date.now()}`;
  return `StarBox_${base}`;
}

function buildWhatsAppUserAgent(version = DEFAULT_CHROME_VERSION) {
  const normalizedVersion = version || DEFAULT_CHROME_VERSION;
  return `${WHATSAPP_USER_AGENT_PREFIX}${normalizedVersion}${WHATSAPP_USER_AGENT_SUFFIX}`;
}

function persistChromeVersionData(version, updatedAt) {
  if (!store) return;
  try {
    store.set(CHROME_VERSION_STORE_KEY, version);
    store.set(CHROME_VERSION_UPDATED_AT_KEY, updatedAt);
  } catch (err) {
    console.warn("⚠️ Gagal menyimpan versi Chrome (UA):", err?.message || err);
  }
}

function loadCachedChromeVersion() {
  if (!store) return;
  try {
    const storedVersion = store.get(CHROME_VERSION_STORE_KEY);
    const storedAt = store.get(CHROME_VERSION_UPDATED_AT_KEY);
    if (typeof storedVersion === "string" && storedVersion.trim()) {
      cachedChromeVersion = storedVersion;
    }
    if (typeof storedAt === "number" && Number.isFinite(storedAt)) {
      cachedChromeVersionUpdatedAt = storedAt;
    }
  } catch (err) {
    console.warn(
      "⚠️ Gagal baca versi Chrome (UA) dari store:",
      err?.message || err
    );
  }
}

function fetchLatestChromeVersionFromOmaha() {
  return new Promise((resolve, reject) => {
    const req = https.get(CHROME_VERSION_API_URL, (res) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        res.resume();
        reject(new Error(`OmahaProxy responded with ${statusCode}`));
        return;
      }

      let rawData = "";
      res.on("data", (chunk) => {
        rawData += chunk;
      });
      res.on("end", () => {
        try {
          const payload = JSON.parse(rawData);
          if (!payload || typeof payload !== "object") {
            throw new Error("unexpected response shape");
          }
          const platformKey =
            PLATFORM_TO_CHROME_KEY[process.platform] || "windows";
          const entry =
            payload[platformKey] ||
            payload.windows ||
            payload.mac ||
            payload.linux ||
            null;
          const stableVersion = entry?.version || null;
          resolve(stableVersion);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10_000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

async function resolveLatestChromeVersion(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedChromeVersion &&
    now - cachedChromeVersionUpdatedAt < CHROME_VERSION_REFRESH_INTERVAL_MS
  ) {
    return cachedChromeVersion;
  }

  if (chromeVersionFetchPromise) {
    return chromeVersionFetchPromise;
  }

  const fetcher = (async () => {
    try {
      const version = await fetchLatestChromeVersionFromOmaha();
      if (version) {
        cachedChromeVersion = version;
        cachedChromeVersionUpdatedAt = Date.now();
        persistChromeVersionData(
          cachedChromeVersion,
          cachedChromeVersionUpdatedAt
        );
        return cachedChromeVersion;
      }
      return cachedChromeVersion;
    } catch (err) {
      console.warn(
        "⚠️ Gagal ambil versi Chrome terbaru, pakai cache:",
        err?.message || err
      );
      return cachedChromeVersion;
    }
  })();

  chromeVersionFetchPromise = fetcher;
  fetcher.finally(() => {
    chromeVersionFetchPromise = null;
  });
  return fetcher;
}

async function resolveWhatsAppUserAgent(forceRefresh = false) {
  const version = await resolveLatestChromeVersion(forceRefresh);
  return buildWhatsAppUserAgent(version);
}

const DEFAULT_ANDROID_SPEC = Object.freeze({
  id: "balanced",
  label: "Balanced • 2 Core • 1.5 GB",
  memoryMb: 1536,
  cores: 2,
  resolution: "720x1280",
  density: 265,
});

function normalizeAndroidSpecInput(spec) {
  const normalized = { ...DEFAULT_ANDROID_SPEC };
  if (!spec || typeof spec !== "object") {
    return normalized;
  }
  if (spec.id) normalized.id = String(spec.id).slice(0, 32);
  if (spec.label) normalized.label = String(spec.label).slice(0, 64);
  const memory = parseInt(spec.memoryMb, 10);
  if (Number.isFinite(memory)) {
    normalized.memoryMb = Math.min(Math.max(memory, 512), 4096);
  }
  const cores = parseInt(spec.cores, 10);
  if (Number.isFinite(cores)) {
    normalized.cores = Math.min(Math.max(cores, 1), 8);
  }
  if (spec.resolution) {
    const match = String(spec.resolution)
      .toLowerCase()
      .match(/(\d+)\s*x\s*(\d+)/);
    if (match) {
      normalized.resolution = `${match[1]}x${match[2]}`;
    }
  }
  const density = parseInt(spec.density, 10);
  if (Number.isFinite(density)) {
    normalized.density = Math.min(Math.max(density, 120), 640);
  }
  return normalized;
}

function ensureAndroidSpec(device) {
  if (!device || (device.service || "").toLowerCase() !== "android") {
    return false;
  }
  const nextSpec = normalizeAndroidSpecInput(device.androidSpec);
  const prev = device.androidSpec || {};
  const changed =
    !prev ||
    ["id", "label", "memoryMb", "cores", "resolution", "density"].some(
      (key) => prev[key] !== nextSpec[key]
    );
  if (changed) {
    device.androidSpec = nextSpec;
  }
  return changed;
}

const withBrandTitle = (label) =>
  label ? `${label} - ${APP_BRAND_TITLE}` : APP_BRAND_TITLE;
const withVersionSuffix = (label) =>
  label ? `${label} ${APP_VERSION_LABEL}` : APP_BRAND_TITLE;

// Setup logging and store (will be initialized after app is ready)
let logStream = null;
let store = null;
let cachedMachineId = null;
let systemReportTimer = null;
let authSession = createEmptyAuthSession();
let authRefreshTimer = null;
let cachedChromeVersion = DEFAULT_CHROME_VERSION;
let virtualOSStorage = null;

// WhatsApp Message Cache - untuk mencegah duplicate send saat fetch ulang
// Map structure: messageId -> { status: 'sending' | 'sent' | 'failed', timestamp: number }
const WHATSAPP_MESSAGE_CACHE = new Map();
const MESSAGE_CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 menit
let cachedChromeVersionUpdatedAt = 0;
let chromeVersionFetchPromise = null;
let OS_VM_DB_PATH = null;
let CRON_JOBS_DB_PATH = null;
const vmProcesses = new Map();

// ── StarCapture ─────────────────────────────────────────────────
let scOverlayWindow = null;
let scCurrentMode   = 'screenshot'; // 'screenshot' | 'record'
let scPendingResolve = null;        // resolves when overlay confirms/cancels
const vmVncProxies = new Map();
const vncWindows = new Map(); // vmId → BrowserWindow

// ── Resource Monitor: rolling CPU usage sampler ────────────────────────────
let _rmCpuCache = 0;
function _rmGetCpuSample() {
  return os.cpus().map(c => ({
    total: Object.values(c.times).reduce((a, b) => a + b, 0),
    idle: c.times.idle,
  }));
}
let _rmPrevSample = _rmGetCpuSample();
setInterval(() => {
  const curr = _rmGetCpuSample();
  let totalDelta = 0, idleDelta = 0;
  for (let i = 0; i < curr.length; i++) {
    totalDelta += curr[i].total - (_rmPrevSample[i]?.total || 0);
    idleDelta  += curr[i].idle  - (_rmPrevSample[i]?.idle  || 0);
  }
  _rmCpuCache = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
  _rmPrevSample = curr;
}, 1000);

// Initialize logging after app is ready
function initializeLogging() {
  // KOREKSI: Menggunakan path temp yang cross-platform
  const tempDir = app.getPath("temp");
  fs.appendFileSync(
    path.join(tempDir, "starbox-debug.log"),
    `[${new Date().toISOString()}] ${process.argv.join(" ")}\n`
  );

  // Setup paths globally
  userDataPath = app.getPath("userData");
  DB_PATH = path.join(userDataPath, "db", "devices.json");
  ANDROID_REMOTE_DB_PATH = path.join(userDataPath, "db", "adb-devices.json");
  OS_VM_DB_PATH = path.join(userDataPath, "db", "virtual-machines.json");
  CRON_JOBS_DB_PATH = path.join(userDataPath, "db", "cron-jobs.json");

  // Setup logging — trim old entries before opening stream
  trimStarboxLog();
  const logPath = path.join(userDataPath, "starbox.log");
  logStream = fs.createWriteStream(logPath, { flags: "a" });

  console.log = (...args) => {
    const message = `[LOG] ${new Date().toISOString()}: ${args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
      .join(" ")}\n`;
    const trimmed = message.endsWith("\n") ? message.slice(0, -1) : message;
    if (logStream) {
      logStream.write(message);
    }
    if (SHOULD_MIRROR_CONSOLE) {
      if (originalConsoleLog) {
        try {
          originalConsoleLog(trimmed);
        } catch {
          process.stdout.write(message);
        }
      } else {
        process.stdout.write(message);
      }
    }
  };
  console.error = (...args) => {
    const message = `[ERR] ${new Date().toISOString()}: ${args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
      .join(" ")}\n`;
    const trimmed = message.endsWith("\n") ? message.slice(0, -1) : message;
    if (logStream) {
      logStream.write(message);
    }
    if (SHOULD_MIRROR_CONSOLE) {
      if (originalConsoleError) {
        try {
          originalConsoleError(trimmed);
        } catch {
          process.stderr.write(message);
        }
      } else {
        process.stderr.write(message);
      }
    }
  };

  // Initialize store
  store = new Store();
  loadCachedChromeVersion();
  restoreAuthSessionFromStore();
  scheduleAuthRefresh();
  // Start remote client if session already exists (e.g. app restart while logged in)
  setTimeout(() => startRemoteClient(), 1500);

  // Initialize managers
  androidManager = new AndroidManager();
  iosManager = new iOSManager();
  virtualOSStorage = new VirtualOSStorage(userDataPath);
  const cctvDbPath  = path.join(app.getPath('userData'), 'cctv-cameras.json');
  const cctvToolsPath = path.join(app.getPath('userData'), 'tools');
  cctvManager = new CctvManager(cctvDbPath, cctvToolsPath);
  // Restore portable ffmpeg path if already installed
  if (process.platform === 'win32') {
    const portableBin = cctvManager._findPortableFfmpegWin();
    if (portableBin) cctvManager.setFfmpegBin(portableBin);
  }
  startCronScheduler();

  console.log("✅ Paths and managers initialized");
  logConsoleOnly("   DB_PATH:", DB_PATH);
  logConsoleOnly("   Store:", store ? "Ready" : "Failed");
  logConsoleOnly("   Android Manager:", androidManager ? "Ready" : "Failed");
  logConsoleOnly("   iOS Manager:", iosManager ? "Ready" : "Failed");
  if (authSession?.isLoggedIn && authSession?.user?.email) {
    console.log(
      `   Auth Session: Logged in as ${authSession.user.email} (kuota: ${
        authSession.deviceQuota ?? "tanpa batas"
      })`
    );
  } else {
    console.log("   Auth Session: Guest mode");
  }

  startSystemInfoReporter();
}

function getPersistentMachineId() {
  if (cachedMachineId) return cachedMachineId;

  try {
    cachedMachineId = machineIdSync();
    return cachedMachineId;
  } catch (err) {
    console.warn(
      "⚠️ Gagal membaca machineId native, fallback ke store:",
      err?.message || err
    );
  }

  if (!store) {
    cachedMachineId = uuidv4();
    return cachedMachineId;
  }

  try {
    const storedId = store.get(MACHINE_ID_STORE_KEY);
    if (storedId) {
      cachedMachineId = storedId;
      return cachedMachineId;
    }
  } catch (err) {
    console.warn(
      "⚠️ Gagal membaca machineId dari store, generate baru:",
      err?.message || err
    );
  }

  cachedMachineId = uuidv4();
  try {
    store.set(MACHINE_ID_STORE_KEY, cachedMachineId);
  } catch (err) {
    console.warn("⚠️ Gagal menyimpan machineId ke store:", err?.message || err);
  }
  return cachedMachineId;
}

function collectNetworkInfo() {
  const summary = {
    macAddresses: [],
    ipAddresses: [],
  };

  try {
    const interfaces = os.networkInterfaces?.() || {};
    Object.entries(interfaces).forEach(([name, configs]) => {
      if (!Array.isArray(configs)) return;

      configs.forEach((config) => {
        if (!config) return;

        if (config.mac && config.mac !== "00:00:00:00:00:00") {
          summary.macAddresses.push(config.mac);
        }

        if (config.address) {
          if (!config.internal) {
            summary.ipAddresses.push(config.address);
          }
        }
      });
    });

    summary.macAddresses = Array.from(new Set(summary.macAddresses));
    summary.ipAddresses = Array.from(new Set(summary.ipAddresses));
  } catch (err) {
    console.warn("⚠️ Gagal membaca informasi jaringan:", err?.message || err);
  }

  return summary;
}

function readDeviceDetails() {
  const fallback = { total: 0, devices: [] };
  if (!DB_PATH) return fallback;

  try {
    if (!fs.existsSync(DB_PATH)) {
      return fallback;
    }

    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = JSON.parse(raw);
    const devices = Array.isArray(data.devices) ? data.devices : [];

    const sanitized = devices.map((device) => ({
      uid: device.uid,
      name: device.name,
      service: device.service,
      mode: device.mode,
      status: device.status,
      autoRun: device.autoRun,
      autoSender: device.autoSender,
      pendingUrl: device.pendingUrl,
      customUrl: device.customUrl,
      lastActiveAt: device.lastActiveAt || device.last_active_at,
      createdAt: device.created_at || device.createdAt,
    }));

    return {
      total: sanitized.length,
      devices: sanitized,
    };
  } catch (err) {
    console.warn("⚠️ Gagal membaca daftar device:", err?.message || err);
    return fallback;
  }
}

function collectWhatsAppGatewaySnapshot() {
  const fallback = { total: 0, devices: [] };
  if (!BaileysManager || !BaileysManager.isDatabaseReady?.()) {
    return fallback;
  }

  try {
    const devices = BaileysManager.getDevices() || [];
    if (!Array.isArray(devices) || devices.length === 0) {
      return fallback;
    }

    const entries = devices.map((device) => {
      const statusInfo = BaileysManager.getConnectionStatus(device.id) || {};
      return {
        id: device.id,
        name: device.name || null,
        status: statusInfo.status || device.status || "unknown",
        connected: !!statusInfo.connected,
        phone: statusInfo.phone || device.phone || null,
        auto_reply_enabled: !!device.auto_reply_enabled,
        created_at: device.created_at || device.createdAt || null,
        updated_at: device.updated_at || device.updatedAt || null,
      };
    });

    return {
      total: entries.length,
      devices: entries,
    };
  } catch (err) {
    console.warn(
      "⚠️ Gagal mengumpulkan snapshot WhatsApp Gateway:",
      err?.message || err
    );
    return fallback;
  }
}

function collectWhatsAppGatewayStatusSnapshot() {
  const fallback = [];
  if (!BaileysManager || !BaileysManager.isDatabaseReady?.()) {
    return fallback;
  }

  try {
    const devices = BaileysManager.getDevices() || [];
    return devices.map((device) => {
      const statusInfo = BaileysManager.getConnectionStatus(device.id) || {};
      return {
        id: device.id,
        name: device.name || null,
        databaseStatus: device.status || "unknown",
        socketStatus: statusInfo.status || "unknown",
        connected: !!statusInfo.connected,
        phone: statusInfo.phone || device.phone || null,
        auto_reply_enabled: !!device.auto_reply_enabled,
        lastCheckedAt: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn(
      "⚠️ Gagal mengumpulkan status WhatsApp Gateway:",
      err?.message || err
    );
    return fallback;
  }
}

function buildDeviceSnapshot(device = {}) {
  if (!device || typeof device !== "object") return null;
  return {
    uid: device.uid || device.token || null,
    name: device.name || null,
    service: device.service || null,
    mode: device.mode || null,
    autoRun: !!device.autoRun,
    autoSender: !!device.autoSender,
    status: device.status || null,
    pendingUrl: device.pendingUrl || null,
    callbackUrl: device.callbackUrl || null,
    customUrl: device.customUrl || null,
    androidSpec: device.androidSpec
      ? {
          id: device.androidSpec.id,
          label: device.androidSpec.label,
          memoryMb: device.androidSpec.memoryMb,
          cores: device.androidSpec.cores,
          resolution: device.androidSpec.resolution,
          density: device.androidSpec.density,
        }
      : null,
    created_at: device.created_at || device.createdAt || null,
    updated_at: device.updated_at || device.updatedAt || null,
  };

  function devLog(...args) {
    if (!IS_DEV_BUILD) return;
    const message = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : a))
      .join(" ");
    if (originalConsoleLog) {
      try {
        originalConsoleLog(`[DEV] ${message}`);
      } catch {
        process.stdout.write(`[DEV] ${message}\n`);
      }
    } else {
      process.stdout.write(`[DEV] ${message}\n`);
    }
  }

  global.__starboxDevLog = devLog;
}

function buildSystemInfoPayload(context = {}) {
  const cpuInfo = os.cpus?.() || [];
  const cpuModel = cpuInfo[0]?.model || "unknown";
  let username = "unknown";
  try {
    username = os.userInfo().username;
  } catch {
    // Ignore failures and keep unknown username
  }

  let localeInfo = { locale: null, timeZone: null };
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    localeInfo = {
      locale: resolved.locale || null,
      timeZone: resolved.timeZone || null,
    };
  } catch {
    // Ignore Intl failures
  }

  const network = collectNetworkInfo();
  const deviceDetails = readDeviceDetails();
  const authSnapshot = sanitizeAuthSession();
  const macAddresses =
    Array.isArray(network.macAddresses) && network.macAddresses.length
      ? network.macAddresses
      : null;
  const ipAddresses =
    Array.isArray(network.ipAddresses) && network.ipAddresses.length
      ? network.ipAddresses
      : null;

  // Remox payload: total connections
  let remoxPayload = null;
  try {
    const remoxConns = typeof loadRemoxConnections === "function" ? loadRemoxConnections() : [];
    remoxPayload = {
      total: Array.isArray(remoxConns) ? remoxConns.length : 0,
    };
  } catch {}

  const payload = {
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    userAgent: app.userAgentFallback || `Starbox/${APP_VERSION}`,
    basic: {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      username,
      arch: os.arch(),
      cpus: cpuModel,
      cpuCores: cpuInfo.length,
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      machineId: getPersistentMachineId(),
      uptimeSeconds: Math.round(os.uptime()),
      loadAverage: os.loadavg(),
      homeDir: os.homedir?.() || null,
      tempDir: os.tmpdir?.() || null,
      locale: localeInfo.locale,
      timeZone: localeInfo.timeZone,
      ipAddresses,
      macAddresses,
    },
    network: {
      macAddresses,
      ipAddresses,
    },
    devices: deviceDetails,
    auth: authSnapshot,
    whatsappGateway: collectWhatsAppGatewaySnapshot(),
    remox_payload: remoxPayload,
    remoteClientId: _stableRemoteClientId || null,
  };

  if (context.eventType) {
    payload.event = context.eventType;
  }
  if (context.accountSnapshot) {
    payload.account = context.accountSnapshot;
  }
  if (context.meta) {
    payload.meta = context.meta;
  }
  if (context.adbRemote) {
    payload.adbRemote = context.adbRemote;
  }
  if (context.deviceChange) {
    payload.deviceChange = context.deviceChange;
  }
  if (context.whatsappGatewayChange) {
    payload.whatsappGatewayChange = context.whatsappGatewayChange;
  }

  return payload;
}

async function sendSystemInfoReport(context = {}) {
  if (!USER_AGENT_REPORT_URL) {
    console.warn("⚠️ USER_AGENT_REPORT_URL kosong, skip kirim info sistem.");
    return;
  }

  try {
    const payload = buildSystemInfoPayload(context);
    // logConsoleOnly(
    //   "🧾 Payload info sistem Starbox (akan dikirim):",
    //   JSON.stringify(payload, null, 2)
    // );
    // logConsoleOnly(`📦 Total device terdeteksi: ${payload.devices.total || 0}`);
    // logConsoleOnly("🎯 Endpoint laporan user-agent:", USER_AGENT_REPORT_URL);
    await requestJson({
      url: USER_AGENT_REPORT_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": payload.userAgent,
      },
      body: payload,
    });

    // logConsoleOnly("📡 Info sistem dikirim ke endpoint Starbox.");
  } catch (err) {
    console.error(
      "❌ Gagal mengirim info sistem:",
      err?.message || err.toString()
    );
  }
}

function buildAdbRemoteReportPayload(context = {}) {
  const devices = readAndroidRemoteDevices();
  const userAgentString =
    app?.userAgentFallback || `Starbox/${APP_VERSION} (ADB Remote)`;
  return {
    event: "adb-remote",
    action: context.action || "sync",
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    userAgent: userAgentString,
    machineId:
      typeof getPersistentMachineId === "function"
        ? getPersistentMachineId()
        : null,
    count: devices.length,
    devices,
    device: context.device || null,
    uid: context.uid || context.device?.uid || null,
  };
}

async function sendAdbRemoteReport(context = {}) {
  if (!USER_AGENT_REPORT_URL) return;
  try {
    const adbRemote = buildAdbRemoteReportPayload(context);
    const payload = buildSystemInfoPayload({
      eventType: "adb-remote",
      meta: context.meta,
      adbRemote: {
        action: adbRemote.action,
        timestamp: adbRemote.timestamp,
        count: adbRemote.count,
        devices: adbRemote.devices,
        device: adbRemote.device,
        uid: adbRemote.uid,
      },
    });
    const userAgent = adbRemote.userAgent || payload.userAgent;
    payload.userAgent = userAgent;
    await requestJson({
      url: USER_AGENT_REPORT_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },
      body: payload,
    });
  } catch (err) {
    console.warn(
      "⚠️ Gagal mengirim laporan ADB Remote:",
      err?.message || err.toString()
    );
  }
}

function startSystemInfoReporter() {
  if (systemReportTimer) {
    clearInterval(systemReportTimer);
    systemReportTimer = null;
  }

  // Kirim pertama kali segera setelah app siap
  sendSystemInfoReport({ eventType: "startup" });
  sendAdbRemoteReport({ action: "startup-sync" }).catch(() => {});
  systemReportTimer = setInterval(
    () => sendSystemInfoReport({ eventType: "heartbeat" }),
    SYSTEM_REPORT_INTERVAL_MS
  );
}

function createEmptyAuthSession() {
  return {
    isLoggedIn: false,
    token: null,
    refreshToken: null,
    user: null,
    deviceQuota: null,
    serverDeviceCount: null,
    lastSyncedAt: null,
    package: null,
    isUnlimited: false,
    packageExpiresAt: null,
    tokenExpiresAt: null,
    allowsPrivateService: false,
    allowsAndroidEmulator: false,
    allowsIosSimulator: false,
    limit_device_wa_gateway: null,
    limit_auto_reply: null,
    limit_broadcast_day: null,

    raw: null,
  };
}

function coerceNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function restoreAuthSessionFromStore() {
  if (!store) {
    authSession = createEmptyAuthSession();
    return;
  }

  try {
    const saved = store.get(AUTH_SESSION_STORE_KEY);
    if (saved && typeof saved === "object") {
      authSession = {
        ...createEmptyAuthSession(),
        ...saved,
      };
      authSession.isLoggedIn =
        !!authSession.token && authSession.isLoggedIn !== false;
    } else {
      authSession = createEmptyAuthSession();
    }
  } catch (err) {
    authSession = createEmptyAuthSession();
    console.warn("⚠️ Gagal memulihkan sesi autentikasi:", err?.message || err);
  }
}

function persistAuthSession() {
  if (!store) return;
  try {
    const payload = { ...authSession };
    delete payload.raw;
    store.set(AUTH_SESSION_STORE_KEY, payload);
  } catch (err) {
    console.warn("⚠️ Gagal menyimpan sesi autentikasi:", err?.message || err);
  }
}

function getGuestServiceLimit() {
  return GUEST_SERVICE_DEVICE_LIMIT;
}

function getAccountDeviceQuota() {
  if (!authSession || !authSession.isLoggedIn) return null;
  if (
    typeof authSession.deviceQuota === "number" &&
    !Number.isNaN(authSession.deviceQuota)
  ) {
    return authSession.deviceQuota;
  }
  return null;
}

function clearAuthRefreshTimer() {
  if (authRefreshTimer) {
    clearTimeout(authRefreshTimer);
    authRefreshTimer = null;
  }
}

function scheduleAuthRefresh() {
  clearAuthRefreshTimer();
  if (
    !authSession ||
    !authSession.isLoggedIn ||
    !authSession.refreshToken ||
    !authSession.tokenExpiresAt
  ) {
    return;
  }

  const expiresAt = Date.parse(authSession.tokenExpiresAt);
  if (Number.isNaN(expiresAt)) return;

  const now = Date.now();
  const msUntilExpiry = expiresAt - now;
  if (msUntilExpiry <= 0) {
    refreshAuthToken().catch((err) => {
      console.error("❌ Refresh token gagal:", err?.message || err);
    });
    return;
  }

  const refreshDelay = Math.max(30 * 1000, msUntilExpiry - 60 * 1000);
  authRefreshTimer = setTimeout(() => {
    refreshAuthToken().catch((err) => {
      console.error("❌ Refresh token gagal:", err?.message || err);
    });
  }, refreshDelay);
}

async function refreshAuthToken() {
  if (!authSession?.refreshToken) {
    console.warn("⚠️ Refresh token tidak tersedia.");
    return;
  }
  try {
    console.log(
      "🔄 Menyegarkan token autentikasi menggunakan refresh token..."
    );
    const data = await callAuthEndpoint("refresh", {
      refresh_token: authSession.refreshToken,
    });
    const overrides = {
      email: authSession.user?.email,
      packageExpiresAt:
        data.package_expires_at ||
        data.packageExpiresAt ||
        authSession.packageExpiresAt,
      tokenExpiresAt:
        data.token_expires_at ||
        data.tokenExpiresAt ||
        (data.expires_in
          ? new Date(
              Date.now() + Number(data.expires_in || 0) * 1000
            ).toISOString()
          : null),
      expiresIn: data.expires_in || data.expiresIn || null,
    };
    applyAuthSessionFromPayload(data, overrides);
    try {
      remoteClient.updateToken(authSession.token);
    } catch (syncErr) {
      console.warn(
        "⚠️ Gagal sinkron token refresh ke Remote Client:",
        syncErr?.message || syncErr
      );
    }
    console.log("✅ Token berhasil diperbarui.");
  } catch (err) {
    console.error("❌ Gagal memperbarui token autentikasi:", err);
    // Hanya logout jika refresh token benar-benar invalid (401/403)
    // Untuk error jaringan atau server error, tetap pertahankan session
    const isAuthError = err?.status === 401 || err?.status === 403;
    if (isAuthError) {
      console.warn("⚠️ Refresh token tidak valid. Logout otomatis.");
      clearAuthSession();
    } else {
      console.warn(
        "⚠️ Refresh token gagal karena error jaringan/server. Session tetap dipertahankan."
      );
      // Jadwalkan ulang refresh untuk dicoba lagi nanti (5 menit)
      authRefreshTimer = setTimeout(() => {
        refreshAuthToken().catch((err) => {
          console.error("❌ Retry refresh token gagal:", err?.message || err);
        });
      }, 5 * 60 * 1000);
    }
  }
}

function sanitizeAuthSession() {
  const { token, refreshToken, raw, ...rest } = authSession || {};
  const sanitizedUser = rest?.user ? { ...rest.user } : null;
  const sanitizedPackage = rest?.package ? { ...rest.package } : null;
  return {
    ...rest,
    user: sanitizedUser,
    package: sanitizedPackage,
    tokenExpiresAt: rest?.tokenExpiresAt || null,
    packageExpiresAt: rest?.packageExpiresAt || null,
    allowsPrivateService: !!rest?.allowsPrivateService,
    allowsAndroidEmulator: !!rest?.allowsAndroidEmulator,
    allowsIosSimulator: !!rest?.allowsIosSimulator,
    hasToken: !!token,
    isLoggedIn: !!(rest?.isLoggedIn || token),
    isUnlimited: !!rest?.isUnlimited,
    guestServiceLimit: getGuestServiceLimit(),
    limit_device_wa_gateway: rest?.limit_device_wa_gateway ?? null,
    limit_auto_reply: rest?.limit_auto_reply ?? null,
    limit_broadcast_day: rest?.limit_broadcast_day ?? null,
  };
}

function broadcastAuthSessionUpdate() {
  const payload = sanitizeAuthSession();
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send("auth-session-updated", payload);
    } catch (err) {
      console.warn(
        "⚠️ Gagal mengirim pembaruan sesi auth:",
        err?.message || err
      );
    }
  });
}

function buildAuthSessionFromResponse(payload = {}, overrides = {}) {
  const baseUser =
    payload.user ||
    payload.account ||
    payload.profile ||
    payload.data?.user ||
    overrides.user ||
    {};
  const packageSource =
    payload.package ||
    payload.data?.package ||
    baseUser.package ||
    payload.subscription ||
    payload.plan ||
    null;
  const normalizedPackage = packageSource
    ? {
        id: packageSource.id ?? null,
        name: packageSource.name || packageSource.title || null,
        device_limit: coerceNumber(
          packageSource.device_limit ?? packageSource.limit
        ),
        is_device_limit_unlimited:
          packageSource.is_device_limit_unlimited === true ||
          packageSource.isDeviceLimitUnlimited === true ||
          packageSource.deviceLimitUnlimited === true,
        is_unlimited:
          packageSource.is_unlimited === true ||
          packageSource.isUnlimited === true ||
          packageSource.unlimited === true,
        limit_device_wa_gateway:
          coerceNumber(packageSource.limit_device_wa_gateway) ??
          coerceNumber(packageSource.limitDeviceWAGateway),
        limit_auto_reply:
          coerceNumber(packageSource.limit_auto_reply) ??
          coerceNumber(packageSource.limitAutoReply),
        limit_broadcast_day:
          coerceNumber(packageSource.limit_broadcast_day) ??
          coerceNumber(packageSource.limitBroadcastDay),
        price_display:
          packageSource.price_display ||
          packageSource.priceDisplay ||
          packageSource.price ||
          null,
        allows_private_service:
          packageSource.allows_private_service === true ||
          packageSource.allowsPrivateService === true,
        allows_android_emulator:
          packageSource.allows_android_emulator === true ||
          packageSource.allowsAndroidEmulator === true,
        allows_ios_simulator:
          packageSource.allows_ios_simulator === true ||
          packageSource.allowsIosSimulator === true,
      }
    : null;
  const packageExpiresAt =
    overrides.packageExpiresAt ||
    payload.package_expires_at ||
    payload.packageExpiresAt ||
    baseUser.package_expires_at ||
    baseUser.packageExpiresAt ||
    normalizedPackage?.expires_at ||
    normalizedPackage?.expiresAt ||
    null;
  const expiresInSeconds = Number(
    overrides.expiresIn ??
      payload.expires_in ??
      payload.expiresIn ??
      payload.data?.expires_in ??
      payload.data?.expiresIn
  );
  let tokenExpiresAt =
    overrides.tokenExpiresAt ||
    (Number.isFinite(expiresInSeconds)
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : null);

  const token =
    payload.token ||
    payload.accessToken ||
    payload.access_token ||
    payload.data?.token ||
    payload.data?.accessToken ||
    payload.data?.access_token ||
    null;

  const refreshToken =
    payload.refreshToken ||
    payload.refresh_token ||
    payload.data?.refreshToken ||
    payload.data?.refresh_token ||
    null;

  const deviceQuotaCandidates = [
    coerceNumber(payload.deviceQuota),
    coerceNumber(payload.maxDevices),
    coerceNumber(payload.device_limit),
    coerceNumber(payload.devices_limit),
    coerceNumber(baseUser.deviceQuota),
    coerceNumber(baseUser.device_limit),
    coerceNumber(normalizedPackage?.device_limit),
  ].filter((value) => typeof value === "number");

  let finalQuota =
    deviceQuotaCandidates.length > 0 ? deviceQuotaCandidates[0] : null;

  const serverDeviceCount =
    coerceNumber(payload.totalDevices) ??
    coerceNumber(payload.deviceCount) ??
    coerceNumber(payload.devices_count) ??
    coerceNumber(baseUser.devices_count) ??
    null;

  const user = {
    id:
      baseUser.id ||
      baseUser.user_id ||
      baseUser.uid ||
      overrides.userId ||
      null,
    name:
      baseUser.name ||
      baseUser.full_name ||
      baseUser.fullName ||
      baseUser.username ||
      overrides.name ||
      null,
    email: baseUser.email || overrides.email || null,
    phone:
      baseUser.phone ||
      baseUser.phone_number ||
      payload.phone ||
      payload.phone_number ||
      overrides.phone ||
      null,
    phone_code:
      overrides.phone_code ||
      overrides.phonecode ||
      baseUser.phone_code ||
      baseUser.phonecode ||
      payload.phone_code ||
      payload.phonecode ||
      null,
    role: baseUser.role || null,
  };

  let isUnlimited = false;
  if ((user.role || "").toLowerCase() === "admin") {
    isUnlimited = true;
    finalQuota = null;
  } else if (normalizedPackage?.is_unlimited) {
    isUnlimited = true;
    finalQuota = null;
  } else if (typeof finalQuota !== "number") {
    finalQuota = getGuestServiceLimit();
  }

  const allowsPrivateService =
    typeof overrides.allowsPrivateService === "boolean"
      ? overrides.allowsPrivateService
      : Boolean(
          normalizedPackage?.allows_private_service ||
            normalizedPackage?.allowsPrivateService ||
            payload.allows_private_service ||
            payload.package_allows_private_service ||
            payload.user?.allows_private_service ||
            baseUser.allows_private_service
        );

  const allowsAndroidEmulator =
    typeof overrides.allowsAndroidEmulator === "boolean"
      ? overrides.allowsAndroidEmulator
      : Boolean(
          normalizedPackage?.allows_android_emulator ||
            normalizedPackage?.allowsAndroidEmulator ||
            payload.allows_android_emulator ||
            payload.package_allows_android_emulator ||
            payload.user?.allows_android_emulator ||
            baseUser.allows_android_emulator
        );

  const allowsIosSimulator =
    typeof overrides.allowsIosSimulator === "boolean"
      ? overrides.allowsIosSimulator
      : Boolean(
          normalizedPackage?.allows_ios_simulator ||
            normalizedPackage?.allowsIosSimulator ||
            payload.allows_ios_simulator ||
            payload.package_allows_ios_simulator ||
            payload.user?.allows_ios_simulator ||
            baseUser.allows_ios_simulator
        );

  const derivedLimitDeviceWAGateway =
    normalizedPackage?.limit_device_wa_gateway ??
    coerceNumber(payload.limit_device_wa_gateway) ??
    coerceNumber(payload.limitDeviceWAGateway) ??
    null;
  const derivedLimitAutoReply =
    normalizedPackage?.limit_auto_reply ??
    coerceNumber(payload.limit_auto_reply) ??
    coerceNumber(payload.limitAutoReply) ??
    null;
  const derivedLimitBroadcastDay =
    normalizedPackage?.limit_broadcast_day ??
    coerceNumber(payload.limit_broadcast_day) ??
    coerceNumber(payload.limitBroadcastDay) ??
    null;

  return {
    ...createEmptyAuthSession(),
    isLoggedIn: !!token,
    token,
    refreshToken,
    user,
    deviceQuota:
      typeof finalQuota === "number" && !isUnlimited ? finalQuota : null,
    isUnlimited,
    package: normalizedPackage,
    packageExpiresAt,
    tokenExpiresAt,
    allowsPrivateService,
    allowsAndroidEmulator,
    allowsIosSimulator,
    serverDeviceCount:
      typeof serverDeviceCount === "number" ? serverDeviceCount : null,
    limit_device_wa_gateway: derivedLimitDeviceWAGateway,
    limit_auto_reply: derivedLimitAutoReply,
    limit_broadcast_day: derivedLimitBroadcastDay,
    lastSyncedAt: new Date().toISOString(),
    raw: payload,
  };
}

function applyAuthSessionFromPayload(payload, overrides = {}) {
  authSession = buildAuthSessionFromResponse(payload, overrides);
  if (!authSession.token) {
    authSession.isLoggedIn = false;
  }
  persistAuthSession();
  broadcastAuthSessionUpdate();
  scheduleAuthRefresh();
  return sanitizeAuthSession();
}

function clearAuthSession() {
  clearAuthRefreshTimer();
  authSession = createEmptyAuthSession();
  persistAuthSession();
  broadcastAuthSessionUpdate();
  return sanitizeAuthSession();
}

async function callAuthEndpoint(pathSuffix, payload = {}, options = {}) {
  const normalizedBase = AUTH_BASE_URL.replace(/\/$/, "");
  const normalizedPath = String(pathSuffix || "").replace(/^\//, "");
  const endpoint = `${normalizedBase}/${normalizedPath}`;
  const method = options.method || "POST";
  const requestOptions = {
    url: endpoint,
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: method === "GET" ? undefined : payload,
  };
  if (method === "GET") {
    delete requestOptions.headers["Content-Type"];
  }

  try {
    const data = await requestJson(requestOptions);
    return data || {};
  } catch (err) {
    if (!err?.status) {
      const networkError = new Error(
        err?.message || "Tidak dapat menghubungi server Starbox."
      );
      networkError.code = err?.code || "NETWORK_ERROR";
      throw networkError;
    }
    throw err;
  }
}

async function fetchPackageDetails(authToken = null) {
  try {
    const data = await requestJson({
      url: PACKAGE_INFO_URL,
      method: "GET",
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        Accept: "application/json",
      },
    });
    // console.log("📦 GET /api/package response:", data);
    return data;
  } catch (err) {
    logConsoleOnly(
      "❌ Gagal mengambil data paket dari API /package:",
      err?.message || err
    );
    return null;
  }
}

async function refreshPackageInfo() {
  if (!authSession?.isLoggedIn || !authSession?.token) {
    return null;
  }

  try {
    const data = await fetchPackageDetails(authSession.token);
    if (!data) return null;

    const payload = {
      token: authSession.token,
      refreshToken: authSession.refreshToken,
      user: authSession.user,
      deviceQuota: authSession.deviceQuota,
      package: data.package,
      package_expires_at: data.package_expires_at,
    };

    const session = applyAuthSessionFromPayload(payload, {
      email: authSession.user?.email,
      packageExpiresAt:
        data.package_expires_at ||
        data.packageExpiresAt ||
        authSession.packageExpiresAt,
    });

    logDev("🔁 Paket disinkronkan dari API /package:", {
      package: session.package,
      expires_at: session.packageExpiresAt,
    });

    return session;
  } catch (err) {
    console.error("❌ Gagal memuat detail paket:", err?.message || err);
    return null;
  }
}

function requestJson(options = {}) {
  const {
    url,
    method = "GET",
    headers = {},
    body = null,
    timeoutMs = 20000,
    expectJson = true,
  } = options;
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("URL request kosong."));
      return;
    }
    const request = net.request({ method, url });
    const finalHeaders = {
      Accept: headers.Accept || "application/json",
      ...headers,
    };
    Object.entries(finalHeaders).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        request.setHeader(key, value);
      }
    });

    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        request.abort();
        reject(new Error("Request timeout."));
      }, timeoutMs);
    }

    request.on("response", (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        if (timer) clearTimeout(timer);
        const statusCode = response.statusCode || 0;
        const rawBody = Buffer.concat(chunks).toString("utf8");

        if (statusCode >= 200 && statusCode < 300) {
          let parsed = rawBody;
          if (expectJson) {
            try {
              parsed = rawBody ? JSON.parse(rawBody) : {};
            } catch (err) {
              console.warn("⚠️ Gagal parse JSON:", err?.message || err);
              parsed = null;
            }
          }
          resolve(parsed);
          return;
        }

        const error = new Error(
          `Request gagal (${statusCode}): ${
            response.statusMessage || "Unknown"
          }`
        );
        error.status = statusCode;
        error.response = rawBody;
        reject(error);
      });
    });

    request.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    if (body !== null && body !== undefined) {
      const payload =
        typeof body === "string" || Buffer.isBuffer(body)
          ? body
          : JSON.stringify(body);
      if (!finalHeaders["Content-Type"] && !finalHeaders["content-type"]) {
        request.setHeader("Content-Type", "application/json");
      }
      request.write(payload);
    }

    request.end();
  });
}

async function fetchLatestVersionInfo(channel = "stable") {
  const normalizedBase = DEFAULT_API_BASE_URL.replace(/\/$/, "");
  const normalizedChannel = encodeURIComponent(channel || "stable");
  const endpoint = `${normalizedBase}/api/version?channel=${normalizedChannel}`;
  const data = await requestJson({ url: endpoint, method: "GET" });
  const payload =
    data && typeof data === "object"
      ? data.data && typeof data.data === "object"
        ? data.data
        : data
      : null;
  if (!payload || typeof payload !== "object") {
    throw new Error("Respons versi tidak valid.");
  }
  if (!payload.channel) {
    payload.channel = channel || "stable";
  }
  return payload;
}

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
const defaultServices = {
  // 🌐 Komunikasi & Sosial
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
  discord: {
    name: "Discord",
    url: "https://discord.com/app",
    icon: "starbox.png",
  },
  slack: { name: "Slack", url: "https://app.slack.com", icon: "starbox.png" },
  messenger: {
    name: "Messenger",
    url: "https://www.messenger.com",
    icon: "starbox.png",
  },
  line: { name: "LINE", url: "https://web.line.me", icon: "starbox.png" },
  microsoft_teams: {
    name: "Microsoft Teams",
    url: "https://teams.microsoft.com",
    icon: "starbox.png",
  },

  // 🛒 Marketplace
  shopee: {
    name: "Shopee",
    url: "https://shopee.co.id/buyer/login",
    icon: "shopee-icon.png",
  },
  shopee_affiliate: {
    name: "Shopee Affiliate",
    url: "https://affiliate.shopee.co.id",
    icon: "starbox.png",
  },
  tokopedia: {
    name: "Tokopedia",
    url: "https://www.tokopedia.com",
    icon: "starbox.png",
  },
  tokopedia_seller: {
    name: "Tokopedia Seller",
    url: "https://seller.tokopedia.com",
    icon: "starbox.png",
  },
  bukalapak: {
    name: "Bukalapak",
    url: "https://www.bukalapak.com",
    icon: "starbox.png",
  },
  lazada: {
    name: "Lazada",
    url: "https://www.lazada.co.id",
    icon: "starbox.png",
  },
  blibli: {
    name: "Blibli",
    url: "https://www.blibli.com",
    icon: "starbox.png",
  },

  // 📱 Sosial Media
  tiktok: {
    name: "TikTok",
    url: "https://www.tiktok.com/login",
    icon: "starbox.png",
  },
  tiktok_affiliate: {
    name: "TikTok Affiliate",
    url: "https://affiliate.tiktok.com",
    icon: "starbox.png",
  },
  youtube: {
    name: "YouTube",
    url: "https://www.youtube.com",
    icon: "starbox.png",
  },
  youtube_studio: {
    name: "YouTube Studio",
    url: "https://studio.youtube.com",
    icon: "starbox.png",
  },
  facebook: {
    name: "Facebook",
    url: "https://www.facebook.com",
    icon: "starbox.png",
  },
  facebook_pages: {
    name: "Facebook Pages",
    url: "https://business.facebook.com/latest/home",
    icon: "starbox.png",
  },
  instagram: {
    name: "Instagram",
    url: "https://www.instagram.com",
    icon: "starbox.png",
  },
  twitter_x: { name: "Twitter / X", url: "https://x.com", icon: "starbox.png" },
  threads: {
    name: "Threads",
    url: "https://www.threads.net",
    icon: "starbox.png",
  },
  pinterest: {
    name: "Pinterest",
    url: "https://www.pinterest.com",
    icon: "starbox.png",
  },
  linkedin: {
    name: "LinkedIn",
    url: "https://www.linkedin.com",
    icon: "starbox.png",
  },
  snapchat: {
    name: "Snapchat",
    url: "https://web.snapchat.com",
    icon: "starbox.png",
  },
  reddit: {
    name: "Reddit",
    url: "https://www.reddit.com",
    icon: "starbox.png",
  },

  // 🧑‍💻 Developer & IT Tools
  github: { name: "GitHub", url: "https://github.com", icon: "starbox.png" },
  gitlab: { name: "GitLab", url: "https://gitlab.com", icon: "starbox.png" },
  bitbucket: {
    name: "Bitbucket",
    url: "https://bitbucket.org",
    icon: "starbox.png",
  },
  stackoverflow: {
    name: "Stack Overflow",
    url: "https://stackoverflow.com",
    icon: "starbox.png",
  },
  dockerhub: {
    name: "Docker Hub",
    url: "https://hub.docker.com",
    icon: "starbox.png",
  },
  cloudflare: {
    name: "Cloudflare",
    url: "https://dash.cloudflare.com",
    icon: "starbox.png",
  },
  vercel: { name: "Vercel", url: "https://vercel.com", icon: "starbox.png" },
  netlify: {
    name: "Netlify",
    url: "https://app.netlify.com",
    icon: "starbox.png",
  },
  firebase: {
    name: "Firebase Console",
    url: "https://console.firebase.google.com",
    icon: "starbox.png",
  },
  aws: {
    name: "AWS Console",
    url: "https://aws.amazon.com/console",
    icon: "starbox.png",
  },
  digitalocean: {
    name: "DigitalOcean",
    url: "https://cloud.digitalocean.com",
    icon: "starbox.png",
  },

  // 💼 Produktivitas & Kolaborasi
  notion: { name: "Notion", url: "https://www.notion.so", icon: "starbox.png" },
  clickup: {
    name: "ClickUp",
    url: "https://app.clickup.com",
    icon: "starbox.png",
  },
  monday: {
    name: "Monday.com",
    url: "https://monday.com",
    icon: "starbox.png",
  },
  asana: { name: "Asana", url: "https://app.asana.com", icon: "starbox.png" },
  trello: { name: "Trello", url: "https://trello.com", icon: "starbox.png" },
  airtable: {
    name: "Airtable",
    url: "https://airtable.com",
    icon: "starbox.png",
  },
  google_docs: {
    name: "Google Docs",
    url: "https://docs.google.com/document/u/0/",
    icon: "starbox.png",
  },
  google_sheets: {
    name: "Google Sheets",
    url: "https://docs.google.com/spreadsheets/u/0/",
    icon: "starbox.png",
  },
  google_slides: {
    name: "Google Slides",
    url: "https://docs.google.com/presentation/u/0/",
    icon: "starbox.png",
  },
  office_word: {
    name: "Microsoft Word (Online)",
    url: "https://www.office.com/launch/word",
    icon: "starbox.png",
  },
  office_excel: {
    name: "Microsoft Excel (Online)",
    url: "https://www.office.com/launch/excel",
    icon: "starbox.png",
  },
  office_powerpoint: {
    name: "Microsoft PowerPoint (Online)",
    url: "https://www.office.com/launch/powerpoint",
    icon: "starbox.png",
  },
  dropbox_paper: {
    name: "Dropbox Paper",
    url: "https://paper.dropbox.com",
    icon: "starbox.png",
  },
  notion: {
    name: "Notion",
    url: "https://www.notion.so",
    icon: "starbox.png",
  },
  zoho_writer: {
    name: "Zoho Writer",
    url: "https://writer.zoho.com",
    icon: "starbox.png",
  },
  zoho_sheet: {
    name: "Zoho Sheet",
    url: "https://sheet.zoho.com",
    icon: "starbox.png",
  },
  obsidian: {
    name: "Obsidian Publish",
    url: "https://publish.obsidian.md",
    icon: "starbox.png",
  },
  evernote: {
    name: "Evernote",
    url: "https://www.evernote.com/Login.action",
    icon: "starbox.png",
  },
  miro: {
    name: "Miro",
    url: "https://miro.com/app/dashboard",
    icon: "starbox.png",
  },
  figma: { name: "Figma", url: "https://www.figma.com", icon: "starbox.png" },
  google_drive: {
    name: "Google Drive",
    url: "https://drive.google.com",
    icon: "starbox.png",
  },
  google_calendar: {
    name: "Google Calendar",
    url: "https://calendar.google.com",
    icon: "starbox.png",
  },
  google_meet: {
    name: "Google Meet",
    url: "https://meet.google.com",
    icon: "starbox.png",
  },
  zoom: { name: "Zoom", url: "https://app.zoom.us", icon: "starbox.png" },
  dropbox: {
    name: "Dropbox",
    url: "https://www.dropbox.com",
    icon: "starbox.png",
  },
  onedrive: {
    name: "OneDrive",
    url: "https://onedrive.live.com",
    icon: "starbox.png",
  },
  wetransfer: {
    name: "WeTransfer",
    url: "https://wetransfer.com",
    icon: "starbox.png",
  },
  mega: { name: "Mega", url: "https://mega.nz", icon: "starbox.png" },

  // 📈 Marketing & Analitik
  google_analytics: {
    name: "Google Analytics",
    url: "https://analytics.google.com",
    icon: "starbox.png",
  },
  meta_business: {
    name: "Meta Business Suite",
    url: "https://business.facebook.com",
    icon: "starbox.png",
  },
  tiktok_ads: {
    name: "TikTok Ads Manager",
    url: "https://ads.tiktok.com",
    icon: "starbox.png",
  },
  google_ads: {
    name: "Google Ads",
    url: "https://ads.google.com",
    icon: "starbox.png",
  },
  mailchimp: {
    name: "Mailchimp",
    url: "https://mailchimp.com",
    icon: "starbox.png",
  },
  buffer: { name: "Buffer", url: "https://buffer.com", icon: "starbox.png" },
  hootsuite: {
    name: "Hootsuite",
    url: "https://www.hootsuite.com",
    icon: "starbox.png",
  },
  ahrefs: { name: "Ahrefs", url: "https://ahrefs.com", icon: "starbox.png" },
  activecampaign: {
    name: "ActiveCampaign",
    url: "https://www.activecampaign.com/login",
    icon: "starbox.png",
  },

  // 🎨 Desain & Kreativitas
  canva: { name: "Canva", url: "https://www.canva.com", icon: "starbox.png" },
  fotor: { name: "Fotor", url: "https://www.fotor.com", icon: "starbox.png" },
  pixlr: { name: "Pixlr", url: "https://pixlr.com", icon: "starbox.png" },
  removebg: {
    name: "Remove.bg",
    url: "https://www.remove.bg",
    icon: "starbox.png",
  },
  photopea: {
    name: "Photopea",
    url: "https://www.photopea.com",
    icon: "starbox.png",
  },
  capcut: {
    name: "CapCut Web",
    url: "https://www.capcut.com",
    icon: "starbox.png",
  },
  adobe_express: {
    name: "Adobe Express",
    url: "https://www.adobe.com/express",
    icon: "starbox.png",
  },

  // 📧 Email
  gmail: { name: "Gmail", url: "https://mail.google.com", icon: "starbox.png" },

  // 📞 Call Center
  aircall: { name: "Aircall", url: "https://dashboard.aircall.io", icon: "starbox.png" },

  // 🗺️ Produk & Roadmap
  aha: { name: "Aha!", url: "https://www.aha.io", icon: "starbox.png" },

  // 📢 Social Media Management
  agorapulse: { name: "Agorapulse", url: "https://app.agorapulse.com", icon: "starbox.png" },

  // 📊 Analitik Enterprise
  adobe_analytics: { name: "Adobe Analytics", url: "https://experiencecloud.adobe.com", icon: "starbox.png" },

  // 🧩 Infrastruktur & Monitoring
  uptimerobot: {
    name: "UptimeRobot",
    url: "https://uptimerobot.com",
    icon: "starbox.png",
  },
  patch: { name: "Patch", url: "https://patch.com", icon: "starbox.png" },

  // 💻 Emulator Lokal
  android: {
    name: "Android Emulator",
    url: "android-emulator.html",
    icon: "starbox.png",
    isLocalFile: true,
  },

  // 🧭 Default / Custom URL
  other: { name: "Website Kustom", url: "", icon: "starbox.png" },
};

let services = { ...defaultServices };
let cachedServiceCatalog = [];

function sanitizeServiceSlug(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeServiceUrl(value) {
  if (!value) return "";
  return value.toString().trim().replace(/\/+$/, "").toLowerCase();
}

async function refreshServicesFromServer() {
  const endpoint = `${DEFAULT_API_BASE_URL}/api/services`;
  let applied = 0;
  const seenUrls = new Set();

  try {
    logConsoleOnly("🌐 Memuat daftar layanan dari server:", endpoint);
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    cachedServiceCatalog = items;
    if (!items.length) {
      console.log("ℹ️ Respons layanan kosong, memakai daftar bawaan.");
      services = { ...defaultServices };
      return;
    }

    const nextServices = { ...defaultServices };

    items
      .filter((item) => item && item.is_active !== false)
      .forEach((item) => {
        const slug = sanitizeServiceSlug(item.slug || item.id || item.name);
        const serviceUrl = (item.url || "").trim();
        if (!slug || !serviceUrl) return;

        const normalizedUrl = normalizeServiceUrl(serviceUrl);
        if (normalizedUrl && seenUrls.has(normalizedUrl)) {
          console.log(`ℹ️ Melewati layanan dengan URL duplikat: ${serviceUrl}`);
          return;
        }

        if (normalizedUrl) {
          seenUrls.add(normalizedUrl);
        }

        const baseConfig = defaultServices[slug] || {};
        const isLocal = Boolean(baseConfig.isLocalFile);

        nextServices[slug] = {
          ...baseConfig,
          name: item.name || baseConfig.name || slug,
          url: isLocal ? baseConfig.url : serviceUrl || baseConfig.url || "",
          icon: baseConfig.icon || "starbox.png",
          description: item.description || baseConfig.description,
          category: item.category || baseConfig.category,
          meta: item.meta || baseConfig.meta || null,
          sortOrder: item.sort_order ?? baseConfig.sortOrder ?? null,
          isLocalFile: baseConfig.isLocalFile || false,
        };
        applied += 1;
      });

    services = nextServices;
    console.log(
      `✅ Sinkron layanan selesai (${applied} layanan server diterapkan).`
    );
  } catch (err) {
    services = { ...defaultServices };
    cachedServiceCatalog = [];
    console.error(
      "⚠️ Gagal memuat layanan dari server, menggunakan daftar bawaan.",
      err?.message || err
    );
  }
}

// Global paths (will be initialized after app is ready)
let userDataPath = null;
let DB_PATH = null;
let ANDROID_REMOTE_DB_PATH = null;

// Manager instances
let androidManager = null;
let iosManager = null;
let cctvManager = null;

const deviceWindows = {}; // Untuk melacak window yang terbuka
const monitorWindows = {}; // Untuk melacak window monitor automasi
let webHubWindow = null; // Single hub window untuk web devices (Rambox-style tabs)
const hubDevices = new Map(); // uid -> tabData untuk devices yang berjalan di hub
const hubWebViews = new Map(); // uid -> BrowserView konten device di Web Hub
const hubSidePanelViews = new Map(); // uid -> BrowserView untuk side panel (TikTok control, WA monitor)
let hubActiveTabUid = null;
let hubLayoutMode = 'single'; // current layout mode sent by renderer
const HUB_TABBAR_HEIGHT = 38;
// Gunakan machine ID sebagai client ID stabil agar tidak duplicate tiap restart
const _stableRemoteClientId = (() => {
  try {
    const { machineIdSync: _mid } = require("node-machine-id");
    const mid = _mid().replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
    const host = require("os").hostname().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 16);
    return `sb-${host}-${mid}`;
  } catch {
    return `sb-${require("os").hostname().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20)}-fallback`;
  }
})();
const remoteClient = new RemoteClient({ clientId: _stableRemoteClientId }); // Remote control antar StarBox instance
const remoteMonitorWindows = new Map(); // key: `${toClientId}::${uid}` -> BrowserWindow
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
const tiktokControlWindows = new Map();
const tiktokAutomationState = new Map();
const DEFAULT_TIKTOK_AUTOMATION_STATE = Object.freeze({
  autoLike: false,
  autoComment: false,
  commentText: "Mantap videonya!",
  likeIntervalMs: 5000,
  commentIntervalMs: 60000,
  likeMode: "interval", // interval | burst
  burstDurationMs: 30000,
  burstRestMs: 20000,
  likeMaxDurationMs: null,
  commentMaxDurationMs: null,
  commentPool: [],
  commentIndex: 0,
  commentSentCount: 0,
});
const TIKTOK_BURST_SPAM_INTERVAL_MS = 120;
const scrcpySessions = new Map();
const ANDROID_REMOTE_SHORTCUTS = Object.freeze({
  "wake-screen": { label: "Bangunkan layar", type: "wake" },
  "select-all": { label: "Select All (Ctrl + A)", type: "selectAll" },
  copy: { label: "Copy (Ctrl + C)", type: "keyevent", code: 278 },
  paste: { label: "Paste (Ctrl + V)", type: "keyevent", code: 279 },
  cut: { label: "Cut (Ctrl + X)", type: "keyevent", code: 277 },
  enter: { label: "Enter", type: "keyevent", code: 66 },
  backspace: { label: "Backspace", type: "keyevent", code: 67 },
  tab: { label: "Tab", type: "keyevent", code: 61 },
  sleep: { label: "Sleep", type: "keyevent", code: 223 },
  "volume-up": { label: "Volume Up", type: "keyevent", code: 24 },
  "volume-down": { label: "Volume Down", type: "keyevent", code: 25 },
});

function isCommandAvailable(command = "") {
  if (!command) return false;
  const binary = process.platform === "win32" ? "where" : "which";
  try {
    const result = spawnSync(binary, [command], {
      stdio: "ignore",
    });
    return result.status === 0;
  } catch (err) {
    return false;
  }
}

function getBrewExecutable() {
  // Cari brew di PATH atau di lokasi default install Mac
  if (isCommandAvailable("brew")) return "brew";
  const candidates = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch (_) {
      // continue
    }
  }
  return null;
}

function resolveScrcpyBinary() {
  // Windows needs .exe extension and different paths
  const platform = process.platform;
  const isWindows = platform === "win32";
  const scrcpyCmd = isWindows ? "scrcpy.exe" : "scrcpy";

  // On Windows, try to get full path from 'where' command first
  if (isWindows) {
    try {
      const result = spawnSync("where", ["scrcpy"], {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      });
      if (result.status === 0 && result.stdout) {
        // where returns multiple paths, take the first one
        const paths = result.stdout.trim().split("\n").filter(Boolean);
        if (paths.length > 0) {
          const firstPath = paths[0].trim().replace(/\r/g, "");
          if (fs.existsSync(firstPath)) {
            return firstPath;
          }
        }
      }
    } catch (_) {
      // Continue to manual search
    }
  }

  // Check if scrcpy is in PATH
  if (isCommandAvailable("scrcpy")) return scrcpyCmd;

  // Windows-specific paths
  if (isWindows) {
    const candidates = [
      // Chocolatey
      "C:\\ProgramData\\chocolatey\\bin\\scrcpy.exe",
      // winget / manual install
      "C:\\Program Files\\scrcpy\\scrcpy.exe",
      "C:\\Program Files (x86)\\scrcpy\\scrcpy.exe",
      // User local
      path.join(os.homedir(), "scoop", "apps", "scrcpy", "current", "scrcpy.exe"),
      path.join(os.homedir(), "AppData", "Local", "scrcpy", "scrcpy.exe"),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch (_) {
        // continue
      }
    }
  } else {
    // Unix/macOS paths
    const candidates = [
      "/opt/homebrew/bin/scrcpy",
      "/usr/local/bin/scrcpy",
      "/usr/bin/scrcpy",
    ];
    for (const candidate of candidates) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch (_) {
        // continue
      }
    }
  }

  return null;
}

function isScrcpyInstalled() {
  try {
    const scrcpyBin = resolveScrcpyBinary();
    if (!scrcpyBin) return false;
    const result = spawnSync(scrcpyBin, ["--version"], {
      stdio: "ignore",
    });
    return result.status === 0;
  } catch (err) {
    return false;
  }
}

function detectScrcpyInstaller() {
  const platform = process.platform;
  if (platform === "darwin") {
    const brewBin = getBrewExecutable();
    if (brewBin) {
      return {
        supported: true,
        command: brewBin,
        args: ["install", "scrcpy"],
        label: "Homebrew",
      };
    }
    return {
      supported: false,
      reason:
        "Homebrew tidak ditemukan. Pastikan Homebrew terpasang (biasanya di /opt/homebrew/bin/brew atau /usr/local/bin/brew) lalu jalankan 'brew install scrcpy'.",
    };
  }
  if (platform === "win32") {
    if (isCommandAvailable("choco")) {
      return {
        supported: true,
        command: "choco",
        args: ["install", "scrcpy", "-y"],
        label: "Chocolatey",
      };
    }
    if (isCommandAvailable("winget")) {
      return {
        supported: true,
        command: "winget",
        args: [
          "install",
          "--id",
          "Genymobile.scrcpy",
          "-e",
          "--accept-source-agreements",
          "--accept-package-agreements",
        ],
        label: "winget",
      };
    }
    return {
      supported: false,
      reason:
        "Chocolatey atau winget tidak ditemukan. Install salah satunya atau pasang scrcpy manual dari https://github.com/Genymobile/scrcpy.",
    };
  }
  if (platform === "linux") {
    return {
      supported: false,
      reason:
        "Instalasi otomatis scrcpy belum tersedia di Linux. Gunakan manajer paket distro Anda (apt, snap, pacman, dll).",
    };
  }
  return {
    supported: false,
    reason: "Platform ini belum mendukung instalasi otomatis scrcpy.",
  };
}

function runScrcpyInstallerCommand(installer, onProgress) {
  const emitProgress = (percent, message) => {
    if (typeof onProgress !== "function") return;
    try {
      onProgress({
        percent,
        message,
        installer: installer.label || installer.command,
      });
    } catch (_) {
      // ignore
    }
  };
  return new Promise((resolve, reject) => {
    const proc = spawn(installer.command, installer.args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    emitProgress(10, `Menjalankan ${installer.label || installer.command}...`);
    if (proc.stdout) {
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
        emitProgress(50, "Mengunduh / memasang scrcpy...");
      });
    }
    if (proc.stderr) {
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
        emitProgress(
          65,
          "Memeriksa hasil instalasi... (log installer diterima)"
        );
      });
    }
    proc.once("error", (err) => reject(err));
    proc.once("close", (code) => {
      if (code === 0) {
        emitProgress(100, "Instalasi selesai");
        resolve({ stdout, stderr });
      } else {
        const message =
          stderr.trim() ||
          stdout.trim() ||
          `Perintah ${installer.command} keluar dengan kode ${code}.`;
        reject(new Error(message));
      }
    });
  });
}

async function installScrcpyAutomatically(onProgress) {
  const installer = detectScrcpyInstaller();
  if (!installer || installer.supported === false) {
    const error = new Error(
      installer?.reason ||
        "Installer otomatis scrcpy tidak tersedia di platform ini."
    );
    error.code = "SCRCPY_INSTALLER_UNAVAILABLE";
    throw error;
  }
  if (typeof onProgress === "function") {
    onProgress({
      percent: 5,
      message: "Menyiapkan installer scrcpy...",
      installer: installer.label || installer.command,
    });
  }
  await runScrcpyInstallerCommand(installer, onProgress);
}

async function sendAndroidKeyevent(adbId, keyCode, options = {}) {
  if (!adbId || keyCode === undefined || keyCode === null) return;
  const manager = ensureAndroidManagerReady();
  const args = ["-s", adbId, "shell", "input", "keyevent"];
  if (options.longPress) {
    args.push("--longpress");
  }
  const value =
    typeof keyCode === "number"
      ? String(keyCode)
      : String(keyCode || "").toUpperCase();
  args.push(value);
  await manager.runAdbCommand(args, {
    timeout: options.timeout || 6000,
    silent: true,
  });
  if (options.delayAfter) {
    await sleep(options.delayAfter);
  }
}

async function sendAndroidSwipe(adbId, from = {}, to = {}, duration = 250) {
  if (!adbId) return;
  const manager = ensureAndroidManagerReady();
  const startX = from.x ?? Math.round(to.x ?? 540);
  const startY = from.y ?? Math.round(to.y ?? 1600);
  const endX = to.x ?? startX;
  const endY = to.y ?? Math.round(startY / 2);
  await manager.runAdbCommand(
    [
      "-s",
      adbId,
      "shell",
      "input",
      "swipe",
      String(startX),
      String(startY),
      String(endX),
      String(endY),
      String(Math.max(duration, 80)),
    ],
    { timeout: 8000, silent: true }
  );
}

async function isDeviceShowingLockscreen(adbId) {
  if (!adbId) return null;
  const manager = ensureAndroidManagerReady();
  try {
    const output = await manager.runAdbCommand(
      ["-s", adbId, "shell", "dumpsys", "window", "policy"],
      { timeout: 6000, silent: true }
    );
    const text = String(output || "").toLowerCase();
    if (!text) return null;
    if (
      text.includes("mshowinglockscreen=true") ||
      text.includes("isstatusbarkeyguard=true") ||
      text.includes("keyguardshowing=true") ||
      text.includes("mdreaminglockscreen=true")
    ) {
      return true;
    }
    if (
      text.includes("mshowinglockscreen=false") ||
      text.includes("isstatusbarkeyguard=false") ||
      text.includes("keyguardshowing=false")
    ) {
      return false;
    }
  } catch (err) {
    console.warn(
      `⚠️ Tidak bisa membaca status lockscreen (${adbId}):`,
      err?.message || err
    );
  }
  return null;
}

async function ensureDeviceScreenAwake(adbId) {
  if (!adbId) return;
  let isLocked = null;
  try {
    isLocked = await isDeviceShowingLockscreen(adbId);
  } catch (err) {
    console.warn(
      `⚠️ Gagal mendeteksi status lockscreen (${adbId}):`,
      err?.message || err
    );
  }
  try {
    await sendAndroidKeyevent(adbId, 224, { delayAfter: 160 }); // KEYCODE_WAKEUP
  } catch (err) {
    console.warn(
      `⚠️ Tidak bisa mengirim WAKEUP ke ${adbId}:`,
      err?.message || err
    );
  }
  // Skip aggressive unlock gestures when device sudah tidak di lockscreen
  if (isLocked === false) {
    return;
  }
  try {
    await sendAndroidKeyevent(adbId, 82, { delayAfter: 140 }); // KEYCODE_MENU
  } catch (err) {
    console.warn(
      `⚠️ Tidak bisa mengirim MENU ke ${adbId}:`,
      err?.message || err
    );
  }
  try {
    const { width, height } = await getDeviceDisplayMetrics(adbId);
    const x = Math.round(width / 2);
    const startY = Math.round(height * 0.72);
    const endY = Math.round(height * 0.28);
    // Faster, shorter swipe to avoid gesture-nav drifting into Recent Apps
    await sendAndroidSwipe(adbId, { x, y: startY }, { x, y: endY }, 180);
  } catch (err) {
    console.warn(`⚠️ Swipe unlock gagal untuk ${adbId}:`, err?.message || err);
  }
}

async function triggerAndroidSelectAll(adbId) {
  if (!adbId) return;
  const manager = ensureAndroidManagerReady();
  try {
    const { width, height } = await getDeviceDisplayMetrics(adbId);
    const x = Math.max(Math.round(width / 2), 200);
    const y = Math.max(Math.round(height * 0.45), 200);
    await manager.runAdbCommand(
      [
        "-s",
        adbId,
        "shell",
        "input",
        "swipe",
        String(x),
        String(y),
        String(x),
        String(y),
        "550",
      ],
      { timeout: 8000, silent: true }
    );
    await sleep(380);
    await sendAndroidKeyevent(adbId, 19, { delayAfter: 120 }).catch(() => {}); // DPAD_UP
    await sendAndroidKeyevent(adbId, 66, { delayAfter: 80 }).catch(() => {}); // ENTER
  } catch (err) {
    console.warn(
      `⚠️ Select-all fallback gagal (${adbId}):`,
      err?.message || err
    );
    throw new Error(
      "Tidak bisa menjalankan Select All otomatis. Coba pilih teks secara manual."
    );
  }
}

async function runAndroidShortcutCommand(uid, shortcutId) {
  const shortcut = ANDROID_REMOTE_SHORTCUTS[shortcutId];
  if (!shortcut) {
    throw new Error("Shortcut tidak dikenal.");
  }
  const record = findAndroidRemoteDevice(uid);
  if (!record) {
    throw new Error("Device Android tidak ditemukan.");
  }
  const adbId = record.adbId;
  if (!adbId) {
    throw new Error("Device tidak memiliki ADB ID.");
  }
  switch (shortcut.type) {
    case "wake":
      await ensureDeviceScreenAwake(adbId);
      return `${shortcut.label} berhasil dijalankan.`;
    case "selectAll":
      await triggerAndroidSelectAll(adbId);
      return "Perintah Select All dikirim.";
    case "keyevent":
      await sendAndroidKeyevent(adbId, shortcut.code);
      return `${shortcut.label} dijalankan.`;
    default:
      throw new Error("Shortcut ini belum didukung.");
  }
}

async function captureAndroidScreenshot(uid, destinationPath = null) {
  const record = findAndroidRemoteDevice(uid);
  if (!record) {
    throw new Error("Device Android tidak ditemukan.");
  }
  const adbId = record.adbId;
  if (!adbId) {
    throw new Error("Device tidak memiliki ADB ID.");
  }
  const manager = ensureAndroidManagerReady();
  const timestamp = Date.now();
  const remotePath = `/sdcard/Download/starbox_screenshot_${timestamp}.png`;
  await manager.runAdbCommand(
    ["-s", adbId, "shell", "screencap", "-p", remotePath],
    { timeout: 20000, silent: true }
  );
  const safeAdbId = String(adbId || uid)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .toLowerCase();
  const tempDir = path.join(os.tmpdir(), "starbox-screenshots");
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, `${safeAdbId}-${timestamp}.png`);
  await manager.runAdbCommand(["-s", adbId, "pull", remotePath, tempPath], {
    timeout: 20000,
    silent: true,
  });
  await manager
    .runAdbCommand(["-s", adbId, "shell", "rm", remotePath], {
      timeout: 8000,
      silent: true,
    })
    .catch(() => {});
  if (destinationPath) {
    fs.copyFileSync(tempPath, destinationPath);
    return { path: destinationPath };
  }
  return { path: tempPath };
}

const MAX_WIFI_SCAN_TARGETS = 256;

function isPrivateIPv4Address(ip = "") {
  if (typeof ip !== "string") return false;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  const match = ip.match(/^172\.(\d+)\./);
  if (match) {
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function parseArpTableOutput(output = "") {
  const candidates = new Set();
  if (!output) return candidates;
  const matches = output.match(/(\d{1,3}(?:\.\d{1,3}){3})/g) || [];
  matches.forEach((ip) => {
    if (isPrivateIPv4Address(ip)) {
      candidates.add(ip);
    }
  });
  return candidates;
}

function collectArpCandidates() {
  const entries = new Set();
  const commands = [
    { cmd: "arp", args: ["-a"] },
    { cmd: "arp", args: ["-an"] },
  ];
  if (process.platform === "linux") {
    commands.push({ cmd: "ip", args: ["neighbor"] });
  }
  commands.forEach(({ cmd, args }) => {
    try {
      const result = spawnSync(cmd, args, {
        encoding: "utf8",
        windowsHide: true,
      });
      if (result.stdout) {
        parseArpTableOutput(result.stdout).forEach((ip) => entries.add(ip));
      }
    } catch (err) {
      console.warn(`⚠️ Gagal menjalankan ${cmd}:`, err?.message || err);
    }
  });
  return entries;
}

function collectInterfaceNeighborCandidates() {
  const neighbors = new Set();
  const interfaces = os.networkInterfaces() || {};
  Object.values(interfaces).forEach((infos = []) => {
    infos.forEach((info = {}) => {
      if (info.family !== "IPv4" || info.internal) return;
      const address = info.address;
      if (!isPrivateIPv4Address(address)) return;
      const parts = address.split(".");
      if (parts.length !== 4) return;
      const base = parts.slice(0, 3).join(".");
      const last = Number(parts[3]);
      const hostRange = [];
      for (let host = 2; host <= 254; host += 1) {
        const candidate = `${base}.${host}`;
        if (candidate === address) continue;
        hostRange.push(candidate);
      }
      hostRange.forEach((ip) => neighbors.add(ip));
    });
  });
  return neighbors;
}

function ipToSortableNumber(ip = "") {
  return ip
    .split(".")
    .map((part) => Number(part) || 0)
    .reduce((acc, part) => (acc << 8) + part, 0);
}

function getWifiScanCandidates() {
  const combined = new Set();
  collectArpCandidates().forEach((ip) => combined.add(ip));
  collectInterfaceNeighborCandidates().forEach((ip) => combined.add(ip));
  combined.delete("127.0.0.1");
  const ordered = Array.from(combined)
    .filter(isPrivateIPv4Address)
    .sort((a, b) => ipToSortableNumber(a) - ipToSortableNumber(b));
  return ordered.slice(0, MAX_WIFI_SCAN_TARGETS);
}

function probeAdbPort(ip, port = 5555, timeout = 1200) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = nodeNet.createConnection({
      host: ip,
      port,
      timeout,
    });
    const finalize = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));
    socket.unref();
  });
}

/**
 * Quick check if an IP is alive by testing common ports
 * Returns true if ANY port responds within timeout
 */
async function isIpAlive(ip, timeout = 200) {
  // Common ports termasuk ADB wireless ports yang sering dipakai
  const commonPorts = [
    // Standard ports
    22, 80, 443, 8080,
    // ADB wired & emulator
    5555, 5556, 5557,
    // ADB wireless common ports (sampling dari range 30000-49999)
    37229, 37121, 40000, 43211, 43393, 45000, 47233, 49555,
  ];
  const probes = commonPorts.map((port) =>
    probeAdbPort(ip, port, timeout).catch(() => false)
  );
  const results = await Promise.all(probes);
  return results.some((r) => r === true);
}

async function scanLocalWifiForAdbDevices(
  emitProgress = true,
  scanMode = "quick"
) {
  const manager = ensureAndroidManagerReady();
  const allCandidates = getWifiScanCandidates();
  const connected = [];
  let scannedCount = 0;
  let index = 0;
  const concurrency = Math.min(20, Math.max(2, allCandidates.length)); // Increased concurrency for deep scan

  let candidates = allCandidates;

  // PRE-FILTER: Only for QUICK scan mode (deep scan needs to be comprehensive)
  if (scanMode === "quick") {
    logDev(
      `\n🔍 [WiFi Scan] Pre-filtering: Checking ${allCandidates.length} IPs untuk yang aktif...`
    );

    const aliveCheckPromises = allCandidates.map((ip) =>
      isIpAlive(ip, 150).then((alive) => ({ ip, alive }))
    );
    const aliveResults = await Promise.all(aliveCheckPromises);
    candidates = aliveResults.filter((r) => r.alive).map((r) => r.ip);

    const skippedCount = allCandidates.length - candidates.length;
    logDev(
      `✅ [WiFi Scan] Pre-filter complete: ${candidates.length} aktif, ${skippedCount} di-skip`
    );

    if (candidates.length === 0) {
      logDev(`⚠️ [WiFi Scan] Tidak ada IP yang responding, scan dibatalkan`);
      return { success: true, connected: [], scanned: allCandidates.length };
    }
  } else {
    logDev(
      `\n🔍 [WiFi Scan] DEEP MODE: Scanning semua ${allCandidates.length} IPs (no pre-filter)`
    );
  }

  // Common ADB wireless ports to check
  let portsToCheck = [];

  if (scanMode === "deep") {
    // DEEP SCAN: Full range 30000-49999 (step 2 untuk kecepatan)
    logDev(`🔍 [WiFi Scan] Mode: DEEP SCAN (range 30000-49999 step 2)`);
    for (let p = 30000; p <= 49999; p += 2) {
      portsToCheck.push(p);
    }
  } else {
    // QUICK SCAN: Port umum yang sering dipakai (default)
    logDev(`🔍 [WiFi Scan] Mode: QUICK SCAN (curated ports)`);
    portsToCheck = [
      // klasik
      5555, 5556, 5557, 5558, 5559, 5560,

      // emulator
      5554, 5556, 5558,

      // vendor ports
      37229, 37121, 37881, 37777,

      // wireless debugging common
      37000, 37219, 37453, 39129, 39797, 40000, 40311, 40901, 43211, 43381,
      45000, 46101, 47233, 48651, 49555, 49857,

      // your device found port
      36535,
    ];
  }

  logDev(`\n🔍 [WiFi Scan] Memulai scan WiFi untuk ADB devices`);
  logDev(`📊 [WiFi Scan] Total IP candidates: ${candidates.length}`);
  logDev(`🔧 [WiFi Scan] Concurrency: ${concurrency}`);
  logDev(`🔌 [WiFi Scan] Ports to check: ${portsToCheck.join(", ")}`);
  logDev(
    `📋 [WiFi Scan] IP list:\n   ${candidates.slice(0, 10).join(", ")}${
      candidates.length > 10 ? ` ... (+${candidates.length - 10} more)` : ""
    }\n`
  );

  // Send initial progress to main window
  if (emitProgress) {
    const mainWin = BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && w.webContents
    );
    if (mainWin) {
      mainWin.webContents.send("adb-wifi-scan-progress", {
        progress: 0,
        scannedCount: 0,
        totalCount: candidates.length,
        foundDevices: [],
      });
    }
  }

  // Adjust timeout based on scan mode (shorter for deep scan to speed things up)
  const portTimeout = scanMode === "deep" ? 400 : 800;

  const worker = async () => {
    while (index < candidates.length) {
      const currentIndex = index;
      index += 1;
      const ip = candidates[currentIndex];
      if (!ip) break;

      scannedCount++;
      const progress = Math.round((scannedCount / candidates.length) * 100);

      logDev(
        `🔎 [${progress}%] Scanning ${ip} on ${portsToCheck.length} ports (${scannedCount}/${candidates.length})`
      );

      const reachablePorts = [];

      // Check ALL ports for this IP (don't break after first one)
      for (const port of portsToCheck) {
        try {
          const reachable = await probeAdbPort(ip, port, portTimeout);
          if (reachable) {
            logDev(`   ✅ Port ${port} reachable on ${ip}`);
            reachablePorts.push(port);
            // Continue checking other ports instead of breaking
          }
        } catch (err) {
          // Port not reachable, continue to next port
        }
      }

      if (reachablePorts.length === 0) {
        logDev(`   ⏭  No ADB ports reachable on ${ip}, skipping`);
        continue;
      }

      logDev(
        `   🎯 Found ${
          reachablePorts.length
        } reachable port(s) on ${ip}: ${reachablePorts.join(", ")}`
      );

      // Try to connect to ALL found ports
      for (const port of reachablePorts) {
        try {
          logDev(`   🔌 Attempting ADB connect to ${ip}:${port}...`);
          const output = await manager.runAdbCommand(
            ["connect", `${ip}:${port}`],
            { timeout: 8000, silent: true }
          );

          logDev(`   📤 ADB response: ${output.trim()}`);

          if (
            /connected to/i.test(output) ||
            /already connected/i.test(output)
          ) {
            const deviceId = `${ip}:${port}`;
            connected.push(deviceId);
            logDev(`   ✅ SUCCESS! Connected to ${deviceId}`);

            // Emit real-time progress with found device
            if (emitProgress) {
              const mainWin = BrowserWindow.getAllWindows().find(
                (w) => !w.isDestroyed() && w.webContents
              );
              if (mainWin) {
                mainWin.webContents.send("adb-wifi-scan-progress", {
                  progress,
                  scannedCount,
                  totalCount: candidates.length,
                  foundDevices: [...connected],
                  newDevice: deviceId,
                });
              }
            }
          } else {
            logDev(`   ❌ Connection failed: ${output.trim()}`);
          }
        } catch (err) {
          warnDev(
            `   ⚠️  adb connect ke ${ip}:${port} gagal:`,
            err?.message || err
          );
        }
      }
    }
  };

  const tasks = Array.from({ length: concurrency }, () => worker());
  await Promise.all(tasks);

  logDev(`\n✅ [WiFi Scan] Selesai!`);
  logDev(
    `📊 [WiFi Scan] Total scanned: ${candidates.length} IPs x ${portsToCheck.length} ports`
  );
  logDev(`🎯 [WiFi Scan] Connected: ${connected.length}`);
  if (connected.length > 0) {
    logDev(`📱 [WiFi Scan] Connected devices: ${connected.join(", ")}\n`);
  } else {
    logDev(`❌ [WiFi Scan] No ADB devices found via WiFi\n`);
  }

  // Send final completion event
  if (emitProgress) {
    const mainWin = BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && w.webContents
    );
    if (mainWin) {
      mainWin.webContents.send("adb-wifi-scan-progress", {
        progress: 100,
        scannedCount: candidates.length,
        totalCount: candidates.length,
        foundDevices: [...connected],
        completed: true,
      });
    }
  }

  return {
    scanned: candidates.length,
    connected,
  };
}

const CHROME_DEBUG_PORT_BASE = 15000;
const CHROME_DEBUG_PORT_RANGE = 1000;

function computeStringHash(value = "") {
  let hash = 0;
  const str = String(value || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function getChromeDebugPort(uid) {
  const hash = computeStringHash(uid || "default");
  return CHROME_DEBUG_PORT_BASE + (hash % CHROME_DEBUG_PORT_RANGE);
}

function resolveWindowMetrics(mode = "desktop") {
  const normalizedMode = (mode || "desktop").toLowerCase();
  const metrics = {
    width: 1000,
    height: 700,
  };
  switch (normalizedMode) {
    case "tablet-ipad":
      metrics.width = 768;
      metrics.height = 1024;
      break;
    case "tablet-ipad-pro":
      metrics.width = 834;
      metrics.height = 1194;
      break;
    case "tablet-ipad-pro-13":
      metrics.width = 1024;
      metrics.height = 1366;
      break;
    case "tablet-android":
      metrics.width = 800;
      metrics.height = 1280;
      break;
    case "tablet-samsung":
      metrics.width = 1600;
      metrics.height = 2560;
      break;
    case "desktop":
      metrics.width = 1000;
      metrics.height = 700;
      break;
    case "desktop-mini":
      metrics.width = 800;
      metrics.height = 600;
      break;
    case "desktop-hd":
      metrics.width = 1366;
      metrics.height = 768;
      break;
    case "desktop-full-hd":
      metrics.width = 1920;
      metrics.height = 1080;
      break;
    case "desktop-2k":
      metrics.width = 2560;
      metrics.height = 1440;
      break;
    case "desktop-wide":
      metrics.width = 1280;
      metrics.height = 800;
      break;
    case "desktop-ultrawide":
      metrics.width = 2560;
      metrics.height = 1080;
      break;
    case "desktop-4k":
      metrics.width = 3840;
      metrics.height = 2160;
      break;
    case "mobile-browser-desktop":
    case "compact":
    case "square":
    case "portrait":
    case "landscape":
      if (normalizedMode === "compact") {
        metrics.width = 600;
        metrics.height = 400;
      } else if (normalizedMode === "square") {
        metrics.width = 700;
        metrics.height = 700;
      } else if (normalizedMode === "portrait") {
        metrics.width = 600;
        metrics.height = 900;
      } else if (normalizedMode === "landscape") {
        metrics.width = 900;
        metrics.height = 600;
      } else if (normalizedMode === "mobile-browser-desktop") {
        metrics.width = 480;
        metrics.height = 700;
      }
      break;
    case "mobile-iphone":
      metrics.width = 390;
      metrics.height = 844;
      break;
    case "mobile-iphone-pro":
      metrics.width = 430;
      metrics.height = 932;
      break;
    case "mobile-iphone-se":
      metrics.width = 375;
      metrics.height = 667;
      break;
    case "mobile-android":
      metrics.width = 393;
      metrics.height = 851;
      break;
    case "mobile-galaxy-s8":
      metrics.width = 360;
      metrics.height = 740;
      break;
    case "mobile-galaxy-s23":
      metrics.width = 384;
      metrics.height = 854;
      break;
    case "mobile-pixel-5":
      metrics.width = 393;
      metrics.height = 851;
      break;
    case "mobile-pixel-7":
      metrics.width = 412;
      metrics.height = 915;
      break;
    case "mobile-oneplus":
      metrics.width = 412;
      metrics.height = 869;
      break;
    default:
      break;
  }
  return metrics;
}

function createTimeoutSignal(ms = 1500) {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    try {
      return AbortSignal.timeout(ms);
    } catch {
      // fallback below
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (typeof timer?.unref === "function") {
    timer.unref();
  }
  return controller.signal;
}

function isChromeBlankTarget(target = {}) {
  if (!target) return false;
  const url = String(target.url || "").trim();
  const title = String(target.title || "").trim();
  if (!url) return true;
  if (CHROME_BLANK_TITLE_SET.has(title)) return true;
  if (url.startsWith("devtools://")) return false;
  return CHROME_BLANK_TARGET_PATTERNS.some((regex) => regex.test(url));
}

async function closeChromeTarget(debugPort, targetId) {
  if (!debugPort || !targetId) return;
  try {
    await fetch(`http://127.0.0.1:${debugPort}/json/close/${targetId}`, {
      method: "GET",
      signal: createTimeoutSignal(1500),
    });
    console.log(`🧹 Menutup tab tambahan Chrome (targetId: ${targetId}).`);
  } catch (err) {
    console.warn(
      `⚠️ Gagal menutup target Chrome ${targetId}:`,
      err?.message || err
    );
  }
}

function stopChromeTargetMonitor(uid) {
  const session = chromeSessions[uid];
  if (!session) return;
  if (session.targetMonitor) {
    clearInterval(session.targetMonitor);
    delete session.targetMonitor;
  }
}

function startChromeTargetMonitor(uid, debugPort) {
  stopChromeTargetMonitor(uid);
  if (!debugPort) return;
  const monitor = setInterval(async () => {
    const session = chromeSessions[uid];
    if (!session || session.debugPort !== debugPort) {
      stopChromeTargetMonitor(uid);
      return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, {
        cache: "no-store",
        signal: createTimeoutSignal(1500),
      });
      if (!response.ok) {
        return;
      }
      const targets = await response.json();
      if (!Array.isArray(targets)) {
        return;
      }
      const blankTargets = [];
      let hasVisiblePage = false;
      targets.forEach((target) => {
        if (
          target.type !== "page" &&
          target.type !== "app" &&
          target.type !== "tab"
        ) {
          return;
        }
        if (isChromeBlankTarget(target)) {
          blankTargets.push(target);
          return;
        }
        if (target.url && !target.url.startsWith("devtools://")) {
          hasVisiblePage = true;
        }
      });
      if (blankTargets.length) {
        blankTargets.forEach((target) => {
          closeChromeTarget(debugPort, target.id).catch(() => {});
        });
      }
      if (!hasVisiblePage) {
        stopChromeNativeSession(uid);
      }
    } catch (err) {
      if (
        err?.name === "AbortError" ||
        err?.code === "ECONNREFUSED" ||
        err?.code === "ECONNRESET"
      ) {
        stopChromeNativeSession(uid);
      }
    }
  }, 2000);
  const session = chromeSessions[uid];
  if (session) {
    session.targetMonitor = monitor;
  } else {
    clearInterval(monitor);
  }
}

const chromeSessions = {};
const CHROME_PROFILE_DIR_NAME = "chrome-profiles";
const CHROME_EXECUTABLE_CANDIDATES = {
  win32: [
    path.join(
      "C:",
      "Program Files",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe"
    ),
    path.join(
      "C:",
      "Program Files (x86)",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe"
    ),
  ],
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
  linux: [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ],
};

const WHATSAPP_SAMPLE_MESSAGES = [
  "Remote Android berjalan mulus nomor delapan",
  "Almost done pesan ke sembilan dari StarBox",
  "Pesan terakhir nomor sepuluh terima kasih",
];

function resolveChromeExecutablePath() {
  const override =
    process.env.STARBOX_CHROME_PATH ||
    process.env.CHROME_PATH ||
    process.env.CHROME_BIN;
  if (override) {
    return override;
  }
  const candidates = CHROME_EXECUTABLE_CANDIDATES[process.platform] || [];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getChromeProfilesRoot() {
  const envRoot = process.env.STARBOX_CHROME_PROFILE_ROOT;
  if (envRoot && String(envRoot).trim()) {
    return path.resolve(envRoot);
  }
  const homeDir = typeof os.homedir === "function" ? os.homedir() : null;
  if (homeDir) {
    return path.join(homeDir, "starbox", "chrome-sessions");
  }
  if (userDataPath) {
    return path.join(userDataPath, CHROME_PROFILE_DIR_NAME);
  }
  return null;
}

function sanitizeChromeProfileId(uid = "") {
  return (uid || "profile")
    .toString()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
}

function makeChromeProfileDir(uid = "") {
  const root = getChromeProfilesRoot();
  if (!root) return null;
  const profileName = sanitizeChromeProfileId(uid);
  const profileDir = path.join(root, profileName);
  try {
    fs.mkdirSync(profileDir, { recursive: true });
  } catch (err) {
    console.warn(
      `⚠️ Gagal membuat direktori profil Chrome (${profileDir}):`,
      err?.message || err
    );
    return null;
  }
  return profileDir;
}

function resolveChromeNativeTargetUrl(device = {}) {
  const serviceKey = (device.service || "").toLowerCase();
  if (serviceKey === "other") {
    const custom = sanitizeCustomUrl(device.customUrl || "");
    if (custom) return custom;
  }
  const selected = services[serviceKey] || services.other;
  return selected?.url || null;
}

function cleanupChromeNativeSession(uid, options = {}) {
  if (!uid) return;
  if (chromeSessions[uid]) {
    delete chromeSessions[uid];
  }
  if (options.updateStatus) {
    updateDeviceStatus(uid, "stopped");
  }
}

function killProcessTree(pid) {
  if (!pid || typeof pid !== "number") return;
  try {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", `${pid}`, "/T", "/F"]);
      killer.once("error", (err) => {
        if (err) {
          console.warn(
            `⚠️ taskkill gagal untuk PID ${pid}:`,
            err?.message || err
          );
        }
      });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch (err) {
    console.warn(`⚠️ Gagal kill process tree ${pid}:`, err?.message || err);
  }
}

function stopChromeNativeSession(uid) {
  const session = chromeSessions[uid];
  if (!session) return false;
  stopChromeTargetMonitor(uid);
  killProcessTree(session.pid);
  try {
    session.process.kill();
  } catch (err) {
    // ignore, already attempted via group kill
  }
  cleanupChromeNativeSession(uid);
  return true;
}

function launchChromeNativeSession(uid, device = {}) {
  const chromePath = resolveChromeExecutablePath();
  if (!chromePath) {
    throw new Error(
      "Chrome asli tidak ditemukan. Silakan set STARBOX_CHROME_PATH jika perlu."
    );
  }
  const profileDir = makeChromeProfileDir(uid);
  if (!profileDir) {
    throw new Error("Tidak dapat membuat folder profil Chrome.");
  }
  const targetUrl = resolveChromeNativeTargetUrl(device);
  if (!targetUrl) {
    throw new Error("Tidak ada URL valid untuk Chrome native.");
  }
  stopChromeNativeSession(uid);

  const metrics = resolveWindowMetrics(device.mode);
  const debugPort = getChromeDebugPort(uid);
  const profileSlug = sanitizeChromeProfileId(uid);
  const chromeClassName = `starbox-chrome-${profileSlug}`;
  const chromeAppId = `com.starbox.chrome.${profileSlug}`;
  const args = [
    `--user-data-dir=${profileDir}`,
    "--profile-directory=Default",
    `--class=${chromeClassName}`,
    `--app-id=${chromeAppId}`,
    `--app=${targetUrl}`,
    "--no-default-browser-check",
    "--no-first-run",
    "--disable-sync",
    "--disable-default-apps",
    "--disable-background-networking",
    "--disable-background-mode",
    "--disable-component-extensions-with-background-pages",
    "--disable-infobars",
    "--disable-session-crashed-bubble",
    "--disable-backgrounding-occluded-windows",
    "--disable-popup-blocking",
    "--disable-renderer-backgrounding",
    "--disable-features=EnableEphemeralGuestProfiles",
    "--force-device-scale-factor=1",
    "--disable-features=OptimizationGuideModelDownloading",
    "--disable-features=TabHoverCardImages",
    "--disable-features=ChromeWhatsNewUI",
    "--disable-features=ChromeWhatsNewUIForOSUpdate",
    "--disable-features=ChromeLabs",
    "--disable-new-tab-tiling",
    "--disable-features=chrome://flags/#passwords-account-storage",
    "--disable-features=AutofillServerCommunication",
    "--silent-launch",
    "--overscroll-history-navigation=0",
    `--remote-debugging-port=${debugPort}`,
    `--window-size=${metrics.width},${metrics.height}`,
    "--window-position=-32000,-32000",
  ];

  const child = spawn(chromePath, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  chromeSessions[uid] = { process: child, pid: child.pid, debugPort };
  startChromeTargetMonitor(uid, debugPort);

  const cleanup = () => cleanupChromeNativeSession(uid, { updateStatus: true });
  child.once("exit", cleanup);
  child.once("error", (err) => {
    console.error(
      `⚠️ Chrome native (${uid}) mengalami error:`,
      err?.message || err
    );
    cleanup();
  });

  return child;
}

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
  if (!device) return false;
  let modified = false;
  if (device.token) {
    if (!device.uid) {
      device.uid = device.token;
      modified = true;
    }
    delete device.token;
    modified = true;
  }
  if (typeof device.customUrl !== "string") {
    device.customUrl = device.customUrl ? String(device.customUrl) : "";
    modified = true;
  }
  if (device.pendingUrl) {
    const sanitized = sanitizePendingUrl(device.pendingUrl);
    if (sanitized !== device.pendingUrl) {
      device.pendingUrl = sanitized;
      modified = true;
    }
  }
  return modified;
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
    if (ensureAndroidSpec(device)) {
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
    let modified = normalizeDeviceList(data);
    const device =
      data.devices?.find((d) => d.uid === uid || d.token === uid) || null;
    if (device && (device.service || "").toLowerCase() === "android") {
      if (!device.avdName) {
        device.avdName = generateAvdName(device.uid || device.token || "");
        modified = true;
      }
      if (ensureAndroidSpec(device)) {
        modified = true;
      }
    }
    if (modified) {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }
    return device;
  } catch (err) {
    console.warn("⚠️ getDeviceConfig gagal:", err.message);
    return null;
  }
}

function ensureAndroidRemoteDb() {
  if (!ANDROID_REMOTE_DB_PATH) return;
  const dir = path.dirname(ANDROID_REMOTE_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(ANDROID_REMOTE_DB_PATH)) {
    fs.writeFileSync(
      ANDROID_REMOTE_DB_PATH,
      JSON.stringify({ devices: [] }, null, 2)
    );
  }
}

function readAndroidRemoteDevices() {
  ensureAndroidRemoteDb();
  try {
    const raw = fs.readFileSync(ANDROID_REMOTE_DB_PATH, "utf8");
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data?.devices)) {
      const devices = data.devices.map((device) => {
        const next = { ...device };
        if (typeof next.whatsappBaseUrl !== "string") {
          next.whatsappBaseUrl = "";
        }
        if (typeof next.whatsappCallbackUrl !== "string") {
          next.whatsappCallbackUrl = "";
        }
        next.whatsappVariant = sanitizeWhatsappVariant(
          next.whatsappVariant || "consumer"
        );
        return next;
      });
      // if (IS_DEV_BUILD) {
      //   logConsoleOnly("📱 [ADB] devices snapshot:", devices);
      // }
      return devices;
    }
  } catch (err) {
    console.warn("⚠️ Gagal membaca adb-devices.json:", err?.message || err);
  }
  return [];
}

function writeAndroidRemoteDevices(devices = []) {
  ensureAndroidRemoteDb();
  try {
    fs.writeFileSync(
      ANDROID_REMOTE_DB_PATH,
      JSON.stringify({ devices }, null, 2)
    );
  } catch (err) {
    console.warn("⚠️ Gagal menulis adb-devices.json:", err?.message || err);
  }
}

function findAndroidRemoteDevice(uid) {
  if (!uid) return null;
  const devices = readAndroidRemoteDevices();
  return devices.find((device) => device.uid === uid) || null;
}

function sanitizeRemoteServiceId(service = "") {
  return (service || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}

function sanitizeWhatsappVariant(value = "") {
  const normalized = (value || "").toString().toLowerCase().trim();
  if (
    ["business", "bisnis", "w4b", "wa-business", "wa_bisnis", "bussines"].includes(
      normalized
    )
  ) {
    return "business";
  }
  return "consumer";
}

function resolveWhatsappPackageName(variant = "consumer") {
  return sanitizeWhatsappVariant(variant) === "business"
    ? "com.whatsapp.w4b"
    : "com.whatsapp";
}

const androidRemoteActionTokens = new Map();

function beginAndroidRemoteAction(uid) {
  if (!uid) return null;
  const existing = androidRemoteActionTokens.get(uid);
  if (existing) {
    existing.aborted = true;
  }
  const token = { aborted: false, startedAt: Date.now() };
  androidRemoteActionTokens.set(uid, token);
  return token;
}

function cancelAndroidRemoteAction(uid) {
  if (!uid) return false;
  const token = androidRemoteActionTokens.get(uid);
  if (token) {
    token.aborted = true;
    return true;
  }
  return false;
}

function clearAndroidRemoteAction(uid) {
  if (!uid) return;
  androidRemoteActionTokens.delete(uid);
}

function addAndroidRemoteDeviceRecord(payload = {}) {
  const devices = readAndroidRemoteDevices();
  const name = String(
    payload.name || payload.service || "Android Remote"
  ).trim();
  const adbId = String(payload.adbId || "").trim();
  const adbName = payload.adbName ? String(payload.adbName || "").trim() : "";
  const service = sanitizeRemoteServiceId(
    payload.service || "android-whatsapp"
  );
  const whatsappVariant = sanitizeWhatsappVariant(
    payload.whatsappVariant || "consumer"
  );
  if (!adbId) {
    throw new Error("ADB device harus dipilih.");
  }
  const duplicate = devices.find(
    (device) => device.adbId.toLowerCase() === adbId.toLowerCase()
  );
  if (duplicate) {
    throw new Error(
      `ADB ${adbId} sudah terdaftar sebagai ${duplicate.name || duplicate.uid}.`
    );
  }

  const record = {
    uid: uuidv4(),
    name,
    adbId,
    adbName,
    service,
    status: sanitizeRemoteServiceId(payload.status) || "disconnected",
    whatsappBaseUrl: sanitizePendingUrl(payload.whatsappBaseUrl || ""),
    whatsappCallbackUrl: sanitizePendingUrl(payload.whatsappCallbackUrl || ""),
    whatsappVariant,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  devices.push(record);
  writeAndroidRemoteDevices(devices);
  return record;
}

/**
 * Helper: Message Cache Management
 */
function cleanExpiredMessageCache() {
  const now = Date.now();
  for (const [messageId, data] of WHATSAPP_MESSAGE_CACHE.entries()) {
    if (now - data.timestamp > MESSAGE_CACHE_EXPIRY_MS) {
      WHATSAPP_MESSAGE_CACHE.delete(messageId);
      console.log(`🧹 Cleaned expired message from cache: ${messageId}`);
    }
  }
}

function isMessageInCache(messageId) {
  cleanExpiredMessageCache();
  return WHATSAPP_MESSAGE_CACHE.has(messageId);
}

function addMessageToCache(messageId, status = "sending") {
  WHATSAPP_MESSAGE_CACHE.set(messageId, {
    status: status,
    timestamp: Date.now(),
  });
  console.log(`💾 Message added to cache: ${messageId} (${status})`);
}

function updateMessageCacheStatus(messageId, status) {
  if (WHATSAPP_MESSAGE_CACHE.has(messageId)) {
    const data = WHATSAPP_MESSAGE_CACHE.get(messageId);
    data.status = status;
    data.timestamp = Date.now();
    console.log(`🔄 Message cache updated: ${messageId} -> ${status}`);
  }
}

function hasMessagesInProgress() {
  cleanExpiredMessageCache();
  for (const [messageId, data] of WHATSAPP_MESSAGE_CACHE.entries()) {
    if (data.status === "sending") {
      return true;
    }
  }
  return false;
}

function getMessagesInProgress() {
  cleanExpiredMessageCache();
  const inProgress = [];
  for (const [messageId, data] of WHATSAPP_MESSAGE_CACHE.entries()) {
    if (data.status === "sending") {
      inProgress.push(messageId);
    }
  }
  return inProgress;
}

/**
 * Helper: Kirim callback ke API untuk update status pesan
 */
async function sendWhatsappCallback(
  callbackUrl,
  messageId,
  status,
  errorMessage = null
) {
  if (!callbackUrl || !messageId) return;
  try {
    const https = require("https");
    const http = require("http");
    const url = new URL(callbackUrl);
    const payload = { id: messageId, status: status };
    if (errorMessage) {
      payload.error_message = errorMessage;
    }
    const postData = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === "https:" ? https : http;
      const req = protocol.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log(`✅ Callback sent: ${messageId} -> ${status}`);
          resolve({ success: true });
        });
      });
      req.on("error", (err) => {
        console.warn(`⚠️ Callback failed:`, err.message);
        reject(err);
      });
      req.write(postData);
      req.end();
    });
  } catch (err) {
    console.warn(`⚠️ Callback error:`, err.message);
  }
}

/**
 * Helper: Deteksi apakah pesan mengandung emoji atau karakter non-ASCII kompleks
 * Comprehensive coverage: standard emoji, ZWJ sequences, skin tones, flags, keycaps, Unicode 15.0
 */
function hasEmojiOrComplexChars(text) {
  // Comprehensive emoji regex covering ALL Unicode emoji types:
  // - Standard emoji ranges (faces, objects, nature, etc.)
  // - ZWJ sequences (👨‍👩‍👧‍👦, 🤦‍♂️, 👨‍💻)
  // - Skin tone modifiers (👍🏻, 👍🏿)
  // - Regional indicators for flags (🇮🇩, 🇺🇸, 🏳️‍🌈)
  // - Variation selectors (emoji presentation)
  // - Keycap sequences (#️⃣, *️⃣, 0️⃣-9️⃣)
  // - Tag sequences for subdivision flags
  // - Unicode 15.0 additions
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{1F680}-\u{1F6FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|[\u{23F0}]|[\u{23F3}]|[\u{25FD}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2705}]|[\u{270A}-\u{270B}]|[\u{2728}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2795}-\u{2797}]|[\u{27B0}]|[\u{27BF}]|[\u{2B1B}-\u{2B1C}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F236}]|[\u{1F238}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{00A9}]|[\u{00AE}]|[\u{203C}]|[\u{2049}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{2328}]|[\u{23CF}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|\u200D|\uFE0F|[\u{E0020}-\u{E007F}]/u;
  return emojiRegex.test(text);
}

/**
 * Helper: Hapus semua emoji dari text (fallback untuk edge case emoji tidak terdeteksi)
 * Digunakan untuk membersihkan pesan sebelum typing manual agar tidak gagal
 */
function stripEmoji(text) {
  if (!text) return "";
  // Remove ALL emoji using comprehensive regex (with global flag)
  // Replaces undetected emoji with empty string to ensure typing continues normally
  return text.replace(
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{1F680}-\u{1F6FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|[\u{23F0}]|[\u{23F3}]|[\u{25FD}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2705}]|[\u{270A}-\u{270B}]|[\u{2728}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2795}-\u{2797}]|[\u{27B0}]|[\u{27BF}]|[\u{2B1B}-\u{2B1C}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F236}]|[\u{1F238}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{00A9}]|[\u{00AE}]|[\u{203C}]|[\u{2049}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{2328}]|[\u{23CF}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|\u200D|\uFE0F|[\u{E0020}-\u{E007F}]/gu,
    ""
  );
}

/**
 * Helper: Smart split message into chunks for emoji preservation
 * Splits by newline first, then by character limit, max 3 chunks
 * @param {string} text - Message to split
 * @param {number} maxChunkChars - Max characters per chunk (default 250 for safe URL encoding)
 * @param {number} maxChunks - Maximum chunks allowed (default 3)
 * @returns {string[]} Array of message chunks, or null if would exceed maxChunks
 */
function smartSplitMessage(text, maxChunkChars = 250, maxChunks = 3) {
  if (!text) return [text];

  // First split by newlines (natural breaks)
  const lines = text.split("\n");
  const chunks = [];
  let currentChunk = "";

  for (const line of lines) {
    // Check if adding this line would exceed chunk limit
    const testChunk = currentChunk ? `${currentChunk}\n${line}` : line;

    if (testChunk.length <= maxChunkChars) {
      // Fits in current chunk
      currentChunk = testChunk;
    } else {
      // Doesn't fit
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      // Check if single line is too long
      if (line.length > maxChunkChars) {
        // Split long line by words
        const words = line.split(" ");
        for (const word of words) {
          const testWord = currentChunk ? `${currentChunk} ${word}` : word;
          if (testWord.length <= maxChunkChars) {
            currentChunk = testWord;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
          }
        }
      } else {
        currentChunk = line;
      }
    }
  }

  // Push remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // Check if exceeds max chunks limit
  if (chunks.length > maxChunks) {
    console.warn(
      `⚠️ Message would require ${chunks.length} chunks (max: ${maxChunks}), returning null for fallback`
    );
    return null; // Signal to use fallback method
  }

  return chunks.length > 0 ? chunks : [text];
}

async function sendWhatsappSampleMessagesThroughAdb(adbId, options = {}) {
  if (!adbId) throw new Error("ADB ID tidak valid.");
  const manager = ensureAndroidManagerReady();
  const actionToken = options.token || null;
  const messages =
    (Array.isArray(options.messages) && options.messages.length
      ? options.messages
      : WHATSAPP_SAMPLE_MESSAGES) || WHATSAPP_SAMPLE_MESSAGES;
  const phoneNumber = String(options.phoneNumber || "6282234528303").replace(
    /[^\d]/g,
    ""
  );
  const whatsappVariant = sanitizeWhatsappVariant(
    options.whatsappVariant || options.variant
  );
  const whatsappPackage = resolveWhatsappPackageName(whatsappVariant);
  const callbackUrl = options.callbackUrl || null;
  const messageId = options.messageId || null;
  if (!phoneNumber) {
    throw new Error("Nomor tujuan WhatsApp tidak valid.");
  }
  await ensureDeviceScreenAwake(adbId);

  for (let i = 0; i < messages.length; i += 1) {
    if (actionToken?.aborted) {
      throw new Error("Remote action dibatalkan oleh pengguna.");
    }
    await ensureDeviceScreenAwake(adbId);
    let message = messages[i];

    // CEK CACHE: Skip jika pesan sudah sedang/sudah dikirim
    if (messageId && isMessageInCache(messageId)) {
      const cacheData = WHATSAPP_MESSAGE_CACHE.get(messageId);
      console.log(
        `⏭️ [ADB:${adbId}] Pesan ${messageId} sudah ada di cache (${cacheData.status}), skip!`
      );
      continue;
    }

    // ADD TO CACHE: Tandai pesan sedang dikirim
    if (messageId) {
      addMessageToCache(messageId, "sending");

      // KIRIM STATUS UPDATE: Tampilkan status "sedang mengetik" di android-remote window
      const scrcpyWin = scrcpyWindows.get(adbId);
      if (scrcpyWin && !scrcpyWin.isDestroyed()) {
        scrcpyWin.webContents.send("automation-update", {
          messageId: messageId,
          status: "typing",
          statusText: "⌨️ Sedang mengetik...",
          message:
            message.substring(0, 50) + (message.length > 50 ? "..." : ""),
        });
      }
    }

    // WhatsApp limit untuk pengguna individu: 65,536 karakter per pesan
    const WHATSAPP_MESSAGE_LIMIT = 65536;

    if (message.length > WHATSAPP_MESSAGE_LIMIT) {
      console.warn(
        `⚠️ [ADB:${adbId}] Pesan ${i + 1} terlalu panjang (${
          message.length
        } chars, limit: ${WHATSAPP_MESSAGE_LIMIT}), akan dipotong!`
      );

      // Potong pesan ke batas maksimal
      message = message.substring(0, WHATSAPP_MESSAGE_LIMIT);

      // Kirim callback dengan warning jika ada
      if (callbackUrl && messageId) {
        console.log(
          `📞 [ADB:${adbId}] Mengirim callback warning (pesan dipotong)...`
        );
        sendWhatsappCallback(
          callbackUrl,
          messageId,
          "done",
          `Pesan dipotong dari ${messages[i].length} ke ${WHATSAPP_MESSAGE_LIMIT} karakter (limit WhatsApp)`
        ).catch((err) => {
          console.warn(`⚠️ Failed to send callback:`, err.message);
        });
      }
    }

    const hasEmoji = hasEmojiOrComplexChars(message);
    const MAX_TYPING_CHARS = 200; // Batas untuk gunakan typing method

    console.log(
      `📲 [ADB:${adbId}] Mengirim pesan WhatsApp ${i + 1}/${messages.length} (${
        message.length
      } chars, emoji: ${hasEmoji ? "yes" : "no"})`
    );

    // Wrap sending logic in try-catch untuk error handling
    try {
      // LOGIKA:
      // - Pesan < 200 chars & tanpa emoji: Gunakan typing method (cepat/instant)
      // - Pesan >= 200 chars atau dengan emoji: Gunakan wa.me URL redirect

      if (message.length < MAX_TYPING_CHARS && !hasEmoji) {
        // METODE 1: TYPING - Untuk pesan pendek tanpa emoji
        const cleanMessage = stripEmoji(message);
        const waUrl = `https://wa.me/${phoneNumber}`;

        console.log(
          `⌨️ [ADB:${adbId}] Kirim via typing instant (${cleanMessage.length} chars)...`
        );

        await manager.runAdbCommand(
          [
            "-s",
            adbId,
            "shell",
            "am",
            "start",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            waUrl,
            whatsappPackage,
          ],
          { timeout: 20000, silent: true }
        );

        await sleep(3500);
        await clearWhatsappInputField(adbId);

        if (actionToken?.aborted) {
          throw new Error("Remote action dibatalkan oleh pengguna.");
        }

        await typeTextWithSpeed(
          adbId,
          cleanMessage,
          options.typingSpeed || "instant"
        );

        console.log(
          `✅ [ADB:${adbId}] Typing selesai, tunggu 1 detik sebelum klik send...`
        );
        await sleep(1000);

        if (actionToken?.aborted) {
          throw new Error("Remote action dibatalkan oleh pengguna.");
        }

        console.log(`📤 [ADB:${adbId}] Klik tombol send...`);
        await tapWhatsappSendButton(adbId);

        console.log(`⏳ [ADB:${adbId}] Menunggu pesan terkirim (3 detik)...`);
        await sleep(3000);
      } else {
        // METODE 2: URL REDIRECT - Untuk pesan panjang atau dengan emoji
        const encodedMessage = encodeURIComponent(message);
        const waUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

        console.log(
          `🔗 [ADB:${adbId}] Kirim via URL redirect (${message.length} chars, URL: ${waUrl.length} chars)`
        );

        await manager.runAdbCommand(
          [
            "-s",
            adbId,
            "shell",
            "am",
            "start",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            waUrl,
            whatsappPackage,
          ],
          { timeout: 20000, silent: true }
        );

        await sleep(2500);

        if (actionToken?.aborted) {
          throw new Error("Remote action dibatalkan oleh pengguna.");
        }

        await tapWhatsappSendButton(adbId);

        console.log(`⏳ [ADB:${adbId}] Menunggu pesan terkirim (2 detik)...`);
        await sleep(2000);
      }

      // Update cache: pesan berhasil terkirim
      if (messageId) {
        updateMessageCacheStatus(messageId, "sent");

        // KIRIM STATUS UPDATE: Tampilkan status "terkirim" di android-remote window
        const scrcpyWin = scrcpyWindows.get(adbId);
        if (scrcpyWin && !scrcpyWin.isDestroyed()) {
          scrcpyWin.webContents.send("automation-update", {
            messageId: messageId,
            status: "sent",
            statusText: "✅ Terkirim",
            message:
              message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          });
        }
      }

      // Kirim callback sukses
      if (callbackUrl && messageId) {
        console.log(`📞 [ADB:${adbId}] Mengirim callback sukses...`);
        sendWhatsappCallback(callbackUrl, messageId, "done").catch((err) => {
          console.warn(`⚠️ Failed to send callback:`, err.message);
        });
      }
    } catch (error) {
      // Error handling: Update cache ke failed dan kirim callback
      console.error(
        `❌ [ADB:${adbId}] Error saat mengirim pesan ${i + 1}:`,
        error.message
      );

      // Update cache ke failed
      if (messageId) {
        updateMessageCacheStatus(messageId, "failed");

        // KIRIM STATUS UPDATE: Tampilkan status "gagal" di android-remote window
        const scrcpyWin = scrcpyWindows.get(adbId);
        if (scrcpyWin && !scrcpyWin.isDestroyed()) {
          scrcpyWin.webContents.send("automation-update", {
            messageId: messageId,
            status: "failed",
            statusText: "❌ Gagal",
            message:
              message.substring(0, 50) + (message.length > 50 ? "..." : ""),
            error: error.message,
          });
        }
      }

      // Kirim callback failed
      if (callbackUrl && messageId) {
        sendWhatsappCallback(
          callbackUrl,
          messageId,
          "failed",
          error.message
        ).catch((err) => {
          console.warn(`⚠️ Failed to send error callback:`, err.message);
        });
      }

      // Continue ke pesan berikutnya (jangan throw error, biar pesan lain tetap dikirim)
    }

    // Delay antar pesan untuk memastikan pesan sebelumnya sudah benar-benar terkirim
    // sebelum memulai pesan berikutnya
    if (i < messages.length - 1) {
      console.log(
        `⏸️ [ADB:${adbId}] Delay 2 detik sebelum pesan berikutnya (${i + 2}/${
          messages.length
        })...`
      );
      await sleep(2000);
    }
  }
}

async function sendSingleWhatsappMessage(
  adbId,
  phoneNumber,
  message = "",
  options = {}
) {
  const whatsappVariant = sanitizeWhatsappVariant(
    options.whatsappVariant || options.variant
  );
  await sendWhatsappSampleMessagesThroughAdb(adbId, {
    messages: [String(message || "")],
    phoneNumber: phoneNumber,
    typingSpeed: options.typingSpeed || "instant",
    callbackUrl: options.callbackUrl,
    messageId: options.messageId,
    deviceUid: options.deviceUid,
    whatsappVariant,
  });
}

function encodeCharForAdbInput(char = "") {
  if (!char) return "";
  if (char === " ") return "%s";
  if (char === "\n") return "%0A";
  if (/^[0-9a-zA-Z]$/.test(char)) return char;
  if (/[.,!?@#\-]/.test(char)) return char;
  return "";
}

function encodeTextForAdbInput(text = "") {
  return Array.from(text)
    .map((char) => encodeCharForAdbInput(char))
    .filter(Boolean)
    .join("");
}

function containsNonAscii(text = "") {
  return /[^\x20-\x7E]/.test(text);
}

async function typeTextWithSpeed(adbId, text = "", typingSpeed = "instant") {
  if (!adbId || !text) return;
  const manager = ensureAndroidManagerReady();
  const normalized = (typingSpeed || "instant").toLowerCase();

  // ADB input text has buffer limit ~200-300 chars
  // For long text, use clipboard paste automatically
  const ADB_INPUT_SAFE_LIMIT = 200;

  const delayMap = {
    robot: 35,
    fasthuman: 60,
    human: 90,
    slowhuman: 130,
    realistic: { base: 80, jitter: 70 },
    stealth: { base: 70, jitter: 90 },
  };

  if (normalized === "paste") {
    await setClipboardAndPaste(adbId, text, manager);
    return;
  }
  if (normalized === "hybrid") {
    await setClipboardAndPaste(adbId, text, manager);
    await sleep(400);
    return;
  }
  if (containsNonAscii(text)) {
    await setClipboardAndPaste(adbId, text, manager);
    return;
  }

  // Auto-paste for long messages to avoid ADB buffer limit
  if (text.length > ADB_INPUT_SAFE_LIMIT) {
    console.log(
      `📋 [ADB:${adbId}] Pesan panjang (${text.length} chars), gunakan clipboard paste otomatis`
    );
    await setClipboardAndPaste(adbId, text, manager);
    return;
  }

  if (delayMap[normalized]) {
    const config = delayMap[normalized];
    const chars = Array.from(text);
    for (const char of chars) {
      const token = encodeCharForAdbInput(char);
      if (!token) continue;
      await manager.runAdbCommand(
        ["-s", adbId, "shell", "input", "text", token],
        { timeout: 10000, silent: true }
      );
      const delay =
        typeof config === "number"
          ? config
          : config.base + Math.floor(Math.random() * config.jitter);
      await sleep(delay);
    }
    return;
  }

  const encoded = encodeTextForAdbInput(text);
  if (!encoded) return;
  await manager.runAdbCommand(
    ["-s", adbId, "shell", "input", "text", encoded],
    { timeout: 10000, silent: true }
  );
}

async function setClipboardAndPaste(adbId, text, manager) {
  // For very long text, use chunked typing approach
  const CHUNK_SIZE = 150; // Safe chunk size for ADB input

  if (text.length > CHUNK_SIZE) {
    console.log(
      `📝 [ADB:${adbId}] Text panjang (${text.length} chars), kirim dalam chunks...`
    );

    // Split text into chunks
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.substring(i, i + CHUNK_SIZE));
    }

    // Send each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const encoded = encodeTextForAdbInput(chunk);

      if (encoded) {
        await manager.runAdbCommand(
          ["-s", adbId, "shell", "input", "text", encoded],
          { timeout: 10000, silent: true }
        );

        console.log(
          `  ✓ Chunk ${i + 1}/${chunks.length} sent (${chunk.length} chars)`
        );

        // Small delay between chunks
        if (i < chunks.length - 1) {
          await sleep(100);
        }
      }
    }

    console.log(
      `✅ [ADB:${adbId}] Semua ${chunks.length} chunks berhasil dikirim`
    );
    return;
  }

  // For short text, try clipper broadcast method
  try {
    await manager.runAdbCommand(
      [
        "-s",
        adbId,
        "shell",
        "am",
        "broadcast",
        "-a",
        "clipper.set",
        "-e",
        "text",
        text,
      ],
      { timeout: 15000, silent: true }
    );

    // Paste using keyevent 279 (KEYCODE_PASTE)
    await manager.runAdbCommand(
      ["-s", adbId, "shell", "input", "keyevent", "279"],
      { timeout: 8000, silent: true }
    );

    console.log(`📋 [ADB:${adbId}] Clipboard paste method used`);
  } catch (err) {
    console.warn(
      `⚠️ Clipboard method failed, using direct input:`,
      err.message
    );

    // Fallback to direct input
    const encoded = encodeTextForAdbInput(text);
    if (encoded) {
      await manager.runAdbCommand(
        ["-s", adbId, "shell", "input", "text", encoded],
        { timeout: 10000, silent: true }
      );
    }
  }
}

async function tapWhatsappSendButton(adbId) {
  const target =
    (await resolveWhatsappSendButtonBounds(adbId)) ||
    (await estimateWhatsappSendButton(adbId));
  if (!target) return;
  const manager = ensureAndroidManagerReady();
  await manager.runAdbCommand(
    [
      "-s",
      adbId,
      "shell",
      "input",
      "tap",
      String(Math.round(target.x)),
      String(Math.round(target.y)),
    ],
    { timeout: 10000, silent: true }
  );
}

async function getDeviceDisplayMetrics(adbId) {
  const manager = ensureAndroidManagerReady();
  try {
    const output = await manager.runAdbCommand(
      ["-s", adbId, "shell", "wm", "size"],
      { timeout: 8000, silent: true }
    );
    const match = output.match(/Physical size:\s*(\d+)x(\d+)/i);
    if (match) {
      return { width: Number(match[1]), height: Number(match[2]) };
    }
  } catch (err) {
    console.warn(
      `⚠️ Gagal membaca resolusi device ${adbId}, gunakan default:`,
      err?.message || err
    );
  }
  return { width: 1080, height: 1920 };
}

async function clearWhatsappInputField(adbId) {
  const manager = ensureAndroidManagerReady();
  try {
    await manager.runAdbCommand(
      ["-s", adbId, "shell", "input", "keyevent", "123"],
      { timeout: 6000, silent: true }
    );
    await manager.runAdbCommand(
      ["-s", adbId, "shell", "input", "keyevent", "--longpress", "67"],
      { timeout: 6000, silent: true }
    );
  } catch (err) {
    console.warn(
      `⚠️ Gagal clear dengan longpress untuk ${adbId}, fallback delete.`,
      err?.message || err
    );
    for (let i = 0; i < 80; i += 1) {
      try {
        await manager.runAdbCommand(
          ["-s", adbId, "shell", "input", "keyevent", "67"],
          { timeout: 3000, silent: true }
        );
      } catch {
        break;
      }
    }
  }
}

async function resolveWhatsappSendButtonBounds(adbId) {
  const manager = ensureAndroidManagerReady();
  const dumpPath = "/sdcard/starbox_uidump.xml";
  const resourceIds = [
    "com.whatsapp:id/send",
    "com.whatsapp:id/send_btn",
    "com.whatsapp:id/send_button",
    "com.whatsapp.w4b:id/send",
  ];
  try {
    await manager.runAdbCommand(
      ["-s", adbId, "shell", "uiautomator", "dump", dumpPath],
      { timeout: 10000, silent: true }
    );
    const xml = await manager.runAdbCommand(
      ["-s", adbId, "shell", "cat", dumpPath],
      { timeout: 10000, silent: true }
    );
    if (!xml) return null;
    for (const resourceId of resourceIds) {
      const pattern = new RegExp(
        `resource-id="${resourceId}"[\\s\\S]*?bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
        "i"
      );
      const match = xml.match(pattern);
      if (match) {
        const x1 = Number(match[1]);
        const y1 = Number(match[2]);
        const x2 = Number(match[3]);
        const y2 = Number(match[4]);
        const x = x1 + (x2 - x1) / 2;
        const y = y1 + (y2 - y1) / 2;
        return { x, y };
      }
    }
  } catch (err) {
    console.warn(
      `⚠️ Gagal membaca tombol send WhatsApp (${adbId}):`,
      err?.message || err
    );
  }
  return null;
}

async function estimateWhatsappSendButton(adbId) {
  const { width, height } = await getDeviceDisplayMetrics(adbId);
  const x = Math.max(Math.floor(width * 0.92), width - 120);
  const y = Math.max(Math.floor(height * 0.78), height - 260);
  return { x, y };
}

function openAndroidDeviceDisplay(uid) {
  if (!uid) {
    throw new Error("UID tidak valid.");
  }
  const record = findAndroidRemoteDevice(uid);
  if (!record) {
    throw new Error("Device Android tidak ditemukan.");
  }
  const adbId = record.adbId;
  if (!adbId) {
    throw new Error("Device tidak memiliki ADB ID.");
  }
  const existing = scrcpySessions.get(adbId);
  if (existing && !existing.killed) {
    // Focus existing control window
    const controlWin = scrcpyWindows.get(adbId);
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.focus();
    }
    return { message: "Tampilan perangkat sudah berjalan." };
  }
  const deviceName = record.name || "Android Device";
  const service = record.service || "android-full-remote";
  return launchScrcpyForDevice(adbId, uid, deviceName, {
    service: service,
    whatsappBaseUrl: record.whatsappBaseUrl || "",
    whatsappCallbackUrl: record.whatsappCallbackUrl || "",
  });
}

const scrcpyWindows = new Map();
const scrcpyRecordings = new Map();
const scrcpyWindowWatchers = new Map();
const scrcpyRestartMeta = new Map();
const MAX_SCRCPY_RESTART = 1;

function createScrcpyWindow(
  uid,
  adbId,
  deviceName = "Android Device",
  options = {}
) {
  const {
    service = "android-full-remote",
    whatsappBaseUrl = "",
    whatsappCallbackUrl = "",
  } = options || {};
  // Check if window already exists
  const existing = scrcpyWindows.get(adbId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({
    width: 260,
    minWidth: 230,
    height: 860,
    title: `Remote Control - ${deviceName}`,
    autoHideMenuBar: true,
    icon: getAssetPath("starbox.png"),
    resizable: true,
    show: false,
    useContentSize: false,
    fullscreenable: false,
    simpleFullscreen: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), "android-remote-preload.cjs"),
    },
  });

  const htmlPath = path.join(__dirname, "android-remote.html");
  const queryParams = new URLSearchParams({
    uid: uid,
    adbId: adbId,
    deviceName: deviceName,
    service,
  });
  if (whatsappBaseUrl) {
    queryParams.set("whatsappBaseUrl", whatsappBaseUrl);
  }
  if (whatsappCallbackUrl) {
    queryParams.set("whatsappCallbackUrl", whatsappCallbackUrl);
  }

  win.loadURL(`file://${htmlPath}?${queryParams.toString()}`);

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  win.on("closed", () => {
    scrcpyWindows.delete(adbId);
    stopScrcpyWindowWatcher(adbId);
    // Stop scrcpy process if running
    const proc = scrcpySessions.get(adbId);
    if (proc && !proc.killed) {
      proc.kill();
    }
    scrcpySessions.delete(adbId);
  });

  scrcpyWindows.set(adbId, win);
  return win;
}

function stopScrcpyWindowWatcher(adbId) {
  const handle = scrcpyWindowWatchers.get(adbId);
  if (handle) {
    clearInterval(handle);
    scrcpyWindowWatchers.delete(adbId);
  }
}

function findScrcpyWindowByTitle(windowTitle) {
  try {
    const windows = windowManager.getWindows();
    if (!Array.isArray(windows) || !windows.length) return null;
    const lowered = (windowTitle || "").toLowerCase();
    return windows.find((w) => {
      try {
        const title = (w.getTitle() || "").toLowerCase();
        return title.includes(lowered) || title.includes("scrcpy");
      } catch {
        return false;
      }
    });
  } catch (err) {
    console.warn(
      "⚠️ Tidak bisa membaca daftar window OS:",
      err?.message || err
    );
    return null;
  }
}

function alignControlWindowToScrcpy(controlWin, scrcpyWin, gap = 8) {
  if (!controlWin || controlWin.isDestroyed()) return;
  if (!scrcpyWin) return;
  const scrcpyBounds = scrcpyWin.getBounds?.();
  if (!scrcpyBounds) return;
  const controlBounds = controlWin.getBounds();
  const desiredX = scrcpyBounds.x + scrcpyBounds.width + gap;
  const desiredY = scrcpyBounds.y;
  const desiredHeight = scrcpyBounds.height;
  if (
    Math.abs(controlBounds.x - desiredX) > 2 ||
    Math.abs(controlBounds.y - desiredY) > 2 ||
    Math.abs(controlBounds.height - desiredHeight) > 2
  ) {
    controlWin.setBounds({
      x: desiredX,
      y: desiredY,
      width: controlBounds.width,
      height: desiredHeight,
    });
  }
}

function startScrcpyWindowWatcher(adbId, controlWin, windowTitle) {
  stopScrcpyWindowWatcher(adbId);
  const interval = setInterval(() => {
    if (!controlWin || controlWin.isDestroyed()) {
      stopScrcpyWindowWatcher(adbId);
      return;
    }
    const scrcpyWin = findScrcpyWindowByTitle(windowTitle);
    if (!scrcpyWin) return;
    try {
      alignControlWindowToScrcpy(controlWin, scrcpyWin);
      const isMinimized =
        typeof scrcpyWin.isMinimized === "function"
          ? scrcpyWin.isMinimized()
          : false;
      if (isMinimized && !controlWin.isMinimized()) {
        controlWin.minimize();
      } else if (!isMinimized && controlWin.isMinimized()) {
        controlWin.restore();
      }
    } catch (err) {
      console.warn("⚠️ Gagal sinkron posisi SCRCPY:", err?.message || err);
    }
  }, 800);
  scrcpyWindowWatchers.set(adbId, interval);
}

function attachControlWindowStateSync(controlWin, windowTitle) {
  const withScrcpy = (callback) => {
    const win = findScrcpyWindowByTitle(windowTitle);
    if (win) {
      try {
        callback(win);
      } catch (err) {
        console.warn("⚠️ Operasi window SCRCPY gagal:", err?.message || err);
      }
    }
  };
  controlWin.on("minimize", () => {
    withScrcpy((win) => win.minimize?.());
  });
  controlWin.on("restore", () => {
    withScrcpy((win) => {
      win.restore?.();
      win.bringToTop?.();
    });
  });
  controlWin.on("hide", () => {
    withScrcpy((win) => win.minimize?.());
  });
  controlWin.on("show", () => {
    withScrcpy((win) => {
      win.restore?.();
      win.bringToTop?.();
    });
  });
}

async function findAndPositionScrcpyWindow(controlWin, windowTitle, adbId) {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(() => {
      attempts += 1;
      const scrcpyWin = findScrcpyWindowByTitle(windowTitle);
      if (scrcpyWin) {
        clearInterval(interval);
        try {
          alignControlWindowToScrcpy(controlWin, scrcpyWin);
          scrcpyWin.bringToTop?.();
          controlWin.moveTop();
          console.log(
            `✅ SCRCPY window positioned next to control window for ${adbId}`
          );
          resolve({ positioned: true, window: scrcpyWin });
        } catch (err) {
          console.warn(
            "⚠️ Could not position SCRCPY window:",
            err?.message || err
          );
          resolve({ positioned: false, reason: "positioning_failed" });
        }
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn(
          `⚠️ SCRCPY window '${windowTitle}' not found after ${maxAttempts} attempts`
        );
        resolve({ positioned: false, reason: "not_found" });
      }
    }, 150);
  });
}

function launchScrcpyForDevice(
  adbId,
  uid = null,
  deviceName = "Android Device",
  options = {}
) {
  scrcpyRestartMeta.set(adbId, {
    uid: uid || adbId,
    deviceName,
    options,
    attempts: 0,
  });
  const scrcpyBin = resolveScrcpyBinary();
  if (!scrcpyBin) {
    const platform = process.platform;
    let errorMsg = "scrcpy tidak ditemukan. ";
    if (platform === "win32") {
      errorMsg += "Pastikan scrcpy terpasang via Chocolatey (choco install scrcpy), winget (winget install Genymobile.scrcpy), atau manual dari https://github.com/Genymobile/scrcpy/releases. Setelah install, restart StarBox.";
    } else if (platform === "darwin") {
      errorMsg += "Pastikan scrcpy terpasang (contoh: brew install scrcpy di /opt/homebrew/bin/scrcpy atau /usr/local/bin/scrcpy).";
    } else {
      errorMsg += "Pastikan scrcpy terpasang via package manager distro Anda (apt, snap, pacman, dll).";
    }
    throw new Error(errorMsg);
  }
  const startProcess = () => {
    const meta = scrcpyRestartMeta.get(adbId) || {
      service: options?.service || "android-full-remote",
      whatsappBaseUrl: options?.whatsappBaseUrl || "",
      whatsappCallbackUrl: options?.whatsappCallbackUrl || "",
      uid: uid || adbId,
      deviceName,
      attempts: 0,
    };
    scrcpyRestartMeta.set(adbId, meta);
    try {
      createScrcpyWindow(meta.uid, adbId, meta.deviceName, meta.options || meta);

      const windowTitle = `${meta.deviceName} (${adbId})`;
      // On Windows, use shell if path contains spaces or special chars
      const needsShell = process.platform === "win32" && /[\s()]/.test(scrcpyBin);
      console.log(`🚀 Launching scrcpy from: ${scrcpyBin} (shell=${needsShell})`);
      const proc = spawn(scrcpyBin, [
        "-s",
        adbId,
        "--window-title",
        windowTitle,
        "--stay-awake",
      ], {
        shell: needsShell,
        windowsHide: true,
      });

      // Capture output for debugging
      if (proc.stdout) {
        proc.stdout.on("data", (data) => {
          console.log(`[scrcpy ${adbId}] ${data.toString().trim()}`);
        });
      }
      if (proc.stderr) {
        proc.stderr.on("data", (data) => {
          console.warn(`[scrcpy ${adbId}] ${data.toString().trim()}`);
        });
      }

      scrcpySessions.set(adbId, proc);

      console.log(`✅ SCRCPY launched for ${meta.deviceName} (${adbId})`);

      const cleanup = () => {
        if (scrcpySessions.get(adbId) === proc) {
          scrcpySessions.delete(adbId);
        }
      };

      const attemptRestart = (reason = "") => {
        const data = scrcpyRestartMeta.get(adbId);
        if (!data) return false;
        if (data.attempts >= MAX_SCRCPY_RESTART) return false;
        data.attempts += 1;
        scrcpyRestartMeta.set(adbId, data);
        console.warn(
          `⚠️ SCRCPY exit (${reason || "unknown"}). Auto-restart attempt ${data.attempts}/${MAX_SCRCPY_RESTART} for ${adbId}`
        );
        setTimeout(() => startProcess(), 800);
        return true;
      };

      proc.once("exit", (code, signal) => {
        const restarted = attemptRestart(`exit code ${code} signal ${signal || "none"}`);
        if (!restarted) {
          cleanup();
          const win = scrcpyWindows.get(adbId);
          if (win && !win.isDestroyed()) {
            win.close();
          }
          scrcpyRestartMeta.delete(adbId);
        }
      });
      proc.once("error", (err) => {
        console.error(`❌ scrcpy error for ${adbId}:`, {
          message: err?.message,
          code: err?.code,
          path: scrcpyBin,
          errno: err?.errno,
          syscall: err?.syscall,
        });
        const restarted = attemptRestart(err?.message || "spawn error");
        if (!restarted) {
          cleanup();
          console.warn(`⚠️ scrcpy gagal untuk ${adbId}:`, err?.message || err);
          scrcpyRestartMeta.delete(adbId);
        }
      });
      proc.once("close", (code, signal) => {
        if (code !== 0) {
          console.warn(
            `⚠️ scrcpy keluar dengan kode ${code} untuk ${adbId} (signal=${signal || "none"})`
          );
        }
      });
    } catch (err) {
      console.warn(`⚠️ Tidak bisa menjalankan scrcpy:`, err?.message || err);
      scrcpyRestartMeta.delete(adbId);
      throw new Error(
        "scrcpy tidak ditemukan atau gagal dijalankan. Pastikan scrcpy terinstal di komputer ini."
      );
    }
  };

  startProcess();
  return { message: "Membuka tampilan perangkat dengan kontrol UI..." };
}

async function performAndroidRemoteAction(
  uid,
  action = "default",
  payload = {}
) {
  const record = findAndroidRemoteDevice(uid);
  if (!record) {
    throw new Error("Device Android tidak ditemukan.");
  }
  const token = beginAndroidRemoteAction(uid);
  const service = sanitizeRemoteServiceId(record.service);
  const normalizedAction = action || "default";

  try {
    if (service === "android-whatsapp") {
      const actionType =
        normalizedAction === "whatsapp-send-sample"
          ? "whatsapp-send-sample"
          : "default";
      if (actionType === "whatsapp-send-sample" || actionType === "default") {
        await sendWhatsappSampleMessagesThroughAdb(record.adbId, {
          ...payload,
          token,
          whatsappVariant: record.whatsappVariant,
        });
        return {
          success: true,
          message: "Pesan WhatsApp sampel berhasil dikirim.",
        };
      }
    }

    throw new Error(
      "Aksi remote untuk layanan ini belum tersedia. Gunakan mode remote manual."
    );
  } finally {
    clearAndroidRemoteAction(uid);
  }
}

function updateAndroidRemoteDeviceRecord(payload = {}) {
  const uid = payload.uid;
  if (!uid) {
    throw new Error("UID tidak valid.");
  }
  const devices = readAndroidRemoteDevices();
  const index = devices.findIndex((device) => device.uid === uid);
  if (index === -1) {
    throw new Error("Device tidak ditemukan.");
  }
  const current = devices[index];
  const next = { ...current };
  if (typeof payload.name === "string" && payload.name.trim()) {
    next.name = payload.name.trim();
  }
  if (typeof payload.adbId === "string" && payload.adbId.trim()) {
    next.adbId = payload.adbId.trim();
    console.log(`✅ Updated adbId for ${uid}: ${next.adbId}`);
  }
  if (typeof payload.service === "string" && payload.service.trim()) {
    next.service = sanitizeRemoteServiceId(payload.service);
  }
  if (typeof payload.status === "string" && payload.status.trim()) {
    next.status = sanitizeRemoteServiceId(payload.status);
  }
  if (payload.whatsappBaseUrl !== undefined) {
    next.whatsappBaseUrl = sanitizePendingUrl(payload.whatsappBaseUrl || "");
  }
  if (payload.whatsappCallbackUrl !== undefined) {
    next.whatsappCallbackUrl = sanitizePendingUrl(
      payload.whatsappCallbackUrl || ""
    );
  }
  if (payload.whatsappVariant !== undefined) {
    next.whatsappVariant = sanitizeWhatsappVariant(
      payload.whatsappVariant || "consumer"
    );
  }

  next.updated_at = new Date().toISOString();
  devices[index] = next;
  writeAndroidRemoteDevices(devices);
  return next;
}

function deleteAndroidRemoteDeviceRecord(uid) {
  if (!uid) {
    throw new Error("UID tidak valid.");
  }
  const devices = readAndroidRemoteDevices();
  const next = devices.filter((device) => device.uid !== uid);
  if (next.length === devices.length) {
    throw new Error("Device tidak ditemukan.");
  }
  writeAndroidRemoteDevices(next);
  return true;
}

function allowAutoSenderForService(service = "") {
  return AUTO_SENDER_SERVICES.has((service || "").toLowerCase());
}

function sanitizePendingUrl(url = "") {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function hasCustomPathInUrl(url = "") {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const path = (parsed.pathname || "").replace(/\/+$/, "");
    return Boolean(path && path !== "/");
  } catch {
    const withoutProtocol = url.replace(/^[a-z]+:\/\//i, "");
    return withoutProtocol.includes("/");
  }
}

function buildUrlWithDefaultPath(baseUrl = "", defaultPath = "") {
  const sanitized = sanitizePendingUrl(baseUrl);
  if (!sanitized) return "";
  const normalizedPath = defaultPath
    ? defaultPath.startsWith("/")
      ? defaultPath
      : `/${defaultPath}`
    : "";
  if (!normalizedPath) {
    return sanitized;
  }
  if (hasCustomPathInUrl(sanitized)) {
    return sanitized;
  }
  try {
    const parsed = new URL(sanitized);
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = normalizedPath;
    }
    parsed.search = "";
    parsed.hash = "";
    let resolved = parsed.toString();
    if (resolved.endsWith("/")) {
      resolved = resolved.replace(/\/+$/, "");
    }
    return resolved;
  } catch {
    const trimmedBase = sanitized.replace(/\/+$/, "");
    return `${trimmedBase}${normalizedPath}`;
  }
}

function resolveAutomationCallbackUrl(pendingUrl = "", callbackUrl = "") {
  const override = sanitizePendingUrl(callbackUrl);
  if (override) {
    return buildUrlWithDefaultPath(override, "/updatestatusmessage");
  }
  return buildUrlWithDefaultPath(pendingUrl, "/updatestatusmessage");
}

function sanitizeCustomUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    return "";
  }
  return value;
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
  win.__inputGuardEnabled =
    win.__inputGuardEnabled === undefined ? true : win.__inputGuardEnabled;

  win.webContents.on("before-input-event", (event, input) => {
    if (win.__inputGuardEnabled !== false && input?.isTrusted) {
      event.preventDefault();
    }
  });

  const injectGuards = () => {
    const currentState = win.__inputGuardEnabled !== false;
    win.webContents
      .executeJavaScript(
        `
      (function () {
        if (window.__starboxGuardInjected) {
          if (window.__starboxSetGuardState) {
            window.__starboxSetGuardState(${currentState ? "true" : "false"});
          } else {
            window.__starboxGuardEnabled = ${currentState ? "true" : "false"};
          }
          return;
        }
        window.__starboxGuardInjected = true;
        window.__starboxGuardEnabled = ${currentState ? "true" : "false"};

        const applyPointerState = () => {
          if (!document.body) return;
          if (window.__starboxGuardEnabled) {
            document.body.style.pointerEvents = 'none';
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'default';
          } else {
            document.body.style.pointerEvents = '';
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
          }
        };

        applyPointerState();

        const observer = new MutationObserver(() => {
          if (window.__starboxGuardEnabled) {
            applyPointerState();
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        const cancelEvent = (event) => {
          if (!window.__starboxGuardEnabled) return;
          if (event.isTrusted) {
            event.stopPropagation();
            event.preventDefault();
          }
        };

        const guardOptions = { capture: true, passive: false };
        ['contextmenu', 'wheel', 'touchstart', 'touchend'].forEach(evt => {
          window.addEventListener(evt, cancelEvent, guardOptions);
        });

        window.__starboxSetGuardState = function(enabled) {
          window.__starboxGuardEnabled = !!enabled;
          applyPointerState();
        };
      })();
    `
      )
      .catch(() => {});
  };

  win.webContents.on("dom-ready", injectGuards);
  win.webContents.on("did-finish-load", injectGuards);
  win.webContents.on("did-navigate", injectGuards);
}

function getWindowInputGuardState(win) {
  if (!win || win.isDestroyed()) return null;
  return win.__inputGuardEnabled !== false;
}

function setWindowInputGuardState(win, enabled) {
  if (!win || win.isDestroyed()) return;
  const desired = !!enabled;
  win.__inputGuardEnabled = desired;
  installInputGuards(win);
  win.webContents
    .executeJavaScript(
      `
      if (window.__starboxSetGuardState) {
        window.__starboxSetGuardState(${desired ? "true" : "false"});
      } else {
        window.__starboxGuardEnabled = ${desired ? "true" : "false"};
      }
    `
    )
    .catch(() => {});
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
    title: withBrandTitle("WA Auto Sender Monitor"),
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
  const inputGuardEnabled =
    "inputGuardEnabled" in remaining
      ? remaining.inputGuardEnabled
      : getWindowInputGuardState(parentWindow);
  if ("inputGuardEnabled" in remaining) {
    delete remaining.inputGuardEnabled;
  }

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
    autoSenderEnabled: !!config.autoSender,
    inputGuardEnabled,
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

  const updateStatusUrl = resolveAutomationCallbackUrl(
    options.pendingUrl || config.pendingUrl || "",
    options.callbackUrl || config.callbackUrl || ""
  );

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

      // Buka WhatsApp Web dengan pesan langsung
      const targetUrl = `https://web.whatsapp.com/send?phone=${
        item.phone
      }&text=${encodeURIComponent(item.message)}&app_absent=0`;

      try {
        console.log(`🤖 Mengirim pesan ke ${item.phone} untuk UID ${uid}`);
        await win.loadURL(targetUrl, { userAgent });
        await waitForLoad(win, 20000);
        await new Promise((res) => setTimeout(res, 1200));

        const sendResult = await win.webContents.executeJavaScript(
          `
          (async () => {
            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            const targetMessage = ${JSON.stringify(item.message || "")};
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

            const findInput = () => inputSelectors
              .map(selector => document.querySelector(selector))
              .find(el => el && typeof el.focus === "function");
            const findSendButton = () => sendSelectors
              .map(selector => document.querySelector(selector))
              .find(btn => btn && !btn.disabled);

            // Cari input box terlebih dahulu
            let input = null;
            for (let attempt = 0; attempt < 24; attempt++) {
              input = findInput();
              if (input) break;
              await sleep(350);
            }

            if (!input) return { ok: false, reason: "no-input" };

            // Focus pada input dan pastikan field terisi
            input.focus();
            await sleep(180);

            const ensureMessageValue = () => {
              const current =
                (typeof input.value === "string" ? input.value : input.textContent || "").trim();
              if (current || !targetMessage) {
                return current || targetMessage || "";
              }
              try {
                const proto = Object.getPrototypeOf(input) || input;
                const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
                if (setter) {
                  setter.call(input, targetMessage);
                } else {
                  input.value = targetMessage;
                  input.textContent = targetMessage;
                }
                input.dispatchEvent(new InputEvent("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
              } catch (err) {
                console.warn("Gagal mengisi pesan otomatis:", err);
              }
              return targetMessage || "";
            };

            const messageValue = ensureMessageValue();

            // Cari tombol kirim yang aktif
            let sendButton = null;
            for (let attempt = 0; attempt < 40; attempt++) {
              sendButton = findSendButton();
              if (sendButton) break;
              await sleep(200);
            }

            if (sendButton) {
              sendButton.click();
            } else {
              // Fallback: tekan Enter
              const enterDown = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              input.dispatchEvent(enterDown);
              const enterUp = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              input.dispatchEvent(enterUp);
            }

            // Tunggu pesan terkirim
            await sleep(900);
            return {
              ok: true,
              via: sendButton ? "button" : "enter",
              messageLength: (messageValue || "").length
            };
          })();
        `,
          true
        );

        const success = !!sendResult?.ok;
        if (success) {
          console.log(
            `✅ Pesan ${item.id || item.message.slice(0, 20)} terkirim via ${
              sendResult?.via || "enter"
            }.`
          );
          // Tunggu tambahan untuk memastikan pesan benar-benar terkirim
          await new Promise((res) => setTimeout(res, 1200));
          results.push({ ...item, status: "done" });
          if (entryIndex !== -1) queueState[entryIndex].status = "done";
        } else {
          console.warn(
            `⚠️ Gagal mengirim pesan ke ${item.phone}${
              sendResult?.reason ? ` (${sendResult.reason})` : ""
            }`
          );
          results.push({
            ...item,
            status: "failed",
            error: sendResult?.reason || "send-failed",
          });
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
      await new Promise((res) => setTimeout(res, 900));
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

function isTikTokUrl(url = "") {
  if (!url) return false;
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (parsed.hostname || "").includes("tiktok.com");
  } catch (_) {
    return value.includes("tiktok.com");
  }
}

function sanitizeTikTokComment(text = "") {
  return String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTikTokAutomationState(uid) {
  if (!uid) return null;
  if (!tiktokAutomationState.has(uid)) {
    tiktokAutomationState.set(uid, {
      ...DEFAULT_TIKTOK_AUTOMATION_STATE,
      uid,
      likeTimer: null,
      likeBurstTicker: null,
      likeRestTimer: null,
      commentTimer: null,
      likeLock: false,
      commentLock: false,
      lastLike: null,
      lastComment: null,
      lastMessage: "",
      targetUrl: "",
      commentPool: [],
      commentIndex: 0,
      commentSentCount: 0,
      likeMaxDurationMs: DEFAULT_TIKTOK_AUTOMATION_STATE.likeMaxDurationMs,
      commentMaxDurationMs: DEFAULT_TIKTOK_AUTOMATION_STATE.commentMaxDurationMs,
      likeAutoStopTimer: null,
      commentAutoStopTimer: null,
      likeAutoStopDeadline: null,
      commentAutoStopDeadline: null,
    });
  }
  return tiktokAutomationState.get(uid);
}

function serializeTikTokState(state) {
  if (!state) return null;
  return {
    autoLike: !!state.autoLike,
    autoComment: !!state.autoComment,
    commentText: state.commentText || "",
    likeIntervalMs: state.likeIntervalMs || DEFAULT_TIKTOK_AUTOMATION_STATE.likeIntervalMs,
    commentIntervalMs:
      state.commentIntervalMs || DEFAULT_TIKTOK_AUTOMATION_STATE.commentIntervalMs,
    likeMode: state.likeMode || DEFAULT_TIKTOK_AUTOMATION_STATE.likeMode,
    burstDurationMs: state.burstDurationMs || DEFAULT_TIKTOK_AUTOMATION_STATE.burstDurationMs,
    burstRestMs: state.burstRestMs || DEFAULT_TIKTOK_AUTOMATION_STATE.burstRestMs,
    likeMaxDurationMs: state.likeMaxDurationMs || null,
    commentMaxDurationMs: state.commentMaxDurationMs || null,
    likeAutoStopDeadline: state.likeAutoStopDeadline || null,
    commentAutoStopDeadline: state.commentAutoStopDeadline || null,
    commentPoolSize: Array.isArray(state.commentPool) ? state.commentPool.length : 0,
    commentSentCount: state.commentSentCount || 0,
    lastLike: state.lastLike || null,
    lastComment: state.lastComment || null,
    lastMessage: state.lastMessage || "",
    targetUrl: state.targetUrl || "",
  };
}

function sendTikTokControlUpdate(uid, payload = {}) {
  const state = serializeTikTokState(getTikTokAutomationState(uid));
  const fullPayload = { uid, state, ...payload };

  // Kirim ke window TikTok control biasa (jika ada)
  const ctrl = tiktokControlWindows.get(uid);
  if (ctrl && !ctrl.isDestroyed()) {
    ctrl.webContents.send("tiktok-control-update", fullPayload);
  }

  // Kirim ke hub side panel BrowserView (jika device ada di hub)
  const sideView = hubSidePanelViews.get(uid);
  if (sideView && !sideView.webContents.isDestroyed()) {
    sideView.webContents.send("tiktok-control-update", fullPayload);
  }
}

function closeTikTokControlWindow(uid) {
  const ctrl = tiktokControlWindows.get(uid);
  if (ctrl && !ctrl.isDestroyed()) {
    try {
      ctrl.close();
    } catch (err) {
      console.warn("⚠️ Gagal menutup jendela kontrol TikTok:", err?.message || err);
    }
  }
  tiktokControlWindows.delete(uid);
}

async function ensureTikTokControlWindow(uid, parentWindow, meta = {}) {
  if (!uid) return null;
  const existing = tiktokControlWindows.get(uid);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) {
      existing.restore();
    }
    existing.show();
    existing.focus();
    sendTikTokControlUpdate(uid, { message: "Kontrol TikTok siap." });
    return existing;
  }

  const parentBounds = parentWindow?.getBounds?.() || {};
  const ctrl = new BrowserWindow({
    width: 400,
    height: 580,
    minWidth: 340,
    minHeight: 480,
    title: withBrandTitle("TikTok Control"),
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0b1220",
    x:
      Number.isFinite(parentBounds.x) && Number.isFinite(parentBounds.width)
        ? Math.round(parentBounds.x + parentBounds.width + MONITOR_DIMENSIONS.screenGap)
        : undefined,
    y: Number.isFinite(parentBounds.y) ? Math.round(parentBounds.y) : undefined,
    webPreferences: {
      preload: path.join(app.getAppPath(), "tiktok-control-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ctrl.setMenuBarVisibility(false);

  ctrl.on("closed", () => {
    tiktokControlWindows.delete(uid);
    teardownTikTokAutomation(uid, { keepState: true, closeWindow: false });
  });

  if (parentWindow && !parentWindow.isDestroyed()) {
    parentWindow.once("closed", () => {
      if (!ctrl.isDestroyed()) {
        ctrl.close();
      }
    });
  }

  const htmlPath = path.join(__dirname, "tiktok-control.html");
  const query = new URLSearchParams({
    uid,
    name: meta.deviceName || "TikTok Control",
    url: meta.targetUrl || "tiktok.com",
  });
  await ctrl.loadURL(`file://${htmlPath}?${query.toString()}`);

  ctrl.once("ready-to-show", () => {
    if (ctrl.isDestroyed()) return;
    ctrl.show();
  });

  tiktokControlWindows.set(uid, ctrl);
  sendTikTokControlUpdate(uid, {
    uid,
    state: serializeTikTokState(getTikTokAutomationState(uid)),
    message: "Kontrol TikTok siap.",
  });
  return ctrl;
}

function teardownTikTokAutomation(uid, options = {}) {
  const state = getTikTokAutomationState(uid);
  if (!state) return;

  if (state.likeTimer) {
    clearInterval(state.likeTimer);
    state.likeTimer = null;
  }
  if (state.likeBurstTicker) {
    clearInterval(state.likeBurstTicker);
    state.likeBurstTicker = null;
  }
  if (state.likeRestTimer) {
    clearTimeout(state.likeRestTimer);
    state.likeRestTimer = null;
  }
  if (state.likeAutoStopTimer) {
    clearTimeout(state.likeAutoStopTimer);
    state.likeAutoStopTimer = null;
  }
  if (state.commentTimer) {
    clearInterval(state.commentTimer);
    state.commentTimer = null;
  }
  if (state.commentAutoStopTimer) {
    clearTimeout(state.commentAutoStopTimer);
    state.commentAutoStopTimer = null;
  }

  state.likeAutoStopDeadline = null;
  state.commentAutoStopDeadline = null;

  state.autoLike = false;
  state.autoComment = false;
  state.likeLock = false;
  state.commentLock = false;

  if (!options.keepState) {
    state.lastLike = null;
    state.lastComment = null;
    state.lastMessage = "";
  } else if (options.reason) {
    state.lastMessage = options.reason;
  }

  if (options.closeWindow) {
    closeTikTokControlWindow(uid);
  } else {
    sendTikTokControlUpdate(uid, {
      state: serializeTikTokState(state),
      message: options.reason || "Automation dihentikan.",
    });
  }
}

function shouldOpenTikTokControl(serviceKey, targetUrl = "") {
  const normalized = (serviceKey || "").toLowerCase();
  if (normalized === "tiktok") return true;
  return isTikTokUrl(targetUrl);
}

function describeTikTokResult(feature, code) {
  if (!code) return "";
  const prefix = feature === "comment" ? "Komentar" : "Love";
  switch (code) {
    case "clicked":
      return `${prefix} dikirim.`;
    case "clicked-burst":
      return "Love dikirim (mode burst).";
    case "already-liked":
      return "Sudah memberi love.";
    case "key-like":
      return "Love dikirim via keyboard (L).";
    case "key-like-burst":
      return "Love dikirim via keyboard (spam L).";
    case "submitted-button":
    case "submitted-enter":
      return "Komentar terkirim.";
    case "no-button":
      return "Tombol love tidak ditemukan.";
    case "no-input":
      return "Kolom komentar tidak ditemukan.";
    case "empty-comment":
      return "Teks komentar kosong, isi terlebih dahulu.";
    case "not-on-tiktok":
      return "Bukan halaman tiktok.com.";
    default:
      return `${prefix} status: ${code}`;
  }
}

function updateTikTokSettings(uid, payload = {}) {
  const state = getTikTokAutomationState(uid);
  if (!state) return { success: false, message: "UID tidak valid." };

  if (payload.likeIntervalMs !== undefined) {
    const ms = Math.max(2000, Number(payload.likeIntervalMs) || 0);
    state.likeIntervalMs = ms;
  }
  if (payload.commentIntervalMs !== undefined) {
    const ms = Math.max(5000, Number(payload.commentIntervalMs) || 0);
    state.commentIntervalMs = ms;
  }
  if (payload.likeMode) {
    const mode = String(payload.likeMode || "").toLowerCase();
    if (["interval", "burst"].includes(mode)) {
      state.likeMode = mode;
    }
  }
  if (payload.burstDurationMs !== undefined) {
    const ms = Math.max(5000, Number(payload.burstDurationMs) || 0);
    state.burstDurationMs = ms;
  }
  if (payload.burstRestMs !== undefined) {
    const ms = Math.max(5000, Number(payload.burstRestMs) || 0);
    state.burstRestMs = ms;
  }
  if (payload.likeMaxDurationMs !== undefined) {
    const ms = Math.max(0, Number(payload.likeMaxDurationMs) || 0);
    state.likeMaxDurationMs = ms || null;
  }
  if (payload.commentMaxDurationMs !== undefined) {
    const ms = Math.max(0, Number(payload.commentMaxDurationMs) || 0);
    state.commentMaxDurationMs = ms || null;
  }
  if (payload.commentText !== undefined) {
    const sanitized = sanitizeTikTokComment(payload.commentText);
    state.commentText =
      sanitized || state.commentText || DEFAULT_TIKTOK_AUTOMATION_STATE.commentText;
  }
  if (Array.isArray(payload.commentPool)) {
    state.commentPool = payload.commentPool.filter((v) => sanitizeTikTokComment(v));
    state.commentIndex = 0;
    state.commentSentCount = 0;
  }
  if (payload.targetUrl) {
    state.targetUrl = payload.targetUrl;
  }

  // Apply new interval immediately if automation already running
  if (state.autoLike) {
    startTikTokAutoLike(uid);
  }
  if (state.autoComment) {
    startTikTokAutoComment(uid);
  }

  return { success: true, state: serializeTikTokState(state) };
}

function stopTikTokAutoLike(uid) {
  const state = getTikTokAutomationState(uid);
  if (!state) return;
  if (state.likeTimer) {
    clearInterval(state.likeTimer);
    state.likeTimer = null;
  }
  if (state.likeBurstTicker) {
    clearInterval(state.likeBurstTicker);
    state.likeBurstTicker = null;
  }
  if (state.likeRestTimer) {
    clearTimeout(state.likeRestTimer);
    state.likeRestTimer = null;
  }
  if (state.likeAutoStopTimer) {
    clearTimeout(state.likeAutoStopTimer);
    state.likeAutoStopTimer = null;
  }
  state.likeAutoStopDeadline = null;
  state.autoLike = false;
}

function stopTikTokAutoComment(uid) {
  const state = getTikTokAutomationState(uid);
  if (!state) return;
  if (state.commentTimer) {
    clearInterval(state.commentTimer);
    state.commentTimer = null;
  }
  if (state.commentAutoStopTimer) {
    clearTimeout(state.commentAutoStopTimer);
    state.commentAutoStopTimer = null;
  }
  state.commentAutoStopDeadline = null;
  state.autoComment = false;
}

function clearTikTokAutoStop(uid, kind = "like") {
  const state = getTikTokAutomationState(uid);
  if (!state) return;
  if (kind === "comment") {
    if (state.commentAutoStopTimer) {
      clearTimeout(state.commentAutoStopTimer);
      state.commentAutoStopTimer = null;
    }
    state.commentAutoStopDeadline = null;
  } else {
    if (state.likeAutoStopTimer) {
      clearTimeout(state.likeAutoStopTimer);
      state.likeAutoStopTimer = null;
    }
    state.likeAutoStopDeadline = null;
  }
}

function scheduleTikTokAutoStop(uid, kind = "like") {
  const state = getTikTokAutomationState(uid);
  if (!state) return;
  const duration =
    kind === "comment"
      ? Number(state.commentMaxDurationMs || 0)
      : Number(state.likeMaxDurationMs || 0);
  clearTikTokAutoStop(uid, kind);
  if (!duration || duration <= 0) return;

  const clamped = Math.max(5000, duration);
  const deadline = Date.now() + clamped;
  if (kind === "comment") {
    state.commentAutoStopDeadline = new Date(deadline).toISOString();
    state.commentAutoStopTimer = setTimeout(() => {
      state.lastMessage = "Auto comment dihentikan otomatis (durasi habis).";
      stopTikTokAutoComment(uid);
      sendTikTokControlUpdate(uid, {
        state: serializeTikTokState(state),
        message: state.lastMessage,
      });
    }, clamped);
  } else {
    state.likeAutoStopDeadline = new Date(deadline).toISOString();
    state.likeAutoStopTimer = setTimeout(() => {
      state.lastMessage = "Auto love dihentikan otomatis (durasi habis).";
      stopTikTokAutoLike(uid);
      sendTikTokControlUpdate(uid, {
        state: serializeTikTokState(state),
        message: state.lastMessage,
      });
    }, clamped);
  }
}

function nextCommentText(state) {
  if (!state) return "";
  const pool = Array.isArray(state.commentPool) ? state.commentPool : [];
  if (pool.length === 0) return state.commentText || "";
  const idx = state.commentIndex || 0;
  if (idx >= pool.length) return null; // selesai, jangan looping
  const text = pool[idx];
  state.commentIndex = idx + 1;
  return text;
}

async function performTikTokAutoLike(uid) {
  const state = getTikTokAutomationState(uid);
  const win = deviceWindows[uid];
  if (!state || !win || win.isDestroyed()) {
    teardownTikTokAutomation(uid, {
      closeWindow: false,
      keepState: true,
      reason: "Window TikTok tidak aktif.",
    });
    return;
  }
  if (state.likeLock) return;

  state.likeLock = true;
  try {
    const result = await win.webContents.executeJavaScript(
      `
        (() => {
          try {
            const mode = ${JSON.stringify(
              (getTikTokAutomationState(uid)?.likeMode || "").toLowerCase()
            )};
            if (!/tiktok\\.com/i.test(location.hostname)) return 'not-on-tiktok';
          const selectors = [
            'button[data-e2e="like-icon"]',
            'button[data-e2e="like-icon-button"]',
            'button[data-e2e="browse-like-icon"]',
            'button[data-e2e="like"]',
            'span[data-e2e="like-icon"]',
            'button[aria-label*="Like"]',
            'button[aria-label*="Suka"]'
          ];
          let btn = null;
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              btn = el.closest('button') || el;
              break;
            }
          }
          if (!btn) {
            btn = Array.from(document.querySelectorAll('button,div,span')).find(el => {
              const aria = (el.getAttribute('aria-label') || '').toLowerCase();
              return aria.includes('like') || aria.includes('suka');
            }) || null;
          }
          if (!btn) {
            // Fallback: tekan tombol "L" beberapa kali
            const pressKey = (delay, last = false) => {
              setTimeout(() => {
                const keyDown = new KeyboardEvent('keydown', {
                  key: 'l',
                  code: 'KeyL',
                  keyCode: 76,
                  which: 76,
                  bubbles: true,
                  cancelable: true
                });
                document.dispatchEvent(keyDown);
                const keyUp = new KeyboardEvent('keyup', {
                  key: 'l',
                  code: 'KeyL',
                  keyCode: 76,
                  which: 76,
                  bubbles: true,
                  cancelable: true
                });
                document.dispatchEvent(keyUp);
              }, delay);
            };
            const times = mode === 'burst' ? 6 : 1;
            for (let i = 0; i < times; i += 1) {
              pressKey(i * 35);
            }
            return times > 1 ? 'key-like-burst' : 'key-like';
          }
          const pressed =
            btn.getAttribute('aria-pressed') ||
            btn.getAttribute('aria-checked') ||
            btn.getAttribute('data-pressed');
          if (pressed === 'true') return 'already-liked';
          const clickOnce = () => {
            btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            btn.click();
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          };
          if (mode === 'burst') {
            for (let i = 0; i < 5; i += 1) {
              clickOnce();
              // Tambahkan spam key "L" super singkat agar mirip ketukan manual
              const keyDown = new KeyboardEvent('keydown', {
                key: 'l',
                code: 'KeyL',
                keyCode: 76,
                which: 76,
                bubbles: true,
                cancelable: true
              });
              const keyUp = new KeyboardEvent('keyup', {
                key: 'l',
                code: 'KeyL',
                keyCode: 76,
                which: 76,
                bubbles: true,
                cancelable: true
              });
              btn.dispatchEvent(keyDown);
              btn.dispatchEvent(keyUp);
            }
          } else {
            clickOnce();
          }
          return mode === 'burst' ? 'clicked-burst' : 'clicked';
        } catch (err) {
          return '__error__:' + (err && err.message ? err.message : err);
        }
        })();
      `,
      true
    );

    let finalResult = result;
    if (typeof result === "string" && result.startsWith("__error__:")) {
      finalResult = "error";
      state.lastMessage = `Auto love gagal: ${result.replace("__error__:", "")}`;
    } else {
      state.lastMessage = describeTikTokResult("like", result);
    }
    state.lastLike = { at: new Date().toISOString(), result: finalResult };
    sendTikTokControlUpdate(uid, {
      state: serializeTikTokState(state),
      message: state.lastMessage,
    });
  } catch (err) {
    state.lastLike = { at: new Date().toISOString(), result: "error" };
    state.lastMessage = `Auto love gagal: ${err?.message || err}`;
    sendTikTokControlUpdate(uid, {
      state: serializeTikTokState(state),
      message: state.lastMessage,
    });
  } finally {
    state.likeLock = false;
  }
}

async function performTikTokAutoComment(uid) {
  const state = getTikTokAutomationState(uid);
  const win = deviceWindows[uid];
  if (!state || !win || win.isDestroyed()) {
    teardownTikTokAutomation(uid, {
      closeWindow: false,
      keepState: true,
      reason: "Window TikTok tidak aktif.",
    });
    return;
  }
  if (state.commentLock) return;

  const text = sanitizeTikTokComment(nextCommentText(state));
  if (!text) {
    const finishedPool =
      Array.isArray(state.commentPool) && state.commentPool.length > 0;
    state.lastComment = { at: new Date().toISOString(), result: "empty-comment" };
    state.lastMessage = finishedPool
      ? "Semua komentar CSV sudah dieksekusi."
      : "Isi teks komentar terlebih dahulu.";
    sendTikTokControlUpdate(uid, {
      state: serializeTikTokState(state),
      message: state.lastMessage,
    });
    stopTikTokAutoComment(uid);
    return;
  }

  state.commentLock = true;
  try {
    const result = await win.webContents.executeJavaScript(
      `
        (() => {
          if (!/tiktok\\.com/i.test(location.hostname)) return 'not-on-tiktok';
          const openComment = () => {
            const btnSelectors = [
              'button[data-e2e="comment-icon"]',
              'button[data-e2e="comment-icon-button"]',
              'button[data-e2e="browse-comment-icon"]',
              'button[aria-label*="comment"]',
              'button[aria-label*="Comment"]',
              'button[aria-label*="Komentar"]',
              'button[data-e2e="comment-input"]',
              'button[data-e2e="comment-text"]'
            ];
            for (const sel of btnSelectors) {
              const btn = document.querySelector(sel);
              if (btn) {
                btn.click();
                return true;
              }
            }
            // Try shortcut "c" to open comment (spam sedikit)
            for (let i = 0; i < 3; i += 1) {
              const evt = new KeyboardEvent('keydown', {
                key: 'c',
                code: 'KeyC',
                keyCode: 67,
                which: 67,
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(evt);
            }
            return false;
          };
          openComment();
          const findInput = () => {
            const candidates = [
              'div[contenteditable="true"][data-e2e="comment-text"]',
              'div[contenteditable="true"][data-e2e="comment-input"]',
              'div[contenteditable="true"][data-e2e*="chat"]',
              'div[contenteditable="true"][role="textbox"]',
              'div[contenteditable="true"][aria-label*="comment"]',
              'div[contenteditable="true"][aria-label*="komentar"]',
              'div[contenteditable="plaintext-only"]',
              'div[contenteditable="plaintext-only"][placeholder]',
              'div[contenteditable="plaintext-only"].css-113kwq0',
              'textarea[data-e2e="comment-text"]',
              'textarea[data-e2e="comment-input"]',
              'textarea[aria-label*="comment"]',
              'textarea[aria-label*="komentar"]',
              'textarea[placeholder*="Type"]',
            ];
            for (const sel of candidates) {
              const el = document.querySelector(sel);
              if (el) return el;
            }
            return null;
          };
          let input = findInput();
          if (!input) {
            // coba scroll ke bawah lalu cari lagi
            try { window.scrollBy(0, 400); } catch (_) {}
            input = findInput();
            if (!input) {
              try { window.scrollBy(0, 800); } catch (_) {}
              input = findInput();
            }
          }
          if (!input) return 'no-input';
          input.focus();
          input.click();
          const text = ${JSON.stringify(text)};
          const applyValue = () => {
            input.innerText = text;
            input.textContent = text;
            try { document.execCommand('selectAll', false, null); } catch (_) {}
            try { document.execCommand('insertText', false, text); } catch (_) {}
            const evt = new InputEvent('input', { bubbles: true, data: text });
            input.dispatchEvent(evt);
            const ev2 = new Event('change', { bubbles: true });
            input.dispatchEvent(ev2);
          };
          input.focus();
          applyValue();
          const submit =
            input.closest('form')?.querySelector('button[type="submit"]') ||
            document.querySelector('button[data-e2e="comment-post"]') ||
            document.querySelector('button[data-e2e*="live"]') ||
            document.querySelector('button[aria-label*="Comment"]') ||
            document.querySelector('button[aria-label*="Kirim"]') ||
            document.querySelector('button[aria-label*="Send"]') ||
            Array.from(document.querySelectorAll('button')).find(b => {
              const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
              return label.includes('kirim') || label.includes('send') || label.includes('comment');
            });
          if (submit) {
            submit.click();
            return 'submitted-button';
          }
          const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          input.dispatchEvent(enter);
          return 'submitted-enter';
        })();
      `,
      true
    );

    state.lastComment = { at: new Date().toISOString(), result };
    state.lastMessage = describeTikTokResult("comment", result);
    if (!["not-on-tiktok", "no-input", "empty-comment", "error"].includes(result)) {
      state.commentSentCount = (state.commentSentCount || 0) + 1;
      const poolSize = Array.isArray(state.commentPool) ? state.commentPool.length : 0;
      if (poolSize > 0 && state.commentSentCount >= poolSize) {
        state.lastMessage = `Semua ${poolSize} komentar CSV selesai dieksekusi.`;
        stopTikTokAutoComment(uid);
      }
    }
    sendTikTokControlUpdate(uid, {
      state: serializeTikTokState(state),
      message: state.lastMessage,
    });
  } catch (err) {
    state.lastComment = { at: new Date().toISOString(), result: "error" };
    state.lastMessage = `Auto comment gagal: ${err?.message || err}`;
    sendTikTokControlUpdate(uid, {
      state: serializeTikTokState(state),
      message: state.lastMessage,
    });
  } finally {
    state.commentLock = false;
  }
}

function startTikTokAutoLike(uid) {
  const state = getTikTokAutomationState(uid);
  if (!state) return;
  stopTikTokAutoLike(uid);
  state.autoLike = true;

  if (state.likeMode === "burst") {
    const runBurst = () => {
      if (!state.autoLike) return;
      if (state.likeRestTimer) {
        clearTimeout(state.likeRestTimer);
        state.likeRestTimer = null;
      }
      if (state.likeBurstTicker) {
        clearInterval(state.likeBurstTicker);
        state.likeBurstTicker = null;
      }

      const burstDuration = Math.max(
        5000,
        Number(state.burstDurationMs || DEFAULT_TIKTOK_AUTOMATION_STATE.burstDurationMs)
      );
      const burstRest = Math.max(
        5000,
        Number(state.burstRestMs || DEFAULT_TIKTOK_AUTOMATION_STATE.burstRestMs)
      );

      state.lastMessage = `Auto love burst: spam ${(burstDuration / 1000).toFixed(
        0
      )} detik, jeda ${(burstRest / 1000).toFixed(0)} detik.`;
      sendTikTokControlUpdate(uid, {
        state: serializeTikTokState(state),
        message: state.lastMessage,
      });

      performTikTokAutoLike(uid);
      state.likeBurstTicker = setInterval(
        () => performTikTokAutoLike(uid),
        TIKTOK_BURST_SPAM_INTERVAL_MS
      );

      state.likeRestTimer = setTimeout(() => {
        if (state.likeBurstTicker) {
          clearInterval(state.likeBurstTicker);
          state.likeBurstTicker = null;
        }
        state.lastMessage = `Auto love burst: jeda ${(burstRest / 1000).toFixed(0)} detik.`;
        sendTikTokControlUpdate(uid, {
          state: serializeTikTokState(state),
          message: state.lastMessage,
        });
        state.likeRestTimer = setTimeout(() => {
          runBurst();
        }, burstRest);
      }, burstDuration);
    };

    runBurst();
    scheduleTikTokAutoStop(uid, "like");
    return;
  }

  const minInterval = 2000;
  const interval = Math.max(minInterval, Number(state.likeIntervalMs) || 0);
  const tick = () => performTikTokAutoLike(uid);
  tick();
  state.likeTimer = setInterval(tick, interval);
  scheduleTikTokAutoStop(uid, "like");
  sendTikTokControlUpdate(uid, {
    state: serializeTikTokState(state),
    message: "Auto love berjalan.",
  });
}

function startTikTokAutoComment(uid) {
  const state = getTikTokAutomationState(uid);
  if (!state) return;
  stopTikTokAutoComment(uid);
  state.autoComment = true;
  const interval = Math.max(5000, Number(state.commentIntervalMs) || 0);
  const tick = () => performTikTokAutoComment(uid);
  tick();
  state.commentTimer = setInterval(tick, interval);
  scheduleTikTokAutoStop(uid, "comment");
  sendTikTokControlUpdate(uid, {
    state: serializeTikTokState(state),
    message: "Auto comment berjalan.",
  });
}
function getUAForMode(mode) {
  const desktopUA = buildWhatsAppUserAgent(cachedChromeVersion || DEFAULT_CHROME_VERSION);
  if (!mode || mode.startsWith('desktop') ||
      ['compact','square','portrait','landscape','mobile-browser-desktop'].includes(mode)) {
    return desktopUA;
  }
  if (mode.includes('ipad') || mode.includes('tablet-ipad')) {
    return 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A5341f Safari/604.1';
  }
  if (mode.includes('iphone')) {
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
  }
  if (mode.includes('samsung') || mode.includes('tablet-samsung')) {
    return 'Mozilla/5.0 (Linux; Android 12; SM-X906B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
  }
  // All other Android/mobile modes
  return 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36';
}

function createDeviceWindow(uid, service, options = {}) {
  const { autoShow = true } = options;
  const serviceKey = (service || "").toLowerCase();
  const selected = services[serviceKey] || services.other;

  let deviceName = selected.name;
  let mode = "desktop";
  let autoSenderEnabled = false;
  let pendingUrl = "";
  let customUrl = "";

  const config = getDeviceConfig(uid);
  if (config) {
    if (config.name) deviceName = config.name;
    if (config.mode) mode = config.mode;
    autoSenderEnabled = Boolean(
      config.autoSender && allowAutoSenderForService(config.service || service)
    );
    pendingUrl = autoSenderEnabled ? config.pendingUrl || "" : "";
    customUrl = config.customUrl || "";
  }

  const targetUrlForService =
    serviceKey === "other"
      ? sanitizeCustomUrl(customUrl)
      : selected.url || "";
  const shouldAttachTikTok = shouldOpenTikTokControl(
    serviceKey,
    targetUrlForService
  );
  if (shouldAttachTikTok) {
    updateTikTokSettings(uid, { targetUrl: targetUrlForService });
  } else {
    teardownTikTokAutomation(uid, { closeWindow: true });
  }

  const isMobile = mode?.startsWith("mobile");
  let width = 1000;
  let height = 700;
  let userAgent = "";
  const getDesktopChromeUserAgent = () =>
    buildWhatsAppUserAgent(cachedChromeVersion || DEFAULT_CHROME_VERSION);

  switch (mode) {
    // Mobile Phones
    case "mobile-iphone":
      width = 390;
      height = 844;
      userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
      break;
    case "mobile-iphone-pro":
      width = 430;
      height = 932;
      userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
      break;
    case "mobile-iphone-se":
      width = 375;
      height = 667;
      userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
      break;
    case "mobile-android":
      width = 393;
      height = 851;
      userAgent =
        "Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-galaxy-s8":
      width = 360;
      height = 740;
      userAgent =
        "Mozilla/5.0 (Linux; Android 7.0; SM-G950U Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-galaxy-s23":
      width = 384;
      height = 854;
      userAgent =
        "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-pixel-5":
      width = 393;
      height = 851;
      userAgent =
        "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-pixel-7":
      width = 412;
      height = 915;
      userAgent =
        "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-oneplus":
      width = 412;
      height = 869;
      userAgent =
        "Mozilla/5.0 (Linux; Android 12; OnePlus 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;
    case "mobile-browser-desktop":
      width = 480;
      height = 700;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
      break;

    // Tablets
    case "tablet-ipad":
    case "mobile-ipad":
      width = 768;
      height = 1024;
      userAgent =
        "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A5341f Safari/604.1";
      break;
    case "tablet-ipad-pro":
      width = 834;
      height = 1194;
      userAgent =
        "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
      break;
    case "tablet-ipad-pro-13":
      width = 1024;
      height = 1366;
      userAgent =
        "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
      break;
    case "tablet-android":
      width = 800;
      height = 1280;
      userAgent =
        "Mozilla/5.0 (Linux; Android 11; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "tablet-samsung":
      width = 1200;
      height = 1600;
      userAgent =
        "Mozilla/5.0 (Linux; Android 12; SM-X906B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;

    // Desktop
    case "desktop":
      width = 1000;
      height = 700;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "desktop-mini":
      width = 800;
      height = 600;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "desktop-hd":
      width = 1366;
      height = 768;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "desktop-full-hd":
      width = 1920;
      height = 1080;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "desktop-2k":
      width = 2560;
      height = 1440;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "desktop-wide":
      width = 1280;
      height = 800;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "desktop-ultrawide":
      width = 2560;
      height = 1080;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "desktop-4k":
      width = 3840;
      height = 2160;
      userAgent = getDesktopChromeUserAgent();
      break;

    // Special Modes
    case "compact":
      width = 600;
      height = 400;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "square":
      width = 700;
      height = 700;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "portrait":
      width = 600;
      height = 900;
      userAgent = getDesktopChromeUserAgent();
      break;
    case "landscape":
      width = 900;
      height = 600;
      userAgent = getDesktopChromeUserAgent();
      break;

    default:
      width = 1000;
      height = 700;
      userAgent = getDesktopChromeUserAgent();
      break;
  }

  const win = new BrowserWindow({
    width,
    height,
    title: withBrandTitle(deviceName),
    autoHideMenuBar: true,
    icon: getAssetPath(selected.icon),
    show: false,
    useContentSize: true,
    fullscreenable: false,
    simpleFullscreen: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), "preload.cjs"),
      partition: `persist:${uid}`,
    },
  });

  const enforceWindowSize = () => {
    try {
      win.setFullScreen(false);
      if (typeof win.unmaximize === "function" && win.isMaximized()) {
        win.unmaximize();
      }
      win.setContentSize(Math.round(width), Math.round(height));
    } catch (err) {
      console.warn("⚠️ Gagal menerapkan ukuran window:", err?.message || err);
    }
  };

  win.webContents.on("page-title-updated", (e) => {
    e.preventDefault(); // 🔒 cegah perubahan title
    win.setTitle(withBrandTitle(deviceName)); // 🔄 pastikan title tetap sesuai device
  });
  win.once("ready-to-show", () => {
    enforceWindowSize();
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
    enforceWindowSize();
    if (autoShow) {
      win.show();
      win.focus();
    }
  });

  win.on("show", enforceWindowSize);
  win.on("restore", enforceWindowSize);

  // Load URL or local file based on service type
  if (serviceKey === "other") {
    const targetUrl = sanitizeCustomUrl(customUrl);
    if (!targetUrl) {
      console.error(
        `❌ Device ${uid} menggunakan layanan custom tanpa URL yang valid.`
      );
      win.loadURL("about:blank");
    } else {
      win.loadURL(targetUrl, {
        userAgent,
      });
    }
  } else if (selected.isLocalFile) {
    // For local HTML files like android-emulator.html
    const fileUrl = `${selected.url}?uid=${encodeURIComponent(uid)}`;
    win.loadFile(fileUrl.split("?")[0]).then(() => {
      // Navigate to include query params
      const fullPath = path.join(__dirname, selected.url);
      win.loadURL(`file://${fullPath}?uid=${encodeURIComponent(uid)}`);
    });
  } else {
    // For web URLs
    win.loadURL(selected.url, {
      userAgent,
    });
  }

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

  if (shouldAttachTikTok) {
    ensureTikTokControlWindow(uid, win, {
      deviceName,
      targetUrl: targetUrlForService || selected.url || "tiktok.com",
    }).catch((err) =>
      console.warn(
        "⚠️ Gagal membuka kontrol TikTok:",
        err?.message || err
      )
    );
  }

  if (autoSenderEnabled) {
    ensureMonitorWindow(uid, win).catch(() => {});
  }

  win.on("close", () => {
    console.log(`[WIN] Window close event untuk UID ${uid}`);
    updateDeviceStatus(uid, "stopped");
  });

  win.on("closed", () => {
    console.log(`[WIN] Window closed event untuk UID ${uid}`);
    teardownTikTokAutomation(uid, {
      closeWindow: true,
      keepState: true,
      reason: "Jendela utama ditutup.",
    });
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
    title: withVersionSuffix("Starbox Emulator"),
    autoHideMenuBar: true,
    icon: getAssetPath("starbox.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), "preload.cjs"),
      allowRunningInsecureContent: true,
      webSecurity: false,
    },
  });
  // mainWindow.maximize();
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

ipcMain.handle("auth-get-session", () => sanitizeAuthSession());

ipcMain.handle("auth-logout", () => {
  stopRemoteClient();
  clearAuthSession();
  return { success: true };
});

ipcMain.handle("auth-login", async (_event, credentials = {}) => {
  const email = (credentials.email || "").trim();
  const password = credentials.password || "";

  if (!email || !password) {
    return {
      success: false,
      message: "Email dan password wajib diisi.",
    };
  }

  try {
    const data = await callAuthEndpoint("login", {
      email,
      password,
    });
    const overrides = {
      email,
      expiresIn: data.expires_in || data.expiresIn || null,
      packageExpiresAt:
        data.package_expires_at || data.packageExpiresAt || null,
    };
    const session = applyAuthSessionFromPayload(data, overrides);
    logDev("📦 Paket aktif:", {
      name: session.package?.name || "Default",
      device_limit: session.package?.device_limit ?? session.deviceQuota,
      allows_private_service: session.allowsPrivateService,
      allows_android_emulator: session.allowsAndroidEmulator,
      allows_ios_simulator: session.allowsIosSimulator,
      expires_at: session.packageExpiresAt,
    });
    const displayName = session.user?.name || session.user?.email || email;
    sendSystemInfoReport({
      eventType: "login",
      accountSnapshot: session,
    });
    await refreshPackageInfo();
    startRemoteClient();
    // Auto-pull Remox dari server setelah login (tidak blocking, tidak perlu menunggu)
    pullRemoxFromCloud().catch(() => {});
    return {
      success: true,
      session,
      message: `Berhasil login sebagai ${displayName}.`,
    };
  } catch (err) {
    console.error("❌ Login gagal:", err?.message || err);
    return {
      success: false,
      message:
        err?.message || "Login gagal. Periksa koneksi atau kredensial Anda.",
      details: err?.details || null,
    };
  }
});

ipcMain.handle("auth-refresh-package", async () => {
  try {
    const session = await refreshPackageInfo();
    return {
      success: true,
      session: session || sanitizeAuthSession(),
    };
  } catch (err) {
    console.error("❌ Gagal refresh paket:", err?.message || err);
    return {
      success: false,
      message:
        err?.message ||
        "Gagal menyinkronkan paket. Periksa koneksi internet Anda.",
    };
  }
});

ipcMain.handle("auth-register", async (_event, payload = {}) => {
  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const password = payload.password || "";
  const phoneCode = (payload.phone_code || payload.phonecode || "").trim();
  const phone = (payload.phone || "").trim();

  if (!name || !email || !password || !phoneCode || !phone) {
    return {
      success: false,
      message:
        "Nama, email, password, kode telepon, dan nomor telepon wajib diisi.",
    };
  }

  try {
    const data = await callAuthEndpoint("register", {
      name,
      email,
      password,
      password_confirmation: password,
      phone_code: phoneCode,
      phone,
    });

    const hasToken = !!(
      data?.token ||
      data?.accessToken ||
      data?.access_token ||
      data?.data?.token ||
      data?.data?.accessToken ||
      data?.data?.access_token
    );

    let session = sanitizeAuthSession();
    if (hasToken) {
      session = applyAuthSessionFromPayload(data, {
        email,
        name,
        phone_code: phoneCode,
        phone,
        expiresIn: data.expires_in || data.expiresIn || null,
        packageExpiresAt:
          data.package_expires_at || data.packageExpiresAt || null,
      });
      logDev("📦 Paket aktif (registrasi):", {
        name: session.package?.name || "Default",
        device_limit: session.package?.device_limit ?? session.deviceQuota,
        allows_private_service: session.allowsPrivateService,
        allows_android_emulator: session.allowsAndroidEmulator,
        allows_ios_simulator: session.allowsIosSimulator,
        expires_at: session.packageExpiresAt,
      });

      sendSystemInfoReport({
        eventType: "login",
        accountSnapshot: session,
      });
    }

    const message =
      data?.message ||
      (hasToken
        ? "Registrasi berhasil dan Anda sudah login."
        : "Registrasi berhasil. Silakan login untuk melanjutkan.");

    return {
      success: true,
      session,
      autoLogin: hasToken,
      message,
    };
  } catch (err) {
    console.error("❌ Registrasi gagal:", err?.message || err);
    return {
      success: false,
      message:
        err?.message || "Registrasi gagal. Silakan coba lagi beberapa saat.",
      details: err?.details || null,
    };
  }
});

ipcMain.handle("auth-change-password", async (_event, payload = {}) => {
  const currentPassword = payload.currentPassword || "";
  const newPassword = payload.newPassword || "";
  const confirmPassword = payload.confirmPassword || "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, message: "Semua field password wajib diisi." };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, message: "Password baru dan konfirmasi tidak cocok." };
  }
  if (newPassword.length < 8) {
    return { success: false, message: "Password baru minimal 8 karakter." };
  }

  try {
    const data = await callAuthEndpoint("change-password", {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    });
    return { success: true, message: data?.message || "Password berhasil diubah." };
  } catch (err) {
    console.error("❌ Ganti password gagal:", err?.message || err);
    return {
      success: false,
      message: err?.message || "Gagal mengubah password. Periksa password lama Anda.",
      details: err?.details || null,
    };
  }
});

ipcMain.handle("get-service-catalog", () => cachedServiceCatalog);

ipcMain.handle("resolve-asset-url", (_event, assetName) => {
  if (!assetName) return null;
  try {
    const assetPath = getAssetPath(assetName);
    return pathToFileURL(assetPath).toString();
  } catch (err) {
    console.error("⚠️ Gagal mengubah asset path:", err?.message || err);
    return null;
  }
});

ipcMain.handle("get-country-codes", async () => {
  try {
    const jsonPath = getAssetPath("country.json");
    const raw = await fs.promises.readFile(jsonPath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error("Format country.json tidak valid");
    }
    return { success: true, data };
  } catch (err) {
    console.error("⚠️ Gagal memuat country.json:", err?.message || err);
    return {
      success: false,
      message: err?.message || "Gagal memuat kode negara.",
    };
  }
});

ipcMain.handle("is-dev-build", () => IS_DEV_BUILD);

ipcMain.handle("download-iso", async (event, { url, filename }) => {
  try {
    const isoDir = path.join(app.getPath("userData"), "isos");
    fs.mkdirSync(isoDir, { recursive: true });
    const destPath = path.join(isoDir, filename);
    const cacheFile = path.join(isoDir, "cache.json");

    // Return immediately if already downloaded
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 1024 * 100) {
        return { success: true, localPath: destPath, cached: true };
      }
      fs.unlinkSync(destPath); // Remove corrupted/partial file
    }

    const win = BrowserWindow.fromWebContents(event.sender);

    // Download with proper redirect following (up to 10 hops)
    const doDownload = (currentUrl, redirectCount = 0) => new Promise((resolve, reject) => {
      if (redirectCount > 10) { reject(new Error("Terlalu banyak redirect")); return; }
      const httpMod = currentUrl.startsWith("https") ? require("https") : require("http");
      const file = fs.createWriteStream(destPath);
      let downloaded = 0;
      let total = 0;
      const req = httpMod.get(currentUrl, { timeout: 30000 }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          file.close();
          fs.unlink(destPath, () => {});
          const loc = res.headers.location;
          if (!loc) { reject(new Error("Redirect tanpa header Location")); return; }
          const nextUrl = loc.startsWith("http") ? loc : new URL(loc, currentUrl).href;
          doDownload(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        total = parseInt(res.headers["content-length"] || "0", 10);
        res.pipe(file);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          const pct = total > 0 ? Math.round((downloaded / total) * 100) : -1;
          win?.webContents?.send("iso-download-progress", { pct, downloaded, total, filename });
        });
        file.on("finish", () => { file.close(); resolve(); });
      });
      req.on("error", (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
      req.on("timeout", () => {
        req.destroy();
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error("Timeout saat download"));
      });
    });

    await doDownload(url);

    // Update cache.json
    let cache = [];
    try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch (_) {}
    if (!cache.find(c => c.filename === filename)) {
      cache.push({ filename, localPath: destPath, url, downloadedAt: new Date().toISOString(), sizeMb: Math.round(fs.statSync(destPath).size / 1024 / 1024) });
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    }

    return { success: true, localPath: destPath };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal download ISO." };
  }
});

ipcMain.handle("list-cached-isos", () => {
  try {
    const cacheFile = path.join(app.getPath("userData"), "isos", "cache.json");
    if (!fs.existsSync(cacheFile)) return [];
    const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    return cache.filter(c => fs.existsSync(c.localPath));
  } catch (_) { return []; }
});

ipcMain.handle("open-vnc-window", async (_event, { vmId, wsPort, vmName }) => {
  try {
    // Focus existing window if already open
    const existing = vncWindows.get(vmId);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return { success: true, focused: true };
    }

    const vncPreloadPath = path.join(__dirname, "vnc-preload.cjs");
    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      minWidth: 640,
      minHeight: 480,
      title: `VNC — ${vmName || vmId}`,
      backgroundColor: "#0b1220",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: fs.existsSync(vncPreloadPath) ? vncPreloadPath : undefined,
      },
    });

    win.loadFile("vnc-viewer.html", {
      query: { host: "127.0.0.1", port: String(wsPort), vmId, vmName: vmName || "" },
    });

    win.on("closed", () => {
      vncWindows.delete(vmId);
    });

    vncWindows.set(vmId, win);
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

ipcMain.handle("focus-vnc-window", (_event, vmId) => {
  const win = vncWindows.get(vmId);
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return { found: true };
  }
  return { found: false };
});

ipcMain.handle("get-vnc-source-id", async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false };
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 0, height: 0 },
    });
    const title = win.getTitle();
    const found = sources.find((s) => s.name === title) ||
                  sources.find((s) => s.name.includes("VNC"));
    if (!found) return { ok: false, error: "Source not found" };
    return { ok: true, sourceId: found.id };
  } catch (err) {
    return { ok: false, error: err?.message };
  }
});

ipcMain.handle("browse-iso-file", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Pilih File ISO",
      filters: [
        { name: "ISO Files", extensions: ["iso", "img"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths?.length) {
      return { success: false, canceled: true };
    }
    return { success: true, path: result.filePaths[0] };
  } catch (err) {
    console.error("❌ Error browsing ISO file:", err);
    return { success: false, message: err?.message || "Gagal membuka file picker" };
  }
});

ipcMain.handle("os-vm-list", async () => {
  try {
    const items = virtualOSStorage ? virtualOSStorage.list() : [];
    return { success: true, items };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal membaca VM list." };
  }
});

ipcMain.handle("os-vm-upsert", async (_event, payload = {}) => {
  try {
    const record = virtualOSStorage
      ? virtualOSStorage.upsert(payload)
      : null;
    return { success: true, record };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal menyimpan VM." };
  }
});

ipcMain.handle("os-vm-delete", async (_event, id) => {
  try {
    virtualOSStorage?.remove(id);
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal menghapus VM." };
  }
});

async function doStartVm(id) {
    const vm = virtualOSStorage?.get(id);
    if (!vm) throw new Error("VM tidak ditemukan.");

    // Validate VM configuration
    if (!vm.isoPath && !vm.diskPath) {
      throw new Error("VM memerlukan ISO file atau disk image untuk boot.\n\nSilakan tambahkan ISO file terlebih dahulu.");
    }

    // Check if ISO file exists (skip check for URLs — QEMU handles them directly or they should be downloaded first)
    if (vm.isoPath && !vm.isoPath.startsWith("http://") && !vm.isoPath.startsWith("https://")) {
      if (!fs.existsSync(vm.isoPath)) {
        throw new Error(`ISO file tidak ditemukan: ${vm.isoPath}\n\nPastikan file ISO sudah ada di lokasi tersebut.`);
      }
    } else if (vm.isoPath && (vm.isoPath.startsWith("http://") || vm.isoPath.startsWith("https://"))) {
      throw new Error(
        `ISO path berupa URL, bukan file lokal.\n\nURL: ${vm.isoPath}\n\nGunakan dropdown "Pilih OS ringan" di modal Edit VM untuk mengunduh ISO secara otomatis ke disk lokal.`
      );
    }

    // Check if disk file exists (if specified)
    let diskPath = vm.diskPath;
    if (!diskPath) {
      const vmDir = path.join(userDataPath || app.getPath("userData"), "vm");
      fs.mkdirSync(vmDir, { recursive: true });
      diskPath = path.join(vmDir, `${id || Date.now()}.qcow2`);
    }
    if (!fs.existsSync(diskPath)) {
      const sizeGb = Math.max(5, Math.min(2048, vm.storageGb || 20));
      const imgResult = spawnSync("qemu-img", [
        "create",
        "-f",
        "qcow2",
        diskPath,
        `${sizeGb}G`,
      ]);
      if (imgResult.error) {
        console.warn("⚠️ qemu-img create error:", imgResult.error?.message || imgResult.error);
      } else {
        console.log("✅ Disk image created:", diskPath);
      }
    }

    if (vmProcesses.has(id)) {
      const existing = vmProcesses.get(id);
      // Check if process is still actually alive
      if (existing && !existing.killed) {
        try {
          process.kill(existing.pid, 0); // signal 0 = just check
          const wsPort = await ensureVncProxy(id, "127.0.0.1", vm.vncPort || 5901);
          return { success: true, vm: { ...vm, status: "running" }, message: "VM sudah berjalan.", wsPort };
        } catch (_) {
          // Process is dead but still in map — fall through to restart
          vmProcesses.delete(id);
          stopVncProxy(id);
        }
      } else {
        vmProcesses.delete(id);
        stopVncProxy(id);
      }
    }

    // Kill any stale process holding the disk file (macOS/Linux)
    if (diskPath && process.platform !== "win32") {
      try {
        const lsofResult = spawnSync("lsof", ["-t", diskPath], { timeout: 3000 });
        if (!lsofResult.error && lsofResult.stdout) {
          const pids = lsofResult.stdout.toString().trim().split("\n").filter(Boolean);
          for (const pid of pids) {
            try {
              process.kill(parseInt(pid), "SIGKILL");
              console.log(`🔪 Killed stale process ${pid} holding ${diskPath}`);
            } catch (_) {}
          }
          if (pids.length > 0) {
            // Give OS a moment to release file locks
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } catch (_) {}
    }

    // Resolve QEMU binary — use vm setting, findQemuBin(), or fallback name
    const _qemuFallback = process.platform === 'win32' ? 'qemu-system-x86_64.exe' : 'qemu-system-x86_64';
    const qemuBin = vm.qemuBinary || findQemuBin() || _qemuFallback;

    // Check if QEMU is installed
    try {
      const checkQemu = spawnSync(qemuBin, ["--version"]);
      if (checkQemu.error) {
        throw new Error(
          `QEMU tidak terinstall atau tidak ditemukan.\n\n` +
          `Binary: ${qemuBin}\n\n` +
          `Install QEMU:\n` +
          `• macOS: brew install qemu\n` +
          `• Ubuntu/Debian: sudo apt install qemu-system-x86\n` +
          `• Windows: https://qemu.org/download`
        );
      }
      console.log(`✅ QEMU found: ${qemuBin}`);
    } catch (err) {
      throw new Error(`Gagal memeriksa QEMU: ${err.message}`);
    }

    const args = [
      "-m",
      String(vm.memoryMb || 1024),
      "-smp",
      String(vm.cpu || 1),
    ];

    if (diskPath) {
      args.push("-drive", `file=${diskPath},format=qcow2,if=ide`);
    }
    if (vm.isoPath) {
      args.push("-cdrom", vm.isoPath);
      if (vm.bootOrder) {
        args.push("-boot", vm.bootOrder);
      }
    }
    if (vm.osType === "windows") {
      args.push("-machine", "type=pc,accel=tcg");
    }

    // Find available VNC port
    const requestedPort = vm.vncPort || 5901;
    const availablePort = await findAvailableVncPort(requestedPort);
    const displayNumber = availablePort - 5900;

    // Update VM with actual VNC port being used
    if (availablePort !== requestedPort) {
      console.log(`⚠️ VNC port ${requestedPort} tidak tersedia, menggunakan port ${availablePort}`);
      virtualOSStorage?.upsert({ id, vncPort: availablePort });
    }

    // VNC with no password authentication for easier connection
    args.push("-vnc", `127.0.0.1:${displayNumber},password=off`);

    if (process.platform === "linux" && vm.enableKvm !== false) {
      args.push("-enable-kvm");
    }

    console.log(`🚀 Starting QEMU for VM ${id}:`, qemuBin, args.join(" "));

    const child = spawn(qemuBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    // Collect stderr for early-exit error reporting
    const stderrLines = [];
    child.stdout?.on("data", (data) => {
      console.log(`[QEMU ${id}] ${data.toString().trim()}`);
    });
    child.stderr?.on("data", (data) => {
      const line = data.toString().trim();
      console.error(`[QEMU ${id} ERR] ${line}`);
      stderrLines.push(line);
    });

    child.on("error", (err) => {
      console.error(`❌ QEMU spawn error for VM ${id}:`, err);
      vmProcesses.delete(id);
      stopVncProxy(id);
      virtualOSStorage?.stop(id);
    });

    child.on("exit", (code, signal) => {
      console.log(`⚠️ QEMU exited for VM ${id}. Code: ${code}, Signal: ${signal}`);
      vmProcesses.delete(id);
      stopVncProxy(id);
      virtualOSStorage?.stop(id);
    });

    vmProcesses.set(id, child);

    // Wait briefly and confirm process is still alive
    await new Promise((r) => setTimeout(r, 600));
    if (!vmProcesses.has(id) || child.killed || child.exitCode !== null) {
      const errDetail = stderrLines.slice(-5).join(" | ") || "QEMU exited immediately.";
      // Check for the common "image locked" error
      const isLocked = stderrLines.some((l) =>
        l.includes("Is another process using the image") || l.includes("Failed to get shared lock")
      );
      let hint = "";
      if (isLocked) {
        hint = "\n\nAda proses QEMU lain yang masih mengunci file disk. Klik 'Stop' terlebih dahulu atau restart aplikasi.";
      }
      throw new Error(`QEMU gagal start.${hint}\n\nDetail: ${errDetail}`);
    }

    // Wait for VNC to be ready and create proxy
    const wsPort = await ensureVncProxy(id, "127.0.0.1", availablePort);

    const updated = virtualOSStorage?.start(id);
    console.log(`✅ VM ${id} started. PID: ${child.pid}, VNC WS: ${wsPort}`);

    return { success: true, vm: updated, pid: child.pid, wsPort };
}

ipcMain.handle("os-vm-start", async (_event, id) => {
  try {
    return await doStartVm(id);
  } catch (err) {
    console.error(`❌ Failed to start VM ${id}:`, err);
    return { success: false, message: err?.message || "Gagal menjalankan VM." };
  }
});

ipcMain.handle("os-vm-stop", async (_event, id) => {
  try {
    const proc = vmProcesses.get(id);
    if (proc) {
      // Try graceful SIGTERM first, then force SIGKILL
      try { proc.kill("SIGTERM"); } catch (_) {}
      await new Promise((r) => setTimeout(r, 800));
      try {
        if (!proc.killed && proc.exitCode === null) {
          proc.kill("SIGKILL");
        }
      } catch (_) {}
      vmProcesses.delete(id);
    }
    stopVncProxy(id);
    const vm = virtualOSStorage?.stop(id);
    return { success: true, vm };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal menghentikan VM." };
  }
});

ipcMain.handle("os-vm-restart", async (_event, id) => {
  try {
    // Stop first (reuse stop logic)
    const proc = vmProcesses.get(id);
    if (proc) {
      try { proc.kill("SIGTERM"); } catch (_) {}
      await new Promise((r) => setTimeout(r, 800));
      try { if (!proc.killed && proc.exitCode === null) proc.kill("SIGKILL"); } catch (_) {}
      vmProcesses.delete(id);
    }
    stopVncProxy(id);
    virtualOSStorage?.stop(id);
    // Start again using shared function
    return await doStartVm(id);
  } catch (err) {
    return { success: false, message: err?.message || "Gagal restart VM." };
  }
});

ipcMain.handle("os-vm-force-stop", async (_event, id) => {
  try {
    const proc = vmProcesses.get(id);
    if (proc) {
      try { proc.kill("SIGKILL"); } catch (_) {}
      vmProcesses.delete(id);
    }
    stopVncProxy(id);
    virtualOSStorage?.stop(id);
    // Also kill by lsof on disk file (macOS/Linux)
    const vm = virtualOSStorage?.get(id);
    if (vm?.diskPath && process.platform !== "win32") {
      try {
        const lsofResult = spawnSync("lsof", ["-t", vm.diskPath], { timeout: 3000 });
        if (!lsofResult.error && lsofResult.stdout) {
          const pids = lsofResult.stdout.toString().trim().split("\n").filter(Boolean);
          for (const pid of pids) {
            try { process.kill(parseInt(pid), "SIGKILL"); } catch (_) {}
          }
        }
      } catch (_) {}
    }
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

ipcMain.handle("os-vm-pause", async (_event, id) => {
  try {
    const proc = vmProcesses.get(id);
    if (!proc) return { success: false, message: "VM tidak ditemukan / tidak berjalan." };
    process.kill(proc.pid, "SIGSTOP");
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

ipcMain.handle("os-vm-resume", async (_event, id) => {
  try {
    const proc = vmProcesses.get(id);
    if (!proc) return { success: false, message: "VM tidak ditemukan / tidak berjalan." };
    process.kill(proc.pid, "SIGCONT");
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

ipcMain.handle("os-vm-kill-all-qemu", async () => {
  try {
    const killed = [];
    // Kill all tracked QEMU processes
    for (const [vmId, proc] of vmProcesses.entries()) {
      try { proc.kill("SIGKILL"); } catch (_) {}
      vmProcesses.delete(vmId);
      stopVncProxy(vmId);
      virtualOSStorage?.stop(vmId);
      killed.push(vmId);
    }
    // Also kill any stray qemu processes by name (macOS/Linux)
    if (process.platform !== "win32") {
      try {
        spawnSync("pkill", ["-9", "-f", "qemu-system"], { timeout: 3000 });
      } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 500));
    return { success: true, killed };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

ipcMain.handle("os-vm-snapshot", async (_event, id, name) => {
  try {
    const result = virtualOSStorage?.snapshot(id, name);
    return { success: true, vm: result?.vm, snapshot: result?.snapshot };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal membuat snapshot." };
  }
});

// Helper function to check if a port is available
async function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const testServer = nodeNet.createServer();
    testServer.once('error', () => {
      resolve(false);
    });
    testServer.once('listening', () => {
      testServer.close();
      resolve(true);
    });
    testServer.listen(port, host);
  });
}

// Helper function to find next available VNC port
async function findAvailableVncPort(startPort = 5901, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`Tidak dapat menemukan VNC port yang tersedia setelah ${maxAttempts} percobaan mulai dari port ${startPort}`);
}

// Helper function to wait for VNC port to be ready
async function waitForVncPort(host, port, maxRetries = 30, delayMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const testSocket = nodeNet.createConnection({ host, port }, () => {
          testSocket.end();
          resolve();
        });
        testSocket.on("error", reject);
        testSocket.setTimeout(1000, () => {
          testSocket.destroy();
          reject(new Error("timeout"));
        });
      });
      return true;
    } catch (err) {
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(`VNC port ${host}:${port} tidak ready setelah ${maxRetries} percobaan`);
}

async function ensureVncProxy(id, host, port) {
  if (vmVncProxies.has(id)) {
    return vmVncProxies.get(id).port;
  }

  // Wait for VNC server to be ready before creating proxy
  await waitForVncPort(host, port);

  return new Promise((resolve, reject) => {
    const wss = new WebSocket.Server({ port: 0 }, () => {
      const wsPort = wss.address().port;
      vmVncProxies.set(id, { wss, port: wsPort });
      console.log(`✅ VNC proxy created for VM ${id}: ws://localhost:${wsPort} -> vnc://${host}:${port}`);
      resolve(wsPort);
    });
    wss.on("connection", (ws) => {
      console.log(`🔌 Client connected to VNC proxy for VM ${id}`);

      // Retry connection to VNC server with exponential backoff
      let retryCount = 0;
      const maxRetries = 5;

      function connectToVnc() {
        const socket = nodeNet.createConnection({ host, port }, () => {
          console.log(`✅ VNC proxy connected to QEMU VNC server ${host}:${port}`);

          ws.on("message", (data) => {
            if (socket.writable) {
              socket.write(data);
            }
          });
          ws.on("close", () => {
            if (!socket.destroyed) {
              socket.end();
            }
          });
          ws.on("error", (err) => {
            console.error(`❌ WebSocket error for VM ${id}:`, err.message);
            if (!socket.destroyed) {
              socket.destroy();
            }
          });

          socket.on("data", (chunk) => {
            if (ws.readyState === 1) {
              ws.send(chunk);
            }
          });
          socket.on("close", () => {
            if (ws.readyState === 1) {
              ws.close();
            }
          });
          socket.on("error", (err) => {
            console.error(`❌ VNC socket error for VM ${id}:`, err.message);
            if (ws.readyState === 1) {
              ws.close();
            }
          });
        });

        socket.on("error", (err) => {
          console.error(`❌ Failed to connect to VNC server (attempt ${retryCount + 1}/${maxRetries}):`, err.message);

          if (retryCount < maxRetries) {
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
            console.log(`🔄 Retrying VNC connection in ${delay}ms...`);
            setTimeout(connectToVnc, delay);
          } else {
            console.error(`❌ Max retries reached for VNC connection to VM ${id}`);
            if (ws.readyState === 1) {
              ws.close(1011, "VNC server unavailable after retries");
            }
          }
        });
      }

      connectToVnc();
    });
    wss.on("error", (err) => {
      console.error(`❌ VNC WebSocket server error for VM ${id}:`, err.message);
      reject(err);
    });
  });
}

function stopVncProxy(id) {
  const proxy = vmVncProxies.get(id);
  if (proxy?.wss) {
    try {
      proxy.wss.clients.forEach((c) => c.terminate());
      proxy.wss.close();
    } catch {
      // ignore
    }
  }
  vmVncProxies.delete(id);
}

ipcMain.handle("check-latest-version", async (_event, channel = "stable") => {
  try {
    const info = await fetchLatestVersionInfo(channel);
    return {
      success: true,
      info,
      currentVersion: APP_VERSION,
      channel: info.channel || channel || "stable",
    };
  } catch (err) {
    console.error("⚠️ Gagal memeriksa versi terbaru:", err?.message || err);
    return {
      success: false,
      message: err?.message || "Gagal memeriksa versi terbaru.",
    };
  }
});

function safeSend(window, channel, payload = {}) {
  if (!window || typeof window.isDestroyed !== "function") return;
  if (window.isDestroyed()) return;
  try {
    window.send(channel, payload);
  } catch (err) {
    console.warn(`⚠️ Gagal mengirim IPC ${channel}:`, err?.message || err);
  }
}

function downloadFileWithProgress(url, destPath, sender) {
  return new Promise((resolve) => {
    const tempPath = `${destPath}.download`;
    let received = 0;
    let total = 0;
    let finished = false;

    const request = https.get(url, (response) => {
      total = parseInt(response.headers["content-length"] || "0", 10) || 0;
      const fileStream = fs.createWriteStream(tempPath);

      response.on("data", (chunk) => {
        received += chunk.length;
        fileStream.write(chunk);
        const progress = total > 0 ? Math.round((received / total) * 100) : null;
        safeSend(sender, "version-download-progress", {
          state: "downloading",
          receivedBytes: received,
          totalBytes: total,
          progress,
        });
      });

      response.on("end", () => {
        if (finished) return;
        finished = true;
        fileStream.end(() => {
          try {
            fs.renameSync(tempPath, destPath);
          } catch (err) {
            safeSend(sender, "version-download-progress", {
              state: "error",
              message: err?.message || "Gagal menyimpan file unduhan.",
            });
            resolve({
              success: false,
              message: err?.message || "Gagal menyimpan file unduhan.",
            });
            return;
          }
          safeSend(sender, "version-download-progress", {
            state: "downloaded",
            receivedBytes: received,
            totalBytes: total,
            progress: 100,
            path: destPath,
          });
          resolve({ success: true, path: destPath });
        });
      });

      response.on("error", (err) => {
        if (finished) return;
        finished = true;
        fileStream.destroy();
        fs.rmSync(tempPath, { force: true });
        safeSend(sender, "version-download-progress", {
          state: "error",
          message: err?.message || "Gagal mengunduh file.",
        });
        resolve({
          success: false,
          message: err?.message || "Gagal mengunduh file.",
        });
      });
    });

    request.on("error", (err) => {
      if (finished) return;
      finished = true;
      fs.rmSync(tempPath, { force: true });
      safeSend(sender, "version-download-progress", {
        state: "error",
        message: err?.message || "Gagal mengunduh file.",
      });
      resolve({ success: false, message: err?.message || "Gagal mengunduh file." });
    });

    request.end();
  });
}

ipcMain.handle("download-version", async (event, payload = {}) => {
  const sender = event?.sender;
  try {
    const url = (payload.url || "").trim();
    if (!url) {
      throw new Error("URL unduhan tidak valid.");
    }
    const platformKey = (payload.platform || process.platform || "")
      .toString()
      .toLowerCase();
    const downloadsDir = app.getPath("downloads");
    await fs.promises.mkdir(downloadsDir, { recursive: true });
    const fallbackName = `starbox-${Date.now()}`;
    const urlPath = url.split("?")[0];
    const baseName = path.basename(urlPath) || fallbackName;
    const rawFilename =
      (payload.filename || "").trim().replace(/[/\\]/g, "") || baseName;
    const urlExt = path.extname(urlPath);
    const filenameExt = path.extname(rawFilename);
    let finalExt = filenameExt || urlExt;
    if (!finalExt && platformKey.startsWith("win")) {
      finalExt = ".exe"; // pastikan di Windows tersimpan sebagai installer
    }
    const finalFilename =
      finalExt && !rawFilename.toLowerCase().endsWith(finalExt.toLowerCase())
        ? `${rawFilename}${finalExt}`
        : rawFilename;
    const targetPath = path.join(downloadsDir, finalFilename);

    safeSend(sender, "version-download-progress", {
      state: "downloading",
      progress: 0,
      message: "Mulai mengunduh...",
    });

    const result = await downloadFileWithProgress(url, targetPath, sender);
    if (!result.success) {
      return result;
    }

    let opened = false;
    if (payload.autoInstall) {
      const openResult = await shell.openPath(targetPath);
      opened = !openResult;
      if (!opened && openResult) {
        safeSend(sender, "version-download-progress", {
          state: "error",
          message: openResult,
        });
        return { success: false, message: openResult, path: targetPath, opened };
      }
    }

    safeSend(sender, "version-download-progress", {
      state: "downloaded",
      progress: 100,
      path: targetPath,
      opened,
    });

    return { success: true, path: targetPath, opened };
  } catch (err) {
    safeSend(sender, "version-download-progress", {
      state: "error",
      message: err?.message || err,
    });
    return { success: false, message: err?.message || "Gagal mengunduh versi." };
  }
});

function ensureAndroidManagerReady() {
  if (!androidManager) {
    androidManager = new AndroidManager();
  }
  return androidManager;
}

function sendAndroidProgress(sender, channel, uid, payload = {}) {
  if (!sender || typeof sender.isDestroyed !== "function") return;
  if (sender.isDestroyed()) return;
  try {
    sender.send(channel, { uid, ...payload });
  } catch (err) {
    console.warn(`⚠️ Gagal mengirim event ${channel}:`, err.message);
  }
}

// IPC Handlers
ipcMain.handle("add-device", (event, payload = {}) => {
  const {
    name,
    service,
    autoRun,
    mode,
    autoSender,
    pendingUrl,
    customUrl,
    useChromeNative,
  } = payload;

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
  const sameServiceCount = devices.filter(
    (d) => (d.service || "").toLowerCase() === serviceKey
  ).length;
  const serviceLabel = services[serviceKey]?.name || service || "layanan ini";

  if (serviceKey === "android") {
    if (!authSession?.isLoggedIn || !authSession?.allowsAndroidEmulator) {
      return {
        success: false,
        message:
          "❌ Layanan Android Emulator tidak tersedia untuk paket Anda. Silakan upgrade paket.",
      };
    }
  }

  if (serviceKey === "other") {
    if (!authSession?.isLoggedIn || !authSession?.allowsPrivateService) {
      return {
        success: false,
        message:
          "❌ Fitur website kustom hanya tersedia pada paket tertentu. Silakan login dengan akun yang mendukung fitur ini.",
      };
    }
  }

  if (!authSession?.isLoggedIn) {
    const guestLimit = getGuestServiceLimit();
    if (sameServiceCount >= guestLimit) {
      return {
        success: false,
        message: `❌ Pengguna tamu hanya boleh memiliki ${guestLimit} device untuk ${serviceLabel}. Silakan login untuk menambah kuota.`,
      };
    }
  } else if (!authSession?.isUnlimited) {
    const rawLimit = getAccountDeviceQuota();
    const accountLimit =
      typeof rawLimit === "number" ? rawLimit : getGuestServiceLimit();
    if (
      typeof accountLimit === "number" &&
      accountLimit >= 0 &&
      sameServiceCount >= accountLimit
    ) {
      return {
        success: false,
        message: `❌ Kuota akun Anda hanya mengizinkan ${accountLimit} device untuk ${serviceLabel}. Upgrade paket untuk menambah limit.`,
      };
    }
  }

  const enableAutoSender =
    allowAutoSenderForService(serviceKey) && !!autoSender;
  const normalizedPendingUrl = enableAutoSender
    ? (pendingUrl || "").trim()
    : "";
  const normalizedCustomUrl =
    serviceKey === "other" ? sanitizeCustomUrl(customUrl) : "";
  if (serviceKey === "other" && !normalizedCustomUrl) {
    return {
      success: false,
      message:
        "❌ Layanan custom membutuhkan URL website yang valid (harus diawali http:// atau https://).",
    };
  }

  const normalizedAndroidSpec =
    serviceKey === "android"
      ? normalizeAndroidSpecInput(payload.androidSpec)
      : null;
  const normalizedUseChromeNative =
    serviceKey !== "android" && !!useChromeNative;

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
    customUrl: normalizedCustomUrl,
    useChromeNative: normalizedUseChromeNative,
    callbackUrl: enableAutoSender
      ? sanitizePendingUrl(payload.callbackUrl || "")
      : "",
  };
  if (serviceKey === "android") {
    newDevice.avdName = generateAvdName(newDevice.uid);
    newDevice.androidSpec = normalizedAndroidSpec;
  }

  devices.push(newDevice);
  fs.writeFileSync(DB_PATH, JSON.stringify({ devices }, null, 2));
  sendSystemInfoReport({
    eventType: "device:add",
    deviceChange: {
      action: "add",
      device: buildDeviceSnapshot(newDevice),
    },
  });

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

// Buka device di window baru (bukan hub)
ipcMain.handle("start-device-new-window", async (event, uid, service) => {
  try {
    console.log(`🪟 Membuka device ${uid} di window baru.`);
    // Jika sedang berjalan di hub, tutup tab-nya dulu
    if (hubDevices.has(uid)) {
      hubDevices.delete(uid);
      destroyHubWebView(uid);
      if (webHubWindow && !webHubWindow.isDestroyed()) {
        webHubWindow.webContents.send('hub-close-tab', uid);
      }
    }
    // Jika sudah punya window sendiri, fokus saja
    const existingWindow = deviceWindows[uid];
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      return { success: true };
    }
    startDevice(uid, service, { forceNewWindow: true });
    return { success: true };
  } catch (err) {
    console.error(`❌ Gagal membuka window baru untuk ${uid}:`, err);
    return { success: false, error: err.message };
  }
});

// Hub tab ditutup oleh user di dalam hub window
ipcMain.on("hub-tab-closed", (event, uid) => {
  if (hubDevices.has(uid)) {
    hubDevices.delete(uid);
    destroyHubWebView(uid);
    updateDeviceStatus(uid, "stopped");
    // Cleanup side panel
    const sideView = hubSidePanelViews.get(uid);
    if (sideView && webHubWindow && !webHubWindow.isDestroyed()) {
      try { webHubWindow.removeBrowserView(sideView); } catch (_) {}
    }
    if (sideView) {
      try { if (!sideView.webContents.isDestroyed()) sideView.webContents.destroy(); } catch (_) {}
      hubSidePanelViews.delete(uid);
    }
    if (hubActiveTabUid === uid) hubActiveTabUid = null;
    console.log(`[HUB] Tab ${uid} ditutup oleh user.`);
  }
});

// Pop out dari hub ke window baru
ipcMain.on("hub-tab-pop-out", (event, uid) => {
  const tabData = hubDevices.get(uid);
  if (!tabData) return;
  hubDevices.delete(uid);
  destroyHubWebView(uid);
  // Cleanup side panel BrowserView (window baru akan buka TikTok control sendiri)
  const sideView = hubSidePanelViews.get(uid);
  if (sideView && webHubWindow && !webHubWindow.isDestroyed()) {
    try { webHubWindow.removeBrowserView(sideView); } catch (_) {}
  }
  if (sideView) {
    try { if (!sideView.webContents.isDestroyed()) sideView.webContents.destroy(); } catch (_) {}
    hubSidePanelViews.delete(uid);
  }
  if (hubActiveTabUid === uid) hubActiveTabUid = null;
  console.log(`[HUB] Pop out device ${uid} ke window baru.`);
  try {
    createDeviceWindow(uid, tabData.service);
  } catch (err) {
    console.error(`❌ Gagal pop out device ${uid}:`, err);
    updateDeviceStatus(uid, "stopped");
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
      const serviceKey = (device.service || "").toLowerCase();

      device.name = payload.name;
      device.autoRun = !!payload.autoRun;
      device.mode = payload.mode || device.mode || "desktop";
      device.autoSender = allowAuto && !!payload.autoSender;
      device.pendingUrl = device.autoSender
        ? (payload.pendingUrl || "").trim()
        : "";
      if (device.autoSender) {
        device.callbackUrl = sanitizePendingUrl(
          payload.callbackUrl || device.callbackUrl || ""
        );
      } else {
        device.callbackUrl = "";
      }
      if (serviceKey === "other") {
        const rawCustomUrl =
          typeof payload.customUrl === "string"
            ? payload.customUrl
            : device.customUrl;
        const nextCustomUrl = sanitizeCustomUrl(rawCustomUrl);
        if (!nextCustomUrl) {
          return {
            success: false,
            message:
              "URL website kustom harus diisi dengan alamat valid (http/https).",
          };
        }
        device.customUrl = nextCustomUrl;
      } else if (serviceKey === "android") {
        device.androidSpec = normalizeAndroidSpecInput(
          payload.androidSpec || device.androidSpec
        );
      } else if (device.customUrl) {
        device.customUrl = "";
      }
      device.useChromeNative =
        serviceKey !== "android" && !!payload.useChromeNative;

      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      sendSystemInfoReport({
        eventType: "device:edit",
        deviceChange: {
          action: "edit",
          device: buildDeviceSnapshot(device),
        },
      });
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
    teardownTikTokAutomation(uid, {
      closeWindow: true,
      keepState: true,
      reason: "Device dihentikan.",
    });

    const chromeSession = chromeSessions[uid];
    if (chromeSession) {
      console.log(`🛑 Menutup Chrome native untuk device ${uid}`);
      stopChromeNativeSession(uid);
      updateDeviceStatus(uid, "stopped");
      delete deviceWindows[uid];
      resolve();
      return;
    }

    // Handle hub device — tutup tab di hub
    if (hubDevices.has(uid)) {
      console.log(`🛑 Menutup tab hub untuk device ${uid}`);
      hubDevices.delete(uid);
      destroyHubWebView(uid);
      updateDeviceStatus(uid, "stopped");

      // Cleanup side panel BrowserView
      const sideView = hubSidePanelViews.get(uid);
      if (sideView) {
        if (webHubWindow && !webHubWindow.isDestroyed()) {
          try { webHubWindow.removeBrowserView(sideView); } catch (_) {}
        }
        try {
          if (!sideView.webContents.isDestroyed()) sideView.webContents.destroy();
        } catch (_) {}
        hubSidePanelViews.delete(uid);
      }

      if (webHubWindow && !webHubWindow.isDestroyed()) {
        webHubWindow.webContents.send('hub-close-tab', uid);
      }
      resolve();
      return;
    }

    const win = deviceWindows[uid];

    if (!win || win.isDestroyed()) {
      const deviceConfig = getDeviceConfig(uid);
      if (deviceConfig?.useChromeNative) {
        console.log(
          `ℹ️ Tidak ditemukan sesi Chrome native untuk UID ${uid} (sudah berhenti).`
        );
      } else {
        console.warn(
          `⚠️ Attempted to stop device ${uid} but no active window was found.`
        );
      }
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

function createWebHubWindow() {
  if (webHubWindow && !webHubWindow.isDestroyed()) {
    if (webHubWindow.isMinimized()) webHubWindow.restore();
    webHubWindow.show();
    webHubWindow.focus();
    return webHubWindow;
  }

  webHubWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: withBrandTitle('Web Hub'),
    autoHideMenuBar: true,
    icon: getAssetPath('starbox.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      preload: path.join(app.getAppPath(), 'web-hub-preload.cjs'),
    },
  });

  webHubWindow.loadFile(path.join(__dirname, 'web-hub.html'));

  webHubWindow.once('ready-to-show', () => {
    webHubWindow.show();
    webHubWindow.focus();
    if (process.env.NODE_ENV === 'development') {
      webHubWindow.webContents.openDevTools({ mode: 'detach' });
    }
    // Force re-apply setelah window fully rendered
    setTimeout(() => {
      if (webHubWindow && !webHubWindow.isDestroyed()) {
        webHubWindow.webContents.send('hub-window-resized');
      }
    }, 300);
  });

  // Recalculate side panel bounds saat window di-resize
  webHubWindow.on('resize', () => {
    // Notify renderer agar recalculate dan kirim ulang view bounds
    if (!webHubWindow.isDestroyed()) {
      webHubWindow.webContents.send('hub-window-resized');
    }
    // Side panel adjustment (single mode)
    if (hubLayoutMode === 'single' && hubActiveTabUid) {
      applyHubLayout(hubActiveTabUid);
    }
  });

  webHubWindow.on('closed', () => {
    for (const uid of hubDevices.keys()) {
      updateDeviceStatus(uid, 'stopped');
    }
    // Destroy semua side panel BrowserViews
    // (hubWebViews sekarang berisi tabData, bukan BrowserView)
    hubWebViews.clear();
    for (const [, view] of hubSidePanelViews) {
      try {
        if (!view.webContents.isDestroyed()) view.webContents.destroy();
      } catch (_) {}
    }
    hubDevices.clear();
    hubWebViews.clear();
    hubSidePanelViews.clear();
    hubActiveTabUid = null;
    webHubWindow = null;
    console.log('[HUB] Web Hub window ditutup, semua tab dibersihkan.');
  });

  return webHubWindow;
}

function destroyHubWebView(uid) {
  const view = hubWebViews.get(uid);
  if (view && view instanceof BrowserView) {
    if (webHubWindow && !webHubWindow.isDestroyed()) {
      try { webHubWindow.removeBrowserView(view); } catch (_) {}
    }
    try { if (!view.webContents.isDestroyed()) view.webContents.destroy(); } catch (_) {}
  }
  hubWebViews.delete(uid);
}

function ensureHubWebView(tabData) {
  if (!tabData?.uid) return null;
  if (hubWebViews.has(tabData.uid)) {
    hubWebViews.get(tabData.uid).__tabData = tabData;
    return hubWebViews.get(tabData.uid);
  }
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:' + tabData.uid,
    },
  });
  view.__tabData = tabData;
  // Set UA via webContents (webPreferences.userAgent tidak berlaku di BrowserView)
  const ua = tabData.userAgent || buildWhatsAppUserAgent(cachedChromeVersion || DEFAULT_CHROME_VERSION);
  view.webContents.setUserAgent(ua);
  view.webContents.loadURL(tabData.url || 'about:blank', { userAgent: ua });
  hubWebViews.set(tabData.uid, view);
  // Status events — forward ke renderer
  view.webContents.on('did-start-loading', () => {
    if (webHubWindow && !webHubWindow.isDestroyed())
      webHubWindow.webContents.send('hub-tab-status', tabData.uid, 'loading');
  });
  view.webContents.on('did-finish-load', () => {
    if (webHubWindow && !webHubWindow.isDestroyed())
      webHubWindow.webContents.send('hub-tab-status', tabData.uid, 'ready');
  });
  view.webContents.on('did-fail-load', () => {
    if (webHubWindow && !webHubWindow.isDestroyed())
      webHubWindow.webContents.send('hub-tab-status', tabData.uid, 'error');
  });
  view.webContents.on('page-title-updated', (e, title) => {
    if (webHubWindow && !webHubWindow.isDestroyed())
      webHubWindow.webContents.send('hub-tab-title', tabData.uid, title);
  });
  console.log('[HUB] BrowserView dibuat untuk', tabData.uid, tabData.url);
  return view;
}

function applyHubWebViewBounds(boundsList = []) {
  if (!webHubWindow || webHubWindow.isDestroyed()) return;

  const activeUids = new Set(boundsList.map(b => b.uid));

  // Lepas BrowserView yang tidak ada di boundsList
  for (const [uid, view] of hubWebViews) {
    if (!(view instanceof BrowserView)) continue;
    if (!activeUids.has(uid)) {
      try { webHubWindow.removeBrowserView(view); } catch (_) {}
    }
  }

  // Set bounds untuk yang aktif — add jika belum attached, setBounds saja jika sudah
  for (const { uid, x, y, w, h } of boundsList) {
    const view = hubWebViews.get(uid);
    if (!view || !(view instanceof BrowserView) || view.webContents.isDestroyed()) continue;
    const bounds = { x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
    try {
      const views = webHubWindow.getBrowserViews();
      if (!views.includes(view)) webHubWindow.addBrowserView(view);
      view.setBounds(bounds);
    } catch (err) {
      console.warn('[HUB] setBounds error:', err?.message);
    }
  }
}

function openDeviceInHub(uid, service) {
  const deviceConfig = getDeviceConfig(uid) || {};
  const serviceKey = (deviceConfig.service || service || '').toLowerCase();
  const selected = services[serviceKey] || services.other;
  const deviceName = deviceConfig.name || selected.name;
  const mode = deviceConfig.mode || 'desktop';
  const customUrl = deviceConfig.customUrl || '';

  const url = serviceKey === 'other'
    ? sanitizeCustomUrl(customUrl)
    : selected.url || '';

  // Tentukan apakah perlu side panel
  const shouldAttachTikTok = shouldOpenTikTokControl(serviceKey, url);
  if (shouldAttachTikTok) {
    updateTikTokSettings(uid, { targetUrl: url });
  } else {
    teardownTikTokAutomation(uid, { closeWindow: true });
  }

  // Buat BrowserView untuk TikTok control sebagai side panel
  if (shouldAttachTikTok && !hubSidePanelViews.has(uid)) {
    try {
      const tiktokHtmlPath = path.join(__dirname, 'tiktok-control.html');
      const query = new URLSearchParams({ uid, name: deviceName, url });
      const sideView = new BrowserView({
        webPreferences: {
          preload: path.join(app.getAppPath(), 'tiktok-control-preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      sideView.webContents.loadURL(`file://${tiktokHtmlPath}?${query}`);
      hubSidePanelViews.set(uid, sideView);
      console.log(`[HUB] TikTok control side panel dibuat untuk ${uid}`);
    } catch (err) {
      console.warn('[HUB] Gagal membuat TikTok control side panel:', err?.message);
    }
  }

  const hasSidePanel = hubSidePanelViews.has(uid);

  const tabData = {
    uid,
    name: deviceName,
    service: serviceKey,
    url,
    userAgent: getUAForMode(mode),
    partition: `persist:${uid}`,
    iconUrl: 'file://' + getAssetPath(selected.icon || 'starbox.png'),
    hasSidePanel,
  };

  hubDevices.set(uid, tabData);
  ensureHubWebView(tabData);
  updateDeviceStatus(uid, 'active');

  const hub = createWebHubWindow();
  const sendAndActivate = () => {
    if (!hub || hub.isDestroyed() || hub.webContents.isDestroyed()) return;
    hub.webContents.send('hub-open-tab', tabData);
    setTimeout(() => {
      if (!hub || hub.isDestroyed() || hub.webContents.isDestroyed()) return;
      hub.webContents.send('hub-window-resized');
    }, 200);
  };

  if (!hub || hub.isDestroyed() || hub.webContents.isDestroyed()) {
    return;
  }
  if (hub.webContents.isLoading()) {
    hub.webContents.once('did-finish-load', sendAndActivate);
  } else if (!hub.isVisible()) {
    // Window belum visible — tunggu sampai shown
    hub.once('show', () => setTimeout(sendAndActivate, 100));
  } else {
    sendAndActivate();
  }
}

// Recalculate BrowserView bounds for hub side panels
function applyHubLayout(uid, options = {}) {
  if (!webHubWindow || webHubWindow.isDestroyed()) return;
  hubActiveTabUid = uid;

  // Lepas semua side panel BrowserView dari window dulu
  for (const [, view] of hubSidePanelViews) {
    try { webHubWindow.removeBrowserView(view); } catch (_) {}
  }

  // Side panels only work in single-tab layout mode
  const sideView = (hubLayoutMode === 'single' && uid) ? hubSidePanelViews.get(uid) : null;
  const hasSidePanel = !!(sideView && !sideView.webContents.isDestroyed());

  if (hasSidePanel) {
    const [w, h] = webHubWindow.getContentSize();
    const sideW = Math.round(w / 3);
    const contentH = Math.max(0, h - HUB_TABBAR_HEIGHT);
    sideView.setBounds({ x: w - sideW, y: HUB_TABBAR_HEIGHT, width: sideW, height: contentH });
    webHubWindow.addBrowserView(sideView);
  }

  // Beritahu hub HTML agar sesuaikan lebar webview
  if (!options.skipNotify && webHubWindow && !webHubWindow.isDestroyed()) {
    webHubWindow.webContents.send('hub-set-layout', uid, hasSidePanel);
  }
}

ipcMain.on('hub-switch-tab', (event, uid) => {
  applyHubLayout(uid);
});

ipcMain.on('hub-layout-mode', (event, mode) => {
  hubLayoutMode = mode || 'single';
  // Side panel hanya relevan di single layout
  // Multi-slot: renderer akan kirim hub-view-bounds sendiri, jangan override di sini
  if (hubLayoutMode === 'single') {
    applyHubLayout(hubActiveTabUid);
  } else {
    // Lepas semua side panel saat multi-slot
    if (webHubWindow && !webHubWindow.isDestroyed()) {
      for (const [, view] of hubSidePanelViews) {
        try { webHubWindow.removeBrowserView(view); } catch (_) {}
      }
    }
  }
});

let _hubBoundsDebounceTimer = null;
let _hubBoundsLastMs = 0;
ipcMain.on('hub-view-bounds', (event, boundsList) => {
  const now = Date.now();
  // Langsung proses jika sudah >200ms sejak terakhir, atau debounce
  if (now - _hubBoundsLastMs > 200) {
    _hubBoundsLastMs = now;
    applyHubWebViewBounds(boundsList);
  } else {
    if (_hubBoundsDebounceTimer) clearTimeout(_hubBoundsDebounceTimer);
    _hubBoundsDebounceTimer = setTimeout(() => {
      _hubBoundsLastMs = Date.now();
      _hubBoundsDebounceTimer = null;
      applyHubWebViewBounds(boundsList);
    }, 150);
  }
});

ipcMain.handle('hub-get-devices', async () => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const devices = (data.devices || []).filter(d => d.service !== 'android');
    return devices.map(d => {
      const svc = services[d.service] || services.other;
      return {
        uid: d.uid,
        name: d.name || svc.name,
        service: d.service,
        iconUrl: 'file://' + getAssetPath(svc.icon || 'starbox.png'),
      };
    });
  } catch (e) {
    console.warn('[HUB] hub-get-devices error:', e?.message);
    return [];
  }
});

ipcMain.handle('hub-start-device', async (event, uid) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const device = (data.devices || []).find(d => d.uid === uid);
    if (!device) return { success: false, error: 'Device not found' };
    await startDevice(uid, device.service, {});
    return { success: true };
  } catch (e) {
    console.warn('[HUB] hub-start-device error:', e?.message);
    return { success: false, error: e?.message };
  }
});

function startDevice(uid, service, options = {}) {
  if (!uid) {
    console.warn("⚠️ startDevice dipanggil tanpa UID, operasi dibatalkan.");
    return;
  }

  if (!app.isReady()) {
    console.log(`⌛ App belum siap. Menunggu untuk menjalankan device ${uid}.`);
    app.whenReady().then(() => startDevice(uid, service, options));
    return;
  }

  const deviceConfig = getDeviceConfig(uid) || {};
  const serviceKey = (deviceConfig.service || service || "").toLowerCase();
  const useChromeNative =
    !!deviceConfig.useChromeNative && serviceKey !== "android";

  if (useChromeNative) {
    console.log(`🚀 Menjalankan device ${uid} menggunakan Chrome native.`);
    try {
      launchChromeNativeSession(uid, { ...deviceConfig, service: serviceKey });
      updateDeviceStatus(uid, "active");
      delete deviceWindows[uid];
      return;
    } catch (err) {
      console.error(`❌ Gagal membuka Chrome native untuk ${uid}:`, err);
      updateDeviceStatus(uid, "stopped");
      throw err;
    }
  }

  // Tentukan apakah device harus dibuka di hub atau window baru
  const forceNewWindow = options.forceNewWindow === true;
  const autoSenderEnabled = Boolean(
    deviceConfig.autoSender && allowAutoSenderForService(serviceKey)
  );
  const selected = services[serviceKey] || services.other;
  const isLocalFile = Boolean(selected.isLocalFile);
  const useHub = !forceNewWindow && !autoSenderEnabled && !isLocalFile && serviceKey !== 'android';

  if (useHub) {
    // Jika sudah berjalan di hub, fokus saja
    if (hubDevices.has(uid)) {
      if (webHubWindow && !webHubWindow.isDestroyed()) {
        if (webHubWindow.isMinimized()) webHubWindow.restore();
        webHubWindow.show();
        webHubWindow.focus();
        webHubWindow.webContents.send('hub-focus-tab', uid);
      }
      return;
    }
    console.log(`🌐 Menjalankan device ${uid} (${serviceKey}) di Web Hub.`);
    updateDeviceStatus(uid, "starting");
    try {
      openDeviceInHub(uid, service);
    } catch (err) {
      console.error(`❌ Gagal membuka device di hub untuk ${uid}:`, err);
      updateDeviceStatus(uid, "stopped");
      throw err;
    }
    return;
  }

  // Mode window baru (autoSender, local file, android, atau force)
  const existingWindow = deviceWindows[uid];
  if (existingWindow && !existingWindow.isDestroyed()) {
    console.log(
      `🔁 Device ${uid} sudah memiliki jendela aktif. Fokuskan kembali.`
    );
    existingWindow.focus();
    return;
  }

  console.log(
    `🚀 Menjalankan device ${uid} (${serviceKey}) sebagai jendela baru.`
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
  stopDevice(uid).catch((err) => {
    console.error(`❌ stopDevice gagal untuk ${uid}:`, err?.message || err);
  });
});

ipcMain.on("focus-device", (event, uid) => {
  // Cek hub terlebih dahulu
  if (hubDevices.has(uid) && webHubWindow && !webHubWindow.isDestroyed()) {
    if (webHubWindow.isMinimized()) webHubWindow.restore();
    webHubWindow.show();
    webHubWindow.focus();
    webHubWindow.webContents.send('hub-focus-tab', uid);
    return;
  }
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

ipcMain.handle("get-device-source-id", async (event, uid) => {
  try {
    const win = deviceWindows[uid];
    if (!win || win.isDestroyed()) return { ok: false, error: "Window not found" };
    const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 } });
    const winTitle = win.getTitle();
    const found = sources.find((s) => s.name === winTitle) ||
                  sources.find((s) => s.name.includes(winTitle.split(" ")[0]));
    if (!found) return { ok: false, error: "Source not found" };
    return { ok: true, sourceId: found.id };
  } catch (err) {
    return { ok: false, error: err?.message || "Failed" };
  }
});

ipcMain.handle("save-recording-file", async (event, filePath, byteArray) => {
  try {
    const buffer = Buffer.from(byteArray);
    fs.writeFileSync(filePath, buffer);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message };
  }
});

ipcMain.handle("show-save-dialog-recording", async (event, defaultName) => {
  const result = await dialog.showSaveDialog({
    title: "Simpan Recording",
    defaultPath: defaultName || "recording.webm",
    filters: [{ name: "Video", extensions: ["webm"] }],
  });
  return result;
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

// Open iOS Simulator window
ipcMain.on("open-ios-simulator", () => {
  console.log("📱 Opening iOS Simulator window...");

  const iosWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    title: withVersionSuffix("iOS Simulator Manager"),
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  iosWindow.loadFile("ios-simulator.html");
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

ipcMain.on("monitor-trigger-fetch-pending", (_event, uid) => {
  if (!uid) return;

  // Cek apakah device sedang running (window exists dan tidak destroyed)
  const deviceWindow = deviceWindows[uid];
  if (!deviceWindow || deviceWindow.isDestroyed()) {
    console.log(`⚠️ Device ${uid} tidak sedang berjalan, skip fetch pending`);
    return;
  }

  // CEK: Jangan fetch jika masih ada pesan yang sedang dikirim
  if (hasMessagesInProgress()) {
    const inProgress = getMessagesInProgress();
    console.log(
      `⏸️ Skip fetch pending untuk ${uid} - masih ada ${inProgress.length} pesan sedang dikirim:`,
      inProgress
    );
    return;
  }

  console.log(
    `⏰ Monitor meminta fetch pending untuk UID ${uid} (device sedang running)`
  );

  // Kirim event ke semua window untuk trigger fetch pending
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send("trigger-fetch-pending", uid);
    }
  });
});

ipcMain.on("monitor-control-automation", (_event, uid, state) => {
  if (!uid || !state) return;

  console.log(
    `🎮 Monitor meminta kontrol automation untuk UID ${uid}: ${state}`
  );

  // Kirim event ke semua window untuk mengontrol automation
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send("control-automation", uid, state);
    }
  });
});

ipcMain.on("monitor-update-settings", (_event, uid, payload = {}) => {
  if (!uid) return;
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send("automation-settings-updated", uid, payload || {});
    }
  });
});

ipcMain.handle("tiktok-control-init", (_event, uid) => {
  if (!uid) {
    return { success: false, message: "UID tidak valid." };
  }
  const state = serializeTikTokState(getTikTokAutomationState(uid));
  const device = getDeviceConfig(uid) || {};
  return {
    success: true,
    state,
    message: "Kontrol TikTok siap.",
    deviceName: device.name || "TikTok",
  };
});

ipcMain.handle(
  "tiktok-control-toggle",
  (_event, uid, feature, enabled, payload = {}) => {
    if (!uid || !feature) {
      return { success: false, message: "Parameter tidak lengkap." };
    }
    updateTikTokSettings(uid, payload || {});
    const normalized = (feature || "").toLowerCase();
    if (normalized === "like") {
      if (enabled) startTikTokAutoLike(uid);
      else stopTikTokAutoLike(uid);
    } else if (normalized === "comment") {
      if (enabled) startTikTokAutoComment(uid);
      else stopTikTokAutoComment(uid);
    }
    const state = serializeTikTokState(getTikTokAutomationState(uid));
    sendTikTokControlUpdate(uid, { state });
    return { success: true, state };
  }
);

ipcMain.handle("tiktok-control-settings", (_event, uid, payload = {}) => {
  const result = updateTikTokSettings(uid, payload || {});
  const state = serializeTikTokState(getTikTokAutomationState(uid));
  sendTikTokControlUpdate(uid, {
    state,
    message: result.success ? "Pengaturan TikTok diperbarui." : result.message,
  });
  return { ...result, state };
});

ipcMain.handle("tiktok-control-import-csv", async (_event, uid) => {
  if (!uid) {
    return { success: false, message: "UID tidak valid." };
  }
  try {
    const result = await dialog.showOpenDialog({
      title: "Pilih file CSV/TXT berisi komentar",
      filters: [
        { name: "CSV", extensions: ["csv"] },
        { name: "Text", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths?.length) {
      return { success: false, canceled: true };
    }
    const filePath = result.filePaths[0];
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    const items = [];
    for (const line of lines) {
      if (!line || !line.trim()) continue;
      // Ambil kolom pertama jika dipisah koma
      const firstCol = line.split(",")[0];
      const clean = sanitizeTikTokComment(firstCol);
      if (clean) items.push(clean);
    }
    if (!items.length) {
      return { success: false, message: "File kosong atau tidak ada komentar valid." };
    }
    const state = getTikTokAutomationState(uid);
    state.commentPool = items.slice(0, 500); // batasi 500
    state.commentIndex = 0;
    state.commentText = state.commentPool[0] || state.commentText;
    const serialized = serializeTikTokState(state);
    sendTikTokControlUpdate(uid, {
      state: serialized,
      message: `Import ${items.length} komentar dari CSV.`,
    });
    return { success: true, state: serialized, imported: items.length };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal membaca file CSV.",
    };
  }
});

const TIKTOK_SAMPLE_CSV = `comment
Mantap videonya! 👍
Keren banget, sukses terus ya!
Semoga makin viral 😍
Kontenmu selalu inspiratif!
Gaskeun bikin konten lagi! 🚀
Seru banget, lanjutin terus!
Suka banget sama vibe-nya!
Mantap, ditunggu video berikutnya!
Kocak parah, ngakak! 😂
Idenya unik, mantap.`;

ipcMain.handle("tiktok-control-save-sample", async () => {
  try {
    const result = await dialog.showSaveDialog({
      title: "Simpan sample komentar TikTok",
      defaultPath: "tiktok-comments-sample.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    fs.writeFileSync(result.filePath, TIKTOK_SAMPLE_CSV, "utf8");
    return { success: true, path: result.filePath };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal menyimpan sample CSV.",
    };
  }
});

ipcMain.handle("set-input-guard-state", (_event, uid, enabled) => {
  if (!uid) return { success: false };
  const win = deviceWindows[uid];
  if (!win || win.isDestroyed()) {
    return { success: false, message: "Window device tidak ditemukan." };
  }
  setWindowInputGuardState(win, enabled);
  const current = getWindowInputGuardState(win);
  console.log(
    `🖱️ Input guard untuk ${uid} kini ${current ? "AKTIF" : "NONAKTIF"}`
  );
  return { success: true, enabled: current };
});

ipcMain.handle("is-device-running", (_event, uid) => {
  if (!uid) return false;
  if (hubDevices.has(uid)) return true;
  const deviceWindow = deviceWindows[uid];
  return !!(deviceWindow && !deviceWindow.isDestroyed());
});

ipcMain.handle("load-devices", (_event, dbType) => {
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
    if (!("callbackUrl" in device)) {
      device.callbackUrl = "";
      modifiedAny = true;
    }
    if (!("useChromeNative" in device)) {
      device.useChromeNative = false;
      modifiedAny = true;
    }
    if ((device.service || "").toLowerCase() === "android" && !device.avdName) {
      device.avdName = generateAvdName(device.uid || device.token || "");
      modifiedAny = true;
    }
  });

  if (modifiedAny) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  }

  // Filter by dbType if specified
  if (dbType === "web") {
    return { devices: (data.devices || []).filter(d => (d.service || "").toLowerCase() !== "android") };
  }
  if (dbType === "android") {
    return { devices: (data.devices || []).filter(d => (d.service || "").toLowerCase() === "android") };
  }

  return data;
});

// ── CCTV ─────────────────────────────────────────────────────────────────────
ipcMain.handle('cctv-get-cameras', () => {
  return { cameras: cctvManager.getCameras() };
});

ipcMain.handle('cctv-save-camera', (_e, camera) => {
  const saved = cctvManager.saveCamera(camera);
  return { success: true, camera: saved };
});

ipcMain.handle('cctv-delete-camera', (_e, uid) => {
  cctvManager.stopStream(uid);
  cctvManager.deleteCamera(uid);
  return { success: true };
});

ipcMain.handle('cctv-start-stream', async (_e, camera) => {
  try {
    const result = await cctvManager.startStream(camera);
    return { success: true, port: result.port };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cctv-stop-stream', (_e, uid) => {
  cctvManager.stopStream(uid);
  return { success: true };
});

ipcMain.handle('cctv-stream-status', (_e, uid) => {
  return cctvManager.getStreamStatus(uid);
});

ipcMain.handle('cctv-snapshot', async (_e, camera) => {
  try {
    const result = await dialog.showSaveDialog({
      title: 'Simpan Screenshot CCTV',
      defaultPath: `cctv-${camera.name || 'snapshot'}-${Date.now()}.jpg`,
      filters: [{ name: 'JPEG Image', extensions: ['jpg'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    const outPath = await cctvManager.takeSnapshot(camera, result.filePath);
    return { success: true, path: outPath };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cctv-check-ffmpeg', async () => {
  return cctvManager.checkFfmpeg();
});

// ── FFmpeg auto-install (semua platform) ─────────────────────────────────────
ipcMain.handle('cctv-install-ffmpeg', async (event) => {
  const win  = BrowserWindow.fromWebContents(event.sender);
  const plat = process.platform;
  const send = (phase, pct, message) => {
    win?.webContents?.send('cctv-ffmpeg-install-progress', { phase, pct, message });
  };

  try {
    // ── Windows: download portable zip ──────────────────────────────────────
    if (plat === 'win32') {
      const toolsDir  = path.join(app.getPath('userData'), 'tools');
      const ffmpegDir = path.join(toolsDir, 'ffmpeg');
      const zipPath   = path.join(toolsDir, 'ffmpeg-download.zip');
      fs.mkdirSync(ffmpegDir, { recursive: true });

      const existing = cctvManager._findPortableFfmpegWin();
      if (existing) {
        cctvManager.setFfmpegBin(existing);
        return { success: true, path: existing, cached: true };
      }

      send('download', 0, 'Memulai download FFmpeg untuk Windows...');
      const downloadUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

      await new Promise((resolve, reject) => {
        const doGet = (url, hops = 0) => {
          if (hops > 10) { reject(new Error('Terlalu banyak redirect')); return; }
          const mod  = url.startsWith('https') ? require('https') : require('http');
          const file = fs.createWriteStream(zipPath);
          let downloaded = 0, total = 0, lastPct = -1;
          const req = mod.get(url, { timeout: 120000 }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
              file.close(); fs.unlink(zipPath, () => {});
              const loc = res.headers.location;
              if (!loc) { reject(new Error('Redirect tanpa Location')); return; }
              doGet(loc.startsWith('http') ? loc : new URL(loc, url).href, hops + 1);
              return;
            }
            if (res.statusCode !== 200) {
              file.close(); fs.unlink(zipPath, () => {});
              reject(new Error(`HTTP ${res.statusCode}`)); return;
            }
            total = parseInt(res.headers['content-length'] || '0', 10);
            send('download', 0, total > 0 ? `Total: ${(total / 1024 / 1024).toFixed(1)} MB` : 'Mengunduh FFmpeg...');
            // Manually track progress then pipe to file
            res.on('data', (chunk) => {
              downloaded += chunk.length;
              const pct = total > 0 ? Math.round((downloaded / total) * 100) : -1;
              // Only send progress every 1% change to avoid flooding IPC
              if (pct !== lastPct) {
                lastPct = pct;
                const mb = (downloaded / 1024 / 1024).toFixed(1);
                const totalMb = total > 0 ? `/${(total / 1024 / 1024).toFixed(1)} MB` : ' MB';
                send('download', pct >= 0 ? pct : 0, `Mengunduh: ${mb}${totalMb}${pct >= 0 ? ` (${pct}%)` : ''}`);
              }
              file.write(chunk);
            });
            res.on('end', () => { file.end(); });
            file.on('finish', () => { resolve(); });
          });
          req.on('error', (e) => { file.close(); fs.unlink(zipPath, () => {}); reject(e); });
          req.on('timeout', () => { req.destroy(); file.close(); fs.unlink(zipPath, () => {}); reject(new Error('Download timeout — koneksi terlalu lambat')); });
        };
        doGet(downloadUrl);
      });

      send('extract', 0, 'Mengekstrak FFmpeg...');
      const extractZipLib = require('extract-zip');
      await extractZipLib(zipPath, { dir: ffmpegDir });
      fs.unlink(zipPath, () => {});

      const binPath = cctvManager._findPortableFfmpegWin();
      if (!binPath) throw new Error('ffmpeg.exe tidak ditemukan setelah ekstrak.');
      cctvManager.setFfmpegBin(binPath);
      send('done', 100, 'FFmpeg berhasil diinstall!');
      return { success: true, path: binPath };
    }

    // ── macOS: brew install ffmpeg ───────────────────────────────────────────
    if (plat === 'darwin') {
      const brewCheck = spawnSync('brew', ['--version'], { timeout: 5000 });
      if (brewCheck.error) {
        return {
          success: false,
          message: 'Homebrew tidak ditemukan. Install Homebrew dulu di https://brew.sh, lalu jalankan: brew install ffmpeg',
          manualUrl: 'https://brew.sh',
        };
      }
      send('install', 0, 'Menginstall FFmpeg via Homebrew...');
      await new Promise((resolve, reject) => {
        const child = spawn('brew', ['install', 'ffmpeg'], { stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', (d) => send('install', -1, d.toString().trim()));
        child.stderr.on('data', (d) => send('install', -1, d.toString().trim()));
        child.on('error', reject);
        child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`brew exit code ${code}`)));
      });
      send('done', 100, 'FFmpeg berhasil diinstall via Homebrew!');
      return { success: true };
    }

    // ── Linux: apt install ffmpeg ────────────────────────────────────────────
    send('install', 0, 'Menginstall FFmpeg via apt...');
    await new Promise((resolve, reject) => {
      const child = spawn('sudo', ['apt-get', 'install', '-y', 'ffmpeg'], { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (d) => send('install', -1, d.toString().trim()));
      child.stderr.on('data', (d) => send('install', -1, d.toString().trim()));
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`apt exit code ${code}`)));
    });
    send('done', 100, 'FFmpeg berhasil diinstall via apt!');
    return { success: true };

  } catch (err) {
    send('error', 0, `Gagal: ${err.message}`);
    return { success: false, message: err.message };
  }
});

// ── QEMU check & auto-install ─────────────────────────────────────────────────

// Helper: find qemu-system-x86_64 binary, including common install paths
function findQemuBin() {
  if (process.platform === 'win32') {
    // Build Windows candidate paths using env vars (covers all drive letters / user installs)
    const pf    = process.env.PROGRAMFILES          || 'C:\\Program Files';
    const pf86  = process.env['PROGRAMFILES(X86)']  || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA          || '';

    // Direct paths (most common: official installer puts exe directly in qemu folder)
    const winPaths = [
      path.join(pf,   'qemu', 'qemu-system-x86_64.exe'),
      path.join(pf,   'QEMU', 'qemu-system-x86_64.exe'),
      path.join(pf86, 'qemu', 'qemu-system-x86_64.exe'),
      path.join(pf86, 'QEMU', 'qemu-system-x86_64.exe'),
    ];
    if (local) {
      winPaths.push(
        path.join(local, 'Programs', 'qemu', 'qemu-system-x86_64.exe'),
        path.join(local, 'Programs', 'QEMU', 'qemu-system-x86_64.exe'),
        path.join(local, 'qemu', 'qemu-system-x86_64.exe'),
      );
    }
    for (const p of winPaths) {
      try { if (fs.existsSync(p)) return p; } catch {}
    }

    // Scan subdirs of Program Files for any qemu* directory (handles version-suffixed installs)
    const scanParent = (parentDir) => {
      try {
        const entries = fs.readdirSync(parentDir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          if (!e.name.toLowerCase().startsWith('qemu')) continue;
          const candidate = path.join(parentDir, e.name, 'qemu-system-x86_64.exe');
          try { if (fs.existsSync(candidate)) return candidate; } catch {}
          const binCandidate = path.join(parentDir, e.name, 'bin', 'qemu-system-x86_64.exe');
          try { if (fs.existsSync(binCandidate)) return binCandidate; } catch {}
        }
      } catch {}
      return null;
    };
    for (const parent of [pf, pf86, local ? path.join(local, 'Programs') : null].filter(Boolean)) {
      const found = scanParent(parent);
      if (found) return found;
    }

    // Use where.exe to search PATH (handles installs that register in PATH registry)
    try {
      const r = spawnSync('where.exe', ['qemu-system-x86_64.exe'], { timeout: 5000 });
      if (!r.error && r.status === 0) {
        const found = r.stdout.toString().trim().split(/\r?\n/)[0].trim();
        if (found) { try { if (fs.existsSync(found)) return found; } catch {} }
      }
    } catch {}
    return null;
  }

  // macOS Homebrew paths
  if (process.platform === 'darwin') {
    const macPaths = [
      '/opt/homebrew/bin/qemu-system-x86_64',
      '/usr/local/bin/qemu-system-x86_64',
    ];
    for (const p of macPaths) {
      try { if (fs.existsSync(p)) return p; } catch {}
    }
  } else {
    // Linux
    const linuxPaths = ['/usr/bin/qemu-system-x86_64', '/usr/local/bin/qemu-system-x86_64'];
    for (const p of linuxPaths) {
      try { if (fs.existsSync(p)) return p; } catch {}
    }
  }

  // Fall back to PATH via spawn
  const name = process.platform === 'win32' ? 'qemu-system-x86_64.exe' : 'qemu-system-x86_64';
  try {
    const r = spawnSync(name, ['--version'], { timeout: 5000 });
    if (!r.error) return name;
  } catch {}
  return null;
}

ipcMain.handle('os-vm-check-qemu', async () => {
  const bin = findQemuBin();
  if (bin) {
    try {
      const r = spawnSync(bin, ['--version'], { timeout: 5000 });
      const ver = (r.stdout || r.stderr || '').toString().split('\n')[0].trim();
      return { available: true, version: ver, bin };
    } catch {}
  }
  return { available: false, platform: process.platform };
});

ipcMain.handle('os-vm-install-qemu', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const sendProgress = (message, done = false, error = false) => {
    win?.webContents?.send('qemu-install-progress', { message, done, error });
  };

  try {
    sendProgress('Memulai instalasi QEMU...');
    const plat = process.platform;
    let cmd, args;

    if (plat === 'win32') {
      // Try winget first (available on Win10 1809+ and Win11)
      const wingetCheck = spawnSync('winget', ['--version'], { timeout: 5000 });
      if (!wingetCheck.error) {
        cmd = 'winget';
        args = ['install', '--id=SoftwareFreedomConservancy.QEMU',
                '--accept-source-agreements', '--accept-package-agreements', '--silent'];
        sendProgress('Menginstall QEMU via winget...');
      } else {
        return {
          success: false,
          message: 'winget tidak ditemukan. Download QEMU manual di https://qemu.org/download/#windows',
          manualUrl: 'https://qemu.org/download/#windows',
        };
      }
    } else if (plat === 'darwin') {
      const brewCheck = spawnSync('brew', ['--version'], { timeout: 5000 });
      if (!brewCheck.error) {
        cmd = 'brew'; args = ['install', 'qemu'];
        sendProgress('Menginstall QEMU via Homebrew...');
      } else {
        return {
          success: false,
          message: 'Homebrew tidak ditemukan. Install homebrew dulu: https://brew.sh, lalu jalankan: brew install qemu',
          manualUrl: 'https://brew.sh',
        };
      }
    } else {
      // Linux
      cmd = 'sudo'; args = ['apt-get', 'install', '-y', 'qemu-system-x86'];
      sendProgress('Menginstall QEMU via apt...');
    }

    await new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (d) => sendProgress(d.toString().trim()));
      child.stderr.on('data', (d) => sendProgress(d.toString().trim()));
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Proses keluar dengan kode ${code}`));
      });
    });

    // Verify — use findQemuBin() to check known install paths too
    const foundBin = findQemuBin();
    if (foundBin) {
      sendProgress(`QEMU berhasil diinstall! (${foundBin})`, true);
    } else {
      sendProgress('QEMU terinstall. Jika banner masih muncul, restart StarBox.', true);
    }
    return { success: true };
  } catch (err) {
    sendProgress(`Gagal: ${err.message}`, false, true);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cctv-scan-onvif', async (event, opts = {}) => {
  const { username = '', password = '', subnetInput = '' } = opts;
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const results = await cctvManager.scanOnvif({
      username, password, subnetInput,
      onProgress: (payload) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('cctv-scan-progress', payload);
        }
      },
    });
    return { success: true, devices: results };
  } catch (err) {
    return { success: false, message: err.message, devices: [] };
  }
});

ipcMain.handle('cctv-probe-onvif', async (_e, ip, port, username, password) => {
  try {
    const result = await cctvManager.probeOnvifDevice(ip, port || 80, username || '', password || '');
    return { success: !!result, device: result };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cctv-ptz-move', async (_e, { ip, port, username, password, profileToken, pan, tilt, zoom, ptzUrl }) => {
  try {
    await cctvManager.ptzContinuousMove(ip, port || 80, username || '', password || '', profileToken, pan || 0, tilt || 0, zoom || 0, ptzUrl || null);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cctv-ptz-stop', async (_e, { ip, port, username, password, profileToken, ptzUrl }) => {
  try {
    await cctvManager.ptzStop(ip, port || 80, username || '', password || '', profileToken, ptzUrl || null);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cctv-ptz-presets', async (_e, { ip, port, username, password, profileToken, ptzUrl }) => {
  try {
    const presets = await cctvManager.ptzGetPresets(ip, port || 80, username || '', password || '', profileToken, ptzUrl || null);
    return { success: true, presets };
  } catch (err) {
    return { success: false, message: err.message, presets: [] };
  }
});

ipcMain.handle('cctv-ptz-goto-preset', async (_e, { ip, port, username, password, profileToken, presetToken, ptzUrl }) => {
  try {
    await cctvManager.ptzGotoPreset(ip, port || 80, username || '', password || '', profileToken, presetToken, ptzUrl || null);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('cctv-ptz-set-preset', async (_e, { ip, port, username, password, profileToken, presetName, ptzUrl }) => {
  try {
    const r = await cctvManager.ptzSetPreset(ip, port || 80, username || '', password || '', profileToken, presetName || '', ptzUrl || null);
    return { success: true, token: r.token };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle("android-remote-load", () => {
  const devices = readAndroidRemoteDevices();
  return { devices };
});

ipcMain.handle("android-remote-add", (_event, payload = {}) => {
  try {
    const record = addAndroidRemoteDeviceRecord(payload);
    const payloadSample = {
      name: record.name,
      adbId: record.adbId,
      service: record.service,
      whatsappBaseUrl: record.whatsappBaseUrl,
      whatsappCallbackUrl: record.whatsappCallbackUrl,
      whatsappVariant: record.whatsappVariant,
      status: record.status,
    };
    queueMicrotask(() =>
      sendAdbRemoteReport({ action: "add", device: record }).catch(() => {})
    );
    return { success: true, device: record, payload: payloadSample };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal menambahkan device Android.",
    };
  }
});

ipcMain.handle("android-remote-edit", (_event, payload = {}) => {
  try {
    const record = updateAndroidRemoteDeviceRecord(payload);
    queueMicrotask(() =>
      sendAdbRemoteReport({ action: "edit", device: record }).catch(() => {})
    );
    return { success: true, device: record };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal memperbarui device Android.",
    };
  }
});

ipcMain.handle("android-remote-delete", (_event, uid) => {
  try {
    const existing = findAndroidRemoteDevice(uid);
    deleteAndroidRemoteDeviceRecord(uid);
    queueMicrotask(() =>
      sendAdbRemoteReport({
        action: "delete",
        device: existing || { uid },
      }).catch(() => {})
    );
    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal menghapus device Android.",
    };
  }
});

ipcMain.handle("android-remote-update", (_event, uid, updates) => {
  try {
    const record = updateAndroidRemoteDeviceRecord({ uid, ...updates });
    return { success: true, device: record };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal update device Android.",
    };
  }
});

// NOTE: sendSingleWhatsappMessage already defined at line 3483
// Using the existing proven implementation

ipcMain.handle(
  "android-remote-send-whatsapp-message",
  async (_event, uid, payload = {}) => {
    try {
      const record = findAndroidRemoteDevice(uid);
      if (!record || !record.adbId) {
        throw new Error("Device tidak ditemukan.");
      }
      const phone = String(payload.phone || payload.phoneNumber || "")
        .replace(/[^\d]/g, "")
        .trim();
      const message = String(payload.message || "").trim();
      const messageId = payload.id || null;
      const callbackUrl = record.whatsappCallbackUrl || null;
      const whatsappVariant = record.whatsappVariant || "consumer";

      if (!phone) {
        throw new Error("Nomor tujuan tidak valid.");
      }
      if (!message) {
        throw new Error("Pesan tidak boleh kosong.");
      }
      await sendSingleWhatsappMessage(record.adbId, phone, message, {
        typingSpeed: "instant",
        callbackUrl: callbackUrl,
        messageId: messageId,
        whatsappVariant,
      });
      return {
        success: true,
        message: `Pesan terkirim ke ${phone}.`,
      };
    } catch (err) {
      console.error("❌ Failed to send WhatsApp message:", err);
      return {
        success: false,
        message: err?.message || "Gagal mengirim pesan WhatsApp.",
      };
    }
  }
);

// Fetch pending WhatsApp messages from baseUrl
ipcMain.handle("android-whatsapp-fetch-messages", async (_event, uid) => {
  try {
    const device = findAndroidRemoteDevice(uid);
    if (!device) {
      return { success: false, message: "Device not found" };
    }

    if (!device.whatsappBaseUrl) {
      return { success: false, message: "baseUrl not configured" };
    }

    const url = new URL(device.whatsappBaseUrl);
    const postData = JSON.stringify({ uid });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const protocol = url.protocol === "https:" ? https : require("http");
      const req = protocol.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ data: [] });
          }
        });
      });

      req.on("error", (err) => reject(err));
      req.write(postData);
      req.end();
    });

    const messages = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
      ? response.data
      : [];
    return { success: true, messages };
  } catch (err) {
    console.error("❌ Failed to fetch WhatsApp messages:", err);
    return {
      success: false,
      message: err?.message || "Failed to fetch messages",
    };
  }
});

// Post message status to callbackUrl
ipcMain.handle(
  "android-whatsapp-post-status",
  async (_event, uid, messageId, status) => {
    try {
      const device = findAndroidRemoteDevice(uid);
      if (!device) {
        return { success: false, message: "Device not found" };
      }

      if (!device.whatsappCallbackUrl) {
        return { success: false, message: "callbackUrl not configured" };
      }

      const url = new URL(device.whatsappCallbackUrl);
      const postData = JSON.stringify({ id: messageId, status });

      await new Promise((resolve, reject) => {
        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname + url.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        };

        const protocol = url.protocol === "https:" ? https : require("http");
        const req = protocol.request(options, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        });

        req.on("error", (err) => reject(err));
        req.write(postData);
        req.end();
      });

      return { success: true };
    } catch (err) {
      console.error("❌ Failed to post status:", err);
      return {
        success: false,
        message: err?.message || "Failed to post status",
      };
    }
  }
);

ipcMain.handle("android-remote-update-status", (_event, uid, status) => {
  try {
    const record = updateAndroidRemoteDeviceRecord({ uid, status });
    return { success: true, device: record };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal memperbarui status device.",
    };
  }
});

ipcMain.handle("android-list-physical-devices", async () => {
  try {
    const manager = ensureAndroidManagerReady();
    const devices = await manager.listConnectedDevices();
    return { success: true, devices };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal membaca daftar ADB.",
      devices: [],
    };
  }
});

ipcMain.handle("android-scan-local-wifi", async (event, options = {}) => {
  try {
    const scanMode = options.scanMode || "quick"; // 'quick' or 'deep'
    const result = await scanLocalWifiForAdbDevices(true, scanMode);
    return { success: true, ...result };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal memindai jaringan lokal.",
    };
  }
});

ipcMain.handle("android-connect-manual-adb", async (event, options = {}) => {
  try {
    const { ip, port, oldAdbId } = options;
    if (!ip || !port) {
      return {
        success: false,
        message: "IP dan Port harus diisi!",
      };
    }

    const manager = ensureAndroidManagerReady();
    const deviceId = `${ip}:${port}`;

    // Disconnect old device first if provided
    if (oldAdbId && oldAdbId !== deviceId) {
      try {
        logDev(`🔌 Disconnecting old device ${oldAdbId}...`);
        await manager.runAdbCommand(["disconnect", oldAdbId], {
          timeout: 5000,
          silent: true,
        });
      } catch (err) {
        console.warn(`⚠️ Could not disconnect old device:`, err.message);
      }
    }

    // Try to connect
    logDev(`🔌 Connecting to ${deviceId}...`);
    const connectResult = await manager.runAdbCommand(["connect", deviceId], {
      timeout: 10000,
    });

    if (
      connectResult.includes("connected") ||
      connectResult.includes("already connected")
    ) {
      logDev(`✅ Successfully connected to ${deviceId}`);

      // Get device info
      const devices = await manager.listConnectedDevices();
      const device = devices.find((d) => d.adbId === deviceId);

      return {
        success: true,
        message: `Berhasil connect ke ${deviceId}`,
        deviceId: deviceId,
        deviceName: device?.description || device?.model || deviceId,
      };
    } else {
      logDev(`❌ Failed to connect to ${deviceId}: ${connectResult}`);
      return {
        success: false,
        message: `Gagal connect: ${connectResult}`,
      };
    }
  } catch (err) {
    console.error("❌ Error connecting manual ADB:", err);
    return {
      success: false,
      message: err?.message || "Gagal connect ke device!",
    };
  }
});

let adbStatusInterval = null;
async function startAdbStatusMonitor() {
  if (adbStatusInterval) return;
  let manager = null;
  try {
    manager = ensureAndroidManagerReady();
  } catch (err) {
    console.warn(
      "⚠️ ADB manager belum siap, status monitor tidak bisa berjalan:",
      err?.message || err
    );
    return;
  }
  const checkStatus = async () => {
    try {
      const result = await manager.listConnectedDevices();
      const devices = Array.isArray(result)
        ? result
        : Array.isArray(result?.devices)
        ? result.devices
        : [];
      const entries = readAndroidRemoteDevices();
      const updates = [];
      entries.forEach((entry) => {
        const adb = devices.find(
          (dev) => dev.adbId && dev.adbId === entry.adbId
        );
        const nextStatus = adb
          ? adb.status === "device"
            ? "connected"
            : "disconnected"
          : "disconnected";
        if (entry.status !== nextStatus) {
          entry.status = nextStatus;
          entry.updated_at = new Date().toISOString();
          updates.push(entry);
        }
      });
      if (updates.length) {
        writeAndroidRemoteDevices(entries);
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send("android-remote-status-updated", updates);
          }
        });
      }
    } catch (err) {
      console.warn("⚠️ Gagal memeriksa status ADB:", err?.message || err);
    }
  };
  setTimeout(checkStatus, 5000);
  adbStatusInterval = setInterval(checkStatus, 10000);
}

ipcMain.handle(
  "android-remote-run-action",
  async (_event, uid, action = "default", payload = {}) => {
    try {
      const result = await performAndroidRemoteAction(uid, action, payload);
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menjalankan aksi remote.",
      };
    }
  }
);

ipcMain.handle("android-remote-cancel-action", (_event, uid) => {
  const cancelled = cancelAndroidRemoteAction(uid);
  if (cancelled) {
    return { success: true, message: "Remote action dihentikan." };
  }
  return { success: false, message: "Tidak ada aksi remote yang berjalan." };
});

ipcMain.handle(
  "android-remote-send-shortcut",
  async (_event, uid, shortcutId) => {
    try {
      const message = await runAndroidShortcutCommand(uid, shortcutId);
      return { success: true, message };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menjalankan shortcut.",
      };
    }
  }
);

ipcMain.handle("android-remote-screenshot", async (event, uid) => {
  try {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const defaultName = `android-screenshot-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.png`;
    const dialogOpts = {
      title: "Simpan Screenshot Android",
      defaultPath: path.join(
        app.getPath("pictures") || app.getPath("home"),
        defaultName
      ),
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    };
    const { canceled, filePath } = await dialog.showSaveDialog(
      browserWindow,
      dialogOpts
    );
    if (canceled || !filePath) {
      return {
        success: false,
        cancelled: true,
        message: "Penyimpanan screenshot dibatalkan.",
      };
    }
    const result = await captureAndroidScreenshot(uid, filePath);
    return {
      success: true,
      path: result.path,
      message: "Screenshot berhasil disimpan.",
    };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal mengambil screenshot.",
    };
  }
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
    sendSystemInfoReport({
      eventType: "device:delete",
      deviceChange: {
        action: "delete",
        device: buildDeviceSnapshot(deviceToDelete),
      },
    });
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

ipcMain.handle("android-remote-open-display", async (_event, uid) => {
  try {
    const result = openAndroidDeviceDisplay(uid);
    return { success: true, ...result };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal membuka tampilan perangkat.",
    };
  }
});

ipcMain.handle("copy-to-clipboard", (_event, text = "") => {
  try {
    clipboard.writeText(String(text || ""));
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal menyalin." };
  }
});

ipcMain.handle("scrcpy-check", () => {
  try {
    return {
      success: true,
      installed: isScrcpyInstalled(),
      platform: process.platform,
    };
  } catch (err) {
    return {
      success: false,
      installed: false,
      message: err?.message || "Gagal memeriksa ketersediaan scrcpy.",
    };
  }
});

ipcMain.handle("scrcpy-install", async (event) => {
  try {
    const sendProgress = (payload) => {
      try {
        event?.sender?.send("scrcpy-install-progress", payload);
      } catch (_) {
        // ignore
      }
    };
    if (isScrcpyInstalled()) {
      return {
        success: true,
        installed: true,
        alreadyInstalled: true,
        message: "scrcpy sudah terpasang.",
      };
    }
    await installScrcpyAutomatically(sendProgress);
    const installed = isScrcpyInstalled();
    if (installed) {
      sendProgress({ percent: 100, message: "scrcpy berhasil dipasang." });
      return {
        success: true,
        installed: true,
        message: "scrcpy berhasil dipasang.",
      };
    }
    return {
      success: false,
      installed: false,
      message:
        "Instalasi selesai, tetapi scrcpy belum terdeteksi. Silakan cek log terminal.",
    };
  } catch (err) {
    return {
      success: false,
      installed: false,
      message:
        err?.message ||
        "Gagal menjalankan instalasi otomatis scrcpy. Coba pasang manual.",
    };
  }
});

// ============================================
// Android Remote Control IPC Handlers
// ============================================

ipcMain.handle("android-remote-wake", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    await ensureDeviceScreenAwake(record.adbId);
    return { success: true, message: "Layar dibangunkan." };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal membangunkan layar.",
    };
  }
});

ipcMain.handle("android-remote-unlock", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    const adbId = record.adbId;
    await ensureDeviceScreenAwake(adbId);
    await sendAndroidKeyevent(adbId, 82); // MENU key to unlock
    return { success: true, message: "Device dibuka." };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal membuka device." };
  }
});

ipcMain.handle("android-remote-press-back", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    await sendAndroidKeyevent(record.adbId, 4); // BACK
    return { success: true, message: "Tombol Back ditekan." };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal menekan Back." };
  }
});

ipcMain.handle("android-remote-press-home", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    await sendAndroidKeyevent(record.adbId, 3); // HOME
    return { success: true, message: "Tombol Home ditekan." };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal menekan Home." };
  }
});

ipcMain.handle("android-remote-press-recent", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    await sendAndroidKeyevent(record.adbId, 187); // RECENT APPS
    return { success: true, message: "Recent Apps ditampilkan." };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal menampilkan Recent Apps.",
    };
  }
});

ipcMain.handle("android-remote-rotate", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    const manager = ensureAndroidManagerReady();
    // Toggle auto-rotate and then rotate
    await manager.runAdbCommand(
      [
        "-s",
        record.adbId,
        "shell",
        "content",
        "insert",
        "--uri",
        "content://settings/system",
        "--bind",
        "name:s:accelerometer_rotation",
        "--bind",
        "value:i:1",
      ],
      { timeout: 5000, silent: true }
    );
    await sendAndroidKeyevent(record.adbId, 111); // ESCAPE key (rotate)
    return { success: true, message: "Layar dirotasi." };
  } catch (err) {
    return { success: false, message: err?.message || "Gagal merotasi layar." };
  }
});

ipcMain.handle("android-remote-start-recording", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    const adbId = record.adbId;

    // Check if already recording
    if (scrcpyRecordings.has(adbId)) {
      throw new Error("Perekaman sudah berjalan.");
    }

    const timestamp = Date.now();
    const filename = `starbox_recording_${timestamp}.mp4`;
    const remotePath = `/sdcard/Download/${filename}`;

    const manager = ensureAndroidManagerReady();
    // Start screen recording
    const recordProc = spawn(
      manager.getADBBinary(),
      ["-s", adbId, "shell", "screenrecord", remotePath],
      { stdio: "ignore" }
    );

    scrcpyRecordings.set(adbId, { proc: recordProc, remotePath, filename });

    return { success: true, message: "Perekaman dimulai." };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal memulai perekaman.",
    };
  }
});

ipcMain.handle("android-remote-stop-recording", async (event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    const adbId = record.adbId;

    const recording = scrcpyRecordings.get(adbId);
    if (!recording) {
      throw new Error("Tidak ada perekaman yang berjalan.");
    }

    // Stop recording by killing the process
    if (recording.proc && !recording.proc.killed) {
      recording.proc.kill("SIGINT");
    }

    // Wait a bit for file to be written
    await sleep(1000);

    // Pull the file
    const manager = ensureAndroidManagerReady();
    const safeAdbId = String(adbId)
      .replace(/[^a-z0-9_-]+/gi, "-")
      .toLowerCase();
    const tempDir = path.join(os.tmpdir(), "starbox-recordings");
    fs.mkdirSync(tempDir, { recursive: true });
    const localPath = path.join(tempDir, `${safeAdbId}-${recording.filename}`);

    await manager.runAdbCommand(
      ["-s", adbId, "pull", recording.remotePath, localPath],
      { timeout: 30000, silent: true }
    );

    // Delete remote file
    await manager
      .runAdbCommand(["-s", adbId, "shell", "rm", recording.remotePath], {
        timeout: 8000,
        silent: true,
      })
      .catch(() => {});

    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const defaultName = `android-recording-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.mp4`;
    const defaultDir =
      app.getPath("videos") ||
      app.getPath("movies") ||
      app.getPath("documents") ||
      app.getPath("downloads");
    const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
      title: "Simpan Rekaman Android",
      defaultPath: path.join(defaultDir, defaultName),
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
    });

    let finalPath = localPath;
    let manualSave = false;
    if (!canceled && filePath) {
      fs.copyFileSync(localPath, filePath);
      finalPath = filePath;
      manualSave = true;
    }

    scrcpyRecordings.delete(adbId);

    const message = manualSave
      ? "Perekaman disimpan."
      : `Perekaman tersimpan sementara di ${localPath}`;

    return {
      success: true,
      message,
      path: finalPath,
      manualSave,
      tempPath: localPath,
      cancelled: canceled,
    };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal menghentikan perekaman.",
    };
  }
});

ipcMain.handle("android-remote-volume-up", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    await sendAndroidKeyevent(record.adbId, 24); // VOLUME_UP
    return { success: true, message: "Volume dinaikkan." };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal menaikkan volume.",
    };
  }
});

ipcMain.handle("android-remote-volume-down", async (_event, uid) => {
  try {
    const record = findAndroidRemoteDevice(uid);
    if (!record || !record.adbId) {
      throw new Error("Device tidak ditemukan.");
    }
    await sendAndroidKeyevent(record.adbId, 25); // VOLUME_DOWN
    return { success: true, message: "Volume diturunkan." };
  } catch (err) {
    return {
      success: false,
      message: err?.message || "Gagal menurunkan volume.",
    };
  }
});

// ============================================
// Android Emulator IPC Handlers
// ============================================

ipcMain.handle("android-check-installation", () => {
  try {
    const manager = ensureAndroidManagerReady();
    const installed = manager.isInstalled();
    const downloadSize = manager.getEstimatedDownloadSize();
    return { success: true, installed, downloadSize };
  } catch (err) {
    console.error("❌ android-check-installation gagal:", err);
    return { success: false, installed: false, error: err.message };
  }
});

ipcMain.handle("android-download", async (event, uid) => {
  const manager = ensureAndroidManagerReady();
  const sender = event.sender;
  const relayProgress = (payload = {}) =>
    sendAndroidProgress(sender, "android-download-progress", uid, payload);
  try {
    await manager.downloadAndSetup(relayProgress);
    return { success: true };
  } catch (err) {
    relayProgress({
      phase: "error",
      message: err?.message || "Download gagal",
    });
    console.error("❌ android-download gagal:", err);
    throw err;
  }
});

ipcMain.handle("android-fix-issues", async (event, uid) => {
  const manager = ensureAndroidManagerReady();
  const sender = event.sender;
  const relayProgress = (payload = {}) =>
    sendAndroidProgress(sender, "android-fix-progress", uid, payload);
  try {
    await manager.fixEmulatorIssues(relayProgress);
    return { success: true };
  } catch (err) {
    relayProgress({
      phase: "error",
      message: err?.message || "Gagal memperbaiki emulator",
    });
    console.error("❌ android-fix-issues gagal:", err);
    return { success: false, message: err?.message || "Gagal memperbaiki emulator" };
  }
});

ipcMain.handle("android-start", async (event, uid, options = {}) => {
  const manager = ensureAndroidManagerReady();
  const sender = event.sender;
  const progressCallback = (payload = {}) =>
    sendAndroidProgress(sender, "android-start-progress", uid, payload);
  const config = getDeviceConfig(uid) || {};
  const avdName =
    (config.avdName && config.avdName.trim()) || generateAvdName(uid);
  const spec = normalizeAndroidSpecInput(config.androidSpec);
  try {
    const result = await manager.startEmulator(avdName, {
      ...(options || {}),
      progressCallback,
      spec,
    });
    return result;
  } catch (err) {
    progressCallback({
      phase: "error",
      message: err?.message || "Gagal memulai emulator",
    });
    console.error("❌ android-start gagal:", err);
    throw err;
  }
});

ipcMain.handle("android-stop", async () => {
  try {
    const manager = ensureAndroidManagerReady();
    return await manager.stopEmulator();
  } catch (err) {
    console.error("❌ android-stop gagal:", err);
    throw err;
  }
});

// ============================================
// iOS Simulator IPC Handlers
// ============================================

ipcMain.handle("ios-check-availability", () => {
  try {
    if (!iosManager) {
      return {
        success: false,
        available: false,
        error: "iOS Manager not initialized",
      };
    }
    const available = iosManager.isAvailable();
    console.log(`📱 iOS Simulator availability check: ${available}`);
    return { success: true, available };
  } catch (err) {
    console.error("❌ iOS availability check failed:", err);
    return { success: false, available: false, error: err.message };
  }
});

ipcMain.handle("ios-get-devices", () => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    const devices = iosManager.getDevices();
    console.log(`📱 Found ${devices.length} iOS simulators`);
    return { success: true, devices };
  } catch (err) {
    console.error("❌ Failed to get iOS devices:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-boot", async (event, udid) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Booting iOS simulator: ${udid}`);

    const result = await iosManager.bootDevice(udid, (progress) => {
      event.sender.send("ios-boot-progress", progress);
    });

    console.log(`✅ iOS simulator booted successfully: ${udid}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to boot iOS simulator ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-shutdown", async (event, udid) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Shutting down iOS simulator: ${udid}`);

    const result = await iosManager.shutdownDevice(udid);

    console.log(`✅ iOS simulator shut down successfully: ${udid}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to shutdown iOS simulator ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-shutdown-all", async () => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log("📱 Shutting down all iOS simulators");

    const result = await iosManager.shutdownAll();

    console.log("✅ All iOS simulators shut down");
    return result;
  } catch (err) {
    console.error("❌ Failed to shutdown all iOS simulators:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-install-app", async (event, udid, appPath) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Installing app on iOS simulator ${udid}: ${appPath}`);

    const result = await iosManager.installApp(udid, appPath);

    console.log(`✅ App installed successfully on ${udid}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to install app on ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-launch-app", async (event, udid, bundleId) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Launching app ${bundleId} on iOS simulator ${udid}`);

    const result = await iosManager.launchApp(udid, bundleId);

    console.log(`✅ App ${bundleId} launched successfully on ${udid}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to launch app ${bundleId} on ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-uninstall-app", async (event, udid, bundleId) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Uninstalling app ${bundleId} from iOS simulator ${udid}`);

    const result = await iosManager.uninstallApp(udid, bundleId);

    console.log(`✅ App ${bundleId} uninstalled from ${udid}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to uninstall app ${bundleId} from ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-open-url", async (event, udid, url) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Opening URL on iOS simulator ${udid}: ${url}`);

    const result = await iosManager.openURL(udid, url);

    console.log(`✅ URL opened successfully on ${udid}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to open URL on ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-get-screenshot", async (event, udid, outputPath) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Taking screenshot from iOS simulator ${udid}`);

    const result = await iosManager.getScreenshot(udid, outputPath);

    console.log(`✅ Screenshot saved to ${outputPath}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to take screenshot from ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-erase-device", async (event, udid) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    console.log(`📱 Erasing iOS simulator ${udid}`);

    const result = await iosManager.eraseDevice(udid);

    console.log(`✅ iOS simulator ${udid} erased successfully`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to erase iOS simulator ${udid}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("ios-is-booted", (event, udid) => {
  try {
    if (!iosManager) {
      return { success: false, error: "iOS Manager not initialized" };
    }
    const booted = iosManager.isBooted(udid);
    return { success: true, booted };
  } catch (err) {
    console.error(
      `❌ Failed to check if iOS simulator ${udid} is booted:`,
      err
    );
    return { success: false, error: err.message };
  }
});

// ============================================
// End of iOS Simulator IPC Handlers
// ============================================

// ============================================
// WhatsApp Gateway IPC Handlers
// ============================================

// Store event callbacks for WA Gateway devices
const waDeviceCallbacks = new Map();

ipcMain.handle("wa-get-devices", async () => {
  try {
    const devices = BaileysManager.getDevices();
    return { success: true, devices };
  } catch (error) {
    console.error("❌ Failed to get WA devices:", error);
    return { success: false, error: error.message };
  }
});

// Helper function to check if error is missing module error
function isMissingModuleError(error) {
  const errorMsg = error.message || error.toString();
  return (
    errorMsg.includes("Cannot find module") ||
    errorMsg.includes("Cannot find package") ||
    errorMsg.includes("MODULE_NOT_FOUND")
  );
}

// Helper function to show missing deps modal
function showMissingDepsModal(error) {
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : __dirname;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("show-missing-deps-modal", {
      message: error.message || error.toString(),
      appPath: appPath,
    });
  }
}

ipcMain.handle("wa-create-device", async (_event, deviceId, name) => {
  try {
    const device = BaileysManager.createDevice(deviceId, name);
    sendSystemInfoReport({
      eventType: "wa-gateway-device-added",
      whatsappGatewayChange: {
        type: "added",
        device: {
          id: device.id,
          name: device.name,
          status: device.status || "disconnected",
          phone: device.phone || null,
        },
      },
    });
    return { success: true, device };
  } catch (error) {
    console.error("❌ Failed to create WA device:", error);

    // Check if it's a missing module error
    if (isMissingModuleError(error)) {
      showMissingDepsModal(error);
    }

    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-start-device", async (event, deviceId) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    const result = await BaileysManager.startDevice(
      deviceId,
      // onQR callback
      (qr) => {
        if (senderWindow && !senderWindow.isDestroyed()) {
          senderWindow.webContents.send("wa-qr-code", deviceId, qr);
        }
      },
      // onConnected callback
      (phone) => {
        if (senderWindow && !senderWindow.isDestroyed()) {
          senderWindow.webContents.send("wa-connected", deviceId, phone);
        }
      },
      // onMessage callback
      (from, message, rawMsg) => {
        if (senderWindow && !senderWindow.isDestroyed()) {
          senderWindow.webContents.send(
            "wa-message-received",
            deviceId,
            from,
            message
          );
        }
      },
      // onStatusChange callback
      (status) => {
        if (senderWindow && !senderWindow.isDestroyed()) {
          senderWindow.webContents.send("wa-status-change", deviceId, status);
        }
      }
    );

    return result;
  } catch (error) {
    console.error("❌ Failed to start WA device:", error);

    // Check if it's a missing module error
    if (isMissingModuleError(error)) {
      showMissingDepsModal(error);
    }

    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-stop-device", async (_event, deviceId, options = {}) => {
  try {
    const result = await BaileysManager.stopDevice(deviceId, options);
    return result;
  } catch (error) {
    console.error("❌ Failed to stop WA device:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-delete-device", async (_event, deviceId) => {
  try {
    const device = BaileysManager.getDevice(deviceId);
    const result = await BaileysManager.deleteDevice(deviceId);
    if (result.success) {
      sendSystemInfoReport({
        eventType: "wa-gateway-device-removed",
        whatsappGatewayChange: {
          type: "removed",
          device: {
            id: device?.id || deviceId,
            name: device?.name || null,
            status: device?.status || "disconnected",
            phone: device?.phone || null,
          },
        },
      });
    }
    return result;
  } catch (error) {
    console.error("❌ Failed to delete WA device:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "wa-send-message",
  async (_event, deviceId, phone, message, options = {}) => {
    try {
      const result = await BaileysManager.sendMessage(
        deviceId,
        phone,
        message,
        options
      );
      return result;
    } catch (error) {
      console.error("❌ Failed to send WA message:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("wa-get-status", (_event, deviceId) => {
  try {
    const status = BaileysManager.getConnectionStatus(deviceId);
    return { success: true, ...status };
  } catch (error) {
    console.error("❌ Failed to get WA status:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-get-profile", (_event, deviceId) => {
  try {
    const profile = BaileysManager.getDeviceProfile(deviceId);
    return { success: true, profile };
  } catch (error) {
    console.error("❌ Failed to get WA profile:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-get-auto-replies", (_event, deviceId) => {
  try {
    const replies = BaileysManager.getAutoReplies(deviceId);
    return { success: true, replies };
  } catch (error) {
    console.error("❌ Failed to get auto replies:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "wa-add-auto-reply",
  (_event, deviceId, keyword, replyMessage, scope, matchType) => {
    try {
      const reply = BaileysManager.addAutoReply(
        deviceId,
        keyword,
        replyMessage,
        scope,
        matchType
      );
      return { success: true, reply };
    } catch (error) {
      console.error("❌ Failed to add auto reply:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("wa-delete-auto-reply", (_event, replyId) => {
  try {
    const result = BaileysManager.deleteAutoReply(replyId);
    return result;
  } catch (error) {
    console.error("❌ Failed to delete auto reply:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-toggle-auto-reply", (_event, replyId, isActive) => {
  try {
    const result = BaileysManager.toggleAutoReply(replyId, isActive);
    return result;
  } catch (error) {
    console.error("❌ Failed to toggle auto reply:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-set-auto-reply-enabled", (_event, deviceId, enabled) => {
  try {
    const result = BaileysManager.updateDevice(deviceId, {
      auto_reply_enabled: enabled ? 1 : 0,
    });
    return { success: true, device: result };
  } catch (error) {
    console.error("❌ Failed to set auto reply enabled:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-set-auto-reject-calls", (_event, deviceId, enabled) => {
  try {
    const result = BaileysManager.updateDevice(deviceId, {
      auto_reject_calls: enabled ? 1 : 0,
    });
    return { success: true, device: result };
  } catch (error) {
    console.error("❌ Failed to set auto reject calls:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("toggle-remote-enabled", (_event, uid, enabled) => {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = JSON.parse(raw);
    const index = data.devices.findIndex((d) => d.uid === uid || d.token === uid);
    if (index === -1) return { success: false, message: "Device tidak ditemukan" };
    data.devices[index].remoteEnabled = enabled !== false;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return { success: true, remoteEnabled: data.devices[index].remoteEnabled };
  } catch (err) {
    console.error("❌ Failed to toggle remote enabled:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("wa-get-schedules", (_event, deviceId) => {
  try {
    const schedules = BaileysManager.getSchedules(deviceId);
    return { success: true, schedules };
  } catch (error) {
    console.error("❌ Failed to get schedules:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "wa-add-schedule",
  (_event, deviceId, scheduleName, cronExpression, message, recipients) => {
    try {
      const schedule = BaileysManager.addSchedule(
        deviceId,
        scheduleName,
        cronExpression,
        message,
        recipients
      );
      return { success: true, schedule };
    } catch (error) {
      console.error("❌ Failed to add schedule:", error);
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("wa-delete-schedule", (_event, scheduleId) => {
  try {
    const result = BaileysManager.deleteSchedule(scheduleId);
    return result;
  } catch (error) {
    console.error("❌ Failed to delete schedule:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-get-message-logs", (_event, deviceId, limit) => {
  try {
    const logs = BaileysManager.getMessageLogs(deviceId, limit);
    return { success: true, logs };
  } catch (error) {
    console.error("❌ Failed to get message logs:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-clear-logs", (_event, deviceId, days) => {
  try {
    const result = BaileysManager.clearMessageLogs(deviceId, days);
    return result;
  } catch (error) {
    console.error("❌ Failed to clear WA logs:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-open-web", async (_event, deviceId) => {
  try {
    await openWhatsAppWebWindow(deviceId);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to open WhatsApp Web:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-send-typing", async (_event, deviceId, target) => {
  try {
    await BaileysManager.sendTypingStatus(deviceId, target);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send typing:", error);
    return { success: false, error: error.message };
  }
});

// ============================================
// End of WhatsApp Gateway IPC Handlers
// ============================================

// ============================================
// Logs IPC Handlers
// ============================================

ipcMain.handle("get-logs", async () => {
  try {
    const logPath = path.join(userDataPath, "starbox.log");

    // Check if log file exists
    if (!fs.existsSync(logPath)) {
      return {
        success: true,
        lines: [],
        size: 0,
        path: logPath,
      };
    }

    // Get file size
    const stats = fs.statSync(logPath);
    const fileSize = stats.size;

    // Read last 2000 lines
    const content = fs.readFileSync(logPath, "utf-8");
    const allLines = content.split("\n");
    const lastLines = allLines.slice(-2000);

    return {
      success: true,
      lines: lastLines,
      size: fileSize,
      path: logPath,
    };
  } catch (error) {
    console.error("❌ Error reading logs:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("clear-logs", async () => {
  try {
    const logPath = path.join(userDataPath, "starbox.log");

    // Clear log file
    fs.writeFileSync(logPath, "");

    console.log("✅ Logs cleared successfully");
    return {
      success: true,
    };
  } catch (error) {
    console.error("❌ Error clearing logs:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// ============================================
// End of Logs IPC Handlers
// ============================================

// ============================================
// Auto Install Dependencies IPC Handlers
// ============================================

ipcMain.handle("auto-install-deps", async (event) => {
  try {
    const { exec } = require("child_process");

    // Find the correct app path with package.json
    let appPath = __dirname;
    if (app.isPackaged) {
      const possiblePaths = [
        path.join(process.resourcesPath, "app"),
        path.join(process.resourcesPath, "app.asar.unpacked"),
        process.resourcesPath,
      ];

      for (const testPath of possiblePaths) {
        const packageJsonPath = path.join(testPath, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          appPath = testPath;
          console.log("✅ Found package.json at:", packageJsonPath);
          break;
        }
      }
    }

    console.log("🔧 Auto-installing dependencies at:", appPath);

    // Verify package.json exists
    if (!fs.existsSync(path.join(appPath, "package.json"))) {
      throw new Error(
        `package.json tidak ditemukan di ${appPath}. ` +
          `Silakan gunakan opsi manual install.`
      );
    }

    // Check if npm is available
    const checkNpm = () => {
      return new Promise((resolve) => {
        exec("npm --version", (error) => {
          resolve(!error);
        });
      });
    };

    const npmAvailable = await checkNpm();
    if (!npmAvailable) {
      throw new Error(
        "Node.js/npm tidak ditemukan. Silakan install Node.js 20 LTS dari https://nodejs.org"
      );
    }

    // Run npm install using exec (more reliable on Windows)
    return new Promise((resolve, reject) => {
      const command =
        process.platform === "win32"
          ? `cd /d "${appPath}" && npm install`
          : `cd "${appPath}" && npm install`;

      console.log("🔧 Running command:", command);

      const npmInstall = exec(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        windowsHide: true,
      });

      let output = "";
      npmInstall.stdout.on("data", (data) => {
        output += data.toString();
        console.log(`[npm install] ${data.toString()}`);
      });

      npmInstall.stderr.on("data", (data) => {
        output += data.toString();
        console.error(`[npm install error] ${data.toString()}`);
      });

      npmInstall.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Dependencies installed successfully");
          resolve({
            success: true,
            message: "Dependencies berhasil diinstall",
          });
        } else {
          console.error("❌ npm install failed with code:", code);
          reject(
            new Error(
              `npm install gagal (exit code ${code}). Output: ${output}`
            )
          );
        }
      });

      npmInstall.on("error", (error) => {
        console.error("❌ Failed to run npm install:", error);
        reject(new Error(`Gagal menjalankan npm install: ${error.message}`));
      });
    });
  } catch (error) {
    console.error("❌ Auto install error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("restart-app", () => {
  console.log("🔄 Restarting app...");
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("get-app-path", () => {
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : __dirname;
  return appPath;
});

// ============================================
// End of Auto Install Dependencies IPC Handlers
// ============================================

// ============================================
// WhatsApp Device Auto-Reconnect & Status Checker
// ============================================

/**
 * Auto-reconnect WhatsApp devices that were connected before app restart
 */
async function autoReconnectWADevices() {
  try {
    console.log("🔄 Checking for WhatsApp devices to auto-reconnect...");
    await checkConnectedDevicesHealth();
  } catch (error) {
    console.error("❌ Error in auto-reconnect WhatsApp devices:", error);
  }
}

function broadcastToAllWAWindows(channel, ...args) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send(channel, ...args);
    }
  });
}

function broadcastStatusChange(deviceId, status) {
  broadcastToAllWAWindows("wa-status-change", deviceId, status);
}

function broadcastConnected(deviceId, phone) {
  broadcastToAllWAWindows("wa-connected", deviceId, phone);
}

const reconnectingDevices = new Set();
const reconnectCooldown = new Map();
const whatsappWebWindows = new Map();

async function openWhatsAppWebWindow(deviceId) {
  const existing = whatsappWebWindows.get(deviceId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }

  const device = BaileysManager.getDevice(deviceId);
  const title = device ? `WhatsApp Web · ${device.name}` : "WhatsApp Web";

  const waWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    title,
    autoHideMenuBar: true,
    backgroundColor: "#0c0d0e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const userAgent = await resolveWhatsAppUserAgent();
  waWindow.webContents.setUserAgent(userAgent);

  waWindow.loadFile(path.join(__dirname, "whatsapp-web.html"), {
    query: { deviceId },
  });

  waWindow.on("closed", () => {
    whatsappWebWindows.delete(deviceId);
  });

  whatsappWebWindows.set(deviceId, waWindow);
  return waWindow;
}

async function attemptSilentReconnect(device) {
  if (!device || reconnectingDevices.has(device.id)) {
    return;
  }

  if (BaileysManager.isAutoReconnectBlocked(device.id)) {
    console.log(
      `ℹ️ Auto-reconnect blocked for ${device.name} (${device.id}) after QR expiry`
    );
    return;
  }

  const lastAttempt = reconnectCooldown.get(device.id);
  const cooldownMs = 30 * 1000;
  if (lastAttempt && Date.now() - lastAttempt < cooldownMs) {
    return;
  }

  const currentStatus = BaileysManager.getConnectionStatus(device.id);
  if (currentStatus.connected) {
    return;
  }

  reconnectingDevices.add(device.id);
  try {
    console.log(
      `🔁 Silent reconnect triggered for ${device.name} (${device.id})`
    );
    await BaileysManager.stopDevice(device.id, {
      logout: false,
      cleanup: false,
      closeSocket: true,
    });
    await BaileysManager.startDevice(
      device.id,
      undefined,
      (phone) => {
        broadcastConnected(device.id, phone);
      },
      undefined,
      (status) => {
        broadcastStatusChange(device.id, status);
      }
    );
    console.log(`✅ Silent reconnect completed for ${device.name}`);
  } catch (error) {
    console.error(
      `❌ Silent reconnect failed for ${device.name} (${device.id}):`,
      error?.message || error
    );
    const normalizedMessage = (error?.message || "").toLowerCase();
    if (normalizedMessage.includes("logged out")) {
      BaileysManager.updateDevice(device.id, {
        status: "disconnected",
        qr_code: null,
      });
      broadcastStatusChange(device.id, "disconnected");
    }
  } finally {
    reconnectingDevices.delete(device.id);
    reconnectCooldown.set(device.id, Date.now());
  }
}

async function checkConnectedDevicesHealth() {
  const devices = BaileysManager.getDevices();

  for (const device of devices) {
    if (device.status !== "connected") {
      continue;
    }

    if (BaileysManager.isAutoReconnectBlocked(device.id)) {
      continue;
    }

    try {
      const actualStatus = BaileysManager.getConnectionStatus(device.id);

      if (!actualStatus.connected) {
        console.log(
          `⚠️ Device ${device.name} (${device.id}) is marked connected but offline.`
        );
        BaileysManager.updateDevice(device.id, { status: "disconnected" });
        await attemptSilentReconnect(device);
        continue;
      }

      if (!device.phone && actualStatus.phone) {
        console.log(
          `📱 Updating phone number for device ${device.name}: ${actualStatus.phone}`
        );
        BaileysManager.updateDevice(device.id, { phone: actualStatus.phone });
      }
    } catch (deviceError) {
      console.error(
        `❌ Error checking status for device ${device.name}:`,
        deviceError?.message || deviceError
      );
    }
  }

  const statusSnapshot = collectWhatsAppGatewayStatusSnapshot();
  sendSystemInfoReport({
    eventType: "wa-gateway-status-check",
    whatsappGatewayStatus: statusSnapshot,
  });
}

/**
 * Start periodic status check for WhatsApp devices (every 15 minutes)
 */
let waStatusCheckInterval = null;
let waScheduleInterval = null;

function startWADeviceStatusChecker() {
  // Clear existing interval if any
  if (waStatusCheckInterval) {
    clearInterval(waStatusCheckInterval);
  }

  console.log(
    "⏱️ Starting WhatsApp device status checker (15-minute interval)"
  );

  // Run check every 15 minutes (15 * 60 * 1000 ms)
  waStatusCheckInterval = setInterval(async () => {
    try {
      console.log("🔍 Running periodic WhatsApp device status check...");
      await checkConnectedDevicesHealth();
      console.log("✅ Periodic status check completed");
    } catch (error) {
      console.error("❌ Error in periodic status check:", error);
    }
  }, 15 * 60 * 1000); // 15 minutes

  // Also run initial check after 30 seconds
  setTimeout(async () => {
    console.log("🔍 Running initial WhatsApp device status check...");
    try {
      await checkConnectedDevicesHealth();
    } catch (error) {
      console.error("❌ Error in initial status check:", error);
    }
  }, 30000); // 30 seconds
}

function broadcastScheduleStatus(scheduleId, status) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send("wa-schedule-status", scheduleId, status);
    }
  });
  try {
    BaileysManager.updateScheduleStatus(scheduleId, status);
  } catch (error) {
    console.error("❌ Failed to persist schedule status:", error);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeScheduledMessage(schedule, device, runAt) {
  if (!device || !device.id) return;
  const recipients = JSON.parse(schedule.recipients || "[]");
  const message = schedule.message || "";
  if (!recipients.length || !message) return;

  broadcastScheduleStatus(schedule.id, "pending");

  for (const phone of recipients) {
    broadcastScheduleStatus(schedule.id, "typing");
    try {
      await BaileysManager.sendTypingStatus(device.id, phone);
      const typingDelay = Math.min(Math.max(message.length * 120, 800), 3200);
      await sleep(typingDelay);
      await BaileysManager.sendMessage(device.id, phone, message, {
        source: "schedule",
      });
      broadcastScheduleStatus(schedule.id, "sent");
    } catch (error) {
      console.error(`❌ Scheduled message failed for ${phone}:`, error);
      broadcastScheduleStatus(schedule.id, "failed");
    }
  }

  BaileysManager.updateScheduleLastRun(schedule.id, runAt.toISOString());
}

async function checkWASchedules() {
  const now = new Date();
  const devices = BaileysManager.getDevices();

  for (const device of devices) {
    const schedules = BaileysManager.getSchedules(device.id);

    for (const schedule of schedules) {
      if (!schedule.is_active || !schedule.cron_expression) {
        continue;
      }

      try {
        const interval = cronParser.parseExpression(schedule.cron_expression, {
          currentDate: now,
          iterator: true,
        });
        const prev = interval.prev();
        const prevDate = prev?.value?.toDate();
        if (!prevDate) continue;

        const lastRun = schedule.last_run ? new Date(schedule.last_run) : null;
        if (lastRun && prevDate.getTime() <= lastRun.getTime()) {
          continue;
        }

        if (prevDate.getTime() > now.getTime()) {
          continue;
        }

        await executeScheduledMessage(schedule, device, prevDate);
      } catch (error) {
        console.error(
          `❌ Schedule check failed for ${schedule.schedule_name}:`,
          error
        );
      }
    }
  }
}

function startWAScheduleChecker() {
  if (waScheduleInterval) {
    clearInterval(waScheduleInterval);
  }

  console.log("⏱️ Starting WA schedule checker (1-minute interval)");
  waScheduleInterval = setInterval(async () => {
    try {
      await checkWASchedules();
    } catch (error) {
      console.error("❌ Error in schedule checker:", error);
    }
  }, 60 * 1000);

  checkWASchedules().catch((error) => {
    console.error("❌ Initial schedule run failed:", error);
  });
}

// Cleanup interval on app quit
app.on("will-quit", () => {
  if (cctvManager) cctvManager.stopAll();

  if (waStatusCheckInterval) {
    clearInterval(waStatusCheckInterval);
    waStatusCheckInterval = null;
  }

  if (waScheduleInterval) {
    clearInterval(waScheduleInterval);
    waScheduleInterval = null;
  }

  Object.keys(chromeSessions).forEach((uid) => {
    stopChromeNativeSession(uid);
  });
});

args.forEach((arg) => {
  if (arg === "--run-device") runDeviceFlag = true;
  else if (arg.startsWith("--uid=")) uid = arg.split("=")[1];
  else if (arg.startsWith("--service=")) service = arg.split("=")[1];
});

app.whenReady().then(async () => {
  // Initialize logging first
  initializeLogging();
  resolveLatestChromeVersion().catch((err) => {
    console.warn(
      "⚠️ Gagal memperbarui versi Chrome untuk user-agent:",
      err?.message || err
    );
  });

  // Initialize WhatsApp Gateway database
  try {
    await BaileysManager.initDatabase();
    console.log("✅ WhatsApp Gateway initialized");
    sendSystemInfoReport({ eventType: "wa-gateway-ready" });

    const waAutoReconnectEnabled = process.env.WA_AUTO_RECONNECT !== "false";
    if (waAutoReconnectEnabled) {
      await autoReconnectWADevices();
      startWADeviceStatusChecker();
    } else {
      console.log(
        "ℹ️ Auto-reconnect disabled via WA_AUTO_RECONNECT, skipping auto reconnect + health checks"
      );
    }
    startWAScheduleChecker();
  } catch (error) {
    console.error("❌ Failed to initialize WhatsApp Gateway:", error);
  }

  await refreshServicesFromServer();

  // ⛔ Jalankan langsung CLI jika diminta
  if (runDeviceFlag && uid && service) {
    console.log(`🖥️ CLI mode: Jalankan device ${uid}`);
    createDeviceWindow(uid, service);
    return;
  }

  // ✅ Buat window utama
  createMainWindow();
  registerStarCaptureShortcuts();
  startAdbStatusMonitor().catch((err) => {
    console.warn(
      "⚠️ Gagal memulai pemantauan status ADB:",
      err?.message || err
    );
  });

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

app.on("before-quit", () => {
  if (systemReportTimer) {
    clearInterval(systemReportTimer);
    systemReportTimer = null;
  }
  clearAuthRefreshTimer();
});

app.on("window-all-closed", () => {
  // Jangan quit kalau Web Hub masih aktif
  if (webHubWindow && !webHubWindow.isDestroyed()) return;
  // Jangan quit kalau ada device di hub (hub sedang dibuat)
  if (hubDevices.size > 0) return;
  // Di macOS, jangan quit saat semua window tutup — biarkan di dock
  if (process.platform === 'darwin') return;

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
      try { win.destroy(); } catch (err) {
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
const CHROME_BLANK_TARGET_PATTERNS = [
  new RegExp("^chrome://new-tab-page", "i"),
  new RegExp("^chrome://newtab", "i"),
  new RegExp("^chrome://startpage", "i"),
  new RegExp("^chrome-search://local-ntp", "i"),
  new RegExp("^chrome://welcome", "i"),
  new RegExp("^chrome://apps", "i"),
  new RegExp("^chrome://new-tab-page-3", "i"),
  new RegExp("^https://www\\.google\\.com/_", "i"),
  new RegExp("^https://www\\.google\\.com/chrome/newtab", "i"),
  new RegExp("^https://www\\.google\\.com/_/chrome/newtab", "i"),
  new RegExp("^https://www\\.google\\.com/_/chrome/signin", "i"),
];
const CHROME_BLANK_TITLE_SET = new Set([
  "New Tab",
  "New tab",
  "Tab baru",
  "Tab Baru",
  "Blank Tab",
  "New page",
]);

// ============================================================
// Remote Control – StarBox MultiDevice
// ============================================================

/**
 * Broadcast event ke semua BrowserWindow yang terbuka.
 */
function broadcastRemoteEvent(channel, data) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win || win.isDestroyed()) return;
    try { win.webContents.send(channel, data); } catch {}
  });
}

/**
 * Mulai remote client setelah user login.
 */
function startRemoteClient() {
  // Boleh dipanggil tanpa login — akan berjalan dalam mode guest (tanpa token)
  // Token hanya digunakan jika user sedang login

  // Auto-generate share PIN jika belum ada (terpisah dari permanentPin)
  try {
    if (!store.get("stardeskSharePin")) {
      store.set("stardeskSharePin", String(Math.floor(100000 + Math.random() * 900000)));
    }
  } catch {}

  try {
    const serverUrl = process.env.STARBOX_REMOTE_URL ||
      (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");

    remoteClient.start({
      token:        authSession?.token || null,  // null = guest mode (tanpa akun)
      appVersion:   APP_VERSION,
      serverUrl,
      deviceWindows,
      getDeviceConfig,
      dbPath:        DB_PATH,
      dbPathAndroid: ANDROID_REMOTE_DB_PATH,
      // Callback agar socket-client bisa push device list saat connect
      onGetMikrotikDevices: () => loadMikrotikDevices(),
      ipcHandlers: {
        "load-devices": async (dbType) => {
          if (dbType === "android") {
            return { devices: readAndroidRemoteDevices() };
          }

          const targetPath = DB_PATH;
          if (!targetPath) return { devices: [] };

          const dbDir = path.dirname(targetPath);
          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
          }
          if (!fs.existsSync(targetPath)) {
            fs.writeFileSync(targetPath, JSON.stringify({ devices: [] }, null, 2));
            return { devices: [] };
          }

          let raw = "";
          try {
            raw = fs.readFileSync(targetPath, "utf8");
          } catch (err) {
            console.warn("⚠️ Remote load-devices gagal baca file:", err?.message || err);
            return { devices: [] };
          }

          let data = { devices: [] };
          if (raw && raw.trim()) {
            try {
              data = JSON.parse(raw);
            } catch (parseErr) {
              try {
                const cleanedRaw = raw.replace(/^\uFEFF/, "").replace(/\u0000/g, "");
                data = JSON.parse(cleanedRaw);
                if (cleanedRaw !== raw) {
                  fs.writeFileSync(targetPath, cleanedRaw, "utf8");
                }
              } catch {
                console.warn(
                  "⚠️ Remote load-devices gagal parse devices.json:",
                  parseErr?.message || parseErr
                );
                return { devices: [] };
              }
            }
          }

          if (!Array.isArray(data.devices)) {
            data.devices = [];
          }
          const modified = normalizeDeviceList(data);
          if (modified) {
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
          }
          // For "web" dbType, exclude android emulator devices
          const filtered = dbType === "web"
            ? (data.devices || []).filter(d => (d.service || "").toLowerCase() !== "android")
            : (data.devices || []);
          return { devices: filtered };
        },
        "start-device": async (uid, service) => {
          startDevice(uid, service);
          return { ok: true };
        },
        "stop-device": async (uid) => {
          if (!uid) throw new Error("uid wajib diisi");
          await stopDevice(uid);
          return { ok: true };
        },
        "focus-device": async (uid) => {
          if (!uid) throw new Error("uid wajib diisi");
          const win = deviceWindows[uid];
          if (!win || win.isDestroyed()) {
            throw new Error(`Window device ${uid} tidak ditemukan`);
          }
          if (win.isMinimized()) win.restore();
          win.focus();
          return { ok: true };
        },
        "ensure-monitor-window": async (uid) => {
          if (!uid) throw new Error("uid wajib diisi");
          const parentWindow = deviceWindows[uid];
          if (!parentWindow || parentWindow.isDestroyed()) {
            throw new Error(`Device ${uid} tidak sedang berjalan`);
          }
          await ensureMonitorWindow(uid, parentWindow);
          return { ok: true };
        },
        "close-monitor-window": async (uid) => {
          if (!uid) throw new Error("uid wajib diisi");
          const monitor = monitorWindows[uid];
          if (monitor && !monitor.isDestroyed()) {
            monitor.close();
          }
          delete monitorWindows[uid];
          return { ok: true };
        },
        // MikroTik: buka Web UI via proxy lokal (dipanggil oleh relay command)
        "mikrotik:open-webui-proxy": async ({ deviceId, host, webPort, name }) => {
          return startMikrotikProxy(deviceId || host, host, webPort).then(async (proxyResult) => {
            if (!proxyResult.success) return proxyResult;
            const win = new BrowserWindow({
              width: 1280, height: 900,
              title: `MikroTik WebUI – ${name || host}`,
              webPreferences: { nodeIntegration:false, contextIsolation:true, webSecurity:false, allowRunningInsecureContent:true },
              icon: path.join(__dirname, "assets", "starbox.png"),
            });
            win.loadURL(`http://127.0.0.1:${proxyResult.port}/`);
            win.setMenuBarVisibility(false);
            win.on("closed", () => {
              const entry = mikrotikProxyServers.get(deviceId || host);
              if (entry) { entry.server.close(); mikrotikProxyServers.delete(deviceId || host); }
            });
            return { success: true };
          });
        },
      },
    });

    remoteClient.onClientsChange((clients) => {
      broadcastRemoteEvent("remote:clients-updated", { clients });
    });
    remoteClient.onConnectionChange(({ connected }) => {
      broadcastRemoteEvent("remote:connection-changed", { connected });
      // Saat terhubung, kirim share PIN ke server (berlaku untuk semua user, bukan permanentPin)
      if (connected) {
        try {
          const sharePin = store.get("stardeskSharePin") || "";
          if (sharePin) {
            remoteClient.socketClient?.socket?.emit("device:register-pin", { pin: sharePin });
          }
        } catch {}
      }
    });
    remoteClient.onAuthInvalid(async () => {
      console.warn("[Remote] AUTH_INVALID — refresh token dan reconnect...");
      try {
        await refreshAuthToken();
        // refreshAuthToken() sudah memanggil remoteClient.updateToken(newToken)
        // yang akan reconnect dengan token baru
      } catch (err) {
        console.error("[Remote] Gagal refresh token setelah AUTH_INVALID:", err.message);
        // Retry dalam 10 detik
        setTimeout(() => startRemoteClient(), 10000);
      }
    });

    console.log("[Remote] Client started, ID:", remoteClient.clientId);
    // Attach StarDesk stream socket handlers immediately (socket instance exists after start)
    _attachStarDeskStreamHandlers();
    startRemoteWatchdog();
  } catch (err) {
    console.error("[Remote] Gagal start remote client:", err.message);
  }
}

/**
 * Hentikan remote client saat logout.
 */
function stopRemoteClient() {
  stopRemoteWatchdog();
  try {
    remoteClient.stop();
    console.log("[Remote] Client stopped");
  } catch (err) {
    console.error("[Remote] Gagal stop remote client:", err.message);
  }
}

// ── Remote Watchdog ──────────────────────────────────────────
let _remoteWatchdogTimer = null;

/**
 * Watchdog: setiap 15 detik cek apakah remote client harus terhubung tapi tidak.
 * Restart koneksi jika token masih valid tapi socket terputus diam-diam.
 */
function startRemoteWatchdog() {
  stopRemoteWatchdog();
  _remoteWatchdogTimer = setInterval(() => {
    if (remoteClient.isConnected) return;

    // Socket terputus tapi user masih login — restart
    console.log("[Remote] Watchdog: socket terputus, restart remote client...");
    try {
      startRemoteClient();
    } catch (err) {
      console.error("[Remote] Watchdog restart gagal:", err.message);
    }
  }, 15000);
}

function stopRemoteWatchdog() {
  if (_remoteWatchdogTimer) {
    clearInterval(_remoteWatchdogTimer);
    _remoteWatchdogTimer = null;
  }
}

// ── IPC Handlers Remote ─────────────────────────────────────

/** Ambil status koneksi dan daftar client online */
ipcMain.handle("remote:get-clients", () => ({
  clients:   remoteClient.onlineClients,
  clientId:  remoteClient.clientId,
  connected: remoteClient.isConnected,
}));

/** Paksa refresh daftar client dari server */
ipcMain.on("remote:refresh-clients", () => {
  remoteClient.refreshClients();
});

/** Kirim command ke client target, tunggu hasilnya */
ipcMain.handle("remote:send-command", async (_, { toClientId, command, payload }) => {
  try {
    const result = await remoteClient.sendCommand(toClientId, command, payload);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Kirim command tanpa menunggu result (untuk high-frequency event seperti pointer move) */
ipcMain.on("remote:fire-command", (_, { toClientId, command, payload }) => {
  try {
    remoteClient.fireCommand(toClientId, command, payload);
  } catch {}
});

/** Buka window Remote Control */
ipcMain.handle("remote:open-window", () => {
  const existing = BrowserWindow.getAllWindows().find(
    (w) => !w.isDestroyed() && w.webContents.getURL().includes("remote-control.html")
  );
  if (existing) {
    existing.focus();
    return { success: true };
  }
  const win = new BrowserWindow({
    width: 1080, height: 720,
    minWidth: 800, minHeight: 500,
    title: "Remote Control – StarBox",
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.loadFile(path.join(__dirname, "remote-control.html"));
  return { success: true };
});

/** Buka window monitor remote untuk satu device (bisa multi window per device berbeda). */
ipcMain.handle("remote:open-monitor-window", (_, payload = {}) => {
  try {
    const toClientId = String(payload?.toClientId || "").trim();
    const uid = String(payload?.uid || "").trim();
    const deviceName = String(payload?.deviceName || uid || "Remote Monitor").trim();
    const resolution = String(payload?.resolution || "auto").trim().toLowerCase();

    if (!toClientId || !uid) {
      return { success: false, error: "toClientId dan uid wajib diisi" };
    }

    const key = `${toClientId}::${uid}`;
    const existing = remoteMonitorWindows.get(key);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      existing.webContents.send("remote:monitor:update-meta", {
        toClientId,
        uid,
        deviceName,
        resolution,
      });
      return { success: true, reused: true };
    }

    let winWidth = 980;
    let winHeight = 760;
    const match = resolution.match(/^(\\d{3,5})x(\\d{3,5})$/);
    if (match) {
      const targetW = Number(match[1]);
      const targetH = Number(match[2]);
      if (Number.isFinite(targetW) && Number.isFinite(targetH)) {
        winWidth = Math.max(760, Math.min(1720, targetW + 140));
        winHeight = Math.max(560, Math.min(1220, targetH + 220));
      }
    }

    const win = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      minWidth: 640,
      minHeight: 480,
      title: `Remote View - ${deviceName}`,
      autoHideMenuBar: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.cjs"),
      },
    });

    win.loadFile(path.join(__dirname, "remote-monitor.html"), {
      query: {
        toClientId,
        uid,
        name: deviceName,
        resolution,
      },
    });

    remoteMonitorWindows.set(key, win);
    win.on("closed", () => {
      const current = remoteMonitorWindows.get(key);
      if (current === win) {
        remoteMonitorWindows.delete(key);
      }
    });

    return { success: true, reused: false };
  } catch (err) {
    return { success: false, error: err?.message || "Gagal membuka monitor window" };
  }
});

// ─── Remox – SSH / Telnet Terminal ───────────────────────────────────────────
const { Client: SshClient } = require("ssh2");
const REMOX_DB_PATH = path.join(app.getPath("userData"), "remox-connections.json");

function loadRemoxConnections() {
  try {
    if (fs.existsSync(REMOX_DB_PATH)) {
      return JSON.parse(fs.readFileSync(REMOX_DB_PATH, "utf8")).connections || [];
    }
  } catch {}
  return [];
}

function saveRemoxConnections(connections) {
  fs.writeFileSync(REMOX_DB_PATH, JSON.stringify({ connections }, null, 2), "utf8");
}

// sessionId -> { type, conn, stream, socket, winId }
const remoxSessions = new Map();

ipcMain.handle("remox:load-connections", () => loadRemoxConnections());

ipcMain.handle("remox:save-connection", (_, conn) => {
  const connections = loadRemoxConnections();
  if (conn.id) {
    const idx = connections.findIndex((c) => c.id === conn.id);
    if (idx >= 0) connections[idx] = conn;
    else connections.push(conn);
  } else {
    conn.id = require("uuid").v4();
    conn.created_at = new Date().toISOString();
    connections.push(conn);
  }
  saveRemoxConnections(connections);
  return conn;
});

ipcMain.handle("remox:delete-connection", (_, id) => {
  saveRemoxConnections(loadRemoxConnections().filter((c) => c.id !== id));
  return { success: true };
});

/**
 * Pull koneksi dari server ke lokal.
 * Server wins untuk UUID yang cocok; koneksi baru dari server ditambahkan;
 * koneksi lokal yang tidak ada di server tetap dipertahankan.
 */
async function pullRemoxFromCloud() {
  if (!authSession?.isLoggedIn || !authSession?.token) return { success: false, error: "Belum login." };
  const apiBase = DEFAULT_API_BASE_URL.replace(/\/$/, "");
  try {
    const res = await fetch(`${apiBase}/api/remox/connections`, {
      headers: { Authorization: `Bearer ${authSession.token}`, Accept: "application/json" },
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const serverConns = data.connections || [];

    const localConns  = loadRemoxConnections();
    const serverIds   = new Set(serverConns.map((c) => c.id));
    // Gabungkan: server menang untuk UUID yang sama, lokal-only tetap
    const localOnly   = localConns.filter((c) => !serverIds.has(c.id));
    const merged      = [
      ...serverConns.map((c) => ({
        ...c,
        sync_cloud: true,
        created_at: c.created_at || new Date().toISOString(),
      })),
      ...localOnly,
    ];
    saveRemoxConnections(merged);
    return { success: true, connections: merged, count: serverConns.length, limit: data.limit ?? null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

ipcMain.handle("remox:pull-from-cloud", () => pullRemoxFromCloud());

ipcMain.handle("remox:cloud-sync", async () => {
  if (!authSession?.isLoggedIn || !authSession?.token) {
    return { success: false, error: "Harap login terlebih dahulu untuk sinkron cloud." };
  }
  const localConns = loadRemoxConnections();
  const apiBase = DEFAULT_API_BASE_URL.replace(/\/$/, "");

  // Hanya kirim koneksi yang user setujui untuk disinkron
  const toSync = localConns.filter(c => c.sync_cloud !== false);

  try {
    const res = await fetch(`${apiBase}/api/remox/connections/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authSession.token}`,
      },
      body: JSON.stringify({ connections: toSync }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 120)}` };
    }
    const data = await res.json();
    const serverConns = data.connections || [];
    const syncedUuids = serverConns.map(c => c.id); // confirmed on server

    // Buat map sync_cloud flags dari data lokal
    const syncFlagMap = new Map(localConns.map(c => [c.id, c.sync_cloud]));

    // Merge: koneksi dari server (sudah di-sync) + restore flag lokal
    const serverIds = new Set(serverConns.map(c => c.id));
    const mergedFromServer = serverConns.map(c => ({
      ...c,
      sync_cloud: syncFlagMap.has(c.id) ? syncFlagMap.get(c.id) : true,
    }));

    // Koneksi lokal yang tidak ada di server (excluded atau belum sync)
    const localOnly = localConns.filter(c => !serverIds.has(c.id));

    const finalConns = [...mergedFromServer, ...localOnly];
    saveRemoxConnections(finalConns);

    return {
      success: true,
      connections: finalConns,
      syncedUuids,                     // UUIDs yang confirmed ada di server
      limit:   data.limit   ?? null,
      count:   data.count   ?? syncedUuids.length,
      skipped: data.skipped ?? 0,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("remox:connect", async (event, { sessionId, connectionId }) => {
  const conn = loadRemoxConnections().find((c) => c.id === connectionId);
  if (!conn) return { success: false, error: "Koneksi tidak ditemukan" };

  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: "Window tidak tersedia" };

  const sendData = (data) => {
    if (!win.isDestroyed()) win.webContents.send("remox:data", { sessionId, data });
  };
  const sendStatus = (status, message) => {
    if (!win.isDestroyed()) win.webContents.send("remox:status", { sessionId, status, message });
  };

  try {
    if (conn.type === "ssh") {
      await new Promise((resolve, reject) => {
        const ssh = new SshClient();
        ssh.on("ready", () => {
          ssh.shell({ term: "xterm-256color", rows: 24, cols: 80 }, (err, stream) => {
            if (err) { ssh.end(); reject(err); return; }
            remoxSessions.set(sessionId, { type: "ssh", conn: ssh, stream });
            stream.on("data", (d) => sendData(d.toString("binary")));
            stream.stderr.on("data", (d) => sendData(d.toString("binary")));
            stream.on("close", () => {
              remoxSessions.delete(sessionId);
              sendStatus("disconnected", "Koneksi SSH ditutup");
            });
            sendStatus("connected");
            resolve();
          });
        });
        ssh.on("error", reject);
        ssh.on("close", () => {
          if (remoxSessions.has(sessionId)) {
            remoxSessions.delete(sessionId);
            sendStatus("disconnected", "Koneksi SSH terputus");
          }
        });
        const opts = {
          host: conn.host,
          port: parseInt(conn.port) || 22,
          username: conn.username,
          readyTimeout: 20000,
        };
        if (conn.privateKey) opts.privateKey = conn.privateKey;
        else opts.password = conn.password || "";
        ssh.connect(opts);
      });
      return { success: true };

    } else if (conn.type === "telnet") {
      await new Promise((resolve, reject) => {
        const socket = new nodeNet.Socket();
        socket.setTimeout(20000);
        socket.once("connect", () => {
          socket.setTimeout(0);
          remoxSessions.set(sessionId, { type: "telnet", socket });
          sendStatus("connected");
          resolve();
        });
        socket.on("data", (d) => sendData(d.toString("binary")));
        socket.on("close", () => {
          if (remoxSessions.has(sessionId)) {
            remoxSessions.delete(sessionId);
            sendStatus("disconnected", "Koneksi Telnet terputus");
          }
        });
        socket.on("error", reject);
        socket.on("timeout", () => reject(new Error("Connection timeout")));
        socket.connect(parseInt(conn.port) || 23, conn.host);
      });
      return { success: true };

    } else {
      return { success: false, error: "Tipe koneksi tidak didukung" };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on("remox:send-data", (_, { sessionId, data }) => {
  const s = remoxSessions.get(sessionId);
  if (!s) return;
  if (s.type === "ssh" && s.stream) s.stream.write(data);
  else if (s.type === "telnet" && s.socket) s.socket.write(data);
});

ipcMain.on("remox:resize", (_, { sessionId, cols, rows }) => {
  const s = remoxSessions.get(sessionId);
  if (s?.type === "ssh" && s.stream) s.stream.setWindow(rows, cols, 0, 0);
});

ipcMain.handle("remox:disconnect", (_, sessionId) => {
  const s = remoxSessions.get(sessionId);
  if (!s) return { success: true };
  if (s.type === "ssh") { s.stream?.end(); s.conn?.end(); }
  else if (s.type === "telnet") { s.socket?.destroy(); }
  remoxSessions.delete(sessionId);
  return { success: true };
});

// Launch native RDP client
ipcMain.handle("remox:launch-rdp", async (_, { host, port, username, password, domain }) => {
  try {
    const rdpPort = parseInt(port) || 3389;
    const userField = domain ? `${domain}\\${username}` : (username || "");

    // Build standard .rdp file — opened by mstsc (Win), MS Remote Desktop (mac), Remmina (Linux)
    const rdpLines = [
      `full address:s:${host}:${rdpPort}`,
      `username:s:${userField}`,
      `prompt for credentials:i:${password ? 0 : 1}`,
      `desktopwidth:i:1280`,
      `desktopheight:i:800`,
      `session bpp:i:32`,
      `compression:i:1`,
      `connection type:i:7`,
      `networkautodetect:i:1`,
      `bandwidthautodetect:i:1`,
      `authentication level:i:2`,
      `enablecredsspsupport:i:1`,
      `redirectclipboard:i:1`,
      `audiomode:i:0`,
    ];
    const tmpDir = app.getPath("temp");
    const rdpFile = path.join(tmpDir, `starbox_rdp_${Date.now()}.rdp`);
    fs.writeFileSync(rdpFile, rdpLines.join("\r\n") + "\r\n", "utf8");

    if (process.platform === "win32") {
      // Windows: mstsc.exe bawaan OS
      spawn("mstsc", [rdpFile], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      // macOS: shell.openPath membuka dengan MS Remote Desktop (jika terinstall)
      const err = await shell.openPath(rdpFile);
      if (err) {
        return { success: false, error: "Tidak ada aplikasi RDP. Silakan install Microsoft Remote Desktop dari App Store." };
      }
    } else {
      // Linux: coba shell.openPath dulu (Remmina/GNOME), fallback ke xfreerdp
      const err = await shell.openPath(rdpFile);
      if (err) {
        const args = [`/v:${host}:${rdpPort}`, `/u:${username || ""}`];
        if (domain) args.push(`/d:${domain}`);
        if (password) args.push(`/p:${password}`);
        args.push("/dynamic-resolution", "/cert:ignore", "+clipboard");
        spawn("xfreerdp", args, { detached: true, stdio: "ignore" }).unref();
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

// ── Resource Monitor ────────────────────────────────────────────────────────

// List running processes (like Activity Monitor / Task Manager)
ipcMain.handle('resource-monitor-processes', async (_, limit = 60) => {
  return new Promise((resolve) => {
    try {
      let cmd, args;
      if (process.platform === 'win32') {
        cmd = 'wmic';
        args = ['process', 'get', 'ProcessId,Name,WorkingSetSize,CommandLine', '/format:csv'];
      } else {
        // macOS / Linux: ps aux sorted by RSS memory
        cmd = 'ps';
        args = ['aux', '--no-headers'];
        if (process.platform === 'darwin') args = ['aux'];
      }

      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', d => { out += d.toString(); });
      child.on('close', () => {
        const procs = [];
        if (process.platform === 'win32') {
          // wmic csv: skip first 2 lines (empty, header)
          const lines = out.split('\n').filter(l => l.trim());
          const header = lines[0]?.split(',').map(h => h.trim());
          for (let i = 1; i < lines.length && procs.length < limit; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 3) continue;
            const pid  = parseInt(cols[header?.indexOf('ProcessId')] || cols[1]) || 0;
            const name = (cols[header?.indexOf('Name')] || cols[2] || '').replace(/"/g, '');
            const mem  = parseInt(cols[header?.indexOf('WorkingSetSize')] || cols[3]) || 0;
            if (!name || pid === 0) continue;
            procs.push({ pid, name, cpu: null, mem, user: '' });
          }
        } else {
          // USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
          const lines = out.split('\n');
          for (const line of lines) {
            if (!line.trim() || line.startsWith('USER')) continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length < 11) continue;
            const user = parts[0];
            const pid  = parseInt(parts[1]);
            const cpu  = parseFloat(parts[2]);
            const memPct = parseFloat(parts[3]);
            const rss  = parseInt(parts[5]) * 1024; // RSS in KB → bytes
            const cmd  = parts.slice(10).join(' ');
            const name = parts[10].split('/').pop().split('\\').pop().slice(0, 40);
            if (!pid) continue;
            procs.push({ pid, name, cpu, memPct, mem: rss, user, cmd: cmd.slice(0, 80) });
          }
        }
        // sort by memory desc, limit
        procs.sort((a, b) => (b.mem || 0) - (a.mem || 0));
        resolve(procs.slice(0, limit));
      });
      child.on('error', () => resolve([]));
      setTimeout(() => { try { child.kill(); } catch {} resolve([]); }, 5000);
    } catch (e) {
      resolve([]);
    }
  });
});

// Kill a process by PID (restricted — cannot kill StarBox itself or PID 1)
ipcMain.handle('resource-monitor-kill', async (_, pid) => {
  pid = parseInt(pid);
  if (!pid || pid <= 1 || pid === process.pid) {
    return { success: false, error: 'Proses tidak dapat dihentikan.' };
  }
  try {
    process.kill(pid, 'SIGTERM');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('resource-monitor-get', async () => {
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();

  // Disk usage (try fs.statfs → fallback df/wmic)
  let disk = null;
  try {
    const fsStatfs = fs.statfsSync || null;
    if (fsStatfs) {
      const st = fsStatfs(app.getPath('userData'));
      disk = {
        total: st.blocks * st.bsize,
        free:  st.bfree  * st.bsize,
        used:  (st.blocks - st.bfree) * st.bsize,
      };
    }
  } catch (_) {}
  if (!disk) {
    // best-effort: spawn df on unix, skip on windows
    try {
      if (process.platform !== 'win32') {
        const { execSync } = require('child_process');
        const raw = execSync('df -k /', { timeout: 2000 }).toString().split('\n')[1].trim().split(/\s+/);
        if (raw.length >= 4) {
          const total = parseInt(raw[1]) * 1024;
          const used  = parseInt(raw[2]) * 1024;
          const free  = parseInt(raw[3]) * 1024;
          disk = { total, used, free };
        }
      }
    } catch (_) {}
  }

  // Running service counts
  const webCount     = Object.keys(deviceWindows).length;
  const androidCount = vmProcesses.size;  // QEMU VMs
  let   cctvCount    = 0;
  try { cctvCount = cctvManager?.streams?.size || 0; } catch (_) {}
  let   waCount    = 0;
  try { waCount = waDeviceCallbacks?.size || 0; } catch (_) {}
  const adbRemoteCount = scrcpySessions.size;   // Android ADB Remote (scrcpy sessions)
  const remoxCount     = remoxSessions.size;    // Remox SSH/Telnet sessions

  const selfMem = process.memoryUsage();

  return {
    cpu:      _rmCpuCache,
    mem:      { total: totalMem, used: totalMem - freeMem, free: freeMem },
    disk,
    services: {
      webEmulator:      webCount,
      androidEmulator:  androidCount,
      cctvStreams:      cctvCount,
      waGateway:        waCount,
      adbRemote:        adbRemoteCount,
      remox:            remoxCount,
    },
    selfMem: {
      rss:        selfMem.rss,
      heapUsed:   selfMem.heapUsed,
      heapTotal:  selfMem.heapTotal,
      external:   selfMem.external,
    },
    system: {
      platform: os.platform(),
      arch:     os.arch(),
      cores:    os.cpus().length,
      model:    os.cpus()[0]?.model || '',
      hostname: os.hostname(),
      uptime:   os.uptime(),
    },
  };
});

// TCP reachability check (ping port)
ipcMain.handle("remox:ping", (_, { host, port }) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new nodeNet.Socket();
    socket.setTimeout(5000);
    socket.once("connect", () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ reachable: true, latency });
    });
    socket.once("error", () => { socket.destroy(); resolve({ reachable: false, latency: null }); });
    socket.once("timeout", () => { socket.destroy(); resolve({ reachable: false, latency: null }); });
    socket.connect(parseInt(port) || 22, host);
  });
});

// ═══════════════════════════════════════════════════════════════
// ── LOG CLEANUP ───────────────────────────────────────────────
function trimStarboxLog() {
  try {
    const logPath = path.join(userDataPath, 'starbox.log');
    if (!fs.existsSync(logPath)) return;
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    // Lines format: "[LOG] 2024-01-01T00:00:00.000Z: ..."
    // Keep lines whose timestamp is within retention window, or lines with no parseable timestamp
    const kept = lines.filter(line => {
      const m = line.match(/^\[(?:LOG|ERR|WARN)\] (\d{4}-\d{2}-\d{2}T[\d:.]+Z):/);
      if (!m) return line.trim() !== ''; // keep non-empty non-timestamped lines
      return new Date(m[1]).getTime() >= cutoff;
    });
    fs.writeFileSync(logPath, kept.join('\n') + (kept.length ? '\n' : ''));
    console.log(`[LOG CLEANUP] starbox.log trimmed: kept ${kept.length} of ${lines.length} lines`);
  } catch (e) {
    // non-fatal
  }
}

// ── CRON JOB MANAGER ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const MAX_CRON_HISTORY = 100; // max history entries per job
let cronSchedulerInterval = null;

function cronDbRead() {
  if (!CRON_JOBS_DB_PATH) return { jobs: [] };
  const dir = path.dirname(CRON_JOBS_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CRON_JOBS_DB_PATH)) {
    fs.writeFileSync(CRON_JOBS_DB_PATH, JSON.stringify({ jobs: [] }, null, 2));
    return { jobs: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(CRON_JOBS_DB_PATH, "utf8"));
  } catch {
    return { jobs: [] };
  }
}

function cronDbWrite(data) {
  if (!CRON_JOBS_DB_PATH) return;
  const dir = path.dirname(CRON_JOBS_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CRON_JOBS_DB_PATH, JSON.stringify(data, null, 2));
}

function cronShouldRun(cronExpr, now) {
  try {
    const interval = cronParser.parseExpression(cronExpr, { currentDate: now, iterator: true });
    const prev = interval.prev();
    // Check if the previous scheduled time is within the current minute
    const prevDate = prev.value.toDate();
    return Math.abs(prevDate.getTime() - now.getTime()) < 60000;
  } catch {
    return false;
  }
}

function cronNextRun(cronExpr) {
  try {
    const interval = cronParser.parseExpression(cronExpr);
    return interval.next().toDate().toISOString();
  } catch {
    return null;
  }
}

async function cronExecuteJob(job) {
  const startTime = Date.now();
  const http = require("http");
  const https = require("https");
  const url = new URL(job.url);
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;

  const method = (job.method || "GET").toUpperCase();
  const headers = Object.assign({ "User-Agent": "StarBox-CronJob/1.0" }, job.headers || {});
  let body = null;
  if (method === "POST" && job.body) {
    body = typeof job.body === "string" ? job.body : JSON.stringify(job.body);
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    headers["Content-Length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 30000,
    };
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          duration: Date.now() - startTime,
          response: data.substring(0, 500),
        });
      });
    });
    req.on("error", (err) => {
      resolve({ status: 0, ok: false, duration: Date.now() - startTime, error: err.message });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, ok: false, duration: Date.now() - startTime, error: "Request timeout" });
    });
    if (body) req.write(body);
    req.end();
  });
}

function startCronScheduler() {
  if (cronSchedulerInterval) clearInterval(cronSchedulerInterval);
  // Align to the next whole minute, then tick every 60s
  const msToNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
  setTimeout(() => {
    runDueCronJobs();
    cronSchedulerInterval = setInterval(runDueCronJobs, 60000);
  }, msToNextMinute);
}

async function runDueCronJobs() {
  const db = cronDbRead();
  if (!db.jobs || !db.jobs.length) return;
  const now = new Date();
  let changed = false;
  for (const job of db.jobs) {
    if (!job.enabled) continue;
    if (!cronShouldRun(job.schedule, now)) continue;
    // Run the job
    const result = await cronExecuteJob(job).catch((err) => ({
      status: 0, ok: false, duration: 0, error: err.message,
    }));
    const historyEntry = {
      id: uuidv4(),
      runAt: now.toISOString(),
      status: result.ok ? "success" : "failed",
      httpStatus: result.status,
      duration: result.duration,
      response: result.response || null,
      error: result.error || null,
    };
    if (!job.history) job.history = [];
    job.history.unshift(historyEntry);
    // Prune entries older than retention window, then cap at MAX_CRON_HISTORY
    const historyCutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    job.history = job.history.filter(h => new Date(h.runAt).getTime() >= historyCutoff);
    if (job.history.length > MAX_CRON_HISTORY) job.history = job.history.slice(0, MAX_CRON_HISTORY);
    job.lastRun = historyEntry.runAt;
    job.lastStatus = historyEntry.status;
    job.nextRun = cronNextRun(job.schedule);
    changed = true;
    console.log(`[CRON] Job "${job.name}" → ${historyEntry.status} (${result.status}) in ${result.duration}ms`);
    // Notify renderer
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) wins[0].webContents.send("cron-job-executed", { jobId: job.id, entry: historyEntry });
  }
  if (changed) cronDbWrite(db);
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle("cron-load-jobs", () => {
  const db = cronDbRead();
  // Refresh nextRun for all jobs
  (db.jobs || []).forEach((j) => { j.nextRun = cronNextRun(j.schedule); });
  return db.jobs || [];
});

ipcMain.handle("cron-add-job", (_, job) => {
  const db = cronDbRead();
  const newJob = {
    id: uuidv4(),
    name: job.name || "Untitled Job",
    schedule: job.schedule || "*/5 * * * *",
    url: job.url || "",
    method: job.method || "GET",
    body: job.body || "",
    headers: job.headers || {},
    enabled: job.enabled !== false,
    history: [],
    lastRun: null,
    lastStatus: null,
    nextRun: cronNextRun(job.schedule || "*/5 * * * *"),
    createdAt: new Date().toISOString(),
  };
  if (!db.jobs) db.jobs = [];
  db.jobs.push(newJob);
  cronDbWrite(db);
  return newJob;
});

ipcMain.handle("cron-edit-job", (_, { id, updates }) => {
  const db = cronDbRead();
  const idx = (db.jobs || []).findIndex((j) => j.id === id);
  if (idx === -1) return { ok: false, error: "Job not found" };
  const job = db.jobs[idx];
  Object.assign(job, {
    name: updates.name ?? job.name,
    schedule: updates.schedule ?? job.schedule,
    url: updates.url ?? job.url,
    method: updates.method ?? job.method,
    body: updates.body ?? job.body,
    headers: updates.headers ?? job.headers,
    enabled: updates.enabled ?? job.enabled,
  });
  job.nextRun = cronNextRun(job.schedule);
  cronDbWrite(db);
  return { ok: true, job };
});

ipcMain.handle("cron-delete-job", (_, id) => {
  const db = cronDbRead();
  const before = (db.jobs || []).length;
  db.jobs = (db.jobs || []).filter((j) => j.id !== id);
  if (db.jobs.length === before) return { ok: false };
  cronDbWrite(db);
  return { ok: true };
});

ipcMain.handle("cron-toggle-job", (_, { id, enabled }) => {
  const db = cronDbRead();
  const job = (db.jobs || []).find((j) => j.id === id);
  if (!job) return { ok: false };
  job.enabled = enabled;
  cronDbWrite(db);
  return { ok: true };
});

ipcMain.handle("cron-run-now", async (_, id) => {
  const db = cronDbRead();
  const job = (db.jobs || []).find((j) => j.id === id);
  if (!job) return { ok: false, error: "Job not found" };
  const result = await cronExecuteJob(job).catch((err) => ({
    status: 0, ok: false, duration: 0, error: err.message,
  }));
  const historyEntry = {
    id: uuidv4(),
    runAt: new Date().toISOString(),
    status: result.ok ? "success" : "failed",
    httpStatus: result.status,
    duration: result.duration,
    response: result.response || null,
    error: result.error || null,
    manual: true,
  };
  if (!job.history) job.history = [];
  job.history.unshift(historyEntry);
  if (job.history.length > MAX_CRON_HISTORY) job.history = job.history.slice(0, MAX_CRON_HISTORY);
  job.lastRun = historyEntry.runAt;
  job.lastStatus = historyEntry.status;
  cronDbWrite(db);
  return { ok: true, entry: historyEntry };
});

ipcMain.handle("cron-get-history", (_, id) => {
  const db = cronDbRead();
  const job = (db.jobs || []).find((j) => j.id === id);
  return job ? (job.history || []) : [];
});

ipcMain.handle("cron-clear-history", (_, id) => {
  const db = cronDbRead();
  const job = (db.jobs || []).find((j) => j.id === id);
  if (!job) return { ok: false };
  job.history = [];
  cronDbWrite(db);
  return { ok: true };
});

ipcMain.handle("cron-validate-expr", (_, expr) => {
  try {
    cronParser.parseExpression(expr);
    const next = cronNextRun(expr);
    return { valid: true, next };
  } catch (e) {
    return { valid: false, error: e.message };
  }
});

// ═══════════════════════════════════════════════════════════════
// ── STARCAPTURE – Screenshot & Screen Recording ────────────────
// ═══════════════════════════════════════════════════════════════

// ── Global Shortcuts ─────────────────────────────────────────
const SC_SHORTCUTS_KEY = 'starCaptureShortcuts';
const SC_SHORTCUT_DEFAULTS = { screenshot: 'CommandOrControl+Shift+S', record: 'CommandOrControl+Shift+R' };

function scGetShortcuts() {
  try {
    const saved = store && store.get(SC_SHORTCUTS_KEY);
    return Object.assign({}, SC_SHORTCUT_DEFAULTS, saved || {});
  } catch { return { ...SC_SHORTCUT_DEFAULTS }; }
}

function registerStarCaptureShortcuts() {
  globalShortcut.unregisterAll();
  const shortcuts = scGetShortcuts();
  // Screenshot shortcut → direct overlay capture flow (preview stays on screen)
  if (shortcuts.screenshot) {
    try {
      globalShortcut.register(shortcuts.screenshot, () => scStartOverlayCaptureFlow());
    } catch (e) { console.warn(`⚠️ Screenshot shortcut [${shortcuts.screenshot}] failed: ${e.message}`); }
  }
  // Record shortcut → send to renderer as before
  if (shortcuts.record) {
    try {
      globalShortcut.register(shortcuts.record, () => {
        const wins = BrowserWindow.getAllWindows();
        if (wins.length) wins[0].webContents.send('starcapture:shortcut', 'record');
      });
    } catch (e) { console.warn(`⚠️ Record shortcut [${shortcuts.record}] failed: ${e.message}`); }
  }
  console.log('✅ StarCapture shortcuts registered:', shortcuts);
}

// ── Multi-display capture helpers ────────────────────────────
// Map<displayId, { image: NativeImage, bounds, scaleFactor }>
let scPreCapturedDisplays = null;
let scOverlayMinX = 0, scOverlayMinY = 0;

async function scCaptureAllDisplaysPre() {
  const displays = screen.getAllDisplays();
  const result = new Map();
  // Capture each display separately at its exact native resolution
  // so thumbnailSize matches 1:1 and no scale correction is needed
  for (let i = 0; i < displays.length; i++) {
    const d = displays[i];
    const physW = Math.round(d.bounds.width  * d.scaleFactor);
    const physH = Math.round(d.bounds.height * d.scaleFactor);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physW, height: physH },
    });
    // Try display_id match first, then index fallback
    let src = sources.find(s => String(s.display_id) === String(d.id));
    if (!src && i < sources.length) src = sources[i];
    if (!src) src = sources[0];
    if (src) result.set(d.id, { image: src.thumbnail, bounds: d.bounds, scaleFactor: d.scaleFactor });
  }
  return result;
}

function scCropFromDisplayMap(rect) {
  if (!scPreCapturedDisplays) return null;
  // rect.displayX/Y = CSS pixels inside overlay (relative to overlay top-left)
  const screenLogX = scOverlayMinX + rect.displayX;
  const screenLogY = scOverlayMinY + rect.displayY;

  // Find the display containing the center of selection
  let entry = null;
  for (const [, e] of scPreCapturedDisplays) {
    const { bounds } = e;
    if (screenLogX >= bounds.x && screenLogX < bounds.x + bounds.width &&
        screenLogY >= bounds.y && screenLogY < bounds.y + bounds.height) {
      entry = e; break;
    }
  }
  if (!entry) {
    const primary = screen.getPrimaryDisplay();
    entry = scPreCapturedDisplays.get(primary.id) || [...scPreCapturedDisplays.values()][0];
  }
  if (!entry) return null;

  const { image, bounds, scaleFactor } = entry;
  const actual = image.getSize();

  // Coordinates relative to this display's top-left (in logical pixels)
  const relLogX = rect.displayX + scOverlayMinX - bounds.x;
  const relLogY = rect.displayY + scOverlayMinY - bounds.y;

  // thumbnail was captured at exact native resolution, so no scale correction needed
  const cropX = Math.max(0, Math.round(relLogX * scaleFactor));
  const cropY = Math.max(0, Math.round(relLogY * scaleFactor));
  const cropW = Math.min(actual.width  - cropX, Math.round(rect.displayW * scaleFactor));
  const cropH = Math.min(actual.height - cropY, Math.round(rect.displayH * scaleFactor));

  if (cropW < 1 || cropH < 1) return null;
  const cropped = image.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
  return scImageToBase64(cropped);
}

// ── Overlay capture flow (screenshot shortcut) ───────────────
async function scStartOverlayCaptureFlow() {
  if (scOverlayWindow && !scOverlayWindow.isDestroyed()) return; // already open
  // Pre-capture ALL displays before overlay opens (no minimize — overlay appears on top)
  scPreCapturedDisplays = await scCaptureAllDisplaysPre();
  scCurrentMode = 'screenshot-overlay';
  scOpenOverlayWindow();
}

let scPendingMainWins = [];

function scOpenOverlayWindow() {
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x);  minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }
  // Store overlay origin for multi-display crop calculation
  scOverlayMinX = minX; scOverlayMinY = minY;

  scOverlayWindow = new BrowserWindow({
    x: minX, y: minY, width: maxX - minX, height: maxY - minY,
    frame: false, transparent: true, alwaysOnTop: true,
    fullscreen: false, skipTaskbar: true, resizable: false,
    movable: false, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'starcapture-overlay-preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  scOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
  scOverlayWindow.setVisibleOnAllWorkspaces(true);
  scOverlayWindow.loadFile(path.join(__dirname, 'starcapture-overlay.html'));
  scOverlayWindow.on('closed', () => {
    scOverlayWindow = null;
    scPreCapturedDisplays = null;
    // Restore main windows when overlay closes
    for (const w of scPendingMainWins) { try { if (!w.isDestroyed()) { w.restore(); w.focus(); } } catch {} }
    scPendingMainWins = [];
    if (scPendingResolve) { scPendingResolve(null); scPendingResolve = null; }
  });
}

ipcMain.handle('starcapture:get-shortcuts', () => scGetShortcuts());

ipcMain.handle('starcapture:set-shortcuts', (_, shortcuts) => {
  try {
    if (store) store.set(SC_SHORTCUTS_KEY, shortcuts);
    registerStarCaptureShortcuts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); _stopCaptureTimer(); });

// ── Screenshot helpers ───────────────────────────────────────
async function scCaptureFullScreen() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const sf = display.scaleFactor;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * sf), height: Math.round(height * sf) },
  });
  if (!sources.length) return null;
  return sources[0].thumbnail; // NativeImage
}

async function scCaptureActiveWindow() {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 3840, height: 2160 },
    fetchWindowIcons: false,
  });
  // Prefer first non-minimized visible window (filter out StarBox itself)
  const filtered = sources.filter(s => s.name && !s.name.includes('StarBox'));
  const src = filtered.length ? filtered[0] : sources[0];
  if (!src) return null;
  return src.thumbnail;
}

function scImageToBase64(img) {
  if (!img) return null;
  const buf = img.toPNG();
  return 'data:image/png;base64,' + buf.toString('base64');
}

// ── Overlay window (for page-button flows: area screenshot and area record) ──
function scOpenOverlay(mode) {
  return new Promise((resolve) => {
    if (scOverlayWindow && !scOverlayWindow.isDestroyed()) scOverlayWindow.close();
    scCurrentMode    = mode;
    scPendingResolve = resolve;
    scPendingMainWins = [];
    scOpenOverlayWindow();
  });
}

function scCloseOverlay() {
  if (scOverlayWindow && !scOverlayWindow.isDestroyed()) scOverlayWindow.close();
  scOverlayWindow = null;
}

// ── IPC: Overlay ──────────────────────────────────────────────
ipcMain.handle('starcapture:overlay-get-mode', () => scCurrentMode);

// Used by recording (page button) — close overlay and resolve with rect
ipcMain.on('starcapture:area-confirmed', (_, rect) => {
  scCloseOverlay();
  if (scPendingResolve) { scPendingResolve(rect); scPendingResolve = null; }
});

// Used by screenshot-overlay flow — crop correct display and send image back to overlay
ipcMain.on('starcapture:capture-confirmed', async (_, rect) => {
  if (!scPreCapturedDisplays || !scOverlayWindow || scOverlayWindow.isDestroyed()) {
    scCloseOverlay(); return;
  }
  try {
    const dataUrl = scCropFromDisplayMap(rect);
    if (!dataUrl) throw new Error('Failed to crop display');
    scOverlayWindow.webContents.send('starcapture:overlay-show-image', dataUrl);
  } catch (e) {
    console.error('[StarCapture] crop error:', e);
    scCloseOverlay();
  }
});

ipcMain.on('starcapture:overlay-cancel', () => {
  scCloseOverlay();
  if (scPendingResolve) { scPendingResolve(null); scPendingResolve = null; }
  const wins = BrowserWindow.getAllWindows();
  if (wins.length) wins[0].webContents.send('starcapture:cancelled');
});

ipcMain.on('starcapture:overlay-close', () => {
  scCloseOverlay();
});

ipcMain.handle('starcapture:overlay-copy', async (_, dataUrl) => {
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('starcapture:overlay-save', async (_, dataUrl) => {
  const win = scOverlayWindow && !scOverlayWindow.isDestroyed() ? scOverlayWindow : BrowserWindow.getAllWindows()[0];
  const result = await dialog.showSaveDialog(win, {
    title: 'Simpan Screenshot',
    defaultPath: path.join(app.getPath('pictures'), `screenshot-${Date.now()}.png`),
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
    return { ok: true, filePath: result.filePath };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC: Screenshot ─────────────────────────────────────────
ipcMain.handle('starcapture:screenshot-full', async () => {
  const img = await scCaptureFullScreen();
  return scImageToBase64(img);
});

ipcMain.handle('starcapture:screenshot-window', async () => {
  const img = await scCaptureActiveWindow();
  return scImageToBase64(img);
});

ipcMain.handle('starcapture:screenshot-area', async () => {
  // Page-button area screenshot: overlay appears on top (no minimize)
  // Pre-capture ALL displays before overlay opens
  scPreCapturedDisplays = await scCaptureAllDisplaysPre();

  const rect = await scOpenOverlay('screenshot');
  if (!rect) return null;

  // Crop from the correct display
  const dataUrl = scCropFromDisplayMap(rect);
  scPreCapturedDisplays = null;
  return dataUrl;
});


// ── IPC: Recording source ID ─────────────────────────────────
ipcMain.handle('starcapture:get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
  return sources.map(s => ({ id: s.id, name: s.name }));
});

ipcMain.handle('starcapture:get-area-for-record', async () => {
  const mainWins = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
  mainWins.forEach(w => w.minimize());
  await new Promise(r => setTimeout(r, 250));

  const rect = await scOpenOverlay('record');
  mainWins.forEach(w => { try { w.restore(); w.focus(); } catch {} });
  return rect; // { x, y, w, h, displayX, displayY, displayW, displayH }
});

// ── IPC: Save / Clipboard ────────────────────────────────────
ipcMain.handle('starcapture:copy-image', (_, dataUrl) => {
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('starcapture:save-image', async (_, { dataUrl, defaultName }) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Screenshot',
    defaultPath: path.join(app.getPath('pictures'), defaultName || `screenshot-${Date.now()}.png`),
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
    return { ok: true, filePath: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('starcapture:save-video', async (_, { buffer, format, defaultName }) => {
  const ext = format === 'webm' ? 'webm' : 'webm'; // save as webm, user can convert
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Recording',
    defaultPath: path.join(app.getPath('videos'), defaultName || `recording-${Date.now()}.${ext}`),
    filters: [
      { name: 'WebM Video', extensions: ['webm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    const uint8 = Buffer.from(buffer);
    fs.writeFileSync(result.filePath, uint8);
    return { ok: true, filePath: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('starcapture:open-file', (_, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});

// ═══════════════════════════════════════════════════════════════
// ── STARDESK – Device Registry & MyStarBox ─────────────────────
// ═══════════════════════════════════════════════════════════════

/** Ambil daftar semua device milik user (online + offline) dari remote server */
ipcMain.handle("stardesk:get-my-devices", async () => {
  if (!authSession?.isLoggedIn || !authSession?.token) {
    return { devices: [], error: "NOT_LOGGED_IN" };
  }
  const serverUrl = process.env.STARBOX_REMOTE_URL ||
    (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
  try {
    const res = await fetch(`${serverUrl}/api/stardesk/my-devices`, {
      headers: { Authorization: `Bearer ${authSession.token}` },
    });
    if (!res.ok) return { devices: [], error: `HTTP_${res.status}` };
    const data = await res.json();

    // Terapkan nama lokal jika ada (override untuk device ini sendiri)
    const localName = (() => { try { return store.get("stardeskDeviceName") || ""; } catch { return ""; } })();
    const myClientId = remoteClient.clientId;
    if (localName && myClientId && Array.isArray(data.devices)) {
      data.devices = data.devices.map(d =>
        d.client_id === myClientId ? { ...d, device_name: localName } : d
      );
    }
    return data;
  } catch (err) {
    console.error("[StarDesk] get-my-devices error:", err.message);
    return { devices: [], error: err.message };
  }
});

/** Status agent lokal (apakah remoteClient sedang terhubung dan client ID-nya) */
ipcMain.handle("stardesk:agent-status", () => ({
  connected:  remoteClient.isConnected,
  clientId:   remoteClient._stableClientId,  // selalu ada, bahkan saat guest / belum connect
  deviceName: remoteClient.deviceName || os.hostname(),
  platform:   process.platform,
  hostname:   os.hostname(),
}));

/** Ganti nama device ini — simpan lokal dulu, lalu sinkron ke server */
ipcMain.handle("stardesk:rename-device", async (_, { deviceName }) => {
  if (!deviceName || typeof deviceName !== "string" || !deviceName.trim()) {
    return { ok: false, error: "device_name wajib diisi" };
  }
  const trimmed = deviceName.trim();

  // Simpan lokal terlebih dahulu (selalu berhasil)
  try { store.set("stardeskDeviceName", trimmed); } catch {}

  // Coba sinkron ke server (best-effort)
  if (authSession?.isLoggedIn && authSession?.token && remoteClient.clientId) {
    const serverUrl = process.env.STARBOX_REMOTE_URL ||
      (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
    try {
      await fetch(`${serverUrl}/api/stardesk/devices/${remoteClient.clientId}/rename`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authSession.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: trimmed }),
      });
    } catch { /* server tidak tersedia – lokal sudah disimpan */ }
  }
  return { ok: true };
});

/** Ambil share PIN (PIN acak untuk berbagi, terpisah dari permanentPin) */
ipcMain.handle("stardesk:guest-pin-get", () => {
  try {
    let pin = store.get("stardeskSharePin");
    if (!pin) {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      store.set("stardeskSharePin", pin);
    }
    return { pin };
  } catch { return { pin: "" }; }
});

/** Refresh share PIN – generate baru dan update socket server */
ipcMain.handle("stardesk:guest-pin-refresh", () => {
  try {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    store.set("stardeskSharePin", pin);
    // Kirim ke server (berlaku untuk semua user)
    {
      remoteClient.socketClient?.socket?.emit("device:register-pin", { pin });
    }
    return { pin };
  } catch { return { pin: "" }; }
});

/** Ambil settings StarDesk dari electron-store */
ipcMain.handle("stardesk:get-settings", () => {
  const defaults = { allowIncoming: true, viewOnly: false, requireApproval: false, permanentPin: "" };
  try {
    return { ...defaults, ...(store.get("stardeskSettings") || {}), deviceName: store.get("stardeskDeviceName") || "" };
  } catch { return defaults; }
});

/** Simpan settings StarDesk, sinkron PIN ke server jika perlu */
ipcMain.handle("stardesk:save-settings", async (_, settings) => {
  try { store.set("stardeskSettings", settings); } catch {}

  // Sinkron PIN permanen ke server jika ada
  if (settings.permanentPin && authSession?.isLoggedIn && authSession?.token && remoteClient.clientId) {
    const serverUrl = process.env.STARBOX_REMOTE_URL ||
      (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
    try {
      await fetch(`${serverUrl}/api/stardesk/devices/${remoteClient.clientId}/set-pin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authSession.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pin: settings.permanentPin }),
      });
    } catch {}
  }
  return { ok: true };
});

/** Buka window preview layar sendiri (self-remote untuk testing) */
ipcMain.handle("stardesk:open-self-preview", () => {
  const existing = BrowserWindow.getAllWindows().find(
    (w) => !w.isDestroyed() && w.webContents.getURL().includes("stardesk-preview.html")
  );
  if (existing) { if (existing.isMinimized()) existing.restore(); existing.focus(); return { ok: true }; }

  const win = new BrowserWindow({
    width: 1000, height: 700,
    minWidth: 600, minHeight: 400,
    title: "StarDesk – Preview Perangkat Ini",
    backgroundColor: "#0d0b1a",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile(path.join(__dirname, "stardesk-preview.html"));
  return { ok: true };
});

/** Generate OTP agar user lain bisa remote masuk ke device ini */
ipcMain.handle("stardesk:generate-otp", async () => {
  if (!authSession?.isLoggedIn || !authSession?.token) return { ok: false, error: "NOT_LOGGED_IN" };
  const clientId = remoteClient.clientId;
  if (!clientId) return { ok: false, error: "Agent belum terhubung" };

  const serverUrl = process.env.STARBOX_REMOTE_URL ||
    (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
  try {
    const res = await fetch(`${serverUrl}/api/stardesk/devices/${clientId}/generate-otp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authSession.token}` },
    });
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/** Hubungkan ke perangkat orang lain menggunakan Device ID + kode OTP */
ipcMain.handle("stardesk:connect-by-code", async (_, { clientId, code }) => {
  if (!clientId || !code) return { ok: false, error: "clientId dan code wajib diisi" };

  const serverUrl = process.env.STARBOX_REMOTE_URL ||
    (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
  try {
    const headers = { "Content-Type": "application/json" };
    if (authSession?.token) headers.Authorization = `Bearer ${authSession.token}`;
    const res = await fetch(`${serverUrl}/api/stardesk/connect-by-code`, {
      method: "POST",
      headers,
      body: JSON.stringify({ client_id: clientId, code }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `HTTP_${res.status}` };
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── StarDesk: screen size for coordinate mapping ────────────────────────────
ipcMain.handle("stardesk:get-screen-size", () => {
  const { screen } = require("electron");
  const d = screen.getPrimaryDisplay();
  return {
    width:       d.bounds.width,
    height:      d.bounds.height,
    scaleFactor: d.scaleFactor,
  };
});

// ── StarDesk: OS-level input simulation ──────────────────────────────────────

let _darwinAccessChecked = false;
let _darwinMovePending  = false;   // throttle: skip mousemove if previous osascript still running
let _winInputProc = null;

// macOS virtual keycode → Windows SendKeys string
const _MAC_KC_TO_WIN_SENDKEY = {
  36: "{ENTER}", 76: "{ENTER}", 51: "{BACKSPACE}", 117: "{DELETE}",
  48: "{TAB}", 53: "{ESCAPE}", 123: "{LEFT}", 124: "{RIGHT}",
  125: "{DOWN}", 126: "{UP}", 115: "{HOME}", 119: "{END}",
  116: "{PGUP}", 121: "{PGDN}",
  122: "{F1}", 120: "{F2}", 99: "{F3}", 118: "{F4}", 96: "{F5}",
  97: "{F6}", 98: "{F7}", 100: "{F8}", 101: "{F9}", 109: "{F10}",
  103: "{F11}", 111: "{F12}",
};

// macOS virtual keycode → xdotool key name
const _MAC_KC_TO_XDOTOOL = {
  36: "Return", 76: "KP_Enter", 51: "BackSpace", 117: "Delete",
  48: "Tab", 53: "Escape", 123: "Left", 124: "Right",
  125: "Down", 126: "Up", 115: "Home", 119: "End",
  116: "Prior", 121: "Next",
  122: "F1", 120: "F2", 99: "F3", 118: "F4", 96: "F5",
  97: "F6", 98: "F7", 100: "F8", 101: "F9", 109: "F10",
  103: "F11", 111: "F12",
};

function _getWinInputProc() {
  if (_winInputProc && !_winInputProc.killed) return _winInputProc;
  const { spawn } = require("child_process");
  const fsMod = require("fs");
  const osMod = require("os");
  const pathMod = require("path");

  const scriptPath = pathMod.join(osMod.tmpdir(), "starbox-input.ps1");
  // Uses SendInput with explicit field offsets to match Windows x64 INPUT struct (40 bytes).
  // INPUT: type(4)+pad(4)=8, then MOUSEINPUT: dx(4)dy(4)data(4)flags(4)time(4)+pad(4)+extra(8) = 32 → total 40.
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
if (-not ([System.Management.Automation.PSTypeName]'SBI').Type) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SBI {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] i, int cb);
  [StructLayout(LayoutKind.Explicit, Size=40)]
  public struct INPUT {
    [FieldOffset(0)]  public int type;
    [FieldOffset(8)]  public int dx;
    [FieldOffset(12)] public int dy;
    [FieldOffset(16)] public uint data;
    [FieldOffset(20)] public uint flags;
    [FieldOffset(24)] public uint time;
    [FieldOffset(32)] public IntPtr extra;
  }
  public static void Mouse(uint flags, uint data=0) {
    var a = new INPUT[1]; a[0].type=0; a[0].flags=flags; a[0].data=data;
    SendInput(1, a, 40);
  }
  public const uint LD=2,LU=4,RD=8,RU=16,MD=32,MU=64,WH=2048;
}
"@
}
Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
while ($true) {
  $line = [Console]::ReadLine()
  if ($null -eq $line) { break }
  try {
    $c = $line | ConvertFrom-Json
    switch ($c.type) {
      "mousemove" { [SBI]::SetCursorPos([int]$c.x,[int]$c.y) }
      "mousedown" {
        [SBI]::SetCursorPos([int]$c.x,[int]$c.y)
        if ($c.button -eq "right") { [SBI]::Mouse([SBI]::RD) }
        elseif ($c.button -eq "middle") { [SBI]::Mouse([SBI]::MD) }
        else { [SBI]::Mouse([SBI]::LD) }
      }
      "mouseup" {
        [SBI]::SetCursorPos([int]$c.x,[int]$c.y)
        if ($c.button -eq "right") { [SBI]::Mouse([SBI]::RU) }
        elseif ($c.button -eq "middle") { [SBI]::Mouse([SBI]::MU) }
        else { [SBI]::Mouse([SBI]::LU) }
      }
      "dblclick" {
        [SBI]::SetCursorPos([int]$c.x,[int]$c.y)
        [SBI]::Mouse([SBI]::LD); [SBI]::Mouse([SBI]::LU)
        Start-Sleep -Milliseconds 40
        [SBI]::Mouse([SBI]::LD); [SBI]::Mouse([SBI]::LU)
      }
      "scroll" {
        $d = [uint32]([int]($c.deltaY) * -12)
        [SBI]::Mouse([SBI]::WH, $d)
      }
      "keystroke" {
        $t = [string]$c.text
        $mods = @($c.modifiers)
        $prefix = ""
        if ($mods -contains "ctrl")  { $prefix += "^" }
        if ($mods -contains "alt")   { $prefix += "%" }
        if ($mods -contains "shift") { $prefix += "+" }
        $escaped = $t -replace '([+^%~(){}])', '{$1}'
        [System.Windows.Forms.SendKeys]::SendWait($prefix + $escaped)
      }
      "sendkey" {
        $k = [string]$c.key; $mods = @($c.modifiers); $prefix = ""
        if ($mods -contains "ctrl")  { $prefix += "^" }
        if ($mods -contains "alt")   { $prefix += "%" }
        if ($mods -contains "shift") { $prefix += "+" }
        [System.Windows.Forms.SendKeys]::SendWait($prefix + $k)
      }
    }
  } catch {}
}
`;
  try {
    fsMod.writeFileSync(scriptPath, psScript, "utf8");
    _winInputProc = spawn("powershell", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
    ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    // Log PowerShell errors so VM/policy failures are visible in Electron logs
    _winInputProc.stderr.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.warn(`[WinInput] PS stderr: ${msg}`);
    });
    _winInputProc.stdout.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[WinInput] PS stdout: ${msg}`);
    });
    _winInputProc.on("error", (e) => { console.error(`[WinInput] spawn error: ${e.message}`); _winInputProc = null; });
    _winInputProc.on("exit",  (code) => { console.warn(`[WinInput] PS exited code=${code}`); _winInputProc = null; });
  } catch (e) { console.error(`[WinInput] failed to start: ${e.message}`); _winInputProc = null; }
  return _winInputProc;
}

function _executeOsInput({ type, x, y, button, deltaX, deltaY, text, keyCode, modifiers = [] }) {
  const platform = process.platform;

  if (platform === "darwin") {
    // Prompt for Accessibility permission the first time input is attempted
    if (!_darwinAccessChecked) {
      _darwinAccessChecked = true;
      try {
        const { systemPreferences } = require("electron");
        if (!systemPreferences.isTrustedAccessibilityClient(false)) {
          systemPreferences.isTrustedAccessibilityClient(true);
        }
      } catch {}
    }

    const { exec } = require("child_process");
    const modMap = { ctrl: "control down", meta: "command down", alt: "option down", shift: "shift down" };
    const modStr = modifiers.map(m => modMap[m]).filter(Boolean);
    const usingStr = modStr.length ? ` using {${modStr.join(", ")}}` : "";

    if (type === "mousemove") {
      if (_darwinMovePending) return;   // drop if previous move still executing
      _darwinMovePending = true;
      exec(`osascript -e 'tell application "System Events" to set the mouse location to {${x}, ${y}}'`,
        () => { _darwinMovePending = false; });
    } else if (type === "mousedown") {
      const btn = button === "right" ? "right click" : "click";
      exec(`osascript -e 'tell application "System Events" to ${btn} at {${x}, ${y}}'`);
    } else if (type === "mouseup") {
      // no-op: osascript click is already down+up in one command
    } else if (type === "dblclick") {
      exec(`osascript -e 'tell application "System Events" to double click at {${x}, ${y}}'`);
    } else if (type === "scroll") {
      // Use python3 + Quartz (pyobjc, built-in on macOS dev machines)
      const dy = Math.round((deltaY || 0) * -3);
      exec(`python3 -c "import Quartz;e=Quartz.CGEventCreateScrollWheelEvent(None,Quartz.kCGScrollEventUnitPixel,1,${dy});Quartz.CGEventPost(Quartz.kCGHIDEventTap,e)" 2>/dev/null`);
    } else if (type === "keystroke" && text) {
      const safe = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      exec(`osascript -e 'tell application "System Events" to keystroke "${safe}"${usingStr}'`);
    } else if (type === "keycode" && keyCode !== undefined) {
      exec(`osascript -e 'tell application "System Events" to key code ${keyCode}${usingStr}'`);
    }

  } else if (platform === "win32") {
    const proc = _getWinInputProc();

    // Primary path: persistent PS process via stdin (fast)
    if (proc && !proc.killed && proc.stdin.writable) {
      let cmd;
      if (type === "keycode" && keyCode !== undefined) {
        const winKey = _MAC_KC_TO_WIN_SENDKEY[keyCode];
        if (!winKey) return;
        cmd = { type: "sendkey", key: winKey, modifiers };
      } else {
        cmd = { type, x, y, button, deltaX, deltaY, text, modifiers };
      }
      try { proc.stdin.write(JSON.stringify(cmd) + "\n"); return; } catch {}
    }

    // Fallback: per-event powershell -Command (slower, works in restricted VM envs)
    const { exec } = require("child_process");
    if (type === "mousemove") {
      exec(`powershell -NoProfile -Command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x|0},${y|0})" -Args (Add-Type -AssemblyName System.Windows.Forms)`, { windowsHide: true });
    } else if (type === "mousedown" || type === "mouseup" || type === "dblclick") {
      // Use cursor move + click via WScript.Shell automation
      const clicks = type === "dblclick" ? 2 : 1;
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x|0},${y|0}); for($i=0;$i -lt ${clicks};$i++){[System.Windows.Forms.Application]::DoEvents()}"`, { windowsHide: true });
    } else if ((type === "keystroke" && text) || type === "sendkey") {
      const k = type === "sendkey" ? (keyCode !== undefined ? (_MAC_KC_TO_WIN_SENDKEY[keyCode] || "") : text) : text;
      if (k) exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${k.replace(/'/g, "''")}')"`, { windowsHide: true });
    }

  } else {
    // Linux: xdotool
    const { exec } = require("child_process");
    const xdoMod = modifiers.map(m =>
      m === "ctrl" ? "ctrl" : m === "meta" ? "super" : m === "alt" ? "alt" : "shift"
    ).join("+");
    if (type === "mousemove") {
      exec(`xdotool mousemove ${x} ${y}`);
    } else if (type === "mousedown") {
      const btn = button === "right" ? 3 : button === "middle" ? 2 : 1;
      exec(`xdotool mousemove ${x} ${y} mousedown ${btn}`);
    } else if (type === "mouseup") {
      const btn = button === "right" ? 3 : button === "middle" ? 2 : 1;
      exec(`xdotool mouseup ${btn}`);
    } else if (type === "dblclick") {
      exec(`xdotool mousemove ${x} ${y} click --repeat 2 1`);
    } else if (type === "scroll") {
      const btn = (deltaY || 0) > 0 ? 5 : 4;
      const cnt = Math.max(1, Math.round(Math.abs(deltaY || 0) / 50));
      exec(`xdotool click --repeat ${cnt} ${btn}`);
    } else if (type === "keystroke" && text) {
      exec(`xdotool type -- "${text.replace(/"/g, '\\"')}"`);
    } else if (type === "keycode" && keyCode !== undefined) {
      const k = _MAC_KC_TO_XDOTOOL[keyCode];
      if (k) exec(`xdotool key ${xdoMod ? xdoMod + "+" : ""}${k}`);
    }
  }
}

ipcMain.on("stardesk:send-input", (_, event) => _executeOsInput(event));

// ── StarDesk: PC Remote Stream ───────────────────────────────────────────────
// getUserMedia in a hidden BrowserWindow gives real-time frames (no stale OS cache).
// --disable-renderer-backgrounding is already applied globally, preventing throttle
// even when the main StarBox window is minimized.

// Map: viewerClientId → sender BrowserWindow (hidden, captures screen via getUserMedia)
const _streamSenderWins = new Map();
// Map: targetClientId → viewer BrowserWindow
const _streamViewerWins = new Map();

function _startStreamSender(viewerClientId) {
  if (_streamSenderWins.has(viewerClientId)) return;
  const win = new BrowserWindow({
    width: 1, height: 1, show: false,
    webPreferences: {
      nodeIntegration: true, contextIsolation: false,
      backgroundThrottling: false,   // belt-and-suspenders
    },
  });
  win.loadFile(path.join(__dirname, "stardesk-stream-sender.html"), {
    hash: encodeURIComponent(viewerClientId),
  });
  _streamSenderWins.set(viewerClientId, win);
  win.on("closed", () => _streamSenderWins.delete(viewerClientId));
}

function _stopStreamSender(viewerClientId) {
  _clearFrameAck(viewerClientId);  // unblock immediately on disconnect
  const win = _streamSenderWins.get(viewerClientId);
  if (win && !win.isDestroyed()) {
    win.webContents.send("stardesk:stop-capture");
    setTimeout(() => { try { win.close(); } catch {} }, 500);
  }
  _streamSenderWins.delete(viewerClientId);
}

// No-op stubs so will-quit cleanup still compiles
function _stopCaptureTimer() {}

/** Attach StarDesk stream socket handlers (called after socket is ready) */
function _attachStarDeskStreamHandlers() {
  const socket = remoteClient?.socketClient?.socket;
  if (!socket) return;

  // Pre-warm Windows input process so it's ready when user starts controlling
  if (process.platform === "win32") _getWinInputProc();

  // Remove old listeners to avoid duplicates on reconnect
  socket.off("stardesk:stream:start");
  socket.off("stardesk:stream:stop");
  socket.off("stardesk:stream:input");
  socket.off("stardesk:stream:ready");
  socket.off("stardesk:stream:error");
  socket.off("stardesk:frame");

  // We're the TARGET: viewer wants to watch our screen
  socket.on("stardesk:stream:start", ({ viewer_client_id }) => {
    _startStreamSender(viewer_client_id);
  });
  socket.on("stardesk:stream:stop", ({ viewer_client_id }) => {
    _stopStreamSender(viewer_client_id);
  });
  // We're the TARGET: viewer sends input to us
  socket.on("stardesk:stream:input", (inputData) => {
    _executeOsInput(inputData);
  });

  // We're the VIEWER: target accepted our request
  socket.on("stardesk:stream:ready", ({ target_client_id }) => {
    const win = _streamViewerWins.get(target_client_id);
    if (win && !win.isDestroyed()) win.webContents.send("stardesk:viewer-ready");
  });
  socket.on("stardesk:stream:error", ({ reason }) => {
    for (const [, win] of _streamViewerWins) {
      if (!win.isDestroyed()) win.webContents.send("stardesk:viewer-error", { reason });
    }
  });

  // We're the VIEWER: frame from target arrives (pass all fields including error)
  socket.on("stardesk:frame", (payload) => {
    for (const [, win] of _streamViewerWins) {
      if (!win.isDestroyed()) win.webContents.send("stardesk:viewer-frame", payload);
    }
  });
}

// IPC: open remote viewer window for a target device
ipcMain.handle("stardesk:open-remote-viewer", (_, { targetClientId, deviceName }) => {
  const existing = _streamViewerWins.get(targetClientId);
  if (existing && !existing.isDestroyed()) { existing.focus(); return { ok: true }; }

  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 500,
    title: `StarDesk Remote – ${deviceName || targetClientId}`,
    backgroundColor: "#0d0b1a",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, "stardesk-remote-viewer.html"));
  win.webContents.once("did-finish-load", () => {
    win.webContents.send("stardesk:viewer-init", {
      targetClientId,
      deviceName: deviceName || targetClientId,
    });
  });
  _streamViewerWins.set(targetClientId, win);
  win.on("closed", () => {
    _streamViewerWins.delete(targetClientId);
    remoteClient?.socketClient?.socket?.emit("stardesk:stream:stop", { target_client_id: targetClientId });
  });
  return { ok: true };
});

// IPC: viewer requests stream from target
ipcMain.handle("stardesk:stream-request", (_, { targetClientId }) => {
  remoteClient?.socketClient?.socket?.emit("stardesk:stream:request", { target_client_id: targetClientId });
  return { ok: true };
});

// IPC: viewer sends input event to target
ipcMain.on("stardesk:stream-input", (_, { targetClientId, ...inputData }) => {
  remoteClient?.socketClient?.socket?.emit("stardesk:stream:input", { target_client_id: targetClientId, ...inputData });
});

// Ack-based flow control: track in-flight frames per viewer.
// Only one frame in-flight at a time → TCP buffer never accumulates → no latency drift.
const _frameAckPending = new Map(); // viewerClientId → timer handle
const FRAME_ACK_TIMEOUT_MS = 250;   // if server doesn't ack within 250ms, unblock anyway

function _clearFrameAck(viewerClientId) {
  const t = _frameAckPending.get(viewerClientId);
  if (t) clearTimeout(t);
  _frameAckPending.delete(viewerClientId);
}

// IPC: sender BrowserWindow relays a captured frame
ipcMain.on("stardesk:stream-frame", (_, { viewerClientId, data, w, h, sw, sh, error }) => {
  const socket = remoteClient?.socketClient?.socket;
  if (!socket?.connected) return;
  if (error) {
    socket.emit("stardesk:frame", { viewer_client_id: viewerClientId, error });
    return;
  }
  // Drop frame if still waiting for server ack on previous frame
  if (_frameAckPending.has(viewerClientId)) return;

  // Mark as pending; server will call ack() when it has forwarded the frame
  const timer = setTimeout(() => _frameAckPending.delete(viewerClientId), FRAME_ACK_TIMEOUT_MS);
  _frameAckPending.set(viewerClientId, timer);

  socket.compress(false).emit(
    "stardesk:frame",
    { viewer_client_id: viewerClientId, data, w, h, sw, sh },
    () => _clearFrameAck(viewerClientId),  // server ack callback
  );
});

ipcMain.handle("stardesk:connect-by-pin", async (_, { clientId, pin }) => {
  if (!clientId || !pin) return { ok: false, error: "clientId dan pin wajib diisi" };

  const serverUrl = process.env.STARBOX_REMOTE_URL ||
    (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
  try {
    const headers = { "Content-Type": "application/json" };
    if (authSession?.token) headers.Authorization = `Bearer ${authSession.token}`;
    const res = await fetch(`${serverUrl}/api/stardesk/connect-by-pin`, {
      method: "POST",
      headers,
      body: JSON.stringify({ client_id: clientId, pin }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `HTTP_${res.status}` };
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── MikroTik Manager ────────────────────────────────────────────────────────
const MIKROTIK_DB_PATH = path.join(app.getPath("userData"), "mikrotik-devices.json");

function loadMikrotikDevices() {
  try {
    if (fs.existsSync(MIKROTIK_DB_PATH)) {
      return JSON.parse(fs.readFileSync(MIKROTIK_DB_PATH, "utf8")).devices || [];
    }
  } catch (_) {}
  return [];
}

function saveMikrotikDevices(devices) {
  fs.writeFileSync(MIKROTIK_DB_PATH, JSON.stringify({ devices }, null, 2), "utf8");
}

ipcMain.handle("mikrotik:load-devices", () => loadMikrotikDevices());

ipcMain.handle("mikrotik:save-device", (_, device) => {
  const devices = loadMikrotikDevices();
  if (device.id) {
    const idx = devices.findIndex((d) => d.id === device.id);
    if (idx >= 0) devices[idx] = device;
    else devices.push(device);
  } else {
    device.id = require("uuid").v4();
    device.created_at = new Date().toISOString();
    devices.push(device);
  }
  saveMikrotikDevices(devices);
  // Sync ke relay server & Laravel setelah simpan
  setImmediate(() => { syncMikrotikDevicesToRelay(); syncMikrotikDevicesToLaravel(); });
  return device;
});

ipcMain.handle("mikrotik:delete-device", (_, id) => {
  saveMikrotikDevices(loadMikrotikDevices().filter((d) => d.id !== id));
  setImmediate(() => { syncMikrotikDevicesToRelay(); syncMikrotikDevicesToLaravel(); });
  return { success: true };
});

/**
 * Scan jaringan lokal untuk mendeteksi perangkat MikroTik.
 * Memeriksa port Winbox (8291), SSH (22), dan HTTP (80/8080) pada subnet lokal.
 */
ipcMain.handle("mikrotik:scan-network", async () => {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  const subnets = [];

  // Kumpulkan semua subnet /24 dari network interface lokal (kecuali loopback)
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        const parts = addr.address.split(".");
        subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
  }

  if (!subnets.length) return { success: false, error: "Tidak ada network interface yang aktif" };

  const MIKROTIK_PORTS = [8291, 22, 80];
  const TIMEOUT_MS = 600;
  const MAX_CONCURRENT = 30;
  const found = [];

  // Scan setiap subnet
  for (const subnet of [...new Set(subnets)]) {
    const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);

    // Scan dengan concurrency limit
    for (let i = 0; i < hosts.length; i += MAX_CONCURRENT) {
      const batch = hosts.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        batch.map((host) =>
          new Promise((resolve) => {
            const openPorts = [];
            let completed = 0;
            for (const port of MIKROTIK_PORTS) {
              const sock = new nodeNet.Socket();
              sock.setTimeout(TIMEOUT_MS);
              sock.once("connect", () => {
                openPorts.push(port);
                sock.destroy();
              });
              sock.on("error", () => {});
              sock.on("timeout", () => sock.destroy());
              sock.on("close", () => {
                completed++;
                if (completed === MIKROTIK_PORTS.length) {
                  resolve({ host, openPorts });
                }
              });
              sock.connect(port, host);
            }
          })
        )
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.openPorts.length > 0) {
          // Deteksi MikroTik: port 8291 (Winbox) adalah tanda kuat
          const isMikrotik = r.value.openPorts.includes(8291) ||
            (r.value.openPorts.includes(22) && r.value.openPorts.includes(80));
          if (isMikrotik) {
            found.push({
              host: r.value.host,
              openPorts: r.value.openPorts,
              hasWinbox: r.value.openPorts.includes(8291),
              hasSsh:    r.value.openPorts.includes(22),
              hasWebUI:  r.value.openPorts.includes(80),
            });
          }
        }
      }
    }
  }

  return { success: true, devices: found };
});

/**
 * Buka Web UI MikroTik di BrowserWindow lokal.
 */
ipcMain.handle("mikrotik:open-webui", (_, { host, webPort, name }) => {
  try {
    const port = parseInt(webPort) || 80;
    const url = port === 443 ? `https://${host}` : `http://${host}${port !== 80 ? `:${port}` : ""}`;
    const win = new BrowserWindow({
      width: 1280,
      height: 900,
      title: `MikroTik – ${name || host}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // izinkan mixed content untuk router HTTP
        allowRunningInsecureContent: true,
      },
      icon: path.join(__dirname, "assets", "starbox.png"),
    });
    win.loadURL(url);
    win.setMenuBarVisibility(false);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Buat koneksi SSH ke MikroTik menggunakan infrastruktur Remox.
 * Menyimpan koneksi ke remox-connections.json dan mengembalikan ID-nya.
 */
ipcMain.handle("mikrotik:open-ssh", (_, { host, sshPort, username, password, name }) => {
  try {
    const connections = loadRemoxConnections();
    // Cari existing connection untuk host ini, atau buat baru
    const tempId = `mtk-${host.replace(/\./g, "-")}`;
    let conn = connections.find((c) => c.id === tempId);
    if (!conn) {
      conn = {
        id: tempId,
        name: `MikroTik ${name || host}`,
        type: "ssh",
        host,
        port: parseInt(sshPort) || 22,
        username: username || "admin",
        password: password || "",
        _mikrotik: true,
      };
      connections.push(conn);
      saveRemoxConnections(connections);
    } else {
      // Update credentials jika berubah
      conn.host     = host;
      conn.port     = parseInt(sshPort) || 22;
      conn.username = username || conn.username || "admin";
      conn.password = password !== undefined ? password : conn.password;
      const idx = connections.findIndex((c) => c.id === tempId);
      connections[idx] = conn;
      saveRemoxConnections(connections);
    }
    return { success: true, connectionId: conn.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Launch Winbox (aplikasi native MikroTik).
 * Coba jalankan dari PATH atau lokasi umum; beri tahu user jika tidak ditemukan.
 */
ipcMain.handle("mikrotik:launch-winbox", async (_, { host, winboxPort, username, password }) => {
  const { exec, execFile } = require("child_process");
  const port = parseInt(winboxPort) || 8291;
  const target = port !== 8291 ? `${host}:${port}` : host;

  // Coba buka lewat protokol winbox:// (jika Winbox terdaftar sebagai URL handler)
  try {
    const { shell } = require("electron");
    await shell.openExternal(`winbox://${target}`);
    return { success: true, method: "protocol" };
  } catch (_) {}

  // Cari Winbox di lokasi umum
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\WinBox\\winbox.exe",
        "C:\\Program Files (x86)\\WinBox\\winbox.exe",
        path.join(app.getPath("home"), "Desktop", "winbox.exe"),
        path.join(app.getPath("home"), "Downloads", "winbox.exe"),
        path.join(app.getPath("home"), "Desktop", "winbox64.exe"),
      ]
    : process.platform === "darwin"
    ? [
        "/Applications/WinBox.app/Contents/MacOS/WinBox",
        path.join(app.getPath("home"), "Downloads", "winbox"),
      ]
    : [
        "/usr/local/bin/winbox",
        "/opt/winbox/winbox",
        path.join(app.getPath("home"), "winbox"),
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const args = [target];
      if (username) args.push(username);
      if (password) args.push(password);
      try {
        const { spawn } = require("child_process");
        spawn(p, args, { detached: true, stdio: "ignore" }).unref();
        return { success: true, method: "executable", path: p };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  }

  return {
    success: false,
    error: "Winbox tidak ditemukan. Download dari mikrotik.com/download dan install terlebih dahulu.",
    downloadUrl: "https://mikrotik.com/download",
  };
});

/**
 * Mulai HTTP proxy lokal yang forward request ke MikroTik web UI.
 * Dipakai oleh mikrotik:open-webui-proxy dan remote viewer melalui relay.
 */
const mikrotikProxyServers = new Map(); // deviceId -> { server, port }

async function startMikrotikProxy(deviceId, host, webPort) {
  if (mikrotikProxyServers.has(deviceId)) {
    return { success: true, port: mikrotikProxyServers.get(deviceId).port };
  }

  const httpModule  = require("http");
  const httpsModule = require("https");
  const { URL: NodeURL } = require("url");

  const targetPort = parseInt(webPort) || 80;
  const targetBase = targetPort === 443
    ? `https://${host}`
    : `http://${host}${targetPort !== 80 ? `:${targetPort}` : ""}`;

  return new Promise((resolve) => {
    const server = httpModule.createServer((req, res) => {
      const targetUrl = targetBase + (req.url || "/");
      const mod = targetUrl.startsWith("https") ? httpsModule : httpModule;
      const proxyReq = mod.request(
        targetUrl,
        {
          method:  req.method,
          headers: { ...req.headers, host: new NodeURL(targetUrl).host },
          timeout: 15000,
          rejectUnauthorized: false,
        },
        (proxyRes) => {
          // Rewrite Location header agar redirect tetap melewati proxy
          const headers = { ...proxyRes.headers };
          if (headers.location) {
            try {
              const loc = new NodeURL(headers.location, targetBase);
              headers.location = loc.pathname + (loc.search || "");
            } catch (_) {}
          }
          res.writeHead(proxyRes.statusCode, headers);
          proxyRes.pipe(res, { end: true });
        }
      );
      req.pipe(proxyReq, { end: true });
      proxyReq.on("error", (err) => {
        if (!res.headersSent) res.writeHead(502);
        res.end(`Proxy error: ${err.message}`);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      mikrotikProxyServers.set(deviceId, { server, port });
      console.log(`[MikroTik] Proxy started for ${host} on localhost:${port}`);
      resolve({ success: true, port });
    });
    server.on("error", (err) => resolve({ success: false, error: err.message }));
  });
}

ipcMain.handle("mikrotik:start-proxy", (_, { deviceId, host, webPort }) =>
  startMikrotikProxy(deviceId, host, webPort)
);

ipcMain.handle("mikrotik:stop-proxy", (_, { deviceId }) => {
  const entry = mikrotikProxyServers.get(deviceId);
  if (entry) { entry.server.close(); mikrotikProxyServers.delete(deviceId); }
  return { success: true };
});

/**
 * Buka Web UI MikroTik melalui proxy lokal (menghindari CORS dan mixed-content).
 */
ipcMain.handle("mikrotik:open-webui-proxy", async (_, { deviceId, host, webPort, name }) => {
  try {
    const proxyResult = await startMikrotikProxy(deviceId, host, webPort);
    if (!proxyResult.success) return proxyResult;

    const win = new BrowserWindow({
      width: 1280,
      height: 900,
      title: `MikroTik WebUI – ${name || host}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
      },
      icon: path.join(__dirname, "assets", "starbox.png"),
    });
    win.loadURL(`http://127.0.0.1:${proxyResult.port}/`);
    win.setMenuBarVisibility(false);
    win.on("closed", () => {
      const entry = mikrotikProxyServers.get(deviceId);
      if (entry) { entry.server.close(); mikrotikProxyServers.delete(deviceId); }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── MikroTik Winbox TCP Tunnel (untuk remote relay) ─────────────────────────
// tunnelId -> { server, activeClients: Map<num, net.Socket>, onData, onStatus }
const mikrotikWinboxTunnels = new Map();

function stopMikrotikWinboxTunnel(deviceId) {
  const tunnel = mikrotikWinboxTunnels.get(deviceId);
  if (!tunnel) return;
  try {
    tunnel.server.close();
    tunnel.activeClients.forEach((c) => { try { c.destroy(); } catch (_) {} });
    const socket = remoteClient?.socketClient?.socket;
    if (socket) socket.off("mikrotik:winbox-relay-data", tunnel.onData);
  } catch (_) {}
  mikrotikWinboxTunnels.delete(deviceId);
  console.log(`[MikroTik] Winbox tunnel stopped for device ${deviceId}`);
}

/**
 * Mulai local TCP server yang relay data ke MikroTik:8291 via Socket.IO relay.
 * User menjalankan Winbox dan connect ke localhost:<port> yang dikembalikan.
 */
ipcMain.handle("mikrotik:start-winbox-tunnel", async (_, { deviceId, targetClientId, host, winboxPort }) => {
  const socket = remoteClient?.socketClient?.socket;
  if (!socket?.connected) return { success: false, error: "Tidak terhubung ke relay server. Login terlebih dahulu." };

  // Hentikan tunnel lama jika ada
  stopMikrotikWinboxTunnel(deviceId);

  let clientNum = 0;
  const activeClients = new Map(); // num -> tcp socket

  // Listener untuk data dari relay → tulis ke Winbox app
  const onData = ({ tunnelId: tid, data }) => {
    // Cari client berdasarkan tunnelId suffix
    const match = tid.match(/-(\d+)$/);
    if (!match) return;
    const cn = parseInt(match[1]);
    const tcpClient = activeClients.get(cn);
    if (tcpClient && !tcpClient.destroyed) {
      try { tcpClient.write(Buffer.from(data, "base64")); } catch (_) {}
    }
  };

  socket.on("mikrotik:winbox-relay-data", onData);

  return new Promise((resolve) => {
    const server = nodeNet.createServer((tcpClient) => {
      const cn = ++clientNum;
      const tunnelId = `winbox-${deviceId}-${cn}`;
      activeClients.set(cn, tcpClient);

      // Minta relay server buka koneksi ke MikroTik
      socket.emit("mikrotik:winbox-tunnel-open", {
        tunnelId,
        targetClientId,
        host,
        port: parseInt(winboxPort) || 8291,
      });

      tcpClient.on("data", (data) => {
        socket.emit("mikrotik:winbox-tunnel-data", { tunnelId, data: data.toString("base64") });
      });

      tcpClient.on("close", () => {
        socket.emit("mikrotik:winbox-tunnel-close", { tunnelId });
        activeClients.delete(cn);
      });

      tcpClient.on("error", () => { tcpClient.destroy(); });
    });

    mikrotikWinboxTunnels.set(deviceId, { server, activeClients, onData });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      console.log(`[MikroTik] Winbox relay tunnel berjalan di localhost:${port}`);
      // Update tunnels map with port info
      mikrotikWinboxTunnels.get(deviceId).port = port;
      resolve({ success: true, port });
    });

    server.on("error", (err) => {
      socket.off("mikrotik:winbox-relay-data", onData);
      mikrotikWinboxTunnels.delete(deviceId);
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle("mikrotik:stop-winbox-tunnel", (_, { deviceId }) => {
  stopMikrotikWinboxTunnel(deviceId);
  return { success: true };
});

ipcMain.handle("mikrotik:get-winbox-tunnel-port", (_, { deviceId }) => {
  const tunnel = mikrotikWinboxTunnels.get(deviceId);
  if (!tunnel) return { active: false };
  return { active: true, port: tunnel.port };
});

// ─── MikroTik device sync ke server ──────────────────────────────────────────
/**
 * Push daftar MikroTik devices ke relay server (untuk device registry).
 * Dipanggil: saat connect, saat tambah/edit/hapus device.
 */
function syncMikrotikDevicesToRelay() {
  const socket = remoteClient?.socketClient?.socket;
  if (!socket?.connected) return;
  try {
    const devices = loadMikrotikDevices();
    if (devices.length > 0) {
      const os = require("os");
      socket.emit("mikrotik:devices-register", {
        devices,
        hostname: os.hostname(),
        platform: process.platform,
      });
    }
  } catch (_) {}
}

/**
 * Sync ke Laravel backend (untuk web dashboard).
 */
async function syncMikrotikDevicesToLaravel() {
  if (!authSession?.isLoggedIn || !authSession?.token) return;
  const apiBase = DEFAULT_API_BASE_URL.replace(/\/$/, "");
  try {
    const devices = loadMikrotikDevices();
    await fetch(`${apiBase}/api/mikrotik/devices/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authSession.token}`,
      },
      body: JSON.stringify({
        devices,
        client_id: _stableRemoteClientId,
      }),
    });
  } catch (_) {} // Fail silently — server mungkin belum punya endpoint ini
}

ipcMain.handle("mikrotik:sync-to-server", async () => {
  syncMikrotikDevicesToRelay();
  await syncMikrotikDevicesToLaravel();
  return { success: true };
});
