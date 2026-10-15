#!/usr/bin/env node
// Rilis modul StarBox ke GitHub Releases dan terbitkan catalog.json.
//
//   GITHUB_REPOSITORY=owner/repo node scripts/release-modules.js [--dry-run]
//
// Untuk tiap modul di modules/:
//   - tag `module-<id>-v<version>` belum ada  → pack, buat release, unggah zip
//   - tag sudah ada                            → pakai zip yang sudah dirilis
//                                                (sha256 dihitung dari aset itu,
//                                                karena zip hasil pack ulang
//                                                hash-nya berbeda)
// Lalu catalog.json diunggah (ditimpa) ke release tetap `modules-catalog`, yang
// dibaca StarBox dari:
//   https://github.com/<owner>/<repo>/releases/download/modules-catalog/catalog.json
//
// Butuh GitHub CLI (`gh`) yang sudah login (di GitHub Actions: GH_TOKEN).

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { OUT_DIR, readManifest, listModules, catalogEntry, sha256File, packModule, writeCatalog } = require("./pack-module");

const CATALOG_TAG = "modules-catalog";
const dryRun = process.argv.includes("--dry-run");
const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
  console.error("Set GITHUB_REPOSITORY=owner/repo");
  process.exit(1);
}

function gh(args, { allowFail = false } = {}) {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  if (r.status !== 0 && !allowFail) {
    throw new Error(`gh ${args.join(" ")} gagal: ${(r.stderr || r.stdout || "").trim()}`);
  }
  return r;
}

const releaseExists = (tag) => gh(["release", "view", tag, "--repo", repo], { allowFail: true }).status === 0;
const downloadUrl = (tag, file) => `https://github.com/${repo}/releases/download/${tag}/${file}`;

const entries = [];
for (const id of listModules()) {
  const manifest = readManifest(id);
  const tag = `module-${id}-v${manifest.version}`;
  const zipName = `${id}-${manifest.version}.zip`;
  let sha256;
  let size;

  if (releaseExists(tag)) {
    // Versi ini sudah dirilis — hitung hash dari aset yang sudah ada
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "starbox-rel-"));
    gh(["release", "download", tag, "--repo", repo, "--pattern", zipName, "--dir", dir]);
    const file = path.join(dir, zipName);
    sha256 = sha256File(file);
    size = fs.statSync(file).size;
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`= ${id} v${manifest.version} sudah dirilis (${tag})`);
  } else {
    const packed = packModule(id);
    sha256 = packed.sha256;
    size = packed.size;
    if (dryRun) {
      console.log(`+ [dry-run] akan merilis ${tag} (${(size / 1048576).toFixed(1)} MB)`);
    } else {
      gh(["release", "create", tag, packed.zipPath, "--repo", repo,
        "--title", `Modul ${manifest.name} v${manifest.version}`,
        "--notes", `${manifest.description || ""}\n\nSHA-256: \`${sha256}\``,
        "--latest=false"]);
      console.log(`+ ${id} v${manifest.version} dirilis (${tag})`);
    }
  }

  entries.push({ ...catalogEntry(manifest), url: downloadUrl(tag, zipName), sha256, size });
}

const catalogPath = writeCatalog(entries, path.join(OUT_DIR, "catalog.json"));
if (dryRun) {
  console.log(`[dry-run] katalog ditulis ke ${catalogPath}`);
} else {
  if (!releaseExists(CATALOG_TAG)) {
    gh(["release", "create", CATALOG_TAG, "--repo", repo, "--title", "Katalog modul StarBox",
      "--notes", "catalog.json dibaca oleh halaman Modul di StarBox. Diperbarui otomatis.", "--latest=false"]);
  }
  gh(["release", "upload", CATALOG_TAG, catalogPath, "--repo", repo, "--clobber"]);
  console.log(`✅ katalog diterbitkan: ${downloadUrl(CATALOG_TAG, "catalog.json")}`);
}
