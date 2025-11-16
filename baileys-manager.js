/**
 * baileys-manager.js
 * WhatsApp Gateway Manager using @whiskeysockets/baileys
 * Handles multi-device connections with SQLite session storage
 */

const { WAGatewayStorage } = require("./wa-storage");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const WA_AUTO_RECONNECT = process.env.WA_AUTO_RECONNECT !== "false";

// Lazy load electron app - will be initialized when needed
let electronApp = null;
function getElectronApp() {
  if (!electronApp) {
    electronApp = require("electron").app;
  }
  return electronApp;
}

// Polyfill for Web Crypto API in Node.js/Electron
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto;
}

// Dynamic imports for ES modules
let makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  P,
  QRCode;
let baileysLoaded = false;

let baileysEntryPath = null;

function getBaileysEntryPath() {
  if (baileysEntryPath) {
    return baileysEntryPath;
  }

  const electronAppInstance = getElectronApp();
  const isPackaged = electronAppInstance?.isPackaged;
  const resources = process.resourcesPath;

  const candidatePaths = [];
  if (isPackaged) {
    candidatePaths.push(
      path.join(
        resources,
        "app.asar.unpacked",
        "node_modules",
        "@whiskeysockets",
        "baileys",
        "lib",
        "index.js"
      )
    );
    candidatePaths.push(
      path.join(
        resources,
        "app",
        "node_modules",
        "@whiskeysockets",
        "baileys",
        "lib",
        "index.js"
      )
    );
    candidatePaths.push(
      path.join(
        resources,
        "app.asar",
        "node_modules",
        "@whiskeysockets",
        "baileys",
        "lib",
        "index.js"
      )
    );
  }

  candidatePaths.push(
    require.resolve("@whiskeysockets/baileys/lib/index.js")
  );

  const found = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `Baileys entry not found; paths tried: ${candidatePaths.join(", ")}`
    );
  }

  baileysEntryPath = found;
  return baileysEntryPath;
}

async function loadBaileys() {
  if (baileysLoaded) return;

  try {
    const baileysPath = getBaileysEntryPath();
    const baileys = await import(pathToFileURL(baileysPath).href);
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;

    // Load QRCode library
    try {
      QRCode = require("qrcode");
    } catch (qrError) {
      console.warn("⚠️ Failed to load qrcode library:", qrError.message);
    }

    // Try to load pino, use fallback if fails
    try {
      const pinoModule = await import("pino");
      P = pinoModule.default;
    } catch (pinoError) {
      console.warn(
        "⚠️ Failed to load pino, using console logger:",
        pinoError.message
      );
      // Fallback logger
      P = () => ({
        fatal: console.error,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug,
        trace: console.debug,
        child: () => P(),
      });
    }

    baileysLoaded = true;
    console.log("✅ Baileys loaded successfully");
  } catch (error) {
    console.error("❌ Failed to load Baileys:", error);
    throw error;
  }
}

// SQLite Database setup
let DB_PATH;
let storage;

function ensureStorage() {
  if (!storage) {
    const baseDir = path.dirname(DB_PATH || getElectronApp().getPath("userData"));
    storage = new WAGatewayStorage(baseDir);
  }
  return storage;
}
let databaseReady = false;

// Store active connections
const activeConnections = new Map();

// Control QR code generation and expiry (avoid repeated emission while waiting for user scan)
const qrGenerationAllowed = new Map();
const qrExpiryTimers = new Map();
const autoReconnectBlocked = new Set();
const reconnectAttemptCount = new Map();
const MAX_AUTO_RECONNECT = 1;
const QR_EXPIRY_MS = 5 * 60 * 1000; // mark QR as expired after 5 minutes

function allowQRCode(deviceId) {
  qrGenerationAllowed.set(deviceId, true);
}

function consumeQRCode(deviceId) {
  qrGenerationAllowed.set(deviceId, false);
}

function isQRCodeAllowed(deviceId) {
  return qrGenerationAllowed.get(deviceId) ?? false;
}

