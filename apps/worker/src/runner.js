import { chromium } from "playwright";
import fetch from "node-fetch";
import FormData from "form-data";
import { applyTemplate } from "./templates.js";

async function apiPost(apiBase, path, body) {
  const r = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if (!r.ok) throw new Error(`API POST ${path} failed: ${r.status}`);
  return r.json().catch(()=> ({}));
}
async function apiGet(apiBase, path) {
  const r = await fetch(`${apiBase}${path}`);
  if (!r.ok) throw new Error(`API GET ${path} failed: ${r.status}`);
  return r.json();
}
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function runJob({ apiBase, s3, payload, log }) {
  const { runId } = payload;

  const resolved = await apiGet(apiBase, `/internal/resolve?runId=${encodeURIComponent(runId)}`);
  const { job, profile, secrets, run, notifications } = resolved;
  const ctx = { job, profile, run, secret: secrets };

  await apiPost(apiBase, `/internal/runs/${runId}/start`, {});
  await postProgress(apiBase, runId, `Resolved job ${job?.name || job?.id}`);

  const prof = profile.config;
  const jobCfg = job.config;
  let browser = null;
  let context = null;
  let page = null;
  const artifacts = [];
  const runNow = new Date();
  const dateFolder = `${runNow.getFullYear()}/${String(runNow.getMonth() + 1).padStart(2, "0")}/${String(runNow.getDate()).padStart(2, "0")}`;
  const jobFolder = sanitize(job?.name || job?.id || "job");

  const captureOne = async (capture, phase) => {
    const name = capture.name || `${phase}-${capture.mode}`;
    if (jobCfg.interaction?.bypassLazyLoad) {
      await autoScrollForLazyLoad(page, apiBase, runId, log);
    }
    if (captureDelay > 0) {
      const seconds = Math.max(0, Math.round(captureDelay / 1000));
      const msg = `wait ${seconds}s`;
      log(msg);
      await postProgress(apiBase, runId, msg);
      await page.waitForTimeout(captureDelay);
    }
    log(`capture:${phase}:${name}`);
    await apiPost(apiBase, `/internal/runs/${runId}/progress`, { message: `capture ${phase} ${name}` });

    let buffer;
    if (capture.mode === "element") {
      if (!capture.selector) throw new Error(`Capture '${name}' requires selector`);
      const locator = page.locator(capture.selector);
      await locator.waitFor({ state: "visible", timeout: 30000 });
      buffer = await locator.screenshot({ type: "png" });
    } else {
      buffer = await page.screenshot({ type: "png", fullPage: !!capture.fullPage });
    }

    const key = `screenshots/${jobFolder}/${dateFolder}/${phase}_${sanitize(name)}-${runId}.png`;
    await s3.put(key, buffer);

    const uploadRes = await maybeUploadExternal(jobCfg.upload, buffer, ctx, { phase, name });
    artifacts.push({
      phase,
      name,
      bucket: s3.bucket,
      objectKey: key,
      sizeBytes: buffer.length,
      contentType: "image/png",
      uploadedExternal: !!uploadRes?.ok,
      externalStatus: uploadRes?.status ?? null
    });
  };

  const capturePhase = async (phase) => {
    const targets = (jobCfg.captures || []).filter(c => c.phase === phase || c.phase === "both");
    for (const c of targets) {
      await captureOne(c, phase);
    }
  };

  const captureDelay = Number.isFinite(jobCfg.captureDelayMs) ? jobCfg.captureDelayMs : 10000;
  const hasPreLogin = (jobCfg.captures || []).some(c => c.phase === "preLogin" || c.phase === "both");
  const hasPostLogin = (jobCfg.captures || []).some(c => c.phase === "postLogin" || c.phase === "both");
  const waitForCaptureDelay = async () => {
    if (captureDelay > 0) {
      await page.waitForTimeout(captureDelay);
    }
  };

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      ignoreHTTPSErrors: !!prof.ignoreHTTPSErrors,
      viewport: prof.viewport || { width: 1366, height: 768 },
      userAgent: prof.userAgent || undefined,
      locale: prof.locale || "en-US",
      timezoneId: prof.timezoneId || "Asia/Jakarta",
      extraHTTPHeaders: prof.extraHeaders || {}
    });

    if (prof.blockResources) {
      await context.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (["image","font","media"].includes(type)) return route.abort();
        return route.continue();
      });
    }

    page = await context.newPage();

    const navTimeout = Number.isFinite(jobCfg.navigationTimeoutMs) ? jobCfg.navigationTimeoutMs : 45000;
    await postProgress(apiBase, runId, `Navigating to ${jobCfg.startUrl}`);
    await page.goto(jobCfg.startUrl, { waitUntil: "domcontentloaded", timeout: navTimeout });
    await postProgress(apiBase, runId, `Navigation complete`);
    if (hasPreLogin) {
      await postProgress(apiBase, runId, `Waiting ${captureDelay}ms before preLogin capture`);
      await waitForCaptureDelay();
      await capturePhase("preLogin");
    }

    if (jobCfg.login?.enabled) {
      await runSteps(page, jobCfg.login.steps || [], secrets, apiBase, runId, log);
      await postProgress(apiBase, runId, `Login steps complete`);
    }

    const postLoginSteps = Array.isArray(jobCfg.postLoginSteps) ? jobCfg.postLoginSteps : [];
    const interaction = jobCfg.interaction || { enabled: false, steps: [], captureMode: "afterInteraction" };
    const interactionSteps = Array.isArray(interaction.steps) ? interaction.steps : [];
    const interactionMode = interaction.captureMode || "afterInteraction";

    if (!jobCfg.login?.enabled && interaction.enabled && interactionSteps.length > 0) {
      let interactionFrame = null;
      for (let i = 0; i < interactionSteps.length; i++) {
        const step = interactionSteps[i];
        if (step.type === "selectFrame") {
          interactionFrame = await resolveFrameTarget(page, step, apiBase, runId, log);
          continue;
        }
        await runSingleStep(page, interactionFrame, step, i, interactionSteps.length, secrets, apiBase, runId, log);
        if (interactionMode === "afterEachStep") {
          await capturePhase("postLogin");
        }
      }
      await postProgress(apiBase, runId, `Interaction steps complete`);
      if (interactionMode === "afterInteraction" && hasPostLogin) {
        await postProgress(apiBase, runId, `Waiting ${captureDelay}ms before postLogin capture`);
        await waitForCaptureDelay();
        await capturePhase("postLogin");
      }
    } else {
      const postLoginCaptures = (jobCfg.captures || []).filter(c => c.phase === "postLogin" || c.phase === "both");
      if (postLoginSteps.length > 0) {
        let postLoginFrame = null;
        for (let i = 0; i < postLoginSteps.length; i++) {
          const step = postLoginSteps[i];
          if (step.type === "selectFrame") {
            postLoginFrame = await resolveFrameTarget(page, step, apiBase, runId, log);
            continue;
          }
          await runSingleStep(page, postLoginFrame, step, i, postLoginSteps.length, secrets, apiBase, runId, log);
          if (postLoginCaptures[i]) {
            await captureOne(postLoginCaptures[i], "postLogin");
          }
        }
        if (postLoginCaptures.length > postLoginSteps.length) {
          for (let i = postLoginSteps.length; i < postLoginCaptures.length; i++) {
            await captureOne(postLoginCaptures[i], "postLogin");
          }
        }
        await postProgress(apiBase, runId, `Post-login steps complete`);
      } else if (hasPostLogin) {
        await postProgress(apiBase, runId, `Waiting ${captureDelay}ms before postLogin capture`);
        await waitForCaptureDelay();
        await capturePhase("postLogin");
      }
    }

    await browser.close();
    await sendNotifications({
      apiBase,
      notifications: notifications || [],
      ctx,
      artifacts,
      log,
      runId
    });
    await apiPost(apiBase, `/internal/runs/${runId}/complete`, { status: "success", artifacts });
    return { ok: true };
  } catch (e) {
    log(`ERROR: ${e?.message || e}`);

    // best-effort failure screenshot
    try {
      if (page) {
        const buffer = await page.screenshot({ type: "png", fullPage: true });
        const key = `screenshots/${jobFolder}/${dateFolder}/error_failure-${runId}.png`;
        await s3.put(key, buffer);
        artifacts.push({
          phase: "postLogin",
          name: "error_failure",
          bucket: s3.bucket,
          objectKey: key,
          sizeBytes: buffer.length,
          contentType: "image/png",
          uploadedExternal: false,
          externalStatus: null
        });
      }
    } catch {}

    try { if (browser) await browser.close(); } catch {}
    await apiPost(apiBase, `/internal/runs/${runId}/complete`, {
      status: "failed",
      error: String(e?.message || e),
      artifacts
    });
    return { ok: false };
  }

  async function maybeUploadExternal(uploadCfg, buffer, ctx, artifact) {
    if (!uploadCfg?.enabled) return null;
    if (!uploadCfg.endpoint) throw new Error("upload.endpoint required when upload enabled");

    const endpoint = uploadCfg.endpoint;
    const method = uploadCfg.method || "POST";
    const timeoutMs = uploadCfg.timeoutMs ?? 20000;
    const retryMax = uploadCfg.retry?.max ?? 0;
    const backoff = uploadCfg.retry?.backoffMs ?? 1000;

    const headers = {};
    for (const [k, v] of Object.entries(uploadCfg.headers || {})) {
      headers[k] = applyTemplate(v, { ...ctx, artifact });
    }

    for (let attempt = 0; attempt <= retryMax; attempt++) {
      try {
        if (uploadCfg.multipart?.fileField) {
          const fd = new FormData();
          fd.append(uploadCfg.multipart.fileField, buffer, { filename: `${artifact.name}.png`, contentType: "image/png" });
          for (const [k, v] of Object.entries(uploadCfg.multipart.extraFields || {})) {
            fd.append(k, applyTemplate(v, { ...ctx, artifact }));
          }
          const r = await fetchWithTimeout(endpoint, {
            method,
            headers: { ...headers, ...fd.getHeaders() },
            body: fd
          }, timeoutMs);
          return { ok: r.ok, status: r.status };
        } else {
          const r = await fetchWithTimeout(endpoint, {
            method,
            headers: { ...headers, "Content-Type": "image/png" },
            body: buffer
          }, timeoutMs);
          return { ok: r.ok, status: r.status };
        }
      } catch (err) {
        if (attempt === retryMax) return { ok: false, status: null };
        await new Promise(r => setTimeout(r, backoff * (attempt + 1)));
      }
    }
    return { ok: false, status: null };
  }
}

