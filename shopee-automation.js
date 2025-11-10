// Shopee Product Link Rotation Automation
// Script ini akan diinjeksi ke halaman Shopee untuk membuka link produk secara otomatis

(function() {
  'use strict';

  // Cegah duplikat initialization
  if (window.__shopeeAutoInitialized) {
    console.log('⚠️ Shopee automation sudah diinisialisasi');
    // Tapi tetap jalankan play button checker untuk halaman baru
    if (window.shopeeAuto && window.shopeeAuto.checkPlayButton) {
      console.log('🔍 Menjalankan play button checker untuk halaman baru...');
      window.shopeeAuto.checkPlayButton();
    }
    // Restart fallback timer untuk halaman baru
    if (window.shopeeAuto && window.shopeeAuto.restartFallbackTimer) {
      console.log('⏰ Restart fallback timer untuk halaman baru...');
      window.shopeeAuto.restartFallbackTimer();
    }
    return;
  }
  window.__shopeeAutoInitialized = true;

  // Konfigurasi
  const CONFIG = {
    INITIAL_DELAY_MS: 60000, // 60 detik (1 menit) delay sebelum mulai pertama kali
    INTERVAL_MS: 15000, // 15 detik per produk
    AUTO_START: true,    // Auto start saat halaman dimuat
    PLAY_BUTTON_CHECK_INTERVAL: 3000, // Cek tombol play setiap 3 detik (lebih lama untuk Shopee)
    MAX_PLAY_ATTEMPTS: 5, // Maksimal percobaan klik tombol play
  };

  // Data produk
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

  // State key untuk localStorage
  const STATE_KEY = 'shopee_auto_state';

  // Load state dari localStorage
  function loadState() {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn('⚠️ Gagal load state dari localStorage:', err);
    }
    return {
      currentIndex: 0,
      isRunning: false,
      isFirstStart: true,
      currentUrl: '',
      videoPlayCount: 0
    };
  }

  // Save state ke localStorage
  function saveState() {
    try {
      const state = {
        currentIndex,
        isRunning,
        isFirstStart,
        currentUrl,
        videoPlayCount
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('⚠️ Gagal save state ke localStorage:', err);
    }
  }

  // Restore state dari localStorage
  const savedState = loadState();

  // State
  let currentIndex = savedState.currentIndex;
  let rotationInterval = null;
  let playButtonInterval = null;
  let playAttempts = 0;
  let isRunning = savedState.isRunning;
  let isFirstStart = savedState.isFirstStart;
  let initialDelayTimer = null;
  let countdownInterval = null;
  let remainingDelaySeconds = 0;
  let currentUrl = savedState.currentUrl;
  let videoPlayCount = savedState.videoPlayCount;

  console.log('📂 State restored:', savedState);

  // Update UI setelah restore state
  setTimeout(() => {
    updatePanelUI();
  }, 100);

  // UI Control Panel
  function createControlPanel() {
    // Cegah duplikat panel
    if (document.getElementById('shopee-auto-panel')) {
      console.log('⚠️ Control panel sudah ada, skip create');
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'shopee-auto-panel';
    panel.innerHTML = `
      <style>
        #shopee-auto-panel {
          position: fixed;
          top: 10px;
          right: 10px;
          background: linear-gradient(135deg, #ee4d2d 0%, #ff6b3d 100%);
          color: white;
          padding: 15px;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(238, 77, 45, 0.3);
          z-index: 999999;
          font-family: Arial, sans-serif;
          min-width: 280px;
          max-width: 320px;
        }
        #shopee-auto-panel h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #shopee-auto-panel .status {
          font-size: 12px;
          margin: 8px 0;
          padding: 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 6px;
        }
        #shopee-auto-panel .controls {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        #shopee-auto-panel button {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s;
        }
        #shopee-auto-panel button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        #shopee-auto-panel .btn-play {
          background: #34d399;
          color: white;
        }
        #shopee-auto-panel .btn-pause {
          background: #fbbf24;
          color: white;
        }
        #shopee-auto-panel .btn-next {
          background: #60a5fa;
          color: white;
        }
        #shopee-auto-panel .btn-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          padding: 0;
          background: rgba(0, 0, 0, 0.3);
          color: white;
          border-radius: 50%;
          font-size: 16px;
          line-height: 24px;
        }
        #shopee-auto-panel .progress {
          font-size: 11px;
          margin-top: 8px;
          opacity: 0.9;
        }
      </style>
      <button class="btn-close" onclick="this.parentElement.remove()">×</button>
      <h3>🛍️ Shopee Auto Rotation</h3>
      <div class="status">
        <div><strong>Status:</strong> <span id="auto-status">Stopped</span></div>
        <div id="delay-info" style="display: none; color: #fbbf24; font-weight: bold;">
          ⏰ Delay: <span id="delay-countdown">60</span>s
          <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">Selesaikan captcha terlebih dahulu</div>
        </div>
        <div><strong>Produk:</strong> <span id="current-product">-</span></div>
        <div class="progress"><span id="product-progress">0/0</span></div>
      </div>
      <div class="controls">
        <button class="btn-play" id="btn-toggle">▶ Start</button>
        <button class="btn-next" id="btn-next">⏭ Next</button>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('btn-toggle').addEventListener('click', toggleRotation);
    document.getElementById('btn-next').addEventListener('click', goToNextProduct);

    updatePanelUI();
  }

  function updatePanelUI() {
    const statusEl = document.getElementById('auto-status');
    const productEl = document.getElementById('current-product');
    const progressEl = document.getElementById('product-progress');
    const toggleBtn = document.getElementById('btn-toggle');
    const delayInfo = document.getElementById('delay-info');
    const delayCountdown = document.getElementById('delay-countdown');

    if (statusEl) {
      if (remainingDelaySeconds > 0) {
        statusEl.textContent = 'Waiting ⏰';
        statusEl.style.color = '#fbbf24';
      } else {
        statusEl.textContent = isRunning ? 'Running ▶' : 'Stopped ⏹';
        statusEl.style.color = isRunning ? '#34d399' : '#fbbf24';
      }
    }

    // Show/hide delay info
    if (delayInfo) {
      delayInfo.style.display = remainingDelaySeconds > 0 ? 'block' : 'none';
    }

    if (delayCountdown) {
      delayCountdown.textContent = remainingDelaySeconds;
    }

    // Validasi index
    const safeIndex = Math.max(0, Math.min(currentIndex, PRODUCTS.length - 1));

    if (productEl) {
      const product = PRODUCTS[safeIndex];
      if (product && product.name) {
        productEl.textContent = product.name;
        console.log(`📦 Produk aktif: ${product.name} (${safeIndex + 1}/${PRODUCTS.length})`);
      } else {
        productEl.textContent = '-';
        console.warn('⚠️ Produk tidak ditemukan pada index:', safeIndex);
      }
    }

    if (progressEl) {
      if (PRODUCTS.length > 0) {
        progressEl.textContent = `${safeIndex + 1}/${PRODUCTS.length}`;
      } else {
        progressEl.textContent = '0/0';
        console.error('❌ Array PRODUCTS kosong!');
      }
    }

    if (toggleBtn) {
      if (isRunning) {
        toggleBtn.textContent = '⏸ Pause';
        toggleBtn.className = 'btn-pause';
      } else {
        toggleBtn.textContent = '▶ Start';
        toggleBtn.className = 'btn-play';
      }
    }
  }

  // Setup video ended listener untuk mendeteksi video selesai
  function setupVideoEndedListener() {
    const videos = document.querySelectorAll('video');

    videos.forEach(video => {
      // Cek apakah sudah ada listener (prevent duplikat)
      if (video.dataset.listenerAttached) return;

      video.addEventListener('ended', () => {
        videoPlayCount++;
        console.log(`🎬 Video selesai diputar (${videoPlayCount}x)`);
        saveState();

        // Jika sudah 2x selesai, pindah ke produk berikutnya
        if (videoPlayCount >= 2) {
          console.log(`⏭️ Video sudah selesai ${videoPlayCount}x, pindah ke produk berikutnya dalam 2 detik...`);

          // Stop play button checker
          if (playButtonInterval) {
            clearInterval(playButtonInterval);
            playButtonInterval = null;
          }

          // Tunggu 2 detik sebelum pindah
          setTimeout(() => {
            goToNextProduct();
          }, 2000);
        } else {
          // Video pertama selesai, tunggu video kedua auto-play atau klik play lagi
          console.log('⏳ Menunggu video kedua...');
          setTimeout(() => {
            tryClickPlayButton();
          }, 1000);
        }
      });

      // Mark bahwa listener sudah dipasang
      video.dataset.listenerAttached = 'true';
      console.log('🎧 Video ended listener terpasang');
    });
  }

  // Auto-click play button
  function tryClickPlayButton() {
    // Cek apakah URL berubah (produk baru)
    const pageUrl = window.location.href;
    if (pageUrl !== currentUrl) {
      currentUrl = pageUrl;
      videoPlayCount = 0;
      console.log('🔄 URL baru terdeteksi, reset video play count');
      saveState(); // Save state saat URL berubah
    }

    // Jika video sudah selesai 2x di URL ini, skip ke produk berikutnya
    if (videoPlayCount >= 2) {
      console.log(`⏭️ Video sudah selesai ${videoPlayCount}x di URL ini, skip...`);

      // Stop play button checker
      if (playButtonInterval) {
        clearInterval(playButtonInterval);
        playButtonInterval = null;
      }

      return true;
    }

    // Setup listener untuk mendeteksi video selesai
    setupVideoEndedListener();

    // Selector untuk tombol play Shopee (mobile & desktop)
    const playButtonSelectors = [
      // Shopee video selectors
      'button[aria-label*="play" i]',
      'button[aria-label*="putar" i]',
      'div[class*="video"] button',
      'div[class*="Video"] button',
      '[class*="video-container"] button',
      '[class*="VideoContainer"] button',
      '[class*="player"] button',
      '[class*="Player"] button',
      'button[class*="play"]',
      'button[class*="Play"]',
      '.video-player button',
      '.video-player__play-btn',
      'video + button',
      'video ~ button',
      'button > svg[class*="play"]',
      'button > svg[class*="Play"]',
      '[data-testid*="play"]',
      '[data-testid*="Play"]',
      'button[title*="play" i]',
      // Shopee specific
      'div[class*="shopee"] button',
      '[class*="product"] [class*="video"] button',
      '[class*="media"] button',
    ];

    // Coba semua selector
    for (const selector of playButtonSelectors) {
      try {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            console.log(`▶️ Auto-click tombol play dengan selector: ${selector}`);

            // Scroll ke button
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Delay sebentar lalu klik
            setTimeout(() => {
              button.click();
              console.log(`✓ Tombol play diklik, menunggu video selesai...`);
            }, 300);

            return true;
          }
        }
      } catch (err) {
        // Ignore error dan lanjut ke selector berikutnya
      }
    }

    // Fallback 1: Coba play video langsung
    try {
      const videos = document.querySelectorAll('video');
      for (const video of videos) {
        if (video.paused) {
          console.log('▶️ Auto-play video langsung (tanpa button)');
          video.play().then(() => {
            console.log(`✓ Video diputar langsung, menunggu video selesai...`);
          }).catch(err => console.log('⚠️ Gagal auto-play video:', err.message));
          return true;
        }
      }
    } catch (err) {
      console.log('⚠️ Error saat mencoba play video:', err.message);
    }

    // Fallback 2: Klik di tengah halaman (untuk trigger play jika ada overlay)
    try {
      console.log('⚠️ Tombol play tidak ditemukan, klik di tengah halaman...');
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Temukan element di tengah
      const centerElement = document.elementFromPoint(centerX, centerY);
      if (centerElement) {
        console.log(`🎯 Klik element di tengah: ${centerElement.tagName}.${centerElement.className}`);
        centerElement.click();
        console.log(`✓ Element diklik, menunggu video selesai...`);

        // Coba parent juga
        setTimeout(() => {
          if (centerElement.parentElement) {
            centerElement.parentElement.click();
            console.log('🎯 Klik parent element juga');
          }
        }, 300);

        return true;
      }
    } catch (err) {
      console.log('⚠️ Error saat klik tengah halaman:', err.message);
    }

    return false;
  }

  function startPlayButtonChecker() {
    playAttempts = 0;
    if (playButtonInterval) {
      clearInterval(playButtonInterval);
    }

    // Delay lebih lama untuk Shopee (3 detik) agar halaman sempat load
    console.log('⏳ Menunggu halaman Shopee load...');
    setTimeout(() => {
      console.log('🔍 Mulai mencari tombol play...');
      tryClickPlayButton();
    }, 3000);

    // Check setiap 3 detik (lebih lama dari sebelumnya)
    playButtonInterval = setInterval(() => {
      playAttempts++;
      if (playAttempts >= CONFIG.MAX_PLAY_ATTEMPTS) {
        clearInterval(playButtonInterval);
        console.log('⏹ Stop mencari tombol play setelah 5 percobaan');
        return;
      }
      console.log(`🔍 Percobaan ${playAttempts + 1}/${CONFIG.MAX_PLAY_ATTEMPTS} mencari tombol play...`);
      tryClickPlayButton();
    }, 3000); // 3 detik interval
  }

  // Product rotation
  function goToNextProduct() {
    if (PRODUCTS.length === 0) {
      console.error('❌ Tidak ada produk untuk rotasi!');
      return;
    }

    currentIndex = (currentIndex + 1) % PRODUCTS.length;
    const product = PRODUCTS[currentIndex];

    console.log(`🔄 Rotasi produk [${currentIndex}/${PRODUCTS.length - 1}]: ${product.name}`);
    console.log(`🔗 Link: ${product.link}`);

    // Save state sebelum navigasi
    saveState();

    updatePanelUI();

    // Navigate to product (timer akan di-restart otomatis setelah navigasi)
    window.location.href = product.link;
  }

  function startCountdown() {
    remainingDelaySeconds = Math.ceil(CONFIG.INITIAL_DELAY_MS / 1000);
    updatePanelUI();

    countdownInterval = setInterval(() => {
      remainingDelaySeconds--;
      updatePanelUI();

      if (remainingDelaySeconds <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }, 1000);
  }

  // Set fallback timer untuk rotasi otomatis (jika video tidak terdeteksi)
  function setFallbackTimer() {
    // Clear timer lama jika ada
    if (rotationInterval) {
      clearInterval(rotationInterval);
      rotationInterval = null;
    }

    if (!isRunning) {
      console.log('⏹ Automation tidak running, skip set fallback timer');
      return;
    }

    // Set timer baru
    rotationInterval = setInterval(() => {
      console.log('⏰ Fallback timer: Pindah ke produk berikutnya (video mungkin tidak terdeteksi)');
      goToNextProduct();
    }, CONFIG.INTERVAL_MS * 4); // 60 detik (15 x 4) sebagai fallback

    console.log(`⏰ Fallback timer diset: ${CONFIG.INTERVAL_MS * 4 / 1000} detik`);
  }

  function startActualRotation() {
    console.log('🚀 Memulai rotasi produk...');

    // Start dengan produk pertama jika belum ada
    if (currentIndex === 0 && !window.location.href.includes('shp.ee')) {
      goToNextProduct();
    } else {
      // Sudah di halaman produk, langsung mulai checker
      startPlayButtonChecker();
      // Set fallback timer
      setFallbackTimer();
    }

    updatePanelUI();
  }

  function startRotation() {
    if (isRunning) return;

    isRunning = true;
    console.log('▶️ Start Shopee Auto Rotation');

    // Jika ini adalah start pertama kali, berikan delay untuk captcha
    if (isFirstStart) {
      console.log(`⏰ Delay ${CONFIG.INITIAL_DELAY_MS / 1000} detik untuk menyelesaikan captcha...`);
      isFirstStart = false;
      remainingDelaySeconds = Math.ceil(CONFIG.INITIAL_DELAY_MS / 1000);

      saveState(); // Save state setelah isFirstStart dan isRunning berubah

      startCountdown();
      updatePanelUI();

      // Setelah delay, mulai rotasi
      initialDelayTimer = setTimeout(() => {
        startActualRotation();
      }, CONFIG.INITIAL_DELAY_MS);
    } else {
      // Bukan first start, langsung mulai
      saveState(); // Save state setelah isRunning berubah
      startActualRotation();
    }

    updatePanelUI();
  }

  function stopRotation() {
    if (!isRunning) return;

    isRunning = false;
    console.log('⏹ Stop Shopee Auto Rotation');

    // Clear all timers and intervals
    if (rotationInterval) {
      clearInterval(rotationInterval);
      rotationInterval = null;
    }

    if (playButtonInterval) {
      clearInterval(playButtonInterval);
      playButtonInterval = null;
    }

    if (initialDelayTimer) {
      clearTimeout(initialDelayTimer);
      initialDelayTimer = null;
    }

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Reset delay countdown
    remainingDelaySeconds = 0;

    saveState(); // Save state setelah isRunning berubah

    updatePanelUI();
  }

  function toggleRotation() {
    if (isRunning) {
      stopRotation();
    } else {
      startRotation();
    }
  }

  // Initialize
  function init() {
    console.log('🛍️ Shopee Automation Script loaded');

    // Tunggu sampai DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createControlPanel();
        // Jika automation sedang running (dari saved state), restart
        if (isRunning) {
          console.log('♻️ Melanjutkan automation yang sedang running...');
          setTimeout(() => {
            startPlayButtonChecker();
            setFallbackTimer();
          }, 2000);
        } else if (CONFIG.AUTO_START && isFirstStart) {
          // Hanya auto start jika first start dan AUTO_START = true
          setTimeout(startRotation, 2000);
        }
      });
    } else {
      createControlPanel();
      // Jika automation sedang running (dari saved state), restart
      if (isRunning) {
        console.log('♻️ Melanjutkan automation yang sedang running...');
        setTimeout(() => {
          startPlayButtonChecker();
          setFallbackTimer();
        }, 2000);
      } else if (CONFIG.AUTO_START && isFirstStart) {
        // Hanya auto start jika first start dan AUTO_START = true
        setTimeout(startRotation, 2000);
      }
    }

    // Setiap kali halaman baru dimuat (navigasi), coba klik play button jika running
    if (isRunning) {
      startPlayButtonChecker();
    }
  }

  // Run
  init();

  // Reset automation (untuk restart dengan delay lagi)
  function resetAutomation() {
    stopRotation();
    isFirstStart = true;
    currentIndex = 0;
    videoPlayCount = 0;
    currentUrl = '';
    console.log('🔄 Automation reset. Start lagi akan menerapkan delay.');
    saveState(); // Save state setelah reset
    updatePanelUI();
  }

  // Clear state dari localStorage
  function clearState() {
    try {
      localStorage.removeItem(STATE_KEY);
      console.log('🗑️ State cleared dari localStorage');
    } catch (err) {
      console.warn('⚠️ Gagal clear state:', err);
    }
  }

  // Expose to window for manual control
  window.shopeeAuto = {
    start: startRotation,
    stop: stopRotation,
    toggle: toggleRotation,
    next: goToNextProduct,
    reset: resetAutomation,
    clearState: clearState, // Clear localStorage
    checkPlayButton: startPlayButtonChecker, // Untuk dipanggil saat navigasi halaman baru
    restartFallbackTimer: setFallbackTimer, // Untuk restart fallback timer setelah navigasi
    setInterval: (ms) => { CONFIG.INTERVAL_MS = ms; },
    setInitialDelay: (ms) => { CONFIG.INITIAL_DELAY_MS = ms; },
    getProducts: () => PRODUCTS,
    getCurrentIndex: () => currentIndex,
    isRunning: () => isRunning,
    getRemainingDelay: () => remainingDelaySeconds,
    getVideoPlayCount: () => videoPlayCount,
    getState: () => ({ currentIndex, isRunning, isFirstStart, currentUrl, videoPlayCount }) // Debug: lihat state terkini
  };

})();
