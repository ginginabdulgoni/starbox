const DEFAULT_ICON_ASSET = "starbox.png";
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

const DEFAULT_SERVICE_LIBRARY = [
  {
    id: "wa",
    label: "WhatsApp",
    color: "#25D366",
    url: "https://web.whatsapp.com",
    category: "Komunikasi",
    description: "Chat personal & bisnis paling populer.",
    keywords: ["whatsapp", "wa", "chat"],
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "#0088cc",
    url: "https://web.telegram.org/k/",
    category: "Komunikasi",
    description: "Pesan instan multi-device dengan bot.",
    keywords: ["telegram", "chat", "bot"],
  },
  {
    id: "gmail",
    label: "Gmail",
    color: "#EA4335",
    url: "https://mail.google.com",
    category: "Produktivitas",
    description: "Email Google Workspace.",
    keywords: ["email", "google"],
  },
  {
    id: "google_drive",
    label: "Google Drive",
    color: "#0f9d58",
    url: "https://drive.google.com",
    category: "Produktivitas",
    description: "File storage & kolaborasi Google.",
    keywords: ["drive", "storage", "workspace"],
  },
  {
    id: "google_docs",
    label: "Google Docs",
    color: "#1a73e8",
    url: "https://docs.google.com/document/u/0/",
    category: "Produktivitas",
    description: "Editor dokumen berbasis cloud.",
    keywords: ["docs", "document", "google"],
  },
  {
    id: "google_sheets",
    label: "Google Sheets",
    color: "#0f9d58",
    url: "https://docs.google.com/spreadsheets/u/0/",
    category: "Produktivitas",
    description: "Spreadsheet kolaboratif Google.",
    keywords: ["sheets", "spreadsheet", "google"],
  },
  {
    id: "google_slides",
    label: "Google Slides",
    color: "#fbbc04",
    url: "https://docs.google.com/presentation/u/0/",
    category: "Presentasi",
    description: "Presentasi online dengan template siap pakai.",
    keywords: ["slides", "presentasi", "google"],
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    color: "#1a73e8",
    url: "https://calendar.google.com",
    category: "Produktivitas",
    description: "Kalender online dan manajemen jadwal Google.",
    keywords: ["calendar", "jadwal", "google"],
  },
  {
    id: "google_meet",
    label: "Google Meet",
    color: "#0c9d58",
    url: "https://meet.google.com",
    category: "Komunikasi",
    description: "Rapat video Google Workspace.",
    keywords: ["google", "meet", "video"],
  },
  {
    id: "office_word",
    label: "Microsoft Word",
    color: "#185abd",
    url: "https://www.office.com/launch/word",
    category: "Produktivitas",
    description: "Microsoft Word Online.",
    keywords: ["word", "office"],
  },
  {
    id: "office_excel",
    label: "Microsoft Excel",
    color: "#107c41",
    url: "https://www.office.com/launch/excel",
    category: "Produktivitas",
    description: "Microsoft Excel Online.",
    keywords: ["excel", "office", "spreadsheet"],
  },
  {
    id: "office_powerpoint",
    label: "Microsoft PowerPoint",
    color: "#b7472a",
    url: "https://www.office.com/launch/powerpoint",
    category: "Presentasi",
    description: "Microsoft PowerPoint Online.",
    keywords: ["powerpoint", "office", "presentasi"],
  },
  {
    id: "youtube",
    label: "YouTube",
    color: "#ff0000",
    url: "https://www.youtube.com",
    category: "Video",
    description: "Platform video terbesar untuk konten dan live.",
    keywords: ["youtube", "video", "stream"],
  },
  {
    id: "youtube_studio",
    label: "YouTube Studio",
    color: "#ff0000",
    url: "https://studio.youtube.com",
    category: "Video",
    description: "Dashboard kreator YouTube.",
    keywords: ["youtube", "studio", "creator"],
  },
  {
    id: "canva",
    label: "Canva",
    color: "#00c4cc",
    url: "https://www.canva.com",
    category: "Desain",
    description: "Desain grafis dan konten sosial instan.",
    keywords: ["canva", "design"],
  },
  {
    id: "fotor",
    label: "Fotor",
    color: "#fcbf1e",
    url: "https://www.fotor.com",
    category: "Desain",
    description: "Editor foto dan kolase online serba cepat.",
    keywords: ["fotor", "photo", "design"],
  },
  {
    id: "pixlr",
    label: "Pixlr",
    color: "#05a081",
    url: "https://pixlr.com",
    category: "Desain",
    description: "Editor foto ringan berbasis browser.",
    keywords: ["pixlr", "photo", "design"],
  },
  {
    id: "removebg",
    label: "Remove.bg",
    color: "#2d68ff",
    url: "https://www.remove.bg",
    category: "Desain",
    description: "Hapus background foto otomatis.",
    keywords: ["removebg", "background", "design"],
  },
  {
    id: "photopea",
    label: "Photopea",
    color: "#0a8d74",
    url: "https://www.photopea.com",
    category: "Desain",
    description: "Editor foto dengan fitur ala Photoshop.",
    keywords: ["photopea", "photo", "design"],
  },
  {
    id: "capcut",
    label: "CapCut Web",
    color: "#000000",
    url: "https://www.capcut.com",
    category: "Video",
    description: "Editor video CapCut versi web.",
    keywords: ["capcut", "video", "editor"],
  },
  {
    id: "adobe_express",
    label: "Adobe Express",
    color: "#ff5c57",
    url: "https://www.adobe.com/express",
    category: "Desain",
    description: "Template desain cepat ala Adobe.",
    keywords: ["adobe", "express", "design"],
  },
  {
    id: "figma",
    label: "Figma",
    color: "#0acf83",
    url: "https://www.figma.com",
    category: "Desain",
    description: "Kolaborasi UI/UX berbasis cloud.",
    keywords: ["figma", "ui", "ux", "design"],
  },
  {
    id: "notion",
    label: "Notion",
    color: "#ffffff",
    url: "https://www.notion.so",
    category: "Produktivitas",
    description: "Dokumentasi & manajemen kerja fleksibel.",
    keywords: ["notion", "docs", "wiki"],
  },
  {
    id: "dropbox_paper",
    label: "Dropbox Paper",
    color: "#0061ff",
    url: "https://paper.dropbox.com",
    category: "Produktivitas",
    description: "Dokumen kolaborasi ringan ala Dropbox.",
    keywords: ["dropbox", "paper"],
  },
  {
    id: "dropbox",
    label: "Dropbox",
    color: "#0061ff",
    url: "https://www.dropbox.com",
    category: "Produktivitas",
    description: "Sinkronisasi file dan backup Dropbox.",
    keywords: ["dropbox", "storage"],
  },
  {
    id: "zoho_writer",
    label: "Zoho Writer",
    color: "#d32f2f",
    url: "https://writer.zoho.com",
    category: "Produktivitas",
    description: "Editor dokumen dari Zoho.",
    keywords: ["zoho", "writer"],
  },
  {
    id: "zoho_sheet",
    label: "Zoho Sheet",
    color: "#1da462",
    url: "https://sheet.zoho.com",
    category: "Produktivitas",
    description: "Spreadsheet Zoho.",
    keywords: ["zoho", "sheet", "spreadsheet"],
  },
  {
    id: "obsidian",
    label: "Obsidian Publish",
    color: "#7c3aed",
    url: "https://publish.obsidian.md",
    category: "Catatan",
    description: "Notasi Markdown canggih Obsidian.",
    keywords: ["obsidian", "markdown"],
  },
  {
    id: "evernote",
    label: "Evernote",
    color: "#2dbe60",
    url: "https://www.evernote.com/Login.action",
    category: "Catatan",
    description: "Notebook digital klasik.",
    keywords: ["evernote", "note"],
  },
  {
    id: "miro",
    label: "Miro",
    color: "#ffd02f",
    url: "https://miro.com/app/dashboard",
    category: "Kolaborasi",
    description: "Whiteboard kolaboratif untuk tim.",
    keywords: ["miro", "whiteboard"],
  },
  {
    id: "slack",
    label: "Slack",
    color: "#611f69",
    url: "https://app.slack.com",
    category: "Komunikasi",
    description: "Kolaborasi tim dan integrasi automasi.",
    keywords: ["slack", "chat", "kolaborasi"],
  },
  {
    id: "discord",
    label: "Discord",
    color: "#5865f2",
    url: "https://discord.com/app",
    category: "Komunitas",
    description: "Komunitas dan layanan pelanggan real-time.",
    keywords: ["discord", "komunitas"],
  },
  {
    id: "messenger",
    label: "Messenger",
    color: "#00b2ff",
    url: "https://www.messenger.com",
    category: "Komunikasi",
    description: "Chat Facebook Messenger versi web.",
    keywords: ["messenger", "facebook"],
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "#F77737",
    url: "https://www.instagram.com",
    category: "Media Sosial",
    description: "Kelola feed, DM, dan reels langsung dari desktop.",
    keywords: ["instagram", "ig"],
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877f2",
    url: "https://www.facebook.com",
    category: "Media Sosial",
    description: "Akses beranda & grup Facebook.",
    keywords: ["facebook", "fb"],
  },
  {
    id: "facebook_pages",
    label: "Facebook Pages",
    color: "#1877f2",
    url: "https://business.facebook.com/latest/home",
    category: "Media Sosial",
    description: "Kelola halaman & iklan Meta.",
    keywords: ["facebook", "pages", "meta"],
  },
  {
    id: "twitter_x",
    label: "Twitter / X",
    color: "#000000",
    url: "https://x.com",
    category: "Media Sosial",
    description: "Posting & monitoring timeline X (Twitter).",
    keywords: ["twitter", "x"],
  },
  {
    id: "threads",
    label: "Threads",
    color: "#000000",
    url: "https://www.threads.net",
    category: "Media Sosial",
    description: "Platform microblogging Meta.",
    keywords: ["threads", "meta"],
  },
  {
    id: "pinterest",
    label: "Pinterest",
    color: "#e60023",
    url: "https://www.pinterest.com",
    category: "Media Sosial",
    description: "Inspirasi visual & ide konten.",
    keywords: ["pinterest", "board"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0a66c2",
    url: "https://www.linkedin.com",
    category: "Media Sosial",
    description: "Jejaring profesional & konten bisnis.",
    keywords: ["linkedin", "professional"],
  },
  {
    id: "snapchat",
    label: "Snapchat",
    color: "#fffc00",
    url: "https://web.snapchat.com",
    category: "Media Sosial",
    description: "Chat & story Snapchat versi web.",
    keywords: ["snapchat"],
  },
  {
    id: "reddit",
    label: "Reddit",
    color: "#ff4500",
    url: "https://www.reddit.com",
    category: "Komunitas",
    description: "Forum komunitas global.",
    keywords: ["reddit", "forum"],
  },
  {
    id: "line",
    label: "LINE",
    color: "#00c300",
    url: "https://web.line.me",
    category: "Komunikasi",
    description: "Chat dan komunitas LINE di desktop.",
    keywords: ["line", "chat"],
  },
  {
    id: "zoom",
    label: "Zoom",
    color: "#2d8cff",
    url: "https://app.zoom.us",
    category: "Komunikasi",
    description: "Meeting video dan webinar.",
    keywords: ["zoom", "meeting", "video"],
  },
  {
    id: "aircall",
    label: "Aircall",
    color: "#00c58c",
    url: "https://dashboard.aircall.io",
    category: "Komunikasi",
    description: "Call center modern berbasis cloud.",
    keywords: ["aircall", "callcenter"],
  },
  {
    id: "uptimerobot",
    label: "UptimeRobot",
    color: "#22c55e",
    url: "https://uptimerobot.com",
    category: "Monitoring",
    description: "Pantau uptime website dan API.",
    keywords: ["uptimerobot", "monitoring", "uptime"],
  },
  {
    id: "patch",
    label: "Patch",
    color: "#1b998b",
    url: "https://patch.com",
    category: "Media",
    description: "Portal berita lokal Patch.",
    keywords: ["patch", "news"],
  },
  {
    id: "asana",
    label: "Asana",
    color: "#fc636b",
    url: "https://app.asana.com",
    category: "Produktivitas",
    description: "Manajemen tugas & tim kreatif.",
    keywords: ["asana", "task", "project"],
  },
  {
    id: "trello",
    label: "Trello",
    color: "#0079bf",
    url: "https://trello.com",
    category: "Produktivitas",
    description: "Board kanban sederhana untuk semua tim.",
    keywords: ["trello", "kanban"],
  },
  {
    id: "microsoft_teams",
    label: "Microsoft Teams",
    color: "#6264a7",
    url: "https://teams.microsoft.com",
    category: "Produktivitas",
    description: "Kolaborasi Microsoft 365.",
    keywords: ["teams", "microsoft"],
  },
  {
    id: "aha",
    label: "Aha!",
    color: "#8a2be2",
    url: "https://www.aha.io",
    category: "Produk & Roadmap",
    description: "Perencanaan roadmap produk.",
    keywords: ["aha", "roadmap"],
  },
  {
    id: "ahrefs",
    label: "Ahrefs",
    color: "#0c63ff",
    url: "https://ahrefs.com",
    category: "Pemasaran",
    description: "Riset SEO dan analisis kompetitor.",
    keywords: ["seo", "ahrefs"],
  },
  {
    id: "agorapulse",
    label: "Agorapulse",
    color: "#f15427",
    url: "https://app.agorapulse.com",
    category: "Pemasaran",
    description: "Manajemen media sosial dan inbox.",
    keywords: ["social", "agorapulse"],
  },
  {
    id: "activecampaign",
    label: "ActiveCampaign",
    color: "#1b6de0",
    url: "https://www.activecampaign.com/login",
    category: "CRM & Automasi",
    description: "Email marketing & automasi CRM.",
    keywords: ["crm", "email"],
  },
  {
    id: "adobe_analytics",
    label: "Adobe Analytics",
    color: "#5c2d91",
    url: "https://experiencecloud.adobe.com",
    category: "Analitik",
    description: "Analitik enterprise Adobe.",
    keywords: ["adobe", "analytics"],
  },
  {
    id: "airtable",
    label: "Airtable",
    color: "#ffb347",
    url: "https://airtable.com",
    category: "Produktivitas",
    description: "Spreadsheet + database fleksibel.",
    keywords: ["airtable", "database"],
  },
  {
    id: "github",
    label: "GitHub",
    color: "#24292e",
    url: "https://github.com",
    category: "Developer",
    description: "Repositori kode dan kolaborasi dev.",
    keywords: ["github", "git"],
  },
  {
    id: "shopee",
    label: "Shopee",
    color: "#ee4d2d",
    url: "https://shopee.co.id",
    category: "Marketplace",
    description: "Marketplace populer di Indonesia.",
    keywords: ["shopee", "marketplace"],
  },
  {
    id: "shopee_affiliate",
    label: "Shopee Affiliate",
    color: "#ee4d2d",
    url: "https://affiliate.shopee.co.id",
    category: "Marketplace",
    description: "Dashboard afiliasi Shopee.",
    keywords: ["shopee", "affiliate"],
  },
  {
    id: "tokopedia",
    label: "Tokopedia",
    color: "#08a045",
    url: "https://www.tokopedia.com",
    category: "Marketplace",
    description: "Marketplace hijau favorit seller.",
    keywords: ["tokopedia", "marketplace"],
  },
  {
    id: "tokopedia_seller",
    label: "Tokopedia Seller",
    color: "#08a045",
    url: "https://seller.tokopedia.com",
    category: "Marketplace",
    description: "Dashboard seller Tokopedia.",
    keywords: ["tokopedia", "seller"],
  },
  {
    id: "bukalapak",
    label: "Bukalapak",
    color: "#d41c5d",
    url: "https://www.bukalapak.com",
    category: "Marketplace",
    description: "Marketplace lokal untuk segala kebutuhan.",
    keywords: ["bukalapak", "marketplace"],
  },
  {
    id: "lazada",
    label: "Lazada",
    color: "#1a73e8",
    url: "https://www.lazada.co.id",
    category: "Marketplace",
    description: "Marketplace internasional di Indonesia.",
    keywords: ["lazada", "marketplace"],
  },
  {
    id: "blibli",
    label: "Blibli",
    color: "#007bff",
    url: "https://www.blibli.com",
    category: "Marketplace",
    description: "Retail dan marketplace serba ada.",
    keywords: ["blibli", "marketplace"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "#000000",
    url: "https://www.tiktok.com/login",
    category: "Marketplace",
    description: "TikTok Shop & live commerce.",
    keywords: ["tiktok", "shop"],
  },
  {
    id: "tiktok_affiliate",
    label: "TikTok Affiliate",
    color: "#000000",
    url: "https://affiliate.tiktok.com",
    category: "Marketplace",
    description: "Program afiliasi TikTok.",
    keywords: ["tiktok", "affiliate"],
  },
  {
    id: "android",
    label: "Android Emulator",
    color: "#3DDC84",
    url: null,
    category: "Emulator",
    description: "Emulator Android bawaan Starbox.",
    icon: "assets/starbox.png",
    requiresFeature: "android",
    keywords: ["android", "emulator"],
  },
  {
    id: "other",
    label: "Website Kustom",
    color: "#f97316",
    url: null,
    category: "Kustom",
    description: "Masukkan URL website Anda sendiri.",
    icon: "assets/starbox.png",
    requiresFeature: "private",
    keywords: ["custom", "private"],
  },
];

let SERVICE_LIBRARY = DEFAULT_SERVICE_LIBRARY.map(cloneServiceEntry);
let serviceConfig = {};
const SERVICE_LIBRARY_MAP = new Map();

rebuildServiceLookups();

const assetUrlCache = new Map();
const assetPendingRequests = new Map();
const assetElementRegistry = new Map();

function buildServiceConfig(list = []) {
  return list.reduce(
    (map, service) => {
      const key = sanitizeServiceId(service.id);
      map[key] = {
        label: service.label,
        color: service.color,
        url: service.url,
      };
      return map;
    },
    {
      default: {
        label: "Service",
        color: "#6b7280",
        url: "https://example.com",
      },
    }
  );
}

function rebuildServiceLookups(list = SERVICE_LIBRARY) {
  serviceConfig = buildServiceConfig(list);
  SERVICE_LIBRARY_MAP.clear();
  list.forEach((service) => {
    SERVICE_LIBRARY_MAP.set(sanitizeServiceId(service.id), service);
  });
}

function cloneServiceEntry(service = {}) {
  const cloned = { ...service };
  if (Array.isArray(service.keywords)) {
    cloned.keywords = [...service.keywords];
  }
  if (service.meta && typeof service.meta === "object") {
    cloned.meta = { ...service.meta };
  }
  return cloned;
}

function sanitizeKeywordList(list = []) {
  return Array.from(
    new Set(
      (list || [])
        .map((value) => (value || "").toString().trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeServiceUrl(url) {
  if (!url) return "";
  return url.toString().trim().replace(/\/+$/, "").toLowerCase();
}

function normalizeAssetName(icon) {
  if (!icon) return null;
  if (icon.startsWith("assets/")) {
    return icon.replace(/^assets\//, "");
  }
  if (!icon.includes("://") && !icon.startsWith("data:")) {
    return icon;
  }
  return null;
}

function getAssetFallbackPath(assetName = DEFAULT_ICON_ASSET) {
  if (!assetName) return `assets/${DEFAULT_ICON_ASSET}`;
  if (assetName.startsWith("assets/")) return assetName;
  return `assets/${assetName}`;
}

function registerAssetElement(assetName, element) {
  if (!assetName || !element) return;
  if (!assetElementRegistry.has(assetName)) {
    assetElementRegistry.set(assetName, new Set());
  }
  assetElementRegistry.get(assetName).add(element);
}

function resolveAssetPath(assetName = DEFAULT_ICON_ASSET) {
  if (!assetName) return Promise.resolve(getAssetFallbackPath());
  if (assetUrlCache.has(assetName)) {
    return Promise.resolve(assetUrlCache.get(assetName));
  }
  if (!window.electronAPI?.resolveAssetUrl) {
    const fallback = getAssetFallbackPath(assetName);
    assetUrlCache.set(assetName, fallback);
    return Promise.resolve(fallback);
  }
  if (assetPendingRequests.has(assetName)) {
    return assetPendingRequests.get(assetName);
  }
  const promise = window.electronAPI
    .resolveAssetUrl(assetName)
    .then((url) => {
      const resolved = url || getAssetFallbackPath(assetName);
      assetUrlCache.set(assetName, resolved);
      assetPendingRequests.delete(assetName);
      const elements = assetElementRegistry.get(assetName);
      if (elements && elements.size) {
        elements.forEach((el) => {
          if (el && el.isConnected && el.dataset.assetName === assetName) {
            el.src = resolved;
          }
        });
        assetElementRegistry.delete(assetName);
      }
      return resolved;
    })
    .catch(() => {
      const fallback = getAssetFallbackPath(assetName);
      assetUrlCache.set(assetName, fallback);
      assetPendingRequests.delete(assetName);
      return fallback;
    });
  assetPendingRequests.set(assetName, promise);
  return promise;
}

function applyAssetToImage(element, assetName = DEFAULT_ICON_ASSET) {
  if (!element) return;
  const normalized = normalizeAssetName(assetName) || DEFAULT_ICON_ASSET;
  element.dataset.assetName = normalized;
  registerAssetElement(normalized, element);
  const fallbackPath =
    assetUrlCache.get(normalized) || getAssetFallbackPath(normalized);
  element.src = fallbackPath;
  resolveAssetPath(normalized).catch(() => {});
}

function getServiceIconSource(service) {
  if (!service) {
    return { type: "asset", name: DEFAULT_ICON_ASSET };
  }
  const assetName =
    service.iconAsset ||
    normalizeAssetName(service.icon) ||
    normalizeAssetName(service.icon_url);
  if (assetName) {
    return { type: "asset", name: assetName };
  }
  if (
    service.icon &&
    (service.icon.includes("://") || service.icon.startsWith("data:"))
  ) {
    return { type: "url", value: service.icon };
  }
  if (service.url) {
    return {
      type: "url",
      value: `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(
        service.url
      )}`,
    };
  }
  return { type: "asset", name: DEFAULT_ICON_ASSET };
}

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

const CATEGORY_COLOR_MAP = {
  komunikasi: "#2563eb",
  "komunikasi & sosial": "#2563eb",
  sosial: "#2563eb",
  "media sosial": "#2563eb",
  marketplace: "#f97316",
  pemasaran: "#f59e0b",
  analitik: "#22c55e",
  desain: "#0ea5e9",
  produktivitas: "#10b981",
  komunitas: "#a855f7",
  video: "#ef4444",
  emulator: "#3DDC84",
};

function pickCategoryColor(category = "") {
  const key = (category || "").toString().trim().toLowerCase();
  return CATEGORY_COLOR_MAP[key] || "#6366f1";
}

function formatServerServiceItem(item, slug) {
  const base =
    DEFAULT_SERVICE_LIBRARY.find(
      (service) => sanitizeServiceId(service.id) === slug
    ) || {};
  const label = item.name || base.label || slug.toUpperCase();
  const category = item.category || base.category || "Layanan";
  const description = item.description || base.description || "Layanan publik";
  const url = (item.url || base.url || "").trim();
  const keywords = sanitizeKeywordList([
    slug,
    label,
    category,
    ...(item.meta?.tags || []),
    ...(base.keywords || []),
  ]);

  return {
    id: slug,
    label,
    color: base.color || pickCategoryColor(category),
    url,
    category,
    description,
    icon: item.icon_url || base.icon || null,
    keywords,
    meta: item.meta || base.meta || null,
    requiresFeature: base.requiresFeature,
    sortOrder: item.sort_order ?? base.sortOrder ?? null,
  };
}

function mergeServiceEntries(base = {}, incoming = {}) {
  const merged = {
    ...base,
    ...incoming,
  };
  merged.icon = incoming.icon || base.icon || null;
  merged.requiresFeature = base.requiresFeature || incoming.requiresFeature;
  const keywords = sanitizeKeywordList([
    ...(base.keywords || []),
    ...(incoming.keywords || []),
  ]);
  if (keywords.length) {
    merged.keywords = keywords;
  }
  return merged;
}

function applyRemoteServiceLibrary(items = []) {
  if (!Array.isArray(items) || !items.length) return null;
  const merged = DEFAULT_SERVICE_LIBRARY.map(cloneServiceEntry);
  const slugIndex = new Map();
  const urlIndex = new Map();

  merged.forEach((service, index) => {
    slugIndex.set(sanitizeServiceId(service.id), index);
    const normalizedUrl = normalizeServiceUrl(service.url);
    if (normalizedUrl && !urlIndex.has(normalizedUrl)) {
      urlIndex.set(normalizedUrl, index);
    }
  });

  const reservedIds = new Set(["android", "other"]);

  items.forEach((item) => {
    if (!item) return;
    const slug = sanitizeServiceId(item.slug || item.id || item.name);
    const serviceUrl = (item.url || "").trim();
    if (!slug || !serviceUrl || reservedIds.has(slug)) return;

    const formatted = formatServerServiceItem(item, slug);
    const normalizedUrl = normalizeServiceUrl(formatted.url);

    if (normalizedUrl && urlIndex.has(normalizedUrl)) {
      const idx = urlIndex.get(normalizedUrl);
      merged[idx] = mergeServiceEntries(merged[idx], formatted);
      return;
    }

    if (slugIndex.has(slug)) {
      const idx = slugIndex.get(slug);
      merged[idx] = mergeServiceEntries(merged[idx], formatted);
      if (normalizedUrl) {
        urlIndex.set(normalizedUrl, idx);
      }
      return;
    }

    merged.push(formatted);
    const newIndex = merged.length - 1;
    slugIndex.set(slug, newIndex);
    if (normalizedUrl && !urlIndex.has(normalizedUrl)) {
      urlIndex.set(normalizedUrl, newIndex);
    }
  });

  return merged;
}

async function refreshServiceLibraryFromServer() {
  if (!window?.electronAPI?.invoke) return false;
  try {
    const catalog =
      (await window.electronAPI.invoke("get-service-catalog")) || [];
    if (!Array.isArray(catalog) || !catalog.length) {
      return false;
    }
    const merged = applyRemoteServiceLibrary(catalog);
    if (!merged || !merged.length) {
      return false;
    }
    SERVICE_LIBRARY = merged;
    rebuildServiceLookups();
    return true;
  } catch (err) {
    console.warn(
      "⚠️ Gagal menerapkan layanan dari server:",
      err?.message || err
    );
    return false;
  }
}

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
let cachedWebDevices = [];
let cachedAndroidDevices = [];

// Function to refresh device list (callable from global scope)
window.refreshDeviceList = async function() {
  console.log('🔄 Refreshing device list for page:', window.currentActivePage);
  // Always reload devices from storage to ensure fresh data
  if (typeof loadAllDevices === 'function') {
    await loadAllDevices();
  } else {
    // Fallback: detect current page and render appropriate devices
    const currentPage = document.querySelector(".page-content.active")?.id;
    if (currentPage === "page-android-ios" && typeof renderDevicesAndroid === 'function') {
      renderDevicesAndroid(cachedAndroidDevices);
    } else if (typeof renderDevices === 'function') {
      renderDevices(cachedWebDevices);
    }
  }
};
let deviceSearchQuery = "";

const serviceBrowserState = {
  search: "",
};

const STORAGE_KEYS = {
  layout: "starboxLayoutPreference",
  theme: "starboxThemePreference",
};

const THEME_OPTIONS = [
  { id: "default", label: "Indigo" },
  { id: "mint", label: "Mint" },
  { id: "sunset", label: "Sunset" },
  { id: "midnight", label: "Midnight" },
];

let preferredTheme = getStoredTheme();
let activeTheme = preferredTheme;

function sanitizeServiceId(value) {
  return (value || "").toString().trim().toLowerCase();
}

function getServiceMeta(serviceId) {
  if (!serviceId) return null;
  return SERVICE_LIBRARY_MAP.get(sanitizeServiceId(serviceId)) || null;
}

function getServiceDisabledReason(service) {
  if (!service) return null;
  if (
    service.requiresFeature === "android" &&
    !authState.allowsAndroidEmulator
  ) {
    return "Aktifkan paket yang mendukung Android Emulator.";
  }
  if (
    service.requiresFeature === "private" &&
    !authState.allowsPrivateService
  ) {
    return "Login untuk memakai website kustom.";
  }
  return null;
}

function attachServiceIconFallback(img, assetName = DEFAULT_ICON_ASSET) {
  if (!img) return;
  img.addEventListener("error", () => {
    if (img.dataset.fallbackApplied === "true") return;
    img.dataset.fallbackApplied = "true";
    applyAssetToImage(img, assetName);
  });
}

function ensureServiceSelectOptions(selectId = "deviceService") {
  const select = document.getElementById(selectId);
  if (!select) return;
  const previousValue = sanitizeServiceId(select.value) || "wa";
  select.innerHTML = "";
  SERVICE_LIBRARY.forEach((service) => {
    if (service.hideInForm) return;
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.label;
    if (service.requiresFeature) {
      option.dataset.requiresFeature = service.requiresFeature;
    }
    select.appendChild(option);
  });
  select.value = SERVICE_LIBRARY_MAP.has(previousValue) ? previousValue : "wa";
}

function filterServices(query = "", options = {}) {
  const normalizedQuery = (query || "").trim().toLowerCase();
  const { hideFlag = "hideInBrowser" } = options;
  return SERVICE_LIBRARY.filter((service) => {
    if (hideFlag && service[hideFlag]) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      service.id,
      service.label,
      service.category,
      service.description,
      ...(service.keywords || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function updateServiceBrowserSelected(selectId = "deviceService") {
  const info = document.getElementById("serviceBrowserSelected");
  if (!info) return;
  const select = document.getElementById(selectId);
  const service = select ? getServiceMeta(select.value) : null;
  if (!service) {
    info.innerHTML = `
      <img src="assets/starbox.png" alt="Service preview" />
      <div>
        <strong>Belum memilih layanan</strong>
        <span>Tap salah satu layanan di daftar di bawah.</span>
      </div>
    `;
    return;
  }
  info.innerHTML = `
    <img alt="${service.label}" />
    <div class="service-browser-selected-info">
      <strong></strong>
      <span class="service-browser-selected-meta"></span>
      <span class="service-browser-selected-url"></span>
    </div>
  `;
  const previewIcon = info.querySelector("img");
  const iconSource = getServiceIconSource(service);
  if (iconSource.type === "asset") {
    applyAssetToImage(previewIcon, iconSource.name);
  } else {
    previewIcon.src = iconSource.value;
    attachServiceIconFallback(previewIcon);
  }
  const infoBox = info.querySelector(".service-browser-selected-info");
  if (infoBox) {
    const titleEl = infoBox.querySelector("strong");
    if (titleEl) {
      titleEl.textContent = service.label;
    }
    const metaEl = infoBox.querySelector(".service-browser-selected-meta");
    if (metaEl) {
      metaEl.textContent =
        service.category || service.description || "Layanan publik";
    }
    const urlEl = infoBox.querySelector(".service-browser-selected-url");
    if (urlEl) {
      if (service.url) {
        urlEl.textContent = `URL: ${service.url}`;
        urlEl.title = service.url;
        urlEl.classList.remove("is-empty");
      } else {
        urlEl.textContent = "URL layanan belum tersedia";
        urlEl.removeAttribute("title");
        urlEl.classList.add("is-empty");
      }
    }
  }
}

function renderServiceBrowserGrid(options = {}) {
  const {
    containerId = "serviceBrowserGrid",
    selectId = "deviceService",
    search = serviceBrowserState.search,
  } = options;
  const container = document.getElementById(containerId);
  const select = document.getElementById(selectId);
  if (!container || !select) return;
  const services = filterServices(search);
  container.innerHTML = "";
  if (!services.length) {
    const empty = document.createElement("div");
    empty.className = "service-browser-empty";
    empty.textContent = "Layanan tidak ditemukan. Coba kata kunci lainnya.";
    container.appendChild(empty);
    updateServiceBrowserSelected(selectId);
    return;
  }
  const currentValue =
    sanitizeServiceId(select.value) ||
    sanitizeServiceId(services[0]?.id || "wa");
  services.forEach((service) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "service-card";
    button.dataset.serviceId = service.id;
    const disabledReason = getServiceDisabledReason(service);
    if (disabledReason) {
      button.classList.add("is-disabled");
      button.disabled = true;
      button.title = disabledReason;
    } else {
      button.addEventListener("click", () =>
        setSelectedService(selectId, service.id)
      );
    }
    if (sanitizeServiceId(service.id) === currentValue) {
      button.classList.add("selected");
    }
    button.innerHTML = `
      <img alt="${service.label}" />
      <div class="service-card-info">
        <div class="service-card-title">${service.label}</div>
      </div>
    `;
    const iconNode = button.querySelector("img");
    const iconSource = getServiceIconSource(service);
    if (iconSource.type === "asset") {
      applyAssetToImage(iconNode, iconSource.name);
    } else {
      iconNode.src = iconSource.value;
      attachServiceIconFallback(iconNode);
    }
    container.appendChild(button);
  });
  updateServiceBrowserSelected(selectId);

  // Apply page-based filtering after rendering
  const currentPage = window.currentActivePage || 'web-emulator';
  filterServicesByPage(currentPage);
}

function setSelectedService(selectId = "deviceService", serviceId = "wa") {
  const select = document.getElementById(selectId);
  if (!select) return;
  if (!SERVICE_LIBRARY_MAP.has(sanitizeServiceId(serviceId))) return;
  select.value = serviceId;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  renderServiceBrowserGrid({ selectId });
}

function canUseThemeSelector() {
  if (!authState.isLoggedIn) return false;
  const pkg = authState.package || {};
  const pkgName = (pkg.name || "").toLowerCase();
  const priceValue = Number(
    pkg.price ?? pkg.price_value ?? pkg.amount ?? pkg.total ?? NaN
  );
  const priceDisplay = (pkg.price_display || "").toLowerCase();
  const isFree =
    pkgName === "free" ||
    pkgName === "gratis" ||
    (Number.isFinite(priceValue) && priceValue <= 0) ||
    priceDisplay.includes("gratis") ||
    priceDisplay.includes("free") ||
    priceDisplay === "💰 gratis";
  return !isFree;
}

function updateThemeButtons() {
  const wrapper = document.getElementById("themeSelector");
  if (!wrapper) return;
  wrapper
    .querySelectorAll(".theme-option")
    .forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.theme === preferredTheme)
    );
}

function applyTheme(themeId, options = {}) {
  const normalized = sanitizeThemeId(themeId);
  activeTheme = normalized;
  const body = document.body;
  if (body) {
    const classes = THEME_OPTIONS.map((theme) => `theme-${theme.id}`);
    body.classList.remove(...classes);
    body.classList.add(`theme-${normalized}`);
  }
  if (!options.skipStore) {
    preferredTheme = normalized;
    setStoredTheme(normalized);
  }
  updateThemeButtons();
}

function syncThemeSelector() {
  const wrapper = document.getElementById("themeSelector");
  if (!wrapper) return;
  const allowed = canUseThemeSelector();
  wrapper.style.display = allowed ? "flex" : "none";
  if (allowed) {
    applyTheme(preferredTheme || "default", { skipStore: true });
  } else {
    applyTheme("default", { skipStore: true });
  }
}

function initThemeSelector() {
  const wrapper = document.getElementById("themeSelector");
  if (!wrapper) return;
  wrapper.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canUseThemeSelector()) return;
      applyTheme(btn.dataset.theme);
    });
  });
}
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
  limitDeviceWAGateway: null,
  limitAutoReply: null,
  limitBroadcastDay: null,
};

if (typeof window !== "undefined") {
  window.getCurrentAuthState = () => authState;
}

const authModalState = {
  activeTab: "login",
};

let phoneCodeOptionsLoaded = false;
let phoneCodeOptionsCache = [];
const DEFAULT_PHONE_CODE = "+62";
const VERSION_CHECK_CHANNEL = "stable";
let currentAppVersion = null;
let latestVersionInfo = null;
let versionCheckInProgress = false;
let hasShownVersionDialog = false;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
let packageCountdownTimer = null;
let systemPlatform =
  typeof navigator !== "undefined" ? navigator.userAgent : null;
let lastAuthDeviceSnapshot = {
  loggedIn: authState.isLoggedIn,
  unlimited: authState.isUnlimited,
  limit: getServiceLimitValue(),
};

function getStoredLayout() {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.layout);
    if (value === "card" || value === "list") return value;
  } catch {}
  return "card";
}

