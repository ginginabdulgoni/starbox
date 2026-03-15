"use strict";

/**
 * Validasi token JWT dengan memanggil endpoint /api/auth/me dari backend StarBox.
 * Hasil di-cache per token agar tidak spam ke API.
 *
 * Response yang diharapkan dari /api/auth/me:
 *   { user: { id, email, name, ... } }
 */

const fetch = require("node-fetch");
const config = require("../config");
const logger = require("../utils/logger");

// Cache: Map<token, { userId, email, name, cachedAt }>
const tokenCache = new Map();

/**
 * Hapus entry cache yang sudah expired.
 */
function pruneCache() {
  const now = Date.now();
  for (const [token, entry] of tokenCache.entries()) {
    if (now - entry.cachedAt > config.TOKEN_CACHE_TTL_MS) {
      tokenCache.delete(token);
    }
  }
}

// Bersihkan cache setiap 10 menit
setInterval(pruneCache, 10 * 60 * 1000);

/**
 * Validasi token Bearer ke API StarBox.
 * @param {string} token - JWT Bearer token
 * @returns {Promise<{userId: string, email: string, name: string}>}
 * @throws {Error} jika token tidak valid
 */
async function validateToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Token tidak boleh kosong");
  }

  // Mode mock untuk testing lokal (MOCK_AUTH=true)
  if (process.env.MOCK_AUTH === "true") {
    logger.warn("[JWT] MOCK_AUTH aktif – semua token diterima (JANGAN di production!)");
    return { userId: "mock-user-1", email: "test@starbox.local", name: "Test User" };
  }

  // Cek cache
  const cached = tokenCache.get(token);
  if (cached && Date.now() - cached.cachedAt < config.TOKEN_CACHE_TTL_MS) {
    logger.debug(`[JWT] Token cache hit untuk user ${cached.userId}`);
    return { userId: cached.userId, email: cached.email, name: cached.name };
  }

  // Panggil API
  const url = `${config.STARBOX_API_BASE}/auth/me`;
  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "StarBox-RemoteServer/1.0",
      },
      timeout: 10000,
    });
  } catch (err) {
    logger.error("[JWT] Gagal reach auth API:", err.message);
    // Jika ada stale cache, pakai sementara agar client tidak disconnect
    const stale = tokenCache.get(token);
    if (stale) {
      logger.warn(`[JWT] Auth API unreachable — pakai stale cache untuk user ${stale.userId}`);
      return { userId: stale.userId, email: stale.email, name: stale.name };
    }
    throw new Error("Auth server tidak dapat dijangkau");
  }

  if (!res.ok) {
    logger.warn(`[JWT] Token ditolak, status ${res.status}`);
    // Hapus cache agar token lama tidak dipakai lagi
    tokenCache.delete(token);
    throw new Error(`Token tidak valid (${res.status})`);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error("Response auth API tidak valid");
  }

  // Normalisasi: support { user: {...} } atau { data: {...} } atau flat object
  const user = body.user || body.data || body;
  const userId = String(user.id || user.user_id || user.uid || "");
  const email = user.email || "";
  const name = user.name || user.username || email;

  if (!userId) {
    throw new Error("Auth API tidak mengembalikan user ID");
  }

  // Simpan ke cache
  tokenCache.set(token, { userId, email, name, cachedAt: Date.now() });
  logger.info(`[JWT] Token valid: user ${userId} (${email})`);

  return { userId, email, name };
}

/**
 * Hapus token dari cache (misalnya saat logout).
 */
function invalidateToken(token) {
  tokenCache.delete(token);
}

module.exports = { validateToken, invalidateToken };
