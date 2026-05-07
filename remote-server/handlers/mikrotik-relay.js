"use strict";

/**
 * mikrotik-relay.js
 *
 * Semua relay MikroTik antar StarBox instances:
 *
 * 1. HTTP Proxy Relay — Web UI MikroTik via StarBox lokal
 * 2. Open WebUI command — StarBox lokal buka BrowserWindow
 * 3. Winbox TCP Relay — tunnel TCP port 8291 via WebSocket
 *    Flow: Viewer (TCP server localhost:PORT) ↔ Relay ↔ Agent (TCP client → MikroTik:8291)
 * 4. Device Registry — setiap agent push daftar MikroTik devices-nya ke server
 *    sehingga web dashboard bisa tahu agent mana yang punya device apa
 */

const logger = require("../utils/logger");

// ── HTTP Proxy ────────────────────────────────────────────────────────────────
// reqId -> { browserSocketId, timeoutHandle }
const proxyPendingMap = new Map();

// ── Winbox TCP Tunnel ─────────────────────────────────────────────────────────
// tunnelId -> { viewerSocketId, agentSocketId }
const winboxTunnelMap = new Map();

// ── Device Registry ───────────────────────────────────────────────────────────
// clientId -> { devices: [], hostname, platform, registeredAt }
const clientDeviceRegistry = new Map();

const TIMEOUT_MS = 20000;

/**
 * Kembalikan semua perangkat MikroTik yang terdaftar dari semua agent yang online.
 * Dipakai oleh REST endpoint di index.js.
 */
function getMikrotikDeviceRegistry() {
  const result = [];
  clientDeviceRegistry.forEach((entry, clientId) => {
    (entry.devices || []).forEach((d) => {
      result.push({ ...d, _clientId: clientId, _hostname: entry.hostname, _platform: entry.platform });
    });
  });
  return result;
}

/**
 * Attach semua MikroTik relay handlers ke satu socket.io socket.
 */