function setStoredLayout(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.layout, value);
  } catch {}
}

function sanitizeThemeId(themeId) {
  const id = (themeId || "").toLowerCase();
  return THEME_OPTIONS.some((theme) => theme.id === id) ? id : "default";
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return sanitizeThemeId(stored);
  } catch {
    return "default";
  }
}

function setStoredTheme(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, sanitizeThemeId(value));
  } catch {}
}

function getServiceLimitValue() {
  if (authState.isLoggedIn) {
    if (authState.package?.is_device_limit_unlimited) return Infinity;
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
  toggleAndroidSpecSection(serviceSelect.value === "android");
  renderServiceBrowserGrid();
}

function updateIOSButtonVisibility() {
  const button = document.getElementById("iosSimulatorButton");
  const buttonAndroid = document.getElementById("iosSimulatorButtonAndroid");

  const isMac =
    (systemPlatform || "").toLowerCase().includes("darwin") ||
    (systemPlatform || "").toLowerCase().includes("mac");
  const canShow = authState.isLoggedIn && authState.allowsIosSimulator && isMac;

  if (button) button.style.display = canShow ? "inline-flex" : "none";
  if (buttonAndroid) buttonAndroid.style.display = canShow ? "inline-flex" : "none";
}

function updateCachedDevices(list = [], type = "web") {
  const deviceList = Array.isArray(list) ? list.slice() : [];

  if (type === "android") {
    cachedAndroidDevices = deviceList;
  } else {
    cachedWebDevices = deviceList;
  }

  // Keep global cache for backward compatibility
  cachedDevices = deviceList;

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
  const quotaEl = document.getElementById("accountQuotaSummary");
  const packageEl = document.getElementById("accountPackageSummary");
  const used = cachedDevices.length;

  if (quotaEl) {
    if (authState.isLoggedIn) {
      if (authState.isUnlimited) {
        quotaEl.textContent = `Unlimited per layanan • Total device saat ini ${used}`;
      } else {
        const limit = getServiceLimitValue();
        quotaEl.textContent = `Batas per layanan: ${limit} device • Total device saat ini ${used}`;
      }
    } else {
      const limit =
        typeof authState.guestServiceLimit === "number"
          ? authState.guestServiceLimit
          : 2;
      quotaEl.textContent = `Mode tamu • Maks ${limit} device per layanan. Login untuk menambah kuota.`;
    }
  }

  if (packageEl) {
    if (authState.isLoggedIn) {
      const pkgName = authState.package?.name || "Default";
      const limitLabel = authState.isUnlimited
        ? "Tanpa batas"
        : `${getServiceLimitValue()} device/layanan`;
      const expiry = getPackageExpiryText();
      packageEl.textContent = expiry
        ? `Paket: ${pkgName} • ${limitLabel} • ${expiry}`
        : `Paket: ${pkgName} • ${limitLabel}`;
    } else {
      packageEl.textContent = "Belum login • Paket tamu default.";
    }
  }
}

function updateAuthHeaderUI() {
  const authButton = document.getElementById("authButton");
  const userProfileButton = document.getElementById("userProfileButton");
  const userProfileName = document.getElementById("userProfileName");
  const statusLabel = document.getElementById("authStatusLabel");
  const layoutToggle = document.getElementById("layoutToggle");

  const guestLabel =
    authState.guestServiceLimit > 0
      ? `Mode tamu • ${authState.guestServiceLimit} device/layanan`
      : "Mode tamu";

  // Update navbar buttons
  if (authState.isLoggedIn) {
    const displayName = authState.user?.name || authState.user?.email || "Pengguna";

    // Hide login button, show profile button
    if (authButton) authButton.style.display = "none";
    if (userProfileButton) {
      userProfileButton.style.display = "flex";
      if (userProfileName) {
        userProfileName.textContent = displayName;
      }
    }
  } else {
    // Show login button, hide profile button
    if (authButton) authButton.style.display = "flex";
    if (userProfileButton) userProfileButton.style.display = "none";
  }

  const preferredLayout = getStoredLayout();
  const effectiveLayout = authState.isLoggedIn ? preferredLayout : "card";
  if (document.body) {
    document.body.classList.toggle("list-layout", effectiveLayout === "list");
  }
  if (layoutToggle) {
    layoutToggle.style.display = authState.isLoggedIn ? "inline-flex" : "none";
    layoutToggle.querySelectorAll(".layout-option").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.layout === effectiveLayout);
    });
  }
  syncThemeSelector();
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
  authState.limitDeviceWAGateway =
    session.limit_device_wa_gateway ??
    session.package?.limit_device_wa_gateway ??
    null;
  authState.limitAutoReply =
    session.limit_auto_reply ?? session.package?.limit_auto_reply ?? null;
  authState.limitBroadcastDay =
    session.limit_broadcast_day ??
    session.package?.limit_broadcast_day ??
    null;
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
    authState.limitDeviceWAGateway = null;
    authState.limitAutoReply = null;
    authState.limitBroadcastDay = null;
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
  if (typeof window !== "undefined") {
    window.__authState = authState;
  }
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
      if (typeof window.loadWAGatewayPage === "function") {
        window.loadWAGatewayPage();
      }
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
  updateDeviceQuotaBanner();
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
    let countries = [];

    if (window.electronAPI?.getCountryCodes) {
      try {
        const ipcResult = await window.electronAPI.getCountryCodes();
        if (Array.isArray(ipcResult?.data)) {
          countries = ipcResult.data;
        } else if (Array.isArray(ipcResult)) {
          countries = ipcResult;
        }
      } catch (err) {
        console.warn("⚠️ IPC country codes gagal:", err?.message || err);
      }
    }

    if (!countries.length) {
      const assetUrl = new URL("assets/country.json", window.location.href);
      const response = await fetch(assetUrl.toString());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (!Array.isArray(json)) {
        throw new Error("Format country.json tidak valid");
      }
      countries = json;
    }

    if (!countries.length) {
      throw new Error("Daftar negara kosong");
    }

    const normalized = countries
      .filter((c) => c && c.phonecode)
      .map((country) => {
        const code = `+${String(country.phonecode).trim()}`;
        const emoji = country.emoji ? `${country.emoji} ` : "";
        const labelName =
          country.nicename || country.name || country.iso || code;
        const label = `${emoji}${labelName} (${code})`;
        const searchText = [
          labelName,
          country.nicename,
          country.name,
          country.iso,
          code,
          country.emoji,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return { code, label, searchText };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "id"));

    phoneCodeOptionsCache = normalized;
    renderPhoneCodeOptions(normalized, select, { preserveValue: false });
    phoneCodeOptionsLoaded = true;
  } catch (err) {
    console.error("⚠️ Gagal memuat daftar kode negara:", err);
    select.innerHTML =
      '<option value="">Gagal memuat kode negara. Coba ulangi.</option>';
  }
}

