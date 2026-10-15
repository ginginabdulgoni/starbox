#!/usr/bin/env node
// Pasang dependensi npm milik setiap modul di modules/<id>/ (untuk `npm run dev`).
// Modul memakai lockfile-nya sendiri dan TIDAK menjalankan install script paket.
//
//   npm run modules:install                 # semua modul yang punya package.json
//   npm run modules:install -- whatsapp-gateway

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const modulesDir = path.join(__dirname, "..", "modules");
const only = process.argv.slice(2);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

let failed = false;
for (const id of fs.readdirSync(modulesDir)) {
  const dir = path.join(modulesDir, id);
  if (only.length && !only.includes(id)) continue;
  if (!fs.existsSync(path.join(dir, "package.json"))) continue;

  const hasLock = fs.existsSync(path.join(dir, "package-lock.json"));
  const args = [hasLock ? "ci" : "install", "--omit=dev", "--omit=optional", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"];
  console.log(`📦 ${id}: npm ${args.join(" ")}`);
  const r = spawnSync(npm, args, { cwd: dir, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`❌ ${id}: npm gagal (exit ${r.status})`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
