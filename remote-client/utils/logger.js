"use strict";

// Logger ringan untuk remote-client (di Electron main process)
// Forward ke console; di production bisa di-pipe ke file logger yang sudah ada

function fmt(level, ...args) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [RemoteClient:${level.toUpperCase()}]`;
  if (level === "error") console.error(prefix, ...args);
  else console.log(prefix, ...args);
}

module.exports = {
  debug: (...a) => (process.env.NODE_ENV === "development" ? fmt("debug", ...a) : null),
  info:  (...a) => fmt("info", ...a),
  warn:  (...a) => fmt("warn", ...a),
  error: (...a) => fmt("error", ...a),
};
