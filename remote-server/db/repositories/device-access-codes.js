"use strict";

const { getDb } = require("../database");

/**
 * Buat OTP baru untuk akses remote device.
 * Hapus kode lama milik device yang sama sebelum membuat baru.
 *
 * @param {string} clientId  - ID device yang akan di-remote
 * @param {string} ownerId   - user_id pemilik device
 * @param {number} ttlMs     - masa berlaku dalam ms (default 10 menit)
 * @returns {string} kode 6-digit yang baru dibuat
 */
function generateCode(clientId, ownerId, ttlMs = 10 * 60 * 1000) {
  const db = getDb();
  // Hapus kode lama milik device ini
  db.prepare(`DELETE FROM device_access_codes WHERE client_id = ?`).run(clientId);

  // Buat 6-digit kode unik
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  db.prepare(`
    INSERT INTO device_access_codes (client_id, owner_id, code, used, expires_at)
    VALUES (@clientId, @ownerId, @code, 0, @expiresAt)
  `).run({ clientId, ownerId, code, expiresAt });

  return code;
}

/**
 * Validasi kode OTP.
 * @returns {{ ok: boolean, clientId?: string, ownerId?: string, error?: string }}
 */
function validateCode(code) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM device_access_codes WHERE code = ?`).get(code);

  if (!row) return { ok: false, error: "INVALID_CODE" };
  if (row.used) return { ok: false, error: "CODE_USED" };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "CODE_EXPIRED" };

  // Tandai sebagai sudah dipakai
  db.prepare(`UPDATE device_access_codes SET used = 1 WHERE code = ?`).run(code);

  return { ok: true, clientId: row.client_id, ownerId: row.owner_id };
}

/**
 * Hapus kode kadaluarsa (cleanup).
 */
function purgeExpired() {
  const db = getDb();
  return db.prepare(`DELETE FROM device_access_codes WHERE expires_at < datetime('now')`).run();
}

module.exports = { generateCode, validateCode, purgeExpired };
