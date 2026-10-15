// ═══════════════════════════════════════════════════════════════════════════════
// StarBox Module Loader
//
// Fitur StarBox dipecah menjadi modul. Setiap modul adalah folder berisi
// manifest.json + entry main/renderer/page. Modul bisa:
//   - bawaan  : <app>/modules/<id>           (ikut ter-bundle di installer)
//   - terpasang: <userData>/modules/<id>     (diunduh dari katalog, menimpa bawaan
//                                             bila versinya lebih baru)
//
// Transparansi: setiap modul WAJIB mendeklarasikan channel IPC dan izin yang
// dipakai di manifest. Channel yang tidak dideklarasikan ditolak saat register,
// dan preload hanya meneruskan channel yang dideklarasikan modul aktif.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const MANIFEST_FILE = "manifest.json";
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/;
const KNOWN_PERMISSIONS = new Set([
  "network",        // akses jaringan (http, socket, scan LAN)
  "child_process",  // menjalankan program lain
  "filesystem",     // baca/tulis file di luar folder data modul
  "dialog",         // membuka dialog simpan/buka file
  "system-install", // memasang software sistem (brew/apt/winget)
  "screen-capture", // menangkap / merekam layar
  "global-shortcut", // shortcut keyboard global (aktif walau StarBox tidak fokus)
]);

function compareVersions(a, b) {
  const pa = String(a || "0").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function validateManifest(manifest, dir) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return ["manifest.json tidak valid"];
  if (!ID_PATTERN.test(manifest.id || "")) errors.push("id harus huruf kecil/angka/-");
  if (path.basename(dir) !== manifest.id) errors.push(`nama folder harus sama dengan id (${manifest.id})`);
  if (!manifest.name) errors.push("name wajib diisi");
  if (!manifest.version) errors.push("version wajib diisi");
  for (const perm of manifest.permissions || []) {
    if (!KNOWN_PERMISSIONS.has(perm)) errors.push(`izin tidak dikenal: ${perm}`);
  }
  if (manifest.iconImage && !/\.(svg|png)$/i.test(manifest.iconImage)) errors.push("iconImage harus .svg atau .png");
  for (const dep of [...(manifest.rendererDeps || []), ...(manifest.styleDeps || [])]) {
    if (!/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//.test(dep)) {
      errors.push(`rendererDeps hanya boleh dari cdnjs/jsdelivr: ${dep}`);
    }
  }
  for (const key of ["main", "renderer", "page", "style", "i18n", "iconImage"]) {
    const rel = manifest[key];
    if (!rel) continue;
    const abs = path.resolve(dir, rel);
    if (!abs.startsWith(dir + path.sep)) errors.push(`${key} harus berada di dalam folder modul`);
    else if (!fs.existsSync(abs)) errors.push(`${key} tidak ditemukan: ${rel}`);
  }
  return errors;
}

class ModuleLoader {
  /**
   * @param {object} opts
   * @param {string} opts.builtinDir   folder modul bawaan (di dalam app)
   * @param {string} opts.installDir   folder modul terpasang (userData/modules)
   * @param {string} opts.statePath    file JSON status aktif/nonaktif modul
   * @param {string} opts.appVersion   versi StarBox, untuk cek `engine`
   * @param {object} opts.electron     { ipcMain, app, BrowserWindow, dialog, shell }
   * @param {Function} opts.coreRequire require milik core, untuk sharedDependencies
   * @param {object} [opts.services]   fungsi core yang boleh dipakai modul (manifest.coreServices)
   * @param {string} [opts.corePreload] path preload.cjs core, untuk jendela milik modul
   * @param {boolean} [opts.loadDownloadModulesFromBuiltin] true saat development
   */
  constructor(opts) {
    this.opts = opts;
    this.modules = new Map(); // id → record
    this.state = readJson(opts.statePath, { disabled: [] });
  }

  _saveState() {
    try {
      fs.mkdirSync(path.dirname(this.opts.statePath), { recursive: true });
      fs.writeFileSync(this.opts.statePath, JSON.stringify(this.state, null, 2));
    } catch (err) {
      console.warn("⚠️ Gagal menyimpan status modul:", err?.message || err);
    }
  }

