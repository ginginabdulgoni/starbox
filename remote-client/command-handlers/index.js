"use strict";

/**
 * Registry semua command handler.
 * Setiap handler adalah async function(payload, bridge) -> result | throws Error
 */

const deviceCommands = require("./device-commands");
const tabCommands    = require("./tab-commands");
const jsCommands     = require("./js-commands");

const handlers = {
  ...deviceCommands,
  ...tabCommands,
  ...jsCommands,
};

/**
 * Dispatch command ke handler yang tepat.
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
  return handler(payload, bridge);
}

module.exports = { dispatchCommand, handlers };