async function postProgress(apiBase, runId, message) {
  await fetch(`${apiBase}/internal/runs/${runId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).catch(() => {});
}

async function sendNotifications({ apiBase, notifications, ctx, artifacts, log, runId }) {
  if (!Array.isArray(notifications) || notifications.length === 0) return;

  const artifactViews = artifacts.map((a) => ({
    ...a,
    url: `${apiBase}/artifact/${encodeURIComponent(a.bucket)}/${encodeURIComponent(a.objectKey)}`
  }));
  const baseCtx = {
    ...ctx,
    msg: `Job ${ctx?.job?.name || ctx?.job?.id} completed successfully`,
    artifacts: artifactViews
  };

  for (const n of notifications) {
    if (n.type !== "http") continue;
    const cfg = n.config || {};
    const endpoint = cfg.endpoint;
    const bodyTemplate = cfg.body || "{}";
    if (!artifactViews.length) {
      const msg = `notification ${n.name || n.id} skipped (no artifact)`;
      log(msg);
      await postProgress(apiBase, runId, msg);
      continue;
    }

    for (const artifact of artifactViews) {
      const notifyCtx = {
        ...baseCtx,
        artifact,
        artifactUrl: artifact?.url || ""
      };
      const headers = {};
      for (const [k, v] of Object.entries(cfg.headers || {})) {
        if (String(k).toLowerCase() === "content-type") continue;
        headers[k] = applyTemplate(v, notifyCtx);
      }
      let payload;
      try {
        const renderedBody = applyTemplate(bodyTemplate, notifyCtx);
        payload = JSON.parse(renderedBody);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          throw new Error("payload must be JSON object");
        }
      } catch (err) {
        const msg = `notification ${n.name || n.id} invalid JSON body`;
        log(msg);
        await postProgress(apiBase, runId, msg);
        break;
      }

      try {
        await postProgress(apiBase, runId, `notification ${n.name || n.id} sending ${artifact.name || ""}`);
        const artifactRes = await fetchWithTimeout(artifact.url, {}, 20000);
        if (!artifactRes.ok) {
          const msg = `notification ${n.name || n.id} failed to fetch artifact`;
          log(msg);
          await postProgress(apiBase, runId, msg);
          continue;
        }
        const buffer = Buffer.from(await artifactRes.arrayBuffer());
        const form = new FormData();
        const fileField = cfg.fileField || "file";
        form.append(fileField, buffer, {
          filename: `${artifact.name || "screenshot"}.png`,
          contentType: artifact.contentType || "image/png"
        });
        for (const [key, value] of Object.entries(payload)) {
          if (value == null) continue;
          if (typeof value === "object") {
            form.append(key, JSON.stringify(value));
          } else {
            form.append(key, String(value));
          }
        }
        form.append("capture_name", String(artifact.name || ""));
        form.append("capture_phase", String(artifact.phase || ""));
        const r = await fetchWithTimeout(
          endpoint,
          {
            method: "POST",
            headers: { ...headers, ...form.getHeaders() },
            body: form
          },
          20000
        );
        const msg = `notification ${n.name || n.id} status ${r.status}`;
        log(msg);
        await postProgress(apiBase, runId, msg);
      } catch (err) {
        const msg = `notification ${n.name || n.id} failed`;
        log(msg);
        await postProgress(apiBase, runId, msg);
      }
    }
  }
}

async function runSteps(page, steps, secrets, apiBase, runId, log) {
  let currentFrame = null;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === "selectFrame") {
      currentFrame = await resolveFrameTarget(page, step, apiBase, runId, log);
      continue;
    }
    await runSingleStep(page, currentFrame, step, i, steps.length, secrets, apiBase, runId, log);
  }
}

async function runSingleStep(page, currentFrame, step, index, total, secrets, apiBase, runId, log) {
  const timeout = step.timeoutMs ?? 30000;
  const label = `step ${index + 1}/${total} ${step.type}`;
  log(label);
  await fetch(`${apiBase}/internal/runs/${runId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: label })
  }).catch(()=>{});

  const target = currentFrame || page;
  switch (step.type) {
    case "waitForLoadState":
      await target.waitForLoadState(step.state || "domcontentloaded", { timeout });
      break;
    case "waitForSelector":
      if (!step.selector) throw new Error("waitForSelector requires selector");
      await smartWaitForSelector(page, target, step.selector, timeout);
      break;
    case "waitForURL":
      if (!step.url) throw new Error("waitForURL requires url");
      await target.waitForURL(step.url, { timeout });
      break;
    case "click":
      if (!step.selector) throw new Error("click requires selector");
      await smartClick(page, target, step.selector, timeout);
      break;
    case "fill":
      if (!step.selector) throw new Error("fill requires selector");
      await target.fill(step.selector, resolveValue(step.value, secrets));
      break;
    case "type":
      await page.keyboard.type(resolveValue(step.value, secrets));
      break;
    case "press":
      await page.keyboard.press(normalizeKey(step.key || "Enter"));
      break;
    case "sleep":
      await page.waitForTimeout(step.ms ?? 500);
      break;
    case "scroll":
      await runScrollStep(target, step, timeout);
      break;
    case "assertURLContains": {
      const expected = String(step.url || "").trim();
      if (!expected) throw new Error("assertURLContains requires url text");
      const current = target.url();
      if (!current.includes(expected)) {
        throw new Error(`assertURLContains failed: expected "${expected}" in "${current}"`);
      }
      break;
    }
    case "assertTextContains": {
      const expected = String(resolveValue(step.value, secrets) || "").trim();
      if (!expected) throw new Error("assertTextContains requires expected text");
      if (step.selector) {
        const locator = target.locator(step.selector).first();
        await locator.waitFor({ state: "visible", timeout });
        const text = (await locator.textContent()) || "";
        if (!text.includes(expected)) {
          throw new Error(`assertTextContains failed on selector "${step.selector}": expected "${expected}"`);
        }
      } else {
        const text = await target.textContent("body");
        if (!String(text || "").includes(expected)) {
          throw new Error(`assertTextContains failed on page: expected "${expected}"`);
        }
      }
      break;
    }
    case "assertVisible": {
      if (!step.selector) throw new Error("assertVisible requires selector");
      await smartWaitForSelector(page, target, step.selector, timeout, "visible");
      break;
    }
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

async function runScrollStep(target, step, timeout) {
  const targetType = step.scrollTo || "bottom";
  const delayMs = Number.isFinite(step.scrollDelayMs) ? step.scrollDelayMs : 250;
  const steps = Number.isFinite(step.scrollSteps) ? Math.max(1, step.scrollSteps) : 6;
  if (targetType === "selector") {
    if (!step.selector) throw new Error("scroll selector required");
    const locator = target.locator(step.selector);
    await locator.waitFor({ state: "visible", timeout });
    await locator.scrollIntoViewIfNeeded();
    return;
  }
  if (targetType === "top") {
    await target.evaluate(() => window.scrollTo(0, 0));
    return;
  }
  for (let i = 0; i < steps; i++) {
    await target.evaluate(() => window.scrollBy(0, window.innerHeight));
    if (delayMs > 0) await page.waitForTimeout(delayMs);
  }
}

async function resolveFrameTarget(page, step, apiBase, runId, log) {
  const selector = String(step.selector || "").trim();
  const urlContains = String(step.url || "").trim();
  const timeout = step.timeoutMs ?? 30000;

  if (selector.toLowerCase() === "main" || urlContains.toLowerCase() === "main") {
    const msg = "selectFrame -> main";
    log(msg);
    await postProgress(apiBase, runId, msg);
    return null;
  }

  if (selector) {
    await page.waitForSelector(selector, { timeout });
    const handle = await page.$(selector);
    const frame = await handle?.contentFrame();
    if (!frame) throw new Error("selectFrame failed: no frame for selector");
    const msg = `selectFrame by selector ${selector}`;
    log(msg);
    await postProgress(apiBase, runId, msg);
    return frame;
  }

  if (urlContains) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const frame = page.frames().find((f) => f.url().includes(urlContains));
      if (frame) {
        const msg = `selectFrame by url ${urlContains}`;
        log(msg);
        await postProgress(apiBase, runId, msg);
        return frame;
      }
      await page.waitForTimeout(250);
    }
    throw new Error(`selectFrame failed: no frame url contains "${urlContains}"`);
  }

  throw new Error("selectFrame requires selector or url");
}

