// ═══════════════════════════════════════════════════════════════════════════════
// Modul Android / iOS — sisi renderer (halaman Android / iOS, modal, aksi massal,
// ADB remote, scrcpy, iOS). Dimuat oleh core (module-host.js) setelah renderer.js
// dan berbagi lingkup global dengan renderer.js.
// ═══════════════════════════════════════════════════════════════════════════════

// API Android / iOS lewat bridge modul (window.electronAPI.modules).
// Dipakai renderer modul, android-emulator.html dan ios-simulator.html.
const androidEmuApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    checkInstallation: call("android-check-installation"),
    getVersions: call("android-get-versions"),
    getStatus: call("android-get-status"),
    getDeviceInfo: call("android-get-device-info"),
    download: call("android-download"),
    start: call("android-start"),
    stop: call("android-stop"),
    fixIssues: call("android-fix-issues"),
    killAdb: call("android-kill-adb"),
    accelStatus: call("android-accel-status"),
    enableAcceleration: call("android-enable-acceleration"),
    onDownloadProgress: (cb) => m.on("android-download-progress", cb),
    onStartProgress: (cb) => m.on("android-start-progress", cb),
    onFixProgress: (cb) => m.on("android-fix-progress", cb),
  };
})();

const androidRemoteApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    getDevices: call("android-remote-load"),
    addDevice: call("android-remote-add"),
    editDevice: call("android-remote-edit"),
    updateDevice: call("android-remote-update"),
    deleteDevice: call("android-remote-delete"),
    updateStatus: call("android-remote-update-status"),
    listAdbDevices: call("android-list-physical-devices"),
    runAction: call("android-remote-run-action"),
    openDisplay: call("android-remote-open-display"),
    closeDisplay: call("android-remote-close-display"),
    checkScrcpy: call("scrcpy-check"),
    installScrcpy: call("scrcpy-install"),
    sendShortcut: call("android-remote-send-shortcut"),
    captureScreenshot: call("android-remote-screenshot"),
    scanLocalWifi: call("android-scan-local-wifi"),
    connectManualAdb: call("android-connect-manual-adb"),
    cancelAction: call("android-remote-cancel-action"),
    onStatusUpdated: (cb) => m.on("android-remote-status-updated", cb),
    onWifiScanProgress: (cb) => m.on("adb-wifi-scan-progress", cb),
    onScrcpyInstallProgress: (cb) => m.on("scrcpy-install-progress", cb),
  };
})();

const iosApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  return {
    checkAvailability: call("ios-check-availability"),
    getDevices: call("ios-get-devices"),
    boot: call("ios-boot"),
    shutdown: call("ios-shutdown"),
    shutdownAll: call("ios-shutdown-all"),
    installApp: call("ios-install-app"),
    launchApp: call("ios-launch-app"),
    uninstallApp: call("ios-uninstall-app"),
    openURL: call("ios-open-url"),
    getScreenshot: call("ios-get-screenshot"),
    eraseDevice: call("ios-erase-device"),
    isBooted: call("ios-is-booted"),
    onBootProgress: (cb) => m.on("ios-boot-progress", cb),
  };
})();

window.androidEmuApi = androidEmuApi;
window.androidRemoteApi = androidRemoteApi;
window.iosApi = iosApi;

const DEFAULT_ANDROID_SPEC_ID = "balanced";

const ANDROID_SPEC_PRESETS = [
  {
    id: "lite",
    label: "Lite • 1 Core • 1 GB RAM",
    description:
      "Mode paling ringan untuk PC kentang. Cocok hanya membuka aplikasi ringan.",
    memoryMb: 1024,
    cores: 1,
    resolution: "540x960",
    density: 220,
  },
  {
    id: "balanced",
    label: "Balanced • 2 Core • 1.5 GB RAM",
    description: "Rekomendasi default untuk performa stabil & kompatibel.",
    memoryMb: 1536,
    cores: 2,
    resolution: "720x1280",
    density: 265,
  },
  {
    id: "performance",
    label: "Performance • 4 Core • 2 GB RAM",
    description: "Untuk PC lebih kuat (butuh ~4GB RAM bebas). Resolusi 1080p.",
    memoryMb: 2048,
    cores: 4,
    resolution: "1080x1920",
    density: 420,
  },
];

const ANDROID_SPEC_PRESET_MAP = new Map(
  ANDROID_SPEC_PRESETS.map((preset) => [preset.id, preset])
);

const ANDROID_REMOTE_SERVICE_IDS = [
  "android-general",
  "android-whatsapp",
];

let cachedAndroidRemoteDevices = [];

let _androidAddType = 'adb'; // 'adb' | 'emulator'

let cachedAdbDevices = [];

const scrcpyStatusState = {
  installed: false,
  checking: false,
  installing: false,
  progressPercent: null,
  progressMessage: "",
};

function getAndroidSpecPreset(specId = DEFAULT_ANDROID_SPEC_ID) {
  return (
    ANDROID_SPEC_PRESET_MAP.get((specId || "").toLowerCase()) ||
    ANDROID_SPEC_PRESET_MAP.get(DEFAULT_ANDROID_SPEC_ID)
  );
}

function getAndroidSpecPayload(specId = DEFAULT_ANDROID_SPEC_ID) {
  const preset = getAndroidSpecPreset(specId);
  return {
    id: preset.id,
    label: preset.label,
    memoryMb: preset.memoryMb,
    cores: preset.cores,
    resolution: preset.resolution,
    density: preset.density,
    description: preset.description,
  };
}

function ensureAndroidSpecSelectOptions(selectId, descriptionId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = "";
  ANDROID_SPEC_PRESETS.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    option.dataset.description = preset.description;
    select.appendChild(option);
  });
  select.value = DEFAULT_ANDROID_SPEC_ID;
  updateAndroidSpecDescription(selectId, descriptionId);
  select.addEventListener("change", () =>
    updateAndroidSpecDescription(selectId, descriptionId)
  );
}

function updateAndroidSpecDescription(selectId, descriptionId) {
  const select = document.getElementById(selectId);
  const descEl = document.getElementById(descriptionId);
  if (!select || !descEl) return;
  const preset = getAndroidSpecPreset(select.value);
  descEl.textContent = preset?.description || "";
}

function toggleAndroidSpecSection(show) {
  const section = document.getElementById("androidSpecSection");
  if (section) {
    section.style.display = show ? "block" : "none";
  }
}

function toggleEditAndroidSpecSection(show) {
  const section = document.getElementById("editAndroidSpecSection");
  if (section) {
    section.style.display = show ? "block" : "none";
  }
}

window.getAndroidSpecPayload = getAndroidSpecPayload;

window.updateAndroidSpecDescription = updateAndroidSpecDescription;

window.DEFAULT_ANDROID_SPEC_ID = DEFAULT_ANDROID_SPEC_ID;

let cachedAndroidDevices = [];

function updateIOSButtonVisibility() {
  const button = document.getElementById("iosSimulatorButton");
  const buttonAndroid = document.getElementById("iosSimulatorButtonAndroid");

  const isMac =
    (systemPlatform || "").toLowerCase().includes("darwin") ||
    (systemPlatform || "").toLowerCase().includes("mac");
  const canShow = authState.allowsIosSimulator !== false && isMac;

  if (button) button.style.display = canShow ? "inline-flex" : "none";
  if (buttonAndroid)
    buttonAndroid.style.display = canShow ? "inline-flex" : "none";
}

function getAndroidRemoteServiceMeta(serviceId) {
  const key = sanitizeServiceId(serviceId);
  const meta =
    SERVICE_LIBRARY_MAP.get(key) || serviceConfig[key] || serviceConfig.default;
  return {
    id: key,
    label: meta?.label || serviceId || "Android Remote",
    color: meta?.color || "#6b7280",
    description: meta?.description || "",
  };
}

function getEffectiveAndroidServiceId(device = {}) {
  const baseService = sanitizeServiceId(device.service);
  if (baseService === "android") {
    return sanitizeServiceId(
      device.androidAutomationService || "android-general"
    );
  }
  return baseService || "android-general";
}

function isAndroidWhatsAppService(serviceId = "") {
  return sanitizeServiceId(serviceId) === "android-whatsapp";
}

function getAndroidRemoteServiceOptions() {
  return ANDROID_REMOTE_SERVICE_IDS.map((id) =>
    getAndroidRemoteServiceMeta(id)
  );
}

function formatAndroidRemoteStatus(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "connected" || normalized === "active") {
    return { label: "Connected", className: "status-chip connected" };
  }
  if (normalized === "running") {
    return { label: "Running", className: "status-chip connected" };
  }
  if (normalized === "error") {
    return { label: "Error", className: "status-chip error" };
  }
  if (normalized === "disconnected" || normalized === "stopped") {
    return { label: "Disconnected", className: "status-chip disconnected" };
  }
  return { label: status || "Unknown", className: "status-chip" };
}

let isLoadingAdbDevices = false;

async function maybeScanLocalWifiForAdb(
  showToastMessage = false,
  scanMode = "quick"
) {
  const api = androidRemoteApi;
  if (!api?.scanLocalWifi) return null;
  try {
    const result = await api.scanLocalWifi({ scanMode });
    if (showToastMessage) {
      if (result?.success) {
        const newCount = Array.isArray(result.connected)
          ? result.connected.length
          : 0;
        if (newCount > 0) {
          showToast(
            `Scan Wi-Fi menemukan ${newCount} device siap ADB.`,
            3200,
            "success"
          );
        } else if (result.scanned) {
          showToast("Scan Wi-Fi selesai, tidak ada device baru.", 2800, "info");
        }
      } else {
        showToast(
          result?.message || "Scan Wi-Fi gagal dijalankan.",
          3200,
          "error"
        );
      }
    }
    return result;
  } catch (err) {
    console.warn("⚠️ Scan Wi-Fi ADB gagal:", err);
    if (showToastMessage) {
      showToast(err?.message || "Scan Wi-Fi gagal.", 3200, "error");
    }
    return null;
  }
}

// Progress bar helpers
function showAdbScanProgress() {
  const progressEl = document.getElementById("adbScanProgress");
  const btnRefresh = document.getElementById("btnRefreshAdb");
  if (progressEl) progressEl.style.display = "block";
  if (btnRefresh) btnRefresh.disabled = true;
}

function hideAdbScanProgress() {
  const progressEl = document.getElementById("adbScanProgress");
  const btnRefresh = document.getElementById("btnRefreshAdb");
  if (progressEl) progressEl.style.display = "none";
  if (btnRefresh) btnRefresh.disabled = false;
}

function updateAdbScanProgress(percent, status) {
  const progressBar = document.getElementById("adbScanProgressBar");
  const percentEl = document.getElementById("adbScanPercent");
  const statusEl = document.getElementById("adbScanStatus");

  if (progressBar) progressBar.style.width = `${percent}%`;
  if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
  if (statusEl) statusEl.textContent = status;
}

let wifiScanProgressListener = null;

let foundDevicesDuringLiveScan = new Set();

