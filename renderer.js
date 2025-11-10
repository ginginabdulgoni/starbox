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
    url: "https://shopee.co.id/",
  },
  shopee_affiliate: {
    label: "Shopee Affiliate",
    color: "#ee4d2d",
    url: "https://affiliate.shopee.co.id/",
  },
  android: {
    label: "Android Emulator",
    color: "#3DDC84",
    url: null,
  },
  other: {
    label: "Website Kustom",
    color: "#f97316",
    url: null,
  },
  default: {
    label: "Service",
    color: "#6b7280",
    url: "https://example.com",
  },
};

const automationConfig = {
  targetUid: null,
  service: "",
  pendingUrl: "",
  deviceName: "",
  callbackUrl: "",
};

let automationMessages = [];
let automationTimer = null;
let automationFetchTimer = null;
let automationFetchRunning = false;
const AUTOMATION_FETCH_INTERVAL_MS = 60000;
const automationMonitorMeta = {
  lastFetch: null,
  error: null,
  activeId: null,
  typing: false,
  nextFetchAt: null,
};

const automationSessions = new Map();
let automationTargetOrder = [];
let automationPrimaryUid = null;
let automationSendRoundRunning = false;
let automationFetchRoundRunning = false;
let automationSendRoundIndex = 0;

const automationConnectionStatus = {
  status: "idle",
  checkedAt: null,
  latencyMs: null,
  endpoint: "",
  httpStatus: null,
  statusText: "",
  message: "",
  error: null,
  responseCount: null,
  responsePreview: "",
};

const automationConnectionLog = [];

let cachedDevices = [];
const authState = {
  isLoggedIn: false,
  user: null,
  deviceQuota: null,
  serverDeviceCount: null,
  guestServiceLimit: 2,
  lastSyncedAt: null,
  package: null,
  isUnlimited: false,
  packageExpiresAt: null,
  allowsPrivateService: false,
  allowsAndroidEmulator: false,
  allowsIosSimulator: false,
};

const authModalState = {
  activeTab: "login",
};

let phoneCodeOptionsLoaded = false;
const DEFAULT_PHONE_CODE = "+62";
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
let packageCountdownTimer = null;
let systemPlatform =
  typeof navigator !== "undefined" ? navigator.userAgent : null;
let lastAuthDeviceSnapshot = {
  loggedIn: authState.isLoggedIn,
  unlimited: authState.isUnlimited,
  limit: getServiceLimitValue(),
};

function getServiceLimitValue() {
  if (authState.isLoggedIn) {
    if (authState.isUnlimited) return Infinity;
    if (
      typeof authState.deviceQuota === "number" &&
      authState.deviceQuota > 0
    ) {
      return authState.deviceQuota;
    }
  }
  return authState.guestServiceLimit > 0 ? authState.guestServiceLimit : 2;
}

function getDeviceUniqueKey(device = {}) {
  return (
    device.uid ||
    device.token ||
    device.id ||
    `${device.service || "service"}::${
      device.name || device.deviceName || "device"
    }::${device.created_at || device.createdAt || ""}`
  );
}

function getDeviceCreatedAtValue(device = {}) {
  const raw = device.created_at || device.createdAt || null;
  const ts = Date.parse(raw || "");
  return Number.isNaN(ts) ? Infinity : ts;
}

function partitionDevicesByLimit(devices = []) {
  const limit = getServiceLimitValue();
  if (limit === Infinity) {
    return { visible: devices.slice(), hidden: [] };
  }

  const serviceBuckets = new Map();
  devices.forEach((device) => {
    const key = (device.service || "").toLowerCase();
    if (!serviceBuckets.has(key)) {
      serviceBuckets.set(key, []);
    }
    serviceBuckets.get(key).push(device);
  });

  const allowedKeys = new Set();
  const hiddenDevices = [];
  serviceBuckets.forEach((list) => {
    list
      .slice()
      .sort((a, b) => getDeviceCreatedAtValue(a) - getDeviceCreatedAtValue(b))
      .forEach((device, index) => {
        const deviceKey = getDeviceUniqueKey(device);
        if (index < limit) {
          allowedKeys.add(deviceKey);
        } else {
          hiddenDevices.push(device);
        }
      });
  });

  const visibleDevices = devices.filter((device) =>
    allowedKeys.has(getDeviceUniqueKey(device))
  );
  return { visible: visibleDevices, hidden: hiddenDevices };
}

function updateDeviceLimitInfo(hiddenDevices = []) {
  const infoEl = document.getElementById("device-limit-info");
  if (!infoEl) return;

  if (!hiddenDevices.length) {
    infoEl.textContent = "";
    infoEl.style.display = "none";
    return;
  }

  if (!authState.isLoggedIn) {
    infoEl.textContent = `🔒 ${hiddenDevices.length} device disembunyikan. Silakan login untuk melihat semua device Anda.`;
  } else if (!authState.isUnlimited) {
    const limit = getServiceLimitValue();
    infoEl.textContent = `⚠️ ${hiddenDevices.length} device lain tidak ditampilkan karena batas ${limit} device per layanan. Hapus device lama atau upgrade paket untuk melihat semuanya.`;
  } else {
    infoEl.textContent = "";
    infoEl.style.display = "none";
    return;
  }

  infoEl.style.display = "block";
}

function clearPackageCountdownTimer() {
  if (packageCountdownTimer) {
    clearInterval(packageCountdownTimer);
    packageCountdownTimer = null;
  }
}

function ensurePackageCountdownTimer() {
  clearPackageCountdownTimer();
  // Countdown tidak diperlukan lagi (masa aktif hanya tampil tanggal)
}

function getPackageExpiryText() {
  if (!authState.packageExpiresAt) return "";
  const expiryTs = Date.parse(authState.packageExpiresAt);
  if (Number.isNaN(expiryTs)) return "";
  const diff = expiryTs - Date.now();
  if (diff <= 0) {
    return "Sudah kedaluwarsa";
  }
  const formattedDate = new Date(expiryTs).toLocaleString();
  return `Berlaku hingga ${formattedDate}`;
}

const REMEMBER_ME_KEY = "starboxRememberLogin";

function getRememberedLogin() {
  try {
    const raw = localStorage.getItem(REMEMBER_ME_KEY);
    if (!raw) return { remember: false, email: "" };
    const parsed = JSON.parse(raw);
    return {
      remember: !!parsed.remember,
      email: parsed.email || "",
    };
  } catch {
    return { remember: false, email: "" };
  }
}

