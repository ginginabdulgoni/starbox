const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const DEFAULT_FILENAME = "wa-gateway-data.json";
const DEFAULT_STRUCTURE = {
  devices: [],
  autoReplies: [],
  schedules: [],
  messageLogs: [],
};

function ensureFile(filePath) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_STRUCTURE, null, 2), "utf8");
    }
  } catch (err) {
    console.error("❌ Gagal memastikan file WA storage:", err);
    throw err;
  }
}

function safeParse(json) {
  try {
    const parsed = JSON.parse(json || "{}");
    return {
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      autoReplies: Array.isArray(parsed.autoReplies) ? parsed.autoReplies : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      messageLogs: Array.isArray(parsed.messageLogs) ? parsed.messageLogs : [],
    };
  } catch (err) {
    console.error("❌ Gagal parse WA storage:", err);
    return DEFAULT_STRUCTURE;
  }
}

class WAGatewayStorage {
  constructor(basePath) {
    this.filePath = path.join(basePath, DEFAULT_FILENAME);
    ensureFile(this.filePath);
  }

  _read() {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      return safeParse(raw);
    } catch (err) {
      console.error("❌ Gagal membaca WA storage:", err);
      return DEFAULT_STRUCTURE;
    }
  }

  _write(data) {
    try {
      const normalized = {
        devices: Array.isArray(data.devices) ? data.devices : [],
        autoReplies: Array.isArray(data.autoReplies) ? data.autoReplies : [],
        schedules: Array.isArray(data.schedules) ? data.schedules : [],
        messageLogs: Array.isArray(data.messageLogs) ? data.messageLogs : [],
      };
      fs.writeFileSync(this.filePath, JSON.stringify(normalized, null, 2), "utf8");
      return normalized;
    } catch (err) {
      console.error("❌ Gagal menulis WA storage:", err);
      return data;
    }
  }

  getDevices() {
    const { devices } = this._read();
    return [...devices];
  }

  getDevice(deviceId) {
    const { devices } = this._read();
    return devices.find((d) => d.id === deviceId) || null;
  }

  saveDevice(device) {
    const data = this._read();
    const existing = data.devices.find((d) => d.id === device.id);
    if (existing) {
      Object.assign(existing, device, { updated_at: new Date().toISOString() });
    } else {
      data.devices.push({
        ...device,
        id: device.id || uuidv4(),
        created_at: device.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    this._write(data);
    return device;
  }

  deleteDevice(deviceId) {
    const data = this._read();
    data.devices = data.devices.filter((d) => d.id !== deviceId);
    data.autoReplies = data.autoReplies.filter((reply) => reply.device_id !== deviceId);
    data.schedules = data.schedules.filter((schedule) => schedule.device_id !== deviceId);
    data.messageLogs = data.messageLogs.filter((log) => log.device_id !== deviceId);
    this._write(data);
  }

  getAutoReplies(deviceId) {
    const { autoReplies } = this._read();
    if (!deviceId) return [...autoReplies];
    return autoReplies.filter((reply) => reply.device_id === deviceId);
  }

  addAutoReply(rule) {
    const data = this._read();
    const entry = {
      id: rule.id || uuidv4(),
      device_id: rule.device_id,
      keyword: rule.keyword,
      reply_message: rule.reply_message,
      scope: rule.scope || "both",
      match_type: rule.match_type || "contains",
      is_active: typeof rule.is_active === "boolean" ? rule.is_active : true,
      created_at: new Date().toISOString(),
    };
    data.autoReplies.push(entry);
    this._write(data);
    return entry;
  }

  deleteAutoReply(replyId) {
    const data = this._read();
    data.autoReplies = data.autoReplies.filter((reply) => reply.id !== replyId);
    this._write(data);
  }

  toggleAutoReply(replyId, isActive) {
    const data = this._read();
    const reply = data.autoReplies.find((r) => r.id === replyId);
    if (reply) {
      reply.is_active = !!isActive;
      reply.updated_at = new Date().toISOString();
      this._write(data);
      return reply;
    }
    return null;
  }

  getSchedules(deviceId) {
    const { schedules } = this._read();
    if (!deviceId) return [...schedules];
    return schedules.filter((schedule) => schedule.device_id === deviceId);
  }

  addSchedule(schedule) {
    const data = this._read();
    const entry = {
      id: schedule.id || uuidv4(),
      device_id: schedule.device_id,
      schedule_name: schedule.schedule_name,
      cron_expression: schedule.cron_expression,
      message: schedule.message,
      recipients: schedule.recipients || "[]",
      is_active: typeof schedule.is_active === "boolean" ? schedule.is_active : true,
      last_run: schedule.last_run || null,
      last_status: schedule.last_status || "pending",
      created_at: new Date().toISOString(),
    };
    data.schedules.push(entry);
    this._write(data);
    return entry;
  }

  deleteSchedule(scheduleId) {
    const data = this._read();
    data.schedules = data.schedules.filter((schedule) => schedule.id !== scheduleId);
    this._write(data);
  }

  updateSchedule(scheduleId, updates) {
    const data = this._read();
    const schedule = data.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return null;
    Object.assign(schedule, updates, { updated_at: new Date().toISOString() });
    this._write(data);
    return schedule;
  }

  logMessage(entry) {
    const data = this._read();
    const logEntry = {
      id: uuidv4(),
      device_id: entry.device_id,
      phone: entry.phone,
      message: entry.message,
      type: entry.type || "unknown",
      status: entry.status || "success",
      timestamp: entry.timestamp || new Date().toISOString(),
      source: entry.source || "manual",
    };
    data.messageLogs.push(logEntry);
    this._write(data);
    return logEntry;
  }

  getMessageLogs(deviceId, limit = 100) {
    const data = this._read();
    let logs = data.messageLogs;
    if (deviceId) {
      logs = logs.filter((log) => log.device_id === deviceId);
    }
    return logs.slice(-limit).reverse();
  }

  clearMessageLogs(days = 0) {
    const data = this._read();
    if (typeof days !== "number" || days <= 0) {
      data.messageLogs = [];
    } else {
      const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
      data.messageLogs = data.messageLogs.filter(
        (log) => new Date(log.timestamp || 0).getTime() >= threshold
      );
    }
    this._write(data);
  }

  countCampaignMessagesToday(deviceId) {
    const data = this._read();
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    return data.messageLogs.filter((log) => {
      if (log.source !== "campaign") return false;
      if (deviceId && log.device_id !== deviceId) return false;
      const timestamp = new Date(log.timestamp || 0).getTime();
      return timestamp >= startOfDay;
    }).length;
  }
}

module.exports = {
  WAGatewayStorage,
  DEFAULT_STRUCTURE,
};