async function refreshAdbDeviceOptionsInternal(
  selectId = "androidAdbDeviceSelect",
  { showToastMessage = false } = {}
) {
  const select = document.getElementById(selectId);
  if (!select || isLoadingAdbDevices) return;
  isLoadingAdbDevices = true;
  foundDevicesDuringLiveScan.clear();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Memuat perangkat ADB...";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.innerHTML = "";
  select.appendChild(placeholder);

  // Show progress bar
  showAdbScanProgress();

  // Setup real-time WiFi scan progress listener
  if (androidRemoteApi.onWifiScanProgress) {
    // Remove old listener if exists
    if (wifiScanProgressListener) {
      wifiScanProgressListener();
    }

    wifiScanProgressListener =
      androidRemoteApi.onWifiScanProgress((data) => {
        const { progress, foundDevices, newDevice, completed } = data;

        // Update progress bar
        if (progress !== undefined) {
          const status = completed
            ? "Selesai!"
            : `Scanning WiFi (${Math.round(progress)}%)...`;
          updateAdbScanProgress(
            Math.max(20, Math.min(90, progress * 0.7 + 20)),
            status
          );
        }

        // Add newly found device to dropdown immediately
        if (newDevice && !foundDevicesDuringLiveScan.has(newDevice)) {
          foundDevicesDuringLiveScan.add(newDevice);

          // Remove placeholder if this is the first device
          if (select.options.length === 1 && select.options[0].disabled) {
            select.innerHTML = "";
            const newPlaceholder = document.createElement("option");
            newPlaceholder.value = "";
            newPlaceholder.textContent = "Pilih perangkat ADB...";
            newPlaceholder.disabled = true;
            newPlaceholder.selected = true;
            select.appendChild(newPlaceholder);
          }

          // Add the new device option
          const option = document.createElement("option");
          option.value = newDevice;
          option.textContent = `📱 ${newDevice} (WiFi)`;
          select.appendChild(option);

          console.log(`✅ Real-time: Added ${newDevice} to dropdown`);
        }
      });
  }

  try {
    // Get scan options from checkboxes
    const scanUsb = document.getElementById("adbScanUsb");
    const scanWifiQuick = document.getElementById("adbScanWifiQuick");
    const scanWifiDeep = document.getElementById("adbScanWifiDeep");

    const shouldScanUsb = scanUsb && scanUsb.checked;
    const shouldScanWifi =
      (scanWifiQuick && scanWifiQuick.checked) ||
      (scanWifiDeep && scanWifiDeep.checked);
    const scanMode = scanWifiDeep && scanWifiDeep.checked ? "deep" : "quick";

    // Validate: at least one option must be selected
    if (!shouldScanUsb && !shouldScanWifi) {
      showToast("Pilih minimal 1 mode scan (USB atau WiFi)", 3000, "error");
      return;
    }

    let progress = 10;

    // Step 1: USB scan (instant if enabled)
    if (shouldScanUsb) {
      updateAdbScanProgress(progress, "Memeriksa perangkat USB...");
      progress += 10;
      // USB devices are automatically detected by adb devices command
      // No explicit scan needed, just a small delay for UX
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Step 2: WiFi scan (if enabled)
    if (shouldScanWifi) {
      const scanModeLabel =
        scanMode === "deep"
          ? "Deep Scan (30000-49999)"
          : "Quick Scan (port umum)";
      updateAdbScanProgress(progress, `${scanModeLabel}: Scanning WiFi...`);
      await maybeScanLocalWifiForAdb(showToastMessage, scanMode);
      progress = 90;
    }

    updateAdbScanProgress(progress, "Mengambil daftar perangkat...");

    const response =
      (await androidRemoteApi.listAdbDevices()) || {};
    const list = Array.isArray(response.devices) ? response.devices : [];
    cachedAdbDevices = list;

    updateAdbScanProgress(100, "Selesai!");

    // Only update dropdown if no devices were found during live scan
    if (foundDevicesDuringLiveScan.size === 0) {
      applyAdbDevicesToSelect(select, list);
    } else {
      // Merge with any USB devices that weren't in the WiFi scan
      const wifiDeviceIds = Array.from(foundDevicesDuringLiveScan);
      const usbDevices = list.filter((d) => !wifiDeviceIds.includes(d.id));

      // Add USB devices if any
      usbDevices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = `📱 ${device.name || device.id}`;
        select.appendChild(option);
      });
    }

    if (showToastMessage) {
      if (response.success) {
        showToast(`Perangkat ADB terdeteksi: ${list.length}.`, 2500, "success");
      } else {
        showToast(
          response.message || "Gagal memuat perangkat ADB.",
          3500,
          "error"
        );
      }
    }
  } catch (err) {
    console.error("⚠️ Gagal memuat perangkat ADB:", err);
    if (foundDevicesDuringLiveScan.size === 0) {
      select.innerHTML =
        '<option value="">Tidak dapat memuat perangkat ADB</option>';
    }
    if (showToastMessage) {
      showToast("Tidak dapat membaca daftar ADB.", 3500, "error");
    }
  } finally {
    isLoadingAdbDevices = false;
    // Cleanup listener
    if (wifiScanProgressListener) {
      wifiScanProgressListener();
      wifiScanProgressListener = null;
    }
    // Hide progress bar after delay
    setTimeout(hideAdbScanProgress, 500);
  }
}

// Toggle between Scan and Manual input modes
function toggleAdbInputMode() {
  const scanMode = document.getElementById("adbModeScan");
  const manualMode = document.getElementById("adbModeManual");
  const scanSection = document.getElementById("adbScanOptionsSection");
  const manualSection = document.getElementById("adbManualInputSection");

  if (manualMode && manualMode.checked) {
    // Show manual input, hide scan options
    if (scanSection) scanSection.style.display = "none";
    if (manualSection) manualSection.style.display = "block";
  } else {
    // Show scan options, hide manual input
    if (scanSection) scanSection.style.display = "block";
    if (manualSection) manualSection.style.display = "none";
  }
}

// Connect to manually entered IP:port
async function connectManualAdbDevice() {
  const ipInput = document.getElementById("adbManualIp");
  const portInput = document.getElementById("adbManualPort");
  const select = document.getElementById("androidAdbDeviceSelect");

  if (!ipInput || !portInput) return;

  const ip = ipInput.value.trim();
  const port = portInput.value.trim();

  if (!ip || !port) {
    showToast("Harap isi IP Address dan Port!", 3000, "error");
    return;
  }

  // Validate IP format (basic)
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) {
    showToast("Format IP Address tidak valid!", 3000, "error");
    return;
  }

  // Validate port (1-65535)
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    showToast("Port harus antara 1-65535!", 3000, "error");
    return;
  }

  showToast(`Connecting ke ${ip}:${port}...`, 2000, "info");

  try {
    const api = androidRemoteApi;
    if (!api?.connectManualAdb) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    const result = await api.connectManualAdb({ ip, port });

    if (result?.success) {
      showToast(`✅ Berhasil connect ke ${ip}:${port}!`, 3000, "success");

      // Add to dropdown
      if (select && result.deviceId) {
        const option = document.createElement("option");
        option.value = result.deviceId;
        option.textContent = `📱 ${result.deviceName || result.deviceId}`;
        option.selected = true;
        select.appendChild(option);
      }

      // Clear inputs
      ipInput.value = "";
      portInput.value = "";

      // Switch back to scan mode
      const scanModeRadio = document.getElementById("adbModeScan");
      if (scanModeRadio) {
        scanModeRadio.checked = true;
        toggleAdbInputMode();
      }
    } else {
      showToast(result?.message || "Gagal connect ke device!", 4000, "error");
    }
  } catch (err) {
    console.error("❌ Error connecting manual ADB:", err);
    showToast(err?.message || "Gagal connect ke device!", 4000, "error");
  }
}

function applyAdbDevicesToSelect(select, devices = []) {
  select.innerHTML = "";
  if (!devices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Tidak ada device ADB terdeteksi";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
    return;
  }
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pilih perangkat ADB...";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.adbId;
    const parts = [
      device.description || device.model,
      `(${device.adbId})`,
      device.status === "device" ? "online" : device.status,
    ].filter(Boolean);
    option.textContent = parts.join(" ");
    select.appendChild(option);
  });
}

function populateAndroidRemoteServiceSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = "";
  const options = getAndroidRemoteServiceOptions();
  options.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.label;
    select.appendChild(option);
  });
}

function getNormalizedCallbackInput(baseUrl = "", callbackUrl = "") {
  const override = sanitizePendingUrl(callbackUrl);
  if (override) return override;
  return extractUrlRoot(baseUrl);
}

async function syncAndroidWhatsappMonitorSource(devices = [], options = {}) {
  const { silent = false } = options;
  const candidates = (Array.isArray(devices) ? devices : [])
    .filter((device) => {
      const serviceId = getEffectiveAndroidServiceId(device);
      const pendingUrl = sanitizePendingUrl(
        device?.whatsappBaseUrl || device?.pendingUrl || ""
      );
      return isAndroidWhatsAppService(serviceId) && !!pendingUrl;
    })
    .map((device) => ({
      uid: device.uid,
      service: "android-whatsapp",
      pendingUrl: sanitizePendingUrl(
        device.whatsappBaseUrl || device.pendingUrl || ""
      ),
      callbackUrl: sanitizePendingUrl(
        device.whatsappCallbackUrl || device.callbackUrl || ""
      ),
      name: device.name || device.deviceName || device.uid,
    }));

  const activeUidSet = new Set(candidates.map((device) => device.uid));

  for (const [uid, session] of Array.from(automationSessions.entries())) {
    if (
      (session?.service || "").toLowerCase() === "android-whatsapp" &&
      !activeUidSet.has(uid)
    ) {
      closeAutomationMonitor(uid);
      removeAutomationSession(uid);
    }
  }

  for (const device of candidates) {
    const session = getOrCreateAutomationSession(device);
    session.service = "android-whatsapp";
    session.pendingUrl = device.pendingUrl;
    session.callbackUrl = device.callbackUrl;
    session.deviceName = device.name;

    if (!automationTargetOrder.includes(device.uid)) {
      automationTargetOrder.push(device.uid);
    }

    if (!silent && window.electronAPI?.ensureMonitorWindow) {
      window.electronAPI.ensureMonitorWindow(device.uid);
    }

    if (!(session.messages || []).length) {
      await refreshAutomationMessagesForSession(session, { silent: true });
    } else {
      broadcastAutomationMonitor(session);
    }
  }

  if (!automationPrimaryUid && candidates.length) {
    automationPrimaryUid = candidates[0].uid;
    activateAutomationSession(automationPrimaryUid);
    persistActiveAutomationSession();
  }
}

let currentAndroidFilter = "all";

let androidSearchQuery = "";

function updateAndroidDashboardMetrics(devices = []) {
  const total = devices.length;
  let running = 0;
  let emus = 0;
  let physical = 0;
  let stopped = 0;

  devices.forEach((d) => {
    const isEmu = d._deviceType === "emulator";
    if (isEmu) emus++;
    else physical++;

    const status = String(d.status || "").toLowerCase();
    const isActive = ["running", "active", "starting", "connected"].includes(status);
    if (isActive) {
      running++;
    } else {
      stopped++;
    }
  });

  const totalEl = document.getElementById("metricAndroidTotal");
  if (totalEl) totalEl.textContent = total;
  const runningEl = document.getElementById("metricAndroidRunning");
  if (runningEl) runningEl.textContent = running;
  const emusEl = document.getElementById("metricAndroidEmus");
  if (emusEl) emusEl.textContent = emus;
  const physicalEl = document.getElementById("metricAndroidPhysical");
  if (physicalEl) physicalEl.textContent = physical;

  const bAll = document.getElementById("badgeAndroidAll");
  if (bAll) bAll.textContent = total;
  const bRunning = document.getElementById("badgeAndroidRunning");
  if (bRunning) bRunning.textContent = running;
  const bEmu = document.getElementById("badgeAndroidEmulator");
  if (bEmu) bEmu.textContent = emus;
  const bPhysical = document.getElementById("badgeAndroidPhysical");
  if (bPhysical) bPhysical.textContent = physical;
  const bStopped = document.getElementById("badgeAndroidStopped");
  if (bStopped) bStopped.textContent = stopped;
}

window.applyAndroidFilter = function (filter) {
  currentAndroidFilter = filter || "all";
  const chips = document.querySelectorAll("#androidFilterChips .filter-chip");
  chips.forEach((chip) => {
    if (chip.dataset.filter === currentAndroidFilter) {
      chip.classList.add("is-active");
    } else {
      chip.classList.remove("is-active");
    }
  });
  renderDevicesAndroid(cachedAndroidRemoteDevices);
};

window.filterAndroidBySearch = function (query) {
  androidSearchQuery = (query || "").trim().toLowerCase();
  renderDevicesAndroid(cachedAndroidRemoteDevices);
};

