/**
 * baileys-manager.js
 * WhatsApp Gateway Manager using @whiskeysockets/baileys
 * Handles multi-device connections with SQLite session storage
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

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

async function loadBaileys() {
  if (baileysLoaded) return;

  try {
    const baileys = await import("@whiskeysockets/baileys");
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
let db;

// Store active connections
const activeConnections = new Map();

// Control QR code generation and expiry (avoid repeated emission while waiting for user scan)
const qrGenerationAllowed = new Map();
const qrExpiryTimers = new Map();
const autoReconnectBlocked = new Set();
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
  // Initialize DB_PATH when app is ready
  if (!DB_PATH) {
    DB_PATH = path.join(
      getElectronApp().getPath("userData"),
      "whatsapp-gateway.db"
    );
  }

  console.log("🗄️ Initializing WhatsApp Gateway database at:", DB_PATH);

  // Load Baileys first
  await loadBaileys();

  db = new Database(DB_PATH);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS wa_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'disconnected',
      qr_code TEXT,
      auto_reply_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wa_sessions (
      device_id TEXT PRIMARY KEY,
      session_data TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES wa_devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wa_auto_replies (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      reply_message TEXT NOT NULL,
      scope TEXT DEFAULT 'both',
      match_type TEXT DEFAULT 'contains',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES wa_devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wa_schedules (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      schedule_name TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      message TEXT NOT NULL,
      recipients TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_run TEXT,
      last_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES wa_devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wa_message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT,
      type TEXT,
      status TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES wa_devices(id) ON DELETE CASCADE
    );
  `);

  try {
    db.exec("ALTER TABLE wa_auto_replies ADD COLUMN scope TEXT DEFAULT 'both'");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE wa_auto_replies ADD COLUMN match_type TEXT DEFAULT 'contains'");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE wa_schedules ADD COLUMN last_status TEXT DEFAULT 'pending'");
  } catch (err) {}

  console.log("✅ Database initialized");
  return db;
}

/**
 * Get all WA Gateway devices
 */
function getDevices() {
  const stmt = db.prepare("SELECT * FROM wa_devices ORDER BY created_at DESC");
  return stmt.all();
}

/**
 * Get single device
 */
function getDevice(deviceId) {
  const stmt = db.prepare("SELECT * FROM wa_devices WHERE id = ?");
  return stmt.get(deviceId);
}

/**
 * Create new WA Gateway device
 */
function createDevice(deviceId, name) {
  const stmt = db.prepare(`
    INSERT INTO wa_devices (id, name, status)
    VALUES (?, ?, 'disconnected')
  `);

  stmt.run(deviceId, name);

  return getDevice(deviceId);
}

/**
 * Update device status and info
 */
