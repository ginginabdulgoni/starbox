const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const DEFAULT_VM_FIELDS = {
  name: "New VM",
  osType: "linux",
  cpu: 2,
  memoryMb: 2048,
  storageGb: 20,
  networkMode: "nat",
  bridgeInterface: "",
  macAddress: "",
  isoPath: "",
  diskPath: "",
  autostart: false,
  notes: "",
  qemuBinary: "qemu-system-x86_64",
  bootOrder: "cd",
  vncPort: 5901,
  status: "stopped",
  lastStartedAt: null,
  lastStoppedAt: null,
  snapshots: [],
};

function sanitizeString(value, max = 128) {
  if (typeof value !== "string") return "";
  return value.slice(0, max).trim();
}

function sanitizeVmPayload(payload = {}) {
  const safe = { ...DEFAULT_VM_FIELDS };
  if (payload.name) safe.name = sanitizeString(payload.name, 128);
  if (payload.osType) safe.osType = sanitizeString(payload.osType, 32);
  if (Number.isFinite(payload.cpu)) {
    safe.cpu = Math.max(1, Math.min(16, parseInt(payload.cpu, 10) || 1));
  }
  if (Number.isFinite(payload.memoryMb)) {
    safe.memoryMb = Math.max(512, Math.min(32768, parseInt(payload.memoryMb, 10) || 2048));
  }
  if (Number.isFinite(payload.storageGb)) {
    safe.storageGb = Math.max(5, Math.min(2048, parseInt(payload.storageGb, 10) || 20));
  }
  if (payload.networkMode) safe.networkMode = sanitizeString(payload.networkMode, 32);
  if (payload.bridgeInterface) safe.bridgeInterface = sanitizeString(payload.bridgeInterface, 64);
  if (payload.macAddress) safe.macAddress = sanitizeString(payload.macAddress, 32);
  if (payload.isoPath) safe.isoPath = sanitizeString(payload.isoPath, 512);
  if (payload.diskPath) safe.diskPath = sanitizeString(payload.diskPath, 512);
  safe.autostart = !!payload.autostart;
  if (payload.notes) safe.notes = sanitizeString(payload.notes, 1024);
  if (payload.qemuBinary) safe.qemuBinary = sanitizeString(payload.qemuBinary, 256);
  if (payload.bootOrder) safe.bootOrder = sanitizeString(payload.bootOrder, 8);
  if (Number.isFinite(payload.vncPort)) {
    const port = parseInt(payload.vncPort, 10) || 5901;
    safe.vncPort = Math.max(5900, Math.min(65535, port));
  }
  if (payload.status) safe.status = sanitizeString(payload.status, 32);
  if (payload.snapshots && Array.isArray(payload.snapshots)) {
    safe.snapshots = payload.snapshots;
  }
  return safe;
}

class VirtualOSStorage {
  constructor(baseDir) {
    const dir = path.join(baseDir, "db");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.dbPath = path.join(dir, "virtual-machines.json");
    this.ensureDb();
  }

  ensureDb() {
    if (fs.existsSync(this.dbPath)) return;
    const payload = { vms: [] };
    fs.writeFileSync(this.dbPath, JSON.stringify(payload, null, 2));
  }

  readAll() {
    this.ensureDb();
    try {
      const raw = fs.readFileSync(this.dbPath, "utf8");
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") {
        throw new Error("DB tidak valid");
      }
      if (!Array.isArray(data.vms)) {
        data.vms = [];
      }
      return data;
    } catch (err) {
      console.warn("⚠️ VM storage corrupted, reset:", err?.message || err);
      const payload = { vms: [] };
      fs.writeFileSync(this.dbPath, JSON.stringify(payload, null, 2));
      return payload;
    }
  }

  writeAll(data) {
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  list() {
    const data = this.readAll();
    return data.vms || [];
  }

  get(id) {
    if (!id) return null;
    const data = this.readAll();
    return data.vms.find((vm) => vm.id === id) || null;
  }

  upsert(payload = {}) {
    const data = this.readAll();
    const id = payload.id || uuidv4();
    const now = new Date().toISOString();
    const sanitized = sanitizeVmPayload(payload);
    const idx = data.vms.findIndex((vm) => vm.id === id);

    if (idx >= 0) {
      data.vms[idx] = {
        ...data.vms[idx],
        ...sanitized,
        id,
        updatedAt: now,
      };
    } else {
      data.vms.push({
        ...sanitized,
        id,
        createdAt: now,
        updatedAt: now,
      });
    }

    this.writeAll(data);
    return data.vms.find((vm) => vm.id === id);
  }

  remove(id) {
    if (!id) return;
    const data = this.readAll();
    const next = data.vms.filter((vm) => vm.id !== id);
    data.vms = next;
    this.writeAll(data);
  }

  updateStatus(id, status) {
    if (!id) return null;
    const data = this.readAll();
    const idx = data.vms.findIndex((vm) => vm.id === id);
    if (idx < 0) return null;
    data.vms[idx].status = status;
    if (status === "running") {
      data.vms[idx].lastStartedAt = new Date().toISOString();
    } else if (status === "stopped") {
      data.vms[idx].lastStoppedAt = new Date().toISOString();
    }
    this.writeAll(data);
    return data.vms[idx];
  }

  start(id) {
    return this.updateStatus(id, "running");
  }

  stop(id) {
    return this.updateStatus(id, "stopped");
  }

  restart(id) {
    return this.updateStatus(id, "running");
  }

  snapshot(id, name = "") {
    if (!id) return null;
    const data = this.readAll();
    const idx = data.vms.findIndex((vm) => vm.id === id);
    if (idx < 0) return null;
    const snap = {
      id: uuidv4(),
      name: sanitizeString(name || "Snapshot", 128),
      createdAt: new Date().toISOString(),
    };
    if (!Array.isArray(data.vms[idx].snapshots)) {
      data.vms[idx].snapshots = [];
    }
    data.vms[idx].snapshots.push(snap);
    this.writeAll(data);
    return { vm: data.vms[idx], snapshot: snap };
  }
}

module.exports = { VirtualOSStorage };
