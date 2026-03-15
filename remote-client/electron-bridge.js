"use strict";

/**
 * ElectronBridge: abstraksi layer antara remote command handlers
 * dan Electron internals (deviceWindows, ipcMain, DB, dll).
 *
 * Cara pakai di electron-main.js:
 *
 *   const ElectronBridge = require("./remote-client/electron-bridge");
 *   const bridge = new ElectronBridge({ deviceWindows, ipcMain, getDeviceConfig });
 *
 * Bridge ini memberikan akses terstruktur tanpa perlu import langsung
 * ke variable global electron-main.js.
 */

const path = require("path");
const fs   = require("fs");

class ElectronBridge {
  /**
   * @param {object} opts
   * @param {object} opts.deviceWindows   - Map uid -> BrowserWindow (dari electron-main.js)
   * @param {object} opts.ipcMain         - ipcMain dari Electron
   * @param {Function} opts.getDeviceConfig - async (uid) -> device object | null
   * @param {string}   opts.dbPath        - path ke devices.json
   * @param {string}   opts.dbPathAndroid - path ke devices-android.json
   */
  constructor({ deviceWindows, ipcMain, getDeviceConfig, dbPath, dbPathAndroid }) {
    this._deviceWindows   = deviceWindows;
    this._ipcMain         = ipcMain;
    this._getDeviceConfig = getDeviceConfig;
    this._dbPath          = dbPath;
    this._dbPathAndroid   = dbPathAndroid;

    // Buat interface IPC agar command handlers bisa invoke/send ke handler yang sudah terdaftar
    this.ipc = this._buildIpcInterface();
  }

  // ─── Device Windows ──────────────────────────────────────────────────────

  /**
   * Cek apakah device sedang berjalan (window ada dan tidak destroyed).
   * @param {string} uid
   * @returns {boolean}
   */
  isDeviceRunning(uid) {
    const win = this._deviceWindows[uid];
    return !!(win && !win.isDestroyed());
  }

  /**
   * Ambil semua UID device yang sedang running.
   * @returns {string[]}
   */
  getRunningDeviceUids() {
    return Object.keys(this._deviceWindows).filter((uid) => this.isDeviceRunning(uid));
  }

  /**
   * Ambil WebContents dari device window.
   * @param {string} uid
   * @returns {Electron.WebContents|null}
   */
  getWebContents(uid) {
    const win = this._deviceWindows[uid];
    if (!win || win.isDestroyed()) return null;
    return win.webContents || null;
  }

  /**
   * Ambil informasi tab (url, title, loading) dari device window.
   * @param {string} uid
   * @returns {{ url: string, title: string, loading: boolean }}
   */
  async getTabInfo(uid) {
    const wc = this.getWebContents(uid);
    if (!wc || wc.isDestroyed()) {
      return { url: null, title: null, loading: false };
    }
    return {
      url:     wc.getURL(),
      title:   wc.getTitle(),
      loading: wc.isLoading(),
    };
  }

  // ─── Device Config ───────────────────────────────────────────────────────

  /**
   * Ambil konfigurasi device dari DB.
   * @param {string} uid
   * @returns {Promise<object|null>}
   */
  async getDeviceConfig(uid) {
    return this._getDeviceConfig(uid);
  }

  // ─── IPC Interface ───────────────────────────────────────────────────────

  /**
   * Bangun interface IPC yang bisa dipanggil dari command handlers.
   * Simulasi ipcRenderer.invoke/send tetapi dari main process langsung.
   *
   * Karena kita ada di main process, kita panggil handler IPC secara langsung
   * tanpa melalui IPC channel yang sebenarnya.
   *
   * Di implementasi nyata, ini bisa diganti dengan memanggil fungsi
   * yang sama yang digunakan oleh handler ipcMain.handle.
   */
  _buildIpcInterface() {
    const self = this;

    return {
      /**
       * Invoke IPC handler langsung (di main process).
       * Ini adalah placeholder — di integrasi nyata, panggil fungsi internal
       * dari electron-main.js yang sudah di-export.
       */
      invoke: async (channel, ...args) => {
        if (!self._ipcHandlers || !self._ipcHandlers[channel]) {
          throw new Error(`IPC handler '${channel}' tidak terdaftar di bridge`);
        }
        return self._ipcHandlers[channel](...args);
      },

      /** Kirim IPC event ke semua window (one-way) */
      send: (channel, ...args) => {
        const { BrowserWindow } = require("electron");
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send(channel, ...args);
          }
        });
      },
    };
  }

  /**
   * Daftarkan IPC handlers agar bridge.ipc.invoke bisa bekerja.
   * Dipanggil dari electron-main.js setelah handler-handler didefinisikan.
   *
   * @param {object} handlers - { [channel]: async function(...args) }
   */
  registerIpcHandlers(handlers) {
    this._ipcHandlers = handlers;
  }
}

module.exports = ElectronBridge;
