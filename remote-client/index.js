"use strict";

/**
 * Entry point modul Remote Client untuk Electron.
 *
 * Cara integrasi ke electron-main.js:
 *
 *   const RemoteClient = require("./remote-client");
 *   const remoteClient = new RemoteClient();
 *
 *   // Setelah user login:
 *   remoteClient.start({
 *     token: authSession.token,
 *     deviceWindows,
 *     getDeviceConfig,
 *     dbPath: DB_PATH,
 *     dbPathAndroid: DB_PATH_ANDROID,
 *   });
 *
 *   // Saat user logout:
 *   remoteClient.stop();
 *
 *   // Dari IPC renderer – kirim command ke client lain:
 *   ipcMain.handle("remote:send-command", async (_, { toClientId, command, payload }) => {
 *     return remoteClient.sendCommand(toClientId, command, payload);
 *   });
 */

const RemoteSocketClient = require("./socket-client");
const ElectronBridge     = require("./electron-bridge");
const { dispatchCommand } = require("./command-handlers");
const logger = require("./utils/logger");
const os     = require("os");
const { v4: uuidv4 } = require("uuid");

class RemoteClient {
  constructor() {
    this.socketClient = null;
    this.bridge       = null;
    this.started      = false;

    /** clientId stabil: dibuat sekali dan dipakai ulang setiap start() */
    const hostname = os.hostname().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
    this._stableClientId = `starbox-${hostname}-${uuidv4().slice(0, 8)}`;

    /** Daftar client online milik user yang sama (dikembalikan dari server) */
    this.onlineClients = [];
    this._selfConnectedAt = null;
    this._appVersion = "1.0.0";

    /** Callback untuk notifikasi ke renderer */
    this._onClientsChange = null;
    this._onConnectionChange = null;
  }

  _buildSelfClientEntry() {
    const clientId = this.clientId || this._stableClientId;
    return {
      client_id: clientId,
      hostname: os.hostname(),
      platform: process.platform,
      app_version: this._appVersion,
      status: this.isConnected ? "online" : "offline",
      connected_at: this._selfConnectedAt || new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
    };
  }

  _withSelfClient(clients = []) {
    const list = Array.isArray(clients) ? [...clients] : [];
    const self = this._buildSelfClientEntry();
    const index = list.findIndex((c) => c?.client_id === self.client_id);

    if (index === -1) {
      list.unshift(self);
    } else {
      list[index] = { ...list[index], ...self };
    }

    return list;
  }

