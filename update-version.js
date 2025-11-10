#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate version berdasarkan tanggal hari ini
// Format: 1.2.YYMMDD (contoh: 1.2.251105 untuk 2025-11-05)
function generateVersionFromDate() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // 2 digit terakhir tahun (25 untuk 2025)
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 01-12
  const day = now.getDate().toString().padStart(2, '0'); // 01-31

  const datePart = `${year}${month}${day}`;
  const version = `1.2.${datePart}`;

  return version;
}

// Update package.json
function updatePackageJson() {
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  const oldVersion = packageJson.version;
  const newVersion = generateVersionFromDate();

  packageJson.version = newVersion;

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

  console.log(`✅ Version updated: ${oldVersion} → ${newVersion}`);
  return newVersion;
}

// Update electron-main.js (cari dan replace versi di title dan setTitle)
function updateElectronMain(newVersion) {
  const mainPath = path.join(__dirname, 'electron-main.js');
  let content = fs.readFileSync(mainPath, 'utf8');

  // Regex untuk mengganti versi di title seperti "Starbox V1.2.1103"
  const versionRegex = /(StarBox\s+V|Starbox\s+V)(\d+\.\d+\.\d+)/gi;

  // Regex untuk mengganti di setTitle yang tidak ada versi: deviceName + " - Starbox"
  const setTitleRegex = /(win\.setTitle\([^)]*\+\s*["'][\s-]*)(StarBox|Starbox)(["'])/gi;

  let updated = false;

  if (versionRegex.test(content)) {
    content = content.replace(versionRegex, (match, prefix) => {
      return `${prefix}${newVersion}`;
    });
    updated = true;
  }

  // Tambahkan versi ke setTitle yang belum ada versi
  content = content.replace(setTitleRegex, (match, prefix, starbox, suffix) => {
    return `${prefix}${starbox} V${newVersion}${suffix}`;
  });

  if (updated || content !== fs.readFileSync(mainPath, 'utf8')) {
    fs.writeFileSync(mainPath, content, 'utf8');
    console.log(`✅ electron-main.js updated with version ${newVersion}`);
  } else {
    console.log(`ℹ️  No version string found in electron-main.js to update`);
  }
}

// Update index.html (footer)
function updateIndexHtml(newVersion) {
  const indexPath = path.join(__dirname, 'index.html');
  let content = fs.readFileSync(indexPath, 'utf8');

  // Regex untuk mengganti versi di footer seperti "StarBox v1.2.1103"
  const footerVersionRegex = /(StarBox\s+v|Starbox\s+v)(\d+\.\d+\.\d+)/gi;
  const titleVersionRegex = /(<title>\s*StarBox\s+v)(\d+\.\d+\.\d+)([^<]*<\/title>)/i;

  let updated = false;

  if (footerVersionRegex.test(content)) {
    content = content.replace(footerVersionRegex, (match, prefix) => {
      return `${prefix}${newVersion}`;
    });
    updated = true;
  }

  if (titleVersionRegex.test(content)) {
    content = content.replace(titleVersionRegex, (match, prefix, _oldVersion, suffix) => {
      return `${prefix}${newVersion}${suffix}`;
    });
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log(`✅ index.html updated with version ${newVersion}`);
  } else {
    console.log(`ℹ️  No version string found in index.html to update`);
  }
}

// Main execution
try {
  const newVersion = updatePackageJson();
  updateElectronMain(newVersion);
  updateIndexHtml(newVersion);
  console.log(`\n🎉 Build version set to: ${newVersion}`);
} catch (error) {
  console.error('❌ Error updating version:', error.message);
  process.exit(1);
}
