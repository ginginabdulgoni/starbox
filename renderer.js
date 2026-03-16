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
const ANDROID_REMOTE_SERVICE_IDS = [
  "android-general",
  "android-whatsapp",
];

rebuildServiceLookups();

const assetUrlCache = new Map();
const assetPendingRequests = new Map();
const assetElementRegistry = new Map();
let cachedAndroidRemoteDevices = [];
let _androidAddType = 'adb'; // 'adb' | 'emulator'
let cachedAdbDevices = [];
const scrcpyStatusState = {
  installed: false,
  checking: false,
  installing: false,
  progressPercent: null,
  progressMessage: "",
};
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
let cachedAndroidDevices = [];

// Function to refresh device list (callable from global scope)
window.refreshDeviceList = async function () {
  console.log("🔄 Refreshing device list for page:", window.currentActivePage);
  // Always reload devices from storage to ensure fresh data
  if (typeof loadAllDevices === "function") {
    await loadAllDevices();
  } else {
    // Fallback: detect current page and render appropriate devices
    const currentPage = document.querySelector(".page-content.active")?.id;
    if (
      currentPage === "page-android-ios" &&
      typeof renderDevicesAndroid === "function"
    ) {
      renderDevicesAndroid(cachedAndroidDevices);
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
  isUnlimited: false,
  packageExpiresAt: null,
  allowsPrivateService: false,
  allowsAndroidEmulator: false,
  allowsIosSimulator: false,
  limitDeviceWAGateway: DEFAULT_LIMITS.limitDeviceWAGateway,
  limitAutoReply: DEFAULT_LIMITS.limitAutoReply,
  limitBroadcastDay: DEFAULT_LIMITS.limitBroadcastDay,
};

if (typeof window !== "undefined") {
  window.getCurrentAuthState = () => authState;
  window.openAdsInfoModal = openAdsInfoModal;
  window.closeAdsInfoModal = closeAdsInfoModal;
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
const ADS_API_PATH = "/api/ads/items";
const PACKAGES_API_PATH = "/api/packages?include_inactive=1";
const ADS_PAGE_KEYS = [
  "web-emulator",
  "android-ios",
  "whatsapp-gateway",
  "remox",
  "os-virtual",
  "cctv",
];
const ADS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const adsState = {
  items: [],
  endpoint: null,
  lastError: null,
  cache: new Map(),
  loadingKeys: new Set(),
  refreshTimer: null,
  countdownTimer: null,
  lastRefreshAt: null,
  nextRefreshAt: null,
};
const packagesState = {
  items: [],
  loading: false,
  lastError: null,
};
let cachedApiBase = null;

function shuffleAdsItems(list = []) {
  const array = list.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function parsePriceValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const text = String(raw).trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (lowered.includes("gratis") || lowered.includes("free")) return 0;
  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function isFreePackageTier() {
  if (!authState?.package) return false;
  const priceValue = parsePriceValue(
    authState.package.price ?? authState.package.price_display
  );
  if (priceValue === null) return false;
  return priceValue <= 0;
}

function shouldDisplayAds() {
  if (!authState.isLoggedIn) return true;
  return isFreePackageTier();
}

function formatAdsPrice(price) {
  const numeric = parsePriceValue(price);
  if (numeric === null) {
    return typeof price === "string" && price.trim() ? price : "Rp -";
  }
  return `Rp ${numeric.toLocaleString("id-ID")}`;
}

function buildAdsId(base, pageKey) {
  if (!pageKey || pageKey === "web-emulator") return base;
  return `${base}-${pageKey}`;
}

async function getApiBase() {
  if (cachedApiBase) return cachedApiBase;
  let isDev =
    typeof process !== "undefined" &&
    process.env &&
    process.env.NODE_ENV === "development";
  try {
    if (window.electronAPI?.isDevBuild) {
      isDev = await window.electronAPI.isDevBuild();
    } else if (window.location?.hostname) {
      isDev = window.location.hostname.includes("starbox.test");
    }
  } catch {
    isDev = false;
  }
  isDevBuildCached = isDev;
  cachedApiBase = (
    (isDev ? ADS_API_BASE.dev : ADS_API_BASE.prod) || ""
  ).replace(/\/$/, "");
  return cachedApiBase;
}

async function resolveAdsEndpoint() {
  if (adsState.endpoint) return adsState.endpoint;
  const base = await getApiBase();
  adsState.endpoint = `${base}${ADS_API_PATH}`;
  return adsState.endpoint;
}

function ensureAdsSection(pageKey = "web-emulator") {
  const isDefault = pageKey === "web-emulator";
  const containerId = buildAdsId("adsShowcase", pageKey);
  let container = document.getElementById(containerId);
  if (container) {
    return {
      container,
      horizontal: document.getElementById(
        buildAdsId("adsTrackHorizontal", pageKey)
      ),
      vertical: document.getElementById(
        buildAdsId("adsTrackVertical", pageKey)
      ),
    };
  }

  const pageMain = document.querySelector(`#page-${pageKey} .page-main`);
  if (!pageMain) {
    return { container: null, horizontal: null, vertical: null };
  }

  container = document.createElement("section");
  container.id = containerId;
  container.className = "ads-showcase";
  container.dataset.pageKey = pageKey;

  const head = document.createElement("div");
  head.className = "ads-head";
  const titleWrap = document.createElement("div");
  titleWrap.className = "ads-title";
  const eyebrow = document.createElement("p");
  eyebrow.className = "ads-eyebrow";
  eyebrow.textContent = "Rekomendasi pilihan";
  const title = document.createElement("h4");
  title.textContent = "Iklan";
  titleWrap.appendChild(eyebrow);
  titleWrap.appendChild(title);

  const countdown = document.createElement("span");
  countdown.id = buildAdsId("adsCountdown", pageKey);
  countdown.className = "ads-countdown";
  countdown.textContent = "";

  const hideBtn = document.createElement("button");
  hideBtn.type = "button";
  hideBtn.className = "ads-hide-btn";
  hideBtn.textContent = "Sembunyikan iklan";
  hideBtn.addEventListener("click", openAdsInfoModal);
  head.appendChild(titleWrap);
  head.appendChild(countdown);
  head.appendChild(hideBtn);

  const marqueeH = document.createElement("div");
  marqueeH.className = "ads-marquee ads-marquee-horizontal";
  const trackH = document.createElement("div");
  trackH.className = "ads-track";
  trackH.id = buildAdsId("adsTrackHorizontal", pageKey);
  trackH.innerHTML = `<div class="ads-empty">Memuat rekomendasi...</div>`;
  marqueeH.appendChild(trackH);

  const marqueeV = document.createElement("div");
  marqueeV.className = "ads-marquee ads-marquee-vertical";
  const trackV = document.createElement("div");
  trackV.className = "ads-track";
  trackV.id = buildAdsId("adsTrackVertical", pageKey);
  trackV.innerHTML = `<div class="ads-empty">Memuat rekomendasi...</div>`;
  marqueeV.appendChild(trackV);

  container.appendChild(head);
  container.appendChild(marqueeH);
  container.appendChild(marqueeV);
  pageMain.appendChild(container);

  return { container, horizontal: trackH, vertical: trackV };
}

function setAdsContainerVisible(pageKey = "web-emulator", visible = false) {
  const { container } = getAdsElements(pageKey);
  if (!container) return;
  container.style.display = visible ? "" : "none";
}

function getAdsElements(pageKey = "web-emulator") {
  const result = ensureAdsSection(pageKey);
  return result;
}

function setAdsMessage(message, pageKey = "web-emulator") {
  const { horizontal, vertical } = getAdsElements(pageKey);
  const content = `<div class="ads-empty">${message}</div>`;
  if (horizontal) horizontal.innerHTML = content;
  if (vertical) vertical.innerHTML = content;
}

function createAdsCardElement(item = {}) {
  const link = document.createElement("a");
  link.className = "ads-card";
  const targetUrl =
    item.short_url || item.product_url || item.productUrl || "#";
  link.href = targetUrl || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const imageUrl =
    item.image || (Array.isArray(item.images) && item.images[0]?.url) || "";
  const image = document.createElement("img");
  image.alt = item.name || "Produk rekomendasi";
  image.src = imageUrl;
  image.onerror = () => {
    image.onerror = null;
    image.src = "assets/starbox.png";
  };

  const content = document.createElement("div");
  content.className = "ads-card-content";

  const title = document.createElement("p");
  title.className = "ads-card-title";
  title.textContent = item.name || "Produk rekomendasi";

  const sourceName =
    item.source?.name || item.source?.code || "StarBox Partner";
  const source = document.createElement("div");
  source.className = "ads-source";
  source.textContent = sourceName;

  const shortLink = document.createElement("p");
  shortLink.className = "ads-short-url";
  const shortValue =
    item.short_url || item.product_url || item.productUrl || "";
  shortLink.textContent = shortValue || "";

  const priceEl = document.createElement("div");
  priceEl.className = "ads-price";
  priceEl.textContent = formatAdsPrice(
    item.price ?? item.price_display ?? item.priceDisplay
  );

  content.appendChild(title);
  content.appendChild(source);
  content.appendChild(shortLink);
  content.appendChild(priceEl);

  link.appendChild(image);
  link.appendChild(content);

  return link;
}

function populateAdsTrack(track, cards = [], direction = "horizontal") {
  if (!track) return;
  track.innerHTML = "";
  if (!cards.length) {
    track.innerHTML = `<div class="ads-empty">Belum ada rekomendasi.</div>`;
    return;
  }
  const minItems = direction === "horizontal" ? 6 : 4;
  const baseSet = [];
  const repeats = Math.max(minItems, cards.length);
  for (let i = 0; i < repeats; i++) {
    baseSet.push(cards[i % cards.length].cloneNode(true));
  }
  const fullSequence = baseSet.concat(
    baseSet.map((node) => node.cloneNode(true))
  );
  fullSequence.forEach((node) => track.appendChild(node));
  const speedSeconds = Math.max(24, Math.min(48, repeats * 4));
  track.style.setProperty("--ads-speed", `${speedSeconds}s`);
}

function renderAdsShowcase(items = [], pageKey = "web-emulator") {
  const { container, horizontal, vertical } = getAdsElements(pageKey);
  if (!container || !horizontal || !vertical) return;

  if (!items.length) {
    setAdsContainerVisible(pageKey, false);
    return;
  }

  const cards = items.map((item) => createAdsCardElement(item));
  populateAdsTrack(horizontal, cards, "horizontal");
  populateAdsTrack(vertical, cards, "vertical");
  setAdsContainerVisible(pageKey, true);
}

async function loadAdsItems(force = false, pageKey = "web-emulator") {
  if (!shouldDisplayAds()) return [];
  const cache = adsState.cache.get(pageKey) || {
    items: [],
    lastFetchedAt: 0,
  };
  const now = Date.now();
  if (
    !force &&
    adsState.loadingKeys.has(pageKey) &&
    cache.items &&
    cache.items.length
  ) {
    return cache.items;
  }
  if (!force && now - cache.lastFetchedAt < ADS_REFRESH_INTERVAL_MS) {
    return cache.items;
  }

  adsState.loadingKeys.add(pageKey);
  setAdsMessage("Memuat rekomendasi...", pageKey);

  try {
    const endpoint = await resolveAdsEndpoint();
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Server merespons ${response.status}`);
    }
    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const shuffled = shuffleAdsItems(data).slice(0, 30);
    adsState.items = shuffled;
    adsState.lastError = null;
    adsState.cache.set(pageKey, {
      items: shuffled,
      lastFetchedAt: Date.now(),
    });
    if (!shuffled.length) {
      setAdsContainerVisible(pageKey, false);
      return [];
    }
    renderAdsShowcase(shuffled, pageKey);
    return shuffled;
  } catch (err) {
    console.error("⚠️ Gagal memuat iklan promosi:", err);
    adsState.lastError = err?.message || String(err);
    setAdsContainerVisible(pageKey, false);
    return [];
  } finally {
    adsState.loadingKeys.delete(pageKey);
  }
}

function syncAdsShowcaseForPage(pageKey = "web-emulator", options = {}) {
  const { container } = getAdsElements(pageKey);
  if (!container) return;
  const shouldShow = shouldDisplayAds();
  container.style.display = shouldShow ? "" : "none";
  if (!shouldShow) return;

  const cache = adsState.cache.get(pageKey);
  if (cache?.items?.length && !options.forceRender && !options.forceRefresh) {
    renderAdsShowcase(cache.items, pageKey);
  }

  if (options.forceRefresh || !cache?.items?.length) {
    loadAdsItems(true, pageKey);
  } else {
    loadAdsItems(false, pageKey);
  }

  if (!cache?.items?.length) {
    setAdsContainerVisible(pageKey, false);
  }
}

function syncAllAdsShowcases(options = {}) {
  if (!shouldDisplayAds()) return;
  ADS_PAGE_KEYS.forEach((key) => {
    syncAdsShowcaseForPage(key, options);
  });
  updateAdsCountdownDisplays();
}

function startAdsAutoRefresh() {
  if (adsState.refreshTimer) return;
  getApiBase()
    .then(() => {
      adsState.lastRefreshAt = Date.now();
      adsState.nextRefreshAt = adsState.lastRefreshAt + ADS_REFRESH_INTERVAL_MS;
      startAdsCountdownTimer();
      adsState.refreshTimer = setInterval(() => {
        if (!shouldDisplayAds()) return;
        adsState.lastRefreshAt = Date.now();
        adsState.nextRefreshAt =
          adsState.lastRefreshAt + ADS_REFRESH_INTERVAL_MS;
        syncAllAdsShowcases({ forceRefresh: true });
      }, ADS_REFRESH_INTERVAL_MS);
    })
    .catch(() => {
      // fallback tanpa countdown jika gagal resolve base
      adsState.refreshTimer = setInterval(() => {
        if (!shouldDisplayAds()) return;
        syncAllAdsShowcases({ forceRefresh: true });
      }, ADS_REFRESH_INTERVAL_MS);
    });
}

function renderPackagesList(items = []) {
  const container = document.getElementById("adsPackagesList");
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p class="loading-text">Belum ada data paket.</p>`;
    return;
  }
  container.innerHTML = "";
  items.forEach((pkg) => {
    const card = document.createElement("div");
    card.className = "ads-package-card";

    const title = document.createElement("h4");
    title.textContent = pkg.name || "Paket";

    const price = document.createElement("p");
    price.className = "ads-package-price";
    price.textContent =
      pkg.price_display ||
      formatAdsPrice(pkg.price) ||
      (pkg.price ? `Rp ${pkg.price}` : "Rp -");

    const desc = document.createElement("p");
    desc.className = "ads-package-desc";
    desc.textContent = pkg.description || "Paket berlangganan StarBox.";

    const meta = document.createElement("div");
    meta.className = "ads-package-meta";
    const limit =
      pkg.is_device_limit_unlimited === true
        ? "Device: Unlimited"
        : `Device: ${pkg.device_limit ?? "-"} / layanan`;
    const cycle = pkg.billing_cycle
      ? `Billing: ${pkg.billing_cycle}/${pkg.billing_interval || 1}`
      : "Billing: -";
    [limit, cycle].forEach((text) => {
      const pill = document.createElement("span");
      pill.textContent = text;
      meta.appendChild(pill);
    });

    card.appendChild(title);
    card.appendChild(price);
    card.appendChild(desc);
    card.appendChild(meta);
    container.appendChild(card);
  });
}

async function loadPackagesList(force = false) {
  if (packagesState.loading && !force) return packagesState.items;
  const container = document.getElementById("adsPackagesList");
  if (container) {
    container.innerHTML = `<p class="loading-text">Memuat paket...</p>`;
  }
  packagesState.loading = true;
  try {
    const base = await getApiBase();
    const response = await fetch(`${base}${PACKAGES_API_PATH}`);
    if (!response.ok) throw new Error(`Server merespons ${response.status}`);
    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    packagesState.items = data;
    packagesState.lastError = null;
    renderPackagesList(data);
    return data;
  } catch (err) {
    console.error("⚠️ Gagal memuat daftar paket:", err);
    packagesState.lastError = err?.message || String(err);
    if (container) {
      container.innerHTML = `<p class="loading-text">Gagal memuat paket: ${packagesState.lastError}</p>`;
    }
    return [];
  } finally {
    packagesState.loading = false;
  }
}

function openAdsInfoModal() {
  const modal = document.getElementById("adsInfoModal");
  if (!modal) return;
  modal.style.display = "flex";
  if (packagesState.items.length) {
    renderPackagesList(packagesState.items);
  } else {
    const container = document.getElementById("adsPackagesList");
    if (container) {
      container.innerHTML = `<p class="loading-text">Memuat paket...</p>`;
    }
    loadPackagesList();
  }
}

function closeAdsInfoModal() {
  const modal = document.getElementById("adsInfoModal");
  if (modal) modal.style.display = "none";
}

function formatCountdown(ms) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function updateAdsCountdownDisplays() {
  if (!isDevBuildCached) {
    ADS_PAGE_KEYS.forEach((key) => {
      const el = document.getElementById(buildAdsId("adsCountdown", key));
      if (el) {
        el.style.display = "none";
        el.textContent = "";
      }
    });
    return;
  }
  const remaining = (adsState.nextRefreshAt || 0) - Date.now();
  const text =
    remaining > 0
      ? `Auto refresh: ${formatCountdown(remaining)}`
      : "Refresh...";
  ADS_PAGE_KEYS.forEach((key) => {
    const el = document.getElementById(buildAdsId("adsCountdown", key));
    if (el) {
      el.style.display = "inline-flex";
      el.textContent = text;
    }
  });
}

function startAdsCountdownTimer() {
  if (!isDevBuildCached) return;
  if (adsState.countdownTimer) return;
  adsState.countdownTimer = setInterval(updateAdsCountdownDisplays, 1000);
  updateAdsCountdownDisplays();
}

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
  if (buttonAndroid)
    buttonAndroid.style.display = canShow ? "inline-flex" : "none";
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

function getAndroidRemoteServiceMeta(serviceId) {
  const key = sanitizeServiceId(serviceId);
  const meta =
    SERVICE_LIBRARY_MAP.get(key) || serviceConfig[key] || serviceConfig.default;
  return {
    id: key,
    label: meta?.label || serviceId || "Android Remote",
    color: meta?.color || "#6b7280",
    description: meta?.description || "",
  };
}

function getAndroidRemoteServiceOptions() {
  return ANDROID_REMOTE_SERVICE_IDS.map((id) =>
    getAndroidRemoteServiceMeta(id)
  );
}

function formatAndroidRemoteStatus(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "connected" || normalized === "active") {
    return { label: "Connected", className: "status-chip connected" };
  }
  if (normalized === "running") {
    return { label: "Running", className: "status-chip connected" };
  }
  if (normalized === "error") {
    return { label: "Error", className: "status-chip error" };
  }
  if (normalized === "disconnected" || normalized === "stopped") {
    return { label: "Disconnected", className: "status-chip disconnected" };
  }
  return { label: status || "Unknown", className: "status-chip" };
}

let isLoadingAdbDevices = false;

async function maybeScanLocalWifiForAdb(
  showToastMessage = false,
  scanMode = "quick"
) {
  const api = window.electronAPI?.androidRemote;
  if (!api?.scanLocalWifi) return null;
  try {
    const result = await api.scanLocalWifi({ scanMode });
    if (showToastMessage) {
      if (result?.success) {
        const newCount = Array.isArray(result.connected)
          ? result.connected.length
          : 0;
        if (newCount > 0) {
          showToast(
            `Scan Wi-Fi menemukan ${newCount} device siap ADB.`,
            3200,
            "success"
          );
        } else if (result.scanned) {
          showToast("Scan Wi-Fi selesai, tidak ada device baru.", 2800, "info");
        }
      } else {
        showToast(
          result?.message || "Scan Wi-Fi gagal dijalankan.",
          3200,
          "error"
        );
      }
    }
    return result;
  } catch (err) {
    console.warn("⚠️ Scan Wi-Fi ADB gagal:", err);
    if (showToastMessage) {
      showToast(err?.message || "Scan Wi-Fi gagal.", 3200, "error");
    }
    return null;
  }
}

// Progress bar helpers
function showAdbScanProgress() {
  const progressEl = document.getElementById("adbScanProgress");
  const btnRefresh = document.getElementById("btnRefreshAdb");
  if (progressEl) progressEl.style.display = "block";
  if (btnRefresh) btnRefresh.disabled = true;
}

function hideAdbScanProgress() {
  const progressEl = document.getElementById("adbScanProgress");
  const btnRefresh = document.getElementById("btnRefreshAdb");
  if (progressEl) progressEl.style.display = "none";
  if (btnRefresh) btnRefresh.disabled = false;
}

function updateAdbScanProgress(percent, status) {
  const progressBar = document.getElementById("adbScanProgressBar");
  const percentEl = document.getElementById("adbScanPercent");
  const statusEl = document.getElementById("adbScanStatus");

  if (progressBar) progressBar.style.width = `${percent}%`;
  if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
  if (statusEl) statusEl.textContent = status;
}

let wifiScanProgressListener = null;
let foundDevicesDuringLiveScan = new Set();

async function refreshAdbDeviceOptionsInternal(
  selectId = "androidAdbDeviceSelect",
  { showToastMessage = false } = {}
) {
  const select = document.getElementById(selectId);
  if (!select || isLoadingAdbDevices) return;
  isLoadingAdbDevices = true;
  foundDevicesDuringLiveScan.clear();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Memuat perangkat ADB...";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.innerHTML = "";
  select.appendChild(placeholder);

  // Show progress bar
  showAdbScanProgress();

  // Setup real-time WiFi scan progress listener
  if (window.electronAPI?.androidRemote?.onWifiScanProgress) {
    // Remove old listener if exists
    if (wifiScanProgressListener) {
      wifiScanProgressListener();
    }

    wifiScanProgressListener =
      window.electronAPI.androidRemote.onWifiScanProgress((data) => {
        const { progress, foundDevices, newDevice, completed } = data;

        // Update progress bar
        if (progress !== undefined) {
          const status = completed
            ? "Selesai!"
            : `Scanning WiFi (${Math.round(progress)}%)...`;
          updateAdbScanProgress(
            Math.max(20, Math.min(90, progress * 0.7 + 20)),
            status
          );
        }

        // Add newly found device to dropdown immediately
        if (newDevice && !foundDevicesDuringLiveScan.has(newDevice)) {
          foundDevicesDuringLiveScan.add(newDevice);

          // Remove placeholder if this is the first device
          if (select.options.length === 1 && select.options[0].disabled) {
            select.innerHTML = "";
            const newPlaceholder = document.createElement("option");
            newPlaceholder.value = "";
            newPlaceholder.textContent = "Pilih perangkat ADB...";
            newPlaceholder.disabled = true;
            newPlaceholder.selected = true;
            select.appendChild(newPlaceholder);
          }

          // Add the new device option
          const option = document.createElement("option");
          option.value = newDevice;
          option.textContent = `📱 ${newDevice} (WiFi)`;
          select.appendChild(option);

          console.log(`✅ Real-time: Added ${newDevice} to dropdown`);
        }
      });
  }

  try {
    // Get scan options from checkboxes
    const scanUsb = document.getElementById("adbScanUsb");
    const scanWifiQuick = document.getElementById("adbScanWifiQuick");
    const scanWifiDeep = document.getElementById("adbScanWifiDeep");

    const shouldScanUsb = scanUsb && scanUsb.checked;
    const shouldScanWifi =
      (scanWifiQuick && scanWifiQuick.checked) ||
      (scanWifiDeep && scanWifiDeep.checked);
    const scanMode = scanWifiDeep && scanWifiDeep.checked ? "deep" : "quick";

    // Validate: at least one option must be selected
    if (!shouldScanUsb && !shouldScanWifi) {
      showToast("Pilih minimal 1 mode scan (USB atau WiFi)", 3000, "error");
      return;
    }

    let progress = 10;

    // Step 1: USB scan (instant if enabled)
    if (shouldScanUsb) {
      updateAdbScanProgress(progress, "Memeriksa perangkat USB...");
      progress += 10;
      // USB devices are automatically detected by adb devices command
      // No explicit scan needed, just a small delay for UX
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Step 2: WiFi scan (if enabled)
    if (shouldScanWifi) {
      const scanModeLabel =
        scanMode === "deep"
          ? "Deep Scan (30000-49999)"
          : "Quick Scan (port umum)";
      updateAdbScanProgress(progress, `${scanModeLabel}: Scanning WiFi...`);
      await maybeScanLocalWifiForAdb(showToastMessage, scanMode);
      progress = 90;
    }

    updateAdbScanProgress(progress, "Mengambil daftar perangkat...");

    const response =
      (await window.electronAPI.androidRemote.listAdbDevices()) || {};
    const list = Array.isArray(response.devices) ? response.devices : [];
    cachedAdbDevices = list;

    updateAdbScanProgress(100, "Selesai!");

    // Only update dropdown if no devices were found during live scan
    if (foundDevicesDuringLiveScan.size === 0) {
      applyAdbDevicesToSelect(select, list);
    } else {
      // Merge with any USB devices that weren't in the WiFi scan
      const wifiDeviceIds = Array.from(foundDevicesDuringLiveScan);
      const usbDevices = list.filter((d) => !wifiDeviceIds.includes(d.id));

      // Add USB devices if any
      usbDevices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = `📱 ${device.name || device.id}`;
        select.appendChild(option);
      });
    }

    if (showToastMessage) {
      if (response.success) {
        showToast(`Perangkat ADB terdeteksi: ${list.length}.`, 2500, "success");
      } else {
        showToast(
          response.message || "Gagal memuat perangkat ADB.",
          3500,
          "error"
        );
      }
    }
  } catch (err) {
    console.error("⚠️ Gagal memuat perangkat ADB:", err);
    if (foundDevicesDuringLiveScan.size === 0) {
      select.innerHTML =
        '<option value="">Tidak dapat memuat perangkat ADB</option>';
    }
    if (showToastMessage) {
      showToast("Tidak dapat membaca daftar ADB.", 3500, "error");
    }
  } finally {
    isLoadingAdbDevices = false;
    // Cleanup listener
    if (wifiScanProgressListener) {
      wifiScanProgressListener();
      wifiScanProgressListener = null;
    }
    // Hide progress bar after delay
    setTimeout(hideAdbScanProgress, 500);
  }
}

// Toggle between Scan and Manual input modes
function toggleAdbInputMode() {
  const scanMode = document.getElementById("adbModeScan");
  const manualMode = document.getElementById("adbModeManual");
  const scanSection = document.getElementById("adbScanOptionsSection");
  const manualSection = document.getElementById("adbManualInputSection");

  if (manualMode && manualMode.checked) {
    // Show manual input, hide scan options
    if (scanSection) scanSection.style.display = "none";
    if (manualSection) manualSection.style.display = "block";
  } else {
    // Show scan options, hide manual input
    if (scanSection) scanSection.style.display = "block";
    if (manualSection) manualSection.style.display = "none";
  }
}

// Connect to manually entered IP:port
async function connectManualAdbDevice() {
  const ipInput = document.getElementById("adbManualIp");
  const portInput = document.getElementById("adbManualPort");
  const select = document.getElementById("androidAdbDeviceSelect");

  if (!ipInput || !portInput) return;

  const ip = ipInput.value.trim();
  const port = portInput.value.trim();

  if (!ip || !port) {
    showToast("Harap isi IP Address dan Port!", 3000, "error");
    return;
  }

  // Validate IP format (basic)
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) {
    showToast("Format IP Address tidak valid!", 3000, "error");
    return;
  }

  // Validate port (1-65535)
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    showToast("Port harus antara 1-65535!", 3000, "error");
    return;
  }

  showToast(`Connecting ke ${ip}:${port}...`, 2000, "info");

  try {
    const api = window.electronAPI?.androidRemote;
    if (!api?.connectManualAdb) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    const result = await api.connectManualAdb({ ip, port });

    if (result?.success) {
      showToast(`✅ Berhasil connect ke ${ip}:${port}!`, 3000, "success");

      // Add to dropdown
      if (select && result.deviceId) {
        const option = document.createElement("option");
        option.value = result.deviceId;
        option.textContent = `📱 ${result.deviceName || result.deviceId}`;
        option.selected = true;
        select.appendChild(option);
      }

      // Clear inputs
      ipInput.value = "";
      portInput.value = "";

      // Switch back to scan mode
      const scanModeRadio = document.getElementById("adbModeScan");
      if (scanModeRadio) {
        scanModeRadio.checked = true;
        toggleAdbInputMode();
      }
    } else {
      showToast(result?.message || "Gagal connect ke device!", 4000, "error");
    }
  } catch (err) {
    console.error("❌ Error connecting manual ADB:", err);
    showToast(err?.message || "Gagal connect ke device!", 4000, "error");
  }
}

