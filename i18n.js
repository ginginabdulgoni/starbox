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
      'sidebar.android_ios': 'Android / iOS',
      'sidebar.resource_monitor': 'Resource Monitor',
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
      'toolbar.add_device_android': 'Add Device',
      'toolbar.ios_simulator': 'iOS Simulator',
      'toolbar.adb_tutorial': 'ADB Tutorial',
      'toolbar.adb_tutorial.title': 'View guide for Developer Options, USB Debugging, and ADB Wireless',
      'toolbar.fix_android': 'Fix Android',
      'toolbar.fix_android.title': 'Fix busy ADB or Android emulator errors',

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
      'android.scrcpy_required': 'Phone screen display requires scrcpy.',
      'android.scrcpy_not_detected': 'scrcpy not detected. Click the button to install automatically via Homebrew/Chocolatey.',
      'android.install_scrcpy': 'Auto install scrcpy',

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
      'dialog.delete_emulator.title': 'Delete emulator?',
      'dialog.delete_emulator.confirm': 'Yes, delete',
      'dialog.delete_emulator.cancel': 'Cancel',

      // ── Toast messages ────────────────────────────────────
      'toast.logout.success': 'Successfully logged out.',
      'toast.logout.error': 'Failed to logout.',
      'toast.register.success': 'Registration successful.',
      'toast.register.failed': 'Registration failed.',
      'toast.register.error': 'An error occurred during registration.',
      'toast.device.deleted': 'Device deleted successfully.',
      'toast.device.delete_error': 'Failed to delete device.',
      'toast.device.comm_error': 'Communication error when trying to delete device.',
      'toast.emulator.deleted': 'Emulator deleted.',
      'toast.emulator.delete_error': 'Delete error: ',


      // ── Resource Monitor page ─────────────────────────────
      'rm.waiting': 'Waiting for data...',
      'rm.refresh': 'Refresh',
      'rm.active_services': 'Active StarBox Services',
      'rm.system_procs': 'System Processes',
      'rm.proc.search': 'Search processes...',
      'rm.loading_procs': 'Loading processes...',
      'rm.system_info': 'System Information',
      'rm.info.platform': 'Platform',
      'rm.info.arch': 'Architecture',
      'rm.info.cores': 'CPU Cores',
      'rm.info.model': 'CPU Model',
      'rm.info.hostname': 'Hostname',
      'rm.info.heap_used': 'Heap Used',
      'rm.info.heap_total': 'Heap Total',
      'rm.info.uptime': 'System Uptime',

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

      // ── StarCapture ───────────────────────────────────────
      'sidebar.starcapture': 'StarCapture',
      'sc.title': 'StarCapture',
      'sc.subtitle': 'Screenshot & screen recording — professional capture tool',
      'sc.shortcuts': 'Keyboard Shortcuts',
      'sc.shortcut.screenshot': 'Screenshot',
      'sc.shortcut.record': 'Screen Record',
      'sc.shortcut.cancel': 'Cancel capture',
      'sc.shortcut.confirm': 'Confirm selection',
      'sc.section.screenshot': 'Screenshot',
      'sc.section.record': 'Screen Recording',
      'sc.ss.full': 'Full Screen',
      'sc.ss.full_desc': 'Capture the entire screen',
      'sc.ss.area': 'Selected Area',
      'sc.ss.area_desc': 'Drag to select a region',
      'sc.ss.window': 'Active Window',
      'sc.ss.window_desc': 'Capture the active window',
      'sc.rec.full': 'Full Screen',
      'sc.rec.full_desc': 'Record the entire screen',
      'sc.rec.area': 'Selected Area',
      'sc.rec.area_desc': 'Record a selected region',
      'sc.rec.pause': 'Pause',
      'sc.rec.resume': 'Resume',
      'sc.rec.stop': '■ Stop',
      'sc.rec.preview_title': 'Recording Preview',
      'sc.gallery': 'Recent Captures',
      'sc.preview.title': 'Screenshot Preview',
      'sc.preview.loading': 'Capturing...',
      'sc.preview.copy': 'Copy to Clipboard',
      'sc.preview.save': 'Save to File',
      'sc.preview.both': 'Copy & Save',
      'sc.preview.discard': 'Discard',
      'sc.toast.copied': 'Copied to clipboard.',
      'sc.toast.copy_error': 'Failed to copy to clipboard.',
      'sc.toast.saved': 'Screenshot saved',
      'sc.toast.video_saved': 'Recording saved',
      'sc.toast.save_error': 'Failed to save file.',
      'sc.toast.capture_error': 'Failed to capture screen.',
      'sc.toast.cancelled': 'Capture cancelled.',
      'sc.toast.recording_started': 'Recording started.',
      'sc.toast.recording_done': 'Recording complete.',
      'sc.toast.record_error': 'Recording failed',
      'sc.toast.no_source': 'No screen source found.',

      // ── Cron Job Manager ──────────────────────────────────
      'sidebar.cron': 'Schedule',
      'cron.subtitle': 'Manage URL-based scheduled tasks (cron jobs)',
      'cron.add_job': 'Add Job',
      'cron.empty': 'No scheduled jobs yet',
      'cron.empty_desc': 'Click "Add Job" to create your first cron task.',
      'cron.loading': 'Loading jobs...',
      'cron.enabled': 'Active',
      'cron.disabled': 'Paused',
      'cron.last_run': 'Last run',
      'cron.next_run': 'Next run',
      'cron.never': 'Never',
      'cron.run_now': 'Run Now',
      'cron.edit': 'Edit',
      'cron.delete': 'Delete',
      'cron.history': 'History',
      'cron.clear_history': 'Clear History',
      'cron.history.empty': 'No execution history yet.',
      'cron.history.title': 'Execution History',
      'cron.history.run_at': 'Run At',
      'cron.history.status': 'Status',
      'cron.history.http': 'HTTP',
      'cron.history.duration': 'Duration',
      'cron.history.response': 'Response',
      'cron.history.manual': 'Manual',
      'cron.modal.add': 'Add Cron Job',
      'cron.modal.edit': 'Edit Cron Job',
      'cron.form.name': 'Job Name',
      'cron.form.name_placeholder': 'E.g.: Health check API',
      'cron.form.schedule': 'Execute Cycle',
      'cron.form.schedule_hint': 'Format: minute hour day month weekday',
      'cron.advanced': 'Advanced',
      'cron.cycle.every_minute': 'Every Minute',
      'cron.cycle.n_minutes': 'N Minutes',
      'cron.cycle.hourly': 'Hourly',
      'cron.cycle.n_hours': 'N Hours',
      'cron.cycle.daily': 'Daily',
      'cron.cycle.n_days': 'N Days',
      'cron.cycle.weekly': 'Weekly',
      'cron.cycle.monthly': 'Monthly',
      'cron.builder.at': 'at',
      'cron.builder.on': 'on',
      'cron.builder.minutes': 'Minutes',
      'cron.builder.hours': 'Hours',
      'cron.builder.days': 'Days',
      'cron.builder.at_minute': 'at minute',
      'cron.builder.day': 'Day',
      'cron.builder.hours_at_min': 'Hours, at minute',
      'cron.builder.days_at': 'Days, at',
      'cron.desc.every_minute': 'Every minute',
      'cron.desc.n_minutes': 'Every {n} minutes',
      'cron.desc.hourly': 'Every hour at :{min}',
      'cron.desc.n_hours': 'Every {n} hours at :{min}',
      'cron.desc.daily': 'Every day at {time}',
      'cron.desc.n_days': 'Every {n} days at {time}',
      'cron.desc.weekly': 'Every week on {day} at {time}',
      'cron.desc.monthly': 'Every month on day {day} at {time}',
      'cron.day.sun': 'Sunday', 'cron.day.mon': 'Monday', 'cron.day.tue': 'Tuesday',
      'cron.day.wed': 'Wednesday', 'cron.day.thu': 'Thursday', 'cron.day.fri': 'Friday', 'cron.day.sat': 'Saturday',
      'cron.form.url': 'URL to Fetch *',
      'cron.form.url_placeholder': 'https://example.com/api/ping',
      'cron.form.method': 'HTTP Method',
      'cron.form.body': 'Request Body (POST only)',
      'cron.form.body_placeholder': '{"key":"value"}',
      'cron.form.enabled': 'Enable this job',
      'cron.form.cancel': 'Cancel',
      'cron.form.save': 'Save Job',
      'cron.next_preview': 'Next run:',
      'cron.expr_invalid': 'Invalid cron expression',
      'cron.presets': 'Presets',
      'cron.preset.every_minute': 'Every minute',
      'cron.preset.every_5min': 'Every 5 minutes',
      'cron.preset.every_15min': 'Every 15 minutes',
      'cron.preset.every_30min': 'Every 30 minutes',
      'cron.preset.every_hour': 'Every hour',
      'cron.preset.every_6h': 'Every 6 hours',
      'cron.preset.every_day': 'Every day at midnight',
      'cron.preset.every_week': 'Every week (Mon)',
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
      'sidebar.android_ios': 'Android / iOS',
      'sidebar.resource_monitor': 'Resource Monitor',
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
      'toolbar.add_device_android': 'Tambah Device',
      'toolbar.ios_simulator': 'iOS Simulator',
      'toolbar.adb_tutorial': 'Tutorial ADB',
      'toolbar.adb_tutorial.title': 'Lihat panduan Developer Options, USB Debugging, dan ADB Wireless',
      'toolbar.fix_android': 'Fix Android',
      'toolbar.fix_android.title': 'Perbaiki masalah ADB busy atau error emulator Android',

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
      'android.scrcpy_required': 'Tampilan layar HP membutuhkan scrcpy.',
      'android.scrcpy_not_detected': 'scrcpy belum terdeteksi. Klik tombol di samping untuk menginstal otomatis melalui Homebrew/Chocolatey.',
      'android.install_scrcpy': 'Install scrcpy otomatis',

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
      'dialog.delete_emulator.title': 'Hapus emulator?',
      'dialog.delete_emulator.confirm': 'Ya, hapus',
      'dialog.delete_emulator.cancel': 'Batal',

      // ── Toast messages ────────────────────────────────────
      'toast.logout.success': 'Berhasil logout.',
      'toast.logout.error': 'Gagal logout.',
      'toast.register.success': 'Registrasi berhasil.',
      'toast.register.failed': 'Registrasi gagal.',
      'toast.register.error': 'Terjadi kesalahan saat registrasi.',
      'toast.device.deleted': 'Device berhasil dihapus.',
      'toast.device.delete_error': 'Gagal menghapus device.',
      'toast.device.comm_error': 'Terjadi kesalahan komunikasi saat mencoba menghapus device.',
      'toast.emulator.deleted': 'Emulator dihapus.',
      'toast.emulator.delete_error': 'Error hapus: ',


      // ── Resource Monitor page ─────────────────────────────
      'rm.waiting': 'Menunggu data…',
      'rm.refresh': 'Refresh',
      'rm.active_services': 'Layanan StarBox Aktif',
      'rm.system_procs': 'Proses Sistem',
      'rm.proc.search': 'Cari proses…',
      'rm.loading_procs': 'Memuat proses…',
      'rm.system_info': 'Informasi Sistem',
      'rm.info.platform': 'Platform',
      'rm.info.arch': 'Arsitektur',
      'rm.info.cores': 'CPU Core',
      'rm.info.model': 'CPU Model',
      'rm.info.hostname': 'Hostname',
      'rm.info.heap_used': 'Heap Used',
      'rm.info.heap_total': 'Heap Total',
      'rm.info.uptime': 'System Uptime',

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

      // ── StarCapture ───────────────────────────────────────
      'sidebar.starcapture': 'StarCapture',
      'sc.title': 'StarCapture',
      'sc.subtitle': 'Screenshot & perekaman layar — alat capture profesional',
      'sc.shortcuts': 'Pintasan Keyboard',
      'sc.shortcut.screenshot': 'Screenshot',
      'sc.shortcut.record': 'Rekam Layar',
      'sc.shortcut.cancel': 'Batalkan capture',
      'sc.shortcut.confirm': 'Konfirmasi pilihan',
      'sc.section.screenshot': 'Screenshot',
      'sc.section.record': 'Perekaman Layar',
      'sc.ss.full': 'Layar Penuh',
      'sc.ss.full_desc': 'Tangkap seluruh layar',
      'sc.ss.area': 'Area Pilihan',
      'sc.ss.area_desc': 'Tarik untuk pilih area',
      'sc.ss.window': 'Window Aktif',
      'sc.ss.window_desc': 'Tangkap window yang aktif',
      'sc.rec.full': 'Layar Penuh',
      'sc.rec.full_desc': 'Rekam seluruh layar',
      'sc.rec.area': 'Area Pilihan',
      'sc.rec.area_desc': 'Rekam area yang dipilih',
      'sc.rec.pause': 'Jeda',
      'sc.rec.resume': 'Lanjutkan',
      'sc.rec.stop': '■ Stop',
      'sc.rec.preview_title': 'Preview Rekaman',
      'sc.gallery': 'Capture Terbaru',
      'sc.preview.title': 'Preview Screenshot',
      'sc.preview.loading': 'Mengambil gambar...',
      'sc.preview.copy': 'Copy ke Clipboard',
      'sc.preview.save': 'Simpan ke File',
      'sc.preview.both': 'Copy & Simpan',
      'sc.preview.discard': 'Buang',
      'sc.toast.copied': 'Disalin ke clipboard.',
      'sc.toast.copy_error': 'Gagal menyalin ke clipboard.',
      'sc.toast.saved': 'Screenshot disimpan',
      'sc.toast.video_saved': 'Rekaman disimpan',
      'sc.toast.save_error': 'Gagal menyimpan file.',
      'sc.toast.capture_error': 'Gagal mengambil tangkapan layar.',
      'sc.toast.cancelled': 'Capture dibatalkan.',
      'sc.toast.recording_started': 'Perekaman dimulai.',
      'sc.toast.recording_done': 'Perekaman selesai.',
      'sc.toast.record_error': 'Rekaman gagal',
      'sc.toast.no_source': 'Sumber layar tidak ditemukan.',

      // ── Cron Job Manager ──────────────────────────────────
      'sidebar.cron': 'Jadwal',
      'cron.subtitle': 'Kelola tugas terjadwal berbasis URL (cron job)',
      'cron.add_job': 'Tambah Job',
      'cron.empty': 'Belum ada jadwal',
      'cron.empty_desc': 'Klik "Tambah Job" untuk membuat tugas cron pertama Anda.',
      'cron.loading': 'Memuat jadwal...',
      'cron.enabled': 'Aktif',
      'cron.disabled': 'Dijeda',
      'cron.last_run': 'Terakhir dijalankan',
      'cron.next_run': 'Berikutnya',
      'cron.never': 'Belum pernah',
      'cron.run_now': 'Jalankan Sekarang',
      'cron.edit': 'Edit',
      'cron.delete': 'Hapus',
      'cron.history': 'Riwayat',
      'cron.clear_history': 'Hapus Riwayat',
      'cron.history.empty': 'Belum ada riwayat eksekusi.',
      'cron.history.title': 'Riwayat Eksekusi',
      'cron.history.run_at': 'Waktu Run',
      'cron.history.status': 'Status',
      'cron.history.http': 'HTTP',
      'cron.history.duration': 'Durasi',
      'cron.history.response': 'Response',
      'cron.history.manual': 'Manual',
      'cron.modal.add': 'Tambah Cron Job',
      'cron.modal.edit': 'Edit Cron Job',
      'cron.form.name': 'Nama Job',
      'cron.form.name_placeholder': 'Mis: Health check API',
      'cron.form.schedule': 'Siklus Eksekusi',
      'cron.form.schedule_hint': 'Format: menit jam hari bulan hari-minggu',
      'cron.advanced': 'Lanjutan',
      'cron.cycle.every_minute': 'Setiap Menit',
      'cron.cycle.n_minutes': 'N Menit',
      'cron.cycle.hourly': 'Per Jam',
      'cron.cycle.n_hours': 'N Jam',
      'cron.cycle.daily': 'Harian',
      'cron.cycle.n_days': 'N Hari',
      'cron.cycle.weekly': 'Mingguan',
      'cron.cycle.monthly': 'Bulanan',
      'cron.builder.at': 'pukul',
      'cron.builder.on': 'hari',
      'cron.builder.minutes': 'Menit',
      'cron.builder.hours': 'Jam',
      'cron.builder.days': 'Hari',
      'cron.builder.at_minute': 'pada menit',
      'cron.builder.day': 'Tanggal',
      'cron.builder.hours_at_min': 'Jam, pada menit',
      'cron.builder.days_at': 'Hari, pukul',
      'cron.desc.every_minute': 'Setiap menit',
      'cron.desc.n_minutes': 'Setiap {n} menit',
      'cron.desc.hourly': 'Setiap jam pada menit :{min}',
      'cron.desc.n_hours': 'Setiap {n} jam pada menit :{min}',
      'cron.desc.daily': 'Setiap hari pukul {time}',
      'cron.desc.n_days': 'Setiap {n} hari pukul {time}',
      'cron.desc.weekly': 'Setiap minggu hari {day} pukul {time}',
      'cron.desc.monthly': 'Setiap bulan tanggal {day} pukul {time}',
      'cron.day.sun': 'Minggu', 'cron.day.mon': 'Senin', 'cron.day.tue': 'Selasa',
      'cron.day.wed': 'Rabu', 'cron.day.thu': 'Kamis', 'cron.day.fri': 'Jumat', 'cron.day.sat': 'Sabtu',
      'cron.form.url': 'URL yang Dipanggil *',
      'cron.form.url_placeholder': 'https://example.com/api/ping',
      'cron.form.method': 'Metode HTTP',
      'cron.form.body': 'Request Body (POST saja)',
      'cron.form.body_placeholder': '{"kunci":"nilai"}',
      'cron.form.enabled': 'Aktifkan job ini',
      'cron.form.cancel': 'Batal',
      'cron.form.save': 'Simpan Job',
      'cron.next_preview': 'Berikutnya:',
      'cron.expr_invalid': 'Ekspresi cron tidak valid',
      'cron.presets': 'Preset',
      'cron.preset.every_minute': 'Setiap menit',
      'cron.preset.every_5min': 'Setiap 5 menit',
      'cron.preset.every_15min': 'Setiap 15 menit',
      'cron.preset.every_30min': 'Setiap 30 menit',
      'cron.preset.every_hour': 'Setiap jam',
      'cron.preset.every_6h': 'Setiap 6 jam',
      'cron.preset.every_day': 'Setiap hari tengah malam',
      'cron.preset.every_week': 'Setiap minggu (Senin)',
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
