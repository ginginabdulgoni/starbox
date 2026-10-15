// ═══════════════════════════════════════════════════════════════════════════════
// Modul MikroTik — sisi main process
//
// Dipindah dari electron-main.js: daftar router, scan jaringan, WebUI (langsung &
// lewat proxy lokal), Winbox, tunnel Winbox lewat relay, sinkron ke server.
// SSH memakai modul Remox (opsional). Data tetap di <userData>/mikrotik-devices.json.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const nodeNet = require("net");

let ctx = null;
const getAuthSession = () => ctx.services.getAuthSession() || {};

/** API untuk core (remote-client relay & push daftar device). */
const api = {
  loadDevices: () => [],
  openWebUIProxyWindow: async () => ({ success: false, error: "MikroTik belum siap" }),
};

function register(context) {
  ctx = context;
  const { ipcMain, app, BrowserWindow } = context.electron;

  // ─── MikroTik Manager ────────────────────────────────────────────────────────
  const MIKROTIK_DB_PATH = path.join(app.getPath("userData"), "mikrotik-devices.json");

  function loadMikrotikDevices() {
    try {
      if (fs.existsSync(MIKROTIK_DB_PATH)) {
        return JSON.parse(fs.readFileSync(MIKROTIK_DB_PATH, "utf8")).devices || [];
      }
    } catch (_) {}
    return [];
  }

  function saveMikrotikDevices(devices) {
    fs.writeFileSync(MIKROTIK_DB_PATH, JSON.stringify({ devices }, null, 2), "utf8");
  }

  ipcMain.handle("mikrotik:load-devices", () => loadMikrotikDevices());

  ipcMain.handle("mikrotik:save-device", (_, device) => {
    const devices = loadMikrotikDevices();
    if (device.id) {
      const idx = devices.findIndex((d) => d.id === device.id);
      if (idx >= 0) devices[idx] = device;
      else devices.push(device);
    } else {
      device.id = ctx.requireShared("uuid").v4();
      device.created_at = new Date().toISOString();
      devices.push(device);
    }
    saveMikrotikDevices(devices);
    // Sync ke relay server & Laravel setelah simpan
    setImmediate(() => { syncMikrotikDevicesToRelay(); syncMikrotikDevicesToLaravel(); });
    return device;
  });

  ipcMain.handle("mikrotik:delete-device", (_, id) => {
    saveMikrotikDevices(loadMikrotikDevices().filter((d) => d.id !== id));
    setImmediate(() => { syncMikrotikDevicesToRelay(); syncMikrotikDevicesToLaravel(); });
    return { success: true };
  });

  /**
   * Scan jaringan lokal untuk mendeteksi perangkat MikroTik.
   * Memeriksa port Winbox (8291), SSH (22), dan HTTP (80/8080) pada subnet lokal.
   */
  ipcMain.handle("mikrotik:scan-network", async () => {
    const os = require("os");
    const interfaces = os.networkInterfaces();
    const subnets = [];

    // Kumpulkan semua subnet /24 dari network interface lokal (kecuali loopback)
    for (const iface of Object.values(interfaces)) {
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal) {
          const parts = addr.address.split(".");
          subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }

    if (!subnets.length) return { success: false, error: "Tidak ada network interface yang aktif" };

    const MIKROTIK_PORTS = [8291, 22, 80];
    const TIMEOUT_MS = 600;
    const MAX_CONCURRENT = 30;
    const found = [];

    // Scan setiap subnet
    for (const subnet of [...new Set(subnets)]) {
      const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);

      // Scan dengan concurrency limit
      for (let i = 0; i < hosts.length; i += MAX_CONCURRENT) {
        const batch = hosts.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.allSettled(
          batch.map((host) =>
            new Promise((resolve) => {
              const openPorts = [];
              let completed = 0;
              for (const port of MIKROTIK_PORTS) {
                const sock = new nodeNet.Socket();
                sock.setTimeout(TIMEOUT_MS);
                sock.once("connect", () => {
                  openPorts.push(port);
                  sock.destroy();
                });
                sock.on("error", () => {});
                sock.on("timeout", () => sock.destroy());
                sock.on("close", () => {
                  completed++;
                  if (completed === MIKROTIK_PORTS.length) {
                    resolve({ host, openPorts });
                  }
                });
                sock.connect(port, host);
              }
            })
          )
        );

        for (const r of results) {
          if (r.status === "fulfilled" && r.value.openPorts.length > 0) {
            // Deteksi MikroTik: port 8291 (Winbox) adalah tanda kuat
            const isMikrotik = r.value.openPorts.includes(8291) ||
              (r.value.openPorts.includes(22) && r.value.openPorts.includes(80));
            if (isMikrotik) {
              found.push({
                host: r.value.host,
                openPorts: r.value.openPorts,
                hasWinbox: r.value.openPorts.includes(8291),
                hasSsh:    r.value.openPorts.includes(22),
                hasWebUI:  r.value.openPorts.includes(80),
              });
            }
          }
        }
      }
    }

    return { success: true, devices: found };
  });

  /**
   * Buka Web UI MikroTik di BrowserWindow lokal.
   */
  ipcMain.handle("mikrotik:open-webui", (_, { host, webPort, name }) => {
    try {
      const port = parseInt(webPort) || 80;
      const url = port === 443 ? `https://${host}` : `http://${host}${port !== 80 ? `:${port}` : ""}`;
      const win = new BrowserWindow({
        width: 1280,
        height: 900,
        title: `MikroTik – ${name || host}`,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // izinkan mixed content untuk router HTTP
          allowRunningInsecureContent: true,
        },
        icon: ctx.paths.appIcon,
      });
      win.loadURL(url);
      win.setMenuBarVisibility(false);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /**
   * Buat koneksi SSH ke MikroTik menggunakan infrastruktur Remox.
   * Menyimpan koneksi ke remox-connections.json dan mengembalikan ID-nya.
   */
  ipcMain.handle("mikrotik:open-ssh", (_, { host, sshPort, username, password, name }) => {
    const remox = ctx.getModuleApi("remox");
    if (!remox) {
      return { success: false, needsModule: "remox", error: "Modul Remox belum terpasang. Pasang dari halaman Modul untuk membuka SSH." };
    }
    const loadRemoxConnections = remox.loadConnections;
    const saveRemoxConnections = remox.saveConnections;
    try {
      const connections = loadRemoxConnections();
      // Cari existing connection untuk host ini, atau buat baru
      const tempId = `mtk-${host.replace(/\./g, "-")}`;
      let conn = connections.find((c) => c.id === tempId);
      if (!conn) {
        conn = {
          id: tempId,
          name: `MikroTik ${name || host}`,
          type: "ssh",
          host,
          port: parseInt(sshPort) || 22,
          username: username || "admin",
          password: password || "",
          _mikrotik: true,
        };
        connections.push(conn);
        saveRemoxConnections(connections);
      } else {
        // Update credentials jika berubah
        conn.host     = host;
        conn.port     = parseInt(sshPort) || 22;
        conn.username = username || conn.username || "admin";
        conn.password = password !== undefined ? password : conn.password;
        const idx = connections.findIndex((c) => c.id === tempId);
        connections[idx] = conn;
        saveRemoxConnections(connections);
      }
      return { success: true, connectionId: conn.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /**
   * Launch Winbox (aplikasi native MikroTik).
   * Coba jalankan dari PATH atau lokasi umum; beri tahu user jika tidak ditemukan.
   */
  ipcMain.handle("mikrotik:launch-winbox", async (_, { host, winboxPort, username, password }) => {
    const { exec, execFile } = require("child_process");
    const port = parseInt(winboxPort) || 8291;
    const target = port !== 8291 ? `${host}:${port}` : host;

    // Coba buka lewat protokol winbox:// (jika Winbox terdaftar sebagai URL handler)
    try {
      const { shell } = require("electron");
      await shell.openExternal(`winbox://${target}`);
      return { success: true, method: "protocol" };
    } catch (_) {}

    // Cari Winbox di lokasi umum
    const candidates = process.platform === "win32"
      ? [
          "C:\\Program Files\\WinBox\\winbox.exe",
          "C:\\Program Files (x86)\\WinBox\\winbox.exe",
          path.join(app.getPath("home"), "Desktop", "winbox.exe"),
          path.join(app.getPath("home"), "Downloads", "winbox.exe"),
          path.join(app.getPath("home"), "Desktop", "winbox64.exe"),
        ]
      : process.platform === "darwin"
      ? [
          "/Applications/WinBox.app/Contents/MacOS/WinBox",
          path.join(app.getPath("home"), "Downloads", "winbox"),
        ]
      : [
          "/usr/local/bin/winbox",
          "/opt/winbox/winbox",
          path.join(app.getPath("home"), "winbox"),
        ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const args = [target];
        if (username) args.push(username);
        if (password) args.push(password);
        try {
          const { spawn } = require("child_process");
          spawn(p, args, { detached: true, stdio: "ignore" }).unref();
          return { success: true, method: "executable", path: p };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
    }

    return {
      success: false,
      error: "Winbox tidak ditemukan. Download dari mikrotik.com/download dan install terlebih dahulu.",
      downloadUrl: "https://mikrotik.com/download",
    };
  });

  /**
   * Mulai HTTP proxy lokal yang forward request ke MikroTik web UI.
   * Dipakai oleh mikrotik:open-webui-proxy dan remote viewer melalui relay.
   */
  const mikrotikProxyServers = new Map(); // deviceId -> { server, port }

  async function startMikrotikProxy(deviceId, host, webPort) {
    if (mikrotikProxyServers.has(deviceId)) {
      return { success: true, port: mikrotikProxyServers.get(deviceId).port };
    }

    const httpModule  = require("http");
    const httpsModule = require("https");
    const { URL: NodeURL } = require("url");

    const targetPort = parseInt(webPort) || 80;
    const targetBase = targetPort === 443
      ? `https://${host}`
      : `http://${host}${targetPort !== 80 ? `:${targetPort}` : ""}`;

    return new Promise((resolve) => {
      const server = httpModule.createServer((req, res) => {
        const targetUrl = targetBase + (req.url || "/");
        const mod = targetUrl.startsWith("https") ? httpsModule : httpModule;
        const proxyReq = mod.request(
          targetUrl,
          {
            method:  req.method,
            headers: { ...req.headers, host: new NodeURL(targetUrl).host },
            timeout: 15000,
            rejectUnauthorized: false,
          },
          (proxyRes) => {
            // Rewrite Location header agar redirect tetap melewati proxy
            const headers = { ...proxyRes.headers };
            if (headers.location) {
              try {
                const loc = new NodeURL(headers.location, targetBase);
                headers.location = loc.pathname + (loc.search || "");
              } catch (_) {}
            }
            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res, { end: true });
          }
        );
        req.pipe(proxyReq, { end: true });
        proxyReq.on("error", (err) => {
          if (!res.headersSent) res.writeHead(502);
          res.end(`Proxy error: ${err.message}`);
        });
      });

      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        mikrotikProxyServers.set(deviceId, { server, port });
        console.log(`[MikroTik] Proxy started for ${host} on localhost:${port}`);
        resolve({ success: true, port });
      });
      server.on("error", (err) => resolve({ success: false, error: err.message }));
    });
  }

  ipcMain.handle("mikrotik:start-proxy", (_, { deviceId, host, webPort }) =>
    startMikrotikProxy(deviceId, host, webPort)
  );

  ipcMain.handle("mikrotik:stop-proxy", (_, { deviceId }) => {
    const entry = mikrotikProxyServers.get(deviceId);
    if (entry) { entry.server.close(); mikrotikProxyServers.delete(deviceId); }
    return { success: true };
  });

  /**
   * Buka Web UI MikroTik melalui proxy lokal (menghindari CORS dan mixed-content).
   */
  ipcMain.handle("mikrotik:open-webui-proxy", async (_, { deviceId, host, webPort, name }) => {
    try {
      const proxyResult = await startMikrotikProxy(deviceId, host, webPort);
      if (!proxyResult.success) return proxyResult;

      const win = new BrowserWindow({
        width: 1280,
        height: 900,
        title: `MikroTik WebUI – ${name || host}`,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
          allowRunningInsecureContent: true,
        },
        icon: ctx.paths.appIcon,
      });
      win.loadURL(`http://127.0.0.1:${proxyResult.port}/`);
      win.setMenuBarVisibility(false);
      win.on("closed", () => {
        const entry = mikrotikProxyServers.get(deviceId);
        if (entry) { entry.server.close(); mikrotikProxyServers.delete(deviceId); }
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── MikroTik Winbox TCP Tunnel (untuk remote relay) ─────────────────────────
  // tunnelId -> { server, activeClients: Map<num, net.Socket>, onData, onStatus }
  const mikrotikWinboxTunnels = new Map();

  function stopMikrotikWinboxTunnel(deviceId) {
    const tunnel = mikrotikWinboxTunnels.get(deviceId);
    if (!tunnel) return;
    try {
      tunnel.server.close();
      tunnel.activeClients.forEach((c) => { try { c.destroy(); } catch (_) {} });
      const socket = ctx.services.getRemoteSocket();
      if (socket) socket.off("mikrotik:winbox-relay-data", tunnel.onData);
    } catch (_) {}
    mikrotikWinboxTunnels.delete(deviceId);
    console.log(`[MikroTik] Winbox tunnel stopped for device ${deviceId}`);
  }

  /**
   * Mulai local TCP server yang relay data ke MikroTik:8291 via Socket.IO relay.
   * User menjalankan Winbox dan connect ke localhost:<port> yang dikembalikan.
   */
  ipcMain.handle("mikrotik:start-winbox-tunnel", async (_, { deviceId, targetClientId, host, winboxPort }) => {
    const socket = ctx.services.getRemoteSocket();
    if (!socket?.connected) return { success: false, error: "Tidak terhubung ke relay server. Login terlebih dahulu." };

    // Hentikan tunnel lama jika ada
    stopMikrotikWinboxTunnel(deviceId);

    let clientNum = 0;
    const activeClients = new Map(); // num -> tcp socket

    // Listener untuk data dari relay → tulis ke Winbox app
    const onData = ({ tunnelId: tid, data }) => {
      // Cari client berdasarkan tunnelId suffix
      const match = tid.match(/-(\d+)$/);
      if (!match) return;
      const cn = parseInt(match[1]);
      const tcpClient = activeClients.get(cn);
      if (tcpClient && !tcpClient.destroyed) {
        try { tcpClient.write(Buffer.from(data, "base64")); } catch (_) {}
      }
    };

    socket.on("mikrotik:winbox-relay-data", onData);

    return new Promise((resolve) => {
      const server = nodeNet.createServer((tcpClient) => {
        const cn = ++clientNum;
        const tunnelId = `winbox-${deviceId}-${cn}`;
        activeClients.set(cn, tcpClient);

        // Minta relay server buka koneksi ke MikroTik
        socket.emit("mikrotik:winbox-tunnel-open", {
          tunnelId,
          targetClientId,
          host,
          port: parseInt(winboxPort) || 8291,
        });

        tcpClient.on("data", (data) => {
          socket.emit("mikrotik:winbox-tunnel-data", { tunnelId, data: data.toString("base64") });
        });

        tcpClient.on("close", () => {
          socket.emit("mikrotik:winbox-tunnel-close", { tunnelId });
          activeClients.delete(cn);
        });

        tcpClient.on("error", () => { tcpClient.destroy(); });
      });

      mikrotikWinboxTunnels.set(deviceId, { server, activeClients, onData });

      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        console.log(`[MikroTik] Winbox relay tunnel berjalan di localhost:${port}`);
        // Update tunnels map with port info
        mikrotikWinboxTunnels.get(deviceId).port = port;
        resolve({ success: true, port });
      });

      server.on("error", (err) => {
        socket.off("mikrotik:winbox-relay-data", onData);
        mikrotikWinboxTunnels.delete(deviceId);
        resolve({ success: false, error: err.message });
      });
    });
  });

  ipcMain.handle("mikrotik:stop-winbox-tunnel", (_, { deviceId }) => {
    stopMikrotikWinboxTunnel(deviceId);
    return { success: true };
  });

  ipcMain.handle("mikrotik:get-winbox-tunnel-port", (_, { deviceId }) => {
    const tunnel = mikrotikWinboxTunnels.get(deviceId);
    if (!tunnel) return { active: false };
    return { active: true, port: tunnel.port };
  });

  // ─── MikroTik device sync ke server ──────────────────────────────────────────
  /**
   * Push daftar MikroTik devices ke relay server (untuk device registry).
   * Dipanggil: saat connect, saat tambah/edit/hapus device.
   */
  function syncMikrotikDevicesToRelay() {
    const socket = ctx.services.getRemoteSocket();
    if (!socket?.connected) return;
    try {
      const devices = loadMikrotikDevices();
      if (devices.length > 0) {
        const os = require("os");
        socket.emit("mikrotik:devices-register", {
          devices,
          hostname: os.hostname(),
          platform: process.platform,
        });
      }
    } catch (_) {}
  }

  /**
   * Sync ke Laravel backend (untuk web dashboard).
   */
  async function syncMikrotikDevicesToLaravel() {
    if (!getAuthSession()?.isLoggedIn || !getAuthSession()?.token) return;
    const apiBase = ctx.services.getApiBaseUrl().replace(/\/$/, "");
    try {
      const devices = loadMikrotikDevices();
      await fetch(`${apiBase}/api/mikrotik/devices/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthSession().token}`,
        },
        body: JSON.stringify({
          devices,
          client_id: ctx.services.getRemoteClientId(),
        }),
      });
    } catch (_) {} // Fail silently — server mungkin belum punya endpoint ini
  }

  ipcMain.handle("mikrotik:sync-to-server", async () => {
    syncMikrotikDevicesToRelay();
    await syncMikrotikDevicesToLaravel();
    return { success: true };
  });

  api.loadDevices = loadMikrotikDevices;
  // Dipanggil relay remote-client ("mikrotik:open-webui-proxy")
  api.openWebUIProxyWindow = async ({ deviceId, host, webPort, name } = {}) => {
      return startMikrotikProxy(deviceId || host, host, webPort).then(async (proxyResult) => {
        if (!proxyResult.success) return proxyResult;
        const win = new BrowserWindow({
          width: 1280, height: 900,
          title: `MikroTik WebUI – ${name || host}`,
          webPreferences: { nodeIntegration:false, contextIsolation:true, webSecurity:false, allowRunningInsecureContent:true },
          icon: ctx.paths.appIcon,
        });
        win.loadURL(`http://127.0.0.1:${proxyResult.port}/`);
        win.setMenuBarVisibility(false);
        win.on("closed", () => {
          const entry = mikrotikProxyServers.get(deviceId || host);
          if (entry) { entry.server.close(); mikrotikProxyServers.delete(deviceId || host); }
        });
        return { success: true };
      });
  };
}

module.exports = { register, api };
