// ═══════════════════════════════════════════════════════════════════════════════
// Modul OS Virtual — sisi renderer (VM QEMU, VNC, ISO)
// Dimuat oleh core (module-host.js) setelah renderer.js. Komunikasi ke main
// process lewat window.electronAPI.modules (hanya channel di manifest.json).
// ═══════════════════════════════════════════════════════════════════════════════

const virtualOSApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    list: call("os-vm-list"),
    save: call("os-vm-upsert"),
    delete: call("os-vm-delete"),
    start: call("os-vm-start"),
    stop: call("os-vm-stop"),
    restart: call("os-vm-restart"),
    snapshot: call("os-vm-snapshot"),
    snapshotRestore: call("os-vm-snapshot-restore"),
    snapshotDelete: call("os-vm-snapshot-delete"),
    pause: call("os-vm-pause"),
    resume: call("os-vm-resume"),
    browseIsoFile: call("browse-iso-file"),
    downloadIso: call("download-iso"),
    listCachedIsos: call("list-cached-isos"),
    forceStop: call("os-vm-force-stop"),
    killAllQemu: call("os-vm-kill-all-qemu"),
    checkQemu: call("os-vm-check-qemu"),
    installQemu: call("os-vm-install-qemu"),
    openVncWindow: call("open-vnc-window"),
    focusVncWindow: call("focus-vnc-window"),
    onIsoDownloadProgress: (cb) => m.on("iso-download-progress", cb),
    onQemuInstallProgress: (cb) => m.on("qemu-install-progress", cb),
  };
})();

window.openVmModal = function (vm = null) {
  const modal = document.getElementById("vmModal");
  if (!modal) return;
  modal.style.display = "flex";
  populateCachedIsos();

  const vmId = document.getElementById("vmId");
  const vmName = document.getElementById("vmName");
  const vmOsType = document.getElementById("vmOsType");
  const vmCpu = document.getElementById("vmCpu");
  const vmMemory = document.getElementById("vmMemory");
  const vmStorage = document.getElementById("vmStorage");
  const vmNetwork = document.getElementById("vmNetwork");
  const vmBridge = document.getElementById("vmBridge");
  const vmMac = document.getElementById("vmMac");
  const vmIso = document.getElementById("vmIso");
  const vmDisk = document.getElementById("vmDisk");
  const vmAutostart = document.getElementById("vmAutostart");
  const vmVncPort = document.getElementById("vmVncPort");
  const vmQemuBin = document.getElementById("vmQemuBin");
  const vmBootOrder = document.getElementById("vmBootOrder");
  const vmNotes = document.getElementById("vmNotes");

  if (vmId) vmId.value = vm?.id || "";
  if (vmName) vmName.value = vm?.name || "";
  if (vmOsType) vmOsType.value = vm?.osType || "linux";
  if (vmCpu) vmCpu.value = vm?.cpu || 2;
  if (vmMemory) vmMemory.value = vm?.memoryMb || 2048;
  if (vmStorage) vmStorage.value = vm?.storageGb || 20;
  if (vmNetwork) vmNetwork.value = vm?.networkMode || "nat";
  if (vmBridge) vmBridge.value = vm?.bridgeInterface || "";
  if (vmMac) vmMac.value = vm?.macAddress || "";
  if (vmIso) vmIso.value = vm?.isoPath || "";
  if (vmDisk) vmDisk.value = vm?.diskPath || "";
  if (vmAutostart) vmAutostart.checked = !!vm?.autostart;
  if (vmVncPort) vmVncPort.value = vm?.vncPort || 5901;
  if (vmQemuBin) vmQemuBin.value = vm?.qemuBinary || "qemu-system-x86_64";
  if (vmBootOrder) vmBootOrder.value = vm?.bootOrder || "cd";
  if (vmNotes) vmNotes.value = vm?.notes || "";
};

window.closeVmModal = function () {
  const modal = document.getElementById("vmModal");
  if (modal) modal.style.display = "none";
};

