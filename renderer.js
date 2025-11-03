const serviceConfig = {
  wa: {
    label: "WhatsApp",
    color: "#25D366",
    url: "https://web.whatsapp.com",
  },
  telegram: {
    label: "Telegram",
    color: "#0088cc",
    url: "https://web.telegram.org/k/",
  },
  gmail: {
    label: "Gmail",
    color: "#EA4335",
    url: "https://mail.google.com",
  },
  shopee: {
    label: "Shopee",
    color: "#ee4d2d",
    url: "https://shopee.co.id/buyer/login",
  },
  shopee_affiliate: {
    label: "Shopee Affiliate",
    color: "#ee4d2d",
    url: "https://affiliate.shopee.co.id/",
  },
  default: {
    label: "Service",
    color: "#6b7280",
    url: "https://example.com",
  },
};

const automationConfig = {
  targetUid: "265846ad-1307-4437-a795-20680a83f8b6",
  messages: [
    {
      phone: "6285283935826",
      message: "👋 Hai Gingin! Semangat paginya 🌞",
      id: 32,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "🤔 Apa kabar hari ini? Semoga selalu baik dan produktif 💪",
      id: 33,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "🕒 Jangan lupa meeting jam 3 ya, jangan telat 😄",
      id: 34,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "💬 Ini contoh pesan keempat, buat tes kirim pesan otomatis 📱",
      id: 35,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "🚀 Proyek StarBox makin keren nih, terusin semangatnya! 🔥",
      id: 36,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "📦 Tes kirim pesan kelima, biar datanya makin lengkap ✨",
      id: 37,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "🧠 Ide bagus kadang datang pas santai, catat sebelum lupa 📝",
      id: 38,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "☕ Istirahat dulu bentar, recharge energi biar fokus lagi ⚡",
      id: 39,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message:
        "📢 Pengingat: testing auto-send WA masih pending, lanjut besok!",
      id: 40,
      status: "pending",
    },

    {
      phone: "6285283935826",
      message: "✅ Semua pesan sudah dikumpulkan, siap dikirim lewat API 💌",
      id: 41,
      status: "pending",
    },
  ],
};

let automationMessages = automationConfig.messages.map((item) => ({ ...item }));
let automationSending = false;
let automationTimer = null;

function pendingAutomationCount() {
  return automationMessages.filter((item) => item.status !== "done").length;
}

function renderSystemInfoBadge(info, error) {
  const badge = document.getElementById("system-info-badge");
  if (!badge) return;

  if (error || !info) {
    badge.textContent = "Info perangkat tidak tersedia";
    badge.title = error?.message || "";
    return;
  }

  const username = info.username || "unknown-user";
  const host = info.hostname || info.node || "unknown-host";
  const systemMeta =
    info.platform ||
    [info.system, info.release, info.machine].filter(Boolean).join(" ");

  const display = `${username}@${host}${
    systemMeta ? ` • ${systemMeta}` : ""
  }`;

  badge.textContent = display;
  badge.title = `User: ${username}\nHost: ${host}\nPlatform: ${
    systemMeta || "n/a"
  }`;
}

async function loadSystemInfoBadge() {
  try {
    const info = await window.electronAPI.getSystemInfo();
    renderSystemInfoBadge(info);
  } catch (err) {
    console.error("⚠️ Gagal memuat system info:", err);
    renderSystemInfoBadge(null, err);
  }
}

function markAutomationStatus(results = []) {
  const statusMap = new Map(
    results.map((item) => [item.id ?? item.phone, item.status ?? "pending"])
  );
  let updated = false;
  automationMessages = automationMessages.map((item) => {
    const key = item.id ?? item.phone;
    if (statusMap.has(key)) {
      let newStatus = statusMap.get(key);
      if (newStatus === 'failed') newStatus = 'done';
      if (item.status !== newStatus) {
        updated = true;
        return { ...item, status: newStatus };
      }
    }
    return item;
  });
  return updated;
}

