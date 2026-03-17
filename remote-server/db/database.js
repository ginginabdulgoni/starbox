"use strict";

/**
 * SQLite wrapper menggunakan sql.js (pure JavaScript/WASM, tanpa native compilation).
 * Menyediakan API synchronous yang kompatibel dengan better-sqlite3.
 *
 * Perbedaan dari better-sqlite3:
 *  - init() adalah async (perlu di-await)
 *  - Otomatis persist ke file setelah setiap operasi write
 */

const path = require("path");
const fs   = require("fs");
const config = require("../config");
const logger = require("../utils/logger");

let _wrapper = null;

// ─── Parameter adapter ────────────────────────────────────────────────────────

/**
 * Konversi params format better-sqlite3 ke format sql.js.
 *
 * better-sqlite3: .run({ clientId: "x" })   → SQL: @clientId
 * sql.js:         .run({ "@clientId": "x" }) → SQL: @clientId
 *
 * - Object tanpa prefix: tambahkan "@"
 * - Primitive tunggal: wrap jadi array [value] untuk placeholder "?"
 * - Array: langsung digunakan (positional ?)
 */
function adaptParams(params, rest) {
  // Dipanggil dengan multiple args: .get("a", "b") → positional ["a","b"]
  if (rest && rest.length > 0) {
    return [params, ...rest];
  }
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params;
  if (typeof params === "object") {
    // Konversi { clientId: "x" } → { "@clientId": "x" }
    const out = {};
    for (const [k, v] of Object.entries(params)) {
      out[/^[@:$]/.test(k) ? k : `@${k}`] = v;
    }
    return out;
  }
  // Primitive tunggal → positional
  return [params];
}

// ─── Statement Wrapper ────────────────────────────────────────────────────────

class SqlWrapperStatement {
  constructor(sqlJsDb, sql, onWrite) {
    this._db     = sqlJsDb;
    this._sql    = sql;
    this._onWrite = onWrite;
  }

  /**
   * Eksekusi INSERT/UPDATE/DELETE dengan params.
   * @param {object|any} params
   * @returns {{ changes: number }}
   */
  run(params) {
    const stmt = this._db.prepare(this._sql);
    try {
      stmt.run(adaptParams(params));
    } finally {
      stmt.free();
    }
    this._onWrite();
    return { changes: this._db.getRowsModified() };
  }

  /**
   * Ambil satu baris (SELECT ... LIMIT 1 semantics).
   * @param {any} params
   * @returns {object|undefined}
   */
  get(params, ...rest) {
    const stmt = this._db.prepare(this._sql);
    let row;
    try {
      stmt.bind(adaptParams(params, rest));
      row = stmt.step() ? stmt.getAsObject() : undefined;
    } finally {
      stmt.free();
    }
    return row;
  }

  /**
   * Ambil semua baris.
   * @param {any} params
   * @returns {object[]}
   */
  all(params, ...rest) {
    const stmt = this._db.prepare(this._sql);
    const rows = [];
    try {
      stmt.bind(adaptParams(params, rest));
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }
    return rows;
  }
}

// ─── Database Wrapper ─────────────────────────────────────────────────────────

class SqlWrapper {
  constructor(sqlJsDb, dbPath) {
    this._db   = sqlJsDb;
    this._path = dbPath;
  }

  /** Abaikan PRAGMA yang tidak relevan untuk sql.js (WAL, foreign_keys) */
  pragma(str) {
    try {
      this._db.run(`PRAGMA ${str}`);
      this._save();
    } catch {
      // Beberapa pragma tidak didukung sql.js, abaikan
    }
  }

  /**
   * Eksekusi SQL multi-statement (untuk migrations).
   * Gunakan exec() bukan run() agar semua statement dijalankan.
   */
  exec(sql) {
    this._db.exec(sql);
    this._save();
  }

  /** Prepare statement, return wrapper dengan API better-sqlite3-like */
  prepare(sql) {
    return new SqlWrapperStatement(this._db, sql, () => this._save());
  }

  /**
   * Transaction: jalankan fn dalam BEGIN/COMMIT, rollback jika error.
   * @param {Function} fn
   * @returns {Function} - fungsi yang membungkus fn dalam transaksi
   */
  transaction(fn) {
    const db   = this._db;
    const save = () => this._save();
    return function () {
      db.run("BEGIN");
      try {
        fn();
        db.run("COMMIT");
        save();
      } catch (e) {
        try { db.run("ROLLBACK"); } catch {}
        throw e;
      }
    };
  }

  /** Simpan database ke file */
  _save() {
    const data = this._db.export();
    fs.writeFileSync(this._path, Buffer.from(data));
  }
}

// ─── Migrations ───────────────────────────────────────────────────────────────

