"use strict";

/**
 * Handler relay command antar client.
 *
 * Flow:
 *   Client A --[command:request]--> Server --[command:execute]--> Client B
 *   Client B --[command:response]--> Server --[command:result]--> Client A
 *
 * Validasi:
 *   1. from_client dan to_client harus dimiliki user yang sama (user_id sama)
 *   2. command harus ada di daftar yang diizinkan
 *   3. send_js hanya boleh jika ALLOW_SEND_JS = true
 */

const { v4: uuidv4 } = require("uuid");
const { isClientOwnedByUser } = require("../db/repositories/client-registry");
const { createEntry, completeEntry } = require("../db/repositories/audit-log");
const config = require("../config");
const logger = require("../utils/logger");

// Command high-frequency (mouse/keyboard) — skip audit log agar tidak spam DB
const SKIP_AUDIT_COMMANDS = new Set([
  "capture_tab", "move_tab", "scroll_tab", "tap_tab", "type_tab", "key_tab",
]);

// Daftar command yang diizinkan
const ALLOWED_COMMANDS = new Set([
  "list_devices",
  "get_tabs",
  "open_tab",
  "focus_tab",
  "reload_tab",
  "close_tab",
  "open_monitor",
  "close_monitor",
  "capture_tab",
  "move_tab",
  "scroll_tab",
  "tap_tab",
  "type_tab",
  "key_tab",
  "navigate_url",
  "get_current_url",
  "get_title",
  "start_device",
  "stop_device",
  "restart_device",
  "send_js",        // dilindungi feature flag ALLOW_SEND_JS
]);

/**
 * Map: commandId -> { fromSocket, startAt, timeoutHandle }
 * Untuk melacak pending command dan cleanup timeout.
 */
const pendingCommands = new Map();

/**
 * Cache ownership: `${userId}::${toClientId}` -> { owned: bool, expiresAt: number }
 * Menghindari query SQLite setiap keystroke (fire_and_forget rapid input).
 */
const ownershipCache = new Map();
const OWNERSHIP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

function isClientOwnedByUserCached(toClientId, userId) {
  const key = `${userId}::${toClientId}`;
  const cached = ownershipCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.owned;

  const owned = isClientOwnedByUser(toClientId, userId);
  ownershipCache.set(key, { owned, expiresAt: Date.now() + OWNERSHIP_CACHE_TTL_MS });
  return owned;
}

/**
 * Pasang handler command:request ke socket (client pengirim).
 * @param {import("socket.io").Socket} socket
 * @param {Map<string, import("socket.io").Socket>} clientSocketMap - clientId -> socket
 */
