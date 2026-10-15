// ═══════════════════════════════════════════════════════════════════════════════
// Modul WhatsApp Gateway — sisi renderer
// Dimuat oleh core (module-host.js) setelah renderer.js. Semua komunikasi ke
// main process lewat window.electronAPI.modules, yang hanya meneruskan channel
// yang dideklarasikan di manifest.json modul ini.
// ═══════════════════════════════════════════════════════════════════════════════

const waApi = (() => {
  const m = window.electronAPI.modules;
  const call = (channel) => (...args) => m.invoke(channel, ...args);
  const on = (channel) => (cb) => m.on(channel, cb);
  return {
    getDevices:          call("wa-get-devices"),
    createDevice:        call("wa-create-device"),
    startDevice:         call("wa-start-device"),
    stopDevice:          call("wa-stop-device"),
    deleteDevice:        call("wa-delete-device"),
    sendMessage:         call("wa-send-message"),
    getStatus:           call("wa-get-status"),
    getDeviceProfile:    call("wa-get-profile"),

    // Auto-reply
    getAutoReplies:      call("wa-get-auto-replies"),
    addAutoReply:        call("wa-add-auto-reply"),
    deleteAutoReply:     call("wa-delete-auto-reply"),
    toggleAutoReply:     call("wa-toggle-auto-reply"),
    setAutoReplyEnabled: call("wa-set-auto-reply-enabled"),
    setAutoRejectCalls:  call("wa-set-auto-reject-calls"),

    // Schedule
    getSchedules:        call("wa-get-schedules"),
    addSchedule:         call("wa-add-schedule"),
    deleteSchedule:      call("wa-delete-schedule"),

    // Logs
    getMessageLogs:      call("wa-get-message-logs"),
    clearLogs:           call("wa-clear-logs"),
    openWhatsAppWeb:     call("wa-open-web"),
    sendTyping:          call("wa-send-typing"),

    // Event listeners
    onQRCode:            on("wa-qr-code"),
    onConnected:         on("wa-connected"),
    onStatusChange:      on("wa-status-change"),
    onScheduleStatus:    on("wa-schedule-status"),
    onMessageReceived:   on("wa-message-received"),
  };
})();

// ============================================
// WhatsApp Gateway Functions
// ============================================

let currentWADeviceId = null;
let currentQRDeviceId = null;
let currentProfileDeviceId = null;
let waDevicesCache = {}; // Cache devices data for quick access
let currentAutoReplyCount = 0;
const scheduleStatusMap = new Map();
const QR_REFRESH_INTERVAL_SECONDS = 60;
let qrAutoRefreshTimerId = null;
let qrAutoRefreshRemainingSeconds = QR_REFRESH_INTERVAL_SECONDS;
let qrAutoRefreshTargetDeviceId = null;
const CAMPAIGN_LOG_SOURCES = new Set(["campaign", "broadcast"]);
const CAMPAIGN_LOG_FETCH_LIMIT = 500;

function isQRModalVisible() {
  const modal = document.getElementById("qrModalWA");
  return modal && modal.style.display === "flex";
}

function updateQRTimerIndicator(visible) {
  const timerEl = document.getElementById("qrTimerIndicator");
  const timerValue = document.getElementById("qrTimerValue");
  if (!timerEl || !timerValue) return;
  if (visible && qrAutoRefreshRemainingSeconds > 0) {
    timerValue.textContent = String(qrAutoRefreshRemainingSeconds);
    timerEl.style.display = "block";
  } else {
    timerEl.style.display = "none";
  }
}

function stopQRAutoRefreshTimer() {
  if (qrAutoRefreshTimerId) {
    clearInterval(qrAutoRefreshTimerId);
    qrAutoRefreshTimerId = null;
  }
  qrAutoRefreshTargetDeviceId = null;
  qrAutoRefreshRemainingSeconds = QR_REFRESH_INTERVAL_SECONDS;
  updateQRTimerIndicator(false);
}

function startQRAutoRefreshTimer(deviceId) {
  if (
    !deviceId ||
    !isQRModalVisible() ||
    currentQRDeviceId !== deviceId
  ) {
    return;
  }
  stopQRAutoRefreshTimer();
  qrAutoRefreshTargetDeviceId = deviceId;
  qrAutoRefreshRemainingSeconds = QR_REFRESH_INTERVAL_SECONDS;
  updateQRTimerIndicator(true);
  qrAutoRefreshTimerId = setInterval(() => {
    if (
      !isQRModalVisible() ||
      currentQRDeviceId !== deviceId ||
      qrAutoRefreshTargetDeviceId !== deviceId
    ) {
      stopQRAutoRefreshTimer();
      return;
    }
    qrAutoRefreshRemainingSeconds -= 1;
    if (qrAutoRefreshRemainingSeconds <= 0) {
      stopQRAutoRefreshTimer();
      if (isQRModalVisible() && currentQRDeviceId === deviceId) {
        refreshQRCode();
      }
      return;
    }
    updateQRTimerIndicator(true);
  }, 1000);
}
function getWAGatewayDeviceLimit() {
  const state =
    (typeof window !== "undefined" && window.getCurrentAuthState
      ? window.getCurrentAuthState()
      : null) || {};
  if (state.package?.is_device_limit_unlimited) {
    return Infinity;
  }
  if (typeof state.limitDeviceWAGateway === "number") {
    return state.limitDeviceWAGateway;
  }
  if (state.isLoggedIn) {
    return state.deviceQuota ?? Infinity;
  }
  return Infinity;
}

function getAutoReplyLimit() {
  const state =
    (typeof window !== "undefined" && window.getCurrentAuthState
      ? window.getCurrentAuthState()
      : null) || {};
  if (typeof state.limitAutoReply === "number") {
    return state.limitAutoReply;
  }
  return Infinity;
}

