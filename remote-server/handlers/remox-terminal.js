"use strict";

/**
 * remox-terminal.js
 *
 * WebSocket-based SSH / Telnet terminal handler untuk browser.
 *
 * Flow (mode public):
 *  1. Browser kirim `remox:web-connect` { sessionId, terminalToken, cols, rows }
 *  2. Server redeem token → buka SSH langsung → relay data ke browser
 *
 * Flow (mode local relay):
 *  1. Browser kirim `remox:web-connect-via-client` { sessionId, terminalToken, targetClientId, cols, rows }
 *  2. Server redeem token → forward `remox:relay-connect` ke StarBox target
 *  3. StarBox buka SSH lokal, kirim balik `remox:relay-status` / `remox:relay-data`
 *  4. Server forward ke browser sebagai `remox:web-status` / `remox:web-data`
 */

const net    = require("net");
const { Client: SshClient } = require("ssh2");
const fetch  = require("node-fetch");
const config = require("../config");
const logger = require("../utils/logger");

// ── State maps (module-level = shared across all sockets) ──────────────────
// Mode public: sessionId -> { type, socketId, stream|tcpSocket, sshClient? }
const webSessions = new Map();

// Mode relay: sessionId -> browserSocketId  (untuk arahkan status/data kembali ke browser)
const relayBrowserMap = new Map();
// Mode relay: sessionId -> starboxSocketId  (untuk forward input/resize/disconnect ke StarBox)
const relayStarBoxMap = new Map();

