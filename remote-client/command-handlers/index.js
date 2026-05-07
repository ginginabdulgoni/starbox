"use strict";

/**
 * Registry semua command handler.
 * Setiap handler adalah async function(payload, bridge) -> result | throws Error
 */

const deviceCommands   = require("./device-commands");
const tabCommands      = require("./tab-commands");
const jsCommands       = require("./js-commands");
const mikrotikCommands = require("./mikrotik-commands");

const handlers = {
  ...deviceCommands,
  ...tabCommands,
  ...jsCommands,
  ...mikrotikCommands,
};

// Command yang mentarget device spesifik via uid — perlu cek remoteEnabled
const DEVICE_SCOPED_COMMANDS = new Set([
  "start_device", "stop_device", "restart_device",
  "open_tab", "focus_tab", "reload_tab", "close_tab",
  "capture_tab", "move_tab", "scroll_tab", "tap_tab", "type_tab", "key_tab",
  "navigate_url", "get_current_url", "get_title",
  "open_monitor", "close_monitor", "send_js",
]);

/**
 * Dispatch command ke handler yang tepat.
 * Sebelum eksekusi, cek remoteEnabled untuk command yang mentarget device spesifik.
 *
 * @param {string} command - nama command
 * @param {object} payload - data dari remote client
 * @param {import("../electron-bridge")} bridge - akses ke Electron internals
 * @returns {Promise<any>} - hasil command
 */
async function dispatchCommand(command, payload, bridge) {
  const handler = handlers[command];
  if (!handler) {
    throw new Error(`Handler untuk command '${command}' tidak ditemukan`);
  }

  // Validasi remoteEnabled per device
  if (DEVICE_SCOPED_COMMANDS.has(command) && payload?.uid) {
    try {
      const device = await bridge.getDeviceConfig(payload.uid);
      if (device && device.remoteEnabled === false) {
        throw new Error(
          `Remote dinonaktifkan untuk device ini. Aktifkan di perangkat StarBox Anda.`
        );
      }
    } catch (err) {
      // Re-throw jika error dari kita sendiri (remoteEnabled check)
      if (err.message?.includes("Remote dinonaktifkan")) throw err;
      // Jika gagal baca config (device tidak ada di DB), biarkan handler yang menangani
    }
  }

  return handler(payload, bridge);
}

module.exports = { dispatchCommand, handlers };