// Render Android devices (MUST BE DEFINED BEFORE loadAllDevicesAndroid)
function renderDevicesAndroid(devices = []) {
  const container = document.getElementById("device-list-android");
  if (!container) {
    console.error("⚠️ Container #device-list-android not found!");
    return;
  }
  cachedAndroidRemoteDevices = Array.isArray(devices) ? devices : [];
  updateAndroidDashboardMetrics(cachedAndroidRemoteDevices);
  container.innerHTML = "";

  if (!cachedAndroidRemoteDevices.length) {
    container.innerHTML = `
      <div class="android-empty-state">
        <div class="android-empty-icon"><i class="bi bi-phone"></i></div>
        <h3>Belum Ada Perangkat Android / Emulator</h3>
        <p>Mulai dengan membuat Android Virtual Emulator baru atau sambungkan HP fisik Anda melalui kabel USB / ADB Wireless.</p>
        <div class="android-empty-actions">
          <button type="button" class="btn-create-emu" onclick="openModalAndroid()">
            <i class="bi bi-plus-circle-fill"></i> Tambah Device
          </button>
          <button type="button" class="btn-tutorial-adb secondary" onclick="openAdbTutorialModal()">
            <i class="bi bi-journal-check"></i> Panduan ADB
          </button>
        </div>
      </div>
    `;
    return;
  }

  let filtered = cachedAndroidRemoteDevices.slice();

  if (currentAndroidFilter === "running") {
    filtered = filtered.filter((d) =>
      ["running", "active", "starting", "connected"].includes(String(d.status || "").toLowerCase())
    );
  } else if (currentAndroidFilter === "emulator") {
    filtered = filtered.filter((d) => d._deviceType === "emulator");
  } else if (currentAndroidFilter === "physical") {
    filtered = filtered.filter((d) => d._deviceType !== "emulator");
  } else if (currentAndroidFilter === "stopped") {
    filtered = filtered.filter((d) =>
      !["running", "active", "starting", "connected"].includes(String(d.status || "").toLowerCase())
    );
  }

  if (androidSearchQuery) {
    filtered = filtered.filter((d) => {
      const haystack = [
        d.name,
        d.uid,
        d.adbId,
        d.adbName,
        d.service,
        d.status,
        d.androidVersion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(androidSearchQuery);
    });
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="android-empty-state" style="padding: 34px 20px;">
        <div class="android-empty-icon" style="font-size: 1.5rem; width: 50px; height: 50px;"><i class="bi bi-search"></i></div>
        <h3>Tidak Ada Perangkat Ditemukan</h3>
        <p>Tidak ada perangkat atau emulator yang cocok dengan kata kunci pencarian atau filter yang dipilih.</p>
        <div class="android-empty-actions">
          <button type="button" class="btn-tutorial-adb secondary" onclick="const inp = document.getElementById('androidSearchInput'); if (inp) inp.value=''; window.filterAndroidBySearch(''); window.applyAndroidFilter('all');">
            <i class="bi bi-arrow-repeat"></i> Reset Filter
          </button>
        </div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

    filtered.forEach((device) => {
      if (device._deviceType === 'emulator') {
        const card = buildAndroidEmulatorCard(device);
        if (card) fragment.appendChild(card);
        return;
      }

      const serviceMeta = getAndroidRemoteServiceMeta(device.service);
      const statusMeta = formatAndroidRemoteStatus(device.status);
      const isConnected = ["connected", "running", "active"].includes(
        String(device.status || "").toLowerCase()
      );
      const deviceCard = document.createElement("div");
      deviceCard.className = "device android-remote-card";
      deviceCard.dataset.uid = device.uid;
      deviceCard.dataset.service = device.service || "";
      deviceCard.dataset.status = device.status || "disconnected";
    deviceCard.style.setProperty("--device-accent", serviceMeta.color);

    deviceCard.innerHTML = `
      <div class="device-header">
        <div class="device-meta">
          <div class="device-header-title-row">
            <div class="android-card-avatar adb"><i class="bi bi-phone-fill"></i></div>
            <div>
              <h3>${device.name || serviceMeta.label}</h3>
              <span class="device-service-name">${serviceMeta.label}</span>
            </div>
          </div>
        </div>
        <span class="${statusMeta.className}">${statusMeta.label}</span>
      </div>
      <div class="device-body android-remote-body">
        <p><strong>ADB ID:</strong> ${device.adbId || "-"}</p>
        ${
          device.adbName
            ? `<p><strong>Alias:</strong> ${device.adbName}</p>`
            : ""
        }
        </div>
        <div class="device-footer">
          <div class="device-actions">
            <button class="restart ${isConnected ? 'secondary' : ''}" title="${isConnected ? 'Restart ADB' : 'Hubungkan ADB'}">
              <i class="bi bi-arrow-clockwise"></i>
              <span>${isConnected ? 'Restart' : 'Connect'}</span>
            </button>
            <button class="monitor" title="Buka Tampilan Layar">
              <i class="bi bi-display"></i>
            </button>
            <div class="device-more-wrapper">
              <button class="device-more" title="Menu Opsi Lainnya" type="button" aria-label="Menu Opsi">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <div class="device-dropdown">
                <button type="button" class="dropdown-action edit"><i class="bi bi-pencil-fill"></i> <span>Edit Device</span></button>
                <button type="button" class="dropdown-action stop ${isConnected ? '' : 'is-hidden'}"><i class="bi bi-stop-fill"></i> <span>Stop ADB</span></button>
                <button type="button" class="dropdown-action" data-action="wake"><i class="bi bi-power"></i> <span>Wake</span></button>
                <button type="button" class="dropdown-action" data-action="sleep"><i class="bi bi-moon"></i> <span>Sleep</span></button>
                <button type="button" class="dropdown-action" data-action="volume-up"><i class="bi bi-volume-up"></i> <span>Vol +</span></button>
                <button type="button" class="dropdown-action" data-action="volume-down"><i class="bi bi-volume-down"></i> <span>Vol -</span></button>
                <button type="button" class="dropdown-action" data-action="screenshot"><i class="bi bi-camera"></i> <span>Screenshot</span></button>
                <div class="dropdown-separator"></div>
                <button type="button" class="dropdown-action delete" title="Hapus device"><i class="bi bi-trash-fill"></i> <span>Hapus Device</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

      const editButton = deviceCard.querySelector(".edit");
      const restartButton = deviceCard.querySelector(".restart");
      const stopButton = deviceCard.querySelector(".stop");
      const monitorButton = deviceCard.querySelector(".monitor");
      const deleteButton = deviceCard.querySelector(".delete");

      editButton?.addEventListener("click", (evt) => {
        evt.stopPropagation();
        openEditAndroidRemoteDevice(device);
      });

      restartButton?.addEventListener("click", (evt) => {
        evt.stopPropagation();
        restartAndroidAdbCard(device.uid);
      });

      stopButton?.addEventListener("click", (evt) => {
        evt.stopPropagation();
        stopAndroidAdbCard(device.uid);
      });

      monitorButton?.addEventListener("click", (evt) => {
        evt.stopPropagation();
        openAndroidRemoteDisplay(device.uid, { silentSuccess: true }).catch(() => {});
        maybeOpenAndroidWhatsAppMonitor(device.uid, {
          delayMs: 250,
        }).catch(() => {});
      });

    deleteButton?.addEventListener("click", (evt) => {
      evt.stopPropagation();
      deleteAndroidRemoteDevice(device.uid);
    });
    const dropdownButton = deviceCard.querySelector(".device-more");
    const dropdown = deviceCard.querySelector(".device-dropdown");
    dropdownButton?.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const alreadyOpen = dropdown?.classList.contains("show");
      document
        .querySelectorAll(".device-dropdown.show")
        .forEach((el) => el.classList.remove("show"));
      if (!alreadyOpen && dropdown) {
        dropdown.classList.add("show");
      }
    });
    dropdown?.querySelectorAll(".dropdown-action").forEach((button) => {
      button.addEventListener("click", (evt) => {
        evt.stopPropagation();
        const action = button.dataset.action;
        handleAndroidMiniAction(device, action);
        dropdown.classList.remove("show");
      });
    });

    fragment.appendChild(deviceCard);
  });

  container.appendChild(fragment);
}

// Peta API level → nama rilis Android untuk label kartu (dipakai saat emulator
// belum jalan / belum bisa dibaca via getprop). Rilis live tetap diambil dari
// getprop saat running.
const ANDROID_RELEASE_BY_API = {
  29: "10",
  30: "11",
  31: "12",
  32: "12L",
  33: "13",
  34: "14",
  35: "15",
};

function androidVersionLabelFromApi(api) {
  const apiNum = Number.parseInt(api, 10);
  const release = ANDROID_RELEASE_BY_API[apiNum];
  if (release) return `Android ${release} (API ${apiNum})`;
  return Number.isFinite(apiNum) ? `API ${apiNum}` : "Android 11 (API 30)";
}

// Ambil versi live dari emulator yang berjalan dan perbarui baris versi di kartu.
async function refreshAndroidEmulatorVersion(uid) {
  const el = document.getElementById(`emuVersion-${uid}`);
  if (!el) return;
  try {
    const info = await androidEmuApi.getDeviceInfo(uid);
    if (info?.success && info.release) {
      const api = info.sdk ? ` (API ${info.sdk})` : "";
      const model = info.model ? ` · ${info.model}` : "";
      el.innerHTML = `<strong>Versi:</strong> Android ${info.release}${api}${model}`;
    }
  } catch (_) {
    /* biarkan label default (versi terkonfigurasi) */
  }
}

function buildAndroidEmulatorCard(device) {
  const spec = device.androidSpec || {};
  const specLabel = spec.id === 'lite' ? '⚡ Lite' : spec.id === 'performance' ? '🚀 Performance' : spec.id === 'custom' ? '🎛️ Custom' : '⚖️ Balanced';
  const isRunning = ['running', 'active', 'starting'].includes((device.status || '').toLowerCase());
  const effectiveServiceId = getEffectiveAndroidServiceId(device);
  const serviceMeta = getAndroidRemoteServiceMeta(effectiveServiceId);
  // Tombol Monitor hanya relevan untuk WhatsApp automation mode read-only
  // (emulator headless, tampilan lewat mirror). Mode native/non-automation
  // sudah punya window emulator sendiri — monitor hanya bikin tampilan dobel.
  const showEmuMonitorButton =
    isAndroidWhatsAppService(effectiveServiceId) &&
    (device.androidDisplayMode || "readonly") !== "native";
  // "playstore" is the actual fallback used when *booting* a device with no
  // saved androidImageVariant (see startAndroidEmulatorDevice() in
  // electron-main.js) — the badge must default the same way, otherwise a
  // legacy device with no explicit variant shows "Root" here while actually
  // booting non-rootable (adbd refuses "root": "cannot run as root in
  // production builds", verified live against StarBox_Andro1_fa2fe5).
  const imageVariant = device.androidImageVariant || 'playstore';
  const isRootable = imageVariant !== 'playstore';
  const card = document.createElement('div');
  card.className = 'device android-remote-card';
  card.dataset.uid = device.uid;
  card.dataset.service = 'android';
  card.dataset.status = device.status || 'stopped';
  card.style.setProperty('--device-accent', '#3ddc84');

  card.innerHTML = `
    <div class="device-header">
      <div class="device-meta">
        <div class="device-header-title-row">
          <div class="android-card-avatar emu"><i class="bi bi-cpu-fill"></i></div>
          <div>
            <h3>${device.name || 'Android Emulator'}</h3>
            <span class="device-service-name">Android Emulator • ${serviceMeta.label}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="status-badge ${isRunning ? 'active' : 'inactive'}">${isRunning ? 'Running' : 'Stopped'}</span>
        <span class="status-badge" style="background:${isRootable ? '#10b981' : '#475569'};" title="${isRootable ? 'Rootable — bisa pakai Device Profile, Play Store dipasang otomatis' : 'Standar — Play Store bawaan, tidak bisa di-root'}">${isRootable ? '🔓 Root' : '🔒 Standar'}</span>
      </div>
    </div>
    <div class="device-body android-remote-body">
      <p id="emuVersion-${device.uid}"><strong>Versi:</strong> ${androidVersionLabelFromApi(device.androidVersion || 30)}</p>
      <p><strong>Preset:</strong> ${specLabel}</p>
      <p><strong>RAM:</strong> ${spec.memoryMb || 1536} MB &nbsp;·&nbsp; <strong>CPU:</strong> ${spec.cores || 2} Core</p>
      <p><strong>Resolusi:</strong> ${spec.resolution || '720x1280'}</p>
      <p><strong>Mode:</strong> ${serviceMeta.label}</p>
    </div>
    <div id="emuProgress-${device.uid}" style="display:none;padding:8px 12px 0">
      <div style="font-size:11px;color:#888;margin-bottom:4px" id="emuProgressLabel-${device.uid}">Mempersiapkan...</div>
      <div style="height:4px;background:#1a1a2e;border-radius:4px;overflow:hidden">
        <div id="emuProgressBar-${device.uid}" style="height:100%;width:0%;background:linear-gradient(90deg,#3ddc84,#25d366);transition:width .3s"></div>
      </div>
    </div>
    <div class="device-footer">
      <div class="device-actions">
        <button class="emu-start-btn ${isRunning ? 'secondary' : ''}">
          <i class="bi bi-${isRunning ? 'arrow-clockwise' : 'play-fill'}"></i>
          <span>${isRunning ? 'Restart' : 'Start'}</span>
        </button>
        ${showEmuMonitorButton ? `
        <button class="emu-monitor-btn" title="Buka Monitor Layar">
          <i class="bi bi-display"></i>
        </button>` : ''}
        <div class="device-more-wrapper">
          <button class="device-more emu-more-btn" title="Menu Opsi Lainnya" type="button" aria-label="Menu Opsi">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <div class="device-dropdown">
            <button type="button" class="dropdown-action emu-stop-btn ${isRunning ? '' : 'is-hidden'}">
              <i class="bi bi-stop-fill"></i> <span>Stop Emulator</span>
            </button>
            <button type="button" class="dropdown-action emu-edit-btn">
              <i class="bi bi-pencil-fill"></i> <span>Edit Emulator</span>
            </button>
            <button type="button" class="dropdown-action emu-status-btn">
              <i class="bi bi-card-text"></i> <span>Detail Status</span>
            </button>
            <div class="dropdown-separator"></div>
            <button type="button" class="dropdown-action delete" title="Hapus emulator">
              <i class="bi bi-trash-fill"></i> <span>Hapus Emulator</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const emuDropdown = card.querySelector('.device-dropdown');
  card.querySelector('.emu-more-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const alreadyOpen = emuDropdown?.classList.contains('show');
    document.querySelectorAll('.device-dropdown.show').forEach((el) => el.classList.remove('show'));
    if (!alreadyOpen && emuDropdown) emuDropdown.classList.add('show');
  });

  card.querySelector('.emu-start-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isRunning) restartAndroidEmulatorCard(device.uid, card);
    else startAndroidEmulatorCard(device.uid, card);
  });

  card.querySelector('.emu-stop-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    emuDropdown?.classList.remove('show');
    stopAndroidEmulatorCard(device.uid);
  });

  card.querySelector('.emu-edit-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    emuDropdown?.classList.remove('show');
    window.openEditAndroidModal(device.uid);
  });

  card.querySelector('.emu-status-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    emuDropdown?.classList.remove('show');
    runDevice(device.uid, "android");
  });

  card.querySelector('.emu-monitor-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openAndroidRemoteDisplay(device.uid, { silentSuccess: true }).catch(() => {});
    maybeOpenAndroidWhatsAppMonitor(device.uid, {
      delayMs: 250,
    }).catch(() => {});
  });

  card.querySelector('.delete')?.addEventListener('click', (e) => {
    e.stopPropagation();
    emuDropdown?.classList.remove('show');
    deleteAndroidEmulatorCard(device.uid, device.name);
  });

  // Emulator berjalan → baca versi Android live via adb getprop dan perbarui baris.
  if (isRunning) {
    refreshAndroidEmulatorVersion(device.uid);
  }

  return card;
}