async function getCampaignBroadcastLimit() {
  const state =
    (typeof window !== "undefined" && window.getCurrentAuthState
      ? window.getCurrentAuthState()
      : null) || {};
  const totalLimit =
    typeof state.limitBroadcastDay === "number"
      ? state.limitBroadcastDay
      : Infinity;
  if (!Number.isFinite(totalLimit)) {
    return { total: Infinity, remaining: Infinity };
  }
  const deviceId = currentWADeviceId;
  if (!deviceId || !waApi.getMessageLogs) {
    return { total: totalLimit, remaining: totalLimit };
  }

  try {
    const result =
      await waApi.getMessageLogs(
        deviceId,
        CAMPAIGN_LOG_FETCH_LIMIT
      );
    if (!result.success) {
      console.warn(
        "Unable to read campaign logs, falling back to quota limit:",
        result.error
      );
      return { total: totalLimit, remaining: totalLimit };
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const usedCount = (result.logs || []).filter((log) => {
      if (!log || !log.source) return false;
      if (!CAMPAIGN_LOG_SOURCES.has(String(log.source).toLowerCase())) {
        return false;
      }
      const timestamp = log.timestamp ? new Date(log.timestamp) : null;
      if (!timestamp || Number.isNaN(timestamp.getTime())) return false;
      return timestamp.getTime() >= todayStart.getTime();
    }).length;
    return {
      total: totalLimit,
      remaining: Math.max(0, totalLimit - usedCount),
    };
  } catch (error) {
    console.error("Failed to compute campaign broadcast usage:", error);
    return { total: totalLimit, remaining: totalLimit };
  }
}

// Load WA devices
async function loadWADevices() {
  console.log("loadWADevices called");
  const container = document.getElementById("wa-device-list");
  if (!container) {
    console.error("Container #wa-device-list not found!");
    return;
  }

  // Show loading state
  container.innerHTML =
    '<div class="wa-empty-state"><p>Loading...</p></div>';

  try {
    console.log("Fetching WA devices from backend...");
    const result = await waApi.getDevices();
    console.log("WA devices result:", result);

    if (!result.success) {
      console.error("Failed to get devices:", result.error);
      container.innerHTML =
        '<div class="wa-empty-state"><p>Error loading devices: ' +
        (result.error || "Unknown error") +
        "</p></div>";
      return;
    }

    const devices = result.devices || [];
    console.log("Loaded devices:", devices.length);

    // Cache devices for quick access
    waDevicesCache = {};
    devices.forEach((device) => {
      waDevicesCache[device.id] = device;
    });

    if (devices.length === 0) {
      container.innerHTML = `
        <div class="wa-empty-state" style="grid-column: 1 / -1; background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(34, 197, 94, 0.35); border-radius: 18px; padding: 42px 24px; text-align: center; backdrop-filter: blur(8px);">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; color: #4ade80; margin-bottom: 14px;">
            <i class="bi bi-whatsapp"></i>
          </div>
          <h3 style="margin: 0 0 8px; font-size: 1.2rem; font-weight: 700; color: #ffffff;">Belum Ada Device WhatsApp Gateway</h3>
          <p style="margin: 0 0 20px; color: rgba(226, 232, 240, 0.7); font-size: 0.9rem; max-width: 480px; margin-inline: auto;">Hubungkan nomor WhatsApp Anda untuk mulai menggunakan fitur otomatisasi, auto-reply, dan penyiaran pesan multi-device.</p>
          <button class="wag-btn wag-btn-primary" onclick="openWAGatewayModal()">
            <i class="bi bi-plus-circle-fill"></i> Tambah Device Sekarang
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    const sortedDevices = [...devices].sort((a, b) => {
      const aTs =
        Date.parse(a.created_at || a.createdAt || "") || Date.now();
      const bTs =
        Date.parse(b.created_at || b.createdAt || "") || Date.now();
      return aTs - bTs;
    });
    const limit = getWAGatewayDeviceLimit();
    const visibleDevices =
      typeof limit === "number" && Number.isFinite(limit)
        ? sortedDevices.slice(0, Math.max(1, Math.floor(limit)))
        : sortedDevices;

    visibleDevices.forEach((device) => {
      const card = createWADeviceCard(device);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading WA devices:", error);
    container.innerHTML =
      '<div class="wa-empty-state"><p>Error loading devices: ' +
      error.message +
      "</p></div>";
  }
}

// Create WA device card
function createWADeviceCard(device) {
  const card = document.createElement("div");
  card.className = "wa-device-card";
  card.id = `wa-device-${device.id}`;

  const statusClass = device.status || "disconnected";
  const statusText =
    {
      connected: "Connected",
      connecting: "Connecting...",
      disconnected: "Disconnected",
      qr_ready: "Scan QR",
    }[statusClass] || "Unknown";

  const statusDot = {
    connected: '<span style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e;display:inline-block;"></span>',
    connecting: '<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>',
    qr_ready: '<span style="width:7px;height:7px;border-radius:50%;background:#38bdf8;box-shadow:0 0 6px #38bdf8;display:inline-block;"></span>',
    disconnected: '<span style="width:7px;height:7px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>',
  }[statusClass] || '';

  card.innerHTML = `
    <div class="wa-device-card-header">
      <div class="wa-device-name">
        <i class="bi bi-whatsapp" style="color:${statusClass==='connected'?'#22c55e':'#94a3b8'};font-size:1.15rem;"></i>
        <span>${device.name}</span>
      </div>
      <div class="wa-device-status ${statusClass}">
        ${statusDot} <span>${statusText}</span>
      </div>
    </div>

    ${
      device.phone
        ? `<div class="wa-device-phone"><i class="bi bi-phone text-success"></i> <span>${device.phone}</span></div>`
        : `<div class="wa-device-phone" style="opacity:0.6;"><i class="bi bi-phone"></i> <span>Belum terhubung nomor</span></div>`
    }

    <div class="wa-device-actions">
      ${
        statusClass === "disconnected"
          ? `<button onclick="startWADevice('${device.id}')" class="btn-primary">
          <i class="bi bi-play-circle"></i> Connect
        </button>`
          : `<button onclick="stopWADevice('${device.id}')" class="btn-danger">
          <i class="bi bi-stop-circle"></i> Disconnect
        </button>`
      }
      ${
        statusClass === "qr_ready"
          ? `<button onclick="prepareFreshQR('${device.id}')" class="btn-info">
          <i class="bi bi-qr-code"></i> Show QR
        </button>`
          : ""
      }
      ${
        statusClass === "connected"
          ? `<button onclick="openSendMessageModal('${device.id}')" class="btn-success">
          <i class="bi bi-send"></i> Send Message
        </button>`
          : ""
      }
      ${
        statusClass === "connected"
          ? `<button onclick="showWAProfileModal('${device.id}')" class="btn-outline">
          <i class="bi bi-person-circle"></i> Profil
        </button>`
          : ""
      }
      ${
        statusClass !== "disconnected"
          ? `<button onclick="restartWADevice('${device.id}')" class="btn-warning" title="Restart connection">
          <i class="bi bi-arrow-repeat"></i> Restart
        </button>`
          : ""
      }
      <div class="wa-actions-dropdown" style="position: relative">
        <button
          type="button"
          class="btn-secondary"
          onclick="toggleWAActionsMenu('${device.id}')"
          data-wa-actions="${device.id}"
        >
          <i class="bi bi-list"></i> Actions
        </button>
        <div
          id="waActionsMenu-${device.id}"
          class="wa-actions-menu"
          style="
            display: none;
            position: absolute;
            right: 0;
            top: 110%;
            background: #0f172a;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            min-width: 185px;
            z-index: 50;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
            overflow: hidden;
          "
        >
          <button
            type="button"
            class="wa-actions-menu-item"
            style="
              display: block;
              width: 100%;
              text-align: left;
              padding: 10px 12px;
              background: transparent;
              border: none;
              color: #e2e8f0;
              cursor: pointer;
            "
            onclick="handleWAAction('${device.id}', 'auto-reply')"
          >
            <i class="bi bi-chat-left-text"></i> Auto Reply
          </button>
          <button
            type="button"
            class="wa-actions-menu-item"
            style="
              display: block;
              width: 100%;
              text-align: left;
              padding: 10px 12px;
              background: transparent;
              border: none;
              color: #e2e8f0;
              cursor: pointer;
            "
            onclick="handleWAAction('${device.id}', 'broadcast')"
          >
            <i class="bi bi-megaphone"></i> Campaign
          </button>
          <button
            type="button"
            class="wa-actions-menu-item"
            style="
              display: block;
              width: 100%;
              text-align: left;
              padding: 10px 12px;
              background: transparent;
              border: none;
              color: #e2e8f0;
              cursor: pointer;
            "
            onclick="handleWAAction('${device.id}', 'logs')"
          >
            <i class="bi bi-journal-text"></i> Logs
          </button>
          <div style="height:1px;background:rgba(255,255,255,0.07);margin:2px 0;"></div>
          <button
            type="button"
            class="wa-actions-menu-item"
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: 100%;
              text-align: left;
              padding: 10px 12px;
              background: transparent;
              border: none;
              color: ${device.auto_reject_calls ? '#f87171' : '#e2e8f0'};
              cursor: pointer;
            "
            onclick="handleWAAction('${device.id}', 'calls')"
          >
            <span><i class="bi bi-telephone-x"></i> Panggilan</span>
            <span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;
              background:${device.auto_reject_calls ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.07)'};
              color:${device.auto_reject_calls ? '#f87171' : '#6b7280'};">
              ${device.auto_reject_calls ? 'Reject ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>
      <button onclick="quickClearWALogs('${
        device.id
      }')" class="btn-secondary">
        <i class="bi bi-trash"></i> Clear Logs
      </button>
      <button onclick="deleteWADevice('${
        device.id
      }')" class="btn-danger" ${
    statusClass === "connected"
      ? 'disabled title="Disconnect before deleting"'
      : ""
  }>
        <i class="bi bi-trash"></i> Delete
      </button>
    </div>
  `;

  return card;
}

let openWAActionsMenuId = null;

function closeWAActionsMenu() {
  if (!openWAActionsMenuId) return;
  const menu = document.getElementById(
    `waActionsMenu-${openWAActionsMenuId}`
  );
  if (menu) {
    menu.style.display = "none";
  }
  openWAActionsMenuId = null;
  document.removeEventListener("click", handleOutsideWAActionsMenu, true);
}

function handleOutsideWAActionsMenu(event) {
  if (!openWAActionsMenuId) return;
  const menu = document.getElementById(
    `waActionsMenu-${openWAActionsMenuId}`
  );
  const trigger = document.querySelector(
    `[data-wa-actions="${openWAActionsMenuId}"]`
  );
  if (
    (menu && menu.contains(event.target)) ||
    (trigger && trigger.contains(event.target))
  ) {
    return;
  }
  closeWAActionsMenu();
}

function toggleWAActionsMenu(deviceId) {
  const menu = document.getElementById(`waActionsMenu-${deviceId}`);
  if (!menu) return;
  const isOpen = openWAActionsMenuId === deviceId;
  closeWAActionsMenu();
  if (!isOpen) {
    menu.style.display = "block";
    openWAActionsMenuId = deviceId;
    document.addEventListener("click", handleOutsideWAActionsMenu, true);
  }
}

function toggleWAGuidePanel() {
  const banner = document.getElementById("wagUnofficialBanner");
  if (!banner) return;
  const isHidden = banner.style.display === "none";
  banner.style.display = isHidden ? "block" : "none";
  const toggleBtn = document.getElementById("wagToggleGuideBtn");
  if (toggleBtn) {
    toggleBtn.innerHTML = isHidden
      ? '<i class="bi bi-journal-bookmark"></i> Panduan'
      : '<i class="bi bi-journal-text"></i> Tampilkan Panduan';
  }
}

async function handleWAAction(deviceId, action) {
  toggleWAActionsMenu(deviceId);
  if (!deviceId || !action) return;
  currentWADeviceId = deviceId;
  if (action === "auto-reply") {
    await openWASettingsModal(deviceId, "auto-reply");
  } else if (action === "broadcast") {
    await openWASettingsModal(deviceId, "broadcast");
  } else if (action === "logs") {
    await openWASettingsModal(deviceId, "logs");
  } else if (action === "calls") {
    await openWASettingsModal(deviceId, "calls");
  }
}

async function quickClearWALogs(deviceId) {
  currentWADeviceId = deviceId;
  const input = document.getElementById("logRetentionDays");
  const defaultDays =
    parseInt(input?.value, 10) && parseInt(input.value, 10) > 0
      ? parseInt(input.value, 10)
      : 7;
  const result = await Swal.fire({
    title: "Clear Logs",
    input: "number",
    inputLabel: "Hapus log yang lebih lama dari (hari)",
    inputValue: defaultDays,
    inputAttributes: { min: "1", step: "1" },
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal",
    icon: "warning",
  });
  if (!result.isConfirmed) return;
  const days = Number(result.value);
  if (Number.isFinite(days) && input) {
    input.value = days;
  }
  await submitLogRetention();
}

// Open add device modal
function openWAGatewayModal() {
  const modal = document.getElementById("addModalWAGateway");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("deviceNameWA").value = "";
    document.getElementById("deviceNameWA").focus();
  }
}

// Close add device modal
function closeWAGatewayModal() {
  const modal = document.getElementById("addModalWAGateway");
  if (modal) modal.style.display = "none";
}

// Submit WA device
async function submitWAGatewayDevice() {
  const name = document.getElementById("deviceNameWA").value.trim();

  if (!name) {
    Swal.fire("Error", "Nama device harus diisi", "error");
    return;
  }

  try {
    await loadWADevices();
    const currentCount = Object.keys(waDevicesCache).length;
    const limit = getWAGatewayDeviceLimit();
    if (typeof limit === "number" && currentCount >= limit) {
      Swal.fire(
        "Batas perangkat tercapai",
        `Paket Anda hanya boleh memiliki ${limit} device WhatsApp Gateway.`,
        "warning"
      );
      return;
    }

    const deviceId = Date.now().toString();
    const result = await waApi.createDevice(
      deviceId,
      name
    );

    if (result.success) {
      closeWAGatewayModal();
      await loadWADevices();

      // Auto start device
      await startWADevice(deviceId);
    } else {
      Swal.fire(
        "Error",
        result.error || "Failed to create device",
        "error"
      );
    }
  } catch (error) {
    console.error("Error creating device:", error);
    Swal.fire("Error", error.message, "error");
  }
}

// Start WA device
async function startWADevice(deviceId) {
  try {
    console.log("▶️ Starting device:", deviceId);
    const result = await waApi.startDevice(
      deviceId
    );

    if (result.success) {
      // Silently update UI - no annoying popup
      console.log("✅ Device start initiated");
      await loadWADevices();
      showQRModal(deviceId);
    } else {
      Swal.fire(
        "Error",
        result.message || "Failed to start device",
        "error"
      );
    }
  } catch (error) {
    console.error("Error starting device:", error);
    Swal.fire("Error", error.message, "error");
  }
}

// Stop WA device
async function stopWADevice(deviceId) {
  const confirmResult = await Swal.fire({
    title: "Logout WA?",
    text: "Menghentikan device akan logout WA dan perlu scan QR ulang. Lanjutkan?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Logout",
    cancelButtonText: "Batal",
    reverseButtons: true,
  });

  if (!confirmResult.isConfirmed) {
    return;
  }

  try {
    console.log("🛑 Stopping device:", deviceId);
    const result = await waApi.stopDevice(
      deviceId
    );

    if (result.success) {
      console.log("✅ Device stopped and session cleared");
      await loadWADevices();
    } else {
      Swal.fire(
        "Error",
        result.message || "Failed to stop device",
        "error"
      );
    }
  } catch (error) {
    console.error("Error stopping device:", error);
    Swal.fire("Error", error.message, "error");
  }
}

// Restart WA device
async function restartWADevice(deviceId) {
  try {
    console.log("🔄 Restarting device:", deviceId);

    // Get device info
    const device = waDevicesCache[deviceId];
    if (!device) {
      Swal.fire("Error", "Device not found", "error");
      return;
    }

    // Show loading
    Swal.fire({
      title: "Restarting Device",
      text: `Restarting ${device.name}...`,
      icon: "info",
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Stop device first
    console.log("🛑 Stopping device...");
    const stopResult =
      await waApi.stopDevice(deviceId, {
        logout: false,
        cleanup: false,
      });

    if (!stopResult.success) {
      console.warn(
        "⚠️ Stop device returned error, but continuing with restart"
      );
    }

    // Wait 2 seconds for clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start device again
    console.log("▶️ Starting device...");
    const startResult =
      await waApi.startDevice(deviceId);

    if (startResult.success) {
      Swal.fire({
        title: "Success",
        text: "Device restarted successfully. Please wait for QR code or connection...",
        icon: "success",
        timer: 3000,
      });
      await loadWADevices();
    } else {
      Swal.fire(
        "Error",
        startResult.message || "Failed to restart device",
        "error"
      );
    }
  } catch (error) {
    console.error("Error restarting device:", error);
    Swal.fire("Error", error.message, "error");
  }
}

// Open send message modal
function openSendMessageModal(deviceId) {
  currentWADeviceId = deviceId;

  // Get device from cache
  const device = waDevicesCache[deviceId];
  if (!device) {
    Swal.fire("Error", "Device not found", "error");
    return;
  }

  // Update device name label
  const deviceNameLabel = document.getElementById(
    "sendMessageDeviceName"
  );
  if (deviceNameLabel) {
    deviceNameLabel.textContent = `Send from: ${device.name} (${
      device.phone || "No phone"
    })`;
  }

  // Clear form
  document.getElementById("sendMessagePhone").value = "";
  document.getElementById("sendMessageText").value = "";

  // Show modal
  const modal = document.getElementById("sendMessageModal");
  if (modal) {
    modal.style.display = "flex";
  }
}

// Close send message modal
function closeSendMessageModal() {
  const modal = document.getElementById("sendMessageModal");
  if (modal) modal.style.display = "none";
  currentWADeviceId = null;
}

// Submit send message
async function submitSendMessage() {
  if (!currentWADeviceId) {
    Swal.fire("Error", "No device selected", "error");
    return;
  }

  const phone = document.getElementById("sendMessagePhone").value.trim();
  const message = document.getElementById("sendMessageText").value.trim();

  // Validation
  if (!phone) {
    Swal.fire("Error", "Phone number is required", "error");
    return;
  }

  if (!message) {
    Swal.fire("Error", "Message is required", "error");
    return;
  }

  // Validate phone format (digits only, minimum 10 characters)
  if (!/^\d{10,15}$/.test(phone)) {
    Swal.fire(
      "Error",
      "Invalid phone number format. Use digits only (e.g., 628123456789)",
      "error"
    );
    return;
  }

  try {
    console.log(
      "📤 Sending message to:",
      phone,
      "from device:",
      currentWADeviceId
    );

    const result = await waApi.sendMessage(
      currentWADeviceId,
      phone,
      message
    );

    if (result.success) {
      Swal.fire("Success", "Message sent successfully!", "success");
      closeSendMessageModal();
    } else {
      Swal.fire(
        "Error",
        result.error || "Failed to send message",
        "error"
      );
    }
  } catch (error) {
    console.error("Error sending message:", error);
    Swal.fire("Error", error.message, "error");
  }
}

// Delete WA device
async function deleteWADevice(deviceId) {
  const device = waDevicesCache[deviceId];
  if (device?.status === "connected") {
    Swal.fire(
      "Info",
      "Disconnect terlebih dahulu sebelum menghapus device ini.",
      "warning"
    );
    return;
  }

  const confirmResult = await Swal.fire({
    title: "Hapus Device?",
    text: "Device dan semua data terkait akan dihapus",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal",
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const result = await waApi.deleteDevice(
      deviceId
    );

    if (result.success) {
      Swal.fire("Success", "Device deleted", "success");
      await loadWADevices();
    } else {
      Swal.fire(
        "Error",
        result.message || "Failed to delete device",
        "error"
      );
    }
  } catch (error) {
    console.error("Error deleting device:", error);
    Swal.fire("Error", error.message, "error");
  }
}

// Show QR modal
async function showQRModal(deviceId, autoRefresh = false) {
  console.log(
    "📱 showQRModal called for deviceId:",
    deviceId,
    "autoRefresh:",
    autoRefresh
  );
  currentQRDeviceId = deviceId;

  // Reload devices to get latest data
  await loadWADevices();

  // Get device from cache
  const device = waDevicesCache[deviceId];
  if (!device) {
    console.error("❌ Device not found in cache:", deviceId);
    Swal.fire("Error", "Device not found", "error");
    return;
  }

  console.log("📱 Device found:", device.name, "Status:", device.status);
  console.log("📱 QR code available:", !!device.qr_code);

  // Update device name label
  const deviceNameLabel = document.getElementById("qrDeviceNameLabel");
  if (deviceNameLabel) {
    deviceNameLabel.textContent = `Scan QR untuk: ${device.name}`;
  }

  updateQRProfileStatus(device);
  // Show modal first
  const modal = document.getElementById("qrModalWA");
  if (modal) {
    modal.style.display = "flex";
  } else {
    console.error("❌ Modal element #qrModalWA not found!");
    return;
  }

  const qrContainer = document.getElementById("qrCodeContainer");
  const refreshBtn = document.getElementById("refreshQRBtn");
  const shouldGenerateQR = autoRefresh || !device.qr_code;

  if (shouldGenerateQR) {
    const fallbackStatus =
      ["connecting", "reconnecting", "disconnected"].includes(
        device.status
      ) && device.status
        ? device.status
        : "hidden";
    updateQRModalStatus(fallbackStatus);

    if (autoRefresh) {
      if (autoRefresh) {
        console.log("🔄 Auto-refreshing QR code for device:", deviceId);
      } else {
        console.warn(
          "⚠️ Device has no QR code yet, waiting for generation"
        );
      }

      // Show loading state
      if (qrContainer) {
        qrContainer.innerHTML =
          '<div style="padding: 2rem;"><i class="bi bi-hourglass-split" style="font-size: 2rem; color: #6b7280;"></i><p style="color: #6b7280; margin-top: 1rem;">Generating QR Code...</p></div>';
      }

      // Manage refresh button
      if (refreshBtn) {
        if (autoRefresh) {
          refreshBtn.disabled = true;
          refreshBtn.innerHTML =
            '<i class="bi bi-hourglass-split"></i> Generating...';
        } else {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML =
            '<i class="bi bi-arrow-clockwise"></i> Refresh QR';
        }
      }

      if (autoRefresh) {
        // Restart device to generate new QR
        try {
          // Stop device first if it's running
          if (device.status !== "disconnected") {
            await waApi.stopDevice(deviceId);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
          }

          // Start device again
          const result =
            await waApi.startDevice(
              deviceId
            );
          if (!result.success) {
            throw new Error(result.message || "Failed to start device");
          }

          console.log("✅ Device restarted, waiting for QR code...");
        } catch (error) {
          console.error("❌ Failed to restart device:", error);
          if (qrContainer) {
            qrContainer.innerHTML =
              '<div style="padding: 2rem;"><i class="bi bi-x-circle" style="font-size: 2rem; color: #ef4444;"></i><p style="color: #ef4444; margin-top: 1rem;">Failed to generate QR. Please try again.</p></div>';
          }
        } finally {
          if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML =
              '<i class="bi bi-arrow-clockwise"></i> Refresh QR';
          }
        }
      }

      return;
    }

    // Clear previous QR code first
    const img = document.getElementById("qrImage");
    const canvas = document.getElementById("qrCanvas");
    if (img) {
      img.src = "";
      img.style.display = "none";
    }
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = "none";
    }

    // Restore QR container structure if needed
    if (qrContainer && !qrContainer.querySelector("#qrImage")) {
      qrContainer.innerHTML =
        '<img id="qrImage" style="width: 300px; height: 300px; display: none;" /><canvas id="qrCanvas" style="display: block;"></canvas>';
    }

    // Render the QR code for THIS specific device
    console.log("📱 Rendering QR code for device:", deviceId);
    renderQRCode(device.qr_code);
    updateQRModalStatus(device.status || "qr_ready");

    console.log("✅ Modal displayed with QR code");
  }
}
// Refresh QR code - regenerate new QR
async function refreshQRCode() {
  if (!currentQRDeviceId) {
    console.error("❌ No device selected for QR refresh");
    return;
  }

  const device = waDevicesCache[currentQRDeviceId];
  if (device?.status === "connected") {
    updateQRProfileStatus(device);
    Swal.fire(
      "Info",
      `WhatsApp ${device.name} sudah terhubung sebagai ${
        device.phone || "–"
      }.`,
      "info"
    );
    return;
  }

  console.log("🔄 Refreshing QR code for device:", currentQRDeviceId);

  // Call showQRModal with autoRefresh = true
  await showQRModal(currentQRDeviceId, true);
}

// Close QR modal
function closeQRModal() {
  console.log("📱 Closing QR modal");
  updateQRModalStatus("hidden");
  const modal = document.getElementById("qrModalWA");
  if (modal) modal.style.display = "none";

  // Clear QR code display
  const img = document.getElementById("qrImage");
  const canvas = document.getElementById("qrCanvas");
  if (img) {
    img.src = "";
    img.style.display = "none";
  }
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = "none";
  }

  // Restore QR container structure
  const qrContainer = document.getElementById("qrCodeContainer");
  if (qrContainer) {
    qrContainer.innerHTML =
      '<img id="qrImage" style="width: 300px; height: 300px; display: none;" /><canvas id="qrCanvas" style="display: block;"></canvas>';
  }

  // Re-enable refresh button
  const refreshBtn = document.getElementById("refreshQRBtn");
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML =
      '<i class="bi bi-arrow-clockwise"></i> Refresh QR';
  }

  currentQRDeviceId = null;
  console.log("✅ QR modal closed and cleared");
}

async function prepareFreshQR(deviceId) {
  console.log("🔁 Preparing fresh QR for device:", deviceId);
  currentQRDeviceId = deviceId;
  await refreshQRCode();
}

// Render QR code
function renderQRCode(qrDataURL) {
  console.log("📱 renderQRCode called, data type:", typeof qrDataURL);
  console.log(
    "📱 Is data URL:",
    qrDataURL && qrDataURL.startsWith("data:")
  );

  // Check if qrDataURL is already a data URL from main process
  if (qrDataURL && qrDataURL.startsWith("data:image")) {
    // Already generated in main process, just display it
    const img = document.getElementById("qrImage");
    const canvas = document.getElementById("qrCanvas");
    if (img) {
      img.src = qrDataURL;
      img.style.display = "block";
      if (canvas) canvas.style.display = "none"; // Hide canvas
      console.log("✅ QR Code image set successfully");
    } else {
      console.error("❌ Image element #qrImage not found!");
    }
    return;
  }

  // Fallback: try to use canvas if QRCode library available
  const canvas = document.getElementById("qrCanvas");
  if (!canvas) {
    console.error("❌ Canvas element #qrCanvas not found!");
    return;
  }

  if (typeof QRCode === "undefined") {
    console.error(
      "❌ QRCode library not loaded and no data URL provided!"
    );
    return;
  }

  QRCode.toCanvas(
    canvas,
    qrDataURL,
    {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    },
    (error) => {
      if (error) {
        console.error("❌ QR Code generation error:", error);
      } else {
        console.log("✅ QR Code rendered successfully");
      }
    }
  );
}

const QR_MODAL_STATUS_CONFIGS = {
  qr_ready: {
    message:
      "QR siap dipindai — buka WhatsApp dan pilih Linked Devices → Link a Device.",
    icon: "bi bi-qr-code",
    iconSpin: false,
    showMessage: true,
    showGraphics: true,
    disableRefresh: false,
    buttonLabel: '<i class="bi bi-arrow-clockwise"></i> Refresh QR',
  },
  connecting: {
    message:
      "Terlihat sudah discan, sedang menyimpan session dan sinkronisasi...",
    icon: "bi bi-arrow-repeat",
    iconSpin: true,
    showMessage: true,
    showGraphics: false,
    disableRefresh: true,
    buttonLabel:
      '<i class="bi bi-hourglass-split"></i> Menyimpan session...',
  },
  reconnecting: {
    message: "Koneksi terputus, mencoba menyambung kembali...",
    icon: "bi bi-arrow-repeat",
    iconSpin: true,
    showMessage: true,
    showGraphics: false,
    disableRefresh: true,
    buttonLabel: '<i class="bi bi-arrow-repeat"></i> Mencoba ulang...',
  },
  disconnected: {
    message:
      "QR sudah kedaluwarsa atau sesi terputus. Tekan Refresh untuk membuat ulang.",
    icon: "bi bi-x-circle",
    iconSpin: false,
    showMessage: true,
    showGraphics: false,
    disableRefresh: false,
    buttonLabel: '<i class="bi bi-arrow-clockwise"></i> Refresh QR',
  },
  hidden: {
    showMessage: false,
    showGraphics: true,
    disableRefresh: false,
  },
};

function updateQRModalStatus(statusKey = "hidden") {
  const banner = document.getElementById("qrStatusMessage");
  const textEl = document.getElementById("qrStatusText");
  if (!banner || !textEl) return;

  const iconEl = banner.querySelector("i");
  const config =
    QR_MODAL_STATUS_CONFIGS[statusKey] || QR_MODAL_STATUS_CONFIGS.hidden;

  if (config.showMessage) {
    banner.style.display = "flex";
    textEl.textContent = config.message;
    if (iconEl) {
      iconEl.className = config.iconSpin
        ? `${config.icon} bi-spin`
        : config.icon;
    }
  } else {
    banner.style.display = "none";
  }

  const qrImage = document.getElementById("qrImage");
  const qrCanvas = document.getElementById("qrCanvas");
  const showGraphics = config.showGraphics ?? true;
  if (qrImage) {
    qrImage.style.display = showGraphics ? "block" : "none";
  }
  if (qrCanvas) {
    qrCanvas.style.display = showGraphics ? "block" : "none";
  }

  const refreshBtn = document.getElementById("refreshQRBtn");
  if (refreshBtn) {
    refreshBtn.disabled = !!config.disableRefresh;
    if (config.buttonLabel) {
      refreshBtn.innerHTML = config.buttonLabel;
    }
  }

  if (statusKey === "qr_ready") {
    startQRAutoRefreshTimer(currentQRDeviceId);
  } else {
    stopQRAutoRefreshTimer();
  }
}

// Open WA settings modal
async function openWASettingsModal(deviceId, defaultTab = "auto-reply") {
  currentWADeviceId = deviceId;
  const modal = document.getElementById("waSettingsModal");
  if (!modal) return;

  modal.style.display = "flex";

  // Load data
  switchWASettingsTab(defaultTab);
  await loadAutoReplies(deviceId);
  await loadSchedules(deviceId);
  await loadMessageLogs(deviceId);

  syncAutoReplyToggleState(deviceId);
  syncAutoRejectCallsState(deviceId);
}

function updateQRProfileStatus(device) {
  const statusEl = document.getElementById("qrProfileStatus");
  if (!statusEl) return;
  if (device?.status === "connected") {
    statusEl.textContent = `WhatsApp sudah terhubung sebagai ${
      device.phone || "–"
    }.`;
    statusEl.style.display = "block";
  } else {
    statusEl.textContent = "";
    statusEl.style.display = "none";
  }
}

async function showWAProfileModal(deviceId) {
  currentProfileDeviceId = deviceId;
  renderWAProfileMessage("Memuat profil WhatsApp...");

  const modal = document.getElementById("waProfileModal");
  if (modal) {
    modal.style.display = "flex";
  }

  try {
    const result =
      await waApi.getDeviceProfile(deviceId);
    if (!result.success) {
      throw new Error(result.error || "Tidak dapat mengambil profil");
    }
    renderWAProfile(result.profile);
  } catch (error) {
    console.error("❌ Gagal memuat profil WA:", error);
    renderWAProfileMessage(
      `Tidak dapat memuat profil: ${
        error.message || "Terjadi kesalahan"
      }`,
      true
    );
  }
}

function closeWAProfileModal() {
  const modal = document.getElementById("waProfileModal");
  if (modal) {
    modal.style.display = "none";
  }
  currentProfileDeviceId = null;
}

function renderWAProfile(profile) {
  const body = document.getElementById("waProfileBody");
  if (!body) return;
  if (!profile) {
    renderWAProfileMessage("Data profil tidak tersedia", true);
    return;
  }

  const displayName =
    profile.displayName || profile.notifyName || "WhatsApp";
  const phone = profile.phone || "–";
  const jid = profile.jid || "–";
  const statusText = profile.status
    ? `Status koneksi: ${profile.status}`
    : "Terhubung";
  const avatarSrc = profile.pictureUrl || "";
  const avatarElement = avatarSrc
    ? `<img src="${avatarSrc}" alt="Avatar ${escapeHtml(displayName)}" />`
    : `<i class="bi bi-person-circle"></i>`;

  body.innerHTML = `
    <div class="wa-profile-card">
      <div class="wa-profile-avatar">
        ${avatarElement}
      </div>
      <div class="wa-profile-content">
        <h4>${escapeHtml(displayName)}</h4>
        <p class="wa-profile-phone">${escapeHtml(phone)}</p>
        <p class="wa-profile-jid">${escapeHtml(jid)}</p>
        <p class="wa-profile-status">${escapeHtml(statusText)}</p>
      </div>
    </div>
  `;
}

function renderWAProfileMessage(message, isError = false) {
  const body = document.getElementById("waProfileBody");
  if (!body) return;
  const className = isError ? "wa-profile-error" : "wa-profile-loading";
  body.innerHTML = `<p class="${className}">${escapeHtml(message)}</p>`;
}

// Close WA settings modal
function closeWASettingsModal() {
  const modal = document.getElementById("waSettingsModal");
  if (modal) modal.style.display = "none";
  currentWADeviceId = null;
}

// Switch settings tab
function switchWASettingsTab(tabName, event) {
  const targetTab = tabName || "auto-reply";
  document.querySelectorAll(".settings-tab").forEach((btn) => {
    const isTarget =
      (event && event.target && btn.contains(event.target)) ||
      btn.dataset.tab === targetTab;
    btn.classList.toggle("active", isTarget);
  });

  document
    .querySelectorAll(".settings-tab-content")
    .forEach((content) => {
      content.classList.toggle(
        "active",
        content.id === `tab-${targetTab}`
      );
    });
}

// Load auto-replies
async function loadAutoReplies(deviceId) {
  const container = document.getElementById("autoReplyList");
  if (!container) return;

  console.log("📝 Loading auto-replies for device:", deviceId);

  try {
    const result =
      await waApi.getAutoReplies(deviceId);
    console.log("📝 Auto-replies result:", result);

    if (!result.success) {
      console.error("Failed to load auto-replies:", result.error);
      container.innerHTML =
        '<p style="text-align: center; color: #ef4444;">Failed to load auto-replies</p>';
      return;
    }

    const replies = result.replies || [];
    currentAutoReplyCount = replies.length;
    console.log("📝 Auto-replies count:", replies.length);

    if (replies.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; color: #6b7280;">Belum ada auto-reply rules</p>';
      return;
    }

    container.innerHTML = replies
      .map((reply) => {
        const scopeLabel = {
          personal: "Personal",
          group: "Group",
          both: "Personal + Group",
        }[reply.scope || "both"];
        const matchLabel = {
          contains: "Mengandung",
          exact: "Sama persis",
        }[reply.match_type || "contains"];

        return `
        <div class="auto-reply-item">
          <div class="auto-reply-item-header">
            <div class="auto-reply-keyword">${reply.keyword}</div>
            <div class="item-actions">
              <button onclick="toggleAutoReplyRule('${
                reply.id
              }', ${!reply.is_active})" class="btn-sm">
                <i class="bi bi-${
                  reply.is_active ? "toggle-on" : "toggle-off"
                }"></i>
              </button>
              <button onclick="deleteAutoReplyRule('${
                reply.id
              }')" class="btn-sm btn-danger">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <div class="auto-reply-meta">
            <span class="badge badge-secondary">${scopeLabel}</span>
            <span class="badge badge-secondary">${matchLabel}</span>
          </div>
          <div class="auto-reply-message">${reply.reply_message}</div>
        </div>
      `;
      })
      .join("");
  } catch (error) {
    currentAutoReplyCount = 0;
    console.error("Error loading auto-replies:", error);
    container.innerHTML =
      '<p style="text-align: center; color: #ef4444;">Error: ' +
      error.message +
      "</p>";
  }
}

function updateAutoReplyToggleLabel(enabled) {
  const label = document.getElementById("autoReplyToggleLabel");
  if (label) {
    label.textContent = enabled
      ? "Auto-reply aktif"
      : "Auto-reply belum aktif";
  }
}

function syncAutoReplyToggleState(deviceId) {
  const checkbox = document.getElementById("autoReplyEnabledCheckbox");
  if (!checkbox) return;

  const device = waDevicesCache[deviceId];
  const enabled = Boolean(device?.auto_reply_enabled);
  checkbox.checked = enabled;
  updateAutoReplyToggleLabel(enabled);
}

async function handleAutoReplyToggleChange(checkbox) {
  if (!currentWADeviceId) {
    checkbox.checked = !checkbox.checked;
    return;
  }

  const enabled = checkbox.checked;
  checkbox.disabled = true;

  try {
    const result =
      await waApi.setAutoReplyEnabled(
        currentWADeviceId,
        enabled
      );
    if (!result.success) {
      throw new Error(
        result.error || "Failed to update auto-reply settings"
      );
    }

    if (result.device) {
      waDevicesCache[currentWADeviceId] = result.device;
    }

    updateAutoReplyToggleLabel(enabled);
    await loadWADevices();
    await loadAutoReplies(currentWADeviceId);
  } catch (error) {
    console.error("❌ Failed to toggle auto-reply:", error);
    checkbox.checked = !enabled;
    Swal.fire(
      "Error",
      error.message || "Failed to update auto-reply settings",
      "error"
    );
  } finally {
    checkbox.disabled = false;
  }
}

function syncAutoRejectCallsState(deviceId) {
  const checkbox = document.getElementById("autoRejectCallsCheckbox");
  const statusEl = document.getElementById("autoRejectCallsStatus");
  if (!checkbox) return;
  const device = waDevicesCache[deviceId];
  const enabled = Boolean(device?.auto_reject_calls);
  checkbox.checked = enabled;
  if (statusEl) {
    statusEl.textContent = enabled ? "Aktif" : "Nonaktif";
    statusEl.style.color = enabled ? "#ef4444" : "var(--color-muted)";
  }
}

async function handleAutoRejectCallsChange(checkbox) {
  if (!currentWADeviceId) {
    checkbox.checked = !checkbox.checked;
    return;
  }
  const enabled = checkbox.checked;
  checkbox.disabled = true;
  try {
    const result = await waApi.setAutoRejectCalls(
      currentWADeviceId,
      enabled
    );
    if (!result.success) throw new Error(result.error || "Gagal menyimpan pengaturan");
    if (result.device) waDevicesCache[currentWADeviceId] = result.device;
    const statusEl = document.getElementById("autoRejectCallsStatus");
    if (statusEl) {
      statusEl.textContent = enabled ? "Aktif" : "Nonaktif";
      statusEl.style.color = enabled ? "#ef4444" : "var(--color-muted)";
    }
  } catch (error) {
    console.error("❌ Failed to toggle auto-reject calls:", error);
    checkbox.checked = !enabled;
    Swal.fire("Error", error.message || "Gagal menyimpan pengaturan", "error");
  } finally {
    checkbox.disabled = false;
  }
}

function formatCronExpression(dateValue, recurrence) {
  if (!dateValue) return "";
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return "";
  const minute = dt.getMinutes();
  const hour = dt.getHours();
  const day = dt.getDate();
  const month = dt.getMonth() + 1;
  const dayOfWeek = dt.getDay();
  switch (recurrence) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case "monthly":
      return `${minute} ${hour} ${day} * *`;
    case "once":
    default:
      return `${minute} ${hour} ${day} ${month} *`;
  }
}

function getScheduleCronExpression() {
  const dateInput = document.getElementById("scheduleDateTime");
  const recurrenceSelect = document.getElementById("scheduleRecurrence");
  const cronInput = document.getElementById("scheduleCron");
  if (!recurrenceSelect || !dateInput || !cronInput) return "";
  const recurrence = recurrenceSelect.value;
  if (recurrence === "custom") {
    return cronInput.value.trim();
  }
  const dtValue = dateInput.value;
  const cron = formatCronExpression(dtValue, recurrence);
  cronInput.value = cron;
  return cron;
}

function updateScheduleCronField() {
  const recurrenceSelect = document.getElementById("scheduleRecurrence");
  const cronGroup = document.getElementById("scheduleCronGroup");
  if (!recurrenceSelect || !cronGroup) return;
  const recurrence = recurrenceSelect.value;
  if (recurrence === "custom") {
    cronGroup.style.display = "block";
  } else {
    cronGroup.style.display = "none";
  }
  getScheduleCronExpression();
}

const scheduleDateTimeElement =
  document.getElementById("scheduleDateTime");
const scheduleRecurrenceElement =
  document.getElementById("scheduleRecurrence");
scheduleDateTimeElement?.addEventListener(
  "change",
  updateScheduleCronField
);
scheduleRecurrenceElement?.addEventListener(
  "change",
  updateScheduleCronField
);
updateScheduleCronField();

async function downloadCampaignTemplate() {
  const link = document.getElementById("campaignTemplateLink");
  if (!link) {
    console.error("⚠️ campaignTemplateLink not found");
    return;
  }
  const assetName = "campaign-template.csv";
  if (window.electronAPI?.resolveAssetUrl) {
    try {
      const resolved = await window.electronAPI.resolveAssetUrl(
        assetName
      );
      if (resolved) {
        link.href = resolved;
      }
    } catch (err) {
      console.warn("⚠️ Gagal resolve asset:", err?.message || err);
    }
  }
  link.click();
}

let campaignMessages = [];
let campaignRunning = false;
let campaignShouldStop = false;
let campaignPointer = 0;
let nextSendTimestamp = null;
let countdownInterval = null;

function renderCampaignPreview() {
  const container = document.getElementById("campaignPreviewList");
  if (!container) return;
  if (!campaignMessages.length) {
    container.innerHTML =
      '<p class="small-text">Preview pesan akan muncul di sini setelah import.</p>';
    return;
  }
  container.innerHTML = campaignMessages
    .map((row, index) => {
      const statusClass = row.status || "pending";
      const statusLabel =
        {
          pending: "Pending",
          typing: "Mengetik...",
          sent: "Terkirim",
          failed: "Gagal",
        }[statusClass] || "Pending";
      return `
        <div class="campaign-row">
          <div class="campaign-cell">
            <strong>${row.phone}</strong>
            <div class="campaign-message">${row.message}</div>
          </div>
          <div class="campaign-cell campaign-status">
            <span class="campaign-badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function normalizeCampaignRows(rawRows = []) {
  return rawRows
    .map((row) => ({
      phone: (
        row.phone ||
        row.nomor ||
        row.phonenumber ||
        row["Phone"] ||
        ""
      ).trim(),
      message: (
        row.message ||
        row.pesan ||
        row.body ||
        row.text ||
        ""
      ).trim(),
      status: "pending",
    }))
    .filter((row) => row.phone && row.message);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseCampaignText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) return [];
  const header = parseCsvLine(lines.shift()).map((h) => h.toLowerCase());
  const dataRows = lines.map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    header.forEach((column, index) => {
      if (!column) return;
      row[column] = values[index] || "";
    });
    return row;
  });
  return dataRows;
}

