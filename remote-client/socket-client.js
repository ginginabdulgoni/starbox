"use strict";

/**
 * Socket.IO client untuk Electron main process.
 * Mengelola koneksi ke Remote Server, reconnect otomatis,
 * dan event routing ke handler yang tepat.
 */

const { io }    = require("socket.io-client");
const { v4: uuidv4 } = require("uuid");
const os        = require("os");
const logger    = require("./utils/logger");

const DEFAULT_REMOTE_URL = process.env.STARBOX_REMOTE_URL || "https://starbox.weagate.com:4200";

class RemoteSocketClient {
  constructor({ token, appVersion, serverUrl, clientId, onCommand, onClientsUpdate, onConnectChange, onAuthInvalid }) {
    /** @type {import("socket.io-client").Socket|null} */
    this.socket       = null;
    this.token        = token;
    this.serverUrl    = serverUrl || DEFAULT_REMOTE_URL;
    this.appVersion   = appVersion || "1.0.0";
    this.clientId     = clientId || this._generateClientId();
    this.connected    = false;

    /** Map pendingRequests: commandId -> { resolve, reject, timeoutHandle } */
    this.pendingRequests = new Map();

    // Callbacks ke layer atas
    this.onCommand       = onCommand       || (() => {});
    this.onClientsUpdate = onClientsUpdate || (() => {});
    this.onConnectChange = onConnectChange || (() => {});
    this.onAuthInvalid   = onAuthInvalid   || (() => {});
  }

  /**
   * Buat client_id yang persisten per instance (gabung hostname + random).
   * Dalam real implementation sebaiknya disimpan ke electron-store.
   */
  _generateClientId() {
    const hostname = os.hostname().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
    return `starbox-${hostname}-${uuidv4().slice(0, 8)}`;
  }

  /** Mulai koneksi ke server */
  connect() {
    if (this.socket) {
      logger.warn("[RemoteClient] Sudah terhubung, skip connect");
      return;
    }

    logger.info(`[RemoteClient] Connecting ke ${this.serverUrl} sebagai ${this.clientId}`);

    this._authMeta = {
      client_id:   this.clientId,
      hostname:    os.hostname(),
      platform:    process.platform,
      app_version: this.appVersion,
    };

    this.socket = io(this.serverUrl, {
      auth: {
        // Kirim token hanya jika ada — tanpa token = guest mode
        ...(this.token ? { token: `Bearer ${this.token}` } : {}),
        meta: this._authMeta,
      },
      reconnection:         true,
      reconnectionAttempts: Infinity,
      reconnectionDelay:    800,
      reconnectionDelayMax: 5000,
      randomizationFactor:  0.3,
      transports: ["websocket"],
      timeout:    10000,
    });

    this._attachEvents();
    this._startHeartbeat();
  }

