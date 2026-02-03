import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export async function makePrismaStore(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required for MySQL/MariaDB");
  }
  const adapter = new PrismaMariaDb({
    host: requireEnv("DATABASE_HOST"),
    user: requireEnv("DATABASE_USER"),
    password: requireEnv("DATABASE_PASSWORD"),
    database: requireEnv("DATABASE_NAME"),
    port: Number(process.env.DATABASE_PORT || 3306),
    connectionLimit: 5
  });
  const prisma = new PrismaClient({ adapter });

  await ensureSchema(prisma);

  function parseConfig(row) {
    if (!row) return row;
    return { ...row, config: row.config_json };
  }

  function normalizeArtifact(row) {
    if (!row) return row;
    const size = row.size_bytes;
    let sizeBytes = size;
    if (typeof size === "bigint") {
      sizeBytes = size <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(size) : size.toString();
    }
    return { ...row, size_bytes: sizeBytes };
  }

  return {
    async getProfile(profileId) {
      const row = await prisma.profiles.findUnique({ where: { id: profileId } });
      if (!row) throw new Error("Profile not found");
      return parseConfig(row);
    },
    async listProfiles() {
      const rows = await prisma.profiles.findMany({ orderBy: { created_at: "desc" } });
      return rows.map(parseConfig);
    },
    async createProfile({ id, name, config, createdAt }) {
      await prisma.profiles.create({
        data: { id, name, config_json: config, created_at: createdAt }
      });
      return { id };
    },
    async updateProfile({ id, name, config }) {
      const updated = await prisma.profiles.updateMany({
        where: { id },
        data: { name, config_json: config }
      });
      return updated.count > 0;
    },
    async deleteProfile(profileId) {
      const jobs = await prisma.jobs.findMany({ where: { profile_id: profileId }, select: { id: true } });
      const jobIds = jobs.map((job) => job.id);
      const runs = jobIds.length
        ? await prisma.runs.findMany({ where: { job_id: { in: jobIds } }, select: { id: true } })
        : [];
      const runIds = runs.map((run) => run.id);

      await prisma.$transaction([
        ...(runIds.length
          ? [prisma.artifacts.deleteMany({ where: { run_id: { in: runIds } } })]
          : []),
        ...(jobIds.length
          ? [
              prisma.runs.deleteMany({ where: { job_id: { in: jobIds } } }),
              prisma.schedules.deleteMany({ where: { job_id: { in: jobIds } } }),
              prisma.jobs.deleteMany({ where: { id: { in: jobIds } } })
            ]
          : []),
        prisma.profiles.deleteMany({ where: { id: profileId } })
      ]);
      return true;
    },
    async listNotifications() {
      const rows = await prisma.notifications.findMany({ orderBy: { created_at: "desc" } });
      return rows.map(parseConfig);
    },
    async getNotification(id) {
      const row = await prisma.notifications.findUnique({ where: { id } });
      return row ? parseConfig(row) : null;
    },
    async createNotification({ id, name, type, config, createdAt }) {
      await prisma.notifications.create({
        data: { id, name, type, config_json: config, created_at: createdAt }
      });
      return { id };
    },
    async updateNotification({ id, name, type, config }) {
      const updated = await prisma.notifications.updateMany({
        where: { id },
        data: { name, type, config_json: config }
      });
      return updated.count > 0;
    },
    async deleteNotification(id) {
      const deleted = await prisma.notifications.deleteMany({ where: { id } });
      return deleted.count > 0;
    },
    async listNotificationsByIds(ids) {
      if (!Array.isArray(ids) || ids.length === 0) return [];
      const rows = await prisma.notifications.findMany({ where: { id: { in: ids } } });
      return rows.map(parseConfig);
    },
    async getJob(jobId) {
      const row = await prisma.jobs.findUnique({ where: { id: jobId } });
      if (!row) throw new Error("Job not found");
      return parseConfig(row);
    },
    async listJobs() {
      const rows = await prisma.jobs.findMany({ orderBy: { created_at: "desc" } });
      return rows.map(parseConfig);
    },
    async listJobNames() {
      return prisma.jobs.findMany({ select: { id: true, name: true } });
    },
    async createJob({ id, name, profileId, config, createdAt }) {
      await prisma.jobs.create({
        data: { id, name, profile_id: profileId, config_json: config, created_at: createdAt }
      });
      return { id };
    },
    async updateJob({ id, name, profileId, config }) {
      const updated = await prisma.jobs.updateMany({
        where: { id },
        data: { name, profile_id: profileId, config_json: config }
      });
      return updated.count > 0;
    },
    async deleteJob(jobId) {
      const runIds = await prisma.runs.findMany({ where: { job_id: jobId }, select: { id: true } });
      const idList = runIds.map((r) => r.id);
      await prisma.$transaction([
        prisma.artifacts.deleteMany({
          where: { run_id: { in: idList } }
        }),
        prisma.runs.deleteMany({ where: { job_id: jobId } }),
        prisma.schedules.deleteMany({ where: { job_id: jobId } }),
        prisma.jobs.deleteMany({ where: { id: jobId } })
      ]);
      return true;
    },
    async listRunningJobIds() {
      const rows = await prisma.runs.findMany({ where: { status: "running" }, select: { job_id: true }, distinct: ["job_id"] });
      return rows.map((r) => r.job_id);
    },
    async createRun({ id, jobId, status, scheduledAt }) {
      await prisma.runs.create({
        data: { id, job_id: jobId, status, scheduled_at: scheduledAt }
      });
      return { id };
    },
    async deleteRun(runId) {
      await prisma.$transaction([
        prisma.artifacts.deleteMany({ where: { run_id: runId } }),
        prisma.runs.deleteMany({ where: { id: runId } })
      ]);
      return true;
    },
    async listRuns(jobId) {
      return jobId
        ? prisma.runs.findMany({ where: { job_id: jobId }, orderBy: { scheduled_at: "desc" }, take: 200 })
        : prisma.runs.findMany({ orderBy: { scheduled_at: "desc" }, take: 200 });
    },
    async getRun(runId) {
      return prisma.runs.findUnique({ where: { id: runId } });
    },
    async listArtifacts(runId) {
      const rows = await prisma.artifacts.findMany({ where: { run_id: runId }, orderBy: { created_at: "asc" } });
      return rows.map(normalizeArtifact);
    },
    async insertArtifacts(runId, artifacts, nowIso) {
      if (!artifacts.length) return;
      await prisma.artifacts.createMany({
        data: artifacts.map((a) => ({
          id: a.id,
          run_id: runId,
          name: String(a.name || "artifact"),
          phase: String(a.phase || "postLogin"),
          bucket: String(a.bucket || ""),
          object_key: String(a.objectKey || ""),
          size_bytes: Number(a.sizeBytes || 0),
          content_type: String(a.contentType || "image/png"),
          uploaded_external: a.uploadedExternal ? 1 : 0,
          external_status: a.externalStatus ? Number(a.externalStatus) : null,
          created_at: nowIso()
        }))
      });
    },
    async updateRunStart(runId, nowIso) {
      await prisma.runs.updateMany({ where: { id: runId }, data: { status: "running", started_at: nowIso() } });
    },
    async appendRunLog(runId, message) {
      const run = await prisma.runs.findUnique({ where: { id: runId }, select: { log_tail: true } });
      const prev = run?.log_tail || "";
      const merged = (prev + "\n" + message).split("\n").slice(-80).join("\n");
      await prisma.runs.updateMany({ where: { id: runId }, data: { log_tail: merged } });
    },
    async completeRun(runId, { status, error }, nowIso) {
      await prisma.runs.updateMany({
        where: { id: runId },
        data: { status, ended_at: nowIso(), error: error || null }
      });
    },
    async failStaleRunningRuns(cutoffIso, reason, nowIso) {
      const result = await prisma.runs.updateMany({
        where: {
          status: "running",
          OR: [
            { started_at: { not: null, lt: cutoffIso } },
            { AND: [{ started_at: null }, { scheduled_at: { lt: cutoffIso } }] }
          ]
        },
        data: { status: "failed", ended_at: nowIso(), error: reason }
      });
      return result.count || 0;
    },
    async listSchedules() {
      return prisma.schedules.findMany({ orderBy: { created_at: "desc" } });
    },
    async listSchedulesByJob(jobId) {
      return prisma.schedules.findMany({ where: { job_id: jobId } });
    },
    async getSchedule(scheduleId) {
      return prisma.schedules.findUnique({ where: { id: scheduleId } });
    },
    async upsertSchedule({ id, jobId, cron, timezone, enabled, mode, remainingRuns, createdAt }) {
      const existing = await prisma.schedules.findFirst({ where: { job_id: jobId, cron, timezone } });
      const scheduleId = existing?.id || id;
      if (existing) {
        await prisma.schedules.updateMany({
          where: { id: scheduleId },
          data: { enabled: enabled ? 1 : 0, mode, remaining_runs: remainingRuns }
        });
      } else {
        await prisma.schedules.create({
          data: {
            id: scheduleId,
            job_id: jobId,
            cron,
            timezone,
            enabled: enabled ? 1 : 0,
            mode,
            remaining_runs: remainingRuns,
            created_at: createdAt
          }
        });
      }
      return scheduleId;
    },
    async deleteSchedulesByJob(jobId) {
      await prisma.schedules.deleteMany({ where: { job_id: jobId } });
    },
    async setScheduleEnabled(scheduleId, enabled) {
      await prisma.schedules.updateMany({ where: { id: scheduleId }, data: { enabled: enabled ? 1 : 0 } });
    },
    async setScheduleRemaining(scheduleId, remainingRuns, enabled) {
      await prisma.schedules.updateMany({
        where: { id: scheduleId },
        data: { remaining_runs: remainingRuns, enabled: enabled ? 1 : 0 }
      });
    },
    async listEnabledSchedules() {
      return prisma.schedules.findMany({ where: { enabled: 1 } });
    },
    async listRunsTodaySuccess(startIso, endIso) {
      return prisma.$queryRawUnsafe(
        "SELECT job_id, COUNT(*) as count, MAX(ended_at) as last_run FROM runs WHERE scheduled_at >= ? AND scheduled_at < ? AND status = 'success' GROUP BY job_id",
        startIso,
        endIso
      );
    },
    async countRunsByStatus() {
      const grouped = await prisma.runs.groupBy({
        by: ["status"],
        _count: { _all: true }
      });
      const out = { queued: 0, running: 0, success: 0, failed: 0, total: 0 };
      for (const row of grouped) {
        const status = String(row.status || "");
        const count = Number(row._count?._all || 0);
        if (Object.prototype.hasOwnProperty.call(out, status)) {
          out[status] = count;
        }
        out.total += count;
      }
      return out;
    }
  };
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required for MySQL/MariaDB`);
  }
  return value;
}

async function ensureSchema(prisma) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS profiles (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      config_json JSON NOT NULL,
      created_at VARCHAR(64) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      profile_id VARCHAR(191) NOT NULL,
      config_json JSON NOT NULL,
      created_at VARCHAR(64) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS schedules (
      id VARCHAR(191) PRIMARY KEY,
      job_id VARCHAR(191) NOT NULL,
      cron VARCHAR(64) NOT NULL,
      timezone VARCHAR(64) NOT NULL,
      enabled TINYINT NOT NULL DEFAULT 1,
      created_at VARCHAR(64) NOT NULL,
      mode VARCHAR(32) NOT NULL DEFAULT 'daily',
      remaining_runs INT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS runs (
      id VARCHAR(191) PRIMARY KEY,
      job_id VARCHAR(191) NOT NULL,
      status VARCHAR(32) NOT NULL,
      scheduled_at VARCHAR(64) NOT NULL,
      started_at VARCHAR(64) NULL,
      ended_at VARCHAR(64) NULL,
      error TEXT NULL,
      log_tail TEXT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS artifacts (
      id VARCHAR(191) PRIMARY KEY,
      run_id VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phase VARCHAR(32) NOT NULL,
      bucket VARCHAR(255) NOT NULL,
      object_key TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      content_type VARCHAR(128) NOT NULL,
      uploaded_external TINYINT NOT NULL DEFAULT 0,
      external_status INT NULL,
      created_at VARCHAR(64) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(32) NOT NULL,
      config_json JSON NOT NULL,
      created_at VARCHAR(64) NOT NULL
    )`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  const indexes = [
    { name: "idx_runs_job_id", table: "runs", columns: "job_id" },
    { name: "idx_artifacts_run_id", table: "artifacts", columns: "run_id" },
    { name: "idx_notifications_name", table: "notifications", columns: "name" }
  ];

  for (const index of indexes) {
    await ensureIndex(prisma, index);
  }
}

async function ensureIndex(prisma, index) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(1) AS count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
    index.table,
    index.name
  );
  const count = Number(rows?.[0]?.count || 0);
  if (count > 0) return;
  await prisma.$executeRawUnsafe(
    `CREATE INDEX ${index.name} ON ${index.table}(${index.columns})`
  );
}
