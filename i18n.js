/**
 * StarBox i18n – Lightweight translation system
 * Supports: English (en) and Indonesian (id)
 * Default: English
 */
(function () {
  const LANG_KEY = 'starbox-lang';

  const translations = {
    en: {
      // ── Navbar ─────────────────────────────────────────────
      'auth.signin': 'Sign In / Register',
      'nav.theme': 'Theme',
      'nav.theme.select': 'Select StarBox Theme',
      'nav.donate': 'Donate',
      'nav.sidebar.collapse': 'Collapse / Expand Sidebar',
      'nav.remote.title': 'Remote Control – click to open',
      'nav.remote': 'Remote',
      'nav.tagline': 'All Your Workspaces, One Place',
      'nav.mode_simple': 'Simple',
      'nav.mode_pro': 'Pro',

      // ── Sidebar ────────────────────────────────────────────
      'sidebar.web_emulator': 'Web Emulator',
      'sidebar.whatsapp_gateway': 'WhatsApp Gateway',
      'sidebar.support_us': 'Support Us',
      'sidebar.logs': 'Logs',
      'sidebar.modules': 'Modules',
      'modules.title': 'Modules',
      'modules.desc': 'Turn on only the features you need. Every module lists the permissions it uses.',
      'modules.restart_hint': 'Restart StarBox to apply module changes.',
      'modules.restart_now': 'Restart now',
      'sidebar.about': 'About',

      // ── Toolbar – Web Emulator ─────────────────────────────
      'toolbar.select_all': 'Select All',
      'toolbar.add_device': 'Add Device',
      'toolbar.actions': 'Actions',
      'toolbar.run_all': 'Run All Device',
      'toolbar.run_selected': 'Run Selected',
      'toolbar.restart_selected': 'Restart Selected',
      'toolbar.restart_all': 'Restart All',
      'toolbar.stop_selected': 'Stop Selected',
      'toolbar.stop_all': 'Stop All',
      'toolbar.remote_control': 'Remote Control',
      'toolbar.layout': 'Layout:',
      'search.placeholder': 'Search device name, service, or URL...',

      // ── Toolbar – Android / iOS ────────────────────────────

      // ── Toolbar – WA Gateway ──────────────────────────────
      'toolbar.add_device_wa': 'Add WA Device',
      'toolbar.fix_wa': 'Fix WA Gateway',
      'wa.gateway.desc': 'Manage multi-device WhatsApp with auto-reply and scheduling',

      // ── Version Banner ────────────────────────────────────
      'version.new_available': 'New version available',
      'version.new_desc': 'Get the latest feature improvements and bug fixes.',
      'version.download': 'Download & Install',
      'version.detail': 'Detail',
      'version.close': 'Close',
      'version.preparing': 'Preparing download...',

      // ── scrcpy Notice ─────────────────────────────────────

      // ── Ads ───────────────────────────────────────────────
      'ads.eyebrow': 'Featured recommendations',
      'ads.hide': 'Hide ads',
      'ads.loading': 'Loading recommendations...',

      // ── Dialogs – Auth ────────────────────────────────────
      'dialog.logout.title': 'Sign out from account?',
      'dialog.logout.text': 'You will return to guest mode.',
      'dialog.logout.confirm': 'Sign Out',
      'dialog.logout.cancel': 'Cancel',

      // ── Dialogs – Device ──────────────────────────────────
      'dialog.delete_device.title': 'Are you sure?',
      'dialog.delete_device.text': 'Device will be permanently deleted and cannot be recovered!',
      'dialog.delete_device.confirm': 'Yes, Delete',
      'dialog.delete_device.cancel': 'Cancel',

      // ── Dialogs – Android Emulator ────────────────────────

      // ── Toast messages ────────────────────────────────────
      'toast.logout.success': 'Successfully logged out.',
      'toast.logout.error': 'Failed to logout.',
      'toast.register.success': 'Registration successful.',
      'toast.register.failed': 'Registration failed.',
      'toast.register.error': 'An error occurred during registration.',
      'toast.device.deleted': 'Device deleted successfully.',
      'toast.device.delete_error': 'Failed to delete device.',
      'toast.device.comm_error': 'Communication error when trying to delete device.',


      // ── Resource Monitor page ─────────────────────────────

      // ── Add Device modal ──────────────────────────────────
      'modal.add.title': 'Add New Device',
      'form.device_name': 'Device Name',
      'form.device_name.placeholder': 'E.g.: Personal WA, Telegram Bot',
      'form.service_type': 'Service Type',
      'form.service_subtitle': 'Select popular services to boost your productivity.',
      'form.service_placeholder': 'Search WhatsApp, Tokopedia, Slack, etc...',
      'form.service_not_selected': 'No service selected',
      'form.service_tap': 'Tap a service from the list below.',
      'form.chrome_native': 'Use native Chrome (separate profile)',
      'form.chrome_native_hint': 'Each device opens Chrome with a unique user data dir to keep Google logins safe.',
      'form.autosender': 'Enable Auto Sender (WhatsApp)',
      'form.pending_url': 'Pending Message Source URL',
      'form.callback_url': 'Callback URL (optional)',
      'form.save_device': 'Save Device',
      'form.website_url': 'Website URL',

      // ── Edit Device modal ─────────────────────────────────
      'modal.edit.title': 'Edit Device',
      'form.save': 'Save',

      // ── Add Android modal ─────────────────────────────────
      'modal.add_android.title': 'Add Android',
      'form.select_service': '-- Select Service --',

      // ── Auth modal ────────────────────────────────────────
      'auth.modal.title': 'Access Starbox Account',
      'auth.modal.subtitle': 'Sign in to increase device quota according to your account package.',
      'auth.tab.login': 'Login',
      'auth.tab.register': 'Register',
      'auth.form.email': 'Email',
      'auth.form.password': 'Password',
      'auth.form.remember': 'Remember me',
      'auth.login.btn': 'Sign In',
      'auth.form.fullname': 'Full Name',
      'auth.form.phone_code': 'Country Code',
      'auth.form.phone': 'Phone Number',
      'auth.form.pass_placeholder': 'Min. 6 characters',
      'auth.register.btn': 'Register',

      // ── Account modal ─────────────────────────────────────
      'account.title': 'Account Details',
      'account.name': 'Name',
      'account.email': 'Email',
      'account.phone': 'Phone',
      'account.package': 'Package',
      'account.limit': 'Limit per service',
      'account.expiry': 'Active period',
      'account.tip': 'If you have upgraded your package but the information has not changed, please sign out and sign back in to refresh the data.',
      'account.check_package': 'Check Package',
      'account.close': 'Close',
      'account.logout': 'Logout',

      // ── Package / Ads modals ──────────────────────────────
      'package.title': 'Your Package Details',
      'package.loading': 'Loading package info...',
      'package.close': 'Close',
      'ads.modal.title': 'Remove Ads',
      'ads.modal.desc': 'Login and subscribe to a package to remove ads from the dashboard.',
      'ads.modal.loading': 'Loading packages...',
      'ads.login_subscribe': 'Login / Subscribe',

      // ── Logs modal ────────────────────────────────────────
      'logs.title': 'StarBox Logs',
      'logs.desc': 'Logs for debugging — created automatically when the app runs',
      'logs.loading': 'Loading logs...',

      // ── Support modal ─────────────────────────────────────
      'support.title': 'Support StarBox',
      'support.subtitle': 'Help us keep growing',
      'support.badge': 'Support Development',
      'support.intro': 'If StarBox helps your workflow, consider supporting development. Every contribution keeps the project alive and growing. Thank you! ❤️',
      'support.intro_professional': 'StarBox is built to simplify real operational work—from device management, automation, and remote access to daily technical workflows. Your support helps keep StarBox stable, actively maintained, and continuously improved with better features, performance, and long-term reliability.',
      'support.subcopy': 'Every contribution directly supports development time, infrastructure costs, bug fixing, testing, and future product improvements so StarBox can continue growing professionally for everyone.',
      'support.trakteer.subtitle': 'Local support in Indonesia via Trakteer / QRIS',
      'support.paypal.subtitle': 'Direct transfer via PayPal — international friendly',
      'support.bmc.subtitle': 'Support with coffee for development time',
      'support.open': 'Open',

      // ── About modal ───────────────────────────────────────
      'about.title': 'About StarBox',

      // ── WA Gateway modal ──────────────────────────────────
      'wa.modal.add.title': 'Add WhatsApp Gateway Device',
      'wa.modal.device_name': 'Device Name',
      'wa.modal.add_scan': 'Add & Scan QR',
      'wa.modal.cancel': 'Cancel',


      // ── Cron Job Manager ──────────────────────────────────
      'toast.cron.saved': 'Job saved.',
      'toast.cron.save_error': 'Failed to save job.',
      'toast.cron.deleted': 'Job deleted.',
      'toast.cron.delete_error': 'Failed to delete job.',
      'toast.cron.run_success': 'Job executed successfully.',
      'toast.cron.run_failed': 'Job executed but returned an error.',
      'toast.cron.run_error': 'Failed to run job.',
      'toast.cron.history_cleared': 'History cleared.',
      'dialog.delete_cron.title': 'Delete this job?',
      'dialog.delete_cron.text': 'Execution history will also be deleted.',
      'dialog.delete_cron.confirm': 'Yes, Delete',
      'dialog.delete_cron.cancel': 'Cancel',

      // ── Misc ──────────────────────────────────────────────
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.edit': 'Edit',
      'common.delete': 'Delete',
      'common.close': 'Close',
      'common.loading': 'Loading...',
      'form.register.btn': 'Register',
      'form.login.btn': 'Sign In',
    },

    id: {
      // ── Navbar ─────────────────────────────────────────────
      'auth.signin': 'Masuk / Daftar',
      'nav.theme': 'Tema',
      'nav.theme.select': 'Pilih Tema StarBox',
      'nav.donate': 'Donasi',
      'nav.sidebar.collapse': 'Perkecil / Perlebar Sidebar',
      'nav.remote.title': 'Remote Control – klik untuk buka',
      'nav.remote': 'Remote',
      'nav.tagline': 'Semua Workspace-mu, Satu Tempat',
      'nav.mode_simple': 'Simple',
      'nav.mode_pro': 'Pro',

      // ── Sidebar ────────────────────────────────────────────
      'sidebar.web_emulator': 'Web Emulator',
      'sidebar.whatsapp_gateway': 'WhatsApp Gateway',
      'sidebar.support_us': 'Support Us',
      'sidebar.logs': 'Log',
      'sidebar.modules': 'Modul',
      'modules.title': 'Modul',
      'modules.desc': 'Aktifkan hanya fitur yang kamu butuhkan. Setiap modul menampilkan izin yang dipakainya.',
      'modules.restart_hint': 'Restart StarBox untuk menerapkan perubahan modul.',
      'modules.restart_now': 'Restart sekarang',
      'sidebar.about': 'Tentang',

      // ── Toolbar – Web Emulator ─────────────────────────────
      'toolbar.select_all': 'Pilih Semua',
      'toolbar.add_device': 'Tambah Device',
      'toolbar.actions': 'Actions',
      'toolbar.run_all': 'Run All Device',
      'toolbar.run_selected': 'Run Selected',
      'toolbar.restart_selected': 'Restart Selected',
      'toolbar.restart_all': 'Restart All',
      'toolbar.stop_selected': 'Stop Selected',
      'toolbar.stop_all': 'Stop All',
      'toolbar.remote_control': 'Remote Control',
      'toolbar.layout': 'Layout:',
      'search.placeholder': 'Cari nama device, layanan, atau URL...',

      // ── Toolbar – Android / iOS ────────────────────────────

      // ── Toolbar – WA Gateway ──────────────────────────────
      'toolbar.add_device_wa': 'Tambah Device WA',
      'toolbar.fix_wa': 'Fix WA Gateway',
      'wa.gateway.desc': 'Kelola multi-device WhatsApp dengan auto-reply dan scheduling',

      // ── Version Banner ────────────────────────────────────
      'version.new_available': 'Versi baru tersedia',
      'version.new_desc': 'Dapatkan peningkatan fitur dan perbaikan bug terbaru.',
      'version.download': 'Download & Install',
      'version.detail': 'Detail',
      'version.close': 'Tutup',
      'version.preparing': 'Menyiapkan unduhan...',

      // ── scrcpy Notice ─────────────────────────────────────

      // ── Ads ───────────────────────────────────────────────
      'ads.eyebrow': 'Rekomendasi pilihan',
      'ads.hide': 'Sembunyikan iklan',
      'ads.loading': 'Memuat rekomendasi...',

      // ── Dialogs – Auth ────────────────────────────────────
      'dialog.logout.title': 'Keluar dari akun?',
      'dialog.logout.text': 'Anda akan kembali ke mode tamu.',
      'dialog.logout.confirm': 'Keluar',
      'dialog.logout.cancel': 'Batal',

      // ── Dialogs – Device ──────────────────────────────────
      'dialog.delete_device.title': 'Anda Yakin?',
      'dialog.delete_device.text': 'Device akan dihapus secara permanen dan tidak bisa dikembalikan!',
      'dialog.delete_device.confirm': 'Ya, Hapus',
      'dialog.delete_device.cancel': 'Batal',

      // ── Dialogs – Android Emulator ────────────────────────

      // ── Toast messages ────────────────────────────────────
      'toast.logout.success': 'Berhasil logout.',
      'toast.logout.error': 'Gagal logout.',
      'toast.register.success': 'Registrasi berhasil.',
      'toast.register.failed': 'Registrasi gagal.',
      'toast.register.error': 'Terjadi kesalahan saat registrasi.',
      'toast.device.deleted': 'Device berhasil dihapus.',
      'toast.device.delete_error': 'Gagal menghapus device.',
      'toast.device.comm_error': 'Terjadi kesalahan komunikasi saat mencoba menghapus device.',


      // ── Resource Monitor page ─────────────────────────────

      // ── Add Device modal ──────────────────────────────────
      'modal.add.title': 'Tambah Device Baru',
      'form.device_name': 'Nama Device',
      'form.device_name.placeholder': 'Misal: WA Personal, Telegram Bot',
      'form.service_type': 'Jenis Layanan',
      'form.service_subtitle': 'Pilih layanan populer untuk membantu produktivitas Anda.',
      'form.service_placeholder': 'Cari WhatsApp, Tokopedia, Slack, dll...',
      'form.service_not_selected': 'Belum memilih layanan',
      'form.service_tap': 'Tap salah satu layanan di daftar di bawah.',
      'form.chrome_native': 'Gunakan Chrome asli (profil terpisah)',
      'form.chrome_native_hint': 'Setiap device membuka Chrome dengan user data dir unik agar login Google tetap aman.',
      'form.autosender': 'Aktifkan Auto Sender (WhatsApp)',
      'form.pending_url': 'URL Sumber Pesan Pending',
      'form.callback_url': 'URL Callback (opsional)',
      'form.save_device': 'Simpan Device',
      'form.website_url': 'URL Website',

      // ── Edit Device modal ─────────────────────────────────
      'modal.edit.title': 'Edit Device',
      'form.save': 'Simpan',

      // ── Add Android modal ─────────────────────────────────
      'modal.add_android.title': 'Tambah Android',
      'form.select_service': '-- Pilih Layanan --',

      // ── Auth modal ────────────────────────────────────────
      'auth.modal.title': 'Akses Akun Starbox',
      'auth.modal.subtitle': 'Masuk untuk menambah kuota device sesuai paket akun Anda.',
      'auth.tab.login': 'Login',
      'auth.tab.register': 'Register',
      'auth.form.email': 'Email',
      'auth.form.password': 'Password',
      'auth.form.remember': 'Ingat saya',
      'auth.login.btn': 'Masuk',
      'auth.form.fullname': 'Nama Lengkap',
      'auth.form.phone_code': 'Kode Negara',
      'auth.form.phone': 'Nomor Telepon',
      'auth.form.pass_placeholder': 'Minimal 6 karakter',
      'auth.register.btn': 'Daftar',

      // ── Account modal ─────────────────────────────────────
      'account.title': 'Detail Akun',
      'account.name': 'Nama',
      'account.email': 'Email',
      'account.phone': 'Telepon',
      'account.package': 'Paket',
      'account.limit': 'Limit per layanan',
      'account.expiry': 'Masa aktif',
      'account.tip': 'Jika Anda sudah upgrade paket namun informasi belum berubah, silakan keluar lalu login kembali agar data ter-refresh.',
      'account.check_package': 'Cek Paket',
      'account.close': 'Tutup',
      'account.logout': 'Logout',

      // ── Package / Ads modals ──────────────────────────────
      'package.title': 'Detail Paket Anda',
      'package.loading': 'Memuat informasi paket...',
      'package.close': 'Tutup',
      'ads.modal.title': 'Hilangkan Iklan',
      'ads.modal.desc': 'Login dan berlangganan paket untuk menghilangkan iklan di dashboard.',
      'ads.modal.loading': 'Memuat paket...',
      'ads.login_subscribe': 'Login / Berlangganan',

      // ── Logs modal ────────────────────────────────────────
      'logs.title': 'Log StarBox',
      'logs.desc': 'Log untuk debug — dibuat otomatis saat aplikasi berjalan',
      'logs.loading': 'Memuat log...',

      // ── Support modal ─────────────────────────────────────
      'support.title': 'Support StarBox',
      'support.subtitle': 'Bantu kami terus berkembang',
      'support.badge': 'Dukung Pengembangan',
      'support.intro': 'Kalau StarBox membantu alur kerja Anda, pertimbangkan untuk mendukung pengembangannya. Setiap kontribusi membantu project ini terus hidup dan berkembang. Terima kasih! ❤️',
      'support.intro_professional': 'StarBox dibangun untuk menyederhanakan pekerjaan operasional nyata—mulai dari manajemen device, otomasi, remote access, hingga alur kerja teknis harian. Dukungan Anda membantu menjaga StarBox tetap stabil, aktif dikembangkan, dan terus ditingkatkan dengan fitur, performa, serta keandalan jangka panjang yang lebih baik.',
      'support.subcopy': 'Setiap kontribusi secara langsung membantu waktu pengembangan, biaya infrastruktur, perbaikan bug, pengujian, dan peningkatan produk ke depan agar StarBox bisa terus berkembang secara profesional untuk semua pengguna.',
      'support.trakteer.subtitle': 'Dukungan lokal Indonesia via Trakteer / QRIS',
      'support.paypal.subtitle': 'Transfer langsung via PayPal — ramah untuk internasional',
      'support.bmc.subtitle': 'Dukung pengembangan dengan traktir kopi',
      'support.open': 'Buka',

      // ── About modal ───────────────────────────────────────
      'about.title': 'Tentang StarBox',

      // ── WA Gateway modal ──────────────────────────────────
      'wa.modal.add.title': 'Tambah Device WhatsApp Gateway',
      'wa.modal.device_name': 'Nama Device',
      'wa.modal.add_scan': 'Tambah & Scan QR',
      'wa.modal.cancel': 'Batal',


      // ── Cron Job Manager ──────────────────────────────────
      'toast.cron.saved': 'Job tersimpan.',
      'toast.cron.save_error': 'Gagal menyimpan job.',
      'toast.cron.deleted': 'Job dihapus.',
      'toast.cron.delete_error': 'Gagal menghapus job.',
      'toast.cron.run_success': 'Job berhasil dieksekusi.',
      'toast.cron.run_failed': 'Job dieksekusi tapi mengembalikan error.',
      'toast.cron.run_error': 'Gagal menjalankan job.',
      'toast.cron.history_cleared': 'Riwayat dihapus.',
      'dialog.delete_cron.title': 'Hapus job ini?',
      'dialog.delete_cron.text': 'Riwayat eksekusi juga akan dihapus.',
      'dialog.delete_cron.confirm': 'Ya, Hapus',
      'dialog.delete_cron.cancel': 'Batal',

      // ── Misc ──────────────────────────────────────────────
      'common.cancel': 'Batal',
      'common.save': 'Simpan',
      'common.edit': 'Edit',
      'common.delete': 'Hapus',
      'common.close': 'Tutup',
      'common.loading': 'Memuat...',
      'form.register.btn': 'Daftar',
      'form.login.btn': 'Masuk',
    },
  };

  // ── Core API ────────────────────────────────────────────────

  let currentLang = localStorage.getItem(LANG_KEY) || 'en';

  /** Translate a key to the current language */
  window.t = function (key) {
    return translations[currentLang]?.[key] ?? translations['en']?.[key] ?? key;
  };

  /** Get the active language code */
  window.getLang = function () {
    return currentLang;
  };

  /** Switch language, persist, and re-apply all translations */
  window.setLang = function (lang) {
    if (!translations[lang] || lang === currentLang) {
      closeLangDropdown();
      return;
    }
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
    closeLangDropdown();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  };

  /** Force-apply all data-i18n* attributes across the page */
  window.applyI18n = applyTranslations;

  /** Merge translations shipped by a module (key yang sudah ada tidak ditimpa) */
  window.registerTranslations = function (lang, dict) {
    if (!translations[lang] || !dict || typeof dict !== 'object') return;
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value === 'string' && !(key in translations[lang])) translations[lang][key] = value;
    }
  };

  // ── DOM application ─────────────────────────────────────────

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const text = window.t(key);
      if (text && text !== key) el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = window.t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.title = window.t(key);
    });
    syncLangButton();
  }

  function syncLangButton() {
    const flagEl = document.getElementById('langFlag');
    const labelEl = document.getElementById('langLabel');
    if (flagEl) flagEl.textContent = currentLang === 'en' ? '🇺🇸' : '🇮🇩';
    if (labelEl) labelEl.textContent = currentLang === 'en' ? 'EN' : 'ID';
    document.querySelectorAll('.lang-option').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.lang === currentLang);
    });
  }

  // ── Dropdown toggle ─────────────────────────────────────────

  function closeLangDropdown() {
    const panel = document.getElementById('langSelectorPanel');
    if (panel) panel.setAttribute('data-visible', 'false');
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTranslations();

    const toggle = document.getElementById('langDropdownToggle');
    const panel = document.getElementById('langSelectorPanel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const visible = panel.getAttribute('data-visible') === 'true';
      panel.setAttribute('data-visible', visible ? 'false' : 'true');
      // close theme dropdown if open
      const themePanel = document.getElementById('themeSelector');
      if (themePanel) themePanel.setAttribute('data-visible', 'false');
    });

    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !panel.contains(e.target)) {
        closeLangDropdown();
      }
    });
  });
})();
