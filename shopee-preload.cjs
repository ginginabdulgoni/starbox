const { contextBridge, ipcRenderer } = require('electron');

// Data produk yang akan dibuka secara otomatis
const products = [
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

contextBridge.exposeInMainWorld('shopeeAutomation', {
  products: products,
  navigateToProduct: (link) => {
    window.location.href = link;
  },
  log: (message) => ipcRenderer.send('log', message)
});

// Auto-click play button setelah halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
  console.log('🛍️ Shopee Automation loaded');

  // Tunggu 3 detik untuk memastikan halaman sudah sepenuhnya dimuat
  setTimeout(() => {
    tryClickPlayButton();

    // Coba lagi setiap 2 detik jika belum berhasil (maksimal 5 kali)
    let attempts = 0;
    const maxAttempts = 5;
    const retryInterval = setInterval(() => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(retryInterval);
        console.log('⏹ Stop mencari tombol play setelah 5 percobaan');
        return;
      }
      tryClickPlayButton();
    }, 2000);
  }, 3000);
});

function tryClickPlayButton() {
  // Berbagai selector untuk tombol play di Shopee
  const playButtonSelectors = [
    'button[aria-label*="play" i]',
    'button[aria-label*="putar" i]',
    'button.video-player__play-btn',
    'button[class*="play"]',
    '.video-player button',
    '[class*="video"] button[class*="play"]',
    'video + button',
    'button > svg[class*="play"]',
    'div[class*="video"] button'
  ];

  let clicked = false;

  for (const selector of playButtonSelectors) {
    const buttons = document.querySelectorAll(selector);

    for (const button of buttons) {
      // Cek apakah button visible dan belum di-klik
      const rect = button.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        console.log(`▶️ Menemukan tombol play dengan selector: ${selector}`);
        button.click();
        clicked = true;

        // Juga coba klik parent jika ada
        if (button.parentElement && button.parentElement.tagName === 'DIV') {
          setTimeout(() => {
            button.parentElement.click();
          }, 500);
        }

        break;
      }
    }

    if (clicked) break;
  }

  // Jika tidak menemukan button, coba klik langsung video element
  if (!clicked) {
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      if (video.paused) {
        console.log('▶️ Mencoba play video secara langsung');
        video.play().catch(err => {
          console.log('⚠️ Gagal auto-play video:', err.message);
        });
        clicked = true;
        break;
      }
    }
  }

  return clicked;
}
