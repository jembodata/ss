import { openDb, migrate } from "../db.js";

export function makeSqliteStore(databaseUrl) {
  const db = openDb(databaseUrl);
  migrate(db);

  function parseConfig(row) {
    return { ...row, config: JSON.parse(row.config_json) };
  }

  return {
    getProfile(profileId) {
      const row = db.prepare("SELECT * FROM profiles WHERE id=?").get(profileId);
      if (!row) throw new Error("Profile not found");
      return parseConfig(row);
    },
    listProfiles() {
      const rows = db.prepare("SELECT * FROM profiles ORDER BY created_at DESC").all();
      return rows.map(parseConfig);
    },
    createProfile({ id, name, config, createdAt }) {
      db.prepare("INSERT INTO profiles (id,name,config_json,created_at) VALUES (?,?,?,?)")
        .run(id, name, JSON.stringify(config), createdAt);
      return { id };
    },
    updateProfile({ id, name, config }) {
      const updated = db.prepare("UPDATE profiles SET name=?, config_json=? WHERE id=?")
        .run(name, JSON.stringify(config), id);
      return updated.changes > 0;
    },
    deleteProfile(profileId) {
      const jobIds = db.prepare("SELECT id FROM jobs WHERE profile_id=?").all(profileId).map((r) => r.id);
      const tx = db.transaction(() => {
        if (jobIds.length) {
          const placeholders = jobIds.map(() => "?").join(", ");
          db.prepare(`DELETE FROM artifacts WHERE run_id IN (SELECT id FROM runs WHERE job_id IN (${placeholders}))`)
            .run(...jobIds);
          db.prepare(`DELETE FROM runs WHERE job_id IN (${placeholders})`).run(...jobIds);
          db.prepare(`DELETE FROM schedules WHERE job_id IN (${placeholders})`).run(...jobIds);
          db.prepare(`DELETE FROM jobs WHERE id IN (${placeholders})`).run(...jobIds);
        }
        db.prepare("DELETE FROM profiles WHERE id=?").run(profileId);
      });
      tx();
      return true;
    },
    listNotifications() {
      const rows = db.prepare("SELECT * FROM notifications ORDER BY created_at DESC").all();
      return rows.map(parseConfig);
    },
    getNotification(id) {
      const row = db.prepare("SELECT * FROM notifications WHERE id=?").get(id);
      if (!row) return null;
      return parseConfig(row);
    },
    createNotification({ id, name, type, config, createdAt }) {
      db.prepare("INSERT INTO notifications (id,name,type,config_json,created_at) VALUES (?,?,?,?,?)")
        .run(id, name, type, JSON.stringify(config), createdAt);
      return { id };
    },
    updateNotification({ id, name, type, config }) {
      const updated = db.prepare("UPDATE notifications SET name=?, type=?, config_json=? WHERE id=?")
        .run(name, type, JSON.stringify(config), id);
      return updated.changes > 0;
    },
    deleteNotification(id) {
      const deleted = db.prepare("DELETE FROM notifications WHERE id=?").run(id);
      return deleted.changes > 0;
    },
    listNotificationsByIds(ids) {
      if (!Array.isArray(ids) || ids.length === 0) return [];
      const placeholders = ids.map(() => "?").join(", ");
      const rows = db.prepare(`SELECT * FROM notifications WHERE id IN (${placeholders})`).all(...ids);
      return rows.map(parseConfig);
    },
    getJob(jobId) {
      const row = db.prepare("SELECT * FROM jobs WHERE id=?").get(jobId);
      if (!row) throw new Error("Job not found");
      return parseConfig(row);
    },
    listJobs() {
      const rows = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all();
      return rows.map(parseConfig);
    },
    listJobNames() {
      return db.prepare("SELECT id, name FROM jobs").all();
    },
    createJob({ id, name, profileId, config, createdAt }) {
      db.prepare("INSERT INTO jobs (id,name,profile_id,config_json,created_at) VALUES (?,?,?,?,?)")
        .run(id, name, profileId, JSON.stringify(config), createdAt);
      return { id };
    },
    updateJob({ id, name, profileId, config }) {
      const updated = db.prepare("UPDATE jobs SET name=?, profile_id=?, config_json=? WHERE id=?")
        .run(name, profileId, JSON.stringify(config), id);
      return updated.changes > 0;
    },
    deleteJob(jobId) {
      const tx = db.transaction(() => {
        db.prepare("DELETE FROM artifacts WHERE run_id IN (SELECT id FROM runs WHERE job_id=?)").run(jobId);
        db.prepare("DELETE FROM runs WHERE job_id=?").run(jobId);
        db.prepare("DELETE FROM schedules WHERE job_id=?").run(jobId);
        db.prepare("DELETE FROM jobs WHERE id=?").run(jobId);
      });
      tx();
      return true;
    },
    listRunningJobIds() {
      const rows = db.prepare("SELECT DISTINCT job_id FROM runs WHERE status=?").all("running");
      return rows.map((r) => r.job_id);
    },
    createRun({ id, jobId, status, scheduledAt }) {
      db.prepare("INSERT INTO runs (id,job_id,status,scheduled_at) VALUES (?,?,?,?)")
        .run(id, jobId, status, scheduledAt);
      return { id };
    },
    deleteRun(runId) {
      const tx = db.transaction(() => {
        db.prepare("DELETE FROM artifacts WHERE run_id=?").run(runId);
        db.prepare("DELETE FROM runs WHERE id=?").run(runId);
      });
      tx();
      return true;
    },
    listRuns(jobId) {
      return jobId
        ? db.prepare("SELECT * FROM runs WHERE job_id=? ORDER BY scheduled_at DESC LIMIT 200").all(jobId)
        : db.prepare("SELECT * FROM runs ORDER BY scheduled_at DESC LIMIT 200").all();
    },
    getRun(runId) {
      return db.prepare("SELECT * FROM runs WHERE id=?").get(runId) || null;
    },
    listArtifacts(runId) {
      return db.prepare("SELECT * FROM artifacts WHERE run_id=? ORDER BY created_at ASC").all(runId);
    },
    insertArtifacts(runId, artifacts, nowIso) {
      const insert = db.prepare(`
        INSERT INTO artifacts
        (id,run_id,name,phase,bucket,object_key,size_bytes,content_type,uploaded_external,external_status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `);
      const tx = db.transaction(() => {
        for (const a of artifacts) {
          insert.run(
            a.id,
            runId,
            String(a.name || "artifact"),
            String(a.phase || "postLogin"),
            String(a.bucket || ""),
            String(a.objectKey || ""),
            Number(a.sizeBytes || 0),
            String(a.contentType || "image/png"),
            a.uploadedExternal ? 1 : 0,
            a.externalStatus ? Number(a.externalStatus) : null,
            nowIso()
          );
        }
      });
      tx();
    },
    updateRunStart(runId, nowIso) {
      db.prepare("UPDATE runs SET status=?, started_at=? WHERE id=?").run("running", nowIso(), runId);
    },
    appendRunLog(runId, message) {
      const prev = db.prepare("SELECT log_tail FROM runs WHERE id=?").get(runId)?.log_tail || "";
      const merged = (prev + "\n" + message).split("\n").slice(-80).join("\n");
      db.prepare("UPDATE runs SET log_tail=? WHERE id=?").run(merged, runId);
    },
    completeRun(runId, { status, error }, nowIso) {
      db.prepare("UPDATE runs SET status=?, ended_at=?, error=? WHERE id=?")
        .run(status, nowIso(), error || null, runId);
    },
    listSchedules() {
      return db.prepare("SELECT * FROM schedules ORDER BY created_at DESC").all();
    },
    listSchedulesByJob(jobId) {
      return db.prepare("SELECT * FROM schedules WHERE job_id=?").all(jobId);
    },
    getSchedule(scheduleId) {
      return db.prepare("SELECT * FROM schedules WHERE id=?").get(scheduleId) || null;
    },
    upsertSchedule({ id, jobId, cron, timezone, enabled, mode, remainingRuns, createdAt }) {
      const existing = db.prepare("SELECT * FROM schedules WHERE job_id=? AND cron=? AND timezone=?")
        .get(jobId, cron, timezone);
      const scheduleId = existing?.id || id;
      if (existing) {
        db.prepare("UPDATE schedules SET enabled=?, mode=?, remaining_runs=? WHERE id=?")
          .run(enabled ? 1 : 0, mode, remainingRuns, scheduleId);
      } else {
        db.prepare("INSERT INTO schedules (id,job_id,cron,timezone,enabled,mode,remaining_runs,created_at) VALUES (?,?,?,?,?,?,?,?)")
          .run(scheduleId, jobId, cron, timezone, enabled ? 1 : 0, mode, remainingRuns, createdAt);
      }
      return scheduleId;
    },
    deleteSchedulesByJob(jobId) {
      db.prepare("DELETE FROM schedules WHERE job_id=?").run(jobId);
    },
    setScheduleEnabled(scheduleId, enabled) {
      db.prepare("UPDATE schedules SET enabled=? WHERE id=?").run(enabled ? 1 : 0, scheduleId);
    },
    setScheduleRemaining(scheduleId, remainingRuns, enabled) {
      db.prepare("UPDATE schedules SET remaining_runs=?, enabled=? WHERE id=?")
        .run(remainingRuns, enabled ? 1 : 0, scheduleId);
    },
    listEnabledSchedules() {
      return db.prepare("SELECT * FROM schedules WHERE enabled=1").all();
    },
    listRunsTodaySuccess(startIso, endIso) {
      return db.prepare(
        "SELECT job_id, COUNT(*) as count, MAX(ended_at) as last_run FROM runs WHERE scheduled_at >= ? AND scheduled_at < ? AND status = 'success' GROUP BY job_id"
      ).all(startIso, endIso);
    }
  };
}