function renderPhoneCodeOptions(list, select, options = {}) {
  const { preserveValue = true, skipSync = false } = options;
  const currentValue = preserveValue ? select.value : "";
  select.innerHTML = '<option value="">Pilih kode negara</option>';

  if (!list.length) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Tidak ditemukan. Ketik kata lain.";
    emptyOption.disabled = true;
    select.appendChild(emptyOption);
    select.selectedIndex = 0;
    if (!skipSync) syncPhoneCodeSearchValue(true);
    return;
  }

  let defaultOptionFound = false;
  list.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = item.label;
    select.appendChild(option);
    if (item.code === DEFAULT_PHONE_CODE) {
      defaultOptionFound = true;
    }
  });

  if (currentValue && list.some((item) => item.code === currentValue)) {
    select.value = currentValue;
  } else if (defaultOptionFound) {
    select.value = DEFAULT_PHONE_CODE;
  } else {
    select.selectedIndex = 0;
  }

  if (!skipSync) {
    syncPhoneCodeSearchValue(true);
  }
}

function syncPhoneCodeSearchValue(force = false) {
  const select = document.getElementById("registerPhoneCode");
  const input = document.getElementById("registerPhoneCodeSearch");
  if (!select || !input) return;
  if (!force && input.dataset.userEditing === "true") return;
  const option = select.options[select.selectedIndex];
  input.value = option?.textContent || "";
}

