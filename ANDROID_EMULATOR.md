# Android Emulator - StarBox

Fitur Android Emulator memungkinkan Anda menjalankan Android virtual device langsung dari StarBox tanpa perlu install Android Studio atau emulator terpisah.

## Fitur Utama

- **Download On-Demand**: Emulator akan otomatis di-download saat pertama kali digunakan
- **One-Click Start**: Setelah di-download, tinggal klik "Start" untuk menjalankan emulator
- **Built-in Controls**: Kontrol emulator langsung dari UI StarBox
- **APK Installation**: Install aplikasi Android dengan drag & drop
- **Lightweight**: Menggunakan Android x86_64 untuk performa optimal

## Cara Penggunaan

### 1. Tambah Device Android

1. Klik tombol "Add Device" di StarBox
2. Pilih service "Android Emulator"
3. Beri nama device (misal: "Android 1")
4. Klik "Save"

### 2. Download Emulator (Hanya Sekali)

Saat pertama kali menjalankan Android device:

1. Klik tombol "Start" pada device Android
2. StarBox akan otomatis download komponen emulator:
   - Android Emulator (~400MB)
   - Platform Tools / ADB (~10MB)
   - System Image Android 11 (~400MB)
3. Progress download akan ditampilkan
4. Proses download memakan waktu sekitar 5-15 menit tergantung koneksi internet

**Note**: Download hanya dilakukan sekali. Setelah itu, emulator langsung bisa digunakan.

### 3. Menjalankan Emulator

Setelah download selesai atau untuk penggunaan berikutnya:

1. Klik "Start" pada device Android
2. Emulator akan boot (sekitar 1-2 menit)
3. Layar Android akan muncul dan siap digunakan

### 4. Kontrol Emulator

StarBox menyediakan kontrol untuk emulator:

- **Tap**: Klik pada layar untuk simulate touch
- **Swipe**: Drag pada layar untuk swipe
- **Back Button**: Tombol back Android
- **Home Button**: Tombol home Android
- **Recent Apps**: Tombol recent apps
- **Screenshot**: Ambil screenshot emulator

### 5. Install Aplikasi (APK)

Untuk install aplikasi Android:

1. Pastikan emulator sudah running
2. Drag & drop file APK ke window StarBox
3. Aplikasi akan otomatis terinstall
4. Buka aplikasi dari launcher Android

## Keycodes Android

Untuk kontrol keyboard, berikut beberapa keycode umum:

- `KEYCODE_HOME` (3): Home button
- `KEYCODE_BACK` (4): Back button
- `KEYCODE_MENU` (82): Menu button
- `KEYCODE_ENTER` (66): Enter
- `KEYCODE_DEL` (67): Delete
- `KEYCODE_APP_SWITCH` (187): Recent apps

## Spesifikasi Emulator Default

- **Android Version**: Android 11 (API 30)
- **Architecture**: x86_64
- **Screen**: 1080x2280 (Pixel 4)
- **RAM**: 2048 MB
- **CPU Cores**: 4
- **GPU**: Hardware acceleration (auto)

## Troubleshooting

### Emulator Tidak Mau Start

- Pastikan virtualization (VT-x/AMD-V) enabled di BIOS
- Coba restart komputer
- Check log di `~/.starbox/starbox.log`

### Download Gagal

- Pastikan koneksi internet stabil
- Coba hapus folder `~/.starbox/android-emulator` dan download ulang
- Check firewall/antivirus tidak memblokir download

### Emulator Lambat

- Pastikan minimal 8GB RAM tersedia
- Tutup aplikasi lain yang berat
- Pastikan GPU acceleration enabled

## Lokasi File

- **Emulator**: `~/.starbox/android-emulator/sdk/emulator/`
- **ADB**: `~/.starbox/android-emulator/sdk/platform-tools/`
- **AVD**: `~/.starbox/android-emulator/avd/`
- **System Images**: `~/.starbox/android-emulator/sdk/system-images/`

## API untuk Developer

Jika Anda ingin menggunakan Android API di renderer:

```javascript
// Check if emulator installed
const { installed } = await window.electronAPI.android.checkInstallation();

// Download emulator
await window.electronAPI.android.download(uid);

// Start emulator
await window.electronAPI.android.start(uid, { headless: false });

// Stop emulator
await window.electronAPI.android.stop(uid);

// Take screenshot
const { data } = await window.electronAPI.android.getScreenshot();

// Tap at coordinates
await window.electronAPI.android.tap(540, 1140);

// Swipe gesture
await window.electronAPI.android.swipe(540, 1500, 540, 500, 300);

// Input text
await window.electronAPI.android.inputText('Hello World');

// Press key
await window.electronAPI.android.pressKey('KEYCODE_HOME');

// Install APK
await window.electronAPI.android.installAPK('/path/to/app.apk');

// Check if running
const { running } = await window.electronAPI.android.isRunning();

// Listen to download progress
window.electronAPI.android.onDownloadProgress((data) => {
  console.log(`Downloading ${data.component}: ${data.progress}%`);
});
```

## Catatan Penting

- **Virtualization Required**: Komputer harus support virtualization (Intel VT-x atau AMD-V)
- **Disk Space**: Minimal 2GB free space untuk emulator
- **RAM**: Minimal 4GB RAM, direkomendasikan 8GB
- **First Boot**: Boot pertama memakan waktu lebih lama (2-3 menit)
- **Internet**: Dibutuhkan untuk download pertama kali

## Roadmap

Fitur yang akan datang:

- [ ] Multiple AVD profiles
- [ ] Custom screen resolution
- [ ] Location simulation (GPS)
- [ ] Camera simulation
- [ ] Network throttling
- [ ] Google Play Services support

---

Jika ada pertanyaan atau issue, silakan buka issue di repository StarBox.
