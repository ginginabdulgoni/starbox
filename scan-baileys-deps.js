/**
 * Auto Scanner Baileys Dependency Checker
 * ---------------------------------------
 * Fungsi:
 * - Scan seluruh file di node_modules/@whiskeysockets/baileys
 * - Cari require() dan import ... from ""
 * - Cek apakah modul tersedia di node_modules
 * - Tampilkan semua modul yang hilang (missing)
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BAILEYS_DIR = path.join(ROOT, "node_modules/@whiskeysockets/baileys");

const SCAN_EXT = [".js", ".cjs", ".mjs", ".ts"];
const foundModules = new Set();

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  const requireRegex = /require\(["'`](.*?)["'`]\)/g;
  const importRegex = /from ["'`](.*?)["'`]/g;
  const importCallRegex = /import\(["'`](.*?)["'`]\)/g;

  let match;

  while ((match = requireRegex.exec(content)) !== null) {
    foundModules.add(match[1]);
  }

  while ((match = importRegex.exec(content)) !== null) {
    foundModules.add(match[1]);
  }

  while ((match = importCallRegex.exec(content)) !== null) {
    foundModules.add(match[1]);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      scanDir(full);
    } else if (SCAN_EXT.includes(path.extname(full))) {
      scanFile(full);
    }
  }
}

function checkModuleExists(modName) {
  // Abaikan path relatif
  if (modName.startsWith("./") || modName.startsWith("../")) return true;

  // Handle modul seperti "libsignal"
  const base = modName.split("/")[0].startsWith("@")
    ? modName.split("/").slice(0, 2).join("/")
    : modName.split("/")[0];

  const modPath = path.join(ROOT, "node_modules", base);
  return fs.existsSync(modPath);
}

console.log("🔍 Scanning Baileys dependencies...");

scanDir(BAILEYS_DIR);

console.log(`📦 Total detected imports: ${foundModules.size}`);

const missing = [];

for (const mod of foundModules) {
  if (!checkModuleExists(mod)) {
    missing.push(mod);
  }
}

console.log("\n=============================");
console.log("📌 Missing Dependencies");
console.log("=============================\n");

if (missing.length === 0) {
  console.log("🎉 ALL GOOD! Tidak ada modul yang hilang.");
} else {
  for (const m of missing) {
    console.log(`❌ Missing: ${m}`);
  }

  console.log("\n=============================");
  console.log("📦 Tambahkan ke asarUnpack:");
  console.log("=============================\n");

  for (const m of missing) {
    const cleaned = m.startsWith("@")
      ? `node_modules/${m}/**`
      : `node_modules/${m.split("/")[0]}/**`;

    console.log(`"${cleaned}",`);
  }
}

console.log("\n🔥 Selesai!");