async function startAndroidEmulatorCard(uid, cardEl) {
  const setProgress = (label, pct) => {
    const prog = document.getElementById('emuProgress-' + uid);
    const bar = document.getElementById('emuProgressBar-' + uid);
    const lbl = document.getElementById('emuProgressLabel-' + uid);
    if (prog) prog.style.display = pct !== null ? 'block' : 'none';
    if (bar && pct !== null) bar.style.width = pct + '%';
    if (lbl && label) lbl.textContent = label;
  };

  try {
    const check = await androidEmuApi.checkInstallation(uid);
    if (!check?.installed) {
      setProgress('Mengunduh Android SDK (~1.5GB)...', 0);
      showToast('📥 Mengunduh Android SDK (~1.5GB)...', 5000, 'info');
      const stopDownloadProgress = androidEmuApi.onDownloadProgress((data) => {
        if (data?.uid && data.uid !== uid) return;
        const pct = Number.isFinite(data.overallProgress)
          ? Math.round(data.overallProgress)
          : data.totalBytes
            ? Math.round((data.bytesDownloaded / data.totalBytes) * 100)
            : 0;
        setProgress(
          data.message || `Mengunduh SDK: ${pct}% — ${data.phase || ''}`,
          pct
        );
      });
      await androidEmuApi.download(uid);
      if (typeof stopDownloadProgress === 'function') {
        stopDownloadProgress();
      }
    }

    setProgress('Memulai emulator...', 5);
    const stopStartProgress = androidEmuApi.onStartProgress((data) => {
      if (data?.uid && data.uid !== uid) return;
      // Note: an "attempt-exit" here is just one GPU/lock retry dying, not
      // necessarily the final outcome — a following attempt may still
      // succeed. Don't reset the progress UI on it; the final resolution of
      // androidEmuApi.start(uid) below (success or catch)
      // already drives the terminal UI state either way.
      const pct = data.phase === 'booted' ? 100
        : data.phase === 'install-playstore' ? 95
        : data.phase === 'wait-boot' ? 50
        : 20;
      setProgress(data.message || data.phase || 'Memulai...', pct);
    });

    const result = await androidEmuApi.start(uid);
    if (typeof stopStartProgress === 'function') {
      stopStartProgress();
    }
    setProgress(null, null);

    if (result?.success) {
      showToast('✅ Emulator Android berjalan!', 3000, 'success');
      await loadAllDevicesAndroid();
      await maybeOpenAndroidWhatsAppDisplay(uid, {
        delayMs: 250,
        silent: true,
        silentSuccess: true,
      });
      await maybeOpenAndroidWhatsAppMonitor(uid, {
        delayMs: 450,
      });
    } else {
      showToast('Gagal start emulator: ' + (result?.message || result?.error || ''), 5000, 'error');
    }
  } catch (err) {
    setProgress(null, null);
    showToast('Error: ' + (err?.message || err), 5000, 'error');
  }
}

function closeAndroidAutomationMonitor(uid) {
  if (uid && window.electronAPI?.closeMonitorWindow) {
    window.electronAPI.closeMonitorWindow(uid);
  }
}

function closeAndroidRemoteDisplay(uid, options = {}) {
  if (!uid) return Promise.resolve(false);
  const { silent = false, silentSuccess = false } = options;
  const api = androidRemoteApi;
  if (!api || typeof api.closeDisplay !== "function") {
    if (!silent) {
      showToast(
        "Fitur menutup tampilan perangkat belum tersedia di versi ini.",
        3500,
        "warning"
      );
    }
    return Promise.resolve(false);
  }
  return api
    .closeDisplay(uid)
    .then((response = {}) => {
      if (response.success) {
        if (!silentSuccess) {
          showToast(
            response.message || "Tampilan perangkat ditutup.",
            2500,
            "info"
          );
        }
        return !!response.closed;
      }
      if (!silent) {
        showToast(
          response.message || "Gagal menutup tampilan perangkat.",
          3500,
          "error"
        );
      }
      return false;
    })
    .catch((err) => {
      console.error("⚠️ Tidak bisa menutup tampilan perangkat:", err);
      if (!silent) {
        showToast(
          err?.message || "Gagal menutup tampilan perangkat.",
          3500,
          "error"
        );
      }
      return false;
    });
}

async function stopAndroidAdbCard(uid) {
  try {
    closeAndroidAutomationMonitor(uid);
    await closeAndroidRemoteDisplay(uid, { silentSuccess: false });
  } catch (err) {
    showToast('Error stop monitor: ' + (err?.message || err), 4000, 'error');
  }
}

async function restartAndroidAdbCard(uid) {
  try {
    closeAndroidAutomationMonitor(uid);
    await closeAndroidRemoteDisplay(uid, { silent: true, silentSuccess: true });
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    await openAndroidRemoteDisplay(uid, { silentSuccess: true });
    await maybeOpenAndroidWhatsAppMonitor(uid, {
      delayMs: 250,
    });
  } catch (err) {
    showToast('Error restart monitor: ' + (err?.message || err), 4000, 'error');
  }
}

async function stopAndroidEmulatorCard(uid) {
  try {
    closeAndroidAutomationMonitor(uid);
    await closeAndroidRemoteDisplay(uid, { silent: true, silentSuccess: true });
    await androidEmuApi.stop(uid);
    showToast('Emulator dihentikan.', 2000, 'info');
    await loadAllDevicesAndroid();
  } catch (err) {
    showToast('Error stop: ' + (err?.message || err), 4000, 'error');
  }
}

async function restartAndroidEmulatorCard(uid, cardEl) {
  try {
    closeAndroidAutomationMonitor(uid);
    await closeAndroidRemoteDisplay(uid, { silent: true, silentSuccess: true });
    await androidEmuApi.stop(uid);
    await loadAllDevicesAndroid();
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    await startAndroidEmulatorCard(uid, cardEl);
  } catch (err) {
    showToast('Error restart: ' + (err?.message || err), 4000, 'error');
  }
}

async function fixAndroidEmulatorCard(uid) {
  try {
    showToast('🔧 Memperbaiki Android...', 3000, 'info');
    await androidEmuApi.fixIssues(uid);
    showToast('Fix selesai.', 2000, 'success');
    await loadAllDevicesAndroid();
  } catch (err) {
    showToast('Error fix: ' + (err?.message || err), 4000, 'error');
  }
}

async function deleteAndroidEmulatorCard(uid, name) {
  const ok = await Swal.fire({
    title: window.t('dialog.delete_emulator.title'),
    text: `"${name}" akan dihapus permanen.`,
    icon: 'warning', showCancelButton: true,
    confirmButtonText: window.t('dialog.delete_emulator.confirm'),
    cancelButtonText: window.t('dialog.delete_emulator.cancel'),
    confirmButtonColor: '#ef4444',
  });
  if (!ok.isConfirmed) return;
  try {
    await window.electronAPI.deleteDevice(uid);
    showToast(window.t('toast.emulator.deleted'), 2000, 'success');
    await loadAllDevicesAndroid();
  } catch (err) {
    showToast(window.t('toast.emulator.delete_error') + (err?.message || err), 4000, 'error');
  }
}

async function loadAllDevicesAndroid() {
  try {
    const [adbResult, allDevicesResult] = await Promise.all([
      androidRemoteApi.getDevices(),
      window.electronAPI.loadDevices(),
    ]);
    const adbDevices = (adbResult?.devices || []).map(d => ({ ...d, _deviceType: 'adb' }));
    const emulatorDevices = (allDevicesResult?.devices || [])
      .filter(d => (d.service || '').toLowerCase() === 'android')
      .map(d => ({ ...d, _deviceType: 'emulator' }));
    const androidDevices = [...emulatorDevices, ...adbDevices];
    renderDevicesAndroid(androidDevices);
    await syncAndroidWhatsappMonitorSource(androidDevices);
    if (automationSessions.size) {
      ensureAutomationLoop();
    }
  } catch (err) {
    console.error("⚠️ Gagal memuat Android devices:", err);
  }
}

function deleteAndroidRemoteDevice(uid) {
  if (!uid) return;
  Swal.fire({
    title: "Hapus Device Android?",
    text: "Perangkat fisik ini akan dilepas dari StarBox.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal",
  }).then((result) => {
    if (!result.isConfirmed) return;
    androidRemoteApi
      .deleteDevice(uid)
      .then((response) => {
        if (response.success) {
          showToast("Device Android berhasil dihapus.", 3000, "success");
          loadAllDevicesAndroid();
        } else {
          showToast(
            response.message || "Gagal menghapus device.",
            3500,
            "error"
          );
        }
      })
      .catch((err) => {
        console.error("⚠️ Gagal menghapus device Android:", err);
        showToast(err?.message || "Gagal menghapus device.", 3500, "error");
      });
  });
}

// Edit Android Remote Device
function openEditAndroidRemoteDevice(device) {
  if (!device || !device.uid) return;

  const modal = document.getElementById("editModalAndroidRemote");
  if (!modal) return;

  // Populate form
  document.getElementById("editAndroidRemoteUid").value = device.uid;
  document.getElementById("editAndroidRemoteName").value = device.name || "";

  const serviceSelect = document.getElementById("editAndroidRemoteService");
  if (serviceSelect) {
    serviceSelect.value = device.service || "android-general";
  }

  // Populate IP/Port fields from adbId (format: "IP:PORT")
  const ipInput = document.getElementById("editAndroidRemoteIp");
  const portInput = document.getElementById("editAndroidRemotePort");

  if (device.adbId && device.adbId.includes(":")) {
    const [ip, port] = device.adbId.split(":");
    if (ipInput) ipInput.value = ip || "";
    if (portInput) portInput.value = port || "";
  } else {
    if (ipInput) ipInput.value = "";
    if (portInput) portInput.value = "";
  }

  // Populate WhatsApp automation fields if available
    const baseUrlInput = document.getElementById("editWhatsAppBaseUrl");
    const callbackUrlInput = document.getElementById("editWhatsAppCallbackUrl");
    const variantSelect = document.getElementById("editWhatsAppVariant");

    if (baseUrlInput) baseUrlInput.value = device.whatsappBaseUrl || "";
    if (callbackUrlInput)
      callbackUrlInput.value = getNormalizedCallbackInput(
        device.whatsappBaseUrl || "",
        device.whatsappCallbackUrl || ""
      );
  if (variantSelect)
    variantSelect.value = device.whatsappVariant || "consumer";

  // Show/hide WhatsApp fields based on service
  toggleWhatsAppAutomationFields();

  // Add event listener for service change
  if (serviceSelect) {
    serviceSelect.removeEventListener("change", toggleWhatsAppAutomationFields);
    serviceSelect.addEventListener("change", toggleWhatsAppAutomationFields);
  }

  modal.style.display = "flex";
}

function toggleWhatsAppAutomationFields() {
  const serviceSelect = document.getElementById("editAndroidRemoteService");
  const whatsappFields = document.getElementById(
    "editWhatsAppAutomationFields"
  );
  const variantSelect = document.getElementById("editWhatsAppVariant");

  if (!serviceSelect || !whatsappFields) return;

  const isWhatsApp = serviceSelect.value === "android-whatsapp";
  whatsappFields.style.display = isWhatsApp ? "block" : "none";
  if (variantSelect) {
    variantSelect.disabled = !isWhatsApp;
    if (!isWhatsApp) {
      variantSelect.value = "consumer";
    }
  }
}

function closeEditAndroidRemoteModal() {
  const modal = document.getElementById("editModalAndroidRemote");
  if (modal) modal.style.display = "none";
}

async function reconnectAndroidRemoteDevice() {
  const ipInput = document.getElementById("editAndroidRemoteIp");
  const portInput = document.getElementById("editAndroidRemotePort");
  const uid = document.getElementById("editAndroidRemoteUid").value;

  if (!ipInput || !portInput || !uid) return;

  const ip = ipInput.value.trim();
  const port = portInput.value.trim();

  if (!ip || !port) {
    showToast("Harap isi IP Address dan Port!", 3000, "error");
    return;
  }

  // Validate IP format
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) {
    showToast("Format IP Address tidak valid!", 3000, "error");
    return;
  }

  // Validate port
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    showToast("Port harus antara 1-65535!", 3000, "error");
    return;
  }

  showToast(`Reconnecting ke ${ip}:${port}...`, 2000, "info");

  try {
    const api = androidRemoteApi;
    if (!api?.connectManualAdb || !api?.getDevices) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    // Get current device to get old adbId
    const devicesResult = await api.getDevices();
    const currentDevice = devicesResult?.devices?.find((d) => d.uid === uid);
    const oldAdbId = currentDevice?.adbId || null;

    const newAdbId = `${ip}:${port}`;

    // Connect to new IP:Port (will disconnect old one)
    const result = await api.connectManualAdb({
      ip,
      port,
      oldAdbId: oldAdbId,
    });

    if (result?.success) {
      showToast(`✅ Berhasil reconnect ke ${ip}:${port}!`, 3000, "success");

      // Update the device record with new adbId
      const updateResult = await api.editDevice({
        uid: uid,
        adbId: newAdbId,
      });

      if (updateResult?.success) {
        console.log(`✅ Device ${uid} updated with new adbId: ${newAdbId}`);
        // Reload devices list
        await loadAllDevicesAndroid();
        closeEditAndroidRemoteModal();
      } else {
        showToast("Reconnect berhasil tapi gagal menyimpan!", 4000, "warning");
      }
    } else {
      showToast(result?.message || "Gagal reconnect ke device!", 4000, "error");
    }
  } catch (err) {
    console.error("❌ Error reconnecting:", err);
    showToast(err?.message || "Gagal reconnect ke device!", 4000, "error");
  }
}

