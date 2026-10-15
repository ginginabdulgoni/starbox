// ═══════════════════════════════════════════════════════════════════════════════
// Modul MikroTik — sisi renderer (daftar router, scan, WebUI, Winbox, SSH (lewat modul Remox), relay)
// Dimuat oleh core (module-host.js) setelah renderer.js. Komunikasi ke main
// process lewat window.electronAPI.modules (hanya channel di manifest.json).
// ═══════════════════════════════════════════════════════════════════════════════

const mikrotikApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    loadDevices: call("mikrotik:load-devices"),
    saveDevice: call("mikrotik:save-device"),
    deleteDevice: call("mikrotik:delete-device"),
    scanNetwork: call("mikrotik:scan-network"),
    openWebUI: call("mikrotik:open-webui"),
    openWebUIProxy: call("mikrotik:open-webui-proxy"),
    openSSH: call("mikrotik:open-ssh"),
    launchWinbox: call("mikrotik:launch-winbox"),
    startProxy: call("mikrotik:start-proxy"),
    stopProxy: call("mikrotik:stop-proxy"),
    startWinboxTunnel: call("mikrotik:start-winbox-tunnel"),
    stopWinboxTunnel: call("mikrotik:stop-winbox-tunnel"),
    getWinboxTunnelPort: call("mikrotik:get-winbox-tunnel-port"),
    syncToServer: call("mikrotik:sync-to-server"),
  };
})();