window.saveVm = async function () {
  try {
    const vmId = document.getElementById("vmId");
    const vmName = document.getElementById("vmName");
    const vmOsType = document.getElementById("vmOsType");
    const vmCpu = document.getElementById("vmCpu");
    const vmMemory = document.getElementById("vmMemory");
    const vmStorage = document.getElementById("vmStorage");
    const vmNetwork = document.getElementById("vmNetwork");
    const vmBridge = document.getElementById("vmBridge");
    const vmMac = document.getElementById("vmMac");
    const vmIso = document.getElementById("vmIso");
    const vmDisk = document.getElementById("vmDisk");
    const vmAutostart = document.getElementById("vmAutostart");
    const vmVncPort = document.getElementById("vmVncPort");
    const vmQemuBin = document.getElementById("vmQemuBin");
    const vmBootOrder = document.getElementById("vmBootOrder");
    const vmNotes = document.getElementById("vmNotes");

    const payload = {
      id: vmId?.value || null,
      name: vmName?.value?.trim() || "",
      osType: vmOsType?.value || "linux",
      cpu: parseInt(vmCpu?.value, 10) || 2,
      memoryMb: parseInt(vmMemory?.value, 10) || 2048,
      storageGb: parseInt(vmStorage?.value, 10) || 20,
      networkMode: vmNetwork?.value || "nat",
      bridgeInterface: vmBridge?.value?.trim() || "",
      macAddress: vmMac?.value?.trim() || "",
      isoPath: vmIso?.value?.trim() || "",
      diskPath: vmDisk?.value?.trim() || "",
      autostart: vmAutostart?.checked || false,
      vncPort: parseInt(vmVncPort?.value, 10) || 5901,
      qemuBinary: vmQemuBin?.value?.trim() || "qemu-system-x86_64",
      bootOrder: vmBootOrder?.value?.trim() || "cd",
      notes: vmNotes?.value?.trim() || "",
    };
    const result = await virtualOSApi.save(payload);
    if (!result?.success) {
      showToast(result?.message || "Gagal menyimpan VM.", 3500, "error");
      return;
    }
    closeVmModal();
    await loadVmList();
    showToast(window.t('toast.vm.saved'), 2500, "success");
  } catch (err) {
    showToast(err?.message || window.t('toast.vm.save_error'), 3500, "error");
  }
};

async function deleteVm(id) {
  if (!id) return;
  const confirm = await Swal.fire({
    title: window.t('dialog.delete_vm.title'),
    text: window.t('dialog.delete_vm.text'),
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: window.t('dialog.delete_vm.confirm'),
    cancelButtonText: window.t('dialog.delete_vm.cancel'),
  });
  if (!confirm.isConfirmed) return;
  const result = await virtualOSApi.delete(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.delete_error'), 3500, "error");
    return;
  }
  await loadVmList();
  showToast(window.t('toast.vm.deleted'), 2500, "success");
}

async function checkQemuStatus() {
  const banner = document.getElementById('qemuMissingBanner');
  if (!banner) return;
  try {
    const r = await virtualOSApi.checkQemu();
    banner.style.display = r.available ? 'none' : 'flex';
  } catch {
    banner.style.display = 'none';
  }
}

