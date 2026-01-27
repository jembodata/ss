import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function openDb(databaseUrl) {
  const filePath = databaseUrl?.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
  if (!filePath) throw new Error("DATABASE_URL required, e.g. file:/data/app.db");

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);

  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(profile_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      cron TEXT NOT NULL,
      timezone TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      error TEXT,
      log_tail TEXT,
      FOREIGN KEY(job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phase TEXT NOT NULL,
      bucket TEXT NOT NULL,
      object_key TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      uploaded_external INTEGER NOT NULL DEFAULT 0,
      external_status INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES runs(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts(run_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_name ON notifications(name);
  `);

  const scheduleCols = db.prepare("PRAGMA table_info(schedules)").all().map(c => c.name);
  if (!scheduleCols.includes("mode")) {
    db.exec("ALTER TABLE schedules ADD COLUMN mode TEXT NOT NULL DEFAULT 'daily'");
  }
  if (!scheduleCols.includes("remaining_runs")) {
    db.exec("ALTER TABLE schedules ADD COLUMN remaining_runs INTEGER");
  }
}
