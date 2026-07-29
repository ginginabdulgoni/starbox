// android-manager.js
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { app } = require('electron');
const extractZip = require('extract-zip');
const { spawn } = require('child_process');

class AndroidManager {
  constructor(userDataPath = null) {
    this.emulatorProcess = null;
    this.adbProcess = null;
    this.userDataPath = userDataPath;
    this.emulatorPath = null;
    this.avdPath = null;
    this.sdkPath = null;
    this.downloadProgress = 0;
    this.isDownloading = false;
    this.activeDownloadPromise = null;
    this.downloadProgressCallbacks = new Set();

    // Platform specific paths
    this.platform = process.platform;
    this.isWin = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';

    // Check if Mac is Apple Silicon
    this.isAppleSilicon = this.isMac && process.arch === 'arm64';
  }

  sanitizeAvdName(name = 'StarBox_Default') {
    const normalized = (name || 'StarBox_Default')
      .toString()
      .replace(/[^a-zA-Z0-9_\-]+/g, '_')
      .slice(0, 32);
    return normalized || 'StarBox_Default';
  }

  getEmulatorTempDir() {
    const base =
      (os.tmpdir && os.tmpdir()) ||
      (app.getPath && app.getPath('temp')) ||
      path.join(this.emulatorPath || app.getPath('userData'), 'tmp');

    // Remove trailing slashes/backslashes to prevent double backslash
    const cleanBase = base.replace(/[\\/]+$/, '');

    // Build path and normalize for Windows
    const tempPath = path.join(cleanBase, 'AndroidEmulator');

    // Final normalization and replace any double backslashes
    const normalized = path.normalize(tempPath);

    // Extra safety: replace any remaining double backslashes on Windows
    return this.isWin ? normalized.replace(/\\\\/g, '\\') : normalized;
  }

  ensureTempCrashDirectories() {
    try {
      const tempDir = this.getEmulatorTempDir();
      // Normalize path to avoid double backslashes on Windows
      const normalizedTempDir = path.normalize(tempDir);
      fs.mkdirSync(normalizedTempDir, { recursive: true });

      // Remove stale crash databases left by a previous crash. Otherwise
      // crashpad keeps reprocessing them on the next launch and floods the log
      // with "GetFileAttributes ... cannot find the file" errors that mask the
      // real failure reason.
      try {
        fs.readdirSync(normalizedTempDir).forEach((entry) => {
          if (/^emu-crash/i.test(entry)) {
            fs.rmSync(path.join(normalizedTempDir, entry), {
              recursive: true,
              force: true,
            });
          }
        });
      } catch (_) {}

      const candidates = [
        path.join(normalizedTempDir, 'emu-crash'),
        path.join(normalizedTempDir, 'emu-crash-33.1.24.db'),
      ];
      candidates.forEach((root) => {
        const attachments = path.join(root, 'attachments');
        fs.mkdirSync(attachments, { recursive: true });
      });
      const updateIni = path.join(normalizedTempDir, 'emu-update-last-check.ini');
      if (!fs.existsSync(updateIni)) {
        fs.writeFileSync(updateIni, 'lastCheck=0\n', 'utf8');
      }
      const homeDir = path.join(normalizedTempDir, 'home');
      fs.mkdirSync(homeDir, { recursive: true });
      return { tempDir: normalizedTempDir, homeDir };
    } catch (err) {
      console.warn('⚠️ Tidak dapat membuat folder temp emulator:', err.message);
    }
    const tempDir = this.getEmulatorTempDir();
    const normalizedTempDir = path.normalize(tempDir);
    return {
      tempDir: normalizedTempDir,
      homeDir: path.join(normalizedTempDir, 'home'),
    };
  }

  getDefaultSpec() {
    return {
      id: 'balanced',
      label: 'Balanced • 2 Core • 1.5 GB',
      memoryMb: 1536,
      cores: 2,
      resolution: '720x1280',
      density: 265,
    };
  }

