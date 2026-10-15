// ═══════════════════════════════════════════════════════════════════════════════
// Modul Resource Monitor — sisi main process
// Dipindah dari electron-main.js: CPU/RAM/disk, jumlah layanan yang berjalan
// (dari core & modul lain), daftar proses + kill, dan System Cleaner.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

function register(context) {
  const { ipcMain, app } = context.electron;
  const svc = context.services;

  // ── Resource Monitor: rolling CPU usage sampler ────────────────────────────
  let _rmCpuCache = 0;

  function _rmGetCpuSample() {
    return os.cpus().map(c => ({
      total: Object.values(c.times).reduce((a, b) => a + b, 0),
      idle: c.times.idle,
    }));
  }

  let _rmPrevSample = _rmGetCpuSample();

  setInterval(() => {
    const curr = _rmGetCpuSample();
    let totalDelta = 0, idleDelta = 0;
    for (let i = 0; i < curr.length; i++) {
      totalDelta += curr[i].total - (_rmPrevSample[i]?.total || 0);
      idleDelta  += curr[i].idle  - (_rmPrevSample[i]?.idle  || 0);
    }
    _rmCpuCache = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
    _rmPrevSample = curr;
  }, 1000);

  const CLEANER_PARTITION_CACHE_SUBDIRS = [
    "Cache",
    "Code Cache",
    "GPUCache",
    "DawnCache",
    "Shared Dictionary",
    path.join("Service Worker", "CacheStorage"),
  ];

  // Hitung (dryRun) atau hapus isi target secara best-effort.
  // Symlink tidak diikuti; socket/fifo/device dilewati; file terkunci diabaikan.
  // Folder root target tidak pernah di-rmdir (hanya isinya).
  async function cleanerWalk(target, options = {}) {
    const { olderThanMs = 0, dryRun = true, skipEntry = null, depth = 0 } = options;
    const result = { bytes: 0, files: 0 };
    let st;
    try {
      st = await fs.promises.lstat(target);
    } catch (_) {
      return result;
    }

    if (st.isSymbolicLink() || st.isFile()) {
      if (olderThanMs && Date.now() - st.mtimeMs < olderThanMs) return result;
      result.bytes += st.size;
      result.files += 1;
      if (!dryRun) {
        try {
          await fs.promises.unlink(target);
        } catch (_) {
          result.bytes -= st.size;
          result.files -= 1;
        }
      }
      return result;
    }

    if (!st.isDirectory()) return result;

    let entries = [];
    try {
      entries = await fs.promises.readdir(target);
    } catch (_) {
      return result;
    }
    for (const entry of entries) {
      if (depth === 0 && typeof skipEntry === "function" && skipEntry(entry)) {
        continue;
      }
      const sub = await cleanerWalk(path.join(target, entry), {
        olderThanMs,
        dryRun,
        skipEntry,
        depth: depth + 1,
      });
      result.bytes += sub.bytes;
      result.files += sub.files;
    }
    if (!dryRun && depth > 0) {
      try {
        await fs.promises.rmdir(target);
      } catch (_) {}
    }
    return result;
  }

  function getCleanerCategories() {
    const userData = app.getPath("userData");
    const home = os.homedir();
    const categories = [];

    // 1. Cache StarBox sendiri — cache web session dihapus, tapi Cookies &
    //    Local Storage TIDAK disentuh sehingga login tetap aman
    const starboxTargets = [
      "Cache",
      "Code Cache",
      "GPUCache",
      "DawnCache",
      "Shared Dictionary",
    ].map((d) => ({ target: path.join(userData, d) }));
    starboxTargets.push({ target: path.join(userData, "starbox.log") });
    try {
      const partRoot = path.join(userData, "Partitions");
      fs.readdirSync(partRoot).forEach((p) => {
        CLEANER_PARTITION_CACHE_SUBDIRS.forEach((sub) => {
          starboxTargets.push({ target: path.join(partRoot, p, sub) });
        });
      });
    } catch (_) {}
    categories.push({
      id: "starbox-cache",
      label: "Cache StarBox",
      desc: "Cache web session & log. Login dan data device tetap aman",
      defaultChecked: true,
      targets: starboxTargets,
    });

    // 2. File temp sistem yang sudah lama
    categories.push({
      id: "system-temp",
      label: "File temp sistem",
      desc: "File sementara berumur lebih dari 3 hari di folder temp",
      defaultChecked: true,
      targets: [
        {
          target: os.tmpdir(),
          olderThanMs: 3 * 24 * 60 * 60 * 1000,
          skipEntry: (name) => /^claude/i.test(name),
        },
      ],
    });

    // 3. Data emulator dari device Android yang sudah dihapus
    const orphanTargets = (context.getModuleApi("android-ios")?.listOrphanAvdTargets?.() || []).map((t) => ({ target: t }));
    categories.push({
      id: "orphan-avd",
      label: "Data emulator yatim",
      desc: "Data AVD milik device Android yang sudah dihapus dari StarBox",
      defaultChecked: true,
      targets: orphanTargets,
    });

    // 4. Cache aplikasi lain milik user (macOS/Linux, opsional)
    if (process.platform === "darwin") {
      categories.push({
        id: "user-cache",
        label: "Cache aplikasi lain (macOS)",
        desc: "~/Library/Caches berumur >7 hari, kecuali cache Apple & StarBox. Aplikasi membangun ulang cache-nya sendiri",
        defaultChecked: false,
        targets: [
          {
            target: path.join(home, "Library", "Caches"),
            olderThanMs: 7 * 24 * 60 * 60 * 1000,
            skipEntry: (name) =>
              /^com\.apple\./i.test(name) || /starbox/i.test(name),
          },
        ],
      });
    } else if (process.platform === "linux") {
      categories.push({
        id: "user-cache",
        label: "Cache aplikasi lain (Linux)",
        desc: "~/.cache berumur >7 hari, kecuali cache StarBox. Aplikasi membangun ulang cache-nya sendiri",
        defaultChecked: false,
        targets: [
          {
            target: path.join(home, ".cache"),
            olderThanMs: 7 * 24 * 60 * 60 * 1000,
            skipEntry: (name) => /starbox/i.test(name),
          },
        ],
      });
    }

    return categories;
  }

  async function runCleanerCategories(categories, dryRun) {
    const out = [];
    for (const cat of categories) {
      let bytes = 0;
      let files = 0;
      for (const t of cat.targets) {
        const r = await cleanerWalk(t.target, {
          olderThanMs: t.olderThanMs || 0,
          dryRun,
          skipEntry: t.skipEntry || null,
        });
        bytes += r.bytes;
        files += r.files;
      }
      out.push({
        id: cat.id,
        label: cat.label,
        desc: cat.desc,
        defaultChecked: cat.defaultChecked,
        bytes,
        files,
      });
    }
    return out;
  }

  ipcMain.handle("system-clean-scan", async () => {
    try {
      const categories = await runCleanerCategories(getCleanerCategories(), true);
      return { success: true, categories };
    } catch (err) {
      console.error("❌ system-clean-scan gagal:", err);
      return { success: false, error: err.message, categories: [] };
    }
  });

  ipcMain.handle("system-clean-run", async (_event, ids = []) => {
    try {
      const wanted = new Set(Array.isArray(ids) ? ids : []);
      const categories = getCleanerCategories().filter((c) => wanted.has(c.id));
      const results = await runCleanerCategories(categories, false);
      // Bersihkan juga cache session Electron yang sedang aktif (best-effort)
      if (wanted.has("starbox-cache")) {
        try {
          await require("electron").session.defaultSession.clearCache();
        } catch (_) {}
      }
      return { success: true, results };
    } catch (err) {
      console.error("❌ system-clean-run gagal:", err);
      return { success: false, error: err.message, results: [] };
    }
  });

  // List running processes (like Activity Monitor / Task Manager)
  ipcMain.handle('resource-monitor-processes', async (_, limit = 60) => {
    return new Promise((resolve) => {
      try {
        let cmd, args;
        if (process.platform === 'win32') {
          cmd = 'wmic';
          args = ['process', 'get', 'ProcessId,Name,WorkingSetSize,CommandLine', '/format:csv'];
        } else {
          // macOS / Linux: ps aux sorted by RSS memory
          cmd = 'ps';
          args = ['aux', '--no-headers'];
          if (process.platform === 'darwin') args = ['aux'];
        }

        const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        child.stdout.on('data', d => { out += d.toString(); });
        child.on('close', () => {
          const procs = [];
          if (process.platform === 'win32') {
            // wmic csv: skip first 2 lines (empty, header)
            const lines = out.split('\n').filter(l => l.trim());
            const header = lines[0]?.split(',').map(h => h.trim());
            for (let i = 1; i < lines.length && procs.length < limit; i++) {
              const cols = lines[i].split(',').map(c => c.trim());
              if (cols.length < 3) continue;
              const pid  = parseInt(cols[header?.indexOf('ProcessId')] || cols[1]) || 0;
              const name = (cols[header?.indexOf('Name')] || cols[2] || '').replace(/"/g, '');
              const mem  = parseInt(cols[header?.indexOf('WorkingSetSize')] || cols[3]) || 0;
              if (!name || pid === 0) continue;
              procs.push({ pid, name, cpu: null, mem, user: '' });
            }
          } else {
            // USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
            const lines = out.split('\n');
            for (const line of lines) {
              if (!line.trim() || line.startsWith('USER')) continue;
              const parts = line.trim().split(/\s+/);
              if (parts.length < 11) continue;
              const user = parts[0];
              const pid  = parseInt(parts[1]);
              const cpu  = parseFloat(parts[2]);
              const memPct = parseFloat(parts[3]);
              const rss  = parseInt(parts[5]) * 1024; // RSS in KB → bytes
              const cmd  = parts.slice(10).join(' ');
              const name = parts[10].split('/').pop().split('\\').pop().slice(0, 40);
              if (!pid) continue;
              procs.push({ pid, name, cpu, memPct, mem: rss, user, cmd: cmd.slice(0, 80) });
            }
          }
          // sort by memory desc, limit
          procs.sort((a, b) => (b.mem || 0) - (a.mem || 0));
          resolve(procs.slice(0, limit));
        });
        child.on('error', () => resolve([]));
        setTimeout(() => { try { child.kill(); } catch {} resolve([]); }, 5000);
      } catch (e) {
        resolve([]);
      }
    });
  });

  // Kill a process by PID (restricted — cannot kill StarBox itself or PID 1)
  ipcMain.handle('resource-monitor-kill', async (_, pid) => {
    pid = parseInt(pid);
    if (!pid || pid <= 1 || pid === process.pid) {
      return { success: false, error: 'Proses tidak dapat dihentikan.' };
    }
    try {
      process.kill(pid, 'SIGTERM');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('resource-monitor-get', async () => {
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();

    // Disk usage (try fs.statfs → fallback df/wmic)
    let disk = null;
    try {
      const fsStatfs = fs.statfsSync || null;
      if (fsStatfs) {
        const st = fsStatfs(app.getPath('userData'));
        disk = {
          total: st.blocks * st.bsize,
          free:  st.bfree  * st.bsize,
          used:  (st.blocks - st.bfree) * st.bsize,
        };
      }
    } catch (_) {}
    if (!disk) {
      // best-effort: spawn df on unix, skip on windows
      try {
        if (process.platform !== 'win32') {
          const { execSync } = require('child_process');
          const raw = execSync('df -k /', { timeout: 2000 }).toString().split('\n')[1].trim().split(/\s+/);
          if (raw.length >= 4) {
            const total = parseInt(raw[1]) * 1024;
            const used  = parseInt(raw[2]) * 1024;
            const free  = parseInt(raw[3]) * 1024;
            disk = { total, used, free };
          }
        }
      } catch (_) {}
    }

    // Running service counts
    const webCount     = svc.getDeviceWindowCount();
    const androidCount = svc.getModuleStats('os-virtual')?.runningVms || 0;  // QEMU VMs (modul OS Virtual)
    let   cctvCount    = 0;
    try { cctvCount = svc.getModuleStats('cctv')?.cctvStreams || 0; } catch (_) {}
    let   waCount    = 0;
    try { waCount = svc.getModuleStats('whatsapp-gateway')?.activeDevices || 0; } catch (_) {}
    const adbRemoteCount = svc.getModuleStats("android-ios")?.scrcpySessions || 0;   // Android ADB Remote (scrcpy sessions)
    const remoxCount     = svc.getModuleStats('remox')?.sessions || 0; // Remox SSH/Telnet sessions

    const selfMem = process.memoryUsage();

    return {
      cpu:      _rmCpuCache,
      mem:      { total: totalMem, used: totalMem - freeMem, free: freeMem },
      disk,
      services: {
        webEmulator:      webCount,
        androidEmulator:  androidCount,
        cctvStreams:      cctvCount,
        waGateway:        waCount,
        adbRemote:        adbRemoteCount,
        remox:            remoxCount,
      },
      selfMem: {
        rss:        selfMem.rss,
        heapUsed:   selfMem.heapUsed,
        heapTotal:  selfMem.heapTotal,
        external:   selfMem.external,
      },
      system: {
        platform: os.platform(),
        arch:     os.arch(),
        cores:    os.cpus().length,
        model:    os.cpus()[0]?.model || '',
        hostname: os.hostname(),
        uptime:   os.uptime(),
      },
    };
  });
}

module.exports = { register };
