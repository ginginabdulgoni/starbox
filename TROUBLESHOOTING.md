# StarBox Troubleshooting Guide

## Android Emulator Issues

### Windows: Filesystem Error dengan Double Backslash

**Error yang muncul:**
```
ERROR filesystem_win.cc:130] GetFileAttributes C:\Users\...\Temp\\AndroidEmulator\emu-crash-33.1.24.db\...
The system cannot find the file specified. (2)
```

**Penjelasan:**
- Error ini adalah **WARNING** bukan error fatal
- Emulator Android mencoba membaca crash database untuk reporting
- Double backslash (`\\`) di path adalah bug minor dari emulator Android
- Emulator tetap bisa berjalan normal meskipun muncul warning ini

**Solusi yang sudah diterapkan:**
1. ✅ Path normalisasi otomatis untuk Windows
2. ✅ Auto-kill ADB server sebelum download/start
3. ✅ Tombol "Fix Android" untuk perbaikan manual
4. ✅ Environment variable disanitasi dari double backslash
5. ✅ Disable metrics dan crash reporting

**Jika masih ada masalah:**
1. Klik tombol **"Fix Android"** di header aplikasi
2. Atau hapus folder `C:\Users\[Username]\AppData\Local\Temp\AndroidEmulator`
3. Atau restart aplikasi StarBox

---

### ADB Busy Error

**Error yang muncul:**
```
cannot bind 'tcp:5037': Address already in use
ADB server didn't ACK
```

**Solusi:**
1. Klik tombol **"Fix Android"** di header
2. Atau secara manual:
   - Buka Task Manager (Ctrl+Shift+Esc)
   - Cari proses "adb.exe"
   - End Task
   - Restart emulator

**Pencegahan otomatis:**
- ADB server sekarang otomatis di-kill sebelum:
  - Download emulator
  - Start emulator
  - Saat klik "Fix Android"

---

### Emulator Crash atau Hang

**Gejala:**
- Emulator freeze
- Layar hitam
- Tidak merespon

**Solusi:**
1. Stop emulator dari StarBox
2. Klik tombol **"Fix Android"**
3. Tunggu proses selesai
4. Start emulator lagi

---

### Error "Platform Directory Missing"

**Penjelasan:**
- Terjadi saat file platform Android tidak ditemukan
- Biasanya karena download tidak lengkap atau folder dihapus

**Solusi otomatis:**
- StarBox akan otomatis download platform yang hilang
- Proses ini berjalan di background saat start emulator

---

## Tips Umum Windows

### Performa Lambat
- Pastikan antivirus tidak memblokir StarBox atau emulator
- Tutup aplikasi lain yang berat
- Emulator Android butuh minimal 4GB RAM bebas

### Path Terlalu Panjang
Jika error "path too long":
- Install StarBox di folder lebih pendek (contoh: `C:\StarBox`)
- Jangan install di folder dengan banyak subfolder

### Permission Denied
- Run StarBox "as administrator" jika ada error permission
- Atau tambahkan exception di Windows Defender

---

## Kontak Support

Jika masalah masih berlanjut:
- 🌐 [starbox.weagate.com](https://starbox.weagate.com)
- 💻 [GitHub Issues](https://github.com/ginginabdulgoni/starbox/issues)
- 📧 Email: support@1112-project.com

---

**Catatan:** Error filesystem Windows yang Anda lihat di console adalah warning internal dari emulator Android, bukan bug dari StarBox. Emulator tetap berfungsi normal.
