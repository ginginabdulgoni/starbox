// ═══════════════════════════════════════════════════════════════════════════════
// Modul ArtCraft Apps — pasang, perbarui & buka aplikasi Craft App Suite
// (PhotoCraft, WordCraft, FilmCraft, …) dari StarBox.
//
// Mengikuti aturan ArtCraft Launcher (github.com/storytold/craft-launcher):
//   - info rilis dari feed resmi https://api.storyteller.ai/v1/craft_apps/release_info;
//     bila feed tidak menjawab: redirect `releases/latest` GitHub + SHA256SUMS.txt
//   - unduhan HANYA dari https://github.com/storytold/<app>/releases (dan CDN asetnya)
//   - setiap file dicek SHA-256 sebelum dipasang
//   - aplikasi yang sedang berjalan tidak ditimpa
// Lokasi pemasangan:
//   macOS   /Applications/<App>.app (DMG resmi, signed & notarized; ~/Applications bila
//           /Applications tidak bisa ditulis)
//   Windows %LOCALAPPDATA%\StarBox\CraftApps\<app> (zip portable — tanpa admin/UAC)
//   Linux   ~/Applications/<App>.AppImage
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const { URL } = require("url");

const FEED_URL = "https://api.storyteller.ai/v1/craft_apps/release_info";
const OWNER = "storytold";
const ALLOWED_HOSTS = new Set([
  "api.storyteller.ai",
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024;
const FEED_TTL_MS = 10 * 60 * 1000;

// Halaman detail tiap aplikasi — teks dari ArtCraft Launcher (details.rs, MIT)
const DETAILS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "details.json"), "utf8"));
  } catch {
    return { apps: {} };
  }
})();

// Craft App Suite (urutan & tagline dari craft-launcher core/catalog.rs)
const SUITE = [
  { id: "photocraft", name: "PhotoCraft", tagline: "Image editing", color: "#2f7bf5" },
  { id: "vectorcraft", name: "VectorCraft", tagline: "Vector illustration", color: "#e8573f" },
  { id: "filmcraft", name: "FilmCraft", tagline: "Video editing, color and sound", color: "#8b5cf6" },
  { id: "lightcraft", name: "LightCraft", tagline: "Photo library and raw development", color: "#f2a516" },
  { id: "pdfcraft", name: "PdfCraft", tagline: "Reading, organizing and protecting PDFs", color: "#12a58a" },
  { id: "effectcraft", name: "EffectCraft", tagline: "Motion graphics and visual effects", color: "#e0368f" },
  { id: "designcraft", name: "DesignCraft", tagline: "Page layout and publishing", color: "#7bb51c" },
  { id: "wordcraft", name: "WordCraft", tagline: "Writing and document design", color: "#3f5fe0" },
  { id: "deckcraft", name: "DeckCraft", tagline: "Presentations and slide shows", color: "#f07a1e" },
  { id: "gridcraft", name: "GridCraft", tagline: "Spreadsheets and data", color: "#1f9d55" },
  { id: "cadcraft", name: "CADCraft", tagline: "Computer-aided design and drafting", color: "#3ea6e8" },
  { id: "soundcraft", name: "SoundCraft", tagline: "Recording, editing and mixing audio", color: "#1fa5c9" },
  { id: "figcraft", name: "FigCraft", tagline: "Interface design and prototyping", color: "#02da96" },
];

// ── Utilitas ──────────────────────────────────────────────────────────────────

