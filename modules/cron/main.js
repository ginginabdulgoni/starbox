// ═══════════════════════════════════════════════════════════════════════════════
// Modul Jadwal (Cron) — sisi main process
// Dipindah dari electron-main.js: penjadwal HTTP request berbasis ekspresi cron,
// riwayat eksekusi dan validasi ekspresi. Data tetap di <userData>/db/cron-jobs.json.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

let stopImpl = () => {};
let startImpl = () => {};

function register(context) {
  const { ipcMain, app, BrowserWindow } = context.electron;
  const cronParser = context.requireShared("cron-parser");
  const uuidv4 = context.requireShared("uuid").v4;
  const { LOG_RETENTION_DAYS } = context.services.getAppInfo();


  let CRON_JOBS_DB_PATH = null;

  const MAX_CRON_HISTORY = 100; // max history entries per job

  let cronSchedulerInterval = null;

  function cronDbRead() {
    if (!CRON_JOBS_DB_PATH) return { jobs: [] };
    const dir = path.dirname(CRON_JOBS_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(CRON_JOBS_DB_PATH)) {
      fs.writeFileSync(CRON_JOBS_DB_PATH, JSON.stringify({ jobs: [] }, null, 2));
      return { jobs: [] };
    }
    try {
      return JSON.parse(fs.readFileSync(CRON_JOBS_DB_PATH, "utf8"));
    } catch {
      return { jobs: [] };
    }
  }

  function cronDbWrite(data) {
    if (!CRON_JOBS_DB_PATH) return;
    const dir = path.dirname(CRON_JOBS_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CRON_JOBS_DB_PATH, JSON.stringify(data, null, 2));
  }

  function cronShouldRun(cronExpr, now) {
    try {
      const interval = cronParser.parseExpression(cronExpr, { currentDate: now, iterator: true });
      const prev = interval.prev();
      // Check if the previous scheduled time is within the current minute
      const prevDate = prev.value.toDate();
      return Math.abs(prevDate.getTime() - now.getTime()) < 60000;
    } catch {
      return false;
    }
  }

  function cronNextRun(cronExpr) {
    try {
      const interval = cronParser.parseExpression(cronExpr);
      return interval.next().toDate().toISOString();
    } catch {
      return null;
    }
  }

  async function cronExecuteJob(job) {
    const startTime = Date.now();
    const http = require("http");
    const https = require("https");
    const url = new URL(job.url);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const method = (job.method || "GET").toUpperCase();
    const headers = Object.assign({ "User-Agent": "StarBox-CronJob/1.0" }, job.headers || {});
    let body = null;
    if (method === "POST" && job.body) {
      body = typeof job.body === "string" ? job.body : JSON.stringify(job.body);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    return new Promise((resolve) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 30000,
      };
      const req = lib.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            duration: Date.now() - startTime,
            response: data.substring(0, 500),
          });
        });
      });
      req.on("error", (err) => {
        resolve({ status: 0, ok: false, duration: Date.now() - startTime, error: err.message });
      });
      req.on("timeout", () => {
        req.destroy();
        resolve({ status: 0, ok: false, duration: Date.now() - startTime, error: "Request timeout" });
      });
      if (body) req.write(body);
      req.end();
    });
  }

  function startCronScheduler() {
    if (cronSchedulerInterval) clearInterval(cronSchedulerInterval);
    // Align to the next whole minute, then tick every 60s
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    setTimeout(() => {
      runDueCronJobs();
      cronSchedulerInterval = setInterval(runDueCronJobs, 60000);
    }, msToNextMinute);
  }

  async function runDueCronJobs() {
    const db = cronDbRead();
    if (!db.jobs || !db.jobs.length) return;
    const now = new Date();
    let changed = false;
    for (const job of db.jobs) {
      if (!job.enabled) continue;
      if (!cronShouldRun(job.schedule, now)) continue;
      // Run the job
      const result = await cronExecuteJob(job).catch((err) => ({
        status: 0, ok: false, duration: 0, error: err.message,
      }));
      const historyEntry = {
        id: uuidv4(),
        runAt: now.toISOString(),
        status: result.ok ? "success" : "failed",
        httpStatus: result.status,
        duration: result.duration,
        response: result.response || null,
        error: result.error || null,
      };
      if (!job.history) job.history = [];
      job.history.unshift(historyEntry);
      // Prune entries older than retention window, then cap at MAX_CRON_HISTORY
      const historyCutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      job.history = job.history.filter(h => new Date(h.runAt).getTime() >= historyCutoff);
      if (job.history.length > MAX_CRON_HISTORY) job.history = job.history.slice(0, MAX_CRON_HISTORY);
      job.lastRun = historyEntry.runAt;
      job.lastStatus = historyEntry.status;
      job.nextRun = cronNextRun(job.schedule);
      changed = true;
      console.log(`[CRON] Job "${job.name}" → ${historyEntry.status} (${result.status}) in ${result.duration}ms`);
      // Notify renderer
      const wins = BrowserWindow.getAllWindows();
      if (wins.length) wins[0].webContents.send("cron-job-executed", { jobId: job.id, entry: historyEntry });
    }
    if (changed) cronDbWrite(db);
  }

  ipcMain.handle("cron-load-jobs", () => {
    const db = cronDbRead();
    // Refresh nextRun for all jobs
    (db.jobs || []).forEach((j) => { j.nextRun = cronNextRun(j.schedule); });
    return db.jobs || [];
  });

  ipcMain.handle("cron-add-job", (_, job) => {
    const db = cronDbRead();
    const newJob = {
      id: uuidv4(),
      name: job.name || "Untitled Job",
      schedule: job.schedule || "*/5 * * * *",
      url: job.url || "",
      method: job.method || "GET",
      body: job.body || "",
      headers: job.headers || {},
      enabled: job.enabled !== false,
      history: [],
      lastRun: null,
      lastStatus: null,
      nextRun: cronNextRun(job.schedule || "*/5 * * * *"),
      createdAt: new Date().toISOString(),
    };
    if (!db.jobs) db.jobs = [];
    db.jobs.push(newJob);
    cronDbWrite(db);
    return newJob;
  });

  ipcMain.handle("cron-edit-job", (_, { id, updates }) => {
    const db = cronDbRead();
    const idx = (db.jobs || []).findIndex((j) => j.id === id);
    if (idx === -1) return { ok: false, error: "Job not found" };
    const job = db.jobs[idx];
    Object.assign(job, {
      name: updates.name ?? job.name,
      schedule: updates.schedule ?? job.schedule,
      url: updates.url ?? job.url,
      method: updates.method ?? job.method,
      body: updates.body ?? job.body,
      headers: updates.headers ?? job.headers,
      enabled: updates.enabled ?? job.enabled,
    });
    job.nextRun = cronNextRun(job.schedule);
    cronDbWrite(db);
    return { ok: true, job };
  });

  ipcMain.handle("cron-delete-job", (_, id) => {
    const db = cronDbRead();
    const before = (db.jobs || []).length;
    db.jobs = (db.jobs || []).filter((j) => j.id !== id);
    if (db.jobs.length === before) return { ok: false };
    cronDbWrite(db);
    return { ok: true };
  });

  ipcMain.handle("cron-toggle-job", (_, { id, enabled }) => {
    const db = cronDbRead();
    const job = (db.jobs || []).find((j) => j.id === id);
    if (!job) return { ok: false };
    job.enabled = enabled;
    cronDbWrite(db);
    return { ok: true };
  });

  ipcMain.handle("cron-run-now", async (_, id) => {
    const db = cronDbRead();
    const job = (db.jobs || []).find((j) => j.id === id);
    if (!job) return { ok: false, error: "Job not found" };
    const result = await cronExecuteJob(job).catch((err) => ({
      status: 0, ok: false, duration: 0, error: err.message,
    }));
    const historyEntry = {
      id: uuidv4(),
      runAt: new Date().toISOString(),
      status: result.ok ? "success" : "failed",
      httpStatus: result.status,
      duration: result.duration,
      response: result.response || null,
      error: result.error || null,
      manual: true,
    };
    if (!job.history) job.history = [];
    job.history.unshift(historyEntry);
    if (job.history.length > MAX_CRON_HISTORY) job.history = job.history.slice(0, MAX_CRON_HISTORY);
    job.lastRun = historyEntry.runAt;
    job.lastStatus = historyEntry.status;
    cronDbWrite(db);
    return { ok: true, entry: historyEntry };
  });

  ipcMain.handle("cron-get-history", (_, id) => {
    const db = cronDbRead();
    const job = (db.jobs || []).find((j) => j.id === id);
    return job ? (job.history || []) : [];
  });

  ipcMain.handle("cron-clear-history", (_, id) => {
    const db = cronDbRead();
    const job = (db.jobs || []).find((j) => j.id === id);
    if (!job) return { ok: false };
    job.history = [];
    cronDbWrite(db);
    return { ok: true };
  });

  ipcMain.handle("cron-validate-expr", (_, expr) => {
    try {
      cronParser.parseExpression(expr);
      const next = cronNextRun(expr);
      return { valid: true, next };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  });

  CRON_JOBS_DB_PATH = path.join(app.getPath("userData"), "db", "cron-jobs.json");
  startImpl = () => startCronScheduler();
  stopImpl = () => {
    if (cronSchedulerInterval) clearInterval(cronSchedulerInterval);
  };
}

module.exports = { register, start: () => startImpl(), shutdown: () => stopImpl() };
