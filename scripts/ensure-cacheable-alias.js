const fs = require("fs");
const path = require("path");

function ensureAlias() {
  const cacheableDir = path.join(__dirname, "..", "node_modules", "cacheable");
  const packagePath = path.join(cacheableDir, "package.json");
  const indexPath = path.join(cacheableDir, "index.js");

  let hasRealPackage = false;
  if (fs.existsSync(packagePath)) {
    try {
      const existingPkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      if (
        existingPkg &&
        typeof existingPkg === "object" &&
        existingPkg.exports &&
        typeof existingPkg.exports === "object"
      ) {
        hasRealPackage = true;
      }
    } catch {
      // ignore parse errors and fall back to alias
    }
  }

  if (hasRealPackage) {
    console.log("[Cacheable Alias] Real cacheable package detected, skipping alias.");
    return;
  }

  if (!fs.existsSync(cacheableDir)) {
    fs.mkdirSync(cacheableDir, { recursive: true });
    console.log(`[Cacheable Alias] Created directory ${cacheableDir}`);
  }

  const pkgContent = {
    name: "cacheable",
    version: "1.0.0",
    main: "index.js",
  };

  fs.writeFileSync(packagePath, JSON.stringify(pkgContent, null, 2), "utf-8");
  console.log(`[Cacheable Alias] Wrote ${packagePath}`);

  const indexContent = `module.exports = require("@cacheable/node-cache");\n`;
  fs.writeFileSync(indexPath, indexContent, "utf-8");
  console.log(`[Cacheable Alias] Wrote ${indexPath}`);
}

try {
  ensureAlias();
  console.log("[Cacheable Alias] Ready");
} catch (error) {
  console.error("[Cacheable Alias] Failed to create alias:", error);
  process.exit(1);
}
