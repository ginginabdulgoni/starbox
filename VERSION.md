# Auto-Versioning StarBox

## Format Versi

StarBox menggunakan format versi: `1.2.YYMMDD`

Contoh:
- `1.2.251105` = Versi build tanggal 5 November 2025
- `1.2.251225` = Versi build tanggal 25 Desember 2025
- `1.2.260101` = Versi build tanggal 1 Januari 2026

## Cara Kerja

Setiap kali Anda menjalankan build, versi akan otomatis diupdate berdasarkan tanggal build:

1. Script `update-version.js` akan dijalankan otomatis sebelum build
2. Tanggal hari ini diambil dan diformat menjadi `YYMMDD`
3. `package.json` diupdate dengan versi baru
4. `electron-main.js` diupdate di bagian window title

## Command Build

```bash
# Build untuk Mac (versi otomatis terupdate)
npm run build:mac

# Build untuk Windows (versi otomatis terupdate)
npm run build:win

# Build untuk Linux (versi otomatis terupdate)
npm run build:linux

# Build untuk semua platform (versi otomatis terupdate)
npm run build:all

# Build default (versi otomatis terupdate)
npm run build
```

## Manual Update Versi

Jika ingin update versi secara manual tanpa build:

```bash
node update-version.js
```

## File yang Terupdate

- `package.json` - field `version`
- `electron-main.js` - window title dengan format "Starbox V1.2.YYMMDD"
- `index.html` - footer dengan format "StarBox v1.2.YYMMDD"

## Catatan

- Versi diupdate berdasarkan **tanggal hari ini** saat build dijalankan
- Format selalu `1.2.YYMMDD` (tidak dapat diubah secara manual untuk consistency)
- Jika build 2x di hari yang sama, versi akan sama
- Jika build di hari berbeda, versi akan berbeda