function handlePhoneCodeSearchInput(event) {
  const select = document.getElementById("registerPhoneCode");
  if (!select || !phoneCodeOptionsCache.length) return;
  const query = (event.target.value || "").trim().toLowerCase();
  if (!query) {
    renderPhoneCodeOptions(phoneCodeOptionsCache, select, {
      preserveValue: true,
      skipSync: true,
    });
    return;
  }
  const filtered = phoneCodeOptionsCache.filter((item) =>
    item.searchText.includes(query)
  );
  renderPhoneCodeOptions(filtered, select, {
    preserveValue: false,
    skipSync: true,
  });
}

function handlePhoneCodeSearchFocus(event) {
  event.target.dataset.userEditing = "true";
  event.target.select();
}

function handlePhoneCodeSearchBlur(event) {
  event.target.dataset.userEditing = "false";
  syncPhoneCodeSearchValue(true);
}

function compareVersions(a = "", b = "") {
  const parse = (value) =>
    value
      .toString()
      .split(".")
      .map((part) => parseInt(part, 10) || 0);
  const partsA = parse(a);
  const partsB = parse(b);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff > 0) return 1;
    if (diff < 0) return -1;
  }
  return 0;
}

function getPreferredPlatformKey() {
  const ua = (navigator.userAgent || "").toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac") || ua.includes("darwin")) return "mac";
  if (ua.includes("linux")) return "linux";
  return null;
}