function attachCommandRelay(socket, clientSocketMap) {
  socket.on("command:request", async (data) => {
    const fromClientId = socket.clientId;
    const userId       = socket.userId;
    const ipAddress    = socket.handshake.address;

    // --- Validasi payload ---
    const { command_id: requestedCommandId, to_client_id, command, payload, fire_and_forget } = data || {};
    const normalizedCommandId =
      typeof requestedCommandId === "string" && requestedCommandId.trim() ? requestedCommandId.trim() : null;
    const fireAndForget = fire_and_forget === true;
    const emitCommandError = (error, message) => socket.emit("command:error", {
      command_id: normalizedCommandId,
      error,
      message,
    });

    if (!to_client_id || !command) {
      return emitCommandError("INVALID_PAYLOAD", "to_client_id dan command wajib diisi");
    }

    // Validasi command
    if (!ALLOWED_COMMANDS.has(command)) {
      return emitCommandError("UNKNOWN_COMMAND", `Command '${command}' tidak dikenal`);
    }

    // Feature flag send_js
    if (command === "send_js" && !config.ALLOW_SEND_JS) {
      return emitCommandError("FEATURE_DISABLED", "Command send_js tidak diaktifkan di server ini");
    }

    // Self-command diperbolehkan untuk kebutuhan testing/debug.

    // --- Validasi kepemilikan: target harus milik user yang sama ---
    let targetOwned;
    try {
      targetOwned = isClientOwnedByUserCached(to_client_id, userId);
    } catch (err) {
      logger.error("[Relay] DB error saat cek ownership:", err.message);
      return emitCommandError("SERVER_ERROR", "Gagal validasi kepemilikan");
    }

    if (!targetOwned) {
      logger.warn(`[Relay] User ${userId} coba kirim ke client asing ${to_client_id}`);
      return emitCommandError("FORBIDDEN", "Target client bukan milik akun Anda");
    }

    // --- Cari socket target ---
    const targetSocket = clientSocketMap.get(to_client_id);
    if (!targetSocket || !targetSocket.connected) {
      return emitCommandError("TARGET_OFFLINE", `Client target (${to_client_id}) sedang offline`);
    }

    // --- Generate command ID ---
    // Fire-and-forget tidak perlu UUID (tidak di-track), pakai ID dari client jika ada
    const commandId = fireAndForget
      ? (normalizedCommandId || "ff")
      : (normalizedCommandId && !pendingCommands.has(normalizedCommandId) ? normalizedCommandId : uuidv4());
    const startAt   = Date.now();

    if (!fireAndForget && !SKIP_AUDIT_COMMANDS.has(command)) {
      // Tulis ke audit log (skip untuk command high-frequency agar tidak spam DB)
      try {
        createEntry({ commandId, userId, fromClientId, toClientId: to_client_id, command, payload, ipAddress });
      } catch (err) {
        logger.error("[Relay] Gagal tulis audit log:", err.message);
        // Tidak fatal, lanjutkan
      }
    }

    if (!fireAndForget && !SKIP_AUDIT_COMMANDS.has(command)) {
      logger.info(`[Relay] Command '${command}' (${commandId}) dari ${fromClientId} -> ${to_client_id}`);
    }

    if (!fireAndForget) {
      // --- Setup timeout ---
      const timeoutHandle = setTimeout(() => {
        if (!pendingCommands.has(commandId)) return;
        pendingCommands.delete(commandId);

        try {
          completeEntry({ commandId, status: "timeout", errorMessage: "Timeout", durationMs: config.COMMAND_TIMEOUT_MS });
        } catch {}

        // Cari socket terbaru dari clientSocketMap (bukan socket lama yang mungkin sudah disconnect)
        const currentSocket = clientSocketMap.get(fromClientId);
        if (currentSocket && currentSocket.connected) {
          currentSocket.emit("command:result", {
            command_id: commandId,
            status:     "timeout",
            error:      "TIMEOUT",
            message:    `Command '${command}' timeout setelah ${config.COMMAND_TIMEOUT_MS}ms`,
          });
        }
      }, config.COMMAND_TIMEOUT_MS);

      // Simpan fromClientId agar bisa lookup socket terbaru saat response tiba
      pendingCommands.set(commandId, { fromClientId, command, startAt, timeoutHandle });
    }

    // --- Kirim ke target ---
    targetSocket.emit("command:execute", {
      command_id:      commandId,
      from_client_id:  fromClientId,
      command,
      payload: payload || {},
      response_required: !fireAndForget,
    });
  });

  // Handler balasan dari client yang mengeksekusi command
  socket.on("command:response", (data) => {
    const { command_id, status, result, error } = data || {};

    if (!command_id) return;

    const pending = pendingCommands.get(command_id);
    if (!pending) {
      // Mungkin sudah timeout
      logger.debug(`[Relay] Response untuk command ${command_id} tidak ditemukan (mungkin sudah timeout)`);
      return;
    }

    clearTimeout(pending.timeoutHandle);
    pendingCommands.delete(command_id);

    const durationMs = Date.now() - pending.startAt;

    // Update audit log (skip untuk command high-frequency)
    if (!SKIP_AUDIT_COMMANDS.has(pending.command)) {
      try {
        completeEntry({ commandId: command_id, status, result, errorMessage: error, durationMs });
      } catch (err) {
        logger.error("[Relay] Gagal update audit log:", err.message);
      }
    }

    // Kirim hasil ke client pengirim — cari socket terbaru berdasarkan clientId
    const fromSocket = clientSocketMap.get(pending.fromClientId);
    if (fromSocket && fromSocket.connected) {
      fromSocket.emit("command:result", {
        command_id,
        status,
        result:   result || null,
        error:    error  || null,
        duration: durationMs,
      });
    } else {
      logger.warn(`[Relay] Pengirim ${pending.fromClientId} sudah offline, command:result dibuang`);
    }

    if (!SKIP_AUDIT_COMMANDS.has(pending.command)) {
      const errorSuffix = status === "failed" && error ? ` - error: ${error}` : "";
      logger.info(`[Relay] Command ${command_id} selesai: ${status} (${durationMs}ms)${errorSuffix}`);
    }
  });
}

module.exports = { attachCommandRelay };
