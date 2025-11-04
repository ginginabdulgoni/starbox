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
  targetUid: null,
  service: "",
  pendingUrl: "",
  deviceName: "",
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
    session.connectionLog.forEach((entry) => automationConnectionLog.push(entry));
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
  return Array.isArray(source)
    ? source.map((entry) => ({ ...entry }))
    : [];
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
      deviceName: "",
      messages: [],
      monitorMeta: createDefaultMonitorMeta(),
      connectionStatus: createDefaultConnectionStatus(),
      connectionLog: [],
      fetchToastMessage: null,
      isSending: false,
    };
    automationSessions.set(uid, session);
  }

  if (deviceOrUid && typeof deviceOrUid === "object") {
    session.service = deviceOrUid.service || session.service || "";
    session.pendingUrl = sanitizePendingUrl(
      deviceOrUid.pendingUrl || session.pendingUrl || ""
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

  const existing =
    session.connectionStatus || createDefaultConnectionStatus();

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
  const trimmed = (url || "").trim();
  return trimmed.replace(/\/+$/, "");
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

function broadcastAutomationMonitor(
  session = getActiveSession(),
  extra = {}
) {
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

async function fetchPendingMessagesForDevice(device, session = getActiveSession()) {
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
  if (!sanitizedUrl) {
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

  const requestUrl = `${sanitizedUrl}/schedule/getpendingmessage`;
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
    (session.messages || []).map((item) => [String(item.id ?? item.phone), item])
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
    broadcastAutomationMonitor(session, {
      error: message,
      typing: false,
    });
  }

  if (isSessionActive(session)) {
    persistActiveAutomationSession();
  }
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
  } catch (err) {
    console.error("⚠️ Gagal memuat system info:", err);
    renderSystemInfoBadge(null, err);
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
    deviceCard.dataset.autoSender = device.autoSender ? "true" : "false";
    deviceCard.dataset.pendingUrl = device.pendingUrl || "";
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
        if (
          device.autoSender &&
          window.electronAPI?.ensureMonitorWindow
        ) {
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
          device.pendingUrl ?? ""
        );
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
        `Pending URL belum diatur untuk device ${session.deviceName || session.uid}.`,
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
        `Automasi saat ini hanya mendukung device WhatsApp (device: ${session.deviceName || session.uid}).`,
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
        `Jalankan device ${session.deviceName || session.uid} terlebih dahulu sebelum mengirim pesan.`,
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
          `Semua pesan untuk ${session.deviceName || session.uid} sudah terkirim.`,
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
      effectiveLimit === Infinity
        ? pending
        : pending.slice(0, effectiveLimit);

    if (!batch.length) {
      broadcastAutomationMonitor(session, { typing: false, activeId: null });
      return;
    }

    const results = await window.electronAPI.sendWhatsappMessages(
      session.uid,
      batch,
      { pendingUrl: session.pendingUrl, silent: true }
    );

    if (Array.isArray(results) && results.length) {
      const successCount = results.filter(
        (item) => item.status === "done"
      ).length;
      const updated = markAutomationStatus(results, session);
      if (updated && successCount > 0 && !silent) {
        showToast(
          `Berhasil mengirim ${successCount} pesan untuk ${session.deviceName || session.uid}.`,
          3000,
          "success"
        );
      }
      const failed = results.filter((item) => item.status !== "done");
      if (failed.length && !silent) {
        showToast(
          `${failed.length} pesan gagal dikirim pada ${session.deviceName || session.uid}.`,
          3000,
          "warning"
        );
        console.warn("Pesan gagal:", failed);
      }
      if (!updated && successCount === 0 && !failed.length && !silent) {
        showToast(
          `Tidak ada pesan yang diperbarui untuk ${session.deviceName || session.uid}.`,
          3000,
          "info"
        );
      }
      broadcastAutomationMonitor(session);
    } else if (!silent) {
      showToast(
        `Automasi selesai tanpa respons pesan untuk ${session.deviceName || session.uid}.`,
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
          `Gagal menjalankan automasi WhatsApp untuk ${session.deviceName || session.uid}.`,
        4000,
        "error"
      );
    }
    broadcastAutomationMonitor(session, {
      error:
        err?.message ||
        `Gagal menjalankan automasi WhatsApp untuk ${session.deviceName || session.uid}.`,
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

function stopAutomationLoop() {
  if (automationTimer) {
    clearInterval(automationTimer);
    automationTimer = null;
  }
  if (automationFetchTimer) {
    clearInterval(automationFetchTimer);
    automationFetchTimer = null;
  }
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
    const rotatedOrder = order.slice(startIndex).concat(order.slice(0, startIndex));
    const sessions = rotatedOrder
      .map((uid) => automationSessions.get(uid))
      .filter(Boolean);

    const results = await Promise.all(
      sessions.map((session) => runAutomationTickForSession(session, { limit: 1 }))
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

    for (const uid of order) {
      const session = automationSessions.get(uid);
      if (!session) continue;
      automationFetchRunning = true;
      scheduleNextAutomationFetch(Date.now(), session);
      try {
        await refreshAutomationMessagesForSession(session, { silent: true });
      } catch (err) {
        console.error("Automation fetch loop error:", err);
      } finally {
        automationFetchRunning = false;
      }
    }
  } finally {
    automationFetchRoundRunning = false;
    restorePrimaryAutomationSession();
  }
}

function ensureAutomationLoop() {
  if (!automationSessions.size) {
    stopAutomationLoop();
    return;
  }

  if (!automationFetchTimer) {
    runAutomationFetchRound().catch((err) =>
      console.error("Automation fetch loop error:", err)
    );
    automationFetchTimer = setInterval(() => {
      runAutomationFetchRound().catch((err) =>
        console.error("Automation fetch loop error:", err)
      );
    }, AUTOMATION_FETCH_INTERVAL_MS);
  }

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
  if (typeof refreshAddAutoSenderUI === "function") {
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
  if (typeof refreshAddAutoSenderUI === "function") {
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
  const isWhatsApp = (service || "").toLowerCase() === "wa";
  const autoSenderEnabled = isWhatsApp && autoSenderCheckbox?.checked;
  const pendingUrl = autoSenderEnabled
    ? (pendingUrlInput?.value || "").trim()
    : "";

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
      pendingUrl,
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
  if (typeof refreshAddAutoSenderUI === "function") refreshAddAutoSenderUI();

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
