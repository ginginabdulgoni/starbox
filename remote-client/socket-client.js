"use strict";

/**
 * Socket.IO client untuk Electron main process.
 * Mengelola koneksi ke Remote Server, reconnect otomatis,
 * dan event routing ke handler yang tepat.
 */

const { io }    = require("socket.io-client");
const { v4: uuidv4 } = require("uuid");
const os        = require("os");
const net       = require("net");
const logger    = require("./utils/logger");

// ssh2 opsional — hanya digunakan untuk relay lokal. Sejak Remox jadi modul,
// ssh2 disediakan modul Remox lewat setSshClientResolver() (lihat electron-main.js).
let resolveSshClient = () => {
  try { return require("ssh2").Client; } catch (_) { return null; }
};

const DEFAULT_REMOTE_URL = process.env.STARBOX_REMOTE_URL || "https://starbox.weagate.com:4200";

// sessionId -> { type, stream|socket, sshClient? }
const relaySessions = new Map();

// tunnelId -> net.Socket (TCP connection to MikroTik:8291)
const winboxTcpSessions = new Map();

class RemoteSocketClient {
  constructor({ token, appVersion, serverUrl, clientId, onCommand, onClientsUpdate, onConnectChange, onAuthInvalid, onGetMikrotikDevices }) {
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
    this.onCommand             = onCommand             || (() => {});
    this.onClientsUpdate       = onClientsUpdate       || (() => {});
    this.onConnectChange       = onConnectChange       || (() => {});
    this.onAuthInvalid         = onAuthInvalid         || (() => {});
    this.onGetMikrotikDevices  = onGetMikrotikDevices  || null;
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
      // Kirim daftar MikroTik devices ke server agar registry ter-update
      if (typeof this.onGetMikrotikDevices === "function") {
        try {
          const devices = this.onGetMikrotikDevices();
          if (Array.isArray(devices) && devices.length > 0) {
            s.emit("mikrotik:devices-register", {
              devices,
              hostname: os.hostname(),
              platform: process.platform,
            });
          }
        } catch (_) {}
      }
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

    // ── Remox Relay: buka SSH/Telnet lokal atas permintaan server ────────────
    s.on("remox:relay-connect", async ({ sessionId, browserSocketId, conn, cols = 80, rows = 24 }) => {
      if (!sessionId || !conn?.host) return;

      const sendData   = (d) => s.emit("remox:relay-data",   { sessionId, data: d });
      const sendStatus = (status, message = "") => s.emit("remox:relay-status", { sessionId, status, message });
      const closeSession = () => {
        const sess = relaySessions.get(sessionId);
        if (!sess) return;
        try {
          if (sess.type === "ssh")    { sess.stream?.close?.(); sess.sshClient?.end(); }
          if (sess.type === "telnet") { sess.tcpSocket?.destroy(); }
        } catch (_) {}
        relaySessions.delete(sessionId);
      };

      closeSession(); // tutup sesi lama jika ada
      logger.info(`[RemoxRelay] Membuka ${conn.type} ke ${conn.host}:${conn.port}`);

      // ── SSH ────────────────────────────────────────────────────────────────
      if (conn.type === "ssh") {
        const SshClient = resolveSshClient();
        if (!SshClient) {
          return sendStatus("error", "Modul Remox belum terpasang di StarBox ini (dibutuhkan untuk SSH).");
        }
        const ssh = new SshClient();

        ssh.on("ready", () => {
          ssh.shell({ term: "xterm-256color", cols, rows }, (err, stream) => {
            if (err) { sendStatus("error", err.message); ssh.end(); return; }

            relaySessions.set(sessionId, { type: "ssh", stream, sshClient: ssh });
            sendStatus("connected");

            stream.on("data",  (d) => sendData(d.toString("binary")));
            stream.stderr.on("data", (d) => sendData(d.toString("binary")));
            stream.on("close", () => { sendStatus("disconnected"); closeSession(); });
          });
        });

        ssh.on("error", (err) => {
          logger.warn(`[RemoxRelay] SSH error ${sessionId}: ${err.message}`);
          sendStatus("error", err.message);
          closeSession();
        });

        const sshConfig = {
          host: conn.host, port: conn.port || 22,
          username: conn.username || "root",
          readyTimeout: 15000, keepaliveInterval: 30000,
        };
        if (conn.privateKey?.trim()) {
          sshConfig.privateKey = conn.privateKey;
          if (conn.password) sshConfig.passphrase = conn.password;
        } else if (conn.password) {
          sshConfig.password = conn.password;
        }

        ssh.connect(sshConfig);
        return;
      }

      // ── Telnet ────────────────────────────────────────────────────────────
      if (conn.type === "telnet") {
        const tcpSocket = net.createConnection({ host: conn.host, port: conn.port || 23 }, () => {
          relaySessions.set(sessionId, { type: "telnet", tcpSocket });
          sendStatus("connected");
        });
        tcpSocket.on("data",  (d) => sendData(d.toString("binary")));
        tcpSocket.on("close", () => { sendStatus("disconnected"); closeSession(); });
        tcpSocket.on("error", (err) => { sendStatus("error", err.message); closeSession(); });
        return;
      }

      sendStatus("error", `Tipe ${conn.type} tidak didukung via relay lokal.`);
    });

    // ── Relay: input dari browser (forwarded oleh server) ───────────────────
    s.on("remox:relay-input", ({ sessionId, data }) => {
      const sess = relaySessions.get(sessionId);
      if (!sess) return;
      try {
        if (sess.type === "ssh")    sess.stream.write(Buffer.from(data, "binary"));
        if (sess.type === "telnet") sess.tcpSocket.write(Buffer.from(data, "binary"));
      } catch (_) {}
    });

    // ── Relay: resize terminal ───────────────────────────────────────────────
    s.on("remox:relay-resize", ({ sessionId, cols, rows }) => {
      const sess = relaySessions.get(sessionId);
      if (sess?.type === "ssh") {
        try { sess.stream.setWindow(rows, cols, 0, 0); } catch (_) {}
      }
    });

    // ── Relay: browser disconnect ────────────────────────────────────────────
    s.on("remox:relay-disconnect", ({ sessionId }) => {
      const sess = relaySessions.get(sessionId);
      if (sess) {
        try {
          if (sess.type === "ssh")    { sess.stream?.close?.(); sess.sshClient?.end(); }
          if (sess.type === "telnet") { sess.tcpSocket?.destroy(); }
        } catch (_) {}
        relaySessions.delete(sessionId);
      }
    });

    // ── MikroTik Relay: HTTP proxy request dari server ───────────────────────
    s.on("mikrotik:relay-proxy-request", async ({ reqId, url, method = "GET", headers = {}, body = null }) => {
      if (!reqId || !url) return;

      // Validasi URL — hanya izinkan HTTP/HTTPS ke IP/host lokal
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Protocol not allowed");
      } catch (err) {
        return s.emit("mikrotik:relay-proxy-response", {
          reqId, ok: false, status: 400, body: `Invalid URL: ${err.message}`,
        });
      }

      logger.info(`[MikroTikRelay] Fetching ${method} ${url}`);

      try {
        const nodeFetch = (() => {
          try { return require("node-fetch"); } catch (_) { return fetch; }
        })();
        const https = require("https");
        const fetchOpts = {
          method,
          headers: { ...headers },
          body: body && method !== "GET" && method !== "HEAD" ? body : undefined,
          redirect: "follow",
          timeout: 15000,
          ...(parsedUrl.protocol === "https:" ? { agent: new https.Agent({ rejectUnauthorized: false }) } : {}),
        };
        const resp = await nodeFetch(url, fetchOpts);
        const respBody = await resp.text();
        const respHeaders = {};
        resp.headers.forEach((v, k) => { respHeaders[k] = v; });

        s.emit("mikrotik:relay-proxy-response", {
          reqId,
          ok:      resp.ok,
          status:  resp.status,
          headers: respHeaders,
          body:    respBody,
        });
      } catch (err) {
        logger.warn(`[MikroTikRelay] Proxy fetch gagal (${url}): ${err.message}`);
        s.emit("mikrotik:relay-proxy-response", {
          reqId, ok: false, status: 502, body: `Fetch error: ${err.message}`,
        });
      }
    });

