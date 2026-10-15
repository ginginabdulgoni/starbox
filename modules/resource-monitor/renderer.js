// Modul Resource Monitor — sisi renderer (dulu <script> inline di halaman).

const resourceMonitorApi = (() => {
  const m = window.electronAPI.modules;
  return {
    get:          () => m.invoke("resource-monitor-get"),
    getProcesses: (limit) => m.invoke("resource-monitor-processes", limit),
    killProcess:  (pid) => m.invoke("resource-monitor-kill", pid),
    cleanScan:    () => m.invoke("system-clean-scan"),
    cleanRun:     (ids) => m.invoke("system-clean-run", ids),
  };
})();

let _rmInterval = null;
let _rmActive   = false;
let _rmAllProcs = [];   // raw process list from last fetch
let _rmMaxMem   = 1;    // for bar scaling

/* ── helpers ── */
function rmFmtBytes(b) {
  if (!b || b < 0) return '—';
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576)    return (b / 1048576).toFixed(0) + ' MB';
  return (b / 1024).toFixed(0) + ' KB';
}
function rmFmtUptime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h}j ${m}m`;
}
function rmSet(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function rmSetBar(id, pct) { const el = document.getElementById(id); if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%'; }
function rmSetSvc(cardId, cntId, v) {
  const card = document.getElementById(cardId);
  const cnt  = document.getElementById(cntId);
  if (!card || !cnt) return;
  cnt.textContent = v;
  card.className = 'rm-svc-card' + (v > 0 ? ' rm-svc-active' : '');
}

/* ── system stats refresh ── */
async function rmRefresh() {
  try {
    const d = await resourceMonitorApi.get();
    rmSet('rmCpuPct', d.cpu + '%');
    rmSet('rmCpuSub', d.system.cores + ' core · ' + (d.system.model.split('@')[0].trim().slice(0, 30) || '—'));
    rmSetBar('rmCpuBar', d.cpu);

    const memPct = Math.round(d.mem.used / d.mem.total * 100);
    rmSet('rmMemPct', memPct + '%');
    rmSet('rmMemSub', rmFmtBytes(d.mem.used) + ' / ' + rmFmtBytes(d.mem.total));
    rmSetBar('rmMemBar', memPct);

    if (d.disk) {
      const dp = Math.round(d.disk.used / d.disk.total * 100);
      rmSet('rmDiskPct', dp + '%');
      rmSet('rmDiskSub', rmFmtBytes(d.disk.used) + ' / ' + rmFmtBytes(d.disk.total));
      rmSetBar('rmDiskBar', dp);
    } else {
      rmSet('rmDiskPct', 'N/A'); rmSet('rmDiskSub', '—');
    }

    const selfPct = Math.round(d.selfMem.rss / d.mem.total * 100);
    rmSet('rmSelfMb', rmFmtBytes(d.selfMem.rss));
    rmSet('rmSelfSub', selfPct + '% dari total RAM');
    rmSetBar('rmSelfBar', selfPct);

    rmSetSvc('rmSvcWeb',     'rmSvcWebCount',     d.services.webEmulator);
    rmSetSvc('rmSvcAndroid', 'rmSvcAndroidCount', d.services.androidEmulator);
    rmSetSvc('rmSvcCctv',    'rmSvcCctvCount',    d.services.cctvStreams);
    rmSetSvc('rmSvcWa',      'rmSvcWaCount',      d.services.waGateway);
    rmSetSvc('rmSvcAdb',     'rmSvcAdbCount',     d.services.adbRemote);
    // Use renderer-side rmxTabs count (more accurate than backend session map)
    const remoxCount = typeof window.rmxGetActiveCount === 'function' ? window.rmxGetActiveCount() : d.services.remox;
    rmSetSvc('rmSvcRemox',   'rmSvcRemoxCount',   remoxCount);

    rmSet('rmSysPlatform',  d.system.platform);
    rmSet('rmSysArch',      d.system.arch);
    rmSet('rmSysCores',     d.system.cores + ' core');
    rmSet('rmSysModel',     d.system.model || '—');
    rmSet('rmSysHost',      d.system.hostname);
    rmSet('rmSysHeap',      rmFmtBytes(d.selfMem.heapUsed));
    rmSet('rmSysHeapTotal', rmFmtBytes(d.selfMem.heapTotal));
    rmSet('rmSysUptime',    rmFmtUptime(d.system.uptime));

    rmSet('rmLastUpdated', 'Update ' + new Date().toLocaleTimeString('id-ID'));
  } catch (e) { console.error('[RM stats]', e); }
}

/* ── process list ── */
async function rmLoadProcs() {
  document.getElementById('rmProcContainer').innerHTML =
    '<div class="rm-loading"><span class="rm-spinner">⟳</span> Memuat proses…</div>';
  try {
    const procs = await resourceMonitorApi.getProcesses(80);
    _rmAllProcs = procs;
    _rmMaxMem   = Math.max(1, ...procs.map(p => p.mem || 0));
    rmRenderProcs();
  } catch (e) {
    document.getElementById('rmProcContainer').innerHTML =
      '<div class="rm-loading">Gagal memuat proses: ' + (e.message || e) + '</div>';
  }
}

let _rmSortBy  = 'mem';
let _rmSortDir = 'desc';   // 'asc' | 'desc'

function rmFilterProcs() { rmRenderProcs(); }
function rmSortProcs(col) { rmSetSort(col); }

function rmSetSort(col) {
  if (_rmSortBy === col) {
    _rmSortDir = _rmSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    _rmSortBy  = col;
    _rmSortDir = col === 'name' ? 'asc' : 'desc';
  }
  rmRenderProcs();
}

function rmRenderProcs() {
  const q = (document.getElementById('rmProcSearch')?.value || '').toLowerCase();
  let list = _rmAllProcs.filter(p => !q || p.name.toLowerCase().includes(q));

  list.sort((a, b) => {
    let v;
    if (_rmSortBy === 'cpu')       v = (a.cpu || 0) - (b.cpu || 0);
    else if (_rmSortBy === 'name') v = a.name.localeCompare(b.name);
    else if (_rmSortBy === 'pid')  v = a.pid - b.pid;
    else if (_rmSortBy === 'user') v = (a.user || '').localeCompare(b.user || '');
    else                           v = (a.mem || 0) - (b.mem || 0);
    return _rmSortDir === 'asc' ? v : -v;
  });

  if (!list.length) {
    document.getElementById('rmProcContainer').innerHTML =
      '<div class="rm-loading">Tidak ada proses yang ditemukan.</div>';
    return;
  }

  const arrow = (col) => {
    if (_rmSortBy !== col) return '<i class="rm-th-arrow" style="opacity:.2">⇅</i>';
    return `<i class="rm-th-arrow">${_rmSortDir === 'asc' ? '▲' : '▼'}</i>`;
  };
  const thCls = (col) => _rmSortBy === col ? 'rm-th-active' : '';

  const rows = list.map(p => {
    const memPct = Math.round((p.mem || 0) / _rmMaxMem * 100);
    const cpuStr = p.cpu != null ? p.cpu.toFixed(1) + '%' : '—';
    return `<tr>
      <td class="rm-proc-name" title="${p.cmd || p.name}">${p.name}</td>
      <td class="rm-proc-pid">${p.pid}</td>
      <td class="rm-proc-cpu">${cpuStr}</td>
      <td class="rm-proc-mem">${rmFmtBytes(p.mem)}</td>
      <td class="rm-proc-bar-wrap">
        <div class="rm-proc-bar"><div class="rm-proc-bar-fill" style="width:${memPct}%"></div></div>
      </td>
      <td class="rm-proc-user">${p.user || '—'}</td>
      <td><button class="rm-btn-sm" onclick="rmKillProc(${p.pid},'${p.name.replace(/'/g,'')}')">✕ Kill</button></td>
    </tr>`;
  }).join('');

  document.getElementById('rmProcContainer').innerHTML =
    `<table class="rm-proc-table">
      <thead><tr>
        <th class="${thCls('name')}" onclick="rmSetSort('name')">Nama ${arrow('name')}</th>
        <th class="${thCls('pid')}"  onclick="rmSetSort('pid')">PID ${arrow('pid')}</th>
        <th class="${thCls('cpu')}"  onclick="rmSetSort('cpu')">CPU ${arrow('cpu')}</th>
        <th class="${thCls('mem')}"  onclick="rmSetSort('mem')">Memori ${arrow('mem')}</th>
        <th></th>
        <th class="${thCls('user')}" onclick="rmSetSort('user')">User ${arrow('user')}</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function rmKillProc(pid, name) {
  const ok = await Swal.fire({
    title: 'Hentikan Proses?',
    html: `Yakin ingin menghentikan <b>${name}</b> (PID ${pid})?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Kill',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444',
    background: 'var(--color-medium-purple, #2d2446)',
    color: 'var(--color-text-light, #e0e0e0)',
  });
  if (!ok.isConfirmed) return;
  const r = await resourceMonitorApi.killProcess(pid);
  if (r.success) {
    _rmAllProcs = _rmAllProcs.filter(p => p.pid !== pid);
    rmRenderProcs();
  } else {
    Swal.fire({ title: 'Gagal', text: r.error, icon: 'error', background:'var(--color-medium-purple,#2d2446)',color:'var(--color-text-light,#e0e0e0)' });
  }
}

/* ── system cleaner ── */
let _rmCleaning = false;

async function rmCleanScan() {
  const body   = document.getElementById('rmCleanBody');
  const runBtn = document.getElementById('rmCleanRunBtn');
  if (!body || !runBtn) return;
  body.innerHTML = '<div class="rm-loading"><span class="rm-spinner">⟳</span> Menghitung ukuran cache &amp; file sampah...</div>';
  runBtn.disabled = true; runBtn.style.opacity = .5;
  try {
    const res  = await resourceMonitorApi.cleanScan();
    const cats = res?.categories || [];
    if (!res?.success) throw new Error(res?.error || 'Scan gagal');
    let total = 0;
    const rows = cats.map((c) => {
      total += c.bytes;
      const empty = c.bytes <= 0;
      return `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid rgba(128,128,128,.08);cursor:pointer;${empty ? 'opacity:.5' : ''}">
          <input type="checkbox" data-clean-id="${c.id}" ${c.defaultChecked && !empty ? 'checked' : ''} ${empty ? 'disabled' : ''} style="accent-color:var(--color-accent-purple)">
          <span style="flex:1;min-width:0">
            <span style="font-size:13px;font-weight:600;display:block;color:var(--color-text-light)">${c.label}</span>
            <span style="font-size:11px;color:var(--color-gray)">${c.desc} · ${c.files} file</span>
          </span>
          <span style="font-size:13px;font-weight:700;color:var(--color-warning,#fbbf24);white-space:nowrap">${rmFmtBytes(c.bytes)}</span>
        </label>`;
    }).join('');
    body.innerHTML = rows +
      `<div style="text-align:right;font-size:12px;color:var(--color-gray);padding-top:10px">Total dapat dibersihkan: <strong style="color:var(--color-text-light)">${rmFmtBytes(total)}</strong></div>`;
    if (total > 0) { runBtn.disabled = false; runBtn.style.opacity = 1; }
  } catch (err) {
    body.innerHTML = '<div style="font-size:12px;color:var(--color-danger,#ef4444)">Gagal scan: ' + (err?.message || err) + '</div>';
  }
}

async function rmCleanRun() {
  if (_rmCleaning) return;
  const ids = Array.from(
    document.querySelectorAll('#rmCleanBody input[data-clean-id]:checked')
  ).map((el) => el.getAttribute('data-clean-id'));
  if (!ids.length) return;

  const runBtn = document.getElementById('rmCleanRunBtn');
  _rmCleaning = true;
  runBtn.disabled = true;
  runBtn.innerHTML = '<span class="rm-spinner">⟳</span> Membersihkan...';
  try {
    const res = await resourceMonitorApi.cleanRun(ids);
    if (!res?.success) throw new Error(res?.error || 'Gagal membersihkan');
    const freed = (res.results || []).reduce((s, r) => s + (r.bytes || 0), 0);
    if (typeof showToast === 'function') {
      showToast('🧹 Selesai! ' + rmFmtBytes(freed) + ' berhasil dibersihkan.', 4000, 'success');
    }
    await rmCleanScan();
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('Gagal membersihkan: ' + (err?.message || err), 4000, 'error');
    }
  } finally {
    _rmCleaning = false;
    runBtn.innerHTML = '<i class="bi bi-trash3"></i> Bersihkan';
  }
}

/* ── polling ── */
async function rmRefreshAll() {
  await Promise.all([ rmRefresh(), rmLoadProcs() ]);
}

function rmStartPolling() {
  if (_rmActive) return;
  _rmActive = true;
  rmRefreshAll();
  _rmInterval = setInterval(rmRefresh, 3000);
}
function rmStopPolling() {
  _rmActive = false;
  if (_rmInterval) { clearInterval(_rmInterval); _rmInterval = null; }
}

// expose to window so renderer.js can call them
window.rmStartPolling  = rmStartPolling;
window.rmStopPolling   = rmStopPolling;
window.rmRefreshAll    = rmRefreshAll;
window.rmKillProc      = rmKillProc;
window.rmFilterProcs   = rmFilterProcs;
window.rmSortProcs     = rmSortProcs;
window.rmLoadProcs     = rmLoadProcs;
