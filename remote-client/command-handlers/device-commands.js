"use strict";

/**
 * Command handlers untuk operasi device: start, stop, restart, list_devices.
 *
 * Semua handler menerima { payload, bridge } dan return value/throw Error.
 * bridge = instance ElectronBridge yang expose akses ke deviceWindows, DB, dll.
 */

const logger = require("../utils/logger");

/**
 * list_devices – ambil semua device web dan android dari DB lokal
 */
async function handleListDevices(payload, bridge) {
  const includeAndroid = payload?.include_android === true;

  const loadDevicesSafe = async (dbType) => {
    try {
      const response = await bridge.ipc.invoke("load-devices", dbType);
      return Array.isArray(response?.devices) ? response.devices : [];
    } catch (err) {
      logger.error(`[CMD] list_devices: gagal load DB ${dbType}: ${err?.message || err}`);
      return [];
    }
  };

  const webDevices = await loadDevicesSafe("web");
  const androidDevices = includeAndroid ? await loadDevicesSafe("android") : [];

  const byUid = new Map();
  const addDevice = (device) => {
    const uid = device?.uid || device?.token || null;
    if (!uid) return;
    byUid.set(uid, {
      uid,
      name: device?.name || uid,
      service: device?.service || "web",
      db_type: device?.db_type || "web",
      autoRun: !!device?.autoRun,
      running: bridge.isDeviceRunning(uid),
      mode: device?.mode || null,
      remoteEnabled: device?.remoteEnabled !== false, // default true
    });
  };

  webDevices.forEach((d) => addDevice({ ...d, db_type: "web" }));
  androidDevices.forEach((d) => addDevice({ ...d, db_type: "android" }));

  // Fallback: jika DB tidak terbaca/empty, tetap tampilkan device yang sedang running.
  for (const uid of bridge.getRunningDeviceUids()) {
    if (byUid.has(uid)) {
      const existing = byUid.get(uid);
      byUid.set(uid, { ...existing, running: true });
      continue;
    }

    let info = { title: "", url: "" };
    try {
      info = await bridge.getTabInfo(uid);
    } catch {}

    let config = null;
    try {
      config = await bridge.getDeviceConfig(uid);
    } catch {}

    byUid.set(uid, {
      uid,
      name: config?.name || info?.title || uid,
      service: config?.service || "web",
      db_type: "runtime",
      autoRun: !!config?.autoRun,
      running: true,
      mode: config?.mode || null,
    });
  }

  const devices = Array.from(byUid.values());
  logger.info(
    `[CMD] list_devices: web=${webDevices.length}, android=${androidDevices.length}, total=${devices.length}`
  );

  return { devices };
}

/**
 * start_device – jalankan device
 * payload: { uid, service? }
 */
async function handleStartDevice(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  if (bridge.isDeviceRunning(uid)) {
    logger.info(`[CMD] start_device: ${uid} sudah running, focus saja`);
    await bridge.ipc.invoke("focus-device", uid);
    return { message: "Device sudah berjalan, difokuskan", uid };
  }

  const device = await bridge.getDeviceConfig(uid);
  if (!device) throw new Error(`Device ${uid} tidak ditemukan`);

  await bridge.ipc.invoke("start-device", uid, device.service);
  return { message: "Device berhasil dijalankan", uid };
}

/**
 * stop_device – hentikan device
 * payload: { uid }
 */
async function handleStopDevice(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  if (!bridge.isDeviceRunning(uid)) {
    return { message: "Device sudah berhenti", uid };
  }

  await bridge.ipc.invoke("stop-device", uid);
  return { message: "Device berhasil dihentikan", uid };
}

/**
 * restart_device – stop lalu start
 * payload: { uid }
 */
async function handleRestartDevice(payload, bridge) {
  const { uid } = payload;
  if (!uid) throw new Error("uid wajib diisi");

  const device = await bridge.getDeviceConfig(uid);
  if (!device) throw new Error(`Device ${uid} tidak ditemukan`);

  if (bridge.isDeviceRunning(uid)) {
    await bridge.ipc.invoke("stop-device", uid);
    // Tunggu window tutup
    await new Promise((r) => setTimeout(r, 1500));
  }

  await bridge.ipc.invoke("start-device", uid, device.service);
  return { message: "Device berhasil direstart", uid };
}

module.exports = {
  list_devices:   handleListDevices,
  start_device:   handleStartDevice,
  stop_device:    handleStopDevice,
  restart_device: handleRestartDevice,
};
