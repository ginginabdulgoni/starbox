// ios-manager.js
const { spawn, execSync } = require('child_process');
const path = require('path');

class iOSManager {
  constructor() {
    this.simulatorProcess = null;
    this.currentDeviceUDID = null;
  }

  /**
   * Check if Xcode and simctl are available
   */
  isAvailable() {
    try {
      execSync('xcode-select -p', { stdio: 'pipe' });
      execSync('xcrun simctl help', { stdio: 'pipe' });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get list of available iOS simulators
   */
  getDevices() {
    try {
      const output = execSync('xcrun simctl list devices available --json', {
        encoding: 'utf8'
      });
      const data = JSON.parse(output);

      const devices = [];
      for (const runtime in data.devices) {
        if (runtime.includes('iOS')) {
          const runtimeDevices = data.devices[runtime];
          runtimeDevices.forEach(device => {
            devices.push({
              udid: device.udid,
              name: device.name,
              state: device.state,
              runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', '').replace(/-/g, ' '),
              isAvailable: device.isAvailable !== false
            });
          });
        }
      }

      return devices;
    } catch (err) {
      console.error('Failed to get iOS devices:', err.message);
      return [];
    }
  }

  /**
   * Boot iOS simulator
   */
  async bootDevice(udid, progressCallback = null) {
    const emit = (payload = {}) => {
      if (typeof progressCallback === 'function') {
        try {
          progressCallback({
            timestamp: Date.now(),
            ...payload,
          });
        } catch (callbackError) {
          console.warn('iOS boot progress callback error:', callbackError.message);
        }
      }
    };

    try {
      // Check current state
      const devices = this.getDevices();
      const device = devices.find(d => d.udid === udid);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.state === 'Booted') {
        emit({ phase: 'already-booted', message: 'Simulator sudah berjalan' });
        this.currentDeviceUDID = udid;
        return { success: true, udid, state: 'Booted' };
      }

      emit({ phase: 'booting', message: `Booting ${device.name}...` });

      // Boot the device
      execSync(`xcrun simctl boot ${udid}`, { stdio: 'pipe' });

      emit({ phase: 'opening', message: 'Membuka Simulator.app...' });

      // Open Simulator.app
      execSync('open -a Simulator', { stdio: 'pipe' });

      // Wait a bit for UI to appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      emit({ phase: 'boot-complete', message: 'Simulator berhasil boot' });

      this.currentDeviceUDID = udid;
      return { success: true, udid, state: 'Booted' };
    } catch (err) {
      emit({ phase: 'error', message: err.message });
      throw err;
    }
  }

  /**
   * Shutdown iOS simulator
   */
  async shutdownDevice(udid) {
    try {
      execSync(`xcrun simctl shutdown ${udid}`, { stdio: 'pipe' });

      if (this.currentDeviceUDID === udid) {
        this.currentDeviceUDID = null;
      }

      return { success: true, udid, state: 'Shutdown' };
    } catch (err) {
      // Might already be shut down
      return { success: true, udid, state: 'Shutdown' };
    }
  }

  /**
   * Shutdown all running simulators
   */
  async shutdownAll() {
    try {
      execSync('xcrun simctl shutdown all', { stdio: 'pipe' });
      this.currentDeviceUDID = null;
      return { success: true };
    } catch (err) {
      return { success: true }; // Ignore errors
    }
  }

  /**
   * Install app to simulator
   */
  async installApp(udid, appPath) {
    try {
      execSync(`xcrun simctl install ${udid} "${appPath}"`, { stdio: 'pipe' });
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to install app: ${err.message}`);
    }
  }

  /**
   * Launch app on simulator
   */
  async launchApp(udid, bundleId) {
    try {
      execSync(`xcrun simctl launch ${udid} ${bundleId}`, { stdio: 'pipe' });
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to launch app: ${err.message}`);
    }
  }

  /**
   * Uninstall app from simulator
   */
  async uninstallApp(udid, bundleId) {
    try {
      execSync(`xcrun simctl uninstall ${udid} ${bundleId}`, { stdio: 'pipe' });
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to uninstall app: ${err.message}`);
    }
  }

  /**
   * Get screenshot from simulator
   */
  async getScreenshot(udid, outputPath) {
    try {
      execSync(`xcrun simctl io ${udid} screenshot "${outputPath}"`, { stdio: 'pipe' });
      return { success: true, path: outputPath };
    } catch (err) {
      throw new Error(`Failed to capture screenshot: ${err.message}`);
    }
  }

  /**
   * Record video from simulator
   */
  startRecording(udid, outputPath, progressCallback = null) {
    return new Promise((resolve, reject) => {
      try {
        const args = ['simctl', 'io', udid, 'recordVideo', outputPath];
        this.simulatorProcess = spawn('xcrun', args);

        this.simulatorProcess.on('spawn', () => {
          if (typeof progressCallback === 'function') {
            progressCallback({ phase: 'recording', message: 'Recording started' });
          }
          resolve({ success: true, recording: true });
        });

        this.simulatorProcess.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop recording video
   */
  stopRecording() {
    if (this.simulatorProcess) {
      this.simulatorProcess.kill('SIGINT');
      this.simulatorProcess = null;
      return { success: true, recording: false };
    }
    return { success: true, recording: false };
  }

  /**
   * Open URL in Safari on simulator
   */
  async openURL(udid, url) {
    try {
      execSync(`xcrun simctl openurl ${udid} "${url}"`, { stdio: 'pipe' });
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to open URL: ${err.message}`);
    }
  }

  /**
   * Erase simulator data
   */
  async eraseDevice(udid) {
    try {
      // Must shutdown first
      await this.shutdownDevice(udid);
      execSync(`xcrun simctl erase ${udid}`, { stdio: 'pipe' });
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to erase device: ${err.message}`);
    }
  }

  /**
   * Get device info
   */
  getDeviceInfo(udid) {
    try {
      const output = execSync(`xcrun simctl list devices available --json`, {
        encoding: 'utf8'
      });
      const data = JSON.parse(output);

      for (const runtime in data.devices) {
        const device = data.devices[runtime].find(d => d.udid === udid);
        if (device) {
          return {
            ...device,
            runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', '').replace(/-/g, ' ')
          };
        }
      }

      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Check if device is booted
   */
  isBooted(udid) {
    const info = this.getDeviceInfo(udid);
    return info && info.state === 'Booted';
  }
}

module.exports = iOSManager;