function compareVersions(a, b) {
  const pa = String(a || "0").split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** GET via HTTPS ke host yang diizinkan, ikuti redirect. `stream` → tulis ke file. */
function httpsRequest(url, { maxBytes = MAX_JSON_BYTES, toFile = null, onProgress = null, followRedirects = true, hops = 0 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return reject(new Error(`URL tidak valid: ${url}`));
    }
    if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) {
      return reject(new Error(`Host tidak diizinkan: ${u.hostname}`));
    }
    if (u.hostname === "github.com" && !u.pathname.startsWith(`/${OWNER}/`)) {
      return reject(new Error(`Hanya rilis github.com/${OWNER} yang diizinkan`));
    }
    const req = https.get(u, { timeout: 60000, headers: { "User-Agent": "StarBox-ArtCraft" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        const loc = res.headers.location;
        if (!followRedirects) return resolve({ redirect: loc ? new URL(loc, u).href : null, status: res.statusCode });
        if (!loc || hops >= 6) return reject(new Error("Redirect tidak valid"));
        return httpsRequest(new URL(loc, u).href, { maxBytes, toFile, onProgress, followRedirects, hops: hops + 1 }).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} (${u.hostname}${u.pathname})`));
      }
      const total = parseInt(res.headers["content-length"] || "0", 10) || 0;
      if (total > maxBytes) {
        res.resume();
        return reject(new Error("Ukuran unduhan melebihi batas"));
      }
      let received = 0;
      const hash = crypto.createHash("sha256");
      const chunks = [];
      const out = toFile ? fs.createWriteStream(toFile) : null;
      res.on("data", (c) => {
        received += c.length;
        if (received > maxBytes) return req.destroy(new Error("Ukuran unduhan melebihi batas"));
        hash.update(c);
        if (out) out.write(c);
        else chunks.push(c);
        onProgress?.(received, total);
      });
      res.on("end", () => {
        const sha256 = hash.digest("hex");
        if (out) out.end(() => resolve({ sha256, size: received }));
        else resolve({ body: Buffer.concat(chunks), sha256, size: received });
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Koneksi timeout")));
    req.on("error", reject);
  });
}

async function getJson(url) {
  const { body } = await httpsRequest(url);
  return JSON.parse(body.toString("utf8"));
}

// ── Platform & aset ───────────────────────────────────────────────────────────

const PLATFORM = (() => {
  const osName = { darwin: "macos", win32: "windows", linux: "linux" }[process.platform] || null;
  const arch = { x64: "x64", arm64: "arm64", ia32: "x86" }[process.arch] || null;
  return { os: osName, arch };
})();

/** Paket yang dipasang StarBox untuk platform ini, urut preferensi. */
function wantedPackages() {
  if (PLATFORM.os === "macos") return [{ os: "macos", arch: "universal", type: "dmg" }];
  if (PLATFORM.os === "windows") {
    const archs = PLATFORM.arch === "arm64" ? ["arm64", "x64"] : PLATFORM.arch === "x86" ? ["x86"] : ["x64"];
    return archs.map((arch) => ({ os: "windows", arch, type: "portable_zip" }));
  }
  if (PLATFORM.os === "linux") return [{ os: "linux", arch: PLATFORM.arch, type: "app_image" }];
  return [];
}

function pickAsset(release) {
  for (const want of wantedPackages()) {
    const a = (release?.assets || []).find((x) =>
      x.platform && x.platform.os === want.os && x.platform.arch === want.arch && x.platform.package_type === want.type);
    if (a) return a;
  }
  return null;
}

// Fallback tanpa feed: nama file `<app>-<ver>-<os>-<arch>[-portable].<ext>`
function parseAssetName(app, name) {
  const m = name.match(new RegExp(`^${app}-(\\d[^-]*(?:-[a-z]+\\.?\\d*)?)-(macos|windows|linux|freebsd)-([a-z0-9_]+?)(-portable)?\\.(dmg|msi|zip|AppImage|deb|rpm|tar\\.gz)$`));
  if (!m) return null;
  const [, version, osName, rawArch, portable, ext] = m;
  const arch = { x86_64: "x64", aarch64: "arm64", universal: "universal" }[rawArch] || rawArch;
  const type = ext === "dmg" ? "dmg" : ext === "AppImage" ? "app_image" : ext === "zip" && portable ? "portable_zip" : ext === "zip" ? "zip" : ext;
  return { version, platform: { os: osName, arch, package_type: type } };
}

async function releaseFromGithub(app) {
  const latest = await httpsRequest(`https://github.com/${OWNER}/${app}/releases/latest`, { followRedirects: false });
  const tag = (latest.redirect || "").split("/tag/")[1];
  if (!tag) throw new Error(`Rilis terbaru ${app} tidak ditemukan`);
  const base = `https://github.com/${OWNER}/${app}/releases/download/${tag}/`;
  const { body } = await httpsRequest(base + "SHA256SUMS.txt");
  const assets = [];
  let version = tag.replace(/^v/, "");
  for (const line of body.toString("utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (!m) continue;
    const parsed = parseAssetName(app, m[2]);
    if (!parsed) continue;
    version = parsed.version;
    assets.push({ name: m[2], sha256: m[1].toLowerCase(), download_url: base + m[2], platform: parsed.platform });
  }
  return { tag, version, html_url: `https://github.com/${OWNER}/${app}/releases/tag/${tag}`, published_at: null, assets };
}

// ── Feed (cache 10 menit) ─────────────────────────────────────────────────────

let feedCache = null;
let feedFetchedAt = 0;
let feedError = null;

async function loadReleases(force = false) {
  if (!force && feedCache && Date.now() - feedFetchedAt < FEED_TTL_MS) return feedCache;
  const releases = {};
  let notices = { announcements: [], alerts: [] };
  feedError = null;
  try {
    const feed = await getJson(FEED_URL);
    const apps = feed?.release_info?.apps || {};
    for (const app of SUITE) if (apps[app.id]?.latest_release) releases[app.id] = apps[app.id].latest_release;
    notices = feed?.important_notices || notices;
  } catch (err) {
    feedError = err.message;
  }
  // Aplikasi yang tidak ada di feed (atau feed gagal) → GitHub langsung
  await Promise.all(SUITE.filter((a) => !releases[a.id]).map(async (a) => {
    try {
      releases[a.id] = await releaseFromGithub(a.id);
    } catch (_) {}
  }));
  feedCache = { releases, notices };
  feedFetchedAt = Date.now();
  return feedCache;
}

// ── Deteksi aplikasi terpasang ────────────────────────────────────────────────

let statePath = null;
const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
};
const writeState = (s) => {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(s, null, 2));
};

const winAppsDir = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "StarBox", "CraftApps");
const linuxAppsDir = () => path.join(os.homedir(), "Applications");