  /** Disconnect dari server */
  disconnect() {
    this._stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  /** Update token (dipanggil saat user login/refresh) */
  updateToken(newToken) {
    if (!newToken || typeof newToken !== "string") return;
    if (newToken === this.token) return;

    this.token = newToken;

    if (!this.socket) return;

    // Update auth pada socket instance yang sama (tanpa destroy) — lebih cepat
    this.socket.auth = { token: `Bearer ${newToken}`, meta: this._authMeta || {} };

    // Pastikan reconnection aktif kembali (mungkin dimatikan saat AUTH_INVALID)
    this.socket.io.reconnection(true);

    if (this.socket.connected) {
      // Reconnect instan dengan token baru — tidak buat socket baru
      this.socket.disconnect();
      this.socket.connect();
    } else {
      // Socket sedang disconnected (misal setelah AUTH_INVALID) — connect langsung
      this.socket.connect();
    }
  }

  // ─── Event Handlers ──────────────────────────────────────────────────────

  _attachEvents() {
    const s = this.socket;

    s.on("connect", () => {
      this.connected = true;
      logger.info(`[RemoteClient] Connected: ${s.id}`);
      this.onConnectChange(true);
    });

    s.on("disconnect", (reason) => {
      this.connected = false;
      logger.warn(`[RemoteClient] Disconnected: ${reason}`);
      this.onConnectChange(false);

      // Jika server memutus koneksi secara paksa, Socket.IO tidak auto-reconnect.
      // Trigger connect() manual agar status remote pulih tanpa perlu reopen app/window.
      if (reason === "io server disconnect") {
        setTimeout(() => {
          if (this.socket && !this.socket.connected) {
            logger.warn("[RemoteClient] Reconnecting after server disconnect...");
            this.socket.connect();
          }
        }, 1500);
      }
    });

    s.on("connect_error", (err) => {
      logger.error(`[RemoteClient] Connection error: ${err.message}`);
      this.connected = false;
      if (err.message === "AUTH_INVALID" && this.token) {
        // Hentikan auto-reconnect sementara, minta parent refresh token (hanya jika ada token)
        logger.warn(`[RemoteClient] Auth error — meminta refresh token, reconnect setelah token baru`);
        s.io.reconnection(false);
        s.disconnect();
        this.onConnectChange(false);
        this.onAuthInvalid(err.message);  // parent akan refresh token lalu panggil updateToken()
      } else {
        this.onConnectChange(false, err.message || "CONNECT_ERROR");
      }
    });

    s.on("reconnect", (attempt) => {
      logger.info(`[RemoteClient] Reconnected setelah ${attempt} percobaan`);
    });

    s.on("reconnect_error", (err) => {
      logger.warn(`[RemoteClient] Reconnect error: ${err.message}`);
    });

    // Daftar client online milik user yang sama
    s.on("clients:list", (data) => {
      logger.info(`[RemoteClient] Clients list: ${data.clients?.length || 0} client`);
      this.onClientsUpdate({ type: "list", clients: data.clients || [] });
    });

    // Notifikasi ada client baru online
    s.on("client:online", (data) => {
      logger.info(`[RemoteClient] Client online: ${data.client_id}`);
      this.onClientsUpdate({ type: "online", client: data });
      // Refresh daftar
      s.emit("clients:refresh");
    });

    // Notifikasi ada client offline
    s.on("client:offline", (data) => {
      logger.info(`[RemoteClient] Client offline: ${data.client_id}`);
      this.onClientsUpdate({ type: "offline", clientId: data.client_id });
    });

    // Terima command dari client lain
    s.on("command:execute", async (data) => {
      const { command_id, from_client_id, command, payload, response_required } = data;
      logger.info(`[RemoteClient] Execute command '${command}' (${command_id}) dari ${from_client_id}`);

      let status = "success";
      let result = null;
      let error  = null;

      try {
        result = await this.onCommand({ command, payload: payload || {}, fromClientId: from_client_id });
      } catch (err) {
        status = "failed";
        error  = err.message || "Unknown error";
        logger.error(`[RemoteClient] Command '${command}' gagal:`, err.message);
      }

      if (response_required === false) {
        return;
      }

      s.emit("command:response", { command_id, status, result, error });
    });

    // Terima hasil command yang kita kirim ke client lain
    s.on("command:result", (data) => {
      const { command_id, status, result, error, duration } = data;
      const pending = this.pendingRequests.get(command_id);
      if (!pending) return;

      clearTimeout(pending.timeoutHandle);
      this.pendingRequests.delete(command_id);

      if (status === "success") {
        pending.resolve({ status, result, duration });
      } else {
        pending.reject(Object.assign(new Error(error || status), { status, result }));
      }
    });

    // Error dari server (sebelum command diteruskan)
    s.on("command:error", (data) => {
      logger.error(`[RemoteClient] Command error dari server: ${data.error} - ${data.message}`);

      if (!data?.command_id) return;
      const pending = this.pendingRequests.get(data.command_id);
      if (!pending) return;

      clearTimeout(pending.timeoutHandle);
      this.pendingRequests.delete(data.command_id);
      pending.reject(Object.assign(new Error(data.message || data.error || "Command error"), {
        status: data.error || "error",
      }));
    });

    // Heartbeat ack
    s.on("heartbeat:ack", (data) => {
      logger.debug(`[RemoteClient] Heartbeat ack: ${data.timestamp}`);
    });
  }

  // ─── Heartbeat ───────────────────────────────────────────────────────────

  _startHeartbeat() {
    const interval = parseInt(process.env.HEARTBEAT_INTERVAL_MS || "30000", 10);
    this._heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("heartbeat");
      }
    }, interval);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Kirim command ke client target dan tunggu hasilnya (Promise).
   * @param {string} toClientId
   * @param {string} command
   * @param {object} payload
   * @param {number} timeoutMs
   * @returns {Promise<{status, result, duration}>}
   */
  sendCommand(toClientId, command, payload = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        return reject(new Error("Tidak terhubung ke remote server"));
      }

      const commandId = uuidv4();

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(commandId);
        reject(new Error(`Command '${command}' timeout setelah ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(commandId, { resolve, reject, timeoutHandle });

      this.socket.emit("command:request", {
        command_id: commandId,
        to_client_id: toClientId,
        command,
        payload,
      });
    });
  }

  /** Minta refresh daftar client online */
  refreshClients() {
    if (this.socket?.connected) {
      this.socket.emit("clients:refresh");
    }
  }

  /** Kirim command tanpa menunggu response (fire-and-forget) */
  fireCommand(toClientId, command, payload = {}) {
    if (!this.socket?.connected) return;
    this.socket.emit("command:request", {
      command_id: uuidv4(),
      to_client_id: toClientId,
      command,
      payload,
      fire_and_forget: true,
    });
  }
}

module.exports = RemoteSocketClient;
