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

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const baseUrlIdx = args.indexOf("--base-url");
const baseUrl = baseUrlIdx >= 0 ? args[baseUrlIdx + 1] : "";
if (!id) {
  console.error("Pakai: npm run modules:pack -- <id> [--base-url <url/>]");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "modules", id);
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, "manifest.json"), "utf8"));
const outDir = path.join(root, "dist-modules");
fs.mkdirSync(outDir, { recursive: true });

// 1. Salin modul (tanpa node_modules) ke staging lalu install dependensi produksi
const staging = fs.mkdtempSync(path.join(os.tmpdir(), `starbox-pack-${id}-`));
const stageDir = path.join(staging, id);
fs.cpSync(srcDir, stageDir, {
  recursive: true,
  filter: (p) => !p.split(path.sep).includes("node_modules") && !p.endsWith(".DS_Store"),
});
if (fs.existsSync(path.join(stageDir, "package.json"))) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const ciArgs = ["ci", "--omit=dev", "--omit=optional", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"];
  console.log(`📦 npm ${ciArgs.join(" ")}`);
  const r = spawnSync(npm, ciArgs, { cwd: stageDir, stdio: "inherit" });
  if (r.status !== 0) {
    console.error("❌ npm ci gagal");
    process.exit(1);
  }
}

// 2. Zip (manifest.json di akar zip)
const zipName = `${id}-${manifest.version}.zip`;
const zipPath = path.join(outDir, zipName);
const zip = new AdmZip();
zip.addLocalFolder(stageDir);
zip.writeZip(zipPath);
fs.rmSync(staging, { recursive: true, force: true });

const data = fs.readFileSync(zipPath);
const sha256 = crypto.createHash("sha256").update(data).digest("hex");

// 3. Perbarui catalog.json
const catalogPath = path.join(outDir, "catalog.json");
let catalog = { modules: [] };
try {
  catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
} catch {}
catalog.modules = (catalog.modules || []).filter((m) => m.id !== id);
catalog.modules.push({
  id,
  name: manifest.name,
  version: manifest.version,
  description: manifest.description || "",
  icon: manifest.sidebar?.icon || manifest.icon || "bi-puzzle",
  permissions: manifest.permissions || [],
  url: baseUrl ? baseUrl.replace(/\/?$/, "/") + zipName : zipName,
  sha256,
  size: data.length,
});
catalog.modules.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");

console.log(`✅ ${zipName}  ${(data.length / 1048576).toFixed(1)} MB  sha256 ${sha256}`);
console.log(`   katalog: ${path.relative(root, catalogPath)}`);
