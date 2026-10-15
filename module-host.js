// ═══════════════════════════════════════════════════════════════════════════════
// StarBox Module Host — sisi renderer
//
// 1. injectUi()   : dipanggil SEBELUM renderer.js. Menyisipkan sidebar, halaman,
//                   style dan terjemahan modul aktif, supaya Pro Mode & i18n
//                   langsung mengenalinya.
// 2. start()      : dipanggil di akhir <body>. Memuat script renderer modul dan
//                   menyiapkan halaman "Modul" (pasang / perbarui / hapus).
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  const PERMISSION_LABELS = {
    network: { icon: "bi-globe2", label: "Akses jaringan" },
    child_process: { icon: "bi-terminal", label: "Menjalankan program lain" },
    filesystem: { icon: "bi-folder2-open", label: "Akses file di luar folder modul" },
    dialog: { icon: "bi-window-stack", label: "Dialog simpan/buka file" },
    "system-install": { icon: "bi-box-seam", label: "Memasang software sistem" },
    "screen-capture": { icon: "bi-camera", label: "Menangkap / merekam layar" },
    "global-shortcut": { icon: "bi-keyboard", label: "Shortcut keyboard global" },
  };

  let rendererConfig = [];
  let restartPending = false;
  let highlightId = null;
  const progressById = new Map(); // id → { phase, pct, message }

  function api() {
    return window.electronAPI && window.electronAPI.modules;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function insertAfter(ref, node) {
    ref.parentNode.insertBefore(node, ref.nextSibling);
  }

  function compareVersions(a, b) {
    const pa = String(a || "0").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
    const pb = String(b || "0").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  function injectUi() {
    try {
      rendererConfig = (api() && api().getRendererConfigSync()) || [];
    } catch (err) {
      console.warn("⚠️ Gagal membaca konfigurasi modul:", err);
      rendererConfig = [];
    }

    const proPages = [];
    const pageLabels = {};

    // Urutan sidebar stabil apa pun kombinasi modul yang terpasang
    const ordered = [...rendererConfig].sort((a, b) => (a.sidebar?.order ?? 999) - (b.sidebar?.order ?? 999));
    const firstExisting = (cands, makeSel) =>
      [].concat(cands || []).map((c) => document.querySelector(makeSel(c))).find(Boolean) || null;

    // Bila tak satu pun anchor "after" ada, sisipkan setelah item modul
    // sebelumnya (urutan tetap) atau setelah Web Emulator.
    let lastModuleItem = null;
    for (const mod of ordered) {
      for (const [lang, dict] of Object.entries(mod.i18n || {})) {
        if (typeof window.registerTranslations === "function") window.registerTranslations(lang, dict);
      }

      for (const href of mod.styleDeps || []) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }

      if (mod.style) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = mod.style;
        document.head.appendChild(link);
      }

      const sb = mod.sidebar;
      if (sb && sb.page) {
        if (sb.pro) proPages.push(sb.page);

        const item = document.createElement("a");
        item.href = "#";
        item.className = "sidebar-item";
        item.dataset.page = sb.page;
        item.dataset.label = sb.label || mod.name;
        item.dataset.module = mod.id;
        item.dataset.order = String(sb.order ?? 999);
        if (sb.pro) item.dataset.pro = "true";
        item.setAttribute("onclick", `switchPage('${sb.page}')`);
        item.innerHTML = `<i class="bi ${esc(sb.icon || "bi-puzzle")}"></i>` +
          `<span${sb.labelKey ? ` data-i18n="${esc(sb.labelKey)}"` : ""}>${esc(sb.label || mod.name)}</span>`;

        let after = firstExisting(sb.after, (p) => `.sidebar-item[data-page="${p}"]`)
          || lastModuleItem
          || document.querySelector('.sidebar-item[data-page="web-emulator"]');
        // Lewati item modul ber-order lebih kecil yang sudah ada di belakang anchor
        while (after?.nextElementSibling?.dataset?.module &&
               Number(after.nextElementSibling.dataset.order) <= Number(sb.order ?? 999)) {
          after = after.nextElementSibling;
        }
        if (after) insertAfter(after, item);
        lastModuleItem = item;
      }

      if (mod.pageHtml) {
        const tpl = document.createElement("template");
        tpl.innerHTML = mod.pageHtml;
        const pageId = tpl.content.querySelector(".page-content")?.id?.replace(/^page-/, "");
        if (pageId && mod.pageLabel) pageLabels[pageId] = mod.pageLabel;
        const anchor = firstExisting(mod.pageAfter, (p) => `#page-${p}`);
        if (anchor) insertAfter(anchor, tpl.content);
        else document.querySelector(".main-wrapper")?.appendChild(tpl.content);
      }
    }

    window.STARBOX_MODULE_PRO_PAGES = proPages;
    window.STARBOX_MODULE_PAGE_LABELS = pageLabels;
  }

  function addScript(src, moduleId) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false; // jaga urutan: pustaka dulu, lalu script modul
    script.dataset.module = moduleId;
    script.onerror = () => console.error(`❌ Script modul ${moduleId} gagal dimuat: ${src}`);
    document.body.appendChild(script);
  }

  function loadScripts() {
    for (const mod of rendererConfig) {
      for (const dep of mod.rendererDeps || []) addScript(dep, mod.id);
      if (mod.script) addScript(mod.script, mod.id);
    }
  }

  // ── Halaman "Modul" ──────────────────────────────────────────────────────────

  function renderPermissionChips(perms) {
    if (!perms.length) return '<span class="mod-chip mod-chip-muted">Tidak butuh izin khusus</span>';
    return perms.map((p) => {
      const info = PERMISSION_LABELS[p] || { icon: "bi-question-circle", label: p };
      return `<span class="mod-chip" title="${esc(p)}"><i class="bi ${info.icon}"></i> ${esc(info.label)}</span>`;
    }).join("");
  }

  function statusBadge(mod) {
    if (progressById.get(mod.id)?.phase === "done") return '<span class="mod-status mod-status-wait">Aktif setelah restart</span>';
    if (mod.error) return `<span class="mod-status mod-status-error" title="${esc(mod.error)}">Error</span>`;
    if (!mod.installed) return '<span class="mod-status mod-status-off">Belum terpasang</span>';
    if (mod.loaded && !mod.enabled) return '<span class="mod-status mod-status-wait">Nonaktif setelah restart</span>';
    if (mod.loaded) return '<span class="mod-status mod-status-on">Aktif</span>';
    if (mod.enabled) return '<span class="mod-status mod-status-wait">Aktif setelah restart</span>';
    return '<span class="mod-status mod-status-off">Nonaktif</span>';
  }

  function renderActions(mod) {
    const id = esc(mod.id);
    const busy = progressById.get(mod.id);
    if (busy && !["done", "error"].includes(busy.phase)) {
      return `<div class="mod-progress"><div class="mod-progress-bar" style="width:${Math.max(3, busy.pct || 0)}%"></div></div>
        <div class="mod-progress-text">${esc(busy.message)}</div>`;
    }
    if (busy && busy.phase === "done") {
      return `<p class="mod-card-note"><i class="bi bi-check-circle"></i> ${esc(busy.message)}</p>`;
    }
    const buttons = [];
    if (!mod.installed && mod.catalog) {
      buttons.push(`<button class="mod-btn mod-btn-primary" onclick="StarBoxModuleHost.install('${id}')">
        <i class="bi bi-download"></i> Pasang${mod.catalog.size ? ` (${formatSize(mod.catalog.size)})` : ""}</button>`);
    }
    if (mod.installed && mod.updateAvailable) {
      buttons.push(`<button class="mod-btn mod-btn-primary" onclick="StarBoxModuleHost.install('${id}')">
        <i class="bi bi-arrow-up-circle"></i> Perbarui ke v${esc(mod.catalog.version)}</button>`);
    }
    if (mod.installed && mod.source === "installed") {
      buttons.push(`<button class="mod-btn" onclick="StarBoxModuleHost.uninstall('${id}')">
        <i class="bi bi-trash"></i> Hapus</button>`);
    }
    if (mod.installed) {
      buttons.push(`<button class="mod-btn${mod.enabled ? "" : " mod-btn-primary"}" onclick="StarBoxModuleHost.toggle('${id}', ${!mod.enabled})">
        <i class="bi ${mod.enabled ? "bi-pause-circle" : "bi-play-circle"}"></i> ${mod.enabled ? "Nonaktifkan" : "Aktifkan"}</button>`);
    }
    const note = busy && busy.phase === "error"
      ? `<p class="mod-card-error"><i class="bi bi-exclamation-triangle"></i> ${esc(busy.message)}</p>`
      : busy && busy.phase === "done" ? `<p class="mod-card-note"><i class="bi bi-check-circle"></i> ${esc(busy.message)}</p>` : "";
    return `${note}<div class="mod-card-actions">${buttons.join("")}</div>`;
  }

  function renderCard(mod) {
    const channels = [...(mod.ipc?.invoke || []), ...(mod.ipc?.events || [])];
    const source = !mod.installed ? "Katalog" : mod.source === "builtin" ? "Bawaan" : "Terpasang";
    const deps = mod.sharedDependencies || [];
    const services = mod.coreServices || [];
    const extra = [];
    if (deps.length) extra.push(`<div class="mod-card-section">Dependensi bersama</div><code>${deps.map(esc).join("<br>")}</code>`);
    if (services.length) extra.push(`<div class="mod-card-section">Layanan core</div><code>${services.map(esc).join("<br>")}</code>`);
    if ((mod.rendererDeps || []).length) extra.push(`<div class="mod-card-section">Pustaka CDN</div><code>${mod.rendererDeps.map(esc).join("<br>")}</code>`);

    return `
      <div class="mod-card${mod.installed && !mod.enabled ? " is-disabled" : ""}${highlightId === mod.id ? " is-highlight" : ""}" id="mod-card-${esc(mod.id)}">
        <div class="mod-card-head">
          <div class="mod-card-icon"><i class="bi ${esc(mod.icon)}"></i></div>
          <div class="mod-card-title">
            <strong>${esc(mod.name)}</strong>
            <span class="mod-card-meta">v${esc(mod.version)} · ${source}${mod.license ? ` · ${esc(mod.license)}` : ""}</span>
          </div>
          ${statusBadge(mod)}
        </div>
        <p class="mod-card-desc">${esc(mod.description)}</p>
        ${mod.error ? `<p class="mod-card-error"><i class="bi bi-exclamation-triangle"></i> ${esc(mod.error)}</p>` : ""}
        <div class="mod-card-section">Izin yang dipakai</div>
        <div class="mod-chips">${renderPermissionChips(mod.permissions || [])}</div>
        ${mod.installed ? `<details class="mod-card-details">
          <summary>${channels.length} channel IPC${deps.length ? ` · ${deps.length} dependensi bersama` : ""}</summary>
          <code>${channels.map(esc).join("<br>")}</code>
          ${extra.join("")}
        </details>` : ""}
        ${renderActions(mod)}
      </div>`;
  }

  /** Gabungkan modul terpasang dengan katalog. */
  function mergeModules(installed, catalog) {
    const byId = new Map();
    for (const m of installed) byId.set(m.id, { ...m, installed: true });
    for (const c of catalog) {
      const cur = byId.get(c.id);
      if (cur) {
        cur.catalog = c;
        cur.updateAvailable = compareVersions(c.version, cur.version) > 0;
      } else {
        byId.set(c.id, {
          id: c.id, name: c.name, version: c.version, description: c.description,
          icon: c.icon || "bi-puzzle", permissions: c.permissions || [],
          installed: false, enabled: false, loaded: false, catalog: c,
        });
      }
    }
    return [...byId.values()];
  }

  let catalogCache = null;
  let catalogError = null;
  let suggestedCache = [];

  function renderSuggestBanner() {
    const el = document.getElementById("modulesSuggestBanner");
    if (!el) return;
    const pending = suggestedCache.filter((s) => !progressById.has(s.id));
    if (!pending.length) {
      el.style.display = "none";
      return;
    }
    const nameOf = (id) => (catalogCache || []).find((m) => m.id === id)?.name || id;
    el.innerHTML = `<span><i class="bi bi-box-arrow-in-down"></i> Fitur yang sebelumnya kamu pakai sekarang berupa modul dan belum terpasang:
      <strong>${pending.map((s) => esc(nameOf(s.id))).join(", ")}</strong>. Data lamamu tetap aman.</span>
      <button class="mod-btn mod-btn-primary" onclick="StarBoxModuleHost.installSuggested()"><i class="bi bi-download"></i> Pasang semua</button>`;
    el.style.display = "flex";
  }

  async function installSuggested() {
    for (const s of suggestedCache.slice()) {
      if (progressById.get(s.id)?.phase === "done") continue;
      await install(s.id);
    }
    renderSuggestBanner();
  }

  async function renderModulesPage({ refreshCatalog = false } = {}) {
    const list = document.getElementById("modulesList");
    if (!list || !api()) return;
    try {
      const { modules = [] } = await api().list();
      if (!catalogCache || refreshCatalog) {
        const res = await api().catalog();
        catalogCache = res.modules || [];
        catalogError = res.success ? null : res.error;
      }
      try {
        suggestedCache = (await api().suggested?.())?.modules || [];
      } catch {
        suggestedCache = [];
      }
      renderSuggestBanner();
      const merged = mergeModules(modules, catalogCache);
      list.innerHTML = merged.length
        ? merged.map(renderCard).join("")
        : '<div class="mod-empty"><i class="bi bi-puzzle"></i><p>Belum ada modul.</p></div>';
      const note = document.getElementById("modulesCatalogNote");
      if (note) {
        note.style.display = catalogError ? "block" : "none";
        note.textContent = catalogError ? `Katalog modul tidak bisa dimuat: ${catalogError}` : "";
      }
      if (highlightId) document.getElementById(`mod-card-${highlightId}`)?.scrollIntoView({ block: "center" });
    } catch (err) {
      list.innerHTML = `<div class="mod-empty">Gagal memuat modul: ${esc(err.message)}</div>`;
    }
    const banner = document.getElementById("modulesRestartBanner");
    if (banner) banner.style.display = restartPending ? "flex" : "none";
  }

  async function toggle(id, enabled) {
    const res = await api().setEnabled(id, enabled);
    if (res && res.restartRequired) restartPending = true;
    renderModulesPage();
  }

  async function install(id) {
    progressById.set(id, { phase: "download", pct: 0, message: "Menyiapkan unduhan..." });
    renderModulesPage();
    const res = await api().install(id);
    if (res && res.success) {
      restartPending = true;
      progressById.set(id, { phase: "done", pct: 100, message: "Terpasang. Restart StarBox untuk mengaktifkan." });
    } else {
      progressById.set(id, { phase: "error", pct: 0, message: (res && res.error) || "Gagal memasang modul" });
    }
    renderModulesPage();
  }

  async function uninstall(id) {
    const res = await api().uninstall(id);
    if (res && res.success) restartPending = true;
    else progressById.set(id, { phase: "error", pct: 0, message: (res && res.error) || "Gagal menghapus modul" });
    renderModulesPage();
  }

  function relaunch() {
    api().relaunch();
  }

  /** Buka halaman milik modul; bila modul belum terpasang, arahkan ke halaman Modul. */
  function openPage(page, moduleId) {
    if (document.getElementById(`page-${page}`)) {
      window.switchPage(page);
      return;
    }
    highlightId = moduleId || null;
    window.switchPage("modules");
  }

  function hookModulesPage() {
    const orig = window.switchPage;
    if (typeof orig !== "function") return;
    window.switchPage = async function (page, ...args) {
      await orig(page, ...args);
      if (page === "modules") renderModulesPage({ refreshCatalog: true });
      else highlightId = null;
    };
  }

  /** Saat startup: beri tahu user lama bila fiturnya kini perlu dipasang sebagai modul. */
  async function notifySuggested() {
    try {
      const res = await api()?.suggested?.();
      const ids = (res?.modules || []).map((m) => m.id);
      if (!ids.length) return;
      const item = document.querySelector('.sidebar-item[data-page="modules"]');
      if (item && !item.querySelector(".mod-badge-dot")) {
        const dot = document.createElement("span");
        dot.className = "mod-badge-dot";
        item.appendChild(dot);
      }
      const key = "starbox-module-suggest-notified";
      let notified = "";
      try { notified = localStorage.getItem(key) || ""; } catch {}
      if (notified === ids.join(",")) return;
      try { localStorage.setItem(key, ids.join(",")); } catch {}
      if (typeof window.showToast === "function") {
        window.showToast("Beberapa fitur yang kamu pakai sekarang berupa modul — buka halaman Modul untuk memasangnya.", 7000, "info");
      }
    } catch {}
  }

  function start() {
    loadScripts();
    hookModulesPage();
    setTimeout(notifySuggested, 2500);
    api()?.onInstallProgress?.((p) => {
      if (!p || !p.id) return;
      progressById.set(p.id, p);
      const card = document.getElementById(`mod-card-${p.id}`);
      const text = card && card.querySelector(".mod-progress-text");
      const bar = card && card.querySelector(".mod-progress-bar");
      if (text && bar && !["done", "error"].includes(p.phase)) {
        text.textContent = p.message;
        bar.style.width = `${Math.max(3, p.pct || 0)}%`;
      }
    });
  }

  window.StarBoxModuleHost = {
    injectUi, start, toggle, install, uninstall, relaunch, openPage, installSuggested,
    refresh: () => renderModulesPage({ refreshCatalog: true }),
  };
})();
