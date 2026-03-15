/**
 * PM2 Ecosystem Config — StarBox Remote Server
 *
 * Deploy:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup   ← jalankan perintah yang muncul agar auto-start saat reboot
 *
 * Catatan cluster Socket.IO:
 *   Socket.IO pakai in-memory state, jadi untuk multi-instance perlu sticky sessions.
 *   Gunakan instances: 1 (default) kecuali sudah pasang @socket.io/sticky + cluster adapter.
 *   Untuk server 2-core, single instance sudah cukup setelah optimasi DB write.
 */
module.exports = {
  apps: [
    {
      name: "starbox-remote",
      script: "index.js",
      cwd: __dirname,

      // Single instance (aman untuk Socket.IO tanpa sticky sessions)
      instances: 1,
      exec_mode: "fork",

      // Restart otomatis jika crash atau memory leak
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 2000,

      // Batasi memory — restart jika >400MB (mencegah leak)
      max_memory_restart: "400M",

      // Node.js heap size eksplisit
      node_args: "--max-old-space-size=384",

      // Environment production
      env: {
        NODE_ENV: "production",
        PORT: 4200,

        // Hanya log warn/error — matikan info/debug untuk mengurangi disk I/O
        LOG_LEVEL: "warn",

        // Naikkan heartbeat interval → lebih jarang DB write
        HEARTBEAT_INTERVAL_MS: 60000,
        HEARTBEAT_DEAD_THRESHOLD_MS: 150000,

        // Token cache 10 menit → lebih jarang hit API auth
        TOKEN_CACHE_TTL_MS: 600000,
      },

      // Log
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
