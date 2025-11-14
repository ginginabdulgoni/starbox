# WhatsApp Gateway Documentation

## Overview

WhatsApp Gateway adalah fitur baru di StarBox yang memungkinkan Anda mengelola multiple WhatsApp devices dengan auto-reply dan scheduling menggunakan library @whiskeysockets/baileys v7.0.0-rc.6.

## Features

### 1. **Multi-Device Support**

- Kelola banyak WhatsApp devices dalam satu aplikasi
- Setiap device memiliki session independen
- Sessions disimpan di SQLite untuk performa ringan

### 2. **Auto-Reply**

- Buat rules auto-reply berdasarkan keyword
- Enable/disable per device
- Multiple rules per device

### 3. **Schedule Messages**

- Kirim pesan terjadwal menggunakan cron expression
- Multiple recipients per schedule
- Tracking last run time

### 4. **Message Logs**

- Log semua pesan masuk dan keluar
- Filter by device
- View message history

## Database Schema

Database menggunakan SQLite dengan tabel:

### `wa_devices`

```sql
id TEXT PRIMARY KEY
name TEXT NOT NULL
phone TEXT
status TEXT (disconnected|connecting|connected|qr_ready)
qr_code TEXT
auto_reply_enabled INTEGER (0|1)
created_at TEXT
updated_at TEXT
```

### `wa_auto_replies`

```sql
id TEXT PRIMARY KEY
device_id TEXT
keyword TEXT NOT NULL
reply_message TEXT NOT NULL
is_active INTEGER (0|1)
created_at TEXT
```

### `wa_schedules`

```sql
id TEXT PRIMARY KEY
device_id TEXT
schedule_name TEXT
cron_expression TEXT
message TEXT
recipients TEXT (JSON array)
is_active INTEGER (0|1)
last_run TEXT
created_at TEXT
```

### `wa_message_logs`

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
device_id TEXT
phone TEXT
message TEXT
type TEXT (sent|received|auto_reply)
status TEXT (success|failed)
timestamp TEXT
```

## API Reference

### Renderer (JavaScript)

```javascript
// Get all devices
const result = await window.electronAPI.whatsappGateway.getDevices();

// Create device
const device = await window.electronAPI.whatsappGateway.createDevice(
  deviceId,
  name
);

// Start device (akan trigger QR code)
await window.electronAPI.whatsappGateway.startDevice(deviceId);

// Stop device
await window.electronAPI.whatsappGateway.stopDevice(deviceId);

// Delete device
await window.electronAPI.whatsappGateway.deleteDevice(deviceId);

// Send message
await window.electronAPI.whatsappGateway.sendMessage(deviceId, phone, message);

// Get status
const status = await window.electronAPI.whatsappGateway.getStatus(deviceId);

// Auto-reply
const replies = await window.electronAPI.whatsappGateway.getAutoReplies(
  deviceId
);
await window.electronAPI.whatsappGateway.addAutoReply(
  deviceId,
  keyword,
  replyMessage
);
await window.electronAPI.whatsappGateway.deleteAutoReply(replyId);
await window.electronAPI.whatsappGateway.toggleAutoReply(replyId, isActive);
await window.electronAPI.whatsappGateway.setAutoReplyEnabled(deviceId, true);

// Schedules
const schedules = await window.electronAPI.whatsappGateway.getSchedules(
  deviceId
);
await window.electronAPI.whatsappGateway.addSchedule(
  deviceId,
  scheduleName,
  cronExpression,
  message,
  recipients
);
await window.electronAPI.whatsappGateway.deleteSchedule(scheduleId);

// Logs
const logs = await window.electronAPI.whatsappGateway.getMessageLogs(
  deviceId,
  100
);

// Event listeners
window.electronAPI.whatsappGateway.onQRCode((deviceId, qr) => {
  console.log("QR Code received:", qr);
});

window.electronAPI.whatsappGateway.onConnected((deviceId, phone) => {
  console.log("Connected:", phone);
});

window.electronAPI.whatsappGateway.onStatusChange((deviceId, status) => {
  console.log("Status changed:", status);
});