function detectCampaignFileType(fileName = "") {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return "excel";
  }
  return "csv";
}

function parseCampaignExcel(arrayBuffer) {
  if (!arrayBuffer) return [];
  if (!window.XLSX || !window.XLSX.read || !window.XLSX.utils) {
    throw new Error(
      "Parser Excel tidak tersedia. Pastikan koneksi internet untuk memuat library XLSX."
    );
  }
  const workbook = window.XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return normalizeCampaignRows(rows);
}

function handleCampaignFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const fileType = detectCampaignFileType(file.name);
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let rows = [];
      if (fileType === "excel") {
        rows = parseCampaignExcel(reader.result);
      } else {
        const text = reader.result || "";
        if (!text) {
          Swal.fire("Error", "File campaign kosong.", "error");
          return;
        }
        if (window.Papa && window.Papa.parse) {
          const parsed = window.Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
          });
          rows = normalizeCampaignRows(parsed.data);
        } else {
          rows = normalizeCampaignRows(parseCampaignText(text));
        }
      }

      if (!rows.length) {
        Swal.fire(
          "Error",
          "Tidak ada data valid pada file campaign.",
          "error"
        );
        campaignMessages = [];
        renderCampaignPreview();
        updateCampaignControls();
        return;
      }

      campaignMessages = rows;
      renderCampaignPreview();
      updateCampaignControls();
    } catch (error) {
      console.error("❌ Failed to parse campaign file:", error);
      Swal.fire(
        "Error",
        error?.message ||
          "Gagal membaca file campaign. Gunakan CSV atau Excel dengan header phone,message.",
        "error"
      );
    }
  };
  reader.onerror = (error) => {
    console.error("❌ Failed to read campaign file:", error);
    Swal.fire("Error", "Gagal membaca file campaign.", "error");
  };
  if (fileType === "excel") {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file, "UTF-8");
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