async function installQemu() {
  const btn = document.getElementById('installQemuBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menginstall...'; }

  let unsubscribe = null;
  try {
    const swalInst = Swal.fire({
      title: 'Install QEMU',
      html: `<div style="text-align:left;max-height:240px;overflow-y:auto;font-size:0.85rem;font-family:monospace;background:#111;padding:8px;border-radius:6px;" id="qemuInstallLog">Memulai instalasi...</div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    });

    unsubscribe = virtualOSApi.onQemuInstallProgress((data) => {
      const log = document.getElementById('qemuInstallLog');
      if (log && data.message) {
        const line = document.createElement('div');
        line.textContent = data.message;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
      }
      if (data.done || data.error) {
        Swal.close();
      }
    });

    const result = await virtualOSApi.installQemu();
    if (unsubscribe) unsubscribe();

    if (result.success) {
      await Swal.fire({ icon: 'success', title: 'QEMU Terinstall', text: 'QEMU berhasil diinstall. Silakan coba jalankan VM.', confirmButtonText: 'OK' });
      await checkQemuStatus();
    } else {
      const opts = { icon: 'error', title: 'Gagal Install QEMU', text: result.message || 'Terjadi kesalahan.', confirmButtonText: 'OK' };
      if (result.manualUrl) opts.footer = `<a href="${result.manualUrl}" target="_blank">Download Manual</a>`;
      await Swal.fire(opts);
    }
  } catch (err) {
    if (unsubscribe) unsubscribe();
    Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonText: 'OK' });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Install QEMU'; }
  }
}

let osvActiveFilter = "all";
let osvSearchQuery = "";

function updateOsvMetrics(items) {
  const total = items.length;
  const running = items.filter((v) => v.status === "running").length;
  const linux = items.filter((v) => (v.osType || "linux").toLowerCase() === "linux").length;
  const windows = items.filter((v) => (v.osType || "").toLowerCase() === "windows").length;
  const stopped = items.filter((v) => v.status !== "running" && v.status !== "starting").length;
  const totalCpu = items.reduce((acc, v) => acc + (parseInt(v.cpu) || 1), 0);
  const totalRamMb = items.reduce((acc, v) => acc + (parseInt(v.memoryMb) || 0), 0);
  const ramStr = totalRamMb >= 1024 ? (totalRamMb / 1024).toFixed(1) + " GB" : totalRamMb + " MB";

  const elTotal = document.getElementById("metricOsvTotal");
  const elRunning = document.getElementById("metricOsvRunning");
  const elCpu = document.getElementById("metricOsvCpu");
  const elRam = document.getElementById("metricOsvRam");

  if (elTotal) elTotal.textContent = total;
  if (elRunning) elRunning.textContent = running;
  if (elCpu) elCpu.textContent = totalCpu;
  if (elRam) elRam.textContent = ramStr;

  const countAll = document.getElementById("osvFilterAllCount");
  const countRunning = document.getElementById("osvFilterRunningCount");
  const countLinux = document.getElementById("osvFilterLinuxCount");
  const countWindows = document.getElementById("osvFilterWindowsCount");
  const countStopped = document.getElementById("osvFilterStoppedCount");

  if (countAll) countAll.textContent = total;
  if (countRunning) countRunning.textContent = running;
  if (countLinux) countLinux.textContent = linux;
  if (countWindows) countWindows.textContent = windows;
  if (countStopped) countStopped.textContent = stopped;
}

function setOsvFilter(filter) {
  osvActiveFilter = filter;
  document.querySelectorAll(".osv-filter-chips .filter-chip").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === filter);
  });
  renderVmFilteredList();
}

function filterOsvList() {
  const input = document.getElementById("osvSearchInput");
  osvSearchQuery = (input?.value || "").toLowerCase().trim();
  renderVmFilteredList();
}

window.setOsvFilter = setOsvFilter;
window.filterOsvList = filterOsvList;

function renderVmFilteredList() {
  const container = document.getElementById("vm-list");
  if (!container) return;

  const items = Array.isArray(vmListCache) ? vmListCache : [];
  if (!items.length) {
    container.innerHTML = `<div class="osv-empty"><i class="bi bi-display"></i><h3>Belum ada OS Virtual</h3><p>Klik "Tambah VM" untuk membuat mesin virtual baru.</p></div>`;
    return;
  }

  const filtered = items.filter((vm) => {
    const osKey = (vm.osType || "linux").toLowerCase();
    const isRunning = vm.status === "running";
    const isStopped = vm.status !== "running" && vm.status !== "starting";

    // Filter chip matching
    if (osvActiveFilter === "running" && !isRunning) return false;
    if (osvActiveFilter === "linux" && osKey !== "linux") return false;
    if (osvActiveFilter === "windows" && osKey !== "windows") return false;
    if (osvActiveFilter === "stopped" && !isStopped) return false;

    // Search query matching
    if (osvSearchQuery) {
      const q = osvSearchQuery;
      const name = (vm.name || "").toLowerCase();
      const os = (vm.osType || "").toLowerCase();
      const vnc = String(vm.vncPort || "");
      const notes = (vm.notes || "").toLowerCase();
      if (!name.includes(q) && !os.includes(q) && !vnc.includes(q) && !notes.includes(q)) {
        return false;
      }
    }

    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="osv-empty"><i class="bi bi-search"></i><h3>Tidak ada VM yang cocok</h3><p>Coba gunakan kata kunci pencarian atau filter yang berbeda.</p></div>`;
    return;
  }

  const osIcons = {
    linux: { icon: "bi-ubuntu", color: "#e95420" },
    windows: { icon: "bi-windows", color: "#0078d7" },
    macos: { icon: "bi-apple", color: "#a2aaad" },
    android: { icon: "bi-android2", color: "#3ddc84" },
    freebsd: { icon: "bi-hdd-network", color: "#ab2b28" },
    other: { icon: "bi-cpu", color: "#7c3aed" },
  };

  container.innerHTML = filtered.map((vm) => {
    const osKey = (vm.osType || "linux").toLowerCase();
    const osInfo = osIcons[osKey] || osIcons.other;
    const isRunning = vm.status === "running";
    const isStarting = vm.status === "starting";
    const statusLabel = isRunning ? "Running" : isStarting ? "Starting..." : "Stopped";
    const statusCls = isRunning ? "running" : isStarting ? "starting" : "stopped";
    const ramGb = vm.memoryMb >= 1024 ? (vm.memoryMb / 1024).toFixed(1) + " GB" : (vm.memoryMb || 0) + " MB";

    // Badge akselerasi hardware
    const accel = (vm.accelUsed || "").toLowerCase();
    const accelHw = accel && accel !== "tcg";
    const accelBadge = isRunning && accel
      ? `<span title="${accelHw ? "Akselerasi hardware aktif — performa native" : "Emulasi software (TCG) — lebih lambat, arsitektur guest ≠ host"}" style="color:${accelHw ? "#50c878" : "#f0a040"}"><i class="bi bi-${accelHw ? "rocket-takeoff" : "cpu"}"></i> ${accel.toUpperCase()}</span>`
      : "";

    // Daftar snapshot (3 terbaru) + tombol restore / hapus
    const snaps = Array.isArray(vm.snapshots) ? vm.snapshots : [];
    const snapBtnStyle = "background:none;border:none;cursor:pointer;padding:1px 4px;border-radius:4px;font-size:11px";
    const snapsHtml = snaps.length
      ? `<div class="osv-snapshots">
          <div class="osv-snap-title">Snapshot (${snaps.length})</div>
          ${snaps.slice(-3).reverse().map((s) => `
            <div class="osv-snap-item">
              <i class="bi bi-camera"></i>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.name} — ${new Date(s.createdAt).toLocaleString()}">${s.name}${s.live ? ' <i class="bi bi-lightning-charge-fill" style="color:#f0a040" title="Snapshot live (termasuk RAM)"></i>' : ""}</span>
              <button style="${snapBtnStyle};color:#50c878" onclick="restoreVmSnapshot('${vm.id}','${s.id}')" title="Restore snapshot ini"><i class="bi bi-arrow-counterclockwise"></i></button>
              <button style="${snapBtnStyle};color:#e87070" onclick="deleteVmSnapshot('${vm.id}','${s.id}')" title="Hapus snapshot"><i class="bi bi-x-lg"></i></button>
            </div>`).join("")}
        </div>`
      : "";

    return `
      <div class="osv-card" data-vm-id="${vm.id}">
        <div class="osv-card-head">
          <div class="osv-os-icon" style="background:${osInfo.color}22; color:${osInfo.color}">
            <i class="bi ${osInfo.icon}"></i>
          </div>
          <div class="osv-card-name">
            <h4>${vm.name || "Tanpa nama"}</h4>
            <span>${(vm.osType || "linux").toUpperCase()}</span>
          </div>
          <span class="osv-status-badge ${statusCls}">
            <span class="dot"></span>${statusLabel}
          </span>
        </div>
        <div class="osv-specs">
          <div class="osv-spec"><div class="osv-spec-val">${vm.cpu || 1}</div><div class="osv-spec-key">vCPU</div></div>
          <div class="osv-spec"><div class="osv-spec-val">${ramGb}</div><div class="osv-spec-key">RAM</div></div>
          <div class="osv-spec"><div class="osv-spec-val">${vm.storageGb || 0} GB</div><div class="osv-spec-key">Disk</div></div>
          <div class="osv-spec"><div class="osv-spec-val">:${vm.vncPort || 5901}</div><div class="osv-spec-key">VNC</div></div>
        </div>
        <div class="osv-info">
          <span><i class="bi bi-diagram-3"></i> ${(vm.networkMode || "nat").toUpperCase()}</span>
          ${accelBadge}
          ${vm.autostart ? '<span><i class="bi bi-lightning-fill" style="color:#f0a040"></i> Autostart</span>' : ""}
          ${vm.isoPath ? `<span title="${vm.isoPath}"><i class="bi bi-disc"></i> ISO</span>` : ""}
        </div>
        ${snapsHtml}
        ${vm.notes ? `<div class="osv-notes">${vm.notes}</div>` : ""}
        <div class="osv-actions">
          <button class="osv-btn start" onclick="startVm('${vm.id}')" title="Start"><i class="bi bi-play-fill"></i> Start</button>
          <button class="osv-btn restart" onclick="restartVm('${vm.id}')" title="Restart"><i class="bi bi-arrow-repeat"></i></button>
          <button class="osv-btn stop" onclick="stopVm('${vm.id}')" title="Stop"><i class="bi bi-stop-fill"></i> Stop</button>
          <button class="osv-btn" style="border-color:rgba(239,68,68,0.4);color:#f87171" onclick="forceStopVm('${vm.id}')" title="Stop Paksa (SIGKILL) — gunakan jika Stop biasa tidak mempan"><i class="bi bi-lightning-fill"></i></button>
          <button class="osv-btn" onclick="snapshotVm('${vm.id}')" title="Snapshot"><i class="bi bi-camera"></i></button>
          <button class="osv-btn" onclick="openVmModalById('${vm.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="osv-btn danger" onclick="deleteVm('${vm.id}')" title="Hapus"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `;
  }).join("");
}

async function loadVmList() {
  const container = document.getElementById("vm-list");
  if (!container) return;
  container.innerHTML = `<div class="osv-empty"><i class="bi bi-arrow-repeat"></i><h3>Memuat daftar VM...</h3></div>`;
  checkQemuStatus();
  try {
    const result = await virtualOSApi.list();
    if (!result?.success) {
      container.innerHTML = `<div class="osv-empty"><i class="bi bi-exclamation-triangle"></i><h3>Gagal memuat VM</h3><p>${result?.message || ""}</p></div>`;
      return;
    }
    const items = Array.isArray(result.items) ? result.items : [];
    vmListCache = items;
    updateOsvMetrics(items);
    renderVmFilteredList();
  } catch (err) {
    container.innerHTML = `<div class="osv-empty"><i class="bi bi-exclamation-triangle"></i><h3>Error</h3><p>${err?.message || "Gagal memuat VM"}</p></div>`;
  }
}

window.openVmModalById = function (id) {
  if (!id || !vmListCache) return;
  const vm = vmListCache.find((v) => v.id === id);
  if (vm) window.openVmModal(vm);
};

async function killAllQemu() {
  const confirm = await Swal.fire({
    title: window.t('dialog.kill_qemu.title'),
    text: window.t('dialog.kill_qemu.text'),
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#f0a040",
    confirmButtonText: window.t('dialog.kill_qemu.confirm'),
    cancelButtonText: window.t('dialog.kill_qemu.cancel'),
  });
  if (!confirm.isConfirmed) return;
  const result = await virtualOSApi.killAllQemu();
  if (result?.success) {
    showToast(window.t('toast.qemu.killed'), 2500, "success");
  } else {
    showToast(result?.message || "Gagal.", 3000, "error");
  }
  await loadVmList();
}

async function startVm(id) {
  // If already running, just focus the VNC window
  const card = document.querySelector(`.osv-card[data-vm-id="${id}"]`);
  const statusBadge = card?.querySelector(".osv-status-badge");
  if (statusBadge?.classList.contains("running")) {
    await virtualOSApi.focusVncWindow(id);
    return;
  }

  showToast(window.t('toast.vm.starting'), 1500, "info");
  const vmName = card?.querySelector("h4")?.textContent || id;
  const result = await virtualOSApi.start(id);
  if (!result?.success) {
    const msg = result?.message || "Gagal start VM.";
    const isLocked = msg.includes("terkunci") || msg.includes("locked") || msg.includes("image");
    await Swal.fire({
      title: window.t('dialog.vm_start_fail'),
      html: msg.replace(/\n/g, "<br>") +
        (isLocked ? `<br><br>${window.t('dialog.vm_start_fail_tip')}` : ""),
      icon: "error",
      confirmButtonText: window.t('common.close'),
    });
    await loadVmList();
    return;
  }
  showToast(window.t('toast.vm.started'), 2000, "success");
  if (result.wsPort) {
    await openVncViewer(result.wsPort, id, vmName);
  }
  await loadVmList();
}

async function forceStopVm(id) {
  const result = await virtualOSApi.forceStop(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.force_stop_error'), 3000, "error");
  } else {
    showToast(window.t('toast.vm.force_stopped'), 2000, "success");
  }
  await loadVmList();
}

async function stopVm(id) {
  const result = await virtualOSApi.stop(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.stop_error'), 3500, "error");
    return;
  }
  showToast(window.t('toast.vm.stopped'), 2000, "info");
  await loadVmList();
}

async function restartVm(id) {
  const result = await virtualOSApi.restart(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.restart_error'), 3500, "error");
    return;
  }
  showToast("VM direstart.", 2000, "info");
  await loadVmList();
}

async function snapshotVm(id) {
  const input = await Swal.fire({
    title: "Snapshot",
    input: "text",
    inputLabel: "Nama snapshot",
    inputPlaceholder: "Misal: sebelum update",
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
  });
  if (!input.isConfirmed) return;
  const result = await virtualOSApi.snapshot(
    id,
    input.value || "Snapshot"
  );
  if (!result?.success) {
    showToast(result?.message || "Gagal snapshot.", 3500, "error");
    return;
  }
  await loadVmList();
  showToast("Snapshot dibuat.", 2000, "success");
}

async function restoreVmSnapshot(id, snapshotId) {
  const confirm = await Swal.fire({
    title: "Restore Snapshot?",
    text: "Kondisi VM saat ini akan digantikan oleh snapshot. Perubahan setelah snapshot akan hilang.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Restore",
    cancelButtonText: "Batal",
  });
  if (!confirm.isConfirmed) return;
  showToast("Me-restore snapshot...", 2000, "info");
  const result = await virtualOSApi.snapshotRestore(id, snapshotId);
  if (!result?.success) {
    showToast(result?.message || "Gagal restore snapshot.", 4000, "error");
    return;
  }
  await loadVmList();
  showToast("Snapshot di-restore.", 2500, "success");
}

async function deleteVmSnapshot(id, snapshotId) {
  const confirm = await Swal.fire({
    title: "Hapus Snapshot?",
    text: "Data snapshot di dalam disk virtual juga akan dihapus.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal",
  });
  if (!confirm.isConfirmed) return;
  const result = await virtualOSApi.snapshotDelete(id, snapshotId);
  if (!result?.success) {
    showToast(result?.message || "Gagal menghapus snapshot.", 3500, "error");
    return;
  }
  await loadVmList();
  showToast("Snapshot dihapus.", 2000, "success");
}

async function openVncViewer(port, vmId, vmName) {
  if (!port) return;
  await virtualOSApi.openVncWindow({ vmId, wsPort: port, vmName });
}

async function browseVmIsoFile() {
  try {
    const isoInput = document.getElementById("vmIso");
    const result = await virtualOSApi.browseIsoFile();
    if (result?.success && result.path) {
      isoInput.value = result.path;
    } else if (!result?.canceled && result?.message) {
      showToast(result.message, 3000, "warning");
    }
  } catch (err) {
    console.warn("⚠️ Gagal membuka dialog ISO:", err?.message || err);
  }
}

async function populateCachedIsos() {
  const group = document.getElementById("vmCachedIsoGroup");
  if (!group) return;
  try {
    const cached = await virtualOSApi.listCachedIsos();
    group.innerHTML = "";
    cached.forEach(c => {
      const opt = document.createElement("option");
      opt.value = "__cached__" + c.localPath;
      opt.textContent = `✓ ${c.filename}${c.sizeMb ? ` (${c.sizeMb}MB)` : ""}`;
      group.appendChild(opt);
    });
    group.style.display = cached.length > 0 ? "" : "none";
  } catch (_) {
    if (group) group.style.display = "none";
  }
}

async function applyQuickIso() {
  const select = document.getElementById("vmQuickIso");
  const isoInput = document.getElementById("vmIso");
  const progressEl = document.getElementById("vmIsoDownloadProgress");
  let url = select?.value || "";
  if (!url) return;

  // Cached ISO: just set the path directly without downloading
  if (url.startsWith("__cached__")) {
    const localPath = url.slice("__cached__".length);
    if (isoInput) isoInput.value = localPath;
    showToast("ISO dipilih dari cache lokal", 2000, "success");
    select.value = "";
    return;
  }

  const filename = url.split("/").pop() || "os.iso";

  // Show progress UI
  if (progressEl) {
    progressEl.style.display = "flex";
    progressEl.querySelector(".iso-dl-label").textContent = `Mengunduh ${filename}...`;
    progressEl.querySelector(".iso-dl-bar-inner").style.width = "0%";
    progressEl.querySelector(".iso-dl-pct").textContent = "0%";
  }

  // Listen to progress
  const unsubProgress = virtualOSApi.onIsoDownloadProgress((data) => {
    if (data.filename !== filename) return;
    const pct = data.pct >= 0 ? data.pct : 0;
    if (progressEl) {
      progressEl.querySelector(".iso-dl-bar-inner").style.width = pct + "%";
      progressEl.querySelector(".iso-dl-pct").textContent = data.pct >= 0 ? pct + "%" : "...";
      const mb = (data.downloaded / 1024 / 1024).toFixed(1);
      const total = data.total > 0 ? ` / ${(data.total / 1024 / 1024).toFixed(1)} MB` : "";
      progressEl.querySelector(".iso-dl-label").textContent = `${filename}: ${mb} MB${total}`;
    }
  });

  try {
    const result = await virtualOSApi.downloadIso({ url, filename });
    unsubProgress();
    if (progressEl) progressEl.style.display = "none";

    if (!result?.success) {
      showToast("Gagal download ISO: " + (result?.message || ""), 4000, "error");
      select.value = "";
      return;
    }
    isoInput.value = result.localPath;
    showToast(result.cached ? `ISO sudah ada: ${filename}` : `ISO berhasil diunduh: ${filename}`, 2500, "success");
    select.value = "";
    populateCachedIsos();
  } catch (err) {
    unsubProgress();
    if (progressEl) progressEl.style.display = "none";
    showToast("Error download ISO: " + (err?.message || ""), 4000, "error");
    select.value = "";
  }
}

// ==================== OS Virtual Modal Functions ====================

window.openModalOSVirtual = function () {
  const modal = document.getElementById("addModalOSVirtual");
  if (!modal) return;

  // Reset form
  const nameInput = document.getElementById("osVirtualName");
  if (nameInput) nameInput.value = "";

  const downloadSelect = document.getElementById("osDownloadSelect");
  if (downloadSelect) downloadSelect.selectedIndex = 0;

  const isoFile = document.getElementById("osISOFile");
  if (isoFile) isoFile.value = "";

  // Reset to download method
  const downloadRadio = document.getElementById("osMethodDownload");
  if (downloadRadio) downloadRadio.checked = true;

  // Reset sections visibility
  const downloadSection = document.getElementById("osDownloadSection");
  const isoSection = document.getElementById("osISOSection");
  if (downloadSection) downloadSection.style.display = "block";
  if (isoSection) isoSection.style.display = "none";

  // Reset VM specs to default
  const ramSelect = document.getElementById("osVMRam");
  const coresSelect = document.getElementById("osVMCores");
  const diskSelect = document.getElementById("osVMDisk");
  const resolutionSelect = document.getElementById("osVMResolution");

  if (ramSelect) ramSelect.value = "2048";
  if (coresSelect) coresSelect.value = "2";
  if (diskSelect) diskSelect.value = "40";
  if (resolutionSelect) resolutionSelect.value = "1920x1080";

  modal.style.display = "flex";
};

window.closeModalOSVirtual = function () {
  const modal = document.getElementById("addModalOSVirtual");
  if (!modal) return;
  modal.style.display = "none";
};

window.toggleOSInstallMethod = function () {
  const downloadRadio = document.getElementById("osMethodDownload");
  const isoRadio = document.getElementById("osMethodISO");
  const downloadSection = document.getElementById("osDownloadSection");
  const isoSection = document.getElementById("osISOSection");

  if (!downloadSection || !isoSection) return;

  if (downloadRadio && downloadRadio.checked) {
    downloadSection.style.display = "block";
    isoSection.style.display = "none";
  } else if (isoRadio && isoRadio.checked) {
    downloadSection.style.display = "none";
    isoSection.style.display = "block";
  }
};

window.browseISOFile = async function () {
  try {
    const result = await virtualOSApi.browseIsoFile();

    if (result.success && result.path) {
      const isoPathInput = document.getElementById("osISOPath");
      if (isoPathInput) {
        isoPathInput.value = result.path;
      }
      console.log("📁 ISO file selected:", result.path);
    } else if (!result.canceled) {
      showToast(result.message || "Gagal memilih file ISO", 3000, "error");
    }
  } catch (err) {
    console.error("❌ Error browsing ISO file:", err);
    showToast("Error: " + err.message, 3000, "error");
  }
};

window.browseVmIsoFile = async function () {
  try {
    const result = await virtualOSApi.browseIsoFile();

    if (result.success && result.path) {
      const isoInput = document.getElementById("vmIso");
      if (isoInput) {
        isoInput.value = result.path;
      }
      console.log("📁 ISO file selected for VM:", result.path);
    } else if (!result.canceled) {
      showToast(result.message || "Gagal memilih file ISO", 3000, "error");
    }
  } catch (err) {
    console.error("❌ Error browsing ISO file:", err);
    showToast("Error: " + err.message, 3000, "error");
  }
};

window.submitOSVirtual = async function () {
  const name = document.getElementById("osVirtualName")?.value.trim() || "";
  const downloadRadio = document.getElementById("osMethodDownload");
  const isoRadio = document.getElementById("osMethodISO");

  // Validation
  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  const installMethod = downloadRadio?.checked ? "download" : "iso";
  let osSource = "";
  let isoPath = "";

  if (installMethod === "download") {
    const downloadSelect = document.getElementById("osDownloadSelect");
    osSource = downloadSelect?.value || "";
    if (!osSource) {
      showToast("Pilih OS yang akan didownload.", 3000, "warning");
      return;
    }
  } else {
    const isoPathInput = document.getElementById("osISOPath");
    isoPath = isoPathInput?.value.trim() || "";
    if (!isoPath) {
      showToast("Pilih file ISO terlebih dahulu.", 3000, "warning");
      return;
    }
  }

  // Get VM specifications
  const ramMb = parseInt(document.getElementById("osVMRam")?.value || "2048");
  const cores = parseInt(document.getElementById("osVMCores")?.value || "2");
  const diskGb = parseInt(document.getElementById("osVMDisk")?.value || "40");
  const resolution = document.getElementById("osVMResolution")?.value || "1920x1080";

  // Prepare device data
  const vmData = {
    name,
    service: "os-virtual",
    installMethod,
    osSource: installMethod === "download" ? osSource : "",
    isoPath: installMethod === "iso" ? isoPath : "",
    vmSpec: {
      ramMb,
      cores,
      diskGb,
      resolution,
    },
  };

  try {
    // TODO: Implement backend handler for OS Virtual
    // For now, show a message that the feature is in development
    console.log("VM Data to be saved:", vmData);

    showToast(
      "✅ Virtual Machine akan segera dibuat. Fitur ini sedang dalam pengembangan.",
      4000,
      "info"
    );

    // TODO: Call backend API to create VM
    // const result = await window.electronAPI.osVirtual.createVM(vmData);

    closeModalOSVirtual();

    // Show detailed info
    Swal.fire({
      title: "OS Virtual - Coming Soon",
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>Nama:</strong> ${name}</p>
          <p><strong>Metode:</strong> ${installMethod === "download" ? "Download OS" : "Upload ISO"}</p>
          ${installMethod === "download" ? `<p><strong>OS:</strong> ${osSource}</p>` : `<p><strong>ISO Path:</strong> ${isoPath}</p>`}
          <p><strong>RAM:</strong> ${ramMb} MB</p>
          <p><strong>CPU:</strong> ${cores} Cores</p>
          <p><strong>Disk:</strong> ${diskGb} GB</p>
          <p><strong>Resolution:</strong> ${resolution}</p>
        </div>
        <hr style="margin: 16px 0;">
        <p style="font-size: 13px; color: #666;">
          Fitur OS Virtual akan menggunakan QEMU atau VirtualBox untuk menjalankan VM.
          Backend sedang dalam pengembangan.
        </p>
      `,
      icon: "info",
      confirmButtonText: "OK",
    });
  } catch (err) {
    console.error("Error creating OS Virtual:", err);
    showToast("Error: " + err.message, 4000, "error");
  }
};

// OS Virtual modal tab switcher
window.osvTab = function(btn, panelId) {
  document.querySelectorAll(".osv-tab").forEach((t) => {
    t.style.borderBottomColor = "transparent";
    t.style.color = "#666";
  });
  btn.style.borderBottomColor = "#7c6fe0";
  btn.style.color = "#e0e0e0";
  document.querySelectorAll(".osv-tab-panel").forEach((p) => p.style.display = "none");
  const panel = document.getElementById(panelId);
  if (panel) panel.style.display = "";
};
window.osvNetworkChange = function() {
  const val = document.getElementById("vmNetwork")?.value;
  const bg = document.getElementById("vmBridgeGroup");
  if (bg) bg.style.display = val === "bridge" ? "" : "none";
};

function showQemuTutorial() {
  const modal = document.getElementById("qemuTutorialModal");
  if (modal) modal.style.display = "flex";
}

// Dulu dipanggil core saat startup; sekarang modul memuat daftar VM sendiri.
loadVmList();
