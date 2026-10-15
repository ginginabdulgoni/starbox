// Android / iOS adalah modul "android-ios"; fungsi-fungsinya hanya ada bila modul terpasang.
const hasAndroidModule = () => typeof loadAllDevicesAndroid === "function";

const DEFAULT_ICON_ASSET = "starbox.png";
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
    id: "android-general",
    label: "General (SCRCPY)",
    color: "#3DDC84",
    url: null,
    category: "Android Remote",
    description: "Kontrol umum perangkat Android via ADB + scrcpy.",
    keywords: ["android", "scrcpy", "remote"],
  },
  {
    id: "android-whatsapp",
    label: "WhatsApp Automation",
    color: "#25D366",
    url: null,
    category: "Android Remote",
    description: "Kontrol WhatsApp di perangkat Android fisik via ADB.",
    keywords: ["android", "whatsapp", "remote"],
  },
  {
    id: "android-tiktok",
    label: "Android • TikTok",
    color: "#010101",
    url: null,
    category: "Android Remote",
    description: "Remote aplikasi TikTok langsung di HP nyata.",
    keywords: ["android", "tiktok"],
  },
  {
    id: "android-youtube",
    label: "Android • YouTube",
    color: "#ff0000",
    url: null,
    category: "Android Remote",
    description: "Kendalikan YouTube Android untuk live/monitor.",
    keywords: ["android", "youtube", "remote"],
  },
  {
    id: "android-instagram",
    label: "Android • Instagram",
    color: "#f77737",
    url: null,
    category: "Android Remote",
    description: "Remote Instagram Marketing & DM di device fisik.",
    keywords: ["android", "instagram", "remote"],
  },
  {
    id: "android-browser",
    label: "Android • Browser",
    color: "#3b82f6",
    url: null,
    category: "Android Remote",
    description: "Remote browser Android umum (Chrome, Firefox).",
    keywords: ["android", "browser", "remote"],
  },
  {
    id: "android-full-remote",
    label: "Android • Full Remote",
    color: "#c084fc",
    url: null,
    category: "Android Remote",
    description:
      "Mode kontrol penuh via ADB/scrcpy untuk aplikasi bebas sesuai kebutuhan.",
    keywords: ["android", "full", "remote"],
  },
  {
    id: "spotify",
    label: "Spotify",
    color: "#1DB954",
    url: "https://open.spotify.com",
    category: "Hiburan",
    description: "Streaming musik, podcast, dan audiobook.",
    keywords: ["spotify", "musik", "streaming", "podcast"],
  },
  {
    id: "radio-garden",
    label: "Radio Garden",
    color: "#00c853",
    url: "https://radio.garden",
    category: "Hiburan",
    description: "Jelajahi radio dari seluruh dunia secara interaktif.",
    keywords: ["radio", "musik", "streaming", "dunia"],
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
let vmListCache = [];

// ── Screen Recording ──────────────────────────────────────────────────────────
const recordingSessions = new Map(); // uid → { recorder, chunks, stream }

async function startRecording(uid, deviceName) {
  if (recordingSessions.has(uid)) {
    showToast("Sedang merekam...", 1500, "info");
    return;
  }
  try {
    const res = await window.electronAPI.getDeviceSourceId(uid);
    if (!res?.ok) {
      showToast("Gagal mendapatkan sumber layar: " + (res?.error || ""), 3000, "error");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: res.sourceId,
        },
      },
    });
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recordingSessions.delete(uid);
      updateRecordButtonState(uid, false);
      const blob = new Blob(chunks, { type: "video/webm" });
      const safeName = (deviceName || "device").replace(/[^a-z0-9]/gi, "_");
      const defaultName = `${safeName}_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      try {
        const saveRes = await window.electronAPI.showSaveDialogRecording(defaultName);
        if (!saveRes.canceled && saveRes.filePath) {
          const buf = await blob.arrayBuffer();
          const arr = Array.from(new Uint8Array(buf));
          await window.electronAPI.invoke("save-recording-file", saveRes.filePath, arr);
          showToast("Recording disimpan.", 2500, "success");
        }
      } catch (_) {
        // Fallback: download via anchor
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast("Recording diunduh.", 2500, "success");
      }
    };
    recorder.start(1000);
    recordingSessions.set(uid, { recorder, chunks, stream });
    updateRecordButtonState(uid, true);
    showToast("Merekam layar...", 2000, "info");
  } catch (err) {
    showToast("Gagal mulai rekam: " + (err?.message || ""), 3500, "error");
  }
}

function stopRecording(uid) {
  const session = recordingSessions.get(uid);
  if (!session) return;
  session.recorder.stop();
}

function updateRecordButtonState(uid, isRecording) {
  const card = document.querySelector(`.device[data-uid="${uid}"]`);
  if (!card) return;
  const btn = card.querySelector(".record-btn");
  if (!btn) return;
  if (isRecording) {
    btn.innerHTML = `<i class="bi bi-stop-circle-fill"></i><span>Stop Rec</span>`;
    btn.classList.add("recording-active");
    btn.title = "Stop Recording";
  } else {
    btn.innerHTML = `<i class="bi bi-record-circle"></i><span>Record</span>`;
    btn.classList.remove("recording-active");
    btn.title = "Rekam layar device";
  }
}

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

window.DEFAULT_SERVICE_LIBRARY = DEFAULT_SERVICE_LIBRARY;

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
const AUTOMATION_MIN_FETCH_INTERVAL_MS = 5000; // minimal 5 detik agar tidak terlalu agresif
const AUTOMATION_RATE_WINDOW_MS = 60000; // 1 menit
const AUTOMATION_FETCH_INTERVAL_MS = 60000; // interval fetch saat antrean kosong
const AUTOMATION_IDLE_FETCH_INTERVAL_MS = 60000; // 60 detik saat antrean kosong
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
// Function to refresh device list (callable from global scope)
window.refreshDeviceList = async function () {
  console.log("🔄 Refreshing device list for page:", window.currentActivePage);
  const activePage =
    window.currentActivePage ||
    document.querySelector(".page-content.active")?.id?.replace(/^page-/, "") ||
    "web-emulator";

  if (activePage === "remox") {
    if (typeof window.initRemoxPage === "function") {
      await window.initRemoxPage();
    }
    return;
  }

  if (activePage === "android-ios") {
    if (typeof loadAllDevicesAndroid === "function") {
      await loadAllDevicesAndroid();
    } else if (typeof renderDevicesAndroid === "function") {
      renderDevicesAndroid(cachedAndroidDevices);
    }
    return;
  }

  if (activePage === "web-emulator" || activePage === "whatsapp-gateway") {
    if (typeof loadAllDevicesWeb === "function") {
      await loadAllDevicesWeb();
    } else if (typeof renderDevices === "function") {
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

const MODE_STORAGE_KEY = "starboxThemeMode";

const THEME_OPTIONS = [
  { id: "default", label: "Indigo" },
  { id: "mint", label: "Mint" },
  { id: "sunset", label: "Sunset" },
  { id: "midnight", label: "Midnight" },
];

let preferredTheme = getStoredTheme();
let activeTheme = preferredTheme;
let preferredThemeMode = getStoredThemeMode();

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
  const currentPage = window.currentActivePage || "web-emulator";
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
  return true;
}

function updateThemeButtons() {
  const wrapper = document.getElementById("themeSelector");
  if (!wrapper) return;
  wrapper
    .querySelectorAll(".theme-option[data-theme]")
    .forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.theme === preferredTheme)
    );
  updateModeButtons();
}

function updateModeButtons() {
  const wrapper = document.getElementById("themeSelector");
  if (!wrapper) return;
  const isDefaultTheme = activeTheme === "default";
  wrapper.querySelectorAll(".theme-option.mode-option").forEach((btn) => {
    btn.classList.toggle(
      "mode-active",
      btn.dataset.mode === preferredThemeMode
    );
    // Disable mode buttons when theme is not default
    btn.style.opacity = isDefaultTheme ? "1" : "0.4";
    btn.style.pointerEvents = isDefaultTheme ? "auto" : "none";
    btn.title = isDefaultTheme ? "" : "Mode hanya tersedia untuk tema Indigo";
  });
}

function applyTheme(themeId, options = {}) {
  const normalized = sanitizeThemeId(themeId);
  activeTheme = normalized;
  const body = document.body;
  if (body) {
    const classes = THEME_OPTIONS.map((theme) => `theme-${theme.id}`);
    body.classList.remove(...classes);
    body.classList.add(`theme-${normalized}`);

    // Reapply mode classes based on new theme
    clearThemeModeClasses();
    if (normalized === "default") {
      body.classList.add(`theme-mode-${preferredThemeMode}`);
    }
  }
  if (!options.skipStore) {
    preferredTheme = normalized;
    setStoredTheme(normalized);
  }
  updateThemeButtons();
}

function syncThemeSelector() {
  const wrapper = document.getElementById("themeSelector");
  const toggleBtn = document.getElementById("themeDropdownToggle");
  if (!wrapper || !toggleBtn) return;
  wrapper.dataset.enabled = "true";
  wrapper.dataset.visible = "false";
  applyTheme(preferredTheme || "default", { skipStore: true });
  toggleBtn.style.setProperty("display", "inline-flex");
  applyThemeMode(preferredThemeMode);
}

function initThemeSelector() {
  const wrapper = document.getElementById("themeSelector");
  if (!wrapper) return;
  wrapper.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.mode) {
        applyThemeMode(btn.dataset.mode);
        return;
      }
      if (!canUseThemeSelector()) return;
      applyTheme(btn.dataset.theme);
    });
  });
}

const DEFAULT_LIMITS = {
  limitBroadcastDay: 10,
  limitAutoReply: 5,
  limitDeviceWAGateway: 1,
};

const authState = {
  isLoggedIn: false,
  user: null,
  deviceQuota: null,
  serverDeviceCount: null,
  guestServiceLimit: 2,
  lastSyncedAt: null,
  package: null,
  isUnlimited: true,
  packageExpiresAt: null,
  allowsPrivateService: true,
  allowsAndroidEmulator: true,
  allowsIosSimulator: true,
  limitDeviceWAGateway: DEFAULT_LIMITS.limitDeviceWAGateway,
  limitAutoReply: DEFAULT_LIMITS.limitAutoReply,
  limitBroadcastDay: DEFAULT_LIMITS.limitBroadcastDay,
};

if (typeof window !== "undefined") {
  window.getCurrentAuthState = () => authState;
}

// Paket dianggap gratis jika: belum login, tidak punya paket, nama paketnya
// free/gratis, atau harganya 0
function isFreePackageTier() {
  if (!authState.isLoggedIn) return true;
  const pkg = authState.package;
  if (!pkg) return true;
  const name = String(pkg.name || "").toLowerCase();
  if (/\bfree\b|\bgratis\b/.test(name)) return true;
  const rawPrice = pkg.price ?? pkg.price_display ?? pkg.priceDisplay;
  if (rawPrice != null) {
    const digits = String(rawPrice).replace(/[^0-9.]/g, "");
    const parsed = parseFloat(digits);
    if (Number.isFinite(parsed)) return parsed <= 0;
  }
  return false;
}

// Fitur remote hanya untuk user login dengan paket berbayar
function canUseRemoteFeatures() {
  return authState.isLoggedIn && !isFreePackageTier();
}

// Tampilkan/sembunyikan tombol Remote Control di toolbar Web Emulator
function updateRemoteUIVisibility() {
  const btn = document.getElementById("btnToolbarRemoteControl");
  if (btn) btn.style.display = canUseRemoteFeatures() ? "inline-flex" : "none";
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
let versionDownloadState = {
  state: "idle", // idle | downloading | downloaded | installing | error
  progress: 0,
  message: "",
  path: "",
};
let packageCountdownTimer = null;
let systemPlatform =
  typeof navigator !== "undefined" ? navigator.userAgent : null;
let lastAuthDeviceSnapshot = {
  loggedIn: authState.isLoggedIn,
  unlimited: authState.isUnlimited,
  limit: getServiceLimitValue(),
};
let isDevBuildCached = null;
const ADS_API_BASE = {
  dev: "http://starbox.test",
  prod: "https://starbox.weagate.com",
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

function getStoredThemeMode() {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "light"; // default: light mode
}

function setStoredThemeMode(value) {
  try {
    localStorage.setItem(
      MODE_STORAGE_KEY,
      value === "light" ? "light" : "dark"
    );
  } catch {}
}

function clearThemeModeClasses() {
  const body = document.body;
  if (!body) return;
  body.classList.remove("theme-mode-dark", "theme-mode-light");
}

function applyThemeMode(mode) {
  const normalized = mode === "light" ? "light" : "dark";
  preferredThemeMode = normalized;
  setStoredThemeMode(normalized);
  const body = document.body;
  if (body) {
    clearThemeModeClasses();
    // Only apply mode classes if current theme is default
    // Other themes (mint, sunset, midnight) use their own color schemes
    if (activeTheme === "default") {
      body.classList.add(`theme-mode-${normalized}`);
    }
  }
  updateModeButtons();
}

function toggleThemeMode() {
  const nextMode = preferredThemeMode === "dark" ? "light" : "dark";
  applyThemeMode(nextMode);
}

function initThemeModeToggle() {
  const modeBtn = document.getElementById("themeModeToggle");
  if (!modeBtn) return;
  modeBtn.addEventListener("click", toggleThemeMode);
  updateModeButtons();
}

function getServiceLimitValue() {
  return Infinity;
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

  const canUseAndroid = hasAndroidModule();
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
  if (hasAndroidModule()) toggleAndroidSpecSection(serviceSelect.value === "android");
  renderServiceBrowserGrid();
}

function updateCachedDevices(list = [], type = "web") {
  const deviceList = Array.isArray(list) ? list.slice() : [];

  if (type === "android") {
    if (hasAndroidModule()) cachedAndroidDevices = deviceList;
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
  return { allowed: true };
}

const FREE_UNLIMITED_SLOGAN =
  "Gratis selamanya • Tanpa biaya bulanan • Tanpa iklan";

function updateDeviceQuotaBanner() {
  const quotaEl = document.getElementById("accountQuotaSummary");
  const packageEl = document.getElementById("accountPackageSummary");
  const used = cachedDevices.length;

  if (quotaEl) {
    if (authState.isLoggedIn) {
      if (authState.isUnlimited) {
        quotaEl.textContent = `Unlimited per layanan • Total device saat ini ${used} • ${FREE_UNLIMITED_SLOGAN}`;
      } else {
        const limit = getServiceLimitValue();
        quotaEl.textContent = `Batas per layanan: ${limit} device • Total device saat ini ${used}`;
      }
    } else {
      quotaEl.textContent = `Mode tamu • Unlimited per layanan • Total device saat ini ${used} • ${FREE_UNLIMITED_SLOGAN}`;
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
  const layoutToggle = document.getElementById("layoutToggle");

  // Update navbar buttons
  if (authState.isLoggedIn) {
    const displayName =
      authState.user?.name || authState.user?.email || "Pengguna";

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
  const prevRemoteAllowed = canUseRemoteFeatures();

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
  authState.isUnlimited = true;
  authState.packageExpiresAt = session.packageExpiresAt || null;
  authState.limitDeviceWAGateway = Infinity;
  authState.limitAutoReply = Infinity;
  authState.limitBroadcastDay = Infinity;
  authState.allowsPrivateService = true;
  authState.allowsAndroidEmulator = true;
  authState.allowsIosSimulator = true;

  if (typeof session.guestServiceLimit === "number") {
    authState.guestServiceLimit = Infinity;
  }
  if (!authState.isUnlimited && typeof authState.deviceQuota !== "number") {
    authState.deviceQuota = Infinity;
  }
  if (!authState.isLoggedIn) {
    authState.package = null;
    authState.isUnlimited = true;
    authState.deviceQuota = Infinity;
    authState.packageExpiresAt = null;
    authState.allowsPrivateService = true;
    authState.allowsAndroidEmulator = true;
    authState.allowsIosSimulator = true;
    authState.limitDeviceWAGateway = Infinity;
    authState.limitAutoReply = Infinity;
    authState.limitBroadcastDay = Infinity;
  }
  if (authState.limitDeviceWAGateway == null) {
    authState.limitDeviceWAGateway = Infinity;
  }
  if (authState.limitAutoReply == null) {
    authState.limitAutoReply = Infinity;
  }
  if (authState.limitBroadcastDay == null) {
    authState.limitBroadcastDay = Infinity;
  }
  ensurePackageCountdownTimer();
  updateAuthHeaderUI();
  updateDeviceQuotaBanner();
  syncServiceAvailability();
  updateAddDeviceQuotaHint();
  if (typeof updateIOSButtonVisibility === "function") updateIOSButtonVisibility();
  updateRemoteUIVisibility();
  const nextLimit = getServiceLimitValue();
  const shouldReload =
    prevLoggedIn !== authState.isLoggedIn ||
    prevUnlimited !== authState.isUnlimited ||
    prevLimit !== nextLimit ||
    prevRemoteAllowed !== canUseRemoteFeatures();
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

async function refreshAuthState() {
  if (!window.electronAPI?.auth?.getSession) return;
  try {
    const currentSession = await window.electronAPI.auth.getSession();
    if (currentSession) {
      applyAuthSession(currentSession);
    }
  } catch (err) {
    console.error("⚠️ Gagal memuat sesi auth:", err);
  }
}

async function initAuthFlow() {
  if (!window.electronAPI?.auth) {
    console.warn("Auth API tidak tersedia di preload.");
    return;
  }

  try {
    await refreshAuthState();
    if (typeof window.loadWAGatewayPage === "function") {
      window.loadWAGatewayPage();
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
      if (result.session) {
        applyAuthSession(result.session);
      }
      if (rememberMe) {
        saveRememberedLogin(email, true);
      } else {
        saveRememberedLogin("", false);
      }
      showToast(result.message || "Berhasil login.", 3500, "success");
      await refreshAuthState();
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
      showToast(result.message || window.t('toast.register.success'), 3500, "success");
      if (result.autoLogin) {
        closeAuthModal();
      } else {
        switchAuthTab("login");
        const loginEmail = document.getElementById("loginEmail");
        if (loginEmail) loginEmail.value = email;
      }
    } else {
      showToast(result.message || window.t('toast.register.failed'), 4000, "error");
    }
  } catch (err) {
    console.error("Registrasi error:", err);
    showToast(window.t('toast.register.error'), 4000, "error");
  } finally {
    setAuthFormLoading("registerSubmitButton", false, window.t('form.register.btn'));
  }
}

function handleLogout() {
  if (!window.electronAPI?.auth) return;
  Swal.fire({
    title: window.t('dialog.logout.title'),
    text: window.t('dialog.logout.text'),
    icon: "question",
    showCancelButton: true,
    confirmButtonText: window.t('dialog.logout.confirm'),
    cancelButtonText: window.t('dialog.logout.cancel'),
    confirmButtonColor: "#ef4444",
  }).then((result) => {
    if (!result.isConfirmed) return;
    window.electronAPI.auth
      .logout()
      .then(() => {
        showToast(window.t('toast.logout.success'), 3000, "success");
        closeAccountModal();
        closeAuthModal();
      })
      .catch((err) => {
        console.error("Logout error:", err);
        showToast(window.t('toast.logout.error'), 3500, "error");
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

function openPackageFromAccount() {
  closeAccountModal();
  if (typeof openPackageModal === "function") {
    openPackageModal();
  }
}

function closeAccountModal() {
  const modal = document.getElementById("accountModal");
  if (modal) {
    modal.style.display = "none";
  }
  // Reset change password form when modal closes
  const form = document.getElementById("changePasswordForm");
  if (form) form.style.display = "none";
  const chevron = document.getElementById("changePasswordChevron");
  if (chevron) chevron.classList.remove("open");
  ["cpCurrentPassword", "cpNewPassword", "cpConfirmPassword"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const msg = document.getElementById("cpMessage");
  if (msg) msg.style.display = "none";
}

function toggleChangePasswordForm() {
  const form = document.getElementById("changePasswordForm");
  const chevron = document.getElementById("changePasswordChevron");
  if (!form) return;
  const isOpen = form.style.display !== "none";
  form.style.display = isOpen ? "none" : "block";
  chevron?.classList.toggle("open", !isOpen);
}

async function submitChangePassword() {
  const currentPassword = document.getElementById("cpCurrentPassword")?.value || "";
  const newPassword = document.getElementById("cpNewPassword")?.value || "";
  const confirmPassword = document.getElementById("cpConfirmPassword")?.value || "";
  const msgEl = document.getElementById("cpMessage");
  const btn = document.getElementById("cpSubmitBtn");

  function showCpMessage(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.display = "block";
    msgEl.style.background = isError ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)";
    msgEl.style.color = isError ? "#f87171" : "#4ade80";
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    showCpMessage("Semua field wajib diisi.", true);
    return;
  }
  if (newPassword !== confirmPassword) {
    showCpMessage("Password baru dan konfirmasi tidak cocok.", true);
    return;
  }
  if (newPassword.length < 8) {
    showCpMessage("Password baru minimal 8 karakter.", true);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
  }

  try {
    const result = await window.electronAPI.auth.changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (result.success) {
      showCpMessage(result.message || "Password berhasil diubah.", false);
      ["cpCurrentPassword", "cpNewPassword", "cpConfirmPassword"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
    } else {
      showCpMessage(result.message || "Gagal mengubah password.", true);
    }
  } catch (err) {
    showCpMessage("Terjadi kesalahan. Coba lagi.", true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Simpan Password";
    }
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
  let platform = null;

  if (
    typeof window !== "undefined" &&
    typeof window.electronAPI?.platform === "function"
  ) {
    platform = window.electronAPI.platform();
  } else if (typeof process !== "undefined" && process.platform) {
    platform = process.platform;
  } else if (typeof navigator !== "undefined" && navigator.platform) {
    platform = navigator.platform;
  }

  if (!platform) return null;

  const normalized = platform.toString().toLowerCase();
  if (normalized === "darwin" || normalized.startsWith("mac")) return "mac";
  if (normalized === "win32" || normalized.includes("win")) return "windows";
  if (normalized.includes("linux")) return "linux";
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
      downloadBtn.style.display = "inline-flex";
      const label = preferred.platform
        ? `Download ${preferred.platform.toUpperCase()}`
        : "Download";
      const labelNode = document.getElementById("versionDownloadLabel");
      if (labelNode) {
        labelNode.textContent = label;
      } else {
        downloadBtn.innerHTML = `<i class="bi bi-download"></i> ${label}`;
      }
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

function resetVersionDownloadState() {
  versionDownloadState = {
    state: "idle",
    progress: 0,
    message: "",
    path: "",
  };
}

function updateVersionDownloadUI() {
  const statusBox = document.getElementById("versionDownloadStatus");
  const textEl = document.getElementById("versionDownloadText");
  const bar = document.getElementById("versionDownloadBar");
  const downloadBtn = document.getElementById("versionAlertDownload");

  if (!statusBox || !textEl || !bar) return;

  if (versionDownloadState.state === "idle") {
    statusBox.style.display = "none";
    bar.style.width = "0%";
    if (downloadBtn) downloadBtn.disabled = false;
    return;
  }

  statusBox.style.display = "block";
  const pct =
    versionDownloadState.progress &&
    Number.isFinite(versionDownloadState.progress)
      ? Math.min(100, Math.max(0, versionDownloadState.progress))
      : 0;
  bar.style.width = `${pct}%`;

  const human = versionDownloadState.message || "";
  const label =
    versionDownloadState.state === "downloading"
      ? `Menyiapkan unduhan... ${pct}%`
      : versionDownloadState.state === "installing"
      ? "Membuka halaman download..."
      : versionDownloadState.state === "downloaded"
      ? "Link download dibuka."
      : versionDownloadState.state === "error"
      ? `Gagal: ${human || "Terjadi kesalahan"}`
      : human || "Menyiapkan unduhan...";

  textEl.textContent = label;
  if (downloadBtn) {
    downloadBtn.disabled = versionDownloadState.state === "downloading";
  }
}

async function startVersionDownload() {
  if (!latestVersionInfo) {
    showToast("Belum ada info versi terbaru.", 3000, "warning");
    return;
  }
  if (!window.electronAPI?.downloadVersion) {
    showToast("Fitur download belum siap di environment ini.", 3000, "error");
    return;
  }
  const preferred = getPreferredDownload(latestVersionInfo);
  if (!preferred?.url) {
    showToast(
      "URL unduhan tidak tersedia untuk platform ini.",
      3000,
      "warning"
    );
    return;
  }

  resetVersionDownloadState();
  versionDownloadState.state = "downloading";
  versionDownloadState.progress = 100;
  updateVersionDownloadUI();
  showToast("Membuka link download StarBox...", 2000, "info");

  try {
    const result = await window.electronAPI.downloadVersion({
      url: preferred.url,
      filename:
        preferred.filename ||
        `starbox-${preferred.platform || "update"}-${
          latestVersionInfo.version
        }`,
      platform:
        preferred.platform ||
        (typeof window.electronAPI?.platform === "function"
          ? window.electronAPI.platform()
          : process.platform),
      openExternalOnly: true,
      channel: latestVersionInfo.channel || "stable",
      version: latestVersionInfo.version,
    });
    if (!result?.success) {
      versionDownloadState.state = "error";
      versionDownloadState.message = result?.message || "Gagal membuka link download.";
      updateVersionDownloadUI();
      showToast(versionDownloadState.message, 4000, "error");
      return;
    }
    versionDownloadState.state = "downloaded";
    versionDownloadState.progress = 100;
    versionDownloadState.path = result.url || preferred.url || "";
    versionDownloadState.message = "Halaman download StarBox dibuka.";
    updateVersionDownloadUI();
    showToast(
      "Link download versi terbaru sudah dibuka.",
      4000,
      "success"
    );
  } catch (err) {
    versionDownloadState.state = "error";
    versionDownloadState.message = err?.message || "Gagal membuka link download.";
    updateVersionDownloadUI();
    showToast(versionDownloadState.message, 4000, "error");
  }
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
    resetVersionDownloadState();
    updateVersionDownloadUI();
    if (isNewer) {
      renderVersionBanner(info);
      if (!hasShownVersionDialog || options.showAlways) {
        showVersionInfoDialog(info);
        hasShownVersionDialog = true;
      }
    } else {
      renderVersionBanner(null);
      updateVersionDownloadUI();
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
      fetchIntervalMs: AUTOMATION_FETCH_INTERVAL_MS,
      sendRatePerMinute: null,
      rateWindowStart: null,
      rateWindowSent: 0,
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

  const sanitizedInterval =
    sanitizeFetchIntervalMs(session.fetchIntervalMs) ??
    AUTOMATION_FETCH_INTERVAL_MS;
  session.fetchIntervalMs = sanitizedInterval;

  const sanitizedRate = sanitizeMessagesPerMinute(session.sendRatePerMinute);
  session.sendRatePerMinute = sanitizedRate;
  if (!sanitizedRate) {
    session.rateWindowStart = null;
    session.rateWindowSent = 0;
  } else {
    if (!session.rateWindowStart) {
      session.rateWindowStart = Date.now();
      session.rateWindowSent = 0;
    } else if (!Number.isFinite(session.rateWindowSent)) {
      session.rateWindowSent = 0;
    }
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

function sanitizeFetchIntervalMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.max(AUTOMATION_MIN_FETCH_INTERVAL_MS, Math.round(num));
}

function getSessionFetchIntervalMs(session = getActiveSession()) {
  if (!session) return AUTOMATION_IDLE_FETCH_INTERVAL_MS;
  const sanitized =
    sanitizeFetchIntervalMs(session.fetchIntervalMs) ??
    sanitizeFetchIntervalMs(AUTOMATION_FETCH_INTERVAL_MS);
  return sanitized ?? AUTOMATION_FETCH_INTERVAL_MS;
}

function sanitizeMessagesPerMinute(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.max(1, Math.floor(num));
}

function getSendRateState(session = getActiveSession(), nowMs = Date.now()) {
  const limit = sanitizeMessagesPerMinute(session?.sendRatePerMinute);
  if (!limit) {
    return { limit: null, remaining: Infinity, resetInMs: 0 };
  }

  let windowStart = session.rateWindowStart || nowMs;
  let used = Number.isFinite(session.rateWindowSent)
    ? session.rateWindowSent
    : 0;

  if (nowMs - windowStart >= AUTOMATION_RATE_WINDOW_MS) {
    windowStart = nowMs;
    used = 0;
  }

  const remaining = Math.max(0, limit - used);
  const resetInMs = Math.max(
    0,
    AUTOMATION_RATE_WINDOW_MS - (nowMs - windowStart)
  );

  return { limit, remaining, resetInMs, windowStart, used };
}

function getNextFetchIntervalMs(session = getActiveSession()) {
  if (!session) return AUTOMATION_IDLE_FETCH_INTERVAL_MS;
  const pendingCount = pendingAutomationCount(session);
  if (pendingCount > 0) {
    return null; // hentikan fetch saat masih ada antrian pending
  }
  return getSessionFetchIntervalMs(session);
}

function scheduleNextAutomationFetch(
  baseTimeMs = Date.now(),
  session = getActiveSession(),
  intervalMs = null
) {
  if (!session) return;
  const delay =
    intervalMs != null ? intervalMs : getNextFetchIntervalMs(session);
  if (delay == null) {
    clearNextAutomationFetch(session);
    return;
  }
  const nextAtIso = new Date(baseTimeMs + delay).toISOString();
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

function extractUrlRoot(url = "") {
  const sanitized = sanitizePendingUrl(url);
  if (!sanitized) return "";
  try {
    const parsed = new URL(sanitized);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    const match = sanitized.match(/^([a-z]+:\/\/[^/]+)/i);
    return match ? match[1].replace(/\/+$/, "") : sanitized;
  }
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
  return buildUrlWithDefaultPath(
    extractUrlRoot(pendingUrl),
    "/schedule/updatestatusmessage"
  );
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
    fetchIntervalMs: getSessionFetchIntervalMs(session),
    messagesPerMinute: sanitizeMessagesPerMinute(session.sendRatePerMinute),
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
    scheduleNextAutomationFetch(
      Date.now(),
      session,
      getNextFetchIntervalMs(session)
    );

    broadcastAutomationMonitor(session, {
      lastFetch: timestamp,
      error: null,
      typing: false,
      activeId: null,
    });

    // Otomatis picu pengiriman segera jika ada pesan pending di antrean
    const pendingCount = (session.messages || []).filter(
      (item) => item.status !== "done"
    ).length;
    if (pendingCount > 0 && !session.isSending && !session.isPaused) {
      ensureAutomationLoop();
      setTimeout(() => {
        runAutomationTickForSession(session).catch((err) =>
          console.error("Auto tick trigger error:", err)
        );
      }, 300);
    }
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
    scheduleNextAutomationFetch(
      Date.now(),
      session,
      getNextFetchIntervalMs(session)
    );

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

  if (automationSessions.size > 0) {
    ensureAutomationLoop();
  }
}

function pendingAutomationCount(session = getActiveSession()) {
  if (!session) return 0;
  return (session.messages || []).filter((item) => item.status !== "done")
    .length;
}

function applyAutomationSettingsUpdate(uid, payload = {}) {
  if (!uid || !payload || typeof payload !== "object") return;
  const session = automationSessions.get(uid);
  if (!session) return;

  let changed = false;

  if ("fetchIntervalMs" in payload) {
    const sanitized =
      sanitizeFetchIntervalMs(payload.fetchIntervalMs) ??
      AUTOMATION_FETCH_INTERVAL_MS;
    if (session.fetchIntervalMs !== sanitized) {
      session.fetchIntervalMs = sanitized;
      changed = true;
    }
    const delay = getNextFetchIntervalMs(session);
    scheduleNextAutomationFetch(Date.now(), session, delay);
    if (!session.isPaused) {
      if (session.fetchRunner) {
        rescheduleDeviceFetchTimer(session);
      } else if (session.pendingUrl) {
        startDeviceFetchTimer(session);
      }
    }
  }

  if ("messagesPerMinute" in payload) {
    const sanitizedRate = sanitizeMessagesPerMinute(payload.messagesPerMinute);
    if (session.sendRatePerMinute !== sanitizedRate) {
      session.sendRatePerMinute = sanitizedRate;
      session.rateWindowStart = sanitizedRate ? Date.now() : null;
      session.rateWindowSent = 0;
      changed = true;
    }
  }

  if (changed) {
    broadcastAutomationMonitor(session, {
      fetchIntervalMs: getSessionFetchIntervalMs(session),
      messagesPerMinute: sanitizeMessagesPerMinute(session.sendRatePerMinute),
    });
    if (isSessionActive(session)) {
      persistActiveAutomationSession();
    }
  }
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

let systemInfoBadgeRetryCount = 0;
const SYSTEM_INFO_BADGE_MAX_RETRIES = 3;

async function loadSystemInfoBadge() {
  const badge = document.getElementById("system-info-badge");
  if (badge) {
    badge.textContent = "Mengambil info…";
  }
  try {
    const info = await window.electronAPI.getSystemInfo();
    renderSystemInfoBadge(info);
    systemPlatform =
      info?.platform || info?.system || info?.release || navigator.userAgent;
    if (typeof updateIOSButtonVisibility === "function") updateIOSButtonVisibility();
    systemInfoBadgeRetryCount = 0;
  } catch (err) {
    console.error("⚠️ Gagal memuat system info:", err);
    renderSystemInfoBadge(null, err);
    systemPlatform =
      typeof navigator !== "undefined" ? navigator.userAgent : null;
    if (typeof updateIOSButtonVisibility === "function") updateIOSButtonVisibility();
    systemInfoBadgeRetryCount += 1;
    if (systemInfoBadgeRetryCount < SYSTEM_INFO_BADGE_MAX_RETRIES) {
      setTimeout(loadSystemInfoBadge, 1500 * systemInfoBadgeRetryCount);
    }
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

  if (Array.isArray(cachedWebDevices)) {
    const found = cachedWebDevices.find((d) => d.uid === uid);
    if (found) found.status = normalized;
    if (typeof updateDashboardMetrics === "function") {
      updateDashboardMetrics(cachedWebDevices);
    }
  }
}

let currentDeviceFilter = "all";

function updateDashboardMetrics(webDevices = []) {
  const total = webDevices.length;
  let running = 0;
  let waCount = 0;
  let autoSenderCount = 0;
  let tiktokCount = 0;
  let stoppedCount = 0;

  webDevices.forEach((device) => {
    const isRunning =
      (typeof isDeviceRunning === "function" && isDeviceRunning(device.uid)) ||
      ["active", "running", "starting"].includes(
        (device.status || "").toLowerCase()
      );
    const service = (device.service || "").toLowerCase();
    if (isRunning) {
      running++;
    } else {
      stoppedCount++;
    }

    if (service.includes("whatsapp") || service === "wa") {
      waCount++;
    }
    if (service.includes("tiktok")) {
      tiktokCount++;
    }
    if (device.autoSender) {
      autoSenderCount++;
    }
  });

  const totalEl = document.getElementById("metricTotalDevices");
  if (totalEl) totalEl.textContent = total;
  const runningEl = document.getElementById("metricRunningDevices");
  if (runningEl) runningEl.textContent = running;
  const waEl = document.getElementById("metricWaDevices");
  if (waEl) waEl.textContent = waCount;
  const autoEl = document.getElementById("metricAutoSenderDevices");
  if (autoEl) autoEl.textContent = autoSenderCount;

  const bAll = document.getElementById("badgeFilterAll");
  if (bAll) bAll.textContent = total;
  const bRunning = document.getElementById("badgeFilterRunning");
  if (bRunning) bRunning.textContent = running;
  const bWa = document.getElementById("badgeFilterWa");
  if (bWa) bWa.textContent = waCount;
  const bTiktok = document.getElementById("badgeFilterTiktok");
  if (bTiktok) bTiktok.textContent = tiktokCount;
  const bAuto = document.getElementById("badgeFilterAutoSender");
  if (bAuto) bAuto.textContent = autoSenderCount;
  const bStopped = document.getElementById("badgeFilterStopped");
  if (bStopped) bStopped.textContent = stoppedCount;
}

function filterDevicesByChip(devices = []) {
  if (!currentDeviceFilter || currentDeviceFilter === "all") return devices;
  return devices.filter((device) => {
    const isRunning =
      (typeof isDeviceRunning === "function" && isDeviceRunning(device.uid)) ||
      ["active", "running", "starting"].includes(
        (device.status || "").toLowerCase()
      );
    const service = (device.service || "").toLowerCase();
    switch (currentDeviceFilter) {
      case "running":
        return isRunning;
      case "stopped":
        return !isRunning;
      case "wa":
        return service.includes("whatsapp") || service === "wa";
      case "tiktok":
        return service.includes("tiktok");
      case "autosender":
        return !!device.autoSender;
      default:
        return true;
    }
  });
}

window.applyDeviceFilter = function (filter) {
  currentDeviceFilter = filter || "all";
  const chips = document.querySelectorAll("#deviceFilterChips .filter-chip");
  chips.forEach((chip) => {
    if (chip.dataset.filter === currentDeviceFilter) {
      chip.classList.add("is-active");
    } else {
      chip.classList.remove("is-active");
    }
  });

  if (Array.isArray(cachedWebDevices) && cachedWebDevices.length) {
    renderDevices(cachedWebDevices);
  } else if (Array.isArray(cachedDevices) && cachedDevices.length) {
    renderDevices(cachedDevices);
  }
};

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
  const webDevices = devices.filter(
    (d) => (d.service || "").toLowerCase() !== "android"
  );

  updateDashboardMetrics(webDevices);

  const chipFilteredDevices = filterDevicesByChip(webDevices);
  const filteredDevices = filterDevicesBySearch(chipFilteredDevices);
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
    if (isSearching) {
      emptyState.textContent = "Tidak ada device yang cocok dengan pencarian Anda.";
    } else {
      const mainLine = document.createElement("div");
      mainLine.textContent =
        "Belum ada device yang dapat ditampilkan untuk konfigurasi saat ini.";
      const sloganLine = document.createElement("div");
      sloganLine.className = "device-empty-state-slogan";
      sloganLine.textContent = FREE_UNLIMITED_SLOGAN;
      emptyState.appendChild(mainLine);
      emptyState.appendChild(sloganLine);
    }
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

    const showRemoteToggle = canUseRemoteFeatures();
    const remoteEnabled = showRemoteToggle && device.remoteEnabled !== false;
    deviceCard.dataset.remoteEnabled = remoteEnabled ? "true" : "false";

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
        ${showRemoteToggle ? `
        <div class="device-remote-toggle" title="Remote Control">
          <label class="device-remote-label">
            <span class="device-remote-text"><i class="bi bi-broadcast"></i> Remote</span>
            <input type="checkbox" class="remote-toggle-input" ${remoteEnabled ? "checked" : ""}>
            <span class="remote-toggle-slider"></span>
          </label>
        </div>` : ""}
        <div class="device-actions">
          <button class="run" title="${isActive ? 'Restart Device' : 'Jalankan Device'}">
            <i class="bi ${runIcon}"></i>
            <span>${runLabel}</span>
          </button>
          <button class="open-window" title="Buka di Window Baru">
            <i class="bi bi-window-plus"></i>
          </button>
          <div class="device-more-wrapper">
            <button class="device-more" title="Menu Opsi Lainnya" type="button" aria-label="Menu Opsi">
              <i class="bi bi-three-dots-vertical"></i>
            </button>
            <div class="device-dropdown">
              <button type="button" class="dropdown-action edit" data-uid="${device.uid}">
                <i class="bi bi-pencil-square"></i>
                <span>Edit Device</span>
              </button>
              <button type="button" class="dropdown-action record-btn" title="Rekam layar device">
                <i class="bi bi-record-circle"></i>
                <span>Rekam Layar</span>
              </button>
              <div class="dropdown-separator"></div>
              <button type="button" class="dropdown-action delete" title="Hapus device">
                <i class="bi bi-trash-fill"></i>
                <span>Hapus Device</span>
              </button>
            </div>
          </div>
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
    const openWindowButton = deviceCard.querySelector(".open-window");
    const deleteButton = deviceCard.querySelector(".delete");
    const editButton = deviceCard.querySelector(".edit");
    const recordButton = deviceCard.querySelector(".record-btn");
    const remoteToggleInput = deviceCard.querySelector(".remote-toggle-input");
    const moreButton = deviceCard.querySelector(".device-more");
    const dropdown = deviceCard.querySelector(".device-dropdown");

    moreButton?.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const alreadyOpen = dropdown?.classList.contains("show");
      document
        .querySelectorAll(".device-dropdown.show")
        .forEach((el) => {
          el.classList.remove("show");
          el.closest(".device")?.classList.remove("dropdown-open");
        });
      if (!alreadyOpen && dropdown) {
        dropdown.classList.add("show");
        deviceCard.classList.add("dropdown-open");
      } else {
        deviceCard.classList.remove("dropdown-open");
      }
    });

    remoteToggleInput?.addEventListener("change", async (e) => {
      const newEnabled = e.target.checked;
      deviceCard.dataset.remoteEnabled = newEnabled ? "true" : "false";
      try {
        await window.electronAPI.toggleRemoteEnabled(device.uid, newEnabled);
      } catch (err) {
        console.error("Gagal toggle remote:", err);
        e.target.checked = !newEnabled;
        deviceCard.dataset.remoteEnabled = (!newEnabled) ? "true" : "false";
      }
    });

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

    openWindowButton?.addEventListener("click", async () => {
      const originalHTML = openWindowButton.innerHTML;
      openWindowButton.innerHTML = `<i class="bi bi-arrow-repeat"></i> <span>...</span>`;
      openWindowButton.disabled = true;
      try {
        await runDeviceInNewWindow(device.uid, device.service);
        setDeviceState(device.uid, "active");
      } catch (err) {
        console.error("Gagal membuka window baru:", err);
      }
      openWindowButton.disabled = false;
      openWindowButton.innerHTML = originalHTML;
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

    deleteButton?.addEventListener("click", (e) => {
      e?.stopPropagation();
      dropdown?.classList.remove("show");
      deleteDevice(device.uid);
    });
    editButton?.addEventListener("click", (e) => {
      e?.stopPropagation();
      dropdown?.classList.remove("show");
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
      if (typeof window.setEditChromeNativeState === "function") {
        window.setEditChromeNativeState(!!device.useChromeNative);
      } else {
        const chromeCheckbox = document.getElementById("editUseChromeNative");
        if (chromeCheckbox) {
          chromeCheckbox.checked = !!device.useChromeNative;
        }
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
      if (editSpecSelect && hasAndroidModule()) {
        editSpecSelect.value =
          device.androidSpec?.id || DEFAULT_ANDROID_SPEC_ID;
        updateAndroidSpecDescription(
          "editAndroidSpecPreset",
          "editAndroidSpecDescription"
        );
      }
      if (typeof window.refreshEditAndroidSpecUI === "function") {
        window.refreshEditAndroidSpecUI();
      } else if (hasAndroidModule()) {
        toggleEditAndroidSpecSection(
          (device.service || "").toLowerCase() === "android"
        );
      }

      if (typeof window.openEditModal === "function") {
        window.openEditModal();
      } else {
        const m = document.getElementById("editModal");
        if (m) m.style.display = "flex";
      }
    });

    // Record button
    recordButton?.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown?.classList.remove("show");
      if (recordingSessions.has(device.uid)) {
        stopRecording(device.uid);
      } else {
        const currentStatus = (deviceCard.dataset.status || "").toLowerCase();
        if (currentStatus !== "active" && currentStatus !== "running") {
          showToast("Jalankan device terlebih dahulu sebelum merekam.", 2500, "info");
          return;
        }
        startRecording(device.uid, device.name);
      }
    });

    // Click anywhere on card (not on buttons/inputs) → focus window if running
    deviceCard.addEventListener("click", (e) => {
      if (e.target.closest("button, input, label, a, select")) return;
      const currentStatus = (deviceCard.dataset.status || "").toLowerCase();
      if (currentStatus === "active" || currentStatus === "running") {
        window.electronAPI?.focusDevice(device.uid);
      }
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
  let isRunning = false;
  if (card) {
    const currentStatus = (card.dataset.status || "").toLowerCase();
    isRunning = ["active", "running"].includes(currentStatus);
  }
  if (!isRunning && window.electronAPI?.isDeviceRunning) {
    try {
      isRunning = await window.electronAPI.isDeviceRunning(session.uid);
    } catch (_) {}
  }
  if (!isRunning) {
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
    const rateState = getSendRateState(session);
    if (rateState.limit) {
      session.rateWindowStart = rateState.windowStart;
      session.rateWindowSent = rateState.used;
    }

    const allowedByRate =
      rateState.limit == null
        ? effectiveLimit
        : Math.min(effectiveLimit, rateState.remaining);

    const batchSize =
      allowedByRate === Infinity
        ? pending.length
        : Math.max(0, Math.min(pending.length, allowedByRate));

    const batch =
      batchSize >= pending.length ? pending : pending.slice(0, batchSize);

    if (!batch.length) {
      if (rateState.limit && rateState.remaining <= 0) {
        console.log(
          `⏸️ Batas ${rateState.limit} pesan/menit tercapai untuk ${session.uid}, menunggu ${Math.ceil(
            rateState.resetInMs / 1000
          )}s`
        );
      }
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

    if (rateState.limit) {
      session.rateWindowStart =
        rateState.windowStart || session.rateWindowStart || Date.now();
      const nextCount = (session.rateWindowSent || 0) + batch.length;
      session.rateWindowSent = Math.min(rateState.limit, nextCount);
    }

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
    rescheduleDeviceFetchTimer(session);
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
    clearTimeout(session.fetchTimer);
    session.fetchTimer = null;
    console.log(`⏹️ Fetch timer stopped for device ${session.uid}`);
  }
  if (session) {
    session.fetchRunner = null;
  }
}

function rescheduleDeviceFetchTimer(session) {
  if (!session || !session.pendingUrl || typeof session.fetchRunner !== "function") {
    return;
  }
  clearTimeout(session.fetchTimer);
  const delay = getNextFetchIntervalMs(session);
  if (delay == null) {
    clearNextAutomationFetch(session);
    session.fetchTimer = null;
    console.log(
      `⏸️ Fetch ditahan untuk ${session.uid} karena antrean masih pending`
    );
    return;
  }
  scheduleNextAutomationFetch(Date.now(), session, delay);
  session.fetchTimer = setTimeout(session.fetchRunner, delay);
  console.log(
    `🔁 Fetch timer diatur ulang untuk ${session.uid} (${Math.round(
      delay / 1000
    )}s)`
  );
}

// Start fetch timer untuk device tertentu (interval independen per device)
function startDeviceFetchTimer(session) {
  if (!session || !session.pendingUrl) return;

  // Stop timer lama jika ada
  stopDeviceFetchTimer(session);

  const runFetchLoop = async () => {
    session.fetchTimer = null;
    if (pendingAutomationCount(session) > 0) {
      clearNextAutomationFetch(session);
      console.log(
        `⏸️ Skip fetch untuk ${session.uid} karena antrean masih pending`
      );
      return;
    }
    try {
      await refreshAutomationMessagesForSession(session, { silent: true });
    } catch (err) {
      console.error(`Fetch error for ${session.uid}:`, err);
    } finally {
      const delay = getNextFetchIntervalMs(session);
      if (delay == null) {
        clearNextAutomationFetch(session);
        session.fetchTimer = null;
        console.log(
          `⏸️ Fetch ditahan untuk ${session.uid} karena antrean belum kosong`
        );
        return;
      }
      scheduleNextAutomationFetch(Date.now(), session, delay);
      session.fetchTimer = setTimeout(runFetchLoop, delay);
      console.log(
        `▶️ Fetch timer set for ${session.uid} (${Math.round(delay / 1000)}s)`
      );
    }
  };

  session.fetchRunner = runFetchLoop;
  // Jalankan segera lalu lanjut sesuai interval dinamis
  runFetchLoop();
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

async function runAutomationTickForSession(session) {
  if (!session) return false;

  if (session.isSending) return false;
  if (!session.pendingUrl) return false;

  const normalizedService = (session.service || "").toLowerCase();
  if (normalizedService !== "wa") {
    return false;
  }

  const card = document.querySelector(`.device[data-uid="${session.uid}"]`);
  let isRunning = false;
  if (card) {
    const status = (card.dataset.status || "").toLowerCase();
    isRunning = ["active", "running"].includes(status);
  }
  if (!isRunning && window.electronAPI?.isDeviceRunning) {
    try {
      isRunning = await window.electronAPI.isDeviceRunning(session.uid);
    } catch (_) {}
  }
  if (!isRunning) {
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
    limit: pendingMessages.length || Infinity,
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
      sessions.map((session) => runAutomationTickForSession(session))
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

      const delay = getNextFetchIntervalMs(session);
      if (delay == null) {
        clearNextAutomationFetch(session);
        return;
      }

      scheduleNextAutomationFetch(Date.now(), session, delay);
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

async function loadAllDevices() {
  try {
    await Promise.all([loadAllDevicesWeb(), hasAndroidModule() ? loadAllDevicesAndroid() : null]);
  } catch (err) {
    console.error("⚠️ Gagal memuat daftar device:", err);
  }
}

function runDevice(uid, service) {
  window.electronAPI.runDevice(uid, service);
  setDeviceState(uid, "active");
  if ((service || "").toLowerCase() === "android" && hasAndroidModule()) {
    maybeOpenAndroidWhatsAppDisplay(uid, {
      delayMs: 1200,
      silent: true,
      silentSuccess: true,
    }).catch(() => {});
    maybeOpenAndroidWhatsAppMonitor(uid, {
      delayMs: 1500,
    }).catch(() => {});
  }
}

async function runDeviceInNewWindow(uid, service) {
  try {
    await window.electronAPI.runDeviceInNewWindow(uid, service);
    setDeviceState(uid, "active");
  } catch (err) {
    console.error("Gagal membuka device di window baru:", err);
  }
}

function stopDevice(uid) {
  window.electronAPI.stopDevice(uid);
  setDeviceState(uid, "stopped");
}

function deleteDevice(uid) {
  Swal.fire({
    title: window.t('dialog.delete_device.title'),
    text: window.t('dialog.delete_device.text'),
    icon: "warning",
    showCancelButton: true,
    // Praktik UX yang baik: tombol konfirmasi untuk aksi berbahaya berwarna merah
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: window.t('dialog.delete_device.confirm'),
    cancelButtonText: window.t('dialog.delete_device.cancel'),
  }).then((result) => {
    if (result.isConfirmed) {
      // Panggil API dan harapkan respons berupa objek { success, message }
      window.electronAPI
        .deleteDevice(uid)
        .then((response) => {
          if (response.success) {
            showToast(window.t('toast.device.deleted'), 3000, "success");
            loadAllDevices(); // Muat ulang daftar
          } else {
            showToast(
              response.message || window.t('toast.device.delete_error'),
              3000,
              "error"
            );
          }
        })
        .catch((err) => {
          console.error("IPC Error saat memanggil deleteDevice:", err);
          showToast(
            window.t('toast.device.comm_error'),
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
  const serviceCards = serviceBrowserGrid.querySelectorAll(".service-card");

  serviceCards.forEach((card) => {
    const serviceValue = card.dataset.serviceId || "";

    if (pageName === "android-ios") {
      // Show only Android service
      if (serviceValue.toLowerCase() === "android") {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    } else if (pageName === "web-emulator") {
      // Hide Android service
      if (serviceValue.toLowerCase() === "android") {
        card.style.display = "none";
      } else {
        card.style.display = "flex";
      }
    } else {
      // For other pages, show all
      card.style.display = "flex";
    }
  });
}

function openModal() {
  document.getElementById("addModal").style.display = "flex";
  updateAddDeviceQuotaHint();

  // Filter services based on current page
  const currentPage = window.currentActivePage || "web-emulator";
  filterServicesByPage(currentPage);

  syncServiceAvailability();
  toggleCustomServiceSection(
    document.getElementById("deviceService")?.value === "other"
  );
  if (hasAndroidModule()) {
    toggleAndroidSpecSection(
      document.getElementById("deviceService")?.value === "android"
    );
  }
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
  if (hasAndroidModule()) toggleAndroidSpecSection(false);
  if (androidSpecSelect && hasAndroidModule()) {
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
            : "tanpa batas";
        message = `Kuota akun: ${count}/${accountLimit} device untuk ${label}.`;
      }
    } else {
      message = `Mode tamu: bebas menambah device ${label} (saat ini ${count}).`;
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
  const chromeNativeCheckbox = document.getElementById("deviceUseChromeNative");
  const useChromeNative =
    service !== "android" &&
    !!(chromeNativeCheckbox && chromeNativeCheckbox.checked);
  const autoSenderCheckbox = document.getElementById("deviceAutoSender");
  const pendingUrlInput = document.getElementById("devicePendingUrl");
  const customUrlInput = document.getElementById("customServiceUrl");
  const isWhatsApp = (service || "").toLowerCase() === "wa";
  const autoSenderRequested = isWhatsApp && autoSenderCheckbox?.checked;
  const autoSenderEnabled = autoSenderRequested && !useChromeNative;
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
    service === "android" && hasAndroidModule()
      ? androidSpecSelect?.value || DEFAULT_ANDROID_SPEC_ID
      : null;
  const androidSpec =
    service === "android" && hasAndroidModule() ? getAndroidSpecPayload(selectedAndroidSpecId) : null;

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
      useChromeNative,
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
  initThemeModeToggle();
  ensureServiceSelectOptions("deviceService");
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
  document.addEventListener("DOMContentLoaded", loadSystemInfoBadge);
  window.addEventListener("focus", () => {
    loadSystemInfoBadge();
  });
  if (typeof refreshAddAutoSenderUI === "function") refreshAddAutoSenderUI();
  if (typeof refreshAddChromeNativeUI === "function")
    refreshAddChromeNativeUI();
  const serviceSelect = document.getElementById("deviceService");
  if (serviceSelect) {
    serviceSelect.addEventListener("change", () => {
      updateAddDeviceQuotaHint();
      if (typeof refreshAddAutoSenderUI === "function") {
        refreshAddAutoSenderUI();
      }
      if (typeof refreshAddChromeNativeUI === "function") {
        refreshAddChromeNativeUI();
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
  if (window.electronAPI?.onVersionDownloadProgress) {
    window.electronAPI.onVersionDownloadProgress((payload = {}) => {
      if (payload.state) {
        versionDownloadState.state = payload.state;
      }
      if (Number.isFinite(payload.progress)) {
        versionDownloadState.progress = payload.progress;
      }
      if (payload.message) {
        versionDownloadState.message = payload.message;
      } else if (payload.state === "downloaded") {
        versionDownloadState.message = "Unduhan selesai.";
      }
      if (payload.path) {
        versionDownloadState.path = payload.path;
      }
      updateVersionDownloadUI();
    });
  }
  checkLatestVersion({ silent: true });
  const deviceSearchInput = document.getElementById("deviceSearchInput");
  if (deviceSearchInput) {
    deviceSearchInput.addEventListener("input", (event) => {
      deviceSearchQuery = (event.target.value || "").toLowerCase();
      renderDevices(cachedDevices);
    });
  }
  const deviceSearchInputAndroid = document.getElementById(
    "deviceSearchInputAndroid"
  );
  if (deviceSearchInputAndroid) {
    deviceSearchInputAndroid.addEventListener("input", (event) => {
      deviceSearchQuery = (event.target.value || "").toLowerCase();
      renderDevices(cachedDevices);
    });
  }
  syncThemeSelector();
  syncServiceAvailability();

  // Re-apply i18n translations and reload device lists when language changes
  document.addEventListener('langchange', () => {
    if (typeof window.applyI18n === 'function') window.applyI18n();
    loadAllDevices();
    if (typeof loadAllDevicesAndroid === 'function') loadAllDevicesAndroid();
  });

  // Update status otomatis
  window.electronAPI.onDeviceStatusUpdated((uid, status) => {
    console.log("📶 Status device berubah:", uid, status);
    if (typeof status === "string" && status) {
      setDeviceState(uid, status);
    }
    loadAllDevices();
    if (typeof loadAllDevicesAndroid === "function") {
      loadAllDevicesAndroid();
    }
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
        // Resume automation: pastikan loop berjalan & start timer jika belum berjalan
        session.isPaused = false;
        ensureAutomationLoop();
        if (!session.fetchTimer) {
          startDeviceFetchTimer(session);
          console.log(`▶️ Automation resumed untuk ${uid}`);
        }
        const pendingCount = (session.messages || []).filter(
          (item) => item.status !== "done"
        ).length;
        if (pendingCount > 0 && !session.isSending) {
          runAutomationTickForSession(session).catch((err) =>
            console.error("Resume send tick error:", err)
          );
        }
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

  // Listener untuk pembaruan pengaturan monitor (interval fetch & rate limit)
  if (window.electronAPI?.onAutomationSettingsUpdated) {
    window.electronAPI.onAutomationSettingsUpdated((uid, settings) => {
      applyAutomationSettingsUpdate(uid, settings || {});
    });
  } else if (window.electronAPI?.on) {
    window.electronAPI.on(
      "automation-settings-updated",
      (_event, uid, settings) => {
        applyAutomationSettingsUpdate(uid, settings || {});
      }
    );
  }
});
document.addEventListener("click", () => {
  document
    .querySelectorAll(".device-dropdown.show")
    .forEach((el) => el.classList.remove("show"));
  document
    .querySelectorAll(".device.dropdown-open")
    .forEach((el) => el.classList.remove("dropdown-open"));
});

window.triggerVersionCheck =
  window.triggerVersionCheck ||
  function () {
    checkLatestVersion({ showAlways: true });
  };

window.startVersionDownload =
  window.startVersionDownload ||
  function () {
    startVersionDownload();
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
      const card = document.querySelector(
        `#device-list .device[data-uid="${uid}"]`
      );
      const status = (card?.dataset.status || "").toLowerCase();
      if (!["active", "running", "starting"].includes(status)) return;
      stopDevice(uid);
    });
  });
}

