"use strict";

/**
 * Command handler untuk operasi MikroTik via relay.
 *
 * Command ini dipanggil ketika StarBox remote (viewer) meminta StarBox lokal
 * (yang berada satu jaringan dengan MikroTik) untuk mengeksekusi aksi.
 */

const logger = require("../utils/logger");

/**
 * mikrotik_open_webui
 * Buka Web UI MikroTik di BrowserWindow pada mesin lokal.
 * Dipakai dalam mode relay: viewer → server → StarBox lokal.
 */
async function handleMikrotikOpenWebUI(payload, bridge) {
  const { host, webPort, name, deviceId } = payload;
  if (!host) throw new Error("host wajib diisi");

  logger.info(`[MikroTikCmd] Open WebUI ${host}:${webPort || 80} (${name || "MikroTik"})`);

  const result = await bridge.ipc.invoke("mikrotik:open-webui-proxy", {
    deviceId: deviceId || host,
    host,
    webPort: parseInt(webPort) || 80,
    name,
  });

  if (!result?.success) {
    throw new Error(result?.error || "Gagal membuka Web UI MikroTik");
  }

  return { success: true };
}

module.exports = {
  mikrotik_open_webui: handleMikrotikOpenWebUI,
};
