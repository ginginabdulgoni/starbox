# Shopee Auto Rotation - Dokumentasi

## Overview
Fitur automation untuk Shopee yang secara otomatis membuka link produk secara berurutan dan auto-click tombol play video jika ada.

## Fitur Utama
1. **Mobile Mode Default**: Otomatis dibuka dengan user agent mobile (Android) untuk tampilan mobile Shopee
2. **Initial Delay**: Delay 1 menit saat pertama kali start untuk menyelesaikan captcha Shopee
3. **Auto Product Rotation**: Membuka link produk secara berurutan dengan interval waktu tertentu
4. **Auto Play Video**:
   - Otomatis mencari dan mengklik tombol play video di halaman produk
   - Multiple fallback: direct video play, klik tengah halaman
   - Deteksi smart untuk video yang hanya audio
5. **Control Panel**: UI kontrol untuk start/stop/next automation dengan countdown delay
6. **Configurable Interval**: Interval waktu dan delay bisa dikustomisasi

## Cara Menggunakan

### 1. Setup Produk
Edit file `shopee-automation.js` dan ubah array `PRODUCTS`:

```javascript
const PRODUCTS = [
  {
    name: "Produk 1",
    link: "https://id.shp.ee/dqpcnw7?smtt=0.0.9"
  },
  {
    name: "Produk 2",
    link: "https://id.shp.ee/bdk6azc?smtt=0.0.9"
  },
  {
    name: "Produk 3",
    link: "https://id.shp.ee/xq7ax6k?smtt=0.0.9"
  }
];
```

### 2. Konfigurasi
Edit konfigurasi di `shopee-automation.js`:

```javascript
const CONFIG = {
  INITIAL_DELAY_MS: 60000, // 60 detik (1 menit) delay sebelum start pertama kali
  INTERVAL_MS: 15000,      // 15 detik per produk (ubah sesuai kebutuhan)
  AUTO_START: true,        // Auto start saat halaman dimuat
  PLAY_BUTTON_CHECK_INTERVAL: 3000, // Cek tombol play setiap 3 detik (lebih lama untuk Shopee)
  MAX_PLAY_ATTEMPTS: 5,    // Maksimal percobaan klik tombol play (total ~15 detik)
};
```

**Catatan**:
- `INITIAL_DELAY_MS`: Delay ini memberikan waktu untuk menyelesaikan captcha Shopee sebelum automation mulai navigasi ke produk
- `PLAY_BUTTON_CHECK_INTERVAL`: Interval 3 detik untuk memberi waktu halaman Shopee load sempurna
- Delay hanya terjadi saat **start pertama kali**, tidak saat pause/resume
- Device akan otomatis dibuka dengan **mode mobile (Android)** untuk tampilan mobile Shopee

### 3. Jalankan Device
1. Buat device baru dengan service **Shopee** atau **Shopee Affiliate**
2. Run device tersebut
3. Automation akan otomatis berjalan (jika `AUTO_START: true`)

## Control Panel
Control panel akan muncul di pojok kanan atas halaman Shopee dengan tampilan:

- **Status**: Menampilkan status automation (Waiting/Running/Stopped)
- **Delay Countdown**: Menampilkan countdown delay awal (hanya saat start pertama kali)
  - Contoh: "⏰ Delay: 58s - Selesaikan captcha terlebih dahulu"
- **Produk**: Menampilkan produk yang sedang dibuka
- **Progress**: Menampilkan progress (contoh: 1/3)
- **Tombol Start/Pause**: Toggle automation on/off
- **Tombol Next**: Skip ke produk berikutnya
- **Tombol Close (×)**: Menutup control panel

**Alur Penggunaan**:
1. Device dibuka → Control panel muncul → Status "Waiting ⏰"
2. Countdown delay 60 detik dimulai
3. Selesaikan captcha Shopee selama masa delay
4. Setelah countdown selesai → Otomatis navigasi ke produk pertama
5. Video auto-play jika ada tombol play

## Manual Control via Console
Anda juga bisa mengontrol automation melalui browser console:

```javascript
// Start automation
window.shopeeAuto.start();

// Stop automation
window.shopeeAuto.stop();

// Toggle (start/stop)
window.shopeeAuto.toggle();

// Skip ke produk berikutnya
window.shopeeAuto.next();

// Reset automation (akan menerapkan delay lagi saat start)
window.shopeeAuto.reset();

// Ubah interval rotasi produk (dalam milliseconds)
window.shopeeAuto.setInterval(20000); // 20 detik

// Ubah initial delay (dalam milliseconds)
window.shopeeAuto.setInitialDelay(30000); // 30 detik

// Cek status running
console.log(window.shopeeAuto.isRunning());

// Cek sisa waktu delay (dalam detik)
console.log(window.shopeeAuto.getRemainingDelay());

// Lihat produk yang ada
console.log(window.shopeeAuto.getProducts());

// Lihat index produk saat ini
console.log(window.shopeeAuto.getCurrentIndex());
```

## File yang Terlibat

