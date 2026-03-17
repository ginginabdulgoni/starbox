"use strict";

/**
 * StarDesk REST API handler.
 *
 * Endpoint:
 *   GET  /api/stardesk/my-devices   → daftar semua device milik user (online + offline)
 *   PATCH /api/stardesk/devices/:clientId/rename → ganti device_name
 *
 * Auth: Bearer token di header Authorization (sama dengan Socket.IO auth).
 */

const { validateToken } = require("../auth/jwt-validator");
const { getClientsByUser, renameDevice, isClientOwnedByUser, getClientById, setPermanentPin, validatePermanentPin } = require("../db/repositories/client-registry");
const { generateCode, validateCode } = require("../db/repositories/device-access-codes");
const logger = require("../utils/logger");

/**
 * Middleware Express untuk validasi Bearer token via REST.
 */
async function restAuth(req, res, next) {
  const raw = req.headers.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

  if (!token) {
    return res.status(401).json({ error: "AUTH_REQUIRED" });
  }

  try {
    const { userId, email, name } = await validateToken(token);
    req.userId    = userId;
    req.userEmail = email;
    req.userName  = name;
    next();
  } catch (err) {
    logger.warn(`[StarDesk API] Token ditolak: ${err.message}`);
    return res.status(401).json({ error: "AUTH_INVALID" });
  }
}

/**
 * Daftarkan route StarDesk ke Express app.
 * @param {import("express").Application} app
 * @param {Map} clientSocketMap  — map clientId→socket (untuk cek live-connection)
 */
