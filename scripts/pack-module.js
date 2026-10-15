#!/usr/bin/env node
// Paketkan modul menjadi zip yang bisa dipasang dari katalog StarBox.
//
//   npm run modules:pack -- whatsapp-gateway
//   npm run modules:pack -- whatsapp-gateway --base-url https://github.com/<owner>/<repo>/releases/download/<tag>/
//
// Hasil di dist-modules/:
//   <id>-<version>.zip   isi folder modul + node_modules produksi (install bersih dari lockfile)
//   catalog.json         daftar modul dengan url, sha256, size (entri modul ini diperbarui)
//
// Tanpa --base-url, url di katalog relatif terhadap catalog.json, sehingga bisa diuji
// langsung: STARBOX_MODULE_CATALOG=dist-modules/catalog.json npm run dev
//
// Juga dipakai scripts/release-modules.js (require) untuk rilis ke GitHub Releases.

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist-modules");

function readManifest(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "modules", id, "manifest.json"), "utf8"));
}

function listModules() {
  return fs
    .readdirSync(path.join(ROOT, "modules"))
    .filter((id) => fs.existsSync(path.join(ROOT, "modules", id, "manifest.json")))
    .sort();
}

/** Entri katalog untuk modul (tanpa url/sha256/size). */
function catalogEntry(manifest) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description || "",
    icon: manifest.icon || manifest.sidebar?.icon || "bi-puzzle",
    permissions: manifest.permissions || [],
  };
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Salin modul ke staging, install dependensi produksi, zip. Mengembalikan info zip. */
function packModule(id) {
  const srcDir = path.join(ROOT, "modules", id);
  const manifest = readManifest(id);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), `starbox-pack-${id}-`));
  const stageDir = path.join(staging, id);
  fs.cpSync(srcDir, stageDir, {
    recursive: true,
    filter: (p) => !p.split(path.sep).includes("node_modules") && !p.endsWith(".DS_Store"),
  });
  if (fs.existsSync(path.join(stageDir, "package.json"))) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const ciArgs = ["ci", "--omit=dev", "--omit=optional", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"];
    console.log(`📦 ${id}: npm ${ciArgs.join(" ")}`);
    const r = spawnSync(npm, ciArgs, { cwd: stageDir, stdio: "inherit" });
    if (r.status !== 0) throw new Error(`npm ci gagal untuk modul ${id}`);
  }

  // manifest.json di akar zip
  const zipName = `${id}-${manifest.version}.zip`;
  const zipPath = path.join(OUT_DIR, zipName);
  const zip = new AdmZip();
  zip.addLocalFolder(stageDir);
  zip.writeZip(zipPath);
  fs.rmSync(staging, { recursive: true, force: true });

  return { id, manifest, zipName, zipPath, sha256: sha256File(zipPath), size: fs.statSync(zipPath).size };
}

function writeCatalog(entries, catalogPath = path.join(OUT_DIR, "catalog.json")) {
  const modules = entries.slice().sort((a, b) => a.id.localeCompare(b.id));
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, JSON.stringify({ generatedAt: new Date().toISOString(), modules }, null, 2) + "\n");
  return catalogPath;
}

module.exports = { ROOT, OUT_DIR, readManifest, listModules, catalogEntry, sha256File, packModule, writeCatalog };

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  const baseUrlIdx = args.indexOf("--base-url");
  const baseUrl = baseUrlIdx >= 0 ? args[baseUrlIdx + 1] : "";
  if (!id) {
    console.error("Pakai: npm run modules:pack -- <id> [--base-url <url/>]");
    process.exit(1);
  }
  try {
    const packed = packModule(id);
    const catalogPath = path.join(OUT_DIR, "catalog.json");
    let catalog = { modules: [] };
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    } catch {}
    const others = (catalog.modules || []).filter((m) => m.id !== id);
    writeCatalog(others.concat({
      ...catalogEntry(packed.manifest),
      url: baseUrl ? baseUrl.replace(/\/?$/, "/") + packed.zipName : packed.zipName,
      sha256: packed.sha256,
      size: packed.size,
    }), catalogPath);
    console.log(`✅ ${packed.zipName}  ${(packed.size / 1048576).toFixed(1)} MB  sha256 ${packed.sha256}`);
    console.log(`   katalog: ${path.relative(ROOT, catalogPath)}`);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