window.electronAPI.whatsappGateway.onMessageReceived(
  (deviceId, from, message) => {
    console.log("Message received:", from, message);
  }
);
```

## Usage Flow

### 1. **Tambah Device Baru**

1. Klik "Tambah Device WA"
2. Masukkan nama device
3. Klik "Tambah & Scan QR"
4. Scan QR code dengan WhatsApp → Linked Devices → Link a Device
5. Tunggu hingga status menjadi "Connected"

### 2. **Setup Auto-Reply**

1. Klik tombol "Settings" pada device card
2. Tab "Auto Reply"
3. Klik "Tambah Rule"
4. Masukkan keyword dan reply message
5. Klik "Simpan"
6. Toggle switch untuk enable/disable

### 3. **Setup Schedule**

1. Klik tombol "Settings" pada device card
2. Tab "Schedule"
3. Klik "Tambah Schedule"
4. Masukkan:
   - Nama schedule
   - Cron expression (contoh: `0 9 * * *` untuk setiap hari jam 9 pagi)
   - Pesan
   - Nomor penerima (pisahkan dengan koma)
5. Klik "Simpan"

### 4. **View Logs**

1. Klik tombol "Settings" pada device card
2. Tab "Logs"
3. Lihat history pesan masuk/keluar

## Cron Expression Examples

```
0 9 * * *       - Setiap hari jam 09:00
0 */2 * * *     - Setiap 2 jam
30 8 * * 1      - Setiap Senin jam 08:30
0 0 1 * *       - Setiap tanggal 1 tengah malam
*/15 * * * *    - Setiap 15 menit
```

Format: `detik menit jam tanggal bulan hari_minggu`

## Files Modified/Created

### Created:

- `baileys-manager.js` - Core WA Gateway logic dengan Baileys
- `WHATSAPP_GATEWAY.md` - This documentation

### Modified:

- `index.html` - Added WhatsApp Gateway page dan modals
- `style.css` - Added WA Gateway styles
- `electron-main.js` - Added IPC handlers
- `preload.cjs` - Added WA Gateway bridge
- `package.json` - Added dependencies

### Dependencies Added:

- `@whiskeysockets/baileys@7.0.0-rc.6` - WhatsApp Web API
- `wa-gateway-data.json` - file JSON untuk menyimpan device, auto-reply, schedule, dan log; semua operasi dilakukan lewat helper JS tanpa native dependency
- `qrcode-terminal` - QR code display
- `qrcode` - QR code canvas rendering
- `pino` - Logger for Baileys

## Architecture

```
┌─────────────────┐
│   Renderer      │
│   (HTML/JS)     │
└────────┬────────┘
         │
         ├─ Load devices, QR display, UI interactions
         │
┌────────▼────────┐
│    Preload      │
│  (preload.cjs)  │
└────────┬────────┘
         │
         ├─ IPC Bridge
         │
┌────────▼────────────┐
│   Electron Main     │
│ (electron-main.js)  │
└────────┬────────────┘
         │
         ├─ IPC Handlers
         │
┌────────▼──────────────┐
│  Baileys Manager      │
│ (baileys-manager.js)  │
└────────┬──────────────┘
         │
         ├─ Session Management
         ├─ Auto-reply Logic
         ├─ Message Logging
         │
┌────────▼────────┐
│  SQLite DB      │
│ (whatsapp-      │
│  gateway.db)    │
└─────────────────┘
```

## Security Considerations

1. **Session Storage**: Sessions disimpan lokal di SQLite
2. **No Cloud Sync**: Semua data tersimpan di device lokal
3. **Credentials**: Tidak ada credential yang dikirim ke server external
4. **WhatsApp TOS**: Pastikan penggunaan sesuai dengan Terms of Service WhatsApp

## Troubleshooting

### QR Code tidak muncul

- Pastikan internet connection stable
- Restart device connection
- Check console untuk error messages

### Device disconnect terus

- Check internet connection
- Pastikan WhatsApp Web tidak dibuka di browser lain
- Pastikan device tidak logout dari WhatsApp mobile

### Auto-reply tidak berfungsi

- Pastikan auto-reply enabled untuk device
- Check keyword match (case-insensitive)
- Lihat logs untuk verify message receipt

## Future Enhancements

- [ ] Webhook integration
- [ ] Media message support (image, video, audio)
- [ ] Group message support
- [ ] Broadcast lists
- [ ] Analytics dashboard
- [ ] Export/import configurations
- [ ] Rate limiting for auto-reply
- [ ] Template messages

## Support

Untuk pertanyaan atau issue, silakan:

1. Check logs di `<userData>/starbox.log`
2. Check database di `<userData>/whatsapp-gateway.db`
3. Report issue di GitHub repository