function getPreferredDownload(info = {}) {
  const downloads = info.downloads || {};
  const platformKey = getPreferredPlatformKey();
  if (platformKey && downloads[platformKey]) {
    return { platform: platformKey, ...(downloads[platformKey] || {}) };
  }
  const [firstKey] = Object.keys(downloads);
  if (firstKey) {
    return { platform: firstKey, ...(downloads[firstKey] || {}) };
  }
  return null;
}

function renderVersionBanner(info) {
  const banner = document.getElementById("versionAlertBanner");
  if (!banner) return;
  if (!info) {
    banner.style.display = "none";
    return;
  }
  const titleEl = document.getElementById("versionAlertTitle");
  const msgEl = document.getElementById("versionAlertMessage");
  const downloadBtn = document.getElementById("versionAlertDownload");

  if (titleEl) {
    titleEl.textContent = `Versi ${info.version} (${(
      info.channel || "stable"
    ).toUpperCase()}) tersedia`;
  }
  if (msgEl) {
    const summary =
      info.changelog?.split?.("\n")?.find((line) => line.trim()) ||
      "Tersedia pembaruan dengan perbaikan terbaru.";
    msgEl.textContent = summary;
  }
  if (downloadBtn) {
    const preferred = getPreferredDownload(info);
    if (preferred?.url) {
      downloadBtn.href = preferred.url;
      downloadBtn.style.display = "inline-flex";
      downloadBtn.innerHTML = `<i class="bi bi-download"></i> Download ${
        preferred.platform ? preferred.platform.toUpperCase() : ""
      }`;
    } else {
      downloadBtn.style.display = "none";
    }
  }
  banner.style.display = "flex";
}