async function saveEditAndroidRemoteDevice() {
  const uid = document.getElementById("editAndroidRemoteUid").value;
  const name = document.getElementById("editAndroidRemoteName").value.trim();
  const service = document.getElementById("editAndroidRemoteService").value;

  if (!uid || !name) {
    showToast("Nama device harus diisi", 3000, "error");
    return;
  }

  const updates = {
    name,
    service,
  };

  // Add WhatsApp automation URLs if service is android-whatsapp
    if (service === "android-whatsapp") {
      const baseUrl = document.getElementById("editWhatsAppBaseUrl").value.trim();
      const callbackUrl = getNormalizedCallbackInput(
        baseUrl,
        document.getElementById("editWhatsAppCallbackUrl").value.trim()
      );
      const whatsappVariant =
        document.getElementById("editWhatsAppVariant")?.value || "consumer";

    updates.whatsappBaseUrl = baseUrl;
    updates.whatsappCallbackUrl = callbackUrl;
    updates.whatsappVariant = whatsappVariant;
  }

  try {
    const response = await androidRemoteApi.updateDevice(
      uid,
      updates
    );

    if (response.success) {
      showToast("Device berhasil diupdate", 3000, "success");
      closeEditAndroidRemoteModal();
      loadAllDevicesAndroid();
    } else {
      showToast(response.message || "Gagal update device", 3500, "error");
    }
  } catch (err) {
    console.error("⚠️ Gagal update device:", err);
    showToast(err?.message || "Gagal update device", 3500, "error");
  }
}

// Toggle between WiFi and Cable mode in Edit Android Remote modal
function toggleEditConnectionMode() {
  const wifiMode = document.getElementById("editModeWifi");
  const cableMode = document.getElementById("editModeCable");
  const wifiSection = document.getElementById("editWifiConnectionSection");
  const cableSection = document.getElementById("editCableConnectionSection");

  if (cableMode && cableMode.checked) {
    // Show cable section, hide WiFi section
    if (wifiSection) wifiSection.style.display = "none";
    if (cableSection) cableSection.style.display = "block";

    // Auto-scan ADB devices when switching to cable mode
    scanEditAdbDevices();
  } else {
    // Show WiFi section, hide cable section
    if (wifiSection) wifiSection.style.display = "block";
    if (cableSection) cableSection.style.display = "none";
  }
}

// Scan ADB devices via cable in Edit Android Remote modal
async function scanEditAdbDevices() {
  const select = document.getElementById("editAdbDeviceSelect");
  const progressBar = document.getElementById("editAdbScanProgressBar");
  const progressSection = document.getElementById("editAdbScanProgress");
  const statusText = document.getElementById("editAdbScanStatus");
  const percentText = document.getElementById("editAdbScanPercent");

  if (!select) return;

  // Show progress
  if (progressSection) progressSection.style.display = "block";
  if (statusText) statusText.textContent = "Scanning USB devices...";
  if (percentText) percentText.textContent = "0%";
  if (progressBar) progressBar.style.width = "0%";

  select.innerHTML = '<option value="">Scanning...</option>';

  try {
    const api = androidRemoteApi;
    if (!api?.listAdbDevices) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    // Animate progress
    if (progressBar) progressBar.style.width = "50%";
    if (percentText) percentText.textContent = "50%";

    // Get list of ADB devices (USB devices are automatically detected)
    const response = await api.listAdbDevices();
    const list = Array.isArray(response?.devices) ? response.devices : [];

    // Animate progress
    if (progressBar) progressBar.style.width = "100%";
    if (percentText) percentText.textContent = "100%";
    if (statusText) statusText.textContent = "Scan selesai";

    if (list.length > 0) {
      select.innerHTML = '<option value="">-- Pilih Perangkat --</option>';
      list.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id || device.adbId;
        const displayName = device.name || device.id || device.adbId;
        const modelInfo = device.model ? ` (${device.model})` : "";
        option.textContent = `${displayName}${modelInfo}`;
        select.appendChild(option);
      });
      showToast(`Ditemukan ${list.length} perangkat`, 3000, "success");
    } else {
      select.innerHTML =
        '<option value="">Tidak ada perangkat ditemukan</option>';
      showToast("Tidak ada perangkat ADB terdeteksi", 3000, "warning");
    }
  } catch (err) {
    console.error("❌ Error scanning ADB devices:", err);
    select.innerHTML = '<option value="">Error scanning devices</option>';
    showToast(err?.message || "Gagal scan perangkat ADB", 3500, "error");
  } finally {
    // Hide progress after delay
    setTimeout(() => {
      if (progressSection) progressSection.style.display = "none";
    }, 500);
  }
}

// Connect selected ADB device in Edit Android Remote modal
async function connectEditAdbDevice() {
  const select = document.getElementById("editAdbDeviceSelect");
  const uid = document.getElementById("editAndroidRemoteUid").value;

  if (!select || !uid) return;

  const adbId = select.value;
  if (!adbId) {
    showToast("Harap pilih perangkat ADB terlebih dahulu!", 3000, "error");
    return;
  }

  showToast(`Connecting ke ${adbId}...`, 2000, "info");

  try {
    const api = androidRemoteApi;
    if (!api?.editDevice) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    // Update device with new adbId
    const updateResult = await api.editDevice({
      uid: uid,
      adbId: adbId,
    });

    if (updateResult?.success) {
      showToast(`✅ Berhasil connect ke ${adbId}!`, 3000, "success");

      // Reload devices list
      await loadAllDevicesAndroid();
      closeEditAndroidRemoteModal();
    } else {
      showToast(
        updateResult?.message || "Gagal connect ke device!",
        4000,
        "error"
      );
    }
  } catch (err) {
    console.error("❌ Error connecting ADB device:", err);
    showToast(err?.message || "Gagal connect ke device!", 4000, "error");
  }
}

// Toggle WhatsApp automation fields in Add Android modal
function toggleAddWhatsAppFields() {
  toggleAndroidWhatsAppFields(
    "androidRemoteServiceSelect",
    "addWhatsAppAutomationFields",
    "addWhatsAppVariant"
  );
}

function toggleAndroidWhatsAppFields(selectId, fieldsId, variantId) {
  const serviceSelect = document.getElementById(selectId);
  const whatsappFields = document.getElementById(fieldsId);
  const variantSelect = document.getElementById(variantId);

  if (!serviceSelect || !whatsappFields) return;

  const isWhatsApp = isAndroidWhatsAppService(serviceSelect.value);
  whatsappFields.style.display = isWhatsApp ? "block" : "none";
  if (variantSelect) {
    variantSelect.disabled = !isWhatsApp;
    if (!isWhatsApp) {
      variantSelect.value = "consumer";
    } else if (!variantSelect.value) {
      variantSelect.value = "consumer";
    }
  }
}

function toggleEmulatorWhatsAppFields() {
  toggleAndroidWhatsAppFields(
    "androidEmulatorServiceSelect",
    "addEmuWhatsAppAutomationFields",
    "addEmuWhatsAppVariant"
  );
}

function toggleEditEmulatorWhatsAppFields() {
  toggleAndroidWhatsAppFields(
    "editAndroidAutomationService",
    "editEmuWhatsAppAutomationFields",
    "editEmuWhatsAppVariant"
  );
}

function getAndroidRemoteLimit() {
  return Infinity;
}

function openAndroidRemoteDisplay(uid, options = {}) {
  if (!uid) return Promise.resolve(false);
  const { silent = false, silentSuccess = false } = options;
  const api = androidRemoteApi;
  if (!api || typeof api.openDisplay !== "function") {
    if (!silent) {
      showToast(
        "Fitur tampilan perangkat belum tersedia di versi ini.",
        3500,
        "warning"
      );
    }
    return Promise.resolve(false);
  }
  return api
    .openDisplay(uid)
    .then((response = {}) => {
      if (response.success) {
        if (!silentSuccess) {
          showToast(
            response.message || "Membuka tampilan perangkat...",
            2500,
            "success"
          );
        }
        wakeAndroidDeviceSilently(uid);
        return true;
      }
      if (!silent) {
        showToast(
          response.message || "Gagal membuka tampilan perangkat.",
          3500,
          "error"
        );
      }
      return false;
    })
    .catch((err) => {
      console.error("⚠️ Tidak bisa membuka tampilan perangkat:", err);
      if (!silent) {
        showToast(
          err?.message || "Gagal membuka tampilan perangkat.",
          3500,
          "error"
        );
      }
      return false;
    });
}

function findCachedAndroidDevice(uid) {
  if (!uid || !Array.isArray(cachedAndroidRemoteDevices)) return null;
  return cachedAndroidRemoteDevices.find((device) => device?.uid === uid) || null;
}

function maybeOpenAndroidWhatsAppDisplay(uid, options = {}) {
  const { delayMs = 0, silent = true, silentSuccess = true } = options;
  const device = findCachedAndroidDevice(uid);
  if (!device) return Promise.resolve(false);
  const serviceKey = getEffectiveAndroidServiceId(device);
  if (!isAndroidWhatsAppService(serviceKey)) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    window.setTimeout(() => {
      openAndroidRemoteDisplay(uid, { silent, silentSuccess }).then(resolve);
    }, Math.max(0, Number(delayMs) || 0));
  });
}

function maybeOpenAndroidWhatsAppMonitor(uid, options = {}) {
  const { delayMs = 0 } = options;
  const device = findCachedAndroidDevice(uid);
  if (!device) return Promise.resolve(false);
  const serviceKey = getEffectiveAndroidServiceId(device);
  const pendingUrl = sanitizePendingUrl(
    device?.whatsappBaseUrl || device?.pendingUrl || ""
  );
  if (!isAndroidWhatsAppService(serviceKey) || !pendingUrl) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (window.electronAPI?.ensureMonitorWindow) {
        window.electronAPI.ensureMonitorWindow(uid);
        resolve(true);
        return;
      }
      resolve(false);
    }, Math.max(0, Number(delayMs) || 0));
  });
}

function wakeAndroidDeviceSilently(uid) {
  const api = androidRemoteApi;
  if (!api?.sendShortcut) return;
  api
    .sendShortcut(uid, "wake-screen")
    .catch((err) =>
      console.warn("⚠️ Gagal membangunkan device otomatis:", err)
    );
}

function sendAndroidShortcutWithFeedback(uid, shortcutId, successMsg) {
  const api = androidRemoteApi;
  if (!api?.sendShortcut) {
    showToast("Fitur shortcut tidak tersedia.", 3000, "warning");
    return Promise.resolve(false);
  }
  showToast("Mengirim perintah ke device...", 1800, "info");
  return api
    .sendShortcut(uid, shortcutId)
    .then((response = {}) => {
      if (response.success) {
        showToast(
          successMsg || response.message || "Perintah berhasil dikirim.",
          2500,
          "success"
        );
        return true;
      }
      showToast(
        response.message || "Perintah gagal dijalankan.",
        3000,
        "error"
      );
      return false;
    })
    .catch((err) => {
      console.error("⚠️ Shortcut gagal:", err);
      showToast(err?.message || "Perintah gagal dijalankan.", 3200, "error");
      return false;
    });
}

function captureAndroidDeviceScreenshot(device) {
  if (!device || !device.uid) return;
  const api = androidRemoteApi;
  if (!api?.captureScreenshot) {
    showToast("Fitur screenshot belum tersedia.", 3200, "warning");
    return;
  }
  showToast("Mengambil screenshot...", 2000, "info");
  api
    .captureScreenshot(device.uid)
    .then((response = {}) => {
      if (response.cancelled) {
        showToast("Penyimpanan screenshot dibatalkan.", 2600, "info");
        return;
      }
      if (response.success && response.path) {
        showToast(
          response.message || `Screenshot disimpan di ${response.path}`,
          4200,
          "success"
        );
        return;
      }
      showToast(
        response.message || "Gagal mengambil screenshot.",
        3200,
        "error"
      );
    })
    .catch((err) => {
      console.error("⚠️ Screenshot gagal:", err);
      showToast(err?.message || "Gagal mengambil screenshot.", 3200, "error");
    });
}

function handleAndroidMiniAction(device, action) {
  if (!device || !device.uid) return;
  switch (action) {
    case "wake":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "wake-screen",
        "Layar dibangunkan."
      );
      break;
    case "sleep":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "sleep",
        "Perangkat masuk mode sleep."
      );
      break;
    case "volume-up":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "volume-up",
        "Volume up dikirim."
      );
      break;
    case "volume-down":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "volume-down",
        "Volume down dikirim."
      );
      break;
    case "screenshot":
      captureAndroidDeviceScreenshot(device);
      break;
    default:
      console.warn("Tidak ada aksi untuk shortcut:", action);
  }
}

function updateScrcpyNoticeUI(customMessage = "") {
  const notice = document.getElementById("scrcpyStatusNotice");
  const textEl = document.getElementById("scrcpyStatusText");
  const button = document.getElementById("installScrcpyButton");
  if (!notice || !textEl || !button) return;
  if (scrcpyStatusState.installed) {
    notice.style.display = "none";
    return;
  }
  notice.style.display = "flex";
  if (customMessage) {
    textEl.textContent = customMessage;
  } else if (scrcpyStatusState.checking) {
    textEl.textContent = "Sedang memeriksa instalasi scrcpy...";
  } else if (scrcpyStatusState.installing) {
    const percentText =
      scrcpyStatusState.progressPercent != null
        ? ` (${scrcpyStatusState.progressPercent}%)`
        : "";
    textEl.textContent = `${
      scrcpyStatusState.progressMessage || "Menginstal scrcpy..."
    }${percentText}`;
  } else {
    textEl.textContent =
      "scrcpy belum terpasang. Dibutuhkan untuk menampilkan layar HP secara langsung. Klik install otomatis (macOS: butuh Homebrew, Windows: Chocolatey/winget) atau pasang manual: brew install scrcpy / choco install scrcpy / winget install Genymobile.scrcpy.";
  }
  button.disabled = scrcpyStatusState.installing || scrcpyStatusState.checking;
  button.textContent = scrcpyStatusState.installing
    ? "Menginstal..."
    : "Install scrcpy otomatis";
}