1. **shopee-automation.js**: Script utama automation yang diinjeksi ke halaman Shopee
2. **shopee-preload.cjs**: Preload script (opsional, untuk konteks bridge)
3. **electron-main.js**: Modifikasi untuk inject script ke service Shopee

## Cara Kerja

1. Saat device Shopee dibuka, `electron-main.js` akan otomatis inject `shopee-automation.js`
2. Script akan membuat control panel di pojok kanan atas
3. Jika `AUTO_START` true, automation langsung berjalan dengan alur:
   - **Start Pertama Kali**:
     - Status berubah menjadi "Waiting ⏰"
     - Countdown 60 detik dimulai (untuk menyelesaikan captcha)
     - User dapat menyelesaikan captcha Shopee selama masa delay
     - Setelah countdown selesai, navigasi ke produk pertama dimulai
   - **Resume dari Pause** (bukan first start):
     - Langsung navigasi tanpa delay
     - Automation melanjutkan dari produk terakhir
4. Setiap interval tertentu (default 15 detik), script akan navigasi ke produk berikutnya
5. Setiap kali halaman baru dimuat (navigasi produk):
   - **Delay 3 detik** menunggu halaman load sempurna
   - Script mencoba mencari tombol play video dengan berbagai selector
   - Jika ditemukan, scroll ke button dan klik otomatis
   - **Fallback 1**: Jika button tidak ketemu, coba play video langsung via JS
   - **Fallback 2**: Jika masih gagal, klik di tengah halaman (untuk video yang ada overlay)
   - Percobaan dilakukan maksimal 5x dengan interval 3 detik (total ~15 detik)
6. Rotasi produk akan berulang dari awal setelah produk terakhir

## Troubleshooting

### Delay terlalu pendek untuk captcha?
Ubah `INITIAL_DELAY_MS` di konfigurasi atau via console:
```javascript
window.shopeeAuto.setInitialDelay(120000); // 2 menit
window.shopeeAuto.reset(); // Reset dan start ulang
```

### Ingin restart dengan delay lagi?
Gunakan fungsi reset:
```javascript
window.shopeeAuto.reset(); // Reset ke first start
window.shopeeAuto.start(); // Akan ada delay lagi
```

### Video tidak auto-play atau hanya audio?
Script sudah dilengkapi dengan 3 fallback mechanism:
1. Cari dan klik tombol play (20+ selector berbeda)
2. Play video langsung via JavaScript
3. Klik di tengah halaman (untuk trigger overlay video)

Lihat di browser console (F12) untuk melihat log apa yang terjadi:
- `▶️ Auto-click tombol play dengan selector: ...` → Button ditemukan dan diklik
- `▶️ Auto-play video langsung` → Video diplay via JS
- `🎯 Klik element di tengah` → Fallback klik tengah halaman

### Tombol play tidak terdeteksi?
Jika masih gagal, tambahkan custom selector di `shopee-automation.js` fungsi `tryClickPlayButton()`:

```javascript
const playButtonSelectors = [
  'button[aria-label*="play" i]',
  'button[aria-label*="putar" i]',
  // Tambahkan selector custom di sini
  '.your-custom-selector',
];
```

### Interval terlalu cepat/lambat?
Ubah `INTERVAL_MS` di konfigurasi:
- Default: 15000 (15 detik)
- Minimum disarankan: 10000 (10 detik)
- Maksimum: sesuai kebutuhan

### Script tidak jalan?
1. Buka DevTools (F12) dan cek console untuk error
2. Pastikan file `shopee-automation.js` ada di folder project
3. Cek apakah service device adalah 'shopee' atau 'shopee_affiliate'

## Tips Penggunaan

1. **Captcha Handling**:
   - Delay 1 menit sudah cukup untuk menyelesaikan captcha pada umumnya
   - Jika perlu lebih lama, ubah `INITIAL_DELAY_MS` di konfigurasi
   - Selesaikan captcha SEBELUM countdown habis
2. **Untuk Affiliate**: Gunakan link pendek Shopee dengan tracking parameter (`smtt`)
3. **Waktu Optimal**: Set interval 15-30 detik agar tidak terlalu cepat
4. **Multiple Devices**: Bisa run multiple device Shopee dengan produk berbeda
5. **Monitoring**: Gunakan control panel untuk memantau progress dan countdown
6. **Restart/Reset**:
   - Pause/Resume: Tidak ada delay lagi
   - Reset + Start: Ada delay lagi (berguna setelah close device)

## Keamanan & Etika

- Gunakan fitur ini sesuai dengan Terms of Service Shopee
- Jangan set interval terlalu cepat untuk menghindari rate limiting
- Pastikan link produk adalah milik sendiri atau affiliate link yang sah
- Automation ini untuk membantu testing, bukan untuk spam atau abuse

## Update Produk

Untuk update produk:
1. Edit `shopee-automation.js`
2. Ubah array `PRODUCTS` dengan link baru
3. Restart device Shopee atau reload halaman

---

**Version**: 1.0
**Last Updated**: 2025-11-06
**Author**: 1112 Project
