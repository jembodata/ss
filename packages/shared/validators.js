import { z } from "zod";

export const ProfileSchema = z.object({
  ignoreHTTPSErrors: z.boolean().default(true),
  viewport: z
    .object({ width: z.number().int().min(200), height: z.number().int().min(200) })
    .default({ width: 1366, height: 768 }),
  userAgent: z.string().optional(),
  locale: z.string().default("en-US"),
  timezoneId: z.string().default("Asia/Jakarta"),
  blockResources: z.boolean().default(false),
  extraHeaders: z.record(z.string()).default({})
});

export const StepSchema = z.object({
  type: z.enum([
    "waitForLoadState",
    "waitForSelector",
    "waitForURL",
    "click",
    "fill",
    "type",
    "press",
    "sleep",
    "scroll",
    "selectFrame",
    "assertURLContains",
    "assertTextContains",
    "assertVisible"
  ]),
  selector: z.string().optional(),
  value: z.string().optional(),
  key: z.string().optional(),
  state: z.enum(["load", "domcontentloaded", "networkidle"]).optional(),
  url: z.string().optional(),
  timeoutMs: z.number().int().optional(),
  ms: z.number().int().optional(),
  scrollTo: z.enum(["top", "bottom", "selector"]).optional(),
  scrollSteps: z.number().int().min(1).max(50).optional(),
  scrollDelayMs: z.number().int().min(0).max(30000).optional()
});

export const CaptureSchema = z.object({
  name: z.string(),
  phase: z.enum(["preLogin", "postLogin", "both"]).default("postLogin"),
  mode: z.enum(["page", "element"]).default("page"),
  selector: z.string().optional(),
  fullPage: z.boolean().default(false)
});

export const UploadSchema = z
  .object({
    enabled: z.boolean().default(false),
    endpoint: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().url().optional()
    ),
    method: z.enum(["POST", "PUT"]).default("POST"),
    headers: z.record(z.string()).default({}),
    multipart: z
      .object({
        fileField: z.string().default("file"),
        extraFields: z.record(z.string()).default({})
      })
      .optional(),
    timeoutMs: z.number().int().default(20000),
    retry: z
      .object({
        max: z.number().int().default(0),
        backoffMs: z.number().int().default(1000)
      })
      .default({ max: 0, backoffMs: 1000 })
  })
  .superRefine((val, ctx) => {
    if (val.enabled && !val.endpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "upload.endpoint required when upload enabled",
        path: ["endpoint"]
      });
    }
  });

export const NotificationSchema = z.object({
  type: z.enum(["http"]).default("http"),
  endpoint: z.string().url(),
  body: z.string().default("{}"),
  headers: z.record(z.string()).default({}),
  fileField: z.string().default("file")
});

export const JobConfigSchema = z.object({
  startUrl: z.string().url(),
  navigationTimeoutMs: z.number().int().min(1000).max(300000).default(45000),
  captureDelayMs: z.number().int().min(0).max(300000).default(10000),
  login: z
    .object({
      enabled: z.boolean().default(false),
      steps: z.array(StepSchema).default([])
    })
    .default({ enabled: false, steps: [] }),
  interaction: z
    .object({
      enabled: z.boolean().default(false),
      steps: z.array(StepSchema).default([]),
      captureMode: z.enum(["afterInteraction", "afterEachStep"]).default("afterInteraction"),
      bypassLazyLoad: z.boolean().default(false)
    })
    .default({ enabled: false, steps: [], captureMode: "afterInteraction", bypassLazyLoad: false }),
  postLoginSteps: z.array(StepSchema).default([]),
  captures: z.array(CaptureSchema).default([]),
  upload: UploadSchema.default({
    enabled: false,
    method: "POST",
    headers: {},
    timeoutMs: 20000,
    retry: { max: 0, backoffMs: 1000 }
  }),
  notifications: z
    .object({
      enabled: z.boolean().default(false),
      ids: z.array(z.string()).default([])
    })
    .default({ enabled: false, ids: [] })
});