function applyAdbDevicesToSelect(select, devices = []) {
  select.innerHTML = "";
  if (!devices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Tidak ada device ADB terdeteksi";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
    return;
  }
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pilih perangkat ADB...";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.adbId;
    const parts = [
      device.description || device.model,
      `(${device.adbId})`,
      device.status === "device" ? "online" : device.status,
    ].filter(Boolean);
    option.textContent = parts.join(" ");
    select.appendChild(option);
  });
}

function populateAndroidRemoteServiceSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = "";
  const options = getAndroidRemoteServiceOptions();
  options.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.label;
    select.appendChild(option);
  });
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
    session.limit_broadcast_day ?? session.package?.limit_broadcast_day ?? null;
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
  if (authState.limitDeviceWAGateway == null) {
    authState.limitDeviceWAGateway = DEFAULT_LIMITS.limitDeviceWAGateway;
  }
  if (authState.limitAutoReply == null) {
    authState.limitAutoReply = DEFAULT_LIMITS.limitAutoReply;
  }
  if (authState.limitBroadcastDay == null) {
    authState.limitBroadcastDay = DEFAULT_LIMITS.limitBroadcastDay;
  }
  ensurePackageCountdownTimer();
  updateAuthHeaderUI();
  updateDeviceQuotaBanner();
  syncServiceAvailability();
  updateAddDeviceQuotaHint();
  syncAllAdsShowcases({ forceRefresh: true });
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
        : "Download & Install";
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
      ? `Mengunduh pembaruan... ${pct}%`
      : versionDownloadState.state === "installing"
      ? "Membuka installer..."
      : versionDownloadState.state === "downloaded"
      ? "Unduhan selesai. Membuka installer..."
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
  versionDownloadState.progress = 0;
  updateVersionDownloadUI();
  showToast("Mengunduh pembaruan StarBox...", 2000, "info");

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
      autoInstall: true,
      channel: latestVersionInfo.channel || "stable",
      version: latestVersionInfo.version,
    });
    if (!result?.success) {
      versionDownloadState.state = "error";
      versionDownloadState.message = result?.message || "Gagal mengunduh.";
      updateVersionDownloadUI();
      showToast(versionDownloadState.message, 4000, "error");
      return;
    }
    versionDownloadState.state = "downloaded";
    versionDownloadState.progress = 100;
    versionDownloadState.path = result.path;
    versionDownloadState.message =
      result.opened === true
        ? "Installer dibuka. Lanjutkan proses instalasi."
        : "Unduhan selesai.";
    updateVersionDownloadUI();
    if (result.opened) {
      showToast(
        "Installer sudah dibuka. Ikuti wizard instalasi.",
        4000,
        "success"
      );
    } else {
      showToast(
        "Unduhan selesai. Buka installer untuk memperbarui.",
        4000,
        "success"
      );
    }
  } catch (err) {
    versionDownloadState.state = "error";
    versionDownloadState.message = err?.message || "Gagal mengunduh.";
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
    updateIOSButtonVisibility();
    systemInfoBadgeRetryCount = 0;
  } catch (err) {
    console.error("⚠️ Gagal memuat system info:", err);
    renderSystemInfoBadge(null, err);
    systemPlatform =
      typeof navigator !== "undefined" ? navigator.userAgent : null;
    updateIOSButtonVisibility();
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
  const webDevices = devices.filter(
    (d) => (d.service || "").toLowerCase() !== "android"
  );

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
          <button class="record-btn" title="Rekam layar device">
            <i class="bi bi-record-circle"></i>
            <span>Record</span>
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
    const recordButton = deviceCard.querySelector(".record-btn");

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

// Render Android devices (MUST BE DEFINED BEFORE loadAllDevicesAndroid)
function renderDevicesAndroid(devices = []) {
  const container = document.getElementById("device-list-android");
  if (!container) {
    console.error("⚠️ Container #device-list-android not found!");
    return;
  }
  cachedAndroidRemoteDevices = Array.isArray(devices) ? devices : [];
  container.innerHTML = "";

  if (!cachedAndroidRemoteDevices.length) {
    container.innerHTML =
      '<div style="padding: 2rem; text-align: center; color: #6b7280;">Belum ada device Android. Klik "Tambah Device" untuk menambah ADB Remote atau Android Emulator.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  cachedAndroidRemoteDevices.forEach((device) => {
    if (device._deviceType === 'emulator') {
      const card = buildAndroidEmulatorCard(device);
      if (card) fragment.appendChild(card);
      return;
    }

    const serviceMeta = getAndroidRemoteServiceMeta(device.service);
    const statusMeta = formatAndroidRemoteStatus(device.status);
    const deviceCard = document.createElement("div");
    deviceCard.className = "device android-remote-card";
    deviceCard.dataset.uid = device.uid;
    deviceCard.dataset.service = device.service || "";
    deviceCard.dataset.status = device.status || "disconnected";
    deviceCard.style.setProperty("--device-accent", serviceMeta.color);

    deviceCard.innerHTML = `
      <div class="device-header">
        <div class="device-meta">
          <h3>${device.name || serviceMeta.label}</h3>
          <span class="device-service-name">${serviceMeta.label}</span>
        </div>
        <span class="${statusMeta.className}">${statusMeta.label}</span>
      </div>
      <div class="device-body android-remote-body">
        <p><strong>ADB ID:</strong> ${device.adbId || "-"}</p>
        ${
          device.adbName
            ? `<p><strong>Alias:</strong> ${device.adbName}</p>`
            : ""
        }
      </div>
      <div class="device-footer">
        <div class="device-actions">
          <button class="edit">
            <i class="bi bi-pencil-fill"></i>
            <span>Edit</span>
          </button>
          <button class="monitor">
            <i class="bi bi-display"></i>
            <span>Monitor</span>
          </button>
          <button class="delete">
            <i class="bi bi-trash-fill"></i>
            <span>Hapus</span>
          </button>
          <div class="device-dropdown">
            <button class="dropdown-action" data-action="wake">
              <i class="bi bi-power"></i> Wake
            </button>
            <button class="dropdown-action" data-action="sleep">
              <i class="bi bi-moon"></i> Sleep
            </button>
            <button class="dropdown-action" data-action="volume-up">
              <i class="bi bi-volume-up"></i> Vol +
            </button>
            <button class="dropdown-action" data-action="volume-down">
              <i class="bi bi-volume-down"></i> Vol -
            </button>
            <button class="dropdown-action" data-action="screenshot">
              <i class="bi bi-camera"></i> Screenshot
            </button>
          </div>
        </div>
      </div>
    `;

    const editButton = deviceCard.querySelector(".edit");
    const monitorButton = deviceCard.querySelector(".monitor");
    const deleteButton = deviceCard.querySelector(".delete");

    editButton?.addEventListener("click", (evt) => {
      evt.stopPropagation();
      openEditAndroidRemoteDevice(device);
    });

    monitorButton?.addEventListener("click", (evt) => {
      evt.stopPropagation();
      openAndroidRemoteDisplay(device.uid);
    });

    deleteButton?.addEventListener("click", (evt) => {
      evt.stopPropagation();
      deleteAndroidRemoteDevice(device.uid);
    });
    const dropdownButton = deviceCard.querySelector(".device-more");
    const dropdown = deviceCard.querySelector(".device-dropdown");
    dropdownButton?.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const alreadyOpen = dropdown?.classList.contains("show");
      document
        .querySelectorAll(".device-dropdown.show")
        .forEach((el) => el.classList.remove("show"));
      if (!alreadyOpen && dropdown) {
        dropdown.classList.add("show");
      }
    });
    dropdown?.querySelectorAll(".dropdown-action").forEach((button) => {
      button.addEventListener("click", (evt) => {
        evt.stopPropagation();
        const action = button.dataset.action;
        handleAndroidMiniAction(device, action);
        dropdown.classList.remove("show");
      });
    });

    fragment.appendChild(deviceCard);
  });

  container.appendChild(fragment);
}

function buildAndroidEmulatorCard(device) {
  const spec = device.androidSpec || {};
  const specLabel = spec.id === 'lite' ? '⚡ Lite' : spec.id === 'performance' ? '🚀 Performance' : '⚖️ Balanced';
  const isRunning = device.status === 'running';

  const card = document.createElement('div');
  card.className = 'device android-remote-card';
  card.dataset.uid = device.uid;
  card.dataset.service = 'android';
  card.dataset.status = device.status || 'stopped';
  card.style.setProperty('--device-accent', '#3ddc84');

  card.innerHTML = `
    <div class="device-header">
      <div class="device-meta">
        <h3>${device.name || 'Android Emulator'}</h3>
        <span class="device-service-name">Android Emulator</span>
      </div>
      <span class="status-badge ${isRunning ? 'active' : 'inactive'}">${isRunning ? 'Running' : 'Stopped'}</span>
    </div>
    <div class="device-body android-remote-body">
      <p><strong>Preset:</strong> ${specLabel}</p>
      <p><strong>RAM:</strong> ${spec.memoryMb || 1536} MB &nbsp;·&nbsp; <strong>CPU:</strong> ${spec.cores || 2} Core</p>
      <p><strong>Resolusi:</strong> ${spec.resolution || '720x1280'}</p>
    </div>
    <div id="emuProgress-${device.uid}" style="display:none;padding:8px 12px 0">
      <div style="font-size:11px;color:#888;margin-bottom:4px" id="emuProgressLabel-${device.uid}">Mempersiapkan...</div>
      <div style="height:4px;background:#1a1a2e;border-radius:4px;overflow:hidden">
        <div id="emuProgressBar-${device.uid}" style="height:100%;width:0%;background:linear-gradient(90deg,#3ddc84,#25d366);transition:width .3s"></div>
      </div>
    </div>
    <div class="device-footer">
      <div class="device-actions">
        <button class="emu-start-btn ${isRunning ? 'secondary' : ''}">
          <i class="bi bi-${isRunning ? 'stop-fill' : 'play-fill'}"></i>
          <span>${isRunning ? 'Stop' : 'Start'}</span>
        </button>
        <button class="emu-fix-btn">
          <i class="bi bi-tools"></i>
          <span>Fix</span>
        </button>
        <button class="delete">
          <i class="bi bi-trash-fill"></i>
          <span>Hapus</span>
        </button>
      </div>
    </div>
  `;

  card.querySelector('.emu-start-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isRunning) stopAndroidEmulatorCard(device.uid);
    else startAndroidEmulatorCard(device.uid, card);
  });

  card.querySelector('.emu-fix-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fixAndroidEmulatorCard(device.uid);
  });

  card.querySelector('.delete')?.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteAndroidEmulatorCard(device.uid, device.name);
  });

  return card;
}

async function startAndroidEmulatorCard(uid, cardEl) {
  const setProgress = (label, pct) => {
    const prog = document.getElementById('emuProgress-' + uid);
    const bar = document.getElementById('emuProgressBar-' + uid);
    const lbl = document.getElementById('emuProgressLabel-' + uid);
    if (prog) prog.style.display = pct !== null ? 'block' : 'none';
    if (bar && pct !== null) bar.style.width = pct + '%';
    if (lbl && label) lbl.textContent = label;
  };

  try {
    const check = await window.electronAPI.android.checkInstallation();
    if (!check?.installed) {
      setProgress('Mengunduh Android SDK (~800MB)...', 0);
      showToast('📥 Mengunduh Android SDK (~800MB)...', 5000, 'info');
      window.electronAPI.android.onDownloadProgress((data) => {
        const pct = Math.round((data.downloaded / (data.total || 1)) * 100) || 0;
        setProgress(`Mengunduh SDK: ${pct}% — ${data.phase || ''}`, pct);
      });
      await window.electronAPI.android.download(uid);
    }

    setProgress('Memulai emulator...', 5);
    window.electronAPI.android.onStartProgress((data) => {
      const pct = data.phase === 'booted' ? 100 : data.phase === 'wait-boot' ? 50 : 20;
      setProgress(data.message || data.phase || 'Memulai...', pct);
    });

    const result = await window.electronAPI.android.start(uid);
    setProgress(null, null);

    if (result?.success) {
      showToast('✅ Emulator Android berjalan!', 3000, 'success');
      await loadAllDevicesAndroid();
    } else {
      showToast('Gagal start emulator: ' + (result?.message || result?.error || ''), 5000, 'error');
    }
  } catch (err) {
    setProgress(null, null);
    showToast('Error: ' + (err?.message || err), 5000, 'error');
  }
}

async function stopAndroidEmulatorCard(uid) {
  try {
    await window.electronAPI.android.stop(uid);
    showToast('Emulator dihentikan.', 2000, 'info');
    await loadAllDevicesAndroid();
  } catch (err) {
    showToast('Error stop: ' + (err?.message || err), 4000, 'error');
  }
}

async function fixAndroidEmulatorCard(uid) {
  try {
    showToast('🔧 Memperbaiki Android...', 3000, 'info');
    await window.electronAPI.android.fixIssues(uid);
    showToast('Fix selesai.', 2000, 'success');
    await loadAllDevicesAndroid();
  } catch (err) {
    showToast('Error fix: ' + (err?.message || err), 4000, 'error');
  }
}

async function deleteAndroidEmulatorCard(uid, name) {
  const ok = await Swal.fire({
    title: window.t('dialog.delete_emulator.title'),
    text: `"${name}" akan dihapus permanen.`,
    icon: 'warning', showCancelButton: true,
    confirmButtonText: window.t('dialog.delete_emulator.confirm'),
    cancelButtonText: window.t('dialog.delete_emulator.cancel'),
    confirmButtonColor: '#ef4444',
  });
  if (!ok.isConfirmed) return;
  try {
    await window.electronAPI.deleteDevice(uid);
    showToast(window.t('toast.emulator.deleted'), 2000, 'success');
    await loadAllDevicesAndroid();
  } catch (err) {
    showToast(window.t('toast.emulator.delete_error') + (err?.message || err), 4000, 'error');
  }
}

async function loadAllDevicesAndroid() {
  try {
    const [adbResult, allDevicesResult] = await Promise.all([
      window.electronAPI.androidRemote.getDevices(),
      window.electronAPI.loadDevices(),
    ]);
    const adbDevices = (adbResult?.devices || []).map(d => ({ ...d, _deviceType: 'adb' }));
    const emulatorDevices = (allDevicesResult?.devices || [])
      .filter(d => (d.service || '').toLowerCase() === 'android')
      .map(d => ({ ...d, _deviceType: 'emulator' }));
    renderDevicesAndroid([...emulatorDevices, ...adbDevices]);
  } catch (err) {
    console.error("⚠️ Gagal memuat Android devices:", err);
  }
}