function normalizeJidForFilter(jidOrPhone) {
  if (!jidOrPhone) return "";
  return String(jidOrPhone).trim().toLowerCase();
}

function normalizePhoneKey(value) {
  if (!value) return "";
  const normalized = normalizeJidForFilter(value);
  return normalized.split("@")[0].replace(/\D/g, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPersonalOrGroupJid(jidOrPhone) {
  const normalized = normalizeJidForFilter(jidOrPhone);
  if (!normalized) return false;
  if (normalized.endsWith("@broadcast") || normalized.includes("broadcast")) {
    return false;
  }
  if (normalized.endsWith("@s.whatsapp.net") || normalized.endsWith("@g.us")) {
    return true;
  }
  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly.length >= 7;
}

function clearQRCodeExpiry(deviceId) {
  const timer = qrExpiryTimers.get(deviceId);
  if (timer) {
    clearTimeout(timer);
    qrExpiryTimers.delete(deviceId);
  }
}

async function expireQRCode(deviceId) {
  clearQRCodeExpiry(deviceId);

  console.log(`⏳ QR Code expired for ${deviceId}, stopping connection`);
  autoReconnectBlocked.add(deviceId);

  const sock = activeConnections.get(deviceId);
  if (sock) {
    try {
      await sock.logout();
    } catch (error) {
      console.error(
        `❌ Failed to logout expired socket for ${deviceId}:`,
        error
      );
    }
  } else {
    updateDevice(deviceId, { status: "disconnected", qr_code: null });
  }
}

function scheduleQRCodeExpiry(deviceId) {
  clearQRCodeExpiry(deviceId);
  const timer = setTimeout(() => {
    expireQRCode(deviceId).catch((error) => {
      console.error(`❌ Error expiring QR for ${deviceId}:`, error);
    });
  }, QR_EXPIRY_MS);
  qrExpiryTimers.set(deviceId, timer);
}

function isAutoReconnectBlocked(deviceId) {
  return autoReconnectBlocked.has(deviceId);
}

function cleanupSessionDir(deviceId) {
  if (!deviceId) return;
  const sessionPath = path.join(
    getElectronApp().getPath("userData"),
    "wa-sessions",
    deviceId
  );
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    console.log(`🗑️ Cleaned up stale session for ${deviceId}`);
  }
}

/**
 * Initialize SQLite database
 */
async function initDatabase() {
  if (!DB_PATH) {
    DB_PATH = path.join(
      getElectronApp().getPath("userData"),
      "wa-gateway-data.json"
    );
  }
  // Log only to console without writing to file
  if (process.env.NODE_ENV === "development") {
    process.stdout.write(`🗄️ Initializing WhatsApp Gateway storage at: ${DB_PATH}\n`);
  }
  await loadBaileys();
  storage = new WAGatewayStorage(path.dirname(DB_PATH));
  if (process.env.NODE_ENV === "development") {
    process.stdout.write("✅ JSON storage initialized\n");
  }
  databaseReady = true;
  return storage;
}

/**
 * Get all WA Gateway devices
 */
function getDevices() {
  return ensureStorage().getDevices();
}

/**
 * Get single device
 */
function getDevice(deviceId) {
  return ensureStorage().getDevice(deviceId);
}

/**
 * Create new WA Gateway device
 */
function createDevice(deviceId, name) {
  return ensureStorage().saveDevice({
    id: deviceId,
    name,
    status: "disconnected",
  });
}

/**
 * Update device status and info
 */
function updateDevice(deviceId, updates) {
  const store = ensureStorage();
  const device = store.getDevice(deviceId);
  if (!device) return null;
  return store.saveDevice({
    ...device,
    ...updates,
    id: deviceId,
  });
}

/**
 * Delete device
 */
function deleteDevice(deviceId) {
  if (activeConnections.has(deviceId)) {
    stopDevice(deviceId);
  }
  const sessionPath = path.join(
    getElectronApp().getPath("userData"),
    "wa-sessions",
    deviceId
  );
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }
  ensureStorage().deleteDevice(deviceId);
  return { success: true };
}