function getMigrations() {
  return [
    {
      version: 1,
      description: "Buat tabel client_registry dan audit_log",
      // sql.js exec() menjalankan multi-statement sekaligus
      sql: `
        CREATE TABLE IF NOT EXISTS client_registry (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id        TEXT    NOT NULL UNIQUE,
          user_id          TEXT    NOT NULL,
          user_email       TEXT    NOT NULL DEFAULT '',
          user_name        TEXT    NOT NULL DEFAULT '',
          hostname         TEXT    NOT NULL DEFAULT '',
          platform         TEXT    NOT NULL DEFAULT '',
          app_version      TEXT    NOT NULL DEFAULT '',
          ip_address       TEXT    NOT NULL DEFAULT '',
          connected_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_heartbeat   DATETIME DEFAULT CURRENT_TIMESTAMP,
          disconnected_at  DATETIME,
          status           TEXT    NOT NULL DEFAULT 'online'
        );
        CREATE INDEX IF NOT EXISTS idx_cr_user_id ON client_registry(user_id);
        CREATE INDEX IF NOT EXISTS idx_cr_status  ON client_registry(status);
        CREATE TABLE IF NOT EXISTS audit_log (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          command_id      TEXT    NOT NULL UNIQUE,
          user_id         TEXT    NOT NULL,
          from_client_id  TEXT    NOT NULL,
          to_client_id    TEXT    NOT NULL,
          command         TEXT    NOT NULL,
          payload         TEXT,
          result          TEXT,
          status          TEXT    NOT NULL DEFAULT 'pending',
          error_message   TEXT,
          ip_address      TEXT    NOT NULL DEFAULT '',
          executed_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at    DATETIME,
          duration_ms     INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_al_user_id     ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_al_command_id  ON audit_log(command_id);
        CREATE INDEX IF NOT EXISTS idx_al_executed_at ON audit_log(executed_at);
        CREATE INDEX IF NOT EXISTS idx_al_status      ON audit_log(status);
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `,
    },
    {
      version: 2,
      description: "Tambah kolom device_name ke client_registry",
      sql: `
        ALTER TABLE client_registry ADD COLUMN device_name TEXT NOT NULL DEFAULT '';
      `,
    },
    {
      version: 3,
      description: "Tambah kolom permanent_pin ke client_registry",
      sql: `ALTER TABLE client_registry ADD COLUMN permanent_pin TEXT DEFAULT NULL;`,
    },
    {
      version: 4,
      description: "Buat tabel device_access_codes untuk OTP remote access",
      sql: `
        CREATE TABLE IF NOT EXISTS device_access_codes (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id   TEXT    NOT NULL,
          owner_id    TEXT    NOT NULL,
          code        TEXT    NOT NULL UNIQUE,
          used        INTEGER NOT NULL DEFAULT 0,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at  DATETIME NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dac_code      ON device_access_codes(code);
        CREATE INDEX IF NOT EXISTS idx_dac_client_id ON device_access_codes(client_id);
      `,
    },
  ];
}

function runMigrations(wrapper) {
  const current = wrapper.prepare("SELECT MAX(version) as v FROM schema_version").get();
  const currentVersion = current?.v || 0;

  const pending = getMigrations().filter((m) => m.version > currentVersion);
  if (pending.length === 0) {
    logger.debug("[DB] Schema sudah up-to-date");
    return;
  }

  for (const m of pending) {
    logger.info(`[DB] Migration v${m.version}: ${m.description}`);
    // Jalankan migration SQL
    wrapper._db.exec(m.sql);
    // Catat versi
    wrapper.prepare("INSERT INTO schema_version (version) VALUES (@version)").run({ version: m.version });
    wrapper._save();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Inisialisasi database (ASYNC karena sql.js init asynchronous).
 * Harus di-await sebelum getDb() bisa dipanggil.
 */
async function init() {
  const dbPath = config.DB_PATH;
  const dbDir  = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Muat sql.js (WASM-based, tanpa native compilation)
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  // Buka atau buat database dari file
  let sqlJsDb;
  if (fs.existsSync(dbPath)) {
    let fileBuffer;
    try {
      fileBuffer = fs.readFileSync(dbPath);
      sqlJsDb = new SQL.Database(fileBuffer);
      // Quick integrity check
      sqlJsDb.run("SELECT 1");
      logger.info(`[DB] Database dimuat dari: ${dbPath}`);
    } catch (loadErr) {
      logger.warn(`[DB] File database rusak (${loadErr.message}), mereset ke database baru...`);
      // Rename file rusak sebagai backup
      const backupPath = `${dbPath}.corrupted.${Date.now()}`;
      try { fs.renameSync(dbPath, backupPath); logger.warn(`[DB] File rusak disimpan ke: ${backupPath}`); } catch {}
      sqlJsDb = new SQL.Database();
      logger.info(`[DB] Database baru dibuat: ${dbPath}`);
    }
  } else {
    sqlJsDb = new SQL.Database();
    logger.info(`[DB] Database baru dibuat: ${dbPath}`);
  }

  // Buat schema_version dulu agar migration check bisa berjalan
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  _wrapper = new SqlWrapper(sqlJsDb, dbPath);

  // Simpan schema_version awal
  _wrapper._save();

  // Jalankan migrations
  runMigrations(_wrapper);

  logger.info(`[DB] SQLite (sql.js) siap: ${dbPath}`);
  return _wrapper;
}

/**
 * Ambil instance database (harus panggil init() dulu).
 * @returns {SqlWrapper}
 */
function getDb() {
  if (!_wrapper) throw new Error("Database belum diinisialisasi. Panggil await init() dulu.");
  return _wrapper;
}

module.exports = { init, getDb };