function saveRememberedLogin(email, remember) {
  try {
    if (remember && email) {
      localStorage.setItem(
        REMEMBER_ME_KEY,
        JSON.stringify({ remember: true, email })
      );
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function applyRememberedLogin() {
  const { remember, email } = getRememberedLogin();
  const emailInput = document.getElementById("loginEmail");
  const checkbox = document.getElementById("loginRememberMe");
  if (checkbox) checkbox.checked = !!remember;
  if (emailInput && remember && email) {
    emailInput.value = email;
  } else if (emailInput && !remember) {
    emailInput.value = emailInput.value || "";
  }
}

function toggleCustomServiceSection(show) {
  const section = document.getElementById("customServiceSection");
  if (section) {
    section.style.display = show ? "block" : "none";
  }
}

function toggleEditCustomServiceSection(show) {
  const section = document.getElementById("editCustomServiceSection");
  if (section) {
    section.style.display = show ? "block" : "none";
  }
}

function syncServiceAvailability() {
  const serviceSelect = document.getElementById("deviceService");
  const addModal = document.getElementById("addModal");
  if (!serviceSelect || !addModal) return;

  const androidOption = serviceSelect.querySelector('option[value="android"]');
  const customOption = serviceSelect.querySelector('option[value="other"]');

  const canUseAndroid = authState.isLoggedIn && authState.allowsAndroidEmulator;
  const canUsePrivate = authState.isLoggedIn && authState.allowsPrivateService;

  if (androidOption) {
    androidOption.hidden = !canUseAndroid;
    androidOption.disabled = !canUseAndroid;
  }
  if (customOption) {
    customOption.hidden = !canUsePrivate;
    customOption.disabled = !canUsePrivate;
  }

  if (serviceSelect.value === "android" && !canUseAndroid) {
    serviceSelect.value = "wa";
  }
  if (serviceSelect.value === "other" && !canUsePrivate) {
    serviceSelect.value = "wa";
  }
  toggleCustomServiceSection(serviceSelect.value === "other");
}

function updateIOSButtonVisibility() {
  const button = document.getElementById("iosSimulatorButton");
  if (!button) return;
  const isMac =
    (systemPlatform || "").toLowerCase().includes("darwin") ||
    (systemPlatform || "").toLowerCase().includes("mac");
  const canShow = authState.isLoggedIn && authState.allowsIosSimulator && isMac;
  button.style.display = canShow ? "inline-flex" : "none";
}

function updateCachedDevices(list = []) {
  cachedDevices = Array.isArray(list) ? list.slice() : [];
  updateDeviceQuotaBanner();
  updateAddDeviceQuotaHint();
}

function getServiceLabel(service) {
  const key = (service || "").toLowerCase();
  return serviceConfig[key]?.label || service || "Layanan";
}

function countDevicesByService(service) {
  const key = (service || "").toLowerCase();
  return cachedDevices.filter(
    (device) => (device.service || "").toLowerCase() === key
  ).length;
}

function canAddDeviceForService(service) {
  const serviceLabel = getServiceLabel(service);
  const count = countDevicesByService(service);

  if (authState.isLoggedIn) {
    if (authState.isUnlimited) {
      return { allowed: true };
    }
    const limit =
      typeof authState.deviceQuota === "number"
        ? authState.deviceQuota
        : authState.guestServiceLimit;
    if (count >= limit) {
      return {
        allowed: false,
        reason: `Kuota akun membatasi ${limit} device untuk ${serviceLabel}. Upgrade paket untuk menambah limit.`,
      };
    }
    return { allowed: true };
  }

  const guestLimit =
    typeof authState.guestServiceLimit === "number"
      ? authState.guestServiceLimit
      : 2;
  if (count >= guestLimit) {
    return {
      allowed: false,
      reason: `Mode tamu hanya mengizinkan ${guestLimit} device untuk ${serviceLabel}. Silakan login untuk menambah kuota.`,
    };
  }
  return { allowed: true };
}

function updateDeviceQuotaBanner() {
  const badge = document.getElementById("authQuotaBadge");
  if (!badge) return;

  if (authState.isLoggedIn) {
    const used = cachedDevices.length;
    if (authState.isUnlimited) {
      badge.textContent = `Total device: ${used} (admin/unlimited, tanpa batas per layanan)`;
    } else {
      const limit = getServiceLimitValue();
      badge.textContent = `Batas per layanan: ${limit} device • Total device saat ini ${used}`;
    }
  } else {
    const limit =
      typeof authState.guestServiceLimit === "number"
        ? authState.guestServiceLimit
        : 2;
    badge.textContent = `Tamu: maks ${limit} device per layanan`;
  }
}

function updateAuthHeaderUI() {
  const authButton = document.getElementById("authButton");
  const logoutButton = document.getElementById("logoutButton");
  const statusLabel = document.getElementById("authStatusLabel");
  const packageLabel = document.getElementById("authPackageLabel");

  const guestLabel =
    authState.guestServiceLimit > 0
      ? `Mode tamu • ${authState.guestServiceLimit} device/layanan`
      : "Mode tamu";

  if (authButton) {
    if (authState.isLoggedIn) {
      const displayName =
        authState.user?.name || authState.user?.email || "Pengguna";
      authButton.innerHTML = `<i class="bi bi-person-badge"></i> Akun (${displayName})`;
    } else {
      authButton.innerHTML =
        '<i class="bi bi-box-arrow-in-right"></i> Masuk / Daftar';
    }
  }

  if (logoutButton) {
    logoutButton.style.display = authState.isLoggedIn ? "inline-flex" : "none";
  }

  if (statusLabel) {
    if (authState.isLoggedIn) {
      const displayName =
        authState.user?.name || authState.user?.email || "Pengguna";
      const roleSuffix =
        (authState.user?.role || "").toLowerCase() === "admin"
          ? " (Admin)"
          : "";
      statusLabel.textContent = `Masuk sebagai ${displayName}${roleSuffix}`;
    } else {
      statusLabel.textContent = guestLabel;
    }
  }

  if (packageLabel) {
    if (!authState.isLoggedIn) {
      packageLabel.style.display = "none";
      packageLabel.textContent = "";
    } else if ((authState.user?.role || "").toLowerCase() === "admin") {
      packageLabel.style.display = "none";
      packageLabel.textContent = "";
    } else {
      const pkgName = authState.package?.name || "Default";
      const limit = getServiceLimitValue();
      const limitText = authState.isUnlimited
        ? "Unlimited per layanan"
        : `${limit} device per layanan`;
      const parts = [`Paket: ${pkgName} • ${limitText}`];
      const expiryText = getPackageExpiryText();
      if (expiryText) {
        parts.push(expiryText);
      }
      packageLabel.textContent = parts.join(" • ");
      packageLabel.style.display = "block";
    }
  }
}

function applyAuthSession(session = {}) {
  const prevLoggedIn = authState.isLoggedIn;
  const prevUnlimited = authState.isUnlimited;
  const prevLimit = getServiceLimitValue();

  authState.isLoggedIn = !!session.isLoggedIn;
  authState.user = session.user || null;
  authState.deviceQuota =
    typeof session.deviceQuota === "number" ? session.deviceQuota : null;
  authState.serverDeviceCount =
    typeof session.serverDeviceCount === "number"
      ? session.serverDeviceCount
      : null;
  authState.lastSyncedAt = session.lastSyncedAt || null;
  authState.package = session.package || null;
  authState.isUnlimited = !!session.isUnlimited;
  authState.packageExpiresAt = session.packageExpiresAt || null;
  authState.allowsPrivateService = !!(
    session.allowsPrivateService ||
    session.package?.allows_private_service ||
    session.package?.allowsPrivateService
  );
  authState.allowsAndroidEmulator = !!(
    session.allowsAndroidEmulator ||
    session.package?.allows_android_emulator ||
    session.package?.allowsAndroidEmulator
  );
  authState.allowsIosSimulator = !!(
    session.allowsIosSimulator ||
    session.package?.allows_ios_simulator ||
    session.package?.allowsIosSimulator
  );
  if (typeof session.guestServiceLimit === "number") {
    authState.guestServiceLimit = session.guestServiceLimit;
  }
  if (!authState.isUnlimited && typeof authState.deviceQuota !== "number") {
    authState.deviceQuota = authState.guestServiceLimit;
  }
  if (!authState.isLoggedIn) {
    authState.package = null;
    authState.isUnlimited = false;
    authState.deviceQuota = null;
    authState.packageExpiresAt = null;
    authState.allowsPrivateService = false;
    authState.allowsAndroidEmulator = false;
    authState.allowsIosSimulator = false;
  }
  ensurePackageCountdownTimer();
  updateAuthHeaderUI();
  updateDeviceQuotaBanner();
  syncServiceAvailability();
  updateAddDeviceQuotaHint();
  updateIOSButtonVisibility();
  const nextLimit = getServiceLimitValue();
  const shouldReload =
    prevLoggedIn !== authState.isLoggedIn ||
    prevUnlimited !== authState.isUnlimited ||
    prevLimit !== nextLimit;
  if (shouldReload) {
    if (typeof loadAllDevices === "function") {
      loadAllDevices();
    }
  }
  lastAuthDeviceSnapshot = {
    loggedIn: authState.isLoggedIn,
    unlimited: authState.isUnlimited,
    limit: nextLimit,
  };
}

async function initAuthFlow() {
  if (!window.electronAPI?.auth) {
    console.warn("Auth API tidak tersedia di preload.");
    return;
  }

  try {
    const session = await window.electronAPI.auth.getSession();
    if (session) {
      applyAuthSession(session);
    }
  } catch (err) {
    console.error("⚠️ Gagal memuat sesi auth awal:", err);
  }

  window.electronAPI.auth.onSessionChanged((session) => {
    applyAuthSession(session || {});
  });
}

function openAuthModal(initialTab = "login") {
  if (authState.isLoggedIn) {
    openAccountModal();
    return;
  }
  authModalState.activeTab = initialTab;
  applyRememberedLogin();
  loadPhoneCodesIntoSelect();
  const modal = document.getElementById("authModal");
  if (modal) {
    modal.style.display = "flex";
    switchAuthTab(initialTab);
  }
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) {
    modal.style.display = "none";
  }
  resetAuthForms();
}

function switchAuthTab(tab = "login") {
  authModalState.activeTab = tab;
  const loginForm = document.getElementById("authLoginForm");
  const registerForm = document.getElementById("authRegisterForm");
  const tabLogin = document.getElementById("authTabLogin");
  const tabRegister = document.getElementById("authTabRegister");

  const isLogin = tab === "register" ? false : true;
  if (loginForm) loginForm.style.display = isLogin ? "block" : "none";
  if (registerForm) registerForm.style.display = isLogin ? "none" : "block";
  if (tabLogin) tabLogin.classList.toggle("active", isLogin);
  if (tabRegister) tabRegister.classList.toggle("active", !isLogin);

  if (isLogin) {
    applyRememberedLogin();
  }
}

function resetAuthForms() {
  [
    "loginEmail",
    "loginPassword",
    "registerName",
    "registerEmail",
    "registerPhoneCode",
    "registerPhone",
    "registerPassword",
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = "";
  });
}

function setAuthFormLoading(buttonId, isLoading, defaultLabel) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Mohon tunggu..." : defaultLabel;
}