function updateDevice(deviceId, updates) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(deviceId);

  const stmt = db.prepare(`
    UPDATE wa_devices
    SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(...values);
  return getDevice(deviceId);
}

/**
 * Delete device
 */
function deleteDevice(deviceId) {
  // Stop connection if active
  if (activeConnections.has(deviceId)) {
    stopDevice(deviceId);
  }

  // Delete session folder
  const sessionPath = path.join(
    getElectronApp().getPath("userData"),
    "wa-sessions",
    deviceId
  );
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  const stmt = db.prepare("DELETE FROM wa_devices WHERE id = ?");
  stmt.run(deviceId);

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

    // Check if already connected
    if (activeConnections.has(deviceId)) {
      console.log(`⚠️ Device ${deviceId} already connected`);
      return { success: false, message: "Device already connected" };
    }

    const device = getDevice(deviceId);
    if (!device) {
      cleanupSessionDir(deviceId);
      throw new Error("Device not found");
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

      if (connection === "close") {
        clearQRCodeExpiry(deviceId);
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        const shouldBlockReconnect = autoReconnectBlocked.has(deviceId);
        const isAutoReconnectAllowed =
          shouldReconnect && WA_AUTO_RECONNECT && !shouldBlockReconnect;
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
        logMessage(deviceId, from, messageText, "received", "success");

        // Trigger callback
        if (onMessage) onMessage(from, messageText, msg);

        // Check auto-reply
        await handleAutoReply(deviceId, sock, from, messageText);
      }
    });

    updateDevice(deviceId, { status: "connecting" });

    return { success: true, message: "Connection started" };
  } catch (error) {
    console.error(`❌ Error starting device ${deviceId}:`, error);
    updateDevice(deviceId, { status: "error" });
    return { success: false, message: error.message };
  }
}

/**
 * Stop WhatsApp connection
 */
async function stopDevice(deviceId) {
  const sock = activeConnections.get(deviceId);
  clearQRCodeExpiry(deviceId);
  autoReconnectBlocked.delete(deviceId);

  if (sock) {
    try {
      await sock.logout();
    } catch (error) {
      console.warn(
        `⚠️ Logout failed for ${deviceId}:`,
        error?.message || error
      );
    } finally {
      activeConnections.delete(deviceId);
      updateDevice(deviceId, { status: "disconnected", qr_code: null });
      cleanupSessionDir(deviceId);
      console.log(`🛑 Stopped device: ${deviceId}`);
    }
    return { success: true };
  }

  return { success: false, message: "Device not connected" };
}

/**
 * Send message via WhatsApp
 */
async function sendMessage(deviceId, phone, message) {
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
 * Auto-reply handler
 */
async function handleAutoReply(deviceId, sock, from, messageText) {
  const device = getDevice(deviceId);

  if (!device || !device.auto_reply_enabled) {
    return;
  }

  const stmt = db.prepare(`
    SELECT * FROM wa_auto_replies
    WHERE device_id = ? AND is_active = 1
  `);

  const autoReplies = stmt.all(deviceId);

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

  const stmt = db.prepare(`
    INSERT INTO wa_message_logs (device_id, phone, message, type, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(deviceId, phone, message, type, status);
}

function updateScheduleLastRun(scheduleId, timestamp) {
  const stmt = db.prepare("UPDATE wa_schedules SET last_run = ? WHERE id = ?");
  stmt.run(timestamp, scheduleId);
}

function updateScheduleStatus(scheduleId, status) {
  const stmt = db.prepare("UPDATE wa_schedules SET last_status = ? WHERE id = ?");
  stmt.run(status, scheduleId);
}

function clearMessageLogs(deviceId, olderThanDays = 0) {
  if (!deviceId) {
    throw new Error("Device ID is required");
  }

  const days = Number(olderThanDays);
  const thresholdDate =
    days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : new Date(0);
  const threshold = thresholdDate.toISOString();
  const stmt = db.prepare(`
    DELETE FROM wa_message_logs
    WHERE device_id = ? AND timestamp < ?
  `);

  const info = stmt.run(deviceId, threshold);
  return { success: true, deleted: info.changes };
}

/**
 * Get auto-replies for a device
 */
function getAutoReplies(deviceId) {
  const stmt = db.prepare(
    "SELECT * FROM wa_auto_replies WHERE device_id = ? ORDER BY created_at DESC"
  );
  return stmt.all(deviceId);
}

/**
 * Add auto-reply rule
 */
function addAutoReply(
  deviceId,
  keyword,
  replyMessage,
  scope = "both",
  matchType = "contains"
) {
  const { v4: uuidv4 } = require("uuid");
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO wa_auto_replies (id, device_id, keyword, reply_message, scope, match_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, deviceId, keyword, replyMessage, scope, matchType);

  return {
    id,
    device_id: deviceId,
    keyword,
    reply_message: replyMessage,
    scope,
    match_type: matchType,
    is_active: 1,
  };
}

/**
 * Delete auto-reply rule
 */
function deleteAutoReply(replyId) {
  const stmt = db.prepare("DELETE FROM wa_auto_replies WHERE id = ?");
  stmt.run(replyId);
  return { success: true };
}

/**
 * Toggle auto-reply rule
 */
function toggleAutoReply(replyId, isActive) {
  const stmt = db.prepare(
    "UPDATE wa_auto_replies SET is_active = ? WHERE id = ?"
  );
  stmt.run(isActive ? 1 : 0, replyId);
  return { success: true };
}

/**
 * Get schedules for a device
 */
function getSchedules(deviceId) {
  const stmt = db.prepare(
    "SELECT * FROM wa_schedules WHERE device_id = ? ORDER BY created_at DESC"
  );
  return stmt.all(deviceId);
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

  const stmt = db.prepare(`
    INSERT INTO wa_schedules (id, device_id, schedule_name, cron_expression, message, recipients)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    deviceId,
    scheduleName,
    cronExpression,
    message,
    JSON.stringify(recipients)
  );

  return { id, device_id: deviceId, schedule_name: scheduleName };
}

/**
 * Delete schedule
 */
function deleteSchedule(scheduleId) {
  const stmt = db.prepare("DELETE FROM wa_schedules WHERE id = ?");
  stmt.run(scheduleId);
  return { success: true };
}

/**
 * Get message logs
 */
function getMessageLogs(deviceId, limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM wa_message_logs
    WHERE device_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(deviceId, limit);
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
};