function setDeviceState(uid, state) {
  const normalized = (state || "").toLowerCase();
  const card = document.querySelector(`.device[data-uid="${uid}"]`);
  if (!card) return;

  const isEngaged = ["active", "running", "starting"].includes(normalized);
  const displayLabel = isEngaged
    ? (normalized || "active").toUpperCase()
    : "START";
  const badgeButton = card.querySelector(".status-indicator");
  const runButton = card.querySelector(".run");
  const inlineStop = card.querySelector(".inline-stop");

  card.dataset.status = normalized;

  if (badgeButton) {
    badgeButton.dataset.status = normalized || "stopped";
    badgeButton.textContent = displayLabel;
    badgeButton.classList.remove("running", "active", "stopped");
    if (isEngaged) {
      badgeButton.classList.add("running");
    } else {
      badgeButton.classList.add("stopped");
    }
    badgeButton.title = isEngaged
      ? "Klik untuk menampilkan jendela"
      : "Klik untuk menjalankan device";
  }

  if (runButton) {
    if (isEngaged) {
      runButton.innerHTML = `<i class="bi bi-arrow-clockwise"></i><span>Restart</span>`;
    } else {
      runButton.innerHTML = `<i class="bi bi-play-fill"></i><span>Jalankan</span>`;
    }
    runButton.disabled = false;
  }

  if (inlineStop) {
    if (isEngaged) {
      inlineStop.classList.remove("is-hidden");
      inlineStop.disabled = false;
    } else {
      inlineStop.classList.add("is-hidden");
      inlineStop.disabled = false;
    }
  }
}

