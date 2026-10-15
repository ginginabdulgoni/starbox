// Modul StarDesk — sisi renderer (MyStarBox, StarDesk, halaman Remote Control).
// Dimuat oleh core (module-host.js) setelah renderer.js.

const stardeskApi = (() => {
  const m = window.electronAPI.modules;
  return {
    /** Ambil semua device milik user (online + offline) dari remote server */
    getMyDevices: () => m.invoke('stardesk:get-my-devices'),

    /** Status agent lokal – apakah sedang terhubung ke remote server */
    getAgentStatus: () => m.invoke('stardesk:agent-status'),

    /** Ganti nama device ini */
    renameDevice: (deviceName) => m.invoke('stardesk:rename-device', { deviceName }),

    /** Generate OTP agar user lain bisa remote masuk ke device ini */
    generateOtp: () => m.invoke('stardesk:generate-otp'),

    /** Hubungkan ke perangkat orang lain dengan Device ID + OTP */
    connectByCode: (clientId, code) => m.invoke('stardesk:connect-by-code', { clientId, code }),

    /** Hubungkan ke perangkat orang lain dengan Device ID + PIN permanen */
    connectByPin: (clientId, pin) => m.invoke('stardesk:connect-by-pin', { clientId, pin }),

    /** Ambil pengaturan StarDesk lokal (PIN, permission toggles) */
    getSettings: () => m.invoke('stardesk:get-settings'),

    /** Simpan pengaturan StarDesk lokal */
    saveSettings: (settings) => m.invoke('stardesk:save-settings', settings),

    /** Ambil PIN guest (auto-generate jika belum ada) */
    getGuestPin: () => m.invoke('stardesk:guest-pin-get'),

    /** Refresh PIN guest (generate baru) */
    refreshGuestPin: () => m.invoke('stardesk:guest-pin-refresh'),

    /** Buka jendela preview layar perangkat ini */
    openSelfPreview: () => m.invoke('stardesk:open-self-preview'),

    /** Buka jendela remote viewer untuk perangkat lain */
    openRemoteViewer: (targetClientId, deviceName) =>
      m.invoke('stardesk:open-remote-viewer', { targetClientId, deviceName }),

    /** Event: device lain dalam akun user yang sama online */
    onDeviceOnline: (cb) =>
      m.on('remote:clients-updated', cb),
  };
})();

// Hook into switchPage (My StarBox)
(function() {
  const _origSwitchPage = window.switchPage;
  if (typeof _origSwitchPage === 'function') {
    window.switchPage = async function(page, ...args) {
      await _origSwitchPage(page, ...args);
      if (page === 'mystarbox') msbInit();
    };
  }
})();

