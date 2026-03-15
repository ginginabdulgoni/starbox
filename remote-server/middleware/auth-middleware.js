"use strict";

/**
 * Socket.IO middleware: validasi JWT di handshake sebelum koneksi diizinkan.
 *
 * Client harus kirim token di handshake auth:
 *   socket = io(SERVER_URL, { auth: { token: "Bearer <jwt>" } })
 *
 * Setelah middleware ini sukses, socket akan memiliki properti:
 *   socket.userId, socket.userEmail, socket.userName
 */

const { validateToken } = require("../auth/jwt-validator");
const logger = require("../utils/logger");

function authMiddleware(socket, next) {
  const raw = socket.handshake.auth?.token || socket.handshake.headers?.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

  if (!token) {
    logger.warn(`[Auth] Koneksi ditolak (no token): ${socket.handshake.address}`);
    return next(new Error("AUTH_REQUIRED"));
  }

  validateToken(token)
    .then(({ userId, email, name }) => {
      socket.userId    = userId;
      socket.userEmail = email;
      socket.userName  = name;
      socket.rawToken  = token;
      logger.info(`[Auth] Socket ${socket.id} authenticated: user ${userId}`);
      next();
    })
    .catch((err) => {
      logger.warn(`[Auth] Token ditolak: ${err.message}`);
      next(new Error("AUTH_INVALID"));
    });
}

module.exports = authMiddleware;
