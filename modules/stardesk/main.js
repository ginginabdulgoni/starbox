// ═══════════════════════════════════════════════════════════════════════════════
// Modul StarDesk — sisi main process (MyStarBox, StarDesk remote desktop & Remote Control)
// Dipindah dari electron-main.js. Koneksi relay (remote-client) tetap milik core;
// modul ini memakainya lewat ctx.services.getRemoteClient().
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const os = require("os");
const { desktopCapturer } = require("electron");

const api = {};

function register(context) {
  const { ipcMain, app, BrowserWindow } = context.electron;
  const svc = context.services;
  const getAuthSession = () => svc.getAuthSession() || {};
  const getStore = () => svc.getStore();
  const { IS_DEV_BUILD } = svc.getAppInfo();

  const remoteMonitorWindows = new Map(); // key: `${toClientId}::${uid}` -> BrowserWindow





  /** Buka window Remote Control */
  ipcMain.handle("remote:open-window", () => {
    const existing = BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && w.webContents.getURL().includes("remote-control.html")
    );
    if (existing) {
      existing.focus();
      return { success: true };
    }
    const win = new BrowserWindow({
      width: 1080, height: 720,
      minWidth: 800, minHeight: 500,
      title: "Remote Control – StarBox",
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        preload: context.paths.corePreload,
      },
    });
    win.loadFile(path.join(__dirname, "remote-control.html"));
    return { success: true };
  });

  /** Buka window monitor remote untuk satu device (bisa multi window per device berbeda). */
  ipcMain.handle("remote:open-monitor-window", (_, payload = {}) => {
    try {
      const toClientId = String(payload?.toClientId || "").trim();
      const uid = String(payload?.uid || "").trim();
      const deviceName = String(payload?.deviceName || uid || "Remote Monitor").trim();
      const resolution = String(payload?.resolution || "auto").trim().toLowerCase();

      if (!toClientId || !uid) {
        return { success: false, error: "toClientId dan uid wajib diisi" };
      }

      const key = `${toClientId}::${uid}`;
      const existing = remoteMonitorWindows.get(key);
      if (existing && !existing.isDestroyed()) {
        existing.focus();
        existing.webContents.send("remote:monitor:update-meta", {
          toClientId,
          uid,
          deviceName,
          resolution,
        });
        return { success: true, reused: true };
      }

      let winWidth = 980;
      let winHeight = 760;
      const match = resolution.match(/^(\\d{3,5})x(\\d{3,5})$/);
      if (match) {
        const targetW = Number(match[1]);
        const targetH = Number(match[2]);
        if (Number.isFinite(targetW) && Number.isFinite(targetH)) {
          winWidth = Math.max(760, Math.min(1720, targetW + 140));
          winHeight = Math.max(560, Math.min(1220, targetH + 220));
        }
      }

      const win = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        minWidth: 640,
        minHeight: 480,
        title: `Remote View - ${deviceName}`,
        autoHideMenuBar: true,
        resizable: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: context.paths.corePreload,
        },
      });

      win.loadFile(path.join(__dirname, "remote-monitor.html"), {
        query: {
          toClientId,
          uid,
          name: deviceName,
          resolution,
        },
      });

      remoteMonitorWindows.set(key, win);
      win.on("closed", () => {
        const current = remoteMonitorWindows.get(key);
        if (current === win) {
          remoteMonitorWindows.delete(key);
        }
      });

      return { success: true, reused: false };
    } catch (err) {
      return { success: false, error: err?.message || "Gagal membuka monitor window" };
    }
  });

  /** Ambil daftar semua device milik user (online + offline) dari remote server */
  ipcMain.handle("stardesk:get-my-devices", async () => {
    if (!getAuthSession()?.isLoggedIn || !getAuthSession()?.token) {
      return { devices: [], error: "NOT_LOGGED_IN" };
    }
    const serverUrl = process.env.STARBOX_REMOTE_URL ||
      (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
    try {
      const res = await fetch(`${serverUrl}/api/stardesk/my-devices`, {
        headers: { Authorization: `Bearer ${getAuthSession().token}` },
      });
      if (!res.ok) return { devices: [], error: `HTTP_${res.status}` };
      const data = await res.json();

      // Terapkan nama lokal jika ada (override untuk device ini sendiri)
      const localName = (() => { try { return getStore().get("stardeskDeviceName") || ""; } catch { return ""; } })();
      const myClientId = svc.getRemoteClient().clientId;
      if (localName && myClientId && Array.isArray(data.devices)) {
        data.devices = data.devices.map(d =>
          d.client_id === myClientId ? { ...d, device_name: localName } : d
        );
      }
      return data;
    } catch (err) {
      console.error("[StarDesk] get-my-devices error:", err.message);
      return { devices: [], error: err.message };
    }
  });

  /** Status agent lokal (apakah svc.getRemoteClient() sedang terhubung dan client ID-nya) */
  ipcMain.handle("stardesk:agent-status", () => ({
    connected:  svc.getRemoteClient().isConnected,
    clientId:   svc.getRemoteClient()._stableClientId,  // selalu ada, bahkan saat guest / belum connect
    deviceName: svc.getRemoteClient().deviceName || os.hostname(),
    platform:   process.platform,
    hostname:   os.hostname(),
  }));

  /** Ganti nama device ini — simpan lokal dulu, lalu sinkron ke server */
  ipcMain.handle("stardesk:rename-device", async (_, { deviceName }) => {
    if (!deviceName || typeof deviceName !== "string" || !deviceName.trim()) {
      return { ok: false, error: "device_name wajib diisi" };
    }
    const trimmed = deviceName.trim();

    // Simpan lokal terlebih dahulu (selalu berhasil)
    try { getStore().set("stardeskDeviceName", trimmed); } catch {}

    // Coba sinkron ke server (best-effort)
    if (getAuthSession()?.isLoggedIn && getAuthSession()?.token && svc.getRemoteClient().clientId) {
      const serverUrl = process.env.STARBOX_REMOTE_URL ||
        (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
      try {
        await fetch(`${serverUrl}/api/stardesk/devices/${svc.getRemoteClient().clientId}/rename`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${getAuthSession().token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ device_name: trimmed }),
        });
      } catch { /* server tidak tersedia – lokal sudah disimpan */ }
    }
    return { ok: true };
  });

  /** Ambil share PIN (PIN acak untuk berbagi, terpisah dari permanentPin) */
  ipcMain.handle("stardesk:guest-pin-get", () => {
    try {
      let pin = getStore().get("stardeskSharePin");
      if (!pin) {
        pin = String(Math.floor(100000 + Math.random() * 900000));
        getStore().set("stardeskSharePin", pin);
      }
      return { pin };
    } catch { return { pin: "" }; }
  });

  /** Refresh share PIN – generate baru dan update socket server */
  ipcMain.handle("stardesk:guest-pin-refresh", () => {
    try {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      getStore().set("stardeskSharePin", pin);
      // Kirim ke server (berlaku untuk semua user)
      {
        svc.getRemoteClient().socketClient?.socket?.emit("device:register-pin", { pin });
      }
      return { pin };
    } catch { return { pin: "" }; }
  });

  /** Ambil settings StarDesk dari electron-store */
  ipcMain.handle("stardesk:get-settings", () => {
    const defaults = { allowIncoming: true, viewOnly: false, requireApproval: false, permanentPin: "" };
    try {
      return { ...defaults, ...(getStore().get("stardeskSettings") || {}), deviceName: getStore().get("stardeskDeviceName") || "" };
    } catch { return defaults; }
  });

  /** Simpan settings StarDesk, sinkron PIN ke server jika perlu */
  ipcMain.handle("stardesk:save-settings", async (_, settings) => {
    try { getStore().set("stardeskSettings", settings); } catch {}

    // Sinkron PIN permanen ke server jika ada
    if (settings.permanentPin && getAuthSession()?.isLoggedIn && getAuthSession()?.token && svc.getRemoteClient().clientId) {
      const serverUrl = process.env.STARBOX_REMOTE_URL ||
        (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
      try {
        await fetch(`${serverUrl}/api/stardesk/devices/${svc.getRemoteClient().clientId}/set-pin`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getAuthSession().token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ pin: settings.permanentPin }),
        });
      } catch {}
    }
    return { ok: true };
  });

  /** Buka window preview layar sendiri (self-remote untuk testing) */
  ipcMain.handle("stardesk:open-self-preview", () => {
    const existing = BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && w.webContents.getURL().includes("stardesk-preview.html")
    );
    if (existing) { if (existing.isMinimized()) existing.restore(); existing.focus(); return { ok: true }; }

    const win = new BrowserWindow({
      width: 1000, height: 700,
      minWidth: 600, minHeight: 400,
      title: "StarDesk – Preview Perangkat Ini",
      backgroundColor: "#0d0b1a",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    win.loadFile(path.join(__dirname, "stardesk-preview.html"));
    return { ok: true };
  });

  /** Generate OTP agar user lain bisa remote masuk ke device ini */
  ipcMain.handle("stardesk:generate-otp", async () => {
    if (!getAuthSession()?.isLoggedIn || !getAuthSession()?.token) return { ok: false, error: "NOT_LOGGED_IN" };
    const clientId = svc.getRemoteClient().clientId;
    if (!clientId) return { ok: false, error: "Agent belum terhubung" };

    const serverUrl = process.env.STARBOX_REMOTE_URL ||
      (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
    try {
      const res = await fetch(`${serverUrl}/api/stardesk/devices/${clientId}/generate-otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthSession().token}` },
      });
      if (!res.ok) return { ok: false, error: `HTTP_${res.status}` };
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /** Hubungkan ke perangkat orang lain menggunakan Device ID + kode OTP */
  ipcMain.handle("stardesk:connect-by-code", async (_, { clientId, code }) => {
    if (!clientId || !code) return { ok: false, error: "clientId dan code wajib diisi" };

    const serverUrl = process.env.STARBOX_REMOTE_URL ||
      (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
    try {
      const headers = { "Content-Type": "application/json" };
      if (getAuthSession()?.token) headers.Authorization = `Bearer ${getAuthSession().token}`;
      const res = await fetch(`${serverUrl}/api/stardesk/connect-by-code`, {
        method: "POST",
        headers,
        body: JSON.stringify({ client_id: clientId, code }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || `HTTP_${res.status}` };
      return data;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── StarDesk: screen size for coordinate mapping ────────────────────────────
  ipcMain.handle("stardesk:get-screen-size", () => {
    const { screen } = require("electron");
    const d = screen.getPrimaryDisplay();
    return {
      width:       d.bounds.width,
      height:      d.bounds.height,
      scaleFactor: d.scaleFactor,
    };
  });

  let _darwinAccessChecked = false;

  let _darwinMovePending  = false;   // throttle: skip mousemove if previous osascript still running

  let _winInputProc = null;

  // macOS virtual keycode → Windows SendKeys string
  const _MAC_KC_TO_WIN_SENDKEY = {
    36: "{ENTER}", 76: "{ENTER}", 51: "{BACKSPACE}", 117: "{DELETE}",
    48: "{TAB}", 53: "{ESCAPE}", 123: "{LEFT}", 124: "{RIGHT}",
    125: "{DOWN}", 126: "{UP}", 115: "{HOME}", 119: "{END}",
    116: "{PGUP}", 121: "{PGDN}",
    122: "{F1}", 120: "{F2}", 99: "{F3}", 118: "{F4}", 96: "{F5}",
    97: "{F6}", 98: "{F7}", 100: "{F8}", 101: "{F9}", 109: "{F10}",
    103: "{F11}", 111: "{F12}",
  };

  // macOS virtual keycode → xdotool key name
  const _MAC_KC_TO_XDOTOOL = {
    36: "Return", 76: "KP_Enter", 51: "BackSpace", 117: "Delete",
    48: "Tab", 53: "Escape", 123: "Left", 124: "Right",
    125: "Down", 126: "Up", 115: "Home", 119: "End",
    116: "Prior", 121: "Next",
    122: "F1", 120: "F2", 99: "F3", 118: "F4", 96: "F5",
    97: "F6", 98: "F7", 100: "F8", 101: "F9", 109: "F10",
    103: "F11", 111: "F12",
  };

  function _getWinInputProc() {
    if (_winInputProc && !_winInputProc.killed) return _winInputProc;
    const { spawn } = require("child_process");
    const fsMod = require("fs");
    const osMod = require("os");
    const pathMod = require("path");

    const scriptPath = pathMod.join(osMod.tmpdir(), "starbox-input.ps1");
    // Uses SendInput with explicit field offsets to match Windows x64 INPUT struct (40 bytes).
    // INPUT: type(4)+pad(4)=8, then MOUSEINPUT: dx(4)dy(4)data(4)flags(4)time(4)+pad(4)+extra(8) = 32 → total 40.
    const psScript = `
  $ErrorActionPreference = 'SilentlyContinue'
  if (-not ([System.Management.Automation.PSTypeName]'SBI').Type) {
  Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class SBI {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] i, int cb);
    [StructLayout(LayoutKind.Explicit, Size=40)]
    public struct INPUT {
      [FieldOffset(0)]  public int type;
      [FieldOffset(8)]  public int dx;
      [FieldOffset(12)] public int dy;
      [FieldOffset(16)] public uint data;
      [FieldOffset(20)] public uint flags;
      [FieldOffset(24)] public uint time;
      [FieldOffset(32)] public IntPtr extra;
    }
    public static void Mouse(uint flags, uint data=0) {
      var a = new INPUT[1]; a[0].type=0; a[0].flags=flags; a[0].data=data;
      SendInput(1, a, 40);
    }
    public const uint LD=2,LU=4,RD=8,RU=16,MD=32,MU=64,WH=2048;
  }
  "@
  }
  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
  while ($true) {
    $line = [Console]::ReadLine()
    if ($null -eq $line) { break }
    try {
      $c = $line | ConvertFrom-Json
      switch ($c.type) {
        "mousemove" { [SBI]::SetCursorPos([int]$c.x,[int]$c.y) }
        "mousedown" {
          [SBI]::SetCursorPos([int]$c.x,[int]$c.y)
          if ($c.button -eq "right") { [SBI]::Mouse([SBI]::RD) }
          elseif ($c.button -eq "middle") { [SBI]::Mouse([SBI]::MD) }
          else { [SBI]::Mouse([SBI]::LD) }
        }
        "mouseup" {
          [SBI]::SetCursorPos([int]$c.x,[int]$c.y)
          if ($c.button -eq "right") { [SBI]::Mouse([SBI]::RU) }
          elseif ($c.button -eq "middle") { [SBI]::Mouse([SBI]::MU) }
          else { [SBI]::Mouse([SBI]::LU) }
        }
        "dblclick" {
          [SBI]::SetCursorPos([int]$c.x,[int]$c.y)
          [SBI]::Mouse([SBI]::LD); [SBI]::Mouse([SBI]::LU)
          Start-Sleep -Milliseconds 40
          [SBI]::Mouse([SBI]::LD); [SBI]::Mouse([SBI]::LU)
        }
        "scroll" {
          $d = [uint32]([int]($c.deltaY) * -12)
          [SBI]::Mouse([SBI]::WH, $d)
        }
        "keystroke" {
          $t = [string]$c.text
          $mods = @($c.modifiers)
          $prefix = ""
          if ($mods -contains "ctrl")  { $prefix += "^" }
          if ($mods -contains "alt")   { $prefix += "%" }
          if ($mods -contains "shift") { $prefix += "+" }
          $escaped = $t -replace '([+^%~(){}])', '{$1}'
          [System.Windows.Forms.SendKeys]::SendWait($prefix + $escaped)
        }
        "sendkey" {
          $k = [string]$c.key; $mods = @($c.modifiers); $prefix = ""
          if ($mods -contains "ctrl")  { $prefix += "^" }
          if ($mods -contains "alt")   { $prefix += "%" }
          if ($mods -contains "shift") { $prefix += "+" }
          [System.Windows.Forms.SendKeys]::SendWait($prefix + $k)
        }
      }
    } catch {}
  }
  `;
    try {
      fsMod.writeFileSync(scriptPath, psScript, "utf8");
      _winInputProc = spawn("powershell", [
        "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
      ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
      // Log PowerShell errors so VM/policy failures are visible in Electron logs
      _winInputProc.stderr.on("data", (d) => {
        const msg = d.toString().trim();
        if (msg) console.warn(`[WinInput] PS stderr: ${msg}`);
      });
      _winInputProc.stdout.on("data", (d) => {
        const msg = d.toString().trim();
        if (msg) console.log(`[WinInput] PS stdout: ${msg}`);
      });
      _winInputProc.on("error", (e) => { console.error(`[WinInput] spawn error: ${e.message}`); _winInputProc = null; });
      _winInputProc.on("exit",  (code) => { console.warn(`[WinInput] PS exited code=${code}`); _winInputProc = null; });
    } catch (e) { console.error(`[WinInput] failed to start: ${e.message}`); _winInputProc = null; }
    return _winInputProc;
  }

  function _executeOsInput({ type, x, y, button, deltaX, deltaY, text, keyCode, modifiers = [] }) {
    const platform = process.platform;

    if (platform === "darwin") {
      // Prompt for Accessibility permission the first time input is attempted
      if (!_darwinAccessChecked) {
        _darwinAccessChecked = true;
        try {
          const { systemPreferences } = require("electron");
          if (!systemPreferences.isTrustedAccessibilityClient(false)) {
            systemPreferences.isTrustedAccessibilityClient(true);
          }
        } catch {}
      }

      const { exec } = require("child_process");
      const modMap = { ctrl: "control down", meta: "command down", alt: "option down", shift: "shift down" };
      const modStr = modifiers.map(m => modMap[m]).filter(Boolean);
      const usingStr = modStr.length ? ` using {${modStr.join(", ")}}` : "";

      if (type === "mousemove") {
        if (_darwinMovePending) return;   // drop if previous move still executing
        _darwinMovePending = true;
        exec(`osascript -e 'tell application "System Events" to set the mouse location to {${x}, ${y}}'`,
          () => { _darwinMovePending = false; });
      } else if (type === "mousedown") {
        const btn = button === "right" ? "right click" : "click";
        exec(`osascript -e 'tell application "System Events" to ${btn} at {${x}, ${y}}'`);
      } else if (type === "mouseup") {
        // no-op: osascript click is already down+up in one command
      } else if (type === "dblclick") {
        exec(`osascript -e 'tell application "System Events" to double click at {${x}, ${y}}'`);
      } else if (type === "scroll") {
        // Use python3 + Quartz (pyobjc, built-in on macOS dev machines)
        const dy = Math.round((deltaY || 0) * -3);
        exec(`python3 -c "import Quartz;e=Quartz.CGEventCreateScrollWheelEvent(None,Quartz.kCGScrollEventUnitPixel,1,${dy});Quartz.CGEventPost(Quartz.kCGHIDEventTap,e)" 2>/dev/null`);
      } else if (type === "keystroke" && text) {
        const safe = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        exec(`osascript -e 'tell application "System Events" to keystroke "${safe}"${usingStr}'`);
      } else if (type === "keycode" && keyCode !== undefined) {
        exec(`osascript -e 'tell application "System Events" to key code ${keyCode}${usingStr}'`);
      }

    } else if (platform === "win32") {
      const proc = _getWinInputProc();

      // Primary path: persistent PS process via stdin (fast)
      if (proc && !proc.killed && proc.stdin.writable) {
        let cmd;
        if (type === "keycode" && keyCode !== undefined) {
          const winKey = _MAC_KC_TO_WIN_SENDKEY[keyCode];
          if (!winKey) return;
          cmd = { type: "sendkey", key: winKey, modifiers };
        } else {
          cmd = { type, x, y, button, deltaX, deltaY, text, modifiers };
        }
        try { proc.stdin.write(JSON.stringify(cmd) + "\n"); return; } catch {}
      }

      // Fallback: per-event powershell -Command (slower, works in restricted VM envs)
      const { exec } = require("child_process");
      if (type === "mousemove") {
        exec(`powershell -NoProfile -Command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x|0},${y|0})" -Args (Add-Type -AssemblyName System.Windows.Forms)`, { windowsHide: true });
      } else if (type === "mousedown" || type === "mouseup" || type === "dblclick") {
        // Use cursor move + click via WScript.Shell automation
        const clicks = type === "dblclick" ? 2 : 1;
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x|0},${y|0}); for($i=0;$i -lt ${clicks};$i++){[System.Windows.Forms.Application]::DoEvents()}"`, { windowsHide: true });
      } else if ((type === "keystroke" && text) || type === "sendkey") {
        const k = type === "sendkey" ? (keyCode !== undefined ? (_MAC_KC_TO_WIN_SENDKEY[keyCode] || "") : text) : text;
        if (k) exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${k.replace(/'/g, "''")}')"`, { windowsHide: true });
      }

    } else {
      // Linux: xdotool
      const { exec } = require("child_process");
      const xdoMod = modifiers.map(m =>
        m === "ctrl" ? "ctrl" : m === "meta" ? "super" : m === "alt" ? "alt" : "shift"
      ).join("+");
      if (type === "mousemove") {
        exec(`xdotool mousemove ${x} ${y}`);
      } else if (type === "mousedown") {
        const btn = button === "right" ? 3 : button === "middle" ? 2 : 1;
        exec(`xdotool mousemove ${x} ${y} mousedown ${btn}`);
      } else if (type === "mouseup") {
        const btn = button === "right" ? 3 : button === "middle" ? 2 : 1;
        exec(`xdotool mouseup ${btn}`);
      } else if (type === "dblclick") {
        exec(`xdotool mousemove ${x} ${y} click --repeat 2 1`);
      } else if (type === "scroll") {
        const btn = (deltaY || 0) > 0 ? 5 : 4;
        const cnt = Math.max(1, Math.round(Math.abs(deltaY || 0) / 50));
        exec(`xdotool click --repeat ${cnt} ${btn}`);
      } else if (type === "keystroke" && text) {
        exec(`xdotool type -- "${text.replace(/"/g, '\\"')}"`);
      } else if (type === "keycode" && keyCode !== undefined) {
        const k = _MAC_KC_TO_XDOTOOL[keyCode];
        if (k) exec(`xdotool key ${xdoMod ? xdoMod + "+" : ""}${k}`);
      }
    }
  }

  ipcMain.on("stardesk:send-input", (_, event) => _executeOsInput(event));

  // Map: viewerClientId → sender BrowserWindow (hidden, captures screen via getUserMedia)
  const _streamSenderWins = new Map();

  // Map: targetClientId → viewer BrowserWindow
  const _streamViewerWins = new Map();

  function _startStreamSender(viewerClientId) {
    if (_streamSenderWins.has(viewerClientId)) return;
    const win = new BrowserWindow({
      width: 1, height: 1, show: false,
      webPreferences: {
        nodeIntegration: true, contextIsolation: false,
        backgroundThrottling: false,   // belt-and-suspenders
      },
    });
    win.loadFile(path.join(__dirname, "stardesk-stream-sender.html"), {
      hash: encodeURIComponent(viewerClientId),
    });
    _streamSenderWins.set(viewerClientId, win);
    win.on("closed", () => _streamSenderWins.delete(viewerClientId));
  }

  function _stopStreamSender(viewerClientId) {
    _clearFrameAck(viewerClientId);  // unblock immediately on disconnect
    const win = _streamSenderWins.get(viewerClientId);
    if (win && !win.isDestroyed()) {
      win.webContents.send("stardesk:stop-capture");
      setTimeout(() => { try { win.close(); } catch {} }, 500);
    }
    _streamSenderWins.delete(viewerClientId);
  }

  // No-op stubs so will-quit cleanup still compiles
  function _stopCaptureTimer() {}

  /** Attach StarDesk stream socket handlers (called after socket is ready) */
  function _attachStarDeskStreamHandlers() {
    const socket = svc.getRemoteClient()?.socketClient?.socket;
    if (!socket) return;

    // Pre-warm Windows input process so it's ready when user starts controlling
    if (process.platform === "win32") _getWinInputProc();

    // Remove old listeners to avoid duplicates on reconnect
    socket.off("stardesk:stream:start");
    socket.off("stardesk:stream:stop");
    socket.off("stardesk:stream:input");
    socket.off("stardesk:stream:ready");
    socket.off("stardesk:stream:error");
    socket.off("stardesk:frame");

    // We're the TARGET: viewer wants to watch our screen
    socket.on("stardesk:stream:start", ({ viewer_client_id }) => {
      _startStreamSender(viewer_client_id);
    });
    socket.on("stardesk:stream:stop", ({ viewer_client_id }) => {
      _stopStreamSender(viewer_client_id);
    });
    // We're the TARGET: viewer sends input to us
    socket.on("stardesk:stream:input", (inputData) => {
      _executeOsInput(inputData);
    });

    // We're the VIEWER: target accepted our request
    socket.on("stardesk:stream:ready", ({ target_client_id }) => {
      const win = _streamViewerWins.get(target_client_id);
      if (win && !win.isDestroyed()) win.webContents.send("stardesk:viewer-ready");
    });
    socket.on("stardesk:stream:error", ({ reason }) => {
      for (const [, win] of _streamViewerWins) {
        if (!win.isDestroyed()) win.webContents.send("stardesk:viewer-error", { reason });
      }
    });

    // We're the VIEWER: frame from target arrives (pass all fields including error)
    socket.on("stardesk:frame", (payload) => {
      for (const [, win] of _streamViewerWins) {
        if (!win.isDestroyed()) win.webContents.send("stardesk:viewer-frame", payload);
      }
    });
  }

  // IPC: open remote viewer window for a target device
  ipcMain.handle("stardesk:open-remote-viewer", (_, { targetClientId, deviceName }) => {
    const existing = _streamViewerWins.get(targetClientId);
    if (existing && !existing.isDestroyed()) { existing.focus(); return { ok: true }; }

    const win = new BrowserWindow({
      width: 1200, height: 800, minWidth: 800, minHeight: 500,
      title: `StarDesk Remote – ${deviceName || targetClientId}`,
      backgroundColor: "#0d0b1a",
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    });
    win.loadFile(path.join(__dirname, "stardesk-remote-viewer.html"));
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("stardesk:viewer-init", {
        targetClientId,
        deviceName: deviceName || targetClientId,
      });
    });
    _streamViewerWins.set(targetClientId, win);
    win.on("closed", () => {
      _streamViewerWins.delete(targetClientId);
      svc.getRemoteClient()?.socketClient?.socket?.emit("stardesk:stream:stop", { target_client_id: targetClientId });
    });
    return { ok: true };
  });

  // IPC: viewer requests stream from target
  ipcMain.handle("stardesk:stream-request", (_, { targetClientId }) => {
    svc.getRemoteClient()?.socketClient?.socket?.emit("stardesk:stream:request", { target_client_id: targetClientId });
    return { ok: true };
  });

  // IPC: viewer sends input event to target
  ipcMain.on("stardesk:stream-input", (_, { targetClientId, ...inputData }) => {
    svc.getRemoteClient()?.socketClient?.socket?.emit("stardesk:stream:input", { target_client_id: targetClientId, ...inputData });
  });

  // Ack-based flow control: track in-flight frames per viewer.
  // Only one frame in-flight at a time → TCP buffer never accumulates → no latency drift.
  const _frameAckPending = new Map(); // viewerClientId → timer handle

  const FRAME_ACK_TIMEOUT_MS = 250;   // if server doesn't ack within 250ms, unblock anyway

  function _clearFrameAck(viewerClientId) {
    const t = _frameAckPending.get(viewerClientId);
    if (t) clearTimeout(t);
    _frameAckPending.delete(viewerClientId);
  }

  // IPC: sender BrowserWindow relays a captured frame
  ipcMain.on("stardesk:stream-frame", (_, { viewerClientId, data, w, h, sw, sh, error }) => {
    const socket = svc.getRemoteClient()?.socketClient?.socket;
    if (!socket?.connected) return;
    if (error) {
      socket.emit("stardesk:frame", { viewer_client_id: viewerClientId, error });
      return;
    }
    // Drop frame if still waiting for server ack on previous frame
    if (_frameAckPending.has(viewerClientId)) return;

    // Mark as pending; server will call ack() when it has forwarded the frame
    const timer = setTimeout(() => _frameAckPending.delete(viewerClientId), FRAME_ACK_TIMEOUT_MS);
    _frameAckPending.set(viewerClientId, timer);

    socket.compress(false).emit(
      "stardesk:frame",
      { viewer_client_id: viewerClientId, data, w, h, sw, sh },
      () => _clearFrameAck(viewerClientId),  // server ack callback
    );
  });

  ipcMain.handle("stardesk:connect-by-pin", async (_, { clientId, pin }) => {
    if (!clientId || !pin) return { ok: false, error: "clientId dan pin wajib diisi" };

    const serverUrl = process.env.STARBOX_REMOTE_URL ||
      (IS_DEV_BUILD ? "http://localhost:4200" : "https://starbox.weagate.com:4200");
    try {
      const headers = { "Content-Type": "application/json" };
      if (getAuthSession()?.token) headers.Authorization = `Bearer ${getAuthSession().token}`;
      const res = await fetch(`${serverUrl}/api/stardesk/connect-by-pin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ client_id: clientId, pin }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || `HTTP_${res.status}` };
      return data;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Sumber layar untuk stream StarDesk (dulu memakai channel StarCapture;
  // sekarang milik modul ini supaya StarDesk tidak bergantung pada StarCapture).
  ipcMain.handle("stardesk:get-screen-sources", async () => {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } });
    return sources.map((s) => ({ id: s.id, name: s.name }));
  });

  api.attachStreamHandlers = _attachStarDeskStreamHandlers;
}

module.exports = { register, api };
