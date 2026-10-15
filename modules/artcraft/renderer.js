// Modul ArtCraft Apps — sisi renderer. Dimuat oleh core (module-host.js).

const artcraftApi = (() => {
  const m = window.electronAPI.modules;
  return {
    list: (force) => m.invoke("artcraft:list", !!force),
    install: (id) => m.invoke("artcraft:install", id),
    open: (id) => m.invoke("artcraft:open", id),
    uninstall: (id) => m.invoke("artcraft:uninstall", id),
    openUrl: (url) => m.invoke("artcraft:open-url", url),
    onProgress: (cb) => m.on("artcraft:progress", cb),
  };
})();

(function () {
  "use strict";

  let data = null;
  const view = (() => {
    const def = { filter: "all", sort: "suite", q: "", mode: "grid" };
    try { return { ...def, ...JSON.parse(localStorage.getItem("starbox-artcraft-view") || "{}"), q: "" }; } catch { return def; }
  })();
  const saveView = () => { try { localStorage.setItem("starbox-artcraft-view", JSON.stringify({ ...view, q: "" })); } catch {} };
  const progress = new Map(); // id → { phase, pct, message }
  const errors = new Map();

  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return iso.slice(0, 10);
    }
  };
  const fmtSize = (b) => (b ? `${(b / 1048576).toFixed(0)} MB` : "");

  function badge(app) {
    if (app.updateAvailable) return '<span class="art-badge update">Update tersedia</span>';
    if (app.installed) return '<span class="art-badge ok">Terpasang · terbaru</span>';
    return app.installable ? '<span class="art-badge none">Siap dipasang</span>' : '<span class="art-badge none">Tidak tersedia</span>';
  }

  function actions(app) {
    const p = progress.get(app.id);
    if (p && !["done", "error"].includes(p.phase)) {
      return `<div style="flex:1"><div class="mod-progress"><div class="mod-progress-bar" style="width:${Math.max(3, p.pct || 0)}%"></div></div>
        <div class="mod-progress-text">${esc(p.message)}</div></div>`;
    }
    const id = esc(app.id);
    const b = [];
    if (!app.installed && app.installable) {
      b.push(`<button class="mod-btn mod-btn-primary" onclick="artcraftInstall('${id}')"><i class="bi bi-download"></i> Pasang${app.latest?.size ? ` (${fmtSize(app.latest.size)})` : ""}</button>`);
    }
    if (app.updateAvailable && app.installable) {
      b.push(`<button class="mod-btn mod-btn-primary" onclick="artcraftInstall('${id}')"><i class="bi bi-arrow-up-circle"></i> Perbarui ke ${esc(app.latest.version)}</button>`);
    }
    if (app.installed) {
      b.push(`<button class="mod-btn" onclick="artcraftOpen('${id}')"><i class="bi bi-box-arrow-up-right"></i> Buka</button>`);
      if (["starbox", "msi"].includes(app.installed.source)) b.push(`<button class="mod-btn" onclick="artcraftUninstall('${id}')" title="Hapus"><i class="bi bi-trash"></i></button>`);
    }
    if (!app.installable && !app.installed) b.push('<span class="art-summary">Belum ada build untuk OS ini</span>');
    return b.join("");
  }

  const numOf = (app) => String((data?.apps || []).indexOf(app) + 1).padStart(2, "0");
  const links = (app) => `<div class="art-links">
      ${app.websiteUrl ? `<button onclick="artcraftOpenUrl('${esc(app.websiteUrl)}')">Website ↗</button>` : ""}
      <button onclick="artcraftOpenUrl('${esc(app.repoUrl)}')">GitHub ↗</button></div>`;

  function card(app) {
    const err = errors.get(app.id);
    return `<div class="art-card" id="art-card-${esc(app.id)}" style="--art-color:${esc(app.color)}">
      <div class="art-card-top"><span class="art-num">${numOf(app)}</span>${links(app)}</div>
      <div class="art-card-head">
        <img class="art-icon" src="${esc(app.icon)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="art-title"><strong>${esc(app.name)}</strong><span>${esc(app.tagline)}</span></div>
        ${badge(app)}
      </div>
      ${app.details?.headline ? `<p class="art-headline">${esc(app.details.headline)}</p>` : ""}
      <dl class="art-meta">
        <dt>Terpasang</dt><dd>${app.installed ? esc(app.installed.version || "versi tidak diketahui") : "—"}</dd>
        <dt>Terbaru</dt><dd>${app.latest ? `${esc(app.latest.version)} · ${fmtDate(app.latest.publishedAt)}` : "—"}</dd>
      </dl>
      ${err ? `<p class="art-error"><i class="bi bi-exclamation-triangle"></i> ${esc(err)}</p>` : ""}
      <div class="art-actions">
        ${app.details ? `<button class="art-link" onclick="artcraftShowDetails('${esc(app.id)}')">Detail</button>` : ""}
        ${app.latest ? `<button class="art-link" onclick="artcraftShowNotes('${esc(app.id)}')">Catatan rilis</button>` : ""}
        ${actions(app)}
      </div>
    </div>`;
  }

  const statusRank = (a) => (a.updateAvailable ? 0 : a.installed ? 1 : 2);
  const FILTERS = {
    all: () => true,
    installed: (a) => !!a.installed,
    updates: (a) => a.updateAvailable,
    "not-installed": (a) => !a.installed,
  };

  function visibleApps() {
    const q = view.q.trim().toLowerCase();
    let apps = data.apps.filter(FILTERS[view.filter] || FILTERS.all)
      .filter((a) => !q || `${a.name} ${a.tagline} ${a.details?.headline || ""}`.toLowerCase().includes(q));
    const order = data.apps.slice();
    const sorters = {
      suite: (a, b) => order.indexOf(a) - order.indexOf(b),
      name: (a, b) => a.name.localeCompare(b.name),
      released: (a, b) => String(b.latest?.publishedAt || "").localeCompare(String(a.latest?.publishedAt || "")),
      status: (a, b) => statusRank(a) - statusRank(b) || order.indexOf(a) - order.indexOf(b),
    };
    return apps.sort(sorters[view.sort] || sorters.suite);
  }


  function table(apps) {
    return `<div class="art-table-wrap"><table class="art-table"><thead><tr>
      <th>#</th><th>Aplikasi</th><th>Status</th><th>Terpasang</th><th>Terbaru</th><th>Rilis</th><th></th></tr></thead><tbody>
      ${apps.map((a) => `<tr id="art-card-${esc(a.id)}" style="--art-color:${esc(a.color)}">
        <td><span class="art-num">${numOf(a)}</span></td>
        <td><img src="${esc(a.icon)}" alt="" onerror="this.style.visibility='hidden'"><strong>${esc(a.name)}</strong></td>
        <td>${badge(a)}</td>
        <td>${a.installed ? esc(a.installed.version || "?") : "—"}</td>
        <td>${a.latest ? esc(a.latest.version) : "—"}</td>
        <td>${a.latest ? fmtDate(a.latest.publishedAt) : "—"}</td>
        <td><div class="art-actions">${a.details ? `<button class="art-link" onclick="artcraftShowDetails('${esc(a.id)}')">Detail</button>` : ""}${actions(a)}</div></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function render() {
    const grid = document.getElementById("artGrid");
    if (!grid || !data) return;
    const apps = visibleApps();
    if (!apps.length) {
      grid.innerHTML = '<div class="art-empty">Tidak ada aplikasi yang cocok.</div>';
    } else if (view.mode === "table") {
      grid.innerHTML = table(apps);
    } else if (view.sort === "suite") {
      // Kelompok seperti launcher resmi: 01 / Classic apps, 02 / New apps
      const groups = [["classic", "Classic apps"], ["new", "New apps"]];
      grid.innerHTML = groups.map(([g, label], i) => {
        const list = apps.filter((a) => (a.group || "new") === g);
        return list.length ? `<div class="art-group-title"><span>0${i + 1} / ${label}</span><span>${list.length} apps</span></div>
          <div class="art-grid">${list.map(card).join("")}</div>` : "";
      }).join("");
    } else {
      grid.innerHTML = `<div class="art-grid">${apps.map(card).join("")}</div>`;
    }
    grid.classList.toggle("art-grid", false);
    // tab & kontrol
    for (const btn of document.querySelectorAll("#artTabs button")) {
      const f = btn.dataset.filter;
      btn.classList.toggle("active", f === view.filter);
      const n = btn.querySelector("span");
      if (n) n.textContent = data.apps.filter(FILTERS[f]).length;
    }
    for (const btn of document.querySelectorAll("#artView button")) btn.classList.toggle("active", btn.dataset.view === view.mode);
    const sortEl = document.getElementById("artSort");
    if (sortEl && sortEl.value !== view.sort) sortEl.value = view.sort;
    const st = document.getElementById("artStatus");
    if (st) {
      const ago = data.fetchedAt ? Math.max(0, Math.round((Date.now() - data.fetchedAt) / 60000)) : null;
      const os = { macos: "macOS", windows: "Windows", linux: "Linux" }[data.platform?.os] || data.platform?.os || "?";
      st.textContent = `Diperiksa ${ago === null ? "—" : ago === 0 ? "baru saja" : `${ago} menit lalu`} · ${data.feedError ? "via GitHub" : "via ArtCraft API"} · memasang untuk ${os}`;
    }
    const installed = data.apps.filter((a) => a.installed).length;
    const updates = data.apps.filter((a) => a.updateAvailable);
    const summary = document.getElementById("artSummary");
    if (summary) summary.textContent = `${installed} terpasang · ${updates.length} update tersedia`;
    const btn = document.getElementById("artUpdateAllBtn");
    if (btn) btn.style.display = updates.length > 1 ? "" : "none";
    const notices = document.getElementById("artNotices");
    if (notices) {
      const items = [...(data.notices?.alerts || []), ...(data.notices?.announcements || [])];
      const feedNote = data.feedError ? [`Feed ArtCraft tidak menjawab (${data.feedError}) — info diambil langsung dari GitHub.`] : [];
      notices.innerHTML = [...feedNote, ...items.map((n) => n.message || n.text || n.title || "")].filter(Boolean)
        .map((t) => `<div class="art-notice"><i class="bi bi-info-circle"></i> ${esc(t)}</div>`).join("");
    }
    updateSidebarBadge(updates.length);
  }

  function updateSidebarBadge(count) {
    const item = document.querySelector('.sidebar-item[data-page="artcraft"]');
    if (!item) return;
    let dot = item.querySelector(".mod-badge-dot");
    if (count && !dot) {
      dot = document.createElement("span");
      dot.className = "mod-badge-dot";
      item.appendChild(dot);
    } else if (!count && dot) dot.remove();
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  function modal(html, wide = false) {
    closeModal();
    const el = document.createElement("div");
    el.id = "artModal";
    el.className = "art-modal";
    el.innerHTML = `<div class="art-modal-box${wide ? " wide" : ""}" role="dialog">
      <button class="art-modal-close" onclick="artcraftCloseModal()" title="Tutup">&times;</button>${html}</div>`;
    el.addEventListener("click", (e) => { if (e.target === el) closeModal(); });
    document.body.appendChild(el);
  }
  function closeModal() {
    document.getElementById("artModal")?.remove();
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // Markdown sederhana & aman (teks di-escape dulu): judul, daftar, tebal, kode, tautan
  function markdown(md) {
    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, (m, label, url) => `<a href="#" onclick="artcraftOpenUrl('${url.replace(/'/g, "%27")}'); return false;">${label}</a>`)
      .replace(/(^|[\s(])(https:\/\/github\.com\/[^\s)<]+)/g, (m, pre, url) => `${pre}<a href="#" onclick="artcraftOpenUrl('${url.replace(/'/g, "%27")}'); return false;">${url.replace(/^https:\/\/github\.com\//, "")}</a>`)
      .replace(/(^|\s)@([A-Za-z0-9-]+)/g, "$1<strong>@$2</strong>");
    const out = [];
    let list = false;
    for (const raw of String(md || "").split(/\r?\n/)) {
      const line = raw.trimEnd();
      const li = line.match(/^\s*[*-]\s+(.*)$/);
      if (li) {
        if (!list) { out.push("<ul>"); list = true; }
        out.push(`<li>${inline(li[1])}</li>`);
        continue;
      }
      if (list) { out.push("</ul>"); list = false; }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) out.push(`<h${Math.min(6, h[1].length + 2)}>${inline(h[2])}</h${Math.min(6, h[1].length + 2)}>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push("</ul>");
    return out.join("");
  }

  function showNotes(id) {
    const app = data?.apps.find((a) => a.id === id);
    if (!app?.latest) return;
    const body = app.latest.notes
      ? `<div class="art-notes">${markdown(app.latest.notes)}</div>`
      : `<p class="art-summary">Catatan rilis tidak tersedia dari feed.</p>`;
    modal(`<div class="art-modal-head" style="--art-color:${esc(app.color)}">
        <img class="art-icon" src="${esc(app.icon)}" alt="" onerror="this.style.visibility='hidden'">
        <div><h3>${esc(app.name)} ${esc(app.latest.version)}</h3><span class="art-summary">Dirilis ${fmtDate(app.latest.publishedAt)}</span></div>
      </div>${body}
      <div class="art-modal-foot"><button class="mod-btn" onclick="artcraftOpenUrl('${esc(app.latest.url)}')"><i class="bi bi-github"></i> Buka di GitHub</button></div>`);
  }

  function showDetails(id) {
    const app = data?.apps.find((a) => a.id === id);
    const d = app?.details;
    if (!d) return;
    const shots = (d.shots || []).map((s, i) => `<figure class="art-shot${i ? "" : " lead"}">
        <img src="${esc(`${d.screenshotsBase}/${s.key}.jpg`)}" alt="${esc(s.caption)}" loading="lazy" onerror="this.closest('figure').remove()">
        <figcaption>${esc(s.caption)}</figcaption></figure>`).join("");
    modal(`<div class="art-modal-head" style="--art-color:${esc(app.color)}">
        <img class="art-icon" src="${esc(app.icon)}" alt="" onerror="this.style.visibility='hidden'">
        <div><h3>${esc(app.name)}</h3><span class="art-summary">${esc(d.headline)}</span></div>
        <div class="art-modal-actions" data-detail-id="${esc(app.id)}">${actions(app)}</div>
      </div>
      <div class="art-detail">
        <div class="art-detail-text">
          ${d.about.split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}
          <h4>Fitur</h4>
          <ul class="art-features">${(d.features || []).map((f) => `<li><strong>${esc(f.title)}</strong> — ${esc(f.text)}</li>`).join("")}</ul>
          <dl class="art-meta">
            <dt>Terpasang</dt><dd>${app.installed ? esc(app.installed.version || "versi tidak diketahui") : "—"}</dd>
            <dt>Terbaru</dt><dd>${app.latest ? `${esc(app.latest.version)} · ${fmtDate(app.latest.publishedAt)}` : "—"}</dd>
            <dt>Platform</dt><dd>${esc(d.platforms)}</dd>
          </dl>
          <p class="art-footnote">Teks & gambar dari ArtCraft Launcher. <a href="#" onclick="artcraftOpenUrl('${esc(app.repoUrl)}'); return false;">Kode sumber</a></p>
        </div>
        <div class="art-shots">${shots}</div>
      </div>`, true);
  }

  async function refresh(force = false) {
    const res = await artcraftApi.list(force);
    if (!res?.success) {
      const grid = document.getElementById("artGrid");
      if (grid) grid.innerHTML = `<div class="art-empty">Gagal memuat daftar aplikasi: ${esc(res?.error || "")}</div>`;
      return;
    }
    data = res;
    render();
    const open = document.querySelector("#artModal [data-detail-id]");
    if (open) showDetails(open.dataset.detailId);
  }

  async function install(id) {
    errors.delete(id);
    progress.set(id, { phase: "download", pct: 0, message: "Menyiapkan…" });
    render();
    const res = await artcraftApi.install(id);
    progress.delete(id);
    if (!res?.success) errors.set(id, res?.error || "Gagal memasang");
    else if (typeof window.showToast === "function") window.showToast(`${data?.apps.find((a) => a.id === id)?.name || id} ${res.version} terpasang`, 3000, "success");
    await refresh();
  }

  async function updateAll() {
    for (const app of (data?.apps || []).filter((a) => a.updateAvailable && a.installable)) await install(app.id);
  }

  async function open(id) {
    const res = await artcraftApi.open(id);
    if (!res?.success) {
      errors.set(id, res?.error || "Gagal membuka");
      render();
    }
  }

  async function uninstall(id) {
    const app = data?.apps.find((a) => a.id === id);
    if (typeof Swal !== "undefined") {
      const ok = await Swal.fire({ icon: "warning", title: `Hapus ${app?.name || id}?`, text: "Aplikasi dipindahkan ke Trash / dihapus dari folder StarBox.", showCancelButton: true, confirmButtonText: "Hapus", cancelButtonText: "Batal" });
      if (!ok.isConfirmed) return;
    }
    const res = await artcraftApi.uninstall(id);
    if (!res?.success) errors.set(id, res?.error || "Gagal menghapus");
    await refresh();
  }

  artcraftApi.onProgress((p) => {
    if (!p?.id || ["done", "error"].includes(p.phase)) return;
    progress.set(p.id, p);
    const el = document.querySelector(`#art-card-${p.id} .mod-progress-bar`);
    const txt = document.querySelector(`#art-card-${p.id} .mod-progress-text`);
    if (el && txt) {
      el.style.width = `${Math.max(3, p.pct || 0)}%`;
      txt.textContent = p.message;
    } else render();
  });

  document.addEventListener("click", (e) => {
    const tab = e.target.closest("#artTabs button");
    if (tab) { view.filter = tab.dataset.filter; saveView(); render(); }
    const vb = e.target.closest("#artView button");
    if (vb) { view.mode = vb.dataset.view; saveView(); render(); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "artSort") { view.sort = e.target.value; saveView(); render(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "artSearch") { view.q = e.target.value; render(); }
  });

  window.artcraftRefresh = refresh;
  window.artcraftInstall = install;
  window.artcraftUpdateAll = updateAll;
  window.artcraftOpen = open;
  window.artcraftUninstall = uninstall;
  window.artcraftOpenUrl = (url) => artcraftApi.openUrl(url);
  window.artcraftShowNotes = showNotes;
  window.artcraftShowDetails = showDetails;
  window.artcraftCloseModal = closeModal;

  // Muat saat halaman dibuka + cek update sekali di latar (untuk titik di sidebar)
  const orig = window.switchPage;
  if (typeof orig === "function") {
    window.switchPage = async function (page, ...args) {
      await orig(page, ...args);
      if (page === "artcraft") refresh(false);
    };
  }
  setTimeout(() => refresh(false).catch(() => {}), 4000);
})();
