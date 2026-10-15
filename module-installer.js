// ═══════════════════════════════════════════════════════════════════════════════
// StarBox Module Installer — katalog, unduh, verifikasi, pasang, hapus
//
// Katalog (JSON) mendaftar modul yang bisa dipasang:
//   { "modules": [ { "id", "name", "version", "description", "url",
//                    "sha256", "size", "permissions": [...] } ] }
//
// Aturan keamanan (mengikuti pola craft-launcher):
//   - unduhan hanya dari host katalog atau GitHub Releases, lewat HTTPS
//     (file:// hanya bila katalognya sendiri file lokal, untuk developer)
//   - setiap zip dicek SHA-256 dari katalog SEBELUM diekstrak
//   - zip diekstrak ke folder staging, manifest-nya harus cocok dengan katalog
//   - modul yang sedang termuat tidak ditimpa di tempat; perubahan berlaku
//     setelah restart
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { URL, fileURLToPath } = require("url");

const MAX_CATALOG_BYTES = 1024 * 1024;
const MAX_MODULE_BYTES = 300 * 1024 * 1024;
const GITHUB_HOSTS = [
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function httpsGet(url, { maxBytes, allowedHosts, onProgress, hops = 0 }) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`URL tidak valid: ${url}`));
      return;
    }
    if (parsed.protocol !== "https:") {
      reject(new Error(`Hanya HTTPS yang diizinkan: ${url}`));
      return;
    }
    if (!allowedHosts.includes(parsed.hostname)) {
      reject(new Error(`Host tidak diizinkan: ${parsed.hostname}`));
      return;
    }
    const req = https.get(parsed, { timeout: 60000, headers: { "User-Agent": "StarBox-Modules" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        const loc = res.headers.location;
        if (!loc || hops >= 5) {
          reject(new Error("Redirect tidak valid"));
          return;
        }
        httpsGet(new URL(loc, parsed).href, { maxBytes, allowedHosts, onProgress, hops: hops + 1 })
          .then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} untuk ${parsed.hostname}${parsed.pathname}`));
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10) || 0;
      if (total > maxBytes) {
        res.resume();
        reject(new Error("Ukuran unduhan melebihi batas"));
        return;
      }
      const chunks = [];
      let received = 0;
      res.on("data", (chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          req.destroy(new Error("Ukuran unduhan melebihi batas"));
          return;
        }
        chunks.push(chunk);
        onProgress?.(received, total);
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Koneksi timeout")));
    req.on("error", reject);
  });
}

class ModuleInstaller {
  /**
   * @param {object} opts
   * @param {string} opts.catalogSource URL https katalog, atau path/file:// lokal (developer)
   * @param {string} opts.installDir    <userData>/modules
   * @param {Function} opts.validateManifest (manifest, dir) => string[]
   */
  constructor(opts) {
    this.opts = opts;
    this.catalog = null;
    this.busy = new Set();
    const src = opts.catalogSource || "";
    this.localCatalogPath = null;
    if (src.startsWith("file:")) this.localCatalogPath = fileURLToPath(src);
    else if (src && !/^https?:/i.test(src)) this.localCatalogPath = path.resolve(src);
    this.allowedHosts = [...GITHUB_HOSTS];
    if (!this.localCatalogPath) {
      try {
        this.allowedHosts.push(new URL(src).hostname);
      } catch {}
    }
  }

  _sanitizeEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const { id, name, version, url, sha256 } = entry;
    if (!ID_PATTERN.test(id || "") || !version || !url || !SHA256_PATTERN.test(String(sha256 || "").toLowerCase())) {
      return null;
    }
    return {
      id,
      name: String(name || id),
      version: String(version),
      description: String(entry.description || ""),
      url: String(url),
      sha256: String(sha256).toLowerCase(),
      size: Number(entry.size) || 0,
      permissions: Array.isArray(entry.permissions) ? entry.permissions.map(String) : [],
      icon: typeof entry.icon === "string" ? entry.icon : "bi-puzzle",
    };
  }

  async fetchCatalog() {
    let raw;
    if (this.localCatalogPath) {
      raw = fs.readFileSync(this.localCatalogPath);
    } else if (this.opts.catalogSource) {
      raw = await httpsGet(this.opts.catalogSource, {
        maxBytes: MAX_CATALOG_BYTES,
        allowedHosts: this.allowedHosts,
      });
    } else {
      raw = Buffer.from('{"modules":[]}');
    }
    let data;
    try {
      data = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new Error("Katalog modul tidak valid (bukan JSON)");
    }
    const modules = (Array.isArray(data?.modules) ? data.modules : [])
      .map((e) => this._sanitizeEntry(e))
      .filter(Boolean);
    this.catalog = { modules, fetchedAt: Date.now() };
    return this.catalog;
  }

  async _download(entry, onProgress) {
    if (entry.url.startsWith("file:")) {
      if (!this.localCatalogPath) throw new Error("file:// hanya diizinkan untuk katalog lokal");
      return fs.readFileSync(fileURLToPath(entry.url));
    }
    if (this.localCatalogPath && !/^https:/i.test(entry.url)) {
      // path relatif terhadap katalog lokal
      return fs.readFileSync(path.resolve(path.dirname(this.localCatalogPath), entry.url));
    }
    return httpsGet(entry.url, {
      maxBytes: Math.min(MAX_MODULE_BYTES, entry.size ? Math.ceil(entry.size * 1.05) + 1024 : MAX_MODULE_BYTES),
      allowedHosts: this.allowedHosts,
      onProgress,
    });
  }

  /**
   * Unduh + verifikasi + pasang. Berlaku setelah restart.
   * @param {string} id
   * @param {(p: {phase: string, pct: number, message: string}) => void} onProgress
   */
  async install(id, onProgress = () => {}) {
    if (this.busy.has(id)) throw new Error("Modul ini sedang diproses");
    this.busy.add(id);
    const stagingRoot = path.join(this.opts.installDir, ".staging");
    const zipPath = path.join(stagingRoot, `${id}.zip`);
    const stagingDir = path.join(stagingRoot, id);
    try {
      const catalog = this.catalog || (await this.fetchCatalog());
      const entry = catalog.modules.find((m) => m.id === id);
      if (!entry) throw new Error(`Modul "${id}" tidak ada di katalog`);

      onProgress({ phase: "download", pct: 0, message: `Mengunduh ${entry.name} v${entry.version}...` });
      const data = await this._download(entry, (received, total) => {
        const size = total || entry.size;
        const pct = size ? Math.min(99, Math.round((received / size) * 100)) : 0;
        onProgress({ phase: "download", pct, message: `Mengunduh ${(received / 1048576).toFixed(1)} MB` });
      });

      onProgress({ phase: "verify", pct: 100, message: "Memeriksa SHA-256..." });
      const digest = crypto.createHash("sha256").update(data).digest("hex");
      if (digest !== entry.sha256) {
        throw new Error(`SHA-256 tidak cocok (diharapkan ${entry.sha256.slice(0, 12)}…, didapat ${digest.slice(0, 12)}…). Unduhan ditolak.`);
      }

      onProgress({ phase: "extract", pct: 100, message: "Mengekstrak..." });
      fs.rmSync(stagingRoot, { recursive: true, force: true });
      fs.mkdirSync(stagingDir, { recursive: true });
      fs.writeFileSync(zipPath, data);
      // extract-zip menolak entri yang keluar dari folder tujuan (zip-slip)
      await require("extract-zip")(zipPath, { dir: stagingDir });

      const manifest = JSON.parse(fs.readFileSync(path.join(stagingDir, "manifest.json"), "utf8"));
      if (manifest.id !== entry.id || String(manifest.version) !== entry.version) {
        throw new Error(`Isi paket (${manifest.id} v${manifest.version}) tidak cocok dengan katalog (${entry.id} v${entry.version})`);
      }
      const errors = this.opts.validateManifest(manifest, stagingDir);
      if (errors.length) throw new Error(`Manifest tidak valid: ${errors.join("; ")}`);

      const target = path.join(this.opts.installDir, id);
      const trash = path.join(this.opts.installDir, `.trash-${id}-${Date.now()}`);
      if (fs.existsSync(target)) fs.renameSync(target, trash);
      fs.renameSync(stagingDir, target);
      fs.rmSync(trash, { recursive: true, force: true });

      onProgress({ phase: "done", pct: 100, message: `${entry.name} v${entry.version} terpasang. Restart StarBox untuk mengaktifkan.` });
      return { success: true, id, version: entry.version, restartRequired: true };
    } finally {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
      this.busy.delete(id);
    }
  }

  /** Hapus modul terpasang (data modul di userData tidak ikut dihapus). */
  uninstall(id) {
    if (!ID_PATTERN.test(id || "")) throw new Error("id modul tidak valid");
    const target = path.join(this.opts.installDir, id);
    if (!fs.existsSync(path.join(target, "manifest.json"))) {
      throw new Error("Modul ini tidak terpasang dari katalog");
    }
    fs.rmSync(target, { recursive: true, force: true });
    return { success: true, restartRequired: true };
  }
}

module.exports = { ModuleInstaller };
