#!/usr/bin/env node

const { spawn } = require("child_process");

const electronBinary = require("electron");
const env = { ...process.env };

// Some shells export ELECTRON_RUN_AS_NODE for unrelated tooling, which breaks
// the main-process bootstrap by turning Electron into plain Node.js.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, process.argv.slice(2), {
  stdio: "inherit",
  env,
});

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
