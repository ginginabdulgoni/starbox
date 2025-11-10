// android-manager.js
const path = require('path');
const fs = require('fs');
const https = require('https');
const { app } = require('electron');
const AdmZip = require('adm-zip');
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

    // Platform specific paths
    this.platform = process.platform;
    this.isWin = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';

    // Check if Mac is Apple Silicon
    this.isAppleSilicon = this.isMac && process.arch === 'arm64';
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
   * Check if emulator is already installed
   */
  isInstalled() {
    this.initializePaths();
    const emulatorBin = this.getEmulatorBinary();
    const adbBin = this.getADBBinary();
    const platformsDir = path.join(this.sdkPath, 'platforms', 'android-30');
    return fs.existsSync(emulatorBin) && fs.existsSync(adbBin) && fs.existsSync(platformsDir);
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

    if (this.isDownloading) {
      throw new Error('Download already in progress');
    }

    this.isDownloading = true;
    this.downloadProgress = 0;

    const emitProgress = (payload = {}) => {
      if (typeof progressCallback !== 'function') return;
      try {
        progressCallback({
          timestamp: Date.now(),
          ...payload,
        });
      } catch (callbackError) {
        console.error('Progress callback error:', callbackError.message);
      }
    };

    try {
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

      // Download emulator components based on platform
      const downloads = await this.getDownloadUrls();
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

      await this.createDefaultAVD((message) => {
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
      urls.push({
        name: 'Emulator',
        url: `${baseUrl}/emulator-darwin_x64-11237101.zip`,
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
        url: `${baseUrl}/sys-img/google_apis/x86_64-30_r10.zip`,
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
        url: `${baseUrl}/sys-img/google_apis/x86_64-30_r10.zip`,
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
        url: `${baseUrl}/sys-img/google_apis/x86_64-30_r10.zip`,
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
        const systemImagesPath = path.join(
          this.sdkPath,
          'system-images',
          'android-30',
          'google_apis',
          'x86_64'
        );
        if (!fs.existsSync(systemImagesPath)) {
          fs.mkdirSync(systemImagesPath, { recursive: true });
        }
        await this.extractZip(systemImageZip, systemImagesPath, (msg) =>
          notify('System Image', msg)
        );
        // Some archives contain an extra nested x86_64 directory.
        const nestedX64 = path.join(systemImagesPath, 'x86_64');
        if (fs.existsSync(nestedX64) && fs.lstatSync(nestedX64).isDirectory()) {
          const nestedEntries = fs.readdirSync(nestedX64);
          nestedEntries.forEach((entry) => {
            const src = path.join(nestedX64, entry);
            const dest = path.join(systemImagesPath, entry);
            fs.renameSync(src, dest);
          });
          fs.rmSync(nestedX64, { recursive: true, force: true });
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
  async createDefaultAVD(statusCallback = null) {
    const avdName = 'StarBox_Default';
    const avdDir = path.join(this.avdPath, `${avdName}.avd`);
    const avdIni = path.join(this.avdPath, `${avdName}.ini`);

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

    // Create config.ini optimized for software emulation with quick boot enabled
    // Lower resolution (720x1280) for faster rendering on Apple Silicon
    const avdConfig = `
avd.ini.encoding=UTF-8
hw.accelerometer=yes
hw.audioInput=no
hw.battery=yes
hw.cpu.arch=x86_64
hw.cpu.ncore=2
hw.device.manufacturer=Google
hw.device.name=pixel_4
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader_indirect
hw.keyboard=yes
hw.lcd.density=240
hw.lcd.height=1280
hw.lcd.width=720
hw.ramSize=1536
hw.sdCard=yes
image.sysdir.1=system-images/android-30/google_apis/x86_64/
skin.name=720x1280
tag.display=Google APIs
tag.id=google_apis
vm.heapSize=228
hw.arc=false
hw.audioOutput=no
fastboot.chosenSnapshotFile=
fastboot.forceChosenSnapshotBoot=no
fastboot.forceColdBoot=no
fastboot.forceFastBoot=yes
disk.dataPartition.size=4294967296
PlayStore.enabled=false
hw.camera=no
hw.camera.back=none
hw.camera.front=none
    `.trim();

    fs.writeFileSync(path.join(avdDir, 'config.ini'), avdConfig);
    notify('AVD device configuration generated');
  }

  ensureSystemImageLayout() {
    try {
      const systemImagesPath = path.join(this.sdkPath, 'system-images', 'android-30', 'google_apis', 'x86_64');
      const nested = path.join(systemImagesPath, 'x86_64');
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
        unzip.on('error', reject);
      });
    } else {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(dest, true);
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
            // Remove existing signature first
            try {
              execSync(`codesign --remove-signature "${binaryPath}"`, { stdio: 'pipe' });
            } catch (e) {
              // Ignore errors - binary might not be signed
            }

            // Sign with entitlements
            execSync(
              `codesign --force --sign - --entitlements "${entitlementsPath}" --timestamp=none "${binaryPath}"`,
              { encoding: 'utf8', stdio: 'pipe' }
            );

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
   * Start Android emulator
   */
  async startEmulator(avdName = 'StarBox_Default', options = {}) {
    this.initializePaths();

    if (this.emulatorProcess) {
      throw new Error('Emulator is already running');
    }

    const {
      headless = false,
      progressCallback = null,
    } = options || {};

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

    // Build emulator arguments optimized for software emulation with quick boot
    // Lower resolution (720x1280) for faster rendering on Apple Silicon
    // Using 'guest' GPU mode instead of SwiftShader for better Apple Silicon compatibility
    const args = [
      '-avd', avdName,
      '-no-boot-anim',
      '-no-audio',
      '-gpu', 'guest',
      '-skin', '720x1280',
      '-memory', '1536',  // Reduce memory for stability
      '-cores', '2',
      '-feature', '-Vulkan',
      '-no-accel',  // Explicitly disable hardware acceleration to avoid HVF errors
      '-verbose'
    ];

    if (headless) {
      args.push('-no-window');
    }

    console.log('⚠️  Menjalankan dalam mode emulasi software (tanpa akselerasi hardware)');
    console.log('   Boot pertama: ~15 menit | Boot berikutnya: ~30-60 detik (Quick Boot)');

    // Always recreate AVD config to ensure optimal settings for software emulation
    emitProgress({
      phase: 'setup-avd',
      message: 'Menyiapkan konfigurasi emulator untuk software mode...',
    });
    await this.createDefaultAVD((message) =>
      emitProgress({
        phase: 'setup-avd',
        message,
      })
    );

    emitProgress({
      phase: 'spawn',
      message: 'Menjalankan proses emulator...',
      command: emulatorBin,
      args,
    });
    console.log(`Platform: ${this.platform}, Arch: ${process.arch}`);
    console.log(`Apple Silicon: ${this.isAppleSilicon}`);
    console.log(`Emulator SDK root: ${this.sdkPath}`);
    console.log(`Emulator AVD home: ${this.avdPath}`);
    console.log(`Emulator args:`, args.join(' '));

    return new Promise((resolve, reject) => {
      try {
        const env = this.getProcessEnv();
        env.ANDROID_EMULATOR_USE_SYSTEM_LIBS = '1';
        if (this.isMac) {
          env.QEMU_AUDIO_DRV = 'none';
          env.ANDROID_EMULATOR_HVF = '1';
        }

        this.emulatorProcess = spawn(emulatorBin, args, { env });

        this.emulatorProcess.stdout.on('data', (data) => {
          console.log(`Emulator: ${data}`);
          emitProgress({
            phase: 'stdout',
            message: data.toString(),
          });
        });

        this.emulatorProcess.stderr.on('data', (data) => {
          console.error(`Emulator error: ${data}`);
          emitProgress({
            phase: 'stderr',
            message: data.toString(),
          });
        });

        this.emulatorProcess.on('error', (error) => {
          console.error('Failed to start emulator:', error);
          this.emulatorProcess = null;
          emitProgress({
            phase: 'error',
            message: error.message,
          });
          reject(error);
        });

        this.emulatorProcess.on('exit', (code) => {
          console.log(`Emulator exited with code ${code}`);
          this.emulatorProcess = null;
          emitProgress({
            phase: 'exit',
            message: `Emulator selesai dengan kode ${code}`,
            exitCode: code,
          });
        });

        // Wait for emulator to boot (15 minutes for software emulation)
        setTimeout(() => {
          this.waitForBoot(900000, (payload) => emitProgress(payload))
            .then(() => {
              resolve({ success: true, port: 5554 });
            })
            .catch((err) => {
              emitProgress({
                phase: 'error',
                message: err?.message || 'Gagal menunggu emulator boot',
              });
              reject(err);
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
      emulator: this.isMac ? 420 : this.isWin ? 350 : 380,
      platformTools: 15,
      platform: 5,
      systemImage: 450
    };

    const totalMB = sizes.emulator + sizes.platformTools + sizes.platform + sizes.systemImage;

    if (totalMB >= 1000) {
      return `${(totalMB / 1024).toFixed(2)} GB`;
    }
    return `${totalMB} MB`;
  }
}

module.exports = AndroidManager;
