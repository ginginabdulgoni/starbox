"use strict";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTOH INTEGRASI ke electron-main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tambahkan kode di bawah ke electron-main.js pada bagian yang sesuai.
 * Cari komentar "// REMOTE CLIENT INTEGRATION" untuk titik injeksi.
 *
 * LANGKAH 1: Import di bagian atas electron-main.js
 * ─────────────────────────────────────────────────
 *
 *   const RemoteClient = require("./remote-client");
 *   const remoteClient = new RemoteClient();
 *
 *
 * LANGKAH 2: Start setelah user login (tambahkan di dalam ipcMain.handle("auth-login"))
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // Di dalam blok try setelah login sukses, setelah buildAuthSessionFromResponse():
 *   startRemoteClient();
 *
 *
 * LANGKAH 3: Tambahkan fungsi startRemoteClient() & stopRemoteClient()
 * ─────────────────────────────────────────────────────────────────────
 *
 *   function startRemoteClient() {
 *     if (!authSession.isLoggedIn || !authSession.token) return;
 *
 *     remoteClient.start({
 *       token:        authSession.token,
 *       appVersion:   APP_VERSION,
 *       deviceWindows,
 *       getDeviceConfig,
 *
 *       // Expose fungsi DB sebagai "IPC handlers" agar bridge bisa invoke mereka
 *       ipcHandlers: {
 *         "load-devices": async (dbType) => {
 *           // Panggil langsung logika load-devices yang sudah ada
 *           const db = readDb(dbType === "android" ? DB_PATH_ANDROID : DB_PATH);
 *           return { devices: db.devices || [] };
 *         },
 *         "start-device": async (uid, service) => {
 *           await startDevice(uid, service);
 *           return { ok: true };
 *         },
 *       },
 *     });
 *
 *     // Saat client lain online/offline: broadcast ke semua window
 *     remoteClient.onClientsChange((clients) => {
 *       broadcastToAllWindows("remote:clients-updated", { clients });
 *     });
 *
 *     // Saat koneksi berubah: broadcast ke semua window
 *     remoteClient.onConnectionChange(({ connected }) => {
 *       broadcastToAllWindows("remote:connection-changed", { connected });
 *     });
 *   }
 *
 *   function stopRemoteClient() {
 *     remoteClient.stop();
 *   }
 *
 *   function broadcastToAllWindows(channel, data) {
 *     const { BrowserWindow } = require("electron");
 *     BrowserWindow.getAllWindows().forEach(win => {
 *       if (!win.isDestroyed()) win.webContents.send(channel, data);
 *     });
 *   }
 *
 *
 * LANGKAH 4: Tambahkan IPC handlers untuk renderer (tambahkan bersama handler lain)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // Ambil daftar client online
 *   ipcMain.handle("remote:get-clients", () => {
 *     return {
 *       clients:   remoteClient.onlineClients,
 *       clientId:  remoteClient.clientId,
 *       connected: remoteClient.isConnected,
 *     };
 *   });
 *
 *   // Refresh daftar client
 *   ipcMain.on("remote:refresh-clients", () => {
 *     remoteClient.refreshClients();
 *   });
 *
 *   // Kirim command ke client target
 *   ipcMain.handle("remote:send-command", async (_, { toClientId, command, payload }) => {
 *     try {
 *       const result = await remoteClient.sendCommand(toClientId, command, payload);
 *       return { success: true, ...result };
 *     } catch (err) {
 *       return { success: false, error: err.message };
 *     }
 *   });
 *
 *
 * LANGKAH 5: Stop saat logout (tambahkan di ipcMain.handle("auth-logout"))
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   stopRemoteClient();
 *
 *
 * LANGKAH 6: Tambahkan ke preload.cjs
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   remote: {
 *     getClients:    ()               => ipcRenderer.invoke("remote:get-clients"),
 *     refreshClients: ()              => ipcRenderer.send("remote:refresh-clients"),
 *     sendCommand:   (toClientId, command, payload) =>
 *                      ipcRenderer.invoke("remote:send-command", { toClientId, command, payload }),
 *     onClientsUpdated:     (cb) => ipcRenderer.on("remote:clients-updated",     (_, d) => cb(d)),
 *     onConnectionChanged:  (cb) => ipcRenderer.on("remote:connection-changed",  (_, d) => cb(d)),
 *   },
 *
 */

// File ini hanya dokumentasi, tidak di-require langsung.
module.exports = {};