    // ── MikroTik Winbox TCP Relay ────────────────────────────────────────────
    // Server meminta agent membuka koneksi TCP ke MikroTik:8291
    s.on("mikrotik:relay-winbox-open", ({ tunnelId, host, port }) => {
      if (!tunnelId || !host) return;

      // Tutup sesi lama jika ada
      const existing = winboxTcpSessions.get(tunnelId);
      if (existing) { try { existing.destroy(); } catch (_) {} winboxTcpSessions.delete(tunnelId); }

      logger.info(`[WinboxRelay] Membuka TCP ke ${host}:${port || 8291} (${tunnelId})`);

      const tcpSock = net.createConnection({ host, port: port || 8291 }, () => {
        winboxTcpSessions.set(tunnelId, tcpSock);
        s.emit("mikrotik:relay-winbox-status", { tunnelId, status: "connected" });
        logger.info(`[WinboxRelay] TCP connected ${tunnelId}`);
      });

      tcpSock.on("data", (data) => {
        // Forward data MikroTik → relay → Winbox app (base64 agar aman di JSON)
        s.emit("mikrotik:relay-winbox-data", { tunnelId, data: data.toString("base64") });
      });

      tcpSock.on("close", () => {
        s.emit("mikrotik:relay-winbox-closed", { tunnelId });
        winboxTcpSessions.delete(tunnelId);
        logger.info(`[WinboxRelay] TCP closed ${tunnelId}`);
      });

      tcpSock.on("error", (err) => {
        logger.warn(`[WinboxRelay] TCP error ${tunnelId}: ${err.message}`);
        s.emit("mikrotik:relay-winbox-status", { tunnelId, status: "error", message: err.message });
        winboxTcpSessions.delete(tunnelId);
      });

      tcpSock.setTimeout(30000);
      tcpSock.on("timeout", () => {
        logger.warn(`[WinboxRelay] TCP timeout ${tunnelId}`);
        tcpSock.destroy();
      });
    });