function stopAllDevices() {
  const allDevices = Array.from(
    document.querySelectorAll("#device-list .device")
  );
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
  toggleChangePasswordForm,
  submitChangePassword,
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

// Make loadAllDevices available globally
window.loadAllDevices = loadAllDevices;

// Main switchPage function with device loading
window.switchPage = async function (page) {
  if (
    typeof event !== "undefined" &&
    typeof event.preventDefault === "function"
  ) {
    event.preventDefault();
  }

  console.log("🔄 Switching to page:", page);

  const proPages = window.STARBOX_PRO_PAGES || [];
  if (proPages.includes(page)) {
    if (typeof window.setProMode === "function") {
      window.setProMode(true);
    } else {
      try { localStorage.setItem("starbox-pro-mode", "true"); } catch (_) {}
    }
  }

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

  document.body.classList.toggle("remox-page-active", page === "remox");

  // Update sidebar active state
  document.querySelectorAll(".sidebar-item").forEach((item) => {
    item.classList.remove("active");
  });
  const sidebarPage = page === "whatsapp-gateway" ? "web-emulator" : page;
  const activeItem = document.querySelector(
    `.sidebar-item[data-page="${sidebarPage}"]`
  );
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
    if (hasAndroidModule()) await loadAllDevicesAndroid();
  } else if (page === "whatsapp-gateway") {
    console.log("  💬 Loading WhatsApp Gateway devices...");
    if (typeof window.loadWAGatewayPage === "function") {
      await window.loadWAGatewayPage();
    } else {
      console.warn("loadWAGatewayPage is not defined.");
    }
  } else if (page === "os-virtual") {
    if (typeof loadVmList === "function") await loadVmList();
  } else if (page === "remox") {
    if (typeof window.initRemoxPage === "function") await window.initRemoxPage();
  } else if (page === "resource-monitor") {
    if (typeof window.rmStartPolling === "function") window.rmStartPolling();
    else setTimeout(() => { if (typeof window.rmStartPolling === "function") window.rmStartPolling(); }, 100);
  } else if (page === "cron") {
    if (typeof window.loadCronJobs === "function") window.loadCronJobs();
  } else if (page === "starcapture") {
    if (typeof window.scInitPage === "function") window.scInitPage();
  }

  // Stop resource monitor polling when leaving that page
  if (page !== "resource-monitor") {
    if (typeof window.rmStopPolling === "function") window.rmStopPolling();
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

document.addEventListener("click", (evt) => {
  const target = evt.target;
  if (!(target instanceof Element)) return;
  const item = target.closest(".sidebar-item[data-page]");
  if (!item) return;

  const page = item.dataset.page;
  if (!page) return;
  evt.preventDefault();
  evt.stopImmediatePropagation();
  window.switchPage(page);
}, true);

// ============================================================
// Remote Control – Status UI
// ============================================================

/**
 * Update indikator remote di navbar.
 * @param {"connecting"|"online"|"offline"} status
 * @param {number} clientCount - jumlah client lain yang online
 */
function updateRemoteStatusUI(status, clientCount = 0) {
  const btn   = document.getElementById("remoteStatusBtn");
  const dot   = document.getElementById("remoteDot");
  const label = document.getElementById("remoteLabel");
  if (!btn || !dot || !label) return;

  const configs = {
    connecting: {
      color: "#f59e0b",
      shadow: "0 0 6px #f59e0b88",
      text:  "Remote...",
      textColor: "#9ca3af",
    },
    online: {
      color: "#4ade80",
      shadow: "0 0 6px #4ade8088",
      text:  clientCount > 0 ? `Remote (${clientCount})` : "Remote",
      textColor: "#4ade80",
    },
    offline: {
      color: "#6b7280",
      shadow: "none",
      text:  "Remote",
      textColor: "#6b7280",
    },
  };

  const cfg = configs[status] || configs.offline;
  dot.style.background  = cfg.color;
  dot.style.boxShadow   = cfg.shadow;
  label.textContent     = cfg.text;
  label.style.color     = cfg.textColor;
  btn.title = status === "online"
    ? `Remote terhubung${clientCount > 0 ? ` – ${clientCount} PC lain online` : ""}\nKlik untuk buka Remote Control`
    : "Remote Control – Klik untuk buka";
}

/** Navigasi ke halaman Remote Control (embedded) */
function openRemoteWindow() {
  // Halaman Remote Control milik modul StarDesk
  StarBoxModuleHost.openPage("remote-control", "stardesk");
}

/** Inisialisasi Remote Status UI */
function initRemoteStatusUI() {
  if (!window.electronAPI?.remote) return;

  const btn = document.getElementById("remoteStatusBtn");

  // Tampilkan tombol hanya jika sudah login
  function syncVisibility() {
    if (!btn) return;
    const isLoggedIn = !!document.getElementById("userProfileButton")
      && document.getElementById("userProfileButton").style.display !== "none";
    btn.style.display = isLoggedIn ? "flex" : "none";
  }

  // Cek status awal
  window.electronAPI.remote.getClients().then((data) => {
    syncVisibility();
    if (data.connected) {
      updateRemoteStatusUI("online", data.clients?.length || 0);
    } else if (data.clientId) {
      updateRemoteStatusUI("connecting");
    } else {
      updateRemoteStatusUI("offline");
    }
  }).catch(() => updateRemoteStatusUI("offline"));

  // Listen event dari main process
  if (window.electronAPI.remote.onConnectionChanged) {
    window.electronAPI.remote.onConnectionChanged(({ connected }) => {
      syncVisibility();
      updateRemoteStatusUI(connected ? "online" : "offline");
      if (connected) {
        // Refresh jumlah client
        window.electronAPI.remote.getClients().then((data) => {
          updateRemoteStatusUI("online", data.clients?.length || 0);
        }).catch(() => {});
      }
    });
  }

  if (window.electronAPI.remote.onClientsUpdated) {
    window.electronAPI.remote.onClientsUpdated(({ clients }) => {
      const online = (clients || []).filter(c => c.status === "online").length;
      updateRemoteStatusUI("online", online);
    });
  }

  // Sync visibility saat auth berubah
  const observer = new MutationObserver(syncVisibility);
  const profileBtn = document.getElementById("userProfileButton");
  if (profileBtn) {
    observer.observe(profileBtn, { attributes: true, attributeFilter: ["style"] });
  }
}

// Boot remote UI setelah DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRemoteStatusUI);
} else {
  initRemoteStatusUI();
}

// ─── Pro Mode Toggle ──────────────────────────────────────────────────────────
(function initProMode() {
  const LS_KEY = 'starbox-pro-mode';
  const PRO_PAGES = [...(window.STARBOX_MODULE_PRO_PAGES || [])];
  window.STARBOX_PRO_PAGES = PRO_PAGES;

  function isProMode() {
    return localStorage.getItem(LS_KEY) === 'true';
  }

  function applyProMode(pro) {
    const btn    = document.getElementById('modeProBtn');
    const label  = document.getElementById('modeProLabel');
    const lang   = window.i18n?.getLang?.() || 'en';

    // Update button appearance
    if (btn) {
      btn.style.backgroundColor = pro ? 'rgba(139, 92, 246, 0.2)' : 'transparent';
      btn.style.borderLeftColor = pro ? 'var(--color-accent-purple)' : 'transparent';
      btn.style.color = pro ? 'var(--color-text-light)' : 'var(--color-text-light)';
      btn.style.fontWeight = pro ? '600' : '500';
    }
    if (label) {
      label.setAttribute('data-i18n', pro ? 'nav.mode_pro' : 'nav.mode_simple');
      label.textContent = pro
        ? (lang === 'id' ? 'Pro' : 'Pro')
        : (lang === 'id' ? 'Simple' : 'Simple');
    }

    // Show/hide pro-only sidebar items
    document.querySelectorAll('.sidebar-item[data-pro="true"]').forEach(el => {
      el.style.display = pro ? '' : 'none';
    });

    // If current page is pro-only and mode switched to simple → go to web-emulator
    if (!pro) {
      const activePage = document.querySelector('.sidebar-item.active')?.dataset?.page;
      if (activePage && PRO_PAGES.includes(activePage)) {
        if (typeof switchPage === 'function') switchPage('web-emulator');
      }
    }
  }

  window.setProMode = function (enabled) {
    const next = !!enabled;
    localStorage.setItem(LS_KEY, String(next));
    applyProMode(next);
  };

  window.toggleProMode = function () {
    window.setProMode(!isProMode());
  };

  // Init on load
  document.addEventListener('DOMContentLoaded', () => applyProMode(isProMode()));
  // Also apply immediately in case DOMContentLoaded already fired
  if (document.readyState !== 'loading') applyProMode(isProMode());
})();

// ─── Favorites / Quick Launch ─────────────────────────────────────────────────
(function initFavorites() {
  const LS_KEY = 'starbox-favorites'; // array of service id

  function getFavs() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  }
  function saveFavs(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {}
  }
  function isFav(id) { return getFavs().includes(id); }

  function toggleFav(id) {
    let favs = getFavs();
    if (favs.includes(id)) favs = favs.filter(f => f !== id);
    else favs.push(id);
    saveFavs(favs);
    renderFavorites();
    renderFavButtonStates();
  }

  function renderFavorites() {
    const section = document.getElementById('favorites-section');
    const grid    = document.getElementById('favorites-grid');
    if (!section || !grid) return;
    const favs = getFavs();
    if (favs.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    grid.innerHTML = '';
    favs.forEach(id => {
      const svc = (window.DEFAULT_SERVICE_LIBRARY || []).find(s => s.id === id);
      if (!svc) return;
      const btn = document.createElement('button');
      btn.title = svc.label;
      btn.style.cssText = `
        display:flex;align-items:center;gap:7px;padding:6px 14px;
        border-radius:20px;border:1px solid rgba(124,111,224,0.3);
        background:rgba(124,111,224,0.08);color:#c0b8f0;
        cursor:pointer;font-size:12px;font-weight:500;
        transition:all 0.15s;white-space:nowrap;
      `;
      btn.onmouseover = () => btn.style.background = 'rgba(124,111,224,0.2)';
      btn.onmouseout  = () => btn.style.background = 'rgba(124,111,224,0.08)';
      btn.innerHTML = `<span style="font-size:15px;">${svc.emoji || '🌐'}</span>${svc.label}`;
      btn.onclick = () => {
        // Buka Add Device modal dengan service ini pre-selected
        if (typeof openAddModal === 'function') openAddModal({ preSelectService: id });
        else if (typeof window.openAddDeviceModal === 'function') window.openAddDeviceModal(id);
      };
      grid.appendChild(btn);
    });
  }

  function renderFavButtonStates() {
    document.querySelectorAll('[data-fav-id]').forEach(btn => {
      const id = btn.dataset.favId;
      const active = isFav(id);
      btn.title = active ? 'Hapus dari Favorit' : 'Tambah ke Favorit';
      btn.style.color = active ? '#f0b429' : '#555';
    });
  }

  window.toggleFavorite  = toggleFav;
  window.renderFavorites = renderFavorites;
  window.isFavorite      = isFav;

  window.openFavoritesManager = function () {
    // Simple modal pilih service yang difavoritkan
    const favs = getFavs();
    const lib  = window.DEFAULT_SERVICE_LIBRARY || [];
    const isLight = document.body.classList.contains('theme-mode-light');
    const bg  = isLight ? '#fff' : '#1c2030';
    const clr = isLight ? '#111' : '#e2e8f0';

    const rows = lib.filter(s => s.id !== 'other').map(s => `
      <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:7px;cursor:pointer;transition:background 0.12s;"
        onmouseover="this.style.background='rgba(124,111,224,0.08)'" onmouseout="this.style.background=''"
      >
        <input type="checkbox" data-fav-svc="${s.id}" ${favs.includes(s.id) ? 'checked' : ''}
          style="accent-color:#7c6fe0;width:15px;height:15px;cursor:pointer;" />
        <span style="font-size:13px;">${s.label}</span>
        <span style="font-size:11px;color:#666;margin-left:auto;">${s.category}</span>
      </label>
    `).join('');

    const html = `
      <div style="font-weight:600;font-size:15px;margin-bottom:14px;color:${clr};">⭐ Kelola Favorit</div>
      <div style="font-size:12px;color:#888;margin-bottom:12px;">Pilih service yang ingin tampil di bagian Favorit.</div>
      <div style="max-height:340px;overflow-y:auto;margin-bottom:16px;">${rows}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button onclick="document.getElementById('favMgrOverlay').remove()"
          style="padding:7px 18px;border-radius:7px;border:1px solid #444;background:none;color:#888;cursor:pointer;">Batal</button>
        <button onclick="(function(){
          const checks = document.querySelectorAll('[data-fav-svc]');
          const sel = [];
          checks.forEach(c => { if(c.checked) sel.push(c.dataset.favSvc); });
          localStorage.setItem('starbox-favorites', JSON.stringify(sel));
          window.renderFavorites && window.renderFavorites();
          document.getElementById('favMgrOverlay').remove();
        })()"
          style="padding:7px 18px;border-radius:7px;border:none;background:#7c6fe0;color:#fff;cursor:pointer;font-weight:600;">Simpan</button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'favMgrOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = `<div style="background:${bg};border-radius:14px;padding:24px;width:420px;max-width:92vw;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,0.4);">${html}</div>`;
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  };

  // Expose service library ke window agar bisa diakses di modal
  if (typeof DEFAULT_SERVICE_LIBRARY !== 'undefined') {
    window.DEFAULT_SERVICE_LIBRARY = DEFAULT_SERVICE_LIBRARY;
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => { renderFavorites(); });
  if (document.readyState !== 'loading') renderFavorites();
})();

// ─── Do Not Disturb / Focus Mode ─────────────────────────────────────────────
(function initDND() {
  const LS_KEY    = 'starbox-dnd';
  const LS_SCHED  = 'starbox-dnd-schedule'; // { enabled, startH, startM, endH, endM }

  let _dndTimer = null;

  function isDND() { return localStorage.getItem(LS_KEY) === 'true'; }
  function setDND(val) { localStorage.setItem(LS_KEY, String(val)); }

  function applyDND(active) {
    const btn   = document.getElementById('dndBtn');
    const icon  = document.getElementById('dndIcon');
    const label = document.getElementById('dndLabel');
    if (!btn) return;

    if (active) {
      btn.style.borderColor = 'rgba(251,191,36,0.5)';
      btn.style.color       = '#fbbf24';
      if (icon)  { icon.className = 'bi bi-moon-fill'; icon.style.fontSize = '13px'; }
      if (label) label.textContent = 'Fokus ON';
      // Notify main process — mute OS notifications
      window.electronAPI?.setDND?.(true);
    } else {
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
      btn.style.color       = '#9ca3af';
      if (icon)  { icon.className = 'bi bi-moon'; icon.style.fontSize = '13px'; }
      if (label) label.textContent = 'Fokus';
      window.electronAPI?.setDND?.(false);
    }

    // Expose ke Web Hub via IPC agar badge berhenti update
    window.electronAPI?.broadcastDND?.(active);
  }

  window.toggleDND = function () {
    const next = !isDND();
    setDND(next);
    applyDND(next);
  };

  window.isDNDActive = isDND;

  // Jadwal otomatis DND
  function checkDNDSchedule() {
    try {
      const sched = JSON.parse(localStorage.getItem(LS_SCHED) || '{}');
      if (!sched.enabled) return;
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      const nowMin   = h * 60 + m;
      const startMin = (sched.startH || 22) * 60 + (sched.startM || 0);
      const endMin   = (sched.endH   || 7)  * 60 + (sched.endM   || 0);

      let shouldDND;
      if (startMin < endMin) {
        shouldDND = nowMin >= startMin && nowMin < endMin;
      } else {
        // Overnight (e.g. 22:00 - 07:00)
        shouldDND = nowMin >= startMin || nowMin < endMin;
      }

      if (shouldDND !== isDND()) {
        setDND(shouldDND);
        applyDND(shouldDND);
      }
    } catch {}
  }

  // Check setiap menit
  setInterval(checkDNDSchedule, 60000);

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    applyDND(isDND());
    checkDNDSchedule();
  });
  if (document.readyState !== 'loading') { applyDND(isDND()); checkDNDSchedule(); }
})();

// ─── Usage Tracker ────────────────────────────────────────────────────────────
(function initUsageTracker() {
  const LS_PREFIX = 'starbox-usage-'; // + YYYY-MM-DD
  let _currentPage = null;
  let _pageStartMs = null;

  function todayKey() {
    return LS_PREFIX + new Date().toISOString().slice(0, 10);
  }
  function getUsage() {
    try { return JSON.parse(localStorage.getItem(todayKey()) || '{}'); } catch { return {}; }
  }
  function saveUsage(data) {
    try { localStorage.setItem(todayKey(), JSON.stringify(data)); } catch {}
  }
  function addTime(key, ms) {
    if (!key || ms < 1000) return; // ignore < 1 detik
    const data = getUsage();
    data[key] = (data[key] || 0) + ms;
    saveUsage(data);
  }
  function trackPageChange(newPage) {
    const now = Date.now();
    if (_currentPage && _pageStartMs) {
      addTime(_currentPage, now - _pageStartMs);
    }
    _currentPage = newPage;
    _pageStartMs = now;
  }

  // Hook switchPage
  const _origSwitchPage = window.switchPage;
  window.switchPage = async function(page, ...args) {
    trackPageChange(page);
    return _origSwitchPage ? _origSwitchPage(page, ...args) : undefined;
  };

  // Track saat window blur/focus
  window.addEventListener('blur',  () => { if (_currentPage && _pageStartMs) { addTime(_currentPage, Date.now() - _pageStartMs); _pageStartMs = null; } });
  window.addEventListener('focus', () => { if (_currentPage) _pageStartMs = Date.now(); });
  window.addEventListener('beforeunload', () => { if (_currentPage && _pageStartMs) addTime(_currentPage, Date.now() - _pageStartMs); });

  // Format ms ke string readable
  function fmtMs(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)   return s + 'd';
    const m = Math.floor(s / 60);
    if (m < 60)   return m + 'm';
    const h = Math.floor(m / 60);
    return h + 'j ' + (m % 60) + 'm';
  }

  // Render modal usage
  window.openUsageStats = function() {
    const data   = getUsage();
    const isLight = document.body.classList.contains('theme-mode-light');
    const bg  = isLight ? '#fff' : '#1c2030';
    const clr = isLight ? '#111' : '#e2e8f0';

    const pageLabels = {
      'web-emulator':    '🌐 Web Emulator',
      'whatsapp-gateway':'💬 WhatsApp Gateway',
      ...(window.STARBOX_MODULE_PAGE_LABELS || {}),
    };

    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const total  = sorted.reduce((s, [,v]) => s + v, 0);

    const rows = sorted.length === 0
      ? '<div style="text-align:center;color:#555;padding:20px;font-size:13px;">Belum ada data hari ini</div>'
      : sorted.map(([key, ms]) => {
          const pct  = total > 0 ? Math.round(ms / total * 100) : 0;
          const label = pageLabels[key] || ('🌐 ' + key);
          return `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                <span style="color:${clr}">${label}</span>
                <span style="color:#7c6fe0;font-weight:600;">${fmtMs(ms)}</span>
              </div>
              <div style="background:rgba(255,255,255,0.06);border-radius:4px;height:6px;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#7c6fe0,#a99cf0);height:100%;width:${pct}%;border-radius:4px;transition:width 0.4s;"></div>
              </div>
            </div>`;
        }).join('');

    const today = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' });
    const html = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="font-weight:600;font-size:15px;color:${clr};">📊 Usage Hari Ini</div>
        <button onclick="document.getElementById('usageOverlay').remove()" style="background:none;border:none;color:#666;font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div style="font-size:11px;color:#888;margin-bottom:16px;">${today} · Total: ${fmtMs(total)}</div>
      <div style="max-height:360px;overflow-y:auto;">${rows}</div>
    `;
    const overlay = document.createElement('div');
    overlay.id = 'usageOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = `<div style="background:${bg};border-radius:14px;padding:24px;width:400px;max-width:92vw;box-shadow:0 16px 48px rgba(0,0,0,0.4);">${html}</div>`;
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  };

  // Init tracking dari halaman aktif saat ini
  document.addEventListener('DOMContentLoaded', () => {
    const active = document.querySelector('.sidebar-item.active')?.dataset?.page || 'web-emulator';
    trackPageChange(active);
  });
  if (document.readyState !== 'loading') {
    const active = document.querySelector('.sidebar-item.active')?.dataset?.page || 'web-emulator';
    trackPageChange(active);
  }
})();

// ─── Auto Cleanup localStorage ────────────────────────────────────────────────
(function autoCleanupStorage() {
  const RULES = [
    // Usage tracker: simpan 30 hari, hapus yang lebih lama
    { prefix: 'starbox-usage-',       keepDays: 30 },
    // Clipboard history: dikelola di memory, tidak perlu cleanup
  ];

  function parseDate(key, prefix) {
    const dateStr = key.replace(prefix, ''); // format YYYY-MM-DD
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  function runCleanup() {
    const now = Date.now();
    let removed = 0;

    try {
      const allKeys = Object.keys(localStorage);

      RULES.forEach(({ prefix, keepDays }) => {
        const cutoff = now - keepDays * 24 * 60 * 60 * 1000;
        allKeys.forEach(key => {
          if (!key.startsWith(prefix)) return;
          const date = parseDate(key, prefix);
          if (date && date.getTime() < cutoff) {
            localStorage.removeItem(key);
            removed++;
          }
        });
      });

      // Hapus key orphan / tidak dikenal milik starbox yang > 90 hari
      const KNOWN_KEYS = new Set([
        'starbox-favorites', 'starbox-pro-mode', 'starbox-dnd',
        'starbox-dnd-schedule', 'starbox-webhub-layout', 'starbox-webhub-bg',
        'starbox-cleanup-last',
      ]);
      allKeys.forEach(key => {
        if (!key.startsWith('starbox-')) return;
        if (KNOWN_KEYS.has(key)) return;
        if (key.startsWith('starbox-usage-')) return; // sudah dihandle di atas
        // Key starbox tidak dikenal — cek apakah ada timestamp di value
        try {
          const val = JSON.parse(localStorage.getItem(key) || '{}');
          if (val._ts && now - val._ts > 90 * 24 * 60 * 60 * 1000) {
            localStorage.removeItem(key);
            removed++;
          }
        } catch {}
      });

      if (removed > 0) console.log(`[StarBox] Auto cleanup: ${removed} localStorage key(s) dihapus`);
      localStorage.setItem('starbox-cleanup-last', String(now));
    } catch (e) {
      console.warn('[StarBox] Cleanup error:', e?.message);
    }
  }

  // Jalankan hanya sekali per hari
  function shouldRun() {
    try {
      const last = parseInt(localStorage.getItem('starbox-cleanup-last') || '0');
      return Date.now() - last > 24 * 60 * 60 * 1000;
    } catch { return true; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (shouldRun()) setTimeout(runCleanup, 5000); // delay 5s agar tidak ganggu startup
  });
  if (document.readyState !== 'loading' && shouldRun()) setTimeout(runCleanup, 5000);

  // Expose untuk manual trigger jika perlu
  window.runStorageCleanup = runCleanup;

  // Hook switchPage — init peta komunitas & cek akselerasi saat halaman dibuka
  const _origSwitchPageForCommunityMap = window.switchPage;
  window.switchPage = async function (page, ...args) {
    const result = _origSwitchPageForCommunityMap
      ? await _origSwitchPageForCommunityMap(page, ...args)
      : undefined;
    if (page === "community-map" && typeof window.initCommunityMapPage === "function") {
      window.initCommunityMapPage();
    }
    if (page === "android-ios" && typeof window.refreshAccelStatus === "function") {
      window.refreshAccelStatus();
    }
    return result;
  };
})();