async function submitLoginForm(event) {
  event?.preventDefault?.();
  if (!window.electronAPI?.auth) return;

  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value || "";
  const rememberMe =
    document.getElementById("loginRememberMe")?.checked || false;

  if (!email || !password) {
    showToast("Email dan password wajib diisi.", 3500, "warning");
    return;
  }

  try {
    setAuthFormLoading("loginSubmitButton", true, "Masuk");
    const result = await window.electronAPI.auth.login({
      email,
      password,
    });
    if (result.success) {
      if (rememberMe) {
        saveRememberedLogin(email, true);
      } else {
        saveRememberedLogin("", false);
      }
      showToast(result.message || "Berhasil login.", 3500, "success");
      closeAuthModal();
    } else {
      if (!rememberMe) {
        saveRememberedLogin("", false);
      }
      showToast(result.message || "Login gagal.", 4000, "error");
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast("Terjadi kesalahan saat login.", 4000, "error");
  } finally {
    setAuthFormLoading("loginSubmitButton", false, "Masuk");
  }
}

async function submitRegisterForm(event) {
  event?.preventDefault?.();
  if (!window.electronAPI?.auth) return;

  const name = document.getElementById("registerName")?.value.trim();
  const email = document.getElementById("registerEmail")?.value.trim();
  let phoneCode = document.getElementById("registerPhoneCode")?.value.trim();
  const phone = document.getElementById("registerPhone")?.value.trim();
  const password = document.getElementById("registerPassword")?.value || "";

  if (!name || !email || !password || !phoneCode || !phone) {
    showToast(
      "Lengkapi nama, email, password, kode negara, dan nomor telepon.",
      3500,
      "warning"
    );
    return;
  }

  if (phoneCode && !phoneCode.startsWith("+")) {
    phoneCode = `+${phoneCode}`;
  }

  try {
    setAuthFormLoading("registerSubmitButton", true, "Daftar");
    const result = await window.electronAPI.auth.register({
      name,
      email,
      phone_code: phoneCode,
      phone,
      password,
    });

    if (result.success) {
      showToast(result.message || "Registrasi berhasil.", 3500, "success");
      if (result.autoLogin) {
        closeAuthModal();
      } else {
        switchAuthTab("login");
        const loginEmail = document.getElementById("loginEmail");
        if (loginEmail) loginEmail.value = email;
      }
    } else {
      showToast(result.message || "Registrasi gagal.", 4000, "error");
    }
  } catch (err) {
    console.error("Registrasi error:", err);
    showToast("Terjadi kesalahan saat registrasi.", 4000, "error");
  } finally {
    setAuthFormLoading("registerSubmitButton", false, "Daftar");
  }
}

function handleLogout() {
  if (!window.electronAPI?.auth) return;
  Swal.fire({
    title: "Keluar dari akun?",
    text: "Anda akan kembali ke mode tamu.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Keluar",
    cancelButtonText: "Batal",
    confirmButtonColor: "#ef4444",
  }).then((result) => {
    if (!result.isConfirmed) return;
    window.electronAPI.auth
      .logout()
      .then(() => {
        showToast("Berhasil logout.", 3000, "success");
        closeAccountModal();
        closeAuthModal();
      })
      .catch((err) => {
        console.error("Logout error:", err);
        showToast("Gagal logout.", 3500, "error");
      });
  });
}

function populateAccountModal() {
  const nameEl = document.getElementById("accountNameValue");
  const emailEl = document.getElementById("accountEmailValue");
  const phoneEl = document.getElementById("accountPhoneValue");
  const pkgEl = document.getElementById("accountPackageValue");
  const limitEl = document.getElementById("accountLimitValue");
  const expiryEl = document.getElementById("accountExpiryValue");

  const phoneCode = authState.user?.phone_code || "";
  const phone = authState.user?.phone || "";
  const formattedPhone =
    phoneCode && phone ? `${phoneCode} ${phone}` : phone || "-";

  if (nameEl) nameEl.textContent = authState.user?.name || "-";
  if (emailEl) emailEl.textContent = authState.user?.email || "-";
  if (phoneEl) phoneEl.textContent = formattedPhone;
  if (pkgEl) pkgEl.textContent = authState.package?.name || "Default";
  if (limitEl) {
    limitEl.textContent = authState.isUnlimited
      ? "Unlimited per layanan"
      : `${getServiceLimitValue()} device per layanan`;
  }
  if (expiryEl) expiryEl.textContent = getPackageExpiryText() || "-";
}

function openAccountModal() {
  const modal = document.getElementById("accountModal");
  if (!modal) return;
  if (!authState.isLoggedIn) {
    openAuthModal("login");
    return;
  }
  populateAccountModal();
  modal.style.display = "flex";
}

function closeAccountModal() {
  const modal = document.getElementById("accountModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function handleAuthButtonClick() {
  if (authState.isLoggedIn) {
    openAccountModal();
  } else {
    openAuthModal("login");
  }
}

async function loadPhoneCodesIntoSelect() {
  const select = document.getElementById("registerPhoneCode");
  if (!select || phoneCodeOptionsLoaded) return;

  try {
    const response = await fetch("assets/country.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const countries = await response.json();
    if (!Array.isArray(countries)) {
      throw new Error("Format country.json tidak valid");
    }

    select.innerHTML = '<option value="">Pilih kode negara</option>';
    const sorted = countries
      .filter((c) => c && c.phonecode)
      .sort((a, b) => {
        const nameA = (a.nicename || a.name || "").toLowerCase();
        const nameB = (b.nicename || b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

    let defaultOptionFound = false;
    sorted.forEach((country) => {
      const code = `+${String(country.phonecode).trim()}`;
      const emoji = country.emoji ? `${country.emoji} ` : "";
      const labelName = country.nicename || country.name || country.iso || code;
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${emoji}${labelName} (${code})`;
      select.appendChild(option);
      if (code === DEFAULT_PHONE_CODE) {
        defaultOptionFound = true;
      }
    });

    if (defaultOptionFound) {
      select.value = DEFAULT_PHONE_CODE;
    } else {
      select.selectedIndex = 0;
    }

    phoneCodeOptionsLoaded = true;
  } catch (err) {
    console.error("⚠️ Gagal memuat daftar kode negara:", err);
    select.innerHTML =
      '<option value="">Gagal memuat kode negara. Coba ulangi.</option>';
  }
}

function getActiveSession() {
  if (!automationConfig.targetUid) return null;
  return automationSessions.get(automationConfig.targetUid) || null;
}

function isSessionActive(session) {
  return !!session && automationConfig.targetUid === session.uid;
}

function syncActiveSessionState(session) {
  if (!isSessionActive(session)) return;
  automationMessages = Array.isArray(session.messages)
    ? session.messages.slice()
    : [];
  Object.assign(
    automationMonitorMeta,
    createDefaultMonitorMeta(),
    session.monitorMeta || {}
  );
  Object.assign(
    automationConnectionStatus,
    createDefaultConnectionStatus(),
    session.connectionStatus || {}
  );
  automationConnectionLog.length = 0;
  cloneConnectionLog(session.connectionLog).forEach((entry) =>
    automationConnectionLog.push(entry)
  );
}

function setSessionMessages(session, messages) {
  session.messages = Array.isArray(messages) ? messages.slice() : [];
  if (isSessionActive(session)) {
    automationMessages = session.messages.slice();
  }
}

function updateSessionMessages(session, updater) {
  const next =
    typeof updater === "function" ? updater(session.messages || []) : updater;
  setSessionMessages(session, next);
}

function updateSessionMonitorMeta(session, updates = {}) {
  session.monitorMeta = {
    ...createDefaultMonitorMeta(),
    ...(session.monitorMeta || {}),
    ...updates,
  };
  if (isSessionActive(session)) {
    Object.assign(automationMonitorMeta, session.monitorMeta);
  }
}

function updateSessionConnectionStatus(session, updates = {}) {
  session.connectionStatus = {
    ...createDefaultConnectionStatus(),
    ...(session.connectionStatus || {}),
    ...updates,
  };
  if (isSessionActive(session)) {
    Object.assign(automationConnectionStatus, session.connectionStatus);
  }
}

function updateSessionConnectionLog(session, newLog = []) {
  session.connectionLog = cloneConnectionLog(newLog);
  if (isSessionActive(session)) {
    automationConnectionLog.length = 0;
    session.connectionLog.forEach((entry) =>
      automationConnectionLog.push(entry)
    );
  }
}

function createDefaultMonitorMeta() {
  return {
    lastFetch: null,
    error: null,
    activeId: null,
    typing: false,
    nextFetchAt: null,
  };
}

function createDefaultConnectionStatus() {
  return {
    status: "idle",
    checkedAt: null,
    latencyMs: null,
    endpoint: "",
    httpStatus: null,
    statusText: "",
    message: "",
    error: null,
    responseCount: null,
    responsePreview: "",
  };
}

function cloneConnectionLog(source = []) {
  return Array.isArray(source) ? source.map((entry) => ({ ...entry })) : [];
}

function getOrCreateAutomationSession(deviceOrUid) {
  const uid =
    typeof deviceOrUid === "string" ? deviceOrUid : deviceOrUid?.uid || null;
  if (!uid) return null;

  let session = automationSessions.get(uid);
  if (!session) {
    session = {
      uid,
      service: "",
      pendingUrl: "",
      callbackUrl: "",
      deviceName: "",
      messages: [],
      monitorMeta: createDefaultMonitorMeta(),
      connectionStatus: createDefaultConnectionStatus(),
      connectionLog: [],
      fetchToastMessage: null,
      isSending: false,
      fetchTimer: null, // Timer individual untuk fetch per device
    };
    automationSessions.set(uid, session);
  }

  if (deviceOrUid && typeof deviceOrUid === "object") {
    session.service = deviceOrUid.service || session.service || "";
    session.pendingUrl = sanitizePendingUrl(
      deviceOrUid.pendingUrl || session.pendingUrl || ""
    );
    session.callbackUrl = sanitizePendingUrl(
      deviceOrUid.callbackUrl || session.callbackUrl || ""
    );
    session.deviceName = deviceOrUid.name || session.deviceName || uid;
  }

  return session;
}

function activateAutomationSession(uid) {
  const session = automationSessions.get(uid);
  if (!session) return false;

  automationConfig.targetUid = uid;
  automationConfig.service = session.service || "";
  automationConfig.pendingUrl = session.pendingUrl || "";
  automationConfig.callbackUrl = session.callbackUrl || "";
  automationConfig.deviceName = session.deviceName || uid;

  syncActiveSessionState(session);

  return true;
}

function persistActiveAutomationSession() {
  const uid = automationConfig.targetUid;
  if (!uid) return;
  const session = getOrCreateAutomationSession(uid);
  if (!session) return;

  session.service = automationConfig.service || session.service || "";
  session.pendingUrl = sanitizePendingUrl(
    automationConfig.pendingUrl || session.pendingUrl || ""
  );
  session.callbackUrl = sanitizePendingUrl(
    automationConfig.callbackUrl || session.callbackUrl || ""
  );
  session.deviceName = automationConfig.deviceName || session.deviceName || uid;
  setSessionMessages(session, automationMessages);
  updateSessionMonitorMeta(session, automationMonitorMeta);
  updateSessionConnectionStatus(session, automationConnectionStatus);
  updateSessionConnectionLog(session, automationConnectionLog);
}

function restorePrimaryAutomationSession() {
  if (
    automationPrimaryUid &&
    automationSessions.has(automationPrimaryUid) &&
    activateAutomationSession(automationPrimaryUid)
  ) {
    persistActiveAutomationSession();
    return;
  }

  const fallbackUid =
    automationTargetOrder.find((uid) => automationSessions.has(uid)) || null;
  automationPrimaryUid = fallbackUid;
  if (fallbackUid) {
    activateAutomationSession(fallbackUid);
    persistActiveAutomationSession();
  } else {
    automationConfig.targetUid = null;
    automationConfig.service = "";
    automationConfig.pendingUrl = "";
    automationConfig.deviceName = "";
    automationMessages = [];
    Object.assign(automationMonitorMeta, createDefaultMonitorMeta());
    Object.assign(automationConnectionStatus, createDefaultConnectionStatus());
    automationConnectionLog.length = 0;
  }
}

function removeAutomationSession(uid) {
  if (!uid) return;

  // Stop timer individual sebelum hapus session
  const session = automationSessions.get(uid);
  if (session) {
    stopDeviceFetchTimer(session);
  }

  automationSessions.delete(uid);
  automationTargetOrder = automationTargetOrder.filter((item) => item !== uid);
  if (automationPrimaryUid === uid) {
    automationPrimaryUid = null;
  }
}

function normalizeAutomationPriority(value) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.max(0, Math.floor(num));
  }
  return 9999;
}

function scheduleNextAutomationFetch(
  baseTimeMs = Date.now(),
  session = getActiveSession()
) {
  if (!session) return;
  const nextAtIso = new Date(
    baseTimeMs + AUTOMATION_FETCH_INTERVAL_MS
  ).toISOString();
  updateSessionMonitorMeta(session, { nextFetchAt: nextAtIso });
  broadcastAutomationMonitor(session, { nextFetchAt: nextAtIso });
}

function clearNextAutomationFetch(session = getActiveSession()) {
  if (!session) return;
  updateSessionMonitorMeta(session, { nextFetchAt: null });
  broadcastAutomationMonitor(session, { nextFetchAt: null });
}

function createAutomationResponsePreview(payload) {
  if (payload == null) return "";
  if (typeof payload === "string") {
    return payload.length > 400 ? `${payload.slice(0, 400)}…` : payload;
  }
  try {
    const text = JSON.stringify(payload);
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  } catch (err) {
    console.warn("Gagal membuat preview respons automasi:", err);
    return String(payload);
  }
}

function resetAutomationConnection(session = getActiveSession()) {
  if (!session) return;
  updateSessionConnectionLog(session, []);
  updateSessionConnectionStatus(session, {
    status: "idle",
    checkedAt: null,
    latencyMs: null,
    endpoint: "",
    httpStatus: null,
    statusText: "",
    message: "",
    error: null,
    responseCount: null,
    responsePreview: "",
  });
  if (isSessionActive(session)) {
    persistActiveAutomationSession();
  }
}

function updateAutomationConnection(state = {}, session = getActiveSession()) {
  if (!state || typeof state !== "object") return;
  if (!session) return;

  const existing = session.connectionStatus || createDefaultConnectionStatus();

  const checkedAt = state.checkedAt || new Date().toISOString();
  const status = (state.status || existing.status || "idle").toLowerCase();
  const latencyMs =
    typeof state.latencyMs === "number" && Number.isFinite(state.latencyMs)
      ? Math.max(0, Math.round(state.latencyMs))
      : existing.latencyMs;
  const httpStatus =
    typeof state.httpStatus === "number" && Number.isFinite(state.httpStatus)
      ? state.httpStatus
      : existing.httpStatus;
  const endpoint = state.endpoint || existing.endpoint || "";
  const statusText = state.statusText || existing.statusText || "";
  const message =
    state.message ||
    (state.error ? String(state.error) : existing.message) ||
    "";
  const responseCount =
    typeof state.responseCount === "number" &&
    Number.isFinite(state.responseCount)
      ? state.responseCount
      : existing.responseCount;
  const responsePreview =
    typeof state.responsePreview === "string"
      ? state.responsePreview
      : createAutomationResponsePreview(state.responseBody) ||
        existing.responsePreview;

  updateSessionConnectionStatus(session, {
    status,
    checkedAt,
    latencyMs,
    endpoint,
    httpStatus,
    statusText,
    message,
    error: state.error || null,
    responseCount,
    responsePreview,
  });

  const logEntry = {
    timestamp: checkedAt,
    status,
    httpStatus,
    statusText,
    latencyMs,
    message,
    responseCount,
    responsePreview,
  };

  const nextLog = cloneConnectionLog(session.connectionLog);
  nextLog.unshift(logEntry);
  while (nextLog.length > 5) {
    nextLog.pop();
  }
  updateSessionConnectionLog(session, nextLog);

  if (isSessionActive(session)) {
    persistActiveAutomationSession();
  }
}

function sanitizePendingUrl(url = "") {
  return (url || "").trim().replace(/\/+$/, "");
}

function hasCustomPathInUrl(url = "") {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const path = (parsed.pathname || "").replace(/\/+$/, "");
    return Boolean(path && path !== "/");
  } catch {
    const withoutProtocol = url.replace(/^[a-z]+:\/\//i, "");
    return withoutProtocol.includes("/");
  }
}

function buildUrlWithDefaultPath(baseUrl = "", defaultPath = "") {
  const sanitized = sanitizePendingUrl(baseUrl);
  if (!sanitized) return "";
  const normalizedPath = defaultPath
    ? defaultPath.startsWith("/")
      ? defaultPath
      : `/${defaultPath}`
    : "";
  if (!normalizedPath) {
    return sanitized;
  }
  if (hasCustomPathInUrl(sanitized)) {
    return sanitized;
  }
  try {
    const parsed = new URL(sanitized);
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = normalizedPath;
    }
    parsed.search = "";
    parsed.hash = "";
    let resolved = parsed.toString();
    if (resolved.endsWith("/")) {
      resolved = resolved.replace(/\/+$/, "");
    }
    return resolved;
  } catch {
    const trimmedBase = sanitized.replace(/\/+$/, "");
    return `${trimmedBase}${normalizedPath}`;
  }
}

function resolveAutomationPendingEndpoint(baseUrl = "") {
  return buildUrlWithDefaultPath(baseUrl, "/schedule/getpendingmessage");
}

function resolveAutomationCallbackUrl(pendingUrl = "", callbackUrl = "") {
  const override = sanitizePendingUrl(callbackUrl);
  if (override) {
    return buildUrlWithDefaultPath(override, "/schedule/updatestatusmessage");
  }
  return buildUrlWithDefaultPath(pendingUrl, "/schedule/updatestatusmessage");
}

function getAutomationQueueSnapshot(session = getActiveSession()) {
  const source = session?.messages || [];
  return source.map((item, index) => {
    const baseId = item?.id ?? item?.phone ?? index;
    return {
      id: baseId != null ? String(baseId) : String(index),
      phone: item?.phone ?? "",
      message: item?.message ?? "",
      status: (item?.status || "pending").toLowerCase(),
      priority: normalizeAutomationPriority(item?.priority),
    };
  });
}

function broadcastAutomationMonitor(session = getActiveSession(), extra = {}) {
  if (!session || !window.electronAPI?.updateAutomationMonitor) {
    return;
  }

  const metaUpdates = {};
  if ("error" in extra) {
    metaUpdates.error = extra.error;
  }
  if ("lastFetch" in extra) {
    metaUpdates.lastFetch = extra.lastFetch;
  }
  if ("activeId" in extra) {
    metaUpdates.activeId =
      extra.activeId != null ? String(extra.activeId) : null;
  }
  if ("typing" in extra) {
    metaUpdates.typing = !!extra.typing;
  }
  if ("nextFetchAt" in extra) {
    metaUpdates.nextFetchAt =
      extra.nextFetchAt != null ? extra.nextFetchAt : null;
  }

  if (Object.keys(metaUpdates).length) {
    updateSessionMonitorMeta(session, metaUpdates);
  }

  const queue = getAutomationQueueSnapshot(session);
  const total = queue.length;
  const done = queue.filter((item) => item.status === "done").length;
  const pending = queue.filter((item) => item.status !== "done").length;

  const extraClone = { ...extra };
  const connectionPayload =
    extraClone.connection && typeof extraClone.connection === "object"
      ? { ...extraClone.connection }
      : { ...(session.connectionStatus || createDefaultConnectionStatus()) };
  const connectionLogPayload = Array.isArray(extraClone.connectionLog)
    ? extraClone.connectionLog.map((entry) => ({ ...entry }))
    : cloneConnectionLog(session.connectionLog);

  delete extraClone.connection;
  delete extraClone.connectionLog;
  if ("nextFetchAt" in extraClone) {
    delete extraClone.nextFetchAt;
  }

  const effectiveMeta = session.monitorMeta || createDefaultMonitorMeta();
  const payload = {
    uid: session.uid,
    service: session.service,
    deviceName: session.deviceName || "",
    pendingUrl: session.pendingUrl,
    queue,
    counts: { total, pending, done },
    lastFetch: effectiveMeta.lastFetch,
    error: effectiveMeta.error,
    activeId: effectiveMeta.activeId,
    typing: effectiveMeta.typing,
    nextFetchAt: effectiveMeta.nextFetchAt,
    connection: connectionPayload,
    connectionLog: connectionLogPayload,
    ...extraClone,
  };

  window.electronAPI.updateAutomationMonitor(session.uid, payload);

  if (isSessionActive(session)) {
    syncActiveSessionState(session);
    persistActiveAutomationSession();
  }
}

async function fetchPendingMessagesForDevice(
  device,
  session = getActiveSession()
) {
  if (!device?.pendingUrl) {
    updateAutomationConnection(
      {
        status: "idle",
        endpoint: "",
        message: "Pending URL tidak tersedia.",
        checkedAt: new Date().toISOString(),
        responseCount: null,
        responsePreview: "",
      },
      session
    );
    return [];
  }

  const sanitizedUrl = sanitizePendingUrl(device.pendingUrl);
  const requestUrl = resolveAutomationPendingEndpoint(sanitizedUrl);
  if (!sanitizedUrl || !requestUrl) {
    updateAutomationConnection(
      {
        status: "idle",
        endpoint: "",
        message: "Pending URL tidak valid.",
        checkedAt: new Date().toISOString(),
        responseCount: null,
        responsePreview: "",
      },
      session
    );
    return [];
  }
  const getTimer = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const startedAt = getTimer();
  const computeLatency = () => getTimer() - startedAt;
  let response;

  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: device.uid,
        service: device.service,
        services: device.service,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Gagal mengambil pending message (${response.status} ${response.statusText})`
      );
    }

    const payload = await response.json();
    const rawMessages = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.messages)
      ? payload.messages
      : [];

    const normalizedMessages = rawMessages
      .map((item, index) => {
        const phone = item?.phone ?? "";
        const message = item?.message ?? "";
        const id =
          item?.id ??
          item?.messageId ??
          (phone ? `${phone}-${index}` : index.toString());
        return {
          id,
          phone,
          message,
          status: item?.status ?? "pending",
          priority: normalizeAutomationPriority(item?.priority),
        };
      })
      .filter((item) => item.phone && item.message);

    const latencyMs = computeLatency();
    updateAutomationConnection(
      {
        status: "online",
        endpoint: requestUrl,
        checkedAt: new Date().toISOString(),
        latencyMs,
        httpStatus: response.status,
        statusText: response.statusText,
        message: response.statusText || "OK",
        responseCount: normalizedMessages.length,
        responsePreview: createAutomationResponsePreview(payload),
        error: null,
      },
      session
    );

    return normalizedMessages;
  } catch (err) {
    const latencyMs = computeLatency();
    updateAutomationConnection(
      {
        status: "offline",
        endpoint: requestUrl,
        checkedAt: new Date().toISOString(),
        latencyMs,
        httpStatus: response?.status ?? null,
        statusText: response?.statusText ?? "",
        message: err?.message || "Gagal terhubung ke pending URL.",
        error: err?.message || "Gagal terhubung ke pending URL.",
        responseCount: null,
        responsePreview: "",
      },
      session
    );
    throw err;
  }
}

function mergeAutomationMessages(newItems = [], session = getActiveSession()) {
  if (!session) return;
  const previousMap = new Map(
    (session.messages || []).map((item) => [
      String(item.id ?? item.phone),
      item,
    ])
  );

  const merged = newItems
    .map((item) => {
      const key = String(item.id ?? item.phone ?? "");
      if (!key) return null;
      const previous = previousMap.get(key);
      const currentStatus = (item.status || "pending").toLowerCase();
      let nextStatus = currentStatus;
      if (previous?.status === "done" && currentStatus !== "done") {
        nextStatus = "done";
      }
      const priority = normalizeAutomationPriority(
        item.priority ?? previous?.priority
      );
      return {
        id: item.id ?? item.phone,
        phone: item.phone,
        message: item.message,
        status: nextStatus,
        priority,
      };
    })
    .filter(Boolean);

  const sorted = sortAutomationMessages(session, merged);
  setSessionMessages(session, sorted);
}

function sortAutomationMessages(session = getActiveSession(), items = null) {
  if (!session) return session?.messages || [];
  const target = Array.isArray(items)
    ? items.slice()
    : Array.isArray(session.messages)
    ? session.messages.slice()
    : [];

  target.sort((a, b) => {
    const statusA = (a.status || "pending").toLowerCase();
    const statusB = (b.status || "pending").toLowerCase();
    const doneA = statusA === "done";
    const doneB = statusB === "done";
    if (doneA !== doneB) {
      return doneA ? 1 : -1;
    }
    const priorityA = normalizeAutomationPriority(a.priority);
    const priorityB = normalizeAutomationPriority(b.priority);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    const idA = String(a.id ?? a.phone ?? "");
    const idB = String(b.id ?? b.phone ?? "");
    return idA.localeCompare(idB);
  });

  if (!Array.isArray(items)) {
    setSessionMessages(session, target);
  }

  return target;
}

function closeAutomationMonitor(uid = automationConfig.targetUid) {
  if (uid && window.electronAPI?.closeMonitorWindow) {
    window.electronAPI.closeMonitorWindow(uid);
  }
}

function resetAutomationState(uid = automationConfig.targetUid) {
  if (!uid) {
    automationSessions.clear();
    automationTargetOrder = [];
    automationPrimaryUid = null;
    automationConfig.targetUid = null;
    automationConfig.service = "";
    automationConfig.pendingUrl = "";
    automationConfig.deviceName = "";
    automationMessages = [];
    Object.assign(automationMonitorMeta, createDefaultMonitorMeta());
    Object.assign(automationConnectionStatus, createDefaultConnectionStatus());
    automationConnectionLog.length = 0;
    automationFetchRunning = false;
    stopAutomationLoop();
    return;
  }

  closeAutomationMonitor(uid);
  removeAutomationSession(uid);

  if (!automationSessions.size) {
    automationPrimaryUid = null;
    automationConfig.targetUid = null;
    automationConfig.service = "";
    automationConfig.pendingUrl = "";
    automationConfig.deviceName = "";
    automationMessages = [];
    Object.assign(automationMonitorMeta, createDefaultMonitorMeta());
    Object.assign(automationConnectionStatus, createDefaultConnectionStatus());
    automationConnectionLog.length = 0;
    automationFetchRunning = false;
    stopAutomationLoop();
    return;
  }

  restorePrimaryAutomationSession();
}

async function refreshAutomationMessagesForSession(session, options = {}) {
  if (!session) return;
  const { silent = false } = options;

  // Cek apakah automation sedang paused
  if (session.isPaused) {
    if (!silent) {
      console.log(
        `⏸ Automation untuk ${session.uid} sedang paused, skip fetch`
      );
    }
    return;
  }

  // Cek apakah device sedang running sebelum fetch
  if (window.electronAPI?.isDeviceRunning) {
    const isRunning = await window.electronAPI.isDeviceRunning(session.uid);
    if (!isRunning) {
      if (!silent) {
        console.log(
          `⚠️ Device ${session.uid} tidak sedang running, skip fetch pending`
        );
      }
      return;
    }
  }

  if (!session.pendingUrl) {
    setSessionMessages(session, []);
    updateSessionMonitorMeta(session, {
      error: null,
      lastFetch: null,
      activeId: null,
      typing: false,
    });
    session.fetchToastMessage = null;
    resetAutomationConnection(session);
    clearNextAutomationFetch(session);
    if (isSessionActive(session)) {
      persistActiveAutomationSession();
    }
    return;
  }

  try {
    const messages = await fetchPendingMessagesForDevice(
      {
        uid: session.uid,
        service: session.service,
        pendingUrl: session.pendingUrl,
      },
      session
    );
    mergeAutomationMessages(messages, session);
    const timestamp = new Date().toISOString();
    session.fetchToastMessage = null;

    // Schedule countdown berikutnya setelah fetch berhasil
    scheduleNextAutomationFetch(Date.now(), session);

    broadcastAutomationMonitor(session, {
      lastFetch: timestamp,
      error: null,
      typing: false,
      activeId: null,
    });
  } catch (err) {
    console.error(
      `⚠️ Gagal memuat daftar pesan pending untuk ${session.uid}:`,
      err
    );
    const message = err?.message || "Gagal memuat daftar pesan pending.";
    if (!silent && session.fetchToastMessage !== message) {
      showToast(message, 3500, "error");
    }
    session.fetchToastMessage = message;

    // Schedule countdown berikutnya meski fetch gagal (retry otomatis)
    scheduleNextAutomationFetch(Date.now(), session);

    broadcastAutomationMonitor(session, {
      error: message,
      typing: false,
    });
  }

  if (isSessionActive(session)) {
    persistActiveAutomationSession();
  }
}

// Backward-compatible alias used by monitor triggers
async function syncPendingMessagesForSession(session, options = {}) {
  return refreshAutomationMessagesForSession(session, options);
}

async function syncAutomationSource(devices = [], options = {}) {
  const { silent = false } = options;
  const candidates = devices.filter(
    (device) => device?.autoSender && device.pendingUrl
  );
  const activeUidSet = new Set(candidates.map((device) => device.uid));

  // Remove sessions that are no longer active
  for (const uid of Array.from(automationSessions.keys())) {
    if (!activeUidSet.has(uid)) {
      if (window.electronAPI?.updateAutomationMonitor) {
        window.electronAPI.updateAutomationMonitor(uid, {
          uid,
          queue: [],
          counts: { total: 0, pending: 0, done: 0 },
          typing: false,
          activeId: null,
          error: "Auto sender dinonaktifkan atau tidak ditemukan.",
          status: "inactive",
          nextFetchAt: null,
          connection: createDefaultConnectionStatus(),
          connectionLog: [],
        });
      }
      closeAutomationMonitor(uid);
      automationSessions.delete(uid);
    }
  }

  automationTargetOrder = candidates.map((device) => device.uid);

  candidates.forEach((device) => {
    const session = getOrCreateAutomationSession(device);
    session.service = device.service || session.service || "";
    session.pendingUrl = sanitizePendingUrl(
      device.pendingUrl || session.pendingUrl || ""
    );
    session.callbackUrl = sanitizePendingUrl(
      device.callbackUrl || session.callbackUrl || ""
    );
    session.deviceName = device.name || session.deviceName || device.uid;
    if (!silent && window.electronAPI?.ensureMonitorWindow) {
      window.electronAPI.ensureMonitorWindow(device.uid);
    }
  });

  if (!automationTargetOrder.length) {
    resetAutomationState(null);
    return;
  }

  if (!automationPrimaryUid || !activeUidSet.has(automationPrimaryUid)) {
    const preferredWa = candidates.find(
      (device) => (device.service || "").toLowerCase() === "wa"
    );
    automationPrimaryUid = preferredWa?.uid || automationTargetOrder[0];
  }

  const primarySession = automationSessions.get(automationPrimaryUid);
  activateAutomationSession(automationPrimaryUid);
  persistActiveAutomationSession();

  if (primarySession && !(primarySession.messages || []).length) {
    await refreshAutomationMessagesForSession(primarySession, { silent: true });
  } else if (primarySession) {
    broadcastAutomationMonitor(primarySession);
  }
}

function pendingAutomationCount(session = getActiveSession()) {
  if (!session) return 0;
  return (session.messages || []).filter((item) => item.status !== "done")
    .length;
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

  const display = `${username}@${host}${systemMeta ? ` • ${systemMeta}` : ""}`;

  badge.textContent = display;
  badge.title = `User: ${username}\nHost: ${host}\nPlatform: ${
    systemMeta || "n/a"
  }`;
}

async function loadSystemInfoBadge() {
  try {
    const info = await window.electronAPI.getSystemInfo();
    renderSystemInfoBadge(info);
    systemPlatform =
      info?.platform || info?.system || info?.release || navigator.userAgent;
    updateIOSButtonVisibility();
  } catch (err) {
    console.error("⚠️ Gagal memuat system info:", err);
    renderSystemInfoBadge(null, err);
    systemPlatform =
      typeof navigator !== "undefined" ? navigator.userAgent : null;
    updateIOSButtonVisibility();
  }
}

function markAutomationStatus(results = [], session = getActiveSession()) {
  if (!session) return false;
  const statusMap = new Map(
    results.map((item) => [item.id ?? item.phone, item.status ?? "pending"])
  );
  let updated = false;
  const current = session.messages || [];
  const nextMessages = current.map((item) => {
    const key = item.id ?? item.phone;
    if (statusMap.has(key)) {
      let newStatus = statusMap.get(key);
      if (newStatus === "failed") newStatus = "done";
      if (item.status !== newStatus) {
        updated = true;
        return { ...item, status: newStatus };
      }
    }
    return item;
  });
  if (updated) {
    setSessionMessages(session, sortAutomationMessages(session, nextMessages));
  } else {
    setSessionMessages(session, nextMessages);
  }
  if (isSessionActive(session)) {
    persistActiveAutomationSession();
  }
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

  if (
    card.dataset.autoSender === "true" &&
    isEngaged &&
    window.electronAPI?.ensureMonitorWindow
  ) {
    window.electronAPI.ensureMonitorWindow(uid);
  }

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
  const limitInfo = document.getElementById("device-limit-info");
  if (!container) return;

  container.innerHTML = "";
  const { visible: visibleDevices, hidden: hiddenDevices } =
    partitionDevicesByLimit(devices);
  updateDeviceLimitInfo(hiddenDevices);
  if (limitInfo && !hiddenDevices.length && !visibleDevices.length) {
    limitInfo.style.display = "none";
  }

  const fragment = document.createDocumentFragment();

  if (!visibleDevices.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "device-empty-state";
    emptyState.textContent =
      "Belum ada device yang dapat ditampilkan untuk konfigurasi saat ini.";
    fragment.appendChild(emptyState);
  }

  for (const device of visibleDevices) {
    const serviceKey = (device?.service || "").toLowerCase();
    const config = serviceConfig[serviceKey] || serviceConfig.default;
    const isCustomService = serviceKey === "other";
    const displayUrl = device.customUrl || "";
    const serviceLabel = isCustomService
      ? displayUrl || config.label || "Website Kustom"
      : config.label || device.service || "Unknown";
    const baseUrl = isCustomService
      ? displayUrl || "https://example.com"
      : config.url || `https://${serviceKey}.com`;
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
    deviceCard.dataset.autoSender = device.autoSender ? "true" : "false";
    deviceCard.dataset.pendingUrl = device.pendingUrl || "";
    deviceCard.dataset.callbackUrl = device.callbackUrl || "";
    deviceCard.dataset.deviceName = device.name || "";
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
        if (device.autoSender && window.electronAPI?.ensureMonitorWindow) {
          window.electronAPI.ensureMonitorWindow(device.uid);
        }
        if (device.autoSender) {
          automationPrimaryUid = device.uid;
          if (activateAutomationSession(device.uid)) {
            persistActiveAutomationSession();
          }
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

        if (device.autoSender) {
          automationPrimaryUid = device.uid;
          if (activateAutomationSession(device.uid)) {
            persistActiveAutomationSession();
          }
        }

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
      window.currentEditService = device.service || "";
      document.getElementById("editDeviceName").value =
        deviceCard.querySelector("h3").textContent;
      document.getElementById("editAutoRun").checked = device.autoRun ?? false;
      document.getElementById("editMode").value = device.mode ?? "desktop";
      if (typeof setEditAutoSenderState === "function") {
        setEditAutoSenderState(
          device.service,
          device.autoSender ?? false,
          device.pendingUrl ?? "",
          device.callbackUrl ?? ""
        );
      }
      const editCustomInput = document.getElementById("editCustomServiceUrl");
      if (editCustomInput) {
        editCustomInput.value = device.customUrl || "";
      }
      if (typeof window.refreshEditCustomServiceUI === "function") {
        window.refreshEditCustomServiceUI();
      } else {
        const section = document.getElementById("editCustomServiceSection");
        if (section) {
          section.style.display =
            (device.service || "").toLowerCase() === "other" ? "block" : "none";
        }
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

async function sendAutomationQueueForSession(session, options = {}) {
  if (!session) return;
  const {
    silent = false,
    silentIfEmpty = false,
    skipRefresh = false,
    limit = Infinity,
  } = options;

  if (!session.pendingUrl) {
    if (!silent) {
      showToast(
        `Pending URL belum diatur untuk device ${
          session.deviceName || session.uid
        }.`,
        3500,
        "warning"
      );
    }
    return;
  }

  const normalizedService = (session.service || "").toLowerCase();
  if (normalizedService !== "wa") {
    if (!silent) {
      showToast(
        `Automasi saat ini hanya mendukung device WhatsApp (device: ${
          session.deviceName || session.uid
        }).`,
        3500,
        "warning"
      );
    }
    return;
  }

  const card = document.querySelector(`.device[data-uid="${session.uid}"]`);
  const currentStatus = (card?.dataset.status || "").toLowerCase();
  if (!["active", "running"].includes(currentStatus)) {
    if (!silent) {
      showToast(
        `Jalankan device ${
          session.deviceName || session.uid
        } terlebih dahulu sebelum mengirim pesan.`,
        3500,
        "warning"
      );
    }
    return;
  }

  if (!silent && window.electronAPI?.ensureMonitorWindow) {
    window.electronAPI.ensureMonitorWindow(session.uid);
  }

  if (session.isSending) return;
  session.isSending = true;

  try {
    if (!skipRefresh) {
      await refreshAutomationMessagesForSession(session, { silent: true });
    }

    const pending = (session.messages || []).filter(
      (item) => item.status !== "done"
    );
    if (!pending.length) {
      if (!silent && !silentIfEmpty) {
        showToast(
          `Semua pesan untuk ${
            session.deviceName || session.uid
          } sudah terkirim.`,
          3000,
          "info"
        );
      }
      broadcastAutomationMonitor(session, { typing: false, activeId: null });
      return;
    }

    if (!navigator.onLine) {
      if (!silent) {
        showToast(
          "Pastikan koneksi internet aktif sebelum menjalankan automasi.",
          3000,
          "warning"
        );
      }
      broadcastAutomationMonitor(session, {
        error: "Koneksi internet tidak tersedia.",
        typing: false,
      });
      return;
    }

    const effectiveLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.max(1, Math.floor(limit))
        : Infinity;
    const batch =
      effectiveLimit === Infinity ? pending : pending.slice(0, effectiveLimit);

    if (!batch.length) {
      broadcastAutomationMonitor(session, { typing: false, activeId: null });
      return;
    }

    const callbackUrl = resolveAutomationCallbackUrl(
      session.pendingUrl,
      session.callbackUrl
    );

    const results = await window.electronAPI.sendWhatsappMessages(
      session.uid,
      batch,
      {
        pendingUrl: session.pendingUrl,
        callbackUrl,
        silent: true,
      }
    );

    if (Array.isArray(results) && results.length) {
      const successCount = results.filter(
        (item) => item.status === "done"
      ).length;
      const updated = markAutomationStatus(results, session);
      if (updated && successCount > 0 && !silent) {
        showToast(
          `Berhasil mengirim ${successCount} pesan untuk ${
            session.deviceName || session.uid
          }.`,
          3000,
          "success"
        );
      }
      const failed = results.filter((item) => item.status !== "done");
      if (failed.length && !silent) {
        showToast(
          `${failed.length} pesan gagal dikirim pada ${
            session.deviceName || session.uid
          }.`,
          3000,
          "warning"
        );
        console.warn("Pesan gagal:", failed);
      }
      if (!updated && successCount === 0 && !failed.length && !silent) {
        showToast(
          `Tidak ada pesan yang diperbarui untuk ${
            session.deviceName || session.uid
          }.`,
          3000,
          "info"
        );
      }
      broadcastAutomationMonitor(session);
    } else if (!silent) {
      showToast(
        `Automasi selesai tanpa respons pesan untuk ${
          session.deviceName || session.uid
        }.`,
        3000,
        "warning"
      );
    }
    broadcastAutomationMonitor(session);
  } catch (err) {
    console.error(
      `❌ Gagal menjalankan automasi WhatsApp untuk ${session.uid}:`,
      err
    );
    if (!silent) {
      showToast(
        err.message ||
          `Gagal menjalankan automasi WhatsApp untuk ${
            session.deviceName || session.uid
          }.`,
        4000,
        "error"
      );
    }
    broadcastAutomationMonitor(session, {
      error:
        err?.message ||
        `Gagal menjalankan automasi WhatsApp untuk ${
          session.deviceName || session.uid
        }.`,
      typing: false,
    });
  } finally {
    session.isSending = false;
    broadcastAutomationMonitor(session, { typing: false, activeId: null });
    loadAllDevices();
    if (isSessionActive(session)) {
      persistActiveAutomationSession();
    }
  }
}

async function sendAutomationQueue(options = {}) {
  const session = getActiveSession();
  return sendAutomationQueueForSession(session, options);
}

// Stop fetch timer untuk device tertentu
function stopDeviceFetchTimer(session) {
  if (session && session.fetchTimer) {
    clearInterval(session.fetchTimer);
    session.fetchTimer = null;
    console.log(`⏹️ Fetch timer stopped for device ${session.uid}`);
  }
}

// Start fetch timer untuk device tertentu (interval independen per device)
function startDeviceFetchTimer(session) {
  if (!session || !session.pendingUrl) return;

  // Stop timer lama jika ada
  stopDeviceFetchTimer(session);

  // Set countdown awal sebelum fetch pertama
  scheduleNextAutomationFetch(Date.now(), session);

  // Jalankan fetch pertama kali langsung
  refreshAutomationMessagesForSession(session, { silent: true }).catch((err) =>
    console.error(`Initial fetch error for ${session.uid}:`, err)
  );

  // Set timer untuk fetch berikutnya (akan berulang otomatis)
  session.fetchTimer = setInterval(() => {
    refreshAutomationMessagesForSession(session, { silent: true }).catch(
      (err) => console.error(`Fetch error for ${session.uid}:`, err)
    );
  }, AUTOMATION_FETCH_INTERVAL_MS);

  console.log(
    `▶️ Fetch timer started for device ${session.uid} (interval: ${
      AUTOMATION_FETCH_INTERVAL_MS / 1000
    }s)`
  );
}

function stopAutomationLoop() {
  if (automationTimer) {
    clearInterval(automationTimer);
    automationTimer = null;
  }
  if (automationFetchTimer) {
    clearInterval(automationFetchTimer);
    automationFetchTimer = null;
  }

  // Stop semua timer individual per device
  automationSessions.forEach((session) => {
    stopDeviceFetchTimer(session);
  });

  automationFetchRunning = false;
  automationSendRoundRunning = false;
  automationFetchRoundRunning = false;
  automationSendRoundIndex = 0;
  clearNextAutomationFetch();
}

async function runAutomationTickForSession(session, options = {}) {
  if (!session) return false;
  const { limit = Infinity } = options;

  if (session.isSending) return false;
  if (!session.pendingUrl) return false;

  const normalizedService = (session.service || "").toLowerCase();
  if (normalizedService !== "wa") {
    return false;
  }

  const card = document.querySelector(`.device[data-uid="${session.uid}"]`);
  if (!card) {
    return false;
  }

  const status = (card.dataset.status || "").toLowerCase();
  if (!["active", "running"].includes(status)) {
    return false;
  }

  const pendingMessages = (session.messages || []).filter(
    (item) => item.status !== "done"
  );
  if (!pendingMessages.length) return false;

  await sendAutomationQueueForSession(session, {
    silent: true,
    silentIfEmpty: true,
    skipRefresh: true,
    limit,
  });

  return true;
}

async function runAutomationSendRound() {
  if (automationSendRoundRunning) return;
  if (!automationTargetOrder.length || !automationSessions.size) return;

  automationSendRoundRunning = true;
  try {
    const order = automationTargetOrder.filter((uid) =>
      automationSessions.has(uid)
    );
    if (!order.length) return;

    const orderLength = order.length;
    let startIndex = automationSendRoundIndex % orderLength;
    const rotatedOrder = order
      .slice(startIndex)
      .concat(order.slice(0, startIndex));
    const sessions = rotatedOrder
      .map((uid) => automationSessions.get(uid))
      .filter(Boolean);

    const results = await Promise.all(
      sessions.map((session) =>
        runAutomationTickForSession(session, { limit: 1 })
      )
    );

    automationSendRoundIndex = (startIndex + 1) % orderLength;
  } catch (err) {
    console.error("Automation loop error:", err);
  } finally {
    automationSendRoundRunning = false;
    restorePrimaryAutomationSession();
  }
}

async function runAutomationFetchRound() {
  if (automationFetchRoundRunning) return;
  if (!automationTargetOrder.length || !automationSessions.size) return;

  automationFetchRoundRunning = true;
  try {
    const order = automationTargetOrder.filter((uid) =>
      automationSessions.has(uid)
    );
    if (!order.length) return;

    automationFetchRunning = true;

    // Jalankan fetch untuk semua device secara PARALLEL (bersamaan)
    const fetchPromises = order.map(async (uid) => {
      const session = automationSessions.get(uid);
      if (!session) return;

      scheduleNextAutomationFetch(Date.now(), session);
      try {
        await refreshAutomationMessagesForSession(session, { silent: true });
      } catch (err) {
        console.error(`Automation fetch error for ${uid}:`, err);
      }
    });

    // Tunggu semua fetch selesai secara bersamaan
    await Promise.all(fetchPromises);
  } finally {
    automationFetchRunning = false;
    automationFetchRoundRunning = false;
    restorePrimaryAutomationSession();
  }
}

function ensureAutomationLoop() {
  if (!automationSessions.size) {
    stopAutomationLoop();
    return;
  }

  // Start individual fetch timer untuk setiap device
  automationSessions.forEach((session) => {
    if (session.pendingUrl && !session.fetchTimer) {
      startDeviceFetchTimer(session);
    }
  });

  // Keep send timer global (karena send berjalan sequential per design)
  if (!automationTimer) {
    automationTimer = setInterval(() => {
      runAutomationSendRound().catch((err) =>
        console.error("Automation loop error:", err)
      );
    }, 15000);

    setTimeout(() => {
      runAutomationSendRound().catch((err) =>
        console.error("Automation loop error:", err)
      );
    }, 3000);
  }
}

async function loadAllDevices() {
  try {
    const data = await window.electronAPI.loadDevices();
    const devices = data.devices || [];
    console.log("📦 Daftar device:", devices);
    renderDevices(devices);
    updateCachedDevices(devices);
    devices.forEach((device) => setDeviceState(device.uid, device.status));
    await syncAutomationSource(devices);
    if (automationSessions.size) {
      ensureAutomationLoop();
    } else {
      stopAutomationLoop();
    }
  } catch (err) {
    console.error("⚠️ Gagal memuat daftar device:", err);
  }
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
  updateAddDeviceQuotaHint();
  syncServiceAvailability();
  toggleCustomServiceSection(
    document.getElementById("deviceService")?.value === "other"
  );
  if (typeof refreshAddAutoSenderUI === "function") {
    refreshAddAutoSenderUI();
  }
  setTimeout(() => {
    const input = document.getElementById("deviceName");
    if (input) input.focus();
  }, 50);
}

function closeModal() {
  document.getElementById("addModal").style.display = "none";
  const nameEl = document.getElementById("deviceName");
  const autoRunEl = document.getElementById("deviceAutoRun");
  const autoSenderEl = document.getElementById("deviceAutoSender");
  const pendingUrlEl = document.getElementById("devicePendingUrl");
  const customUrlEl = document.getElementById("customServiceUrl");
  const callbackEl = document.getElementById("deviceCallbackUrl");
  const serviceSelect = document.getElementById("deviceService");
  if (nameEl) nameEl.value = "";
  if (serviceSelect) serviceSelect.value = "wa";
  if (autoRunEl) autoRunEl.checked = false;
  if (autoSenderEl) autoSenderEl.checked = false;
  if (pendingUrlEl) pendingUrlEl.value = "";
  if (customUrlEl) customUrlEl.value = "";
  if (callbackEl) callbackEl.value = "";
  toggleCustomServiceSection(false);
  syncServiceAvailability();
  updateAddDeviceQuotaHint();
  if (typeof refreshAddAutoSenderUI === "function") {
    refreshAddAutoSenderUI();
  }
}

function updateAddDeviceQuotaHint() {
  const hint = document.getElementById("addDeviceQuotaHint");
  const serviceSelect = document.getElementById("deviceService");
  if (!hint || !serviceSelect) return;

  const service = serviceSelect.value;
  const label = getServiceLabel(service);
  const count = countDevicesByService(service);
  const guestLimit =
    typeof authState.guestServiceLimit === "number"
      ? authState.guestServiceLimit
      : 2;
  const quotaCheck = canAddDeviceForService(service);

  let message = "";
  if (quotaCheck.allowed) {
    if (authState.isLoggedIn) {
      if (authState.isUnlimited) {
        message = `Akun admin/unlimited: bebas menambah device ${label}.`;
      } else {
        const accountLimit =
          typeof authState.deviceQuota === "number"
            ? authState.deviceQuota
            : guestLimit;
        message = `Kuota akun: ${count}/${accountLimit} device untuk ${label}.`;
      }
    } else {
      message = `Mode tamu: ${count}/${guestLimit} device untuk ${label}.`;
    }
  } else {
    message = quotaCheck.reason;
  }

  hint.textContent = message;
  hint.classList.toggle("quota-warning", !quotaCheck.allowed);
}

async function submitDevice() {
  const name = document.getElementById("deviceName").value.trim();
  const service = document.getElementById("deviceService").value;
  const mode = document.getElementById("deviceMode").value;
  const autoRun = document.getElementById("deviceAutoRun").checked;
  const autoSenderCheckbox = document.getElementById("deviceAutoSender");
  const pendingUrlInput = document.getElementById("devicePendingUrl");
  const customUrlInput = document.getElementById("customServiceUrl");
  const isWhatsApp = (service || "").toLowerCase() === "wa";
  const autoSenderEnabled = isWhatsApp && autoSenderCheckbox?.checked;
  const pendingUrl = autoSenderEnabled
    ? (pendingUrlInput?.value || "").trim()
    : "";
  const customUrl =
    service === "other" ? (customUrlInput?.value || "").trim() : "";
  const callbackInput = document.getElementById("deviceCallbackUrl");
  const callbackUrl = autoSenderEnabled
    ? (callbackInput?.value || "").trim()
    : "";

  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  if (service === "other") {
    if (!customUrl) {
      showToast("URL website kustom wajib diisi.", 3500, "warning");
      return;
    }
    if (!/^https?:\/\//i.test(customUrl)) {
      showToast(
        "URL website harus diawali http:// atau https://.",
        3500,
        "warning"
      );
      return;
    }
  }

  const quotaCheck = canAddDeviceForService(service);
  if (!quotaCheck.allowed) {
    showToast(quotaCheck.reason, 4000, "warning");
    updateAddDeviceQuotaHint();
    return;
  }

  try {
    const result = await window.electronAPI.addDevice({
      name,
      service,
      autoRun,
      mode,
      autoSender: autoSenderEnabled,
      pendingUrl,
      callbackUrl,
      customUrl,
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
  initAuthFlow();
  applyRememberedLogin();
  loadPhoneCodesIntoSelect();
  loadAllDevices();
  loadSystemInfoBadge();
  if (typeof refreshAddAutoSenderUI === "function") refreshAddAutoSenderUI();
  const serviceSelect = document.getElementById("deviceService");
  if (serviceSelect) {
    serviceSelect.addEventListener("change", () => {
      updateAddDeviceQuotaHint();
      if (typeof refreshAddAutoSenderUI === "function") {
        refreshAddAutoSenderUI();
      }
      toggleCustomServiceSection(serviceSelect.value === "other");
    });
  }
  syncServiceAvailability();

  // Update status otomatis
  window.electronAPI.onDeviceStatusUpdated((uid) => {
    console.log("📶 Status device berubah:", uid);
    setDeviceState(uid, "active");
    loadAllDevices();
  });

  // Listener untuk trigger fetch pending dari monitor
  if (window.electronAPI?.onTriggerFetchPending) {
    window.electronAPI.onTriggerFetchPending((uid) => {
      console.log("⏰ Menerima trigger fetch pending untuk UID:", uid);
      const session = automationSessions.get(uid);
      if (session) {
        syncPendingMessagesForSession(session, { silent: false })
          .then(() => {
            console.log("✅ Fetch pending berhasil untuk UID:", uid);
          })
          .catch((err) => {
            console.error("❌ Fetch pending gagal untuk UID:", uid, err);
          });
      } else {
        console.warn("⚠️ Session tidak ditemukan untuk UID:", uid);
      }
    });
  }

  // Listener untuk kontrol automation (play/pause/stop)
  if (window.electronAPI?.onControlAutomation) {
    window.electronAPI.onControlAutomation((uid, state) => {
      console.log(`🎮 Menerima kontrol automation untuk UID ${uid}: ${state}`);
      const session = automationSessions.get(uid);
      if (!session) {
        console.warn("⚠️ Session tidak ditemukan untuk UID:", uid);
        return;
      }

      if (state === "running") {
        // Resume automation: start timer jika belum berjalan
        if (!session.fetchTimer) {
          startDeviceFetchTimer(session);
          console.log(`▶️ Automation resumed untuk ${uid}`);
        }
        session.isPaused = false;
      } else if (state === "paused") {
        // Pause automation: stop timer tapi jangan hapus session
        stopDeviceFetchTimer(session);
        session.isPaused = true;
        console.log(`⏸ Automation paused untuk ${uid}`);
      } else if (state === "stopped") {
        // Stop automation: stop timer dan clear messages
        stopDeviceFetchTimer(session);
        session.isPaused = false;
        clearNextAutomationFetch(session);
        broadcastAutomationMonitor(session, {
          typing: false,
          activeId: null,
        });
        console.log(`⏹ Automation stopped untuk ${uid}`);
      }
    });
  }
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
  handleAuthButtonClick,
  openAuthModal,
  closeAuthModal,
  openAccountModal,
  closeAccountModal,
});
