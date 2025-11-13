// electron-main.js
const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const screen = electron.screen;
const clipboard = electron.clipboard;
const net = electron.net;

const Store = require("electron-store");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { machineIdSync } = require("node-machine-id");
const AndroidManager = require("./android-manager");
const iOSManager = require("./ios-manager");
const BaileysManager = require("./baileys-manager");
const cronParser = require("cron-parser");
const { version: packageVersion } = require("./package.json");

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

function logDev(...args) {
  if (global.__starboxDevLog) {
    global.__starboxDevLog(...args);
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

  // Setup logging
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
  restoreAuthSessionFromStore();
  scheduleAuthRefresh();

  // Initialize managers
  androidManager = new AndroidManager();
  iosManager = new iOSManager();

  console.log("✅ Paths and managers initialized");
  console.log("   DB_PATH:", DB_PATH);
  console.log("   Store:", store ? "Ready" : "Failed");
  console.log("   Android Manager:", androidManager ? "Ready" : "Failed");
  console.log("   iOS Manager:", iosManager ? "Ready" : "Failed");
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
    logDev(
      "🧾 Payload info sistem Starbox (akan dikirim):",
      JSON.stringify(payload, null, 2)
    );
    logDev(`📦 Total device terdeteksi: ${payload.devices.total || 0}`);
    console.log("🎯 Endpoint laporan user-agent:", USER_AGENT_REPORT_URL);
    await requestJson({
      url: USER_AGENT_REPORT_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": payload.userAgent,
      },
      body: payload,
    });

    console.log("📡 Info sistem dikirim ke endpoint Starbox.");
  } catch (err) {
    console.error(
      "❌ Gagal mengirim info sistem:",
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
    console.log("✅ Token berhasil diperbarui.");
  } catch (err) {
    console.error("❌ Gagal memperbarui token autentikasi:", err);
    clearAuthSession();
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
    isLoggedIn: !!(rest?.isLoggedIn && token),
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
    console.log("📦 GET /api/package response:", data);
    return data;
  } catch (err) {
    console.error(
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
        const rawBody = Buffer.concat(chunks).toString("utf8");
        let parsed = rawBody;
        if (expectJson) {
          try {
            parsed = rawBody ? JSON.parse(rawBody) : {};
          } catch (err) {
            console.warn("⚠️ Gagal parse JSON:", err?.message || err);
            parsed = null;
          }
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
        } else {
          const error = new Error(
            (parsed && (parsed.message || parsed.error)) ||
              `Request gagal (${response.statusCode})`
          );
          error.status = response.statusCode;
          error.details = parsed;
          reject(error);
        }
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
    console.log("🌐 Memuat daftar layanan dari server:", endpoint);
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

// Manager instances
let androidManager = null;
let iosManager = null;

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

            // Cari input box terlebih dahulu
            let input = null;
            for (let attempt = 0; attempt < 24; attempt++) {
              input = inputSelectors
                .map(selector => document.querySelector(selector))
                .find(Boolean);
              if (input) break;
              await sleep(350);
            }

            if (!input) return false;

            // Focus pada input dan ketik 10 spasi dengan cepat (simulasi mengetik)
            input.focus();
            await sleep(200);

            // Ketik 10 spasi dengan cepat (hanya simulasi, tidak dimasukkan ke input)
            for (let i = 0; i < 10; i++) {
              // Hanya trigger event keyboard tanpa menambahkan ke input
              const spaceKeydown = new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                bubbles: true,
                cancelable: true
              });
              input.dispatchEvent(spaceKeydown);

              // Delay cepat antara spasi (30-50ms)
              await sleep(30 + Math.random() * 20);
            }

            // Tunggu sebentar setelah simulasi mengetik
            await sleep(200);

            // Langsung tekan Enter untuk kirim
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            input.dispatchEvent(enterEvent);

            // Tunggu pesan terkirim
            await sleep(500);
            return true;
          })();
        `,
          true
        );

        if (success) {
          console.log(
            `✅ Pesan ${item.id || item.message.slice(0, 20)} terkirim.`
          );
          // Tunggu tambahan untuk memastikan pesan benar-benar terkirim
          await new Promise((res) => setTimeout(res, 1000));
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
  const serviceKey = (service || "").toLowerCase();
  const selected = services[serviceKey] || services.wa;

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

  const isMobile = mode?.startsWith("mobile");
  let width = 1000;
  let height = 700;
  let userAgent = "";

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
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-mini":
      width = 800;
      height = 600;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-hd":
      width = 1366;
      height = 768;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-full-hd":
      width = 1920;
      height = 1080;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-2k":
      width = 2560;
      height = 1440;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-wide":
      width = 1280;
      height = 800;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-ultrawide":
      width = 2560;
      height = 1080;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "desktop-4k":
      width = 3840;
      height = 2160;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;

    // Special Modes
    case "compact":
      width = 600;
      height = 400;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "square":
      width = 700;
      height = 700;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "portrait":
      width = 600;
      height = 900;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;
    case "landscape":
      width = 900;
      height = 600;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      break;

    default:
      width = 1000;
      height = 700;
      userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
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
    title: withVersionSuffix("Starbox Emulator"),
    autoHideMenuBar: true,
    icon: getAssetPath("starbox.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), "preload.cjs"),
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
  const { name, service, autoRun, mode, autoSender, pendingUrl, customUrl } =
    payload;

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
  const deviceWindow = deviceWindows[uid];
  return deviceWindow && !deviceWindow.isDestroyed();
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
    if (!("callbackUrl" in device)) {
      device.callbackUrl = "";
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
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-stop-device", async (_event, deviceId) => {
  try {
    const result = await BaileysManager.stopDevice(deviceId);
    return result;
  } catch (error) {
    console.error("❌ Failed to stop WA device:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("wa-delete-device", async (_event, deviceId) => {
  try {
    const device = BaileysManager.getDevice(deviceId);
    const result = BaileysManager.deleteDevice(deviceId);
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

ipcMain.handle("wa-send-message", async (_event, deviceId, phone, message) => {
  try {
    const result = await BaileysManager.sendMessage(deviceId, phone, message);
    return result;
  } catch (error) {
    console.error("❌ Failed to send WA message:", error);
    return { success: false, error: error.message };
  }
});

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

ipcMain.handle("wa-open-web", (_event, deviceId) => {
  try {
    openWhatsAppWebWindow(deviceId);
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

function openWhatsAppWebWindow(deviceId) {
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
      await BaileysManager.sendMessage(device.id, phone, message);
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
  if (waStatusCheckInterval) {
    clearInterval(waStatusCheckInterval);
    waStatusCheckInterval = null;
  }

  if (waScheduleInterval) {
    clearInterval(waScheduleInterval);
    waScheduleInterval = null;
  }
});

args.forEach((arg) => {
  if (arg === "--run-device") runDeviceFlag = true;
  else if (arg.startsWith("--uid=")) uid = arg.split("=")[1];
  else if (arg.startsWith("--service=")) service = arg.split("=")[1];
});

app.whenReady().then(async () => {
  // Initialize logging first
  initializeLogging();

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
