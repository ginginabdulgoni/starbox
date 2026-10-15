# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StarBox is an Electron-based desktop application that runs multiple web services (WhatsApp, Telegram, Gmail, etc.) and native emulators (Android, iOS) in isolated sessions. Each "device" has its own session partition (`persist:<uid>`) ensuring separate cookies and storage.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (with DevTools)
npm run dev

# Production mode
npm start

# Build for specific platforms
npm run build:mac      # macOS universal binary
npm run build:win      # Windows x64 & arm64
npm run build:linux    # Linux x64 & arm64
npm run build:all      # All platforms

# Version update (runs automatically in prebuild)
node update-version.js
```

## Core Architecture

### Main Process (electron-main.js)

The main entry point that handles:
- **Window management**: Main window, device windows, monitor windows, emulator windows
- **IPC handlers**: All communication between renderer and main process
- **Database management**: Two separate JSON databases (web services and Android devices)
- **Device lifecycle**: Starting, stopping, focusing devices
- **Authentication**: User login/register/logout with remote API
- **System reporting**: Machine ID and user agent reporting
- **Android/iOS managers**: Emulator download, boot, and control

Key constants:
- `DB_PATH`: Path to web services database (`devices.json`)
- `DB_PATH_ANDROID`: Path to Android devices database (`devices-android.json`)
- `DEFAULT_API_BASE_URL`: Backend API (dev: `http://starbox.test`, prod: `https://starbox.weagate.com`)
- `GUEST_SERVICE_DEVICE_LIMIT`: 2 devices max for non-authenticated users

### Database Structure

Two **completely separate** JSON databases managed at different paths:

**devices.json** - Web service devices (DB_PATH)
```javascript
{
  devices: [{
    uid: "unique-id",
    name: "Device Name",
    service: "wa|telegram|gmail|...",  // NOT "android"
    color: "#hex",
    autoRun: boolean,
    autoSender: boolean,           // WhatsApp auto sender
    pendingURL: "https://...",     // API endpoint for messages
    partition: "persist:uid"
  }]
}
```

**devices-android.json** - Android emulator devices ONLY (DB_PATH_ANDROID)
```javascript
{
  devices: [{
    uid: "unique-id",
    name: "Android Device",
    service: "android",            // MUST be "android"
    avdName: "StarBox_xxxxx",
    autoRun: boolean,
    androidSpec: {
      id: "balanced|lite|performance",
      memoryMb: 1536,
      cores: 2,
      resolution: "720x1280",
      density: 265
    }
  }]
}
```

**Critical Helper Function:**
`getDbPath(serviceKey)` at electron-main.js:1536 - Returns `DB_PATH_ANDROID` if service is "android", otherwise returns `DB_PATH`.

**All handlers now use this:**
- `add-device`: Uses `getDbPath(service)` to route to correct DB
- `edit-device`: Searches both DBs to find device, then saves to correct one
- `delete-device`: Searches both DBs to find and delete from correct one
- `load-devices(dbType)`: Accepts "web", "android", or "all" parameter

### Renderer Process (renderer.js)

Handles UI logic including:
- Device catalog with search and filtering
- Device CRUD operations via IPC
- WhatsApp auto sender UI
- Service library with 60+ predefined services
- Android spec preset selection (Lite, Balanced, Performance)

### Preload Scripts

- **preload.cjs**: Main window bridge (`window.electronAPI`)
- **monitor-preload.cjs**: WhatsApp automation monitor bridge
- **shopee-preload.cjs**: Shopee automation bridge

All use `contextBridge.exposeInMainWorld` for secure IPC.

### Platform-Specific Managers

**android-manager.js**
- Downloads Android emulator (~1.5GB, Google Play image) on-demand
- Manages AVD (Android Virtual Device) creation and lifecycle
- Platform detection: Windows, macOS (including Apple Silicon), Linux
- ADB integration for APK installation and device control
- Path sanitization to avoid double backslash issues on Windows

**ios-manager.js** (macOS only)
- Uses Xcode's `simctl` to manage iOS simulators
- Boot, shutdown, app installation, screenshots
- Only available when Xcode is installed

## Key IPC Channels

### Authentication
- `auth-get-session`: Get current auth session
- `auth-login`: Login with credentials
- `auth-register`: Register new user
- `auth-logout`: Logout current user

### Device Management
- `add-device`: Add new device (auto-routes to correct DB)
- `edit-device`: Update device settings
- `delete-device`: Remove device
- `load-devices`: Load all devices (can filter by dbType)
- `start-device`: Start device window
- `stop-device`: Stop device window
- `is-device-running`: Check if device is active

### Android Emulator
- `android-check-installation`: Check if emulator is installed
- `android-download`: Download emulator components
- `android-start`: Boot emulator with specs
- `android-stop`: Stop running emulator
- `android-fix-issues`: Kill ADB and clean temp files
- `android-kill-adb`: Kill ADB server process