function readMacBundle(app, bundlePath) {
  const plist = path.join(bundlePath, "Contents", "Info.plist");
  if (!fs.existsSync(plist)) return null;
  const r = spawnSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plist], { encoding: "utf8", timeout: 5000 });
  if (r.status !== 0) return null;
  try {
    const info = JSON.parse(r.stdout);
    if (info.CFBundleIdentifier !== `ai.storyteller.${app.id}`) return null;
    const version = info[`${app.name}Version`] || info.CFBundleShortVersionString || info.CFBundleVersion || null;
    return { version, path: bundlePath };
  } catch {
    return null;
  }
}

function readWindowsRegistry(app) {
  // Aplikasi yang dipasang lewat MSI resmi (oleh user / ArtCraft Launcher)
  for (const hive of ["HKCU", "HKLM"]) {
    const r = spawnSync("reg", ["query", `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`, "/s", "/f", app.name, "/d"], { encoding: "utf8", timeout: 8000, windowsHide: true });
    if (r.status !== 0 || !r.stdout) continue;
    for (const block of r.stdout.split(/\r?\n\r?\n/)) {
      if (!new RegExp(`DisplayName\\s+REG_SZ\\s+${app.name}\\s*$`, "m").test(block)) continue;
      const ver = block.match(/DisplayVersion\s+REG_SZ\s+(\S+)/);
      const loc = block.match(/InstallLocation\s+REG_SZ\s+(.+)/);
      return { version: ver ? ver[1] : null, path: loc ? loc[1].trim() : null, source: "msi" };
    }
  }
  return null;
}

function findExe(dir, app) {
  try {
    const names = fs.readdirSync(dir);
    const exact = names.find((n) => n.toLowerCase() === `${app.id}.exe`);
    return path.join(dir, exact || names.find((n) => n.toLowerCase().endsWith(".exe")) || "");
  } catch {
    return null;
  }
}

function detect(app) {
  const state = readState()[app.id];
  if (PLATFORM.os === "macos") {
    for (const dir of ["/Applications", path.join(os.homedir(), "Applications")]) {
      const found = readMacBundle(app, path.join(dir, `${app.name}.app`));
      if (found) return { ...found, source: state && state.path === found.path ? "starbox" : "external" };
    }
    return null;
  }
  if (PLATFORM.os === "windows") {
    if (state && fs.existsSync(state.path)) return { version: state.version, path: state.path, source: "starbox" };
    return readWindowsRegistry(app);
  }
  if (PLATFORM.os === "linux") {
    if (state && fs.existsSync(state.path)) return { version: state.version, path: state.path, source: "starbox" };
    const p = path.join(linuxAppsDir(), `${app.name}.AppImage`);
    return fs.existsSync(p) ? { version: null, path: p, source: "external" } : null;
  }
  return null;
}

function isRunning(installed) {
  if (!installed?.path || PLATFORM.os === "windows") return false;
  const needle = PLATFORM.os === "macos" ? path.join(installed.path, "Contents", "MacOS") : installed.path;
  const r = spawnSync("pgrep", ["-f", needle], { encoding: "utf8", timeout: 4000 });
  return r.status === 0 && !!r.stdout.trim();
}

