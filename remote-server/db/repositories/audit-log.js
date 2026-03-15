"use strict";

const { getDb } = require("../database");

/**
 * Buat entry audit log baru (status: pending).
 */
function createEntry({ commandId, userId, fromClientId, toClientId, command, payload, ipAddress }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (command_id, user_id, from_client_id, to_client_id, command, payload, status, ip_address)
    VALUES (@commandId, @userId, @fromClientId, @toClientId, @command, @payload, 'pending', @ipAddress)
  `).run({
    commandId,
    userId,
    fromClientId,
    toClientId,
    command,
    payload: payload ? JSON.stringify(payload) : null,
    ipAddress: ipAddress || "",
  });
}

/**
 * Update entry audit log dengan result (success / failed / timeout).
 */
function completeEntry({ commandId, status, result, errorMessage, durationMs }) {
  const db = getDb();
  db.prepare(`
    UPDATE audit_log SET
      status       = @status,
      result       = @result,
      error_message = @errorMessage,
      completed_at = CURRENT_TIMESTAMP,
      duration_ms  = @durationMs
    WHERE command_id = @commandId
  `).run({
    commandId,
    status,
    result: result ? JSON.stringify(result) : null,
    errorMessage: errorMessage || null,
    durationMs: durationMs || null,
  });
}

/**
 * Ambil audit log untuk user tertentu, dengan pagination.
 */
function getByUser(userId, { limit = 50, offset = 0, command = null } = {}) {
  const db = getDb();
  let query = `
    SELECT id, command_id, from_client_id, to_client_id, command, status,
           error_message, ip_address, executed_at, completed_at, duration_ms
    FROM audit_log
    WHERE user_id = ?
  `;
  const params = [userId];

  if (command) {
    query += " AND command = ?";
    params.push(command);
  }

  query += " ORDER BY executed_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Ambil satu entry by command_id.
 */
function getByCommandId(commandId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM audit_log WHERE command_id = ?`).get(commandId);
}

/**
 * Hapus audit log lama (lebih dari N hari).
 */
function purgeOlderThan(days = 30) {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM audit_log WHERE executed_at < datetime('now', '-${parseInt(days, 10)} days')
  `).run();
  return result.changes;
}

module.exports = { createEntry, completeEntry, getByUser, getByCommandId, purgeOlderThan };
