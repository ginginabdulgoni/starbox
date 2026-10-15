// Modul Jadwal (Cron) — sisi renderer. Dimuat oleh core (module-host.js) setelah renderer.js.

const cronApi = (() => {
  const m = window.electronAPI.modules;
  return {
    loadJobs:      () => m.invoke("cron-load-jobs"),
    addJob:        (job) => m.invoke("cron-add-job", job),
    editJob:       (id, updates) => m.invoke("cron-edit-job", { id, updates }),
    deleteJob:     (id) => m.invoke("cron-delete-job", id),
    toggleJob:     (id, enabled) => m.invoke("cron-toggle-job", { id, enabled }),
    runNow:        (id) => m.invoke("cron-run-now", id),
    getHistory:    (id) => m.invoke("cron-get-history", id),
    clearHistory:  (id) => m.invoke("cron-clear-history", id),
    validateExpr:  (expr) => m.invoke("cron-validate-expr", expr),
    onJobExecuted: (cb) => m.on("cron-job-executed", cb),
  };
})();

// ════════════════════════════════════════════════════════════════
// CRON JOB MANAGER – UI Logic
// ════════════════════════════════════════════════════════════════

(function () {
  // ── State ─────────────────────────────────────────────────────
  let cronJobs = [];
  let editingCronId = null;
  let openHistoryId = null;

  // ── Schedule Visual Builder ───────────────────────────────────
  const CYCLES = ['every_minute','n_minutes','hourly','n_hours','daily','n_days','weekly','monthly'];
  const WEEKDAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];

  function t(key) { return window.t ? window.t(key) : key.split('.').pop(); }
  function pad2(n) { return String(n).padStart(2,'0'); }

  function buildCycleSelect() {
    const sel = document.getElementById('cronCycle');
    if (!sel) return;
    const cur = sel.value || 'daily';
    sel.innerHTML = CYCLES.map(c =>
      `<option value="${c}"${c===cur?' selected':''}>${t('cron.cycle.'+c)}</option>`
    ).join('');
  }

  window.cronBuilderChange = function () {
    buildCycleSelect();
    const cycle = document.getElementById('cronCycle')?.value || 'daily';
    const fields = document.getElementById('cronBuilderFields');
    if (!fields) return;

    // Preserve existing values before wiping fields
    const prevN    = document.getElementById('cronBuildN')?.value || '5';
    const prevMin  = document.getElementById('cronBuildMin')?.value || '0';
    const prevTime = document.getElementById('cronBuildTime')?.value || '01:30';
    const prevWd   = document.getElementById('cronBuildWeekday')?.value || '1';
    const prevDay  = document.getElementById('cronBuildDay')?.value || '1';

    const inputCls  = 'cron-builder-num';
    const timeCls   = 'cron-builder-time';
    const selCls    = 'cron-builder-sel';
    const lblCls    = 'cron-builder-lbl';

    let html = '';
    switch (cycle) {
      case 'every_minute':
        break;
      case 'n_minutes':
        html = `<input type="number" id="cronBuildN" class="${inputCls}" min="1" max="59" value="${prevN}" onchange="cronBuilderSync()">
                <span class="${lblCls}">${t('cron.builder.minutes')}</span>`;
        break;
      case 'hourly':
        html = `<span class="${lblCls}">${t('cron.builder.at_minute')}</span>
                <input type="number" id="cronBuildMin" class="${inputCls}" min="0" max="59" value="${prevMin}" onchange="cronBuilderSync()">`;
        break;
      case 'n_hours':
        html = `<input type="number" id="cronBuildN" class="${inputCls}" min="1" max="23" value="${prevN}" onchange="cronBuilderSync()">
                <span class="${lblCls}">${t('cron.builder.hours_at_min')}</span>
                <input type="number" id="cronBuildMin" class="${inputCls}" min="0" max="59" value="${prevMin}" onchange="cronBuilderSync()">`;
        break;
      case 'daily':
        html = `<span class="${lblCls}">${t('cron.builder.at')}</span>
                <input type="time" id="cronBuildTime" class="${timeCls}" value="${prevTime}" onchange="cronBuilderSync()">`;
        break;
      case 'n_days':
        html = `<input type="number" id="cronBuildN" class="${inputCls}" min="1" max="31" value="${prevN}" onchange="cronBuilderSync()">
                <span class="${lblCls}">${t('cron.builder.days_at')}</span>
                <input type="time" id="cronBuildTime" class="${timeCls}" value="${prevTime}" onchange="cronBuilderSync()">`;
        break;
      case 'weekly': {
        const opts = WEEKDAY_KEYS.map((k,i) =>
          `<option value="${i}"${i===parseInt(prevWd)?' selected':''}>${t('cron.day.'+k)}</option>`
        ).join('');
        html = `<span class="${lblCls}">${t('cron.builder.on')}</span>
                <select id="cronBuildWeekday" class="${selCls}" onchange="cronBuilderSync()">${opts}</select>
                <span class="${lblCls}">${t('cron.builder.at')}</span>
                <input type="time" id="cronBuildTime" class="${timeCls}" value="${prevTime}" onchange="cronBuilderSync()">`;
        break;
      }
      case 'monthly':
        html = `<span class="${lblCls}">${t('cron.builder.day')}</span>
                <input type="number" id="cronBuildDay" class="${inputCls}" min="1" max="31" value="${prevDay}" onchange="cronBuilderSync()">
                <span class="${lblCls}">${t('cron.builder.at')}</span>
                <input type="time" id="cronBuildTime" class="${timeCls}" value="${prevTime}" onchange="cronBuilderSync()">`;
        break;
    }
    fields.innerHTML = html;
    cronBuilderSync();
  };

  window.cronBuilderSync = function () {
    const cycle = document.getElementById('cronCycle')?.value || 'daily';
    const n       = parseInt(document.getElementById('cronBuildN')?.value) || 5;
    const min     = parseInt(document.getElementById('cronBuildMin')?.value) || 0;
    const time    = document.getElementById('cronBuildTime')?.value || '01:30';
    const [h, m]  = time.split(':').map(Number);
    const weekday = parseInt(document.getElementById('cronBuildWeekday')?.value) || 1;
    const dom     = parseInt(document.getElementById('cronBuildDay')?.value) || 1;

    // Build cron expression
    let expr = '*/5 * * * *';
    switch (cycle) {
      case 'every_minute': expr = '* * * * *';                   break;
      case 'n_minutes':    expr = `*/${Math.max(1,n)} * * * *`;  break;
      case 'hourly':       expr = `${min} * * * *`;               break;
      case 'n_hours':      expr = `${min} */${Math.max(1,n)} * * *`; break;
      case 'daily':        expr = `${m} ${h} * * *`;              break;
      case 'n_days':       expr = `${m} ${h} */${Math.max(1,n)} * *`; break;
      case 'weekly':       expr = `${m} ${h} * * ${weekday}`;    break;
      case 'monthly':      expr = `${m} ${h} ${dom} * *`;         break;
    }
    const schedEl = document.getElementById('cronJobSchedule');
    if (schedEl) schedEl.value = expr;

    // Build human-readable description
    const dayName = t('cron.day.' + WEEKDAY_KEYS[weekday]);
    const descMap = {
      every_minute: t('cron.desc.every_minute'),
      n_minutes:    t('cron.desc.n_minutes').replace('{n}', n),
      hourly:       t('cron.desc.hourly').replace('{min}', pad2(min)),
      n_hours:      t('cron.desc.n_hours').replace('{n}', n).replace('{min}', pad2(min)),
      daily:        t('cron.desc.daily').replace('{time}', time),
      n_days:       t('cron.desc.n_days').replace('{n}', n).replace('{time}', time),
      weekly:       t('cron.desc.weekly').replace('{day}', dayName).replace('{time}', time),
      monthly:      t('cron.desc.monthly').replace('{day}', dom).replace('{time}', time),
    };
    const descEl = document.getElementById('cronBuilderDesc');
    if (descEl) descEl.innerHTML = `<i class="bi bi-arrow-repeat"></i>${descMap[cycle] || expr}`;
  };

  // Parse raw cron expr → set builder state (for edit mode / advanced panel)
  window.cronParseRaw = function () {
    const expr = document.getElementById('cronJobSchedule')?.value?.trim() || '';
    const parts = expr.split(/\s+/);
    if (parts.length < 5) return;
    const [min, hour, dom, month, dow] = parts;

    let cycle = 'daily';
    if (min==='*' && hour==='*' && dom==='*' && month==='*' && dow==='*')               cycle='every_minute';
    else if (min.startsWith('*/') && hour==='*' && dom==='*' && month==='*' && dow==='*') cycle='n_minutes';
    else if (!min.includes('*') && !min.includes('/') && hour==='*' && dom==='*' && month==='*' && dow==='*') cycle='hourly';
    else if (!min.includes('*') && !min.includes('/') && hour.startsWith('*/') && dom==='*' && month==='*' && dow==='*') cycle='n_hours';
    else if (!min.includes('*') && !min.includes('/') && dom==='*' && month==='*' && dow!=='*' && !dow.includes('/')) cycle='weekly';
    else if (!min.includes('*') && !min.includes('/') && !dom.includes('*') && !dom.includes('/') && month==='*' && dow==='*') cycle='monthly';
    else if (dom.startsWith('*/') && month==='*' && dow==='*') cycle='n_days';
    else if (dom==='*' && month==='*' && dow==='*') cycle='daily';

    const cycleEl = document.getElementById('cronCycle');
    if (cycleEl) cycleEl.value = cycle;
    window.cronBuilderChange();

    setTimeout(() => {
      const pNum = s => parseInt(s.replace('*/','')) || 0;
      const mm = parseInt(min)||0, hh = parseInt(hour)||0;
      const timeFmt = `${pad2(hh)}:${pad2(mm)}`;
      if (cycle==='n_minutes' && document.getElementById('cronBuildN')) document.getElementById('cronBuildN').value = pNum(min);
      if (cycle==='hourly' && document.getElementById('cronBuildMin')) document.getElementById('cronBuildMin').value = mm;
      if (cycle==='n_hours') {
        if (document.getElementById('cronBuildN')) document.getElementById('cronBuildN').value = pNum(hour);
        if (document.getElementById('cronBuildMin')) document.getElementById('cronBuildMin').value = mm;
      }
      if (['daily','n_days','weekly','monthly'].includes(cycle) && document.getElementById('cronBuildTime'))
        document.getElementById('cronBuildTime').value = timeFmt;
      if (cycle==='n_days' && document.getElementById('cronBuildN')) document.getElementById('cronBuildN').value = pNum(dom);
      if (cycle==='weekly' && document.getElementById('cronBuildWeekday')) document.getElementById('cronBuildWeekday').value = parseInt(dow)||1;
      if (cycle==='monthly' && document.getElementById('cronBuildDay')) document.getElementById('cronBuildDay').value = parseInt(dom)||1;
      cronBuilderSync();
    }, 0);
  };

  window.cronToggleAdvanced = function () {
    const panel = document.getElementById('cronAdvancedPanel');
    const btn   = document.getElementById('cronAdvToggle');
    if (!panel) return;
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : '';
    if (btn) btn.classList.toggle('active', !showing);
  };

  // ── Helpers ───────────────────────────────────────────────────
  function fmtDate(iso) {
    if (!iso) return t('cron.never');
    return new Date(iso).toLocaleString();
  }

  function fmtDuration(ms) {
    if (ms == null) return '-';
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  // ── Load & Render ─────────────────────────────────────────────
  window.loadCronJobs = async function () {
    const list = document.getElementById('cronJobList');
    if (!list) return;
    list.innerHTML = `<div class="cron-empty"><i class="bi bi-hourglass-split"></i><h3>${window.t ? window.t('cron.loading') : 'Loading...'}</h3></div>`;
    try {
      cronJobs = await cronApi.loadJobs();
      renderCronJobs();
    } catch (e) {
      list.innerHTML = `<div class="cron-empty"><i class="bi bi-exclamation-circle"></i><h3>Error loading jobs</h3></div>`;
    }
  };

  function renderCronJobs() {
    const list = document.getElementById('cronJobList');
    if (!list) return;
    if (!cronJobs || cronJobs.length === 0) {
      list.innerHTML = `
        <div class="cron-empty">
          <i class="bi bi-clock-history"></i>
          <h3>${window.t ? window.t('cron.empty') : 'No scheduled jobs yet'}</h3>
          <p style="margin:4px 0 0;font-size:13px;color:#555">${window.t ? window.t('cron.empty_desc') : 'Click "Add Job" to create your first cron task.'}</p>
        </div>`;
      return;
    }
    list.innerHTML = cronJobs.map(renderCronJobCard).join('');
    // Re-open history panel if it was open
    if (openHistoryId) {
      const panel = document.querySelector(`[data-history-id="${openHistoryId}"]`);
      if (panel) panel.classList.add('open');
    }
  }

  function renderCronJobCard(job) {
    const statusClass = job.lastStatus === 'success' ? 'success' : job.lastStatus === 'failed' ? 'failed' : 'pending';
    const statusLabel = job.lastStatus
      ? (window.t ? window.t(`cron.${job.lastStatus}`) : job.lastStatus)
      : (window.t ? window.t('cron.never') : 'Never');
    const toggleClass = job.enabled ? 'on' : '';
    const cardClass = job.enabled ? '' : 'cron-disabled';
    const nextRun = job.nextRun ? fmtDate(job.nextRun) : '-';
    const lastRun = fmtDate(job.lastRun);

    return `
    <div class="cron-job-card ${cardClass}" id="cron-card-${job.id}">
      <div class="cron-card-header" onclick="cronToggleHistory('${job.id}')">
        <button class="cron-toggle ${toggleClass}" title="${job.enabled ? (window.t ? window.t('cron.enabled') : 'Active') : (window.t ? window.t('cron.disabled') : 'Paused')}"
          onclick="event.stopPropagation();cronToggleJobEnabled('${job.id}',${!job.enabled})"></button>
        <span class="cron-card-name">${escapeHtml(job.name)}</span>
        <span class="cron-card-schedule">${escapeHtml(job.schedule)}</span>
        <span class="cron-card-status ${statusClass}">${statusLabel}</span>
        <div class="cron-card-actions" onclick="event.stopPropagation()">
          <button class="cron-act-btn" onclick="cronRunNow('${job.id}')" title="${window.t ? window.t('cron.run_now') : 'Run Now'}">
            <i class="bi bi-play-fill"></i>
          </button>
          <button class="cron-act-btn" onclick="openEditCronModal('${job.id}')" title="${window.t ? window.t('cron.edit') : 'Edit'}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="cron-act-btn danger" onclick="cronDeleteJob('${job.id}')" title="${window.t ? window.t('cron.delete') : 'Delete'}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <i class="bi bi-chevron-down" style="color:#555;font-size:12px;margin-left:4px"></i>
      </div>
      <div class="cron-card-meta">
        <div class="cron-meta-item">${window.t ? window.t('cron.last_run') : 'Last run'}: <span>${lastRun}</span></div>
        <div class="cron-meta-item">${window.t ? window.t('cron.next_run') : 'Next run'}: <span>${nextRun}</span></div>
        <div class="cron-meta-item">HTTP: <span>${escapeHtml(job.method || 'GET')}</span></div>
      </div>
      <div class="cron-card-url">
        <a href="#" onclick="return false;" title="${escapeHtml(job.url)}">${escapeHtml(job.url)}</a>
      </div>
      <!-- History Panel -->
      <div class="cron-history-panel ${openHistoryId === job.id ? 'open' : ''}" data-history-id="${job.id}">
        <div class="cron-history-header">
          <h4><i class="bi bi-list-ul" style="margin-right:5px"></i>${window.t ? window.t('cron.history.title') : 'Execution History'}</h4>
          <button class="cron-act-btn" onclick="cronClearHistory('${job.id}')" style="font-size:11px">${window.t ? window.t('cron.clear_history') : 'Clear History'}</button>
        </div>
        <div id="cron-history-${job.id}">${renderCronHistory(job.history)}</div>
      </div>
    </div>`;
  }

  function renderCronHistory(history) {
    if (!history || !history.length) {
      return `<p style="padding:12px 16px;color:#555;font-size:12px;margin:0">${window.t ? window.t('cron.history.empty') : 'No execution history yet.'}</p>`;
    }
    return `<table class="cron-history-table">
      <thead><tr>
        <th>${window.t ? window.t('cron.history.run_at') : 'Run At'}</th>
        <th>${window.t ? window.t('cron.history.status') : 'Status'}</th>
        <th>${window.t ? window.t('cron.history.http') : 'HTTP'}</th>
        <th>${window.t ? window.t('cron.history.duration') : 'Duration'}</th>
        <th>${window.t ? window.t('cron.history.response') : 'Response'}</th>
      </tr></thead>
      <tbody>${history.slice(0, 50).map(e => `
        <tr>
          <td style="white-space:nowrap">${fmtDate(e.runAt)}${e.manual ? ` <span style="font-size:10px;color:#888">(${window.t ? window.t('cron.history.manual') : 'Manual'})</span>` : ''}</td>
          <td><span class="cron-status-dot ${e.status}"></span>${e.status}</td>
          <td style="font-family:monospace">${e.httpStatus || '-'}</td>
          <td>${fmtDuration(e.duration)}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(e.response || e.error || '')}">${escapeHtml((e.response || e.error || '-').substring(0, 80))}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Toggle History Panel ──────────────────────────────────────
  window.cronToggleHistory = function (id) {
    const panel = document.querySelector(`[data-history-id="${id}"]`);
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    // Close all
    document.querySelectorAll('.cron-history-panel.open').forEach(p => p.classList.remove('open'));
    openHistoryId = null;
    if (!isOpen) {
      panel.classList.add('open');
      openHistoryId = id;
    }
  };

  // ── Toggle Enable/Disable ─────────────────────────────────────
  window.cronToggleJobEnabled = async function (id, enabled) {
    try {
      await cronApi.toggleJob(id, enabled);
      const job = cronJobs.find(j => j.id === id);
      if (job) job.enabled = enabled;
      const card = document.getElementById(`cron-card-${id}`);
      if (card) {
        card.classList.toggle('cron-disabled', !enabled);
        const toggle = card.querySelector('.cron-toggle');
        if (toggle) {
          toggle.classList.toggle('on', enabled);
          toggle.title = enabled ? (window.t ? window.t('cron.enabled') : 'Active') : (window.t ? window.t('cron.disabled') : 'Paused');
        }
      }
    } catch (e) {
      console.error('cronToggleJobEnabled error', e);
    }
  };

  // ── Run Now ───────────────────────────────────────────────────
  window.cronRunNow = async function (id) {
    try {
      const result = await cronApi.runNow(id);
      if (result.ok) {
        const job = cronJobs.find(j => j.id === id);
        if (job) {
          job.lastRun = result.entry.runAt;
          job.lastStatus = result.entry.status;
          if (!job.history) job.history = [];
          job.history.unshift(result.entry);
        }
        renderCronJobs();
        const st = result.entry.status;
        const key = st === 'success' ? 'toast.cron.run_success' : 'toast.cron.run_failed';
        if (typeof showToast === 'function') showToast(window.t ? window.t(key) : st, st === 'success' ? 'success' : 'warning');
      } else {
        if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.run_error') : 'Error running job', 'error');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.run_error') : 'Error running job', 'error');
    }
  };

  // ── Delete Job ────────────────────────────────────────────────
  window.cronDeleteJob = async function (id) {
    const job = cronJobs.find(j => j.id === id);
    const confirmed = await Swal.fire({
      title: window.t ? window.t('dialog.delete_cron.title') : 'Delete this job?',
      text: window.t ? window.t('dialog.delete_cron.text') : 'Execution history will also be deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: window.t ? window.t('dialog.delete_cron.confirm') : 'Yes, Delete',
      cancelButtonText: window.t ? window.t('dialog.delete_cron.cancel') : 'Cancel',
      background: '#161b22',
      color: '#e0e0e0',
    });
    if (!confirmed.isConfirmed) return;
    try {
      const result = await cronApi.deleteJob(id);
      if (result.ok) {
        cronJobs = cronJobs.filter(j => j.id !== id);
        renderCronJobs();
        if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.deleted') : 'Job deleted.', 'success');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.delete_error') : 'Failed to delete job.', 'error');
    }
  };

  // ── Clear History ─────────────────────────────────────────────
  window.cronClearHistory = async function (id) {
    try {
      await cronApi.clearHistory(id);
      const job = cronJobs.find(j => j.id === id);
      if (job) job.history = [];
      const histEl = document.getElementById(`cron-history-${id}`);
      if (histEl) histEl.innerHTML = renderCronHistory([]);
      if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.history_cleared') : 'History cleared.', 'success');
    } catch (e) {}
  };

  // ── Modal ─────────────────────────────────────────────────────
  function openCronModalCommon() {
    // Reset advanced panel
    const advPanel = document.getElementById('cronAdvancedPanel');
    const advBtn   = document.getElementById('cronAdvToggle');
    if (advPanel) advPanel.style.display = 'none';
    if (advBtn)   advBtn.classList.remove('active');
    cronToggleBody();
    // Build cycle select then trigger builder
    buildCycleSelect();
    window.cronBuilderChange();
    document.getElementById('cronModal').classList.add('open');
    if (typeof window.applyI18n === 'function') window.applyI18n();
  }

  window.openCronModal = function () {
    editingCronId = null;
    document.getElementById('cronJobId').value = '';
    document.getElementById('cronJobName').value = '';
    document.getElementById('cronJobUrl').value = '';
    document.getElementById('cronJobMethod').value = 'GET';
    document.getElementById('cronJobBody').value = '';
    document.getElementById('cronJobEnabled').checked = true;
    const titleEl = document.getElementById('cronModalTitle');
    if (titleEl) titleEl.textContent = t('cron.modal.add');
    // Default cycle: daily 01:30
    const cycleEl = document.getElementById('cronCycle');
    if (cycleEl) cycleEl.value = 'daily';
    openCronModalCommon();
  };

  window.openEditCronModal = function (id) {
    const job = cronJobs.find(j => j.id === id);
    if (!job) return;
    editingCronId = id;
    document.getElementById('cronJobId').value = job.id;
    document.getElementById('cronJobName').value = job.name || '';
    document.getElementById('cronJobUrl').value = job.url || '';
    document.getElementById('cronJobMethod').value = job.method || 'GET';
    document.getElementById('cronJobBody').value = typeof job.body === 'object' ? JSON.stringify(job.body) : (job.body || '');
    document.getElementById('cronJobEnabled').checked = job.enabled !== false;
    const titleEl = document.getElementById('cronModalTitle');
    if (titleEl) titleEl.textContent = t('cron.modal.edit');
    // Parse existing schedule into builder
    const schedEl = document.getElementById('cronJobSchedule');
    if (schedEl) schedEl.value = job.schedule || '*/5 * * * *';
    window.cronParseRaw();
    document.getElementById('cronModal').classList.add('open');
    if (typeof window.applyI18n === 'function') window.applyI18n();
  };

  window.closeCronModal = function () {
    document.getElementById('cronModal').classList.remove('open');
  };

  window.cronToggleBody = function () {
    const method = document.getElementById('cronJobMethod')?.value || 'GET';
    const bodyField = document.getElementById('cronBodyField');
    if (bodyField) bodyField.style.display = ['POST','PUT','PATCH'].includes(method) ? '' : 'none';
  };

  window.submitCronJob = async function () {
    const name = document.getElementById('cronJobName')?.value?.trim();
    // Always sync builder → hidden field before reading
    cronBuilderSync();
    const schedule = document.getElementById('cronJobSchedule')?.value?.trim();
    const url = document.getElementById('cronJobUrl')?.value?.trim();
    const method = document.getElementById('cronJobMethod')?.value || 'GET';
    const body = document.getElementById('cronJobBody')?.value?.trim() || '';
    const enabled = document.getElementById('cronJobEnabled')?.checked !== false;

    if (!url) {
      if (typeof showToast === 'function') showToast('URL is required', 'warning');
      return;
    }

    const payload = { name: name || 'Untitled', schedule: schedule || '*/5 * * * *', url, method, body, enabled };

    try {
      if (editingCronId) {
        const result = await cronApi.editJob(editingCronId, payload);
        if (result.ok) {
          const idx = cronJobs.findIndex(j => j.id === editingCronId);
          if (idx !== -1) cronJobs[idx] = result.job;
          if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.saved') : 'Job saved.', 'success');
        }
      } else {
        const newJob = await cronApi.addJob(payload);
        cronJobs.push(newJob);
        if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.saved') : 'Job saved.', 'success');
      }
      closeCronModal();
      renderCronJobs();
    } catch (e) {
      if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.save_error') : 'Failed to save job.', 'error');
    }
  };

  // ── Live update from main process ─────────────────────────────
  if (cronApi.onJobExecuted) {
    cronApi.onJobExecuted(({ jobId, entry }) => {
      const job = cronJobs.find(j => j.id === jobId);
      if (job) {
        job.lastRun = entry.runAt;
        job.lastStatus = entry.status;
        if (!job.history) job.history = [];
        job.history.unshift(entry);
        // Update card in place if cron page is visible
        const activePage = window.currentActivePage || '';
        if (activePage === 'cron') renderCronJobs();
      }
    });
  }
})();
