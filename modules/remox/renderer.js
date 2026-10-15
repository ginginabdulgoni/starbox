// ═══════════════════════════════════════════════════════════════════════════════
// Modul Remox — sisi renderer (terminal SSH / Telnet berbasis xterm.js, RDP)
// Dimuat oleh core (module-host.js) setelah renderer.js. xterm.js dimuat dari
// CDN lewat manifest.rendererDeps / styleDeps. Komunikasi ke main process lewat
// window.electronAPI.modules (hanya channel yang dideklarasikan di manifest).
// ═══════════════════════════════════════════════════════════════════════════════

const remoxApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    loadConnections:  call("remox:load-connections"),
    saveConnection:   call("remox:save-connection"),
    deleteConnection: call("remox:delete-connection"),
    connect:          call("remox:connect"),
    sendData:         (opts) => m.send("remox:send-data", opts),
    resize:           (opts) => m.send("remox:resize", opts),
    disconnect:       call("remox:disconnect"),
    ping:             call("remox:ping"),
    launchRdp:        call("remox:launch-rdp"),
    cloudSync:        call("remox:cloud-sync"),
    pullFromCloud:    call("remox:pull-from-cloud"),
    onData:           (cb) => m.on("remox:data", cb),
    onStatus:         (cb) => m.on("remox:status", cb),
  };
})();