async function smartWaitForSelector(page, target, selector, timeout, state = "attached") {
  try {
    await target.waitForSelector(selector, { timeout, state });
    return target;
  } catch {}

  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const frames = [page, ...page.frames()];
    for (const frame of frames) {
      try {
        const handle = await frame.$(selector);
        if (handle) {
          await frame.waitForSelector(selector, { timeout: 2000, state });
          return frame;
        }
      } catch {}
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`smartWaitForSelector timeout for ${selector}`);
}

async function smartClick(page, target, selector, timeout) {
  const end = Date.now() + timeout;
  let lastErr;
  while (Date.now() < end) {
    try {
      const remaining = Math.max(250, end - Date.now());
      const frame = await smartWaitForSelector(page, target, selector, Math.min(5000, remaining), "visible");
      await frame.click(selector, { timeout: 2000 });
      return;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(250);
    }
  }
  throw new Error(`smartClick timeout for ${selector}${lastErr ? ` (${lastErr.message || lastErr})` : ""}`);
}

async function autoScrollForLazyLoad(page, apiBase, runId, log) {
  const msg = "lazy-load scroll";
  log(msg);
  await postProgress(apiBase, runId, msg);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
function resolveValue(v, secrets) {
  if (typeof v !== "string") return "";
  if (v.startsWith("secret.")) return secrets?.[v.slice(7)] ?? "";
  return v;
}
function normalizeKey(key) {
  if (!key) return "Enter";
  const normalized = String(key).trim();
  const upper = normalized.toUpperCase();
  const map = {
    ENTER: "Enter",
    RETURN: "Enter",
    ESC: "Escape",
    ESCAPE: "Escape",
    SPACE: "Space",
    TAB: "Tab",
    BACKSPACE: "Backspace",
    DELETE: "Delete"
  };
  return map[upper] || normalized;
}
function sanitize(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "shot";
}