### iOS Simulator (macOS only)
- `ios-check-availability`: Check if Xcode/simctl available
- `ios-get-devices`: List available simulators
- `ios-boot`: Boot simulator
- `ios-shutdown`: Shutdown simulator
- `ios-install-app`: Install IPA/app
- `ios-launch-app`: Launch app by bundle ID

### WhatsApp Automation
- `monitor-trigger-fetch-pending`: Fetch pending messages from API
- `monitor-control-automation`: Play/pause automation
- `automation-monitor-update`: Update monitor stats
- `set-input-guard-state`: Enable/disable input guard overlay

## Important Files

- `index.html`: Main application window
- `automation-monitor.html`: WhatsApp automation monitor UI
- `android-emulator.html`: Android emulator window
- `ios-simulator.html`: iOS simulator window
- `style.css`: Main application styles
- `update-version.js`: Auto-updates version in code before build

## Service Catalog

Predefined services in `DEFAULT_SERVICE_LIBRARY` (renderer.js):
- **Komunikasi**: WhatsApp, Telegram
- **Produktivitas**: Gmail, Google Drive/Docs/Sheets/Slides
- **Media**: YouTube, Instagram, TikTok
- **Marketplace**: Tokopedia, Shopee, Lazada, Bukalapak
- **Business**: Slack, Trello, Notion, GitHub
- **Microsoft 365**: Word, Excel, PowerPoint Online
- And 40+ more services

## WhatsApp Auto Sender

When `autoSender: true` and service is "wa":
1. Device fetches pending messages from `pendingURL/getpendingmessage` (POST)
2. Opens WhatsApp Web chat for each phone number
3. Simulates typing and clicking send button
4. Reports status back to `pendingURL/updatestatusmessage` (POST)
5. Monitor window shows queue, stats, and logs in real-time

API expects:
```javascript
// GET pending response
{
  data: [{
    id: "msg-id",
    phone: "628123456789",
    message: "Hello world",
    priority: 1
  }]
}

// POST status update
{
  status: "success|failed",
  message_id: "msg-id",
  error_message: "..."
}
```

## Android Emulator Presets

Three performance presets defined in `ANDROID_SPEC_PRESETS`:

1. **Lite** - 1 Core, 1 GB RAM, 540x960
2. **Balanced** (default) - 2 Core, 1.5 GB RAM, 720x1280
3. **Performance** - 4 Core, 2 GB RAM, 1080x1920

Function `normalizeAndroidSpecInput(spec)` validates and normalizes spec values with safe limits.

## Windows-Specific Handling

- Path normalization to prevent double backslash errors
- Auto-kill ADB server before downloads/starts
- "Fix Android" button kills ADB and cleans temp directories
- Environment variables sanitized from `\\` to `\`
- See `TROUBLESHOOTING.md` for common Windows filesystem warnings

## Guest vs Authenticated Users

- **Guest mode**: Limited to 2 devices (GUEST_SERVICE_DEVICE_LIMIT)
- **Authenticated**: Unlimited devices
- Auth session stored in electron-store with key `AUTH_SESSION_STORE_KEY`
- Machine ID tracked for analytics via `MACHINE_ID_STORE_KEY`

## Build Configuration

Electron-builder config in package.json:
- Universal binary for macOS (Intel + Apple Silicon)
- NSIS installer for Windows
- AppImage + deb for Linux
- Assets bundled in `assets/` directory
- Excludes: `dist/`, `sessions/`, `repo/`, `start/`
- Custom entitlements for macOS hardened runtime

## Development Tips

- Use `npm run dev` to enable DevTools and hot reload
- Check logs in `<userData>/starbox.log` for main process
- Check `<temp>/starbox-debug.log` for startup arguments
- IPC handlers should validate and sanitize all inputs
- Always use `getDbPath(service)` to route to correct database
- Device UIDs are generated via `uuid.v4()`
- AVD names are sanitized to alphanumeric only (max 32 chars)

## Separate UI for Web vs Android Devices

**Page Structure (index.html):**
- **page-web-emulator**: Web services only (WhatsApp, Telegram, Gmail, etc.)
  - Container: `#device-list`
  - Modal: `#addModal`, `#editModal`
  - Functions: `openModal()`, `submitDevice()`, `loadAllDevicesWeb()`
  - Bulk actions: `runAllDevices()`, `stopSelectedDevices()`, etc.

- **page-android-ios**: Android/iOS emulators only
  - Container: `#device-list-android`
  - Modals: `#addModalAndroid`, `#editModalAndroid` (simpler, Android-specific)
  - Functions: `openModalAndroid()`, `submitAndroidDevice()`, `loadAllDevicesAndroid()`
  - Bulk actions: `runAllDevicesAndroid()`, `stopSelectedDevicesAndroid()`, etc.

