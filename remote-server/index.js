"use strict";

require("dotenv").config();

const fs      = require("fs");
const http    = require("http");
const https   = require("https");
const express = require("express");
const { Server } = require("socket.io");
const config  = require("./config");
const logger  = require("./utils/logger");
const { init: initDb } = require("./db/database");
const authMiddleware   = require("./middleware/auth-middleware");
const { handleConnection } = require("./handlers/connection-handler");
const { startHeartbeatSweeper } = require("./handlers/heartbeat");
const { clientSocketMap } = require("./handlers/connection-handler");
const { purgeOlderThan }   = require("./db/repositories/audit-log");

async function main() {
  // ─── Init Database (async karena sql.js pakai WASM) ──────────────────────
  await initDb();

  // ─── Express App ─────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({
      status:  "ok",
      uptime:  process.uptime(),
      clients: clientSocketMap.size,
      version: "1.0.0",
      time:    new Date().toISOString(),
    });
  });

  app.get("/audit-log", (req, res) => {
    const { getByUser } = require("./db/repositories/audit-log");
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: "user_id required" });
    const logs = getByUser(userId, {
      limit:   parseInt(req.query.limit  || "50", 10),
      offset:  parseInt(req.query.offset || "0",  10),
      command: req.query.command || null,
    });
    res.json({ logs });
  });

  // ─── HTTP / HTTPS + Socket.IO Server ─────────────────────────────────────
  // Jika SSL_CERT dan SSL_KEY di-set di .env → pakai HTTPS (untuk port 4200 langsung)
  // Jika tidak → pakai HTTP biasa (dibalik Nginx reverse proxy)
  const SSL_CERT = "/www/server/panel/vhost/cert/starbox.weagate.com/fullchain.pem";
  const SSL_KEY  = "/www/server/panel/vhost/cert/starbox.weagate.com/privkey.pem";

  let server;
  if (fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
    server = https.createServer({
      cert: fs.readFileSync(SSL_CERT),
      key:  fs.readFileSync(SSL_KEY),
    }, app);
    logger.info("[Server] Mode: HTTPS (SSL aktif)");
  } else {
    server = http.createServer(app);
    logger.info("[Server] Mode: HTTP (SSL tidak ditemukan, pakai reverse proxy)");
  }

  const io = new Server(server, {
    cors: {
      origin:  config.CORS_ORIGINS,
      methods: ["GET", "POST"],
    },
    pingTimeout:  120000,
    pingInterval: 60000,
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 10 * 1024 * 1024, // 10 MB – untuk frame JPEG besar
  });

  io.use(authMiddleware);

  io.on("connection", (socket) => {
    handleConnection(io, socket);
  });

  // ─── Background Jobs ──────────────────────────────────────────────────────
  startHeartbeatSweeper(io, clientSocketMap);

  setInterval(() => {
    try {
      const deleted = purgeOlderThan(30);
      if (deleted > 0) logger.info(`[Purge] Hapus ${deleted} audit log lama`);
    } catch (err) {
      logger.error("[Purge] Gagal purge audit log:", err.message);
    }
  }, 24 * 60 * 60 * 1000);

  // ─── Start ────────────────────────────────────────────────────────────────
  server.listen(config.PORT, () => {
    const proto = fs.existsSync(SSL_CERT) ? "wss/https" : "ws/http";
    logger.info(`[Server] StarBox Remote Server berjalan di ${proto}://0.0.0.0:${config.PORT}`);
    logger.info(`[Server] ALLOW_SEND_JS: ${config.ALLOW_SEND_JS}`);
    logger.info(`[Server] STARBOX_API_BASE: ${config.STARBOX_API_BASE}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("[Server] Shutdown...");
    io.close();
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);
}

main().catch((err) => {
  console.error("[Server] Fatal error saat startup:", err);
  process.exit(1);
});