async function refreshScrcpyStatusIndicator() {
  const notice = document.getElementById("scrcpyStatusNotice");
  if (!notice) return;
  const api = androidRemoteApi;
  if (!api?.checkScrcpy) {
    notice.style.display = "none";
    scrcpyStatusState.installed = true;
    return;
  }
  scrcpyStatusState.checking = true;
  updateScrcpyNoticeUI();
  let customMessage = "";
  try {
    const result = await api.checkScrcpy();
    if (result?.success === false && result?.message) {
      scrcpyStatusState.installed = false;
      customMessage = result.message;
    } else {
      scrcpyStatusState.installed = !!result?.installed;
    }
  } catch (err) {
    console.warn("⚠️ Tidak bisa mengecek scrcpy:", err);
    scrcpyStatusState.installed = false;
    customMessage =
      "Tidak bisa mengecek scrcpy. Coba jalankan aplikasi sebagai admin.";
  } finally {
    scrcpyStatusState.checking = false;
    updateScrcpyNoticeUI(customMessage);
  }
}

function requestScrcpyInstallation() {
  const api = androidRemoteApi;
  if (!api?.installScrcpy) {
    showToast(
      "Fitur instalasi otomatis tidak tersedia di versi ini.",
      3500,
      "warning"
    );
    return;
  }
  if (scrcpyStatusState.installing) return;
  scrcpyStatusState.installing = true;
  scrcpyStatusState.progressPercent = 0;
  scrcpyStatusState.progressMessage = "Menyiapkan instalasi scrcpy...";
  updateScrcpyNoticeUI();
  showToast("Menjalankan instalasi scrcpy...", 3500, "info");
  api
    .installScrcpy()
    .then((response = {}) => {
      if (response.success) {
        showToast(
          response.message || "scrcpy berhasil dipasang.",
          3500,
          "success"
        );
      } else {
        showToast(
          response.message ||
            "Instalasi otomatis scrcpy gagal. Coba pasang manual.",
          4000,
          "error"
        );
      }
    })
    .catch((err) => {
      console.error("⚠️ Instalasi scrcpy gagal:", err);
      showToast(
        err?.message || "Instalasi otomatis scrcpy gagal.",
        4000,
        "error"
      );
    })
    .finally(() => {
      scrcpyStatusState.installing = false;
      scrcpyStatusState.progressPercent = null;
      scrcpyStatusState.progressMessage = "";
      refreshScrcpyStatusIndicator();
    });
}

function setupScrcpyHelperCard() {
  const installBtn = document.getElementById("installScrcpyButton");
  if (installBtn) {
    installBtn.addEventListener("click", () => requestScrcpyInstallation());
  }
  const api = androidRemoteApi;
  if (api?.onScrcpyInstallProgress) {
    api.onScrcpyInstallProgress((payload = {}) => {
      if (!scrcpyStatusState.installing) return;
      if (payload.percent != null) {
        scrcpyStatusState.progressPercent = Math.min(
          100,
          Math.max(0, Math.round(payload.percent))
        );
      }
      if (payload.message) {
        scrcpyStatusState.progressMessage = payload.message;
      }
      updateScrcpyNoticeUI();
    });
  }
  refreshScrcpyStatusIndicator();
}

function remoteAndroidDevice(device) {
  if (!device || !device.uid) return;
  const serviceKey = getEffectiveAndroidServiceId(device);

  if (serviceKey === "android-whatsapp") {
    Swal.fire({
      title: "Remote WhatsApp",
      html: "StarBox akan mengirim 10 pesan sample ke <strong>6282337481227</strong>.<br>Pilih kecepatan pengetikan:",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Mulai Remote",
      cancelButtonText: "Batal",
      input: "select",
      inputOptions: {
        instant: "Super Cepat",
        robot: "Stabil (seragam, tanpa variasi)",
        fasthuman: "Cepat Natural (seperti manusia mahir)",
        human: "Natural (lebih lambat)",
        slowhuman: "Pelan Natural (seperti orang biasa)",
        realistic: "Sangat Natural (ada jeda & variasi real)",
        paste: "Tempel Instan (clipboard)",
        hybrid: "Hybrid (paste lalu edit sedikit)",
        stealth: "Stealth Mode (anti terdeteksi, variasi halus)",
      },
      inputValue: "instant",
    }).then((result) => {
      if (!result.isConfirmed) return;
      const typingSpeed = result.value || "instant";
      openAndroidRemoteDisplay(device.uid, { silentSuccess: true });
      runAndroidRemoteAction(device.uid, "whatsapp-send-sample", {
        typingSpeed,
      });
    });
    return;
  }

  Swal.fire(
    "Belum tersedia",
    "Remote otomatis untuk layanan ini belum didukung. Gunakan kontrol manual via ADB/scrcpy.",
    "info"
  );
}

function runAndroidRemoteAction(uid, action, payload = {}) {
  showToast("Menjalankan remote action...", 2000, "info");
  androidRemoteApi
    .runAction(uid, action, payload)
    .then((response) => {
      if (response.success) {
        showToast(
          response.message || "Remote action selesai.",
          3000,
          "success"
        );
      } else {
        showToast(response.message || "Remote action gagal.", 3500, "error");
      }
    })
    .catch((err) => {
      console.error("⚠️ Remote action error:", err);
      showToast(err?.message || "Remote action gagal.", 3500, "error");
    });
}

function stopAndroidRemoteAction(device) {
  if (!device || !device.uid) return;
  androidRemoteApi
    .cancelAction(device.uid)
    .then((response) => {
      if (response.success) {
        showToast(
          response.message || "Aksi remote dihentikan.",
          2500,
          "success"
        );
      } else {
        showToast(
          response.message || "Tidak ada aksi remote aktif.",
          2500,
          "info"
        );
      }
    })
    .catch((err) => {
      console.error("⚠️ Gagal menghentikan remote:", err);
      showToast(err?.message || "Gagal menghentikan remote.", 3000, "error");
    });
}

// ADB tutorial modal controls
window.openAdbTutorialModal = function () {
  const modal = document.getElementById("adbTutorialModal");
  if (modal) modal.style.display = "flex";
};

window.closeAdbTutorialModal = function () {
  const modal = document.getElementById("adbTutorialModal");
  if (modal) modal.style.display = "none";
};

// Modal functions for Android
window.switchAndroidAddType = function(type) {
  _androidAddType = type;
  const adbForm = document.getElementById('androidFormTypeAdb');
  const emuForm = document.getElementById('androidFormTypeEmulator');
  const btnAdb = document.getElementById('btnAndroidTypeAdb');
  const btnEmu = document.getElementById('btnAndroidTypeEmu');
  if (adbForm) adbForm.style.display = type === 'adb' ? '' : 'none';
  if (emuForm) emuForm.style.display = type === 'emulator' ? '' : 'none';
  if (btnAdb) { btnAdb.style.background = type === 'adb' ? 'rgba(61,220,132,0.15)' : 'transparent'; btnAdb.style.color = type === 'adb' ? '#3ddc84' : '#888'; }
  if (btnEmu) { btnEmu.style.background = type === 'emulator' ? 'rgba(61,220,132,0.15)' : 'transparent'; btnEmu.style.color = type === 'emulator' ? '#3ddc84' : '#888'; }
};

window.selectEmuSpec = function(spec) {
  document.querySelectorAll('label[id^="emuSpec"]').forEach(el => {
    el.style.borderColor = el.id === 'emuSpec' + spec.charAt(0).toUpperCase() + spec.slice(1)
      ? 'rgba(61,220,132,0.4)' : '#30363d';
  });
  const customPanel = document.getElementById('emuCustomPanel');
  if (customPanel) customPanel.style.display = spec === 'custom' ? 'block' : 'none';
};

const EMU_RESOLUTION_DENSITY = {
  '540x960': 220,
  '720x1280': 265,
  '1080x1920': 420,
};

function readCustomEmuSpec(prefix) {
  const memoryMb = parseInt(document.getElementById(prefix + 'Ram')?.value, 10) || 1536;
  const cores = parseInt(document.getElementById(prefix + 'Cores')?.value, 10) || 2;
  const resolution = document.getElementById(prefix + 'Resolution')?.value || '720x1280';
  return {
    id: 'custom',
    label: `Custom • ${cores} Core • ${(memoryMb / 1024).toFixed(1)} GB`,
    memoryMb,
    cores,
    resolution,
    density: EMU_RESOLUTION_DENSITY[resolution] || 265,
  };
}

function setCustomEmuSpecInputs(prefix, spec = {}) {
  const memoryMb = spec.memoryMb || 1536;
  const cores = spec.cores || 2;
  const resolution = EMU_RESOLUTION_DENSITY[spec.resolution] ? spec.resolution : '720x1280';
  const ramInput = document.getElementById(prefix + 'Ram');
  const ramLabel = document.getElementById(prefix + 'RamLabel');
  if (ramInput) ramInput.value = memoryMb;
  if (ramLabel) ramLabel.textContent = memoryMb + ' MB';
  const coresInput = document.getElementById(prefix + 'Cores');
  const coresLabel = document.getElementById(prefix + 'CoresLabel');
  if (coresInput) coresInput.value = cores;
  if (coresLabel) coresLabel.textContent = cores + ' Core';
  const resSelect = document.getElementById(prefix + 'Resolution');
  if (resSelect) resSelect.value = resolution;
}

window.openModalAndroid = async function () {
  const modal = document.getElementById("addModalAndroid");
  if (!modal) return;

  _androidAddType = 'adb';
  window.switchAndroidAddType('adb');

  const nameInput = document.getElementById("deviceNameAndroid");
  if (nameInput) nameInput.value = "";

  populateAndroidRemoteServiceSelect("androidRemoteServiceSelect");
  populateAndroidRemoteServiceSelect("androidEmulatorServiceSelect");
  const emulatorServiceSelect = document.getElementById(
    "androidEmulatorServiceSelect"
  );
  if (emulatorServiceSelect) {
    emulatorServiceSelect.value = "android-general";
  }
  populateAndroidVersionSelect("addAndroidVersion", 30);
  toggleEmulatorWhatsAppFields();
  bindAndroidWhatsAppUrlSync("addWhatsAppBaseUrl", "addWhatsAppCallbackUrl");
  bindAndroidWhatsAppUrlSync(
    "addEmuWhatsAppBaseUrl",
    "addEmuWhatsAppCallbackUrl"
  );

  // Initialize select with placeholder (no auto-scan)
  const adbSelect = document.getElementById("androidAdbDeviceSelect");
  if (adbSelect) {
    adbSelect.innerHTML =
      '<option value="" disabled selected>Klik tombol refresh untuk memuat perangkat ADB</option>';
  }

  modal.style.display = "flex";
  setTimeout(() => {
    refreshAdbDeviceOptionsInternal("androidAdbDeviceSelect", {
      showToastMessage: false,
    }).catch((err) => console.warn("⚠️ Gagal auto refresh ADB devices:", err));
  }, 150);
};

window.closeModalAndroid = function () {
  _androidAddType = 'adb';
  const modal = document.getElementById("addModalAndroid");
  if (!modal) return;
  modal.style.display = "none";
  const adbSelect = document.getElementById("androidAdbDeviceSelect");
  if (adbSelect) adbSelect.selectedIndex = 0;
  const serviceSelect = document.getElementById("androidRemoteServiceSelect");
  if (serviceSelect) serviceSelect.selectedIndex = 0;
  const nameInput = document.getElementById("deviceNameAndroid");
  if (nameInput) nameInput.value = "";

  // Clear WhatsApp fields
  const baseUrlInput = document.getElementById("addWhatsAppBaseUrl");
  const callbackUrlInput = document.getElementById("addWhatsAppCallbackUrl");
  const whatsappFields = document.getElementById("addWhatsAppAutomationFields");

  if (baseUrlInput) baseUrlInput.value = "";
  if (callbackUrlInput) callbackUrlInput.value = "";
  if (whatsappFields) whatsappFields.style.display = "none";

  const emuServiceSelect = document.getElementById("androidEmulatorServiceSelect");
  const emuVariantSelect = document.getElementById("addEmuWhatsAppVariant");
  const emuBaseUrlInput = document.getElementById("addEmuWhatsAppBaseUrl");
  const emuCallbackUrlInput = document.getElementById("addEmuWhatsAppCallbackUrl");
  const emuWhatsappFields = document.getElementById(
    "addEmuWhatsAppAutomationFields"
  );
  if (emuServiceSelect) emuServiceSelect.value = "android-general";
  if (emuVariantSelect) emuVariantSelect.value = "consumer";
  if (emuBaseUrlInput) emuBaseUrlInput.value = "";
  if (emuCallbackUrlInput) emuCallbackUrlInput.value = "";
  if (emuWhatsappFields) emuWhatsappFields.style.display = "none";
};