function registerStarDeskRoutes(app, clientSocketMap) {
  // GET /api/stardesk/my-devices
  app.get("/api/stardesk/my-devices", restAuth, (req, res) => {
    try {
      const rows = getClientsByUser(req.userId);

      // Dedup: per hostname, simpan hanya yang paling baru (online > offline, lalu last_heartbeat)
      // Ini untuk menangani kasus client_id lama sebelum stable machine ID dipakai
      const byHostname = new Map();
      for (const d of rows) {
        const key = (d.hostname || d.client_id).toLowerCase();
        const existing = byHostname.get(key);
        if (!existing) {
          byHostname.set(key, d);
        } else {
          // Prefer online, lalu lebih baru
          const existOnline = clientSocketMap.has(existing.client_id);
          const dOnline     = clientSocketMap.has(d.client_id);
          if (dOnline && !existOnline) {
            byHostname.set(key, d);
          } else if (!existOnline && !dOnline) {
            // Both offline – keep newer last_heartbeat
            if (new Date(d.last_heartbeat) > new Date(existing.last_heartbeat)) {
              byHostname.set(key, d);
            }
          }
        }
      }

      const devices = Array.from(byHostname.values()).map((d) => ({
        client_id:       d.client_id,
        device_name:     d.device_name || d.hostname || d.client_id,
        hostname:        d.hostname,
        platform:        d.platform,
        app_version:     d.app_version,
        user_email:      d.user_email,
        user_name:       d.user_name,
        ip_address:      d.ip_address,
        status:          clientSocketMap.has(d.client_id) ? "online" : "offline",
        connected_at:    d.connected_at,
        last_heartbeat:  d.last_heartbeat,
        disconnected_at: d.disconnected_at,
      }));

      res.json({ devices });
    } catch (err) {
      logger.error("[StarDesk API] get my-devices error:", err.message);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  // PATCH /api/stardesk/devices/:clientId/rename
  app.patch("/api/stardesk/devices/:clientId/rename", restAuth, (req, res) => {
    const { clientId } = req.params;
    const { device_name } = req.body || {};

    if (!device_name || typeof device_name !== "string" || !device_name.trim()) {
      return res.status(400).json({ error: "device_name wajib diisi" });
    }

    // Pastikan device milik user ini
    if (!isClientOwnedByUser(clientId, req.userId)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    try {
      renameDevice(clientId, device_name.trim());

      // Kirim event ke socket client jika sedang online
      const socket = clientSocketMap.get(clientId);
      if (socket) {
        socket.emit("device:renamed", { client_id: clientId, device_name: device_name.trim() });
      }

      res.json({ ok: true, device_name: device_name.trim() });
    } catch (err) {
      logger.error("[StarDesk API] rename error:", err.message);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  // POST /api/stardesk/devices/:clientId/generate-otp
  // Pemilik device membuat kode OTP agar user lain bisa remote masuk
  app.post("/api/stardesk/devices/:clientId/generate-otp", restAuth, (req, res) => {
    const { clientId } = req.params;

    if (!isClientOwnedByUser(clientId, req.userId)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    try {
      const code = generateCode(clientId, req.userId);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      res.json({ ok: true, code, client_id: clientId, expires_at: expiresAt });
    } catch (err) {
      logger.error("[StarDesk API] generate-otp error:", err.message);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  // POST /api/stardesk/connect-by-code
  // User lain memasukkan Device ID + OTP untuk menghubungkan ke perangkat (no auth required — OTP is self-authenticating)
  app.post("/api/stardesk/connect-by-code", (req, res) => {
    const { client_id, code } = req.body || {};

    if (!client_id || !code) {
      return res.status(400).json({ error: "client_id dan code wajib diisi" });
    }

    try {
      const result = validateCode(String(code).trim());
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }

      // Pastikan code sesuai dengan client_id yang diminta
      if (result.clientId !== client_id) {
        return res.status(400).json({ error: "INVALID_CODE" });
      }

      // Cek apakah device sedang online
      const isOnline = clientSocketMap.has(result.clientId);
      const device   = getClientById(result.clientId);

      res.json({
        ok:        true,
        client_id: result.clientId,
        device_name: device?.device_name || device?.hostname || result.clientId,
        hostname:    device?.hostname || "",
        platform:    device?.platform || "",
        status:      isOnline ? "online" : "offline",
      });
    } catch (err) {
      logger.error("[StarDesk API] connect-by-code error:", err.message);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  // POST /api/stardesk/devices/:clientId/set-pin
  // Pemilik device menyimpan PIN permanen (reusable, tidak expire)
  app.post("/api/stardesk/devices/:clientId/set-pin", restAuth, (req, res) => {
    const { clientId } = req.params;
    const { pin } = req.body || {};

    if (!isClientOwnedByUser(clientId, req.userId)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // PIN boleh kosong (untuk hapus PIN)
    if (pin && (String(pin).length < 4 || String(pin).length > 20)) {
      return res.status(400).json({ error: "PIN harus 4–20 karakter" });
    }

    try {
      setPermanentPin(clientId, pin ? String(pin).trim() : null);
      res.json({ ok: true });
    } catch (err) {
      logger.error("[StarDesk API] set-pin error:", err.message);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  // POST /api/stardesk/connect-by-pin
  // Hubungkan ke device menggunakan PIN permanen (kapanpun, reusable) (no auth required — PIN is self-authenticating)
  app.post("/api/stardesk/connect-by-pin", (req, res) => {
    const { client_id, pin } = req.body || {};

    if (!client_id || !pin) {
      return res.status(400).json({ error: "client_id dan pin wajib diisi" });
    }

    try {
      // Cek PIN: coba DB terlebih dahulu (permanentPin auth user), lalu cek socket sharePin
      let valid = validatePermanentPin(client_id, String(pin).trim());
      if (!valid) {
        const targetSocket = clientSocketMap.get(client_id);
        if (targetSocket?.sharePin) {
          valid = targetSocket.sharePin === String(pin).trim();
        }
      }
      if (!valid) return res.status(400).json({ error: "INVALID_PIN" });

      const isOnline = clientSocketMap.has(client_id);
      const device   = getClientById(client_id);

      res.json({
        ok:          true,
        client_id,
        device_name: device?.device_name || device?.hostname || client_id,
        hostname:    device?.hostname || "",
        platform:    device?.platform || "",
        status:      isOnline ? "online" : "offline",
      });
    } catch (err) {
      logger.error("[StarDesk API] connect-by-pin error:", err.message);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });
}

module.exports = { registerStarDeskRoutes };