document
  .getElementById("campaignRate")
  ?.addEventListener("change", () => {
    if (!campaignRunning) {
      updateCountdownText();
    }
  });

function getCampaignIntervalMs() {
  const rateInput = document.getElementById("campaignRate");
  const rate = Math.max(1, parseInt(rateInput?.value, 10) || 1);
  return Math.floor(60000 / rate);
}

function updateCountdownText() {
  const countdownEl = document.getElementById("campaignCountdownText");
  if (!countdownEl) return;
  if (!nextSendTimestamp || !campaignRunning || campaignShouldStop) {
    countdownEl.textContent = "Menunggu pengiriman berikutnya...";
    return;
  }
  const deltaMs = nextSendTimestamp - Date.now();
  if (deltaMs <= 0) {
    countdownEl.textContent = "Mengirim pesan berikutnya...";
    return;
  }
  const seconds = Math.ceil(deltaMs / 1000);
  countdownEl.textContent = `Pesan berikutnya akan dikirim dalam ${seconds} detik`;
}

function startCountdownTicker() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  countdownInterval = setInterval(updateCountdownText, 500);
}

function stopCountdownTicker() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

async function runCampaign() {
  if (campaignRunning) return;
  if (!currentWADeviceId) {
    Swal.fire("Error", "Pilih device WA terlebih dahulu", "error");
    return;
  }
  if (!campaignMessages.length) {
    Swal.fire("Error", "Tidak ada pesan campaign untuk dikirim", "error");
    return;
  }
  const broadcastQuota = await getCampaignBroadcastLimit();
  const remainingQuota = broadcastQuota.remaining;
  if (
    Number.isFinite(remainingQuota) &&
    campaignMessages.length > remainingQuota
  ) {
    Swal.fire(
      "Limit campaign tercapai",
      `Paket Anda hanya dapat mengirim ${broadcastQuota.total} broadcast per hari. Sisa untuk hari ini: ${remainingQuota}.`,
      "warning"
    );
    return;
  }

  if (campaignPointer >= campaignMessages.length) {
    campaignPointer = 0;
  }

  campaignRunning = true;
  campaignShouldStop = false;
  updateCampaignControls();
  const button = document.getElementById("runCampaignBtn");
  if (button) button.disabled = true;
  startCountdownTicker();

  while (campaignPointer < campaignMessages.length) {
    if (campaignShouldStop) break;
    const row = campaignMessages[campaignPointer];
    row.status = "typing";
    renderCampaignPreview();

    try {
      await waApi.sendTyping(
        currentWADeviceId,
        row.phone
      );
      const typingDelay = Math.min(
        Math.max(row.message.length * 120, 800),
        3200
      );
      await wait(typingDelay);
      const result = await waApi.sendMessage(
        currentWADeviceId,
        row.phone,
        row.message,
        { source: "campaign" }
      );
      row.status = result.success ? "sent" : "failed";
    } catch (error) {
      console.error("❌ Campaign error:", error);
      row.status = "failed";
    }
    renderCampaignPreview();
    campaignPointer++;

    if (
      campaignPointer < campaignMessages.length &&
      !campaignShouldStop
    ) {
      const intervalMs = getCampaignIntervalMs();
      nextSendTimestamp = Date.now() + intervalMs;
      updateCountdownText();
      await wait(intervalMs);
    } else {
      nextSendTimestamp = null;
      updateCountdownText();
    }
  }

  stopCountdownTicker();
  if (button) button.disabled = false;
  campaignRunning = false;
  if (!campaignShouldStop && campaignPointer >= campaignMessages.length) {
    campaignPointer = campaignMessages.length;
  }
  campaignShouldStop = false;
  updateCampaignControls();
  Swal.fire("Selesai", "Campaign telah selesai diproses.", "success");
}