async function loadAllDevices() {
  try {
    await Promise.all([loadAllDevicesWeb(), loadAllDevicesAndroid()]);
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

function deleteAndroidRemoteDevice(uid) {
  if (!uid) return;
  Swal.fire({
    title: "Hapus Device Android?",
    text: "Perangkat fisik ini akan dilepas dari StarBox.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal",
  }).then((result) => {
    if (!result.isConfirmed) return;
    window.electronAPI.androidRemote
      .deleteDevice(uid)
      .then((response) => {
        if (response.success) {
          showToast("Device Android berhasil dihapus.", 3000, "success");
          loadAllDevicesAndroid();
        } else {
          showToast(
            response.message || "Gagal menghapus device.",
            3500,
            "error"
          );
        }
      })
      .catch((err) => {
        console.error("⚠️ Gagal menghapus device Android:", err);
        showToast(err?.message || "Gagal menghapus device.", 3500, "error");
      });
  });
}

// Edit Android Remote Device
function openEditAndroidRemoteDevice(device) {
  if (!device || !device.uid) return;

  const modal = document.getElementById("editModalAndroidRemote");
  if (!modal) return;

  // Populate form
  document.getElementById("editAndroidRemoteUid").value = device.uid;
  document.getElementById("editAndroidRemoteName").value = device.name || "";

  const serviceSelect = document.getElementById("editAndroidRemoteService");
  if (serviceSelect) {
    serviceSelect.value = device.service || "android-general";
  }

  // Populate IP/Port fields from adbId (format: "IP:PORT")
  const ipInput = document.getElementById("editAndroidRemoteIp");
  const portInput = document.getElementById("editAndroidRemotePort");

  if (device.adbId && device.adbId.includes(":")) {
    const [ip, port] = device.adbId.split(":");
    if (ipInput) ipInput.value = ip || "";
    if (portInput) portInput.value = port || "";
  } else {
    if (ipInput) ipInput.value = "";
    if (portInput) portInput.value = "";
  }

  // Populate WhatsApp automation fields if available
  const baseUrlInput = document.getElementById("editWhatsAppBaseUrl");
  const callbackUrlInput = document.getElementById("editWhatsAppCallbackUrl");
  const variantSelect = document.getElementById("editWhatsAppVariant");

  if (baseUrlInput) baseUrlInput.value = device.whatsappBaseUrl || "";
  if (callbackUrlInput)
    callbackUrlInput.value = device.whatsappCallbackUrl || "";
  if (variantSelect)
    variantSelect.value = device.whatsappVariant || "consumer";

  // Show/hide WhatsApp fields based on service
  toggleWhatsAppAutomationFields();

  // Add event listener for service change
  if (serviceSelect) {
    serviceSelect.removeEventListener("change", toggleWhatsAppAutomationFields);
    serviceSelect.addEventListener("change", toggleWhatsAppAutomationFields);
  }

  modal.style.display = "flex";
}

function toggleWhatsAppAutomationFields() {
  const serviceSelect = document.getElementById("editAndroidRemoteService");
  const whatsappFields = document.getElementById(
    "editWhatsAppAutomationFields"
  );
  const variantSelect = document.getElementById("editWhatsAppVariant");

  if (!serviceSelect || !whatsappFields) return;

  const isWhatsApp = serviceSelect.value === "android-whatsapp";
  whatsappFields.style.display = isWhatsApp ? "block" : "none";
  if (variantSelect) {
    variantSelect.disabled = !isWhatsApp;
    if (!isWhatsApp) {
      variantSelect.value = "consumer";
    }
  }
}

function closeEditAndroidRemoteModal() {
  const modal = document.getElementById("editModalAndroidRemote");
  if (modal) modal.style.display = "none";
}

async function reconnectAndroidRemoteDevice() {
  const ipInput = document.getElementById("editAndroidRemoteIp");
  const portInput = document.getElementById("editAndroidRemotePort");
  const uid = document.getElementById("editAndroidRemoteUid").value;

  if (!ipInput || !portInput || !uid) return;

  const ip = ipInput.value.trim();
  const port = portInput.value.trim();

  if (!ip || !port) {
    showToast("Harap isi IP Address dan Port!", 3000, "error");
    return;
  }

  // Validate IP format
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) {
    showToast("Format IP Address tidak valid!", 3000, "error");
    return;
  }

  // Validate port
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    showToast("Port harus antara 1-65535!", 3000, "error");
    return;
  }

  showToast(`Reconnecting ke ${ip}:${port}...`, 2000, "info");

  try {
    const api = window.electronAPI?.androidRemote;
    if (!api?.connectManualAdb || !api?.getDevices) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    // Get current device to get old adbId
    const devicesResult = await api.getDevices();
    const currentDevice = devicesResult?.devices?.find((d) => d.uid === uid);
    const oldAdbId = currentDevice?.adbId || null;

    const newAdbId = `${ip}:${port}`;

    // Connect to new IP:Port (will disconnect old one)
    const result = await api.connectManualAdb({
      ip,
      port,
      oldAdbId: oldAdbId,
    });

    if (result?.success) {
      showToast(`✅ Berhasil reconnect ke ${ip}:${port}!`, 3000, "success");

      // Update the device record with new adbId
      const updateResult = await api.editDevice({
        uid: uid,
        adbId: newAdbId,
      });

      if (updateResult?.success) {
        console.log(`✅ Device ${uid} updated with new adbId: ${newAdbId}`);
        // Reload devices list
        await loadAllDevicesAndroid();
        closeEditAndroidRemoteModal();
      } else {
        showToast("Reconnect berhasil tapi gagal menyimpan!", 4000, "warning");
      }
    } else {
      showToast(result?.message || "Gagal reconnect ke device!", 4000, "error");
    }
  } catch (err) {
    console.error("❌ Error reconnecting:", err);
    showToast(err?.message || "Gagal reconnect ke device!", 4000, "error");
  }
}

async function saveEditAndroidRemoteDevice() {
  const uid = document.getElementById("editAndroidRemoteUid").value;
  const name = document.getElementById("editAndroidRemoteName").value.trim();
  const service = document.getElementById("editAndroidRemoteService").value;

  if (!uid || !name) {
    showToast("Nama device harus diisi", 3000, "error");
    return;
  }

  const updates = {
    name,
    service,
  };

  // Add WhatsApp automation URLs if service is android-whatsapp
  if (service === "android-whatsapp") {
    const baseUrl = document.getElementById("editWhatsAppBaseUrl").value.trim();
    const callbackUrl = document
      .getElementById("editWhatsAppCallbackUrl")
      .value.trim();
    const whatsappVariant =
      document.getElementById("editWhatsAppVariant")?.value || "consumer";

    updates.whatsappBaseUrl = baseUrl;
    updates.whatsappCallbackUrl = callbackUrl;
    updates.whatsappVariant = whatsappVariant;
  }

  try {
    const response = await window.electronAPI.androidRemote.updateDevice(
      uid,
      updates
    );

    if (response.success) {
      showToast("Device berhasil diupdate", 3000, "success");
      closeEditAndroidRemoteModal();
      loadAllDevicesAndroid();
    } else {
      showToast(response.message || "Gagal update device", 3500, "error");
    }
  } catch (err) {
    console.error("⚠️ Gagal update device:", err);
    showToast(err?.message || "Gagal update device", 3500, "error");
  }
}

// Toggle between WiFi and Cable mode in Edit Android Remote modal
function toggleEditConnectionMode() {
  const wifiMode = document.getElementById("editModeWifi");
  const cableMode = document.getElementById("editModeCable");
  const wifiSection = document.getElementById("editWifiConnectionSection");
  const cableSection = document.getElementById("editCableConnectionSection");

  if (cableMode && cableMode.checked) {
    // Show cable section, hide WiFi section
    if (wifiSection) wifiSection.style.display = "none";
    if (cableSection) cableSection.style.display = "block";

    // Auto-scan ADB devices when switching to cable mode
    scanEditAdbDevices();
  } else {
    // Show WiFi section, hide cable section
    if (wifiSection) wifiSection.style.display = "block";
    if (cableSection) cableSection.style.display = "none";
  }
}

// Scan ADB devices via cable in Edit Android Remote modal
async function scanEditAdbDevices() {
  const select = document.getElementById("editAdbDeviceSelect");
  const progressBar = document.getElementById("editAdbScanProgressBar");
  const progressSection = document.getElementById("editAdbScanProgress");
  const statusText = document.getElementById("editAdbScanStatus");
  const percentText = document.getElementById("editAdbScanPercent");

  if (!select) return;

  // Show progress
  if (progressSection) progressSection.style.display = "block";
  if (statusText) statusText.textContent = "Scanning USB devices...";
  if (percentText) percentText.textContent = "0%";
  if (progressBar) progressBar.style.width = "0%";

  select.innerHTML = '<option value="">Scanning...</option>';

  try {
    const api = window.electronAPI?.androidRemote;
    if (!api?.listAdbDevices) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    // Animate progress
    if (progressBar) progressBar.style.width = "50%";
    if (percentText) percentText.textContent = "50%";

    // Get list of ADB devices (USB devices are automatically detected)
    const response = await api.listAdbDevices();
    const list = Array.isArray(response?.devices) ? response.devices : [];

    // Animate progress
    if (progressBar) progressBar.style.width = "100%";
    if (percentText) percentText.textContent = "100%";
    if (statusText) statusText.textContent = "Scan selesai";

    if (list.length > 0) {
      select.innerHTML = '<option value="">-- Pilih Perangkat --</option>';
      list.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id || device.adbId;
        const displayName = device.name || device.id || device.adbId;
        const modelInfo = device.model ? ` (${device.model})` : "";
        option.textContent = `${displayName}${modelInfo}`;
        select.appendChild(option);
      });
      showToast(`Ditemukan ${list.length} perangkat`, 3000, "success");
    } else {
      select.innerHTML =
        '<option value="">Tidak ada perangkat ditemukan</option>';
      showToast("Tidak ada perangkat ADB terdeteksi", 3000, "warning");
    }
  } catch (err) {
    console.error("❌ Error scanning ADB devices:", err);
    select.innerHTML = '<option value="">Error scanning devices</option>';
    showToast(err?.message || "Gagal scan perangkat ADB", 3500, "error");
  } finally {
    // Hide progress after delay
    setTimeout(() => {
      if (progressSection) progressSection.style.display = "none";
    }, 500);
  }
}

// Connect selected ADB device in Edit Android Remote modal
async function connectEditAdbDevice() {
  const select = document.getElementById("editAdbDeviceSelect");
  const uid = document.getElementById("editAndroidRemoteUid").value;

  if (!select || !uid) return;

  const adbId = select.value;
  if (!adbId) {
    showToast("Harap pilih perangkat ADB terlebih dahulu!", 3000, "error");
    return;
  }

  showToast(`Connecting ke ${adbId}...`, 2000, "info");

  try {
    const api = window.electronAPI?.androidRemote;
    if (!api?.editDevice) {
      showToast("API tidak tersedia!", 3000, "error");
      return;
    }

    // Update device with new adbId
    const updateResult = await api.editDevice({
      uid: uid,
      adbId: adbId,
    });

    if (updateResult?.success) {
      showToast(`✅ Berhasil connect ke ${adbId}!`, 3000, "success");

      // Reload devices list
      await loadAllDevicesAndroid();
      closeEditAndroidRemoteModal();
    } else {
      showToast(
        updateResult?.message || "Gagal connect ke device!",
        4000,
        "error"
      );
    }
  } catch (err) {
    console.error("❌ Error connecting ADB device:", err);
    showToast(err?.message || "Gagal connect ke device!", 4000, "error");
  }
}

// Toggle WhatsApp automation fields in Add Android modal
function toggleAddWhatsAppFields() {
  const serviceSelect = document.getElementById("androidRemoteServiceSelect");
  const whatsappFields = document.getElementById("addWhatsAppAutomationFields");
  const variantSelect = document.getElementById("addWhatsAppVariant");

  if (!serviceSelect || !whatsappFields) return;

  const isWhatsApp = serviceSelect.value === "android-whatsapp";
  whatsappFields.style.display = isWhatsApp ? "block" : "none";
  if (variantSelect) {
    variantSelect.disabled = !isWhatsApp;
    if (!isWhatsApp) {
      variantSelect.value = "consumer";
    } else if (!variantSelect.value) {
      variantSelect.value = "consumer";
    }
  }
}

function getAndroidRemoteLimit() {
  if (authState.allowsAndroidEmulator) return Infinity;
  if (!authState.isLoggedIn) return 1;
  if (isFreePackageTier()) return 1;
  return 1;
}

function openAndroidRemoteDisplay(uid, options = {}) {
  if (!uid) return Promise.resolve(false);
  const { silent = false, silentSuccess = false } = options;
  const api = window.electronAPI?.androidRemote;
  if (!api || typeof api.openDisplay !== "function") {
    if (!silent) {
      showToast(
        "Fitur tampilan perangkat belum tersedia di versi ini.",
        3500,
        "warning"
      );
    }
    return Promise.resolve(false);
  }
  return api
    .openDisplay(uid)
    .then((response = {}) => {
      if (response.success) {
        if (!silentSuccess) {
          showToast(
            response.message || "Membuka tampilan perangkat...",
            2500,
            "success"
          );
        }
        wakeAndroidDeviceSilently(uid);
        return true;
      }
      if (!silent) {
        showToast(
          response.message || "Gagal membuka tampilan perangkat.",
          3500,
          "error"
        );
      }
      return false;
    })
    .catch((err) => {
      console.error("⚠️ Tidak bisa membuka tampilan perangkat:", err);
      if (!silent) {
        showToast(
          err?.message || "Gagal membuka tampilan perangkat.",
          3500,
          "error"
        );
      }
      return false;
    });
}

function wakeAndroidDeviceSilently(uid) {
  const api = window.electronAPI?.androidRemote;
  if (!api?.sendShortcut) return;
  api
    .sendShortcut(uid, "wake-screen")
    .catch((err) =>
      console.warn("⚠️ Gagal membangunkan device otomatis:", err)
    );
}

function sendAndroidShortcutWithFeedback(uid, shortcutId, successMsg) {
  const api = window.electronAPI?.androidRemote;
  if (!api?.sendShortcut) {
    showToast("Fitur shortcut tidak tersedia.", 3000, "warning");
    return Promise.resolve(false);
  }
  showToast("Mengirim perintah ke device...", 1800, "info");
  return api
    .sendShortcut(uid, shortcutId)
    .then((response = {}) => {
      if (response.success) {
        showToast(
          successMsg || response.message || "Perintah berhasil dikirim.",
          2500,
          "success"
        );
        return true;
      }
      showToast(
        response.message || "Perintah gagal dijalankan.",
        3000,
        "error"
      );
      return false;
    })
    .catch((err) => {
      console.error("⚠️ Shortcut gagal:", err);
      showToast(err?.message || "Perintah gagal dijalankan.", 3200, "error");
      return false;
    });
}

function captureAndroidDeviceScreenshot(device) {
  if (!device || !device.uid) return;
  const api = window.electronAPI?.androidRemote;
  if (!api?.captureScreenshot) {
    showToast("Fitur screenshot belum tersedia.", 3200, "warning");
    return;
  }
  showToast("Mengambil screenshot...", 2000, "info");
  api
    .captureScreenshot(device.uid)
    .then((response = {}) => {
      if (response.cancelled) {
        showToast("Penyimpanan screenshot dibatalkan.", 2600, "info");
        return;
      }
      if (response.success && response.path) {
        showToast(
          response.message || `Screenshot disimpan di ${response.path}`,
          4200,
          "success"
        );
        return;
      }
      showToast(
        response.message || "Gagal mengambil screenshot.",
        3200,
        "error"
      );
    })
    .catch((err) => {
      console.error("⚠️ Screenshot gagal:", err);
      showToast(err?.message || "Gagal mengambil screenshot.", 3200, "error");
    });
}

function handleAndroidMiniAction(device, action) {
  if (!device || !device.uid) return;
  switch (action) {
    case "wake":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "wake-screen",
        "Layar dibangunkan."
      );
      break;
    case "sleep":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "sleep",
        "Perangkat masuk mode sleep."
      );
      break;
    case "volume-up":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "volume-up",
        "Volume up dikirim."
      );
      break;
    case "volume-down":
      sendAndroidShortcutWithFeedback(
        device.uid,
        "volume-down",
        "Volume down dikirim."
      );
      break;
    case "screenshot":
      captureAndroidDeviceScreenshot(device);
      break;
    default:
      console.warn("Tidak ada aksi untuk shortcut:", action);
  }
}

function updateScrcpyNoticeUI(customMessage = "") {
  const notice = document.getElementById("scrcpyStatusNotice");
  const textEl = document.getElementById("scrcpyStatusText");
  const button = document.getElementById("installScrcpyButton");
  if (!notice || !textEl || !button) return;
  if (scrcpyStatusState.installed) {
    notice.style.display = "none";
    return;
  }
  notice.style.display = "flex";
  if (customMessage) {
    textEl.textContent = customMessage;
  } else if (scrcpyStatusState.checking) {
    textEl.textContent = "Sedang memeriksa instalasi scrcpy...";
  } else if (scrcpyStatusState.installing) {
    const percentText =
      scrcpyStatusState.progressPercent != null
        ? ` (${scrcpyStatusState.progressPercent}%)`
        : "";
    textEl.textContent = `${
      scrcpyStatusState.progressMessage || "Menginstal scrcpy..."
    }${percentText}`;
  } else {
    textEl.textContent =
      "scrcpy belum terpasang. Dibutuhkan untuk menampilkan layar HP secara langsung. Klik install otomatis (macOS: butuh Homebrew, Windows: Chocolatey/winget) atau pasang manual: brew install scrcpy / choco install scrcpy / winget install Genymobile.scrcpy.";
  }
  button.disabled = scrcpyStatusState.installing || scrcpyStatusState.checking;
  button.textContent = scrcpyStatusState.installing
    ? "Menginstal..."
    : "Install scrcpy otomatis";
}

async function refreshScrcpyStatusIndicator() {
  const notice = document.getElementById("scrcpyStatusNotice");
  if (!notice) return;
  const api = window.electronAPI?.androidRemote;
  if (!api?.checkScrcpy) {
    notice.style.display = "none";
    scrcpyStatusState.installed = true;
    return;
  }
  scrcpyStatusState.checking = true;
  updateScrcpyNoticeUI();
  let customMessage = "";
  try {
    const result = await api.checkScrcpy();
    if (result?.success === false && result?.message) {
      scrcpyStatusState.installed = false;
      customMessage = result.message;
    } else {
      scrcpyStatusState.installed = !!result?.installed;
    }
  } catch (err) {
    console.warn("⚠️ Tidak bisa mengecek scrcpy:", err);
    scrcpyStatusState.installed = false;
    customMessage =
      "Tidak bisa mengecek scrcpy. Coba jalankan aplikasi sebagai admin.";
  } finally {
    scrcpyStatusState.checking = false;
    updateScrcpyNoticeUI(customMessage);
  }
}

function requestScrcpyInstallation() {
  const api = window.electronAPI?.androidRemote;
  if (!api?.installScrcpy) {
    showToast(
      "Fitur instalasi otomatis tidak tersedia di versi ini.",
      3500,
      "warning"
    );
    return;
  }
  if (scrcpyStatusState.installing) return;
  scrcpyStatusState.installing = true;
  scrcpyStatusState.progressPercent = 0;
  scrcpyStatusState.progressMessage = "Menyiapkan instalasi scrcpy...";
  updateScrcpyNoticeUI();
  showToast("Menjalankan instalasi scrcpy...", 3500, "info");
  api
    .installScrcpy()
    .then((response = {}) => {
      if (response.success) {
        showToast(
          response.message || "scrcpy berhasil dipasang.",
          3500,
          "success"
        );
      } else {
        showToast(
          response.message ||
            "Instalasi otomatis scrcpy gagal. Coba pasang manual.",
          4000,
          "error"
        );
      }
    })
    .catch((err) => {
      console.error("⚠️ Instalasi scrcpy gagal:", err);
      showToast(
        err?.message || "Instalasi otomatis scrcpy gagal.",
        4000,
        "error"
      );
    })
    .finally(() => {
      scrcpyStatusState.installing = false;
      scrcpyStatusState.progressPercent = null;
      scrcpyStatusState.progressMessage = "";
      refreshScrcpyStatusIndicator();
    });
}

function setupScrcpyHelperCard() {
  const installBtn = document.getElementById("installScrcpyButton");
  if (installBtn) {
    installBtn.addEventListener("click", () => requestScrcpyInstallation());
  }
  const api = window.electronAPI?.androidRemote;
  if (api?.onScrcpyInstallProgress) {
    api.onScrcpyInstallProgress((payload = {}) => {
      if (!scrcpyStatusState.installing) return;
      if (payload.percent != null) {
        scrcpyStatusState.progressPercent = Math.min(
          100,
          Math.max(0, Math.round(payload.percent))
        );
      }
      if (payload.message) {
        scrcpyStatusState.progressMessage = payload.message;
      }
      updateScrcpyNoticeUI();
    });
  }
  refreshScrcpyStatusIndicator();
}

function remoteAndroidDevice(device) {
  if (!device || !device.uid) return;
  const serviceKey = (device.service || "").toLowerCase();

  if (serviceKey === "android-whatsapp") {
    Swal.fire({
      title: "Remote WhatsApp",
      html: "StarBox akan mengirim 10 pesan sample ke <strong>6282337481227</strong>.<br>Pilih kecepatan pengetikan:",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Mulai Remote",
      cancelButtonText: "Batal",
      input: "select",
      inputOptions: {
        instant: "Super Cepat",
        robot: "Stabil (seragam, tanpa variasi)",
        fasthuman: "Cepat Natural (seperti manusia mahir)",
        human: "Natural (lebih lambat)",
        slowhuman: "Pelan Natural (seperti orang biasa)",
        realistic: "Sangat Natural (ada jeda & variasi real)",
        paste: "Tempel Instan (clipboard)",
        hybrid: "Hybrid (paste lalu edit sedikit)",
        stealth: "Stealth Mode (anti terdeteksi, variasi halus)",
      },
      inputValue: "instant",
    }).then((result) => {
      if (!result.isConfirmed) return;
      const typingSpeed = result.value || "instant";
      openAndroidRemoteDisplay(device.uid, { silentSuccess: true });
      runAndroidRemoteAction(device.uid, "whatsapp-send-sample", {
        typingSpeed,
      });
    });
    return;
  }

  Swal.fire(
    "Belum tersedia",
    "Remote otomatis untuk layanan ini belum didukung. Gunakan kontrol manual via ADB/scrcpy.",
    "info"
  );
}

function runAndroidRemoteAction(uid, action, payload = {}) {
  showToast("Menjalankan remote action...", 2000, "info");
  window.electronAPI.androidRemote
    .runAction(uid, action, payload)
    .then((response) => {
      if (response.success) {
        showToast(
          response.message || "Remote action selesai.",
          3000,
          "success"
        );
      } else {
        showToast(response.message || "Remote action gagal.", 3500, "error");
      }
    })
    .catch((err) => {
      console.error("⚠️ Remote action error:", err);
      showToast(err?.message || "Remote action gagal.", 3500, "error");
    });
}

