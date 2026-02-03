import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { makeQueue } from "./queue.js";
import { makeS3, ensureBucket } from "./s3.js";
import { ProfileSchema, JobConfigSchema, NotificationSchema } from "./validators.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { makeStore } from "./store/index.js";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./swagger.js";

const PORT = Number(process.env.PORT || 8080);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DB_PROVIDER = String(process.env.DB_PROVIDER || "sqlite").toLowerCase();
const DATABASE_URL = process.env.DATABASE_URL || "file:/data/app.db";
const RUN_ATTEMPTS = Math.max(1, Number(process.env.RUN_ATTEMPTS || 2));
const RUN_BACKOFF_MS = Math.max(100, Number(process.env.RUN_BACKOFF_MS || 3000));
const RUN_STALE_TIMEOUT_MINUTES = Math.max(1, Number(process.env.RUN_STALE_TIMEOUT_MINUTES || 30));
const S3_BUCKET = process.env.S3_BUCKET || "screenshots";
const store = await makeStore({ provider: DB_PROVIDER, databaseUrl: DATABASE_URL });

const s3 = makeS3();
await ensureBucket(s3, S3_BUCKET);

const queue = makeQueue(REDIS_URL);

const app = express();
const api = express.Router();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(new URL("../public", import.meta.url).pathname));
app.get("/api/openapi.json", (req,res)=>res.json(openApiSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use("/api", api);
app.use("/api/v1", api);
const nowIso = () => new Date().toISOString();

// ---- helpers ----
function getProfile(profileId) {
  return store.getProfile(profileId);
}
function getJob(jobId) {
  return store.getJob(jobId);
}
function getNotificationsByIds(ids) {
  return store.listNotificationsByIds(ids);
}

// ---- JSON API ----
api.get("/health", (req,res)=>res.json({ ok:true, time: nowIso() }));
api.get("/metrics/summary", async (req,res)=>{
  try {
    const queueCounts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
    const runCounts = await store.countRunsByStatus();
    res.json({
      time: nowIso(),
      queue: queueCounts,
      runs: runCounts
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to collect metrics" });
  }
});

api.get("/profiles", async (req,res)=>{
  const rows = await store.listProfiles();
  res.json(rows);
});
api.post("/profiles", async (req,res)=>{
  const id = nanoid();
  const name = String(req.body.name || "Profile");
  const parsed = ProfileSchema.safeParse(req.body.config || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await store.createProfile({ id, name, config: parsed.data, createdAt: nowIso() });
  res.json({ id });
});
api.put("/profiles/:profileId", async (req,res)=>{
  const id = req.params.profileId;
  const name = String(req.body.name || "Profile");
  const parsed = ProfileSchema.safeParse(req.body.config || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await store.updateProfile({ id, name, config: parsed.data });
  if (!updated) return res.status(404).json({ error: "Profile not found" });
  res.json({ ok: true });
});
api.delete("/profiles/:profileId", async (req,res)=>{
  const id = req.params.profileId;
  const existing = await store.getProfile(id).catch(() => null);
  if (!existing) return res.status(404).json({ error: "Profile not found" });
  await store.deleteProfile(id);
  res.json({ ok: true });
});

api.get("/notifications", async (req,res)=>{
  const rows = await store.listNotifications();
  res.json(rows);
});
api.post("/notifications", async (req,res)=>{
  const id = nanoid();
  const name = String(req.body.name || "Notification");
  const type = String(req.body.type || "http");
  const endpoint = String(req.body.endpoint || "");
  const bodyText = typeof req.body.body === "string" ? req.body.body : JSON.stringify(req.body.body ?? {});
  const headersText = typeof req.body.headers === "string" ? req.body.headers : JSON.stringify(req.body.headers ?? {});
  const fileField = String(req.body.fileField || "file");

  try {
    JSON.parse(bodyText || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  let headersObj = {};
  if (headersText && headersText.trim()) {
    try {
      const parsedHeaders = JSON.parse(headersText);
      if (!parsedHeaders || typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders)) {
        return res.status(400).json({ error: "Headers must be a JSON object" });
      }
      headersObj = parsedHeaders;
    } catch {
      return res.status(400).json({ error: "Invalid JSON headers" });
    }
  }

  const parsed = NotificationSchema.safeParse({
    type,
    endpoint,
    body: bodyText,
    headers: headersObj,
    fileField
  });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const config = {
    type: parsed.data.type,
    endpoint: parsed.data.endpoint,
    body: parsed.data.body,
    headers: parsed.data.headers,
    fileField: parsed.data.fileField
  };
  await store.createNotification({
    id,
    name,
    type: parsed.data.type,
    config,
    createdAt: nowIso()
  });
  res.json({ id });
});
api.put("/notifications/:notificationId", async (req,res)=>{
  const id = req.params.notificationId;
  const name = String(req.body.name || "Notification");
  const type = String(req.body.type || "http");
  const endpoint = String(req.body.endpoint || "");
  const bodyText = typeof req.body.body === "string" ? req.body.body : JSON.stringify(req.body.body ?? {});
  const headersText = typeof req.body.headers === "string" ? req.body.headers : JSON.stringify(req.body.headers ?? {});
  const fileField = String(req.body.fileField || "file");

  try {
    JSON.parse(bodyText || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  let headersObj = {};
  if (headersText && headersText.trim()) {
    try {
      const parsedHeaders = JSON.parse(headersText);
      if (!parsedHeaders || typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders)) {
        return res.status(400).json({ error: "Headers must be a JSON object" });
      }
      headersObj = parsedHeaders;
    } catch {
      return res.status(400).json({ error: "Invalid JSON headers" });
    }
  }

  const parsed = NotificationSchema.safeParse({
    type,
    endpoint,
    body: bodyText,
    headers: headersObj,
    fileField
  });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const config = {
    type: parsed.data.type,
    endpoint: parsed.data.endpoint,
    body: parsed.data.body,
    headers: parsed.data.headers,
    fileField: parsed.data.fileField
  };
  const updated = await store.updateNotification({
    id,
    name,
    type: parsed.data.type,
    config
  });
  if (!updated) return res.status(404).json({ error: "Notification not found" });
  res.json({ ok: true });
});
api.delete("/notifications/:notificationId", async (req,res)=>{
  const id = req.params.notificationId;
  const deleted = await store.deleteNotification(id);
  if (!deleted) return res.status(404).json({ error: "Notification not found" });
  res.json({ ok: true });
});
api.post("/notifications/:notificationId/test", async (req,res)=>{
  const id = req.params.notificationId;
  const row = await store.getNotification(id);
  if (!row) return res.status(404).json({ error: "Notification not found" });
  const config = row.config;
  if (!config?.endpoint) return res.status(400).json({ error: "Notification endpoint missing" });

  const fileField = config.fileField || "file";
  const headers = {};
  for (const [k, v] of Object.entries(config.headers || {})) {
    if (String(k).toLowerCase() === "content-type") continue;
    headers[k] = v;
  }

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
  const buffer = Buffer.from(pngBase64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });
  const form = new FormData();
  form.append(fileField, blob, "test.png");
  const payloadObj = JSON.parse(config.body || "{}");
  if (!payloadObj || typeof payloadObj !== "object" || Array.isArray(payloadObj)) {
    return res.status(400).json({ error: "Payload must be a JSON object" });
  }
  for (const [key, value] of Object.entries(payloadObj)) {
    if (value == null) continue;
    if (typeof value === "object") {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }

  try {
    const r = await fetch(config.endpoint, {
      method: "POST",
      headers,
      body: form
    });
    const bodyText = await r.text().catch(() => "");
    console.log(`[notification:test] ${id} -> ${r.status}`);
    res.json({ ok: r.ok, status: r.status, body: bodyText });
  } catch (e) {
    console.log(`[notification:test] ${id} failed`);
    res.status(500).json({ error: "Notification test failed" });
  }
});
api.post("/notifications/test-draft", async (req,res)=>{
  const type = String(req.body.type || "http");
  const endpoint = String(req.body.endpoint || "");
  const bodyText = typeof req.body.body === "string" ? req.body.body : JSON.stringify(req.body.body ?? {});
  const headersText = typeof req.body.headers === "string" ? req.body.headers : JSON.stringify(req.body.headers ?? {});
  const fileField = String(req.body.fileField || "file");

  try {
    JSON.parse(bodyText || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  let headersObj = {};
  if (headersText && headersText.trim()) {
    try {
      const parsedHeaders = JSON.parse(headersText);
      if (!parsedHeaders || typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders)) {
        return res.status(400).json({ error: "Headers must be a JSON object" });
      }
      headersObj = parsedHeaders;
    } catch {
      return res.status(400).json({ error: "Invalid JSON headers" });
    }
  }

  const parsed = NotificationSchema.safeParse({
    type,
    endpoint,
    body: bodyText,
    headers: headersObj,
    fileField
  });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
  const buffer = Buffer.from(pngBase64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });
  const form = new FormData();
  form.append(parsed.data.fileField, blob, "test.png");
  const payloadObj = JSON.parse(parsed.data.body || "{}");
  if (!payloadObj || typeof payloadObj !== "object" || Array.isArray(payloadObj)) {
    return res.status(400).json({ error: "Payload must be a JSON object" });
  }
  for (const [key, value] of Object.entries(payloadObj)) {
    if (value == null) continue;
    if (typeof value === "object") {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }

  const headers = {};
  for (const [k, v] of Object.entries(parsed.data.headers || {})) {
    if (String(k).toLowerCase() === "content-type") continue;
    headers[k] = v;
  }

  try {
    const r = await fetch(parsed.data.endpoint, {
      method: "POST",
      headers,
      body: form
    });
    const bodyResp = await r.text().catch(() => "");
    console.log(`[notification:test-draft] -> ${r.status}`);
    res.json({ ok: r.ok, status: r.status, body: bodyResp });
  } catch (e) {
    console.log("[notification:test-draft] failed");
    res.status(500).json({ error: "Notification test failed" });
  }
});

api.get("/jobs", async (req,res)=>{
  const rows = await store.listJobs();
  res.json(rows);
});
api.get("/jobs/running", async (req,res)=>{
  const rows = await store.listRunningJobIds();
  res.json({ jobIds: rows });
});
api.put("/jobs/:jobId", async (req,res)=>{
  const jobId = req.params.jobId;
  const name = String(req.body.name || "Job");
  const profileId = String(req.body.profileId || "");
  if (!profileId) return res.status(400).json({ error: "profileId required" });

  try {
    await getProfile(profileId);
    const parsed = JobConfigSchema.safeParse(req.body.config || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const updated = await store.updateJob({ id: jobId, name, profileId, config: parsed.data });
    if (!updated) return res.status(404).json({ error: "Job not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || "Failed to update job" });
  }
});
api.post("/jobs", async (req,res)=>{
  const id = nanoid();
  const name = String(req.body.name || "Job");
  const profileId = String(req.body.profileId || "");
  if (!profileId) return res.status(400).json({ error: "profileId required" });

  await getProfile(profileId);
  const parsed = JobConfigSchema.safeParse(req.body.config || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await store.createJob({
    id,
    name,
    profileId,
    config: parsed.data,
    createdAt: nowIso()
  });
  res.json({ id });
});
api.delete("/jobs/:jobId", async (req,res)=>{
  const jobId = req.params.jobId;
  const schedules = await store.listSchedulesByJob(jobId);

  for (const s of schedules) {
    try {
      await queue.removeRepeatable("run", { cron: s.cron, tz: s.timezone }, `schedule:${s.id}`);
      await queue.removeRepeatable("run", { cron: s.cron, tz: s.timezone }, `schedule:${s.job_id}`);
    } catch {}
  }

  await store.deleteJob(jobId);
  res.json({ ok: true });
});

api.post("/jobs/:jobId/run-now", async (req,res)=>{
  const jobId = req.params.jobId;
  await getJob(jobId);

  const runId = nanoid();
  await store.createRun({ id: runId, jobId, status: "queued", scheduledAt: nowIso() });

  await queue.add("run", { runId, jobId }, {
    attempts: RUN_ATTEMPTS,
    backoff: { type: "exponential", delay: RUN_BACKOFF_MS },
    removeOnComplete: true,
    removeOnFail: false
  });
  res.json({ runId });
});
api.delete("/runs/:runId", async (req,res)=>{
  const runId = req.params.runId;
  await store.deleteRun(runId);
  res.json({ ok: true });
});

api.get("/runs", async (req,res)=>{
  const jobId = req.query.jobId ? String(req.query.jobId) : null;
  const rows = await store.listRuns(jobId);
  res.json(rows);
});
api.get("/runs/:runId", async (req,res)=>{
  const runId = req.params.runId;
  const run = await store.getRun(runId);
  if (!run) return res.status(404).json({ error: "Run not found" });
  const artifacts = await store.listArtifacts(runId);
  res.json({ run, artifacts });
});

// Schedule (cron) – repeatable job triggers worker which calls run-now
api.post("/jobs/:jobId/schedules", async (req,res)=>{
  const jobId = req.params.jobId;
  const timezone = String(req.body.timezone || "Asia/Jakarta");
  const mode = String(req.body.mode || "daily");
  const crons = Array.isArray(req.body.crons)
    ? req.body.crons.map(c => String(c || "")).filter(Boolean)
    : [String(req.body.cron || "")].filter(Boolean);
  if (crons.length === 0) return res.status(400).json({ error: "cron required" });
  if (!["daily","limited"].includes(mode)) return res.status(400).json({ error: "invalid mode" });
  let remainingRuns = null;
  if (mode === "limited") {
    const count = Number(req.body.remainingRuns ?? req.body.runsCount ?? 1);
    if (!Number.isFinite(count) || count < 1) {
      return res.status(400).json({ error: "remainingRuns must be >= 1" });
    }
    remainingRuns = Math.floor(count);
  }
  await getJob(jobId);

  // store schedule
  const scheduleIds = [];
  for (const cron of crons) {
    const scheduleId = await store.upsertSchedule({
      id: nanoid(),
      jobId,
      cron,
      timezone,
      enabled: true,
      mode,
      remainingRuns,
      createdAt: nowIso()
    });

    // Add repeatable job. Worker will translate scheduled tick -> run-now.
    await queue.add(
      "run",
      { scheduled: true, jobId, runId: null, scheduleId },
      {
        repeat: { cron, tz: timezone },
        jobId: `schedule:${scheduleId}`,
        attempts: RUN_ATTEMPTS,
        backoff: { type: "exponential", delay: RUN_BACKOFF_MS },
        removeOnComplete: true
      }
    );
    scheduleIds.push(scheduleId);
  }

  res.json({ scheduleIds });
});
api.delete("/jobs/:jobId/schedules", async (req,res)=>{
  const jobId = req.params.jobId;
  const schedules = await store.listSchedulesByJob(jobId);
  if (schedules.length === 0) return res.status(404).json({ error: "Schedule not found" });

  for (const s of schedules) {
    try {
      await queue.removeRepeatable("run", { cron: s.cron, tz: s.timezone }, `schedule:${s.id}`);
      await queue.removeRepeatable("run", { cron: s.cron, tz: s.timezone }, `schedule:${s.job_id}`);
    } catch {}
  }
  await store.deleteSchedulesByJob(jobId);
  res.json({ ok: true });
});
api.patch("/jobs/:jobId/schedules/status", async (req,res)=>{
  const jobId = req.params.jobId;
  const enabled = req.body?.enabled === true;
  const schedules = await store.listSchedulesByJob(jobId);
  if (schedules.length === 0) return res.status(404).json({ error: "Schedule not found" });

  if (enabled) {
    for (const s of schedules) {
      if (s.mode === "limited" && Number.isFinite(s.remaining_runs) && s.remaining_runs <= 0) {
        return res.status(400).json({ error: "limited schedule has no remaining runs" });
      }
      await store.setScheduleEnabled(s.id, true);
      await queue.add(
        "run",
        { scheduled: true, jobId: s.job_id, runId: null, scheduleId: s.id },
        {
          repeat: { cron: s.cron, tz: s.timezone },
          jobId: `schedule:${s.id}`,
          attempts: RUN_ATTEMPTS,
          backoff: { type: "exponential", delay: RUN_BACKOFF_MS },
          removeOnComplete: true
        }
      );
    }
  } else {
    for (const s of schedules) {
      await store.setScheduleEnabled(s.id, false);
      try {
        await queue.removeRepeatable("run", { cron: s.cron, tz: s.timezone }, `schedule:${s.id}`);
        await queue.removeRepeatable("run", { cron: s.cron, tz: s.timezone }, `schedule:${s.job_id}`);
      } catch {}
    }
  }
  res.json({ ok: true, enabled });
});
api.get("/schedules", async (req,res)=>{
  const rows = await store.listSchedules();
  res.json(rows);
});
api.get("/schedules/today", async (req,res)=>{
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const jobs = await queue.getRepeatableJobs();
    const items = jobs
      .filter(j => typeof j.next === "number" && j.next >= todayStart.getTime() && j.next < todayEnd.getTime())
      .map(j => ({
        key: j.key,
        name: j.name,
        jobId: j.id && j.id.startsWith("schedule:") ? j.id.slice("schedule:".length) : j.id,
        cron: j.cron || null,
        timezone: j.tz || null,
        next: j.next
      }))
      .sort((a,b) => a.next - b.next);
    res.json({ start: todayStart.toISOString(), end: todayEnd.toISOString(), items });
  } catch (e) {
    res.status(500).json({ error: "Failed to load schedules" });
  }
});
api.get("/schedules/running", async (req,res)=>{
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const now = new Date();

    const repeatables = await queue.getRepeatableJobs();
    const scheduleRows = await store.listEnabledSchedules();
    const jobRows = await store.listJobNames();
    const runRows = await store.listRunsTodaySuccess(todayStart.toISOString(), todayEnd.toISOString());

    const jobMap = new Map(jobRows.map((j) => [j.id, j]));
    const runMap = new Map(runRows.map((r) => [r.job_id, r]));
    const repeatableMap = new Map();
    for (const j of repeatables) {
      const scheduleId = j.id && String(j.id).startsWith("schedule:") ? String(j.id).slice("schedule:".length) : null;
      if (scheduleId) repeatableMap.set(scheduleId, j);
    }

    const items = scheduleRows
      .map((s) => {
        const rep = repeatableMap.get(s.id);
        const jobName = jobMap.get(s.job_id)?.name || null;
        return {
          key: rep?.key || `schedule:${s.id}`,
          scheduleId: s.id,
          jobId: s.job_id,
          jobName,
          cron: s.cron,
          timezone: s.timezone,
          enabled: s.enabled,
          mode: s.mode || "daily",
          remainingRuns: s.remaining_runs ?? null,
          next: rep?.next || null,
          nextIso: rep?.next ? new Date(rep.next).toISOString() : null,
          nextToday:
            typeof rep?.next === "number" && rep.next >= todayStart.getTime() && rep.next < todayEnd.getTime()
              ? rep.next
              : null,
          nextTodayIso:
            typeof rep?.next === "number" && rep.next >= todayStart.getTime() && rep.next < todayEnd.getTime()
              ? new Date(rep.next).toISOString()
              : null,
          nextExpectedIso: computeNextExpectedIso(s.cron, s.timezone, now),
          doneToday: Number(runMap.get(s.job_id)?.count || 0),
          lastRunIso: runMap.get(s.job_id)?.last_run || null
        };
      })
      .sort((a,b) => (a.next || 0) - (b.next || 0));
    res.json({ items });
  } catch {
    res.status(500).json({ error: "Failed to load running schedules" });
  }
});

function computeNextExpectedIso(cron, timezone, now) {
  const match = String(cron || "").trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (!match) return null;
  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (!Number.isFinite(minute) || !Number.isFinite(hour)) return null;

  const tz = timezone || "UTC";
  const nowUtc = now instanceof Date ? now : new Date();

  let localParts;
  try {
    localParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(nowUtc)
      .reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
  } catch {
    return null;
  }

  const year = Number(localParts.year);
  const month = Number(localParts.month);
  const day = Number(localParts.day);
  if (!year || !month || !day) return null;

  const toUtcForTz = (y, m, d, h, min) => {
    const utcGuess = new Date(Date.UTC(y, m - 1, d, h, min, 0));
    const localAsUtc = new Date(utcGuess.toLocaleString("en-US", { timeZone: tz }));
    const offset = utcGuess.getTime() - localAsUtc.getTime();
    return new Date(utcGuess.getTime() + offset);
  };

  const targetUtc = toUtcForTz(year, month, day, hour, minute);
  const nowLocal = new Date(nowUtc.toLocaleString("en-US", { timeZone: tz }));
  const targetLocal = new Date(targetUtc.toLocaleString("en-US", { timeZone: tz }));

  if (nowLocal > targetLocal) {
    const nextDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const nextParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(new Date(nextDay.getTime() + 24 * 60 * 60 * 1000))
      .reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
    const nextYear = Number(nextParts.year);
    const nextMonth = Number(nextParts.month);
    const nextDayNum = Number(nextParts.day);
    if (!nextYear || !nextMonth || !nextDayNum) return targetUtc.toISOString();
    return toUtcForTz(nextYear, nextMonth, nextDayNum, hour, minute).toISOString();
  }

  return targetUtc.toISOString();
}

// ---- Internal endpoints (worker only) ----
app.get("/internal/resolve", async (req,res)=>{
  const runId = String(req.query.runId || "");
  if (!runId) return res.status(400).json({ error: "runId required" });

  const run = await store.getRun(runId);
  if (!run) return res.status(404).json({ error: "Run not found" });

  const job = await getJob(run.job_id);
  const profile = await getProfile(job.profile_id);
  const notificationIds =
    job?.config?.notifications?.enabled === true
      ? job.config.notifications.ids || []
      : [];
  const notifications = await getNotificationsByIds(notificationIds);

  res.json({
    run: { id: run.id, jobId: job.id },
    job: { id: job.id, name: job.name, config: job.config },
    profile: { id: profile.id, name: profile.name, config: profile.config },
    notifications: notifications.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      config: n.config
    })),
    secrets: {}   // MVP: add secrets later (Vault/encrypted DB)
  });
});
app.post("/internal/schedules/consume", async (req,res)=>{
  const scheduleId = String(req.body.scheduleId || "");
  if (!scheduleId) return res.status(400).json({ error: "scheduleId required" });

  const schedule = await store.getSchedule(scheduleId);
  if (!schedule || schedule.enabled !== 1) return res.json({ allow: false });

  if (schedule.mode !== "limited") return res.json({ allow: true, jobId: schedule.job_id });

  const remaining = Number.isFinite(schedule.remaining_runs) ? schedule.remaining_runs : 0;
  if (remaining <= 0) {
    await store.setScheduleEnabled(scheduleId, false);
    try {
      await queue.removeRepeatable("run", { cron: schedule.cron, tz: schedule.timezone }, `schedule:${schedule.id}`);
      await queue.removeRepeatable("run", { cron: schedule.cron, tz: schedule.timezone }, `schedule:${schedule.job_id}`);
    } catch {}
    return res.json({ allow: false });
  }

  const nextRemaining = remaining - 1;
  const enabled = nextRemaining > 0 ? 1 : 0;
  await store.setScheduleRemaining(scheduleId, nextRemaining, enabled === 1);
  if (enabled === 0) {
    try {
      await queue.removeRepeatable("run", { cron: schedule.cron, tz: schedule.timezone }, `schedule:${schedule.id}`);
      await queue.removeRepeatable("run", { cron: schedule.cron, tz: schedule.timezone }, `schedule:${schedule.job_id}`);
    } catch {}
  }
  res.json({ allow: true, jobId: schedule.job_id, remaining: nextRemaining });
});

app.post("/internal/runs/:runId/start", async (req,res)=>{
  await store.updateRunStart(req.params.runId, nowIso);
  res.json({ ok:true });
});
app.post("/internal/runs/:runId/progress", async (req,res)=>{
  const runId = req.params.runId;
  const msg = String(req.body.message || "");
  await store.appendRunLog(runId, msg);
  res.json({ ok:true });
});
app.post("/internal/runs/:runId/complete", async (req,res)=>{
  const runId = req.params.runId;
  const status = String(req.body.status || "failed");
  const error = req.body.error ? String(req.body.error) : null;
  const artifacts = Array.isArray(req.body.artifacts) ? req.body.artifacts : [];

  await store.completeRun(runId, { status, error }, nowIso);
  const withIds = artifacts.map((a) => ({ ...a, id: nanoid(), bucket: a.bucket || S3_BUCKET }));
  await store.insertArtifacts(runId, withIds, nowIso);
  res.json({ ok:true });
});


// MVP image proxy (later: presigned URL)
app.get("/artifact/:bucket/*", async (req,res)=>{
  try {
    const bucket = req.params.bucket;
    const key = req.params[0];
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    res.setHeader("Content-Type", out.ContentType || "application/octet-stream");
    out.Body.pipe(res);
  } catch {
    res.status(404).send("Not found");
  }
});

// On startup, reload schedules into BullMQ
async function loadSchedules() {
  const schedules = await store.listEnabledSchedules();
  for (const s of schedules) {
    try {
      await queue.removeRepeatable("run", { cron: s.cron, tz: s.timezone }, `schedule:${s.job_id}`);
    } catch {}
    await queue.add(
      "run",
      { scheduled: true, jobId: s.job_id, runId: null, scheduleId: s.id },
      {
        repeat: { cron: s.cron, tz: s.timezone },
        jobId: `schedule:${s.id}`,
        attempts: RUN_ATTEMPTS,
        backoff: { type: "exponential", delay: RUN_BACKOFF_MS },
        removeOnComplete: true
      }
    );
  }
}
async function recoverStaleRunningRuns() {
  try {
    const cutoff = new Date(Date.now() - RUN_STALE_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    const reason = `Run marked failed by recovery (stale > ${RUN_STALE_TIMEOUT_MINUTES}m)`;
    const changed = await store.failStaleRunningRuns(cutoff, reason, nowIso);
    if (changed > 0) {
      console.log(`[recovery] marked ${changed} stale runs as failed`);
    }
  } catch (e) {
    console.error("[recovery] failed", e?.message || e);
  }
}
await recoverStaleRunningRuns();
setInterval(recoverStaleRunningRuns, 60 * 1000);
await loadSchedules();

app.listen(PORT, ()=> console.log(`API listening on :${PORT}`));


