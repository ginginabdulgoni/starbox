"use strict";

/**
 * Handler heartbeat dari client.
 * Client mengirim event "heartbeat" setiap HEARTBEAT_INTERVAL_MS.
 * Server update last_heartbeat di DB dan balas "heartbeat:ack".
 */

const { touchHeartbeat } = require("../db/repositories/client-registry");
const config = require("../config");
const logger = require("../utils/logger");

/**
 * Pasang handler heartbeat ke socket.
 * @param {import("socket.io").Socket} socket
 * @param {Map<string, import("socket.io").Socket>} clientSocketMap - clientId -> socket
 */
function attachHeartbeat(socket, clientSocketMap) {
  socket.on("heartbeat", () => {
    const clientId = socket.clientId;
    if (!clientId) return;

    // Update in-memory only — DB write is batched in the sweeper to reduce CPU load
    socket.lastHeartbeatAt = Date.now();
    socket.emit("heartbeat:ack", { timestamp: socket.lastHeartbeatAt });
  });
}

/**
 * Jalankan sweeper: cek client yang last_heartbeat-nya sudah terlalu lama.
 * Sekaligus batch-write heartbeat ke DB untuk semua client yang masih hidup.
 */
function startHeartbeatSweeper(io, clientSocketMap) {
  const threshold = config.HEARTBEAT_DEAD_THRESHOLD_MS;
  // Sweeper jalan setiap 2× interval heartbeat — mengurangi frekuensi DB write
  const sweepInterval = config.HEARTBEAT_INTERVAL_MS * 2;

  setInterval(() => {
    const now = Date.now();
    for (const [clientId, socket] of clientSocketMap.entries()) {
      if (!socket.lastHeartbeatAt) continue;
      const age = now - socket.lastHeartbeatAt;
      if (age > threshold) {
        logger.warn(`[Heartbeat] Client ${clientId} timeout (${age}ms), disconnect`);
        socket.disconnect(true);
      } else {
        // Batch DB write di sini, bukan per-heartbeat event
        try { touchHeartbeat(clientId); } catch {}
      }
    }
  }, sweepInterval);
}

module.exports = { attachHeartbeat, startHeartbeatSweeper };