function stopCampaign() {
  if (!campaignRunning) return;
  campaignShouldStop = true;
  updateCampaignControls();
  stopCountdownTicker();
  nextSendTimestamp = null;
  updateCountdownText();
}

function clearCampaign() {
  campaignMessages = [];
  campaignPointer = 0;
  campaignRunning = false;
  campaignShouldStop = false;
  nextSendTimestamp = null;
  stopCountdownTicker();
  document.getElementById("campaignFileInput").value = "";
  renderCampaignPreview();
  updateCampaignControls();
  updateCountdownText();
}

function updateCampaignControls() {
  const stopBtn = document.getElementById("stopCampaignBtn");
  const clearBtn = document.getElementById("clearCampaignBtn");
  const runBtn = document.getElementById("runCampaignBtn");
  if (stopBtn) stopBtn.disabled = !campaignRunning;
  if (clearBtn)
    clearBtn.disabled = campaignRunning || !campaignMessages.length;
  if (runBtn)
    runBtn.disabled = campaignRunning || !campaignMessages.length;
}

updateCountdownText();
updateCampaignControls();

async function submitLogRetention() {
  const input = document.getElementById("logRetentionDays");
  const button = document.getElementById("logRetentionBtn");
  if (!currentWADeviceId) {
    Swal.fire("Error", "Device belum dipilih", "error");
    return;
  }

  const days = parseInt(input.value, 10);
  if (!Number.isFinite(days) || days < 1) {
    Swal.fire("Error", "Masukkan jumlah hari valid (>= 1)", "error");
    return;
  }

  input.disabled = true;
  if (button) button.disabled = true;

  try {
    const result = await waApi.clearLogs(
      currentWADeviceId,
      days
    );
    if (!result.success) {
      throw new Error(result.error || "Gagal menghapus log");
    }

    Swal.fire({
      title: "Berhasil",
      text: `Menghapus ${
        result.deleted ?? 0
      } log lama (>= ${days} hari).`,
      icon: "success",
    });

    await loadMessageLogs(currentWADeviceId);
  } catch (error) {
    console.error("❌ Failed to clean logs:", error);
    Swal.fire("Error", error.message || "Gagal menghapus log", "error");
  } finally {
    input.disabled = false;
    if (button) button.disabled = false;
  }
}