// ── Pasang ────────────────────────────────────────────────────────────────────

const run = (cmd, args, timeout = 600000) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout, windowsHide: true });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} gagal: ${(r.stderr || r.stdout || r.error?.message || "").trim().slice(0, 300)}`);
  return r.stdout;
};

function installMac(app, file) {
  const mount = fs.mkdtempSync(path.join(os.tmpdir(), `starbox-${app.id}-mnt-`));
  run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-noautoopen", "-noverify", "-mountpoint", mount, file], 180000);
  try {
    const bundle = path.join(mount, `${app.name}.app`);
    if (!fs.existsSync(bundle)) throw new Error(`${app.name}.app tidak ada di DMG`);
    if (!readMacBundle(app, bundle)) throw new Error("Bundle di DMG bukan aplikasi yang diharapkan");
    let targetDir = "/Applications";
    try {
      fs.accessSync(targetDir, fs.constants.W_OK);
    } catch {
      targetDir = path.join(os.homedir(), "Applications");
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const target = path.join(targetDir, `${app.name}.app`);
    const staged = `${target}.starbox-new`;
    fs.rmSync(staged, { recursive: true, force: true });
    run("/usr/bin/ditto", ["--norsrc", "--noextattr", "--noacl", bundle, staged]);
    const old = `${target}.starbox-old`;
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(target)) fs.renameSync(target, old);
    fs.renameSync(staged, target);
    fs.rmSync(old, { recursive: true, force: true });
    return target;
  } finally {
    spawnSync("/usr/bin/hdiutil", ["detach", mount, "-force"], { timeout: 60000 });
    fs.rmSync(mount, { recursive: true, force: true });
  }
}

async function installWindows(app, file, extractZip) {
  const target = path.join(winAppsDir(), app.id);
  const staged = `${target}.starbox-new`;
  fs.rmSync(staged, { recursive: true, force: true });
  await extractZip(file, { dir: staged });
  // zip portable: exe di akar, atau di satu folder di dalamnya
  let root = staged;
  const entries = fs.readdirSync(staged);
  if (entries.length === 1 && fs.statSync(path.join(staged, entries[0])).isDirectory()) root = path.join(staged, entries[0]);
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(root, target);
  fs.rmSync(staged, { recursive: true, force: true });
  return target;
}

function installLinux(app, file) {
  const dir = linuxAppsDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${app.name}.AppImage`);
  fs.copyFileSync(file, `${target}.starbox-new`);
  fs.chmodSync(`${target}.starbox-new`, 0o755);
  fs.renameSync(`${target}.starbox-new`, target);
  return target;
}

// ── Registrasi ────────────────────────────────────────────────────────────────

