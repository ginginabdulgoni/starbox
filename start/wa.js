// start/wa.js
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const uid = process.argv[2];
if (!uid) {
  console.error('❌ UID not provided!');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sessionPath = path.join(__dirname, '..', 'sessions', uid);

// Cek dan buat folder session jika belum ada
if (!fs.existsSync(sessionPath)) {
  console.log(`📁 Membuat folder session: ${sessionPath}`);
  fs.mkdirSync(sessionPath, { recursive: true });
} else {
  console.log(`📁 Folder session sudah ada: ${sessionPath}`);
}

// Info
console.log('🧠 Menggunakan userDataDir:', sessionPath);

(async () => {
  const headlessMode = process.env.BACKGROUND === '1' ? 'new' : false;

  const browser = await puppeteer.launch({
    headless: headlessMode,
    userDataDir: sessionPath,
    args: [
      '--window-size=1200,800',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=TranslateUI',
    ]
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  console.log('🌐 Membuka WhatsApp Web...');
  await page.goto('https://web.whatsapp.com');

  try {
    // Tunggu hingga login berhasil atau QR muncul
    await Promise.race([
      page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 10000 }),
      page.waitForSelector('div[data-testid="chat-list-search"]', { timeout: 10000 }),
    ]);

    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('div[data-testid="chat-list-search"]');
    });

    if (isLoggedIn) {
      console.log(`✅ Device ${uid} sudah login`);
    } else {
      console.log(`📸 QR Code tampil. Silakan scan untuk login...`);
    }
  } catch (err) {
    console.error('⚠️ Gagal mendeteksi status login:', err.message);
  }

  console.log(`📲 WhatsApp device aktif. Session disimpan di: ${sessionPath}`);
})();