**Separate Select All & Bulk Actions:**
- Web page: `selectAllDevices()` targets `#device-list input[type="checkbox"]`
- Android page: `selectAllDevicesAndroid()` targets `#device-list-android input[type="checkbox"]`
- Each page has independent bulk action buttons calling separate functions

**Modal Routing (renderer.js:3800-3855):**
```javascript
// In edit button click handler:
if (device.service === "android") {
  window.openEditAndroidModal(device.uid);
} else {
  // Regular web service modal
}
```

**Key Renderer Functions (renderer.js:4898-5220):**
- `loadAllDevicesWeb()`: Loads from "web" DB, renders to `#device-list`
- `loadAllDevicesAndroid()`: Loads from "android" DB, renders to `#device-list-android`
- `renderDevicesAndroid(devices)`: Android-specific rendering
- `openModalAndroid()`, `closeModalAndroid()`, `submitAndroidDevice()`
- `openEditAndroidModal(uid)`, `saveEditAndroidDevice()`
- All Android bulk actions (run/stop/restart selected/all)

**Page Switching:**
The overridden `switchPage()` function automatically loads the correct device list when switching between pages.

## Related Documentation

- `README.md`: User-facing documentation
- `ANDROID_EMULATOR.md`: Android emulator setup and API
- `TROUBLESHOOTING.md`: Common issues and fixes (especially Windows)
- `SHOPEE_AUTOMATION.md`: Shopee-specific automation
- `VERSION.md`: Version history

## Module System (StarBox as launcher)

Features are being split into modules under `modules/<id>/` (built-in) or `<userData>/modules/<id>/` (installed; wins when its version is newer). CCTV is the first one.

- `module-loader.js` (main): discovers, validates and loads modules; state in `<userData>/modules-state.json`.
- `module-host.js` (renderer): `injectUi()` runs before `renderer.js` (sidebar, page, i18n), `start()` at end of `<body>` loads module scripts and renders the **Modules** page.
- `manifest.json` declares `main`, `renderer`, `page`, `i18n`, `sidebar` (`page`, `after`, `pro`), `permissions`, `sharedDependencies` and `ipc.invoke` / `ipc.events`.
- A module may only `ipcMain.handle` channels listed in `ipc.invoke`; preload (`electronAPI.modules.invoke/on`) only forwards channels of loaded modules.
- Module main exports `register(ctx)`, optional `getStats()` and `shutdown()`. Use `ctx.requireShared(name)` for core npm packages listed in `sharedDependencies`.
- Enabling/disabling a module takes effect after restart.

### Download-only modules (WhatsApp Gateway / Baileys)

- `modules/whatsapp-gateway/` has its own `package.json` + lockfile + `node_modules`; Baileys is **not** a core dependency anymore and is excluded from the installer (`build.files`).
- `manifest.distribution: "download"` → loaded from `modules/` only in development (`STARBOX_DEV_MODULES=off` disables that to test the install flow); release users install it from the catalog on the **Modules** page.
- `module-installer.js`: fetches the catalog (`STARBOX_MODULE_CATALOG` or `<API>/modules/catalog.json`), downloads over HTTPS (catalog host + GitHub only), verifies SHA-256, extracts to `<userData>/modules/<id>`.
- `npm run modules:install` installs module deps for dev; `npm run modules:pack -- <id> [--base-url <url/>]` builds `dist-modules/<id>-<ver>.zip` + `catalog.json`.
- Module deps must stay compatible with Electron's Node (Electron 25 = Node 18.15); the WA lockfile was seeded from the core lockfile for that reason.
- Manifest extras: `pageAfter`, `pageLabel`, `rendererDeps` / `styleDeps` (cdnjs/jsdelivr only), `coreServices` (core functions exposed via `ctx.services`), `icon`, `ipc.send` (fire-and-forget channels → `ipcMain.on`, renderer `electronAPI.modules.send`); module main may export `start()` (awaited after app ready) and `api` (read by core via `moduleLoader.getApi(id)`).
- Download modules today: `whatsapp-gateway` (Baileys), `remox` (SSH/Telnet/RDP; `ssh2` installed pure-JS with `--omit=optional`), `mikrotik` (uses Remox via `ctx.getModuleApi("remox")`, declared in `optionalModules`) and `os-virtual` (QEMU/VNC; `vm-storage.js`, `vnc-viewer.html`, `vnc-preload.cjs` live in the module).
- Sidebar placement: `sidebar.after` / `pageAfter` accept a list of fallback anchors and modules are inserted by `sidebar.order`, so the order stays stable whichever modules are installed. Core features that use them must handle the module being absent: MikroTik SSH returns `needsModule: "remox"` and the UI calls `StarBoxModuleHost.openPage(page, moduleId)`; the remote-client SSH relay gets `ssh2` via `RemoteSocketClient.setSshClientResolver`.