// Open add auto-reply modal
function openAddAutoReplyModal() {
  const modal = document.getElementById("addAutoReplyModal");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("autoReplyKeyword").value = "";
    document.getElementById("autoReplyMessage").value = "";
    const scopeSelect = document.getElementById("autoReplyScope");
    if (scopeSelect) scopeSelect.value = "";
    const matchSelect = document.getElementById("autoReplyMatchType");
    if (matchSelect) matchSelect.value = "";
  }
}

// Close add auto-reply modal
function closeAddAutoReplyModal() {
  const modal = document.getElementById("addAutoReplyModal");
  if (modal) modal.style.display = "none";
}

// Submit auto-reply
async function submitAutoReply() {
  const keyword = document
    .getElementById("autoReplyKeyword")
    .value.trim();
  const message = document
    .getElementById("autoReplyMessage")
    .value.trim();

  if (!keyword || !message) {
    Swal.fire("Error", "Keyword dan message harus diisi", "error");
    return;
  }

  try {
    const scope = document.getElementById("autoReplyScope")?.value;
    const matchType =
      document.getElementById("autoReplyMatchType")?.value;
    if (!scope || !matchType) {
      Swal.fire(
        "Error",
        "Silakan pilih batasan scope dan tipe pencocokan",
        "error"
      );
      return;
    }
    const autoReplyLimit = getAutoReplyLimit();
    if (
      typeof autoReplyLimit === "number" &&
      currentAutoReplyCount >= autoReplyLimit
    ) {
      Swal.fire(
        "Limit auto-reply tercapai",
        `Paket Anda hanya boleh membuat ${autoReplyLimit} auto-reply rule.`,
        "warning"
      );
      return;
    }
    const result = await waApi.addAutoReply(
      currentWADeviceId,
      keyword,
      message,
      scope,
      matchType
    );

    if (result.success) {
      closeAddAutoReplyModal();
      await loadAutoReplies(currentWADeviceId);
      Swal.fire("Success", "Auto-reply rule added", "success");
    }
  } catch (error) {
    Swal.fire("Error", error.message, "error");
  }
}

