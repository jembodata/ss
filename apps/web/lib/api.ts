export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ||
  "http://localhost:8081";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.error || res.statusText;
    throw new Error(message || "Request failed");
  }
  return data as T;
}

export const api = {
  profiles: {
    list: () => request<any[]>("/api/v1/profiles"),
    create: (payload: { name: string; config: unknown }) =>
      request<{ id: string }>("/api/v1/profiles", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    update: (profileId: string, payload: { name: string; config: unknown }) =>
      request("/api/v1/profiles/" + encodeURIComponent(profileId), {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    remove: (profileId: string) =>
      request("/api/v1/profiles/" + encodeURIComponent(profileId), { method: "DELETE" })
  },
  jobs: {
    list: () => request<any[]>("/api/v1/jobs"),
    running: () => request<{ jobIds: string[] }>("/api/v1/jobs/running"),
    create: (payload: { name: string; profileId: string; config: unknown }) =>
      request<{ id: string }>("/api/v1/jobs", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    update: (jobId: string, payload: { name: string; profileId: string; config: unknown }) =>
      request("/api/v1/jobs/" + encodeURIComponent(jobId), {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    runNow: (jobId: string) =>
      request<{ runId: string }>("/api/v1/jobs/" + encodeURIComponent(jobId) + "/run-now", {
        method: "POST"
      }),
    remove: (jobId: string) =>
      request("/api/v1/jobs/" + encodeURIComponent(jobId), { method: "DELETE" })
  },
  runs: {
    list: (jobId?: string) =>
      request<any[]>(jobId ? `/api/v1/runs?jobId=${encodeURIComponent(jobId)}` : "/api/v1/runs"),
    get: (runId: string) => request("/api/v1/runs/" + encodeURIComponent(runId)),
    remove: (runId: string) =>
      request("/api/v1/runs/" + encodeURIComponent(runId), { method: "DELETE" })
  },
  schedules: {
    list: () => request<any[]>("/api/v1/schedules"),
    running: () => request<{ items: any[] }>("/api/v1/schedules/running"),
    create: (jobId: string, payload: { crons: string[]; timezone: string; mode?: string; remainingRuns?: number | null }) =>
      request("/api/v1/jobs/" + encodeURIComponent(jobId) + "/schedules", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    remove: (jobId: string) =>
      request("/api/v1/jobs/" + encodeURIComponent(jobId) + "/schedules", { method: "DELETE" }),
    toggle: (jobId: string, enabled: boolean) =>
      request("/api/v1/jobs/" + encodeURIComponent(jobId) + "/schedules/status", {
        method: "PATCH",
        body: JSON.stringify({ enabled })
      })
  },
  notifications: {
    list: () => request<any[]>("/api/v1/notifications"),
    create: (payload: { name: string; type: string; endpoint: string; body: string; headers?: string; fileField?: string }) =>
      request<{ id: string }>("/api/v1/notifications", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    update: (id: string, payload: { name: string; type: string; endpoint: string; body: string; headers?: string; fileField?: string }) =>
      request("/api/v1/notifications/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    test: (id: string) =>
      request<{ ok: boolean; status?: number; body?: string }>("/api/v1/notifications/" + encodeURIComponent(id) + "/test", {
        method: "POST"
      }),
    testDraft: (payload: { type: string; endpoint: string; body: string; headers?: string; fileField?: string }) =>
      request<{ ok: boolean; status?: number; body?: string }>("/api/v1/notifications/test-draft", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    remove: (id: string) =>
      request("/api/v1/notifications/" + encodeURIComponent(id), { method: "DELETE" })
  },
  metrics: {
    summary: () =>
      request<{
        time: string;
        queue: Record<string, number>;
        runs: Record<string, number>;
      }>("/api/v1/metrics/summary")
  }
};