async function submitEmulatorDeviceForm() {
  const name = document.getElementById('deviceNameAndroid')?.value.trim();
  if (!name) { showToast('Nama device wajib diisi.', 3000, 'warning'); return; }
  const specRadio = document.querySelector('input[name="emuSpec"]:checked');
  const specId = specRadio?.value || 'balanced';
  const SPEC_MAP = {
    lite:        { id: 'lite',        memoryMb: 1024, cores: 1, resolution: '540x960',   density: 213 },
    balanced:    { id: 'balanced',    memoryMb: 1536, cores: 2, resolution: '720x1280',  density: 265 },
    performance: { id: 'performance', memoryMb: 2048, cores: 4, resolution: '1080x1920', density: 420 },
  };
  const androidSpec =
    specId === 'custom'
      ? readCustomEmuSpec('emuCustom')
      : SPEC_MAP[specId] || SPEC_MAP.balanced;
  const androidAutomationService =
    document.getElementById("androidEmulatorServiceSelect")?.value ||
    "android-general";
  const isWhatsAppAutomation = isAndroidWhatsAppService(
    androidAutomationService
  );
    try {
      const whatsappBaseUrl = isWhatsAppAutomation
        ? document.getElementById("addEmuWhatsAppBaseUrl")?.value.trim() || ""
        : "";
      const whatsappCallbackUrl = isWhatsAppAutomation
        ? getNormalizedCallbackInput(
            whatsappBaseUrl,
            document.getElementById("addEmuWhatsAppCallbackUrl")?.value.trim() || ""
          )
        : "";
      const androidVersion = Number.parseInt(
        document.getElementById("addAndroidVersion")?.value,
        10
      );
      // "google_apis" (Root) gets Play Store auto-installed on its first
      // boot — see startAndroidEmulatorDevice() in electron-main.js.
      const androidImageVariant =
        document.getElementById("addAndroidVariant")?.value === "playstore"
          ? "playstore"
          : "google_apis";
      const result = await window.electronAPI.addDevice({
        name,
        service: 'android',
        androidSpec,
        androidVersion: Number.isFinite(androidVersion) ? androidVersion : 30,
        androidImageVariant,
        androidAutomationService,
        whatsappVariant: isWhatsAppAutomation
          ? document.getElementById("addEmuWhatsAppVariant")?.value || "consumer"
          : "consumer",
        androidDisplayMode: isWhatsAppAutomation
          ? document.getElementById("addEmuDisplayMode")?.value || "readonly"
          : "readonly",
        whatsappBaseUrl,
        whatsappCallbackUrl,
      });
    if (result?.success) {
      showToast('✅ Android Emulator ditambahkan!', 3000, 'success');
      closeModalAndroid();
      await loadAllDevicesAndroid();
    } else {
      showToast(result?.message || 'Gagal menambah emulator.', 4000, 'error');
    }
  } catch (err) {
    showToast('Error: ' + (err?.message || err), 4000, 'error');
  }
}

window.submitAndroidDevice = async function () {
  // Route to emulator submit if that type is selected
  if (_androidAddType === 'emulator') { submitEmulatorDeviceForm(); return; }

  const name = document.getElementById("deviceNameAndroid").value.trim();
  const adbSelect = document.getElementById("androidAdbDeviceSelect");
  const serviceSelect = document.getElementById("androidRemoteServiceSelect");

  const adbId = adbSelect?.value || "";
  const service = serviceSelect?.value || "";

  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }
  if (!adbId) {
    showToast("Pilih perangkat ADB terlebih dahulu.", 3000, "warning");
    return;
  }
  if (!service) {
    showToast("Pilih jenis layanan terlebih dahulu.", 3000, "warning");
    return;
  }

  const selectedAdb = cachedAdbDevices.find((item) => item.adbId === adbId);

  // Prepare device data
  const deviceData = {
    name,
    adbId,
    adbName: selectedAdb?.description || "",
    service,
    status: selectedAdb?.status === "device" ? "connected" : "disconnected",
  };

  // Add WhatsApp automation URLs if service is android-whatsapp
    if (service === "android-whatsapp") {
      const baseUrl =
        document.getElementById("addWhatsAppBaseUrl")?.value.trim() || "";
      const callbackUrl = getNormalizedCallbackInput(
        baseUrl,
        document.getElementById("addWhatsAppCallbackUrl")?.value.trim() || ""
      );
      const whatsappVariant =
        document.getElementById("addWhatsAppVariant")?.value || "consumer";

    deviceData.whatsappBaseUrl = baseUrl;
    deviceData.whatsappCallbackUrl = callbackUrl;
    deviceData.whatsappVariant = whatsappVariant;
  }

  try {
    const result = await androidRemoteApi.addDevice(deviceData);

    if (result.success) {
      showToast("✅ Device Android berhasil ditambahkan!", 3000, "success");
      if (result.payload) {
        console.log(
          "📦 Payload adb-devices.json yang disimpan:",
          JSON.stringify(result.payload, null, 2)
        );
        showToast(
          `Payload tersimpan: ${result.payload.name} (${result.payload.adbId})`,
          4200,
          "info"
        );
      }
      closeModalAndroid();
      await loadAllDevicesAndroid();
    } else {
      showToast(result.message || "Gagal menambah device.", 4000, "error");
    }
  } catch (err) {
    console.error("Error adding Android device:", err);
    showToast("Error: " + err.message, 4000, "error");
  }
};

window.refreshAdbDeviceOptions = function (
  selectId = "androidAdbDeviceSelect"
) {
  refreshAdbDeviceOptionsInternal(selectId, { showToastMessage: true });
};

// Edit Android device functions
let editingAndroidDeviceUid = null;

window.openEditAndroidModal = async function (uid) {
  try {
    const data = await window.electronAPI.loadDevices();
    const device = (data?.devices || []).find((d) => d.uid === uid);
    if (!device) {
      showToast("Device tidak ditemukan.", 3000, "warning");
      return;
    }

    editingAndroidDeviceUid = uid;
    populateAndroidSpecPreset(
      "editAndroidSpecPresetAndroid",
      "editAndroidSpecDescriptionAndroid"
    );
    populateAndroidVersionSelect("editAndroidVersion", device.androidVersion || 30);

    const nameInput = document.getElementById("editDeviceNameAndroid");
    if (nameInput) nameInput.value = device.name || "";

    // Slider custom selalu diisi dari spec aktif, jadi saat pindah ke Custom
    // nilainya berangkat dari kondisi sekarang
    setCustomEmuSpecInputs("editEmuCustom", device.androidSpec);

    const presetSelect = document.getElementById("editAndroidSpecPresetAndroid");
    if (presetSelect) {
      const customOpt = document.createElement("option");
      customOpt.value = "custom";
      customOpt.textContent = "🎛️ Custom (atur sendiri dengan slider)";
      presetSelect.appendChild(customOpt);

      const toggleCustomPanel = () => {
        const panel = document.getElementById("editEmuCustomPanel");
        if (panel) {
          panel.style.display = presetSelect.value === "custom" ? "block" : "none";
        }
        if (presetSelect.value === "custom") {
          const descEl = document.getElementById("editAndroidSpecDescriptionAndroid");
          if (descEl) descEl.textContent = "Geser slider untuk mengatur RAM, CPU, dan resolusi sesuai kebutuhan.";
        }
      };
      presetSelect.addEventListener("change", toggleCustomPanel);

      const specId = device.androidSpec?.id;
      const isPreset = ANDROID_SPEC_PRESETS.some((p) => p.id === specId);
      presetSelect.value = isPreset ? specId : "custom";
      presetSelect.dispatchEvent(new Event("change"));
    }

    const autoRunInput = document.getElementById("editAutoRunAndroid");
    if (autoRunInput) autoRunInput.checked = !!device.autoRun;

    populateAndroidRemoteServiceSelect("editAndroidAutomationService");
    const automationServiceSelect = document.getElementById(
      "editAndroidAutomationService"
    );
    if (automationServiceSelect) {
      automationServiceSelect.value =
        device.androidAutomationService || "android-general";
    }
    const editVariantSelect = document.getElementById("editEmuWhatsAppVariant");
    const editBaseUrlInput = document.getElementById("editEmuWhatsAppBaseUrl");
    const editCallbackUrlInput = document.getElementById(
      "editEmuWhatsAppCallbackUrl"
    );
    if (editVariantSelect) {
      editVariantSelect.value = device.whatsappVariant || "consumer";
    }
    const editDisplayModeSelect = document.getElementById("editEmuDisplayMode");
    if (editDisplayModeSelect) {
      editDisplayModeSelect.value = device.androidDisplayMode || "readonly";
    }
      if (editBaseUrlInput) {
        editBaseUrlInput.value = device.whatsappBaseUrl || "";
      }
      if (editCallbackUrlInput) {
        editCallbackUrlInput.value = getNormalizedCallbackInput(
          device.whatsappBaseUrl || "",
          device.whatsappCallbackUrl || ""
        );
      }
    toggleEditEmulatorWhatsAppFields();

    const modal = document.getElementById("editModalAndroid");
    if (modal) modal.style.display = "flex";
  } catch (err) {
    showToast("Error: " + (err?.message || err), 4000, "error");
  }
};

window.closeEditModalAndroid = function () {
  editingAndroidDeviceUid = null;
  const modal = document.getElementById("editModalAndroid");
  if (modal) modal.style.display = "none";
  const whatsappFields = document.getElementById(
    "editEmuWhatsAppAutomationFields"
  );
  if (whatsappFields) whatsappFields.style.display = "none";
};

window.saveEditAndroidDevice = async function () {
  if (!editingAndroidDeviceUid) return;

  const name = document.getElementById("editDeviceNameAndroid")?.value.trim();
  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  const presetId =
    document.getElementById("editAndroidSpecPresetAndroid")?.value ||
    DEFAULT_ANDROID_SPEC_ID;
  const androidSpec =
    presetId === "custom"
      ? readCustomEmuSpec("editEmuCustom")
      : { ...(ANDROID_SPEC_PRESETS.find((p) => p.id === presetId) || {}) };
  const autoRun = !!document.getElementById("editAutoRunAndroid")?.checked;
  const androidAutomationService =
    document.getElementById("editAndroidAutomationService")?.value ||
    "android-general";
  const isWhatsAppAutomation = isAndroidWhatsAppService(
    androidAutomationService
  );
  const whatsappVariant = isWhatsAppAutomation
    ? document.getElementById("editEmuWhatsAppVariant")?.value || "consumer"
    : "consumer";
  const androidDisplayMode = isWhatsAppAutomation
    ? document.getElementById("editEmuDisplayMode")?.value || "readonly"
    : "readonly";
  const androidVersionParsed = Number.parseInt(
    document.getElementById("editAndroidVersion")?.value,
    10
  );
  const androidVersion = Number.isFinite(androidVersionParsed)
    ? androidVersionParsed
    : 30;
    const whatsappBaseUrl = isWhatsAppAutomation
      ? document.getElementById("editEmuWhatsAppBaseUrl")?.value.trim() || ""
      : "";
    const whatsappCallbackUrl = isWhatsAppAutomation
      ? getNormalizedCallbackInput(
          whatsappBaseUrl,
          document.getElementById("editEmuWhatsAppCallbackUrl")?.value.trim() || ""
        )
      : "";

  try {
    const result = await window.electronAPI.editDevice({
      uid: editingAndroidDeviceUid,
      name,
      autoRun,
      androidSpec,
      androidVersion,
      androidAutomationService,
      whatsappVariant,
      androidDisplayMode,
      whatsappBaseUrl,
      whatsappCallbackUrl,
    });
    if (result?.success) {
      showToast(
        "✅ Perubahan disimpan. Restart device agar spesifikasi baru terpakai.",
        3500,
        "success"
      );
      closeEditModalAndroid();
      await loadAllDevicesAndroid();
    } else {
      showToast(result?.message || "Gagal menyimpan perubahan.", 4000, "error");
    }
  } catch (err) {
    showToast("Error: " + (err?.message || err), 4000, "error");
  }
};

// Cache daftar versi Android dari main process (katalog statis).
let _androidVersionsCache = null;

async function getAndroidVersionsCached() {
  if (_androidVersionsCache) return _androidVersionsCache;
  try {
    const res = await androidEmuApi.getVersions();
    _androidVersionsCache = res?.versions || [];
  } catch (_) {
    _androidVersionsCache = [];
  }
  return _androidVersionsCache;
}

// Helper: isi dropdown versi Android dan pilih API tertentu (default 30).
async function populateAndroidVersionSelect(selectId, selectedApi = 30) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const versions = await getAndroidVersionsCached();
  select.innerHTML = "";
  const list = versions.length
    ? versions
    : [{ api: 30, label: "Android 11 (API 30)" }];
  list.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = String(v.api);
    opt.textContent = v.label;
    select.appendChild(opt);
  });
  select.value = String(selectedApi || 30);
  if (!select.value) select.value = "30";
}

// Helper: Populate Android spec preset dropdown
function populateAndroidSpecPreset(selectId, descriptionId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = "";
  ANDROID_SPEC_PRESETS.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    select.appendChild(option);
  });

  // Set default
  select.value = DEFAULT_ANDROID_SPEC_ID;

  // Update description on change
  const updateDesc = () => {
    const selectedPreset = ANDROID_SPEC_PRESETS.find(
      (p) => p.id === select.value
    );
    const descEl = document.getElementById(descriptionId);
    if (descEl && selectedPreset) {
      descEl.textContent = selectedPreset.description || "";
    }
  };

  select.addEventListener("change", updateDesc);
  updateDesc(); // Initial update
}