  _scanDir(dir, source) {
    const found = [];
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return found;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const moduleDir = path.join(dir, entry.name);
      const manifest = readJson(path.join(moduleDir, MANIFEST_FILE), null);
      if (!manifest) continue;
      found.push({ dir: moduleDir, manifest, source, errors: validateManifest(manifest, moduleDir) });
    }
    return found;
  }

  /** Cari semua modul. Modul terpasang menang bila versinya >= bawaan. */
  discover() {
    const candidates = [
      ...this._scanDir(this.opts.builtinDir, "builtin"),
      ...this._scanDir(this.opts.installDir, "installed"),
    ];
    for (const c of candidates) {
      const id = c.manifest.id;
      // Modul "download" (mis. WhatsApp Gateway) hanya dimuat dari bundel saat
      // development; di build rilis ia harus dipasang dari katalog.
      if (c.source === "builtin" && c.manifest.distribution === "download" && !this.opts.loadDownloadModulesFromBuiltin) {
        continue;
      }
      const existing = this.modules.get(id);
      if (existing && compareVersions(c.manifest.version, existing.manifest.version) < 0) continue;
      this.modules.set(id, {
        ...c,
        id,
        enabled: !this.state.disabled.includes(id),
        loaded: false,
        loadError: null,
        exports: null,
        channels: new Set(),
        listeners: [],
      });
    }
    return this.list();
  }

  _guardedIpcMain(record) {
    const { ipcMain } = this.opts.electron;
    const declaredInvoke = new Set(record.manifest.ipc?.invoke || []);
    const declaredSend = new Set(record.manifest.ipc?.send || []);
    const check = (channel, declared, key) => {
      if (!declared.has(channel)) {
        throw new Error(`[${record.id}] channel IPC "${channel}" tidak dideklarasikan di manifest.ipc.${key}`);
      }
    };
    return {
      handle: (channel, fn) => {
        check(channel, declaredInvoke, "invoke");
        ipcMain.handle(channel, fn);
        record.channels.add(channel);
      },
      on: (channel, fn) => {
        check(channel, declaredSend, "send");
        ipcMain.on(channel, fn);
        record.listeners.push([channel, fn]);
      },
      removeHandler: (channel) => { ipcMain.removeHandler(channel); record.channels.delete(channel); },
    };
  }

  _context(record) {
    const { app } = this.opts.electron;
    const allowedShared = new Set(record.manifest.sharedDependencies || []);
    const dataDir = path.join(app.getPath("userData"), "module-data", record.id);
    const services = {};
    for (const name of record.manifest.coreServices || []) {
      if (typeof this.opts.services?.[name] !== "function") {
        throw new Error(`[${record.id}] layanan core tidak tersedia: ${name}`);
      }
      services[name] = this.opts.services[name];
    }
    return {
      id: record.id,
      manifest: record.manifest,
      moduleDir: record.dir,
      electron: { ...this.opts.electron, ipcMain: this._guardedIpcMain(record) },
      paths: {
        userData: app.getPath("userData"),
        data: dataDir,
        corePreload: this.opts.corePreload,
        appIcon: this.opts.appIcon,
      },
      services,
      log: (...args) => console.log(`[mod:${record.id}]`, ...args),
      /** API modul lain yang dideklarasikan di manifest.optionalModules (null bila tidak terpasang). */
      getModuleApi: (id) => {
        if (!(record.manifest.optionalModules || []).includes(id)) {
          throw new Error(`[${record.id}] modul "${id}" belum dideklarasikan di manifest.optionalModules`);
        }
        return this.getApi(id);
      },
      /** Paket npm milik core yang boleh dipakai modul (dideklarasikan di manifest). */
      requireShared: (name) => {
        if (!allowedShared.has(name)) {
          throw new Error(`[${record.id}] "${name}" belum dideklarasikan di manifest.sharedDependencies`);
        }
        return this.opts.coreRequire(name);
      },
    };
  }

  /** Muat sisi main process semua modul aktif yang valid. */
  loadAll() {
    if (this.modules.size === 0) this.discover();
    for (const record of this.modules.values()) {
      if (!record.enabled) continue;
      if (record.errors.length) {
        record.loadError = record.errors.join("; ");
        console.warn(`⚠️ Modul ${record.id} dilewati: ${record.loadError}`);
        continue;
      }
      const engine = record.manifest.engine?.starbox;
      if (engine && compareVersions(this.opts.appVersion, engine.replace(/^>=\s*/, "")) < 0) {
        record.loadError = `butuh StarBox ${engine}`;
        console.warn(`⚠️ Modul ${record.id} dilewati: ${record.loadError}`);
        continue;
      }
      const pkgPath = path.join(record.dir, "package.json");
      const pkg = readJson(pkgPath, null);
      if (pkg && Object.keys(pkg.dependencies || {}).length && !fs.existsSync(path.join(record.dir, "node_modules"))) {
        record.loadError = record.source === "builtin"
          ? "dependensi modul belum terpasang (developer: jalankan npm run modules:install)"
          : "paket modul tidak lengkap (node_modules hilang) — pasang ulang modul";
        console.warn(`⚠️ Modul ${record.id} dilewati: ${record.loadError}`);
        continue;
      }
      try {
        if (record.manifest.main) {
          record.exports = require(path.join(record.dir, record.manifest.main));
          record.exports.register?.(this._context(record));
        }
        record.loaded = true;
        console.log(`🧩 Modul dimuat: ${record.manifest.name} v${record.manifest.version} (${record.source})`);
      } catch (err) {
        record.loadError = err?.message || String(err);
        console.error(`❌ Gagal memuat modul ${record.id}:`, record.loadError);
        // Lepas handler yang sempat terdaftar sebelum gagal
        for (const channel of record.channels) this.opts.electron.ipcMain.removeHandler(channel);
        for (const [channel, fn] of record.listeners) this.opts.electron.ipcMain.removeListener(channel, fn);
        record.channels.clear();
        record.listeners = [];
      }
    }
  }

  /** Inisialisasi yang butuh app siap (dipanggil core setelah whenReady). */
  async startAll() {
    for (const record of this.modules.values()) {
      if (!record.loaded || typeof record.exports?.start !== "function") continue;
      try {
        await record.exports.start();
      } catch (err) {
        console.error(`❌ Start modul ${record.id} gagal:`, err?.message || err);
      }
    }
  }

  isLoaded(id) {
    return !!this.modules.get(id)?.loaded;
  }

  /**
   * API publik modul untuk dipakai core / fitur lain (mis. MikroTik memakai
   * koneksi Remox). null bila modul tidak termuat.
   */
  getApi(id) {
    const record = this.modules.get(id);
    return record?.loaded ? record.exports?.api || null : null;
  }

  getStats(id) {
    const record = this.modules.get(id);
    if (!record?.loaded) return null;
    try {
      return record.exports?.getStats?.() || null;
    } catch {
      return null;
    }
  }

  shutdownAll() {
    for (const record of this.modules.values()) {
      if (!record.loaded) continue;
      try {
        record.exports?.shutdown?.();
      } catch (err) {
        console.warn(`⚠️ Shutdown modul ${record.id} gagal:`, err?.message || err);
      }
    }
  }

  setEnabled(id, enabled) {
    if (!this.modules.has(id)) return false;
    const disabled = new Set(this.state.disabled);
    if (enabled) disabled.delete(id);
    else disabled.add(id);
    this.state.disabled = [...disabled];
    this._saveState();
    this.modules.get(id).enabled = !!enabled;
    return true;
  }

  /** Ringkasan untuk halaman Modul (tanpa objek internal). */
  list() {
    return [...this.modules.values()].map((r) => ({
      id: r.id,
      name: r.manifest.name,
      version: r.manifest.version,
      description: r.manifest.description || "",
      author: r.manifest.author || "",
      license: r.manifest.license || "",
      homepage: r.manifest.homepage || "",
      icon: r.manifest.icon || r.manifest.sidebar?.icon || "bi-puzzle",
      iconUrl: r.manifest.iconImage ? pathToFileURL(path.join(r.dir, r.manifest.iconImage)).href : null,
      source: r.source,
      enabled: r.enabled,
      loaded: r.loaded,
      error: r.loadError || (r.errors.length ? r.errors.join("; ") : null),
      distribution: r.manifest.distribution || "bundled",
      permissions: r.manifest.permissions || [],
      ipc: r.manifest.ipc || {},
      sharedDependencies: r.manifest.sharedDependencies || [],
      coreServices: r.manifest.coreServices || [],
      optionalModules: r.manifest.optionalModules || [],
      rendererDeps: r.manifest.rendererDeps || [],
    }));
  }

  /** Daftar channel yang boleh diteruskan preload (hanya modul yang termuat). */
  bridgeConfig() {
    const invoke = [];
    const send = [];
    const events = [];
    for (const r of this.modules.values()) {
      if (!r.loaded) continue;
      invoke.push(...(r.manifest.ipc?.invoke || []));
      send.push(...(r.manifest.ipc?.send || []));
      events.push(...(r.manifest.ipc?.events || []));
    }
    return { invoke, send, events };
  }

  /** Data UI renderer: halaman, sidebar, script, style, terjemahan. */
  rendererConfig() {
    const out = [];
    for (const r of this.modules.values()) {
      if (!r.loaded) continue;
      const m = r.manifest;
      const fileUrl = (rel) => (rel ? pathToFileURL(path.join(r.dir, rel)).href : null);
      let pageHtml = "";
      if (m.page) {
        try { pageHtml = fs.readFileSync(path.join(r.dir, m.page), "utf8"); } catch {}
      }
      out.push({
        id: r.id,
        name: m.name,
        sidebar: m.sidebar || null,
        pageAfter: m.pageAfter || m.sidebar?.after || null,
        pageLabel: m.pageLabel || m.sidebar?.statsLabel || null,
        rendererDeps: m.rendererDeps || [],
        styleDeps: m.styleDeps || [],
        pageHtml,
        script: fileUrl(m.renderer),
        style: fileUrl(m.style),
        iconUrl: fileUrl(m.iconImage),
        i18n: m.i18n ? readJson(path.join(r.dir, m.i18n), {}) : {},
      });
    }
    return out;
  }
}

module.exports = { ModuleLoader, compareVersions, validateManifest };