function attachMikrotikRelay(io, socket, clientSocketMap) {

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVICE REGISTRY
  // ═══════════════════════════════════════════════════════════════════════════

  // Agent mendaftarkan daftar MikroTik device-nya ke server
  socket.on("mikrotik:devices-register", ({ devices, hostname, platform }) => {
    const clientId = socket.clientId;
    if (!clientId) return;
    clientDeviceRegistry.set(clientId, {
      devices: Array.isArray(devices) ? devices : [],
      hostname: hostname || socket.hostname || "unknown",
      platform: platform || socket.platform || "unknown",
      registeredAt: new Date().toISOString(),
    });
    logger.info(`[MikroTikRegistry] ${clientId.slice(0, 16)} daftarkan ${devices?.length || 0} device`);
  });

  // Viewer/web minta daftar semua device dari semua agent
  socket.on("mikrotik:devices-list-request", () => {
    socket.emit("mikrotik:devices-list-response", { devices: getMikrotikDeviceRegistry() });
  });

  // Cleanup registry saat disconnect
  socket.on("disconnect", () => {
    const clientId = socket.clientId;
    if (clientId) clientDeviceRegistry.delete(clientId);

    // Cleanup HTTP proxy
    proxyPendingMap.forEach((entry, reqId) => {
      if (entry.browserSocketId === socket.id) {
        clearTimeout(entry.timeoutHandle);
        proxyPendingMap.delete(reqId);
      }
    });

    // Cleanup Winbox tunnels
    winboxTunnelMap.forEach((tunnel, tunnelId) => {
      if (tunnel.viewerSocketId === socket.id || tunnel.agentSocketId === socket.id) {
        // Notify the other side
        if (tunnel.viewerSocketId === socket.id) {
          const agentSock = io.sockets.sockets.get(tunnel.agentSocketId);
          agentSock?.emit("mikrotik:relay-winbox-close", { tunnelId });
        } else {
          const viewerSock = io.sockets.sockets.get(tunnel.viewerSocketId);
          viewerSock?.emit("mikrotik:winbox-relay-status", { tunnelId, status: "closed", message: "Agent terputus" });
        }
        winboxTunnelMap.delete(tunnelId);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP PROXY RELAY (Web UI MikroTik)
  // ═══════════════════════════════════════════════════════════════════════════

  socket.on("mikrotik:proxy-request", ({ reqId, targetClientId, url, method = "GET", headers = {}, body = null }) => {
    if (!reqId || !targetClientId || !url) return;

    const sendError = (msg) =>
      socket.emit("mikrotik:proxy-response", { reqId, ok: false, status: 502, body: msg });

    const targetSocket = clientSocketMap?.get(targetClientId);
    if (!targetSocket?.connected) return sendError(`Agent (${targetClientId.slice(0, 16)}…) tidak online.`);

    const th = setTimeout(() => {
      proxyPendingMap.delete(reqId);
      sendError("Agent tidak merespons (timeout 20s).");
    }, TIMEOUT_MS);

    proxyPendingMap.set(reqId, { browserSocketId: socket.id, timeoutHandle: th });
    targetSocket.emit("mikrotik:relay-proxy-request", { reqId, url, method, headers, body });
    logger.info(`[MikroTikRelay] Proxy ${method} ${url} → ${targetClientId.slice(0, 16)}`);
  });

  socket.on("mikrotik:relay-proxy-response", ({ reqId, ok, status, headers, body }) => {
    const entry = proxyPendingMap.get(reqId);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    proxyPendingMap.delete(reqId);
    const bs = io.sockets.sockets.get(entry.browserSocketId);
    bs?.connected && bs.emit("mikrotik:proxy-response", { reqId, ok, status, headers, body });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN WEBUI COMMAND
  // ═══════════════════════════════════════════════════════════════════════════

  socket.on("mikrotik:open-webui-via-client", ({ reqId, targetClientId, host, webPort, name }) => {
    if (!reqId || !targetClientId || !host) return;
    const sendResult = (ok, message = "") => socket.emit("mikrotik:open-webui-result", { reqId, ok, message });

    const targetSocket = clientSocketMap?.get(targetClientId);
    if (!targetSocket?.connected) return sendResult(false, `Agent ${targetClientId.slice(0, 16)}… tidak online.`);

    targetSocket.emit("mikrotik:relay-open-webui", { reqId, host, webPort, name });
    const t = setTimeout(() => sendResult(false, "Agent tidak merespons."), TIMEOUT_MS);
    socket.once(`_mtk_webui_ack_${reqId}`, () => clearTimeout(t));
    logger.info(`[MikroTikRelay] Open WebUI ${host} → ${targetClientId.slice(0, 16)}`);
  });

  socket.on("mikrotik:relay-open-webui-ack", ({ reqId, ok, message }) => {
    io.emit(`_mtk_webui_ack_${reqId}`, { ok, message });
    // Also send result to any viewer waiting
    socket.broadcast.emit("mikrotik:open-webui-result", { reqId, ok, message });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WINBOX TCP TUNNEL RELAY
  //
  // Alur:
  //   Viewer   → mikrotik:winbox-tunnel-open   → Server → mikrotik:relay-winbox-open   → Agent
  //   Agent    → mikrotik:relay-winbox-status  → Server → mikrotik:winbox-relay-status → Viewer
  //   Viewer   → mikrotik:winbox-tunnel-data   → Server → mikrotik:relay-winbox-data   → Agent
  //   Agent    → mikrotik:relay-winbox-data    → Server → mikrotik:winbox-relay-data   → Viewer
  //   Viewer   → mikrotik:winbox-tunnel-close  → Server → mikrotik:relay-winbox-close  → Agent
  //   Agent    → mikrotik:relay-winbox-close   → Server → mikrotik:winbox-relay-status(closed) → Viewer
  // ═══════════════════════════════════════════════════════════════════════════

  // Viewer: minta buka TCP tunnel ke MikroTik:8291
  socket.on("mikrotik:winbox-tunnel-open", ({ tunnelId, targetClientId, host, port }) => {
    if (!tunnelId || !targetClientId || !host) return;

    const sendStatus = (status, message = "") =>
      socket.emit("mikrotik:winbox-relay-status", { tunnelId, status, message });

    const targetSocket = clientSocketMap?.get(targetClientId);
    if (!targetSocket?.connected) return sendStatus("error", `Agent ${targetClientId.slice(0, 16)}… tidak online.`);

    winboxTunnelMap.set(tunnelId, { viewerSocketId: socket.id, agentSocketId: targetSocket.id });

    targetSocket.emit("mikrotik:relay-winbox-open", { tunnelId, host, port: port || 8291 });
    logger.info(`[WinboxRelay] Tunnel ${tunnelId} → ${targetClientId.slice(0, 16)} → ${host}:${port || 8291}`);

    // Timeout jika agent tidak connect dalam 15 detik
    const th = setTimeout(() => {
      if (!winboxTunnelMap.has(tunnelId)) return;
      const t = winboxTunnelMap.get(tunnelId);
      if (!t.connected) {
        winboxTunnelMap.delete(tunnelId);
        sendStatus("error", "Agent tidak berhasil terhubung ke MikroTik (timeout 15s).");
      }
    }, 15000);
    winboxTunnelMap.get(tunnelId)._connectTimeout = th;
  });

  // Agent: status koneksi TCP ke MikroTik (connected/error/closed)
  socket.on("mikrotik:relay-winbox-status", ({ tunnelId, status, message }) => {
    const tunnel = winboxTunnelMap.get(tunnelId);
    if (!tunnel) return;

    if (status === "connected") {
      clearTimeout(tunnel._connectTimeout);
      tunnel.connected = true;
    }

    const viewerSock = io.sockets.sockets.get(tunnel.viewerSocketId);
    viewerSock?.emit("mikrotik:winbox-relay-status", { tunnelId, status, message });
    logger.info(`[WinboxRelay] ${tunnelId} status: ${status}${message ? " — " + message : ""}`);

    if (status === "error" || status === "closed") {
      clearTimeout(tunnel._connectTimeout);
      winboxTunnelMap.delete(tunnelId);
    }
  });

  // Viewer → relay → agent: data dari Winbox app ke MikroTik
  socket.on("mikrotik:winbox-tunnel-data", ({ tunnelId, data }) => {
    const tunnel = winboxTunnelMap.get(tunnelId);
    if (!tunnel) return;
    const agentSock = io.sockets.sockets.get(tunnel.agentSocketId);
    agentSock?.emit("mikrotik:relay-winbox-data", { tunnelId, data });
  });

  // Agent → relay → viewer: data dari MikroTik ke Winbox app
  socket.on("mikrotik:relay-winbox-data", ({ tunnelId, data }) => {
    const tunnel = winboxTunnelMap.get(tunnelId);
    if (!tunnel) return;
    const viewerSock = io.sockets.sockets.get(tunnel.viewerSocketId);
    viewerSock?.emit("mikrotik:winbox-relay-data", { tunnelId, data });
  });

  // Viewer: tutup tunnel (Winbox app disconnect)
  socket.on("mikrotik:winbox-tunnel-close", ({ tunnelId }) => {
    const tunnel = winboxTunnelMap.get(tunnelId);
    if (!tunnel) return;
    clearTimeout(tunnel._connectTimeout);
    const agentSock = io.sockets.sockets.get(tunnel.agentSocketId);
    agentSock?.emit("mikrotik:relay-winbox-close", { tunnelId });
    winboxTunnelMap.delete(tunnelId);
    logger.info(`[WinboxRelay] Tunnel ${tunnelId} ditutup oleh viewer`);
  });

  // Agent: konfirmasi closed dari sisi TCP
  socket.on("mikrotik:relay-winbox-closed", ({ tunnelId }) => {
    const tunnel = winboxTunnelMap.get(tunnelId);
    if (!tunnel) return;
    clearTimeout(tunnel._connectTimeout);
    const viewerSock = io.sockets.sockets.get(tunnel.viewerSocketId);
    viewerSock?.emit("mikrotik:winbox-relay-status", { tunnelId, status: "closed" });
    winboxTunnelMap.delete(tunnelId);
    logger.info(`[WinboxRelay] Tunnel ${tunnelId} closed oleh agent`);
  });
}

module.exports = { attachMikrotikRelay, getMikrotikDeviceRegistry };
