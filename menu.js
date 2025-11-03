import inquirer from 'inquirer';
import { db, initDB } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gunakan npx electron untuk jalankan launcher
const electronCommand = `npx electron electron-main.js`;

const serviceIcons = {
  wa: '🟢 WhatsApp',
  telegram: '📨 Telegram'
};

(async () => {
  await initDB();

  const menu = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '📦 Pilih aksi:',
      choices: [
        '➕ Tambah Device',
        '▶️ Jalankan Semua Device Aktif',
        '▶️ Jalankan Satu Device',
        '📋 Lihat Semua Device',
        '🗑️ Hapus Device',
        '❌ Keluar'
      ]
    }
  ]);

  if (menu.action === '➕ Tambah Device') {
    const deviceInput = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Nama device:'
      },
      {
        type: 'list',
        name: 'service',
        message: 'Jenis layanan:',
        choices: Object.keys(serviceIcons)
      }
    ]);

    const uid = uuidv4();
    const sessionPath = `sessions/${uid}`;
    fs.mkdirSync(path.join(__dirname, sessionPath), { recursive: true });

    const newDevice = {
      uid,
      name: deviceInput.name,
      service: deviceInput.service,
      status: 'active',
      os_type: process.platform,
      session_path: sessionPath,
      created_at: new Date().toISOString()
    };

    db.data.devices.push(newDevice);
    await db.write();
    console.log(`✅ Device '${deviceInput.name}' (${deviceInput.service}) ditambahkan.`);

  } else if (menu.action === '▶️ Jalankan Semua Device Aktif') {
    const activeDevices = db.data.devices.filter(d => d.status === 'active');

    for (const device of activeDevices) {
      const label = serviceIcons[device.service] || device.service;
      console.log(`[▶️] Menjalankan ${device.name} (${label})...`);

      exec(`${electronCommand} ${device.uid} ${device.service}`, (err, stdout, stderr) => {
        if (err) {
          console.error(`❌ Gagal menjalankan ${device.name}`);
          console.error(stderr);
        }
      });
    }

  } else if (menu.action === '▶️ Jalankan Satu Device') {
    const deviceChoices = db.data.devices.map((d, i) => ({
      name: `${serviceIcons[d.service] || d.service} — ${d.name}`,
      value: i
    }));

    const selected = await inquirer.prompt([
      {
        type: 'list',
        name: 'index',
        message: 'Pilih device untuk dijalankan:',
        choices: deviceChoices
      }
    ]);

    const device = db.data.devices[selected.index];
    console.log(`[▶️] Menjalankan ${device.name} (${device.service})...`);

    exec(`${electronCommand} ${device.uid} ${device.service}`, (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Gagal menjalankan ${device.name}`);
        console.error(stderr);
      }
    });

  } else if (menu.action === '📋 Lihat Semua Device') {
    console.table(db.data.devices, ['uid', 'name', 'service', 'status', 'os_type']);

  } else if (menu.action === '🗑️ Hapus Device') {
    const deviceChoices = db.data.devices.map((d, i) => ({
      name: `${serviceIcons[d.service] || d.service} — ${d.name}`,
      value: i
    }));

    const selected = await inquirer.prompt([
      {
        type: 'list',
        name: 'index',
        message: 'Pilih device yang ingin dihapus:',
        choices: deviceChoices
      }
    ]);

    const removed = db.data.devices.splice(selected.index, 1)[0];
    await db.write();
    console.log(`🗑️ Device '${removed.name}' (${removed.service}) dihapus.`);

  } else if (menu.action === '❌ Keluar') {
    console.log('👋 Sampai jumpa!');
    process.exit(0);
  }
})();
