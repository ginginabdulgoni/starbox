#!/usr/bin/env node
"use strict";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * StarBox Remote Control – Test Client
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Simulasi 2 client (Komputer A dan Komputer B) menggunakan token yang sama.
 *
 * Mode 1 – pakai token asli:
 *   node test-client.js --token=<JWT_TOKEN>
 *
 * Mode 2 – pakai mock auth (server harus dijalankan dengan MOCK_AUTH=true):
 *   MOCK_AUTH=true node ../index.js   (di terminal lain)
 *   node test-client.js --mock
 *
 * Mode 3 – test lengkap dengan semua command:
 *   node test-client.js --token=<JWT> --all
 */

const { io } = require("socket.io-client");

// ─── Config ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    if (!a.startsWith("--")) return [a, true];
    const eq = a.indexOf("=");
    return eq === -1 ? [a.slice(2), true] : [a.slice(2, eq), a.slice(eq + 1)];
  })
);
const SERVER    = args.server  || "http://localhost:4200";
const TOKEN     = args.token   || process.env.STARBOX_TOKEN || "mock-token-for-testing";
const RUN_ALL   = !!args.all;
const MOCK_MODE = !!args.mock;

const colors = {
  reset:  "\x1b[0m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  gray:   "\x1b[90m",
  bold:   "\x1b[1m",
};
const c = (col, s) => `${colors[col]}${s}${colors.reset}`;

// ─── Logger ───────────────────────────────────────────────────────────────────
function log(tag, msg, data) {
  const ts = new Date().toLocaleTimeString("id-ID");
  const tagStr = tag.padEnd(12);
  console.log(`${c("gray", ts)} ${tagStr} ${msg}`, data !== undefined ? c("gray", JSON.stringify(data, null, 2)) : "");
}

// ─── Connect ──────────────────────────────────────────────────────────────────
function createClient(name, clientId) {
  return new Promise((resolve, reject) => {
    log(c("cyan", `[${name}]`), "Connecting ke " + SERVER);

    const socket = io(SERVER, {
      auth: {
        token: `Bearer ${TOKEN}`,
        meta: {
          client_id:   clientId,
          hostname:    `Test-${name}`,
          platform:    process.platform,
          app_version: "test-1.0.0",
        },
      },
      transports:  ["websocket"],
      reconnection: false,
      timeout:      5000,
    });

    socket.on("connect", () => {
      log(c("green", `[${name}]`), `✓ Terhubung (socket.id=${socket.id})`);
      socket.name = name;
      resolve(socket);
    });

    socket.on("connect_error", (err) => {
      log(c("red", `[${name}]`), `✗ Gagal connect: ${err.message}`);
      if (err.message === "AUTH_REQUIRED" || err.message === "AUTH_INVALID") {
        console.log();
        console.log(c("yellow", "  ⚠  Token tidak valid!"));
        console.log("     Cara mendapatkan token:");
        console.log("     1. Buka StarBox, login ke akun Anda");
        console.log("     2. Buka DevTools (Ctrl+Shift+I)");
        console.log("     3. Ketik di Console:");
        console.log(c("cyan", "        await window.electronAPI.getSession()"));
        console.log("     4. Salin nilai field 'token'");
        console.log("     5. Jalankan: node test-client.js --token=<token yang disalin>");
        console.log();
      }
      reject(new Error(err.message));
    });

    socket.on("disconnect", (reason) => {
      log(c("yellow", `[${name}]`), `Disconnected: ${reason}`);
    });
  });
}

// ─── Helper: kirim command dan tunggu hasil ────────────────────────────────────
function sendCommand(socket, toClientId, command, payload = {}) {
  return new Promise((resolve, reject) => {
    const tid = setTimeout(() => reject(new Error("Timeout 10s")), 10000);

    socket.once("command:result", (data) => {
      clearTimeout(tid);
      resolve(data);
    });

    socket.once("command:error", (data) => {
      clearTimeout(tid);
      reject(new Error(`${data.error}: ${data.message}`));
    });

    socket.emit("command:request", { to_client_id: toClientId, command, payload });
  });
}

// ─── Test Suites ──────────────────────────────────────────────────────────────
async function runTests(clientA, clientB) {
  console.log();
  console.log(c("bold", "═══════════════════════════════════════════════════"));
  console.log(c("bold", " UJICOBA REMOTE COMMAND"));
  console.log(c("bold", "═══════════════════════════════════════════════════"));
  console.log(`  Client A = ${c("cyan", clientA.name)} (pengirim command)`);
  console.log(`  Client B = ${c("cyan", clientB.name)} (target, mengeksekusi)`);
  console.log();

  // ── Pasang executor di Client B ──────────────────────────────────────────
  clientB.on("command:execute", async ({ command_id, from_client_id, command, payload }) => {
    log(c("cyan", `[B-EXEC]`), `Terima command '${c("yellow", command)}' dari ${from_client_id}`);

    // Simulasi eksekusi command – kembalikan mock data
    const mockResults = {
      list_devices: {
        devices: [
          { uid: "aaa-111", name: "WhatsApp Bisnis", service: "wa",       running: true  },
          { uid: "bbb-222", name: "Telegram Bot",    service: "telegram", running: false },
          { uid: "ccc-333", name: "Gmail Kantor",    service: "gmail",    running: true  },
        ]
      },
      get_tabs: {
        tabs: [
          { uid: "aaa-111", url: "https://web.whatsapp.com", title: "WhatsApp", loading: false },
          { uid: "ccc-333", url: "https://mail.google.com",  title: "Gmail",    loading: false },
        ]
      },
      get_current_url:  { uid: payload.uid, url: "https://web.whatsapp.com" },
      get_title:        { uid: payload.uid, title: "WhatsApp" },
      start_device:     { message: "Device berhasil dijalankan", uid: payload.uid },
      stop_device:      { message: "Device berhasil dihentikan", uid: payload.uid },
      restart_device:   { message: "Device berhasil direstart",  uid: payload.uid },
      focus_tab:        { message: "Tab difokuskan",   uid: payload.uid },
      reload_tab:       { message: "Tab di-reload",    uid: payload.uid },
      close_tab:        { message: "Tab ditutup",      uid: payload.uid },
      navigate_url:     { message: "Navigasi berhasil", uid: payload.uid, url: payload.url },
      open_tab:         { message: "Tab dibuka",       uid: payload.uid },
    };

    const result = mockResults[command] || { message: `Command '${command}' dieksekusi`, payload };
    clientB.emit("command:response", { command_id, status: "success", result });
  });

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`  ${("" + (passed + failed + 1)).padStart(2)}. ${name.padEnd(35)}`);
    try {
      const res = await fn();
      console.log(c("green", "✓ PASS") + (res ? c("gray", "  → " + JSON.stringify(res).slice(0, 60)) : ""));
      passed++;
    } catch (err) {
      console.log(c("red", "✗ FAIL") + c("red", "  → " + err.message));
      failed++;
    }
  }

  // ── Test 1: Client A lihat daftar client online ──────────────────────────
  await test("clients:list (terima saat connect)", () => {
    return new Promise((res, rej) => {
      // Sudah diterima saat connect, cek via refresh
      clientA.once("clients:list", (data) => res(`${data.clients.length} client`));
      clientA.emit("clients:refresh");
      setTimeout(() => rej(new Error("Tidak menerima clients:list")), 3000);
    });
  });

  // ── Test 2: list_devices ─────────────────────────────────────────────────
  await test("list_devices", async () => {
    const res = await sendCommand(clientA, clientB.targetId, "list_devices");
    if (!res.result?.devices) throw new Error("Tidak ada field devices");
    return `${res.result.devices.length} devices`;
  });

  // ── Test 3: get_tabs ──────────────────────────────────────────────────────
  await test("get_tabs", async () => {
    const res = await sendCommand(clientA, clientB.targetId, "get_tabs");
    if (!res.result?.tabs) throw new Error("Tidak ada field tabs");
    return `${res.result.tabs.length} tabs`;
  });

  // ── Test 4: get_current_url ───────────────────────────────────────────────
  await test("get_current_url", async () => {
    const res = await sendCommand(clientA, clientB.targetId, "get_current_url", { uid: "aaa-111" });
    return res.result?.url;
  });

  // ── Test 5: get_title ─────────────────────────────────────────────────────
  await test("get_title", async () => {
    const res = await sendCommand(clientA, clientB.targetId, "get_title", { uid: "aaa-111" });
    return res.result?.title;
  });

  // ── Test 6: navigate_url ──────────────────────────────────────────────────
  await test("navigate_url", async () => {
    const res = await sendCommand(clientA, clientB.targetId, "navigate_url", {
      uid: "aaa-111", url: "https://web.whatsapp.com"
    });
    return res.result?.message;
  });

  // ── Test 7: focus_tab ─────────────────────────────────────────────────────
  await test("focus_tab", async () => {
    const res = await sendCommand(clientA, clientB.targetId, "focus_tab", { uid: "aaa-111" });
    return res.result?.message;
  });

  // ── Test 8: reload_tab ────────────────────────────────────────────────────
  await test("reload_tab", async () => {
    const res = await sendCommand(clientA, clientB.targetId, "reload_tab", { uid: "aaa-111" });
    return res.result?.message;
  });

  if (RUN_ALL) {
    // ── Test 9: start_device ────────────────────────────────────────────────
    await test("start_device", async () => {
      const res = await sendCommand(clientA, clientB.targetId, "start_device", { uid: "bbb-222" });
      return res.result?.message;
    });

    // ── Test 10: stop_device ────────────────────────────────────────────────
    await test("stop_device", async () => {
      const res = await sendCommand(clientA, clientB.targetId, "stop_device", { uid: "aaa-111" });
      return res.result?.message;
    });

    // ── Test 11: restart_device ─────────────────────────────────────────────
    await test("restart_device", async () => {
      const res = await sendCommand(clientA, clientB.targetId, "restart_device", { uid: "aaa-111" });
      return res.result?.message;
    });

    // ── Test 12: close_tab ──────────────────────────────────────────────────
    await test("close_tab", async () => {
      const res = await sendCommand(clientA, clientB.targetId, "close_tab", { uid: "ccc-333" });
      return res.result?.message;
    });

    // ── Test 13: open_tab ───────────────────────────────────────────────────
    await test("open_tab", async () => {
      const res = await sendCommand(clientA, clientB.targetId, "open_tab", { uid: "ccc-333" });
      return res.result?.message;
    });

    // ── Test 14: send_js BLOKIR (server punya ALLOW_SEND_JS=false) ──────────
    await test("send_js (harus ditolak server)", async () => {
      return new Promise((res, rej) => {
        clientA.once("command:error", (data) => {
          if (data.error === "FEATURE_DISABLED") res("Ditolak dengan benar ✓");
          else rej(new Error("Error yang salah: " + data.error));
        });
        clientA.emit("command:request", {
          to_client_id: clientB.id,
          command: "send_js",
          payload: { uid: "aaa-111", code: "document.title" },
        });
        setTimeout(() => rej(new Error("Tidak ada balasan dari server")), 3000);
      });
    });

    // ── Test 15: command ke client lain (harus FORBIDDEN) ───────────────────
    await test("command ke client asing (harus FORBIDDEN)", async () => {
      return new Promise((res, rej) => {
        clientA.once("command:error", (data) => {
          if (data.error === "FORBIDDEN") res("Ditolak dengan benar ✓");
          else rej(new Error("Seharusnya FORBIDDEN, dapat: " + data.error));
        });
        clientA.emit("command:request", {
          to_client_id: "client-milik-user-lain",
          command:       "list_devices",
          payload:       {},
        });
        setTimeout(() => rej(new Error("Tidak ada balasan dari server")), 3000);
      });
    });
  }

  // ── Hasil ────────────────────────────────────────────────────────────────
  console.log();
  console.log(c("bold", "═══════════════════════════════════════════════════"));
  console.log(`  Hasil: ${c("green", passed + " PASS")}  ${failed > 0 ? c("red", failed + " FAIL") : c("gray", "0 FAIL")}`);
  console.log(c("bold", "═══════════════════════════════════════════════════"));
  console.log();

  return { passed, failed };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log();
  console.log(c("bold", "StarBox Remote Control – Test Client"));
  console.log(c("gray", `Server: ${SERVER}`));
  console.log(c("gray", `Token:  ${TOKEN.slice(0, 20)}...`));
  console.log();

  let clientA, clientB;

  try {
    // Koneksi dua client secara bersamaan
    [clientA, clientB] = await Promise.all([
      createClient("Komputer-A", "test-client-a"),
      createClient("Komputer-B", "test-client-b"),
    ]);

    // Tunggu clients:list – ambil client_id resmi Client B dari DB server
    const targetClientId = await new Promise((res) => {
      const tid = setTimeout(() => {
        // Fallback: gunakan custom client_id yang diset saat connect
        res("test-client-b");
      }, 2000);
      clientA.on("clients:list", (data) => {
        const found = (data.clients || []).find(c =>
          c.client_id === "test-client-b" || c.hostname === "Test-Komputer-B"
        );
        if (found) { clearTimeout(tid); res(found.client_id); }
      });
      setTimeout(() => clientA.emit("clients:refresh"), 200);
    });

    log(c("green", "[INFO]"), `Client B terdaftar dengan ID: ${c("cyan", targetClientId)}`);
    // Simpan target ID agar runTests bisa akses
    clientB.targetId = targetClientId;

    // Jalankan test suite
    const { failed } = await runTests(clientA, clientB);

    clientA.disconnect();
    clientB.disconnect();
    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error(c("red", "\n✗ Test gagal: " + err.message));
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    process.exit(1);
  }
}

main();
