import fetch from "node-fetch";
import { Worker } from "bullmq";
import { makeS3, putPng } from "./s3.js";
import { runJob } from "./runner.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8081";
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);

const { client, bucket } = makeS3();
const s3 = {
  bucket,
  put: async (key, buffer) => putPng({ client, bucket, key, buffer })
};

console.log("Worker starting...");
console.log("Redis:", REDIS_URL);
console.log("API:", API_BASE_URL);
console.log("Bucket:", bucket);

const worker = new Worker(
  "screenshot-runs",
  async (job) => {
    const data = job.data || {};

    // Scheduled tick: create a real run via API, then exit
    if (!data.runId && data.scheduled && data.jobId) {
      if (data.scheduleId) {
        const allowRes = await fetch(`${API_BASE_URL}/internal/schedules/consume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: data.scheduleId })
        });
        if (!allowRes.ok) throw new Error(`Schedule consume failed: ${allowRes.status}`);
        const allowData = await allowRes.json();
        if (!allowData?.allow) return { scheduled: true, skipped: true };
      }
      const r = await fetch(`${API_BASE_URL}/api/jobs/${encodeURIComponent(data.jobId)}/run-now`, { method: "POST" });
      if (!r.ok) throw new Error(`Failed to create scheduled run: ${r.status}`);
      return { scheduled: true };
    }

    const payload = { runId: data.runId, jobId: data.jobId };
    const log = (m) => console.log(`[${payload.runId}] ${m}`);
    return runJob({ apiBase: API_BASE_URL, s3, payload, log });
  },
  {
    connection: { url: REDIS_URL },
    concurrency: WORKER_CONCURRENCY
  }
);

worker.on("failed", (job, err) => {
  console.error("Job failed", job?.id, err?.message || err);
  const runId = job?.data?.runId;
  if (!runId) return;
  fetch(`${API_BASE_URL}/internal/runs/${encodeURIComponent(runId)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "failed",
      error: String(err?.message || err || "Worker job failed"),
      artifacts: []
    })
  }).catch(() => {});
});
