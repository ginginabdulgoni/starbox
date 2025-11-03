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

if (!fs.existsSync(sessionPath)) {
  console.error('❌ Session path not found:', sessionPath);
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: sessionPath,
    args: [
      '--app=https://affiliate.shopee.co.id/',
      '--window-size=1000,700',
      '--no-default-browser-check',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
      '--disable-features=TranslateUI',
      '--no-sandbox',
      '--disable-web-security'
    ]
  });

  console.log(`🟠 Shopee Affiliate device ${uid} launched as standalone window.`);
})();