    // Data dari Winbox app (via relay) → forward ke MikroTik TCP socket
    s.on("mikrotik:relay-winbox-data", ({ tunnelId, data }) => {
      const sock = winboxTcpSessions.get(tunnelId);
      if (sock && !sock.destroyed) {
        try { sock.write(Buffer.from(data, "base64")); } catch (_) {}
      }
    });

    // Viewer menutup tunnel — agent juga close TCP
    s.on("mikrotik:relay-winbox-close", ({ tunnelId }) => {
      const sock = winboxTcpSessions.get(tunnelId);
      if (sock) { try { sock.destroy(); } catch (_) {} winboxTcpSessions.delete(tunnelId); }
      logger.info(`[WinboxRelay] Tunnel ${tunnelId} ditutup oleh viewer`);
    });

    // ── MikroTik Relay: server minta buka Web UI MikroTik lokal ─────────────
    s.on("mikrotik:relay-open-webui", async ({ reqId, host, webPort, name }) => {
      if (!host) return;
      logger.info(`[MikroTikRelay] Open WebUI ${host}:${webPort || 80}`);
      try {
        // Dispatch via onCommand → command-handlers/mikrotik-commands.js
        await this.onCommand({
          command: "mikrotik_open_webui",
          payload: { host, webPort, name },
          fromClientId: "relay-server",
        });
        s.emit("mikrotik:relay-open-webui-ack", { reqId, ok: true });
      } catch (err) {
        logger.warn(`[MikroTikRelay] Open WebUI gagal: ${err.message}`);
        s.emit("mikrotik:relay-open-webui-ack", { reqId, ok: false, message: err.message });
      }
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

RemoteSocketClient.setSshClientResolver = (fn) => {
  if (typeof fn === "function") resolveSshClient = fn;
};

module.exports = RemoteSocketClient;