// ═══════════════════════════════════════════════════════════════
// ── MYSTARBOX – Device Registry UI ─────────────────────────────
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  let _msbInitialized = false;
  let _msbSelfClientId = null;

  const PLATFORM_ICON = {
    win32:  'bi-windows',
    darwin: 'bi-apple',
    linux:  'bi-ubuntu',
  };

  function platformIcon(platform) {
    return PLATFORM_ICON[platform] || 'bi-laptop';
  }

  function timeAgo(isoStr) {
    if (!isoStr) return '—';
    const diff = Date.now() - new Date(isoStr).getTime();
    if (diff < 60000) return 'Baru saja';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' mnt lalu';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
    return Math.floor(diff / 86400000) + ' hari lalu';
  }

  function renderDeviceCard(device) {
    const isSelf = device.client_id === _msbSelfClientId;
    const isOnline = device.status === 'online';
    const displayName = device.device_name || device.hostname || device.client_id;
    const icon = platformIcon(device.platform);
    const selfClass = isSelf ? ' is-self' : '';

    return `
      <div class="msb-card${selfClass}" data-client-id="${device.client_id}">
        <div class="msb-card-top">
          <div class="msb-card-icon">
            <i class="bi ${icon}"></i>
          </div>
          <div class="msb-card-title">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <h3 title="${displayName}" style="margin:0 0 3px;">${displayName}</h3>
              ${isSelf ? `<span class="msb-self-badge">Perangkat Ini</span>` : ''}
            </div>
            <span class="msb-hostname">${device.hostname || ''}</span>
          </div>
          <span class="msb-status-badge ${isOnline ? 'online' : 'offline'}">
            <span class="dot"></span>
            ${isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div class="msb-card-meta">
          <span><i class="bi bi-cpu"></i> ${device.platform || '—'}</span>
          <span><i class="bi bi-app"></i> StarBox v${device.app_version || '—'}</span>
          <span><i class="bi bi-clock"></i> Terakhir aktif: ${timeAgo(device.last_heartbeat)}</span>
          ${device.ip_address ? `<span><i class="bi bi-hdd-network"></i> ${device.ip_address}</span>` : ''}
        </div>
        <div class="msb-card-actions">
          ${isSelf
            ? `<button class="msb-btn msb-btn-primary" onclick="msbOpenRemote('${device.client_id}', '${displayName.replace(/'/g, "\\'")}')">
                <i class="bi bi-display"></i> Preview
               </button>
               <button class="msb-btn msb-btn-secondary" onclick="msbShowSharePanel('${device.client_id}', '${displayName.replace(/'/g, "\\'")}')">
                <i class="bi bi-share-fill"></i> Bagikan
               </button>
               <button class="msb-btn msb-btn-secondary" onclick="msbShowDeviceInfo('${device.client_id}')">
                <i class="bi bi-info-circle"></i> Info
               </button>
               <button class="msb-btn msb-btn-secondary" onclick="msbRenameDevice('${device.client_id}', '${displayName.replace(/'/g, "\\'")}')">
                <i class="bi bi-pencil"></i>
               </button>
               <button class="msb-btn msb-btn-secondary" onclick="msbShowSettings('${device.client_id}')" title="Pengaturan">
                <i class="bi bi-gear-fill"></i>
               </button>`
            : `<button class="msb-btn msb-btn-primary" ${isOnline ? '' : 'disabled'} onclick="msbOpenRemote('${device.client_id}', '${displayName.replace(/'/g, "\\'")}')">
                <i class="bi bi-display"></i> Remote
               </button>
               <button class="msb-btn msb-btn-secondary" onclick="msbRenameDevice('${device.client_id}', '${displayName.replace(/'/g, "\\'")}')">
                <i class="bi bi-pencil"></i> Nama
               </button>`
          }
        </div>
      </div>`;
  }

  async function msbLoadDevices() {
    const grid = document.getElementById('msbDeviceGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="msb-loading"><i class="bi bi-hourglass-split"></i> Memuat perangkat...</div>';

    const api = stardeskApi;
    if (!api) {
      grid.innerHTML = '<div class="msb-empty"><i class="bi bi-exclamation-triangle"></i><p>StarDesk API tidak tersedia</p></div>';
      return;
    }

    // Ambil status agent lokal
    let _agentStatus = null;
    try {
      _agentStatus = await api.getAgentStatus();
      _msbSelfClientId = _agentStatus?.clientId || null;
      const dot  = document.getElementById('msbAgentDot');
      const text = document.getElementById('msbAgentStatusText');
      if (dot && text) {
        if (_agentStatus?.connected) {
          const isLoggedIn = typeof authState !== 'undefined' && authState.isLoggedIn;
          dot.className = 'msb-agent-dot online';
          text.textContent = isLoggedIn ? 'Terhubung ke server' : 'Terhubung (Guest)';
        } else {
          dot.className = 'msb-agent-dot offline';
          text.textContent = 'Menghubungkan...';
        }
      }
    } catch {}

    // Ambil daftar device
    try {
      const result = await api.getMyDevices();

      if (result?.error === 'NOT_LOGGED_IN') {
        // Gunakan agentStatus yang sudah di-fetch di atas
        const selfId       = _agentStatus?.clientId || '—';
        const selfName     = _agentStatus?.deviceName || _agentStatus?.hostname || selfId;
        const selfPlatform = _agentStatus?.platform || '';
        const isConn       = _agentStatus?.connected;
        const platIcon     = selfPlatform === 'win32' ? 'windows' : selfPlatform === 'darwin' ? 'apple' : 'display';
        const connClass    = isConn ? 'online' : 'offline';
        const connLabel    = isConn ? 'Terhubung' : 'Menghubungkan...';

        // Ambil PIN lokal
        let guestPin = '';
        try {
          const pinResult = await api.getGuestPin();
          guestPin = pinResult?.pin || '';
        } catch {}

        grid.innerHTML = `
          <div style="grid-column:1/-1;">
            <div class="sds-section-title" style="margin-bottom:8px;"><i class="bi bi-hdd-network"></i> Perangkat Ini</div>
            <div style="background:rgba(124,111,224,0.08);border:1px solid rgba(124,111,224,0.2);border-radius:10px;padding:14px 16px;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <div class="sds-si-icon"><i class="bi bi-${platIcon}"></i></div>
                <div style="flex:1;min-width:0;">
                  <div class="sds-si-name">${selfName} <span class="msb-self-badge">Perangkat Ini</span></div>
                </div>
                <span class="msb-status-badge ${connClass}" style="flex-shrink:0;">
                  <span class="dot"></span>${connLabel}
                </span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:8px 10px;">
                  <div style="font-size:0.68rem;opacity:0.5;margin-bottom:3px;">Device ID</div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <code style="font-size:0.72rem;word-break:break-all;flex:1;opacity:0.85;">${selfId}</code>
                    <button class="msb-copy-btn" onclick="msbCopyText('${selfId.replace(/'/g,"\\'")}', this)" title="Salin ID"><i class="bi bi-clipboard"></i></button>
                  </div>
                </div>
                <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:8px 10px;">
                  <div style="font-size:0.68rem;opacity:0.5;margin-bottom:3px;">PIN Akses</div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <code id="sdsGuestPinDisplay" style="font-size:1.1rem;letter-spacing:3px;font-weight:700;color:#a78bfa;flex:1;">${guestPin || '—'}</code>
                    <button class="msb-copy-btn" onclick="msbCopyText('${guestPin}', this)" title="Salin PIN"><i class="bi bi-clipboard"></i></button>
                    <button class="msb-copy-btn" onclick="sdsRefreshGuestPin()" title="Generate PIN baru"><i class="bi bi-arrow-clockwise"></i></button>
                  </div>
                </div>
              </div>
              <p style="font-size:0.73rem;opacity:0.45;margin:8px 0 0;text-align:center;">Bagikan Device ID + PIN ini kepada perangkat lain yang ingin meremote PC ini</p>
            </div>
            <div class="msb-empty" style="padding:12px 0 8px;border:none;background:none;">
              <i class="bi bi-person-circle" style="font-size:1.8rem;"></i>
              <p style="font-size:0.84rem;margin:6px 0 14px;">Login untuk melihat semua perangkat akun Anda<br>dan berbagi akses ke perangkat ini.</p>
              <button class="msb-btn msb-btn-primary" style="margin:0 auto;" onclick="handleAuthButtonClick()">
                <i class="bi bi-box-arrow-in-right"></i> Sign In / Register
              </button>
            </div>
          </div>`;
        return;
      }

      const devices = result?.devices || [];
      if (devices.length === 0) {
        grid.innerHTML = '<div class="msb-empty"><i class="bi bi-hdd-network"></i><p>Belum ada perangkat terdaftar.<br>Jalankan StarBox di perangkat lain untuk mendaftarkannya.</p></div>';
        return;
      }

      // Urutkan: self dulu, lalu online, lalu offline
      devices.sort((a, b) => {
        if (a.client_id === _msbSelfClientId) return -1;
        if (b.client_id === _msbSelfClientId) return 1;
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (b.status === 'online' && a.status !== 'online') return 1;
        return new Date(b.last_heartbeat) - new Date(a.last_heartbeat);
      });

      grid.innerHTML = devices.map(renderDeviceCard).join('');
    } catch (err) {
      grid.innerHTML = `<div class="msb-empty"><i class="bi bi-exclamation-triangle"></i><p>Gagal memuat perangkat: ${err.message}</p></div>`;
    }
  }

  window.msbInit = function () {
    if (!_msbInitialized) {
      const api = stardeskApi;
      if (api?.onDeviceOnline) {
        api.onDeviceOnline(() => {
          const page = document.getElementById('page-mystarbox');
          if (page && page.classList.contains('active')) msbLoadDevices();
        });
      }
      _msbInitialized = true;
    }
    msbLoadDevices();
    sdsRenderSessionHistory();
  };

  window.msbRefresh = function () {
    msbLoadDevices();
  };

  window.msbOpenRemote = function (clientId, deviceName) {
    const api = stardeskApi;
    if (!api) return;
    if (clientId === _msbSelfClientId) {
      api.openSelfPreview && api.openSelfPreview().catch(() => {});
      return;
    }
    // Record session before opening
    sdsRecordSession(clientId, deviceName);
    api.openRemoteViewer && api.openRemoteViewer(clientId, deviceName).catch(() => {});
  };

  // ── Tab switching ────────────────────────────────────────────────
  window.sdsSwitchTab = function (tab) {
    document.querySelectorAll('.sds-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sds-panel').forEach(p => p.classList.remove('active'));
    if (tab === 'stardesk') {
      document.getElementById('sdsTabBtnStardesk')?.classList.add('active');
      document.getElementById('sdsPanelStardesk')?.classList.add('active');
    } else {
      document.getElementById('sdsTabBtnMystarbox')?.classList.add('active');
      document.getElementById('sdsPanelMystarbox')?.classList.add('active');
      sdsLoadMyStarBox();
    }
  };

  // ── Session history ──────────────────────────────────────────────
  const SDS_HISTORY_KEY = 'stardesk-session-history';
  const SDS_HISTORY_MAX = 50;

  function sdsGetHistory() {
    try { return JSON.parse(localStorage.getItem(SDS_HISTORY_KEY) || '[]'); } catch { return []; }
  }

  function sdsRecordSession(clientId, deviceName) {
    const history = sdsGetHistory();
    history.unshift({ clientId, deviceName: deviceName || clientId, startedAt: new Date().toISOString() });
    if (history.length > SDS_HISTORY_MAX) history.length = SDS_HISTORY_MAX;
    localStorage.setItem(SDS_HISTORY_KEY, JSON.stringify(history));
    sdsRenderSessionHistory();
  }

  function sdsRenderSessionHistory() {
    const container = document.getElementById('sdsSessionList');
    if (!container) return;
    const history = sdsGetHistory();
    if (history.length === 0) {
      container.innerHTML = '<div class="sds-session-empty">Belum ada riwayat session remote</div>';
      return;
    }
    container.innerHTML = history.map(entry => {
      const d = new Date(entry.startedAt);
      const dateStr = isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
      const timeStr = isNaN(d) ? '' : d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
      return `
        <div class="sds-session-item">
          <div class="sds-si-icon"><i class="bi bi-display"></i></div>
          <div class="sds-si-info">
            <div class="sds-si-name">${entry.deviceName || entry.clientId}</div>
            <div class="sds-si-sub">${entry.clientId}</div>
          </div>
          <div class="sds-si-time">${dateStr}<br>${timeStr}</div>
          <button class="msb-btn msb-btn-primary" style="padding:4px 10px;font-size:0.78rem;" onclick="msbOpenRemote('${entry.clientId}','${(entry.deviceName||'').replace(/'/g,"\\'")}')">
            <i class="bi bi-display"></i> Remote
          </button>
        </div>`;
    }).join('');
  }

  window.sdsClearHistory = function () {
    localStorage.removeItem(SDS_HISTORY_KEY);
    sdsRenderSessionHistory();
  };

  // ── MyStarBox account tab ────────────────────────────────────────
  async function sdsLoadMyStarBox() {
    const container = document.getElementById('sdsMyboxContent');
    if (!container) return;

    const api = stardeskApi;

    // Check auth state
    const isLoggedIn = typeof authState !== 'undefined' && authState.isLoggedIn;
    if (!isLoggedIn) {
      container.innerHTML = `
        <div class="sds-mybox-login">
          <i class="bi bi-person-circle"></i>
          <p>Login untuk mengakses data akun MyStarBox Anda.<br>
             Lihat semua perangkat terdaftar dan informasi langganan.</p>
          <button class="msb-btn msb-btn-primary" style="margin:0 auto;" onclick="handleAuthButtonClick()">
            <i class="bi bi-box-arrow-in-right"></i> Sign In / Register
          </button>
        </div>`;
      return;
    }

    // Show account info
    const user = authState.user || {};
    const name = user.name || user.email || 'Pengguna';
    const email = user.email || '';
    const initial = (name[0] || 'U').toUpperCase();
    const isUnlimited = authState.isUnlimited || authState.package?.is_device_limit_unlimited;
    const planLabel = isUnlimited ? 'Pro' : 'Free';
    const planClass = isUnlimited ? 'pro' : 'free';
    const planIcon = isUnlimited ? 'bi-star-fill' : 'bi-person';

    container.innerHTML = `
      <div class="sds-account-card">
        <div class="sds-account-avatar">${initial}</div>
        <div class="sds-account-info">
          <h3>${name}</h3>
          <p>${email}</p>
          <span class="sds-plan-badge ${planClass}"><i class="bi ${planIcon}"></i> ${planLabel}</span>
        </div>
      </div>
      <div>
        <div class="sds-section-title"><i class="bi bi-hdd-network"></i> Perangkat Terdaftar</div>
        <div id="sdsMyboxDevices" class="sds-mybox-devices">
          <div class="msb-loading" style="padding:20px 0;"><i class="bi bi-hourglass-split"></i> Memuat...</div>
        </div>
      </div>`;

    // Load devices into the mybox device list
    if (!api) return;
    try {
      const result = await api.getMyDevices();
      const devicesEl = document.getElementById('sdsMyboxDevices');
      if (!devicesEl) return;
      const devices = result?.devices || [];
      if (devices.length === 0) {
        devicesEl.innerHTML = '<div class="sds-session-empty">Belum ada perangkat terdaftar</div>';
        return;
      }
      const agentStatus = await api.getAgentStatus().catch(() => null);
      const selfId = agentStatus?.clientId;
      devicesEl.innerHTML = devices.map(d => {
        const dname = d.device_name || d.hostname || d.client_id;
        const isOnline = d.status === 'online';
        const isSelf = d.client_id === selfId;
        const platIcon = d.platform === 'win32' ? 'windows' : d.platform === 'darwin' ? 'apple' : 'display';
        const remoteBtn = isSelf
          ? `<button class="msb-btn msb-btn-secondary" style="padding:4px 10px;font-size:0.78rem;" onclick="msbOpenRemote('${d.client_id}','${dname.replace(/'/g,"\\'")}')">
               <i class="bi bi-display"></i> Preview
             </button>`
          : `<button class="msb-btn msb-btn-primary" style="padding:4px 10px;font-size:0.78rem;" ${isOnline ? '' : 'disabled'} onclick="msbOpenRemote('${d.client_id}','${dname.replace(/'/g,"\\'")}')">
               <i class="bi bi-display"></i> Remote
             </button>`;
        return `
          <div class="sds-mybox-device-row">
            <div class="sds-si-icon"><i class="bi bi-${platIcon}"></i></div>
            <div class="sds-si-info">
              <div class="sds-si-name">${dname}${isSelf ? ' <span class="msb-self-badge">Perangkat Ini</span>' : ''}</div>
              <div class="sds-si-sub">${d.platform || ''} · v${d.app_version || '—'}</div>
            </div>
            <span class="msb-status-badge ${isOnline ? 'online' : 'offline'}" style="margin-right:6px;">
              <span class="dot"></span>${isOnline ? 'Online' : 'Offline'}
            </span>
            ${remoteBtn}
          </div>`;
      }).join('');
    } catch (err) {
      const devicesEl = document.getElementById('sdsMyboxDevices');
      if (devicesEl) devicesEl.innerHTML = `<div class="sds-session-empty">Gagal memuat: ${err.message}</div>`;
    }
  }

  window.msbRenameDevice = async function (clientId, currentName) {
    const newName = await new Promise((resolve) => {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Ganti Nama Perangkat',
          input: 'text',
          inputValue: currentName,
          inputAttributes: { maxlength: 50 },
          showCancelButton: true,
          confirmButtonText: 'Simpan',
          cancelButtonText: 'Batal',
          background: '#1e1b2e',
          color: '#fff',
          confirmButtonColor: '#7c6fe0',
        }).then((r) => resolve(r.isConfirmed ? r.value?.trim() : null));
      } else {
        const v = prompt('Nama perangkat baru:', currentName);
        resolve(v ? v.trim() : null);
      }
    });

    if (!newName) return;

    const api = stardeskApi;
    if (!api) return;

    try {
      const result = await api.renameDevice(newName);
      if (result?.ok) {
        msbLoadDevices();
      } else {
        alert('Gagal mengganti nama: ' + (result?.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Gagal mengganti nama: ' + err.message);
    }
  };

  // ── Show Device Info (ID) ───────────────────────────────────────
  window.msbShowDeviceInfo = function (clientId) {
    _msbOpenModal(`
      <div style="text-align:center;margin-bottom:16px;">
        <i class="bi bi-hdd-network-fill" style="font-size:2.5rem;color:#7c6fe0;"></i>
        <h3 style="margin:10px 0 4px;font-size:1.1rem;">ID Perangkat Ini</h3>
        <p style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin:0;">Bagikan ID ini kepada user lain bersama kode OTP</p>
      </div>
      <div class="msb-info-row">
        <span class="msb-info-label">Device ID</span>
        <div class="msb-info-copy">
          <code id="msbDeviceIdCode">${clientId}</code>
          <button class="msb-copy-btn" onclick="msbCopyText('${clientId}', this)"><i class="bi bi-clipboard"></i></button>
        </div>
      </div>
      <p style="font-size:0.8rem;color:rgba(255,255,255,0.45);margin-top:12px;text-align:center;">
        Gunakan tombol <b>Bagikan Akses</b> untuk membuat kode OTP satu kali pakai.
      </p>
    `);
  };

  // ── Share Panel (Device ID + OTP) ──────────────────────────────
  window.msbShowSharePanel = async function (clientId, deviceName) {
    const api = stardeskApi;
    if (!api) return;

    // Tampilkan modal dengan loading dulu
    _msbOpenModal(`
      <div style="text-align:center;margin-bottom:16px;">
        <i class="bi bi-share-fill" style="font-size:2.2rem;color:#7c6fe0;"></i>
        <h3 style="margin:10px 0 4px;font-size:1.1rem;">Bagikan Akses Remote</h3>
        <p style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin:0;">Berikan Device ID + OTP kepada orang yang ingin remote PC ini</p>
      </div>
      <div class="msb-info-row">
        <span class="msb-info-label">Device ID</span>
        <div class="msb-info-copy">
          <code id="msbShareDeviceId">${clientId}</code>
          <button class="msb-copy-btn" onclick="msbCopyText('${clientId}', this)"><i class="bi bi-clipboard"></i></button>
        </div>
      </div>
      <div class="msb-info-row" style="margin-top:10px;">
        <span class="msb-info-label">Kode OTP <span id="msbOtpTimer" style="font-size:0.75rem;opacity:0.6;"></span></span>
        <div class="msb-info-copy">
          <code id="msbOtpCode" style="font-size:1.4rem;letter-spacing:4px;color:#7c6fe0;">Memuat...</code>
          <button class="msb-copy-btn" id="msbOtpCopyBtn" disabled><i class="bi bi-clipboard"></i></button>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;justify-content:center;">
        <button class="msb-btn msb-btn-secondary" onclick="msbShowSharePanel('${clientId}', '${deviceName.replace(/'/g, "\\'")}')">
          <i class="bi bi-arrow-clockwise"></i> Buat OTP Baru
        </button>
        <button class="msb-btn msb-btn-secondary" onclick="_msbCloseModal()">Tutup</button>
      </div>
      <p style="font-size:0.78rem;color:rgba(255,255,255,0.4);margin-top:12px;text-align:center;">
        OTP berlaku 10 menit dan hanya bisa dipakai 1 kali
      </p>
    `, false);

    try {
      const result = await api.generateOtp();
      const codeEl  = document.getElementById('msbOtpCode');
      const copyBtn = document.getElementById('msbOtpCopyBtn');
      const timerEl = document.getElementById('msbOtpTimer');

      if (!result?.ok || !result?.code) {
        if (codeEl) codeEl.textContent = 'Gagal: ' + (result?.error || 'Error');
        return;
      }

      if (codeEl) codeEl.textContent = result.code;
      if (copyBtn) {
        copyBtn.disabled = false;
        copyBtn.onclick = () => msbCopyText(result.code, copyBtn);
      }

      // Countdown timer
      if (timerEl && result.expires_at) {
        const expiry = new Date(result.expires_at);
        const tick = () => {
          const secs = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
          if (!document.getElementById('msbOtpTimer')) return; // modal closed
          timerEl.textContent = secs > 0 ? `(${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')})` : '(Kadaluarsa)';
          if (secs > 0) setTimeout(tick, 1000);
        };
        tick();
      }
    } catch (err) {
      const codeEl = document.getElementById('msbOtpCode');
      if (codeEl) codeEl.textContent = 'Error: ' + err.message;
    }
  };

  // ── Inline connect form (StarDesk tab) ─────────────────────────
  window.sdsRefreshGuestPin = async function () {
    const api = stardeskApi;
    if (!api) return;
    const btn = event?.currentTarget;
    if (btn) { btn.innerHTML = '<i class="bi bi-hourglass-split"></i>'; btn.disabled = true; }
    try {
      const result = await api.refreshGuestPin();
      const pinEl = document.getElementById('sdsGuestPinDisplay');
      if (pinEl && result?.pin) pinEl.textContent = result.pin;
    } catch {}
    if (btn) { btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>'; btn.disabled = false; }
  };

  window.sdsFocusConnect = function () {
    // Switch to StarDesk tab and focus the Device ID input
    sdsSwitchTab('stardesk');
    setTimeout(() => document.getElementById('sdsConnectId')?.focus(), 80);
  };

  window.sdsConnectValidate = function () {
    const id = document.getElementById('sdsConnectId')?.value?.trim();
    const btn = document.getElementById('sdsConnectBtn');
    if (btn) btn.disabled = !id;
    const errEl = document.getElementById('sdsConnectErr');
    if (errEl) errEl.textContent = '';
  };

  window.sdsDoConnect = async function () {
    const clientId = document.getElementById('sdsConnectId')?.value?.trim();
    const pin      = document.getElementById('sdsConnectPin')?.value?.trim();
    const errEl    = document.getElementById('sdsConnectErr');
    if (!clientId) { if (errEl) errEl.textContent = 'Device ID wajib diisi'; return; }

    const api = stardeskApi;
    if (!api) return;

    const btn = document.getElementById('sdsConnectBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Menghubungkan...'; }
    if (errEl) errEl.textContent = '';

    try {
      let result;
      if (!pin) {
        // No code — try to open remote directly (same-account device)
        result = { ok: true, client_id: clientId, device_name: null, status: 'online' };
      } else {
        // Try OTP/code first (server determines if it's valid)
        result = await api.connectByCode(clientId, pin);

        // If OTP endpoint says the code doesn't exist, try as permanent PIN
        if (!result?.ok && (result?.error === 'INVALID_CODE' || result?.error === 'NOT_FOUND')) {
          const pinResult = await api.connectByPin(clientId, pin);
          // Use PIN result only if it's better than the OTP error
          if (pinResult?.ok || pinResult?.error !== 'INVALID_PIN') result = pinResult;
        }
      }

      if (!result?.ok) {
        const msgs = {
          INVALID_CODE: 'Kode OTP tidak valid atau sudah kadaluarsa',
          CODE_USED:    'Kode sudah pernah dipakai',
          CODE_EXPIRED: 'Kode sudah kadaluarsa',
          INVALID_PIN:  'PIN salah',
          NOT_FOUND:    'Device ID tidak ditemukan',
          NOT_LOGGED_IN: 'Silakan login terlebih dahulu',
          FORBIDDEN:    'Akses ditolak',
        };
        if (errEl) errEl.textContent = msgs[result?.error] || ('Gagal: ' + (result?.error || 'Unknown'));
        return;
      }

      const targetId   = result.client_id || clientId;
      const targetName = result.device_name || clientId;

      if (result.status && result.status !== 'online') {
        if (errEl) errEl.textContent = `Perangkat "${targetName}" sedang offline`;
        return;
      }

      // Clear form
      const idEl = document.getElementById('sdsConnectId');
      const pinEl = document.getElementById('sdsConnectPin');
      if (idEl) idEl.value = '';
      if (pinEl) pinEl.value = '';
      if (btn) btn.disabled = true;

      window.msbOpenRemote(targetId, targetName);
    } catch (err) {
      if (errEl) errEl.textContent = 'Error: ' + err.message;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-display"></i> Remote'; }
    }
  };

  // ── Connect by Code Dialog (kept for compatibility) ─────────────
  window.msbShowConnectDialog = function () {
    _msbOpenModal(`
      <div style="text-align:center;margin-bottom:16px;">
        <i class="bi bi-plug-fill" style="font-size:2.2rem;color:#7c6fe0;"></i>
        <h3 style="margin:10px 0 4px;font-size:1.1rem;">Hubungkan ke Perangkat Lain</h3>
        <p style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin:0;">Masukkan Device ID dan kode OTP yang diberikan pemilik perangkat</p>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:0.82rem;color:rgba(255,255,255,0.6);display:block;margin-bottom:5px;">Device ID</label>
        <input id="msbConnectDeviceId" type="text" placeholder="sb-hostname-abc123..." style="
          width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
          border-radius:7px;padding:9px 12px;color:#fff;font-size:0.9rem;outline:none;font-family:monospace;" />
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:0.82rem;color:rgba(255,255,255,0.6);display:block;margin-bottom:5px;">Kode OTP</label>
        <input id="msbConnectOtp" type="text" placeholder="6 digit kode" maxlength="6" style="
          width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
          border-radius:7px;padding:9px 12px;color:#fff;font-size:1.2rem;letter-spacing:4px;text-align:center;outline:none;" />
      </div>
      <div id="msbConnectError" style="color:#f87171;font-size:0.82rem;margin-bottom:10px;min-height:18px;text-align:center;"></div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="msb-btn msb-btn-primary" onclick="msbDoConnect()">
          <i class="bi bi-plug-fill"></i> Hubungkan
        </button>
        <button class="msb-btn msb-btn-secondary" onclick="_msbCloseModal()">Batal</button>
      </div>
    `);
    // Light mode input fix
    const isDark = !document.body.classList.contains('theme-mode-light');
    if (!isDark) {
      document.querySelectorAll('#msbConnectDeviceId,#msbConnectOtp').forEach(el => {
        el.style.background = 'rgba(0,0,0,0.06)';
        el.style.borderColor = 'rgba(124,111,224,0.3)';
        el.style.color = '#1e1a3f';
      });
    }
    setTimeout(() => document.getElementById('msbConnectDeviceId')?.focus(), 100);
  };

  window.msbDoConnect = async function () {
    const clientId = document.getElementById('msbConnectDeviceId')?.value?.trim();
    const code     = document.getElementById('msbConnectOtp')?.value?.trim();
    const errEl    = document.getElementById('msbConnectError');

    if (!clientId || !code) {
      if (errEl) errEl.textContent = 'Device ID dan OTP wajib diisi';
      return;
    }

    const api = stardeskApi;
    if (!api) return;

    if (errEl) errEl.textContent = 'Menghubungkan...';

    try {
      const result = await api.connectByCode(clientId, code);
      if (!result?.ok) {
        const msgs = { INVALID_CODE: 'Kode tidak valid', CODE_USED: 'Kode sudah dipakai', CODE_EXPIRED: 'Kode sudah kadaluarsa', NOT_LOGGED_IN: 'Silakan login terlebih dahulu' };
        if (errEl) errEl.textContent = msgs[result?.error] || ('Gagal: ' + (result?.error || 'Unknown'));
        return;
      }

      _msbCloseModal();

      if (result.status !== 'online') {
        alert(`Perangkat "${result.device_name || result.client_id}" saat ini offline. Tidak bisa di-remote.`);
        return;
      }

      // Buka Remote Control dan pilih device tersebut
      window.msbOpenRemote(result.client_id, result.device_name);
    } catch (err) {
      if (errEl) errEl.textContent = 'Error: ' + err.message;
    }
  };

  // ── Settings (PIN + Permissions) ──────────────────────────────
  window.msbShowSettings = async function (_clientId) {
    const api = stardeskApi;
    if (!api) return;

    // Muat settings dulu sebelum render modal
    let settings = { permanentPin: '', allowIncoming: true, viewOnly: false, requireApproval: false };
    try {
      const s = await api.getSettings();
      if (s) settings = { ...settings, ...s };
    } catch {}

    const isLight = document.body.classList.contains('theme-mode-light');
    const inputStyle = `width:100%;box-sizing:border-box;background:${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'};border:1px solid ${isLight ? 'rgba(124,111,224,0.3)' : 'rgba(255,255,255,0.15)'};border-radius:7px;padding:9px 12px;color:${isLight ? '#1e1a3f' : '#fff'};font-size:0.9rem;outline:none;font-family:monospace;`;
    const toggleRow = (id, label, desc, checked) => `
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 0;border-bottom:1px solid rgba(124,111,224,0.1);">
        <div style="flex:1;">
          <div style="font-size:0.88rem;font-weight:500;">${label}</div>
          <div style="font-size:0.78rem;opacity:0.55;margin-top:2px;">${desc}</div>
        </div>
        <div style="position:relative;width:40px;height:22px;flex-shrink:0;margin-top:1px;">
          <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute;" onchange="msbSettingsToggleStyle(this)">
          <span id="${id}Track" onclick="document.getElementById('${id}').click()" style="display:block;width:40px;height:22px;background:${checked ? '#7c6fe0' : 'rgba(255,255,255,0.15)'};border-radius:11px;cursor:pointer;transition:background 0.2s;position:relative;">
            <span style="position:absolute;top:3px;left:${checked ? '21px' : '3px'};width:16px;height:16px;background:#fff;border-radius:50%;transition:left 0.2s;pointer-events:none;" id="${id}Knob"></span>
          </span>
        </div>
      </label>`;

    _msbOpenModal(`
      <div style="text-align:center;margin-bottom:18px;">
        <i class="bi bi-gear-fill" style="font-size:2rem;color:#7c6fe0;"></i>
        <h3 style="margin:10px 0 4px;font-size:1.1rem;">Pengaturan StarDesk</h3>
        <p style="font-size:0.8rem;opacity:0.5;margin:0;">Konfigurasi akses remote untuk perangkat ini</p>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <i class="bi bi-key-fill" style="color:#7c6fe0;"></i> PIN Permanen
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div style="position:relative;flex:1;">
            <input id="msbPinInput" type="password" placeholder="PIN 4–20 karakter (kosongkan untuk hapus)" style="${inputStyle}padding-right:38px;" value="${settings.permanentPin || ''}" />
            <button onclick="msbTogglePinVisibility()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(124,111,224,0.8);font-size:1rem;padding:0;" id="msbPinEyeBtn">
              <i class="bi bi-eye" id="msbPinEyeIcon"></i>
            </button>
          </div>
          <button class="msb-btn msb-btn-secondary" onclick="msbGeneratePin()" title="Buat PIN acak" style="flex-shrink:0;">
            <i class="bi bi-shuffle"></i>
          </button>
        </div>
        <p style="font-size:0.76rem;opacity:0.45;margin:6px 0 0;">PIN bisa dipakai berkali-kali tanpa kadaluarsa. Kosongkan untuk menonaktifkan.</p>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          <i class="bi bi-shield-lock-fill" style="color:#7c6fe0;"></i> Izin Akses
        </div>
        ${toggleRow('msbAllow', 'Izinkan Koneksi Masuk', 'Perangkat ini bisa di-remote oleh user lain', settings.allowIncoming !== false)}
        ${toggleRow('msbViewOnly', 'Mode Lihat Saja', 'Remote user hanya bisa melihat layar, tidak bisa kontrol', settings.viewOnly === true)}
        ${toggleRow('msbApproval', 'Butuh Persetujuan', 'Tampilkan konfirmasi sebelum koneksi masuk diterima', settings.requireApproval === true)}
      </div>

      <div id="msbSettingsMsg" style="font-size:0.82rem;text-align:center;min-height:18px;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="msb-btn msb-btn-primary" onclick="msbSaveSettings()">
          <i class="bi bi-floppy-fill"></i> Simpan
        </button>
        <button class="msb-btn msb-btn-secondary" onclick="_msbCloseModal()">Batal</button>
      </div>
    `);
  };

  window.msbTogglePinVisibility = function () {
    const inp = document.getElementById('msbPinInput');
    const icon = document.getElementById('msbPinEyeIcon');
    if (!inp) return;
    if (inp.type === 'password') {
      inp.type = 'text';
      if (icon) { icon.className = 'bi bi-eye-slash'; }
    } else {
      inp.type = 'password';
      if (icon) { icon.className = 'bi bi-eye'; }
    }
  };

  window.msbGeneratePin = function () {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const pin = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const inp = document.getElementById('msbPinInput');
    if (inp) { inp.value = pin; inp.type = 'text'; }
    const icon = document.getElementById('msbPinEyeIcon');
    if (icon) icon.className = 'bi bi-eye-slash';
  };

  // Toggle switch visual update
  window.msbSettingsToggleStyle = function (checkbox) {
    const track = document.getElementById(checkbox.id + 'Track');
    const knob  = document.getElementById(checkbox.id + 'Knob');
    if (track) track.style.background = checkbox.checked ? '#7c6fe0' : 'rgba(255,255,255,0.15)';
    if (knob)  knob.style.left = checkbox.checked ? '21px' : '3px';
  };

  window.msbSaveSettings = async function () {
    const api = stardeskApi;
    if (!api) return;

    const pin         = document.getElementById('msbPinInput')?.value?.trim() || null;
    const allowIncoming   = document.getElementById('msbAllow')?.checked ?? true;
    const viewOnly        = document.getElementById('msbViewOnly')?.checked ?? false;
    const requireApproval = document.getElementById('msbApproval')?.checked ?? false;
    const msgEl       = document.getElementById('msbSettingsMsg');

    // Validasi PIN
    if (pin && (pin.length < 4 || pin.length > 20)) {
      if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'PIN harus 4–20 karakter'; }
      return;
    }

    if (msgEl) { msgEl.style.color = '#a78bfa'; msgEl.textContent = 'Menyimpan...'; }

    try {
      const result = await api.saveSettings({ permanentPin: pin, allowIncoming, viewOnly, requireApproval });
      if (result?.ok) {
        if (msgEl) { msgEl.style.color = '#4ade80'; msgEl.textContent = '✓ Tersimpan'; }
        setTimeout(() => _msbCloseModal(), 900);
      } else {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Gagal: ' + (result?.error || 'Unknown'); }
      }
    } catch (err) {
      if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Error: ' + err.message; }
    }
  };

  // ── Copy helper ────────────────────────────────────────────────
  window.msbCopyText = function (text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (btn) { btn.innerHTML = '<i class="bi bi-check2"></i>'; setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500); }
    }).catch(() => {});
  };

  // ── Modal helper ───────────────────────────────────────────────
  function _msbOpenModal(html, showClose = true) {
    let overlay = document.getElementById('msbModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'msbModalOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.addEventListener('click', (e) => { if (e.target === overlay) _msbCloseModal(); });
      document.body.appendChild(overlay);
    }
    const isLight = document.body.classList.contains('theme-mode-light');
    overlay.innerHTML = `
      <div style="background:${isLight ? '#fff' : '#1e1b2e'};color:${isLight ? '#1e1a3f' : '#fff'};border:1px solid rgba(124,111,224,${isLight ? '0.25' : '0.3'});border-radius:14px;padding:24px;max-width:460px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.4);position:relative;">
        ${showClose ? `<button onclick="_msbCloseModal()" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:${isLight ? '#6b7280' : '#888'};line-height:1;">✕</button>` : ''}
        <style>
          .msb-info-row{display:flex;flex-direction:column;gap:5px;}
          .msb-info-label{font-size:0.78rem;color:${isLight ? '#6b7280' : 'rgba(255,255,255,0.5)'};}
          .msb-info-copy{display:flex;align-items:center;gap:8px;background:${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)'};border:1px solid rgba(124,111,224,0.2);border-radius:7px;padding:8px 10px;}
          .msb-info-copy code{flex:1;font-size:0.85rem;word-break:break-all;color:${isLight ? '#3d3480' : '#a78bfa'};}
          .msb-copy-btn{background:none;border:none;cursor:pointer;color:${isLight ? '#7c6fe0' : '#a78bfa'};font-size:1rem;padding:2px 4px;flex-shrink:0;}
          .msb-copy-btn:disabled{opacity:0.4;cursor:not-allowed;}
        </style>
        ${html}
      </div>`;
    overlay.style.display = 'flex';
  }

  window._msbCloseModal = function () {
    const el = document.getElementById('msbModalOverlay');
    if (el) el.style.display = 'none';
  };
})();

(function () {
  "use strict";

  let _rcInitialized = false;

  const rcState = {
    connected: false,
    myClientId: null,
    clients: [],
    selectedClient: null,
    selectedClientDevices: [],
    pollTimer: null,
    _reconnectTimer: null,
  };

  function rcEsc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function rcNow() {
    return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function rcAddLog(level, message) {
    const panel = document.getElementById("rc-logPanel");
    if (!panel) return;
    const row = document.createElement("div");
    row.className = "rc-log-entry";
    row.innerHTML = `<span class="rc-log-time">${rcNow()}</span><span class="rc-log-${level}">${rcEsc(message)}</span>`;
    panel.appendChild(row);
    panel.scrollTop = panel.scrollHeight;
    while (panel.children.length > 200) panel.removeChild(panel.firstChild);
  }

  function rcUpdateConnectionUI() {
    const dot = document.getElementById("rc-dot");
    const label = document.getElementById("rc-connLabel");
    if (!dot || !label) return;
    if (rcState.connected) {
      dot.className = "rc-dot";
      label.textContent = `Terhubung (ID: ${rcState.myClientId || "-"})`;
    } else {
      dot.className = "rc-dot rc-dot-offline";
      label.textContent = "Menghubungkan ulang...";
    }
  }

  function rcUpdateStats() {
    const total = rcState.selectedClientDevices.length;
    const running = rcState.selectedClientDevices.filter((d) => d.running).length;
    const el1 = document.getElementById("rc-chipDevice");
    const el2 = document.getElementById("rc-chipRunning");
    if (el1) el1.textContent = String(total);
    if (el2) el2.textContent = String(running);
  }

  function rcRenderSelectedHeader() {
    const title = document.getElementById("rc-selectedTitle");
    const sub = document.getElementById("rc-selectedSub");
    if (!title || !sub) return;
    if (!rcState.selectedClient) {
      title.textContent = "Belum ada komputer dipilih";
      sub.textContent = "Pilih client dari panel kiri untuk mulai remote.";
      return;
    }
    const c = rcState.selectedClient;
    title.textContent = c.hostname || c.client_id;
    sub.textContent = `${c.platform || "-"} · ${c.user_email || "akun sama"}`;
  }

  function rcRenderClientList() {
    const listEl = document.getElementById("rc-clientList");
    if (!listEl) return;
    if (!rcState.clients.length) {
      listEl.innerHTML = `<div class="rc-empty-client">Tidak ada client online dengan akun yang sama.</div>`;
      return;
    }
    const sorted = [...rcState.clients].sort((a, b) => {
      return (b.client_id === rcState.myClientId ? 1 : 0) - (a.client_id === rcState.myClientId ? 1 : 0);
    });
    listEl.innerHTML = sorted.map((c) => {
      const online = c.status === "online";
      const isSelected = rcState.selectedClient?.client_id === c.client_id;
      const isSelf = c.client_id === rcState.myClientId;
      return `<div class="rc-client-item ${isSelected ? "rc-active" : ""}" onclick="rcSelectClient('${rcEsc(c.client_id)}')">
        <div class="rc-client-name">${rcEsc(c.hostname || c.client_id)}${isSelf ? " (Ini)" : ""}</div>
        <div class="rc-client-meta">${rcEsc(c.platform || "-")} · v${rcEsc(c.app_version || "?")}</div>
        <span class="rc-client-badge ${online ? "rc-badge-online" : "rc-badge-offline"}">${online ? "Online" : "Offline"}</span>
      </div>`;
    }).join("");
  }

  function rcStartPolling(clientId) {
    rcStopPolling();
    rcState.pollTimer = setInterval(async () => {
      if (!rcState.selectedClient || !rcState.connected) return;
      try {
        const result = await rcSendCommand(clientId, "list_devices", { include_android: false });
        const devices = Array.isArray(result?.devices) ? result.devices : [];
        const oldSig = rcState.selectedClientDevices.map(d => `${d.uid}:${d.running}`).join(",");
        const newSig = devices.map(d => `${d.uid}:${d.running}`).join(",");
        if (oldSig !== newSig) {
          rcState.selectedClientDevices = devices;
          rcRenderDeviceGrid();
          rcUpdateStats();
        }
      } catch { /* silent */ }
    }, 10000); // 10s — cukup untuk deteksi status device, tidak spam server
  }

  function rcStopPolling() {
    if (rcState.pollTimer) { clearInterval(rcState.pollTimer); rcState.pollTimer = null; }
  }

  window.rcSelectClient = async function (clientId) {
    const target = rcState.clients.find((c) => c.client_id === clientId);
    if (!target) return;
    rcState.selectedClient = target;
    rcRenderClientList();
    rcRenderSelectedHeader();
    const grid = document.getElementById("rc-deviceGrid");
    if (grid) grid.innerHTML = `<div class="rc-hint">Memuat device dari ${rcEsc(target.hostname || target.client_id)}...</div>`;
    await rcLoadDevices(clientId);
    rcStartPolling(clientId);
  };

  async function rcLoadDevices(clientId) {
    if (!clientId) return;
    try {
      const result = await rcSendCommand(clientId, "list_devices", { include_android: false });
      rcState.selectedClientDevices = Array.isArray(result?.devices) ? result.devices : [];
      rcRenderDeviceGrid();
      rcUpdateStats();
      rcAddLog("success", `Load ${rcState.selectedClientDevices.length} device dari ${clientId.slice(0, 16)}`);
    } catch (err) {
      rcState.selectedClientDevices = [];
      rcRenderDeviceGrid();
      rcUpdateStats();
      rcAddLog("error", `Gagal load device: ${err.message}`);
    }
  }

  function rcRenderDeviceGrid() {
    const grid = document.getElementById("rc-deviceGrid");
    if (!grid) return;
    if (!rcState.selectedClient) {
      grid.innerHTML = `<div class="rc-hint">Pilih komputer untuk memuat device.</div>`;
      return;
    }
    if (!rcState.selectedClientDevices.length) {
      grid.innerHTML = `<div class="rc-hint">Tidak ada device ditemukan.</div>`;
      return;
    }
    const icons = { wa: "💬", android: "🤖", telegram: "✈️", tiktok: "🎵", youtube_studio: "▶️" };
    grid.innerHTML = rcState.selectedClientDevices.map((d) => {
      const uid = String(d.uid || "");
      const running = !!d.running;
      const remoteEnabled = d.remoteEnabled !== false;
      const icon = icons[String(d.service || "").toLowerCase()] || "🌐";
      const safeUid = rcEsc(uid);
      const safeName = rcEsc(d.name || uid);
      const encodedName = encodeURIComponent(String(d.name || uid));

      const runningBtns = `
        <button class="rc-btn rc-btn-xs rc-btn-primary" onclick="rcOpenMonitor('${safeUid}','${encodedName}')">Remote</button>
        <button class="rc-btn rc-btn-xs rc-btn-soft" onclick="rcQuickCmd('focus_tab','${safeUid}')">Fokus</button>
        <button class="rc-btn rc-btn-xs rc-btn-soft" onclick="rcQuickCmd('reload_tab','${safeUid}')">Reload</button>
        <button class="rc-btn rc-btn-xs rc-btn-danger" onclick="rcQuickCmd('stop_device','${safeUid}')">Stop</button>
      `;
      const stoppedBtns = `
        <button class="rc-btn rc-btn-xs rc-btn-primary" onclick="rcQuickCmd('start_device','${safeUid}')">Start</button>
        <button class="rc-btn rc-btn-xs rc-btn-soft" onclick="rcQuickCmd('open_tab','${safeUid}')">Buka Tab</button>
      `;
      const disabledInfo = `
        <div class="rc-remote-disabled-info">
          <i class="bi bi-wifi-off"></i>
          <span>Remote dinonaktifkan. Aktifkan di perangkat StarBox Anda.</span>
        </div>
      `;
      return `<div class="rc-device-card${remoteEnabled ? "" : " rc-remote-disabled"}">
        <div class="rc-device-head">
          <div class="rc-device-icon">${icon}</div>
          <div style="min-width:0">
            <div class="rc-device-name">${safeName}</div>
            <div class="rc-device-meta">${rcEsc(d.service || "web")} · ${rcEsc(uid.slice(0, 10))}</div>
          </div>
        </div>
        <span class="rc-status-pill ${running ? "rc-running" : "rc-stopped"}">${running ? "Running" : "Stopped"}</span>
        <div class="rc-device-actions">${remoteEnabled ? (running ? runningBtns : stoppedBtns) : disabledInfo}</div>
      </div>`;
    }).join("");
  }

  window.rcOpenMonitor = async function (uid, encodedName) {
    if (!rcState.selectedClient) { rcAddLog("warn", "Pilih client dulu."); return; }
    const deviceName = (() => { try { return decodeURIComponent(encodedName || ""); } catch { return uid; } })();
    try {
      const res = await window.electronAPI.modules.invoke("remote:open-monitor-window", {
        toClientId: rcState.selectedClient.client_id,
        uid, deviceName, resolution: "960x540",
      });
      if (!res?.success) throw new Error(res?.error || "Gagal buka monitor");
      rcAddLog("info", `Monitor dibuka: ${deviceName}`);
    } catch (err) {
      rcAddLog("error", `Open monitor gagal: ${err.message}`);
    }
  };

  window.rcQuickCmd = async function (command, uid) {
    if (!rcState.selectedClient) { rcAddLog("warn", "Pilih client dulu."); return; }
    if (!uid) return;
    rcAddLog("info", `${command} -> ${uid.slice(0, 10)}`);
    try {
      const result = await rcSendCommand(rcState.selectedClient.client_id, command, { uid });
      rcAddLog("success", `${command}: ${JSON.stringify(result).slice(0, 100)}`);
      if (["start_device","stop_device","restart_device","open_tab","close_tab"].includes(command)) {
        setTimeout(() => rcLoadDevices(rcState.selectedClient.client_id), 600);
      }
    } catch (err) {
      rcAddLog("error", `${command}: ${err.message}`);
    }
  };

  async function rcSendCommand(toClientId, command, payload = {}) {
    const res = await window.electronAPI.remote.sendCommand(toClientId, command, payload);
    if (!res?.success) throw new Error(res?.error || "Unknown error");
    return res.result;
  }

  window.rcRefreshClients = function () {
    if (window.electronAPI?.remote?.refreshClients) {
      window.electronAPI.remote.refreshClients();
      rcAddLog("info", "Refresh daftar client...");
    }
  };

  function rcCheckPremiumAccess() {
    const state = window.getCurrentAuthState?.();
    const paywall = document.getElementById("rc-paywall");
    const header  = document.getElementById("rc-main-header");
    const workspace = document.querySelector(".rc-workspace");

    if (!paywall || !header || !workspace) return true;

    const isLoggedIn = !!state?.isLoggedIn;
    let isFree = !isLoggedIn;

    if (isLoggedIn && state?.package) {
      const priceRaw = state.package.price ?? state.package.price_display ?? "";
      const text = String(priceRaw).toLowerCase();
      if (text.includes("gratis") || text.includes("free")) {
        isFree = true;
      } else {
        const num = Number(String(priceRaw).replace(/[^0-9.-]/g, ""));
        isFree = Number.isFinite(num) && num <= 0;
      }
    }

    if (isFree) {
      // Tampilkan paywall, sembunyikan konten utama
      paywall.style.display = "flex";
      header.style.display  = "none";
      workspace.style.display = "none";

      // Render tombol aksi sesuai kondisi
      const actions = document.getElementById("rc-paywall-actions");
      if (actions) {
        if (!isLoggedIn) {
          actions.innerHTML = `
            <button onclick="handleAuthButtonClick()" style="background:linear-gradient(135deg,#1ec8a5,#16a085);border:none;color:#031f18;font-size:14px;font-weight:700;padding:12px 28px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
              <i class="bi bi-box-arrow-in-right"></i> Masuk / Daftar
            </button>
            <button onclick="openPackageModal()" style="background:#0d2234;border:1px solid #28445d;color:#c8dff0;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
              <i class="bi bi-rocket-takeoff"></i> Lihat Paket
            </button>`;
        } else {
          actions.innerHTML = `
            <button onclick="openPackageModal()" style="background:linear-gradient(135deg,#1ec8a5,#16a085);border:none;color:#031f18;font-size:14px;font-weight:700;padding:12px 28px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
              <i class="bi bi-rocket-takeoff"></i> Upgrade Sekarang
            </button>
            <button onclick="openAccountModal()" style="background:#0d2234;border:1px solid #28445d;color:#c8dff0;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
              <i class="bi bi-person-circle"></i> Info Akun
            </button>`;
        }
      }
      return false; // tidak punya akses
    }

    // Premium — tampilkan konten normal
    paywall.style.display   = "none";
    header.style.display    = "flex";
    workspace.style.display = "grid";
    return true; // punya akses
  }

  window.initRemoteControlPage = function () {
    // Cek akses premium dulu — jika tidak, tampilkan paywall dan berhenti
    if (!rcCheckPremiumAccess()) return;

    if (!window.electronAPI?.remote) {
      const label = document.getElementById("rc-connLabel");
      if (label) label.textContent = "Error: API tidak tersedia";
      return;
    }

    // Register persistent event listeners only once
    if (!_rcInitialized) {
      _rcInitialized = true;

      window.electronAPI.remote.onClientsUpdated(({ clients }) => {
        // Receiving a client list from server = we're connected
        if (!rcState.connected) {
          rcState.connected = true;
          rcUpdateConnectionUI();
        }
        rcState.clients = Array.isArray(clients) ? clients : [];
        // Expose ke halaman lain (misal MikroTik)
        window.remoteClients = rcState.clients;
        window.myClientId    = rcState.myClientId;
        rcRenderClientList();
        if (rcState.selectedClient) {
          const still = rcState.clients.find((c) => c.client_id === rcState.selectedClient.client_id);
          if (!still) {
            rcAddLog("warn", "Client terpilih offline. Pilih client lain.");
            rcStopPolling();
            rcState.selectedClient = null;
            rcState.selectedClientDevices = [];
            rcRenderSelectedHeader();
            rcRenderDeviceGrid();
          } else {
            rcState.selectedClient = still;
            rcRenderSelectedHeader();
          }
        }
        rcUpdateStats();
      });

      window.electronAPI.remote.onConnectionChanged(({ connected }) => {
        const wasConnected = rcState.connected;
        rcState.connected = !!connected;
        rcUpdateConnectionUI();
        if (!connected) {
          clearTimeout(rcState._reconnectTimer);
          rcState._reconnectTimer = setTimeout(() => {
            if (!rcState.connected) window.electronAPI.remote.refreshClients();
          }, 3000);
        } else if (!wasConnected) {
          window.electronAPI.remote.refreshClients();
          rcAddLog("success", "Terhubung kembali ke server.");
        }
      });
    }

    // Every time the page opens: fetch current state + ask server for fresh client list
    window.electronAPI.remote.getClients().then((initial) => {
      rcState.connected = !!initial?.connected;
      rcState.myClientId = initial?.clientId || null;
      rcState.clients = Array.isArray(initial?.clients) ? initial.clients : [];
      window.remoteClients = rcState.clients;
      window.myClientId    = rcState.myClientId;
      rcUpdateConnectionUI();
      rcRenderClientList();
      rcRenderSelectedHeader();
      rcRenderDeviceGrid();
      rcUpdateStats();
      if (!rcState.clients.length) {
        rcAddLog("info", "Menghubungkan ke server...");
      }
    }).catch((err) => {
      const label = document.getElementById("rc-connLabel");
      if (label) label.textContent = `Error: ${err.message}`;
      rcAddLog("error", `getClients gagal: ${err.message}`);
    });

    // Immediately request fresh data from server (doesn't wait for getClients)
    window.electronAPI.remote.refreshClients();
  };
  // Watch for when page-remote-control becomes active (most reliable trigger)
  (function () {
    function tryInit() {
      if (typeof window.initRemoteControlPage === "function") {
        window.initRemoteControlPage();
      }
    }
    const rcPage = document.getElementById("page-remote-control");
    if (rcPage) {
      const obs = new MutationObserver(() => {
        if (rcPage.classList.contains("active")) tryInit();
      });
      obs.observe(rcPage, { attributes: true, attributeFilter: ["class"] });
    }
  })();
})();