async function renderDevices(devices) {
  const container = document.getElementById("device-list");
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const device of devices) {
    const serviceKey = (device?.service || "").toLowerCase();
    const config = serviceConfig[serviceKey] || serviceConfig.default;
    const serviceLabel = config.label || device.service || "Unknown";
    const baseUrl = config.url || `https://${serviceKey}.com`;
    const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(
      baseUrl
    )}`;
    const initialStatus = (device.status || "stopped").toLowerCase();
    const isActive =
      initialStatus === "active" ||
      initialStatus === "running" ||
      initialStatus === "starting";
    const initialLabel = isActive
      ? (initialStatus || "active").toUpperCase()
      : "START";

    const deviceCard = document.createElement("div");
    deviceCard.className = "device";
    deviceCard.dataset.uid = device.uid;
    deviceCard.dataset.service = device.service || "";
    deviceCard.dataset.status = initialStatus;
    deviceCard.style.setProperty("--device-accent", config.color || "#6b7280");

    const runLabel = isActive ? "Restart" : "Jalankan";
    const runIcon = isActive ? "bi-arrow-clockwise" : "bi-play-fill";

    deviceCard.innerHTML = `
      <input type="checkbox"
             class="select-device"
             value="${device.uid}"
             data-service="${device.service || ""}"
             aria-label="Pilih ${device.name}">

      <div class="device-service-icon" title="Layanan: ${serviceLabel}">
        <img src="${faviconUrl}"
             alt="Ikon ${serviceLabel}"
             onerror="this.onerror=null;this.src='assets/starbox.png';">
      </div>

      <div class="device-header">
        <div class="device-meta">
          <h3>${device.name}</h3>
          <span class="device-service-name">${serviceLabel}</span>
        </div>
      </div>

      <div class="device-body">
        <button class="status-indicator ${
          isActive ? "running" : "stopped"
        }" data-uid="${device.uid}" title="${
      isActive
        ? "Klik untuk menampilkan jendela"
        : "Klik untuk menjalankan device"
    }">
          ${initialLabel}
        </button>
        <button class="inline-stop ${
          isActive ? "" : "is-hidden"
        }" title="Stop ${device.name}">
          <i class="bi bi-stop-circle"></i>
          <span>Stop</span>
        </button>
      </div>

      <div class="device-footer">
        <div class="device-actions">
          <button class="run">
            <i class="bi ${runIcon}"></i>
            <span>${runLabel}</span>
          </button>
          <button class="edit" data-uid="${device.uid}">
            <i class="bi bi-pencil-square"></i>
            <span>Edit</span>
          </button>
          <button class="delete">
            <i class="bi bi-trash-fill"></i>
            <span>Hapus</span>
          </button>
        </div>
      </div>
    `;

    const statusButton = deviceCard.querySelector(".status-indicator");
    const inlineStop = deviceCard.querySelector(".inline-stop");
    const runButton = deviceCard.querySelector(".run");
    const deleteButton = deviceCard.querySelector(".delete");
    const editButton = deviceCard.querySelector(".edit");

    statusButton?.addEventListener("click", () => {
      const currentStatus = (deviceCard.dataset.status || "").toLowerCase();
      if (currentStatus === "active" || currentStatus === "running") {
        if (window.electronAPI?.focusDevice) {
          window.electronAPI.focusDevice(device.uid);
        }
      } else {
        runDevice(device.uid, device.service);
      }
    });

    runButton.addEventListener("click", async () => {
      const originalHTML = runButton.innerHTML;
      runButton.innerHTML = `<i class="bi bi-arrow-repeat"></i> <span>Proses...</span>`;
      runButton.disabled = true;

      try {
        await runDevice(device.uid, device.service);
        device.status = "active";

        // Update UI
        setDeviceState(device.uid, "active");
        runButton.innerHTML = `<i class="bi bi-arrow-clockwise"></i> <span>Restart</span>`;
      } catch (err) {
        console.error("Gagal menjalankan device:", err);
        runButton.innerHTML = originalHTML;
      }

      runButton.disabled = false;
    });

    if (inlineStop) {
      inlineStop.addEventListener("click", () => {
        Swal.fire({
          title: `Hentikan ${device.name}?`,
          text: "Jendela device akan ditutup.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#6b7280",
          confirmButtonText: "Ya, hentikan",
        }).then((result) => {
          if (!result.isConfirmed) return;

          inlineStop.disabled = true;
          window.electronAPI.stopDevice(device.uid);
          setDeviceState(device.uid, "stopped");
          device.status = "stopped";
        });
      });
    }

    deleteButton.addEventListener("click", () => deleteDevice(device.uid));
    editButton.addEventListener("click", () => {
      window.currentEditUID = device.uid;
      window.currentEditService = device.service || '';
      document.getElementById("editDeviceName").value =
        deviceCard.querySelector("h3").textContent;
      document.getElementById("editAutoRun").checked = device.autoRun ?? false;
      document.getElementById("editMode").value = device.mode ?? "desktop";
      if (typeof setEditAutoSenderState === 'function') {
        setEditAutoSenderState(device.service, device.autoSender ?? false, device.pendingUrl ?? '');
      }

      openEditModal();
    });

    fragment.appendChild(deviceCard);

    // ✅ Jalankan jika autoRun diaktifkan
    // if (device.autoRun === true) {
    //   console.log(`🚀 Auto-run: ${device.name}`);
    //   runButton.click(); // Trigger tombol run
    // } else {
    //   console.log(`⏭️ Lewati auto-run: ${device.name}`);
    // }
  }

  container.appendChild(fragment);
}

async function sendAutomationQueue() {
  if (!automationConfig?.targetUid) {
    showToast("Konfigurasi automasi tidak ditemukan.", 3000, "error");
    return;
  }

  const card = document.querySelector(
    `.device[data-uid="${automationConfig.targetUid}"]`
  );
  const currentStatus = (card?.dataset.status || "").toLowerCase();
  if (!["active", "running"].includes(currentStatus)) {
    showToast(
      "Jalankan device WhatsApp terlebih dahulu sebelum mengirim pesan.",
      3500,
      "warning"
    );
    return;
  }

  const pending = automationMessages.filter((item) => item.status !== "done");
  if (!pending.length) {
    showToast("Semua pesan sudah terkirim.", 3000, "info");
    return;
  }

  if (automationSending) return;

  if (!navigator.onLine) {
    showToast(
      "Pastikan koneksi internet aktif sebelum menjalankan automasi.",
      3000,
      "warning"
    );
    return;
  }

  automationSending = true;
  loadAllDevices();

  try {
    const results = await window.electronAPI.sendWhatsappMessages(
      automationConfig.targetUid,
      pending
    );

    if (Array.isArray(results) && results.length) {
      const successCount = results.filter(
        (item) => item.status === "done"
      ).length;
      const updated = markAutomationStatus(results);
      if (updated && successCount > 0) {
        showToast(`Berhasil mengirim ${successCount} pesan.`, 3000, "success");
      }
      const failed = results.filter((item) => item.status !== "done");
      if (failed.length) {
        showToast(`${failed.length} pesan gagal dikirim.`, 3000, "warning");
        console.warn("Pesan gagal:", failed);
      }
      if (!updated && successCount === 0 && !failed.length) {
        showToast("Tidak ada pesan yang diperbarui.", 3000, "info");
      }
    } else {
      showToast("Automasi selesai tanpa respons pesan.", 3000, "warning");
    }
  } catch (err) {
    console.error("❌ Gagal menjalankan automasi WhatsApp:", err);
    showToast(
      err.message || "Gagal menjalankan automasi WhatsApp.",
      4000,
      "error"
    );
  } finally {
    automationSending = false;
    loadAllDevices();
  }
}

function stopAutomationLoop() {
  if (automationTimer) {
    clearInterval(automationTimer);
    automationTimer = null;
  }
}

async function tryAutomationTick() {
  if (automationSending) return;

  const pending = pendingAutomationCount();
  if (pending === 0) {
    stopAutomationLoop();
    return;
  }

  const card = document.querySelector(
    `.device[data-uid="${automationConfig.targetUid}"]`
  );
  if (!card) {
    return;
  }

  const status = (card.dataset.status || "").toLowerCase();
  const service = (card.dataset.service || "").toLowerCase();

  if (service !== "wa") {
    stopAutomationLoop();
    return;
  }

  if (!["active", "running"].includes(status)) {
    console.log("⏸️ Automation menunggu device dijalankan secara manual.");
    return;
  }

  await sendAutomationQueue();
}

function ensureAutomationLoop() {
  if (automationTimer) return;

  automationTimer = setInterval(() => {
    tryAutomationTick().catch((err) =>
      console.error("Automation loop error:", err)
    );
  }, 15000);

  // Jalankan percobaan pertama sesaat setelah loop dibuat.
  setTimeout(() => {
    tryAutomationTick().catch((err) =>
      console.error("Automation loop error:", err)
    );
  }, 3000);
}

function loadAllDevices() {
  window.electronAPI.loadDevices().then((data) => {
    const devices = data.devices || [];
    console.log("📦 Daftar device:", devices);
    renderDevices(devices);
    devices.forEach((device) => setDeviceState(device.uid, device.status));
    if (pendingAutomationCount() > 0) {
      ensureAutomationLoop();
    } else {
      stopAutomationLoop();
    }
  });
}

function runDevice(uid, service) {
  window.electronAPI.runDevice(uid, service);
  setDeviceState(uid, "active");
}

function stopDevice(uid) {
  window.electronAPI.stopDevice(uid);
  setDeviceState(uid, "stopped");
}

function deleteDevice(uid) {
  Swal.fire({
    title: "Anda Yakin?",
    text: "Device akan dihapus secara permanen dan tidak bisa dikembalikan!",
    icon: "warning",
    showCancelButton: true,
    // Praktik UX yang baik: tombol konfirmasi untuk aksi berbahaya berwarna merah
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Ya, Hapus Saja!",
    cancelButtonText: "Batal",
  }).then((result) => {
    if (result.isConfirmed) {
      // Panggil API dan harapkan respons berupa objek { success, message }
      window.electronAPI
        .deleteDevice(uid)
        .then((response) => {
          if (response.success) {
            showToast("Device berhasil dihapus.", 3000, "success");
            loadAllDevices(); // Muat ulang daftar
          } else {
            showToast(
              response.message || "Gagal menghapus device.",
              3000,
              "error"
            );
          }
        })
        .catch((err) => {
          console.error("IPC Error saat memanggil deleteDevice:", err);
          showToast(
            "Terjadi kesalahan komunikasi saat mencoba menghapus device.",
            3000,
            "error"
          );
        });
    }
  });
}

function openModal() {
  document.getElementById("addModal").style.display = "block";
  if (typeof refreshAddAutoSenderUI === 'function') {
    refreshAddAutoSenderUI();
  }
}

function closeModal() {
  document.getElementById("addModal").style.display = "none";
  const nameEl = document.getElementById("deviceName");
  const autoRunEl = document.getElementById("deviceAutoRun");
  const autoSenderEl = document.getElementById("deviceAutoSender");
  const pendingUrlEl = document.getElementById("devicePendingUrl");
  if (nameEl) nameEl.value = "";
  if (autoRunEl) autoRunEl.checked = false;
  if (autoSenderEl) autoSenderEl.checked = false;
  if (pendingUrlEl) pendingUrlEl.value = "";
  if (typeof refreshAddAutoSenderUI === 'function') {
    refreshAddAutoSenderUI();
  }
}

async function submitDevice() {
  const name = document.getElementById("deviceName").value.trim();
  const service = document.getElementById("deviceService").value;
  const mode = document.getElementById("deviceMode").value;
  const autoRun = document.getElementById("deviceAutoRun").checked;
  const autoSenderCheckbox = document.getElementById("deviceAutoSender");
  const pendingUrlInput = document.getElementById("devicePendingUrl");
  const isWhatsApp = (service || '').toLowerCase() === 'wa';
  const autoSenderEnabled = isWhatsApp && autoSenderCheckbox?.checked;
  const pendingUrl = autoSenderEnabled ? (pendingUrlInput?.value || '').trim() : '';

  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  try {
    const result = await window.electronAPI.addDevice({
      name,
      service,
      autoRun,
      mode,
      autoSender: autoSenderEnabled,
      pendingUrl
    });
    if (result.success) {
      showToast(`Device ${name} berhasil ditambahkan.`, 3000, "success");
      closeModal();
      document.getElementById("deviceName").value = "";
      loadAllDevices();
    } else {
      showToast(
        result.message || "Tidak bisa menambahkan device.",
        3000,
        "error"
      );
    }
  } catch (err) {
    showToast(
      err.message || "Terjadi kesalahan saat menambahkan device.",
      3000,
      "error"
    );
  }
}

// Jalankan saat awal
window.addEventListener("DOMContentLoaded", () => {
  loadAllDevices();
  loadSystemInfoBadge();
  if (typeof refreshAddAutoSenderUI === 'function') refreshAddAutoSenderUI();

  // Update status otomatis
  window.electronAPI.onDeviceStatusUpdated((uid) => {
    console.log("📶 Status device berubah:", uid);
    setDeviceState(uid, "active");
    loadAllDevices();
  });
});
function restartDevice(uid, service) {
  // Close window by killing process (optional improvement: track PID)
  // Di sini kita hanya ubah status dan jalankan ulang
  window.electronAPI.log(`♻️ Restarting device ${uid}`);
  window.electronAPI.runDevice(uid, service); // ini akan buka window baru
  setDeviceState(uid, "active");
}
function selectAllDevices(master) {
  document.querySelectorAll(".select-device").forEach((cb) => {
    cb.checked = master.checked;
  });
}

// Function: Run All Device
function runAllDevices() {
  const allDevices = document.querySelectorAll(".device");
  if (allDevices.length === 0) return;
  allDevices.forEach((card) => {
    const uid = card.dataset.uid;
    const service = card.dataset.service;
    if (uid && service) {
      runDevice(uid, service);
    }
  });
}

// Function: Run Selected Device
function runSelectedDevices() {
  const selected = Array.from(
    document.querySelectorAll(".select-device:checked")
  );
  if (selected.length === 0) return alert("Pilih device terlebih dahulu!");
  selected.forEach((cb) => {
    const uid = cb.value;
    const service = cb.getAttribute("data-service");
    // Panggil fungsi runDevice (pastikan ada di global scope)
    runDevice(uid, service);
  });
}

function restartSelectedDevices() {
  const selected = Array.from(
    document.querySelectorAll(".select-device:checked")
  );
  if (selected.length === 0) return alert("Pilih device terlebih dahulu!");
  selected.forEach((cb) => {
    const uid = cb.value;
    const service = cb.getAttribute("data-service");
    runDevice(uid, service);
  });
}

function restartAllDevices() {
  const allDevices = document.querySelectorAll(".device");
  if (allDevices.length === 0) return;
  allDevices.forEach((card) => {
    const uid = card.dataset.uid;
    const service = card.dataset.service;
    if (uid && service) {
      runDevice(uid, service);
    }
  });
}

function stopSelectedDevices() {
  const selected = Array.from(
    document.querySelectorAll(".select-device:checked")
  );
  if (selected.length === 0) return alert("Pilih device terlebih dahulu!");
  Swal.fire({
    title: `Hentikan ${selected.length} device?`,
    text: "Semua jendela yang dipilih akan ditutup.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Ya, hentikan",
  }).then((result) => {
    if (!result.isConfirmed) return;
    selected.forEach((cb) => {
      const uid = cb.value;
      const card = document.querySelector(`.device[data-uid="${uid}"]`);
      const status = (card?.dataset.status || "").toLowerCase();
      if (!["active", "running", "starting"].includes(status)) return;
      stopDevice(uid);
    });
  });
}

function stopAllDevices() {
  const allDevices = Array.from(document.querySelectorAll(".device"));
  if (allDevices.length === 0) return;
  Swal.fire({
    title: "Hentikan semua device?",
    text: "Seluruh jendela yang aktif akan ditutup.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Ya, hentikan semua",
  }).then((result) => {
    if (!result.isConfirmed) return;
    allDevices.forEach((card) => {
      const uid = card.dataset.uid;
      const status = (card.dataset.status || "").toLowerCase();
      if (!uid || !["active", "running", "starting"].includes(status)) return;
      stopDevice(uid);
    });
  });
}
async function loadAbout() {
  const about = await window.electron.invoke("get-about-info");
  document.getElementById("appName").innerText = about.name;
  document.getElementById("appVersion").innerText = about.version;
  document.getElementById("appDescription").innerText = about.description;
}

async function saveAbout() {
  const newAbout = {
    name: document.getElementById("inputName").value,
    version: document.getElementById("inputVersion").value,
    description: document.getElementById("inputDescription").value,
  };
  await window.electron.invoke("update-about-info", newAbout);
  loadAbout(); // refresh tampilan
}

Object.assign(window, {
  runAllDevices,
  runSelectedDevices,
  restartSelectedDevices,
  restartAllDevices,
  stopSelectedDevices,
  stopAllDevices,
  stopDevice,
  restartDevice,
  selectAllDevices,
  sendAutomationQueue,
});
