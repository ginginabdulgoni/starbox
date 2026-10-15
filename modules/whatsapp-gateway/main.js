// ═══════════════════════════════════════════════════════════════════════════════
// Modul WhatsApp Gateway — sisi main process
//
// Dipindah dari electron-main.js. Baileys dan dependensinya ada di node_modules
// milik modul ini, jadi tidak ikut terpasang di installer StarBox; modul ini
// diunduh hanya saat user memasangnya dari halaman Modul.
// Data (SQLite/JSON + sesi WA) tetap di lokasi lama di <userData>.
// ═══════════════════════════════════════════════════════════════════════════════

const path = require("path");
const BaileysManager = require("./baileys-manager");

// Diisi oleh register(ctx)
let ctx = null;
let ipcMain = null;
let app = null;
let BrowserWindow = null;
let cronParser = null;

const sendSystemInfoReport = (...args) => ctx?.services?.sendSystemInfoReport?.(...args);
const resolveWhatsAppUserAgent = (...args) => ctx.services.resolveWhatsAppUserAgent(...args);
const corePreloadPath = () => ctx.paths.corePreload;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function registerIpcHandlers() {
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

    const mainWindow = ctx.services.getMainWindow?.();
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

}

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
      preload: corePreloadPath(),
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

// ── Lifecycle modul ───────────────────────────────────────────────────────────

function register(context) {
  ctx = context;
  ({ ipcMain, app, BrowserWindow } = context.electron);
  cronParser = context.requireShared("cron-parser");
  registerIpcHandlers();
}

/** Dipanggil core setelah app siap (menggantikan blok init lama di electron-main). */
async function start() {
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
}

function getStats() {
  const snapshot = collectWhatsAppGatewaySnapshot();
  return {
    snapshot,
    activeDevices: snapshot.devices.filter((d) => d.connected).length,
  };
}

function shutdown() {
  if (waStatusCheckInterval) {
    clearInterval(waStatusCheckInterval);
    waStatusCheckInterval = null;
  }

  if (waScheduleInterval) {
    clearInterval(waScheduleInterval);
    waScheduleInterval = null;
  }
}

module.exports = { register, start, getStats, shutdown };