function stopAndroidRemoteAction(device) {
  if (!device || !device.uid) return;
  window.electronAPI.androidRemote
    .cancelAction(device.uid)
    .then((response) => {
      if (response.success) {
        showToast(
          response.message || "Aksi remote dihentikan.",
          2500,
          "success"
        );
      } else {
        showToast(
          response.message || "Tidak ada aksi remote aktif.",
          2500,
          "info"
        );
      }
    })
    .catch((err) => {
      console.error("⚠️ Gagal menghentikan remote:", err);
      showToast(err?.message || "Gagal menghentikan remote.", 3000, "error");
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
  ensureAndroidSpecSelectOptions("androidSpecPreset", "androidSpecDescription");
  ensureAndroidSpecSelectOptions(
    "editAndroidSpecPreset",
    "editAndroidSpecDescription"
  );
  populateAndroidRemoteServiceSelect("androidRemoteServiceSelect");
  refreshAdbDeviceOptionsInternal("androidAdbDeviceSelect");
  setupScrcpyHelperCard();
  if (window.electronAPI?.androidRemote?.onStatusUpdated) {
    window.electronAPI.androidRemote.onStatusUpdated((updates = []) => {
      if (!Array.isArray(updates) || !updates.length) return;
      let changed = false;
      cachedAndroidRemoteDevices = cachedAndroidRemoteDevices.map((device) => {
        const next = updates.find((entry) => entry.uid === device.uid);
        if (next && next.status !== device.status) {
          changed = true;
          return { ...device, status: next.status };
        }
        return device;
      });
      if (changed) {
        renderDevicesAndroid(cachedAndroidRemoteDevices);
      }
    });
  }
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
  ADS_PAGE_KEYS.forEach((key) => ensureAdsSection(key));
  syncAllAdsShowcases({ forceRefresh: true });
  startAdsAutoRefresh();
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
  loadVmList();
  syncThemeSelector();
  syncServiceAvailability();

  // Re-apply i18n translations and reload device lists when language changes
  document.addEventListener('langchange', () => {
    if (typeof window.applyI18n === 'function') window.applyI18n();
    loadAllDevices();
    if (typeof loadAllDevicesAndroid === 'function') loadAllDevicesAndroid();
  });

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

window.openVmModal = function (vm = null) {
  const modal = document.getElementById("vmModal");
  if (!modal) return;
  modal.style.display = "flex";
  populateCachedIsos();

  const vmId = document.getElementById("vmId");
  const vmName = document.getElementById("vmName");
  const vmOsType = document.getElementById("vmOsType");
  const vmCpu = document.getElementById("vmCpu");
  const vmMemory = document.getElementById("vmMemory");
  const vmStorage = document.getElementById("vmStorage");
  const vmNetwork = document.getElementById("vmNetwork");
  const vmBridge = document.getElementById("vmBridge");
  const vmMac = document.getElementById("vmMac");
  const vmIso = document.getElementById("vmIso");
  const vmDisk = document.getElementById("vmDisk");
  const vmAutostart = document.getElementById("vmAutostart");
  const vmVncPort = document.getElementById("vmVncPort");
  const vmQemuBin = document.getElementById("vmQemuBin");
  const vmBootOrder = document.getElementById("vmBootOrder");
  const vmNotes = document.getElementById("vmNotes");

  if (vmId) vmId.value = vm?.id || "";
  if (vmName) vmName.value = vm?.name || "";
  if (vmOsType) vmOsType.value = vm?.osType || "linux";
  if (vmCpu) vmCpu.value = vm?.cpu || 2;
  if (vmMemory) vmMemory.value = vm?.memoryMb || 2048;
  if (vmStorage) vmStorage.value = vm?.storageGb || 20;
  if (vmNetwork) vmNetwork.value = vm?.networkMode || "nat";
  if (vmBridge) vmBridge.value = vm?.bridgeInterface || "";
  if (vmMac) vmMac.value = vm?.macAddress || "";
  if (vmIso) vmIso.value = vm?.isoPath || "";
  if (vmDisk) vmDisk.value = vm?.diskPath || "";
  if (vmAutostart) vmAutostart.checked = !!vm?.autostart;
  if (vmVncPort) vmVncPort.value = vm?.vncPort || 5901;
  if (vmQemuBin) vmQemuBin.value = vm?.qemuBinary || "qemu-system-x86_64";
  if (vmBootOrder) vmBootOrder.value = vm?.bootOrder || "cd";
  if (vmNotes) vmNotes.value = vm?.notes || "";
};

window.closeVmModal = function () {
  const modal = document.getElementById("vmModal");
  if (modal) modal.style.display = "none";
};

window.saveVm = async function () {
  try {
    const vmId = document.getElementById("vmId");
    const vmName = document.getElementById("vmName");
    const vmOsType = document.getElementById("vmOsType");
    const vmCpu = document.getElementById("vmCpu");
    const vmMemory = document.getElementById("vmMemory");
    const vmStorage = document.getElementById("vmStorage");
    const vmNetwork = document.getElementById("vmNetwork");
    const vmBridge = document.getElementById("vmBridge");
    const vmMac = document.getElementById("vmMac");
    const vmIso = document.getElementById("vmIso");
    const vmDisk = document.getElementById("vmDisk");
    const vmAutostart = document.getElementById("vmAutostart");
    const vmVncPort = document.getElementById("vmVncPort");
    const vmQemuBin = document.getElementById("vmQemuBin");
    const vmBootOrder = document.getElementById("vmBootOrder");
    const vmNotes = document.getElementById("vmNotes");

    const payload = {
      id: vmId?.value || null,
      name: vmName?.value?.trim() || "",
      osType: vmOsType?.value || "linux",
      cpu: parseInt(vmCpu?.value, 10) || 2,
      memoryMb: parseInt(vmMemory?.value, 10) || 2048,
      storageGb: parseInt(vmStorage?.value, 10) || 20,
      networkMode: vmNetwork?.value || "nat",
      bridgeInterface: vmBridge?.value?.trim() || "",
      macAddress: vmMac?.value?.trim() || "",
      isoPath: vmIso?.value?.trim() || "",
      diskPath: vmDisk?.value?.trim() || "",
      autostart: vmAutostart?.checked || false,
      vncPort: parseInt(vmVncPort?.value, 10) || 5901,
      qemuBinary: vmQemuBin?.value?.trim() || "qemu-system-x86_64",
      bootOrder: vmBootOrder?.value?.trim() || "cd",
      notes: vmNotes?.value?.trim() || "",
    };
    const result = await window.electronAPI.virtualOS.save(payload);
    if (!result?.success) {
      showToast(result?.message || "Gagal menyimpan VM.", 3500, "error");
      return;
    }
    closeVmModal();
    await loadVmList();
    showToast(window.t('toast.vm.saved'), 2500, "success");
  } catch (err) {
    showToast(err?.message || window.t('toast.vm.save_error'), 3500, "error");
  }
};

async function deleteVm(id) {
  if (!id) return;
  const confirm = await Swal.fire({
    title: window.t('dialog.delete_vm.title'),
    text: window.t('dialog.delete_vm.text'),
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: window.t('dialog.delete_vm.confirm'),
    cancelButtonText: window.t('dialog.delete_vm.cancel'),
  });
  if (!confirm.isConfirmed) return;
  const result = await window.electronAPI.virtualOS.delete(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.delete_error'), 3500, "error");
    return;
  }
  await loadVmList();
  showToast(window.t('toast.vm.deleted'), 2500, "success");
}

async function checkQemuStatus() {
  const banner = document.getElementById('qemuMissingBanner');
  if (!banner) return;
  try {
    const r = await window.electronAPI.virtualOS.checkQemu();
    banner.style.display = r.available ? 'none' : 'flex';
  } catch {
    banner.style.display = 'none';
  }
}

async function installQemu() {
  const btn = document.getElementById('installQemuBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menginstall...'; }

  let unsubscribe = null;
  try {
    const swalInst = Swal.fire({
      title: 'Install QEMU',
      html: `<div style="text-align:left;max-height:240px;overflow-y:auto;font-size:0.85rem;font-family:monospace;background:#111;padding:8px;border-radius:6px;" id="qemuInstallLog">Memulai instalasi...</div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    });

    unsubscribe = window.electronAPI.virtualOS.onQemuInstallProgress((data) => {
      const log = document.getElementById('qemuInstallLog');
      if (log && data.message) {
        const line = document.createElement('div');
        line.textContent = data.message;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
      }
      if (data.done || data.error) {
        Swal.close();
      }
    });

    const result = await window.electronAPI.virtualOS.installQemu();
    if (unsubscribe) unsubscribe();

    if (result.success) {
      await Swal.fire({ icon: 'success', title: 'QEMU Terinstall', text: 'QEMU berhasil diinstall. Silakan coba jalankan VM.', confirmButtonText: 'OK' });
      await checkQemuStatus();
    } else {
      const opts = { icon: 'error', title: 'Gagal Install QEMU', text: result.message || 'Terjadi kesalahan.', confirmButtonText: 'OK' };
      if (result.manualUrl) opts.footer = `<a href="${result.manualUrl}" target="_blank">Download Manual</a>`;
      await Swal.fire(opts);
    }
  } catch (err) {
    if (unsubscribe) unsubscribe();
    Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonText: 'OK' });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Install QEMU'; }
  }
}

async function loadVmList() {
  const container = document.getElementById("vm-list");
  if (!container) return;
  container.innerHTML = `<div class="osv-empty"><i class="bi bi-arrow-repeat"></i><h3>Memuat daftar VM...</h3></div>`;
  checkQemuStatus();
  try {
    const result = await window.electronAPI.virtualOS.list();
    if (!result?.success) {
      container.innerHTML = `<div class="osv-empty"><i class="bi bi-exclamation-triangle"></i><h3>Gagal memuat VM</h3><p>${result?.message || ""}</p></div>`;
      return;
    }
    const items = Array.isArray(result.items) ? result.items : [];
    vmListCache = items;
    if (!items.length) {
      container.innerHTML = `<div class="osv-empty"><i class="bi bi-display"></i><h3>Belum ada OS Virtual</h3><p>Klik "Tambah VM" untuk membuat mesin virtual baru.</p></div>`;
      return;
    }

    const osIcons = {
      linux: { icon: "bi-ubuntu", color: "#e95420" },
      windows: { icon: "bi-windows", color: "#0078d7" },
      macos: { icon: "bi-apple", color: "#a2aaad" },
      android: { icon: "bi-android2", color: "#3ddc84" },
      freebsd: { icon: "bi-hdd-network", color: "#ab2b28" },
      other: { icon: "bi-cpu", color: "#7c3aed" },
    };

    container.innerHTML = items.map((vm) => {
      const osKey = (vm.osType || "linux").toLowerCase();
      const osInfo = osIcons[osKey] || osIcons.other;
      const isRunning = vm.status === "running";
      const isStarting = vm.status === "starting";
      const statusLabel = isRunning ? "Running" : isStarting ? "Starting..." : "Stopped";
      const statusCls = isRunning ? "running" : isStarting ? "starting" : "stopped";
      const ramGb = vm.memoryMb >= 1024 ? (vm.memoryMb / 1024).toFixed(1) + " GB" : (vm.memoryMb || 0) + " MB";

      return `
        <div class="osv-card" data-vm-id="${vm.id}">
          <div class="osv-card-head">
            <div class="osv-os-icon" style="background:${osInfo.color}22; color:${osInfo.color}">
              <i class="bi ${osInfo.icon}"></i>
            </div>
            <div class="osv-card-name">
              <h4>${vm.name || "Tanpa nama"}</h4>
              <span>${(vm.osType || "linux").toUpperCase()}</span>
            </div>
            <span class="osv-status-badge ${statusCls}">
              <span class="dot"></span>${statusLabel}
            </span>
          </div>
          <div class="osv-specs">
            <div class="osv-spec"><div class="osv-spec-val">${vm.cpu || 1}</div><div class="osv-spec-key">vCPU</div></div>
            <div class="osv-spec"><div class="osv-spec-val">${ramGb}</div><div class="osv-spec-key">RAM</div></div>
            <div class="osv-spec"><div class="osv-spec-val">${vm.storageGb || 0} GB</div><div class="osv-spec-key">Disk</div></div>
            <div class="osv-spec"><div class="osv-spec-val">:${vm.vncPort || 5901}</div><div class="osv-spec-key">VNC</div></div>
          </div>
          <div class="osv-info">
            <span><i class="bi bi-diagram-3"></i> ${(vm.networkMode || "nat").toUpperCase()}</span>
            ${vm.autostart ? '<span><i class="bi bi-lightning-fill" style="color:#f0a040"></i> Autostart</span>' : ""}
            ${vm.isoPath ? `<span title="${vm.isoPath}"><i class="bi bi-disc"></i> ISO</span>` : ""}
          </div>
          ${vm.notes ? `<div class="osv-notes">${vm.notes}</div>` : ""}
          <div class="osv-actions">
            <button class="osv-btn start" onclick="startVm('${vm.id}')" title="Start"><i class="bi bi-play-fill"></i> Start</button>
            <button class="osv-btn restart" onclick="restartVm('${vm.id}')" title="Restart"><i class="bi bi-arrow-repeat"></i></button>
            <button class="osv-btn stop" onclick="stopVm('${vm.id}')" title="Stop"><i class="bi bi-stop-fill"></i> Stop</button>
            <button class="osv-btn" style="border-color:rgba(239,68,68,0.4);color:#f87171" onclick="forceStopVm('${vm.id}')" title="Stop Paksa (SIGKILL) — gunakan jika Stop biasa tidak mempan"><i class="bi bi-lightning-fill"></i></button>
            <button class="osv-btn" onclick="snapshotVm('${vm.id}')" title="Snapshot"><i class="bi bi-camera"></i></button>
            <button class="osv-btn" onclick="openVmModalById('${vm.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="osv-btn danger" onclick="deleteVm('${vm.id}')" title="Hapus"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="osv-empty"><i class="bi bi-exclamation-triangle"></i><h3>Error</h3><p>${err?.message || "Gagal memuat VM"}</p></div>`;
  }
}

window.openVmModalById = function (id) {
  if (!id || !vmListCache) return;
  const vm = vmListCache.find((v) => v.id === id);
  if (vm) window.openVmModal(vm);
};

async function killAllQemu() {
  const confirm = await Swal.fire({
    title: window.t('dialog.kill_qemu.title'),
    text: window.t('dialog.kill_qemu.text'),
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#f0a040",
    confirmButtonText: window.t('dialog.kill_qemu.confirm'),
    cancelButtonText: window.t('dialog.kill_qemu.cancel'),
  });
  if (!confirm.isConfirmed) return;
  const result = await window.electronAPI.virtualOS.killAllQemu();
  if (result?.success) {
    showToast(window.t('toast.qemu.killed'), 2500, "success");
  } else {
    showToast(result?.message || "Gagal.", 3000, "error");
  }
  await loadVmList();
}

async function startVm(id) {
  // If already running, just focus the VNC window
  const card = document.querySelector(`.osv-card[data-vm-id="${id}"]`);
  const statusBadge = card?.querySelector(".osv-status-badge");
  if (statusBadge?.classList.contains("running")) {
    await window.electronAPI.virtualOS.focusVncWindow(id);
    return;
  }

  showToast(window.t('toast.vm.starting'), 1500, "info");
  const vmName = card?.querySelector("h4")?.textContent || id;
  const result = await window.electronAPI.virtualOS.start(id);
  if (!result?.success) {
    const msg = result?.message || "Gagal start VM.";
    const isLocked = msg.includes("terkunci") || msg.includes("locked") || msg.includes("image");
    await Swal.fire({
      title: window.t('dialog.vm_start_fail'),
      html: msg.replace(/\n/g, "<br>") +
        (isLocked ? `<br><br>${window.t('dialog.vm_start_fail_tip')}` : ""),
      icon: "error",
      confirmButtonText: window.t('common.close'),
    });
    await loadVmList();
    return;
  }
  showToast(window.t('toast.vm.started'), 2000, "success");
  if (result.wsPort) {
    await openVncViewer(result.wsPort, id, vmName);
  }
  await loadVmList();
}

async function forceStopVm(id) {
  const result = await window.electronAPI.virtualOS.forceStop(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.force_stop_error'), 3000, "error");
  } else {
    showToast(window.t('toast.vm.force_stopped'), 2000, "success");
  }
  await loadVmList();
}

async function stopVm(id) {
  const result = await window.electronAPI.virtualOS.stop(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.stop_error'), 3500, "error");
    return;
  }
  showToast(window.t('toast.vm.stopped'), 2000, "info");
  await loadVmList();
}

async function restartVm(id) {
  const result = await window.electronAPI.virtualOS.restart(id);
  if (!result?.success) {
    showToast(result?.message || window.t('toast.vm.restart_error'), 3500, "error");
    return;
  }
  showToast("VM direstart.", 2000, "info");
  await loadVmList();
}

async function snapshotVm(id) {
  const input = await Swal.fire({
    title: "Snapshot",
    input: "text",
    inputLabel: "Nama snapshot",
    inputPlaceholder: "Misal: sebelum update",
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
  });
  if (!input.isConfirmed) return;
  const result = await window.electronAPI.virtualOS.snapshot(
    id,
    input.value || "Snapshot"
  );
  if (!result?.success) {
    showToast(result?.message || "Gagal snapshot.", 3500, "error");
    return;
  }
  await loadVmList();
  showToast("Snapshot dibuat.", 2000, "success");
}

async function openVncViewer(port, vmId, vmName) {
  if (!port) return;
  await window.electronAPI.virtualOS.openVncWindow({ vmId, wsPort: port, vmName });
}

async function browseVmIsoFile() {
  try {
    const isoInput = document.getElementById("vmIso");
    const result = await window.electronAPI.virtualOS.browseIsoFile();
    if (result?.success && result.path) {
      isoInput.value = result.path;
    } else if (!result?.canceled && result?.message) {
      showToast(result.message, 3000, "warning");
    }
  } catch (err) {
    console.warn("⚠️ Gagal membuka dialog ISO:", err?.message || err);
  }
}

async function populateCachedIsos() {
  const group = document.getElementById("vmCachedIsoGroup");
  if (!group) return;
  try {
    const cached = await window.electronAPI.virtualOS.listCachedIsos();
    group.innerHTML = "";
    cached.forEach(c => {
      const opt = document.createElement("option");
      opt.value = "__cached__" + c.localPath;
      opt.textContent = `✓ ${c.filename}${c.sizeMb ? ` (${c.sizeMb}MB)` : ""}`;
      group.appendChild(opt);
    });
    group.style.display = cached.length > 0 ? "" : "none";
  } catch (_) {
    if (group) group.style.display = "none";
  }
}

async function applyQuickIso() {
  const select = document.getElementById("vmQuickIso");
  const isoInput = document.getElementById("vmIso");
  const progressEl = document.getElementById("vmIsoDownloadProgress");
  let url = select?.value || "";
  if (!url) return;

  // Cached ISO: just set the path directly without downloading
  if (url.startsWith("__cached__")) {
    const localPath = url.slice("__cached__".length);
    if (isoInput) isoInput.value = localPath;
    showToast("ISO dipilih dari cache lokal", 2000, "success");
    select.value = "";
    return;
  }

  const filename = url.split("/").pop() || "os.iso";

  // Show progress UI
  if (progressEl) {
    progressEl.style.display = "flex";
    progressEl.querySelector(".iso-dl-label").textContent = `Mengunduh ${filename}...`;
    progressEl.querySelector(".iso-dl-bar-inner").style.width = "0%";
    progressEl.querySelector(".iso-dl-pct").textContent = "0%";
  }

  // Listen to progress
  const unsubProgress = window.electronAPI.virtualOS.onIsoDownloadProgress((data) => {
    if (data.filename !== filename) return;
    const pct = data.pct >= 0 ? data.pct : 0;
    if (progressEl) {
      progressEl.querySelector(".iso-dl-bar-inner").style.width = pct + "%";
      progressEl.querySelector(".iso-dl-pct").textContent = data.pct >= 0 ? pct + "%" : "...";
      const mb = (data.downloaded / 1024 / 1024).toFixed(1);
      const total = data.total > 0 ? ` / ${(data.total / 1024 / 1024).toFixed(1)} MB` : "";
      progressEl.querySelector(".iso-dl-label").textContent = `${filename}: ${mb} MB${total}`;
    }
  });

  try {
    const result = await window.electronAPI.virtualOS.downloadIso({ url, filename });
    unsubProgress();
    if (progressEl) progressEl.style.display = "none";

    if (!result?.success) {
      showToast("Gagal download ISO: " + (result?.message || ""), 4000, "error");
      select.value = "";
      return;
    }
    isoInput.value = result.localPath;
    showToast(result.cached ? `ISO sudah ada: ${filename}` : `ISO berhasil diunduh: ${filename}`, 2500, "success");
    select.value = "";
    populateCachedIsos();
  } catch (err) {
    unsubProgress();
    if (progressEl) progressEl.style.display = "none";
    showToast("Error download ISO: " + (err?.message || ""), 4000, "error");
    select.value = "";
  }
}

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

// ADB tutorial modal controls
window.openAdbTutorialModal = function () {
  const modal = document.getElementById("adbTutorialModal");
  if (modal) modal.style.display = "flex";
};

window.closeAdbTutorialModal = function () {
  const modal = document.getElementById("adbTutorialModal");
  if (modal) modal.style.display = "none";
};

// Modal functions for Android
window.switchAndroidAddType = function(type) {
  _androidAddType = type;
  const adbForm = document.getElementById('androidFormTypeAdb');
  const emuForm = document.getElementById('androidFormTypeEmulator');
  const btnAdb = document.getElementById('btnAndroidTypeAdb');
  const btnEmu = document.getElementById('btnAndroidTypeEmu');
  if (adbForm) adbForm.style.display = type === 'adb' ? '' : 'none';
  if (emuForm) emuForm.style.display = type === 'emulator' ? '' : 'none';
  if (btnAdb) { btnAdb.style.background = type === 'adb' ? 'rgba(61,220,132,0.15)' : 'transparent'; btnAdb.style.color = type === 'adb' ? '#3ddc84' : '#888'; }
  if (btnEmu) { btnEmu.style.background = type === 'emulator' ? 'rgba(61,220,132,0.15)' : 'transparent'; btnEmu.style.color = type === 'emulator' ? '#3ddc84' : '#888'; }
};

window.selectEmuSpec = function(spec) {
  document.querySelectorAll('[id^="emuSpec"]').forEach(el => {
    el.style.borderColor = el.id === 'emuSpec' + spec.charAt(0).toUpperCase() + spec.slice(1)
      ? 'rgba(61,220,132,0.4)' : '#30363d';
  });
};

window.openModalAndroid = async function () {
  const modal = document.getElementById("addModalAndroid");
  if (!modal) return;

  _androidAddType = 'adb';
  window.switchAndroidAddType('adb');

  const nameInput = document.getElementById("deviceNameAndroid");
  if (nameInput) nameInput.value = "";

  populateAndroidRemoteServiceSelect("androidRemoteServiceSelect");

  // Initialize select with placeholder (no auto-scan)
  const adbSelect = document.getElementById("androidAdbDeviceSelect");
  if (adbSelect) {
    adbSelect.innerHTML =
      '<option value="" disabled selected>Klik tombol refresh untuk memuat perangkat ADB</option>';
  }

  modal.style.display = "flex";
  setTimeout(() => {
    refreshAdbDeviceOptionsInternal("androidAdbDeviceSelect", {
      showToastMessage: false,
    }).catch((err) => console.warn("⚠️ Gagal auto refresh ADB devices:", err));
  }, 150);
};

window.closeModalAndroid = function () {
  _androidAddType = 'adb';
  const modal = document.getElementById("addModalAndroid");
  if (!modal) return;
  modal.style.display = "none";
  const adbSelect = document.getElementById("androidAdbDeviceSelect");
  if (adbSelect) adbSelect.selectedIndex = 0;
  const serviceSelect = document.getElementById("androidRemoteServiceSelect");
  if (serviceSelect) serviceSelect.selectedIndex = 0;
  const nameInput = document.getElementById("deviceNameAndroid");
  if (nameInput) nameInput.value = "";

  // Clear WhatsApp fields
  const baseUrlInput = document.getElementById("addWhatsAppBaseUrl");
  const callbackUrlInput = document.getElementById("addWhatsAppCallbackUrl");
  const whatsappFields = document.getElementById("addWhatsAppAutomationFields");

  if (baseUrlInput) baseUrlInput.value = "";
  if (callbackUrlInput) callbackUrlInput.value = "";
  if (whatsappFields) whatsappFields.style.display = "none";
};

async function submitEmulatorDeviceForm() {
  const name = document.getElementById('deviceNameAndroid')?.value.trim();
  if (!name) { showToast('Nama device wajib diisi.', 3000, 'warning'); return; }
  const specRadio = document.querySelector('input[name="emuSpec"]:checked');
  const specId = specRadio?.value || 'balanced';
  const SPEC_MAP = {
    lite:        { id: 'lite',        memoryMb: 1024, cores: 1, resolution: '540x960',   density: 213 },
    balanced:    { id: 'balanced',    memoryMb: 1536, cores: 2, resolution: '720x1280',  density: 265 },
    performance: { id: 'performance', memoryMb: 2048, cores: 4, resolution: '1080x1920', density: 420 },
  };
  const androidSpec = SPEC_MAP[specId] || SPEC_MAP.balanced;
  try {
    const result = await window.electronAPI.addDevice({ name, service: 'android', androidSpec });
    if (result?.success) {
      showToast('✅ Android Emulator ditambahkan!', 3000, 'success');
      closeModalAndroid();
      await loadAllDevicesAndroid();
    } else {
      showToast(result?.message || 'Gagal menambah emulator.', 4000, 'error');
    }
  } catch (err) {
    showToast('Error: ' + (err?.message || err), 4000, 'error');
  }
}

window.submitAndroidDevice = async function () {
  // Route to emulator submit if that type is selected
  if (_androidAddType === 'emulator') { submitEmulatorDeviceForm(); return; }

  const name = document.getElementById("deviceNameAndroid").value.trim();
  const adbSelect = document.getElementById("androidAdbDeviceSelect");
  const serviceSelect = document.getElementById("androidRemoteServiceSelect");

  const adbId = adbSelect?.value || "";
  const service = serviceSelect?.value || "";

  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }
  if (!adbId) {
    showToast("Pilih perangkat ADB terlebih dahulu.", 3000, "warning");
    return;
  }
  if (!service) {
    showToast("Pilih jenis layanan terlebih dahulu.", 3000, "warning");
    return;
  }

  const selectedAdb = cachedAdbDevices.find((item) => item.adbId === adbId);

  // Prepare device data
  const deviceData = {
    name,
    adbId,
    adbName: selectedAdb?.description || "",
    service,
    status: selectedAdb?.status === "device" ? "connected" : "disconnected",
  };

  // Add WhatsApp automation URLs if service is android-whatsapp
  if (service === "android-whatsapp") {
    const baseUrl =
      document.getElementById("addWhatsAppBaseUrl")?.value.trim() || "";
    const callbackUrl =
      document.getElementById("addWhatsAppCallbackUrl")?.value.trim() || "";
    const whatsappVariant =
      document.getElementById("addWhatsAppVariant")?.value || "consumer";

    deviceData.whatsappBaseUrl = baseUrl;
    deviceData.whatsappCallbackUrl = callbackUrl;
    deviceData.whatsappVariant = whatsappVariant;
  }

  const limit = getAndroidRemoteLimit();
  if (Number.isFinite(limit)) {
    let currentCount = Array.isArray(cachedAndroidRemoteDevices)
      ? cachedAndroidRemoteDevices.length
      : 0;
    if (currentCount < limit && window.electronAPI?.androidRemote?.getDevices) {
      try {
        const snapshot = await window.electronAPI.androidRemote.getDevices();
        const list = Array.isArray(snapshot?.devices) ? snapshot.devices : [];
        cachedAndroidRemoteDevices = list;
        currentCount = list.length;
      } catch (err) {
        console.warn("⚠️ Gagal sinkron jumlah ADB devices:", err);
      }
    }
    if (currentCount >= limit) {
      const needUpgrade =
        authState.allowsAndroidEmulator !== true &&
        (authState.isLoggedIn ? !isFreePackageTier() : true);
      const reason =
        !authState.isLoggedIn || isFreePackageTier()
          ? "Mode tamu/paket gratis dibatasi 1 device ADB Remote."
          : "Paket Anda belum mendukung Android Emulator/ADB tanpa batas.";
      const action = needUpgrade
        ? "Silakan login atau upgrade paket yang mendukung Android Emulator."
        : "Silakan hapus device lama sebelum menambah yang baru.";
      showToast(`${reason} ${action}`, 4500, "warning");
      return;
    }
  }

  try {
    const result = await window.electronAPI.androidRemote.addDevice(deviceData);

    if (result.success) {
      showToast("✅ Device Android berhasil ditambahkan!", 3000, "success");
      if (result.payload) {
        console.log(
          "📦 Payload adb-devices.json yang disimpan:",
          JSON.stringify(result.payload, null, 2)
        );
        showToast(
          `Payload tersimpan: ${result.payload.name} (${result.payload.adbId})`,
          4200,
          "info"
        );
      }
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

// ==================== OS Virtual Modal Functions ====================

window.openModalOSVirtual = function () {
  const modal = document.getElementById("addModalOSVirtual");
  if (!modal) return;

  // Reset form
  const nameInput = document.getElementById("osVirtualName");
  if (nameInput) nameInput.value = "";

  const downloadSelect = document.getElementById("osDownloadSelect");
  if (downloadSelect) downloadSelect.selectedIndex = 0;

  const isoFile = document.getElementById("osISOFile");
  if (isoFile) isoFile.value = "";

  // Reset to download method
  const downloadRadio = document.getElementById("osMethodDownload");
  if (downloadRadio) downloadRadio.checked = true;

  // Reset sections visibility
  const downloadSection = document.getElementById("osDownloadSection");
  const isoSection = document.getElementById("osISOSection");
  if (downloadSection) downloadSection.style.display = "block";
  if (isoSection) isoSection.style.display = "none";

  // Reset VM specs to default
  const ramSelect = document.getElementById("osVMRam");
  const coresSelect = document.getElementById("osVMCores");
  const diskSelect = document.getElementById("osVMDisk");
  const resolutionSelect = document.getElementById("osVMResolution");

  if (ramSelect) ramSelect.value = "2048";
  if (coresSelect) coresSelect.value = "2";
  if (diskSelect) diskSelect.value = "40";
  if (resolutionSelect) resolutionSelect.value = "1920x1080";

  modal.style.display = "flex";
};

window.closeModalOSVirtual = function () {
  const modal = document.getElementById("addModalOSVirtual");
  if (!modal) return;
  modal.style.display = "none";
};

window.toggleOSInstallMethod = function () {
  const downloadRadio = document.getElementById("osMethodDownload");
  const isoRadio = document.getElementById("osMethodISO");
  const downloadSection = document.getElementById("osDownloadSection");
  const isoSection = document.getElementById("osISOSection");

  if (!downloadSection || !isoSection) return;

  if (downloadRadio && downloadRadio.checked) {
    downloadSection.style.display = "block";
    isoSection.style.display = "none";
  } else if (isoRadio && isoRadio.checked) {
    downloadSection.style.display = "none";
    isoSection.style.display = "block";
  }
};

window.browseISOFile = async function () {
  try {
    const result = await window.electronAPI.virtualOS.browseIsoFile();

    if (result.success && result.path) {
      const isoPathInput = document.getElementById("osISOPath");
      if (isoPathInput) {
        isoPathInput.value = result.path;
      }
      console.log("📁 ISO file selected:", result.path);
    } else if (!result.canceled) {
      showToast(result.message || "Gagal memilih file ISO", 3000, "error");
    }
  } catch (err) {
    console.error("❌ Error browsing ISO file:", err);
    showToast("Error: " + err.message, 3000, "error");
  }
};

window.browseVmIsoFile = async function () {
  try {
    const result = await window.electronAPI.virtualOS.browseIsoFile();

    if (result.success && result.path) {
      const isoInput = document.getElementById("vmIso");
      if (isoInput) {
        isoInput.value = result.path;
      }
      console.log("📁 ISO file selected for VM:", result.path);
    } else if (!result.canceled) {
      showToast(result.message || "Gagal memilih file ISO", 3000, "error");
    }
  } catch (err) {
    console.error("❌ Error browsing ISO file:", err);
    showToast("Error: " + err.message, 3000, "error");
  }
};

window.submitOSVirtual = async function () {
  const name = document.getElementById("osVirtualName")?.value.trim() || "";
  const downloadRadio = document.getElementById("osMethodDownload");
  const isoRadio = document.getElementById("osMethodISO");

  // Validation
  if (!name) {
    showToast("Nama device wajib diisi.", 3000, "warning");
    return;
  }

  const installMethod = downloadRadio?.checked ? "download" : "iso";
  let osSource = "";
  let isoPath = "";

  if (installMethod === "download") {
    const downloadSelect = document.getElementById("osDownloadSelect");
    osSource = downloadSelect?.value || "";
    if (!osSource) {
      showToast("Pilih OS yang akan didownload.", 3000, "warning");
      return;
    }
  } else {
    const isoPathInput = document.getElementById("osISOPath");
    isoPath = isoPathInput?.value.trim() || "";
    if (!isoPath) {
      showToast("Pilih file ISO terlebih dahulu.", 3000, "warning");
      return;
    }
  }

  // Get VM specifications
  const ramMb = parseInt(document.getElementById("osVMRam")?.value || "2048");
  const cores = parseInt(document.getElementById("osVMCores")?.value || "2");
  const diskGb = parseInt(document.getElementById("osVMDisk")?.value || "40");
  const resolution = document.getElementById("osVMResolution")?.value || "1920x1080";

  // Prepare device data
  const vmData = {
    name,
    service: "os-virtual",
    installMethod,
    osSource: installMethod === "download" ? osSource : "",
    isoPath: installMethod === "iso" ? isoPath : "",
    vmSpec: {
      ramMb,
      cores,
      diskGb,
      resolution,
    },
  };

  try {
    // TODO: Implement backend handler for OS Virtual
    // For now, show a message that the feature is in development
    console.log("VM Data to be saved:", vmData);

    showToast(
      "✅ Virtual Machine akan segera dibuat. Fitur ini sedang dalam pengembangan.",
      4000,
      "info"
    );

    // TODO: Call backend API to create VM
    // const result = await window.electronAPI.osVirtual.createVM(vmData);

    closeModalOSVirtual();

    // Show detailed info
    Swal.fire({
      title: "OS Virtual - Coming Soon",
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>Nama:</strong> ${name}</p>
          <p><strong>Metode:</strong> ${installMethod === "download" ? "Download OS" : "Upload ISO"}</p>
          ${installMethod === "download" ? `<p><strong>OS:</strong> ${osSource}</p>` : `<p><strong>ISO Path:</strong> ${isoPath}</p>`}
          <p><strong>RAM:</strong> ${ramMb} MB</p>
          <p><strong>CPU:</strong> ${cores} Cores</p>
          <p><strong>Disk:</strong> ${diskGb} GB</p>
          <p><strong>Resolution:</strong> ${resolution}</p>
        </div>
        <hr style="margin: 16px 0;">
        <p style="font-size: 13px; color: #666;">
          Fitur OS Virtual akan menggunakan QEMU atau VirtualBox untuk menjalankan VM.
          Backend sedang dalam pengembangan.
        </p>
      `,
      icon: "info",
      confirmButtonText: "OK",
    });
  } catch (err) {
    console.error("Error creating OS Virtual:", err);
    showToast("Error: " + err.message, 4000, "error");
  }
};

window.refreshAdbDeviceOptions = function (
  selectId = "androidAdbDeviceSelect"
) {
  refreshAdbDeviceOptionsInternal(selectId, { showToastMessage: true });
};

// Edit Android device functions
let editingAndroidDeviceUid = null;

window.openEditAndroidModal = function () {
  Swal.fire(
    "Informasi",
    "Pengelolaan device Android fisik dilakukan lewat daftar ADB baru. Silakan hapus & tambahkan ulang jika ingin mengubah pengaturan.",
    "info"
  );
};

window.closeEditModalAndroid = function () {};
window.saveEditAndroidDevice = function () {};

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
  if (
    typeof event !== "undefined" &&
    typeof event.preventDefault === "function"
  ) {
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
  const activeItem = document.querySelector(
    `.sidebar-item[data-page="${page}"]`
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
    await loadAllDevicesAndroid();
  } else if (page === "whatsapp-gateway") {
    console.log("  💬 Loading WhatsApp Gateway devices...");
    if (typeof window.loadWAGatewayPage === "function") {
      await window.loadWAGatewayPage();
    } else {
      console.warn("loadWAGatewayPage is not defined.");
    }
  } else if (page === "os-virtual") {
    await loadVmList();
  } else if (page === "remox") {
    if (typeof window.initRemoxPage === "function") window.initRemoxPage();
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

  // Refresh iklan per halaman (hit ulang per menu)
  syncAdsShowcaseForPage(page, { forceRefresh: true });

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
  const sidebarItem = document.querySelector('.sidebar-item[data-page="remote-control"]');
  if (sidebarItem) {
    sidebarItem.click();
  }
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

// ═══════════════════════════════════════════════════════════════════════════════
// CCTV Module
// ═══════════════════════════════════════════════════════════════════════════════

let _cctvCameras    = [];
let _cctvLayout     = 4;       // 1, 4, 9, 16
let _cctvStreaming  = new Map(); // uid → { port, type, refreshTimer }
let _hlsInstances  = new Map(); // uid → Hls instance

let _cctvAutoConnectDone = false;

async function cctvInit() {
  await cctvCheckFfmpeg();
  await cctvLoadCameras();
  cctvRenderGrid();
  // First access this session: auto-connect all registered cameras
  if (!_cctvAutoConnectDone && _cctvCameras.length > 0) {
    _cctvAutoConnectDone = true;
    for (const cam of _cctvCameras) {
      if (!_cctvStreaming.has(cam.uid)) {
        cctvConnect(cam.uid);
      }
    }
  }
}

async function cctvCheckFfmpeg() {
  const dot    = document.getElementById('cctvStatusDot');
  const text   = document.getElementById('cctvStatusText');
  const btn    = document.getElementById('cctvInstallFfmpegBtn');
  const banner = document.getElementById('cctvFfmpegMissingBanner');
  try {
    const r = await window.electronAPI.cctv.checkFfmpeg();
    if (r.available) {
      if (dot)    dot.style.background = '#22c55e';
      if (text)   text.textContent = 'ffmpeg tersedia';
      if (btn)    btn.style.display = 'none';
      if (banner) banner.style.display = 'none';
    } else {
      if (dot)    dot.style.background = '#f59e0b';
      if (text)   text.textContent = 'ffmpeg tidak ditemukan';
      if (btn)    btn.style.display = 'inline-flex';
      if (banner) banner.style.display = 'flex';
    }
  } catch {
    if (dot)    dot.style.background = '#666';
    if (text)   text.textContent = '';
    if (btn)    btn.style.display = 'none';
    if (banner) banner.style.display = 'none';
  }
}

async function cctvInstallFfmpeg() {
  const allBtns = [
    document.getElementById('cctvInstallFfmpegBtn'),
    document.getElementById('cctvInstallFfmpegBannerBtn'),
  ];
  allBtns.forEach(b => { if (b) { b.disabled = true; b.textContent = 'Menginstall...'; } });

  const plat = process.platform;
  const desc = plat === 'win32'
    ? 'Mengunduh FFmpeg portable (~90 MB)...'
    : plat === 'darwin'
      ? 'Menginstall FFmpeg via Homebrew...'
      : 'Menginstall FFmpeg via apt...';

  let unsubscribe = null;
  try {
    Swal.fire({
      title: 'Install FFmpeg / RTSP',
      html: `<p style="margin-bottom:8px;font-size:0.9rem;">${desc}</p>
             <div style="text-align:left;max-height:220px;overflow-y:auto;font-size:0.8rem;
                  font-family:monospace;background:#111;padding:8px;border-radius:6px;" id="ffmpegInstallLog">
               Memulai...
             </div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    });

    unsubscribe = window.electronAPI.cctv.onFfmpegInstallProgress((data) => {
      const log = document.getElementById('ffmpegInstallLog');
      if (log && data.message) {
        const line = document.createElement('div');
        line.textContent = data.message;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
      }
    });

    const result = await window.electronAPI.cctv.installFfmpeg();
    if (unsubscribe) unsubscribe();

    if (result.success) {
      await Swal.fire({ icon: 'success', title: 'FFmpeg Terinstall', text: 'FFmpeg / RTSP siap digunakan.', confirmButtonText: 'OK' });
      await cctvCheckFfmpeg();
    } else {
      const opts = { icon: 'error', title: 'Gagal Install FFmpeg', text: result.message || 'Terjadi kesalahan.', confirmButtonText: 'OK' };
      if (result.manualUrl) opts.footer = `<a href="${result.manualUrl}" target="_blank">Download Manual</a>`;
      await Swal.fire(opts);
    }
  } catch (err) {
    if (unsubscribe) unsubscribe();
    Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonText: 'OK' });
  } finally {
    allBtns.forEach(b => { if (b) { b.disabled = false; b.innerHTML = '<i class="bi bi-download"></i> Install FFmpeg'; } });
  }
}

async function cctvLoadCameras() {
  try {
    const r = await window.electronAPI.cctv.getCameras();
    _cctvCameras = r.cameras || [];
  } catch (e) {
    console.error('[CCTV] load cameras error', e);
    _cctvCameras = [];
  }
}

function cctvSetLayout(n) {
  _cctvLayout = n;
  const grid = document.getElementById('cctvGrid');
  if (grid) {
    grid.className = `cctv-grid cctv-grid-${n}`;
  }
  [1,4,9,16].forEach(x => {
    const btn = document.getElementById(`cctvLayout${x}`);
    if (btn) btn.classList.toggle('active', x === n);
  });
  cctvRenderGrid();
}

function cctvRenderGrid() {
  const grid = document.getElementById('cctvGrid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.className = `cctv-grid cctv-grid-${_cctvLayout}`;

  const totalCells = _cctvLayout;
  for (let i = 0; i < totalCells; i++) {
    const cam = _cctvCameras[i] || null;
    grid.appendChild(cam ? cctvBuildCell(cam) : cctvBuildEmptyCell(i));
  }

  // If more cameras than cells, show the rest as extra cells below
  if (_cctvCameras.length > totalCells) {
    for (let i = totalCells; i < _cctvCameras.length; i++) {
      grid.appendChild(cctvBuildCell(_cctvCameras[i]));
    }
  }
}

function cctvBuildEmptyCell(idx) {
  const div = document.createElement('div');
  div.className = 'cctv-cell';
  div.innerHTML = `
    <div class="cctv-empty-cell">
      <i class="bi bi-camera-video-off"></i>
      <span>Slot ${idx + 1}</span>
    </div>`;
  return div;
}

function cctvBuildCell(cam) {
  const div = document.createElement('div');
  div.className = 'cctv-cell';
  div.id = `cctvCell_${cam.uid}`;
  div.setAttribute('data-uid', cam.uid);

  const streamInfo = _cctvStreaming.get(cam.uid);
  const isStreaming = !!streamInfo;

  if (isStreaming) {
    div.classList.add('streaming');
    if (cam.type === 'hls') {
      div.innerHTML = `
        <video id="cctvVideo_${cam.uid}" autoplay muted playsinline style="width:100%;height:100%;object-fit:contain;background:#000;"></video>
        <span class="cctv-live-badge">● LIVE</span>`;
    } else if (cam.type === 'snapshot') {
      const src = cam.url + (cam.url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      div.innerHTML = `
        <img id="cctvImg_${cam.uid}" src="${src}" style="width:100%;height:100%;object-fit:contain;background:#000;" alt="${cam.name}">
        <span class="cctv-live-badge">● LIVE</span>`;
    } else if (cam.type === 'http-mjpeg') {
      div.innerHTML = `
        <canvas id="cctvCanvas_${cam.uid}" style="width:100%;height:100%;object-fit:contain;background:#000;display:block;"></canvas>
        <div id="cctvStreamStatus_${cam.uid}" style="display:none;"></div>
        <span id="cctvLiveBadge_${cam.uid}" class="cctv-live-badge">● LIVE</span>`;
    } else {
      // RTSP proxy via localhost — use canvas reader
      div.innerHTML = `
        <canvas id="cctvCanvas_${cam.uid}" style="width:100%;height:100%;object-fit:contain;background:#000;display:block;"></canvas>
        <div id="cctvStreamStatus_${cam.uid}" style="display:none;"></div>
        <span id="cctvLiveBadge_${cam.uid}" class="cctv-live-badge">● LIVE</span>`;
    }
  } else {
    div.innerHTML = `
      <div class="cctv-placeholder">
        <i class="bi bi-camera-video" style="color:#222;"></i>
        <span style="font-size:0.8rem;color:#444;">${cam.name}</span>
        <button onclick="cctvConnect('${cam.uid}')" style="background:var(--color-primary);color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:0.8rem;">
          <i class="bi bi-play-fill"></i> Hubungkan
        </button>
      </div>`;
  }

  const hasPtz = !!(cam.onvifIp && cam.onvifToken);

  // Overlay
  div.innerHTML += `
    <div class="cctv-overlay">
      <span class="cctv-label">${cam.name}</span>
      <div class="cctv-actions">
        ${isStreaming ? `<button onclick="cctvDisconnect('${cam.uid}')">⏹ Stop</button>` : `<button onclick="cctvConnect('${cam.uid}')">▶ Live</button>`}
        ${isStreaming ? `<button onclick="cctvReload('${cam.uid}')" title="Reload stream">↺</button>` : ''}
        ${hasPtz ? `<button onclick="cctvOpenPtz('${cam.uid}')" title="PTZ Control" style="background:#7c3aed;">🎮 PTZ</button>` : ''}
        <button onclick="cctvSnapshot('${cam.uid}')">📷</button>
        <button onclick="cctvFullscreen('${cam.uid}')">⛶</button>
        <button onclick="cctvOpenEditModal('${cam.uid}')">✏</button>
        <button onclick="cctvDeleteCamera('${cam.uid}')" style="color:#fca5a5;">🗑</button>
      </div>
    </div>`;

  // Double click → fullscreen
  div.addEventListener('dblclick', () => cctvFullscreen(cam.uid));

  // If HLS, init after DOM insert
  if (isStreaming && cam.type === 'hls') {
    setTimeout(() => cctvInitHls(cam), 50);
  }

  // If snapshot, start refresh timer
  if (isStreaming && cam.type === 'snapshot') {
    cctvStartSnapshotRefresh(cam);
  }

  // If RTSP proxy or direct MJPEG, start canvas reader
  if (isStreaming && (cam.type === 'rtsp' || cam.type === 'http-mjpeg')) {
    setTimeout(() => cctvStartCanvasStream(cam), 50);
  }

  return div;
}

// ── Connect / Disconnect ─────────────────────────────────────────────────────

async function cctvConnect(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;

  const cell = document.getElementById(`cctvCell_${uid}`);
  if (cell) {
    cell.innerHTML = `<div class="cctv-placeholder"><i class="bi bi-arrow-repeat" style="color:var(--color-primary);animation:spin 1s linear infinite;font-size:2rem;"></i><span style="font-size:0.8rem;color:#888;">Menghubungkan...</span></div>`;
  }

  try {
    if (cam.type === 'http-mjpeg') {
      // Direct MJPEG — no proxy needed
      _cctvStreaming.set(uid, { port: null, type: 'http-mjpeg' });
    } else if (cam.type === 'snapshot') {
      _cctvStreaming.set(uid, { port: null, type: 'snapshot' });
    } else if (cam.type === 'hls') {
      _cctvStreaming.set(uid, { port: null, type: 'hls' });
    } else {
      // RTSP → ffmpeg proxy
      const r = await window.electronAPI.cctv.startStream(cam);
      if (!r.success) throw new Error(r.message || 'Gagal memulai stream');
      _cctvStreaming.set(uid, { port: r.port, type: 'rtsp' });
    }
    cctvRenderGrid();
  } catch (err) {
    _cctvStreaming.delete(uid);
    if (cell) {
      cell.innerHTML = `
        <div class="cctv-placeholder">
          <i class="bi bi-exclamation-triangle" style="color:#ef4444;font-size:2rem;"></i>
          <span style="font-size:0.75rem;color:#ef4444;text-align:center;padding:0 10px;">${err.message}</span>
          <button onclick="cctvConnect('${uid}')" style="background:#ef4444;color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:0.78rem;">Coba Lagi</button>
        </div>`;
    }
    console.error('[CCTV] connect error', err);
  }
}

async function cctvReload(uid) {
  const info = _cctvStreaming.get(uid);
  if (!info) { return cctvConnect(uid); }
  // Abort current stream so reconnect loop restarts immediately
  if (info.abortCtrl) { try { info.abortCtrl.abort(); } catch (_e) {} }
}

async function cctvDisconnect(uid) {
  const info = _cctvStreaming.get(uid);
  if (info && info.refreshTimer) clearInterval(info.refreshTimer);
  if (info && info.abortCtrl) { try { info.abortCtrl.abort(); } catch (_e) {} }
  // destroy HLS instance
  const hls = _hlsInstances.get(uid);
  if (hls) { try { hls.destroy(); } catch (_e) {} _hlsInstances.delete(uid); }
  _cctvStreaming.delete(uid);
  await window.electronAPI.cctv.stopStream(uid);
  cctvRenderGrid();
}

// ── HLS ──────────────────────────────────────────────────────────────────────

function cctvInitHls(cam) {
  const video = document.getElementById(`cctvVideo_${cam.uid}`);
  if (!video) return;

  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(cam.url);
    hls.attachMedia(video);
    _hlsInstances.set(cam.uid, hls);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = cam.url;
  }
}

// ── Snapshot refresh ─────────────────────────────────────────────────────────

function cctvStartSnapshotRefresh(cam) {
  const info = _cctvStreaming.get(cam.uid);
  if (!info) return;
  const intervalSec = cam.refreshSec || 5;
  const timer = setInterval(() => {
    const img = document.getElementById(`cctvImg_${cam.uid}`);
    if (!img) { clearInterval(timer); return; }
    img.src = cam.url + (cam.url.includes('?') ? '&' : '?') + '_t=' + Date.now();
  }, intervalSec * 1000);
  info.refreshTimer = timer;
}

// ── Canvas MJPEG reader ───────────────────────────────────────────────────────

function _classifyStreamError(err) {
  if (!err) return 'Stream terputus';
  const msg = (err.message || '').toLowerCase();
  if (msg === 'read_timeout')                    return 'Timeout / RTO (tdk ada data)';
  if (msg.includes('failed to fetch') ||
      msg.includes('err_connection_refused') ||
      msg.includes('econnrefused'))              return 'Koneksi ditolak (ECONNREFUSED)';
  if (msg.includes('timed_out') ||
      msg.includes('err_connection_timed_out'))  return 'Koneksi timeout (RTO)';
  if (msg.includes('http 401'))                  return 'Autentikasi gagal (401)';
  if (msg.includes('http 403'))                  return 'Akses ditolak (403)';
  if (msg.includes('http 404'))                  return 'Stream tdk ditemukan (404)';
  if (msg.includes('http 5'))                    return `Error server (${err.message})`;
  if (msg.includes('network'))                   return 'Jaringan terputus';
  return (err.message || 'Stream terputus').slice(0, 50);
}

function cctvSetStreamStatus(uid, msg, type) {
  const el = document.getElementById(`cctvStreamStatus_${uid}`);
  if (!el) return;
  if (!msg) { el.style.display = 'none'; return; }
  const bg = type === 'error' ? 'rgba(239,68,68,0.88)' : 'rgba(30,27,46,0.88)';
  const ic = type === 'error' ? '⚠ ' : type === 'connecting' ? '↻ ' : '';
  el.style.cssText = `position:absolute;bottom:28px;left:0;right:0;text-align:center;padding:4px 8px;background:${bg};color:#fff;font-size:0.68rem;font-weight:600;display:block;z-index:3;pointer-events:none;letter-spacing:0.01em;`;
  el.textContent = ic + msg;
}

// Returns { stopped: bool, error? }
// stopped=true  → AbortError from user disconnect, do NOT reconnect
// stopped=false → stream ended/error, reconnect is OK
async function cctvDrawCanvasFromUrl(canvas, url, outerAbortCtrl, uid) {
  const ctx = canvas.getContext('2d');
  const JPEG_SOI = 0xFF, JPEG_EOI_BYTE = 0xD9, JPEG_START = 0xD8;
  const FREEZE_TIMEOUT_MS = 15000; // abort stream if no data for 15s

  let lastFrameTs = Date.now();
  let frameCount  = 0;

  // Watchdog: if no data for FREEZE_TIMEOUT_MS, abort the fetch
  let freezeTimer = setTimeout(() => outerAbortCtrl.abort('freeze'), FREEZE_TIMEOUT_MS);
  const resetFreeze = () => {
    clearTimeout(freezeTimer);
    freezeTimer = setTimeout(() => outerAbortCtrl.abort('freeze'), FREEZE_TIMEOUT_MS);
  };

  // Live badge — update every second
  const badgeTimer = setInterval(() => {
    const badge = document.getElementById(`cctvLiveBadge_${uid}`);
    if (!badge) { clearInterval(badgeTimer); return; }
    const idle = Math.round((Date.now() - lastFrameTs) / 1000);
    if (idle < 3) {
      badge.textContent = '● LIVE';
      badge.style.color = '#22c55e';
    } else {
      badge.textContent = `⚠ ${idle}s idle`;
      badge.style.color = '#f59e0b';
    }
  }, 1000);

  const cleanup = () => {
    clearInterval(badgeTimer);
    clearTimeout(freezeTimer);
  };

  try {
    const resp = await fetch(url, { signal: outerAbortCtrl.signal });
    if (!resp.ok) { cleanup(); return { error: new Error(`HTTP ${resp.status}`), stopped: false }; }

    const reader = resp.body.getReader();
    let buf = new Uint8Array(0);

    const append = (chunk) => {
      const merged = new Uint8Array(buf.length + chunk.length);
      merged.set(buf);
      merged.set(chunk, buf.length);
      buf = merged;
    };

    const findFrame = () => {
      let start = -1;
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i] === JPEG_SOI && buf[i + 1] === JPEG_START) { start = i; break; }
      }
      if (start < 0) { buf = new Uint8Array(0); return null; }
      for (let i = start + 2; i < buf.length - 1; i++) {
        if (buf[i] === JPEG_SOI && buf[i + 1] === JPEG_EOI_BYTE) {
          const frame = buf.slice(start, i + 2);
          buf = buf.slice(i + 2);
          return frame;
        }
      }
      if (start > 0) buf = buf.slice(start);
      return null;
    };

    while (true) {
      const { value, done } = await reader.read(); // AbortSignal cancels this properly
      if (done) { cleanup(); return { error: new Error('Stream terputus oleh server'), stopped: false }; }
      resetFreeze();
      append(value);
      let frame;
      while ((frame = findFrame()) !== null) {
        try {
          const blob = new Blob([frame], { type: 'image/jpeg' });
          const bmp  = await createImageBitmap(blob);
          canvas.width  = bmp.width;
          canvas.height = bmp.height;
          ctx.drawImage(bmp, 0, 0);
          bmp.close();
          frameCount++;
          lastFrameTs = Date.now();
          if (frameCount === 1) cctvSetStreamStatus(uid, '', '');
        } catch (_e) { /* skip bad frame */ }
      }
    }
  } catch (err) {
    cleanup();
    if (err.name === 'AbortError') {
      // Distinguish freeze-abort vs user-disconnect-abort
      const isFrozen = outerAbortCtrl.signal.reason === 'freeze';
      if (isFrozen) return { error: new Error('Stream beku (15s tdk ada data)'), stopped: false };
      return { stopped: true }; // user disconnected
    }
    return { error: err, stopped: false };
  }
}

async function cctvStartCanvasStream(cam) {
  const RETRY_DELAYS = [3000, 5000, 8000, 10000, 15000];
  let attempt = 0;

  while (_cctvStreaming.has(cam.uid)) {
    const info = _cctvStreaming.get(cam.uid);
    if (!info) return;

    // ── For RTSP: restart ffmpeg proxy on every attempt ──────────────────────
    if (cam.type === 'rtsp') {
      cctvSetStreamStatus(cam.uid, attempt > 0 ? `↻ Memulai ulang stream (${attempt})...` : 'Memulai ffmpeg...', 'connecting');
      try {
        const r = await window.electronAPI.cctv.startStream(cam);
        if (!r.success) throw new Error(r.message || 'Gagal memulai proxy');
        info.port = r.port; // update port in case it changed
      } catch (err) {
        attempt++;
        const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
        for (let i = Math.round(delay / 1000); i > 0; i--) {
          if (!_cctvStreaming.has(cam.uid)) return;
          cctvSetStreamStatus(cam.uid, `ffmpeg gagal: ${err.message} — retry ${i}s`, 'error');
          await new Promise(r => setTimeout(r, 1000));
        }
        continue;
      }
      // Small delay to let ffmpeg initialize before we fetch
      await new Promise(r => setTimeout(r, 500));
    }

    const url    = cam.type === 'http-mjpeg' ? cam.url : `http://127.0.0.1:${info.port}/`;
    const canvas = document.getElementById(`cctvCanvas_${cam.uid}`);
    if (!canvas) return;

    // Create a fresh AbortController for this attempt
    const abortCtrl = new AbortController();
    info.abortCtrl  = abortCtrl;

    cctvSetStreamStatus(cam.uid, attempt > 0 ? `Menghubungkan ulang (${attempt})...` : 'Menghubungkan...', 'connecting');

    const { error, stopped } = await cctvDrawCanvasFromUrl(canvas, url, abortCtrl, cam.uid);

    if (stopped || !_cctvStreaming.has(cam.uid)) return;

    // Stream ended / errored — check ffmpeg log for details, then reconnect
    attempt++;
    let errMsg = _classifyStreamError(error);

    // Try to get ffmpeg error log from proxy
    try {
      const st = await window.electronAPI.cctv.streamStatus(cam.uid);
      if (st && st.ffmpegLog) {
        const log = st.ffmpegLog.slice(-300); // last 300 chars
        if (log.includes('Connection refused'))      errMsg = 'RTSP: Koneksi ditolak';
        else if (log.includes('401 Unauthorized'))   errMsg = 'RTSP: Auth gagal (401)';
        else if (log.includes('No route to host'))   errMsg = 'RTSP: Host tidak terjangkau';
        else if (log.includes('Connection timed out')) errMsg = 'RTSP: Timeout';
        else if (log.includes('Invalid data'))       errMsg = 'RTSP: URL/format tidak valid';
        else if (log.includes('No such file'))       errMsg = 'ffmpeg tidak ditemukan';
      }
    } catch {}

    const delay    = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
    const delaySec = Math.round(delay / 1000);
    console.warn(`[CCTV] ${cam.name} — ${errMsg}, retry in ${delaySec}s (attempt ${attempt})`);

    for (let i = delaySec; i > 0; i--) {
      if (!_cctvStreaming.has(cam.uid)) return;
      cctvSetStreamStatus(cam.uid, `${errMsg} — reconnect ${i}s`, 'error');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── Snapshot save ─────────────────────────────────────────────────────────────

async function cctvSnapshot(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  try {
    const r = await window.electronAPI.cctv.snapshot(cam);
    if (r.success) {
      cctvToast(`Screenshot disimpan ke: ${r.path}`, 'success');
    } else if (!r.canceled) {
      cctvToast(`Gagal: ${r.message}`, 'error');
    }
  } catch (err) {
    cctvToast(`Error: ${err.message}`, 'error');
  }
}

// ── Fullscreen ────────────────────────────────────────────────────────────────

function cctvFullscreen(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  const info = _cctvStreaming.get(uid);
  const fsEl    = document.getElementById('cctvFullscreen');
  const fsImg   = document.getElementById('cctvFsImg');
  const fsVid   = document.getElementById('cctvFsVideo');
  const fsTitle = document.getElementById('cctvFsTitle');

  if (fsTitle) fsTitle.textContent = cam.name;
  fsImg.style.display  = 'none';
  fsVid.style.display  = 'none';

  if (!info) {
    fsEl.style.display = 'flex';
    return;
  }

  if (cam.type === 'hls') {
    fsVid.style.display = 'block';
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(cam.url);
      hls.attachMedia(fsVid);
    } else {
      fsVid.src = cam.url;
    }
  } else if (cam.type === 'snapshot') {
    fsImg.src = cam.url + (cam.url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    fsImg.style.display = 'block';
  } else {
    // RTSP proxy or direct MJPEG — use canvas
    let fsCanvas = document.getElementById('cctvFsCanvas');
    if (!fsCanvas) {
      fsCanvas = document.createElement('canvas');
      fsCanvas.id = 'cctvFsCanvas';
      fsCanvas.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;background:#000;';
      fsImg.parentNode.insertBefore(fsCanvas, fsImg);
    }
    fsCanvas.style.display = 'block';
    const streamUrl = cam.type === 'http-mjpeg' ? cam.url : `http://127.0.0.1:${info.port}/`;
    // abort any previous fs stream
    if (window._cctvFsAbort) { try { window._cctvFsAbort.abort(); } catch (_e) {} }
    window._cctvFsAbort = new AbortController();
    cctvDrawCanvasFromUrl(fsCanvas, streamUrl, window._cctvFsAbort.signal, '__fs__');
  }

  fsEl.style.display = 'flex';
}

function cctvCloseFullscreen() {
  const fsEl     = document.getElementById('cctvFullscreen');
  const fsVid    = document.getElementById('cctvFsVideo');
  const fsImg    = document.getElementById('cctvFsImg');
  const fsCanvas = document.getElementById('cctvFsCanvas');
  if (fsVid) { fsVid.pause(); fsVid.src = ''; }
  if (fsImg) { fsImg.src = ''; fsImg.style.display = 'none'; }
  if (fsCanvas)  fsCanvas.style.display = 'none';
  if (window._cctvFsAbort) { try { window._cctvFsAbort.abort(); } catch (_e) {} window._cctvFsAbort = null; }
  if (fsEl)  fsEl.style.display = 'none';
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function cctvOpenAddModal() {
  document.getElementById('cctvModalTitle').textContent = 'Tambah Kamera';
  document.getElementById('cctvEditUid').value = '';
  document.getElementById('cctvName').value     = '';
  document.getElementById('cctvType').value     = 'rtsp';
  document.getElementById('cctvUrl').value      = '';
  document.getElementById('cctvUsername').value = '';
  document.getElementById('cctvPassword').value = '';
  document.getElementById('cctvFps').value      = '15';
  document.getElementById('cctvRefreshSec').value = '5';
  document.getElementById('cctvNotes').value    = '';
  const onvifIpEl2 = document.getElementById('cctvOnvifIp');
  if (onvifIpEl2) onvifIpEl2.value = '';
  const onvifPortEl2 = document.getElementById('cctvOnvifPort');
  if (onvifPortEl2) onvifPortEl2.value = '';
  const onvifTokenEl2 = document.getElementById('cctvOnvifToken');
  if (onvifTokenEl2) onvifTokenEl2.value = '';
  cctvOnTypeChange();
  document.getElementById('cctvModal').style.display = 'flex';
}

function cctvOpenEditModal(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  document.getElementById('cctvModalTitle').textContent = 'Edit Kamera';
  document.getElementById('cctvEditUid').value = cam.uid;
  document.getElementById('cctvName').value     = cam.name || '';
  document.getElementById('cctvType').value     = cam.type || 'rtsp';
  document.getElementById('cctvUrl').value      = cam.url || '';
  document.getElementById('cctvUsername').value = cam.username || '';
  document.getElementById('cctvPassword').value = cam.password || '';
  document.getElementById('cctvFps').value      = String(cam.fps || 15);
  document.getElementById('cctvRefreshSec').value = String(cam.refreshSec || 5);
  document.getElementById('cctvNotes').value    = cam.notes || '';
  const onvifIpEl = document.getElementById('cctvOnvifIp');
  if (onvifIpEl) onvifIpEl.value = cam.onvifIp || '';
  const onvifPortEl = document.getElementById('cctvOnvifPort');
  if (onvifPortEl) onvifPortEl.value = String(cam.onvifPort || '');
  const onvifTokenEl = document.getElementById('cctvOnvifToken');
  if (onvifTokenEl) onvifTokenEl.value = cam.onvifToken || '';
  cctvOnTypeChange();
  document.getElementById('cctvModal').style.display = 'flex';
}

function cctvCloseModal() {
  document.getElementById('cctvModal').style.display = 'none';
}

// Auto-fill ONVIF IP from stream URL
function cctvAutoFillOnvif() {
  const url  = (document.getElementById('cctvUrl') || {}).value || '';
  const ipEl  = document.getElementById('cctvOnvifIp');
  const portEl = document.getElementById('cctvOnvifPort');
  const tokenEl = document.getElementById('cctvOnvifToken');

  // Extract IP from rtsp://user:pass@IP:PORT/... or http://IP:PORT/...
  const m = url.match(/(?:rtsp|http|https):\/\/(?:[^@]+@)?(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?/i);
  if (m && ipEl) {
    if (!ipEl.value) ipEl.value = m[1];
    // Only pre-fill port if ONVIF port field is default 80 (don't overwrite if user set it)
    if (portEl && (portEl.value === '80' || !portEl.value)) {
      portEl.value = '80'; // ONVIF port is separate from RTSP port — keep 80 as default
    }
  }
  if (tokenEl && !tokenEl.value) tokenEl.value = 'MainStream';
  if (ipEl && !ipEl.value) { cctvToast('Tidak bisa deteksi IP dari URL — isi manual', 'error'); }
}

function cctvOnTypeChange() {
  const type = document.getElementById('cctvType').value;
  const brandHelper = document.getElementById('cctvBrandHelper');
  const credFields  = document.getElementById('cctvCredFields');
  const fpsField    = document.getElementById('cctvFpsField');
  const snapField   = document.getElementById('cctvSnapshotInterval');
  const urlHint     = document.getElementById('cctvUrlHint');

  const hints = {
    'rtsp':       'Contoh: rtsp://192.168.1.100:554/stream1',
    'http-mjpeg': 'Contoh: http://192.168.1.100/mjpeg',
    'hls':        'Contoh: http://192.168.1.100/stream.m3u8',
    'snapshot':   'Contoh: http://192.168.1.100/snapshot.jpg',
  };
  if (urlHint) urlHint.textContent = hints[type] || '';

  if (brandHelper) brandHelper.style.display = type === 'rtsp' ? 'block' : 'none';
  if (credFields)  credFields.style.display  = (type === 'rtsp' || type === 'http-mjpeg') ? 'flex' : 'none';
  if (fpsField)    fpsField.style.display    = type === 'rtsp' ? 'block' : 'none';
  if (snapField)   snapField.style.display   = type === 'snapshot' ? 'block' : 'none';
}

function cctvApplyTemplate(tpl) {
  if (!tpl) return;
  document.getElementById('cctvUrl').value = tpl;
}

async function cctvSaveCamera() {
  const name = (document.getElementById('cctvName').value || '').trim();
  const url  = (document.getElementById('cctvUrl').value  || '').trim();
  if (!name) { cctvToast('Nama kamera wajib diisi', 'error'); return; }
  if (!url)  { cctvToast('URL stream wajib diisi', 'error'); return; }

  const existingUid = document.getElementById('cctvEditUid').value;
  const camera = {
    uid:          existingUid || crypto.randomUUID(),
    name,
    type:         document.getElementById('cctvType').value,
    url,
    username:     document.getElementById('cctvUsername').value,
    password:     document.getElementById('cctvPassword').value,
    fps:          parseInt(document.getElementById('cctvFps').value) || 15,
    refreshSec:   parseInt(document.getElementById('cctvRefreshSec').value) || 5,
    notes:        document.getElementById('cctvNotes').value,
    onvifIp:      (document.getElementById('cctvOnvifIp')    || {}).value || '',
    onvifPort:    parseInt((document.getElementById('cctvOnvifPort') || {}).value) || 0,
    onvifToken:   (document.getElementById('cctvOnvifToken') || {}).value || '',
  };

  try {
    await window.electronAPI.cctv.saveCamera(camera);
    if (existingUid) {
      const idx = _cctvCameras.findIndex(c => c.uid === existingUid);
      if (idx >= 0) _cctvCameras[idx] = camera;
    } else {
      _cctvCameras.push(camera);
    }
    cctvCloseModal();
    cctvRenderGrid();
    cctvToast(`Kamera "${name}" disimpan`, 'success');
  } catch (err) {
    cctvToast(`Gagal simpan: ${err.message}`, 'error');
  }
}

async function cctvDeleteCamera(uid) {
  const cam = _cctvCameras.find(c => c.uid === uid);
  if (!cam) return;
  if (!confirm(`Hapus kamera "${cam.name}"?`)) return;
  await cctvDisconnect(uid);
  await window.electronAPI.cctv.deleteCamera(uid);
  _cctvCameras = _cctvCameras.filter(c => c.uid !== uid);
  cctvRenderGrid();
  cctvToast(`Kamera "${cam.name}" dihapus`, 'success');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function cctvToast(msg, type = 'info') {
  const colors = { success: '#22c55e', error: '#ef4444', info: '#6366f1' };
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:24px;right:24px;background:${colors[type]||colors.info};color:#fff;padding:10px 18px;border-radius:8px;font-size:0.85rem;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:340px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

// Hook into switchPage
(function() {
  const _origSwitchPage = window.switchPage;
  if (typeof _origSwitchPage === 'function') {
    window.switchPage = async function(page, ...args) {
      await _origSwitchPage(page, ...args);
      if (page === 'cctv') cctvInit();
    };
  }
})();

// ── PTZ Panel ─────────────────────────────────────────────────────────────────

let _ptzCam = null;         // current camera for PTZ
let _ptzPresets = [];       // loaded presets

function cctvOpenPtz(uid) {
  _ptzCam = _cctvCameras.find(c => c.uid === uid);
  if (!_ptzCam) return;

  let panel = document.getElementById('cctvPtzPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cctvPtzPanel';
    panel.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:10000;background:#1e1b2e;border:1px solid #4c1d95;
      border-radius:14px;padding:20px 24px;min-width:320px;
      box-shadow:0 8px 40px rgba(0,0,0,0.6);color:#fff;font-family:inherit;`;
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <span style="font-weight:700;font-size:1rem;">🎮 PTZ — ${_ptzCam.name}</span>
      <button onclick="cctvClosePtz()" style="background:none;border:none;color:#aaa;font-size:1.3rem;cursor:pointer;line-height:1;">✕</button>
    </div>

    <!-- Speed -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:0.8rem;color:#aaa;">
      <span>Kecepatan:</span>
      <input id="ptzSpeed" type="range" min="1" max="10" value="5" style="flex:1;">
      <span id="ptzSpeedVal">0.5</span>
    </div>

    <!-- D-pad + Zoom -->
    <div style="display:flex;gap:16px;align-items:center;justify-content:center;margin-bottom:14px;">
      <!-- D-pad -->
      <div style="display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:4px;">
        <button class="ptz-btn" onmousedown="cctvPtzDir('ul')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('ul')" ontouchend="cctvPtzHalt()">↖</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('u')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('u')"  ontouchend="cctvPtzHalt()">↑</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('ur')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('ur')" ontouchend="cctvPtzHalt()">↗</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('l')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('l')"  ontouchend="cctvPtzHalt()">←</button>
        <button class="ptz-btn" onclick="cctvPtzHalt()" style="background:#3f3465;font-size:0.7rem;">■</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('r')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('r')"  ontouchend="cctvPtzHalt()">→</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('dl')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('dl')" ontouchend="cctvPtzHalt()">↙</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('d')"  onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('d')"  ontouchend="cctvPtzHalt()">↓</button>
        <button class="ptz-btn" onmousedown="cctvPtzDir('dr')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('dr')" ontouchend="cctvPtzHalt()">↘</button>
      </div>
      <!-- Zoom -->
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="ptz-btn" style="height:60px;font-size:1.1rem;" onmousedown="cctvPtzDir('zi')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('zi')" ontouchend="cctvPtzHalt()">🔍+</button>
        <button class="ptz-btn" style="height:60px;font-size:1.1rem;" onmousedown="cctvPtzDir('zo')" onmouseup="cctvPtzHalt()" ontouchstart="cctvPtzDir('zo')" ontouchend="cctvPtzHalt()">🔍−</button>
      </div>
    </div>

    <!-- Presets -->
    <div id="ptzPresetArea" style="border-top:1px solid #3f3465;padding-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:0.82rem;color:#aaa;">Preset Posisi</span>
        <button onclick="cctvPtzLoadPresets()" style="background:#4c1d95;border:none;color:#fff;padding:3px 10px;border-radius:5px;cursor:pointer;font-size:0.75rem;">🔄 Muat</button>
      </div>
      <div id="ptzPresetList" style="display:flex;flex-wrap:wrap;gap:6px;min-height:30px;">
        <span style="font-size:0.75rem;color:#666;">Klik "Muat" untuk daftar preset kamera</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <input id="ptzNewPresetName" type="text" placeholder="Nama preset baru..." style="flex:1;background:#2d2446;border:1px solid #4c1d95;color:#fff;padding:5px 8px;border-radius:6px;font-size:0.78rem;">
        <button onclick="cctvPtzSavePreset()" style="background:#7c3aed;border:none;color:#fff;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78rem;white-space:nowrap;">💾 Simpan</button>
      </div>
    </div>

    <div id="ptzStatus" style="font-size:0.72rem;color:#aaa;margin-top:8px;text-align:center;min-height:16px;"></div>`;

  // Speed label sync
  const speedInput = panel.querySelector('#ptzSpeed');
  if (speedInput) {
    speedInput.addEventListener('input', () => {
      document.getElementById('ptzSpeedVal').textContent = (speedInput.value / 10).toFixed(1);
    });
  }

  // Add PTZ button styles if not already added
  if (!document.getElementById('ptzBtnStyle')) {
    const s = document.createElement('style');
    s.id = 'ptzBtnStyle';
    s.textContent = `.ptz-btn{width:44px;height:44px;background:#2d2446;border:1px solid #4c1d95;color:#fff;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:background 0.1s;user-select:none;} .ptz-btn:active,.ptz-btn:hover{background:#6d28d9;}`;
    document.head.appendChild(s);
  }

  panel.style.display = 'block';
}

function cctvClosePtz() {
  cctvPtzHalt();
  const panel = document.getElementById('cctvPtzPanel');
  if (panel) panel.style.display = 'none';
  _ptzCam = null;
}

function _ptzParams() {
  return { ip: _ptzCam.onvifIp, port: _ptzCam.onvifPort || 80, username: _ptzCam.username || '', password: _ptzCam.password || '', profileToken: _ptzCam.onvifToken };
}

function _ptzStatus(msg) {
  const el = document.getElementById('ptzStatus');
  if (el) el.textContent = msg;
}

async function cctvPtzDir(dir) {
  if (!_ptzCam) return;
  const speed = parseFloat((document.getElementById('ptzSpeed') || { value: '5' }).value) / 10;
  const dirMap = {
    u:  [0,  speed, 0],  d:  [0, -speed, 0],
    l:  [-speed, 0, 0],  r:  [speed,  0, 0],
    ul: [-speed, speed, 0], ur: [speed, speed, 0],
    dl: [-speed,-speed, 0], dr: [speed,-speed, 0],
    zi: [0, 0,  speed],  zo: [0, 0, -speed],
  };
  const [pan, tilt, zoom] = dirMap[dir] || [0, 0, 0];
  try {
    const r = await window.electronAPI.cctv.ptzMove({ ..._ptzParams(), pan, tilt, zoom });
    if (!r.success) _ptzStatus(`Error: ${r.message}`);
    else _ptzStatus('');
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

async function cctvPtzHalt() {
  if (!_ptzCam) return;
  try {
    await window.electronAPI.cctv.ptzStop(_ptzParams());
  } catch {}
}

async function cctvPtzLoadPresets() {
  if (!_ptzCam) return;
  _ptzStatus('Memuat preset...');
  const listEl = document.getElementById('ptzPresetList');
  if (listEl) listEl.innerHTML = '<span style="font-size:0.75rem;color:#aaa;">Memuat...</span>';
  try {
    const r = await window.electronAPI.cctv.ptzPresets(_ptzParams());
    if (!r.success) { _ptzStatus(`Gagal: ${r.message}`); return; }
    _ptzPresets = r.presets || [];
    _ptzStatus(_ptzPresets.length ? `${_ptzPresets.length} preset` : 'Tidak ada preset');
    if (listEl) {
      listEl.innerHTML = _ptzPresets.length
        ? _ptzPresets.map(p => `<button onclick="cctvPtzGoto('${p.token}')" style="padding:4px 10px;background:#2d2446;border:1px solid #4c1d95;color:#fff;border-radius:6px;cursor:pointer;font-size:0.75rem;" title="${p.name}">${p.name}</button>`).join('')
        : '<span style="font-size:0.75rem;color:#666;">Tidak ada preset tersimpan</span>';
    }
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

async function cctvPtzGoto(presetToken) {
  if (!_ptzCam) return;
  _ptzStatus('Bergerak ke preset...');
  try {
    const r = await window.electronAPI.cctv.ptzGotoPreset({ ..._ptzParams(), presetToken });
    _ptzStatus(r.success ? '✓ Posisi preset diterapkan' : `Gagal: ${r.message}`);
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

async function cctvPtzSavePreset() {
  if (!_ptzCam) return;
  const name = (document.getElementById('ptzNewPresetName') || {}).value || '';
  _ptzStatus('Menyimpan preset...');
  try {
    const r = await window.electronAPI.cctv.ptzSetPreset({ ..._ptzParams(), presetName: name });
    if (r.success) {
      _ptzStatus(`✓ Preset "${name || r.token}" disimpan`);
      if (document.getElementById('ptzNewPresetName')) document.getElementById('ptzNewPresetName').value = '';
      cctvPtzLoadPresets();
    } else {
      _ptzStatus(`Gagal: ${r.message}`);
    }
  } catch (err) { _ptzStatus(`Error: ${err.message}`); }
}

// Expose globally
window.cctvSetLayout       = cctvSetLayout;
window.cctvConnect         = cctvConnect;
window.cctvReload          = cctvReload;
window.cctvDisconnect      = cctvDisconnect;
window.cctvSnapshot        = cctvSnapshot;
window.cctvFullscreen      = cctvFullscreen;
window.cctvCloseFullscreen = cctvCloseFullscreen;
window.cctvOpenAddModal    = cctvOpenAddModal;
window.cctvOpenEditModal   = cctvOpenEditModal;
window.cctvCloseModal      = cctvCloseModal;
window.cctvAutoFillOnvif   = cctvAutoFillOnvif;
window.cctvOnTypeChange    = cctvOnTypeChange;
window.cctvApplyTemplate   = cctvApplyTemplate;
window.cctvSaveCamera      = cctvSaveCamera;
window.cctvDeleteCamera    = cctvDeleteCamera;

// ── ONVIF Scan ────────────────────────────────────────────────────────────────

let _cctvScanUnlisten = null;
let _cctvScanRunning  = false;

function cctvOpenScanModal() {
  document.getElementById('cctvScanModal').style.display = 'flex';
  cctvPopulateSubnetChips();
}

function cctvPopulateSubnetChips() {
  const chips = document.getElementById('cctvSubnetChips');
  if (!chips) return;
  // Show common subnet quick-pick chips
  const commonSubnets = ['192.168.0', '192.168.1', '192.168.2', '192.168.10', '192.168.100', '10.0.0', '172.16.0'];
  chips.innerHTML = commonSubnets.map(s =>
    `<button onclick="cctvSetSubnet('${s}')"
      style="padding:3px 10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:5px;color:var(--color-muted);cursor:pointer;font-size:0.75rem;font-family:monospace;white-space:nowrap;"
      title="Scan ${s}.1-254">${s}.x</button>`
  ).join('');
}

function cctvSetSubnet(subnet) {
  const input = document.getElementById('cctvScanSubnet');
  if (input) input.value = subnet;
  // Highlight active chip
  document.querySelectorAll('#cctvSubnetChips button').forEach(btn => {
    const active = btn.textContent.startsWith(subnet);
    btn.style.background      = active ? 'var(--color-primary)' : 'var(--color-bg)';
    btn.style.color           = active ? '#fff' : 'var(--color-muted)';
    btn.style.borderColor     = active ? 'var(--color-primary)' : 'var(--color-border)';
  });
}

function cctvCloseScanModal() {
  document.getElementById('cctvScanModal').style.display = 'none';
  if (_cctvScanUnlisten) { _cctvScanUnlisten(); _cctvScanUnlisten = null; }
}

async function cctvStartScan() {
  if (_cctvScanRunning) return;
  _cctvScanRunning = true;

  const btn  = document.getElementById('cctvScanBtn');
  const prog = document.getElementById('cctvScanProgress');
  const msg  = document.getElementById('cctvScanMsg');
  const pct  = document.getElementById('cctvScanPct');
  const bar  = document.getElementById('cctvScanBar');
  const res  = document.getElementById('cctvScanResults');
  const empty = document.getElementById('cctvScanEmpty');

  const username    = (document.getElementById('cctvScanUser').value   || '').trim();
  const password    = document.getElementById('cctvScanPass').value   || '';
  const subnetInput = (document.getElementById('cctvScanSubnet').value || '').trim();

  if (btn)   { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Scanning...'; }
  if (prog)  prog.style.display = 'block';
  if (empty) empty.style.display = 'none';
  if (res)   res.innerHTML = '';

  // Listen for progress events
  if (_cctvScanUnlisten) _cctvScanUnlisten();
  _cctvScanUnlisten = window.electronAPI.cctv.onScanProgress((data) => {
    if (msg) msg.textContent = data.message || '';
    if (data.progress != null) {
      if (pct) pct.textContent = data.progress + '%';
      if (bar) bar.style.width = data.progress + '%';
    }
  });

  try {
    const r = await window.electronAPI.cctv.scanOnvif({ username, password, subnetInput });
    const devices = r.devices || [];

    if (devices.length === 0) {
      if (res) res.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;color:var(--color-muted);gap:8px;">
          <i class="bi bi-camera-video-off" style="font-size:2rem;"></i>
          <span style="font-size:0.85rem;">Tidak ada perangkat ONVIF ditemukan di jaringan ini</span>
          <span style="font-size:0.75rem;opacity:.7;">Pastikan kamera dan komputer dalam satu subnet</span>
        </div>`;
    } else {
      if (res) res.innerHTML = devices.map(d => cctvBuildScanResultCard(d, username, password)).join('');
    }
  } catch (err) {
    if (res) res.innerHTML = `<div style="padding:16px;color:#ef4444;font-size:0.85rem;">Error: ${err.message}</div>`;
  } finally {
    _cctvScanRunning = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-search"></i> Scan Lagi'; }
    if (_cctvScanUnlisten) { _cctvScanUnlisten(); _cctvScanUnlisten = null; }
  }
}

function cctvBuildScanResultCard(d, username, password) {
  const info  = d.info || {};
  const label = [info.manufacturer, info.model].filter(Boolean).join(' ') || 'ONVIF Device';
  const rtsp  = d.streamUri || '';

  return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:8px;background:var(--color-bg);margin-bottom:8px;border:1px solid var(--color-border);">
    <div style="padding:8px;background:var(--color-primary)22;border-radius:8px;flex-shrink:0;">
      <i class="bi bi-camera-video-fill" style="color:var(--color-primary);font-size:1.1rem;"></i>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;font-size:0.9rem;">${label}</div>
      <div style="font-size:0.75rem;color:var(--color-muted);margin-top:2px;">${d.ip}:${d.port} · ${d.source === 'ws-discovery' ? 'WS-Discovery' : 'TCP Scan'}</div>
      ${info.firmware ? `<div style="font-size:0.72rem;color:var(--color-muted);">FW: ${info.firmware}${info.serial ? ' · S/N: ' + info.serial : ''}</div>` : ''}
      ${rtsp ? `<div style="font-size:0.72rem;color:#22c55e;margin-top:3px;font-family:monospace;word-break:break-all;">${rtsp}</div>` : '<div style="font-size:0.72rem;color:#f59e0b;margin-top:3px;">Stream URI tidak tersedia (coba dengan credentials)</div>'}
    </div>
    <button onclick="cctvAddFromScan('${d.ip}',${d.port},'${encodeURIComponent(rtsp)}','${encodeURIComponent(label)}','${encodeURIComponent(username)}','${encodeURIComponent(password)}','${encodeURIComponent(d.profileToken||'')}')"
      style="flex-shrink:0;padding:6px 14px;background:var(--color-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">
      + Tambah
    </button>
  </div>`;
}

function cctvAddFromScan(ip, port, rtspEnc, labelEnc, userEnc, passEnc, profileTokenEnc) {
  const rtsp  = decodeURIComponent(rtspEnc);
  const label = decodeURIComponent(labelEnc);
  const user  = decodeURIComponent(userEnc);
  const pass  = decodeURIComponent(passEnc);
  const token = profileTokenEnc ? decodeURIComponent(profileTokenEnc) : '';

  // Pre-fill add modal
  document.getElementById('cctvModalTitle').textContent = 'Tambah Kamera ONVIF';
  document.getElementById('cctvEditUid').value       = '';
  document.getElementById('cctvName').value          = label || `Kamera ${ip}`;
  document.getElementById('cctvType').value          = 'rtsp';
  document.getElementById('cctvUrl').value           = rtsp || `rtsp://${ip}:554/stream1`;
  document.getElementById('cctvUsername').value      = user;
  document.getElementById('cctvPassword').value      = pass;
  document.getElementById('cctvFps').value           = '15';
  document.getElementById('cctvRefreshSec').value    = '5';
  document.getElementById('cctvNotes').value         = `ONVIF ${ip}:${port}`;
  // Store ONVIF metadata for PTZ
  const onvifIpEl = document.getElementById('cctvOnvifIp');
  if (onvifIpEl) { onvifIpEl.value = ip; }
  const onvifPortEl = document.getElementById('cctvOnvifPort');
  if (onvifPortEl) { onvifPortEl.value = port; }
  const onvifTokenEl = document.getElementById('cctvOnvifToken');
  if (onvifTokenEl) { onvifTokenEl.value = token; }
  cctvOnTypeChange();

  // Close scan modal, open add modal
  cctvCloseScanModal();
  document.getElementById('cctvModal').style.display = 'flex';
}

window.cctvOpenScanModal   = cctvOpenScanModal;
window.cctvCloseScanModal  = cctvCloseScanModal;
window.cctvStartScan       = cctvStartScan;
window.cctvAddFromScan     = cctvAddFromScan;
window.cctvSetSubnet       = cctvSetSubnet;

function cctvToggleScanPass(btn) {
  const input = document.getElementById('cctvScanPass');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) { icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye'; }
}
window.cctvToggleScanPass  = cctvToggleScanPass;
window.cctvOpenPtz         = cctvOpenPtz;
window.cctvClosePtz        = cctvClosePtz;
window.cctvPtzDir          = cctvPtzDir;
window.cctvPtzHalt         = cctvPtzHalt;
window.cctvPtzLoadPresets  = cctvPtzLoadPresets;
window.cctvPtzGoto         = cctvPtzGoto;
window.cctvPtzSavePreset   = cctvPtzSavePreset;

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
      cronJobs = await window.electronAPI.cron.loadJobs();
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
      await window.electronAPI.cron.toggleJob(id, enabled);
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
      const result = await window.electronAPI.cron.runNow(id);
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
      const result = await window.electronAPI.cron.deleteJob(id);
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
      await window.electronAPI.cron.clearHistory(id);
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
        const result = await window.electronAPI.cron.editJob(editingCronId, payload);
        if (result.ok) {
          const idx = cronJobs.findIndex(j => j.id === editingCronId);
          if (idx !== -1) cronJobs[idx] = result.job;
          if (typeof showToast === 'function') showToast(window.t ? window.t('toast.cron.saved') : 'Job saved.', 'success');
        }
      } else {
        const newJob = await window.electronAPI.cron.addJob(payload);
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
  if (window.electronAPI?.cron?.onJobExecuted) {
    window.electronAPI.cron.onJobExecuted(({ jobId, entry }) => {
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

// ════════════════════════════════════════════════════════════════
// STARCAPTURE – Screenshot & Screen Recording UI
// ════════════════════════════════════════════════════════════════

(function () {
  // ── State ─────────────────────────────────────────────────────
  let scCurrentDataUrl = null;  // current screenshot dataURL
  let scCurrentType    = 'screenshot'; // 'screenshot' | 'video'
  let scMediaRecorder  = null;
  let scRecChunks      = [];
  let scRecStream      = null;
  let scRecInterval    = null;
  let scRecSeconds     = 0;
  let scRecPaused      = false;
  let scAreaRect       = null;   // for area recording
  let scCropCanvas     = null;
  let scCropCtx        = null;
  let scCropVideo      = null;
  let scCropAnim       = null;

  // ── Helpers ───────────────────────────────────────────────────
  function t(k) { return window.t ? window.t(k) : k.split('.').pop(); }
  function showToastSC(msg, type) { if (typeof showToast === 'function') showToast(msg, type); }

  function scImgSize(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(`${img.naturalWidth} × ${img.naturalHeight} px`);
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  }

  // ── Shortcut customization ────────────────────────────────────
  async function scLoadShortcutsUI() {
    try {
      const s = await window.electronAPI.starCapture.getShortcuts();
      const inp1 = document.getElementById('scKbScreenshot');
      const inp2 = document.getElementById('scKbRecord');
      if (inp1) inp1.value = s.screenshot || '';
      if (inp2) inp2.value = s.record || '';
    } catch {}
  }

  window.scSaveShortcuts = async function () {
    const inp1 = document.getElementById('scKbScreenshot');
    const inp2 = document.getElementById('scKbRecord');
    const shortcuts = { screenshot: inp1?.value?.trim() || '', record: inp2?.value?.trim() || '' };
    try {
      const r = await window.electronAPI.starCapture.setShortcuts(shortcuts);
      const status = document.getElementById('scShortcutStatus');
      if (status) { status.style.display = ''; setTimeout(() => { status.style.display = 'none'; }, 2500); }
      if (!r.ok) showToastSC('Gagal menyimpan pintasan: ' + r.error, 'error');
    } catch (e) { showToastSC('Error: ' + e.message, 'error'); }
  };

  window.scResetShortcuts = async function () {
    const inp1 = document.getElementById('scKbScreenshot');
    const inp2 = document.getElementById('scKbRecord');
    if (inp1) inp1.value = 'CommandOrControl+Shift+S';
    if (inp2) inp2.value = 'CommandOrControl+Shift+R';
    await window.scSaveShortcuts();
  };

  window.scSetShortcutFromInput = function (type) { window.scSaveShortcuts(); };

  // ── Page init ─────────────────────────────────────────────────
  window.scInitPage = function () {
    // Register shortcut listener once
    if (window._scShortcutRegistered) return;
    window._scShortcutRegistered = true;
    if (window.electronAPI?.starCapture?.onShortcut) {
      window.electronAPI.starCapture.onShortcut(mode => {
        // 'screenshot' shortcut is now handled fully in main process (overlay flow)
        // Only record shortcut still goes through renderer
        if (mode === 'record') scStartRecord('full');
      });
    }
    if (window.electronAPI?.starCapture?.onCancelled) {
      window.electronAPI.starCapture.onCancelled(() => {
        scClosePreview();
        showToastSC(t('sc.toast.cancelled'), 'info');
      });
    }
    scLoadShortcutsUI();
  };

  // Register shortcuts immediately on load (not just when page opens)
  document.addEventListener('DOMContentLoaded', () => {
    if (!window._scShortcutRegistered) window.scInitPage();
  });

  // ── Annotation System ─────────────────────────────────────────
  const scAnnotation = (() => {
    let canvas, ctx, baseImg;
    let annotations = [];
    let activeTool  = 'arrow';
    let activeColor = '#ef4444';
    let activeWidth = 2;
    let isDrawing   = false;
    let startX = 0, startY = 0;
    let pencilPoints = [];
    let eventsBound  = false;
    let hasImage     = false;

    function coords(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    }

    function redraw(preview) {
      if (!ctx || !baseImg) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      annotations.forEach(a => drawOne(a));
      if (preview) drawOne(preview);
    }

    function drawOne(a) {
      ctx.save();
      ctx.strokeStyle = a.color; ctx.fillStyle = a.color;
      ctx.lineWidth = a.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      switch (a.type) {
        case 'arrow':   drawArrow(a); break;
        case 'rect':    drawRect(a);  break;
        case 'ellipse': drawEllipse(a); break;
        case 'pencil':  drawPencil(a);  break;
        case 'text':    drawText(a);  break;
        case 'blur':    drawBlur(a);  break;
      }
      ctx.restore();
    }

    function drawArrow({x1,y1,x2,y2,color,width}) {
      const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy);
      if(len<2)return;
      const hl=Math.max(12,width*3.5), ang=Math.atan2(dy,dx);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2-hl*0.55*Math.cos(ang), y2-hl*0.55*Math.sin(ang)); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2,y2);
      ctx.lineTo(x2-hl*Math.cos(ang-Math.PI/6),y2-hl*Math.sin(ang-Math.PI/6));
      ctx.lineTo(x2-hl*Math.cos(ang+Math.PI/6),y2-hl*Math.sin(ang+Math.PI/6));
      ctx.closePath(); ctx.fill();
    }
    function drawRect({x1,y1,x2,y2}) { ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1)); }
    function drawEllipse({x1,y1,x2,y2}) {
      const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;
      if(rx<1||ry<1)return;
      ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,2*Math.PI); ctx.stroke();
    }
    function drawPencil({points}) {
      if(!points||points.length<2)return;
      ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
      ctx.stroke();
    }
    function drawText({x,y,text,color,width}) {
      const fs=Math.max(14,width*6);
      ctx.font=`bold ${fs}px -apple-system,sans-serif`;
      ctx.fillStyle=color;
      ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=3;
      ctx.fillText(text,x,y);
      ctx.shadowBlur=0;
    }
    function drawBlur({x1,y1,x2,y2}) {
      const rx=Math.min(x1,x2),ry=Math.min(y1,y2),rw=Math.abs(x2-x1),rh=Math.abs(y2-y1);
      if(rw<4||rh<4)return;
      // Larger block = stronger pixelation blur
      const BLOCK=Math.max(20,Math.round(Math.min(rw,rh)/5));
      try {
        const imgData=ctx.getImageData(rx,ry,rw,rh), d=imgData.data;
        for(let by=0;by<rh;by+=BLOCK) for(let bx=0;bx<rw;bx+=BLOCK) {
          // Average all pixels in the block
          let tr=0,tg=0,tb=0,cnt=0;
          for(let fy=by;fy<Math.min(by+BLOCK,rh);fy++) for(let fx=bx;fx<Math.min(bx+BLOCK,rw);fx++) {
            const fi=(fy*rw+fx)*4; tr+=d[fi];tg+=d[fi+1];tb+=d[fi+2];cnt++;
          }
          const ar=tr/cnt|0,ag=tg/cnt|0,ab=tb/cnt|0;
          for(let fy=by;fy<Math.min(by+BLOCK,rh);fy++) for(let fx=bx;fx<Math.min(bx+BLOCK,rw);fx++) {
            const fi=(fy*rw+fx)*4; d[fi]=ar;d[fi+1]=ag;d[fi+2]=ab;d[fi+3]=255;
          }
        }
        ctx.putImageData(imgData,rx,ry);
      } catch(e){}
    }

    function showTextInput(screenX, screenY, canvasX, canvasY) {
      const existing = document.getElementById('scTextInputOverlay');
      if(existing) existing.remove();
      const fs = Math.max(16, activeWidth * 7);
      const inp = document.createElement('input');
      inp.id = 'scTextInputOverlay';
      inp.type = 'text';
      inp.placeholder = 'Ketik teks, Enter untuk OK';
      inp.style.cssText = `
        position:fixed;left:${screenX}px;top:${Math.max(10, screenY - fs - 8)}px;
        background:rgba(0,0,0,0.85);color:${activeColor};
        border:2px solid ${activeColor};border-radius:5px;
        padding:5px 10px;font-size:${fs}px;font-weight:700;
        font-family:-apple-system,sans-serif;outline:none;
        min-width:160px;max-width:420px;z-index:99999;
        box-shadow:0 4px 16px rgba(0,0,0,0.6);
      `;
      const commit = () => {
        const txt = inp.value.trim(); inp.remove();
        if(txt) { annotations.push({type:'text',x:canvasX,y:canvasY,text:txt,color:activeColor,width:activeWidth}); redraw(); }
      };
      inp.addEventListener('keydown', e => {
        if(e.key==='Enter') { e.preventDefault(); commit(); }
        if(e.key==='Escape') { e.preventDefault(); inp.remove(); }
        e.stopPropagation();
      });
      inp.addEventListener('blur', commit);
      document.body.appendChild(inp);
      inp.focus();
    }

    function onDown(e) {
      if(!hasImage||e.button!==0)return;
      isDrawing=true;
      const {x,y}=coords(e); startX=x; startY=y;
      if(activeTool==='pencil') pencilPoints=[{x,y}];
      if(activeTool==='text') {
        isDrawing=false;
        showTextInput(e.clientX, e.clientY, x, y);
      }
    }
    function onMove(e) {
      if(!isDrawing)return;
      const {x,y}=coords(e);
      if(activeTool==='pencil'){pencilPoints.push({x,y});redraw({type:'pencil',points:[...pencilPoints],color:activeColor,width:activeWidth});}
      else if(activeTool!=='text'){redraw({type:activeTool,x1:startX,y1:startY,x2:x,y2:y,color:activeColor,width:activeWidth});}
    }
    function onUp(e) {
      if(!isDrawing)return; isDrawing=false;
      const {x,y}=coords(e);
      if(activeTool==='pencil'){
        if(pencilPoints.length>1) annotations.push({type:'pencil',points:[...pencilPoints],color:activeColor,width:activeWidth});
      } else if(activeTool!=='text'){
        if(Math.abs(x-startX)>2||Math.abs(y-startY)>2) annotations.push({type:activeTool,x1:startX,y1:startY,x2:x,y2:y,color:activeColor,width:activeWidth});
      }
      pencilPoints=[]; redraw();
    }

    function bindEvents() {
      if(eventsBound)return; eventsBound=true;
      canvas.addEventListener('mousedown',onDown);
      canvas.addEventListener('mousemove',onMove);
      canvas.addEventListener('mouseup',onUp);
      canvas.addEventListener('mouseleave',onUp);
    }

    return {
      init(dataUrl) {
        canvas=document.getElementById('scAnnotateCanvas');
        if(!canvas)return;
        ctx=canvas.getContext('2d');
        annotations=[]; hasImage=false;
        bindEvents();
        const img=new Image();
        img.onload=()=>{
          canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
          baseImg=img; hasImage=true;
          redraw();
          canvas.style.display='block';
          const tb=document.getElementById('scAnnotateToolbar');
          if(tb) tb.classList.add('visible');
        };
        img.src=dataUrl;
      },
      setTool(tool) {
        activeTool=tool;
        document.querySelectorAll('.sc-annot-tool').forEach(b=>b.classList.remove('active'));
        const id='scTool'+tool.charAt(0).toUpperCase()+tool.slice(1);
        const btn=document.getElementById(id); if(btn) btn.classList.add('active');
        if(canvas) canvas.style.cursor=tool==='text'?'text':tool==='blur'?'cell':'crosshair';
      },
      setColor(color) {
        activeColor=color;
        const dot=document.getElementById('scAnnotColorDot'); if(dot) dot.style.background=color;
      },
      setWidth(w, btn) {
        activeWidth=w;
        document.querySelectorAll('.sc-annot-sz').forEach(b=>b.classList.remove('active'));
        if(btn) btn.classList.add('active');
      },
      undo() { annotations.pop(); redraw(); },
      clear() { annotations=[]; redraw(); },
      getDataUrl() { return canvas&&hasImage?canvas.toDataURL('image/png'):null; },
      reset() {
        hasImage=false; annotations=[];
        if(canvas){ canvas.style.display='none'; canvas.width=0; canvas.height=0; }
        const tb=document.getElementById('scAnnotateToolbar'); if(tb) tb.classList.remove('visible');
      },
    };
  })();
  window.scAnnotation = scAnnotation;

  // ── Screenshot ────────────────────────────────────────────────
  window.scTakeScreenshot = async function (mode) {
    // For area mode: don't show loading — main window is minimized during overlay
    if (mode !== 'area') scShowPreviewLoading(t('sc.preview.title'));
    try {
      let dataUrl = null;
      if (mode === 'full') {
        dataUrl = await window.electronAPI.starCapture.screenshotFull();
      } else if (mode === 'area') {
        dataUrl = await window.electronAPI.starCapture.screenshotArea();
      } else if (mode === 'window') {
        dataUrl = await window.electronAPI.starCapture.screenshotWindow();
      }
      if (!dataUrl) { scClosePreview(); return; }
      await scShowScreenshotPreview(dataUrl);
    } catch (e) {
      scClosePreview();
      showToastSC(t('sc.toast.capture_error'), 'error');
    }
  };

  async function scShowScreenshotPreview(dataUrl) {
    scCurrentDataUrl = dataUrl;
    scCurrentType    = 'screenshot';
    const size = await scImgSize(dataUrl);
    const vid     = document.getElementById('scPreviewVideo');
    const loading = document.getElementById('scPreviewLoading');
    const meta    = document.getElementById('scPreviewMeta');
    const icon    = document.getElementById('scPreviewIcon');
    const title   = document.getElementById('scPreviewTitle');
    const btnCopy = document.getElementById('scBtnCopy');
    const btnBoth = document.getElementById('scBtnBoth');

    if (vid)     vid.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (meta)    meta.textContent = size;
    if (icon)    { icon.className = 'bi bi-image'; icon.style.color = '#7c6fe0'; }
    if (title)   title.textContent = t('sc.preview.title');
    if (btnCopy) btnCopy.style.display = '';
    if (btnBoth) btnBoth.style.display = '';

    scAnnotation.init(dataUrl);

    const overlay = document.getElementById('scPreviewOverlay');
    if (overlay) overlay.classList.add('open');
  }

  // ── Copy / Save ───────────────────────────────────────────────
  function scGetCurrentDataUrl() {
    if (scCurrentType === 'screenshot') return scAnnotation.getDataUrl() || scCurrentDataUrl;
    return scCurrentDataUrl;
  }

  window.scCopyToClipboard = async function () {
    const dataUrl = scGetCurrentDataUrl();
    if (!dataUrl) return;
    try {
      const result = await window.electronAPI.starCapture.copyImage(dataUrl);
      if (result.ok) showToastSC(t('sc.toast.copied'), 'success');
      else showToastSC(t('sc.toast.copy_error'), 'error');
    } catch { showToastSC(t('sc.toast.copy_error'), 'error'); }
  };

  window.scSaveFile = async function () {
    if (scCurrentType === 'screenshot') {
      await scSaveScreenshot();
    } else {
      await scSaveVideoFile();
    }
  };

  window.scSaveBoth = async function () {
    await scCopyToClipboard();
    await scSaveFile();
  };

  async function scSaveScreenshot() {
    const dataUrl = scGetCurrentDataUrl();
    if (!dataUrl) return;
    try {
      const result = await window.electronAPI.starCapture.saveImage({
        dataUrl,
        defaultName: `screenshot-${Date.now()}.png`,
      });
      if (result.ok) {
        showToastSC(t('sc.toast.saved') + (result.filePath ? ': ' + result.filePath.split(/[\\/]/).pop() : ''), 'success');
        scClosePreview();
      }
    } catch { showToastSC(t('sc.toast.save_error'), 'error'); }
  }

  async function scSaveVideoFile() {
    if (!scRecChunks.length) return;
    try {
      const blob = new Blob(scRecChunks, { type: 'video/webm' });
      const buffer = await blob.arrayBuffer();
      const result = await window.electronAPI.starCapture.saveVideo({
        buffer: new Uint8Array(buffer),
        format: 'webm',
        defaultName: `recording-${Date.now()}.webm`,
      });
      if (result.ok) {
        showToastSC(t('sc.toast.video_saved') + (result.filePath ? ': ' + result.filePath.split(/[\\/]/).pop() : ''), 'success');
        scClosePreview();
      }
    } catch (e) { showToastSC(t('sc.toast.save_error'), 'error'); }
  }

  // ── Preview helpers ───────────────────────────────────────────
  function scShowPreviewLoading(title) {
    const overlay  = document.getElementById('scPreviewOverlay');
    const loading  = document.getElementById('scPreviewLoading');
    const canvas   = document.getElementById('scAnnotateCanvas');
    const vid      = document.getElementById('scPreviewVideo');
    const titleEl  = document.getElementById('scPreviewTitle');
    if (loading) loading.style.display = '';
    if (canvas) canvas.style.display = 'none';
    if (vid)    vid.style.display = 'none';
    if (titleEl && title) titleEl.textContent = title;
    if (overlay) overlay.classList.add('open');
  }

  window.scClosePreview = function () {
    const overlay = document.getElementById('scPreviewOverlay');
    if (overlay) overlay.classList.remove('open');
    const vid = document.getElementById('scPreviewVideo');
    if (vid) { vid.src = ''; vid.style.display = 'none'; }
    scAnnotation.reset();
    scCurrentDataUrl = null;
  };

  // Escape to close preview
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('scPreviewOverlay');
      if (overlay?.classList.contains('open')) { scClosePreview(); e.stopPropagation(); }
    }
  });

  // ── Screen Recording ──────────────────────────────────────────
  window.scStartRecord = async function (mode) {
    if (scMediaRecorder && scMediaRecorder.state !== 'inactive') return;
    scRecChunks = [];
    scAreaRect  = null;

    try {
      let sourceId, constraints;

      if (mode === 'area') {
        const rect = await window.electronAPI.starCapture.getAreaForRecord();
        if (!rect) return;
        scAreaRect = rect;
      }

      // Get screen source
      const sources = await window.electronAPI.starCapture.getScreenSources();
      if (!sources || !sources.length) { showToastSC(t('sc.toast.no_source'), 'error'); return; }
      sourceId = sources[0].id;

      // getUserMedia stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1, maxWidth: 7680,
            minHeight: 1, maxHeight: 4320,
          }
        }
      });

      let recordStream = stream;

      // If area mode — crop via canvas
      if (scAreaRect) {
        const { displayX: x, displayY: y, displayW: w, displayH: h } = scAreaRect;
        scCropVideo = document.createElement('video');
        scCropVideo.srcObject = stream;
        scCropVideo.muted = true;
        await scCropVideo.play();

        scCropCanvas = document.createElement('canvas');
        scCropCanvas.width  = w;
        scCropCanvas.height = h;
        scCropCtx = scCropCanvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        function drawFrame() {
          if (!scCropCtx || !scCropVideo) return;
          scCropCtx.drawImage(scCropVideo, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w, h);
          scCropAnim = requestAnimationFrame(drawFrame);
        }
        drawFrame();
        recordStream = scCropCanvas.captureStream(30);
      }

      scRecStream = stream;
      scMediaRecorder = new MediaRecorder(recordStream, { mimeType: 'video/webm;codecs=vp8' });
      scMediaRecorder.ondataavailable = e => { if (e.data.size > 0) scRecChunks.push(e.data); };
      scMediaRecorder.onstop = scOnRecordStop;
      scMediaRecorder.start(500);

      scRecSeconds = 0;
      scRecPaused  = false;
      scRecInterval = setInterval(() => {
        if (!scRecPaused) {
          scRecSeconds++;
          const m = String(Math.floor(scRecSeconds / 60)).padStart(2, '0');
          const s = String(scRecSeconds % 60).padStart(2, '0');
          const timeEl = document.getElementById('scRecordTime');
          if (timeEl) timeEl.textContent = `${m}:${s}`;
        }
      }, 1000);

      const bar = document.getElementById('scRecordBar');
      if (bar) bar.classList.add('open');

      showToastSC(t('sc.toast.recording_started'), 'success');
    } catch (e) {
      console.error('StarCapture recording error:', e);
      showToastSC(t('sc.toast.record_error') + ': ' + (e.message || e), 'error');
    }
  };

  window.scPauseRecord = function () {
    if (!scMediaRecorder) return;
    const btn = document.getElementById('scBtnPause');
    if (scRecPaused) {
      scMediaRecorder.resume();
      scRecPaused = false;
      if (btn) btn.textContent = t('sc.rec.pause');
    } else {
      scMediaRecorder.pause();
      scRecPaused = true;
      if (btn) btn.textContent = t('sc.rec.resume');
    }
  };

  window.scStopRecord = function () {
    if (!scMediaRecorder) return;
    clearInterval(scRecInterval);
    scMediaRecorder.stop();
    const bar = document.getElementById('scRecordBar');
    if (bar) bar.classList.remove('open');
  };

  async function scOnRecordStop() {
    // Clean up area crop animation
    if (scCropAnim) { cancelAnimationFrame(scCropAnim); scCropAnim = null; }
    if (scCropVideo) { scCropVideo.pause(); scCropVideo.srcObject = null; scCropVideo = null; }
    scCropCanvas = null; scCropCtx = null;
    // Stop original stream
    if (scRecStream) { scRecStream.getTracks().forEach(t => t.stop()); scRecStream = null; }

    if (!scRecChunks.length) return;
    scCurrentType = 'video';
    scCurrentDataUrl = null;

    const blob = new Blob(scRecChunks, { type: 'video/webm' });
    const url  = URL.createObjectURL(blob);

    const vid     = document.getElementById('scPreviewVideo');
    const canvas  = document.getElementById('scAnnotateCanvas');
    const loading = document.getElementById('scPreviewLoading');
    const meta    = document.getElementById('scPreviewMeta');
    const icon    = document.getElementById('scPreviewIcon');
    const title   = document.getElementById('scPreviewTitle');
    const btnCopy = document.getElementById('scBtnCopy');
    const btnBoth = document.getElementById('scBtnBoth');

    if (vid)    { vid.src = url; vid.style.display = 'block'; }
    if (canvas) canvas.style.display = 'none';
    if (loading) loading.style.display = 'none';
    const dur = `${String(Math.floor(scRecSeconds/60)).padStart(2,'0')}:${String(scRecSeconds%60).padStart(2,'0')}`;
    if (meta) meta.textContent = `WebM · ${dur}`;
    if (icon) { icon.className = 'bi bi-camera-video'; icon.style.color = '#ef4444'; }
    if (title) title.textContent = t('sc.rec.preview_title');
    if (btnCopy) btnCopy.style.display = 'none';
    if (btnBoth) btnBoth.style.display = 'none';

    const overlay = document.getElementById('scPreviewOverlay');
    if (overlay) overlay.classList.add('open');

    showToastSC(t('sc.toast.recording_done'), 'success');
  }
})();
