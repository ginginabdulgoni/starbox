"use strict";

/**
 * Socket.IO middleware: validasi auth di handshake sebelum koneksi diizinkan.
 *
 * Dua mode auth:
 *  A) JWT token (Electron desktop app):
 *     socket = io(SERVER_URL, { auth: { token: "Bearer <jwt>" } })
 *
 *  B) Web token (browser dari Laravel web):
 *     socket = io(SERVER_URL, { auth: { web_token: "<uuid>" } })
 *     Token divalidasi ke Laravel API → dapat user_id
 *
 * Setelah middleware sukses, socket memiliki:
 *   socket.userId, socket.userEmail, socket.userName, socket.isGuest, socket.isWebViewer
 */

const { validateToken } = require("../auth/jwt-validator");
const fetch  = require("node-fetch");
const config = require("../config");
const logger = require("../utils/logger");

async function authMiddleware(socket, next) {
  // ── Mode B: Web token dari browser Laravel ───────────────────────────────
  const webToken = socket.handshake.auth?.web_token;
  if (webToken) {
    try {
      const url = `${config.STARBOX_API_BASE}/stardesk/validate-web-token`;
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "StarBox-RemoteServer/1.0" },
        body:    JSON.stringify({ token: webToken }),
        timeout: 8000,
      });

      if (!res.ok) {
        logger.warn(`[Auth] Web token ditolak oleh Laravel: HTTP ${res.status}`);
        return next(new Error("AUTH_INVALID"));
      }

      const { user_id, machine_id, remote_client_id, hostname } = await res.json();

      socket.userId          = user_id;
      socket.userEmail       = "";
      socket.userName        = hostname || "Web Browser";
      socket.isGuest         = false;
      socket.isWebViewer     = true;
      socket.rawWebToken     = webToken;
      // targetMachineId = format client_id yg dipakai Electron di remote-server
      socket.targetMachineId = remote_client_id || machine_id;

      logger.info(`[Auth] Web viewer socket authenticated: user ${user_id}, target ${machine_id}`);
      return next();
    } catch (err) {
      logger.warn(`[Auth] Web token validation error: ${err.message}`);
      return next(new Error("AUTH_INVALID"));
    }
  }

  // ── Mode A: JWT token (Electron app) ─────────────────────────────────────
  const raw = socket.handshake.auth?.token || socket.handshake.headers?.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

  if (!token) {
    // Guest — tidak ada auth, hanya bisa menerima StarDesk stream publik
    socket.userId    = null;
    socket.userEmail = "";
    socket.userName  = "Guest";
    socket.isGuest   = true;
    logger.info(`[Auth] Guest socket dari ${socket.handshake.address}`);
    return next();
  }

  validateToken(token)
    .then(({ userId, email, name }) => {
      socket.userId    = userId;
      socket.userEmail = email;
      socket.userName  = name;
      socket.rawToken  = token;
      socket.isGuest   = false;
      logger.info(`[Auth] Socket ${socket.id} authenticated: user ${userId}`);
      next();
    })
    .catch((err) => {
      logger.warn(`[Auth] Token ditolak: ${err.message}`);
      next(new Error("AUTH_INVALID"));
    });
}

module.exports = authMiddleware;