  normalizeSpec(spec) {
    const base = this.getDefaultSpec();
    if (!spec || typeof spec !== 'object') {
      return { ...base };
    }
    const normalized = { ...base };
    const mem = parseInt(spec.memoryMb, 10);
    if (Number.isFinite(mem)) {
      normalized.memoryMb = Math.min(Math.max(mem, 512), 4096);
    }
    const cores = parseInt(spec.cores, 10);
    if (Number.isFinite(cores)) {
      normalized.cores = Math.min(Math.max(cores, 1), 8);
    }
    if (spec.resolution) {
      const match = String(spec.resolution)
        .toLowerCase()
        .match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        normalized.resolution = `${match[1]}x${match[2]}`;
      }
    }
    const density = parseInt(spec.density, 10);
    if (Number.isFinite(density)) {
      normalized.density = Math.min(Math.max(density, 120), 640);
    }
    normalized.id = spec.id || normalized.id;
    normalized.label = spec.label || normalized.label;
    return normalized;
  }

  parseResolution(resolution = '720x1280') {
    const match = String(resolution)
      .toLowerCase()
      .match(/(\d+)\s*x\s*(\d+)/);
    if (!match) {
      return { width: 720, height: 1280 };
    }
    return { width: Number(match[1]), height: Number(match[2]) };
  }

  getProcessEnv() {
    this.initializePaths();
    const env = { ...process.env };
    env.ANDROID_SDK_ROOT = this.sdkPath;
    env.ANDROID_HOME = this.sdkPath;
    env.ANDROID_SDK_HOME = this.emulatorPath;
    env.ANDROID_AVD_HOME = this.avdPath;
    const emulatorDir = path.join(this.sdkPath, 'emulator');
    const platformToolsDir = path.join(this.sdkPath, 'platform-tools');
    const currentPath = env.PATH || env.Path || '';
    env.PATH = [emulatorDir, platformToolsDir, currentPath]
      .filter(Boolean)
      .join(path.delimiter);
    if (env.Path) {
      env.Path = env.PATH;
    }
    return env;
  }

  spawnAdb(args = [], options = {}) {
    return spawn(this.getADBBinary(), args, {
      env: this.getProcessEnv(),
      ...options,
    });
  }

  runAdbCommand(args = [], { timeout = 20000, silent = false } = {}) {
    return new Promise((resolve, reject) => {
      const adb = this.spawnAdb(args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        adb.kill('SIGKILL');
        reject(new Error(`ADB command timeout: ${args.join(' ')}`));
      }, timeout);

      adb.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (!silent && text.trim()) {
          console.log(`[ADB stdout] ${text.trim()}`);
        }
      });

      adb.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (!silent && text.trim()) {
          console.warn(`[ADB stderr] ${text.trim()}`);
        }
      });

      adb.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `ADB exited with code ${code}`));
        }
      });

      adb.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async listConnectedDevices() {
    try {
      const output = await this.runAdbCommand(['devices', '-l'], {
        timeout: 15000,
        silent: true,
      });
      const lines = output.split(/\r?\n/);
      const devices = [];
      lines.forEach((raw) => {
        const line = raw.trim();
        if (
          !line ||
          line.toLowerCase().includes('list of devices attached') ||
          line.startsWith('* daemon')
        ) {
          return;
        }
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length < 2) return;
        const adbId = parts.shift();
        const status = parts.shift();
        const meta = {};
        parts.forEach((token) => {
          const [key, value] = token.split(':');
          if (key && value) {
            meta[key.toLowerCase()] = value;
          }
        });
        devices.push({
          adbId,
          status,
          model: meta.model || null,
          product: meta.product || null,
          device: meta.device || null,
          transportId: meta.transport_id || null,
          description: meta.model || meta.device || adbId,
        });
      });
      return devices;
    } catch (err) {
      console.warn('⚠️ Gagal mendapatkan daftar perangkat ADB:', err.message);
      return [];
    }
  }

  /**
   * Kill ADB server to fix "device offline" or "busy" errors
   */
  async killAdbServer() {
    // On Windows, running the bundled adb.exe to "kill-server" re-locks the very
    // file we may need to overwrite during extraction, and Windows keeps the
    // handle briefly after the process exits — causing EBUSY on adb.exe. Force
    // kill every adb.exe with taskkill instead, then wait for the lock to clear.
    if (this.isWin) {
      const { execSync } = require('child_process');
      try {
        execSync('taskkill /F /IM adb.exe /T', { stdio: 'pipe' });
        console.log('✅ ADB process force killed on Windows');
      } catch (winError) {
        // Exit code 128 / "not found" just means no adb.exe was running.
        const msg = winError?.message || '';
        if (!/not found|tidak ditemukan|128/i.test(msg)) {
          console.warn('⚠️ taskkill adb.exe warning:', msg);
        }
      }
      // Give Windows time to release the file handle on adb.exe.
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { success: true };
    }

    try {
      console.log('🔪 Killing ADB server...');
      await this.runAdbCommand(['kill-server'], { timeout: 10000, silent: true });
      console.log('✅ ADB server killed successfully');
      return { success: true };
    } catch (error) {
      console.warn('⚠️ Failed to kill ADB server:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restart ADB server
   */
  async restartAdbServer() {
    try {
      console.log('🔄 Restarting ADB server...');
      await this.killAdbServer();
      // Wait a bit before starting
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.runAdbCommand(['start-server'], { timeout: 15000, silent: false });
      console.log('✅ ADB server restarted successfully');
      return { success: true };
    } catch (error) {
      console.warn('⚠️ Failed to restart ADB server:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix common emulator/ADB issues
   */
  async fixEmulatorIssues(progressCallback) {
    const emitProgress = (payload = {}) => {
      if (typeof progressCallback === 'function') {
        try {
          progressCallback({
            timestamp: Date.now(),
            ...payload,
          });
        } catch (callbackError) {
          console.error('Fix progress callback error:', callbackError.message);
        }
      }
    };

    try {
      emitProgress({
        phase: 'fix-start',
        message: 'Memulai perbaikan emulator...',
      });

      // Kill ADB server
      emitProgress({
        phase: 'fix-adb',
        message: 'Menghentikan ADB server...',
      });
      await this.killAdbServer();

      // Clean temp crash directories
      emitProgress({
        phase: 'fix-temp',
        message: 'Membersihkan direktori temporary...',
      });
      this.ensureTempCrashDirectories();

      // Restart ADB server
      emitProgress({
        phase: 'fix-restart',
        message: 'Memulai ulang ADB server...',
      });
      await this.restartAdbServer();

      emitProgress({
        phase: 'fix-done',
        message: 'Perbaikan selesai!',
      });

      return { success: true, message: 'Emulator berhasil diperbaiki' };
    } catch (error) {
      emitProgress({
        phase: 'fix-error',
        message: `Gagal memperbaiki: ${error.message}`,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize paths (call this after app is ready)
   */
  initializePaths() {
    if (this.emulatorPath) return; // Already initialized

    const basePath = this.userDataPath || app.getPath('userData');
    this.emulatorPath = path.join(basePath, 'android-emulator');
    this.avdPath = path.join(this.emulatorPath, 'avd');
    this.sdkPath = path.join(this.emulatorPath, 'sdk');
  }

  /**
   * Guest ABI matching the host CPU (Apple Silicon runs arm64 images natively)
   */
  getGuestAbi() {
    return this.isAppleSilicon ? 'arm64-v8a' : 'x86_64';
  }

  getGuestCpuArch() {
    return this.isAppleSilicon ? 'arm64' : 'x86_64';
  }

  /**
   * System image variant: Google Play images include the Play Store app,
   * plain google_apis images only ship Play Services.
   */
  getImageTag() {
    return 'google_apis_playstore';
  }

  getSystemImagesDir() {
    this.initializePaths();
    return path.join(this.sdkPath, 'system-images', 'android-30', this.getImageTag(), this.getGuestAbi());
  }

  /**
   * Check if emulator is already installed
   */
  isInstalled() {
    this.initializePaths();
    const emulatorBin = this.getEmulatorBinary();
    const adbBin = this.getADBBinary();
    const platformsDir = path.join(this.sdkPath, 'platforms', 'android-30');
    const systemImage = path.join(this.getSystemImagesDir(), 'system.img');
    return (
      fs.existsSync(emulatorBin) &&
      fs.existsSync(adbBin) &&
      fs.existsSync(platformsDir) &&
      fs.existsSync(systemImage)
    );
  }

  /**
   * Whether a single download component is already present on disk. Used to make
   * (re)installs idempotent — a partial install only fetches what is missing and
   * never re-extracts over files that may be locked (e.g. a running adb.exe).
   */
  componentPresent(name) {
    this.initializePaths();
    switch (name) {
      case 'Emulator':
        return fs.existsSync(this.getEmulatorBinary());
      case 'Platform Tools':
        return fs.existsSync(this.getADBBinary());
      case 'Platform':
        return fs.existsSync(path.join(this.sdkPath, 'platforms', 'android-30'));
      case 'System Image':
        return fs.existsSync(path.join(this.getSystemImagesDir(), 'system.img'));
      default:
        return false;
    }
  }

  /**
   * Fix missing platforms directory for existing installations
   */
  async fixMissingPlatforms(progressCallback) {
    this.initializePaths();
    const platformsDir = path.join(this.sdkPath, 'platforms', 'android-30');

    if (fs.existsSync(platformsDir)) {
      return { success: true, message: 'Platforms directory already exists' };
    }

    const emitProgress = (payload = {}) => {
      if (typeof progressCallback === 'function') {
        try {
          progressCallback({
            timestamp: Date.now(),
            ...payload,
          });
        } catch (callbackError) {
          console.error('Progress callback error:', callbackError.message);
        }
      }
    };

    try {
      emitProgress({
        phase: 'download',
        component: 'Platform',
        message: 'Downloading missing platform package...',
      });

      const baseUrl = 'https://dl.google.com/android/repository';
      const platformZip = path.join(this.sdkPath, 'platform.zip');

      await this.downloadFile(
        `${baseUrl}/platform-30_r03.zip`,
        platformZip,
        (stats = {}) => {
          const componentProgress = typeof stats.percent === 'number'
            ? Math.max(0, Math.min(100, Math.round(stats.percent)))
            : null;

          emitProgress({
            phase: 'download',
            component: 'Platform',
            overallProgress: componentProgress,
            bytesDownloaded: stats.downloadedBytes ?? null,
            totalBytes: stats.totalBytes ?? null,
            message: 'Downloading platform package',
          });
        }
      );

      emitProgress({
        phase: 'extract',
        component: 'Platform',
        message: 'Extracting platform package...',
      });

      if (!fs.existsSync(platformsDir)) {
        fs.mkdirSync(platformsDir, { recursive: true });
      }

      await this.extractZip(platformZip, platformsDir, (msg) => {
        emitProgress({
          phase: 'extract',
          component: 'Platform',
          message: msg,
        });
      });

      fs.unlinkSync(platformZip);

      emitProgress({
        phase: 'done',
        component: 'Platform',
        message: 'Platform package installed successfully',
      });

      return { success: true, message: 'Platform package installed' };
    } catch (error) {
      emitProgress({
        phase: 'error',
        component: 'Platform',
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Get emulator binary path based on platform
   */
  getEmulatorBinary() {
    this.initializePaths();
    const binPath = path.join(this.sdkPath, 'emulator');
    if (this.isWin) return path.join(binPath, 'emulator.exe');
    return path.join(binPath, 'emulator');
  }

  /**
   * Get ADB binary path based on platform
   */
  getADBBinary() {
    this.initializePaths();
    const binPath = path.join(this.sdkPath, 'platform-tools');
    if (this.isWin) return path.join(binPath, 'adb.exe');
    return path.join(binPath, 'adb');
  }

  /**
   * Download and setup Android emulator
   */
  async downloadAndSetup(progressCallback) {
    this.initializePaths();

    if (typeof progressCallback === 'function') {
      this.downloadProgressCallbacks.add(progressCallback);
    }

    if (!this.activeDownloadPromise) {
      this.activeDownloadPromise = this._downloadAndSetup().finally(() => {
        this.activeDownloadPromise = null;
      });
    }

    try {
      return await this.activeDownloadPromise;
    } finally {
      if (typeof progressCallback === 'function') {
        this.downloadProgressCallbacks.delete(progressCallback);
      }
    }
  }

  async _downloadAndSetup() {
    this.isDownloading = true;
    this.downloadProgress = 0;

    const emitProgress = (payload = {}) => {
      const progress = {
        timestamp: Date.now(),
        ...payload,
      };
      for (const callback of this.downloadProgressCallbacks) {
        try {
          callback(progress);
        } catch (callbackError) {
          console.error('Progress callback error:', callbackError.message);
        }
      }
    };

    try {
      // Kill any existing ADB server to prevent "busy" errors
      emitProgress({
        phase: 'prepare',
        component: 'ADB Cleanup',
        overallProgress: 0,
        message: 'Membersihkan ADB server yang masih berjalan...',
      });

      try {
        await this.killAdbServer();
      } catch (adbError) {
        console.warn('⚠️ Failed to kill ADB during setup:', adbError.message);
        // Continue anyway, not critical
      }

      emitProgress({
        phase: 'prepare',
        component: 'Directories',
        overallProgress: 0,
        message: 'Preparing directories...',
      });

      await this.createDirectories();

      emitProgress({
        phase: 'prepare',
        component: 'Directories',
        overallProgress: 1,
        message: 'Directory preparation complete',
      });

      // Download emulator components based on platform. Skip anything already on
      // disk so a partial install only fetches what is missing and never
      // re-extracts over locked files (e.g. a running adb.exe → EBUSY on Windows).
      const allDownloads = await this.getDownloadUrls();
      const downloads = allDownloads.filter((download) => {
        if (this.componentPresent(download.name)) {
          console.log(`✓ ${download.name} already installed, skipping download`);
          return false;
        }
        return true;
      });
      const totalStages = downloads.length + 2; // downloads + extraction + AVD setup
      const stageWeight = totalStages > 0 ? 100 / totalStages : 100;
      let completedStages = 0;

      for (const download of downloads) {
        const stageBase = completedStages * stageWeight;

        emitProgress({
          phase: 'download',
          component: download.name,
          overallProgress: Math.min(100, stageBase),
          message: `Downloading ${download.name}...`,
        });

        await this.downloadFile(download.url, download.dest, (stats = {}) => {
          const componentProgress =
            typeof stats.percent === 'number'
              ? Math.max(0, Math.min(100, Math.round(stats.percent)))
              : null;
          const overallProgress =
            componentProgress != null
              ? Math.min(
                  100,
                  Number(
                    (stageBase + (componentProgress / 100) * stageWeight).toFixed(2)
                  )
                )
              : Math.min(
                  100,
                  Number((stageBase + stageWeight * 0.25).toFixed(2))
                );

          this.downloadProgress = overallProgress;

          emitProgress({
            phase: 'download',
            component: download.name,
            overallProgress,
            bytesDownloaded: stats.downloadedBytes ?? null,
            totalBytes: stats.totalBytes ?? null,
            message: `Downloading ${download.name}`,
          });
        });

        completedStages += 1;
        const stageCompletion = Math.min(
          100,
          Number((completedStages * stageWeight).toFixed(2))
        );
        this.downloadProgress = stageCompletion;

        emitProgress({
          phase: 'download',
          component: download.name,
          overallProgress: stageCompletion,
          message: `${download.name} download complete`,
        });
      }

      const extractionBase = completedStages * stageWeight;
      emitProgress({
        phase: 'extract',
        component: 'Packages',
        overallProgress: Math.min(99, Number(extractionBase.toFixed(2))),
        message: 'Extracting emulator packages...',
      });

      await this.extractAndSetup((component, message) => {
        emitProgress({
          phase: 'extract',
          component,
          overallProgress: Math.min(
            99,
            Number((extractionBase + stageWeight * 0.5).toFixed(2))
          ),
          message,
        });
      });

      completedStages += 1;
      this.downloadProgress = Math.min(
        100,
        Number((completedStages * stageWeight).toFixed(2))
      );

      emitProgress({
        phase: 'extract',
        component: 'Packages',
        overallProgress: this.downloadProgress,
        message: 'Extraction complete',
      });
      this.ensureSystemImageLayout();

      const setupBase = completedStages * stageWeight;
      emitProgress({
        phase: 'setup',
        component: 'AVD',
        overallProgress: Math.min(99, Number(setupBase.toFixed(2))),
        message: 'Creating default Android Virtual Device...',
      });

      await this.createDefaultAVD('StarBox_Default', null, (message) => {
        emitProgress({
          phase: 'setup',
          component: 'AVD',
          overallProgress: Math.min(
            99,
            Number((setupBase + stageWeight * 0.5).toFixed(2))
          ),
          message,
        });
      });

      completedStages += 1;
      this.downloadProgress = Math.min(
        100,
        Number((completedStages * stageWeight).toFixed(2))
      );

      emitProgress({
        phase: 'setup',
        component: 'AVD',
        overallProgress: this.downloadProgress,
        message: 'AVD setup complete',
      });

      this.downloadProgress = 100;
      emitProgress({
        phase: 'done',
        component: 'All',
        overallProgress: 100,
        message: 'Android emulator ready to launch',
      });

      this.isDownloading = false;
      return { success: true };
    } catch (error) {
      this.isDownloading = false;
      emitProgress({
        phase: 'error',
        component: 'All',
        overallProgress: this.downloadProgress,
        message: error.message,
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }
  }

  /**
   * Create necessary directories
   */
  async createDirectories() {
    const dirs = [this.emulatorPath, this.avdPath, this.sdkPath];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Get download URLs based on platform
   */
  async getDownloadUrls() {
    // Using lightweight Android x86 approach
    // These are placeholder URLs - you'll need to host or use actual Android SDK URLs
    const baseUrl = 'https://dl.google.com/android/repository';

    const urls = [];

    if (this.isMac) {
      // Apple Silicon needs the native arm64 emulator + arm64-v8a system image.
      // Running the x86_64 stack under Rosetta has no hypervisor acceleration
      // and results in a black screen / never finishing boot.
      const emulatorArch = this.isAppleSilicon ? 'aarch64' : 'x64';
      const systemImageFile = this.isAppleSilicon
        ? 'arm64-v8a-30_r10-darwin.zip'
        : 'x86_64-30_r10-darwin.zip';
      urls.push({
        name: 'Emulator',
        url: `${baseUrl}/emulator-darwin_${emulatorArch}-11237101.zip`,
        dest: path.join(this.sdkPath, 'emulator.zip')
      });
      urls.push({
        name: 'Platform Tools',
        url: `${baseUrl}/platform-tools-latest-darwin.zip`,
        dest: path.join(this.sdkPath, 'platform-tools.zip')
      });
      urls.push({
        name: 'Platform',
        url: `${baseUrl}/platform-30_r03.zip`,
        dest: path.join(this.sdkPath, 'platform.zip')
      });
      urls.push({
        name: 'System Image',
        url: `${baseUrl}/sys-img/google_apis_playstore/${systemImageFile}`,
        dest: path.join(this.sdkPath, 'system-image.zip')
      });
    } else if (this.isWin) {
      urls.push({
        name: 'Emulator',
        url: `${baseUrl}/emulator-windows_x64-11237101.zip`,
        dest: path.join(this.sdkPath, 'emulator.zip')
      });
      urls.push({
        name: 'Platform Tools',
        url: `${baseUrl}/platform-tools-latest-windows.zip`,
        dest: path.join(this.sdkPath, 'platform-tools.zip')
      });
      urls.push({
        name: 'Platform',
        url: `${baseUrl}/platform-30_r03.zip`,
        dest: path.join(this.sdkPath, 'platform.zip')
      });
      urls.push({
        name: 'System Image',
        url: `${baseUrl}/sys-img/google_apis_playstore/x86_64-30_r10-windows.zip`,
        dest: path.join(this.sdkPath, 'system-image.zip')
      });
    } else {
      urls.push({
        name: 'Emulator',
        url: `${baseUrl}/emulator-linux_x64-11237101.zip`,
        dest: path.join(this.sdkPath, 'emulator.zip')
      });
      urls.push({
        name: 'Platform Tools',
        url: `${baseUrl}/platform-tools-latest-linux.zip`,
        dest: path.join(this.sdkPath, 'platform-tools.zip')
      });
      urls.push({
        name: 'Platform',
        url: `${baseUrl}/platform-30_r03.zip`,
        dest: path.join(this.sdkPath, 'platform.zip')
      });
      urls.push({
        name: 'System Image',
        url: `${baseUrl}/sys-img/google_apis_playstore/x86_64-30_r10-linux.zip`,
        dest: path.join(this.sdkPath, 'system-image.zip')
      });
    }

    return urls;
  }

  /**
   * Download a file with progress
   */
  downloadFile(url, destination, progressCallback) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);

      const handleError = (err) => {
        file.close(() => {
          fs.unlink(destination, () => {});
          reject(err);
        });
      };

      const request = https.get(url, (response) => {
        if ([301, 302, 307, 308].includes(response.statusCode)) {
          const location = response.headers.location;
          if (!location) {
            handleError(new Error('Download redirected without location header'));
            return;
          }
          response.resume();
          file.close(() => {
            fs.unlink(destination, () => {
              this.downloadFile(location, destination, progressCallback)
                .then(resolve)
                .catch(reject);
            });
          });
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          handleError(
            new Error(`Download failed with status code ${response.statusCode}`)
          );
          return;
        }

        const totalHeader = response.headers['content-length'];
        const totalBytes =
          totalHeader && !Number.isNaN(Number.parseInt(totalHeader, 10))
            ? Number.parseInt(totalHeader, 10)
            : null;
        let downloadedBytes = 0;

        if (typeof progressCallback === 'function') {
          progressCallback({
            status: 'start',
            percent: totalBytes ? 0 : null,
            downloadedBytes,
            totalBytes,
          });
        }

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent =
            totalBytes && totalBytes > 0
              ? Math.min(
                  100,
                  Math.round((downloadedBytes / totalBytes) * 100)
                )
              : null;

          if (typeof progressCallback === 'function') {
            progressCallback({
              status: 'progress',
              percent,
              downloadedBytes,
              totalBytes,
            });
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            if (typeof progressCallback === 'function') {
              progressCallback({
                status: 'finished',
                percent: 100,
                downloadedBytes,
                totalBytes,
              });
            }
            resolve();
          });
        });

        file.on('error', handleError);
      });

      request.on('error', handleError);
      request.setTimeout(30000, () => {
        request.destroy(new Error('Download timed out: no data received for 30 seconds'));
      });
    });
  }

  /**
   * Extract downloaded files
   */
  async extractAndSetup(statusCallback = null) {
    console.log('Extracting emulator files...');

    const notify = (component, message) => {
      if (typeof statusCallback !== 'function') return;
      try {
        statusCallback(component, message);
      } catch (callbackError) {
        console.error('Extraction callback error:', callbackError.message);
      }
    };

    try {
      // Extract emulator
      const emulatorZip = path.join(this.sdkPath, 'emulator.zip');
      if (fs.existsSync(emulatorZip)) {
        console.log('Extracting emulator...');
        notify('Emulator', 'Extracting emulator package...');
        await this.extractZip(emulatorZip, this.sdkPath, (msg) =>
          notify('Emulator', msg)
        );
        fs.unlinkSync(emulatorZip); // Remove zip after extraction
        notify('Emulator', 'Emulator package extracted');
      }

      // Extract platform-tools
      const platformToolsZip = path.join(this.sdkPath, 'platform-tools.zip');
      if (fs.existsSync(platformToolsZip)) {
        console.log('Extracting platform-tools...');
        notify('Platform Tools', 'Extracting platform tools...');
        await this.extractZip(platformToolsZip, this.sdkPath, (msg) =>
          notify('Platform Tools', msg)
        );
        fs.unlinkSync(platformToolsZip);
        notify('Platform Tools', 'Platform tools extracted');
      }

      // Extract platform
      const platformZip = path.join(this.sdkPath, 'platform.zip');
      if (fs.existsSync(platformZip)) {
        console.log('Extracting platform...');
        notify('Platform', 'Extracting platform package...');
        const platformsPath = path.join(this.sdkPath, 'platforms', 'android-30');
        if (!fs.existsSync(platformsPath)) {
          fs.mkdirSync(platformsPath, { recursive: true });
        }
        await this.extractZip(platformZip, platformsPath, (msg) =>
          notify('Platform', msg)
        );
        fs.unlinkSync(platformZip);
        notify('Platform', 'Platform package extracted');
      }

      // Extract system image
      const systemImageZip = path.join(this.sdkPath, 'system-image.zip');
      if (fs.existsSync(systemImageZip)) {
        console.log('Extracting system image...');
        notify('System Image', 'Extracting system image...');
        const systemImagesPath = this.getSystemImagesDir();
        if (!fs.existsSync(systemImagesPath)) {
          fs.mkdirSync(systemImagesPath, { recursive: true });
        }
        await this.extractZip(systemImageZip, systemImagesPath, (msg) =>
          notify('System Image', msg)
        );
        // Some archives contain an extra nested ABI directory.
        const nestedAbi = path.join(systemImagesPath, this.getGuestAbi());
        if (fs.existsSync(nestedAbi) && fs.lstatSync(nestedAbi).isDirectory()) {
          const nestedEntries = fs.readdirSync(nestedAbi);
          nestedEntries.forEach((entry) => {
            const src = path.join(nestedAbi, entry);
            const dest = path.join(systemImagesPath, entry);
            fs.renameSync(src, dest);
          });
          fs.rmSync(nestedAbi, { recursive: true, force: true });
        }
        fs.unlinkSync(systemImageZip);
        notify('System Image', 'System image extracted');
      }

      // Set executable permissions on Unix-like systems
      if (!this.isWin) {
        const emulatorBin = this.getEmulatorBinary();
        const adbBin = this.getADBBinary();

        if (fs.existsSync(emulatorBin)) {
          notify('Permissions', 'Updating emulator permissions...');
          fs.chmodSync(emulatorBin, 0o755);
        }
        if (fs.existsSync(adbBin)) {
          notify('Permissions', 'Updating platform-tools permissions...');
          fs.chmodSync(adbBin, 0o755);
        }
      }

      console.log('Extraction completed successfully');
      notify('Extraction', 'All packages extracted successfully');
    } catch (error) {
      console.error('Error during extraction:', error);
      throw error;
    }
  }

  /**
   * Create default AVD configuration
   */
  /**
   * Remove stale AVD lock files/dirs left behind by a crashed emulator. Without
   * this the next launch fails with "Please use -read-only flag to enable this
   * feature" because the emulator thinks another instance still owns the AVD.
   * Safe to call because StarBox only runs one emulator instance at a time.
   */
  cleanAvdLocks(avdName = 'StarBox_Default') {
    try {
      const avdDir = path.join(this.avdPath, `${this.sanitizeAvdName(avdName)}.avd`);
      if (!fs.existsSync(avdDir)) return;
      fs.readdirSync(avdDir).forEach((entry) => {
        // Locks are usually *.lock (files) or directories like
        // hardware-qemu.ini.lock / multiinstance.lock / snapshot.lock.
        if (/\.lock$/i.test(entry)) {
          try {
            fs.rmSync(path.join(avdDir, entry), { recursive: true, force: true });
            console.log(`🧹 Menghapus lock AVD basi: ${entry}`);
          } catch (_) {}
        }
      });
    } catch (err) {
      console.warn('⚠️ Gagal membersihkan lock AVD:', err.message);
    }
  }

  async createDefaultAVD(avdName = 'StarBox_Default', spec = null, statusCallback = null) {
    avdName = this.sanitizeAvdName(avdName);
    const avdDir = path.join(this.avdPath, `${avdName}.avd`);
    const avdIni = path.join(this.avdPath, `${avdName}.ini`);
    const resolvedSpec = this.normalizeSpec(spec);
    const { width, height } = this.parseResolution(resolvedSpec.resolution);
    const heapSize = Math.max(
      228,
      Math.min(768, Math.round(resolvedSpec.memoryMb * 0.4))
    );

    const notify = (message) => {
      if (typeof statusCallback !== 'function') return;
      try {
        statusCallback(message);
      } catch (callbackError) {
        console.error('AVD callback error:', callbackError.message);
      }
    };

    if (!fs.existsSync(avdDir)) {
      notify('Creating AVD directory structure...');
      fs.mkdirSync(avdDir, { recursive: true });
    }

    // Create AVD config
    const configIni = `
avd.ini.encoding=UTF-8
path=${avdDir}
path.rel=avd/${avdName}.avd
target=android-30
    `.trim();

    fs.writeFileSync(avdIni, configIni);
    notify('AVD base configuration written');

    // Mac memakai host GPU ('auto', render via Metal/OpenGL host).
    // Windows & Linux memakai SwiftShader di host — aman untuk semua driver
    // GPU dan tetap jalan headless. 'guest' (render software di dalam guest)
    // dihindari karena sangat lambat dan bisa menyebabkan layar hitam.
    const gpuMode = this.isMac ? 'auto' : 'swiftshader_indirect';
    const avdConfig = `
avd.ini.encoding=UTF-8
abi.type=${this.getGuestAbi()}
hw.accelerometer=yes
hw.audioInput=no
hw.battery=yes
hw.cpu.arch=${this.getGuestCpuArch()}
hw.cpu.ncore=${resolvedSpec.cores}
hw.device.manufacturer=Google
hw.device.name=pixel_4
hw.gpu.enabled=yes
hw.gpu.mode=${gpuMode}
hw.keyboard=yes
hw.lcd.density=240
hw.lcd.height=${height}
hw.lcd.width=${width}
hw.lcd.density=${resolvedSpec.density}
hw.ramSize=${resolvedSpec.memoryMb}
hw.sdCard=yes
image.sysdir.1=system-images/android-30/${this.getImageTag()}/${this.getGuestAbi()}/
skin.name=${resolvedSpec.resolution}
tag.display=Google Play
tag.id=${this.getImageTag()}
vm.heapSize=${heapSize}
hw.arc=false
hw.audioOutput=yes
fastboot.chosenSnapshotFile=
fastboot.forceChosenSnapshotBoot=no
fastboot.forceColdBoot=yes
fastboot.forceFastBoot=no
snapshot.present=no
disk.dataPartition.size=4294967296
PlayStore.enabled=yes
hw.camera=no
hw.camera.back=none
hw.camera.front=none
    `.trim();

    fs.writeFileSync(path.join(avdDir, 'config.ini'), avdConfig);
    notify('AVD device configuration generated');
  }

  ensureSystemImageLayout() {
    try {
      const systemImagesPath = this.getSystemImagesDir();
      const nested = path.join(systemImagesPath, this.getGuestAbi());
      if (fs.existsSync(nested) && fs.lstatSync(nested).isDirectory()) {
        fs.readdirSync(nested).forEach((entry) => {
          const src = path.join(nested, entry);
          const dest = path.join(systemImagesPath, entry);
          fs.renameSync(src, dest);
        });
        fs.rmSync(nested, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn('Unable to normalize system image layout:', err.message);
    }
  }

  async extractZip(zipPath, dest, notify) {
    if (!fs.existsSync(zipPath)) return false;
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const runUnzip = !this.isWin;
    if (runUnzip) {
      await new Promise((resolve, reject) => {
        const unzip = spawn('unzip', ['-o', zipPath, '-d', dest]);
        unzip.stdout.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg && typeof notify === 'function') {
            notify(msg);
          }
        });
        unzip.stderr.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg) {
            console.warn('[unzip]', msg);
          }
        });
        unzip.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`unzip exited with code ${code}`));
        });
        unzip.on('error', (err) => {
          if (err && err.code === 'ENOENT') {
            reject(new Error(
              "Perintah 'unzip' tidak ditemukan. Install terlebih dahulu " +
              '(Debian/Ubuntu: sudo apt install unzip, Fedora: sudo dnf install unzip), ' +
              'lalu ulangi download.'
            ));
          } else {
            reject(err);
          }
        });
      });
    } else {
      const attemptExtract = () =>
        extractZip(zipPath, {
          dir: dest,
          onEntry: (entry) => {
            if (typeof notify === 'function' && entry?.fileName) {
              notify(entry.fileName);
            }
          },
        });

      try {
        await attemptExtract();
      } catch (err) {
        // A binary in the archive (typically adb.exe) may still be locked by a
        // running process. Force-kill adb, wait for the lock to clear, retry once.
        const locked =
          err &&
          (err.code === 'EBUSY' ||
            err.code === 'EPERM' ||
            /EBUSY|EPERM|locked|being used by another process/i.test(err.message || ''));
        if (!locked) throw err;

        console.warn('⚠️ Extraction hit a locked file, killing ADB and retrying:', err.message);
        if (typeof notify === 'function') {
          notify('File terkunci, menutup ADB lalu mencoba ulang...');
        }
        await this.killAdbServer();
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await attemptExtract();
      }
    }

    return true;
  }

  /**
   * Check and try to add Hypervisor entitlement to emulator binaries (macOS only)
   */
  async ensureEmulatorEntitlements() {
    if (!this.isMac) return { hasHvf: false };

    const emulatorDir = path.join(this.sdkPath, 'emulator');
    const { execSync } = require('child_process');

    try {
      // List QEMU binaries to see what's actually there
      const qemuDir = path.join(emulatorDir, 'qemu');
      console.log('📂 Checking QEMU directory structure...');

      if (fs.existsSync(qemuDir)) {
        const qemuContents = execSync(`find "${qemuDir}" -type f -name "qemu-system-*" 2>/dev/null || true`, {
          encoding: 'utf8'
        });
        console.log('QEMU binaries found:', qemuContents || 'None');
      } else {
        console.log('⚠️  QEMU directory not found at:', qemuDir);
      }

      // Create entitlements file
      const entitlementsPath = path.join(this.sdkPath, 'emulator-entitlements.plist');
      const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.hypervisor</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
</dict>
</plist>`;

      fs.writeFileSync(entitlementsPath, entitlements);

      // Sign all critical binaries in emulator directory
      // Try multiple possible QEMU binary locations
      const binariesToSign = [
        'emulator',
        'qemu/darwin-x86_64/qemu-system-x86_64',
        'qemu/darwin-x86_64/qemu-system-x86_64-headless',
        'qemu/darwin-aarch64/qemu-system-aarch64',
        'qemu/darwin-aarch64/qemu-system-x86_64',
        'lib64/qt/libexec/QtWebEngineProcess'
      ];

      console.log('🔐 Signing emulator binaries with HVF entitlement...');
      let signedCount = 0;

      for (const binary of binariesToSign) {
        const binaryPath = path.join(emulatorDir, binary);
        if (fs.existsSync(binaryPath)) {
          try {
            // Sign a temp copy, then swap it in. Signing in place can fail for
            // the launcher because codesign mistakes the emulator root dir for
            // a bundle ("In subcomponent: NOTICE.csv"), and a failed re-sign
            // leaves an unsigned binary that macOS SIGKILLs on Apple Silicon.
            const tmpCopy = path.join(
              os.tmpdir(),
              `starbox-sign-${path.basename(binary)}-${Date.now()}`
            );
            fs.copyFileSync(binaryPath, tmpCopy);
            execSync(
              `codesign --force --sign - --entitlements "${entitlementsPath}" --timestamp=none "${tmpCopy}"`,
              { encoding: 'utf8', stdio: 'pipe' }
            );
            fs.copyFileSync(tmpCopy, binaryPath);
            fs.unlinkSync(tmpCopy);
            fs.chmodSync(binaryPath, 0o755);

            // Verify the result actually carries a valid signature
            execSync(`codesign --verify "${binaryPath}"`, { stdio: 'pipe' });

            console.log(`  ✓ Signed: ${binary}`);
            signedCount++;
          } catch (signErr) {
            console.warn(`  ⚠ Could not sign ${binary}:`, signErr.message);
          }
        } else {
          console.log(`  - Not found: ${binary}`);
        }
      }

      if (signedCount > 0) {
        console.log(`✅ Successfully signed ${signedCount} binaries`);
        return { hasHvf: true };
      } else {
        console.warn('⚠️  No binaries were signed');
        return { hasHvf: false };
      }
    } catch (err) {
      console.warn('⚠️  Error during signing process:', err.message);
      console.warn('   Emulator will run in software mode (slower but functional)');
      return { hasHvf: false };
    }
  }

  /**
   * Check hardware acceleration support via `emulator -accel-check`
   * (Windows: WHPX/AEHD/HAXM, macOS: HVF, Linux: KVM)
   */
  checkAccelSupport(timeoutMs = 10000) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      try {
        const proc = spawn(this.getEmulatorBinary(), ['-accel-check'], {
          env: this.getProcessEnv(),
        });
        let output = '';
        proc.stdout.on('data', (d) => { output += d.toString(); });
        proc.stderr.on('data', (d) => { output += d.toString(); });
        proc.on('close', () => {
          // Format output:
          //   accel:
          //   0                              <- kode status (0 = tersedia)
          //   Hypervisor.Framework OS X ...  <- deskripsi hypervisor
          //   accel
          const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
          const statusIdx = lines.indexOf('accel:');
          const statusCode = statusIdx !== -1 ? parseInt(lines[statusIdx + 1], 10) : NaN;
          const available =
            statusCode === 0 || /is installed and usable/i.test(output);
          const detail =
            (statusIdx !== -1 && lines[statusIdx + 2]) || output.trim();
          // A parsed exit is a definitive answer; timeouts/errors are not, so we
          // never block startup on a check that simply failed to run.
          finish({ available, detail, definitive: true });
        });
        proc.on('error', (err) => finish({ available: false, detail: err.message, definitive: false }));
        setTimeout(() => {
          try { proc.kill('SIGKILL'); } catch (_) {}
          finish({ available: false, detail: 'accel-check timeout', definitive: false });
        }, timeoutMs);
      } catch (err) {
        finish({ available: false, detail: err.message, definitive: false });
      }
    });
  }

  /**
   * Report hardware-acceleration status for the emulator page. Combines the
   * `-accel-check` result with the guest ABI so the UI can explain whether the
   * machine can run the x86_64 image at all.
   */
  async getAccelerationStatus() {
    const accel = await this.checkAccelSupport();
    const guestAbi = this.getGuestAbi();
    return {
      available: !!accel.available,
      definitive: accel.definitive !== false,
      detail: accel.detail || '',
      guestAbi,
      // x86_64 guests have no software fallback; arm64 (Apple Silicon) uses HVF.
      requiresAcceleration: guestAbi === 'x86_64',
      platform: this.platform,
      isWin: this.isWin,
      isMac: this.isMac,
      isLinux: this.isLinux,
    };
  }

  /**
   * Best-effort attempt to enable the Windows Hypervisor Platform feature (WHPX)
   * via an elevated PowerShell call. This CANNOT enable CPU virtualization that
   * is turned off in BIOS/UEFI — only the Windows optional feature. Requires a
   * reboot afterwards. Returns { success, rebootRequired, message }.
   */
  async enableWindowsAcceleration() {
    if (!this.isWin) {
      return { success: false, message: 'Fitur ini hanya tersedia di Windows.' };
    }

    const { spawn } = require('child_process');
    // Enable both HypervisorPlatform (WHPX) and VirtualMachinePlatform in one
    // elevated call. -Verb RunAs triggers the UAC prompt.
    const inner =
      'Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform,VirtualMachinePlatform -All -NoRestart';
    const psCommand =
      `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden ` +
      `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','${inner}'`;

    return new Promise((resolve) => {
      let stderr = '';
      try {
        const proc = spawn(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
          { windowsHide: true }
        );
        proc.stderr.on('data', (d) => {
          stderr += d.toString();
        });
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              rebootRequired: true,
              message:
                'Windows Hypervisor Platform berhasil diaktifkan. Restart PC lalu coba jalankan emulator lagi.',
            });
          } else {
            resolve({
              success: false,
              message:
                stderr.trim() ||
                'Gagal mengaktifkan (izin UAC ditolak atau perlu hak administrator).',
            });
          }
        });
        proc.on('error', (err) => {
          resolve({ success: false, message: err.message });
        });
      } catch (err) {
        resolve({ success: false, message: err.message });
      }
    });
  }

  /**
   * Start Android emulator
   */
  async startEmulator(avdName = 'StarBox_Default', options = {}) {
    avdName = this.sanitizeAvdName(avdName);
    this.initializePaths();

    if (this.emulatorProcess) {
      throw new Error('Emulator is already running');
    }

    const {
      headless = false,
      progressCallback = null,
      spec: requestedSpec = null,
    } = options || {};

    const resolvedSpec = this.normalizeSpec(requestedSpec);

    // Ensure temp crash directories exist
    this.ensureTempCrashDirectories();

    const emitProgress = (payload = {}) => {
      if (typeof progressCallback === 'function') {
        try {
          progressCallback({
            timestamp: Date.now(),
            ...payload,
          });
        } catch (callbackError) {
          console.warn('Start progress callback error:', callbackError.message);
        }
      }
    };

    // Kill any zombie ADB processes before starting
    emitProgress({
      phase: 'prepare-adb',
      message: 'Membersihkan ADB server...',
    });

    try {
      await this.killAdbServer();
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (adbError) {
      console.warn('⚠️ Failed to kill ADB before start:', adbError.message);
      // Continue anyway
    }

    // Check for missing platforms directory and fix if needed
    const platformsDir = path.join(this.sdkPath, 'platforms', 'android-30');
    if (!fs.existsSync(platformsDir)) {
      emitProgress({
        phase: 'fix-platforms',
        message: 'Platform directory missing, downloading required package...',
      });
      try {
        await this.fixMissingPlatforms(progressCallback);
      } catch (error) {
        throw new Error(`Failed to fix missing platforms: ${error.message}`);
      }
    }

    if (!this.isInstalled()) {
      throw new Error('Emulator not installed. Please download first.');
    }

    const emulatorBin = this.getEmulatorBinary();
    const adbBin = this.getADBBinary();

    if (!this.isWin) {
      const ensurePerms = (target, label) => {
        try {
          if (fs.existsSync(target)) {
            fs.chmodSync(target, 0o755);
          }
        } catch (permError) {
          console.warn(`Unable to update permissions for ${label}:`, permError.message);
          emitProgress({
            phase: 'permissions-warning',
            message: `Gagal memperbarui izin untuk ${label}: ${permError.message}`,
          });
        }
      };
      ensurePerms(emulatorBin, 'emulator binary');
      ensurePerms(adbBin, 'ADB binary');
    }
    this.ensureSystemImageLayout();

    // Check emulator entitlements on macOS
    if (this.isMac) {
      await this.ensureEmulatorEntitlements();
    }

    // GPU renderer candidates. A native crash (access violation, exit 0xC0000005)
    // is almost always the graphics backend, so we retry the next renderer.
    // GPU-accelerated renderers come FIRST so heavy apps (Play Store / Play
    // Services) render smoothly like on macOS; software is only a last resort —
    // software rendering is what makes those apps crash/close on Windows.
    //   - angle_indirect: ANGLE → Direct3D11, GPU-accelerated, very stable on Windows
    //   - host: native host OpenGL/GPU driver
    //   - swiftshader_indirect: software GL, no driver dependency (last resort)
    const gpuCandidates = this.isMac
      ? ['auto']
      : this.isWin
        ? ['angle_indirect', 'host', 'swiftshader_indirect']
        : ['host', 'swiftshader_indirect'];

    const skinValue = (resolvedSpec.resolution || '720x1280').toLowerCase();
    // Base args shared across every GPU attempt; '-gpu <mode>' is prepended per try.
    const baseArgs = [
      '-avd', avdName,
      '-no-boot-anim',
      '-skin', skinValue,
      '-memory', String(resolvedSpec.memoryMb || 1536),
      '-cores', String(resolvedSpec.cores || 2),
      '-feature', '-Vulkan',
      '-no-snapshot-load',
      '-no-snapshot-save',
      // 'auto' memakai hypervisor host bila tersedia (Windows: WHPX/AEHD/HAXM,
      // Linux: KVM) dan otomatis fallback ke mode software bila tidak ada
      '-accel', 'auto',
      '-verbose',
    ];
    if (headless) {
      baseArgs.push('-no-window');
    }

    // Laporkan status akselerasi supaya pengguna tahu kenapa boot cepat/lambat
    const accelInfo = await this.checkAccelSupport();
    if (accelInfo.available) {
      console.log(`🚀 Akselerasi hardware aktif: ${accelInfo.detail}`);
      emitProgress({
        phase: 'accel',
        message: 'Akselerasi hardware aktif — boot ±1 menit.',
      });
    } else {
      const hint = this.isWin
        ? 'Untuk mempercepat: aktifkan "Windows Hypervisor Platform" di Windows Features (atau install Android Emulator Hypervisor Driver dari Google), lalu restart PC.'
        : this.isLinux
          ? 'Untuk mempercepat: pastikan KVM aktif dan user tergabung di grup kvm.'
          : '';
      console.log('⚠️  Akselerasi hardware tidak tersedia — mode emulasi software (lambat).');
      console.log(`   ${accelInfo.detail}`);
      if (hint) console.log(`   ${hint}`);

      // x86_64 guest images have NO software fallback — the emulator will PANIC
      // and exit with code 1. Fail fast with an actionable message instead of a
      // cryptic exit code. Only block on a definitive negative accel-check.
      if (this.getGuestAbi() === 'x86_64' && accelInfo.definitive) {
        throw new Error(
          `Akselerasi hardware (WHPX/HAXM/AEHD) tidak aktif, sedangkan emulator Android x86_64 wajib akselerasi untuk bisa berjalan. ${hint} Detail: ${accelInfo.detail || 'accel-check gagal'}`
        );
      }

      emitProgress({
        phase: 'accel',
        message: `Akselerasi hardware tidak tersedia — emulator berjalan mode software (boot bisa >10 menit). ${hint}`,
      });
    }

    // Always recreate AVD config to ensure optimal settings for software emulation
    emitProgress({
      phase: 'setup-avd',
      message: 'Menyiapkan konfigurasi emulator untuk software mode...',
    });
    await this.createDefaultAVD(avdName, resolvedSpec, (message) =>
      emitProgress({
        phase: 'setup-avd',
        message,
      })
    );

    console.log(`Platform: ${this.platform}, Arch: ${process.arch}`);
    console.log(`Apple Silicon: ${this.isAppleSilicon}`);
    console.log(`Emulator SDK root: ${this.sdkPath}`);
    console.log(`Emulator AVD home: ${this.avdPath}`);

    // A crash with a native exit code (>= 0xC0000000, e.g. 0xC0000005 access
    // violation) means the emulator process itself crashed — retry a different
    // GPU renderer rather than surfacing a cryptic code.
    const isNativeCrash = (code) =>
      typeof code === 'number' && code >= 0xc0000000;

    const attemptStart = (gpuMode) => {
      // Clear any stale lock left by a previous crash / renderer attempt so this
      // launch does not fail with "Please use -read-only flag to enable...".
      this.cleanAvdLocks(avdName);

      const args = ['-gpu', gpuMode, ...baseArgs];
      emitProgress({
        phase: 'spawn',
        message: `Menjalankan proses emulator (GPU: ${gpuMode})...`,
        command: emulatorBin,
        args,
      });
      console.log('Emulator args:', args.join(' '));

      return new Promise((resolve, reject) => {
        try {
          const env = this.getProcessEnv();
          env.ANDROID_EMULATOR_USE_SYSTEM_LIBS = '1';
          env.ANDROID_EMULATOR_DISABLE_CRASH_REPORT = '1';
          env.ANDROID_EMULATOR_DISABLE_METRICS = '1';

          // Get temp directory with proper normalization
          const tempDir = this.getEmulatorTempDir();

          // Set environment variables without double backslashes
          env.ANDROID_EMULATOR_HOME = env.ANDROID_EMULATOR_HOME || tempDir;
          env.ANDROID_PRODUCT_OUT = env.ANDROID_PRODUCT_OUT || tempDir;

          // Ensure TEMP and TMP are set correctly on Windows
          if (this.isWin) {
            const winTemp = os.tmpdir().replace(/[\\/]+$/, '');
            const normalizedWinTemp = path.normalize(winTemp).replace(/\\\\/g, '\\');
            env.TEMP = normalizedWinTemp;
            env.TMP = normalizedWinTemp;
          }

          const spawnedAt = Date.now();
          this.emulatorProcess = spawn(emulatorBin, args, { env });

          // Keep the tail of emulator output so a non-zero exit can report the
          // actual reason (PANIC/ERROR lines) instead of a generic exit code.
          // Crashpad / crash-db chatter is pure noise and would otherwise mask
          // the real error, so it is excluded from the reasoning buffer.
          const isNoise = (line) =>
            /filesystem_win\.cc|emu-crash|getfileattributes|crashpad|attachments[\\/]/i.test(
              line
            );
          const outputTail = [];
          const rememberOutput = (text) => {
            text
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line && !isNoise(line))
              .forEach((line) => {
                outputTail.push(line);
                if (outputTail.length > 40) outputTail.shift();
              });
          };
          const extractFailureReason = () => {
            const panic = outputTail.filter((line) => /panic/i.test(line));
            if (panic.length) return panic.slice(-4).join('\n');
            const important = outputTail.filter((line) =>
              /error|fatal|cannot|failed|not found|unable|missing/i.test(line)
            );
            const picked = (important.length ? important : outputTail).slice(-6);
            return picked.join('\n');
          };

          this.emulatorProcess.stdout.on('data', (data) => {
            const text = data.toString();
            rememberOutput(text);
            console.log(`Emulator: ${text}`);
            emitProgress({ phase: 'stdout', message: text });
          });

          this.emulatorProcess.stderr.on('data', (data) => {
            const text = data.toString();
            rememberOutput(text);
            console.error(`Emulator error: ${text}`);
            emitProgress({ phase: 'stderr', message: text });
          });

          this.emulatorProcess.on('error', (error) => {
            console.error('Failed to start emulator:', error);
            this.emulatorProcess = null;
            emitProgress({ phase: 'error', message: error.message });
            reject(error);
          });

          let bootResolved = false;
          let bootTimer = null;

          this.emulatorProcess.on('exit', (code) => {
            console.log(`Emulator exited with code ${code}`);
            this.emulatorProcess = null;
            emitProgress({
              phase: 'exit',
              message: `Emulator selesai dengan kode ${code}`,
              exitCode: code,
            });
            if (!bootResolved && code !== 0 && code !== null) {
              bootResolved = true;
              if (bootTimer) clearTimeout(bootTimer);
              const reason = extractFailureReason();
              const err = new Error(
                reason
                  ? `Emulator (GPU ${gpuMode}) keluar dengan kode ${code}:\n${reason}`
                  : `Emulator (GPU ${gpuMode}) keluar dengan kode ${code}. Cek log di atas untuk detail kesalahan.`
              );
              err.exitCode = code;
              err.nativeCrash = isNativeCrash(code);
              // How long the process survived — a death within a few seconds is
              // a startup/renderer failure worth retrying on the next renderer.
              err.earlyExit = Date.now() - spawnedAt < 15000;
              err.gpuMode = gpuMode;
              reject(err);
            }
          });

          // Wait for emulator to boot (15 minutes for software emulation)
          bootTimer = setTimeout(() => {
            bootTimer = null;
            if (bootResolved) return;
            this.waitForBoot(900000, (payload) => emitProgress(payload))
              .then(() => {
                if (!bootResolved) {
                  bootResolved = true;
                  resolve({ success: true, port: 5554 });
                }
              })
              .catch((err) => {
                if (!bootResolved) {
                  bootResolved = true;
                  emitProgress({
                    phase: 'error',
                    message: err?.message || 'Gagal menunggu emulator boot',
                  });
                  reject(err);
                }
              });
          }, 2000);
        } catch (error) {
          emitProgress({
            phase: 'error',
            message: error?.message || 'Gagal memulai emulator',
          });
          reject(error);
        }
      });
    };

    // Try each GPU renderer; on a native crash, fall through to the next one.
    let lastError = null;
    for (let i = 0; i < gpuCandidates.length; i++) {
      const mode = gpuCandidates[i];
      try {
        return await attemptStart(mode);
      } catch (err) {
        lastError = err;
        const hasNext = i < gpuCandidates.length - 1;
        // Retry the next renderer when the process died early at startup — a
        // native crash (access violation) or a quick non-zero exit (code 1) are
        // both usually the GPU backend failing to initialise. Do NOT retry a
        // boot timeout (no exitCode) — that would waste 15 minutes per renderer.
        const rendererFailed =
          err && typeof err.exitCode === 'number' && err.exitCode !== 0 &&
          (err.nativeCrash || err.earlyExit);
        if (rendererFailed && hasNext) {
          console.warn(`⚠️ Renderer '${mode}' gagal (code ${err.exitCode}); mencoba renderer berikutnya...`);
          emitProgress({
            phase: 'gpu-retry',
            message: `Renderer grafis '${mode}' gagal (kode ${err.exitCode}). Mencoba renderer lain...`,
          });
          // Make sure the process is fully gone before the next attempt.
          try { await this.killAdbServer(); } catch (_) {}
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        throw err;
      }
    }
    if (lastError && typeof lastError.exitCode === 'number' && lastError.exitCode !== 0) {
      throw new Error(
        `${lastError.message}\n\nSemua renderer grafis (${gpuCandidates.join(', ')}) gagal. ` +
          'Coba: update driver GPU ke versi terbaru, tutup aplikasi berat/antivirus yang memblokir emulator, lalu jalankan lagi.'
      );
    }
    throw lastError || new Error('Gagal memulai emulator.');
  }

  /**
   * Wait for emulator to fully boot
   */
  async waitForBoot(timeout = 900000, progressCallback = null) {
    const startTime = Date.now();
    const emit = (payload = {}) => {
      if (typeof progressCallback === 'function') {
        try {
          progressCallback({
            phase: 'boot-wait',
            elapsedMs: Date.now() - startTime,
            ...payload,
          });
        } catch (callbackError) {
          console.warn('Boot wait callback error:', callbackError.message);
        }
      }
    };

    emit({ message: 'Menunggu emulator terdeteksi oleh ADB...' });
    try {
      await this.runAdbCommand(['wait-for-device'], {
        timeout: Math.max(30000, Math.min(timeout, 180000)),
        silent: true,
      });
      emit({ message: 'ADB tersambung. Mengecek status boot...' });
    } catch (err) {
      emit({ message: `ADB belum siap: ${err.message}` });
    }

    const pollDelay = 4000;

    while (Date.now() - startTime < timeout) {
      const status = await this.getBootProperties();
      if (status.bootCompleted) {
        emit({
          phase: 'boot-complete',
          message: 'Emulator berhasil boot.',
          details: status,
        });
        return true;
      }

      emit({
        message: `Menunggu boot... sys.boot_completed=${status.sys || '0'} dev.bootcomplete=${status.dev || '0'} bootanim=${status.bootAnim || 'unknown'}`,
      });

      await new Promise((resolve) => setTimeout(resolve, pollDelay));
    }

    emit({
      phase: 'boot-timeout',
      message: 'Waktu tunggu boot emulator habis.',
    });
    throw new Error('Emulator boot timeout');
  }

  async getBootProperties() {
    const safeGet = async (prop) => {
      try {
        return (
          await this.runAdbCommand(['shell', 'getprop', prop], {
            timeout: 5000,
            silent: true,
          })
        ).trim();
      } catch {
        return '';
      }
    };

    const sys = await safeGet('sys.boot_completed');
    const dev = await safeGet('dev.bootcomplete');
    const bootAnim = await safeGet('init.svc.bootanim');
    const bootCompleted =
      (sys === '1' || dev === '1') && bootAnim && bootAnim.toLowerCase() !== 'running';

    return {
      sys,
      dev,
      bootAnim: bootAnim || '',
      bootCompleted,
    };
  }

  /**
   * Stop emulator
   */
  async stopEmulator() {
    if (!this.emulatorProcess) {
      return { success: true, message: 'Emulator not running' };
    }

    return new Promise((resolve) => {
      // Kill via ADB first (graceful)
      const adb = spawn(this.getADBBinary(), ['emu', 'kill']);

      adb.on('close', () => {
        setTimeout(() => {
          if (this.emulatorProcess) {
            this.emulatorProcess.kill();
            this.emulatorProcess = null;
          }
          resolve({ success: true });
        }, 1000);
      });

      adb.on('error', () => {
        // Force kill
        if (this.emulatorProcess) {
          this.emulatorProcess.kill();
          this.emulatorProcess = null;
        }
        resolve({ success: true });
      });
    });
  }

  /**
   * Get emulator screenshot
   */
  async getScreenshot() {
    return new Promise((resolve, reject) => {
      const adb = spawn(this.getADBBinary(), ['exec-out', 'screencap', '-p']);

      const chunks = [];
      adb.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      adb.on('close', (code) => {
        if (code === 0) {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.toString('base64'));
        } else {
          reject(new Error('Screenshot failed'));
        }
      });

      adb.on('error', reject);
    });
  }

  /**
   * Send tap event
   */
  async tap(x, y) {
    return this.executeAdbCommand(['shell', 'input', 'tap', x.toString(), y.toString()]);
  }

  /**
   * Send swipe event
   */
  async swipe(x1, y1, x2, y2, duration = 300) {
    return this.executeAdbCommand([
      'shell', 'input', 'swipe',
      x1.toString(), y1.toString(),
      x2.toString(), y2.toString(),
      duration.toString()
    ]);
  }

  /**
   * Send text input
   */
  async inputText(text) {
    const escaped = text.replace(/\s/g, '%s');
    return this.executeAdbCommand(['shell', 'input', 'text', escaped]);
  }

  /**
   * Press key (KEYCODE_BACK, KEYCODE_HOME, etc)
   */
  async pressKey(keycode) {
    return this.executeAdbCommand(['shell', 'input', 'keyevent', keycode]);
  }

  /**
   * Install APK
   */
  async installAPK(apkPath) {
    return this.executeAdbCommand(['install', '-r', apkPath]);
  }

  /**
   * Execute ADB command
   */
  executeAdbCommand(args) {
    return new Promise((resolve, reject) => {
      const adb = spawn(this.getADBBinary(), args);

      let output = '';
      let error = '';

      adb.stdout.on('data', (data) => {
        output += data.toString();
      });

      adb.stderr.on('data', (data) => {
        error += data.toString();
      });

      adb.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject(new Error(error || 'ADB command failed'));
        }
      });

      adb.on('error', reject);
    });
  }

  /**
   * Get emulator status
   */
  isRunning() {
    return this.emulatorProcess !== null;
  }

  /**
   * Get download progress
   */
  getDownloadProgress() {
    return this.downloadProgress;
  }

  /**
   * Get estimated download size based on platform
   */
  getEstimatedDownloadSize() {
    // Approximate sizes for each component (in MB)
    const sizes = {
      emulator: this.isAppleSilicon ? 260 : this.isMac ? 420 : this.isWin ? 350 : 380,
      platformTools: 15,
      platform: 5,
      systemImage: 1250
    };

    const totalMB = sizes.emulator + sizes.platformTools + sizes.platform + sizes.systemImage;

    if (totalMB >= 1000) {
      return `${(totalMB / 1024).toFixed(2)} GB`;
    }
    return `${totalMB} MB`;
  }
}

module.exports = AndroidManager;
