// ═══════════════════════════════════════════════════════════════════════════════
// Modul Android / iOS — sisi main process
//
// Dipindah dari electron-main.js: emulator Android (AVD), ADB remote + scrcpy,
// StarSync (multi-device), simulasi SMS/telepon/GPS/kamera, otomasi WhatsApp
// lewat ADB, dan iOS Simulator (macOS). Core memanggil modul ini lewat
// moduleLoader.getApi("android-ios") — lihat androidApi() di electron-main.js.
// Data tetap di lokasi lama (<userData>/db/devices.json & adb-devices.json).
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { spawn, spawnSync } = require("child_process");

let ctx = null;
const api = {};
let startImpl = async () => {};
let shutdownImpl = () => {};
let statsImpl = () => ({ scrcpySessions: 0 });

function register(context) {
  ctx = context;
  const { ipcMain, app, BrowserWindow, dialog } = context.electron;
  const svc = context.services;
  // Fungsi & data milik core yang dipakai kode Android (manifest.coreServices)
  const {
    logDev, sanitizeRemoteServiceId, sanitizeWhatsappVariant, sanitizePendingUrl,
    getDeviceConfig, updateDeviceStatus, sendAutomationMonitorPayload,
    resolveAutomationCallbackUrl, resolveAutomationPendingEndpoint, getAssetPath,
    withVersionSuffix, requestJson, normalizeAutomationPriority, hasMessagesInProgress,
    getPersistentMachineId, cleanExpiredMessageCache, buildSystemInfoPayload,
    buildDeviceSnapshot,
  } = svc;
  const DB_PATH = svc.getDbPath();
  const WHATSAPP_MESSAGE_CACHE = svc.getWhatsappMessageCache();
  const windowManager = svc.getWindowManager();
  const { APP_VERSION, IS_DEV_BUILD, USER_AGENT_REPORT_URL } = svc.getAppInfo();
  const uuidv4 = context.requireShared("uuid").v4;

  const nodeNet = require("net");

  // Development mode - no special module resolution needed
  const AndroidManager = require("./android-manager");

  const { AndroidSyncManager, MOTION_ACTION_DOWN, MOTION_ACTION_UP, MOTION_ACTION_MOVE } = require("./android-sync-manager");

  const iOSManager = require("./ios-manager");

  function warnDev(...args) {
    if (!IS_DEV_BUILD) return;
    if (global.__starboxDevLog) {
      global.__starboxDevLog(...args);
      return;
    }
    console.warn(...args);
  }

  function generateAvdName(uid = "", deviceName = "") {
    const sanitizedName = String(deviceName || "")
      .normalize("NFKD")
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20);
    const fallback =
      (uid || uuidv4())
        .toString()
        .replace(/[^a-zA-Z0-9]+/g, "")
        .slice(0, 8) || `AVD${Date.now()}`;
    const suffix = (uid || "")
      .toString()
      .replace(/[^a-zA-Z0-9]+/g, "")
      .slice(0, 6);
    const base = sanitizedName || fallback;
    const unique = suffix ? `${base}_${suffix}` : base;
    return `StarBox_${unique}`.slice(0, 32);
  }

  function syncAndroidAvdIdentity(device = {}) {
    if (!device || (device.service || "").toLowerCase() !== "android") {
      return false;
    }

    const nextAvdName = generateAvdName(
      device.uid || device.token || "",
      device.name || ""
    );
    const currentAvdName = String(device.avdName || "").trim();
    if (!nextAvdName) return false;
    if (!currentAvdName) {
      device.avdName = nextAvdName;
      return true;
    }
    if (currentAvdName === nextAvdName) {
      return false;
    }

    try {
      const manager = ensureAndroidManagerReady();
      if (typeof manager.initializePaths === "function") {
        manager.initializePaths();
      }
      const avdRoot = manager.avdPath;
      if (avdRoot) {
        const oldDir = path.join(avdRoot, `${currentAvdName}.avd`);
        const oldIni = path.join(avdRoot, `${currentAvdName}.ini`);
        const newDir = path.join(avdRoot, `${nextAvdName}.avd`);
        const newIni = path.join(avdRoot, `${nextAvdName}.ini`);

        if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
          fs.renameSync(oldDir, newDir);
        }
        if (fs.existsSync(oldIni) && !fs.existsSync(newIni)) {
          fs.renameSync(oldIni, newIni);
        }
        if (fs.existsSync(newIni)) {
          fs.writeFileSync(
            newIni,
            [
              "avd.ini.encoding=UTF-8",
              `path=${newDir}`,
              `path.rel=avd/${nextAvdName}.avd`,
              "target=android-30",
            ].join("\n")
          );
        }
      }
    } catch (err) {
      console.warn(
        "⚠️ Gagal sinkron nama AVD Android:",
        err?.message || err
      );
    }

    device.avdName = nextAvdName;
    return true;
  }

  const DEFAULT_ANDROID_SPEC = Object.freeze({
    id: "balanced",
    label: "Balanced • 2 Core • 1.5 GB",
    memoryMb: 1536,
    cores: 2,
    resolution: "720x1280",
    density: 265,
  });

  function normalizeAndroidSpecInput(spec) {
    const normalized = { ...DEFAULT_ANDROID_SPEC };
    if (!spec || typeof spec !== "object") {
      return normalized;
    }
    if (spec.id) normalized.id = String(spec.id).slice(0, 32);
    if (spec.label) normalized.label = String(spec.label).slice(0, 64);
    const memory = parseInt(spec.memoryMb, 10);
    if (Number.isFinite(memory)) {
      normalized.memoryMb = Math.min(Math.max(memory, 512), 4096);
    }
    const cores = parseInt(spec.cores, 10);
    if (Number.isFinite(cores)) {
      normalized.cores = Math.min(Math.max(cores, 1), 8);
    }
    if (spec.resolution) {
      const match = String(spec.resolution)
        .toLowerCase()
        .match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        normalized.resolution = `${match[1]}x${match[2]}`;
      }
    }
    const density = parseInt(spec.density, 10);
    if (Number.isFinite(density)) {
      normalized.density = Math.min(Math.max(density, 120), 640);
    }
    return normalized;
  }

  function ensureAndroidSpec(device) {
    if (!device || (device.service || "").toLowerCase() !== "android") {
      return false;
    }
    const nextSpec = normalizeAndroidSpecInput(device.androidSpec);
    const prev = device.androidSpec || {};
    const changed =
      !prev ||
      ["id", "label", "memoryMb", "cores", "resolution", "density"].some(
        (key) => prev[key] !== nextSpec[key]
      );
    if (changed) {
      device.androidSpec = nextSpec;
    }
    return changed;
  }

  function ensureAndroidAutomationConfig(device) {
    if (!device || (device.service || "").toLowerCase() !== "android") {
      return false;
    }
    let changed = false;
    const nextService = sanitizeRemoteServiceId(
      device.androidAutomationService || "android-general"
    );
    if (device.androidAutomationService !== nextService) {
      device.androidAutomationService = nextService;
      changed = true;
    }
    if (typeof device.whatsappBaseUrl !== "string") {
      device.whatsappBaseUrl = "";
      changed = true;
    }
    if (typeof device.whatsappCallbackUrl !== "string") {
      device.whatsappCallbackUrl = "";
      changed = true;
    }
    const nextVariant = sanitizeWhatsappVariant(
      device.whatsappVariant || "consumer"
    );
    if (device.whatsappVariant !== nextVariant) {
      device.whatsappVariant = nextVariant;
      changed = true;
    }
    return changed;
  }

  function readAndroidEmulatorDetails() {
    const fallback = { total: 0, devices: [] };
    if (!DB_PATH) return fallback;

    try {
      if (!fs.existsSync(DB_PATH)) return fallback;

      const raw = fs.readFileSync(DB_PATH, "utf8");
      const data = JSON.parse(raw);
      const devices = Array.isArray(data.devices)
        ? data.devices.filter(
            (device) => String(device?.service || "").toLowerCase() === "android"
          )
        : [];
      const sanitized = devices
        .map(buildDeviceSnapshot)
        .filter(Boolean);

      return {
        total: sanitized.length,
        devices: sanitized,
      };
    } catch (err) {
      console.warn(
        "⚠️ Gagal membaca daftar Android emulator:",
        err?.message || err
      );
      return fallback;
    }
  }

  function buildAdbRemoteReportPayload(context = {}) {
    const devices = readAndroidRemoteDevices();
    const userAgentString =
      app?.userAgentFallback || `Starbox/${APP_VERSION} (ADB Remote)`;
    return {
      event: "adb-remote",
      action: context.action || "sync",
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      userAgent: userAgentString,
      machineId:
        typeof getPersistentMachineId === "function"
          ? getPersistentMachineId()
          : null,
      count: devices.length,
      devices,
      device: context.device || null,
      uid: context.uid || context.device?.uid || null,
    };
  }

  async function sendAdbRemoteReport(context = {}) {
    if (!USER_AGENT_REPORT_URL) return;
    try {
      const adbRemote = buildAdbRemoteReportPayload(context);
      const payload = buildSystemInfoPayload({
        eventType: "adb-remote",
        meta: context.meta,
        adbRemote: {
          action: adbRemote.action,
          timestamp: adbRemote.timestamp,
          count: adbRemote.count,
          devices: adbRemote.devices,
          device: adbRemote.device,
          uid: adbRemote.uid,
        },
      });
      const userAgent = adbRemote.userAgent || payload.userAgent;
      payload.userAgent = userAgent;
      await requestJson({
        url: USER_AGENT_REPORT_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": userAgent,
        },
        body: payload,
      });
    } catch (err) {
      console.warn(
        "⚠️ Gagal mengirim laporan ADB Remote:",
        err?.message || err.toString()
      );
    }
  }

  let ANDROID_REMOTE_DB_PATH = null;

  // Manager instances
  let androidManager = null;

  let androidSyncManager = null;

  let androidSyncWindow = null; // Single grid window for the multi-device sync feature

  let iosManager = null;

  const scrcpySessions = new Map();

  const ANDROID_REMOTE_SHORTCUTS = Object.freeze({
    "wake-screen": { label: "Bangunkan layar", type: "wake" },
    "select-all": { label: "Select All (Ctrl + A)", type: "selectAll" },
    copy: { label: "Copy (Ctrl + C)", type: "keyevent", code: 278 },
    paste: { label: "Paste (Ctrl + V)", type: "keyevent", code: 279 },
    cut: { label: "Cut (Ctrl + X)", type: "keyevent", code: 277 },
    enter: { label: "Enter", type: "keyevent", code: 66 },
    backspace: { label: "Backspace", type: "keyevent", code: 67 },
    tab: { label: "Tab", type: "keyevent", code: 61 },
    sleep: { label: "Sleep", type: "keyevent", code: 223 },
    "volume-up": { label: "Volume Up", type: "keyevent", code: 24 },
    "volume-down": { label: "Volume Down", type: "keyevent", code: 25 },
  });

  function isCommandAvailable(command = "") {
    if (!command) return false;
    const binary = process.platform === "win32" ? "where" : "which";
    try {
      const result = spawnSync(binary, [command], {
        stdio: "ignore",
      });
      return result.status === 0;
    } catch (err) {
      return false;
    }
  }

  function getBrewExecutable() {
    // Cari brew di PATH atau di lokasi default install Mac
    if (isCommandAvailable("brew")) return "brew";
    const candidates = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
    for (const candidate of candidates) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch (_) {
        // continue
      }
    }
    return null;
  }

  function resolveScrcpyBinary() {
    // Windows needs .exe extension and different paths
    const platform = process.platform;
    const isWindows = platform === "win32";
    const scrcpyCmd = isWindows ? "scrcpy.exe" : "scrcpy";

    // On Windows, try to get full path from 'where' command first
    if (isWindows) {
      try {
        const result = spawnSync("where", ["scrcpy"], {
          stdio: ["ignore", "pipe", "ignore"],
          encoding: "utf8",
        });
        if (result.status === 0 && result.stdout) {
          // where returns multiple paths, take the first one
          const paths = result.stdout.trim().split("\n").filter(Boolean);
          if (paths.length > 0) {
            const firstPath = paths[0].trim().replace(/\r/g, "");
            if (fs.existsSync(firstPath)) {
              return firstPath;
            }
          }
        }
      } catch (_) {
        // Continue to manual search
      }
    }

    // Check if scrcpy is in PATH
    if (isCommandAvailable("scrcpy")) return scrcpyCmd;

    // Windows-specific paths
    if (isWindows) {
      const candidates = [
        // Chocolatey
        "C:\\ProgramData\\chocolatey\\bin\\scrcpy.exe",
        // winget / manual install
        "C:\\Program Files\\scrcpy\\scrcpy.exe",
        "C:\\Program Files (x86)\\scrcpy\\scrcpy.exe",
        // User local
        path.join(os.homedir(), "scoop", "apps", "scrcpy", "current", "scrcpy.exe"),
        path.join(os.homedir(), "AppData", "Local", "scrcpy", "scrcpy.exe"),
      ];
      for (const candidate of candidates) {
        try {
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        } catch (_) {
          // continue
        }
      }
    } else {
      // Unix/macOS paths
      const candidates = [
        "/opt/homebrew/bin/scrcpy",
        "/usr/local/bin/scrcpy",
        "/usr/bin/scrcpy",
      ];
      for (const candidate of candidates) {
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
          return candidate;
        } catch (_) {
          // continue
        }
      }
    }

    return null;
  }

  function isScrcpyInstalled() {
    try {
      const scrcpyBin = resolveScrcpyBinary();
      if (!scrcpyBin) return false;
      const result = spawnSync(scrcpyBin, ["--version"], {
        stdio: "ignore",
      });
      return result.status === 0;
    } catch (err) {
      return false;
    }
  }

  function detectScrcpyInstaller() {
    const platform = process.platform;
    if (platform === "darwin") {
      const brewBin = getBrewExecutable();
      if (brewBin) {
        return {
          supported: true,
          command: brewBin,
          args: ["install", "scrcpy"],
          label: "Homebrew",
        };
      }
      return {
        supported: false,
        reason:
          "Homebrew tidak ditemukan. Pastikan Homebrew terpasang (biasanya di /opt/homebrew/bin/brew atau /usr/local/bin/brew) lalu jalankan 'brew install scrcpy'.",
      };
    }
    if (platform === "win32") {
      if (isCommandAvailable("choco")) {
        return {
          supported: true,
          command: "choco",
          args: ["install", "scrcpy", "-y"],
          label: "Chocolatey",
        };
      }
      if (isCommandAvailable("winget")) {
        return {
          supported: true,
          command: "winget",
          args: [
            "install",
            "--id",
            "Genymobile.scrcpy",
            "-e",
            "--accept-source-agreements",
            "--accept-package-agreements",
          ],
          label: "winget",
        };
      }
      return {
        supported: false,
        reason:
          "Chocolatey atau winget tidak ditemukan. Install salah satunya atau pasang scrcpy manual dari https://github.com/Genymobile/scrcpy.",
      };
    }
    if (platform === "linux") {
      return {
        supported: false,
        reason:
          "Instalasi otomatis scrcpy belum tersedia di Linux. Gunakan manajer paket distro Anda (apt, snap, pacman, dll).",
      };
    }
    return {
      supported: false,
      reason: "Platform ini belum mendukung instalasi otomatis scrcpy.",
    };
  }

  function runScrcpyInstallerCommand(installer, onProgress) {
    const emitProgress = (percent, message) => {
      if (typeof onProgress !== "function") return;
      try {
        onProgress({
          percent,
          message,
          installer: installer.label || installer.command,
        });
      } catch (_) {
        // ignore
      }
    };
    return new Promise((resolve, reject) => {
      const proc = spawn(installer.command, installer.args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      let stdout = "";
      let stderr = "";
      emitProgress(10, `Menjalankan ${installer.label || installer.command}...`);
      if (proc.stdout) {
        proc.stdout.on("data", (data) => {
          stdout += data.toString();
          emitProgress(50, "Mengunduh / memasang scrcpy...");
        });
      }
      if (proc.stderr) {
        proc.stderr.on("data", (data) => {
          stderr += data.toString();
          emitProgress(
            65,
            "Memeriksa hasil instalasi... (log installer diterima)"
          );
        });
      }
      proc.once("error", (err) => reject(err));
      proc.once("close", (code) => {
        if (code === 0) {
          emitProgress(100, "Instalasi selesai");
          resolve({ stdout, stderr });
        } else {
          const message =
            stderr.trim() ||
            stdout.trim() ||
            `Perintah ${installer.command} keluar dengan kode ${code}.`;
          reject(new Error(message));
        }
      });
    });
  }

  async function installScrcpyAutomatically(onProgress) {
    const installer = detectScrcpyInstaller();
    if (!installer || installer.supported === false) {
      const error = new Error(
        installer?.reason ||
          "Installer otomatis scrcpy tidak tersedia di platform ini."
      );
      error.code = "SCRCPY_INSTALLER_UNAVAILABLE";
      throw error;
    }
    if (typeof onProgress === "function") {
      onProgress({
        percent: 5,
        message: "Menyiapkan installer scrcpy...",
        installer: installer.label || installer.command,
      });
    }
    await runScrcpyInstallerCommand(installer, onProgress);
  }

  async function sendAndroidKeyevent(adbId, keyCode, options = {}) {
    if (!adbId || keyCode === undefined || keyCode === null) return;
    const manager = ensureAndroidManagerReady();
    const args = ["-s", adbId, "shell", "input", "keyevent"];
    if (options.longPress) {
      args.push("--longpress");
    }
    const value =
      typeof keyCode === "number"
        ? String(keyCode)
        : String(keyCode || "").toUpperCase();
    args.push(value);
    await manager.runAdbCommand(args, {
      timeout: options.timeout || 6000,
      silent: true,
    });
    if (options.delayAfter) {
      await sleep(options.delayAfter);
    }
  }

  async function sendAndroidSwipe(adbId, from = {}, to = {}, duration = 250) {
    if (!adbId) return;
    const manager = ensureAndroidManagerReady();
    const startX = from.x ?? Math.round(to.x ?? 540);
    const startY = from.y ?? Math.round(to.y ?? 1600);
    const endX = to.x ?? startX;
    const endY = to.y ?? Math.round(startY / 2);
    await manager.runAdbCommand(
      [
        "-s",
        adbId,
        "shell",
        "input",
        "swipe",
        String(startX),
        String(startY),
        String(endX),
        String(endY),
        String(Math.max(duration, 80)),
      ],
      { timeout: 8000, silent: true }
    );
  }

  async function isDeviceShowingLockscreen(adbId) {
    if (!adbId) return null;
    const manager = ensureAndroidManagerReady();
    try {
      const output = await manager.runAdbCommand(
        ["-s", adbId, "shell", "dumpsys", "window", "policy"],
        { timeout: 6000, silent: true }
      );
      const text = String(output || "").toLowerCase();
      if (!text) return null;
      if (
        text.includes("mshowinglockscreen=true") ||
        text.includes("isstatusbarkeyguard=true") ||
        text.includes("keyguardshowing=true") ||
        text.includes("mdreaminglockscreen=true")
      ) {
        return true;
      }
      if (
        text.includes("mshowinglockscreen=false") ||
        text.includes("isstatusbarkeyguard=false") ||
        text.includes("keyguardshowing=false")
      ) {
        return false;
      }
    } catch (err) {
      console.warn(
        `⚠️ Tidak bisa membaca status lockscreen (${adbId}):`,
        err?.message || err
      );
    }
    return null;
  }

  async function ensureDeviceScreenAwake(adbId) {
    if (!adbId) return;
    let isLocked = null;
    try {
      isLocked = await isDeviceShowingLockscreen(adbId);
    } catch (err) {
      console.warn(
        `⚠️ Gagal mendeteksi status lockscreen (${adbId}):`,
        err?.message || err
      );
    }
    try {
      await sendAndroidKeyevent(adbId, 224, { delayAfter: 160 }); // KEYCODE_WAKEUP
    } catch (err) {
      console.warn(
        `⚠️ Tidak bisa mengirim WAKEUP ke ${adbId}:`,
        err?.message || err
      );
    }
    // Skip aggressive unlock gestures when device sudah tidak di lockscreen
    if (isLocked === false) {
      return;
    }
    try {
      await sendAndroidKeyevent(adbId, 82, { delayAfter: 140 }); // KEYCODE_MENU
    } catch (err) {
      console.warn(
        `⚠️ Tidak bisa mengirim MENU ke ${adbId}:`,
        err?.message || err
      );
    }
    try {
      const { width, height } = await getDeviceDisplayMetrics(adbId);
      const x = Math.round(width / 2);
      const startY = Math.round(height * 0.72);
      const endY = Math.round(height * 0.28);
      // Faster, shorter swipe to avoid gesture-nav drifting into Recent Apps
      await sendAndroidSwipe(adbId, { x, y: startY }, { x, y: endY }, 180);
    } catch (err) {
      console.warn(`⚠️ Swipe unlock gagal untuk ${adbId}:`, err?.message || err);
    }
  }

  async function triggerAndroidSelectAll(adbId) {
    if (!adbId) return;
    const manager = ensureAndroidManagerReady();
    try {
      const { width, height } = await getDeviceDisplayMetrics(adbId);
      const x = Math.max(Math.round(width / 2), 200);
      const y = Math.max(Math.round(height * 0.45), 200);
      await manager.runAdbCommand(
        [
          "-s",
          adbId,
          "shell",
          "input",
          "swipe",
          String(x),
          String(y),
          String(x),
          String(y),
          "550",
        ],
        { timeout: 8000, silent: true }
      );
      await sleep(380);
      await sendAndroidKeyevent(adbId, 19, { delayAfter: 120 }).catch(() => {}); // DPAD_UP
      await sendAndroidKeyevent(adbId, 66, { delayAfter: 80 }).catch(() => {}); // ENTER
    } catch (err) {
      console.warn(
        `⚠️ Select-all fallback gagal (${adbId}):`,
        err?.message || err
      );
      throw new Error(
        "Tidak bisa menjalankan Select All otomatis. Coba pilih teks secara manual."
      );
    }
  }

  async function runAndroidShortcutCommand(uid, shortcutId) {
    const shortcut = ANDROID_REMOTE_SHORTCUTS[shortcutId];
    if (!shortcut) {
      throw new Error("Shortcut tidak dikenal.");
    }
    const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
    const adbId = record.adbId;
    switch (shortcut.type) {
      case "wake":
        await ensureDeviceScreenAwake(adbId);
        return `${shortcut.label} berhasil dijalankan.`;
      case "selectAll":
        await triggerAndroidSelectAll(adbId);
        return "Perintah Select All dikirim.";
      case "keyevent":
        await sendAndroidKeyevent(adbId, shortcut.code);
        return `${shortcut.label} dijalankan.`;
      default:
        throw new Error("Shortcut ini belum didukung.");
    }
  }

  async function captureAndroidScreenshot(uid, destinationPath = null) {
    const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
    const adbId = record.adbId;
    const manager = ensureAndroidManagerReady();
    const timestamp = Date.now();
    const remotePath = `/sdcard/Download/starbox_screenshot_${timestamp}.png`;
    await manager.runAdbCommand(
      ["-s", adbId, "shell", "screencap", "-p", remotePath],
      { timeout: 20000, silent: true }
    );
    const safeAdbId = String(adbId || uid)
      .replace(/[^a-z0-9_-]+/gi, "-")
      .toLowerCase();
    const tempDir = path.join(os.tmpdir(), "starbox-screenshots");
    fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `${safeAdbId}-${timestamp}.png`);
    await manager.runAdbCommand(["-s", adbId, "pull", remotePath, tempPath], {
      timeout: 20000,
      silent: true,
    });
    await manager
      .runAdbCommand(["-s", adbId, "shell", "rm", remotePath], {
        timeout: 8000,
        silent: true,
      })
      .catch(() => {});
    if (destinationPath) {
      fs.copyFileSync(tempPath, destinationPath);
      return { path: destinationPath };
    }
    return { path: tempPath };
  }

  const MAX_WIFI_SCAN_TARGETS = 256;

  function isPrivateIPv4Address(ip = "") {
    if (typeof ip !== "string") return false;
    if (/^10\./.test(ip)) return true;
    if (/^192\.168\./.test(ip)) return true;
    const match = ip.match(/^172\.(\d+)\./);
    if (match) {
      const second = Number(match[1]);
      return second >= 16 && second <= 31;
    }
    return false;
  }

  function parseArpTableOutput(output = "") {
    const candidates = new Set();
    if (!output) return candidates;
    const matches = output.match(/(\d{1,3}(?:\.\d{1,3}){3})/g) || [];
    matches.forEach((ip) => {
      if (isPrivateIPv4Address(ip)) {
        candidates.add(ip);
      }
    });
    return candidates;
  }

  function collectArpCandidates() {
    const entries = new Set();
    const commands = [
      { cmd: "arp", args: ["-a"] },
      { cmd: "arp", args: ["-an"] },
    ];
    if (process.platform === "linux") {
      commands.push({ cmd: "ip", args: ["neighbor"] });
    }
    commands.forEach(({ cmd, args }) => {
      try {
        const result = spawnSync(cmd, args, {
          encoding: "utf8",
          windowsHide: true,
        });
        if (result.stdout) {
          parseArpTableOutput(result.stdout).forEach((ip) => entries.add(ip));
        }
      } catch (err) {
        console.warn(`⚠️ Gagal menjalankan ${cmd}:`, err?.message || err);
      }
    });
    return entries;
  }

  function collectInterfaceNeighborCandidates() {
    const neighbors = new Set();
    const interfaces = os.networkInterfaces() || {};
    Object.values(interfaces).forEach((infos = []) => {
      infos.forEach((info = {}) => {
        if (info.family !== "IPv4" || info.internal) return;
        const address = info.address;
        if (!isPrivateIPv4Address(address)) return;
        const parts = address.split(".");
        if (parts.length !== 4) return;
        const base = parts.slice(0, 3).join(".");
        const last = Number(parts[3]);
        const hostRange = [];
        for (let host = 2; host <= 254; host += 1) {
          const candidate = `${base}.${host}`;
          if (candidate === address) continue;
          hostRange.push(candidate);
        }
        hostRange.forEach((ip) => neighbors.add(ip));
      });
    });
    return neighbors;
  }

  function ipToSortableNumber(ip = "") {
    return ip
      .split(".")
      .map((part) => Number(part) || 0)
      .reduce((acc, part) => (acc << 8) + part, 0);
  }

  function getWifiScanCandidates() {
    const combined = new Set();
    collectArpCandidates().forEach((ip) => combined.add(ip));
    collectInterfaceNeighborCandidates().forEach((ip) => combined.add(ip));
    combined.delete("127.0.0.1");
    const ordered = Array.from(combined)
      .filter(isPrivateIPv4Address)
      .sort((a, b) => ipToSortableNumber(a) - ipToSortableNumber(b));
    return ordered.slice(0, MAX_WIFI_SCAN_TARGETS);
  }

  function probeAdbPort(ip, port = 5555, timeout = 1200) {
    return new Promise((resolve) => {
      let settled = false;
      const socket = nodeNet.createConnection({
        host: ip,
        port,
        timeout,
      });
      const finalize = (result) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(timeout);
      socket.once("connect", () => finalize(true));
      socket.once("timeout", () => finalize(false));
      socket.once("error", () => finalize(false));
      socket.unref();
    });
  }

  /**
   * Quick check if an IP is alive by testing common ports
   * Returns true if ANY port responds within timeout
   */
  async function isIpAlive(ip, timeout = 200) {
    // Common ports termasuk ADB wireless ports yang sering dipakai
    const commonPorts = [
      // Standard ports
      22, 80, 443, 8080,
      // ADB wired & emulator
      5555, 5556, 5557,
      // ADB wireless common ports (sampling dari range 30000-49999)
      37229, 37121, 40000, 43211, 43393, 45000, 47233, 49555,
    ];
    const probes = commonPorts.map((port) =>
      probeAdbPort(ip, port, timeout).catch(() => false)
    );
    const results = await Promise.all(probes);
    return results.some((r) => r === true);
  }

  async function scanLocalWifiForAdbDevices(
    emitProgress = true,
    scanMode = "quick"
  ) {
    const manager = ensureAndroidManagerReady();
    const allCandidates = getWifiScanCandidates();
    const connected = [];
    let scannedCount = 0;
    let index = 0;
    const concurrency = Math.min(20, Math.max(2, allCandidates.length)); // Increased concurrency for deep scan

    let candidates = allCandidates;

    // PRE-FILTER: Only for QUICK scan mode (deep scan needs to be comprehensive)
    if (scanMode === "quick") {
      logDev(
        `\n🔍 [WiFi Scan] Pre-filtering: Checking ${allCandidates.length} IPs untuk yang aktif...`
      );

      const aliveCheckPromises = allCandidates.map((ip) =>
        isIpAlive(ip, 150).then((alive) => ({ ip, alive }))
      );
      const aliveResults = await Promise.all(aliveCheckPromises);
      candidates = aliveResults.filter((r) => r.alive).map((r) => r.ip);

      const skippedCount = allCandidates.length - candidates.length;
      logDev(
        `✅ [WiFi Scan] Pre-filter complete: ${candidates.length} aktif, ${skippedCount} di-skip`
      );

      if (candidates.length === 0) {
        logDev(`⚠️ [WiFi Scan] Tidak ada IP yang responding, scan dibatalkan`);
        return { success: true, connected: [], scanned: allCandidates.length };
      }
    } else {
      logDev(
        `\n🔍 [WiFi Scan] DEEP MODE: Scanning semua ${allCandidates.length} IPs (no pre-filter)`
      );
    }

    // Common ADB wireless ports to check
    let portsToCheck = [];

    if (scanMode === "deep") {
      // DEEP SCAN: Full range 30000-49999 (step 2 untuk kecepatan)
      logDev(`🔍 [WiFi Scan] Mode: DEEP SCAN (range 30000-49999 step 2)`);
      for (let p = 30000; p <= 49999; p += 2) {
        portsToCheck.push(p);
      }
    } else {
      // QUICK SCAN: Port umum yang sering dipakai (default)
      logDev(`🔍 [WiFi Scan] Mode: QUICK SCAN (curated ports)`);
      portsToCheck = [
        // klasik
        5555, 5556, 5557, 5558, 5559, 5560,

        // emulator
        5554, 5556, 5558,

        // vendor ports
        37229, 37121, 37881, 37777,

        // wireless debugging common
        37000, 37219, 37453, 39129, 39797, 40000, 40311, 40901, 43211, 43381,
        45000, 46101, 47233, 48651, 49555, 49857,

        // your device found port
        36535,
      ];
    }

    logDev(`\n🔍 [WiFi Scan] Memulai scan WiFi untuk ADB devices`);
    logDev(`📊 [WiFi Scan] Total IP candidates: ${candidates.length}`);
    logDev(`🔧 [WiFi Scan] Concurrency: ${concurrency}`);
    logDev(`🔌 [WiFi Scan] Ports to check: ${portsToCheck.join(", ")}`);
    logDev(
      `📋 [WiFi Scan] IP list:\n   ${candidates.slice(0, 10).join(", ")}${
        candidates.length > 10 ? ` ... (+${candidates.length - 10} more)` : ""
      }\n`
    );

    // Send initial progress to main window
    if (emitProgress) {
      const mainWin = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents
      );
      if (mainWin) {
        mainWin.webContents.send("adb-wifi-scan-progress", {
          progress: 0,
          scannedCount: 0,
          totalCount: candidates.length,
          foundDevices: [],
        });
      }
    }

    // Adjust timeout based on scan mode (shorter for deep scan to speed things up)
    const portTimeout = scanMode === "deep" ? 400 : 800;

    const worker = async () => {
      while (index < candidates.length) {
        const currentIndex = index;
        index += 1;
        const ip = candidates[currentIndex];
        if (!ip) break;

        scannedCount++;
        const progress = Math.round((scannedCount / candidates.length) * 100);

        logDev(
          `🔎 [${progress}%] Scanning ${ip} on ${portsToCheck.length} ports (${scannedCount}/${candidates.length})`
        );

        const reachablePorts = [];

        // Check ALL ports for this IP (don't break after first one)
        for (const port of portsToCheck) {
          try {
            const reachable = await probeAdbPort(ip, port, portTimeout);
            if (reachable) {
              logDev(`   ✅ Port ${port} reachable on ${ip}`);
              reachablePorts.push(port);
              // Continue checking other ports instead of breaking
            }
          } catch (err) {
            // Port not reachable, continue to next port
          }
        }

        if (reachablePorts.length === 0) {
          logDev(`   ⏭  No ADB ports reachable on ${ip}, skipping`);
          continue;
        }

        logDev(
          `   🎯 Found ${
            reachablePorts.length
          } reachable port(s) on ${ip}: ${reachablePorts.join(", ")}`
        );

        // Try to connect to ALL found ports
        for (const port of reachablePorts) {
          try {
            logDev(`   🔌 Attempting ADB connect to ${ip}:${port}...`);
            const output = await manager.runAdbCommand(
              ["connect", `${ip}:${port}`],
              { timeout: 8000, silent: true }
            );

            logDev(`   📤 ADB response: ${output.trim()}`);

            if (
              /connected to/i.test(output) ||
              /already connected/i.test(output)
            ) {
              const deviceId = `${ip}:${port}`;
              connected.push(deviceId);
              logDev(`   ✅ SUCCESS! Connected to ${deviceId}`);

              // Emit real-time progress with found device
              if (emitProgress) {
                const mainWin = BrowserWindow.getAllWindows().find(
                  (w) => !w.isDestroyed() && w.webContents
                );
                if (mainWin) {
                  mainWin.webContents.send("adb-wifi-scan-progress", {
                    progress,
                    scannedCount,
                    totalCount: candidates.length,
                    foundDevices: [...connected],
                    newDevice: deviceId,
                  });
                }
              }
            } else {
              logDev(`   ❌ Connection failed: ${output.trim()}`);
            }
          } catch (err) {
            warnDev(
              `   ⚠️  adb connect ke ${ip}:${port} gagal:`,
              err?.message || err
            );
          }
        }
      }
    };

    const tasks = Array.from({ length: concurrency }, () => worker());
    await Promise.all(tasks);

    logDev(`\n✅ [WiFi Scan] Selesai!`);
    logDev(
      `📊 [WiFi Scan] Total scanned: ${candidates.length} IPs x ${portsToCheck.length} ports`
    );
    logDev(`🎯 [WiFi Scan] Connected: ${connected.length}`);
    if (connected.length > 0) {
      logDev(`📱 [WiFi Scan] Connected devices: ${connected.join(", ")}\n`);
    } else {
      logDev(`❌ [WiFi Scan] No ADB devices found via WiFi\n`);
    }

    // Send final completion event
    if (emitProgress) {
      const mainWin = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents
      );
      if (mainWin) {
        mainWin.webContents.send("adb-wifi-scan-progress", {
          progress: 100,
          scannedCount: candidates.length,
          totalCount: candidates.length,
          foundDevices: [...connected],
          completed: true,
        });
      }
    }

    return {
      scanned: candidates.length,
      connected,
    };
  }

  const WHATSAPP_SAMPLE_MESSAGES = [
    "Remote Android berjalan mulus nomor delapan",
    "Almost done pesan ke sembilan dari StarBox",
    "Pesan terakhir nomor sepuluh terima kasih",
  ];

  function ensureAndroidRemoteDb() {
    if (!ANDROID_REMOTE_DB_PATH) return;
    const dir = path.dirname(ANDROID_REMOTE_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(ANDROID_REMOTE_DB_PATH)) {
      fs.writeFileSync(
        ANDROID_REMOTE_DB_PATH,
        JSON.stringify({ devices: [] }, null, 2)
      );
    }
  }

  function readAndroidRemoteDevices() {
    ensureAndroidRemoteDb();
    try {
      const raw = fs.readFileSync(ANDROID_REMOTE_DB_PATH, "utf8");
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (Array.isArray(data?.devices)) {
        const devices = data.devices.map((device) => {
          const next = { ...device };
          if (typeof next.whatsappBaseUrl !== "string") {
            next.whatsappBaseUrl = "";
          }
          if (typeof next.whatsappCallbackUrl !== "string") {
            next.whatsappCallbackUrl = "";
          }
          next.whatsappVariant = sanitizeWhatsappVariant(
            next.whatsappVariant || "consumer"
          );
          return next;
        });
        // if (IS_DEV_BUILD) {
        //   logConsoleOnly("📱 [ADB] devices snapshot:", devices);
        // }
        return devices;
      }
    } catch (err) {
      console.warn("⚠️ Gagal membaca adb-devices.json:", err?.message || err);
    }
    return [];
  }

  function writeAndroidRemoteDevices(devices = []) {
    ensureAndroidRemoteDb();
    try {
      fs.writeFileSync(
        ANDROID_REMOTE_DB_PATH,
        JSON.stringify({ devices }, null, 2)
      );
    } catch (err) {
      console.warn("⚠️ Gagal menulis adb-devices.json:", err?.message || err);
    }
  }

  function findAndroidRemoteDevice(uid) {
    if (!uid) return null;
    const devices = readAndroidRemoteDevices();
    return devices.find((device) => device.uid === uid) || null;
  }

  async function resolveEmulatorAdbTarget(device = {}) {
    if (!device?.uid) return null;
    const manager = ensureAndroidManagerReady();
    const devices = await manager.listConnectedDevices();
    const emulatorDevices = devices.filter(
      (entry) =>
        entry?.status === "device" &&
        /^emulator-\d+$/i.test(String(entry.adbId || ""))
    );
    const expectedAvdName = String(
      device.avdName || generateAvdName(device.uid)
    ).trim();

    for (const entry of emulatorDevices) {
      try {
        const output = await manager.runAdbCommand(
          ["-s", entry.adbId, "emu", "avd", "name"],
          { timeout: 4000, silent: true }
        );
        if (String(output || "").trim() === expectedAvdName) {
          return entry.adbId;
        }
      } catch (_) {}
    }
    return null;
  }

  function resolveWhatsappPackageName(variant = "consumer") {
    return sanitizeWhatsappVariant(variant) === "business"
      ? "com.whatsapp.w4b"
      : "com.whatsapp";
  }

  // Mode tampilan device Android automation:
  // - "readonly" (default): emulator headless + mirror scrcpy --no-control
  // - "native": window QEMU asli (mandiri, kontrol penuh, tanpa scrcpy)
  function sanitizeAndroidDisplayMode(value = "") {
    return String(value || "").trim().toLowerCase() === "native"
      ? "native"
      : "readonly";
  }

  async function resolveAndroidDeviceRecord(uid, options = {}) {
    const { requireAdb = false } = options;
    const remoteRecord = findAndroidRemoteDevice(uid);
    if (remoteRecord) {
      const resolvedTarget = await resolveAdbTarget(remoteRecord.adbId);
      const adbId = resolvedTarget?.adbId || remoteRecord.adbId || "";
      if (requireAdb && !adbId) {
        throw new Error("Device tidak memiliki ADB ID.");
      }
      return {
        source: "adb-remote",
        uid: remoteRecord.uid,
        name: remoteRecord.name || "Android Device",
        service: sanitizeRemoteServiceId(remoteRecord.service || "android-general"),
        adbId,
        status: remoteRecord.status || "disconnected",
        whatsappBaseUrl: sanitizePendingUrl(remoteRecord.whatsappBaseUrl || ""),
        whatsappCallbackUrl: sanitizePendingUrl(
          remoteRecord.whatsappCallbackUrl || ""
        ),
        whatsappVariant: sanitizeWhatsappVariant(
          remoteRecord.whatsappVariant || "consumer"
        ),
        displayMode: sanitizeAndroidDisplayMode(remoteRecord.androidDisplayMode),
        raw: remoteRecord,
      };
    }

    const emulatorConfig = getDeviceConfig(uid);
    if (emulatorConfig && (emulatorConfig.service || "").toLowerCase() === "android") {
      const adbId = await resolveEmulatorAdbTarget(emulatorConfig);
      if (requireAdb && !adbId) {
        throw new Error(
          "Emulator belum aktif atau belum terdeteksi ADB. Jalankan emulator terlebih dahulu."
        );
      }
      return {
        source: "emulator",
        uid: emulatorConfig.uid || uid,
        name: emulatorConfig.name || "Android Emulator",
        service: sanitizeRemoteServiceId(
          emulatorConfig.androidAutomationService || "android-general"
        ),
        adbId: adbId || "",
        status: emulatorConfig.status || "stopped",
        whatsappBaseUrl: sanitizePendingUrl(
          emulatorConfig.whatsappBaseUrl || ""
        ),
        whatsappCallbackUrl: sanitizePendingUrl(
          emulatorConfig.whatsappCallbackUrl || ""
        ),
        whatsappVariant: sanitizeWhatsappVariant(
          emulatorConfig.whatsappVariant || "consumer"
        ),
        displayMode: sanitizeAndroidDisplayMode(emulatorConfig.androidDisplayMode),
        raw: emulatorConfig,
      };
    }

    throw new Error("Device Android tidak ditemukan.");
  }

  const androidRemoteActionTokens = new Map();

  function beginAndroidRemoteAction(uid) {
    if (!uid) return null;
    const existing = androidRemoteActionTokens.get(uid);
    if (existing) {
      existing.aborted = true;
    }
    const token = { aborted: false, startedAt: Date.now() };
    androidRemoteActionTokens.set(uid, token);
    return token;
  }

  function cancelAndroidRemoteAction(uid) {
    if (!uid) return false;
    const token = androidRemoteActionTokens.get(uid);
    if (token) {
      token.aborted = true;
      return true;
    }
    return false;
  }

  function clearAndroidRemoteAction(uid) {
    if (!uid) return;
    androidRemoteActionTokens.delete(uid);
  }

  function addAndroidRemoteDeviceRecord(payload = {}) {
    const devices = readAndroidRemoteDevices();
    const name = String(
      payload.name || payload.service || "Android Remote"
    ).trim();
    const adbId = String(payload.adbId || "").trim();
    const adbName = payload.adbName ? String(payload.adbName || "").trim() : "";
    const service = sanitizeRemoteServiceId(
      payload.service || "android-whatsapp"
    );
    const whatsappVariant = sanitizeWhatsappVariant(
      payload.whatsappVariant || "consumer"
    );
    if (!adbId) {
      throw new Error("ADB device harus dipilih.");
    }
    const duplicate = devices.find(
      (device) => device.adbId.toLowerCase() === adbId.toLowerCase()
    );
    if (duplicate) {
      throw new Error(
        `ADB ${adbId} sudah terdaftar sebagai ${duplicate.name || duplicate.uid}.`
      );
    }

    const record = {
      uid: uuidv4(),
      name,
      adbId,
      adbName,
      service,
      status: sanitizeRemoteServiceId(payload.status) || "disconnected",
      whatsappBaseUrl: sanitizePendingUrl(payload.whatsappBaseUrl || ""),
      whatsappCallbackUrl: sanitizePendingUrl(payload.whatsappCallbackUrl || ""),
      whatsappVariant,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    devices.push(record);
    writeAndroidRemoteDevices(devices);
    return record;
  }

  function isMessageInCache(messageId) {
    cleanExpiredMessageCache();
    return WHATSAPP_MESSAGE_CACHE.has(messageId);
  }

  function addMessageToCache(messageId, status = "sending") {
    WHATSAPP_MESSAGE_CACHE.set(messageId, {
      status: status,
      timestamp: Date.now(),
    });
    console.log(`💾 Message added to cache: ${messageId} (${status})`);
  }

  function updateMessageCacheStatus(messageId, status) {
    if (WHATSAPP_MESSAGE_CACHE.has(messageId)) {
      const data = WHATSAPP_MESSAGE_CACHE.get(messageId);
      data.status = status;
      data.timestamp = Date.now();
      console.log(`🔄 Message cache updated: ${messageId} -> ${status}`);
    }
  }

  /**
   * Helper: Kirim callback ke API untuk update status pesan
   */
  async function sendWhatsappCallback(
    callbackUrl,
    messageId,
    status,
    errorMessage = null
  ) {
    if (!callbackUrl || !messageId) return;
    try {
      const https = require("https");
      const http = require("http");
      const url = new URL(callbackUrl);
      const payload = { id: messageId, status: status };
      if (errorMessage) {
        payload.error_message = errorMessage;
      }
      const postData = JSON.stringify(payload);

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      return new Promise((resolve, reject) => {
        const protocol = url.protocol === "https:" ? https : http;
        const req = protocol.request(options, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            console.log(`✅ Callback sent: ${messageId} -> ${status}`);
            resolve({ success: true });
          });
        });
        req.on("error", (err) => {
          console.warn(`⚠️ Callback failed:`, err.message);
          reject(err);
        });
        req.write(postData);
        req.end();
      });
    } catch (err) {
      console.warn(`⚠️ Callback error:`, err.message);
    }
  }

  /**
   * Helper: Deteksi apakah pesan mengandung emoji atau karakter non-ASCII kompleks
   * Comprehensive coverage: standard emoji, ZWJ sequences, skin tones, flags, keycaps, Unicode 15.0
   */
  function hasEmojiOrComplexChars(text) {
    // Comprehensive emoji regex covering ALL Unicode emoji types:
    // - Standard emoji ranges (faces, objects, nature, etc.)
    // - ZWJ sequences (👨‍👩‍👧‍👦, 🤦‍♂️, 👨‍💻)
    // - Skin tone modifiers (👍🏻, 👍🏿)
    // - Regional indicators for flags (🇮🇩, 🇺🇸, 🏳️‍🌈)
    // - Variation selectors (emoji presentation)
    // - Keycap sequences (#️⃣, *️⃣, 0️⃣-9️⃣)
    // - Tag sequences for subdivision flags
    // - Unicode 15.0 additions
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{1F680}-\u{1F6FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|[\u{23F0}]|[\u{23F3}]|[\u{25FD}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2705}]|[\u{270A}-\u{270B}]|[\u{2728}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2795}-\u{2797}]|[\u{27B0}]|[\u{27BF}]|[\u{2B1B}-\u{2B1C}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F236}]|[\u{1F238}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{00A9}]|[\u{00AE}]|[\u{203C}]|[\u{2049}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{2328}]|[\u{23CF}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|\u200D|\uFE0F|[\u{E0020}-\u{E007F}]/u;
    return emojiRegex.test(text);
  }

  /**
   * Helper: Hapus semua emoji dari text (fallback untuk edge case emoji tidak terdeteksi)
   * Digunakan untuk membersihkan pesan sebelum typing manual agar tidak gagal
   */
  function stripEmoji(text) {
    if (!text) return "";
    // Remove ALL emoji using comprehensive regex (with global flag)
    // Replaces undetected emoji with empty string to ensure typing continues normally
    return text.replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{1F680}-\u{1F6FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|[\u{23F0}]|[\u{23F3}]|[\u{25FD}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2705}]|[\u{270A}-\u{270B}]|[\u{2728}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2795}-\u{2797}]|[\u{27B0}]|[\u{27BF}]|[\u{2B1B}-\u{2B1C}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F236}]|[\u{1F238}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{00A9}]|[\u{00AE}]|[\u{203C}]|[\u{2049}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{2328}]|[\u{23CF}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|\u200D|\uFE0F|[\u{E0020}-\u{E007F}]/gu,
      ""
    );
  }

  async function sendWhatsappSampleMessagesThroughAdb(adbId, options = {}) {
    if (!adbId) throw new Error("ADB ID tidak valid.");
    const manager = ensureAndroidManagerReady();
    const actionToken = options.token || null;
    const messages =
      (Array.isArray(options.messages) && options.messages.length
        ? options.messages
        : WHATSAPP_SAMPLE_MESSAGES) || WHATSAPP_SAMPLE_MESSAGES;
    const phoneNumber = String(options.phoneNumber || "6282234528303").replace(
      /[^\d]/g,
      ""
    );
    const whatsappVariant = sanitizeWhatsappVariant(
      options.whatsappVariant || options.variant
    );
    const whatsappPackage = resolveWhatsappPackageName(whatsappVariant);
    const callbackUrl = options.callbackUrl || null;
    const messageId = options.messageId || null;
    if (!phoneNumber) {
      throw new Error("Nomor tujuan WhatsApp tidak valid.");
    }
    await ensureDeviceScreenAwake(adbId);

    for (let i = 0; i < messages.length; i += 1) {
      if (actionToken?.aborted) {
        throw new Error("Remote action dibatalkan oleh pengguna.");
      }
      await ensureDeviceScreenAwake(adbId);
      let message = messages[i];

      // CEK CACHE: Skip jika pesan sudah sedang/sudah dikirim
      if (messageId && isMessageInCache(messageId)) {
        const cacheData = WHATSAPP_MESSAGE_CACHE.get(messageId);
        console.log(
          `⏭️ [ADB:${adbId}] Pesan ${messageId} sudah ada di cache (${cacheData.status}), skip!`
        );
        continue;
      }

      // ADD TO CACHE: Tandai pesan sedang dikirim
      if (messageId) {
        addMessageToCache(messageId, "sending");

        // KIRIM STATUS UPDATE: Tampilkan status "sedang mengetik" di android-remote window
        const scrcpyWin = scrcpyWindows.get(adbId);
        if (scrcpyWin && !scrcpyWin.isDestroyed()) {
          scrcpyWin.webContents.send("automation-update", {
            messageId: messageId,
            status: "typing",
            statusText: "⌨️ Sedang mengetik...",
            message:
              message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          });
        }
      }

      // WhatsApp limit untuk pengguna individu: 65,536 karakter per pesan
      const WHATSAPP_MESSAGE_LIMIT = 65536;

      if (message.length > WHATSAPP_MESSAGE_LIMIT) {
        console.warn(
          `⚠️ [ADB:${adbId}] Pesan ${i + 1} terlalu panjang (${
            message.length
          } chars, limit: ${WHATSAPP_MESSAGE_LIMIT}), akan dipotong!`
        );

        // Potong pesan ke batas maksimal
        message = message.substring(0, WHATSAPP_MESSAGE_LIMIT);

        // Kirim callback dengan warning jika ada
        if (callbackUrl && messageId) {
          console.log(
            `📞 [ADB:${adbId}] Mengirim callback warning (pesan dipotong)...`
          );
          sendWhatsappCallback(
            callbackUrl,
            messageId,
            "done",
            `Pesan dipotong dari ${messages[i].length} ke ${WHATSAPP_MESSAGE_LIMIT} karakter (limit WhatsApp)`
          ).catch((err) => {
            console.warn(`⚠️ Failed to send callback:`, err.message);
          });
        }
      }

      const hasEmoji = hasEmojiOrComplexChars(message);
      // Baris baru tidak bisa diketik via `input text` (token %0A akan terkirim
      // sebagai teks mentah) — wajib lewat URL redirect agar format terjaga
      const hasNewline = /[\r\n]/.test(message);
      const MAX_TYPING_CHARS = 200; // Batas untuk gunakan typing method

      console.log(
        `📲 [ADB:${adbId}] Mengirim pesan WhatsApp ${i + 1}/${messages.length} (${
          message.length
        } chars, emoji: ${hasEmoji ? "yes" : "no"}, newline: ${
          hasNewline ? "yes" : "no"
        })`
      );

      // Wrap sending logic in try-catch untuk error handling
      try {
        // LOGIKA:
        // - Pesan < 200 chars, tanpa emoji & tanpa baris baru: typing method
        // - Pesan >= 200 chars, dengan emoji, atau multiline: wa.me URL redirect

        if (message.length < MAX_TYPING_CHARS && !hasEmoji && !hasNewline) {
          // METODE 1: TYPING - Untuk pesan pendek tanpa emoji
          const cleanMessage = stripEmoji(message);
          const waUrl = `https://wa.me/${phoneNumber}`;

          console.log(
            `⌨️ [ADB:${adbId}] Kirim via typing instant (${cleanMessage.length} chars)...`
          );

          await manager.runAdbCommand(
            [
              "-s",
              adbId,
              "shell",
              "am",
              "start",
              "-a",
              "android.intent.action.VIEW",
              "-d",
              waUrl,
              whatsappPackage,
            ],
            { timeout: 20000, silent: true }
          );

          await sleep(2000);

          const isForeground = await waitForWhatsappForeground(
            adbId,
            whatsappPackage,
            10000
          );
          if (!isForeground) {
            throw new Error(
              "WhatsApp tidak terbuka di foreground — pengiriman dibatalkan agar tidak mengetik di aplikasi lain."
            );
          }

          // WAJIB: fokuskan kolom input dulu, kalau tidak keyevent/typing
          // jatuh ke elemen lain di WhatsApp (terlihat seperti klik tombol acak)
          const entryBounds = await tapWhatsappInputField(adbId);
          if (!entryBounds) {
            throw new Error(
              "Kolom input pesan WhatsApp tidak ditemukan — chat mungkin belum terbuka."
            );
          }

          await clearWhatsappInputField(adbId);

          if (actionToken?.aborted) {
            throw new Error("Remote action dibatalkan oleh pengguna.");
          }

          await typeTextWithSpeed(
            adbId,
            cleanMessage,
            options.typingSpeed || "instant"
          );

          console.log(
            `✅ [ADB:${adbId}] Typing selesai, tunggu 1 detik sebelum klik send...`
          );
          await sleep(1000);

          if (actionToken?.aborted) {
            throw new Error("Remote action dibatalkan oleh pengguna.");
          }

          console.log(`📤 [ADB:${adbId}] Klik tombol send...`);
          await tapWhatsappSendButton(adbId, entryBounds);

          console.log(`⏳ [ADB:${adbId}] Menunggu pesan terkirim (3 detik)...`);
          await sleep(3000);
        } else {
          // METODE 2: URL REDIRECT - Untuk pesan panjang atau dengan emoji
          const encodedMessage = encodeURIComponent(message);
          const waUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

          console.log(
            `🔗 [ADB:${adbId}] Kirim via URL redirect (${message.length} chars, URL: ${waUrl.length} chars)`
          );

          await manager.runAdbCommand(
            [
              "-s",
              adbId,
              "shell",
              "am",
              "start",
              "-a",
              "android.intent.action.VIEW",
              "-d",
              waUrl,
              whatsappPackage,
            ],
            { timeout: 20000, silent: true }
          );

          await sleep(2500);

          const isForeground = await waitForWhatsappForeground(
            adbId,
            whatsappPackage,
            10000
          );
          if (!isForeground) {
            throw new Error(
              "WhatsApp tidak terbuka di foreground — pengiriman dibatalkan agar tidak salah klik."
            );
          }

          if (actionToken?.aborted) {
            throw new Error("Remote action dibatalkan oleh pengguna.");
          }

          const entryBounds = await resolveWhatsappNodeBounds(
            adbId,
            WHATSAPP_ENTRY_FIELD_IDS,
            { retries: 2, delayMs: 800 }
          );
          await tapWhatsappSendButton(adbId, entryBounds);

          console.log(`⏳ [ADB:${adbId}] Menunggu pesan terkirim (2 detik)...`);
          await sleep(2000);
        }

        // Update cache: pesan berhasil terkirim
        if (messageId) {
          updateMessageCacheStatus(messageId, "sent");

          // KIRIM STATUS UPDATE: Tampilkan status "terkirim" di android-remote window
          const scrcpyWin = scrcpyWindows.get(adbId);
          if (scrcpyWin && !scrcpyWin.isDestroyed()) {
            scrcpyWin.webContents.send("automation-update", {
              messageId: messageId,
              status: "sent",
              statusText: "✅ Terkirim",
              message:
                message.substring(0, 50) + (message.length > 50 ? "..." : ""),
            });
          }
        }

        // Kirim callback sukses
        if (callbackUrl && messageId) {
          console.log(`📞 [ADB:${adbId}] Mengirim callback sukses...`);
          sendWhatsappCallback(callbackUrl, messageId, "done").catch((err) => {
            console.warn(`⚠️ Failed to send callback:`, err.message);
          });
        }
      } catch (error) {
        // Error handling: Update cache ke failed dan kirim callback
        console.error(
          `❌ [ADB:${adbId}] Error saat mengirim pesan ${i + 1}:`,
          error.message
        );

        // Update cache ke failed
        if (messageId) {
          updateMessageCacheStatus(messageId, "failed");

          // KIRIM STATUS UPDATE: Tampilkan status "gagal" di android-remote window
          const scrcpyWin = scrcpyWindows.get(adbId);
          if (scrcpyWin && !scrcpyWin.isDestroyed()) {
            scrcpyWin.webContents.send("automation-update", {
              messageId: messageId,
              status: "failed",
              statusText: "❌ Gagal",
              message:
                message.substring(0, 50) + (message.length > 50 ? "..." : ""),
              error: error.message,
            });
          }
        }

        // Kirim callback failed
        if (callbackUrl && messageId) {
          sendWhatsappCallback(
            callbackUrl,
            messageId,
            "failed",
            error.message
          ).catch((err) => {
            console.warn(`⚠️ Failed to send error callback:`, err.message);
          });
        }

        // Continue ke pesan berikutnya (jangan throw error, biar pesan lain tetap dikirim)
      }

      // Delay antar pesan untuk memastikan pesan sebelumnya sudah benar-benar terkirim
      // sebelum memulai pesan berikutnya
      if (i < messages.length - 1) {
        console.log(
          `⏸️ [ADB:${adbId}] Delay 2 detik sebelum pesan berikutnya (${i + 2}/${
            messages.length
          })...`
        );
        await sleep(2000);
      }
    }
  }

  async function sendSingleWhatsappMessage(
    adbId,
    phoneNumber,
    message = "",
    options = {}
  ) {
    const whatsappVariant = sanitizeWhatsappVariant(
      options.whatsappVariant || options.variant
    );
    await sendWhatsappSampleMessagesThroughAdb(adbId, {
      messages: [String(message || "")],
      phoneNumber: phoneNumber,
      typingSpeed: options.typingSpeed || "instant",
      callbackUrl: options.callbackUrl,
      messageId: options.messageId,
      deviceUid: options.deviceUid,
      whatsappVariant,
    });
  }

  function encodeCharForAdbInput(char = "") {
    if (!char) return "";
    if (char === " ") return "%s";
    // `input text` hanya mengenal token %s (spasi) — %0A TIDAK di-decode dan
    // akan terkirim sebagai teks mentah. Pesan multiline dialihkan ke metode
    // URL redirect; di sini newline diganti spasi sebagai jaring pengaman.
    if (char === "\n" || char === "\r") return "%s";
    if (/^[0-9a-zA-Z]$/.test(char)) return char;
    if (/[.,!?@#\-]/.test(char)) return char;
    return "";
  }

  function encodeTextForAdbInput(text = "") {
    return Array.from(text)
      .map((char) => encodeCharForAdbInput(char))
      .filter(Boolean)
      .join("");
  }

  function containsNonAscii(text = "") {
    return /[^\x20-\x7E]/.test(text);
  }

  async function typeTextWithSpeed(adbId, text = "", typingSpeed = "instant") {
    if (!adbId || !text) return;
    const manager = ensureAndroidManagerReady();
    const normalized = (typingSpeed || "instant").toLowerCase();

    // ADB input text has buffer limit ~200-300 chars
    // For long text, use clipboard paste automatically
    const ADB_INPUT_SAFE_LIMIT = 200;

    const delayMap = {
      robot: 35,
      fasthuman: 60,
      human: 90,
      slowhuman: 130,
      realistic: { base: 80, jitter: 70 },
      stealth: { base: 70, jitter: 90 },
    };

    if (normalized === "paste") {
      await setClipboardAndPaste(adbId, text, manager);
      return;
    }
    if (normalized === "hybrid") {
      await setClipboardAndPaste(adbId, text, manager);
      await sleep(400);
      return;
    }
    if (containsNonAscii(text)) {
      await setClipboardAndPaste(adbId, text, manager);
      return;
    }

    // Auto-paste for long messages to avoid ADB buffer limit
    if (text.length > ADB_INPUT_SAFE_LIMIT) {
      console.log(
        `📋 [ADB:${adbId}] Pesan panjang (${text.length} chars), gunakan clipboard paste otomatis`
      );
      await setClipboardAndPaste(adbId, text, manager);
      return;
    }

    if (delayMap[normalized]) {
      const config = delayMap[normalized];
      const chars = Array.from(text);
      for (const char of chars) {
        const token = encodeCharForAdbInput(char);
        if (!token) continue;
        await manager.runAdbCommand(
          ["-s", adbId, "shell", "input", "text", token],
          { timeout: 10000, silent: true }
        );
        const delay =
          typeof config === "number"
            ? config
            : config.base + Math.floor(Math.random() * config.jitter);
        await sleep(delay);
      }
      return;
    }

    const encoded = encodeTextForAdbInput(text);
    if (!encoded) return;
    await manager.runAdbCommand(
      ["-s", adbId, "shell", "input", "text", encoded],
      { timeout: 10000, silent: true }
    );
  }

  async function setClipboardAndPaste(adbId, text, manager) {
    // For very long text, use chunked typing approach
    const CHUNK_SIZE = 150; // Safe chunk size for ADB input

    if (text.length > CHUNK_SIZE) {
      console.log(
        `📝 [ADB:${adbId}] Text panjang (${text.length} chars), kirim dalam chunks...`
      );

      // Split text into chunks
      const chunks = [];
      for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.substring(i, i + CHUNK_SIZE));
      }

      // Send each chunk sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const encoded = encodeTextForAdbInput(chunk);

        if (encoded) {
          await manager.runAdbCommand(
            ["-s", adbId, "shell", "input", "text", encoded],
            { timeout: 10000, silent: true }
          );

          console.log(
            `  ✓ Chunk ${i + 1}/${chunks.length} sent (${chunk.length} chars)`
          );

          // Small delay between chunks
          if (i < chunks.length - 1) {
            await sleep(100);
          }
        }
      }

      console.log(
        `✅ [ADB:${adbId}] Semua ${chunks.length} chunks berhasil dikirim`
      );
      return;
    }

    // For short text, try clipper broadcast method
    try {
      await manager.runAdbCommand(
        [
          "-s",
          adbId,
          "shell",
          "am",
          "broadcast",
          "-a",
          "clipper.set",
          "-e",
          "text",
          text,
        ],
        { timeout: 15000, silent: true }
      );

      // Paste using keyevent 279 (KEYCODE_PASTE)
      await manager.runAdbCommand(
        ["-s", adbId, "shell", "input", "keyevent", "279"],
        { timeout: 8000, silent: true }
      );

      console.log(`📋 [ADB:${adbId}] Clipboard paste method used`);
    } catch (err) {
      console.warn(
        `⚠️ Clipboard method failed, using direct input:`,
        err.message
      );

      // Fallback to direct input
      const encoded = encodeTextForAdbInput(text);
      if (encoded) {
        await manager.runAdbCommand(
          ["-s", adbId, "shell", "input", "text", encoded],
          { timeout: 10000, silent: true }
        );
      }
    }
  }

  async function tapAtPoint(adbId, x, y) {
    const manager = ensureAndroidManagerReady();
    await manager.runAdbCommand(
      [
        "-s",
        adbId,
        "shell",
        "input",
        "tap",
        String(Math.round(x)),
        String(Math.round(y)),
      ],
      { timeout: 10000, silent: true }
    );
  }

  async function tapWhatsappSendButton(adbId, entryBounds = null) {
    let target = await resolveWhatsappNodeBounds(adbId, WHATSAPP_SEND_BUTTON_IDS, {
      retries: 3,
      delayMs: 900,
    });

    // Fallback: posisi tombol send selalu di kanan kolom input, sejajar vertikal.
    if (!target && entryBounds) {
      const { width } = await getDeviceDisplayMetrics(adbId);
      target = {
        x: entryBounds.x2 + (width - entryBounds.x2) / 2,
        y: entryBounds.y1 + (entryBounds.y2 - entryBounds.y1) / 2,
      };
      console.warn(
        `⚠️ [ADB:${adbId}] Tombol send tidak ketemu via uidump, pakai posisi relatif kolom input (${Math.round(target.x)},${Math.round(target.y)})`
      );
    }

    if (!target) {
      throw new Error(
        "Tombol send WhatsApp tidak ditemukan — chat mungkin belum terbuka, pengiriman dibatalkan agar tidak salah klik."
      );
    }
    await tapAtPoint(adbId, target.x, target.y);
  }

  async function getDeviceDisplayMetrics(adbId) {
    const manager = ensureAndroidManagerReady();
    try {
      const output = await manager.runAdbCommand(
        ["-s", adbId, "shell", "wm", "size"],
        { timeout: 8000, silent: true }
      );
      const match = output.match(/Physical size:\s*(\d+)x(\d+)/i);
      if (match) {
        return { width: Number(match[1]), height: Number(match[2]) };
      }
    } catch (err) {
      console.warn(
        `⚠️ Gagal membaca resolusi device ${adbId}, gunakan default:`,
        err?.message || err
      );
    }
    return { width: 1080, height: 1920 };
  }

  async function clearWhatsappInputField(adbId) {
    const manager = ensureAndroidManagerReady();
    try {
      await manager.runAdbCommand(
        ["-s", adbId, "shell", "input", "keyevent", "123"],
        { timeout: 6000, silent: true }
      );
      await manager.runAdbCommand(
        ["-s", adbId, "shell", "input", "keyevent", "--longpress", "67"],
        { timeout: 6000, silent: true }
      );
    } catch (err) {
      console.warn(
        `⚠️ Gagal clear dengan longpress untuk ${adbId}, fallback delete.`,
        err?.message || err
      );
      for (let i = 0; i < 80; i += 1) {
        try {
          await manager.runAdbCommand(
            ["-s", adbId, "shell", "input", "keyevent", "67"],
            { timeout: 3000, silent: true }
          );
        } catch {
          break;
        }
      }
    }
  }

  const WHATSAPP_SEND_BUTTON_IDS = [
    "com.whatsapp:id/send",
    "com.whatsapp:id/send_btn",
    "com.whatsapp:id/send_button",
    "com.whatsapp.w4b:id/send",
    "com.whatsapp.w4b:id/send_btn",
    "com.whatsapp.w4b:id/send_button",
  ];

  const WHATSAPP_ENTRY_FIELD_IDS = [
    "com.whatsapp:id/entry",
    "com.whatsapp.w4b:id/entry",
  ];

  async function dumpUiHierarchy(adbId) {
    const manager = ensureAndroidManagerReady();
    const dumpPath = "/sdcard/starbox_uidump.xml";
    await manager.runAdbCommand(
      ["-s", adbId, "shell", "uiautomator", "dump", dumpPath],
      { timeout: 10000, silent: true }
    );
    const xml = await manager.runAdbCommand(
      ["-s", adbId, "shell", "cat", dumpPath],
      { timeout: 10000, silent: true }
    );
    return xml || "";
  }

  function extractBoundsForResourceIds(xml, resourceIds = []) {
    if (!xml) return null;
    for (const resourceId of resourceIds) {
      const pattern = new RegExp(
        `resource-id="${resourceId}"[\\s\\S]*?bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
        "i"
      );
      const match = xml.match(pattern);
      if (match) {
        const x1 = Number(match[1]);
        const y1 = Number(match[2]);
        const x2 = Number(match[3]);
        const y2 = Number(match[4]);
        return {
          x1,
          y1,
          x2,
          y2,
          x: x1 + (x2 - x1) / 2,
          y: y1 + (y2 - y1) / 2,
        };
      }
    }
    return null;
  }

  async function resolveWhatsappNodeBounds(adbId, resourceIds = [], options = {}) {
    const { retries = 3, delayMs = 900 } = options;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const xml = await dumpUiHierarchy(adbId);
        const bounds = extractBoundsForResourceIds(xml, resourceIds);
        if (bounds) return bounds;
      } catch (err) {
        console.warn(
          `⚠️ Gagal dump UI WhatsApp (${adbId}, percobaan ${attempt}/${retries}):`,
          err?.message || err
        );
      }
      if (attempt < retries) await sleep(delayMs);
    }
    return null;
  }

  async function waitForWhatsappForeground(adbId, whatsappPackage, timeoutMs = 10000) {
    const manager = ensureAndroidManagerReady();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const output = await manager.runAdbCommand(
          [
            "-s",
            adbId,
            "shell",
            "dumpsys",
            "window",
            "|",
            "grep",
            "-e",
            "mCurrentFocus",
            "-e",
            "mFocusedApp",
          ],
          { timeout: 8000, silent: true }
        );
        if (String(output || "").includes(whatsappPackage)) {
          return true;
        }
      } catch (err) {
        // grep tanpa hasil mengembalikan exit code != 0 — bukan error fatal
      }
      await sleep(700);
    }
    return false;
  }

  // Tap kolom input pesan supaya fokus keyboard benar-benar di compose box.
  // Tanpa ini, `input text` dan keyevent jatuh ke elemen lain (terlihat seperti
  // klik tombol acak di WhatsApp).
  async function tapWhatsappInputField(adbId) {
    const bounds = await resolveWhatsappNodeBounds(adbId, WHATSAPP_ENTRY_FIELD_IDS, {
      retries: 4,
      delayMs: 900,
    });
    if (!bounds) return null;
    await tapAtPoint(adbId, bounds.x, bounds.y);
    await sleep(500);
    return bounds;
  }

  function parseLoopbackAdbEndpoint(adbId = "") {
    const match = String(adbId || "")
      .trim()
      .toLowerCase()
      .match(/^(127\.0\.0\.1|localhost):(\d+)$/);
    if (!match) return null;
    return {
      host: match[1],
      port: Number.parseInt(match[2], 10),
    };
  }

  function buildAdbTargetCandidates(adbId = "") {
    const trimmed = String(adbId || "").trim();
    if (!trimmed) return [];
    const candidates = [trimmed];
    const loopback = parseLoopbackAdbEndpoint(trimmed);
    if (loopback && Number.isFinite(loopback.port)) {
      if (loopback.host !== "127.0.0.1") {
        candidates.push(`127.0.0.1:${loopback.port}`);
      }
      if (loopback.host !== "localhost") {
        candidates.push(`localhost:${loopback.port}`);
      }
      if (loopback.port >= 5555) {
        const emulatorPort = loopback.port - 1;
        if (emulatorPort >= 5554) {
          candidates.push(`emulator-${emulatorPort}`);
        }
      }
    }
    return [...new Set(candidates)];
  }

  async function resolveAdbTarget(adbId) {
    const trimmed = String(adbId || "").trim();
    if (!trimmed) {
      throw new Error("ADB ID tidak valid.");
    }

    const candidates = buildAdbTargetCandidates(trimmed);
    const liveCandidates = candidates.filter((candidate) => {
      const session = scrcpySessions.get(candidate);
      return session && !session.killed;
    });
    if (liveCandidates.length) {
      return { adbId: liveCandidates[0], requestedAdbId: trimmed, matchedBy: "session" };
    }

    const manager = ensureAndroidManagerReady();
    const devices = await manager.listConnectedDevices();
    const onlineDevices = devices.filter((device) => device?.status === "device");
    const exact = onlineDevices.find((device) =>
      candidates.some(
        (candidate) => candidate.toLowerCase() === String(device.adbId || "").toLowerCase()
      )
    );
    if (exact) {
      return {
        adbId: exact.adbId,
        requestedAdbId: trimmed,
        matchedBy: exact.adbId.toLowerCase() === trimmed.toLowerCase() ? "exact" : "alias",
        device: exact,
      };
    }

    const fallback = devices.find((device) =>
      candidates.some(
        (candidate) => candidate.toLowerCase() === String(device.adbId || "").toLowerCase()
      )
    );
    if (fallback) {
      return {
        adbId: fallback.adbId,
        requestedAdbId: trimmed,
        matchedBy: "offline",
        device: fallback,
      };
    }

    return { adbId: trimmed, requestedAdbId: trimmed, matchedBy: "raw" };
  }

  async function openAndroidDeviceDisplay(uid) {
    if (!uid) {
      throw new Error("UID tidak valid.");
    }
    const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
    const adbId = record.adbId;
    const resolvedTarget = await resolveAdbTarget(adbId);
    const targetAdbId = resolvedTarget.adbId || adbId;
    const existing =
      scrcpySessions.get(targetAdbId) || scrcpySessions.get(adbId);
    if (existing && !existing.killed) {
      // Focus existing control window
      const controlWin =
        scrcpyWindows.get(targetAdbId) || scrcpyWindows.get(adbId);
      if (controlWin && !controlWin.isDestroyed()) {
        controlWin.focus();
      }
      return { message: "Tampilan perangkat sudah berjalan." };
    }

    // scrcpy tidak terpasang (auto-install gagal/belum dijalankan) — untuk
    // emulator StarBox sendiri (bukan HP fisik, yang memang wajib scrcpy)
    // ada jalan keluar: restart dengan window QEMU asli langsung, tanpa
    // scrcpy sama sekali, daripada device macet headless tanpa cara
    // melihat/mengontrolnya.
    if (record.source === "emulator" && !resolveScrcpyBinary()) {
      console.warn(
        `⚠️ [Android:${uid}] scrcpy tidak ditemukan — restart device dengan window native (tanpa scrcpy).`
      );
      const manager = ensureAndroidManagerReady();
      const config = getDeviceConfig(uid) || {};
      const avdName =
        (config.avdName && config.avdName.trim()) ||
        generateAvdName(uid, config.name || "");
      await manager.stopEmulator(avdName, adbId).catch(() => {});
      updateDeviceStatus(uid, "stopped");
      stopAndroidWhatsappAutomationLoop(uid);
      const result = await startAndroidEmulatorDevice(uid, {}, () => {});
      return {
        message: result?.success
          ? "scrcpy tidak ditemukan — device dijalankan dengan window emulator langsung (tanpa mode scrcpy)."
          : result?.message || "Gagal menjalankan device dalam mode native.",
      };
    }

    const deviceName = record.name || "Android Device";
    const service = record.service || "android-general";
    return launchScrcpyForDevice(targetAdbId, uid, deviceName, {
      service: service,
      displayMode: record.displayMode || "readonly",
      whatsappBaseUrl: resolveAutomationPendingEndpoint(record.whatsappBaseUrl),
      whatsappCallbackUrl: resolveAutomationCallbackUrl(
        record.whatsappBaseUrl,
        record.whatsappCallbackUrl
      ),
    });
  }

  async function closeAndroidDeviceDisplay(uid) {
    if (!uid) {
      throw new Error("UID tidak valid.");
    }
    const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
    const resolvedTarget = await resolveAdbTarget(record.adbId);
    const targetAdbId = resolvedTarget?.adbId || record.adbId;
    const candidateIds = [
      targetAdbId,
      record.adbId,
      ...buildAdbTargetCandidates(record.adbId),
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const uniqueIds = [...new Set(candidateIds)];

    let closed = false;
    uniqueIds.forEach((adbId) => {
      scrcpyRestartMeta.delete(adbId);
      const existingWindow = scrcpyWindows.get(adbId);
      if (existingWindow && !existingWindow.isDestroyed()) {
        closed = true;
        existingWindow.close();
        return;
      }
      const proc = scrcpySessions.get(adbId);
      if (proc && !proc.killed) {
        closed = true;
        proc.kill();
        scrcpySessions.delete(adbId);
      }
    });

    return {
      message: closed
        ? "Tampilan perangkat ditutup."
        : "Tampilan perangkat belum berjalan.",
      closed,
    };
  }

  const scrcpyWindows = new Map();

  const scrcpyRecordings = new Map();

  const scrcpyWindowWatchers = new Map();

  const scrcpyRestartMeta = new Map();

  const MAX_SCRCPY_RESTART = 1;

  function createScrcpyWindow(
    uid,
    adbId,
    deviceName = "Android Device",
    options = {}
  ) {
    const {
      service = "android-full-remote",
      displayMode = "readonly",
      whatsappBaseUrl = "",
      whatsappCallbackUrl = "",
    } = options || {};
    // Check if window already exists
    const existing = scrcpyWindows.get(adbId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    const win = new BrowserWindow({
      width: 260,
      minWidth: 230,
      height: 860,
      title: `Remote Control - ${deviceName}`,
      autoHideMenuBar: true,
      icon: getAssetPath("starbox.png"),
      resizable: true,
      show: false,
      useContentSize: false,
      fullscreenable: false,
      simpleFullscreen: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, "android-remote-preload.cjs"),
      },
    });

    const htmlPath = path.join(__dirname, "android-remote.html");
    const queryParams = new URLSearchParams({
      uid: uid,
      adbId: adbId,
      deviceName: deviceName,
      service,
      displayMode: sanitizeAndroidDisplayMode(displayMode),
    });
    if (whatsappBaseUrl) {
      queryParams.set("whatsappBaseUrl", whatsappBaseUrl);
    }
    if (whatsappCallbackUrl) {
      queryParams.set("whatsappCallbackUrl", whatsappCallbackUrl);
    }

    win.loadURL(`file://${htmlPath}?${queryParams.toString()}`);

    win.once("ready-to-show", () => {
      win.show();
      win.focus();
    });

    win.on("closed", () => {
      scrcpyWindows.delete(adbId);
      stopScrcpyWindowWatcher(adbId);
      // Stop scrcpy process if running
      const proc = scrcpySessions.get(adbId);
      if (proc && !proc.killed) {
        proc.kill();
      }
      scrcpySessions.delete(adbId);
    });

    scrcpyWindows.set(adbId, win);
    return win;
  }

  /**
   * "StarSync" — grid window for synchronized multi-device remote control.
   * Fully independent from createScrcpyWindow()/the external scrcpy CLI above:
   * this talks directly to a bundled scrcpy-server.jar over its socket
   * protocol via android-sync-manager.js (see that file for wire-format
   * details verified against scrcpy v4.1 server source).
   */
  function createAndroidSyncWindow() {
    if (androidSyncWindow && !androidSyncWindow.isDestroyed()) {
      androidSyncWindow.focus();
      return androidSyncWindow;
    }

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 640,
      minHeight: 480,
      title: "StarSync — Kontrol Serentak Android",
      autoHideMenuBar: true,
      icon: getAssetPath("starbox.png"),
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, "android-sync-preload.cjs"),
      },
    });

    win.loadFile(path.join(__dirname, "android-sync.html"));

    win.once("ready-to-show", () => {
      win.show();
      win.focus();
    });

    win.on("closed", () => {
      androidSyncWindow = null;
      if (androidSyncManager) {
        androidSyncManager.disconnectAll().catch(() => {});
      }
    });

    androidSyncWindow = win;
    return win;
  }

  function stopScrcpyWindowWatcher(adbId) {
    const handle = scrcpyWindowWatchers.get(adbId);
    if (handle) {
      clearInterval(handle);
      scrcpyWindowWatchers.delete(adbId);
    }
  }

  function findScrcpyWindowByTitle(windowTitle) {
    try {
      const windows = windowManager.getWindows();
      if (!Array.isArray(windows) || !windows.length) return null;
      const lowered = (windowTitle || "").toLowerCase();
      return windows.find((w) => {
        try {
          const title = (w.getTitle() || "").toLowerCase();
          return title.includes(lowered) || title.includes("scrcpy");
        } catch {
          return false;
        }
      });
    } catch (err) {
      console.warn(
        "⚠️ Tidak bisa membaca daftar window OS:",
        err?.message || err
      );
      return null;
    }
  }

  function alignControlWindowToScrcpy(controlWin, scrcpyWin, gap = 8) {
    if (!controlWin || controlWin.isDestroyed()) return;
    if (!scrcpyWin) return;
    const scrcpyBounds = scrcpyWin.getBounds?.();
    if (!scrcpyBounds) return;
    const controlBounds = controlWin.getBounds();
    const desiredX = scrcpyBounds.x + scrcpyBounds.width + gap;
    const desiredY = scrcpyBounds.y;
    const desiredHeight = scrcpyBounds.height;
    if (
      Math.abs(controlBounds.x - desiredX) > 2 ||
      Math.abs(controlBounds.y - desiredY) > 2 ||
      Math.abs(controlBounds.height - desiredHeight) > 2
    ) {
      controlWin.setBounds({
        x: desiredX,
        y: desiredY,
        width: controlBounds.width,
        height: desiredHeight,
      });
    }
  }

  function startScrcpyWindowWatcher(adbId, controlWin, windowTitle) {
    stopScrcpyWindowWatcher(adbId);
    const interval = setInterval(() => {
      if (!controlWin || controlWin.isDestroyed()) {
        stopScrcpyWindowWatcher(adbId);
        return;
      }
      const scrcpyWin = findScrcpyWindowByTitle(windowTitle);
      if (!scrcpyWin) return;
      try {
        alignControlWindowToScrcpy(controlWin, scrcpyWin);
        const isMinimized =
          typeof scrcpyWin.isMinimized === "function"
            ? scrcpyWin.isMinimized()
            : false;
        if (isMinimized && !controlWin.isMinimized()) {
          controlWin.minimize();
        } else if (!isMinimized && controlWin.isMinimized()) {
          controlWin.restore();
        }
      } catch (err) {
        console.warn("⚠️ Gagal sinkron posisi SCRCPY:", err?.message || err);
      }
    }, 800);
    scrcpyWindowWatchers.set(adbId, interval);
  }

  function attachControlWindowStateSync(controlWin, windowTitle) {
    const withScrcpy = (callback) => {
      const win = findScrcpyWindowByTitle(windowTitle);
      if (win) {
        try {
          callback(win);
        } catch (err) {
          console.warn("⚠️ Operasi window SCRCPY gagal:", err?.message || err);
        }
      }
    };
    controlWin.on("minimize", () => {
      withScrcpy((win) => win.minimize?.());
    });
    controlWin.on("restore", () => {
      withScrcpy((win) => {
        win.restore?.();
        win.bringToTop?.();
      });
    });
    controlWin.on("hide", () => {
      withScrcpy((win) => win.minimize?.());
    });
    controlWin.on("show", () => {
      withScrcpy((win) => {
        win.restore?.();
        win.bringToTop?.();
      });
    });
  }

  async function findAndPositionScrcpyWindow(controlWin, windowTitle, adbId) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 60;
      const interval = setInterval(() => {
        attempts += 1;
        const scrcpyWin = findScrcpyWindowByTitle(windowTitle);
        if (scrcpyWin) {
          clearInterval(interval);
          try {
            alignControlWindowToScrcpy(controlWin, scrcpyWin);
            scrcpyWin.bringToTop?.();
            controlWin.moveTop();
            console.log(
              `✅ SCRCPY window positioned next to control window for ${adbId}`
            );
            resolve({ positioned: true, window: scrcpyWin });
          } catch (err) {
            console.warn(
              "⚠️ Could not position SCRCPY window:",
              err?.message || err
            );
            resolve({ positioned: false, reason: "positioning_failed" });
          }
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.warn(
            `⚠️ SCRCPY window '${windowTitle}' not found after ${maxAttempts} attempts`
          );
          resolve({ positioned: false, reason: "not_found" });
        }
      }, 150);
    });
  }

  function launchScrcpyForDevice(
    adbId,
    uid = null,
    deviceName = "Android Device",
    options = {}
  ) {
    scrcpyRestartMeta.set(adbId, {
      uid: uid || adbId,
      deviceName,
      options,
      attempts: 0,
    });
    const scrcpyBin = resolveScrcpyBinary();
    if (!scrcpyBin) {
      const platform = process.platform;
      let errorMsg = "scrcpy tidak ditemukan. ";
      if (platform === "win32") {
        errorMsg += "Pastikan scrcpy terpasang via Chocolatey (choco install scrcpy), winget (winget install Genymobile.scrcpy), atau manual dari https://github.com/Genymobile/scrcpy/releases. Setelah install, restart StarBox.";
      } else if (platform === "darwin") {
        errorMsg += "Pastikan scrcpy terpasang (contoh: brew install scrcpy di /opt/homebrew/bin/scrcpy atau /usr/local/bin/scrcpy).";
      } else {
        errorMsg += "Pastikan scrcpy terpasang via package manager distro Anda (apt, snap, pacman, dll).";
      }
      throw new Error(errorMsg);
    }
    const startProcess = () => {
      const meta = scrcpyRestartMeta.get(adbId) || {
        service: options?.service || "android-full-remote",
        whatsappBaseUrl: options?.whatsappBaseUrl || "",
        whatsappCallbackUrl: options?.whatsappCallbackUrl || "",
        uid: uid || adbId,
        deviceName,
        attempts: 0,
      };
      scrcpyRestartMeta.set(adbId, meta);
      try {
        createScrcpyWindow(meta.uid, adbId, meta.deviceName, meta.options || meta);

        const serviceId = sanitizeRemoteServiceId(
          meta.options?.service || meta.service || ""
        );
        const isNativeDisplay =
          sanitizeAndroidDisplayMode(
            meta.options?.displayMode || meta.displayMode || ""
          ) === "native";
        const isWhatsappAutomation =
          serviceId === "android-whatsapp" && !isNativeDisplay;
        const windowTitle = `${meta.deviceName} (${adbId})${
          isWhatsappAutomation ? " — Read-Only" : ""
        }`;
        const scrcpyArgs = ["-s", adbId, "--window-title", windowTitle];
        if (isWhatsappAutomation) {
          // Mode WhatsApp automation: layar hanya bisa dilihat (read-only),
          // user tidak bisa klik/buka aplikasi lain sehingga pengiriman
          // pesan pending tidak terganggu. Catatan: --stay-awake tidak boleh
          // dipakai bersama --no-control (scrcpy exit code 1); layar dijaga
          // tetap bangun oleh siklus automation via ADB.
          scrcpyArgs.push("--no-control");
          console.log(
            `🔒 Read-only mode aktif untuk ${adbId} (WhatsApp automation)`
          );
        } else {
          scrcpyArgs.push("--stay-awake");
        }
        // On Windows, use shell if path contains spaces or special chars
        const needsShell = process.platform === "win32" && /[\s()]/.test(scrcpyBin);
        console.log(`🚀 Launching scrcpy from: ${scrcpyBin} (shell=${needsShell})`);
        // scrcpy butuh adb — arahkan ke adb milik SDK internal StarBox,
        // karena adb biasanya tidak ada di PATH sistem (scrcpy exit diam-diam
        // dengan "Command not found: adb" tanpa env ini)
        let scrcpyEnv = { ...process.env };
        try {
          const manager = ensureAndroidManagerReady();
          scrcpyEnv = manager.getProcessEnv();
          scrcpyEnv.ADB = manager.getADBBinary();
        } catch (err) {
          console.warn(
            "⚠️ Tidak bisa menyiapkan env adb untuk scrcpy:",
            err?.message || err
          );
        }
        const proc = spawn(scrcpyBin, scrcpyArgs, {
          shell: needsShell,
          windowsHide: true,
          env: scrcpyEnv,
        });

        // Capture output for debugging
        if (proc.stdout) {
          proc.stdout.on("data", (data) => {
            console.log(`[scrcpy ${adbId}] ${data.toString().trim()}`);
          });
        }
        if (proc.stderr) {
          proc.stderr.on("data", (data) => {
            console.warn(`[scrcpy ${adbId}] ${data.toString().trim()}`);
          });
        }

        scrcpySessions.set(adbId, proc);

        console.log(`✅ SCRCPY launched for ${meta.deviceName} (${adbId})`);

        const cleanup = () => {
          if (scrcpySessions.get(adbId) === proc) {
            scrcpySessions.delete(adbId);
          }
        };

        const attemptRestart = (reason = "") => {
          const data = scrcpyRestartMeta.get(adbId);
          if (!data) return false;
          if (data.attempts >= MAX_SCRCPY_RESTART) return false;
          data.attempts += 1;
          scrcpyRestartMeta.set(adbId, data);
          console.warn(
            `⚠️ SCRCPY exit (${reason || "unknown"}). Auto-restart attempt ${data.attempts}/${MAX_SCRCPY_RESTART} for ${adbId}`
          );
          setTimeout(() => startProcess(), 800);
          return true;
        };

        proc.once("exit", (code, signal) => {
          const restarted = attemptRestart(`exit code ${code} signal ${signal || "none"}`);
          if (!restarted) {
            cleanup();
            scrcpyRestartMeta.delete(adbId);
          }
        });
        proc.once("error", (err) => {
          console.error(`❌ scrcpy error for ${adbId}:`, {
            message: err?.message,
            code: err?.code,
            path: scrcpyBin,
            errno: err?.errno,
            syscall: err?.syscall,
          });
          const restarted = attemptRestart(err?.message || "spawn error");
          if (!restarted) {
            cleanup();
            console.warn(`⚠️ scrcpy gagal untuk ${adbId}:`, err?.message || err);
            scrcpyRestartMeta.delete(adbId);
          }
        });
        proc.once("close", (code, signal) => {
          if (code !== 0) {
            console.warn(
              `⚠️ scrcpy keluar dengan kode ${code} untuk ${adbId} (signal=${signal || "none"})`
            );
          }
        });
      } catch (err) {
        console.warn(`⚠️ Tidak bisa menjalankan scrcpy:`, err?.message || err);
        scrcpyRestartMeta.delete(adbId);
        throw new Error(
          "scrcpy tidak ditemukan atau gagal dijalankan. Pastikan scrcpy terinstal di komputer ini."
        );
      }
    };

    startProcess();
    return { message: "Membuka tampilan perangkat dengan kontrol UI..." };
  }

  async function performAndroidRemoteAction(
    uid,
    action = "default",
    payload = {}
  ) {
    const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
    const token = beginAndroidRemoteAction(uid);
    const service = sanitizeRemoteServiceId(record.service);
    const normalizedAction = action || "default";

    try {
      if (service === "android-whatsapp") {
        const actionType =
          normalizedAction === "whatsapp-send-sample"
            ? "whatsapp-send-sample"
            : "default";
        if (actionType === "whatsapp-send-sample" || actionType === "default") {
          await sendWhatsappSampleMessagesThroughAdb(record.adbId, {
            ...payload,
            token,
            whatsappVariant: record.whatsappVariant,
          });
          return {
            success: true,
            message: "Pesan WhatsApp sampel berhasil dikirim.",
          };
        }
      }

      throw new Error(
        "Aksi remote untuk layanan ini belum tersedia. Gunakan mode remote manual."
      );
    } finally {
      clearAndroidRemoteAction(uid);
    }
  }

  function updateAndroidRemoteDeviceRecord(payload = {}) {
    const uid = payload.uid;
    if (!uid) {
      throw new Error("UID tidak valid.");
    }
    const devices = readAndroidRemoteDevices();
    const index = devices.findIndex((device) => device.uid === uid);
    if (index === -1) {
      throw new Error("Device tidak ditemukan.");
    }
    const current = devices[index];
    const next = { ...current };
    if (typeof payload.name === "string" && payload.name.trim()) {
      next.name = payload.name.trim();
    }
    if (typeof payload.adbId === "string" && payload.adbId.trim()) {
      next.adbId = payload.adbId.trim();
      console.log(`✅ Updated adbId for ${uid}: ${next.adbId}`);
    }
    if (typeof payload.service === "string" && payload.service.trim()) {
      next.service = sanitizeRemoteServiceId(payload.service);
    }
    if (typeof payload.status === "string" && payload.status.trim()) {
      next.status = sanitizeRemoteServiceId(payload.status);
    }
    if (payload.whatsappBaseUrl !== undefined) {
      next.whatsappBaseUrl = sanitizePendingUrl(payload.whatsappBaseUrl || "");
    }
    if (payload.whatsappCallbackUrl !== undefined) {
      next.whatsappCallbackUrl = sanitizePendingUrl(
        payload.whatsappCallbackUrl || ""
      );
    }
    if (payload.whatsappVariant !== undefined) {
      next.whatsappVariant = sanitizeWhatsappVariant(
        payload.whatsappVariant || "consumer"
      );
    }

    next.updated_at = new Date().toISOString();
    devices[index] = next;
    writeAndroidRemoteDevices(devices);
    return next;
  }

  function deleteAndroidRemoteDeviceRecord(uid) {
    if (!uid) {
      throw new Error("UID tidak valid.");
    }
    const devices = readAndroidRemoteDevices();
    const next = devices.filter((device) => device.uid !== uid);
    if (next.length === devices.length) {
      throw new Error("Device tidak ditemukan.");
    }
    writeAndroidRemoteDevices(next);
    return true;
  }

  function ensureAndroidManagerReady() {
    if (!androidManager) {
      androidManager = new AndroidManager();
    }
    return androidManager;
  }

  function ensureAndroidSyncManagerReady() {
    if (!androidSyncManager) {
      androidSyncManager = new AndroidSyncManager(
        ensureAndroidManagerReady(),
        path.join(__dirname, "assets", "scrcpy-server.jar")
      );
    }
    return androidSyncManager;
  }

  function sendAndroidProgress(sender, channel, uid, payload = {}) {
    if (!sender || typeof sender.isDestroyed !== "function") return;
    if (sender.isDestroyed()) return;
    try {
      sender.send(channel, { uid, ...payload });
    } catch (err) {
      console.warn(`⚠️ Gagal mengirim event ${channel}:`, err.message);
    }
  }

  // Open iOS Simulator window
  ipcMain.on("open-ios-simulator", () => {
    console.log("📱 Opening iOS Simulator window...");

    const iosWindow = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: ctx.paths.corePreload,
      },
      title: withVersionSuffix("iOS Simulator Manager"),
      icon: getAssetPath("icon.png"),
    });

    iosWindow.loadFile(path.join(__dirname, "ios-simulator.html"));
  });

  // Fetch pending messages dari whatsappBaseUrl (dipakai IPC handler dan
  // siklus automation Android yang berjalan di main process)
  async function fetchAndroidPendingMessagesList(uid) {
    const device = await resolveAndroidDeviceRecord(uid);
    const requestUrl = resolveAutomationPendingEndpoint(device.whatsappBaseUrl);
    if (!requestUrl) {
      throw new Error("whatsappBaseUrl belum dikonfigurasi.");
    }

    const url = new URL(requestUrl);
    const postData = JSON.stringify({ uid });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const protocol = url.protocol === "https:" ? https : require("http");
      const req = protocol.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ data: [] });
          }
        });
      });

      req.setTimeout(15000, () => {
        req.destroy(new Error("Timeout fetch pending messages"));
      });
      req.on("error", (err) => reject(err));
      req.write(postData);
      req.end();
    });

    return Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
      ? response.data
      : [];
  }

  // Siklus fetch + kirim pesan pending untuk Android WhatsApp automation.
  // Device Android emulator TIDAK punya device window (QEMU jalan di
  // background), jadi fetch/kirim harus dikerjakan di main process — bukan
  // di-broadcast ke renderer seperti device web.
  const androidPendingCycleBusy = new Set();

  const ANDROID_AUTOMATION_MESSAGE_DELAY_MS = 30000; // ~2 pesan/menit

  async function runAndroidWhatsappPendingCycle(uid) {
    if (androidPendingCycleBusy.has(uid)) {
      console.log(
        `⏸️ Skip fetch pending Android ${uid} — siklus sebelumnya masih berjalan`
      );
      return;
    }
    if (hasMessagesInProgress()) {
      console.log(
        `⏸️ Skip fetch pending Android ${uid} — masih ada pesan sedang dikirim`
      );
      return;
    }

    androidPendingCycleBusy.add(uid);
    try {
      const config = getDeviceConfig(uid) || {};
      let record;
      try {
        record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
      } catch (err) {
        console.warn(
          `⚠️ Emulator ${uid} belum siap untuk automation:`,
          err?.message || err
        );
        sendAutomationMonitorPayload(uid, {
          queue: [],
          error: err?.message || "Emulator belum aktif.",
        }).catch(() => {});
        return;
      }

      const rawMessages = await fetchAndroidPendingMessagesList(uid);
      const queueState = rawMessages
        .map((item, index) => ({
          id: String(item?.id ?? item?.messageId ?? index),
          phone: String(item?.phone || "").replace(/[^\d]/g, ""),
          message: String(item?.message || ""),
          status: (item?.status || "pending").toLowerCase(),
          priority: normalizeAutomationPriority(item?.priority),
        }))
        .filter((item) => item.phone && item.message);

      const pushUpdate = (activeId = null, typing = false, extra = {}) => {
        sendAutomationMonitorPayload(uid, {
          queue: queueState,
          activeId: activeId != null ? String(activeId) : null,
          typing: Boolean(typing),
          lastFetch: new Date().toISOString(),
          ...extra,
        }).catch(() => {});
      };

      console.log(
        `📥 [Android:${uid}] Fetch pending: ${queueState.length} pesan siap dikirim`
      );
      pushUpdate(null, false);

      if (!queueState.length) return;

      const callbackUrl = resolveAutomationCallbackUrl(
        config.whatsappBaseUrl || "",
        config.whatsappCallbackUrl || ""
      );
      const whatsappVariant = sanitizeWhatsappVariant(
        config.whatsappVariant || "consumer"
      );

      for (let i = 0; i < queueState.length; i += 1) {
        const entry = queueState[i];
        if (entry.status !== "pending") continue;
        if (entry.id && isMessageInCache(entry.id)) {
          console.log(
            `⏭️ [Android:${uid}] Pesan ${entry.id} sudah ada di cache, skip`
          );
          continue;
        }

        entry.status = "sending";
        pushUpdate(entry.id, true);

        try {
          await sendSingleWhatsappMessage(record.adbId, entry.phone, entry.message, {
            typingSpeed: "instant",
            callbackUrl,
            messageId: entry.id,
            whatsappVariant,
          });
        } catch (err) {
          console.error(
            `❌ [Android:${uid}] Gagal mengirim pesan ${entry.id}:`,
            err?.message || err
          );
        }

        // Status final ada di message cache (diisi oleh alur pengiriman ADB)
        const cacheStatus = WHATSAPP_MESSAGE_CACHE.get(entry.id)?.status;
        entry.status = cacheStatus === "sent" ? "done" : "failed";
        pushUpdate(null, false);

        if (i < queueState.length - 1) {
          await sleep(ANDROID_AUTOMATION_MESSAGE_DELAY_MS);
        }
      }
    } catch (err) {
      console.error(
        `❌ [Android:${uid}] Siklus pending automation gagal:`,
        err?.message || err
      );
      sendAutomationMonitorPayload(uid, {
        queue: [],
        error: err?.message || "Gagal memuat pesan pending.",
      }).catch(() => {});
    } finally {
      androidPendingCycleBusy.delete(uid);
    }
  }

  ipcMain.handle("android-remote-load", () => {
    const devices = readAndroidRemoteDevices();
    return { devices };
  });

  ipcMain.handle("android-remote-add", (_event, payload = {}) => {
    try {
      const record = addAndroidRemoteDeviceRecord(payload);
      const payloadSample = {
        name: record.name,
        adbId: record.adbId,
        service: record.service,
        whatsappBaseUrl: record.whatsappBaseUrl,
        whatsappCallbackUrl: record.whatsappCallbackUrl,
        whatsappVariant: record.whatsappVariant,
        status: record.status,
      };
      queueMicrotask(() =>
        sendAdbRemoteReport({ action: "add", device: record }).catch(() => {})
      );
      return { success: true, device: record, payload: payloadSample };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menambahkan device Android.",
      };
    }
  });

  ipcMain.handle("android-remote-edit", (_event, payload = {}) => {
    try {
      const record = updateAndroidRemoteDeviceRecord(payload);
      queueMicrotask(() =>
        sendAdbRemoteReport({ action: "edit", device: record }).catch(() => {})
      );
      return { success: true, device: record };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal memperbarui device Android.",
      };
    }
  });

  ipcMain.handle("android-remote-delete", (_event, uid) => {
    try {
      const existing = findAndroidRemoteDevice(uid);
      deleteAndroidRemoteDeviceRecord(uid);
      queueMicrotask(() =>
        sendAdbRemoteReport({
          action: "delete",
          device: existing || { uid },
        }).catch(() => {})
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menghapus device Android.",
      };
    }
  });

  ipcMain.handle("android-remote-update", (_event, uid, updates) => {
    try {
      const record = updateAndroidRemoteDeviceRecord({ uid, ...updates });
      return { success: true, device: record };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal update device Android.",
      };
    }
  });

  ipcMain.handle(
    "android-remote-send-whatsapp-message",
    async (_event, uid, payload = {}) => {
      try {
        const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
        const phone = String(payload.phone || payload.phoneNumber || "")
          .replace(/[^\d]/g, "")
          .trim();
        const message = String(payload.message || "").trim();
        const messageId = payload.id || null;
        const callbackUrl = record.whatsappCallbackUrl || null;
        const whatsappVariant = record.whatsappVariant || "consumer";

        if (!phone) {
          throw new Error("Nomor tujuan tidak valid.");
        }
        if (!message) {
          throw new Error("Pesan tidak boleh kosong.");
        }
        await sendSingleWhatsappMessage(record.adbId, phone, message, {
          typingSpeed: "instant",
          callbackUrl: callbackUrl,
          messageId: messageId,
          whatsappVariant,
        });
        return {
          success: true,
          message: `Pesan terkirim ke ${phone}.`,
        };
      } catch (err) {
        console.error("❌ Failed to send WhatsApp message:", err);
        return {
          success: false,
          message: err?.message || "Gagal mengirim pesan WhatsApp.",
        };
      }
    }
  );

  // Fetch pending WhatsApp messages from baseUrl
  ipcMain.handle("android-whatsapp-fetch-messages", async (_event, uid) => {
    try {
      const messages = await fetchAndroidPendingMessagesList(uid);
      return { success: true, messages };
    } catch (err) {
      console.error("❌ Failed to fetch WhatsApp messages:", err);
      return {
        success: false,
        message: err?.message || "Failed to fetch messages",
      };
    }
  });

  // Post message status to callbackUrl
  ipcMain.handle(
    "android-whatsapp-post-status",
    async (_event, uid, messageId, status) => {
      try {
        const device = await resolveAndroidDeviceRecord(uid);

        const callbackUrl = resolveAutomationCallbackUrl(
          device.whatsappBaseUrl,
          device.whatsappCallbackUrl
        );
        if (!callbackUrl) {
          return { success: false, message: "callbackUrl not configured" };
        }

        const url = new URL(callbackUrl);
        const postData = JSON.stringify({ id: messageId, status });

        await new Promise((resolve, reject) => {
          const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: url.pathname + url.search,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
          };

          const protocol = url.protocol === "https:" ? https : require("http");
          const req = protocol.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
          });

          req.on("error", (err) => reject(err));
          req.write(postData);
          req.end();
        });

        return { success: true };
      } catch (err) {
        console.error("❌ Failed to post status:", err);
        return {
          success: false,
          message: err?.message || "Failed to post status",
        };
      }
    }
  );

  ipcMain.handle("android-remote-update-status", (_event, uid, status) => {
    try {
      const record = updateAndroidRemoteDeviceRecord({ uid, status });
      return { success: true, device: record };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal memperbarui status device.",
      };
    }
  });

  ipcMain.handle("android-list-physical-devices", async () => {
    try {
      const manager = ensureAndroidManagerReady();
      const devices = await manager.listConnectedDevices();
      return { success: true, devices };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal membaca daftar ADB.",
        devices: [],
      };
    }
  });

  ipcMain.handle("android-scan-local-wifi", async (event, options = {}) => {
    try {
      const scanMode = options.scanMode || "quick"; // 'quick' or 'deep'
      const result = await scanLocalWifiForAdbDevices(true, scanMode);
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal memindai jaringan lokal.",
      };
    }
  });

  ipcMain.handle("android-connect-manual-adb", async (event, options = {}) => {
    try {
      const { ip, port, oldAdbId } = options;
      if (!ip || !port) {
        return {
          success: false,
          message: "IP dan Port harus diisi!",
        };
      }

      const manager = ensureAndroidManagerReady();
      const deviceId = `${ip}:${port}`;

      // Disconnect old device first if provided
      if (oldAdbId && oldAdbId !== deviceId) {
        try {
          logDev(`🔌 Disconnecting old device ${oldAdbId}...`);
          await manager.runAdbCommand(["disconnect", oldAdbId], {
            timeout: 5000,
            silent: true,
          });
        } catch (err) {
          console.warn(`⚠️ Could not disconnect old device:`, err.message);
        }
      }

      // Try to connect
      logDev(`🔌 Connecting to ${deviceId}...`);
      const connectResult = await manager.runAdbCommand(["connect", deviceId], {
        timeout: 10000,
      });

      if (
        connectResult.includes("connected") ||
        connectResult.includes("already connected")
      ) {
        logDev(`✅ Successfully connected to ${deviceId}`);

        // Get device info
        const devices = await manager.listConnectedDevices();
        const device = devices.find((d) => d.adbId === deviceId);

        return {
          success: true,
          message: `Berhasil connect ke ${deviceId}`,
          deviceId: deviceId,
          deviceName: device?.description || device?.model || deviceId,
        };
      } else {
        logDev(`❌ Failed to connect to ${deviceId}: ${connectResult}`);
        return {
          success: false,
          message: `Gagal connect: ${connectResult}`,
        };
      }
    } catch (err) {
      console.error("❌ Error connecting manual ADB:", err);
      return {
        success: false,
        message: err?.message || "Gagal connect ke device!",
      };
    }
  });

  let adbStatusInterval = null;

  async function startAdbStatusMonitor() {
    if (adbStatusInterval) return;
    let manager = null;
    try {
      manager = ensureAndroidManagerReady();
    } catch (err) {
      console.warn(
        "⚠️ ADB manager belum siap, status monitor tidak bisa berjalan:",
        err?.message || err
      );
      return;
    }
    const checkStatus = async () => {
      try {
        const result = await manager.listConnectedDevices();
        const devices = Array.isArray(result)
          ? result
          : Array.isArray(result?.devices)
          ? result.devices
          : [];
        const entries = readAndroidRemoteDevices();
        const updates = [];
        entries.forEach((entry) => {
          const adb = devices.find(
            (dev) => dev.adbId && dev.adbId === entry.adbId
          );
          const nextStatus = adb
            ? adb.status === "device"
              ? "connected"
              : "disconnected"
            : "disconnected";
          if (entry.status !== nextStatus) {
            entry.status = nextStatus;
            entry.updated_at = new Date().toISOString();
            updates.push(entry);
          }
        });
        if (updates.length) {
          writeAndroidRemoteDevices(entries);
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send("android-remote-status-updated", updates);
            }
          });
        }
      } catch (err) {
        console.warn("⚠️ Gagal memeriksa status ADB:", err?.message || err);
      }
    };
    setTimeout(checkStatus, 5000);
    adbStatusInterval = setInterval(checkStatus, 10000);
  }

  ipcMain.handle(
    "android-remote-run-action",
    async (_event, uid, action = "default", payload = {}) => {
      try {
        const result = await performAndroidRemoteAction(uid, action, payload);
        return { success: true, ...result };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Gagal menjalankan aksi remote.",
        };
      }
    }
  );

  ipcMain.handle("android-remote-cancel-action", (_event, uid) => {
    const cancelled = cancelAndroidRemoteAction(uid);
    if (cancelled) {
      return { success: true, message: "Remote action dihentikan." };
    }
    return { success: false, message: "Tidak ada aksi remote yang berjalan." };
  });

  ipcMain.handle(
    "android-remote-send-shortcut",
    async (_event, uid, shortcutId) => {
      try {
        const message = await runAndroidShortcutCommand(uid, shortcutId);
        return { success: true, message };
      } catch (err) {
        return {
          success: false,
          message: err?.message || "Gagal menjalankan shortcut.",
        };
      }
    }
  );

  ipcMain.handle("android-remote-screenshot", async (event, uid) => {
    try {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const defaultName = `android-screenshot-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.png`;
      const dialogOpts = {
        title: "Simpan Screenshot Android",
        defaultPath: path.join(
          app.getPath("pictures") || app.getPath("home"),
          defaultName
        ),
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      };
      const { canceled, filePath } = await dialog.showSaveDialog(
        browserWindow,
        dialogOpts
      );
      if (canceled || !filePath) {
        return {
          success: false,
          cancelled: true,
          message: "Penyimpanan screenshot dibatalkan.",
        };
      }
      const result = await captureAndroidScreenshot(uid, filePath);
      return {
        success: true,
        path: result.path,
        message: "Screenshot berhasil disimpan.",
      };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal mengambil screenshot.",
      };
    }
  });

  ipcMain.handle("android-remote-open-display", async (_event, uid) => {
    try {
      const result = await openAndroidDeviceDisplay(uid);
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal membuka tampilan perangkat.",
        };
    }
  });

  ipcMain.handle("android-remote-close-display", async (_event, uid) => {
    try {
      const result = await closeAndroidDeviceDisplay(uid);
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menutup tampilan perangkat.",
      };
    }
  });

  ipcMain.handle("scrcpy-check", () => {
    try {
      return {
        success: true,
        installed: isScrcpyInstalled(),
        platform: process.platform,
      };
    } catch (err) {
      return {
        success: false,
        installed: false,
        message: err?.message || "Gagal memeriksa ketersediaan scrcpy.",
      };
    }
  });

  ipcMain.handle("scrcpy-install", async (event) => {
    try {
      const sendProgress = (payload) => {
        try {
          event?.sender?.send("scrcpy-install-progress", payload);
        } catch (_) {
          // ignore
        }
      };
      if (isScrcpyInstalled()) {
        return {
          success: true,
          installed: true,
          alreadyInstalled: true,
          message: "scrcpy sudah terpasang.",
        };
      }
      await installScrcpyAutomatically(sendProgress);
      const installed = isScrcpyInstalled();
      if (installed) {
        sendProgress({ percent: 100, message: "scrcpy berhasil dipasang." });
        return {
          success: true,
          installed: true,
          message: "scrcpy berhasil dipasang.",
        };
      }
      return {
        success: false,
        installed: false,
        message:
          "Instalasi selesai, tetapi scrcpy belum terdeteksi. Silakan cek log terminal.",
      };
    } catch (err) {
      return {
        success: false,
        installed: false,
        message:
          err?.message ||
          "Gagal menjalankan instalasi otomatis scrcpy. Coba pasang manual.",
      };
    }
  });

  // Guard: device dengan mode WhatsApp automation bersifat read-only —
  // navigasi (Back/Home/Recent/Rotate) diblokir agar user tidak bisa
  // berpindah aplikasi dan mengganggu pengiriman pesan pending.
  async function assertAndroidRemoteNavAllowed(uid) {
    const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
    if (
      sanitizeRemoteServiceId(record.service) === "android-whatsapp" &&
      record.displayMode !== "native"
    ) {
      throw new Error(
        "Mode read-only: navigasi dinonaktifkan selama WhatsApp automation berjalan."
      );
    }
    return record;
  }

  ipcMain.handle("android-remote-wake", async (_event, uid) => {
    try {
      const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
      await ensureDeviceScreenAwake(record.adbId);
      return { success: true, message: "Layar dibangunkan." };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal membangunkan layar.",
      };
    }
  });

  ipcMain.handle("android-remote-unlock", async (_event, uid) => {
    try {
      const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
      const adbId = record.adbId;
      await ensureDeviceScreenAwake(adbId);
      await sendAndroidKeyevent(adbId, 82); // MENU key to unlock
      return { success: true, message: "Device dibuka." };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal membuka device." };
    }
  });

  ipcMain.handle("android-remote-press-back", async (_event, uid) => {
    try {
      const record = await assertAndroidRemoteNavAllowed(uid);
      await sendAndroidKeyevent(record.adbId, 4); // BACK
      return { success: true, message: "Tombol Back ditekan." };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal menekan Back." };
    }
  });

  ipcMain.handle("android-remote-press-home", async (_event, uid) => {
    try {
      const record = await assertAndroidRemoteNavAllowed(uid);
      await sendAndroidKeyevent(record.adbId, 3); // HOME
      return { success: true, message: "Tombol Home ditekan." };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal menekan Home." };
    }
  });

  ipcMain.handle("android-remote-press-recent", async (_event, uid) => {
    try {
      const record = await assertAndroidRemoteNavAllowed(uid);
      await sendAndroidKeyevent(record.adbId, 187); // RECENT APPS
      return { success: true, message: "Recent Apps ditampilkan." };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menampilkan Recent Apps.",
      };
    }
  });

  ipcMain.handle("android-remote-rotate", async (_event, uid) => {
    try {
      const record = await assertAndroidRemoteNavAllowed(uid);
      const manager = ensureAndroidManagerReady();
      // Toggle auto-rotate and then rotate
      await manager.runAdbCommand(
        [
          "-s",
          record.adbId,
          "shell",
          "content",
          "insert",
          "--uri",
          "content://settings/system",
          "--bind",
          "name:s:accelerometer_rotation",
          "--bind",
          "value:i:1",
        ],
        { timeout: 5000, silent: true }
      );
      await sendAndroidKeyevent(record.adbId, 111); // ESCAPE key (rotate)
      return { success: true, message: "Layar dirotasi." };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal merotasi layar." };
    }
  });

  ipcMain.handle("android-remote-start-recording", async (_event, uid) => {
    try {
      const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
      const adbId = record.adbId;

      // Check if already recording
      if (scrcpyRecordings.has(adbId)) {
        throw new Error("Perekaman sudah berjalan.");
      }

      const timestamp = Date.now();
      const filename = `starbox_recording_${timestamp}.mp4`;
      const remotePath = `/sdcard/Download/${filename}`;

      const manager = ensureAndroidManagerReady();
      // Start screen recording
      const recordProc = spawn(
        manager.getADBBinary(),
        ["-s", adbId, "shell", "screenrecord", remotePath],
        { stdio: "ignore" }
      );

      scrcpyRecordings.set(adbId, { proc: recordProc, remotePath, filename });

      return { success: true, message: "Perekaman dimulai." };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal memulai perekaman.",
      };
    }
  });

  ipcMain.handle("android-remote-stop-recording", async (event, uid) => {
    try {
      const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
      const adbId = record.adbId;

      const recording = scrcpyRecordings.get(adbId);
      if (!recording) {
        throw new Error("Tidak ada perekaman yang berjalan.");
      }

      // Stop recording by killing the process
      if (recording.proc && !recording.proc.killed) {
        recording.proc.kill("SIGINT");
      }

      // Wait a bit for file to be written
      await sleep(1000);

      // Pull the file
      const manager = ensureAndroidManagerReady();
      const safeAdbId = String(adbId)
        .replace(/[^a-z0-9_-]+/gi, "-")
        .toLowerCase();
      const tempDir = path.join(os.tmpdir(), "starbox-recordings");
      fs.mkdirSync(tempDir, { recursive: true });
      const localPath = path.join(tempDir, `${safeAdbId}-${recording.filename}`);

      await manager.runAdbCommand(
        ["-s", adbId, "pull", recording.remotePath, localPath],
        { timeout: 30000, silent: true }
      );

      // Delete remote file
      await manager
        .runAdbCommand(["-s", adbId, "shell", "rm", recording.remotePath], {
          timeout: 8000,
          silent: true,
        })
        .catch(() => {});

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const defaultName = `android-recording-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.mp4`;
      const defaultDir =
        app.getPath("videos") ||
        app.getPath("movies") ||
        app.getPath("documents") ||
        app.getPath("downloads");
      const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
        title: "Simpan Rekaman Android",
        defaultPath: path.join(defaultDir, defaultName),
        filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
      });

      let finalPath = localPath;
      let manualSave = false;
      if (!canceled && filePath) {
        fs.copyFileSync(localPath, filePath);
        finalPath = filePath;
        manualSave = true;
      }

      scrcpyRecordings.delete(adbId);

      const message = manualSave
        ? "Perekaman disimpan."
        : `Perekaman tersimpan sementara di ${localPath}`;

      return {
        success: true,
        message,
        path: finalPath,
        manualSave,
        tempPath: localPath,
        cancelled: canceled,
      };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menghentikan perekaman.",
      };
    }
  });

  ipcMain.handle("android-remote-volume-up", async (_event, uid) => {
    try {
      const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
      await sendAndroidKeyevent(record.adbId, 24); // VOLUME_UP
      return { success: true, message: "Volume dinaikkan." };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menaikkan volume.",
      };
    }
  });

  ipcMain.handle("android-remote-volume-down", async (_event, uid) => {
    try {
      const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
      await sendAndroidKeyevent(record.adbId, 25); // VOLUME_DOWN
      return { success: true, message: "Volume diturunkan." };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Gagal menurunkan volume.",
      };
    }
  });

  ipcMain.handle("android-sync-open-window", () => {
    createAndroidSyncWindow();
    return { success: true };
  });

  // StarBox-registered Android devices (devices.json, service === "android")
  // that aren't part of the live `adb devices` list yet — i.e. not booted
  // this session. Exposed so the StarSync picker can offer them too and boot
  // on demand, instead of only showing whatever ADB already happens to see.
  function readRegisteredAndroidDevices() {
    try {
      if (!fs.existsSync(DB_PATH)) return [];
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      return (data.devices || []).filter(
        (d) => (d.service || "").toLowerCase() === "android"
      );
    } catch (_) {
      return [];
    }
  }

  ipcMain.handle("android-sync-list-devices", async () => {
    try {
      const manager = ensureAndroidManagerReady();
      const liveDevices = await manager.listConnectedDevices();

      const registered = readRegisteredAndroidDevices();

      // Resolve avdName -> adbId for every live emulator two ways: fast
      // in-memory tracking (only knows about emulators THIS app session
      // itself started) and a live query against the emulator console (catches
      // one that was already running before StarBox launched, or started in a
      // previous session). Without the second path, an emulator that's
      // genuinely running but wasn't booted by this process would wrongly show
      // as "belum jalan" — picking it would then try to boot a second instance
      // of the same AVD on top of the one already running, which fails.
      const avdNameToAdbId = new Map();
      registered.forEach((d) => {
        const entry = manager.getEmulatorProcessEntry(d.avdName);
        if (entry?.adbId) avdNameToAdbId.set(d.avdName, entry.adbId);
      });
      const trackedAdbIds = new Set(avdNameToAdbId.values());
      await Promise.all(
        liveDevices
          .filter((d) => d.adbId?.startsWith("emulator-") && !trackedAdbIds.has(d.adbId))
          .map(async (d) => {
            const avdName = await manager.getAvdNameForAdbId(d.adbId).catch(() => null);
            if (avdName && !avdNameToAdbId.has(avdName)) {
              avdNameToAdbId.set(avdName, d.adbId);
            }
          })
      );

      // A live device that's actually a StarBox-managed emulator gets matched
      // back to its registered record — needed both for uid (so StarSync can
      // offer "disconnect + stop the emulator") and so its label stays the
      // StarBox name + Android version the user set for it, instead of
      // falling back to ADB's generic model string ("sdk_gphone64_arm64")
      // only while running — that made the same device show a different name
      // in the picker depending on whether it happened to be running yet.
      const adbIdToRegistered = new Map();
      registered.forEach((d) => {
        const adbId = avdNameToAdbId.get(d.avdName);
        if (adbId) adbIdToRegistered.set(adbId, d);
      });

      const describeRegistered = (d) => ({
        name: d.name || d.avdName || d.uid || d.token,
        androidVersionLabel: manager.getVersionMeta(d.androidVersion)?.label || null,
        // Only StarBox-managed emulators can be flagged this way — we know
        // their exact API level. A physical/unregistered ADB device is real
        // hardware, not the buggy emulator image, so it's never blocked here.
        videoUnsupported: !manager.isSyncVideoSupported(d.androidVersion),
        videoUnsupportedReason: !manager.isSyncVideoSupported(d.androidVersion)
          ? "Android 9 (API 28) punya bug GPU di image emulator-nya sendiri — video mirror StarSync selalu gagal (Capture/encoding error). Device tetap bisa dipakai normal di luar StarSync."
          : null,
      });

      const notRunning = registered
        .filter((d) => !avdNameToAdbId.has(d.avdName))
        .map((d) => ({
          uid: d.uid || d.token,
          avdName: d.avdName,
          running: false,
          ...describeRegistered(d),
        }));

      const devices = [
        ...liveDevices.map((d) => {
          const reg = adbIdToRegistered.get(d.adbId);
          return {
            ...d,
            running: true,
            uid: reg ? reg.uid || reg.token : null,
            ...(reg ? describeRegistered(reg) : { name: d.description || d.adbId, androidVersionLabel: null }),
          };
        }),
        ...notRunning,
      ];
      return { success: true, devices };
    } catch (err) {
      return { success: false, devices: [], error: err.message };
    }
  });

  function syncSend(channel, payload) {
    if (androidSyncWindow && !androidSyncWindow.isDestroyed()) {
      try {
        androidSyncWindow.webContents.send(channel, payload);
      } catch (_) {}
    }
  }

  ipcMain.handle("android-sync-connect", async (_event, adbId, options = {}) => {
    try {
      const manager = ensureAndroidManagerReady();
      // Backstop against the Android 9 (API 28) GPU/color-buffer bug — the
      // device picker already hides/disables it, but re-check here in case
      // the picker's state is stale (e.g. a second window, or a stale
      // pendingSelection entry).
      const avdName = await manager.getAvdNameForAdbId(adbId).catch(() => null);
      if (avdName) {
        const reg = readRegisteredAndroidDevices().find((d) => d.avdName === avdName);
        if (reg && !manager.isSyncVideoSupported(reg.androidVersion)) {
          return {
            success: false,
            adbId,
            error:
              "Android 9 (API 28) tidak didukung StarSync — bug GPU di image emulator-nya sendiri (Capture/encoding error). Device tetap bisa dipakai normal di luar StarSync.",
          };
        }
      }
      const sync = ensureAndroidSyncManagerReady();
      const session = await sync.connect(adbId, {
        video: options?.video !== false,
        onStatus: (status, detail) => syncSend("android-sync-status", { adbId, status, detail }),
        onConfig: (cfg) => syncSend("android-sync-config", { adbId, ...cfg }),
        onFrame: (buf, meta) =>
          syncSend("android-sync-frame", {
            adbId,
            chunk: Uint8Array.from(buf),
            config: meta.config,
            keyFrame: meta.keyFrame,
          }),
        onLog: (level, text) => syncSend("android-sync-log", { adbId, level, text }),
      });
      return { success: true, adbId, width: session.width, height: session.height };
    } catch (err) {
      return { success: false, adbId, error: err.message };
    }
  });

  ipcMain.handle("android-sync-disconnect", async (_event, adbId) => {
    try {
      const sync = ensureAndroidSyncManagerReady();
      await sync.disconnect(adbId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sync-disconnect-all", async () => {
    try {
      const sync = ensureAndroidSyncManagerReady();
      await sync.disconnectAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sync-touch", (_event, adbId, evt = {}) => {
    const sync = ensureAndroidSyncManagerReady();
    const session = sync.getSession(adbId);
    if (!session) return { success: false, error: "Session tidak aktif" };
    const actionMap = { down: MOTION_ACTION_DOWN, up: MOTION_ACTION_UP, move: MOTION_ACTION_MOVE };
    const action = actionMap[evt.action];
    if (action === undefined) return { success: false, error: `Aksi tidak dikenal: ${evt.action}` };
    session.sendTouch({
      action,
      x: evt.x,
      y: evt.y,
      screenWidth: evt.screenWidth,
      screenHeight: evt.screenHeight,
      pointerId: evt.pointerId || 1,
    });
    return { success: true };
  });

  ipcMain.handle("android-sync-text", (_event, adbId, text) => {
    const sync = ensureAndroidSyncManagerReady();
    const session = sync.getSession(adbId);
    if (!session) return { success: false, error: "Session tidak aktif" };
    session.sendText(text);
    return { success: true };
  });

  // Nav (Home/Back/Recent) prefers the live control-socket session (instant,
  // no per-press process spawn); falls back to the plain-ADB path already
  // proven in the single-device remote (electron-main.js sendAndroidKeyevent)
  // for a device whose sync session isn't connected yet.
  ipcMain.handle("android-sync-nav", async (_event, adbId, keycode) => {
    try {
      const sync = ensureAndroidSyncManagerReady();
      const session = sync.getSession(adbId);
      if (session) {
        session.pressKeycode(keycode);
      } else {
        await sendAndroidKeyevent(adbId, keycode);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sync-rotate", (_event, adbId) => {
    const sync = ensureAndroidSyncManagerReady();
    const session = sync.getSession(adbId);
    if (!session) return { success: false, error: "Session tidak aktif" };
    session.sendRotate();
    return { success: true };
  });

  // Plain `adb reboot` — works for a StarBox emulator or a physical device
  // either way, independent of whether a scrcpy session is connected. The
  // video/control sockets naturally drop and the tile reflects that via the
  // existing socket-close error handling; the renderer follows this up with
  // android-sync-wait-boot then reconnects automatically once it resolves.
  ipcMain.handle("android-sync-reboot", async (_event, adbId) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.rebootDevice(adbId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sync-wait-boot", async (_event, adbId, timeoutMs) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.waitForDeviceReady(adbId, {
        timeoutMs: Number(timeoutMs) || undefined,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-send-sms", async (_event, adbId, from, text) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.simulateIncomingSms(adbId, from, text);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-call", async (_event, adbId, number) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.simulateIncomingCall(adbId, number);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-accept-call", async (_event, adbId, number) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.acceptIncomingCall(adbId, number);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-cancel-call", async (_event, adbId, number) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.cancelCall(adbId, number);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-set-network", async (_event, adbId, { voice, data, signal } = {}) => {
    try {
      const manager = ensureAndroidManagerReady();
      if (voice) await manager.setGsmVoiceState(adbId, voice);
      if (data) await manager.setGsmDataState(adbId, data);
      if (signal) await manager.setSignalProfile(adbId, signal);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-set-gps", async (_event, adbId, lat, lon, altitude) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.setGpsLocation(adbId, lat, lon, altitude);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-start-gps-route", async (_event, adbId, waypoints, options = {}) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.startGpsRoute(adbId, waypoints, {
        speedKmh: options.speedKmh,
        onWaypoint: (update) => syncSend("android-sim-gps-update", { adbId, ...update }),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-stop-gps-route", async (_event, adbId) => {
    try {
      const manager = ensureAndroidManagerReady();
      const result = await manager.stopGpsRoute(adbId);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sim-set-phone-number", async (_event, adbId, number) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.setPhoneNumber(adbId, number);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-camera-list-webcams", () => {
    try {
      const manager = ensureAndroidManagerReady();
      return { success: true, webcams: manager.listWebcams() };
    } catch (err) {
      return { success: false, webcams: [], error: err.message };
    }
  });

  ipcMain.handle("android-camera-pick-image", async (_event) => {
    const win = androidSyncWindow || BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: "Pilih gambar untuk kamera virtual",
      properties: ["openFile"],
      filters: [{ name: "Gambar", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled || !result.filePaths?.length) {
      return { success: false, canceled: true };
    }
    return { success: true, path: result.filePaths[0] };
  });

  ipcMain.handle("android-camera-set-scene-image", async (_event, adbId, target, imagePath) => {
    try {
      const manager = ensureAndroidManagerReady();
      await manager.setVirtualSceneImage(adbId, target, imagePath || null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-device-profile-list-presets", () => {
    try {
      const manager = ensureAndroidManagerReady();
      return { success: true, presets: manager.getDeviceProfilePresets() };
    } catch (err) {
      return { success: false, presets: [], error: err.message };
    }
  });

  ipcMain.handle("android-device-profile-apply", async (_event, adbId, profile) => {
    try {
      const manager = ensureAndroidManagerReady();
      const result = await manager.applyDeviceProfile(adbId, profile, {
        onProgress: (message) => syncSend("android-device-profile-progress", { adbId, message }),
      });
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-device-profile-install-playstore", async (_event, adbId) => {
    try {
      const manager = ensureAndroidManagerReady();
      const result = await manager.installPlayStore(adbId, {
        onProgress: (message) => syncSend("android-device-profile-progress", { adbId, message }),
      });
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-sync-launch-app", async (_event, adbId, packageName) => {
    const pkg = String(packageName || "").trim();
    if (!/^[a-zA-Z0-9_.]+$/.test(pkg)) {
      return { success: false, error: "Nama package tidak valid" };
    }
    try {
      const sync = ensureAndroidSyncManagerReady();
      const session = sync.getSession(adbId);
      if (session) {
        session.sendStartApp(pkg);
      } else {
        const manager = ensureAndroidManagerReady();
        await manager.runAdbCommand(
          ["-s", adbId, "shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"],
          { timeout: 10000 }
        );
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("android-get-versions", () => {
    try {
      const manager = ensureAndroidManagerReady();
      return { success: true, versions: manager.getSupportedVersions() };
    } catch (err) {
      return { success: false, versions: [], error: err.message };
    }
  });

  ipcMain.handle("android-check-installation", (_event, uid = null) => {
    try {
      const manager = ensureAndroidManagerReady();
      // Cek instalasi untuk versi yang dipilih device (bila uid diberikan),
      // agar versi yang belum terunduh terdeteksi "belum terpasang".
      const config = uid ? getDeviceConfig(uid) || {} : {};
      const apiLevel = manager.normalizeApiLevel(config.androidVersion);
      const imageVariant = config.androidImageVariant || "playstore";
      const coreInstalled = manager.isCoreInstalled();
      const installed = manager.isInstalled(apiLevel, imageVariant);
      const downloadSize = manager.getEstimatedDownloadSize();
      return { success: true, installed, coreInstalled, apiLevel, downloadSize };
    } catch (err) {
      console.error("❌ android-check-installation gagal:", err);
      return { success: false, installed: false, error: err.message };
    }
  });

  ipcMain.handle("android-download", async (event, uid, options = {}) => {
    const manager = ensureAndroidManagerReady();
    const sender = event.sender;
    const config = uid ? getDeviceConfig(uid) || {} : {};
    const apiLevel = manager.normalizeApiLevel(
      options?.apiLevel ?? config.androidVersion
    );
    const imageVariant = options?.imageVariant || config.androidImageVariant || "playstore";
    const relayProgress = (payload = {}) =>
      sendAndroidProgress(sender, "android-download-progress", uid, payload);
    try {
      await manager.downloadAndSetup(relayProgress, apiLevel, imageVariant);
      return { success: true, apiLevel };
    } catch (err) {
      relayProgress({
        phase: "error",
        message: err?.message || "Download gagal",
      });
      console.error("❌ android-download gagal:", err);
      throw err;
    }
  });

  ipcMain.handle("android-fix-issues", async (event, uid) => {
    const manager = ensureAndroidManagerReady();
    const sender = event.sender;
    const relayProgress = (payload = {}) =>
      sendAndroidProgress(sender, "android-fix-progress", uid, payload);
    try {
      await manager.fixEmulatorIssues(relayProgress);
      return { success: true };
    } catch (err) {
      relayProgress({
        phase: "error",
        message: err?.message || "Gagal memperbaiki emulator",
      });
      console.error("❌ android-fix-issues gagal:", err);
      return { success: false, message: err?.message || "Gagal memperbaiki emulator" };
    }
  });

  ipcMain.handle("android-accel-status", async () => {
    try {
      const manager = ensureAndroidManagerReady();
      const status = await manager.getAccelerationStatus();
      return { success: true, ...status };
    } catch (err) {
      console.error("❌ android-accel-status gagal:", err);
      return { success: false, message: err?.message || "Gagal memeriksa akselerasi." };
    }
  });

  ipcMain.handle("android-enable-acceleration", async () => {
    try {
      const manager = ensureAndroidManagerReady();
      return await manager.enableWindowsAcceleration();
    } catch (err) {
      console.error("❌ android-enable-acceleration gagal:", err);
      return { success: false, message: err?.message || "Gagal mengaktifkan akselerasi." };
    }
  });

  // Buka aplikasi WhatsApp (consumer/business) di device via launcher intent
  async function launchWhatsappApp(adbId, variant = "consumer") {
    if (!adbId) return;
    const manager = ensureAndroidManagerReady();
    const pkg = resolveWhatsappPackageName(variant);
    await manager.runAdbCommand(
      [
        "-s",
        adbId,
        "shell",
        "monkey",
        "-p",
        pkg,
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
      ],
      { timeout: 15000, silent: true }
    );
  }

  // Loop automation WhatsApp Android di main process — TIDAK bergantung pada
  // window monitor/remote yang terbuka, supaya pengiriman pesan pending tetap
  // berjalan selama emulator hidup.
  const androidAutomationLoops = new Map();

  const ANDROID_AUTOMATION_LOOP_INTERVAL_MS = 60000;

  const ANDROID_AUTOMATION_FIRST_RUN_DELAY_MS = 15000;

  function startAndroidWhatsappAutomationLoop(uid) {
    if (!uid || androidAutomationLoops.has(uid)) return;
    const config = getDeviceConfig(uid) || {};
    const isAndroidWhatsappAutomation =
      sanitizeRemoteServiceId(config.androidAutomationService || "") ===
        "android-whatsapp" &&
      !!sanitizePendingUrl(config.whatsappBaseUrl || "");
    if (!isAndroidWhatsappAutomation) return;

    console.log(
      `🔁 [Android:${uid}] Automation loop dimulai (interval ${
        ANDROID_AUTOMATION_LOOP_INTERVAL_MS / 1000
      }s)`
    );
    const runCycle = () => {
      runAndroidWhatsappPendingCycle(uid).catch((err) => {
        console.error(
          `❌ [Android:${uid}] Siklus automation loop gagal:`,
          err?.message || err
        );
      });
    };
    const firstRun = setTimeout(async () => {
      // Buka WhatsApp otomatis (biasa/Business sesuai pengaturan device)
      // supaya emulator langsung siap menerima automation
      try {
        const record = await resolveAndroidDeviceRecord(uid, { requireAdb: true });
        await ensureDeviceScreenAwake(record.adbId);
        await launchWhatsappApp(record.adbId, record.whatsappVariant);
        console.log(
          `📱 [Android:${uid}] WhatsApp (${record.whatsappVariant}) dibuka otomatis.`
        );
      } catch (err) {
        console.warn(
          `⚠️ [Android:${uid}] Gagal membuka WhatsApp otomatis:`,
          err?.message || err
        );
      }
      runCycle();
    }, ANDROID_AUTOMATION_FIRST_RUN_DELAY_MS);
    const timer = setInterval(runCycle, ANDROID_AUTOMATION_LOOP_INTERVAL_MS);
    androidAutomationLoops.set(uid, { timer, firstRun });
  }

  function stopAndroidWhatsappAutomationLoop(uid) {
    const loop = androidAutomationLoops.get(uid);
    if (!loop) return;
    clearTimeout(loop.firstRun);
    clearInterval(loop.timer);
    androidAutomationLoops.delete(uid);
    console.log(`⏹️ [Android:${uid}] Automation loop dihentikan.`);
  }

  function persistAndroidDeviceField(uid, field, value) {
    if (!fs.existsSync(DB_PATH)) return;
    try {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      const data = JSON.parse(raw);
      const index = Array.isArray(data.devices)
        ? data.devices.findIndex((d) => d.uid === uid || d.token === uid)
        : -1;
      if (index !== -1) {
        data.devices[index][field] = value;
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.warn(
        `⚠️ Gagal menyimpan ${field} untuk device ${uid}:`,
        err?.message || err
      );
    }
  }

  async function startAndroidEmulatorDevice(
    uid,
    options = {},
    progressCallback = () => {}
  ) {
    const manager = ensureAndroidManagerReady();
    const safeProgressCallback =
      typeof progressCallback === "function" ? progressCallback : () => {};
    const config = getDeviceConfig(uid) || {};
    if (config && (config.service || "").toLowerCase() === "android") {
      const avdIdentityChanged = syncAndroidAvdIdentity(config);
      if (avdIdentityChanged && fs.existsSync(DB_PATH)) {
        try {
          const raw = fs.readFileSync(DB_PATH, "utf8");
          const data = JSON.parse(raw);
          const index = Array.isArray(data.devices)
            ? data.devices.findIndex((d) => d.uid === uid || d.token === uid)
            : -1;
          if (index !== -1) {
            data.devices[index].avdName = config.avdName;
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
          }
        } catch (err) {
          console.warn(
            "⚠️ Gagal menyimpan perubahan nama AVD:",
            err?.message || err
          );
        }
      }
    }
    const avdName =
      (config.avdName && config.avdName.trim()) ||
      generateAvdName(uid, config.name || "");
    const spec = normalizeAndroidSpecInput(config.androidSpec);
    const apiLevel = manager.normalizeApiLevel(config.androidVersion);
    // Mode WhatsApp automation dengan tampilan "readonly": boot headless
    // (tanpa window QEMU) supaya user tidak bisa mengontrol emulator langsung —
    // tampilan hanya lewat mirror scrcpy yang read-only. Mode "native": window
    // QEMU asli tampil penuh (mandiri, tanpa scrcpy).
    const isWhatsappAutomationDevice =
      sanitizeRemoteServiceId(config.androidAutomationService || "") ===
      "android-whatsapp";
    const isNativeDisplay =
      sanitizeAndroidDisplayMode(config.androidDisplayMode) === "native";
    // Headless boot only makes sense if scrcpy is actually there to mirror
    // it afterwards — otherwise the device would boot with literally no way
    // to see or control it (auto-install of scrcpy can fail: no
    // Homebrew/Chocolatey/winget, network issues, permissions, etc.). Fall
    // back to a normal visible window instead of getting the device stuck.
    const scrcpyMissing =
      isWhatsappAutomationDevice && !isNativeDisplay && !resolveScrcpyBinary();
    const useHeadlessBoot =
      isWhatsappAutomationDevice && !isNativeDisplay && !scrcpyMissing;
    if (isWhatsappAutomationDevice) {
      console.log(
        useHeadlessBoot
          ? `🔒 [Android:${uid}] Boot headless (WhatsApp automation, tampilan via remote read-only).`
          : scrcpyMissing
            ? `🖥️ [Android:${uid}] scrcpy tidak ditemukan — boot native (window QEMU langsung) sebagai gantinya.`
            : `🖥️ [Android:${uid}] Boot native penuh (WhatsApp automation, window QEMU tampil langsung).`
      );
    }
    if (scrcpyMissing) {
      safeProgressCallback({
        phase: "display-fallback",
        message:
          "scrcpy tidak ditemukan — device dijalankan dengan window emulator langsung (tanpa mode scrcpy).",
      });
    }
    try {
      const imageVariant =
        options?.imageVariant || config.androidImageVariant || "playstore";
      const result = await manager.startEmulator(avdName, {
        ...(options || {}),
        apiLevel,
        imageVariant,
        headless: useHeadlessBoot || options?.headless === true,
        progressCallback: (payload = {}) => {
          // Do NOT react to a single failed attempt here (was keyed on a
          // "exit" phase that android-manager.js no longer emits — the retry
          // loop's per-attempt renderer/lock failures now report as
          // "attempt-exit"). A retry may still succeed, so eagerly marking the
          // device "stopped" and killing its WhatsApp automation loop here
          // would be wrong mid-retry. The final outcome (success or exhausted
          // retries) is already handled below via the resolved result / catch.
          safeProgressCallback(payload);
        },
        spec,
      });
      if (result?.success) {
        updateDeviceStatus(uid, "running");
        startAndroidWhatsappAutomationLoop(uid);

        // Every Android device is now rootable by default, so Play Store isn't
        // baked into the system image — install it once, automatically, on
        // whichever boot is actually its first (no more "Varian Sistem" user
        // choice, see add-device handler). Failure here must not fail the
        // device start: the emulator itself is already up and usable.
        if (
          manager.isRootableVariant(imageVariant) &&
          !config.androidPlayStoreInstalled &&
          result.adbId
        ) {
          try {
            safeProgressCallback({
              phase: "install-playstore",
              message: "Memasang Google Play Store (pertama kali, ~2.4 GB)...",
            });
            const installResult = await manager.installPlayStore(result.adbId, {
              onProgress: (message) =>
                safeProgressCallback({ phase: "install-playstore", message }),
            });
            if (installResult?.success) {
              persistAndroidDeviceField(uid, "androidPlayStoreInstalled", true);
              safeProgressCallback({
                phase: "install-playstore",
                message: "Google Play Store berhasil dipasang.",
              });
            }
          } catch (err) {
            console.warn(
              `⚠️ [Android:${uid}] Gagal memasang Play Store otomatis:`,
              err?.message || err
            );
            safeProgressCallback({
              phase: "install-playstore",
              message:
                "Gagal memasang Play Store otomatis: " +
                (err?.message || "unknown error"),
            });
          }
        }
      }
      return result;
    } catch (err) {
      if (err?.message === "Emulator is already running") {
        const adbId = await resolveEmulatorAdbTarget(config).catch(() => null);
        updateDeviceStatus(uid, "running");
        startAndroidWhatsappAutomationLoop(uid);
        safeProgressCallback({
          phase: "boot-complete",
          message: "Emulator sudah berjalan.",
        });
        return {
          success: true,
          alreadyRunning: true,
          port: adbId ? String(adbId).split("-")[1] || null : null,
          adbId: adbId || null,
        };
      }
      updateDeviceStatus(uid, "stopped");
      safeProgressCallback({
        phase: "error",
        message: err?.message || "Gagal memulai emulator",
      });
      throw err;
    }
  }

  async function getAndroidEmulatorRuntimeStatus(uid) {
    const manager = ensureAndroidManagerReady();
    const config = getDeviceConfig(uid) || {};
    const storedStatus = String(config.status || "").toLowerCase();
    const avdName =
      (config.avdName && config.avdName.trim()) ||
      generateAvdName(uid, config.name || "");
    const processEntry = manager.getEmulatorProcessEntry(avdName);
    const processRunning = !!processEntry;
    const adbId = await resolveEmulatorAdbTarget(config).catch(() => null);
    const running =
      processRunning || !!adbId || ["running", "active", "starting"].includes(storedStatus);

    if (uid) {
      updateDeviceStatus(uid, running ? "running" : "stopped");
    }

    return {
      success: true,
      installed: manager.isInstalled(),
      running,
      port: adbId
        ? String(adbId).split("-")[1] || null
        : processRunning
        ? String(processEntry?.port || "") || null
        : null,
      adbId: adbId || processEntry?.adbId || null,
    };
  }

  ipcMain.handle("android-start", async (event, uid, options = {}) => {
    const sender = event.sender;
    try {
      return await startAndroidEmulatorDevice(uid, options, (payload = {}) => {
        sendAndroidProgress(sender, "android-start-progress", uid, payload);
      });
    } catch (err) {
      console.error("❌ android-start gagal:", err);
      throw err;
    }
  });

  ipcMain.handle("android-get-status", async (_event, uid) => {
    try {
      return await getAndroidEmulatorRuntimeStatus(uid);
    } catch (err) {
      return {
        success: false,
        installed: false,
        running: false,
        message: err?.message || "Gagal membaca status emulator.",
      };
    }
  });

  // Baca versi Android (release/API/model) dari emulator yang sedang berjalan.
  ipcMain.handle("android-get-device-info", async (_event, uid) => {
    try {
      const manager = ensureAndroidManagerReady();
      const config = getDeviceConfig(uid) || {};
      const adbId = await resolveEmulatorAdbTarget(config).catch(() => null);
      if (!adbId) {
        return { success: false, running: false };
      }
      const info = await manager.getEmulatorVersionInfo(adbId);
      return { success: true, running: true, adbId, ...(info || {}) };
    } catch (err) {
      return {
        success: false,
        running: false,
        message: err?.message || "Gagal membaca info versi emulator.",
      };
    }
  });

  ipcMain.handle("android-stop", async (_event, uid) => {
    try {
      const manager = ensureAndroidManagerReady();
      const config = getDeviceConfig(uid) || {};
      const avdName =
        (config.avdName && config.avdName.trim()) ||
        generateAvdName(uid, config.name || "");
      const adbId = await resolveEmulatorAdbTarget(config).catch(() => null);
      const result = await manager.stopEmulator(avdName, adbId);
      if (uid) {
        updateDeviceStatus(uid, "stopped");
        stopAndroidWhatsappAutomationLoop(uid);
      }
      return result;
    } catch (err) {
      console.error("❌ android-stop gagal:", err);
      throw err;
    }
  });

  ipcMain.handle("ios-check-availability", () => {
    try {
      if (!iosManager) {
        return {
          success: false,
          available: false,
          error: "iOS Manager not initialized",
        };
      }
      const available = iosManager.isAvailable();
      console.log(`📱 iOS Simulator availability check: ${available}`);
      return { success: true, available };
    } catch (err) {
      console.error("❌ iOS availability check failed:", err);
      return { success: false, available: false, error: err.message };
    }
  });

  ipcMain.handle("ios-get-devices", () => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      const devices = iosManager.getDevices();
      console.log(`📱 Found ${devices.length} iOS simulators`);
      return { success: true, devices };
    } catch (err) {
      console.error("❌ Failed to get iOS devices:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-boot", async (event, udid) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Booting iOS simulator: ${udid}`);

      const result = await iosManager.bootDevice(udid, (progress) => {
        event.sender.send("ios-boot-progress", progress);
      });

      console.log(`✅ iOS simulator booted successfully: ${udid}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to boot iOS simulator ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-shutdown", async (event, udid) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Shutting down iOS simulator: ${udid}`);

      const result = await iosManager.shutdownDevice(udid);

      console.log(`✅ iOS simulator shut down successfully: ${udid}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to shutdown iOS simulator ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-shutdown-all", async () => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log("📱 Shutting down all iOS simulators");

      const result = await iosManager.shutdownAll();

      console.log("✅ All iOS simulators shut down");
      return result;
    } catch (err) {
      console.error("❌ Failed to shutdown all iOS simulators:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-install-app", async (event, udid, appPath) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Installing app on iOS simulator ${udid}: ${appPath}`);

      const result = await iosManager.installApp(udid, appPath);

      console.log(`✅ App installed successfully on ${udid}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to install app on ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-launch-app", async (event, udid, bundleId) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Launching app ${bundleId} on iOS simulator ${udid}`);

      const result = await iosManager.launchApp(udid, bundleId);

      console.log(`✅ App ${bundleId} launched successfully on ${udid}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to launch app ${bundleId} on ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-uninstall-app", async (event, udid, bundleId) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Uninstalling app ${bundleId} from iOS simulator ${udid}`);

      const result = await iosManager.uninstallApp(udid, bundleId);

      console.log(`✅ App ${bundleId} uninstalled from ${udid}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to uninstall app ${bundleId} from ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-open-url", async (event, udid, url) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Opening URL on iOS simulator ${udid}: ${url}`);

      const result = await iosManager.openURL(udid, url);

      console.log(`✅ URL opened successfully on ${udid}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to open URL on ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-get-screenshot", async (event, udid, outputPath) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Taking screenshot from iOS simulator ${udid}`);

      const result = await iosManager.getScreenshot(udid, outputPath);

      console.log(`✅ Screenshot saved to ${outputPath}`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to take screenshot from ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-erase-device", async (event, udid) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      console.log(`📱 Erasing iOS simulator ${udid}`);

      const result = await iosManager.eraseDevice(udid);

      console.log(`✅ iOS simulator ${udid} erased successfully`);
      return result;
    } catch (err) {
      console.error(`❌ Failed to erase iOS simulator ${udid}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ios-is-booted", (event, udid) => {
    try {
      if (!iosManager) {
        return { success: false, error: "iOS Manager not initialized" };
      }
      const booted = iosManager.isBooted(udid);
      return { success: true, booted };
    } catch (err) {
      console.error(
        `❌ Failed to check if iOS simulator ${udid} is booted:`,
        err
      );
      return { success: false, error: err.message };
    }
  });

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // AVD milik device yang sudah dihapus dari database
  function listOrphanAvdTargets() {
    const avdRoot = path.join(
      app.getPath("userData"),
      "android-emulator",
      "avd"
    );
    const known = new Set(["StarBox_Default"]);
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      (data.devices || []).forEach((d) => {
        if (d.avdName) known.add(d.avdName);
        if (d.uid) known.add(generateAvdName(d.uid));
      });
    } catch (_) {}
    const targets = [];
    try {
      fs.readdirSync(avdRoot).forEach((entry) => {
        const match = entry.match(/^(.+)\.(avd|ini)$/i);
        if (!match) return;
        if (!known.has(match[1])) targets.push(path.join(avdRoot, entry));
      });
    } catch (_) {}
    return targets;
  }

  // ── Inisialisasi (dulu di initializeLogging core) ──────────────────────────
  ANDROID_REMOTE_DB_PATH = path.join(app.getPath("userData"), "db", "adb-devices.json");
  androidManager = new AndroidManager();
  iosManager = new iOSManager();

  // ── API untuk core (device generik, monitor, telemetri, cleaner, remote) ──
  Object.assign(api, {
    emulatorHtmlPath: path.join(__dirname, "android-emulator.html"),
    normalizeAndroidSpecInput, generateAvdName, ensureAndroidSpec,
    ensureAndroidAutomationConfig, syncAndroidAvdIdentity, sanitizeAndroidDisplayMode,
    normalizeApiLevel: (value) => ensureAndroidManagerReady().normalizeApiLevel(value),
    startAndroidEmulatorDevice, runAndroidWhatsappPendingCycle, readAndroidEmulatorDetails,
    sendAdbRemoteReport, findAndroidRemoteDevice, openAndroidDeviceDisplay,
    readAndroidRemoteDevices, listOrphanAvdTargets,
  });

  startImpl = async () => {
    startAdbStatusMonitor().catch((err) => {
      console.warn("⚠️ Gagal memulai pemantauan status ADB:", err?.message || err);
    });
  };

  shutdownImpl = () => {
    // Tear down StarSync sessions first (closes adb-forward/local sockets
    // cleanly) before the emulator processes they're attached to get killed.
    if (androidSyncManager) {
      try {
        androidSyncManager.disconnectAll().catch(() => {});
      } catch (_) {}
    }
    // Force-kill every Android emulator process (incl. netsimd & crashpad_handler
    // children) so nothing lingers after StarBox closes.
    if (androidManager) {
      try {
        androidManager.killOrphanEmulatorProcesses().catch((err) => {
          console.warn("⚠️ Gagal menghentikan emulator Android saat quit:", err?.message);
        });
      } catch (err) {
        console.warn("⚠️ Gagal menghentikan emulator Android saat quit:", err?.message);
      }
    }
  };

  statsImpl = () => ({ scrcpySessions: scrcpySessions.size });
}

module.exports = {
  register,
  start: () => startImpl(),
  shutdown: () => shutdownImpl(),
  getStats: () => statsImpl(),
  api,
};
