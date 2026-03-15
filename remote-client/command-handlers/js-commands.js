"use strict";

/**
 * Command handler untuk send_js.
 * Dilindungi feature flag REMOTE_ALLOW_SEND_JS di client-side
 * DAN ALLOW_SEND_JS di server-side.
 *
 * Risiko tinggi: hanya aktifkan di environment yang terkontrol.
 */

const logger = require("../utils/logger");

// Daftar pattern JS yang DIBLOKIR (blacklist sederhana)
const BLOCKED_PATTERNS = [
  /require\s*\(/,         // require() - akses modul Node
  /process\./,            // process.env, process.exit, dll
  /child_process/,        // spawn shell
  /fs\./,                 // file system
  /electron/i,            // akses Electron API langsung
  /__dirname/,
  /__filename/,
  /global\./,
];

/**
 * send_js – eksekusi JavaScript di webContents device
 * payload: { uid, code }
 */
async function handleSendJs(payload, bridge) {
  // Cek feature flag di sisi client
  if (!process.env.REMOTE_ALLOW_SEND_JS || process.env.REMOTE_ALLOW_SEND_JS !== "true") {
    throw new Error("Feature send_js tidak diaktifkan di client ini");
  }

  const { uid, code } = payload;
  if (!uid || !code) throw new Error("uid dan code wajib diisi");

  if (typeof code !== "string" || code.length > 50000) {
    throw new Error("Code tidak valid atau terlalu panjang (max 50KB)");
  }

  // Cek blacklist
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      logger.warn(`[CMD] send_js ditolak karena pattern berbahaya: ${pattern}`);
      throw new Error("Code mengandung pola yang diblokir");
    }
  }

  const webContents = bridge.getWebContents(uid);
  if (!webContents || webContents.isDestroyed()) {
    throw new Error(`WebContents untuk device ${uid} tidak ditemukan`);
  }

  logger.warn(`[CMD] send_js dieksekusi pada device ${uid}, code length: ${code.length}`);

  let result;
  try {
    result = await webContents.executeJavaScript(code, true);
  } catch (err) {
    throw new Error(`Eksekusi JS gagal: ${err.message}`);
  }

  // Sanitasi result (jangan kembalikan object yang terlalu besar)
  let sanitizedResult;
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > 100000) {
      sanitizedResult = "[Result terlalu besar, dipotong]";
    } else {
      sanitizedResult = result;
    }
  } catch {
    sanitizedResult = String(result);
  }

  return { uid, result: sanitizedResult };
}

module.exports = {
  send_js: handleSendJs,
};