  /**
   * Mulai remote client setelah user login.
   *
   * @param {object} opts
   * @param {string}   opts.token           - JWT Bearer token
   * @param {string}   opts.appVersion      - versi aplikasi
   * @param {object}   opts.deviceWindows   - Map uid -> BrowserWindow
   * @param {Function} opts.getDeviceConfig - async (uid) -> device
   * @param {string}   opts.dbPath          - path devices.json
   * @param {string}   opts.dbPathAndroid   - path devices-android.json
   * @param {object}   opts.ipcHandlers     - { [channel]: handler } untuk bridge.ipc.invoke
   */
  start(opts) {
    if (this.started) {
      logger.warn("[RemoteClient] Sudah berjalan, stop dulu sebelum start ulang");
      this.stop();
    }

    const { token, appVersion, serverUrl, deviceWindows, getDeviceConfig, dbPath, dbPathAndroid, ipcHandlers } = opts;
    this._appVersion = appVersion || "1.0.0";

    // Inisialisasi bridge
    this.bridge = new ElectronBridge({
      deviceWindows,
      ipcMain: null, // tidak digunakan langsung
      getDeviceConfig,
      dbPath,
      dbPathAndroid,
    });

    if (ipcHandlers) {
      this.bridge.registerIpcHandlers(ipcHandlers);
    }

    // Inisialisasi socket client
    this.socketClient = new RemoteSocketClient({
      token,
      appVersion,
      serverUrl,
      clientId: this._stableClientId,

      // Token expired/invalid di server — minta parent refresh token
      onAuthInvalid: (errorCode) => {
        logger.warn(`[RemoteClient] Auth invalid (${errorCode}) — meminta refresh token...`);
        if (this._onAuthInvalid) this._onAuthInvalid(errorCode);
      },

      // Terima dan dispatch command dari client lain
      onCommand: async ({ command, payload, fromClientId }) => {
        logger.info(`[RemoteClient] Terima command '${command}' dari ${fromClientId}`);
        return dispatchCommand(command, payload, this.bridge);
      },

      // Update daftar client online
      onClientsUpdate: (update) => {
        if (update.type === "list") {
          this.onlineClients = update.clients;
        } else if (update.type === "online") {
          const exists = this.onlineClients.find((c) => c.client_id === update.client.client_id);
          if (!exists) this.onlineClients.push(update.client);
        } else if (update.type === "offline") {
          this.onlineClients = this.onlineClients.filter((c) => c.client_id !== update.clientId);
        }
        this.onlineClients = this._withSelfClient(this.onlineClients);
        if (this._onClientsChange) {
          this._onClientsChange(this.onlineClients);
        }
      },

      // Perubahan status koneksi
      onConnectChange: (connected) => {
        // started = false hanya saat stop() dipanggil secara eksplisit.
        // Auth error ditangani via onAuthInvalid — jangan hentikan permanen di sini.
        if (connected && !this._selfConnectedAt) {
          this._selfConnectedAt = new Date().toISOString();
        }
        this.onlineClients = this._withSelfClient(this.onlineClients);
        if (this._onClientsChange) {
          this._onClientsChange(this.onlineClients);
        }
        if (this._onConnectionChange) {
          this._onConnectionChange({ connected });
        }
      },
    });

    this.socketClient.connect();
    this.started = true;
    this.onlineClients = this._withSelfClient(this.onlineClients);
    logger.info(`[RemoteClient] Started dengan client_id: ${this.socketClient.clientId}`);
  }

  /** Hentikan remote client (misal saat logout) */
  stop() {
    if (this.socketClient) {
      this.socketClient.disconnect();
      this.socketClient = null;
    }
    this.bridge      = null;
    this.started     = false;
    this.onlineClients = [];
    this._selfConnectedAt = null;
    logger.info("[RemoteClient] Stopped");
  }

  /**
   * Kirim command ke client target dan tunggu hasilnya.
   * @param {string} toClientId
   * @param {string} command
   * @param {object} payload
   * @returns {Promise<{status, result, duration}>}
   */
  async sendCommand(toClientId, command, payload = {}) {
    if (!this.socketClient) {
      throw new Error("Remote client belum dimulai. Login dulu.");
    }
    if (!this.socketClient.connected) {
      throw new Error("Tidak terhubung ke remote server. Mohon tunggu reconnect.");
    }
    return this.socketClient.sendCommand(toClientId, command, payload);
  }

  /**
   * Kirim command tanpa menunggu response (untuk event high-frequency).
   * @param {string} toClientId
   * @param {string} command
   * @param {object} payload
   */
  fireCommand(toClientId, command, payload = {}) {
    if (!this.socketClient) return;
    if (!this.socketClient.connected) return;
    this.socketClient.fireCommand(toClientId, command, payload);
  }

  /**
   * Sinkronkan token baru (hasil refresh) ke koneksi remote aktif.
   * @param {string} token
   */
  updateToken(token) {
    if (!token || !this.socketClient) return;
    this.socketClient.updateToken(token);
  }

  /** Refresh daftar client online */
  refreshClients() {
    if (this.socketClient) {
      this.socketClient.refreshClients();
    }
  }

  /** Daftarkan callback saat daftar client berubah */
  onClientsChange(fn) {
    this._onClientsChange = fn;
  }

  /** Daftarkan callback saat status koneksi berubah */
  onConnectionChange(fn) {
    this._onConnectionChange = fn;
  }

  /** Daftarkan callback saat server menolak token (AUTH_INVALID) */
  onAuthInvalid(fn) {
    this._onAuthInvalid = fn;
  }

  /** Ambil client_id lokal */
  get clientId() {
    return this.socketClient?.clientId || null;
  }

  /** Cek status koneksi */
  get isConnected() {
    return !!(this.socketClient?.connected);
  }
}

module.exports = RemoteClient;