// ── Token redemption ────────────────────────────────────────────────────────
async function redeemToken(terminalToken) {
  const url = `${config.STARBOX_API_BASE}/remox/terminal/redeem`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "StarBox-RemoteServer/1.0" },
    body: JSON.stringify({ token: terminalToken }),
    timeout: 8000,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Token tidak valid (HTTP ${res.status}): ${txt.slice(0, 80)}`);
  }
  return res.json(); // { via, target_client_id, conn: { type, host, port, username, password, privateKey } }
}

// ── Close public session ────────────────────────────────────────────────────
function closeWebSession(sessionId) {
  const s = webSessions.get(sessionId);
  if (!s) return;
  try {
    if (s.type === "ssh")    { s.stream?.close?.(); s.sshClient?.end(); }
    if (s.type === "telnet") { s.tcpSocket?.destroy(); }
  } catch (_) {}
  webSessions.delete(sessionId);
  logger.info(`[RemoxWeb] Session ${sessionId} ditutup`);
}

/**
 * Attach handler ke socket.io socket.
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 * @param {Map<string, import("socket.io").Socket>} [clientSocketMap] - clientId -> socket
 */
function attachRemoxWebTerminal(io, socket, clientSocketMap) {

  // ── Mode public: server buka SSH langsung ──────────────────────────────────
  socket.on("remox:web-connect", async ({ sessionId, terminalToken, cols = 80, rows = 24 }) => {
    if (!sessionId || !terminalToken) return;

    closeWebSession(sessionId);

    const sendData   = (d) => socket.emit("remox:web-data",   { sessionId, data: d });
    const sendStatus = (status, message = "") =>
      socket.emit("remox:web-status", { sessionId, status, message });

    let conn;
    try {
      const result = await redeemToken(terminalToken);
      conn = result.conn;
      if (!conn?.host) throw new Error("Detail koneksi tidak lengkap");
    } catch (err) {
      logger.warn(`[RemoxWeb] Redeem token gagal: ${err.message}`);
      return sendStatus("error", err.message);
    }

    sendStatus("connecting");
    logger.info(`[RemoxWeb] ${socket.id} → ${conn.type}://${conn.host}:${conn.port}`);

    if (conn.type === "ssh") {
      const ssh = new SshClient();

      ssh.on("ready", () => {
        ssh.shell({ term: "xterm-256color", cols, rows }, (err, stream) => {
          if (err) { sendStatus("error", err.message); ssh.end(); return; }

          webSessions.set(sessionId, { type: "ssh", socketId: socket.id, stream, sshClient: ssh });
          sendStatus("connected");

          stream.on("data",  (d) => sendData(d.toString("binary")));
          stream.stderr.on("data", (d) => sendData(d.toString("binary")));
          stream.on("close", () => {
            sendStatus("disconnected");
            closeWebSession(sessionId);
          });
        });
      });

      ssh.on("error", (err) => {
        logger.warn(`[RemoxWeb] SSH error ${sessionId}: ${err.message}`);
        sendStatus("error", err.message);
        closeWebSession(sessionId);
      });

      const sshConfig = {
        host:     conn.host,
        port:     conn.port || 22,
        username: conn.username || "root",
        readyTimeout: 15000,
        keepaliveInterval: 30000,
      };
      if (conn.privateKey && conn.privateKey.trim()) {
        sshConfig.privateKey = conn.privateKey;
        if (conn.password) sshConfig.passphrase = conn.password;
      } else if (conn.password) {
        sshConfig.password = conn.password;
      }

      ssh.connect(sshConfig);
      return;
    }

    if (conn.type === "telnet") {
      const tcpSocket = net.createConnection({ host: conn.host, port: conn.port || 23 }, () => {
        webSessions.set(sessionId, { type: "telnet", socketId: socket.id, tcpSocket });
        sendStatus("connected");
      });
      tcpSocket.on("data",  (d) => sendData(d.toString("binary")));
      tcpSocket.on("close", () => { sendStatus("disconnected"); closeWebSession(sessionId); });
      tcpSocket.on("error", (err) => { sendStatus("error", err.message); closeWebSession(sessionId); });
      return;
    }

    sendStatus("error", "Tipe RDP tidak didukung via web terminal. Gunakan aplikasi desktop StarBox.");
  });

  // ── Mode relay: browser minta SSH via StarBox Lokal ─────────────────────────
  socket.on("remox:web-connect-via-client", async ({ sessionId, terminalToken, targetClientId, cols = 80, rows = 24 }) => {
    if (!sessionId || !terminalToken || !targetClientId) return;

    const sendStatus = (status, message = "") =>
      socket.emit("remox:web-status", { sessionId, status, message });

    // Redeem token
    let conn;
    try {
      const result = await redeemToken(terminalToken);
      if (result.via !== "local") {
        return sendStatus("error", "Token bukan untuk mode lokal.");
      }
      conn = result.conn;
      if (!conn?.host) throw new Error("Detail koneksi tidak lengkap");
    } catch (err) {
      logger.warn(`[RemoxRelay] Redeem token gagal: ${err.message}`);
      return sendStatus("error", err.message);
    }

    // Cari StarBox socket
    const targetSocket = clientSocketMap?.get(targetClientId);
    if (!targetSocket || !targetSocket.connected) {
      return sendStatus("error",
        `StarBox Lokal (${targetClientId.slice(0, 16)}…) tidak ditemukan atau offline. ` +
        `Pastikan aplikasi StarBox berjalan dan terhubung internet.`
      );
    }

    // Simpan mapping dua arah
    relayBrowserMap.set(sessionId, socket.id);        // sessionId → browser socket id
    relayStarBoxMap.set(sessionId, targetSocket.id);  // sessionId → starbox socket id

    sendStatus("connecting");
    logger.info(`[RemoxRelay] ${socket.id} → StarBox ${targetClientId} (${targetSocket.id}) → ${conn.host}:${conn.port}`);

    // Timeout: jika StarBox tidak respond dalam 20 detik, kirim error ke browser
    const timeoutHandle = setTimeout(() => {
      if (!relayBrowserMap.has(sessionId)) return; // sudah resolved
      relayBrowserMap.delete(sessionId);
      relayStarBoxMap.delete(sessionId);
      sendStatus("error", "StarBox Lokal tidak merespons (timeout 20 detik). Pastikan aplikasi berjalan.");
    }, 20000);

    // Simpan timeoutHandle agar bisa di-clear saat connected/error
    relayBrowserMap.set(sessionId, { socketId: socket.id, timeoutHandle });

    // Forward ke StarBox
    targetSocket.emit("remox:relay-connect", {
      sessionId,
      conn: {
        type:       conn.type,
        host:       conn.host,
        port:       conn.port,
        username:   conn.username,
        password:   conn.password,
        privateKey: conn.privateKey,
      },
      cols,
      rows,
    });
  });

  // ── StarBox → server: status relay (connected/error/disconnected) ──────────
  // Ini diterima dari StarBox socket, di-forward ke browser socket
  socket.on("remox:relay-status", ({ sessionId, status, message }) => {
    const entry = relayBrowserMap.get(sessionId);
    if (!entry) return;

    // Hanya clear timeout jika status sudah final (connected/error/disconnected).
    // Jika status masih "connecting", timeout harus tetap aktif agar browser tidak stuck selamanya.
    const isFinalStatus = status === "connected" || status === "error" || status === "disconnected";
    if (entry.timeoutHandle && isFinalStatus) {
      clearTimeout(entry.timeoutHandle);
      relayBrowserMap.set(sessionId, { socketId: entry.socketId });
    }

    const browserSocket = io.sockets.sockets.get(entry.socketId ?? entry);
    if (browserSocket?.connected) {
      browserSocket.emit("remox:web-status", { sessionId, status, message });
      logger.info(`[RemoxRelay] Status ${status} → browser ${entry.socketId ?? entry}`);
    }

    if (status === "disconnected" || status === "error") {
      relayBrowserMap.delete(sessionId);
      relayStarBoxMap.delete(sessionId);
    }
  });

  // ── StarBox → server: data SSH (output terminal) → browser ────────────────
  socket.on("remox:relay-data", ({ sessionId, data }) => {
    const entry = relayBrowserMap.get(sessionId);
    if (!entry) return;
    const browserSocket = io.sockets.sockets.get(entry.socketId ?? entry);
    if (browserSocket?.connected) {
      browserSocket.emit("remox:web-data", { sessionId, data });
    }
  });

  // ── Browser → server: input keyboard → StarBox ────────────────────────────
  socket.on("remox:web-data", ({ sessionId, data }) => {
    // Mode relay
    const starboxSocketId = relayStarBoxMap.get(sessionId);
    if (starboxSocketId) {
      const starboxSocket = io.sockets.sockets.get(starboxSocketId);
      if (starboxSocket?.connected) {
        starboxSocket.emit("remox:relay-input", { sessionId, data });
      }
      return;
    }
    // Mode public
    const s = webSessions.get(sessionId);
    if (!s) return;
    try {
      if (s.type === "ssh")    s.stream.write(Buffer.from(data, "binary"));
      if (s.type === "telnet") s.tcpSocket.write(Buffer.from(data, "binary"));
    } catch (_) {}
  });

  // ── Browser → server: resize → StarBox ───────────────────────────────────
  socket.on("remox:web-resize", ({ sessionId, cols, rows }) => {
    const starboxSocketId = relayStarBoxMap.get(sessionId);
    if (starboxSocketId) {
      const starboxSocket = io.sockets.sockets.get(starboxSocketId);
      if (starboxSocket?.connected) {
        starboxSocket.emit("remox:relay-resize", { sessionId, cols, rows });
      }
      return;
    }
    const s = webSessions.get(sessionId);
    if (s?.type === "ssh") {
      try { s.stream.setWindow(rows, cols, 0, 0); } catch (_) {}
    }
  });

  // ── Browser disconnect ────────────────────────────────────────────────────
  socket.on("remox:web-disconnect", ({ sessionId }) => {
    const starboxSocketId = relayStarBoxMap.get(sessionId);
    if (starboxSocketId) {
      const starboxSocket = io.sockets.sockets.get(starboxSocketId);
      if (starboxSocket?.connected) {
        starboxSocket.emit("remox:relay-disconnect", { sessionId });
      }
      const entry = relayBrowserMap.get(sessionId);
      if (entry?.timeoutHandle) clearTimeout(entry.timeoutHandle);
      relayBrowserMap.delete(sessionId);
      relayStarBoxMap.delete(sessionId);
      return;
    }
    closeWebSession(sessionId);
  });

  // ── Socket putus → cleanup ─────────────────────────────────────────────────
  socket.on("disconnect", () => {
    // Cleanup public sessions
    webSessions.forEach((s, id) => {
      if (s.socketId === socket.id) closeWebSession(id);
    });
    // Cleanup relay sessions dimana socket ini adalah browser
    relayBrowserMap.forEach((entry, sessionId) => {
      const socketId = entry.socketId ?? entry;
      if (socketId === socket.id) {
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
        // Notify StarBox to close
        const sbId = relayStarBoxMap.get(sessionId);
        if (sbId) {
          const sbSock = io.sockets.sockets.get(sbId);
          sbSock?.emit("remox:relay-disconnect", { sessionId });
        }
        relayBrowserMap.delete(sessionId);
        relayStarBoxMap.delete(sessionId);
      }
    });
    // Cleanup relay sessions dimana socket ini adalah StarBox
    relayStarBoxMap.forEach((sbSocketId, sessionId) => {
      if (sbSocketId === socket.id) {
        const entry = relayBrowserMap.get(sessionId);
        if (entry) {
          if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
          const bSock = io.sockets.sockets.get(entry.socketId ?? entry);
          bSock?.emit("remox:web-status", { sessionId, status: "disconnected", message: "StarBox Lokal terputus." });
        }
        relayBrowserMap.delete(sessionId);
        relayStarBoxMap.delete(sessionId);
      }
    });
  });
}

module.exports = { attachRemoxWebTerminal };
