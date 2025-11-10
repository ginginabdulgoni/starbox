# StarBox – Emulator Multi-Layanan

StarBox adalah aplikasi desktop berbasis Electron yang membantu menjalankan beberapa layanan web populer (WhatsApp, Telegram, Gmail, Shopee, dll.) di dalam satu lingkungan terkontrol. Selain memudahkan manajemen banyak “device” virtual, StarBox dilengkapi automasi pengiriman pesan WhatsApp yang bisa dipantau lewat jendela monitor khusus.

## Fitur Utama

- **Multi‑service web emulator**
  Jalankan berbagai layanan web dengan profil terisolasi (partition `persist:<uid>`) sehingga tiap device memiliki sesi cookies sendiri.

- **Android Emulator (NEW!)**
  Jalankan Android virtual device langsung dari StarBox tanpa install Android Studio. Download on-demand (~800MB), kemudian tinggal klik Start untuk menjalankan emulator Android 11.

- **Manajemen device**
  Tambah, edit, hapus, dan jalankan device melalui antarmuka desktop. Opsi `autoRun` akan otomatis membuka device saat aplikasi mulai.

- **Auto sender WhatsApp**
  Device yang memakai layanan `wa` dapat diaktifkan sebagai auto sender. Mesin automasi mengambil antrean pesan dari endpoint yang kamu sediakan, menjalankan pengiriman, dan melaporkan status balik ke endpoint update.

- **Monitoring paralel**
  Tiap device auto sender memiliki jendela monitor terpisah yang menampilkan antrean, statistik, status koneksi, dan log troubleshooting. Beberapa monitor dapat beroperasi bersamaan tanpa saling menunggu.

- **Kendali penuh via IPC**
  Renderer mengatur pengiriman per sesi dan berkomunikasi dengan proses utama melalui kanal IPC yang diamankan (`contextIsolation: true` + preload script).

## Struktur Proyek Singkat

```
.
├── electron-main.js        # Entry process utama Electron
├── renderer.js             # Logika UI & automasi di proses renderer
├── automation-monitor.html # Tampilan monitor auto sender
├── monitor-preload.cjs     # Preload untuk monitor window
├── preload.cjs             # Preload untuk window utama
├── assets/                 # Ikon dan aset statis
├── start/                  # Skrip pendukung (opsional)
├── dist/                   # Output build Electron (setelah build)
└── README.md               # Berkas ini
```

> Catatan: Folder `repo/` di root berisi arsip kode lama. Folder tersebut tidak dipakai dalam build terbaru; kamu bisa menghapusnya jika tidak diperlukan.

## Prasyarat

- **Node.js** 18 atau lebih baru  
- **npm** (disertakan bersama Node.js)  
- Sistem operasi yang didukung Electron (macOS, Windows, Linux)

## Instalasi & Menjalankan Project

```bash
# 1. Instal dependensi
npm install

# 2. Mode pengembangan (membuka window dengan DevTools)
npm run dev

# 3. Mode produksi (menjalankan aplikasi seperti user)
npm start
```

Jika ingin membuat paket installer:

```bash
npm run build:mac     # macOS
npm run build:win     # Windows (x64 & arm64)
npm run build:linux   # Linux (x64 & arm64)
# atau
npm run build         # Semua target sesuai konfigurasi electron-builder
```

Output build akan berada di folder `dist/`.

## Automasi WhatsApp

1. **Aktifkan auto sender** saat menambah/mengedit device layanan `WA`.
2. **Isi Pending URL** mengarah ke backend milikmu. Backend tersebut harus menyediakan:
   - Endpoint `POST /getpendingmessage` yang mengembalikan daftar pesan (`id`, `phone`, `message`, `priority`, dll.).
   - Endpoint `POST /updatestatusmessage` (opsional) untuk menerima status kirim.
   - Jika kamu hanya mengisi domain dasar (mis. `https://contoh.com`), StarBox otomatis menambahkan `/getpendingmessage` saat mengambil antrean dan `/updatestatusmessage` saat mengirim status. Bila kamu menuliskan URL lengkap dengan path kustom (mis. `https://contoh.com/api/getmessage`), StarBox akan menggunakan URL tersebut apa adanya tanpa menempelkan path default.
3. Tiap pesan akan dikirimkan lewat WhatsApp Web dengan mensimulasikan klik tombol kirim.
4. Status, antrean, serta pesan error akan muncul di jendela monitor device terkait.

Karena StarBox menjalankan automasi per device, kamu bisa menjalankan beberapa auto sender sekaligus tanpa saling mengganggu.

## Android Emulator

StarBox sekarang mendukung Android Emulator built-in! Lihat [ANDROID_EMULATOR.md](ANDROID_EMULATOR.md) untuk dokumentasi lengkap.

**Quick Start:**
1. Tambah device baru dengan service "Android Emulator"
2. Klik Start - akan otomatis download emulator pertama kali (~800MB)
3. Tunggu boot selesai (~2 menit)
4. Siap digunakan!

**Fitur:**
- Android 11 (API 30) x86_64
- Install APK via drag & drop
- Screenshot & screen control
- ADB integration

## Logging & Debugging

- Proses utama menulis log ke `<userData>/starbox.log`.  
- Argumen start dicatat ke `<temp>/starbox-debug.log`.  
- Gunakan DevTools (Ctrl/Cmd+Shift+I) untuk menginspeksi UI.  
- Monitor automasi juga menampilkan ringkasan koneksi dan preview respons API pending.

## Tips Pengembangan

- Pastikan setiap perubahan IPC di `renderer.js` memiliki handler aman di `electron-main.js`.
- Gunakan `npm run dev` saat mengembangkan agar hot reload dan DevTools aktif.
- Setelah update besar, jalankan `npm audit fix` bila perlu untuk memperbaiki paket rentan.

## Kontribusi

1. Fork repo ini dan buat branch baru (`git checkout -b fitur-baru`).
2. Lakukan perubahan, sertakan komentar singkat jika ada logika kompleks.
3. Pastikan lint/test berjalan (jika tersedia).
4. Kirim pull request beserta deskripsi perubahan dan langkah uji.

Silakan ajukan issue jika menemukan bug atau memiliki ide pengembangan lanjutan.

---

Dibuat dengan ❤️ oleh Gingin Abdul Goni dan kontributor StarBox lainnya.
