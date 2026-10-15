// ═══════════════════════════════════════════════════════════════════════════════
// Modul Remox — sisi main process (SSH / Telnet / RDP)
//
// Dipindah dari electron-main.js. ssh2 ada di node_modules milik modul ini
// (JavaScript murni, tanpa cpu-features / binding native), jadi tidak ikut
// terpasang di installer StarBox. Koneksi tetap di <userData>/remox-connections.json.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const nodeNet = require("net");
const { spawn } = require("child_process");
const { Client: SshClient } = require("ssh2");

let ctx = null;
let remoxSessions = null;

const getAuthSession = () => ctx.services.getAuthSession() || {};
const getApiBaseUrl = () => ctx.services.getApiBaseUrl();

/** API untuk core & fitur lain (MikroTik, remote-client relay, telemetri). */
const api = {
  SshClient,
  loadConnections: () => [],
  saveConnections: () => {},
  pullFromCloud: async () => ({ success: false, error: "Remox belum siap" }),
};

function register(context) {
  ctx = context;
  const { ipcMain, app, BrowserWindow, shell } = context.electron;

  let remoxSshAlgorithms;
  try {
    const sshConstants = require("ssh2/lib/protocol/constants");
    remoxSshAlgorithms = {
      kex: sshConstants.SUPPORTED_KEX,
      cipher: sshConstants.SUPPORTED_CIPHER,
      serverHostKey: sshConstants.SUPPORTED_SERVER_HOST_KEY,
      hmac: sshConstants.SUPPORTED_MAC,
      compress: sshConstants.SUPPORTED_COMPRESSION,
    };
  } catch (_) {
    remoxSshAlgorithms = {
      cipher: [
        "aes128-gcm@openssh.com",
        "aes256-gcm@openssh.com",
        "aes128-ctr",
        "aes192-ctr",
        "aes256-ctr",
        "chacha20-poly1305@openssh.com",
        "aes256-cbc",
        "aes192-cbc",
        "aes128-cbc",
        "3des-cbc",
        "aes128-gcm",
        "aes256-gcm",
      ],
    };
  }
  const REMOX_DB_PATH = path.join(app.getPath("userData"), "remox-connections.json");

  function loadRemoxConnections() {
    try {
      if (fs.existsSync(REMOX_DB_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(REMOX_DB_PATH, "utf8"));
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.connections)) return parsed.connections;
      }
    } catch (err) {
      console.warn("[Remox] Gagal membaca remox-connections.json:", err?.message || err);
    }
    return [];
  }

  function saveRemoxConnections(connections) {
    fs.writeFileSync(REMOX_DB_PATH, JSON.stringify({ connections }, null, 2), "utf8");
  }

  // sessionId -> { type, conn, stream, socket, winId }
  remoxSessions = new Map();

  ipcMain.handle("remox:load-connections", () => loadRemoxConnections());

  ipcMain.handle("remox:save-connection", (_, conn) => {
    const connections = loadRemoxConnections();
    if (conn.id) {
      const idx = connections.findIndex((c) => c.id === conn.id);
      if (idx >= 0) connections[idx] = conn;
      else connections.push(conn);
    } else {
      conn.id = ctx.requireShared("uuid").v4();
      conn.created_at = new Date().toISOString();
      connections.push(conn);
    }
    saveRemoxConnections(connections);
    return conn;
  });

  ipcMain.handle("remox:delete-connection", (_, id) => {
    saveRemoxConnections(loadRemoxConnections().filter((c) => c.id !== id));
    return { success: true };
  });

  /**
   * Pull koneksi dari server ke lokal.
   * Server wins untuk UUID yang cocok; koneksi baru dari server ditambahkan;
   * koneksi lokal yang tidak ada di server tetap dipertahankan.
   */
  async function pullRemoxFromCloud() {
    if (!getAuthSession()?.isLoggedIn || !getAuthSession()?.token) return { success: false, error: "Belum login." };
    const apiBase = getApiBaseUrl().replace(/\/$/, "");
    try {
      const res = await fetch(`${apiBase}/api/remox/connections`, {
        headers: { Authorization: `Bearer ${getAuthSession().token}`, Accept: "application/json" },
      });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      const serverConns = data.connections || [];

      const localConns  = loadRemoxConnections();
      const serverIds   = new Set(serverConns.map((c) => c.id));
      // Gabungkan: server menang untuk UUID yang sama, lokal-only tetap
      const localOnly   = localConns.filter((c) => !serverIds.has(c.id));
      const merged      = [
        ...serverConns.map((c) => ({
          ...c,
          sync_cloud: true,
          created_at: c.created_at || new Date().toISOString(),
        })),
        ...localOnly,
      ];
      saveRemoxConnections(merged);
      return { success: true, connections: merged, count: serverConns.length, limit: data.limit ?? null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  ipcMain.handle("remox:pull-from-cloud", () => pullRemoxFromCloud());

  ipcMain.handle("remox:cloud-sync", async () => {
    if (!getAuthSession()?.isLoggedIn || !getAuthSession()?.token) {
      return { success: false, error: "Harap login terlebih dahulu untuk sinkron cloud." };
    }
    const localConns = loadRemoxConnections();
    const apiBase = getApiBaseUrl().replace(/\/$/, "");

    // Hanya kirim koneksi yang user setujui untuk disinkron
    const toSync = localConns.filter(c => c.sync_cloud !== false);

    try {
      const res = await fetch(`${apiBase}/api/remox/connections/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthSession().token}`,
        },
        body: JSON.stringify({ connections: toSync }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 120)}` };
      }
      const data = await res.json();
      const serverConns = data.connections || [];
      const syncedUuids = serverConns.map(c => c.id); // confirmed on server

      // Buat map sync_cloud flags dari data lokal
      const syncFlagMap = new Map(localConns.map(c => [c.id, c.sync_cloud]));

      // Merge: koneksi dari server (sudah di-sync) + restore flag lokal
      const serverIds = new Set(serverConns.map(c => c.id));
      const mergedFromServer = serverConns.map(c => ({
        ...c,
        sync_cloud: syncFlagMap.has(c.id) ? syncFlagMap.get(c.id) : true,
      }));

      // Koneksi lokal yang tidak ada di server (excluded atau belum sync)
      const localOnly = localConns.filter(c => !serverIds.has(c.id));

      const finalConns = [...mergedFromServer, ...localOnly];
      saveRemoxConnections(finalConns);

      return {
        success: true,
        connections: finalConns,
        syncedUuids,                     // UUIDs yang confirmed ada di server
        limit:   data.limit   ?? null,
        count:   data.count   ?? syncedUuids.length,
        skipped: data.skipped ?? 0,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("remox:connect", async (event, { sessionId, connectionId }) => {
    const conn = loadRemoxConnections().find((c) => c.id === connectionId);
    if (!conn) return { success: false, error: "Koneksi tidak ditemukan" };

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: "Window tidak tersedia" };

    const sendData = (data) => {
      if (!win.isDestroyed()) win.webContents.send("remox:data", { sessionId, data });
    };
    const sendStatus = (status, message) => {
      if (!win.isDestroyed()) win.webContents.send("remox:status", { sessionId, status, message });
    };

    try {
      if (conn.type === "ssh") {
        await new Promise((resolve, reject) => {
          const ssh = new SshClient();
          ssh.on("ready", () => {
            ssh.shell({ term: "xterm-256color", rows: 24, cols: 80 }, (err, stream) => {
              if (err) { ssh.end(); reject(err); return; }
              remoxSessions.set(sessionId, { type: "ssh", conn: ssh, stream });
              stream.on("data", (d) => sendData(d.toString("binary")));
              stream.stderr.on("data", (d) => sendData(d.toString("binary")));
              stream.on("close", () => {
                remoxSessions.delete(sessionId);
                sendStatus("disconnected", "Koneksi SSH ditutup");
              });
              sendStatus("connected");
              resolve();
            });
          });
          ssh.on("keyboard-interactive", (name, instructions, instructionsLang, prompts, finish) => {
            finish([conn.password || ""]);
          });
          ssh.on("error", reject);
          ssh.on("close", () => {
            if (remoxSessions.has(sessionId)) {
              remoxSessions.delete(sessionId);
              sendStatus("disconnected", "Koneksi SSH terputus");
            }
          });
          const opts = {
            host: conn.host,
            port: parseInt(conn.port) || 22,
            username: conn.username,
            readyTimeout: 20000,
            keepaliveInterval: 15000,
            tryKeyboard: true,
            algorithms: remoxSshAlgorithms,
          };
          if (conn.privateKey) opts.privateKey = conn.privateKey;
          else opts.password = conn.password || "";
          if (conn.passphrase) opts.passphrase = conn.passphrase;
          ssh.connect(opts);
        });
        return { success: true };

      } else if (conn.type === "telnet") {
        await new Promise((resolve, reject) => {
          const socket = new nodeNet.Socket();
          socket.setTimeout(20000);
          socket.once("connect", () => {
            socket.setTimeout(0);
            remoxSessions.set(sessionId, { type: "telnet", socket });
            sendStatus("connected");
            resolve();
          });
          socket.on("data", (d) => sendData(d.toString("binary")));
          socket.on("close", () => {
            if (remoxSessions.has(sessionId)) {
              remoxSessions.delete(sessionId);
              sendStatus("disconnected", "Koneksi Telnet terputus");
            }
          });
          socket.on("error", reject);
          socket.on("timeout", () => reject(new Error("Connection timeout")));
          socket.connect(parseInt(conn.port) || 23, conn.host);
        });
        return { success: true };

      } else {
        return { success: false, error: "Tipe koneksi tidak didukung" };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on("remox:send-data", (_, { sessionId, data }) => {
    const s = remoxSessions.get(sessionId);
    if (!s) return;
    if (s.type === "ssh" && s.stream) s.stream.write(data);
    else if (s.type === "telnet" && s.socket) s.socket.write(data);
  });

  ipcMain.on("remox:resize", (_, { sessionId, cols, rows }) => {
    const s = remoxSessions.get(sessionId);
    if (s?.type === "ssh" && s.stream) s.stream.setWindow(rows, cols, 0, 0);
  });

  ipcMain.handle("remox:disconnect", (_, sessionId) => {
    const s = remoxSessions.get(sessionId);
    if (!s) return { success: true };
    if (s.type === "ssh") { s.stream?.end(); s.conn?.end(); }
    else if (s.type === "telnet") { s.socket?.destroy(); }
    remoxSessions.delete(sessionId);
    return { success: true };
  });

  // Launch native RDP client
  ipcMain.handle("remox:launch-rdp", async (_, { host, port, username, password, domain }) => {
    try {
      const rdpPort = parseInt(port) || 3389;
      const userField = domain ? `${domain}\\${username}` : (username || "");

      // Build standard .rdp file — opened by mstsc (Win), MS Remote Desktop (mac), Remmina (Linux)
      const rdpLines = [
        `full address:s:${host}:${rdpPort}`,
        `username:s:${userField}`,
        `prompt for credentials:i:${password ? 0 : 1}`,
        `desktopwidth:i:1280`,
        `desktopheight:i:800`,
        `session bpp:i:32`,
        `compression:i:1`,
        `connection type:i:7`,
        `networkautodetect:i:1`,
        `bandwidthautodetect:i:1`,
        `authentication level:i:2`,
        `enablecredsspsupport:i:1`,
        `redirectclipboard:i:1`,
        `audiomode:i:0`,
      ];
      const tmpDir = app.getPath("temp");
      const rdpFile = path.join(tmpDir, `starbox_rdp_${Date.now()}.rdp`);
      fs.writeFileSync(rdpFile, rdpLines.join("\r\n") + "\r\n", "utf8");

      if (process.platform === "win32") {
        // Windows: mstsc.exe bawaan OS
        spawn("mstsc", [rdpFile], { detached: true, stdio: "ignore" }).unref();
      } else if (process.platform === "darwin") {
        // macOS: shell.openPath membuka dengan MS Remote Desktop (jika terinstall)
        const err = await shell.openPath(rdpFile);
        if (err) {
          return { success: false, error: "Tidak ada aplikasi RDP. Silakan install Microsoft Remote Desktop dari App Store." };
        }
      } else {
        // Linux: coba shell.openPath dulu (Remmina/GNOME), fallback ke xfreerdp
        const err = await shell.openPath(rdpFile);
        if (err) {
          const args = [`/v:${host}:${rdpPort}`, `/u:${username || ""}`];
          if (domain) args.push(`/d:${domain}`);
          if (password) args.push(`/p:${password}`);
          args.push("/dynamic-resolution", "/cert:ignore", "+clipboard");
          spawn("xfreerdp", args, { detached: true, stdio: "ignore" }).unref();
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // TCP reachability check (ping port)
  ipcMain.handle("remox:ping", (_, { host, port }) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new nodeNet.Socket();
      socket.setTimeout(5000);
      socket.once("connect", () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latency });
      });
      socket.once("error", () => { socket.destroy(); resolve({ reachable: false, latency: null }); });
      socket.once("timeout", () => { socket.destroy(); resolve({ reachable: false, latency: null }); });
      socket.connect(parseInt(port) || 22, host);
    });
  });

  api.loadConnections = loadRemoxConnections;
  api.saveConnections = saveRemoxConnections;
  api.pullFromCloud = pullRemoxFromCloud;
}

function getStats() {
  return { sessions: remoxSessions ? remoxSessions.size : 0 };
}

module.exports = { register, getStats, api };