/**
 * Start WhatsApp connection for a device
 */
async function startDevice(
  deviceId,
  onQR,
  onConnected,
  onMessage,
  onStatusChange
) {
  try {
    console.log(`🚀 Starting WA device: ${deviceId}`);

    // Ensure Baileys is loaded
    await loadBaileys();

    const device = getDevice(deviceId);
    if (!device) {
      cleanupSessionDir(deviceId);
      throw new Error("Device not found");
    }

    // Check if already connected
    const deviceStatus = device.status;
    const isConnectedStatus =
      deviceStatus === "connected" || deviceStatus === "connecting";
    if (activeConnections.has(deviceId) || isConnectedStatus) {
      console.log(
        `⚠️ Device ${deviceId} status '${deviceStatus}' already connected/connecting; skipping new start`
      );
      return { success: false, message: "Device already connected" };
    }

    // Session path
    const sessionPath = path.join(
      getElectronApp().getPath("userData"),
      "wa-sessions",
      deviceId
    );
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    // Get latest Baileys version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📱 Using WA v${version.join(".")}, isLatest: ${isLatest}`);

    // Create socket with safe logger
    let logger;
    try {
      logger = P({ level: "silent" });
    } catch (loggerError) {
      console.warn("⚠️ Failed to create pino logger, using fallback");
      logger = {
        fatal: () => {},
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {},
        child: () => logger,
      };
    }

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ["StarBox WA Gateway", "Chrome", "120.0.0"],
      defaultQueryTimeoutMs: undefined,
    });

    // Store connection
    activeConnections.set(deviceId, sock);
    console.log(`📱 Device ${deviceId} added to active connections`);
    console.log(`📱 Total active connections: ${activeConnections.size}`);

    autoReconnectBlocked.delete(deviceId);
    allowQRCode(deviceId);

    // QR Code handler
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (!isQRCodeAllowed(deviceId)) {
          return;
        }

        console.log(`📱 QR Code generated for ${deviceId}`);

        // Convert QR string to data URL
        let qrDataURL = qr;
        if (QRCode) {
          try {
            qrDataURL = await QRCode.toDataURL(qr, {
              width: 400,
              margin: 2,
              errorCorrectionLevel: "M",
            });
            console.log(`✅ QR Code converted to data URL`);
          } catch (qrErr) {
            console.error("❌ Failed to convert QR to data URL:", qrErr);
          }
        }

        updateDevice(deviceId, { status: "qr_ready", qr_code: qrDataURL });
        if (onQR) onQR(qrDataURL);
        consumeQRCode(deviceId);
        scheduleQRCodeExpiry(deviceId);
      }

      if (connection === "connecting") {
        clearQRCodeExpiry(deviceId);
        console.log(`🔄 QR scanned for ${deviceId}, waiting for login sync`);
        updateDevice(deviceId, { status: "connecting", qr_code: null });
        if (onStatusChange) onStatusChange("connecting");
        return;
      }

      if (connection === "close") {
        clearQRCodeExpiry(deviceId);
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        const shouldBlockReconnect = autoReconnectBlocked.has(deviceId);
        const previousAttempts = reconnectAttemptCount.get(deviceId) || 0;
        const isAutoReconnectAllowed =
          shouldReconnect &&
          WA_AUTO_RECONNECT &&
          !shouldBlockReconnect &&
          previousAttempts < MAX_AUTO_RECONNECT;
        const nextStatus = isAutoReconnectAllowed
          ? "reconnecting"
          : "disconnected";

        console.log(
          `❌ Connection closed for ${deviceId}, reconnect:`,
          shouldReconnect
        );

        activeConnections.delete(deviceId);

        updateDevice(deviceId, { status: nextStatus, qr_code: null });
        if (onStatusChange) onStatusChange(nextStatus);

        if (isAutoReconnectAllowed) {
          reconnectAttemptCount.set(deviceId, previousAttempts + 1);
          // Auto reconnect after 5 seconds
          setTimeout(() => {
            startDevice(deviceId, onQR, onConnected, onMessage, onStatusChange);
          }, 5000);
        } else if (shouldReconnect && !WA_AUTO_RECONNECT) {
          console.log(
            `ℹ️ Auto-reconnect disabled for ${deviceId}; awaiting manual restart.`
          );
        }

        if (!shouldReconnect) {
          cleanupSessionDir(deviceId);
        }
      } else if (connection === "open") {
        clearQRCodeExpiry(deviceId);
        console.log(`✅ Connected: ${deviceId}`);

        // Get phone number
        const phone = sock.user?.id?.split(":")[0] || "";

        updateDevice(deviceId, {
          status: "connected",
          phone: phone,
          qr_code: null,
        });

        reconnectAttemptCount.set(deviceId, 0);

        if (onConnected) onConnected(phone);
        if (onStatusChange) onStatusChange("connected");
      }
    });

    // Save credentials
    sock.ev.on("creds.update", saveCreds);

    // Message handler
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const from = msg.key.remoteJid;
        const messageText =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        console.log(`📨 Message from ${from}: ${messageText}`);

        // Log message
    logMessage(deviceId, from, messageText, "received", "success", {
      source: "received",
    });

        // Trigger callback
        if (onMessage) onMessage(from, messageText, msg);

        // Check auto-reply
        await handleAutoReply(deviceId, sock, from, messageText);
      }
    });

    updateDevice(deviceId, { status: "connecting" });

    return { success: true, message: "Connection started" };
  } catch (error) {
    const normalizedMessage =
      (error && typeof error === "object" && error.message) ||
      (typeof error === "string" && error) ||
      "Unknown error starting device";
    console.error(
      `❌ Error starting device ${deviceId}:`,
      normalizedMessage,
      error?.stack || error
    );
    updateDevice(deviceId, { status: "error" });
    return { success: false, message: normalizedMessage };
  }
}

