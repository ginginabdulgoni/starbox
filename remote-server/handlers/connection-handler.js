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

const { upsertClient, markOffline, getOnlineClientsByUser, renameDevice } = require("../db/repositories/client-registry");
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

  // Room berdasarkan user_id: semua client user yang sama bergabung di sini.
  // Guest tidak punya userId — pakai room private berbasis socket.id agar terisolasi.
  const userRoom = userId ? `user:${userId}` : `guest:${socket.id}`;
  socket.join(userRoom);

  logger.info(`[Conn] Client ${clientId} (${userEmail}) connected dari ${ipAddress}`);

  // Daftarkan di DB (hanya untuk authenticated user, bukan guest)
  if (userId) {
    upsertClient({
      clientId,
      userId,
      userEmail,
      userName,
      hostname:    meta.hostname    || "",
      platform:    meta.platform    || "",
      appVersion:  meta.app_version || "",
      ipAddress,
      deviceName:  meta.device_name || "",
    });
  }

  // Masukkan ke map
  clientSocketMap.set(clientId, socket);
  socket.lastHeartbeatAt = Date.now();

  // Kirim ke client ini: daftar semua client online milik user yang sama (termasuk diri sendiri)
  // Guest tidak punya user_id — kirim list kosong
  const clients = userId ? getOnlineClientsByUser(userId) : [];
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
    const online = userId ? getOnlineClientsByUser(userId) : [];
    socket.emit("clients:list", { clients: online });
  });

  // Handler: ganti nama device
  socket.on("device:rename", ({ device_name }) => {
    if (typeof device_name === "string" && device_name.trim()) {
      renameDevice(clientId, device_name.trim());
      socket.to(userRoom).emit("device:renamed", { client_id: clientId, device_name: device_name.trim() });
    }
  });

  // Handler: client mendaftarkan share PIN lokal (berlaku untuk semua, bukan hanya guest)
  socket.on("device:register-pin", ({ pin }) => {
    if (typeof pin === "string" && pin.length >= 4 && pin.length <= 20) {
      socket.sharePin = pin;
      logger.info(`[Pin] Client ${clientId} registered share PIN`);
    }
  });

  // ── StarDesk PC Remote Streaming ──────────────────────────────────────────

  // Viewer meminta stream dari target PC
  socket.on("stardesk:stream:request", ({ target_client_id }) => {
    const targetSocket = clientSocketMap.get(target_client_id);
    if (!targetSocket || !targetSocket.connected) {
      socket.emit("stardesk:stream:error", { reason: "TARGET_OFFLINE" });
      return;
    }
    // Cek kepemilikan: hanya jika keduanya bukan guest (guest bisa di-remote oleh siapa saja via OTP/PIN)
    if (!socket.isGuest && !targetSocket.isGuest && targetSocket.userId !== userId) {
      socket.emit("stardesk:stream:error", { reason: "FORBIDDEN" });
      return;
    }
    targetSocket.emit("stardesk:stream:start", { viewer_client_id: clientId });
    socket.emit("stardesk:stream:ready", { target_client_id });
    logger.info(`[Stream] ${clientId} meminta stream dari ${target_client_id}`);
  });

  // Viewer menghentikan stream
  socket.on("stardesk:stream:stop", ({ target_client_id }) => {
    const targetSocket = clientSocketMap.get(target_client_id);
    if (targetSocket && targetSocket.connected) {
      targetSocket.emit("stardesk:stream:stop", { viewer_client_id: clientId });
    }
  });

  // Target PC mengirim frame → relay ke viewer, lalu ack ke target
  // Ack memberi tahu target bahwa server telah selesai memproses frame ini,
  // sehingga target bisa mengirim frame berikutnya (flow control / cegah buffer buildup)
  socket.on("stardesk:frame", (payload, ack) => {
    const { viewer_client_id, ...rest } = payload;
    const viewerSocket = clientSocketMap.get(viewer_client_id);
    if (viewerSocket && viewerSocket.connected) {
      viewerSocket.emit("stardesk:frame", rest);
    }
    if (typeof ack === "function") ack();
  });

  // Viewer mengirim input → relay ke target PC
  socket.on("stardesk:stream:input", ({ target_client_id, ...inputData }) => {
    const targetSocket = clientSocketMap.get(target_client_id);
    // Izinkan jika: sesama user, atau salah satu adalah guest (auth sudah via OTP/PIN)
    const sameUser = userId && targetSocket?.userId === userId;
    const guestAllowed = socket.isGuest || targetSocket?.isGuest;
    if (targetSocket && targetSocket.connected && (sameUser || guestAllowed)) {
      targetSocket.emit("stardesk:stream:input", inputData);
    }
  });

  // Handler disconnect
  socket.on("disconnect", (reason) => {
    logger.info(`[Conn] Client ${clientId} disconnect: ${reason}`);

    clientSocketMap.delete(clientId);
    if (userId) markOffline(clientId);

    // Broadcast ke sesama user
    socket.to(userRoom).emit("client:offline", { client_id: clientId });
  });
}

module.exports = { handleConnection, clientSocketMap };