function register(context) {
  const { ipcMain, app: electronApp, shell } = context.electron;
  const extractZip = context.requireShared("extract-zip");
  statePath = path.join(context.paths.data, "state.json");
  const busy = new Set();

  async function list(force = false) {
    const { releases, notices } = await loadReleases(force);
    const apps = SUITE.map((app) => {
      const rel = releases[app.id] || null;
      const installed = detect(app);
      const asset = rel ? pickAsset(rel) : null;
      return {
        ...app,
        icon: `https://raw.githubusercontent.com/${OWNER}/${app.id}/main/assets/app-icon/hicolor/128x128/apps/ai.storyteller.${app.id}.png`,
        repoUrl: `https://github.com/${OWNER}/${app.id}`,
        latest: rel ? {
          version: rel.version, tag: rel.tag, publishedAt: rel.published_at, url: rel.html_url,
          size: asset?.size_bytes || null, notes: rel.notes_markdown || null,
        } : null,
        details: DETAILS.apps?.[app.id]
          ? { ...DETAILS.apps[app.id], screenshotsBase: `${DETAILS.screenshotsBase}/${app.id}` }
          : null,
        installed: installed ? { version: installed.version, path: installed.path, source: installed.source } : null,
        installable: !!asset,
        updateAvailable: !!(installed?.version && rel?.version && compareVersions(rel.version, installed.version) > 0),
        busy: busy.has(app.id),
      };
    });
    return { platform: PLATFORM, apps, notices, feedError, fetchedAt: feedFetchedAt };
  }

  async function install(event, id) {
    const app = SUITE.find((a) => a.id === id);
    if (!app) throw new Error("Aplikasi tidak dikenal");
    if (busy.has(id)) throw new Error(`${app.name} sedang diproses`);
    const send = (phase, pct, message) => {
      if (!event.sender.isDestroyed()) event.sender.send("artcraft:progress", { id, phase, pct, message });
    };
    busy.add(id);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `starbox-${id}-`));
    try {
      const { releases } = await loadReleases(true);
      const rel = releases[id];
      const asset = rel && pickAsset(rel);
      if (!asset) throw new Error(`Belum ada build ${app.name} untuk ${PLATFORM.os}/${PLATFORM.arch}`);
      if (!/^[a-f0-9]{64}$/i.test(asset.sha256 || "")) throw new Error("Rilis tidak menyertakan SHA-256 — dibatalkan");
      const existing = detect(app);
      if (existing && isRunning(existing)) throw new Error(`${app.name} sedang berjalan. Tutup dulu, lalu coba lagi.`);

      const file = path.join(tmp, asset.name);
      send("download", 0, `Mengunduh ${app.name} ${rel.version}…`);
      const dl = await httpsRequest(asset.download_url, {
        toFile: file,
        maxBytes: MAX_DOWNLOAD_BYTES,
        onProgress: (got, total) => send("download", total ? Math.round((got / total) * 100) : 0, `Mengunduh ${(got / 1048576).toFixed(1)}${total ? ` / ${(total / 1048576).toFixed(1)}` : ""} MB`),
      });
      send("verify", 100, "Memeriksa SHA-256…");
      if (dl.sha256 !== asset.sha256.toLowerCase()) {
        throw new Error(`SHA-256 tidak cocok — file ditolak (diharapkan ${asset.sha256.slice(0, 12)}…, didapat ${dl.sha256.slice(0, 12)}…)`);
      }

      send("install", 100, `Memasang ${app.name}…`);
      let target;
      if (PLATFORM.os === "macos") target = installMac(app, file);
      else if (PLATFORM.os === "windows") target = await installWindows(app, file, extractZip);
      else target = installLinux(app, file);

      const state = readState();
      state[id] = { version: rel.version, path: target, installedAt: new Date().toISOString() };
      writeState(state);
      send("done", 100, `${app.name} ${rel.version} terpasang`);
      return { success: true, version: rel.version, path: target };
    } finally {
      busy.delete(id);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  ipcMain.handle("artcraft:list", async (_e, force) => {
    try {
      return { success: true, ...(await list(!!force)) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("artcraft:install", async (event, id) => {
    try {
      return await install(event, String(id || ""));
    } catch (err) {
      if (!event.sender.isDestroyed()) event.sender.send("artcraft:progress", { id, phase: "error", pct: 0, message: err.message });
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("artcraft:open", async (_e, id) => {
    const app = SUITE.find((a) => a.id === id);
    const installed = app && detect(app);
    if (!installed?.path) return { success: false, error: "Aplikasi belum terpasang" };
    try {
      if (PLATFORM.os === "macos") {
        spawn("/usr/bin/open", [installed.path], { detached: true, stdio: "ignore" }).unref();
      } else if (PLATFORM.os === "windows") {
        const exe = fs.statSync(installed.path).isDirectory() ? findExe(installed.path, app) : installed.path;
        if (!exe || !fs.existsSync(exe)) return { success: false, error: "File .exe tidak ditemukan" };
        spawn(exe, [], { detached: true, stdio: "ignore", cwd: path.dirname(exe) }).unref();
      } else {
        spawn(installed.path, [], { detached: true, stdio: "ignore" }).unref();
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("artcraft:uninstall", async (_e, id) => {
    const app = SUITE.find((a) => a.id === id);
    const installed = app && detect(app);
    if (!installed) return { success: false, error: "Aplikasi belum terpasang" };
    if (installed.source !== "starbox") {
      return { success: false, error: "Aplikasi ini tidak dipasang oleh StarBox — hapus lewat sistem operasi." };
    }
    if (isRunning(installed)) return { success: false, error: `${app.name} sedang berjalan. Tutup dulu.` };
    try {
      if (PLATFORM.os === "macos") await shell.trashItem(installed.path);
      else fs.rmSync(installed.path, { recursive: true, force: true });
      const state = readState();
      delete state[id];
      writeState(state);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("artcraft:open-url", (_e, url) => {
    // Hanya membuka browser (tidak mengunduh apa pun): tautan catatan rilis & situs ArtCraft
    const ok = /^https:\/\/(github\.com\/|getartcraft\.com\/)/.test(String(url || ""));
    if (ok) shell.openExternal(url);
    return { success: ok };
  });

  void electronApp;
}

module.exports = { register };
