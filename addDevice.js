// addDevice.js
const { db, initDB } = require('./db');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

(async () => {
  await initDB();

  const uid = uuidv4();
  const sessionPath = `sessions/${uid}`;

  // Pastikan folder session ada
  fs.mkdirSync(path.join(__dirname, sessionPath), { recursive: true });

  const newDevice = {
    uid,
    name: 'Whatsapp Device 1',
    service: 'wa', // bisa juga 'telegram', 'gmail'
    status: 'active',
    os_type: process.platform,
    session_path: sessionPath,
    created_at: new Date().toISOString()
  };

  db.data.devices.push(newDevice);
  await db.write();

  console.log('✅ Device added:', newDevice);
})();