/**
 * Stop WhatsApp connection
 */
async function stopDevice(deviceId, options = {}) {
  const sock = activeConnections.get(deviceId);
  clearQRCodeExpiry(deviceId);
  autoReconnectBlocked.delete(deviceId);

  const { logout = true, cleanup = logout, closeSocket = true } = options;

  if (sock) {
    try {
      if (logout) {
        await sock.logout();
      } else if (closeSocket) {
        try {
          if (sock.ws && typeof sock.ws.close === "function") {
            sock.ws.close();
          } else if (typeof sock.close === "function") {
            sock.close();
          } else if (typeof sock.end === "function") {
            sock.end();
          }
        } catch (closeError) {
          console.warn(
            `⚠️ Failed to close socket for ${deviceId}:`,
            closeError?.message || closeError
          );
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ Logout failed for ${deviceId}:`,
        error?.message || error
      );
    } finally {
      activeConnections.delete(deviceId);
      updateDevice(deviceId, { status: "disconnected", qr_code: null });
      if (cleanup) {
        cleanupSessionDir(deviceId);
      }
      console.log(`🛑 Stopped device: ${deviceId}`);
      reconnectAttemptCount.delete(deviceId);
      autoReconnectBlocked.add(deviceId);
    }
    return { success: true };
  }

  return { success: false, message: "Device not connected" };
}

/**
 * Send message via WhatsApp
 */
async function sendMessage(deviceId, phone, message, options = {}) {
  console.log(`📤 Attempting to send message from device: ${deviceId}`);
  console.log(`📤 Active connections count: ${activeConnections.size}`);
  console.log(
    `📤 Device in active connections: ${activeConnections.has(deviceId)}`
  );

  const sock = activeConnections.get(deviceId);

  if (!sock) {
    const device = getDevice(deviceId);
    console.error(
      `❌ Device ${deviceId} (${device?.name}) not connected to socket`
    );
    console.error(`❌ Database status: ${device?.status}`);
    console.error(
      `❌ Active connections IDs:`,
      Array.from(activeConnections.keys())
    );
    throw new Error(`Device not connected. Please reconnect the device first.`);
  }

  try {
    console.log(`📤 Sending to phone: ${phone}`);

    // Format phone number
    const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;

    await sock.sendMessage(jid, { text: message });

    console.log(`✅ Message sent successfully to ${phone}`);

    // Log message
      logMessage(deviceId, phone, message, "sent", "success", {
        fromMe: true,
        allowFromMe: true,
        source: options.source || "manual",
      });

    return { success: true };
  } catch (error) {
    console.error("❌ Send message error:", error);
    console.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    logMessage(deviceId, phone, message, "sent", "failed", {
      fromMe: true,
      allowFromMe: true,
      source: options.source || "manual",
    });
    throw error;
  }
}

async function sendTypingStatus(deviceId, target) {
  const sock = activeConnections.get(deviceId);
  if (!sock) {
    throw new Error("Device not connected");
  }

  const jid = target.includes("@") ? target : `${target}@s.whatsapp.net`;
  await sock.sendPresenceUpdate("composing", jid);
  await delay(800);
  await sock.sendPresenceUpdate("paused", jid);
}

/**
 * Get device connection status
 */
function getConnectionStatus(deviceId) {
  const isConnected = activeConnections.has(deviceId);
  const device = getDevice(deviceId);

  return {
    connected: isConnected,
    status: device?.status || "unknown",
    phone: device?.phone || null,
  };
}

/**
 * Get profile data for connected device
 */
function getDeviceProfile(deviceId) {
  const sock = activeConnections.get(deviceId);
  const device = getDevice(deviceId);
  if (!sock) {
    return {
      jid: device?.jid || "",
      phone: device?.phone || null,
      displayName: device?.name || "WhatsApp",
      pictureUrl: null,
      notifyName: null,
      connected: false,
      status: device?.status || "disconnected",
      fallback: true,
    };
  }

  const contact = sock.user || {};
  const jid = contact.id || "";
  const phone = jid.split(":")[0] || "";
  const displayName =
    contact.name || contact.notify || contact.verifiedName || "WhatsApp";
  const pictureUrl =
    contact.pictureUrl ||
    contact.imgUrl ||
    contact.avatar ||
    contact.profilePicture ||
    null;
  return {
    jid,
    phone,
    displayName,
    pictureUrl,
    notifyName: contact.notify || null,
    connected: true,
    status: device?.status || "connected",
  };
}

/**
 * Auto-reply handler
 */
async function handleAutoReply(deviceId, sock, from, messageText) {
  const device = getDevice(deviceId);

  if (!device || !device.auto_reply_enabled) {
    return;
  }

  const autoReplies = ensureStorage()
    .getAutoReplies(deviceId)
    .filter((rule) => rule.is_active);

  for (const rule of autoReplies) {
    const keywordRaw = (rule.keyword || "").toLowerCase();
    const messageNormalized = messageText.toLowerCase().trim();
    if (!keywordRaw) continue;

    const scope = (rule.scope || "both").toLowerCase();
    const isGroup = from?.endsWith("@g.us");
    if (scope === "personal" && isGroup) {
      continue;
    }
    if (scope === "group" && !isGroup) {
      continue;
    }

    const matchType = (rule.match_type || "contains").toLowerCase();
    const matches =
      matchType === "exact"
        ? messageNormalized === keywordRaw
        : messageNormalized.includes(keywordRaw);

    if (!matches) {
      continue;
    }

    console.log(`🤖 Auto-reply triggered for keyword: ${keywordRaw}`);

    try {
      const replyText = rule.reply_message || '';
      const typingSpeed = 120;
      const minDelay = 500;
      const maxDelay = 3200;
      const baseDelay = Math.min(Math.max(replyText.length * typingSpeed, minDelay), maxDelay);
      const jitter = Math.floor(Math.random() * 500);
      const composeDelay = baseDelay + jitter;

      await sock.sendPresenceUpdate("composing", from);
      await delay(composeDelay);
      await sock.sendPresenceUpdate("paused", from);

      await sock.sendMessage(from, { text: rule.reply_message });
      logMessage(deviceId, from, rule.reply_message, "auto_reply", "success", {
        fromMe: true,
        allowFromMe: true,
        source: "auto_reply",
      });
    } catch (error) {
      console.error("❌ Auto-reply error:", error);
    }

    break; // Only send first matching reply
  }
}

/**
 * Log message to database
 */
function logMessage(deviceId, phone, message, type, status, options = {}) {
  const { fromMe = false, allowFromMe = false } = options;
  if (fromMe && !allowFromMe) {
    return;
  }

  if (!isPersonalOrGroupJid(phone)) {
    return;
  }

  const device = getDevice(deviceId);
  const devicePhoneKey = normalizePhoneKey(device?.phone);
  const targetPhoneKey = normalizePhoneKey(phone);
  if (devicePhoneKey && targetPhoneKey && devicePhoneKey === targetPhoneKey) {
    return;
  }

  ensureStorage().logMessage({
    device_id: deviceId,
    phone,
    message,
    type,
    status,
    source: options.source,
  });
}

function updateScheduleLastRun(scheduleId, timestamp) {
  ensureStorage().updateSchedule(scheduleId, { last_run: timestamp });
}

function updateScheduleStatus(scheduleId, status) {
  ensureStorage().updateSchedule(scheduleId, { last_status: status });
}

function clearMessageLogs(deviceId, olderThanDays = 0) {
  ensureStorage().clearMessageLogs(olderThanDays);
  return { success: true };
}

function getAutoReplies(deviceId) {
  return ensureStorage().getAutoReplies(deviceId);
}

function addAutoReply(
  deviceId,
  keyword,
  replyMessage,
  scope = "both",
  matchType = "contains"
) {
  return ensureStorage().addAutoReply({
    device_id: deviceId,
    keyword,
    reply_message: replyMessage,
    scope,
    match_type: matchType,
    is_active: true,
  });
}

function deleteAutoReply(replyId) {
  ensureStorage().deleteAutoReply(replyId);
  return { success: true };
}

function toggleAutoReply(replyId, isActive) {
  const reply = ensureStorage().toggleAutoReply(replyId, isActive);
  return { success: !!reply };
}

/**
 * Get schedules for a device
 */
function getSchedules(deviceId) {
  return ensureStorage().getSchedules(deviceId);
}

/**
 * Add schedule
 */
function addSchedule(
  deviceId,
  scheduleName,
  cronExpression,
  message,
  recipients
) {
  const { v4: uuidv4 } = require("uuid");
  const id = uuidv4();
  return ensureStorage().addSchedule({
    id,
    device_id: deviceId,
    schedule_name: scheduleName,
    cron_expression: cronExpression,
    message,
    recipients: JSON.stringify(recipients),
  });
}

/**
 * Delete schedule
 */
function deleteSchedule(scheduleId) {
  ensureStorage().deleteSchedule(scheduleId);
  return { success: true };
}

/**
 * Get message logs
 */
function getMessageLogs(deviceId, limit = 100) {
  return ensureStorage().getMessageLogs(deviceId, limit);
}

function isDatabaseReady() {
  return databaseReady && !!storage;
}

module.exports = {
  initDatabase,
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  startDevice,
  stopDevice,
  sendMessage,
  sendTypingStatus,
  getConnectionStatus,
  getDeviceProfile,
  isAutoReconnectBlocked,
  getAutoReplies,
  addAutoReply,
  deleteAutoReply,
  toggleAutoReply,
  getSchedules,
  addSchedule,
  deleteSchedule,
  getMessageLogs,
  clearMessageLogs,
  updateScheduleLastRun,
  updateScheduleStatus,
  isDatabaseReady,
};