(function () {
  "use strict";

  // ─── State ───────────────────────────────────────────────────────────
  let mtkDevices  = [];
  let mtkSelected = null; // device yang dipilih

  // ─── Load & Render ────────────────────────────────────────────────────
  async function mtkLoadDevices() {
    if (!mikrotikApi) return;
    mtkDevices = await mikrotikApi.loadDevices();
    mtkRenderSidebar();
  }

  function mtkRenderSidebar() {
    const list  = document.getElementById("mtkConnList");
    const empty = document.getElementById("mtkConnEmpty");
    if (!list) return;

    // Hapus item lama (tapi biarkan empty placeholder)
    list.querySelectorAll(".mtk-conn-item").forEach((el) => el.remove());

    if (!mtkDevices.length) {
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";

    mtkDevices.forEach((dev) => {
      const item = document.createElement("div");
      item.className = "mtk-conn-item" + (mtkSelected?.id === dev.id ? " active" : "");
      item.dataset.id = dev.id;
      item.innerHTML = `
        <div class="mtk-conn-icon"><i class="bi bi-router"></i></div>
        <div class="mtk-conn-info">
          <div class="mtk-conn-name">${escHtml(dev.name || dev.host)}</div>
          <div class="mtk-conn-host">${escHtml(dev.host)}</div>
        </div>
        <div class="mtk-conn-dot" id="mtkDot-${dev.id}"></div>`;
      item.addEventListener("click", () => mtkSelectDevice(dev));
      list.appendChild(item);
    });
  }

  function escHtml(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // ─── Select & Detail ─────────────────────────────────────────────────
  function mtkSelectDevice(dev) {
    mtkSelected = dev;
    // Update sidebar highlight
    document.querySelectorAll(".mtk-conn-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === dev.id);
    });
    mtkRenderDetail(dev);
  }

  function mtkRenderDetail(dev) {
    const splash = document.getElementById("mtkSplash");
    const detail = document.getElementById("mtkDetail");
    if (!splash || !detail) return;
    splash.style.display = "none";
    detail.classList.add("visible");

    const ports = [];
    if (dev.sshPort)    ports.push({ label: "SSH",    port: dev.sshPort,    icon: "bi-terminal" });
    if (dev.webPort)    ports.push({ label: "Web UI", port: dev.webPort,    icon: "bi-globe" });
    if (dev.winboxPort) ports.push({ label: "Winbox", port: dev.winboxPort, icon: "bi-window-stack" });

    detail.innerHTML = `
      <div class="mtk-detail-hdr">
        <div class="mtk-detail-icon"><i class="bi bi-router"></i></div>
        <div class="mtk-detail-title">
          <h3>${escHtml(dev.name || dev.host)}</h3>
          <span>${escHtml(dev.host)}${dev.note ? " — " + escHtml(dev.note) : ""}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="mtk-btn mtk-btn-secondary mtk-btn-sm" onclick="mtkOpenEditModal('${dev.id}')"><i class="bi bi-pencil"></i> Edit</button>
          <button class="mtk-btn mtk-btn-danger mtk-btn-sm" onclick="mtkDeleteDevice('${dev.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>

      <div class="mtk-info-grid">
        <div class="mtk-info-card">
          <label>Host / IP</label>
          <span>${escHtml(dev.host)}</span>
        </div>
        <div class="mtk-info-card">
          <label>Username</label>
          <span>${escHtml(dev.username || "admin")}</span>
        </div>
        ${dev.note ? `<div class="mtk-info-card" style="grid-column:1/-1"><label>Catatan</label><span>${escHtml(dev.note)}</span></div>` : ""}
      </div>

      <div style="margin-bottom:14px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#888);font-weight:700;margin-bottom:8px">Port</div>
        <div>
          ${ports.map((p) => `<span class="mtk-port-badge"><i class="bi ${p.icon}"></i> ${p.label}: ${p.port}</span>`).join("")}
        </div>
      </div>

      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#888);font-weight:700;margin-bottom:12px">Aksi Koneksi</div>
      <div class="mtk-detail-actions">
        <button class="mtk-btn mtk-btn-primary" onclick="mtkDoSSH('${dev.id}')">
          <i class="bi bi-terminal-fill"></i> SSH Terminal
        </button>
        <button class="mtk-btn mtk-btn-secondary" onclick="mtkDoWebUI('${dev.id}')">
          <i class="bi bi-globe"></i> Web UI
        </button>
        <button class="mtk-btn mtk-btn-secondary" onclick="mtkDoWinbox('${dev.id}')">
          <i class="bi bi-window-stack"></i> Winbox
        </button>
      </div>

      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#888);font-weight:700;margin-bottom:10px">Remote via Relay
        <span style="font-size:10px;font-weight:400;color:#5b6af0;margin-left:6px;text-transform:none">• Akses dari jaringan lain</span>
      </div>
      <div style="background:rgba(91,106,240,.08);border:1px solid rgba(91,106,240,.25);border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7">
        <div style="color:var(--text-muted,#aaa);margin-bottom:12px">
          <i class="bi bi-info-circle" style="color:#5b6af0"></i>
          Pastikan <strong>StarBox Agent</strong> berjalan di jaringan yang sama dengan router dan login dengan akun yang sama.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <button class="mtk-btn mtk-btn-primary mtk-btn-sm" onclick="mtkDoSSHRelay('${dev.id}')">
            <i class="bi bi-terminal"></i> SSH via Relay
          </button>
          <button class="mtk-btn mtk-btn-secondary mtk-btn-sm" onclick="mtkDoWebUIRelay('${dev.id}')">
            <i class="bi bi-globe"></i> Web UI via Relay
          </button>
          <button class="mtk-btn mtk-btn-secondary mtk-btn-sm" id="mtkWinboxRelayBtn-${dev.id}" onclick="mtkDoWinboxRelay('${dev.id}')">
            <i class="bi bi-plug"></i> Winbox via Relay
          </button>
        </div>
        <div id="mtkWinboxRelayInfo-${dev.id}" style="display:none;margin-top:12px;padding:10px 12px;background:rgba(39,174,96,.1);border:1px solid rgba(39,174,96,.3);border-radius:8px">
          <div style="color:#27ae60;font-weight:600;margin-bottom:4px"><i class="bi bi-check-circle-fill"></i> Winbox Tunnel Aktif</div>
          <div style="color:var(--text-muted,#aaa);font-size:12px">
            Buka Winbox → connect ke <code style="background:#0003;padding:1px 5px;border-radius:4px;color:#e0e0e0">localhost:<span class="mtk-winbox-port"></span></code>
          </div>
          <button class="mtk-btn mtk-btn-danger mtk-btn-sm" style="margin-top:8px" onclick="mtkStopWinboxTunnel('${dev.id}')">
            <i class="bi bi-stop-fill"></i> Stop Tunnel
          </button>
        </div>
      </div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#888);font-weight:700;margin:18px 0 10px">Sinkronisasi Server</div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-muted,#aaa)">
        <i class="bi bi-cloud-arrow-up" style="color:#5b6af0;font-size:16px"></i>
        Device ini tersinkron ke server StarBox. Dapat diakses dari web dashboard.
        <button class="mtk-btn mtk-btn-secondary mtk-btn-sm" onclick="mtkSyncToServer()" style="margin-left:auto">
          <i class="bi bi-arrow-repeat"></i> Sync Sekarang
        </button>
      </div>`;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────
  window.mtkOpenAddModal = function () {
    document.getElementById("mtkModalTitle").textContent = "Tambah Router MikroTik";
    document.getElementById("mtkFId").value     = "";
    document.getElementById("mtkFName").value   = "";
    document.getElementById("mtkFHost").value   = "";
    document.getElementById("mtkFSshPort").value = "22";
    document.getElementById("mtkFWebPort").value = "80";
    document.getElementById("mtkFWinboxPort").value = "8291";
    document.getElementById("mtkFUser").value   = "admin";
    document.getElementById("mtkFPass").value   = "";
    document.getElementById("mtkFNote").value   = "";
    document.getElementById("mtkModalOverlay").classList.add("visible");
    setTimeout(() => document.getElementById("mtkFName").focus(), 80);
  };

  window.mtkOpenEditModal = function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    if (!dev) return;
    document.getElementById("mtkModalTitle").textContent = "Edit Router MikroTik";
    document.getElementById("mtkFId").value     = dev.id;
    document.getElementById("mtkFName").value   = dev.name || "";
    document.getElementById("mtkFHost").value   = dev.host || "";
    document.getElementById("mtkFSshPort").value = dev.sshPort || 22;
    document.getElementById("mtkFWebPort").value = dev.webPort || 80;
    document.getElementById("mtkFWinboxPort").value = dev.winboxPort || 8291;
    document.getElementById("mtkFUser").value   = dev.username || "admin";
    document.getElementById("mtkFPass").value   = dev.password || "";
    document.getElementById("mtkFNote").value   = dev.note || "";
    document.getElementById("mtkModalOverlay").classList.add("visible");
  };

  window.mtkCloseModal = function () {
    document.getElementById("mtkModalOverlay").classList.remove("visible");
  };

  window.mtkSubmitDevice = async function () {
    const host = document.getElementById("mtkFHost").value.trim();
    if (!host) { Swal.fire({ icon:"warning", title:"Host diperlukan", text:"Masukkan IP address atau hostname router.", background:"#1e2030", color:"#e0e0e0" }); return; }

    const device = {
      id:         document.getElementById("mtkFId").value || undefined,
      name:       document.getElementById("mtkFName").value.trim() || host,
      host,
      sshPort:    parseInt(document.getElementById("mtkFSshPort").value) || 22,
      webPort:    parseInt(document.getElementById("mtkFWebPort").value) || 80,
      winboxPort: parseInt(document.getElementById("mtkFWinboxPort").value) || 8291,
      username:   document.getElementById("mtkFUser").value.trim() || "admin",
      password:   document.getElementById("mtkFPass").value,
      note:       document.getElementById("mtkFNote").value.trim(),
    };

    const saved = await mikrotikApi.saveDevice(device);
    mtkCloseModal();
    await mtkLoadDevices();
    mtkSelectDevice(mtkDevices.find((d) => d.id === saved.id) || mtkDevices[0]);
  };

  window.mtkDeleteDevice = async function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    const res = await Swal.fire({
      title: "Hapus Router?",
      text: `Yakin hapus "${dev?.name || dev?.host}"?`,
      icon: "warning", showCancelButton: true,
      confirmButtonText: "Ya, Hapus", cancelButtonText: "Batal",
      confirmButtonColor: "#e74c3c",
      background: "#1e2030", color: "#e0e0e0",
    });
    if (!res.isConfirmed) return;
    await mikrotikApi.deleteDevice(id);
    mtkSelected = null;
    document.getElementById("mtkSplash").style.display = "";
    document.getElementById("mtkDetail").classList.remove("visible");
    await mtkLoadDevices();
  };

  // ─── Connection actions ───────────────────────────────────────────────
  window.mtkDoSSH = async function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    if (!dev) return;
    const res = await mikrotikApi.openSSH({
      host: dev.host, sshPort: dev.sshPort, username: dev.username, password: dev.password, name: dev.name,
    });
    if (res.needsModule) {
      // Remox adalah modul terpisah — arahkan user untuk memasangnya
      StarBoxModuleHost.openPage("remox", res.needsModule);
      return;
    }
    if (res.success) {
      // Buka Remox, tunggu koneksi dimuat, lalu auto-connect
      window.rmxConnectById(res.connectionId);
    } else {
      Swal.fire({ icon:"error", title:"SSH Gagal", text:res.error, background:"#1e2030", color:"#e0e0e0" });
    }
  };

  window.mtkDoWebUI = async function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    if (!dev) return;
    const res = await mikrotikApi.openWebUIProxy({ deviceId:dev.id, host:dev.host, webPort:dev.webPort, name:dev.name });
    if (!res.success) {
      Swal.fire({ icon:"error", title:"Gagal Buka Web UI", text:res.error, background:"#1e2030", color:"#e0e0e0" });
    }
  };

  window.mtkDoWinbox = async function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    if (!dev) return;
    const res = await mikrotikApi.launchWinbox({ host:dev.host, winboxPort:dev.winboxPort, username:dev.username, password:dev.password });
    if (!res.success) {
      Swal.fire({
        icon:"warning", title:"Winbox Tidak Ditemukan",
        html: `${res.error}<br/><br/><a href="#" onclick="window.electronAPI?.openExternal?.('https://mikrotik.com/download')" style="color:#5b6af0">Download Winbox dari mikrotik.com</a>`,
        background:"#1e2030", color:"#e0e0e0",
      });
    }
  };

  window.mtkDoSSHRelay = async function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    if (!dev) return;
    const res = await mikrotikApi.openSSH({
      host: dev.host, sshPort: dev.sshPort, username: dev.username, password: dev.password, name: dev.name,
    });
    if (res.needsModule) {
      StarBoxModuleHost.openPage("remox", res.needsModule);
      return;
    }
    if (res.success) {
      Swal.fire({
        icon: "info", title: "SSH via Relay",
        text: "Koneksi SSH akan dibuat melalui relay server. Pastikan StarBox Agent di jaringan yang sama sudah online.",
        background: "#1e2030", color: "#e0e0e0", timer: 3000, showConfirmButton: false,
      });
      // Tunggu Swal selesai, lalu navigate + connect
      setTimeout(() => window.rmxConnectById(res.connectionId), 200);
    } else {
      Swal.fire({ icon:"error", title:"SSH Relay Gagal", text:res.error, background:"#1e2030", color:"#e0e0e0" });
    }
  };

  window.mtkDoWebUIRelay = async function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    if (!dev) return;
    Swal.fire({
      icon: "info", title: "Web UI via Relay",
      html: `StarBox Agent di jaringan <strong>${escHtml(dev.host)}</strong> akan membuka Web UI MikroTik dan meneruskannya ke StarBox Anda melalui relay.<br/><br/>Pastikan StarBox Agent sedang berjalan dan terhubung.`,
      background: "#1e2030", color: "#e0e0e0",
      showCancelButton: true, confirmButtonText: "Buka", cancelButtonText: "Batal",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      // Kirim command ke remote client via relay
      if (window.sendRemoteCommand) {
        const result = await window.sendRemoteCommand("mikrotik_open_webui", { deviceId: dev.id, host: dev.host, webPort: dev.webPort, name: dev.name });
        if (!result?.success) {
          Swal.fire({ icon:"error", title:"Gagal", text: result?.error || "Agent tidak merespons", background:"#1e2030", color:"#e0e0e0" });
        }
      } else {
        // Fallback: buka langsung (hanya works jika MikroTik reachable)
        window.mtkDoWebUI(id);
      }
    });
  };

  window.mtkDoWinboxRelay = async function (id) {
    const dev = mtkDevices.find((d) => d.id === id);
    if (!dev) return;

    // Cek jika tunnel sudah aktif
    const existing = await mikrotikApi.getWinboxTunnelPort({ deviceId: dev.id });
    if (existing?.active) {
      mtkShowWinboxTunnelInfo(dev.id, existing.port);
      return;
    }

    const btn = document.getElementById(`mtkWinboxRelayBtn-${dev.id}`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Connecting…'; }

    // Minta daftar client online untuk pilih agent
    const clients = window.remoteClients || [];
    let targetClientId = null;

    // Coba cari agent dengan device ini
    const agentClients = clients.filter((c) => c.client_id !== window.myClientId);

    if (agentClients.length === 0) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-plug"></i> Winbox via Relay'; }
      Swal.fire({
        icon: "warning", title: "Tidak Ada Agent",
        text: "Tidak ada StarBox Agent online. Pastikan StarBox di jaringan MikroTik sudah berjalan dan login.",
        background: "#1e2030", color: "#e0e0e0",
      });
      return;
    }

    if (agentClients.length === 1) {
      targetClientId = agentClients[0].client_id;
    } else {
      // Tampilkan picker
      const opts = agentClients.map((c, i) => `<option value="${escHtml(c.client_id)}">${escHtml(c.hostname || c.client_id)}</option>`).join("");
      const { value } = await Swal.fire({
        title: "Pilih StarBox Agent",
        html: `<select id="mtkAgentPicker" class="swal2-input" style="margin:0">${opts}</select>`,
        confirmButtonText: "Hubungkan",
        showCancelButton: true,
        background: "#1e2030", color: "#e0e0e0",
        preConfirm: () => document.getElementById("mtkAgentPicker")?.value,
      });
      if (!value) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-plug"></i> Winbox via Relay'; }
        return;
      }
      targetClientId = value;
    }

    const res = await mikrotikApi.startWinboxTunnel({
      deviceId:       dev.id,
      targetClientId,
      host:           dev.host,
      winboxPort:     dev.winboxPort || 8291,
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-plug"></i> Winbox via Relay'; }

    if (res.success) {
      mtkShowWinboxTunnelInfo(dev.id, res.port);
    } else {
      Swal.fire({ icon: "error", title: "Winbox Relay Gagal", text: res.error, background: "#1e2030", color: "#e0e0e0" });
    }
  };

  function mtkShowWinboxTunnelInfo(devId, port) {
    const info = document.getElementById(`mtkWinboxRelayInfo-${devId}`);
    if (!info) return;
    info.style.display = "block";
    const portEl = info.querySelector(".mtk-winbox-port");
    if (portEl) portEl.textContent = port;
  }

  window.mtkStopWinboxTunnel = async function (id) {
    await mikrotikApi.stopWinboxTunnel({ deviceId: id });
    const info = document.getElementById(`mtkWinboxRelayInfo-${id}`);
    if (info) info.style.display = "none";
  };

  window.mtkSyncToServer = async function () {
    await mikrotikApi.syncToServer();
    Swal.fire({
      icon: "success", title: "Tersinkron",
      text: "Daftar MikroTik device berhasil dikirim ke server StarBox.",
      background: "#1e2030", color: "#e0e0e0", timer: 2500, showConfirmButton: false,
    });
  };

  // ─── Network Scanner ─────────────────────────────────────────────────
  window.mtkScanNetwork = function () {
    document.getElementById("mtkScanOverlay").classList.add("visible");
    document.getElementById("mtkScanBar").style.width = "0%";
    document.getElementById("mtkScanStatus").textContent = "Siap untuk scan…";
    document.getElementById("mtkScanResults").innerHTML = `<div style="color:var(--text-muted,#888);font-size:13px;text-align:center">Klik <strong>Mulai Scan</strong> untuk mendeteksi perangkat MikroTik di jaringan lokal.</div>`;
    document.getElementById("mtkScanStartBtn").disabled = false;
  };

  window.mtkCloseScan = function () {
    document.getElementById("mtkScanOverlay").classList.remove("visible");
  };

  window.mtkStartScan = async function () {
    const btn    = document.getElementById("mtkScanStartBtn");
    const bar    = document.getElementById("mtkScanBar");
    const status = document.getElementById("mtkScanStatus");
    const results = document.getElementById("mtkScanResults");

    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Scanning…';
    results.innerHTML = "";
    bar.style.width = "10%";
    status.textContent = "Memindai jaringan lokal, harap tunggu…";

    // Animasikan progress bar
    const prog = setInterval(() => {
      const current = parseFloat(bar.style.width) || 10;
      if (current < 85) bar.style.width = (current + 3) + "%";
    }, 800);

    try {
      const res = await mikrotikApi.scanNetwork();
      clearInterval(prog);
      bar.style.width = "100%";

      if (!res.success) {
        status.textContent = "Scan gagal: " + (res.error || "unknown");
        return;
      }

      status.textContent = `Scan selesai. Ditemukan ${res.devices.length} perangkat MikroTik.`;

      if (!res.devices.length) {
        results.innerHTML = `<div style="color:var(--text-muted,#888);font-size:13px;text-align:center;padding:12px">Tidak ada perangkat MikroTik terdeteksi di jaringan lokal.</div>`;
        return;
      }

      res.devices.forEach((d) => {
        const portLabels = [
          d.hasSsh    ? "SSH:22"         : null,
          d.hasWebUI  ? "Web:80"         : null,
          d.hasWinbox ? "Winbox:8291"    : null,
        ].filter(Boolean).join("  ");

        const item = document.createElement("div");
        item.className = "mtk-scan-result-item";
        item.innerHTML = `
          <div class="ri"><i class="bi bi-router"></i></div>
          <div class="rd">
            <b>${escHtml(d.host)}</b>
            <small>${portLabels}</small>
          </div>
          <button class="mtk-btn mtk-btn-primary mtk-btn-sm">+ Tambah</button>`;
        item.querySelector("button").addEventListener("click", () => {
          mtkCloseScan();
          // Pre-fill form
          document.getElementById("mtkFName").value = `MikroTik ${d.host}`;
          document.getElementById("mtkFHost").value = d.host;
          document.getElementById("mtkFSshPort").value = "22";
          document.getElementById("mtkFWebPort").value = "80";
          document.getElementById("mtkFWinboxPort").value = "8291";
          document.getElementById("mtkFUser").value = "admin";
          document.getElementById("mtkFPass").value = "";
          document.getElementById("mtkFNote").value = "";
          document.getElementById("mtkFId").value = "";
          document.getElementById("mtkModalTitle").textContent = "Tambah Router MikroTik";
          document.getElementById("mtkModalOverlay").classList.add("visible");
        });
        results.appendChild(item);
      });
    } catch (err) {
      clearInterval(prog);
      status.textContent = "Error: " + err.message;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-play-fill"></i> Scan Lagi';
    }
  };

  // ─── Init ─────────────────────────────────────────────────────────────
  window.initMikrotikPage = async function () {
    await mtkLoadDevices();
    // Sync ke server saat halaman dibuka
    mikrotikApi.syncToServer?.();
  };

  // Observe page activation
  const mtkPage = document.getElementById("page-mikrotik");
  if (mtkPage) {
    let mtkInited = false;
    new MutationObserver(() => {
      if (mtkPage.classList.contains("active") && !mtkInited) {
        mtkInited = true;
        window.initMikrotikPage();
      }
    }).observe(mtkPage, { attributes: true, attributeFilter: ["class"] });
  }
})();
