const fs = require("fs");
const path = require("path");
// uuid v4 bawaan Node (crypto.randomUUID) — modul ini tidak butuh paket npm
const { randomUUID: uuidv4 } = require("crypto");

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

// partial=true: hanya field yang dikirim yang di-sanitize (untuk update record
// yang sudah ada) — mencegah field lain ke-reset ke default.
function sanitizeVmPayload(payload = {}, { partial = false } = {}) {
  const safe = partial ? {} : { ...DEFAULT_VM_FIELDS };
  const has = (k) => Object.prototype.hasOwnProperty.call(payload, k);
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
  if (has("bridgeInterface")) safe.bridgeInterface = sanitizeString(payload.bridgeInterface, 64);
  if (has("macAddress")) safe.macAddress = sanitizeString(payload.macAddress, 32);
  if (has("isoPath")) safe.isoPath = sanitizeString(payload.isoPath, 512);
  if (has("diskPath")) safe.diskPath = sanitizeString(payload.diskPath, 512);
  if (!partial || has("autostart")) safe.autostart = !!payload.autostart;
  if (has("notes")) safe.notes = sanitizeString(payload.notes, 1024);
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
    const idx = data.vms.findIndex((vm) => vm.id === id);
    // Record lama → partial update agar field yang tidak dikirim tidak ke-reset.
    const sanitized = sanitizeVmPayload(payload, { partial: idx >= 0 });

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

  // Update field runtime (bukan konfigurasi) tanpa melewati sanitizer.
  patchRuntime(id, patch = {}) {
    if (!id) return null;
    const data = this.readAll();
    const idx = data.vms.findIndex((vm) => vm.id === id);
    if (idx < 0) return null;
    const allowed = ["accelUsed", "lastWsPort"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        data.vms[idx][key] = patch[key];
      }
    }
    this.writeAll(data);
    return data.vms[idx];
  }

  snapshot(id, name = "", extra = {}) {
    if (!id) return null;
    const data = this.readAll();
    const idx = data.vms.findIndex((vm) => vm.id === id);
    if (idx < 0) return null;
    const snap = {
      id: uuidv4(),
      name: sanitizeString(name || "Snapshot", 128),
      // tag qcow2 internal (dipakai qemu-img snapshot / savevm-loadvm)
      tag: sanitizeString(extra.tag || "", 64),
      live: !!extra.live,
      createdAt: new Date().toISOString(),
    };
    if (!Array.isArray(data.vms[idx].snapshots)) {
      data.vms[idx].snapshots = [];
    }
    data.vms[idx].snapshots.push(snap);
    this.writeAll(data);
    return { vm: data.vms[idx], snapshot: snap };
  }

  getSnapshot(id, snapshotId) {
    const vm = this.get(id);
    if (!vm || !Array.isArray(vm.snapshots)) return null;
    return vm.snapshots.find((s) => s.id === snapshotId) || null;
  }

  removeSnapshot(id, snapshotId) {
    if (!id || !snapshotId) return null;
    const data = this.readAll();
    const idx = data.vms.findIndex((vm) => vm.id === id);
    if (idx < 0) return null;
    const snaps = Array.isArray(data.vms[idx].snapshots) ? data.vms[idx].snapshots : [];
    const removed = snaps.find((s) => s.id === snapshotId) || null;
    data.vms[idx].snapshots = snaps.filter((s) => s.id !== snapshotId);
    this.writeAll(data);
    return removed;
  }
}

module.exports = { VirtualOSStorage };
