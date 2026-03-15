"use strict";

/**
 * Handler siklus hidup koneksi Socket.IO.
 *
 * Saat client connect:
 *   1. Daftarkan di client_registry DB
 *   2. Masukkan ke Map clientSocketMap
 *   3. Masukkan ke room berdasarkan user_id (untuk broadcast antar sesama user)
 *   4. Broadcast "client:online" ke semua client user yang sama
 *
 * Saat client disconnect:
 *   1. Tandai offline di DB
 *   2. Hapus dari Map
 *   3. Broadcast "client:offline"
 */

const { upsertClient, markOffline, getOnlineClientsByUser } = require("../db/repositories/client-registry");
const { attachCommandRelay } = require("./command-relay");
const { attachHeartbeat } = require("./heartbeat");
const logger = require("../utils/logger");

/**
 * Map global: clientId -> Socket
 * Digunakan oleh command-relay untuk mengirim event ke target client.
 */
const clientSocketMap = new Map();

/**
 * Pasang semua handler ke socket baru.
 * Dipanggil dari io.on("connection", ...) di index.js.
 *
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
function handleConnection(io, socket) {
  const { userId, userEmail, userName } = socket;
  const ipAddress = socket.handshake.address;
  const meta      = socket.handshake.auth?.meta || {};

  // Buat clientId yang stabil: user bisa kirim dari client, atau auto-generate dari socket.id
  const clientId = meta.client_id || socket.id;
  socket.clientId = clientId;

  // Room berdasarkan user_id: semua client user yang sama bergabung di sini
  const userRoom = `user:${userId}`;
  socket.join(userRoom);

  logger.info(`[Conn] Client ${clientId} (${userEmail}) connected dari ${ipAddress}`);

  // Daftarkan di DB
  upsertClient({
    clientId,
    userId,
    userEmail,
    userName,
    hostname:   meta.hostname   || "",
    platform:   meta.platform   || "",
    appVersion: meta.app_version || "",
    ipAddress,
  });

  // Masukkan ke map
  clientSocketMap.set(clientId, socket);
  socket.lastHeartbeatAt = Date.now();

  // Kirim ke client ini: daftar semua client online milik user yang sama (termasuk diri sendiri)
  const clients = getOnlineClientsByUser(userId);
  socket.emit("clients:list", { clients });

  // Broadcast ke client lain milik user yang sama: ada client baru online
  socket.to(userRoom).emit("client:online", {
    client_id:   clientId,
    hostname:    meta.hostname   || "",
    platform:    meta.platform   || "",
    app_version: meta.app_version || "",
    connected_at: new Date().toISOString(),
  });

  // Pasang handler command relay
  attachCommandRelay(socket, clientSocketMap);

  // Pasang handler heartbeat
  attachHeartbeat(socket, clientSocketMap);

  // Handler: client minta daftar client online milik user yang sama
  socket.on("clients:refresh", () => {
    const online = getOnlineClientsByUser(userId);
    socket.emit("clients:list", { clients: online });
  });

  // Handler disconnect
  socket.on("disconnect", (reason) => {
    logger.info(`[Conn] Client ${clientId} disconnect: ${reason}`);

    clientSocketMap.delete(clientId);
    markOffline(clientId);

    // Broadcast ke sesama user
    socket.to(userRoom).emit("client:offline", { client_id: clientId });
  });
}

module.exports = { handleConnection, clientSocketMap };
