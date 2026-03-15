"use strict";

const { getDb } = require("../database");

/**
 * Daftarkan client baru atau update jika sudah ada.
 */
function upsertClient({ clientId, userId, userEmail, userName, hostname, platform, appVersion, ipAddress }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO client_registry (client_id, user_id, user_email, user_name, hostname, platform, app_version, ip_address, status, connected_at, last_heartbeat, disconnected_at)
    VALUES (@clientId, @userId, @userEmail, @userName, @hostname, @platform, @appVersion, @ipAddress, 'online', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT(client_id) DO UPDATE SET
      user_id        = excluded.user_id,
      user_email     = excluded.user_email,
      user_name      = excluded.user_name,
      hostname       = excluded.hostname,
      platform       = excluded.platform,
      app_version    = excluded.app_version,
      ip_address     = excluded.ip_address,
      status         = 'online',
      connected_at   = CURRENT_TIMESTAMP,
      last_heartbeat = CURRENT_TIMESTAMP,
      disconnected_at = NULL
  `).run({ clientId, userId, userEmail, userName, hostname, platform, appVersion, ipAddress });
}

/**
 * Update last_heartbeat timestamp.
 */
function touchHeartbeat(clientId) {
  const db = getDb();
  db.prepare(`
    UPDATE client_registry SET last_heartbeat = CURRENT_TIMESTAMP WHERE client_id = ?
  `).run(clientId);
}

/**
 * Tandai client sebagai offline.
 */
function markOffline(clientId) {
  const db = getDb();
  db.prepare(`
    UPDATE client_registry
    SET status = 'offline', disconnected_at = CURRENT_TIMESTAMP
    WHERE client_id = ?
  `).run(clientId);
}

/**
 * Ambil semua client milik user (termasuk offline).
 */
function getClientsByUser(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT client_id, user_id, user_email, user_name, hostname, platform, app_version,
           ip_address, status, connected_at, last_heartbeat, disconnected_at
    FROM client_registry
    WHERE user_id = ?
    ORDER BY last_heartbeat DESC
  `).all(userId);
}

/**
 * Ambil hanya client online milik user.
 */
function getOnlineClientsByUser(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT client_id, user_id, user_email, user_name, hostname, platform, app_version,
           ip_address, status, connected_at, last_heartbeat
    FROM client_registry
    WHERE user_id = ? AND status = 'online'
    ORDER BY connected_at DESC
  `).all(userId);
}

/**
 * Cek apakah client milik user tertentu.
 */
function isClientOwnedByUser(clientId, userId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT 1 FROM client_registry WHERE client_id = ? AND user_id = ?
  `).get(clientId, userId);
  return !!row;
}

/**
 * Ambil satu client by ID.
 */
function getClientById(clientId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM client_registry WHERE client_id = ?`).get(clientId);
}

module.exports = {
  upsertClient,
  touchHeartbeat,
  markOffline,
  getClientsByUser,
  getOnlineClientsByUser,
  isClientOwnedByUser,
  getClientById,
};
