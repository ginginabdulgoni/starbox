require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 4200,

  // URL API utama StarBox untuk validasi token
  STARBOX_API_BASE: process.env.STARBOX_API_BASE || "https://starbox.weagate.com/api",

  // Path SQLite audit log database
  DB_PATH: process.env.DB_PATH || "./data/remote.db",

  // Timeout command (ms) – client harus balas sebelum ini
  COMMAND_TIMEOUT_MS: parseInt(process.env.COMMAND_TIMEOUT_MS || "30000", 10),

  // Interval heartbeat yang diharapkan dari client (ms)
  HEARTBEAT_INTERVAL_MS: parseInt(process.env.HEARTBEAT_INTERVAL_MS || "30000", 10),

  // Jika client tidak kirim heartbeat lebih dari ini, dianggap offline
  HEARTBEAT_DEAD_THRESHOLD_MS: parseInt(process.env.HEARTBEAT_DEAD_THRESHOLD_MS || "75000", 10),

  // CORS origins yang diizinkan (comma-separated)
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "*").split(","),

  // Feature flag: izinkan command send_js
  ALLOW_SEND_JS: process.env.ALLOW_SEND_JS === "true",

  // Secret opsional untuk validasi JWT lokal (jika set, tidak perlu call API)
  JWT_SECRET: process.env.JWT_SECRET || null,

  // Cache durasi validasi token (ms) agar tidak spam ke API
  TOKEN_CACHE_TTL_MS: parseInt(process.env.TOKEN_CACHE_TTL_MS || "300000", 10), // 5 menit
};