// Select All for Android
window.selectAllDevicesAndroid = function (checkbox) {
  const checkboxes = document.querySelectorAll(
    '#device-list-android input[type="checkbox"][data-device-uid]'
  );
  checkboxes.forEach((cb) => {
    cb.checked = checkbox.checked;
  });
};

// Bulk actions for Android
//
// Emulator starts are staggered, not fired all at once. Each emulator needs its
// own console port + a heavy QEMU/boot; launching them in the same tick spikes
// CPU and makes boots time out. A short gap lets one settle (port reserved, ADB
// ready) before the next begins — we do NOT wait for full boot, so they still
// boot in parallel, just offset.
const ANDROID_BULK_START_STAGGER_MS = 1500;

function androidStartDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAndroidDevicesStaggered(devices) {
  for (let i = 0; i < devices.length; i++) {
    const { uid, service } = devices[i];
    runDevice(uid, service || "android");
    if (i < devices.length - 1) {
      await androidStartDelay(ANDROID_BULK_START_STAGGER_MS);
    }
  }
}

window.runAllDevicesAndroid = async function () {
  const data = await window.electronAPI.loadDevices("android");
  const devices = (data.devices || []).map((device) => ({
    uid: device.uid,
    service: device.service,
  }));
  await runAndroidDevicesStaggered(devices);
};

window.runSelectedDevicesAndroid = async function () {
  const checkboxes = document.querySelectorAll(
    '#device-list-android input[type="checkbox"][data-device-uid]:checked'
  );
  const devices = Array.from(checkboxes).map((cb) => ({
    uid: cb.getAttribute("data-device-uid"),
    service: cb.getAttribute("data-device-service") || "android",
  }));
  await runAndroidDevicesStaggered(devices);
};

window.restartSelectedDevicesAndroid = function () {
  const checkboxes = document.querySelectorAll(
    '#device-list-android input[type="checkbox"][data-device-uid]:checked'
  );
  checkboxes.forEach((cb) => {
    const uid = cb.getAttribute("data-device-uid");
    const service = cb.getAttribute("data-device-service") || "android";
    window.electronAPI.runDevice(uid, service);
  });
};

window.restartAllDevicesAndroid = async function () {
  const data = await window.electronAPI.loadDevices("android");
  const devices = data.devices || [];
  devices.forEach((device) => {
    window.electronAPI.runDevice(device.uid, device.service);
  });
};

window.stopSelectedDevicesAndroid = function () {
  const checkboxes = document.querySelectorAll(
    '#device-list-android input[type="checkbox"][data-device-uid]:checked'
  );
  checkboxes.forEach((cb) => {
    const uid = cb.getAttribute("data-device-uid");
    stopDevice(uid);
  });
};

window.stopAllDevicesAndroid = async function () {
  const data = await window.electronAPI.loadDevices("android");
  const devices = data.devices || [];
  devices.forEach((device) => {
    stopDevice(device.uid);
  });
};

// ── Inisialisasi (dulu di blok DOMContentLoaded renderer.js) ─────────────────
function androidIosModuleInit() {
  ensureAndroidSpecSelectOptions("androidSpecPreset", "androidSpecDescription");
  ensureAndroidSpecSelectOptions(
    "editAndroidSpecPreset",
    "editAndroidSpecDescription"
  );
  populateAndroidRemoteServiceSelect("androidRemoteServiceSelect");
  refreshAdbDeviceOptionsInternal("androidAdbDeviceSelect");
  setupScrcpyHelperCard();
  if (androidRemoteApi.onStatusUpdated) {
    androidRemoteApi.onStatusUpdated((updates = []) => {
      if (!Array.isArray(updates) || !updates.length) return;
      let changed = false;
      cachedAndroidRemoteDevices = cachedAndroidRemoteDevices.map((device) => {
        const next = updates.find((entry) => entry.uid === device.uid);
        if (next && next.status !== device.status) {
          changed = true;
          return { ...device, status: next.status };
        }
        return device;
      });
      if (changed) {
        renderDevicesAndroid(cachedAndroidRemoteDevices);
      }
    });
  }
  if (window.currentActivePage === "android-ios" || document.getElementById("page-android-ios")?.classList.contains("active")) {
    loadAllDevicesAndroid();
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", androidIosModuleInit);
else androidIosModuleInit();


// ── Helper halaman (dulu inline di index.html) ─────────────────────────────
function openIOSSimulator() {
  // Open iOS Simulator window using electronAPI
  if (window.electronAPI && window.electronAPI.send) {
    window.electronAPI.send("open-ios-simulator");
  } else {
    console.error("electronAPI not available");
  }
}

function openAndroidSyncWindow() {
  if (window.electronAPI && window.electronAPI.invoke) {
    window.electronAPI.invoke("android-sync-open-window");
  } else {
    console.error("electronAPI not available");
  }
}

async function fixAndroidEmulator() {
  // Fix Android emulator issues (ADB busy, crash directories, etc.)
  Swal.fire({
    title: "Perbaiki Emulator Android",
    html: `
    <p>Proses ini akan:</p>
    <ul style="text-align: left; margin: 10px auto; max-width: 300px;">
      <li>Menghentikan ADB server</li>
      <li>Membersihkan file temporary</li>
      <li>Restart ADB server</li>
    </ul>
    <p><strong>Berguna untuk fix error:</strong></p>
    <ul style="text-align: left; margin: 10px auto; max-width: 300px; font-size: 0.9em;">
      <li>"ADB busy"</li>
      <li>"device offline"</li>
      <li>Emulator crash</li>
    </ul>
  `,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#8b5cf6",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Ya, Perbaiki",
    cancelButtonText: "Batal",
  }).then(async (result) => {
    if (result.isConfirmed) {
      const loadingSwal = Swal.fire({
        title: "Memperbaiki...",
        text: "Mohon tunggu...",
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        },
      });

      try {
        if (
          window.electronAPI &&
          androidEmuApi &&
          androidEmuApi.fixIssues
        ) {
          const response = await androidEmuApi.fixIssues(
            "fix-android-emulator"
          );

          if (response.success) {
            Swal.fire({
              icon: "success",
              title: "Berhasil!",
              html: `
              <p><strong>Emulator Android berhasil diperbaiki!</strong></p>
              <ul style="text-align: left; margin: 10px auto; max-width: 300px; font-size: 0.9em;">
                <li>✅ ADB server telah di-restart</li>
                <li>✅ File temporary dibersihkan</li>
              </ul>
              <p style="margin-top: 10px; font-size: 0.85em; color: #666;">
                Sekarang Anda bisa mencoba download atau jalankan emulator Android lagi.
              </p>
            `,
              confirmButtonColor: "#4ade80",
            });
          } else {
            Swal.fire({
              icon: "error",
              title: "Gagal",
              text:
                response.error || "Gagal memperbaiki emulator Android.",
              confirmButtonColor: "#ef4444",
            });
          }
        } else {
          console.error("electronAPI.android.fixIssues not available");
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "API untuk fix Android tidak tersedia. Pastikan aplikasi sudah diupdate.",
            confirmButtonColor: "#ef4444",
          });
        }
      } catch (error) {
        console.error("Error fixing Android emulator:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text:
            error.message ||
            "Terjadi kesalahan saat memperbaiki emulator.",
          confirmButtonColor: "#ef4444",
        });
      }
    }
  });
}

// ===================== Status Akselerasi Hardware (Android) =====================
function buildAccelSteps(status) {
  if (status.isWin) {
    return `
      <strong>Cara mengaktifkan akselerasi:</strong>
      <ol>
        <li>Restart ke <strong>BIOS/UEFI</strong> → aktifkan <code>Intel VT-x</code> / <code>AMD-V (SVM)</code>, simpan &amp; reboot.</li>
        <li>Buka <em>Turn Windows features on or off</em> → centang <strong>Windows Hypervisor Platform</strong> (dan <strong>Virtual Machine Platform</strong>).</li>
        <li>Alternatif: install <em>Android Emulator Hypervisor Driver (AEHD)</em> dari Google.</li>
        <li><strong>Restart PC</strong>, lalu jalankan emulator lagi.</li>
      </ol>
      <div style="margin-top:6px; opacity:0.75;">Tombol "Coba aktifkan otomatis" hanya mengaktifkan fitur Windows-nya (butuh izin admin + restart) — pengaturan BIOS tetap harus manual.</div>
    `;
  }
  if (status.isLinux) {
    return `
      <strong>Cara mengaktifkan akselerasi (KVM):</strong>
      <ol>
        <li>Aktifkan virtualization (VT-x/AMD-V) di BIOS/UEFI.</li>
        <li>Install KVM: <code>sudo apt install qemu-kvm</code>.</li>
        <li>Tambahkan user ke grup kvm: <code>sudo usermod -aG kvm $USER</code>, lalu logout/login.</li>
      </ol>
    `;
  }
  return `
    <strong>Akselerasi (HVF) tidak terdeteksi.</strong>
    <ol>
      <li>Pastikan macOS versi terbaru dan tutup aplikasi virtualisasi lain (VirtualBox lama, dll).</li>
      <li>Coba restart aplikasi StarBox.</li>
    </ol>
  `;
}

async function refreshAccelStatus() {
  const panel = document.getElementById("accelInfoPanel");
  if (!panel || !androidEmuApi.accelStatus) return;

  const icon = document.getElementById("accelInfoIcon");
  const title = document.getElementById("accelInfoTitle");
  const sub = document.getElementById("accelInfoSub");
  const steps = document.getElementById("accelInfoSteps");
  const enableBtn = document.getElementById("accelEnableBtn");

  panel.style.display = "block";
  panel.className = "accel-panel check";
  icon.className = "bi bi-cpu";
  title.textContent = "Memeriksa akselerasi hardware...";
  sub.textContent = "";
  steps.style.display = "none";
  enableBtn.style.display = "none";

  try {
    const status = await androidEmuApi.accelStatus();
    if (!status?.success) {
      panel.className = "accel-panel warn";
      icon.className = "bi bi-exclamation-triangle-fill";
      title.textContent = "Gagal memeriksa akselerasi";
      sub.textContent = status?.message || "";
      return;
    }

    if (status.available) {
      panel.className = "accel-panel ok";
      icon.className = "bi bi-check-circle-fill";
      title.textContent = "Akselerasi hardware aktif";
      sub.textContent = `Emulator siap dijalankan (boot ±1 menit). ${status.detail || ""}`.trim();
      steps.style.display = "none";
      enableBtn.style.display = "none";
    } else if (!status.definitive) {
      // accel-check tidak bisa dijalankan (mis. emulator belum diunduh)
      panel.className = "accel-panel check";
      icon.className = "bi bi-info-circle-fill";
      title.textContent = "Status akselerasi belum bisa diperiksa";
      sub.textContent = "Unduh emulator terlebih dahulu, lalu klik \"Cek ulang\".";
      steps.style.display = "none";
      enableBtn.style.display = "none";
    } else if (status.requiresAcceleration) {
      panel.className = "accel-panel warn";
      icon.className = "bi bi-exclamation-triangle-fill";
      title.textContent = "Akselerasi hardware tidak aktif — emulator tidak bisa berjalan";
      sub.textContent = "Emulator Android x86_64 wajib akselerasi (WHPX/HAXM/AEHD). Tanpa ini, emulator keluar dengan kode 1.";
      steps.innerHTML = buildAccelSteps(status);
      steps.style.display = "block";
      enableBtn.style.display = status.isWin ? "inline-flex" : "none";
    } else {
      panel.className = "accel-panel check";
      icon.className = "bi bi-info-circle-fill";
      title.textContent = "Akselerasi tidak terdeteksi — mode software (lambat)";
      sub.textContent = "Emulator tetap bisa jalan tapi boot bisa >10 menit.";
      steps.innerHTML = buildAccelSteps(status);
      steps.style.display = "block";
      enableBtn.style.display = "none";
    }
  } catch (err) {
    panel.className = "accel-panel warn";
    icon.className = "bi bi-exclamation-triangle-fill";
    title.textContent = "Gagal memeriksa akselerasi";
    sub.textContent = err?.message || "";
  }
}
window.refreshAccelStatus = refreshAccelStatus;

async function tryEnableAcceleration() {
  const confirm = await Swal.fire({
    title: "Aktifkan Windows Hypervisor Platform?",
    html: "StarBox akan menjalankan perintah dengan izin administrator (muncul prompt UAC). Setelah selesai, <strong>PC perlu di-restart</strong>.<br><br>Catatan: ini tidak bisa mengaktifkan virtualization yang dimatikan di BIOS.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Ya, coba aktifkan",
    cancelButtonText: "Batal",
    confirmButtonColor: "#8b5cf6",
  });
  if (!confirm.isConfirmed) return;

  Swal.fire({
    title: "Mengaktifkan...",
    html: "Setujui prompt UAC yang muncul.",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const result = await androidEmuApi.enableAcceleration();
    if (result?.success) {
      await Swal.fire({
        title: "Berhasil",
        html: result.message || "Fitur diaktifkan. Silakan restart PC.",
        icon: "success",
      });
    } else {
      await Swal.fire({
        title: "Gagal",
        html: result?.message || "Tidak dapat mengaktifkan akselerasi.",
        icon: "error",
      });
    }
  } catch (err) {
    await Swal.fire({ title: "Gagal", html: err?.message || "Terjadi kesalahan.", icon: "error" });
  }
}
window.tryEnableAcceleration = tryEnableAcceleration;
window.openIOSSimulator = openIOSSimulator;
window.openAndroidSyncWindow = openAndroidSyncWindow;
window.fixAndroidEmulator = fixAndroidEmulator;
