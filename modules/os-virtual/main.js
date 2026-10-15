// ═══════════════════════════════════════════════════════════════════════════════
// Modul OS Virtual — sisi main process (VM QEMU + VNC)
//
// Dipindah dari electron-main.js: daftar VM, start/stop/pause/snapshot lewat QEMU
// + QMP, proxy VNC→WebSocket untuk jendela noVNC, unduh ISO, cek/pasang QEMU.
// Data tetap di <userData>/db/virtual-machines.json dan disk di <userData>/vm.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const nodeNet = require("net");
const { spawn, spawnSync } = require("child_process");
const { desktopCapturer } = require("electron");
const { VirtualOSStorage } = require("./vm-storage");

let virtualOSStorage = null;
let vmProcesses = null;
let startImpl = () => {};

function register(context) {
  const { ipcMain, app, BrowserWindow, dialog } = context.electron;
  const WebSocket = context.requireShared("ws");

  virtualOSStorage = new VirtualOSStorage(context.paths.userData);
  vmProcesses = new Map();
  const vmQmpPorts = new Map(); // vmId → port QMP monitor (graceful shutdown, pause, snapshot live)
  const vmVncProxies = new Map();
  const vncWindows = new Map(); // vmId → BrowserWindow

  ipcMain.handle("download-iso", async (event, { url, filename }) => {
    try {
      const isoDir = path.join(app.getPath("userData"), "isos");
      fs.mkdirSync(isoDir, { recursive: true });
      const destPath = path.join(isoDir, filename);
      const cacheFile = path.join(isoDir, "cache.json");

      // Return immediately if already downloaded
      if (fs.existsSync(destPath)) {
        const stat = fs.statSync(destPath);
        if (stat.size > 1024 * 100) {
          return { success: true, localPath: destPath, cached: true };
        }
        fs.unlinkSync(destPath); // Remove corrupted/partial file
      }

      const win = BrowserWindow.fromWebContents(event.sender);

      // Download with proper redirect following (up to 10 hops)
      const doDownload = (currentUrl, redirectCount = 0) => new Promise((resolve, reject) => {
        if (redirectCount > 10) { reject(new Error("Terlalu banyak redirect")); return; }
        const httpMod = currentUrl.startsWith("https") ? require("https") : require("http");
        const file = fs.createWriteStream(destPath);
        let downloaded = 0;
        let total = 0;
        const req = httpMod.get(currentUrl, { timeout: 30000 }, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            file.close();
            fs.unlink(destPath, () => {});
            const loc = res.headers.location;
            if (!loc) { reject(new Error("Redirect tanpa header Location")); return; }
            const nextUrl = loc.startsWith("http") ? loc : new URL(loc, currentUrl).href;
            doDownload(nextUrl, redirectCount + 1).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            file.close();
            fs.unlink(destPath, () => {});
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          total = parseInt(res.headers["content-length"] || "0", 10);
          res.pipe(file);
          res.on("data", (chunk) => {
            downloaded += chunk.length;
            const pct = total > 0 ? Math.round((downloaded / total) * 100) : -1;
            win?.webContents?.send("iso-download-progress", { pct, downloaded, total, filename });
          });
          file.on("finish", () => { file.close(); resolve(); });
        });
        req.on("error", (err) => {
          file.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
        req.on("timeout", () => {
          req.destroy();
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error("Timeout saat download"));
        });
      });

      await doDownload(url);

      // Update cache.json
      let cache = [];
      try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch (_) {}
      if (!cache.find(c => c.filename === filename)) {
        cache.push({ filename, localPath: destPath, url, downloadedAt: new Date().toISOString(), sizeMb: Math.round(fs.statSync(destPath).size / 1024 / 1024) });
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      }

      return { success: true, localPath: destPath };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal download ISO." };
    }
  });

  ipcMain.handle("list-cached-isos", () => {
    try {
      const cacheFile = path.join(app.getPath("userData"), "isos", "cache.json");
      if (!fs.existsSync(cacheFile)) return [];
      const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      return cache.filter(c => fs.existsSync(c.localPath));
    } catch (_) { return []; }
  });

  ipcMain.handle("open-vnc-window", async (_event, { vmId, wsPort, vmName }) => {
    try {
      // Focus existing window if already open
      const existing = vncWindows.get(vmId);
      if (existing && !existing.isDestroyed()) {
        if (existing.isMinimized()) existing.restore();
        existing.show();
        existing.focus();
        return { success: true, focused: true };
      }

      const vncPreloadPath = path.join(__dirname, "vnc-preload.cjs");
      const win = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 640,
        minHeight: 480,
        title: `VNC — ${vmName || vmId}`,
        backgroundColor: "#0b1220",
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: fs.existsSync(vncPreloadPath) ? vncPreloadPath : undefined,
        },
      });

      win.loadFile(path.join(__dirname, "vnc-viewer.html"), {
        query: { host: "127.0.0.1", port: String(wsPort), vmId, vmName: vmName || "" },
      });

      win.on("closed", () => {
        vncWindows.delete(vmId);
      });

      vncWindows.set(vmId, win);
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message };
    }
  });

  ipcMain.handle("focus-vnc-window", (_event, vmId) => {
    const win = vncWindows.get(vmId);
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return { found: true };
    }
    return { found: false };
  });

  ipcMain.handle("get-vnc-source-id", async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { ok: false };
      const sources = await desktopCapturer.getSources({
        types: ["window"],
        thumbnailSize: { width: 0, height: 0 },
      });
      const title = win.getTitle();
      const found = sources.find((s) => s.name === title) ||
                    sources.find((s) => s.name.includes("VNC"));
      if (!found) return { ok: false, error: "Source not found" };
      return { ok: true, sourceId: found.id };
    } catch (err) {
      return { ok: false, error: err?.message };
    }
  });

  ipcMain.handle("browse-iso-file", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Pilih File ISO",
        filters: [
          { name: "ISO Files", extensions: ["iso", "img"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      console.error("❌ Error browsing ISO file:", err);
      return { success: false, message: err?.message || "Gagal membuka file picker" };
    }
  });

  ipcMain.handle("os-vm-list", async () => {
    try {
      const items = virtualOSStorage ? virtualOSStorage.list() : [];
      return { success: true, items };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal membaca VM list." };
    }
  });

  ipcMain.handle("os-vm-upsert", async (_event, payload = {}) => {
    try {
      const record = virtualOSStorage
        ? virtualOSStorage.upsert(payload)
        : null;
      return { success: true, record };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal menyimpan VM." };
    }
  });

  ipcMain.handle("os-vm-delete", async (_event, id) => {
    try {
      virtualOSStorage?.remove(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal menghapus VM." };
    }
  });

  // ── QEMU optimization helpers ─────────────────────────────────────────────
  // Arsitektur guest dari nama binary (qemu-system-x86_64 / qemu-system-aarch64 / ...)
  function getQemuBinArch(qemuBin) {
    const base = path.basename(String(qemuBin || "")).toLowerCase();
    if (base.includes("aarch64")) return "aarch64";
    if (base.includes("i386")) return "i386";
    if (base.includes("arm")) return "arm";
    return "x86_64";
  }

  // Deteksi akselerator hardware terbaik yang tersedia untuk binary QEMU ini.
  // HVF (macOS) / KVM (Linux) / WHPX (Windows) hanya bisa dipakai jika arsitektur
  // guest = arsitektur host; selain itu jatuh ke TCG (emulasi software).
  const qemuAccelCache = new Map();
  function detectQemuAccel(qemuBin) {
    if (qemuAccelCache.has(qemuBin)) return qemuAccelCache.get(qemuBin);
    let available = "";
    try {
      const r = spawnSync(qemuBin, ["-accel", "help"], { timeout: 5000 });
      if (!r.error && r.stdout) available = r.stdout.toString().toLowerCase();
    } catch (_) {}
    const hostArch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x86_64" : process.arch;
    const archMatch = getQemuBinArch(qemuBin) === hostArch;
    let accel = "tcg";
    if (archMatch) {
      if (process.platform === "linux" && available.includes("kvm")) {
        try {
          fs.accessSync("/dev/kvm", fs.constants.R_OK | fs.constants.W_OK);
          accel = "kvm";
        } catch (_) {}
      } else if (process.platform === "darwin" && available.includes("hvf")) {
        accel = "hvf";
      } else if (process.platform === "win32" && available.includes("whpx")) {
        accel = "whpx";
      }
    }
    qemuAccelCache.set(qemuBin, accel);
    console.log(`⚡ QEMU accel untuk ${path.basename(qemuBin)}: ${accel}${archMatch ? "" : " (arch guest ≠ host)"}`);
    return accel;
  }

  // qemu-img yang satu paket dengan binary QEMU (penting di Windows: tidak ada di PATH)
  function findQemuImg(qemuBin) {
    const name = process.platform === "win32" ? "qemu-img.exe" : "qemu-img";
    try {
      const sibling = path.join(path.dirname(qemuBin), name);
      if (fs.existsSync(sibling)) return sibling;
    } catch (_) {}
    return name;
  }

  // Firmware UEFI (edk2) untuk mesin aarch64 "virt" — wajib agar bisa boot ISO
  function findEdk2Firmware(qemuBin) {
    const dirs = [
      path.join(path.dirname(qemuBin || ""), "..", "share", "qemu"),
      path.join(path.dirname(qemuBin || ""), "share"),
      "/opt/homebrew/share/qemu",
      "/usr/local/share/qemu",
      "/usr/share/qemu",
    ];
    for (const dir of dirs) {
      try {
        const p = path.join(dir, "edk2-aarch64-code.fd");
        if (fs.existsSync(p)) return p;
      } catch (_) {}
    }
    return null;
  }

  // Lokasi disk qcow2 VM (mengikuti logika pembuatan otomatis di doStartVm)
  function resolveVmDiskPath(vm) {
    if (vm.diskPath) return vm.diskPath;
    const vmDir = path.join(app.getPath("userData"), "vm");
    return path.join(vmDir, `${vm.id}.qcow2`);
  }

  // Rakit argumen QEMU yang dioptimalkan:
  // - Akselerasi hardware (HVF/KVM/WHPX) dengan fallback TCG
  // - Mesin modern q35 (x86) / virt+UEFI (aarch64)
  // - Disk virtio + writeback cache + discard (Linux), SATA/AHCI (Windows/other)
  // - Jaringan virtio-net / e1000 sesuai networkMode
  // - virtio-balloon (RAM idle dikembalikan ke host) + usb-tablet (mouse VNC akurat)
  function buildQemuArgs(vm, diskPath, displayNumber, qemuBin, qmpPort) {
    const binArch = getQemuBinArch(qemuBin);
    const accel = detectQemuAccel(qemuBin);
    const hwAccel = accel !== "tcg";
    const isArm = binArch === "aarch64" || binArch === "arm";
    const guest = (vm.osType || "linux").toLowerCase();

    const args = ["-m", String(vm.memoryMb || 1024), "-smp", String(vm.cpu || 1)];

    const safeName = String(vm.name || "vm").replace(/[^\w .-]/g, "").slice(0, 40) || "vm";
    args.push("-name", safeName);

    // Mesin + akselerator (accel=X:tcg → coba hardware dulu, fallback TCG)
    if (isArm) {
      args.push("-machine", `virt,accel=${accel}${hwAccel ? ":tcg" : ""}`);
      const fw = findEdk2Firmware(qemuBin);
      if (fw) args.push("-bios", fw);
    } else {
      let machine = `q35,accel=${accel}${hwAccel ? ":tcg" : ""}`;
      if (accel === "whpx") machine += ",kernel-irqchip=off";
      args.push("-machine", machine);
    }

    // CPU model: host passthrough saat pakai akselerasi hardware
    if (hwAccel) {
      if (guest === "windows" && accel === "kvm") {
        // Hyper-V enlightenments → Windows guest jauh lebih responsif di KVM
        args.push("-cpu", "host,hv_relaxed,hv_spinlocks=0x1fff,hv_vapic,hv_time");
      } else {
        args.push("-cpu", "host");
      }
    } else {
      args.push("-cpu", "max");
    }

    // Disk: virtio untuk Linux (tercepat), SATA/IDE untuk Windows & OS lain
    // (installer Windows tidak punya driver virtio bawaan)
    if (diskPath) {
      const diskIf = guest === "linux" ? "virtio" : "ide";
      args.push("-drive", `file=${diskPath},format=qcow2,if=${diskIf},cache=writeback,discard=unmap`);
    }

    // CD-ROM installer
    if (vm.isoPath) {
      if (isArm) {
        // mesin virt tidak punya bus IDE — pakai USB CD-ROM
        args.push("-drive", `file=${vm.isoPath},media=cdrom,if=none,id=cd0,readonly=on`);
        args.push("-device", "usb-storage,drive=cd0");
      } else {
        args.push("-cdrom", vm.isoPath);
        if (vm.bootOrder) args.push("-boot", `order=${vm.bootOrder},menu=on`);
      }
    }

    // Jaringan sesuai networkMode (sebelumnya disimpan tapi tidak pernah dipakai)
    const netDevice = guest === "linux" ? "virtio-net-pci" : "e1000";
    const macSuffix = vm.macAddress ? `,mac=${vm.macAddress}` : "";
    const mode = (vm.networkMode || "nat").toLowerCase();
    if (mode === "none") {
      args.push("-nic", "none");
    } else if (mode === "bridge" && process.platform === "darwin") {
      args.push("-netdev", `vmnet-bridged,id=net0,ifname=${vm.bridgeInterface || "en0"}`);
      args.push("-device", `${netDevice},netdev=net0${macSuffix}`);
    } else if (mode === "bridge" && process.platform === "linux") {
      args.push("-netdev", `bridge,id=net0,br=${vm.bridgeInterface || "br0"}`);
      args.push("-device", `${netDevice},netdev=net0${macSuffix}`);
    } else {
      // NAT (user-mode) — juga fallback bridge di Windows
      args.push("-netdev", "user,id=net0");
      args.push("-device", `${netDevice},netdev=net0${macSuffix}`);
    }

    // Balloon: guest bisa mengembalikan RAM yang tidak terpakai ke host
    args.push("-device", "virtio-balloon-pci");

    // USB tablet → posisi mouse absolut, kursor VNC tidak meleset
    args.push("-device", "qemu-xhci,id=xhci");
    args.push("-device", "usb-tablet");
    if (isArm) args.push("-device", "usb-kbd");

    // Display
    if (isArm) {
      args.push("-device", "virtio-gpu-pci");
    } else {
      args.push("-vga", guest === "linux" ? "virtio" : "std");
    }

    // Jam hardware Windows memakai waktu lokal
    if (guest === "windows") args.push("-rtc", "base=localtime");

    // VNC display
    args.push("-vnc", `127.0.0.1:${displayNumber},password=off`);

    // QMP monitor untuk graceful shutdown / pause / snapshot live
    if (qmpPort) args.push("-qmp", `tcp:127.0.0.1:${qmpPort},server=on,wait=off`);

    return { args, accel };
  }

  // Client QMP minimal: handshake capabilities lalu satu perintah
  function qmpCommand(port, execute, cmdArgs = {}, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const socket = nodeNet.createConnection({ host: "127.0.0.1", port });
      let buffer = "";
      let stage = 0; // 0=tunggu greeting, 1=tunggu ack capabilities, 2=tunggu hasil
      let settled = false;
      const timer = setTimeout(() => finish(new Error("QMP timeout")), timeoutMs);
      function finish(err, result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { socket.destroy(); } catch (_) {}
        err ? reject(err) : resolve(result);
      }
      socket.on("error", (err) => finish(err));
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          let msg;
          try { msg = JSON.parse(line); } catch (_) { continue; }
          if (msg.event) continue; // abaikan event async
          if (stage === 0 && msg.QMP) {
            stage = 1;
            socket.write(JSON.stringify({ execute: "qmp_capabilities" }) + "\n");
          } else if (stage === 1) {
            if (msg.error) return finish(new Error(msg.error.desc || "QMP capabilities gagal"));
            stage = 2;
            socket.write(JSON.stringify({ execute, arguments: cmdArgs }) + "\n");
          } else if (stage === 2) {
            if (msg.error) return finish(new Error(msg.error.desc || `QMP ${execute} gagal`));
            return finish(null, msg.return);
          }
        }
      });
    });
  }

  // Stop VM: coba ACPI shutdown (guest shutdown bersih) → SIGTERM → SIGKILL
  async function doStopVm(id, { graceful = true, gracefulTimeoutMs = 6000 } = {}) {
    const proc = vmProcesses.get(id);
    if (proc) {
      const waitExit = (ms) =>
        new Promise((resolve) => {
          if (proc.exitCode !== null) return resolve(true);
          const onExit = () => { clearTimeout(t); resolve(true); };
          const t = setTimeout(() => {
            proc.removeListener("exit", onExit);
            resolve(false);
          }, ms);
          proc.once("exit", onExit);
        });
      let exited = proc.exitCode !== null;
      const qmpPort = vmQmpPorts.get(id);
      if (!exited && graceful && qmpPort) {
        try {
          await qmpCommand(qmpPort, "system_powerdown");
          console.log(`🔌 VM ${id}: ACPI powerdown dikirim, menunggu guest shutdown...`);
          exited = await waitExit(gracefulTimeoutMs);
        } catch (_) {}
      }
      if (!exited) {
        try { proc.kill("SIGTERM"); } catch (_) {}
        exited = await waitExit(1500);
      }
      if (!exited) {
        try { proc.kill("SIGKILL"); } catch (_) {}
      }
      vmProcesses.delete(id);
    }
    vmQmpPorts.delete(id);
    stopVncProxy(id);
    return virtualOSStorage?.stop(id);
  }

  async function doStartVm(id) {
      const vm = virtualOSStorage?.get(id);
      if (!vm) throw new Error("VM tidak ditemukan.");

      // Validate VM configuration
      if (!vm.isoPath && !vm.diskPath) {
        throw new Error("VM memerlukan ISO file atau disk image untuk boot.\n\nSilakan tambahkan ISO file terlebih dahulu.");
      }

      // Check if ISO file exists (skip check for URLs — QEMU handles them directly or they should be downloaded first)
      if (vm.isoPath && !vm.isoPath.startsWith("http://") && !vm.isoPath.startsWith("https://")) {
        if (!fs.existsSync(vm.isoPath)) {
          throw new Error(`ISO file tidak ditemukan: ${vm.isoPath}\n\nPastikan file ISO sudah ada di lokasi tersebut.`);
        }
      } else if (vm.isoPath && (vm.isoPath.startsWith("http://") || vm.isoPath.startsWith("https://"))) {
        throw new Error(
          `ISO path berupa URL, bukan file lokal.\n\nURL: ${vm.isoPath}\n\nGunakan dropdown "Pilih OS ringan" di modal Edit VM untuk mengunduh ISO secara otomatis ke disk lokal.`
        );
      }

      // Resolve QEMU binary — use vm setting, findQemuBin(), or fallback name
      const _qemuFallback = process.platform === 'win32' ? 'qemu-system-x86_64.exe' : 'qemu-system-x86_64';
      const qemuBin = vm.qemuBinary || findQemuBin() || _qemuFallback;

      // Check if disk file exists (if specified)
      const diskPath = resolveVmDiskPath({ ...vm, id });
      if (!vm.diskPath) {
        fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      }
      if (!fs.existsSync(diskPath)) {
        const sizeGb = Math.max(5, Math.min(2048, vm.storageGb || 20));
        // lazy_refcounts + writeback cache = tulis disk jauh lebih cepat, file tetap thin
        const imgResult = spawnSync(findQemuImg(qemuBin), [
          "create",
          "-f",
          "qcow2",
          "-o",
          "lazy_refcounts=on",
          diskPath,
          `${sizeGb}G`,
        ]);
        if (imgResult.error || imgResult.status !== 0) {
          const detail = imgResult.error?.message || imgResult.stderr?.toString().trim() || "qemu-img gagal";
          throw new Error(`Gagal membuat disk virtual (${diskPath}).\n\nDetail: ${detail}`);
        }
        console.log("✅ Disk image created:", diskPath);
      }

      if (vmProcesses.has(id)) {
        const existing = vmProcesses.get(id);
        // Check if process is still actually alive
        if (existing && !existing.killed) {
          try {
            process.kill(existing.pid, 0); // signal 0 = just check
            const wsPort = await ensureVncProxy(id, "127.0.0.1", vm.vncPort || 5901);
            return { success: true, vm: { ...vm, status: "running" }, message: "VM sudah berjalan.", wsPort };
          } catch (_) {
            // Process is dead but still in map — fall through to restart
            vmProcesses.delete(id);
            stopVncProxy(id);
          }
        } else {
          vmProcesses.delete(id);
          stopVncProxy(id);
        }
      }

      // Kill any stale process holding the disk file (macOS/Linux)
      if (diskPath && process.platform !== "win32") {
        try {
          const lsofResult = spawnSync("lsof", ["-t", diskPath], { timeout: 3000 });
          if (!lsofResult.error && lsofResult.stdout) {
            const pids = lsofResult.stdout.toString().trim().split("\n").filter(Boolean);
            for (const pid of pids) {
              try {
                process.kill(parseInt(pid), "SIGKILL");
                console.log(`🔪 Killed stale process ${pid} holding ${diskPath}`);
              } catch (_) {}
            }
            if (pids.length > 0) {
              // Give OS a moment to release file locks
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        } catch (_) {}
      }

      // Check if QEMU is installed
      try {
        const checkQemu = spawnSync(qemuBin, ["--version"]);
        if (checkQemu.error) {
          throw new Error(
            `QEMU tidak terinstall atau tidak ditemukan.\n\n` +
            `Binary: ${qemuBin}\n\n` +
            `Install QEMU:\n` +
            `• macOS: brew install qemu\n` +
            `• Ubuntu/Debian: sudo apt install qemu-system-x86\n` +
            `• Windows: https://qemu.org/download`
          );
        }
        console.log(`✅ QEMU found: ${qemuBin}`);
      } catch (err) {
        throw new Error(`Gagal memeriksa QEMU: ${err.message}`);
      }

      // Find available VNC port
      const requestedPort = vm.vncPort || 5901;
      const availablePort = await findAvailableVncPort(requestedPort);
      const displayNumber = availablePort - 5900;

      // Update VM with actual VNC port being used
      if (availablePort !== requestedPort) {
        console.log(`⚠️ VNC port ${requestedPort} tidak tersedia, menggunakan port ${availablePort}`);
        virtualOSStorage?.upsert({ id, vncPort: availablePort });
      }

      // Port QMP monitor (graceful shutdown / pause / snapshot live)
      let qmpPort = null;
      try {
        qmpPort = await findAvailableVncPort(availablePort + 100, 50);
      } catch (_) {
        console.warn("⚠️ Tidak menemukan port QMP bebas — VM jalan tanpa monitor.");
      }

      const { args, accel } = buildQemuArgs(vm, diskPath, displayNumber, qemuBin, qmpPort);

      console.log(`🚀 Starting QEMU for VM ${id} (accel=${accel}):`, qemuBin, args.join(" "));

      const child = spawn(qemuBin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      // Collect stderr for early-exit error reporting
      const stderrLines = [];
      child.stdout?.on("data", (data) => {
        console.log(`[QEMU ${id}] ${data.toString().trim()}`);
      });
      child.stderr?.on("data", (data) => {
        const line = data.toString().trim();
        console.error(`[QEMU ${id} ERR] ${line}`);
        stderrLines.push(line);
      });

      child.on("error", (err) => {
        console.error(`❌ QEMU spawn error for VM ${id}:`, err);
        vmProcesses.delete(id);
        vmQmpPorts.delete(id);
        stopVncProxy(id);
        virtualOSStorage?.stop(id);
      });

      child.on("exit", (code, signal) => {
        console.log(`⚠️ QEMU exited for VM ${id}. Code: ${code}, Signal: ${signal}`);
        vmProcesses.delete(id);
        vmQmpPorts.delete(id);
        stopVncProxy(id);
        virtualOSStorage?.stop(id);
      });

      vmProcesses.set(id, child);
      if (qmpPort) vmQmpPorts.set(id, qmpPort);

      // Wait briefly and confirm process is still alive
      await new Promise((r) => setTimeout(r, 600));
      if (!vmProcesses.has(id) || child.killed || child.exitCode !== null) {
        const errDetail = stderrLines.slice(-5).join(" | ") || "QEMU exited immediately.";
        // Check for the common "image locked" error
        const isLocked = stderrLines.some((l) =>
          l.includes("Is another process using the image") || l.includes("Failed to get shared lock")
        );
        let hint = "";
        if (isLocked) {
          hint = "\n\nAda proses QEMU lain yang masih mengunci file disk. Klik 'Stop' terlebih dahulu atau restart aplikasi.";
        }
        throw new Error(`QEMU gagal start.${hint}\n\nDetail: ${errDetail}`);
      }

      // Wait for VNC to be ready and create proxy
      const wsPort = await ensureVncProxy(id, "127.0.0.1", availablePort);

      virtualOSStorage?.patchRuntime(id, { accelUsed: accel });
      const updated = virtualOSStorage?.start(id);
      console.log(`✅ VM ${id} started. PID: ${child.pid}, VNC WS: ${wsPort}, accel: ${accel}`);

      return { success: true, vm: updated, pid: child.pid, wsPort, accel };
  }

  ipcMain.handle("os-vm-start", async (_event, id) => {
    try {
      return await doStartVm(id);
    } catch (err) {
      console.error(`❌ Failed to start VM ${id}:`, err);
      return { success: false, message: err?.message || "Gagal menjalankan VM." };
    }
  });

  ipcMain.handle("os-vm-stop", async (_event, id) => {
    try {
      // ACPI shutdown via QMP dulu (guest shutdown bersih) → SIGTERM → SIGKILL
      const vm = await doStopVm(id);
      return { success: true, vm };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal menghentikan VM." };
    }
  });

  ipcMain.handle("os-vm-restart", async (_event, id) => {
    try {
      // Coba reset via QMP dulu (reboot instan tanpa proses baru)
      const proc = vmProcesses.get(id);
      const qmpPort = vmQmpPorts.get(id);
      if (proc && proc.exitCode === null && qmpPort) {
        try {
          await qmpCommand(qmpPort, "system_reset");
          return { success: true, vm: virtualOSStorage?.get(id), message: "VM direset." };
        } catch (_) {
          // QMP gagal → fallback stop + start
        }
      }
      await doStopVm(id);
      return await doStartVm(id);
    } catch (err) {
      return { success: false, message: err?.message || "Gagal restart VM." };
    }
  });

  ipcMain.handle("os-vm-force-stop", async (_event, id) => {
    try {
      const proc = vmProcesses.get(id);
      if (proc) {
        try { proc.kill("SIGKILL"); } catch (_) {}
        vmProcesses.delete(id);
      }
      vmQmpPorts.delete(id);
      stopVncProxy(id);
      virtualOSStorage?.stop(id);
      // Also kill by lsof on disk file (macOS/Linux)
      const vm = virtualOSStorage?.get(id);
      if (vm?.diskPath && process.platform !== "win32") {
        try {
          const lsofResult = spawnSync("lsof", ["-t", vm.diskPath], { timeout: 3000 });
          if (!lsofResult.error && lsofResult.stdout) {
            const pids = lsofResult.stdout.toString().trim().split("\n").filter(Boolean);
            for (const pid of pids) {
              try { process.kill(parseInt(pid), "SIGKILL"); } catch (_) {}
            }
          }
        } catch (_) {}
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message };
    }
  });

  ipcMain.handle("os-vm-pause", async (_event, id) => {
    try {
      const proc = vmProcesses.get(id);
      if (!proc) return { success: false, message: "VM tidak ditemukan / tidak berjalan." };
      // Pause via QMP (jalan juga di Windows); fallback SIGSTOP di macOS/Linux
      const qmpPort = vmQmpPorts.get(id);
      if (qmpPort) {
        await qmpCommand(qmpPort, "stop");
      } else if (process.platform !== "win32") {
        process.kill(proc.pid, "SIGSTOP");
      } else {
        return { success: false, message: "QMP tidak tersedia untuk pause di Windows." };
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message };
    }
  });

  ipcMain.handle("os-vm-resume", async (_event, id) => {
    try {
      const proc = vmProcesses.get(id);
      if (!proc) return { success: false, message: "VM tidak ditemukan / tidak berjalan." };
      const qmpPort = vmQmpPorts.get(id);
      if (qmpPort) {
        await qmpCommand(qmpPort, "cont");
      } else if (process.platform !== "win32") {
        process.kill(proc.pid, "SIGCONT");
      } else {
        return { success: false, message: "QMP tidak tersedia untuk resume di Windows." };
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message };
    }
  });

  ipcMain.handle("os-vm-kill-all-qemu", async () => {
    try {
      const killed = [];
      // Kill all tracked QEMU processes
      for (const [vmId, proc] of vmProcesses.entries()) {
        try { proc.kill("SIGKILL"); } catch (_) {}
        vmProcesses.delete(vmId);
        vmQmpPorts.delete(vmId);
        stopVncProxy(vmId);
        virtualOSStorage?.stop(vmId);
        killed.push(vmId);
      }
      // Also kill any stray qemu processes by name (macOS/Linux)
      if (process.platform !== "win32") {
        try {
          spawnSync("pkill", ["-9", "-f", "qemu-system"], { timeout: 3000 });
        } catch (_) {}
      }
      await new Promise((r) => setTimeout(r, 500));
      return { success: true, killed };
    } catch (err) {
      return { success: false, message: err?.message };
    }
  });

  // Snapshot NYATA di dalam file qcow2 (bukan hanya metadata):
  // - VM berjalan → savevm via QMP (menyimpan disk + RAM, bisa di-restore persis)
  // - VM mati    → qemu-img snapshot -c (disk saja)
  ipcMain.handle("os-vm-snapshot", async (_event, id, name) => {
    try {
      const vm = virtualOSStorage?.get(id);
      if (!vm) throw new Error("VM tidak ditemukan.");
      const diskPath = resolveVmDiskPath(vm);
      if (!fs.existsSync(diskPath)) {
        throw new Error("Disk VM belum ada. Jalankan VM minimal satu kali sebelum membuat snapshot.");
      }
      const tag = `sb_${Date.now()}`;
      const proc = vmProcesses.get(id);
      const running = !!(proc && proc.exitCode === null);
      if (running) {
        const qmpPort = vmQmpPorts.get(id);
        if (!qmpPort) throw new Error("Monitor QMP tidak tersedia. Stop VM lalu buat snapshot lagi.");
        await qmpCommand(qmpPort, "human-monitor-command", { "command-line": `savevm ${tag}` }, 180000);
      } else {
        const qemuImg = findQemuImg(vm.qemuBinary || findQemuBin() || "qemu-system-x86_64");
        const r = spawnSync(qemuImg, ["snapshot", "-c", tag, diskPath], { timeout: 180000 });
        if (r.error || r.status !== 0) {
          const detail = r.error?.message || r.stderr?.toString().trim() || "qemu-img snapshot gagal";
          throw new Error(`Gagal membuat snapshot disk.\n\nDetail: ${detail}`);
        }
      }
      const result = virtualOSStorage?.snapshot(id, name, { tag, live: running });
      return { success: true, vm: result?.vm, snapshot: result?.snapshot };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal membuat snapshot." };
    }
  });

  ipcMain.handle("os-vm-snapshot-restore", async (_event, id, snapshotId) => {
    try {
      const vm = virtualOSStorage?.get(id);
      if (!vm) throw new Error("VM tidak ditemukan.");
      const snap = virtualOSStorage?.getSnapshot(id, snapshotId);
      if (!snap) throw new Error("Snapshot tidak ditemukan.");
      if (!snap.tag) {
        throw new Error("Snapshot ini dibuat versi StarBox lama dan tidak berisi data disk — tidak bisa di-restore.");
      }
      const proc = vmProcesses.get(id);
      const running = !!(proc && proc.exitCode === null);
      if (running) {
        if (!snap.live) {
          throw new Error("Snapshot ini dibuat saat VM mati (disk saja). Stop VM terlebih dahulu untuk me-restore.");
        }
        const qmpPort = vmQmpPorts.get(id);
        if (!qmpPort) throw new Error("Monitor QMP tidak tersedia. Stop VM lalu restore lagi.");
        await qmpCommand(qmpPort, "human-monitor-command", { "command-line": `loadvm ${snap.tag}` }, 180000);
      } else {
        const diskPath = resolveVmDiskPath(vm);
        if (!fs.existsSync(diskPath)) throw new Error("Disk VM tidak ditemukan.");
        const qemuImg = findQemuImg(vm.qemuBinary || findQemuBin() || "qemu-system-x86_64");
        const r = spawnSync(qemuImg, ["snapshot", "-a", snap.tag, diskPath], { timeout: 180000 });
        if (r.error || r.status !== 0) {
          const detail = r.error?.message || r.stderr?.toString().trim() || "qemu-img snapshot gagal";
          throw new Error(`Gagal restore snapshot.\n\nDetail: ${detail}`);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal restore snapshot." };
    }
  });

  ipcMain.handle("os-vm-snapshot-delete", async (_event, id, snapshotId) => {
    try {
      const vm = virtualOSStorage?.get(id);
      if (!vm) throw new Error("VM tidak ditemukan.");
      const snap = virtualOSStorage?.getSnapshot(id, snapshotId);
      if (!snap) throw new Error("Snapshot tidak ditemukan.");
      if (snap.tag) {
        const proc = vmProcesses.get(id);
        const running = !!(proc && proc.exitCode === null);
        const diskPath = resolveVmDiskPath(vm);
        if (running) {
          const qmpPort = vmQmpPorts.get(id);
          if (qmpPort) {
            try {
              await qmpCommand(qmpPort, "human-monitor-command", { "command-line": `delvm ${snap.tag}` }, 60000);
            } catch (e) {
              console.warn(`⚠️ delvm gagal untuk ${snap.tag}:`, e?.message);
            }
          }
        } else if (fs.existsSync(diskPath)) {
          const qemuImg = findQemuImg(vm.qemuBinary || findQemuBin() || "qemu-system-x86_64");
          const r = spawnSync(qemuImg, ["snapshot", "-d", snap.tag, diskPath], { timeout: 60000 });
          if (r.error || (r.status !== 0 && !r.stderr?.toString().includes("Can't find"))) {
            console.warn("⚠️ qemu-img snapshot -d gagal:", r.stderr?.toString().trim());
          }
        }
      }
      virtualOSStorage?.removeSnapshot(id, snapshotId);
      return { success: true, vm: virtualOSStorage?.get(id) };
    } catch (err) {
      return { success: false, message: err?.message || "Gagal menghapus snapshot." };
    }
  });

  // Helper function to check if a port is available
  async function isPortAvailable(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
      const testServer = nodeNet.createServer();
      testServer.once('error', () => {
        resolve(false);
      });
      testServer.once('listening', () => {
        testServer.close();
        resolve(true);
      });
      testServer.listen(port, host);
    });
  }

  // Helper function to find next available VNC port
  async function findAvailableVncPort(startPort = 5901, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      const available = await isPortAvailable(port);
      if (available) {
        return port;
      }
    }
    throw new Error(`Tidak dapat menemukan VNC port yang tersedia setelah ${maxAttempts} percobaan mulai dari port ${startPort}`);
  }

  // Helper function to wait for VNC port to be ready
  async function waitForVncPort(host, port, maxRetries = 30, delayMs = 500) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await new Promise((resolve, reject) => {
          const testSocket = nodeNet.createConnection({ host, port }, () => {
            testSocket.end();
            resolve();
          });
          testSocket.on("error", reject);
          testSocket.setTimeout(1000, () => {
            testSocket.destroy();
            reject(new Error("timeout"));
          });
        });
        return true;
      } catch (err) {
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw new Error(`VNC port ${host}:${port} tidak ready setelah ${maxRetries} percobaan`);
  }

  async function ensureVncProxy(id, host, port) {
    if (vmVncProxies.has(id)) {
      return vmVncProxies.get(id).port;
    }

    // Wait for VNC server to be ready before creating proxy
    await waitForVncPort(host, port);

    return new Promise((resolve, reject) => {
      const wss = new WebSocket.Server({ port: 0 }, () => {
        const wsPort = wss.address().port;
        vmVncProxies.set(id, { wss, port: wsPort });
        console.log(`✅ VNC proxy created for VM ${id}: ws://localhost:${wsPort} -> vnc://${host}:${port}`);
        resolve(wsPort);
      });
      wss.on("connection", (ws) => {
        console.log(`🔌 Client connected to VNC proxy for VM ${id}`);

        // Retry connection to VNC server with exponential backoff
        let retryCount = 0;
        const maxRetries = 5;

        function connectToVnc() {
          const socket = nodeNet.createConnection({ host, port }, () => {
            console.log(`✅ VNC proxy connected to QEMU VNC server ${host}:${port}`);

            ws.on("message", (data) => {
              if (socket.writable) {
                socket.write(data);
              }
            });
            ws.on("close", () => {
              if (!socket.destroyed) {
                socket.end();
              }
            });
            ws.on("error", (err) => {
              console.error(`❌ WebSocket error for VM ${id}:`, err.message);
              if (!socket.destroyed) {
                socket.destroy();
              }
            });

            socket.on("data", (chunk) => {
              if (ws.readyState === 1) {
                ws.send(chunk);
              }
            });
            socket.on("close", () => {
              if (ws.readyState === 1) {
                ws.close();
              }
            });
            socket.on("error", (err) => {
              console.error(`❌ VNC socket error for VM ${id}:`, err.message);
              if (ws.readyState === 1) {
                ws.close();
              }
            });
          });

          socket.on("error", (err) => {
            console.error(`❌ Failed to connect to VNC server (attempt ${retryCount + 1}/${maxRetries}):`, err.message);

            if (retryCount < maxRetries) {
              retryCount++;
              const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
              console.log(`🔄 Retrying VNC connection in ${delay}ms...`);
              setTimeout(connectToVnc, delay);
            } else {
              console.error(`❌ Max retries reached for VNC connection to VM ${id}`);
              if (ws.readyState === 1) {
                ws.close(1011, "VNC server unavailable after retries");
              }
            }
          });
        }

        connectToVnc();
      });
      wss.on("error", (err) => {
        console.error(`❌ VNC WebSocket server error for VM ${id}:`, err.message);
        reject(err);
      });
    });
  }

  function stopVncProxy(id) {
    const proxy = vmVncProxies.get(id);
    if (proxy?.wss) {
      try {
        proxy.wss.clients.forEach((c) => c.terminate());
        proxy.wss.close();
      } catch {
        // ignore
      }
    }
    vmVncProxies.delete(id);
  }

  // ── QEMU check & auto-install ─────────────────────────────────────────────────

  // Helper: find qemu-system-x86_64 binary, including common install paths
  function findQemuBin() {
    if (process.platform === 'win32') {
      // Build Windows candidate paths using env vars (covers all drive letters / user installs)
      const pf    = process.env.PROGRAMFILES          || 'C:\\Program Files';
      const pf86  = process.env['PROGRAMFILES(X86)']  || 'C:\\Program Files (x86)';
      const local = process.env.LOCALAPPDATA          || '';

      // Direct paths (most common: official installer puts exe directly in qemu folder)
      const winPaths = [
        path.join(pf,   'qemu', 'qemu-system-x86_64.exe'),
        path.join(pf,   'QEMU', 'qemu-system-x86_64.exe'),
        path.join(pf86, 'qemu', 'qemu-system-x86_64.exe'),
        path.join(pf86, 'QEMU', 'qemu-system-x86_64.exe'),
      ];
      if (local) {
        winPaths.push(
          path.join(local, 'Programs', 'qemu', 'qemu-system-x86_64.exe'),
          path.join(local, 'Programs', 'QEMU', 'qemu-system-x86_64.exe'),
          path.join(local, 'qemu', 'qemu-system-x86_64.exe'),
        );
      }
      for (const p of winPaths) {
        try { if (fs.existsSync(p)) return p; } catch {}
      }

      // Scan subdirs of Program Files for any qemu* directory (handles version-suffixed installs)
      const scanParent = (parentDir) => {
        try {
          const entries = fs.readdirSync(parentDir, { withFileTypes: true });
          for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (!e.name.toLowerCase().startsWith('qemu')) continue;
            const candidate = path.join(parentDir, e.name, 'qemu-system-x86_64.exe');
            try { if (fs.existsSync(candidate)) return candidate; } catch {}
            const binCandidate = path.join(parentDir, e.name, 'bin', 'qemu-system-x86_64.exe');
            try { if (fs.existsSync(binCandidate)) return binCandidate; } catch {}
          }
        } catch {}
        return null;
      };
      for (const parent of [pf, pf86, local ? path.join(local, 'Programs') : null].filter(Boolean)) {
        const found = scanParent(parent);
        if (found) return found;
      }

      // Use where.exe to search PATH (handles installs that register in PATH registry)
      try {
        const r = spawnSync('where.exe', ['qemu-system-x86_64.exe'], { timeout: 5000 });
        if (!r.error && r.status === 0) {
          const found = r.stdout.toString().trim().split(/\r?\n/)[0].trim();
          if (found) { try { if (fs.existsSync(found)) return found; } catch {} }
        }
      } catch {}
      return null;
    }

    // macOS Homebrew paths
    if (process.platform === 'darwin') {
      const macPaths = [
        '/opt/homebrew/bin/qemu-system-x86_64',
        '/usr/local/bin/qemu-system-x86_64',
      ];
      for (const p of macPaths) {
        try { if (fs.existsSync(p)) return p; } catch {}
      }
    } else {
      // Linux
      const linuxPaths = ['/usr/bin/qemu-system-x86_64', '/usr/local/bin/qemu-system-x86_64'];
      for (const p of linuxPaths) {
        try { if (fs.existsSync(p)) return p; } catch {}
      }
    }

    // Fall back to PATH via spawn
    const name = process.platform === 'win32' ? 'qemu-system-x86_64.exe' : 'qemu-system-x86_64';
    try {
      const r = spawnSync(name, ['--version'], { timeout: 5000 });
      if (!r.error) return name;
    } catch {}
    return null;
  }

  ipcMain.handle('os-vm-check-qemu', async () => {
    const bin = findQemuBin();
    if (bin) {
      try {
        const r = spawnSync(bin, ['--version'], { timeout: 5000 });
        const ver = (r.stdout || r.stderr || '').toString().split('\n')[0].trim();
        return { available: true, version: ver, bin };
      } catch {}
    }
    return { available: false, platform: process.platform };
  });

  ipcMain.handle('os-vm-install-qemu', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const sendProgress = (message, done = false, error = false) => {
      win?.webContents?.send('qemu-install-progress', { message, done, error });
    };

    try {
      sendProgress('Memulai instalasi QEMU...');
      const plat = process.platform;
      let cmd, args;

      if (plat === 'win32') {
        // Try winget first (available on Win10 1809+ and Win11)
        const wingetCheck = spawnSync('winget', ['--version'], { timeout: 5000 });
        if (!wingetCheck.error) {
          cmd = 'winget';
          args = ['install', '--id=SoftwareFreedomConservancy.QEMU',
                  '--accept-source-agreements', '--accept-package-agreements', '--silent'];
          sendProgress('Menginstall QEMU via winget...');
        } else {
          return {
            success: false,
            message: 'winget tidak ditemukan. Download QEMU manual di https://qemu.org/download/#windows',
            manualUrl: 'https://qemu.org/download/#windows',
          };
        }
      } else if (plat === 'darwin') {
        const brewCheck = spawnSync('brew', ['--version'], { timeout: 5000 });
        if (!brewCheck.error) {
          cmd = 'brew'; args = ['install', 'qemu'];
          sendProgress('Menginstall QEMU via Homebrew...');
        } else {
          return {
            success: false,
            message: 'Homebrew tidak ditemukan. Install homebrew dulu: https://brew.sh, lalu jalankan: brew install qemu',
            manualUrl: 'https://brew.sh',
          };
        }
      } else {
        // Linux
        cmd = 'sudo'; args = ['apt-get', 'install', '-y', 'qemu-system-x86'];
        sendProgress('Menginstall QEMU via apt...');
      }

      await new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', (d) => sendProgress(d.toString().trim()));
        child.stderr.on('data', (d) => sendProgress(d.toString().trim()));
        child.on('error', reject);
        child.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Proses keluar dengan kode ${code}`));
        });
      });

      // Verify — use findQemuBin() to check known install paths too
      const foundBin = findQemuBin();
      if (foundBin) {
        sendProgress(`QEMU berhasil diinstall! (${foundBin})`, true);
      } else {
        sendProgress('QEMU terinstall. Jika banner masih muncul, restart StarBox.', true);
      }
      return { success: true };
    } catch (err) {
      sendProgress(`Gagal: ${err.message}`, false, true);
      return { success: false, message: err.message };
    }
  });

  startImpl = () => {
    // Autostart VM yang ditandai autostart (checkbox di modal Lanjutan)
    setTimeout(async () => {
      try {
        const vms = virtualOSStorage.list().filter((vm) => vm.autostart);
        for (const vm of vms) {
          try {
            console.log(`🚀 Autostart VM: ${vm.name} (${vm.id})`);
            await doStartVm(vm.id);
          } catch (err) {
            console.warn(`⚠️ Autostart VM ${vm.name} gagal:`, err?.message || err);
          }
        }
      } catch (err) {
        console.warn("⚠️ Autostart VM error:", err?.message || err);
      }
    }, 4000);
  };
}

/** Dipanggil core setelah app siap: autostart VM yang ditandai autostart. */
function start() {
  startImpl();
}

function getStats() {
  return { runningVms: vmProcesses ? vmProcesses.size : 0 };
}

module.exports = { register, start, getStats };