(function () {
  "use strict";

  // ─── State ───────────────────────────────────────────────────────────
  let rmxConnections = [];
  let rmxTabs = [];         // [{ id, connId, name, type, status, term, fitAddon }]
  let rmxActiveTab = null;  // tab id
  let rmxDataUnlisten = null;
  let rmxStatusUnlisten = null;
  let rmxInitialized = false;
  let rmxSearchQuery = "";
  const rmxTabDnD = { dragId: null, dropTargetId: null, dropPos: null, justDropped: false };
  // UUIDs yang dikonfirmasi ada di server setelah sync terakhir
  const rmxSyncedUuids = new Set();

  // ─── Ping cache ───────────────────────────────────────────────────────
  // connId -> { reachable, latency, ts }
  const rmxPingCache = new Map();
  const PING_TTL_MS = 3 * 60 * 1000; // 3 menit
  const RMX_QUICK_ACTIONS = {
    health: {
      label: "Health",
      command:
        "(command -v htop >/dev/null 2>&1 && htop) || (command -v btop >/dev/null 2>&1 && btop) || top",
    },
    uptime: {
      label: "Uptime",
      command: "uptime && who -b 2>/dev/null || last reboot | head -n 1",
    },
    disk: { label: "Disk", command: "df -h" },
    memory: {
      label: "Memory",
      command: "(command -v free >/dev/null 2>&1 && free -h) || vm_stat",
    },
    network: {
      label: "Network",
      command: "(command -v ip >/dev/null 2>&1 && ip a) || ifconfig",
    },
    services: {
      label: "Services",
      command:
        "(command -v systemctl >/dev/null 2>&1 && systemctl --failed --no-pager) || service --status-all",
    },
    logs: {
      label: "Logs",
      command:
        "(command -v journalctl >/dev/null 2>&1 && journalctl -xe --no-pager | tail -n 120) || tail -n 120 /var/log/syslog || tail -n 120 /var/log/messages",
    },
    docker: {
      label: "Docker",
      command:
        "(command -v docker >/dev/null 2>&1 && docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}') || docker ps",
    },
    ports: {
      label: "Ports",
      command:
        "(command -v ss >/dev/null 2>&1 && ss -tulpn) || (command -v netstat >/dev/null 2>&1 && netstat -tulpn) || lsof -i -P -n",
    },
    update: {
      label: "Update",
      command:
        "if command -v apt >/dev/null 2>&1; then sudo apt update; elif command -v dnf >/dev/null 2>&1; then sudo dnf check-update; elif command -v yum >/dev/null 2>&1; then sudo yum check-update; elif command -v apk >/dev/null 2>&1; then sudo apk update; elif command -v pacman >/dev/null 2>&1; then sudo pacman -Sy; else echo 'Package manager tidak dikenali'; fi",
    },
  };

  function rmxCloseSupportArtifacts() {
    const supportModal = document.getElementById("supportModal");
    if (supportModal) supportModal.style.display = "none";
  }

  function rmxSetQuickbarMenuOpen(open) {
    const menu = document.getElementById("rmxQuickbarMenu");
    const toggle = document.getElementById("rmxQuickbarToggle");
    if (!menu || !toggle) return;
    menu.classList.toggle("open", !!open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  window.rmxToggleQuickbarMenu = function (event) {
    event?.stopPropagation?.();
    const menu = document.getElementById("rmxQuickbarMenu");
    if (!menu) return;
    rmxSetQuickbarMenuOpen(!menu.classList.contains("open"));
  };

  function rmxHasBlockingOverlayOpen() {
    const supportModal = document.getElementById("supportModal");
    const remoxModal = document.getElementById("rmxModal");
    const tabModal = document.getElementById("rmxTabModal");
    return Boolean(
      (supportModal && supportModal.style.display === "flex") ||
      (remoxModal && remoxModal.style.display === "flex") ||
      (tabModal && tabModal.classList.contains("open"))
    );
  }

  function rmxGetActiveTerminalTab() {
    return rmxTabs.find(
      (tab) =>
        tab.id === rmxActiveTab &&
        tab.type !== "rdp" &&
        tab.status === "connected"
    ) || null;
  }

  function rmxFocusActiveTerminal() {
    const tab = rmxTabs.find((item) => item.id === rmxActiveTab);
    tab?.term?.focus();
  }

  function rmxRestoreActiveTerminal(forceFocus = false) {
    if (window.currentActivePage !== "remox") return;
    const activeTab = rmxGetActiveTerminalTab();
    if (!activeTab) return;

    const runRestore = () => {
      try {
        activeTab.fitAddon?.fit?.();
      } catch (_) {}
      try {
        remoxApi.resize({
          sessionId: activeTab.id,
          cols: activeTab.term?.cols,
          rows: activeTab.term?.rows,
        });
      } catch (_) {}
      if (forceFocus) {
        try {
          activeTab.term?.focus();
        } catch (_) {}
      }
    };

    runRestore();
    setTimeout(runRestore, 60);
    setTimeout(runRestore, 180);
  }

  function rmxSendActiveCommand(command) {
    const activeTab = rmxGetActiveTerminalTab();
    if (!activeTab || !remoxApi.sendData) {
      Swal.fire({
        icon: "info",
        title: "Sesi terminal belum aktif",
        text: "Buka sesi SSH atau Telnet yang sudah terhubung terlebih dahulu.",
        customClass: {
          popup: "theme-aware-swal",
          container: "swal-on-top",
        },
      });
      return false;
    }

    const payload = String(command || "").endsWith("\r")
      ? String(command)
      : `${String(command)}\r`;
    activeTab.term?.focus();
    remoxApi.sendData({ sessionId: activeTab.id, data: payload });
    return true;
  }

  window.rmxRunQuickAction = function (key) {
    const action = RMX_QUICK_ACTIONS[key];
    if (!action) return;
    rmxSetQuickbarMenuOpen(false);
    rmxCloseSupportArtifacts();
    rmxSendActiveCommand(action.command);
  };

  window.rmxShowShortcutHelp = function () {
    rmxSetQuickbarMenuOpen(false);
    const rows = [
      ["Ctrl/Cmd + Shift + 1", "Health monitor (`htop` / `btop` / `top`)"],
      ["Ctrl/Cmd + Shift + 2", "Disk usage (`df -h`)"],
      ["Ctrl/Cmd + Shift + 3", "Memory usage (`free -h` / `vm_stat`)"],
      ["Ctrl/Cmd + Shift + 4", "Network info (`ip a` / `ifconfig`)"],
      ["Ctrl/Cmd + Shift + 5", "Failed services"],
      ["Ctrl/Cmd + Shift + 6", "Recent logs"],
      ["Ctrl/Cmd + Shift + 7", "Docker status"],
      ["Ctrl/Cmd + Shift + 8", "Package update check"],
      ["Ctrl/Cmd + Shift + 9", "Uptime & reboot info"],
      ["Ctrl/Cmd + Shift + 0", "Listening ports"],
      ["Ctrl/Cmd + Shift + K", "Focus terminal aktif"],
      ["Ctrl/Cmd + Shift + /", "Buka bantuan shortcut"],
    ];

    Swal.fire({
      title: "Shortcut Remox",
      html: `
        <div style="text-align:left;font-size:13px;line-height:1.7">
          ${rows.map(([keys, desc]) => `
            <div style="display:flex;justify-content:space-between;gap:14px;padding:6px 0;border-bottom:1px solid rgba(148,163,184,0.16);">
              <strong style="white-space:nowrap">${keys}</strong>
              <span style="text-align:right">${desc}</span>
            </div>
          `).join("")}
        </div>
      `,
      width: 720,
      confirmButtonText: "Tutup",
      customClass: {
        popup: "theme-aware-swal",
        confirmButton: "btn-primary",
        container: "swal-on-top",
      },
    });
  };

  document.addEventListener("keydown", (event) => {
    if (window.currentActivePage !== "remox") return;
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return;
    if (rmxHasBlockingOverlayOpen()) return;

    const target = event.target;
    const tagName = target?.tagName?.toLowerCase?.() || "";
    const isEditing =
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target?.isContentEditable;
    if (isEditing) return;

    const quickActionMap = {
      "1": "health",
      "2": "disk",
      "3": "memory",
      "4": "network",
      "5": "services",
      "6": "logs",
      "7": "docker",
      "8": "update",
      "9": "uptime",
      "0": "ports",
    };

    if (quickActionMap[event.key]) {
      event.preventDefault();
      window.rmxRunQuickAction(quickActionMap[event.key]);
      return;
    }

    if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      rmxFocusActiveTerminal();
      return;
    }

    if (event.key === "/" || event.key === "?") {
      event.preventDefault();
      window.rmxShowShortcutHelp();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".rmx-quickbar-dropdown")) {
      rmxSetQuickbarMenuOpen(false);
    }
  });

  window.addEventListener("focus", () => {
    if (window.currentActivePage !== "remox") return;
    rmxCloseSupportArtifacts();
    rmxRestoreActiveTerminal(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (window.currentActivePage !== "remox") return;
    rmxRestoreActiveTerminal(true);
  });

  // ─── Init ─────────────────────────────────────────────────────────────
  // Expose active session count and refit helper for Resource Monitor
  window.rmxGetActiveCount = function () {
    return rmxTabs.filter(t => t.status === 'connected').length;
  };

  // Expose search setter so inline oninput="" can reach the IIFE variable
  window.rmxSetSearch = function (q) {
    rmxSearchQuery = q;
    rmxRefreshSidebar();
  };

  function rmxRefitActive() {
    rmxRenderTabs();
    if (rmxActiveTab) {
      const tab = rmxTabs.find(t => t.id === rmxActiveTab);
      if (tab?.fitAddon) setTimeout(() => { tab.fitAddon.fit(); tab.term?.focus(); }, 60);
    }
  }

  window.initRemoxPage = async function () {
    rmxCloseSupportArtifacts();
    const firstInit = !rmxInitialized;
    rmxInitialized = true;

    // Subscribe to IPC events
    if (firstInit && remoxApi) {
      rmxDataUnlisten = remoxApi.onData(({ sessionId, data }) => {
        const tab = rmxTabs.find((t) => t.id === sessionId);
        if (tab?.term) tab.term.write(data);
      });
      rmxStatusUnlisten = remoxApi.onStatus(({ sessionId, status, message }) => {
        const tab = rmxTabs.find((t) => t.id === sessionId);
        if (!tab) return;
        tab.status = status;
        rmxRenderTabs();
        if (status === "disconnected") {
          tab.term?.write(`\r\n\x1b[33m[Terputus${message ? ": " + message : ""}]\x1b[0m\r\n`);
        }
      });
    }

    rmxSetLayout(rmxCurrentLayout);
    await rmxCheckCloudAccess();
    await rmxLoadConnections();
    rmxUpdateWorkspaceLayout();
    if (firstInit) rmxScheduleAutoSync(); // mulai auto-sync setiap 5 menit

    // Jika lokal kosong dan user sudah login, otomatis tarik dari server
    if (rmxConnections.length === 0) {
      await window.rmxPullCloud(true);
    }
    rmxRefitActive();
  };

  async function rmxLoadConnections() {
    if (!remoxApi) return;
    try {
      const loaded = await remoxApi.loadConnections();
      rmxConnections = Array.isArray(loaded) ? loaded : [];
    } catch (err) {
      console.warn("Gagal memuat koneksi Remox:", err?.message || err);
      rmxConnections = [];
    }
    rmxRefreshSidebar();
    rmxPingAll();
  }

  /**
   * Navigasi ke Remox, tunggu koneksi dimuat, lalu auto-connect ke connectionId.
   * Dipanggil dari halaman lain (misal MikroTik).
   */
  window.rmxConnectById = async function (connectionId) {
    await switchPage("remox");
    // Tunggu initRemoxPage selesai (max 3 detik)
    let waited = 0;
    await new Promise((resolve) => {
      const check = () => {
        if (rmxInitialized || waited >= 3000) return resolve();
        waited += 80;
        setTimeout(check, 80);
      };
      check();
    });
    // Reload koneksi agar koneksi MikroTik yang baru tersimpan juga terbaca
    await rmxLoadConnections();
    window.rmxConnectOrFocus?.(connectionId);
  };

  // ─── Groups ───────────────────────────────────────────────────────────
  const rmxCollapsedGroups = new Set();

  function rmxGetGroups() {
    // Returns ordered unique group names (case-insensitive).
    const byKey = new Map();
    rmxConnections.forEach((c) => {
      const g = String(c.group || "").trim();
      if (!g) return;
      const key = g.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, g);
    });
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" }));
  }

  function rmxUpdateGroupDatalist(selectedValue = "") {
    const groupSelect = document.getElementById("rmxFormGroup");
    const groups = rmxGetGroups();

    if (groupSelect) {
      groupSelect.innerHTML = "";
      const frag = document.createDocumentFragment();

      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "Tanpa group";
      frag.appendChild(emptyOpt);

      // Jika value saat ini tidak ada di daftar group terbaru, tetap tampilkan agar tidak hilang saat edit.
      const selected = String(selectedValue || "").trim();
      if (selected && !groups.some((g) => g.toLowerCase() === selected.toLowerCase())) {
        const customOpt = document.createElement("option");
        customOpt.value = selected;
        customOpt.textContent = selected;
        frag.appendChild(customOpt);
      }

      groups.forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        frag.appendChild(opt);
      });
      groupSelect.appendChild(frag);
      groupSelect.value = selected || "";
    }
  };

  window.rmxAddNewGroup = async function () {
    const { value: newGroup } = await Swal.fire({
      title: "Buat Grup Baru",
      input: "text",
      inputLabel: "Nama Grup",
      inputPlaceholder: "Contoh: Server Kantor",
      showCancelButton: true,
      confirmButtonText: "Buat & Pilih",
      cancelButtonText: "Batal",
      customClass: {
        popup: 'theme-aware-swal',
        confirmButton: 'btn-primary',
        cancelButton: 'btn-secondary',
        container: 'swal-on-top'
      },
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "Nama grup tidak boleh kosong!";
        }
      },
    });

    if (newGroup) {
      const groupSelect = document.getElementById("rmxFormGroup");
      const trimmedGroup = newGroup.trim();

      // Cek jika grup sudah ada (case-insensitive)
      const exists = Array.from(groupSelect.options).some(
        (opt) => opt.value.toLowerCase() === trimmedGroup.toLowerCase()
      );

      if (!exists) {
        const newOption = document.createElement("option");
        newOption.value = trimmedGroup;
        newOption.textContent = trimmedGroup;
        groupSelect.appendChild(newOption);
      }

      groupSelect.value = trimmedGroup;
    }
  };

  function rmxToggleGroup(groupName) {
    if (rmxCollapsedGroups.has(groupName)) rmxCollapsedGroups.delete(groupName);
    else rmxCollapsedGroups.add(groupName);
    rmxRefreshSidebar();
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────
  function rmxConnItemHTML(c) {
    const activeTab = rmxTabs.find((t) => t.connId === c.id && t.status !== "disconnected");
    const isActive = !!activeTab;
    const isRdp = c.type === "rdp";
    const ping = isRdp ? null : rmxPingCache.get(c.id);
    let pingClass = "", pingLabel = "–", pingTitle = "Klik untuk ping";
    if (isRdp) {
      pingClass = ""; pingLabel = "RDP"; pingTitle = "RDP";
    } else if (ping) {
      if (ping.checking) { pingClass = "checking"; pingLabel = "..."; }
      else if (ping.reachable) { pingClass = "ok"; pingLabel = ping.latency + "ms"; }
      else { pingClass = "fail"; pingLabel = "Gagal"; }
      pingTitle = `Dicek ${rmxTimeAgo(ping.ts)} lalu`;
    }
    // ── Cloud sync status ──────────────────────────────────────────
    const isExcluded = c.sync_cloud === false;
    const isSynced   = !isExcluded && rmxSyncedUuids.has(c.id);
    const cloudState = isExcluded ? "excluded" : isSynced ? "synced" : "pending";
    const cloudIcon  = isExcluded
      ? "bi-cloud-slash-fill"
      : isSynced ? "bi-cloud-check-fill" : "bi-cloud-arrow-up-fill";
    const cloudTitle = isExcluded
      ? "Tidak disinkron ke cloud — klik untuk aktifkan sinkron"
      : isSynced
        ? "✅ Tersinkron ke cloud Starbox — klik untuk nonaktifkan sinkron"
        : "⏳ Belum disinkron ke cloud — klik untuk nonaktifkan sinkron";

    return `<div class="rmx-conn-item${isActive ? " active" : ""}" onclick="rmxConnectOrFocus('${c.id}')">
      <div class="rmx-conn-icon ${c.type}">
        <i class="bi bi-${c.type === "ssh" ? "shield-lock" : c.type === "rdp" ? "display" : "terminal"}"></i>
      </div>
      <div class="rmx-conn-info">
        <div class="rmx-conn-head">
          <div class="rmx-conn-name">${rmxEsc(c.name)}</div>
          <div class="rmx-conn-actions" style="opacity:0">
            <button class="rmx-conn-btn" onclick="event.stopPropagation();rmxOpenEditModal('${c.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="rmx-conn-btn danger" onclick="event.stopPropagation();rmxDeleteConnection('${c.id}')" title="Hapus"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div class="rmx-conn-meta">${rmxEsc(c.type.toUpperCase())} · ${rmxEsc(c.host)}:${c.port}</div>
      </div>
      <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
        <span class="rmx-cloud-dot ${cloudState}" title="${cloudTitle}"
          onclick="event.stopPropagation();rmxToggleSyncCloud('${c.id}')">
          <i class="bi ${cloudIcon}"></i>
        </span>
        <span class="rmx-ping-badge ${pingClass}" title="${pingTitle}"
          onclick="event.stopPropagation();${isRdp ? "" : "rmxPingOne('" + c.id + "')"}">
          <span class="rmx-ping-dot"></span>${rmxEsc(pingLabel)}
        </span>
      </div>
    </div>`;
  }

  function rmxRefreshSidebar() {
    const list = document.getElementById("rmxConnList");
    if (!list) return;

    // Filter connections by search query (name, host, group, type)
    const q = rmxSearchQuery.toLowerCase();
    const filtered = q
      ? rmxConnections.filter(c =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.host || "").toLowerCase().includes(q) ||
          (c.group || "").toLowerCase().includes(q) ||
          (c.type || "").toLowerCase().includes(q) ||
          String(c.port || "").includes(q) ||
          (c.username || "").toLowerCase().includes(q)
        )
      : rmxConnections;

    if (!filtered.length) {
      list.innerHTML = q
        ? `<div class="rmx-conn-empty">Tidak ada koneksi cocok untuk "<strong>${rmxEsc(q)}</strong>".</div>`
        : `<div class="rmx-conn-empty">Belum ada koneksi tersimpan.</div>`;
      rmxUpdateGroupDatalist();
      return;
    }

    const namedGroups = [...new Set(filtered.map(c => (c.group || "").trim()).filter(Boolean))];
    const ungrouped   = filtered.filter(c => !(c.group || "").trim());
    let html = "";

    // Named groups
    namedGroups.forEach(g => {
      const members  = filtered.filter(c => (c.group || "").trim() === g);
      const collapsed = rmxCollapsedGroups.has(g);
      html += `<div class="rmx-group-header${collapsed ? " collapsed" : ""}"
        onclick="rmxToggleGroup('${rmxEsc(g)}')">
        <i class="bi bi-chevron-down rmx-group-arrow"></i>
        <i class="bi bi-folder2" style="font-size:11px;opacity:0.7"></i>
        ${rmxEsc(g)}
        <span class="rmx-group-count">${members.length}</span>
      </div>`;
      html += `<div class="rmx-group-items${collapsed ? " hidden" : ""}">`;
      members.forEach(c => { html += rmxConnItemHTML(c); });
      html += `</div>`;
    });

    // Ungrouped (no header if all connections are ungrouped)
    if (ungrouped.length) {
      if (namedGroups.length) {
        const collapsed = rmxCollapsedGroups.has("__ungrouped__");
        html += `<div class="rmx-group-header${collapsed ? " collapsed" : ""}"
          onclick="rmxToggleGroup('__ungrouped__')">
          <i class="bi bi-chevron-down rmx-group-arrow"></i>
          <i class="bi bi-hdd-network" style="font-size:11px;opacity:0.7"></i>
          Tanpa Grup
          <span class="rmx-group-count">${ungrouped.length}</span>
        </div>`;
        html += `<div class="rmx-group-items${collapsed ? " hidden" : ""}">`;
        ungrouped.forEach(c => { html += rmxConnItemHTML(c); });
        html += `</div>`;
      } else {
        ungrouped.forEach(c => { html += rmxConnItemHTML(c); });
      }
    }

    list.innerHTML = html;
    const isDetailLayout = document.getElementById('rmxSidebar')?.classList.contains('layout-detail');
    list.querySelectorAll(".rmx-conn-item").forEach((el) => {
      const actions = el.querySelector(".rmx-conn-actions");
      if (actions) actions.style.opacity = isDetailLayout ? "1" : "0";
      el.addEventListener("mouseenter", () => {
        if (!actions) return;
        actions.style.opacity = "1";
      });
      el.addEventListener("mouseleave", () => {
        if (!actions) return;
        actions.style.opacity = isDetailLayout ? "1" : "0";
      });
    });
    rmxUpdateGroupDatalist();
  }
  // Expose for inline onclick handlers inside dynamically generated HTML
  window.rmxRefreshSidebar = rmxRefreshSidebar;
  window.rmxToggleGroup = function (g) {
    if (rmxCollapsedGroups.has(g)) rmxCollapsedGroups.delete(g);
    else rmxCollapsedGroups.add(g);
    rmxRefreshSidebar();
  };

  // ─── Ping ─────────────────────────────────────────────────────────────
  async function rmxPingOne(connId) {
    const conn = rmxConnections.find((c) => c.id === connId);
    if (!conn || !remoxApi.ping || conn.type === "rdp") return;
    rmxPingCache.set(connId, { checking: true, ts: Date.now() });
    rmxRefreshSidebar();
    const res = await remoxApi.ping({ host: conn.host, port: conn.port });
    rmxPingCache.set(connId, { reachable: res.reachable, latency: res.latency, ts: Date.now() });
    rmxRefreshSidebar();
  }

  async function rmxPingAll() {
    if (!rmxConnections.length || !remoxApi.ping) return;
    const now = Date.now();
    // Only ping connections whose cache is expired or missing
    const toPing = rmxConnections.filter((c) => {
      if (c.type === "rdp") return false; // RDP: skip ping, firewall sering blokir TCP probe
      const cached = rmxPingCache.get(c.id);
      return !cached || (!cached.checking && now - cached.ts > PING_TTL_MS);
    });
    if (!toPing.length) return;
    toPing.forEach((c) => rmxPingCache.set(c.id, { checking: true, ts: now }));
    rmxRefreshSidebar();
    await Promise.all(toPing.map(async (c) => {
      const res = await remoxApi.ping({ host: c.host, port: c.port });
      rmxPingCache.set(c.id, { reachable: res.reachable, latency: res.latency, ts: Date.now() });
    }));
    rmxRefreshSidebar();
  }

  function rmxTimeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + "d";
    return Math.floor(s / 60) + "m";
  }

  // Expose ping for inline onclick in generated HTML
  window.rmxPingOne = rmxPingOne;

  // ─── Toggle cloud sync per connection ────────────────────────────────
  window.rmxToggleSyncCloud = async function (connId) {
    const conn = rmxConnections.find(c => c.id === connId);
    if (!conn || !remoxApi.saveConnection) return;
    const updated = { ...conn, sync_cloud: conn.sync_cloud === false ? true : false };
    try {
      const saved = await remoxApi.saveConnection(updated);
      const idx = rmxConnections.findIndex(c => c.id === connId);
      if (idx >= 0) rmxConnections[idx] = saved;
      // Kalau dinonaktifkan, hapus dari synced set
      if (saved.sync_cloud === false) rmxSyncedUuids.delete(connId);
      rmxRefreshSidebar();
    } catch (e) { console.error("rmxToggleSyncCloud:", e); }
  };

  // ─── Cloud Sync ───────────────────────────────────────────────────────
  let rmxAutoSyncTimer = null;
  const RMX_AUTO_SYNC_MS = 5 * 60 * 1000; // 5 menit

  function rmxScheduleAutoSync() {
    if (rmxAutoSyncTimer) clearInterval(rmxAutoSyncTimer);
    rmxAutoSyncTimer = setInterval(async () => {
      if (!remoxApi.cloudSync) return;
      const btn = document.getElementById("rmxSyncBtn");
      if (btn) btn.classList.add("syncing");
      try {
        await window.rmxSyncCloud(true); // silent auto-sync
      } catch (_) {}
      if (btn) btn.classList.remove("syncing");
    }, RMX_AUTO_SYNC_MS);
  }

  window.rmxSyncCloud = async function (silent = false) {
    const btn = document.getElementById("rmxSyncBtn");
    const quota = document.getElementById("rmxQuotaBadge");
    if (!remoxApi.cloudSync) {
      if (!silent) alert("Fitur sinkron tidak tersedia di versi ini.");
      return;
    }
    if (btn) { btn.classList.add("syncing"); btn.disabled = true; }
    try {
      const res = await remoxApi.cloudSync();
      if (res.success) {
        rmxConnections = res.connections;

        // Tandai UUIDs yang dikonfirmasi ada di server
        rmxSyncedUuids.clear();
        (res.syncedUuids || []).forEach(id => rmxSyncedUuids.add(id));

        rmxRefreshSidebar();
        rmxPingAll();
        const time = new Date().toLocaleTimeString();
        if (btn) btn.title = "Tersinkron: " + time;

        // Tampilkan info quota dari server
        if (quota) {
          if (res.limit !== null && res.limit !== undefined) {
            quota.textContent = `${res.count}/${res.limit}`;
            quota.title = `Tersimpan di cloud: ${res.count} dari ${res.limit} koneksi`;
            quota.style.display = "";
            quota.className = "rmx-quota-badge" + (res.count >= res.limit ? " full" : "");
          } else {
            quota.style.display = "none"; // unlimited, tidak perlu tampil
          }
        }

        if (!silent && res.skipped > 0) {
          alert(`⚠️ ${res.skipped} koneksi tidak tersimpan ke cloud karena melebihi batas paket (${res.limit} koneksi).\n\nKoneksi di lokal tetap tersimpan semua.`);
        }
      } else {
        if (!silent) alert("Sinkron gagal: " + (res.error || "Unknown error"));
      }
    } catch (e) {
      if (!silent) alert("Sinkron error: " + e.message);
    } finally {
      if (btn) { btn.classList.remove("syncing"); btn.disabled = false; }
    }
  };

  // ─── Pull from Cloud (server → lokal) ────────────────────────────────
  window.rmxPullCloud = async function (silent = false) {
    const btn = document.getElementById("rmxPullBtn");
    if (!remoxApi.pullFromCloud) {
      if (!silent) alert("Fitur ini tidak tersedia di versi ini.");
      return;
    }
    if (btn) { btn.classList.add("syncing"); btn.disabled = true; }
    try {
      const res = await remoxApi.pullFromCloud();
      if (res.success) {
        rmxConnections = res.connections;
        rmxSyncedUuids.clear();
        res.connections.filter(c => c.sync_cloud).forEach(c => rmxSyncedUuids.add(c.id));
        rmxRefreshSidebar();
        rmxPingAll();
        if (btn) btn.title = "Ditarik: " + new Date().toLocaleTimeString();

        // Update quota badge
        const quota = document.getElementById("rmxQuotaBadge");
        if (quota && res.limit !== null && res.limit !== undefined) {
          quota.textContent = `${res.count}/${res.limit}`;
          quota.style.display = "";
          quota.className = "rmx-quota-badge" + (res.count >= res.limit ? " full" : "");
        }

        if (!silent && res.count > 0) {
          alert(`✅ Berhasil menarik ${res.count} koneksi dari server.`);
        }
      } else {
        if (!silent) alert("Gagal tarik dari server: " + (res.error || "Unknown error"));
      }
    } catch (e) {
      if (!silent) alert("Error: " + e.message);
    } finally {
      if (btn) { btn.classList.remove("syncing"); btn.disabled = false; }
    }
  };

  // ─── Tab connect modal ────────────────────────────────────────────────
  window.rmxOpenTabModal = function () {
    const body = document.getElementById("rmxTabModalBody");
    if (!body) return;
    if (!rmxConnections.length) {
      body.innerHTML = `<div class="rmx-tab-modal-empty">Belum ada koneksi tersimpan.<br>Klik <strong>+</strong> di sidebar untuk menambah.</div>`;
    } else {
      const namedGroups = rmxGetGroups();
      const ungrouped   = rmxConnections.filter(c => !(c.group || "").trim());
      let html = "";
      const itemHTML = (c) => {
        const ping = rmxPingCache.get(c.id);
        const dotColor = !ping ? "#444" : ping.checking ? "#f0a040" : ping.reachable ? "#50c878" : "#e87070";
        const latency  = ping?.reachable ? ping.latency + "ms" : "";
        return `<div class="rmx-tab-modal-item" onclick="rmxCloseTabModal();rmxConnectOrFocus('${c.id}')">
          <div class="rmx-conn-icon ${c.type}" style="width:28px;height:28px;font-size:12px;border-radius:6px;flex-shrink:0">
            <i class="bi bi-${c.type === "ssh" ? "shield-lock" : c.type === "rdp" ? "display" : "terminal"}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div class="rmx-tmi-name">${rmxEsc(c.name)}</div>
            <div class="rmx-tmi-meta">${rmxEsc(c.type.toUpperCase())} · ${rmxEsc(c.host)}:${c.port}</div>
          </div>
          <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;${latency ? "box-shadow:0 0 4px " + dotColor + "88" : ""}" title="${latency}"></span>
        </div>`;
      };
      namedGroups.forEach(g => {
        html += `<div class="rmx-tab-modal-group-label"><i class="bi bi-folder2" style="margin-right:4px;opacity:0.7"></i>${rmxEsc(g)}</div>`;
        rmxConnections.filter(c => (c.group || "").trim() === g).forEach(c => { html += itemHTML(c); });
      });
      if (ungrouped.length) {
        if (namedGroups.length) html += `<div class="rmx-tab-modal-group-label"><i class="bi bi-hdd-network" style="margin-right:4px;opacity:0.7"></i>Tanpa Grup</div>`;
        ungrouped.forEach(c => { html += itemHTML(c); });
      }
      body.innerHTML = html;
    }
    document.getElementById("rmxTabModal").classList.add("open");
  };

  window.rmxCloseTabModal = function () {
    document.getElementById("rmxTabModal")?.classList.remove("open");
  };

  // Close on backdrop click
  document.getElementById("rmxTabModal")?.addEventListener("click", function(e) {
    if (e.target === this) rmxCloseTabModal();
  });

  // ─── Tabs ─────────────────────────────────────────────────────────────
  // ─── Sidebar resize ───────────────────────────────────────────────────
  const RMX_SIDEBAR_MIN = 160;
  const RMX_SIDEBAR_MAX = 520;
  const RMX_SIDEBAR_DEFAULT = 240;

  (function rmxInitResize() {
    const handle = document.getElementById('rmxResizeHandle');
    const sidebar = document.getElementById('rmxSidebar');
    if (!handle || !sidebar) return;

    // Restore saved width
    const saved = parseInt(localStorage.getItem('rmx-sidebar-w'));
    if (saved && saved >= RMX_SIDEBAR_MIN && saved <= RMX_SIDEBAR_MAX) {
      sidebar.style.width = saved + 'px';
    }

    let startX = 0, startW = 0, dragging = false;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const newW = Math.min(RMX_SIDEBAR_MAX, Math.max(RMX_SIDEBAR_MIN, startW + (e.clientX - startX)));
      sidebar.style.width = newW + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem('rmx-sidebar-w', sidebar.offsetWidth); } catch (_) {}
      // Refit active terminal after resize
      if (rmxActiveTab) {
        const tab = rmxTabs.find(t => t.id === rmxActiveTab);
        if (tab?.fitAddon) setTimeout(() => tab.fitAddon.fit(), 50);
      }
    });

    // Double-click to reset to default width
    handle.addEventListener('dblclick', () => {
      sidebar.style.width = RMX_SIDEBAR_DEFAULT + 'px';
      try { localStorage.setItem('rmx-sidebar-w', RMX_SIDEBAR_DEFAULT); } catch (_) {}
      if (rmxActiveTab) {
        const tab = rmxTabs.find(t => t.id === rmxActiveTab);
        if (tab?.fitAddon) setTimeout(() => tab.fitAddon.fit(), 50);
      }
    });
  })();

  // ─── Layout & workspace state ──────────────────────────────────────────
  let rmxCurrentLayout = (typeof localStorage !== 'undefined' && localStorage.getItem('rmx-layout')) || 'compact';

  function rmxUpdateWorkspaceLayout() {
    const workspace = document.querySelector('.rmx-workspace');
    if (!workspace) return;
    if (rmxTabs.length === 0) workspace.classList.add('no-tabs');
    else workspace.classList.remove('no-tabs');
  }

  window.rmxSetLayout = function (mode) {
    rmxCurrentLayout = mode;
    try { localStorage.setItem('rmx-layout', mode); } catch (_) {}
    const sidebar = document.getElementById('rmxSidebar');
    if (!sidebar) return;
    if (mode === 'detail') {
      sidebar.classList.add('layout-detail');
      document.getElementById('rmxLayoutDetailBtn')?.classList.add('active');
      document.getElementById('rmxLayoutCompactBtn')?.classList.remove('active');
    } else {
      sidebar.classList.remove('layout-detail');
      document.getElementById('rmxLayoutCompactBtn')?.classList.add('active');
      document.getElementById('rmxLayoutDetailBtn')?.classList.remove('active');
    }
    // Re-render agar state hover/action mengikuti mode baru.
    rmxRefreshSidebar();
  };

  // ─── Cloud access check ────────────────────────────────────────────────
  async function rmxCheckCloudAccess() {
    const pullBtn   = document.getElementById('rmxPullBtn');
    const syncBtn   = document.getElementById('rmxSyncBtn');
    const quotaBadge = document.getElementById('rmxQuotaBadge');
    const banner    = document.getElementById('rmxCloudBanner');
    const bannerText    = document.getElementById('rmxCloudBannerText');
    const loginBtn  = document.getElementById('rmxCloudBannerLoginBtn');
    const upgradeBtn = document.getElementById('rmxCloudBannerUpgradeBtn');

    let session = null;
    try {
      if (window.electronAPI?.auth?.getSession) session = await window.electronAPI.auth.getSession();
    } catch (_) {}

    const isLoggedIn = !!(session?.isLoggedIn);
    const hasPkg     = isLoggedIn && (session?.package !== null && session?.package !== undefined);

    if (!isLoggedIn) {
      if (pullBtn)  pullBtn.style.display  = 'none';
      if (syncBtn)  syncBtn.style.display  = 'none';
      if (quotaBadge) quotaBadge.style.display = 'none';
      if (banner) { banner.style.display = 'flex'; banner.className = 'rmx-cloud-banner'; }
      if (bannerText) bannerText.textContent = 'Login terlebih dahulu untuk menggunakan sinkronisasi cloud.';
      if (loginBtn)   loginBtn.style.display   = '';
      if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else if (!hasPkg) {
      if (pullBtn)  pullBtn.style.display  = 'none';
      if (syncBtn)  syncBtn.style.display  = 'none';
      if (quotaBadge) quotaBadge.style.display = 'none';
      if (banner) { banner.style.display = 'flex'; banner.className = 'rmx-cloud-banner warn'; }
      if (bannerText) bannerText.textContent = 'Sinkronisasi cloud hanya tersedia untuk paket berlangganan.';
      if (loginBtn)   loginBtn.style.display   = 'none';
      if (upgradeBtn) upgradeBtn.style.display = '';
    } else {
      if (pullBtn)  pullBtn.style.display  = '';
      if (syncBtn)  syncBtn.style.display  = '';
      if (banner)   banner.style.display   = 'none';
    }
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────
  function rmxClearTabDropMarks() {
    const tabsEl = document.getElementById("rmxTabs");
    if (!tabsEl) return;
    tabsEl.querySelectorAll(".rmx-tab.drop-before, .rmx-tab.drop-after").forEach((el) => {
      el.classList.remove("drop-before", "drop-after");
    });
  }

  function rmxReorderTabs(dragId, targetId, position = "before") {
    const from = rmxTabs.findIndex((t) => t.id === dragId);
    const to = rmxTabs.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0 || from === to) return;

    const [moved] = rmxTabs.splice(from, 1);
    const targetNow = rmxTabs.findIndex((t) => t.id === targetId);
    const insertAt = position === "after" ? targetNow + 1 : targetNow;
    rmxTabs.splice(Math.max(0, insertAt), 0, moved);
  }

  function rmxRenderTabs() {
    // Preserve the + button; only update session tabs
    const tabsEl = document.getElementById("rmxTabs");
    if (!tabsEl) return;
    // Remove existing session tabs (keep .rmx-tab-add and .rmx-tab-dropdown)
    tabsEl.querySelectorAll(".rmx-tab").forEach((el) => el.remove());
    // Insert tabs before the + button
    const addBtn = document.getElementById("rmxTabAddBtn");
    rmxTabs.forEach((t) => {
      const dotClass = t.status === "connected" ? "connected"
        : t.status === "connecting" ? "connecting"
        : t.status === "error" ? "error" : "";
      const div = document.createElement("div");
      div.className = "rmx-tab" + (t.id === rmxActiveTab ? " active" : "");
      div.dataset.tabId = t.id;
      div.draggable = true;
      div.onclick = () => {
        if (rmxTabDnD.justDropped) {
          rmxTabDnD.justDropped = false;
          return;
        }
        rmxSetActiveTab(t.id);
      };
      div.addEventListener("dragstart", (e) => {
        rmxTabDnD.dragId = t.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        setTimeout(() => div.classList.add("dragging"), 0);
      });
      div.addEventListener("dragend", () => {
        div.classList.remove("dragging");
        rmxTabDnD.dragId = null;
        rmxTabDnD.dropTargetId = null;
        rmxTabDnD.dropPos = null;
        rmxClearTabDropMarks();
      });
      div.addEventListener("dragover", (e) => {
        if (!rmxTabDnD.dragId || rmxTabDnD.dragId === t.id) return;
        e.preventDefault();
        const rect = div.getBoundingClientRect();
        const before = e.clientX < rect.left + rect.width / 2;
        rmxClearTabDropMarks();
        div.classList.add(before ? "drop-before" : "drop-after");
        rmxTabDnD.dropTargetId = t.id;
        rmxTabDnD.dropPos = before ? "before" : "after";
      });
      div.addEventListener("dragleave", () => {
        div.classList.remove("drop-before", "drop-after");
      });
      div.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!rmxTabDnD.dragId || rmxTabDnD.dragId === t.id) return;
        const pos = rmxTabDnD.dropPos || "before";
        rmxReorderTabs(rmxTabDnD.dragId, t.id, pos);
        rmxTabDnD.justDropped = true;
        rmxRenderTabs();
      });
      div.innerHTML = `<span class="rmx-tab-dot ${dotClass}"></span>
        <span>${rmxEsc(t.name)}</span>
        <button class="rmx-tab-close" draggable="false" onclick="event.stopPropagation();rmxCloseTab('${t.id}')" title="${window.t('remox.tab.close')}">×</button>`;
      tabsEl.insertBefore(div, addBtn || null);
    });
    if (!tabsEl.dataset.dndBound) {
      tabsEl.addEventListener("dragover", (e) => {
        if (!rmxTabDnD.dragId) return;
        e.preventDefault();
      });
      tabsEl.addEventListener("drop", (e) => {
        if (!rmxTabDnD.dragId) return;
        const targetTab = e.target.closest(".rmx-tab");
        if (!targetTab) {
          const from = rmxTabs.findIndex((x) => x.id === rmxTabDnD.dragId);
          if (from > -1) {
            const [moved] = rmxTabs.splice(from, 1);
            rmxTabs.push(moved);
            rmxTabDnD.justDropped = true;
            rmxRenderTabs();
          }
        }
      });
      tabsEl.dataset.dndBound = "1";
    }
    rmxUpdateWorkspaceLayout();
  }

  function rmxSetActiveTab(id) {
    rmxActiveTab = id;
    rmxCloseSupportArtifacts();
    rmxRenderTabs();
    document.querySelectorAll(".rmx-terminal-panel").forEach((p) => p.classList.remove("active"));
    const panel = document.getElementById("rmx-panel-" + id);
    if (panel) {
      panel.classList.add("active");
      const tab = rmxTabs.find((t) => t.id === id);
      if (tab?.fitAddon) { setTimeout(() => { tab.fitAddon.fit(); tab.term?.focus(); }, 50); }
    }
    rmxSplashHide();
  }

  window.rmxCloseTab = async function (id) {
    const tab = rmxTabs.find((t) => t.id === id);
    if (tab) {
      tab.term?.dispose();
      await remoxApi.disconnect(id);
    }
    rmxTabs = rmxTabs.filter((t) => t.id !== id);
    document.getElementById("rmx-panel-" + id)?.remove();

    if (rmxActiveTab === id) {
      rmxActiveTab = rmxTabs.length ? rmxTabs[rmxTabs.length - 1].id : null;
      if (rmxActiveTab) rmxSetActiveTab(rmxActiveTab);
      else { rmxSplashShow(); }
    }
    rmxRenderTabs();
    rmxRefreshSidebar();
  };

  function rmxSplashShow() {
    const s = document.getElementById("rmxSplash");
    if (s) { s.style.display = ""; }
  }
  function rmxSplashHide() {
    const s = document.getElementById("rmxSplash");
    if (s) { s.style.display = "none"; }
  }

  // Panels are created dynamically and appended to #rmxPanels
  function rmxEnsurePanel(sessionId) {
    if (document.getElementById("rmx-panel-" + sessionId)) return;
    const panels = document.getElementById("rmxPanels");
    if (!panels) return;
    const div = document.createElement("div");
    div.className = "rmx-terminal-panel";
    div.id = "rmx-panel-" + sessionId;
    div.innerHTML = '<div class="rmx-term-container" style="width:100%;height:100%;"></div>';
    panels.appendChild(div);
  }

  // ─── RDP Panel ────────────────────────────────────────────────────────
  async function rmxOpenRdpPanel(conn, sessionId) {
    rmxEnsurePanel(sessionId);
    const tab = { id: sessionId, connId: conn.id, name: conn.name, type: "rdp", status: "connected", term: null, fitAddon: null };
    rmxTabs.push(tab);
    rmxRenderTabs();
    rmxSetActiveTab(sessionId);
    rmxSplashHide();

    const panelEl = document.getElementById("rmx-panel-" + sessionId);
    if (panelEl) {
      const container = panelEl.querySelector(".rmx-term-container");
      container.addEventListener("mousedown", rmxCloseSupportArtifacts);
      container.style.display = "flex";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.background = "#0d1117";
      container.innerHTML = `
        <div style="text-align:center;max-width:380px;padding:24px">
          <div style="font-size:40px;margin-bottom:16px">🖥️</div>
          <div style="font-size:16px;font-weight:600;color:#e0e0e0;margin-bottom:6px">${rmxEsc(conn.name)}</div>
          <div style="font-size:13px;color:#666;margin-bottom:4px">RDP — ${rmxEsc(conn.host)}:${conn.port}</div>
          ${conn.domain ? `<div style="font-size:12px;color:#555;margin-bottom:4px">Domain: ${rmxEsc(conn.domain)}</div>` : ""}
          ${conn.username ? `<div style="font-size:12px;color:#555;margin-bottom:20px">User: ${rmxEsc(conn.username)}</div>` : `<div style="margin-bottom:20px"></div>`}
          <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
            <button id="rdpLaunchBtn-${sessionId}"
              style="display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:9px;
                border:1px solid rgba(124,111,224,0.4);background:rgba(124,111,224,0.15);
                color:#a78bfa;cursor:pointer;font-size:14px;font-weight:600;transition:all .15s"
              onclick="rmxLaunchRdp('${sessionId}','${conn.id}')">
              <i class="bi bi-play-fill"></i> Buka RDP Client
            </button>
            <div id="rdpStatus-${sessionId}" style="font-size:12px;color:#555"></div>
          </div>
          <div style="margin-top:20px;padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;
            font-size:11px;color:#555;line-height:1.6;text-align:left">
            <b style="color:#777">Info:</b> RDP akan dibuka menggunakan aplikasi native di sistem Anda.<br>
            Windows: <i>Remote Desktop Connection (mstsc)</i><br>
            macOS: <i>Microsoft Remote Desktop</i><br>
            Linux: <i>Remmina / xfreerdp</i>
          </div>
        </div>`;
    }

    // Auto-launch immediately
    rmxLaunchRdp(sessionId, conn.id);
  }

  window.rmxLaunchRdp = async function (sessionId, connId) {
    const conn = rmxConnections.find((c) => c.id === connId);
    if (!conn) return;
    const statusEl = document.getElementById("rdpStatus-" + sessionId);
    const setStatus = (msg, ok) => {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.style.color = ok === true ? "#50c878" : ok === false ? "#f87171" : "#888";
    };
    if (!remoxApi.launchRdp) {
      setStatus("launchRdp tidak tersedia — coba restart aplikasi", false);
      return;
    }
    setStatus("Membuka RDP client…", null);
    try {
      const res = await remoxApi.launchRdp({
        host: conn.host, port: conn.port,
        username: conn.username, password: conn.password, domain: conn.domain,
      });
      if (res?.success) {
        setStatus("RDP client dibuka ✓", true);
      } else {
        setStatus("Gagal: " + (res?.error || "Unknown error"), false);
      }
    } catch (err) {
      setStatus("Error: " + (err?.message || String(err)), false);
    }
  };

  // ─── Connect / Focus ──────────────────────────────────────────────────
  window.rmxConnectOrFocus = async function (connId) {
    rmxCloseSupportArtifacts();
    const existingTab = rmxTabs.find((t) => t.connId === connId && t.status !== "disconnected");
    if (existingTab) { rmxSetActiveTab(existingTab.id); return; }
    const sessionId = "rmx-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const conn = rmxConnections.find((c) => c.id === connId);
    if (!conn) return;

    // RDP — open panel with native client launcher
    if (conn.type === "rdp") { await rmxOpenRdpPanel(conn, sessionId); return; }

    rmxEnsurePanel(sessionId);
    const tab = {
      id: sessionId, connId, name: conn.name, type: conn.type,
      status: "connecting", term: null, fitAddon: null,
    };
    rmxTabs.push(tab);
    rmxRenderTabs();
    rmxSetActiveTab(sessionId);
    rmxSplashHide();

    const panelEl = document.getElementById("rmx-panel-" + sessionId);
    if (panelEl) {
      const container = panelEl.querySelector(".rmx-term-container");
      container.addEventListener("mousedown", rmxCloseSupportArtifacts);
      const term = new Terminal({
        theme: {
          background: "#0d1117", foreground: "#c9d1d9", cursor: "#58a6ff",
          selectionBackground: "#3b4a6b", black: "#0d1117", red: "#ff7b72",
          green: "#3fb950", yellow: "#d29922", blue: "#58a6ff", magenta: "#bc8cff",
          cyan: "#39c5cf", white: "#b1bac4", brightBlack: "#6e7681",
          brightRed: "#ffa198", brightGreen: "#56d364", brightYellow: "#e3b341",
          brightBlue: "#79c0ff", brightMagenta: "#d2a8ff", brightCyan: "#56d4dd",
          brightWhite: "#f0f6fc",
        },
        fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
        fontSize: 13, lineHeight: 1.2, cursorBlink: true,
        allowTransparency: true, scrollback: 5000,
      });
      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();
      tab.term = term;
      tab.fitAddon = fitAddon;

      term.onData((data) => remoxApi.sendData({ sessionId, data }));

      const ro = new ResizeObserver(() => {
        if (tab.status === "connected") {
          fitAddon.fit();
          remoxApi.resize({ sessionId, cols: term.cols, rows: term.rows });
        }
      });
      ro.observe(container);
      term.write(`\x1b[33mMenghubungkan ke ${conn.host}:${conn.port}...\x1b[0m\r\n`);
    }

    const result = await remoxApi.connect({ sessionId, connectionId: connId });
    if (result.success) {
      tab.status = "connected";
      if (tab.fitAddon) {
        tab.fitAddon.fit();
        remoxApi.resize({ sessionId, cols: tab.term.cols, rows: tab.term.rows });
      }
    } else {
      tab.status = "error";
      tab.term?.write(`\r\n\x1b[31mGagal terhubung: ${result.error}\x1b[0m\r\n`);
    }
    rmxRenderTabs();
    rmxRefreshSidebar();
    tab.term?.focus();
  };

  // ─── Modal ────────────────────────────────────────────────────────────
  window.rmxOpenAddModal = function () {
    document.getElementById("rmxEditId").value = "";
    document.getElementById("rmxModalTitle").textContent = window.t('remox.modal.add');
    document.getElementById("rmxFormName").value = "";
    document.getElementById("rmxFormType").value = "ssh";
    document.getElementById("rmxFormHost").value = "";
    document.getElementById("rmxFormPort").value = "22";
    document.getElementById("rmxFormUser").value = "";
    document.getElementById("rmxFormPass").value = "";
    document.getElementById("rmxFormPk").value = "";
    document.getElementById("rmxFormDomain").value = "";
    document.getElementById("rmxPkField").style.display = "none";
    document.getElementById("rmxRdpFields").style.display = "none";
    document.getElementById("rmxPkToggleBtn").style.display = "";
    document.getElementById("rmxSshFields").style.display = "";
    rmxSetPasswordVisibility(false);
    rmxUpdateGroupDatalist("");
    document.getElementById("rmxModal").style.display = "flex";
    document.getElementById("rmxFormName").focus();
  };

  window.rmxOpenEditModal = function (id) {
    const c = rmxConnections.find((x) => x.id === id);
    if (!c) return;
    document.getElementById("rmxEditId").value = c.id;
    document.getElementById("rmxModalTitle").textContent = window.t('remox.modal.edit');
    document.getElementById("rmxFormName").value = c.name || "";
    document.getElementById("rmxFormType").value = c.type || "ssh";
    document.getElementById("rmxFormHost").value = c.host || "";
    document.getElementById("rmxFormPort").value = c.port || 22;
    document.getElementById("rmxFormUser").value = c.username || "";
    document.getElementById("rmxFormPass").value = c.password || "";
    document.getElementById("rmxFormPk").value = c.privateKey || "";
    document.getElementById("rmxFormDomain").value = c.domain || "";
    const isRdp = c.type === "rdp";
    const isSsh = c.type === "ssh";
    document.getElementById("rmxPkField").style.display = (isSsh && c.privateKey) ? "" : "none";
    document.getElementById("rmxRdpFields").style.display = isRdp ? "" : "none";
    document.getElementById("rmxPkToggleBtn").style.display = isSsh ? "" : "none";
    document.getElementById("rmxSshFields").style.display = (isSsh || isRdp) ? "" : "none";
    rmxSetPasswordVisibility(false);
    rmxUpdateGroupDatalist(c.group || "");
    document.getElementById("rmxModal").style.display = "flex";
  };

  window.rmxCloseModal = function () {
    rmxSetPasswordVisibility(false);
    document.getElementById("rmxModal").style.display = "none";
  };

  window.rmxOnTypeChange = function () {
    const t = document.getElementById("rmxFormType").value;
    const isSsh = t === "ssh";
    const isRdp = t === "rdp";
    document.getElementById("rmxSshFields").style.display = (isSsh || isRdp) ? "" : "none";
    document.getElementById("rmxRdpFields").style.display = isRdp ? "" : "none";
    document.getElementById("rmxPkField").style.display = "none";
    document.getElementById("rmxPkToggleBtn").style.display = isSsh ? "" : "none";
    document.getElementById("rmxFormPort").value = isSsh ? 22 : isRdp ? 3389 : 23;
  };

  window.rmxTogglePk = function () {
    const f = document.getElementById("rmxPkField");
    f.style.display = f.style.display === "none" ? "" : "none";
  };

  function rmxSetPasswordVisibility(show) {
    const input = document.getElementById("rmxFormPass");
    const icon = document.getElementById("rmxPassToggleIcon");
    const btn = document.getElementById("rmxPassToggleBtn");
    if (!input) return;
    input.type = show ? "text" : "password";
    if (icon) icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
    if (btn) {
      btn.title = show ? "Hide password" : "Show password";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    }
  }

  window.rmxTogglePasswordVisibility = function () {
    const input = document.getElementById("rmxFormPass");
    if (!input) return;
    rmxSetPasswordVisibility(input.type === "password");
  };

  window.rmxSaveConnection = async function () {
    const name = document.getElementById("rmxFormName").value.trim();
    const type = document.getElementById("rmxFormType").value;
    const host = document.getElementById("rmxFormHost").value.trim();
    const defPort = type === "ssh" ? 22 : type === "rdp" ? 3389 : 23;
    const port = parseInt(document.getElementById("rmxFormPort").value) || defPort;
    const username = document.getElementById("rmxFormUser").value.trim();
    const password = document.getElementById("rmxFormPass").value;
    const privateKey = document.getElementById("rmxFormPk").value.trim();
    const domain = document.getElementById("rmxFormDomain").value.trim();
    const editId = document.getElementById("rmxEditId").value;

    if (!name) { alert("Nama koneksi wajib diisi"); return; }
    if (!host) { alert("Host wajib diisi"); return; }
    if (type === "ssh" && !username) { alert("Username wajib diisi untuk SSH"); return; }
    if (type === "rdp" && !username) { alert("Username wajib diisi untuk RDP"); return; }

    const group = String(document.getElementById("rmxFormGroup").value || "").trim();
    const conn = { type, host, port, username, password, privateKey, domain, group };
    if (editId) conn.id = editId;
    conn.name = name;

    const saved = await remoxApi.saveConnection(conn);
    if (editId) {
      const idx = rmxConnections.findIndex((c) => c.id === editId);
      if (idx >= 0) rmxConnections[idx] = saved; else rmxConnections.push(saved);
      // Invalidate ping cache for edited connection
      rmxPingCache.delete(editId);
    } else {
      rmxConnections.push(saved);
    }
    rmxRefreshSidebar();
    rmxCloseModal();
    // Ping the saved/new connection
    rmxPingOne(saved.id);
  };

  window.rmxDeleteConnection = async function (id) {
    const c = rmxConnections.find((x) => x.id === id);
    if (!c) return;
    if (!confirm(`Hapus koneksi "${c.name}"?`)) return;
    await remoxApi.deleteConnection(id);
    rmxConnections = rmxConnections.filter((x) => x.id !== id);
    rmxRefreshSidebar();
  };

  // ─── Util ─────────────────────────────────────────────────────────────
  function rmxEsc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ─── Re-check cloud access on session change ──────────────────────────
  if (window.electronAPI?.auth?.onSessionChanged) {
    window.electronAPI.auth.onSessionChanged(() => {
      if (rmxInitialized) rmxCheckCloudAccess();
    });
  }

  // ─── MutationObserver trigger ─────────────────────────────────────────
  const rmxPage = document.getElementById("page-remox");
  if (rmxPage) {
    new MutationObserver(() => {
      if (rmxPage.classList.contains("active")) window.initRemoxPage();
    }).observe(rmxPage, { attributes: true, attributeFilter: ["class"] });
  }
})();