function dismissVersionBanner() {
  const banner = document.getElementById("versionAlertBanner");
  if (banner) {
    banner.style.display = "none";
  }
}

function updateVersionIndicator(hasUpdate) {
  const dot = document.getElementById("versionUpdateDot");
  if (dot) {
    dot.style.display = hasUpdate ? "inline-block" : "none";
  }
}

function buildDownloadListHtml(downloads = {}) {
  const entries = Object.entries(downloads);
  if (!entries.length) return "";
  const items = entries
    .map(([platform, payload]) => {
      if (!payload?.url) return "";
      const checksum = payload.checksum
        ? `<small>Checksum: ${payload.checksum}</small>`
        : "";
      return `<li><a href="${
        payload.url
      }" target="_blank" rel="noopener">${platform.toUpperCase()}</a>${checksum}</li>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";
  return `<ul class="version-download-list">${items}</ul>`;
}

function showVersionInfoDialog(info) {
  if (!info) return;
  const changelogHtml = (info.changelog || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("<br>");
  const notesHtml = Array.isArray(info.metadata?.notes)
    ? info.metadata.notes.map((note) => `<li>${note}</li>`).join("")
    : "";
  const downloadHtml = buildDownloadListHtml(info.downloads || {});

  const sections = [];
  sections.push(
    `<p><strong>Channel:</strong> ${(
      info.channel || "stable"
    ).toUpperCase()}</p>`
  );
  if (info.metadata?.min_app_version) {
    sections.push(
      `<p><strong>Minimal versi aplikasi:</strong> ${info.metadata.min_app_version}</p>`
    );
  }
  if (changelogHtml) {
    sections.push(
      `<div class="version-changelog"><strong>Changelog:</strong><br>${changelogHtml}</div>`
    );
  }
  if (notesHtml) {
    sections.push(
      `<div class="version-notes"><strong>Catatan:</strong><ul>${notesHtml}</ul></div>`
    );
  }
  if (downloadHtml) {
    sections.push(
      `<div class="version-downloads"><strong>Unduhan:</strong>${downloadHtml}</div>`
    );
  }

  Swal.fire({
    title: `Versi ${info.version} tersedia`,
    html: sections.join(""),
    icon: "info",
    width: 600,
    confirmButtonText: "Tutup",
  });
}

async function checkLatestVersion(options = {}) {
  if (!window.electronAPI?.checkLatestVersion) return;
  if (versionCheckInProgress) {
    if (options.showAlways) {
      showToast("Sedang memeriksa versi...", 2500, "info");
    }
    return;
  }
  versionCheckInProgress = true;
  const channel = options.channel || VERSION_CHECK_CHANNEL;
  try {
    const result = await window.electronAPI.checkLatestVersion(channel);
    if (!result?.success) {
      if (options.silent) {
        console.warn("⚠️ Version check gagal:", result?.message || "Unknown");
      } else {
        showToast(result?.message || "Gagal memeriksa versi.", 3500, "error");
      }
      return;
    }
    currentAppVersion = result.currentVersion || currentAppVersion || "0.0.0";
    const info = result.info || result.data;
    if (!info?.version) {
      if (options.silent) {
        console.warn("⚠️ Respons versi tidak valid:", info);
      } else {
        showToast("Respons versi tidak valid.", 3500, "error");
      }
      return;
    }
    latestVersionInfo = info;
    const isNewer =
      compareVersions(info.version, currentAppVersion || "0.0.0") > 0;
    updateVersionIndicator(isNewer);
    if (isNewer) {
      renderVersionBanner(info);
      if (!hasShownVersionDialog || options.showAlways) {
        showVersionInfoDialog(info);
        hasShownVersionDialog = true;
      }
    } else {
      renderVersionBanner(null);
      if (options.showAlways) {
        showToast(
          `Anda sudah menggunakan versi terbaru (${currentAppVersion}).`,
          3500,
          "success"
        );
      }
    }
  } catch (err) {
    if (options.silent) {
      console.warn("⚠️ Gagal memeriksa versi:", err?.message || err);
    } else {
      showToast(err?.message || "Gagal memeriksa versi.", 3500, "error");
    }
  } finally {
    versionCheckInProgress = false;
  }
}

async function hydrateStaticAssetImages() {
  if (!window.electronAPI?.resolveAssetUrl) return;
  const candidates = document.querySelectorAll("[data-asset-src]");
  if (!candidates.length) return;
  const tasks = Array.from(candidates).map(async (img) => {
    const assetName = img.getAttribute("data-asset-src");
    if (!assetName) return;
    try {
      const resolved = await window.electronAPI.resolveAssetUrl(assetName);
      if (resolved) {
        img.src = resolved;
      }
    } catch (err) {
      console.warn(`⚠️ Gagal memuat asset ${assetName}:`, err?.message || err);
    }
  });
  await Promise.allSettled(tasks);
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

function filterDevicesBySearch(devices = []) {
  if (!deviceSearchQuery) return devices.slice();
  const query = deviceSearchQuery;
  return devices.filter((device) => {
    const label = getServiceLabel(device.service);
    const haystack = [
      device.uid,
      device.name,
      label,
      device.service,
      device.customUrl,
      device.pendingUrl,
      device.mode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

async function renderDevices(devices) {
  // This function ONLY handles web service devices (NOT Android)
  // Renders to #device-list container
  const container = document.getElementById("device-list");
  const limitInfo = document.getElementById("device-limit-info");
  if (!container) return;

  container.innerHTML = "";

  // Filter out Android devices - only show web services
  const webDevices = devices.filter(d => (d.service || '').toLowerCase() !== 'android');

  const filteredDevices = filterDevicesBySearch(webDevices);
  const { visible: visibleDevices, hidden: hiddenDevices } =
    partitionDevicesByLimit(filteredDevices);
  const isSearching = !!deviceSearchQuery;
  updateDeviceLimitInfo(hiddenDevices);
  if (limitInfo && !hiddenDevices.length && !visibleDevices.length) {
    limitInfo.style.display = "none";
  }

  const fragment = document.createDocumentFragment();

  if (!visibleDevices.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "device-empty-state";
    emptyState.textContent = isSearching
      ? "Tidak ada device yang cocok dengan pencarian Anda."
      : "Belum ada device yang dapat ditampilkan untuk konfigurasi saat ini.";
    fragment.appendChild(emptyState);
  }

  for (const device of visibleDevices) {
    const serviceKey = (device?.service || "").toLowerCase();
    const config = serviceConfig[serviceKey] || serviceConfig.default;
    const serviceMeta = SERVICE_LIBRARY_MAP.get(serviceKey);
    const isCustomService = serviceKey === "other";
    const displayUrl = device.customUrl || "";
    const serviceLabel = isCustomService
      ? displayUrl || config.label || "Website Kustom"
      : config.label || device.service || "Unknown";
    const baseUrl = isCustomService
      ? displayUrl || ""
      : config.url || serviceMeta?.url || "";
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
             data-device-uid="${device.uid}"
             data-device-service="${device.service || ""}"
             data-service="${device.service || ""}"
             aria-label="Pilih ${device.name}">

      <div class="device-service-icon" title="Layanan: ${serviceLabel}">
        <img alt="Ikon ${serviceLabel}">
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

    const iconElement = deviceCard.querySelector(".device-service-icon img");
    if (isCustomService) {
      if (displayUrl) {
        iconElement.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(
          displayUrl
        )}`;
        attachServiceIconFallback(iconElement);
      } else {
        applyAssetToImage(iconElement);
      }
    } else if (serviceMeta) {
      const iconSource = getServiceIconSource(serviceMeta);
      if (iconSource.type === "asset") {
        applyAssetToImage(iconElement, iconSource.name);
      } else {
        iconElement.src = iconSource.value;
        attachServiceIconFallback(iconElement);
      }
    } else if (baseUrl) {
      iconElement.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(
        baseUrl
      )}`;
      attachServiceIconFallback(iconElement);
    } else {
      applyAssetToImage(iconElement);
    }

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
      // Check if Android device - use separate modal
      if ((device.service || "").toLowerCase() === "android") {
        if (typeof window.openEditAndroidModal === "function") {
          window.openEditAndroidModal(device.uid);
        }
        return;
      }

      // For web services, use original modal
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
      const editSpecSelect = document.getElementById("editAndroidSpecPreset");
      if (editSpecSelect) {
        editSpecSelect.value =
          device.androidSpec?.id || DEFAULT_ANDROID_SPEC_ID;
        updateAndroidSpecDescription(
          "editAndroidSpecPreset",
          "editAndroidSpecDescription"
        );
      }
      if (typeof window.refreshEditAndroidSpecUI === "function") {
        window.refreshEditAndroidSpecUI();
      } else {
        toggleEditAndroidSpecSection(
          (device.service || "").toLowerCase() === "android"
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

// Load devices separately for Web and Android (MUST BE DEFINED BEFORE loadAllDevices)
async function loadAllDevicesWeb() {
  try {
    const data = await window.electronAPI.loadDevices("web");
    const devices = data.devices || [];
    console.log("📦 Web devices:", devices);
    renderDevices(devices);
    updateCachedDevices(devices, "web");
    devices.forEach((device) => setDeviceState(device.uid, device.status));
    await syncAutomationSource(devices);
    if (automationSessions.size) {
      ensureAutomationLoop();
    } else {
      stopAutomationLoop();
    }
  } catch (err) {
    console.error("⚠️ Gagal memuat web devices:", err);
  }
}

// Render Android devices (MUST BE DEFINED BEFORE loadAllDevicesAndroid)
function renderDevicesAndroid(devices) {
  console.log("🤖 renderDevicesAndroid called with", devices?.length || 0, "devices");
  const container = document.getElementById("device-list-android");
  if (!container) {
    console.error("⚠️ Container #device-list-android not found!");
    return;
  }

  console.log("  📦 Clearing Android container");
  container.innerHTML = "";

  // Filter to only show Android devices
  const androidDevices = (devices || []).filter(d =>
    (d.service || '').toLowerCase() === 'android'
  );

  if (androidDevices.length === 0) {
    console.log("  📭 No Android devices, showing empty state");
    container.innerHTML =
      '<div style="padding: 2rem; text-align: center; color: #6b7280;">Belum ada device Android. Klik "Tambah Device" untuk mulai.</div>';
    return;
  }

  console.log("  🎨 Rendering", androidDevices.length, "Android devices");

  const fragment = document.createDocumentFragment();

  for (const device of androidDevices) {
    const serviceKey = (device?.service || "").toLowerCase();
    const config = serviceConfig[serviceKey] || serviceConfig.default;
    const serviceMeta = SERVICE_LIBRARY_MAP.get(serviceKey);
    const serviceLabel = config.label || device.service || "Android Emulator";
    const baseUrl = config.url || serviceMeta?.url || "";
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
    deviceCard.dataset.autoSender = "false";
    deviceCard.dataset.pendingUrl = "";
    deviceCard.dataset.callbackUrl = "";
    deviceCard.dataset.deviceName = device.name || "";
    deviceCard.style.setProperty("--device-accent", config.color || "#6b7280");

    const runLabel = isActive ? "Restart" : "Jalankan";
    const runIcon = isActive ? "bi-arrow-clockwise" : "bi-play-fill";

    deviceCard.innerHTML = `
      <div class="device-service-icon" title="Layanan: ${serviceLabel}">
        <img alt="Ikon ${serviceLabel}">
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

    const iconElement = deviceCard.querySelector(".device-service-icon img");
    if (serviceMeta) {
      const iconSource = getServiceIconSource(serviceMeta);
      if (iconSource.type === "asset") {
        applyAssetToImage(iconElement, iconSource.name);
      } else {
        iconElement.src = iconSource.value;
        attachServiceIconFallback(iconElement);
      }
    } else if (baseUrl) {
      iconElement.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(
        baseUrl
      )}`;
      attachServiceIconFallback(iconElement);
    } else {
      applyAssetToImage(iconElement);
    }

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

        setTimeout(() => {
          runButton.innerHTML = originalHTML;
          runButton.disabled = false;
        }, 2000);
      } catch (err) {
        console.error("Error running device:", err);
        runButton.innerHTML = originalHTML;
        runButton.disabled = false;
      }
    });

    if (inlineStop) {
      inlineStop.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        if (inlineStop.disabled) return;
        try {
          inlineStop.disabled = true;
          window.electronAPI.stopDevice(device.uid);
          setDeviceState(device.uid, "stopped");
          device.status = "stopped";
        } catch (err) {
          console.error("Error stopping device:", err);
          inlineStop.disabled = false;
        }
      });
    }

    deleteButton.addEventListener("click", () => deleteDevice(device.uid));
    editButton.addEventListener("click", () => {
      // Android device always uses Android modal
      if (typeof window.openEditAndroidModal === "function") {
        window.openEditAndroidModal(device.uid);
      }
    });

    fragment.appendChild(deviceCard);
  }

  container.appendChild(fragment);
}

async function loadAllDevicesAndroid() {
  try {
    const data = await window.electronAPI.loadDevices("android");
    const devices = data.devices || [];
    console.log("📦 Android devices:", devices);
    renderDevicesAndroid(devices);
    updateCachedDevices(devices, "android");
    devices.forEach((device) => setDeviceState(device.uid, device.status));
  } catch (err) {
    console.error("⚠️ Gagal memuat Android devices:", err);
  }
}

async function loadAllDevices() {
  try {
    // Detect which page is active and load from correct DB
    const currentPage = document.querySelector(".page-content.active")?.id;

    if (currentPage === "page-android-ios") {
      // Load Android devices only
      await loadAllDevicesAndroid();
    } else {
      // Default to Web devices (page-web-emulator or others)
      await loadAllDevicesWeb();
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

function filterServicesByPage(pageName) {
  const serviceBrowserGrid = document.getElementById("serviceBrowserGrid");
  if (!serviceBrowserGrid) return;

  // Clear and rebuild service browser based on page
  const serviceCards = serviceBrowserGrid.querySelectorAll('.service-card');

  serviceCards.forEach(card => {
    const serviceValue = card.dataset.serviceId || '';

    if (pageName === 'android-ios') {
      // Show only Android service
      if (serviceValue.toLowerCase() === 'android') {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    } else if (pageName === 'web-emulator') {
      // Hide Android service
      if (serviceValue.toLowerCase() === 'android') {
        card.style.display = 'none';
      } else {
        card.style.display = 'flex';
      }
    } else {
      // For other pages, show all
      card.style.display = 'flex';
    }
  });
}

function openModal() {
  document.getElementById("addModal").style.display = "flex";
  updateAddDeviceQuotaHint();

  // Filter services based on current page
  const currentPage = window.currentActivePage || 'web-emulator';
  filterServicesByPage(currentPage);

  syncServiceAvailability();
  toggleCustomServiceSection(
    document.getElementById("deviceService")?.value === "other"
  );
  toggleAndroidSpecSection(
    document.getElementById("deviceService")?.value === "android"
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
  const androidSpecSelect = document.getElementById("androidSpecPreset");
  if (nameEl) nameEl.value = "";
  if (serviceSelect) serviceSelect.value = "wa";
  if (autoRunEl) autoRunEl.checked = false;
  if (autoSenderEl) autoSenderEl.checked = false;
  if (pendingUrlEl) pendingUrlEl.value = "";
  if (customUrlEl) customUrlEl.value = "";
  if (callbackEl) callbackEl.value = "";
  toggleCustomServiceSection(false);
  toggleAndroidSpecSection(false);
  if (androidSpecSelect) {
    androidSpecSelect.value = DEFAULT_ANDROID_SPEC_ID;
    updateAndroidSpecDescription("androidSpecPreset", "androidSpecDescription");
  }
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

// Helper function to check if mode is valid for WhatsApp (minimal iPad Pro 11" 834x1194)
function isModeValidForWhatsApp(mode) {
  if (!mode) return false;
  // Mode yang valid untuk WhatsApp: tablet-* atau desktop-*
  // Minimal: tablet-ipad-pro (834x1194)
  const validModes = [
    "tablet-ipad-pro",
    "tablet-ipad-pro-13",
    "tablet-android",
    "tablet-samsung",
    "desktop",
    "desktop-mini",
    "desktop-hd",
    "desktop-full-hd",
    "desktop-2k",
    "desktop-wide",
    "desktop-ultrawide",
    "desktop-4k",
  ];
  return validModes.includes(mode);
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
  const androidSpecSelect = document.getElementById("androidSpecPreset");
  const selectedAndroidSpecId =
    service === "android"
      ? androidSpecSelect?.value || DEFAULT_ANDROID_SPEC_ID
      : null;
  const androidSpec =
    service === "android" ? getAndroidSpecPayload(selectedAndroidSpecId) : null;

  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  // Validasi mode untuk WhatsApp: minimal iPad Pro 11" (834x1194)
  if (isWhatsApp && !isModeValidForWhatsApp(mode)) {
    showToast(
      'Untuk layanan WhatsApp, mode minimal harus 📘 iPad Pro 11" (834x1194). Mode di bawah itu tidak bisa dibuka.',
      5000,
      "warning"
    );
    // Auto-set ke tablet-ipad-pro jika mode tidak valid
    const modeSelect = document.getElementById("deviceMode");
    if (modeSelect) {
      modeSelect.value = "tablet-ipad-pro";
    }
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
      androidSpec,
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
  resolveAssetPath(DEFAULT_ICON_ASSET).catch(() => {});
  hydrateStaticAssetImages();
  initThemeSelector();
  ensureServiceSelectOptions("deviceService");
  ensureAndroidSpecSelectOptions("androidSpecPreset", "androidSpecDescription");
  ensureAndroidSpecSelectOptions(
    "editAndroidSpecPreset",
    "editAndroidSpecDescription"
  );
  renderServiceBrowserGrid();
  refreshServiceLibraryFromServer()
    .then((updated) => {
      if (updated) {
        ensureServiceSelectOptions("deviceService");
        renderServiceBrowserGrid();
      }
    })
    .catch((err) =>
      console.warn(
        "⚠️ Tidak dapat menyinkronkan layanan saat inisialisasi:",
        err?.message || err
      )
    );
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
      renderServiceBrowserGrid();
    });
  }
  const serviceSearch = document.getElementById("serviceBrowserSearch");
  if (serviceSearch) {
    serviceSearch.addEventListener("input", (event) => {
      serviceBrowserState.search = event.target.value || "";
      renderServiceBrowserGrid();
    });
  }
  const phoneCodeSearch = document.getElementById("registerPhoneCodeSearch");
  if (phoneCodeSearch) {
    phoneCodeSearch.addEventListener("input", handlePhoneCodeSearchInput);
    phoneCodeSearch.addEventListener("focus", handlePhoneCodeSearchFocus);
    phoneCodeSearch.addEventListener("blur", handlePhoneCodeSearchBlur);
  }
  const phoneCodeSelect = document.getElementById("registerPhoneCode");
  if (phoneCodeSelect) {
    phoneCodeSelect.addEventListener("change", () =>
      syncPhoneCodeSearchValue(true)
    );
  }
  checkLatestVersion({ silent: true });
  const deviceSearchInput = document.getElementById("deviceSearchInput");
  if (deviceSearchInput) {
    deviceSearchInput.addEventListener("input", (event) => {
      deviceSearchQuery = (event.target.value || "").toLowerCase();
      renderDevices(cachedDevices);
    });
  }
  const deviceSearchInputAndroid = document.getElementById("deviceSearchInputAndroid");
  if (deviceSearchInputAndroid) {
    deviceSearchInputAndroid.addEventListener("input", (event) => {
      deviceSearchQuery = (event.target.value || "").toLowerCase();
      renderDevices(cachedDevices);
    });
  }
  syncThemeSelector();
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

window.triggerVersionCheck =
  window.triggerVersionCheck ||
  function () {
    checkLatestVersion({ showAlways: true });
  };

window.openVersionInfoDialog =
  window.openVersionInfoDialog ||
  function () {
    if (latestVersionInfo) {
      showVersionInfoDialog(latestVersionInfo);
    } else {
      checkLatestVersion({ showAlways: true });
    }
  };

window.dismissVersionBanner =
  window.dismissVersionBanner || dismissVersionBanner;

function restartDevice(uid, service) {
  // Close window by killing process (optional improvement: track PID)
  // Di sini kita hanya ubah status dan jalankan ulang
  window.electronAPI.log(`♻️ Restarting device ${uid}`);
  window.electronAPI.runDevice(uid, service); // ini akan buka window baru
  setDeviceState(uid, "active");
}
// WEB EMULATOR ONLY - target #device-list container
function selectAllDevices(master) {
  document.querySelectorAll("#device-list .select-device").forEach((cb) => {
    cb.checked = master.checked;
  });
}

// Function: Run All Device
// WEB EMULATOR ONLY - target #device-list container
function runAllDevices() {
  const allDevices = document.querySelectorAll("#device-list .device");
  if (allDevices.length === 0) return;
  allDevices.forEach((card) => {
    const uid = card.dataset.uid;
    const service = card.dataset.service;
    if (uid && service) {
      runDevice(uid, service);
    }
  });
}

// Function: Run Selected Device - WEB EMULATOR ONLY
function runSelectedDevices() {
  const selected = Array.from(
    document.querySelectorAll("#device-list .select-device:checked")
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
    document.querySelectorAll("#device-list .select-device:checked")
  );
  if (selected.length === 0) return alert("Pilih device terlebih dahulu!");
  selected.forEach((cb) => {
    const uid = cb.value;
    const service = cb.getAttribute("data-service");
    runDevice(uid, service);
  });
}

function restartAllDevices() {
  const allDevices = document.querySelectorAll("#device-list .device");
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
    document.querySelectorAll("#device-list .select-device:checked")
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
      const card = document.querySelector(`#device-list .device[data-uid="${uid}"]`);
      const status = (card?.dataset.status || "").toLowerCase();
      if (!["active", "running", "starting"].includes(status)) return;
      stopDevice(uid);
    });
  });
}