// Delete auto-reply rule
async function deleteAutoReplyRule(replyId) {
  try {
    await waApi.deleteAutoReply(replyId);
    await loadAutoReplies(currentWADeviceId);
  } catch (error) {
    Swal.fire("Error", error.message, "error");
  }
}

// Toggle auto-reply rule
async function toggleAutoReplyRule(replyId, isActive) {
  try {
    await waApi.toggleAutoReply(
      replyId,
      isActive
    );
    await loadAutoReplies(currentWADeviceId);
  } catch (error) {
    Swal.fire("Error", error.message, "error");
  }
}

// Load schedules
async function loadSchedules(deviceId) {
  const container = document.getElementById("scheduleList");
  if (!container) return;

  try {
    const result = await waApi.getSchedules(
      deviceId
    );
    const schedules = result.schedules || [];

    if (schedules.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; color: #6b7280;">Belum ada scheduled messages</p>';
      return;
    }

    schedules.forEach((schedule) => {
      scheduleStatusMap.set(
        schedule.id,
        schedule.last_status || "pending"
      );
    });

    container.innerHTML = schedules
      .map((schedule) => {
        const scheduleStatus =
          scheduleStatusMap.get(schedule.id) || "pending";
        const statusLabels = {
          pending: "Pending",
          typing: "Sedang mengetik",
          sent: "Terkirim",
          failed: "Gagal",
        };
        return `
        <div class="schedule-item">
          <div class="schedule-item-header">
            <div><strong>${schedule.schedule_name}</strong></div>
            <button onclick="deleteScheduleItem('${
              schedule.id
            }')" class="btn-sm btn-danger">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <div class="schedule-status-badge ${scheduleStatus}">${
          statusLabels[scheduleStatus] || "Pending"
        }</div>
          <div><small>Cron: ${schedule.cron_expression}</small></div>
          <div class="schedule-message">${schedule.message}</div>
          <div><small>Recipients: ${JSON.parse(
            schedule.recipients || "[]"
          ).join(", ")}</small></div>
        </div>
      `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading schedules:", error);
  }
}

// Open add schedule modal
function openAddScheduleModal() {
  const modal = document.getElementById("addScheduleModal");
  if (modal) {
    modal.style.display = "flex";
  }
}

// Close add schedule modal
function closeAddScheduleModal() {
  const modal = document.getElementById("addScheduleModal");
  if (modal) modal.style.display = "none";
}

// Submit schedule
async function submitSchedule() {
  const name = document.getElementById("scheduleName").value.trim();
  const cron = getScheduleCronExpression();
  const message = document.getElementById("scheduleMessage").value.trim();
  const recipientsText = document
    .getElementById("scheduleRecipients")
    .value.trim();

  if (!name || !cron || !message || !recipientsText) {
    Swal.fire(
      "Error",
      "Semua field harus diisi dengan data valid",
      "error"
    );
    return;
  }

  const recipients = recipientsText
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r);

  try {
    const result = await waApi.addSchedule(
      currentWADeviceId,
      name,
      cron,
      message,
      recipients
    );

    if (result.success) {
      closeAddScheduleModal();
      await loadSchedules(currentWADeviceId);
      Swal.fire("Success", "Schedule added", "success");
    }
  } catch (error) {
    Swal.fire("Error", error.message, "error");
  }
}

// Delete schedule
async function deleteScheduleItem(scheduleId) {
  try {
    await waApi.deleteSchedule(scheduleId);
    await loadSchedules(currentWADeviceId);
  } catch (error) {
    Swal.fire("Error", error.message, "error");
  }
}

// Load message logs
async function loadMessageLogs(deviceId) {
  const container = document.getElementById("messageLogsList");
  if (!container) return;

  try {
    const result =
      await waApi.getMessageLogs(
        deviceId,
        50
      );
    const logs = result.logs || [];

    if (logs.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; color: #6b7280;">Belum ada message logs</p>';
      return;
    }

    container.innerHTML = logs
      .map(
        (log) => `
      <div class="log-item">
        <div class="log-item-header">
          <div class="log-phone">${log.phone}</div>
          <div>
            <span class="log-type ${log.type}">${log.type}</span>
            <small>${new Date(log.timestamp).toLocaleString()}</small>
          </div>
        </div>
        <div class="log-message">${log.message || "-"}</div>
      </div>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error loading logs:", error);
  }
}

// Event listeners
if (waApi) {
  // QR Code event
  waApi.onQRCode((deviceId, qr) => {
    console.log("📱 QR Code event received for device:", deviceId);
    console.log("📱 Current QR Device ID:", currentQRDeviceId);

    // Update device list to reflect new QR code
    loadWADevices();

    // Only show modal automatically if no modal is currently open
    // OR if this is the device that's currently being viewed
    if (!currentQRDeviceId) {
      console.log("📱 Auto-showing QR modal for new device:", deviceId);
      showQRModal(deviceId);
    } else if (currentQRDeviceId === deviceId) {
      console.log(
        "📱 Updating QR code for currently viewed device:",
        deviceId
      );

      // Restore QR container structure if it was replaced with loading message
      const qrContainer = document.getElementById("qrCodeContainer");
      if (qrContainer && !qrContainer.querySelector("#qrImage")) {
        qrContainer.innerHTML =
          '<img id="qrImage" style="width: 300px; height: 300px; display: none;" /><canvas id="qrCanvas" style="display: block;"></canvas>';
      }

      // Clear and re-render QR code for the currently viewed device
      const img = document.getElementById("qrImage");
      const canvas = document.getElementById("qrCanvas");
      if (img) {
        img.src = "";
        img.style.display = "none";
      }
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = "none";
      }

      // Render new QR code
      renderQRCode(qr);
      updateQRModalStatus("qr_ready");

      // Re-enable refresh button
      const refreshBtn = document.getElementById("refreshQRBtn");
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML =
          '<i class="bi bi-arrow-clockwise"></i> Refresh QR';
      }

      console.log("✅ QR code updated successfully");
    } else {
      console.log(
        "📱 QR code received for different device. Not updating modal."
      );
    }
  });

  // Connected event
  waApi.onConnected((deviceId, phone) => {
    console.log("✅ Device connected:", deviceId, phone);

    // Close QR modal if open for this device
    if (currentQRDeviceId === deviceId) {
      closeQRModal();
      // Only show success alert if user was actively waiting (QR modal was open)
      Swal.fire({
        title: "Connected!",
        text: `Connected as ${phone}`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    }

    // Always reload devices to update UI
    loadWADevices();
  });

  // Status change event
  waApi.onStatusChange(
    (deviceId, status) => {
      console.log("Status changed:", deviceId, status);
      const modal = document.getElementById("qrModalWA");
      if (
        currentQRDeviceId === deviceId &&
        modal &&
        modal.style.display === "flex"
      ) {
        if (status === "connected") {
          updateQRModalStatus("hidden");
        } else {
          updateQRModalStatus(status);
        }
      }
      loadWADevices();
    }
  );

  waApi.onScheduleStatus(
    (scheduleId, status) => {
      scheduleStatusMap.set(scheduleId, status);
      if (currentWADeviceId) {
        loadSchedules(currentWADeviceId);
      }
    }
  );

  // Message received event
  waApi.onMessageReceived(
    (deviceId, from, message) => {
      console.log("Message received:", deviceId, from, message);
      if (currentWADeviceId === deviceId) {
        loadMessageLogs(deviceId);
      }
    }
  );
}

// Load WA devices when switching to WA Gateway page
// This will be called by switchPage function in renderer.js
window.loadWAGatewayPageActual = loadWADevices;
window.loadWAGatewayReady = true;
if (typeof window._resolveWAGatewayReady === "function") {
  window._resolveWAGatewayReady();
}
window.dispatchEvent(new Event("loadWAGatewayReady"));
window.loadWAGatewayPage = loadWADevices;
if (window.electronAPI?.auth?.onSessionChanged) {
  window.electronAPI.auth.onSessionChanged(() => {
    loadWADevices();
  });
}

// Dulu dipicu core saat startup (initAuthFlow); sekarang modul memuatnya sendiri.
loadWADevices();