function stopAllDevices() {
  const allDevices = Array.from(document.querySelectorAll("#device-list .device"));
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

window.changeLayout = function (layout) {
  const desired = layout === "list" ? "list" : "card";
  setStoredLayout(desired);
  const toggle = document.getElementById("layoutToggle");
  if (toggle) {
    toggle.querySelectorAll(".layout-option").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.layout === desired);
    });
  }
  if (document.body) {
    document.body.classList.toggle("list-layout", desired === "list");
  }
};

// ========================================
// ANDROID / iOS SEPARATE FUNCTIONS
// ========================================

// Modal functions for Android
window.openModalAndroid = function () {
  const modal = document.getElementById("addModalAndroid");
  if (!modal) return;

  // Reset form
  document.getElementById("deviceNameAndroid").value = "";
  document.getElementById("deviceAutoRunAndroid").checked = false;

  // Populate Android spec presets
  populateAndroidSpecPreset("androidSpecPresetAdd", "androidSpecDescriptionAdd");

  modal.style.display = "flex";
};

window.closeModalAndroid = function () {
  const modal = document.getElementById("addModalAndroid");
  if (modal) modal.style.display = "none";
};

window.submitAndroidDevice = async function () {
  const name = document.getElementById("deviceNameAndroid").value.trim();
  const autoRun = document.getElementById("deviceAutoRunAndroid").checked;
  const androidSpecSelect = document.getElementById("androidSpecPresetAdd");
  const selectedAndroidSpecId =
    androidSpecSelect?.value || DEFAULT_ANDROID_SPEC_ID;
  const androidSpec = getAndroidSpecPayload(selectedAndroidSpecId);

  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  try {
    const result = await window.electronAPI.addDevice({
      name,
      service: "android",
      autoRun,
      mode: "desktop",
      autoSender: false,
      pendingUrl: "",
      callbackUrl: "",
      customUrl: "",
      androidSpec,
    });

    if (result.success) {
      showToast("✅ Android device berhasil ditambahkan!", 3000, "success");
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

// Edit Android device functions
let editingAndroidDeviceUid = null;

window.openEditAndroidModal = function (uid) {
  const devices = getCachedDevices();
  const device = devices.find((d) => d.uid === uid);
  if (!device) return;

  editingAndroidDeviceUid = uid;

  document.getElementById("editDeviceNameAndroid").value = device.name || "";
  document.getElementById("editAutoRunAndroid").checked = !!device.autoRun;

  // Populate Android spec presets
  populateAndroidSpecPreset(
    "editAndroidSpecPresetAndroid",
    "editAndroidSpecDescriptionAndroid"
  );

  // Set current spec
  const currentSpecId = device.androidSpec?.id || DEFAULT_ANDROID_SPEC_ID;
  const editSpecSelect = document.getElementById("editAndroidSpecPresetAndroid");
  if (editSpecSelect) {
    editSpecSelect.value = currentSpecId;
  }

  const modal = document.getElementById("editModalAndroid");
  if (modal) modal.style.display = "flex";
};

window.closeEditModalAndroid = function () {
  const modal = document.getElementById("editModalAndroid");
  if (modal) modal.style.display = "none";
  editingAndroidDeviceUid = null;
};

window.saveEditAndroidDevice = async function () {
  if (!editingAndroidDeviceUid) return;

  const name = document.getElementById("editDeviceNameAndroid").value.trim();
  const autoRun = document.getElementById("editAutoRunAndroid").checked;
  const androidSpecSelect = document.getElementById(
    "editAndroidSpecPresetAndroid"
  );
  const selectedAndroidSpecId =
    androidSpecSelect?.value || DEFAULT_ANDROID_SPEC_ID;
  const androidSpec = getAndroidSpecPayload(selectedAndroidSpecId);

  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  try {
    const result = await window.electronAPI.editDevice({
      uid: editingAndroidDeviceUid,
      name,
      autoRun,
      mode: "desktop",
      autoSender: false,
      pendingUrl: "",
      callbackUrl: "",
      customUrl: "",
      androidSpec,
    });

    if (result.success) {
      showToast("✅ Android device berhasil diupdate!", 3000, "success");
      closeEditModalAndroid();
      await loadAllDevicesAndroid();
    } else {
      showToast(result.message || "Gagal update device.", 4000, "error");
    }
  } catch (err) {
    console.error("Error editing Android device:", err);
    showToast("Error: " + err.message, 4000, "error");
  }
};

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
window.runAllDevicesAndroid = async function () {
  const data = await window.electronAPI.loadDevices("android");
  const devices = data.devices || [];
  devices.forEach((device) => {
    runDevice(device.uid, device.service);
  });
};

window.runSelectedDevicesAndroid = function () {
  const checkboxes = document.querySelectorAll(
    '#device-list-android input[type="checkbox"][data-device-uid]:checked'
  );
  checkboxes.forEach((cb) => {
    const uid = cb.getAttribute("data-device-uid");
    const service = cb.getAttribute("data-device-service") || "android";
    runDevice(uid, service);
  });
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

// Make loadAllDevices available globally
window.loadAllDevices = loadAllDevices;

// Main switchPage function with device loading
window.switchPage = async function (page) {
  if (typeof event !== "undefined" && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  console.log("🔄 Switching to page:", page);

  window.currentActivePage = page;

  // Hide all pages
  document.querySelectorAll(".page-content").forEach((p) => {
    p.classList.remove("active");
    console.log("  ❌ Hiding page:", p.id);
  });

  // Show target page
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add("active");
    console.log("  ✅ Showing page:", targetPage.id);
  } else {
    console.error("  ⚠️ Target page not found:", `page-${page}`);
  }

  // Update sidebar active state
  document.querySelectorAll(".sidebar-item").forEach((item) => {
    item.classList.remove("active");
  });
  const activeItem = document.querySelector(`.sidebar-item[data-page="${page}"]`);
  if (activeItem) {
    activeItem.classList.add("active");
  }

  // Persist selection
  try {
    localStorage.setItem("starbox-current-page", page);
  } catch (err) {
    console.warn("Unable to persist current page:", err?.message || err);
  }

  // Adjust service list visibility based on page
  if (typeof filterServicesByPage === "function") {
    filterServicesByPage(page);
  }

  // Load devices/content for the current page
  if (page === "web-emulator") {
    console.log("  📱 Loading web devices...");
    await loadAllDevicesWeb();
  } else if (page === "android-ios") {
    console.log("  🤖 Loading Android devices...");
    await loadAllDevicesAndroid();
  } else if (page === "whatsapp-gateway") {
    console.log("  💬 Loading WhatsApp Gateway devices...");
    if (typeof window.loadWAGatewayPage === "function") {
      await window.loadWAGatewayPage();
    } else {
      console.warn("loadWAGatewayPage is not defined.");
    }
  }

  // Close sidebar overlay on mobile after switching pages
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
  }

  if (typeof window.syncVersionDots === "function") {
    window.syncVersionDots();
  }
};
