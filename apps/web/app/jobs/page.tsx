"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import { useToast } from "@/components/ToastProvider";
import {
  Button,
  Checkbox,
  ComposedModal,
  Form,
  InlineLoading,
  MultiSelect,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Modal,
  Pagination,
  Select,
  SelectItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tile
} from "@carbon/react";

type Schedule = {
  id: string;
  job_id: string;
  cron: string;
  timezone: string;
  enabled: number;
  mode: string;
  remaining_runs: number | null;
};
type Capture = {
  name: string;
  phase: string;
  mode: string;
  fullPage?: boolean;
  selector?: string;
};
const pressKeyHint = "Keys: Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown";

function cronToTime(cron: string) {
  const match = String(cron || "").trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (!match) return cron;
  return `${match[2].padStart(2, "0")}:${match[1].padStart(2, "0")}`;
}

function parseTimes(raw: string) {
  const input = raw.trim();
  if (!input) return { error: "Schedule time required.", crons: [] as string[] };
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  const crons: string[] = [];
  for (const part of parts) {
    const match = part.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) return { error: `Invalid time: ${part}`, crons: [] };
    crons.push(`${match[2]} ${match[1].padStart(2, "0")} * * *`);
  }
  return { error: null, crons };
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<Record<string, Schedule[]>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [editJob, setEditJob] = useState<any | null>(null);
  const [editJobCfg, setEditJobCfg] = useState<any | null>(null);
  const [editCaptures, setEditCaptures] = useState<Capture[]>([]);
  const [editName, setEditName] = useState("");
  const [editProfile, setEditProfile] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [editScheduleEnabled, setEditScheduleEnabled] = useState(false);
  const [editScheduleTimes, setEditScheduleTimes] = useState("");
  const [editScheduleTz, setEditScheduleTz] = useState("Asia/Jakarta");
  const [editScheduleMode, setEditScheduleMode] = useState("daily");
  const [editScheduleRuns, setEditScheduleRuns] = useState(1);
  const [editStatus, setEditStatus] = useState("");
  const [editLoginStepType, setEditLoginStepType] = useState("click");
  const [editLoginStepSelector, setEditLoginStepSelector] = useState("");
  const [editLoginStepValue, setEditLoginStepValue] = useState("");
  const [editLoginStepKey, setEditLoginStepKey] = useState("Enter");
  const [editLoginStepUrl, setEditLoginStepUrl] = useState("");
  const [editLoginStepState, setEditLoginStepState] = useState("domcontentloaded");
  const [editLoginStepSleepSeconds, setEditLoginStepSleepSeconds] = useState("1");
  const [editLoginStepTimeoutSeconds, setEditLoginStepTimeoutSeconds] = useState("30");
  const [editLoginStepStatus, setEditLoginStepStatus] = useState("");
  const [editInteractionStepType, setEditInteractionStepType] = useState("click");
  const [editInteractionStepSelector, setEditInteractionStepSelector] = useState("");
  const [editInteractionStepValue, setEditInteractionStepValue] = useState("");
  const [editInteractionStepKey, setEditInteractionStepKey] = useState("Enter");
  const [editInteractionStepUrl, setEditInteractionStepUrl] = useState("");
  const [editInteractionStepState, setEditInteractionStepState] = useState("domcontentloaded");
  const [editInteractionStepSleepSeconds, setEditInteractionStepSleepSeconds] = useState("1");
  const [editInteractionStepTimeoutSeconds, setEditInteractionStepTimeoutSeconds] = useState("30");
  const [editInteractionScrollTo, setEditInteractionScrollTo] = useState("bottom");
  const [editInteractionScrollSteps, setEditInteractionScrollSteps] = useState("6");
  const [editInteractionScrollDelaySeconds, setEditInteractionScrollDelaySeconds] = useState("0.25");
  const [editInteractionStepStatus, setEditInteractionStepStatus] = useState("");
  const [editPostStepType, setEditPostStepType] = useState("click");
  const [editPostStepSelector, setEditPostStepSelector] = useState("");
  const [editPostStepValue, setEditPostStepValue] = useState("");
  const [editPostStepKey, setEditPostStepKey] = useState("Enter");
  const [editPostStepUrl, setEditPostStepUrl] = useState("");
  const [editPostStepState, setEditPostStepState] = useState("domcontentloaded");
  const [editPostStepSleepSeconds, setEditPostStepSleepSeconds] = useState("1");
  const [editPostStepTimeoutSeconds, setEditPostStepTimeoutSeconds] = useState("30");
  const [editPostStepStatus, setEditPostStepStatus] = useState("");
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<any | null>(null);
  const [manualRunLoading, setManualRunLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    refresh();
    api.notifications.list().then(setNotifications).catch(() => {});
    api.profiles
      .list()
      .then((list) => {
        const map: Record<string, string> = {};
        list.forEach((p: any) => {
          map[p.id] = p.name || p.id;
        });
        setProfiles(map);
      })
      .catch(() => {});
    const a = setInterval(loadRunning, 10000);
    const b = setInterval(loadSchedules, 15000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  async function refresh() {
    await loadJobs();
    await loadSchedules();
    await loadRunning();
  }

  async function loadJobs() {
    try {
      const data = await api.jobs.list();
      setJobs(data);
    } catch {
      setStatus("Failed to load jobs.");
      push("error", "Jobs failed", "Failed to load jobs.");
    }
  }

  async function loadSchedules() {
    try {
      const list = (await api.schedules.list()) as Schedule[];
      const map: Record<string, Schedule[]> = {};
      list.forEach((s) => {
        if (!map[s.job_id]) map[s.job_id] = [];
        map[s.job_id].push(s);
      });
      setSchedules(map);
    } catch {
      push("error", "Schedules failed", "Failed to load schedules.");
    }
  }

  async function loadRunning() {
    try {
      const res = await api.jobs.running();
      setRunning(new Set(res.jobIds));
    } catch {
      push("error", "Runs failed", "Failed to load running jobs.");
    }
  }

  async function runNow(jobId: string) {
    setStatus("Queueing run...");
    setManualRunLoading((prev) => ({ ...prev, [jobId]: true }));
    try {
      await api.jobs.runNow(jobId);
      setStatus("Run queued.");
      push("success", "Run queued", jobId);
    } catch (err: any) {
      setStatus(err.message || "Failed to run.");
      push("error", "Run failed", err.message || "Failed to run.");
    } finally {
      setManualRunLoading((prev) => ({ ...prev, [jobId]: false }));
    }
  }

  async function toggleSchedule(jobId: string, enabled: boolean) {
    setStatus(enabled ? "Starting schedule..." : "Stopping schedule...");
    try {
      await api.schedules.toggle(jobId, enabled);
      await loadSchedules();
      setStatus(enabled ? "Schedule started." : "Schedule stopped.");
      push("success", enabled ? "Schedule started" : "Schedule stopped", jobId);
    } catch (err: any) {
      setStatus(err.message || "Schedule toggle failed.");
      push("error", "Schedule failed", err.message || "Schedule toggle failed.");
    }
  }

  async function deleteJob(jobId: string) {
    setStatus("Deleting...");
    try {
      await api.jobs.remove(jobId);
      await refresh();
      setStatus("Deleted.");
      push("success", "Job deleted", jobId);
    } catch (err: any) {
      setStatus(err.message || "Delete failed.");
      push("error", "Delete failed", err.message || "Delete failed.");
    }
  }
  function requestDelete(job: any) {
    setConfirmDeleteJob(job);
    setConfirmDeleteOpen(true);
  }

  function openEdit(job: any) {
    setEditJob(job);
    setEditName(job.name || "");
    setEditProfile(job.profile_id || "");
    const cfg = job.config || {};
    const normalized = {
      startUrl: cfg.startUrl || "",
      navigationTimeoutMs: Number.isFinite(cfg.navigationTimeoutMs) ? cfg.navigationTimeoutMs : 45000,
      captureDelayMs: Number.isFinite(cfg.captureDelayMs) ? cfg.captureDelayMs : 10000,
      login: {
        enabled: !!cfg.login?.enabled,
        steps: Array.isArray(cfg.login?.steps) ? cfg.login.steps : []
      },
      interaction: {
        enabled: !!cfg.interaction?.enabled,
        steps: Array.isArray(cfg.interaction?.steps) ? cfg.interaction.steps : [],
        captureMode: cfg.interaction?.captureMode || "afterInteraction",
        bypassLazyLoad: !!cfg.interaction?.bypassLazyLoad
      },
      postLoginSteps: Array.isArray(cfg.postLoginSteps) ? cfg.postLoginSteps : [],
      captures: Array.isArray(cfg.captures) ? cfg.captures : [],
      notifications: cfg.notifications || { enabled: false, ids: [] }
    };
    setEditJobCfg(normalized);
    setEditCaptures(normalized.captures as Capture[]);
    const sched = schedules[job.id] || [];
    setEditScheduleEnabled(sched.length > 0);
    setEditScheduleTimes(sched.map((s) => cronToTime(s.cron)).join(", "));
    setEditScheduleTz(sched[0]?.timezone || "Asia/Jakarta");
    setEditScheduleMode(sched[0]?.mode || "daily");
    setEditScheduleRuns(sched[0]?.remaining_runs ?? 1);
  }

  async function saveEdit() {
    if (!editJob || !editJobCfg) return;
    setEditStatus("Saving...");
    if (!editJobCfg.startUrl) {
      setEditStatus("Start URL is required.");
      return;
    }
    const cfg = { ...editJobCfg, captures: editCaptures };
    try {
      await api.jobs.update(editJob.id, {
        name: editName,
        profileId: editProfile,
        config: cfg
      });
      if (editScheduleEnabled) {
        const parsed = parseTimes(editScheduleTimes);
        if (parsed.error) {
          setEditStatus(parsed.error);
          return;
        }
        const runs = editScheduleMode === "limited" ? editScheduleRuns : null;
        await api.schedules.remove(editJob.id).catch(() => {});
        await api.schedules.create(editJob.id, {
          crons: parsed.crons,
          timezone: editScheduleTz,
          mode: editScheduleMode,
          remainingRuns: runs
        });
      } else {
        await api.schedules.remove(editJob.id).catch(() => {});
      }
      setEditStatus("Saved.");
      await refresh();
      push("success", "Job saved", editName || editJob.id);
      closeEdit();
    } catch (err: any) {
      setEditStatus(err.message || "Save failed.");
      push("error", "Save failed", err.message || "Save failed.");
    }
  }

  function closeEdit() {
    setEditJob(null);
    setEditJobCfg(null);
    setEditStatus("");
  }

  const scheduleMap = useMemo(() => schedules, [schedules]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const pageItems = jobs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <AppHeader />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Jobs</h2>
          <p className="text-sm text-muted">Active capture jobs</p>
        </div>
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Status</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Profile</TableHeader>
              <TableHeader>Start URL</TableHeader>
              <TableHeader>Schedule</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((job) => {
              const sched = scheduleMap[job.id] || [];
              const enabled = sched.some((s) => s.enabled === 1);
              const isManualLoading = !!manualRunLoading[job.id];
              const isRunning = running.has(job.id);
              return (
                <TableRow key={job.id}>
                  <TableCell>
                    <Tag type={isRunning ? "green" : "red"}>
                      {isRunning ? "Running" : "Idle"}
                    </Tag>
                  </TableCell>
                  <TableCell>{job.name}</TableCell>
                  <TableCell>{profiles[job.profile_id] || job.profile_id}</TableCell>
                  <TableCell>{job.config?.startUrl}</TableCell>
                  <TableCell>{sched.length ? sched.map((s) => `${cronToTime(s.cron)} (${s.mode})`).join(", ") : "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        kind="secondary"
                        onClick={() => runNow(job.id)}
                        disabled={isManualLoading}
                      >
                        Manual run
                      </Button>
                      {(isManualLoading || isRunning) && (
                        <InlineLoading
                          description={isRunning ? "Running..." : "Queueing..."}
                          status={isRunning ? "active" : "active"}
                        />
                      )}
                      <Button size="sm" kind="ghost" onClick={() => toggleSchedule(job.id, !enabled)} disabled={!sched.length}>
                        {enabled ? "Stop schedule" : "Start schedule"}
                      </Button>
                      <Button size="sm" kind="ghost" onClick={() => openEdit(job)}>Edit</Button>
                      <Button size="sm" kind="ghost" onClick={() => requestDelete(job)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!pageItems.length && (
              <TableRow>
                <TableCell colSpan={6}>{status || "No jobs yet."}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          pageSize={pageSize}
          pageSizes={[5, 10, 20]}
          totalItems={jobs.length}
          onChange={({ page, pageSize }) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
        {status && <p className="text-xs text-muted">{status}</p>}
      </div>

      <ComposedModal
        open={!!editJob && !!editJobCfg}
        onClose={closeEdit}
        size="lg"
        preventCloseOnClickOutside
        className="modal-fixed"
      >
        <ModalHeader label="Jobs" title="Edit Job" />
        <ModalBody>
          {editJob && editJobCfg && (
            <Form aria-label="Edit job form">
              <Stack gap={6}>
              <TextInput id="edit-name" labelText="Job name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <TextInput id="edit-profile" labelText="Profile ID" value={editProfile} onChange={(e) => setEditProfile(e.target.value)} />
              <TextInput
                id="edit-start-url"
                labelText="Start URL"
                value={editJobCfg.startUrl || ""}
                onChange={(e) => setEditJobCfg({ ...editJobCfg, startUrl: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  id="edit-timeout"
                  labelText="Load timeout (seconds)"
                  type="number"
                  value={String(Math.round((editJobCfg.navigationTimeoutMs || 45000) / 1000))}
                  onChange={(e) =>
                    setEditJobCfg({
                      ...editJobCfg,
                      navigationTimeoutMs: Number(e.target.value) * 1000
                    })
                  }
                />
                <TextInput
                  id="edit-delay"
                  labelText="Capture delay (seconds)"
                  type="number"
                  value={String(Math.round((editJobCfg.captureDelayMs || 10000) / 1000))}
                  onChange={(e) =>
                    setEditJobCfg({
                      ...editJobCfg,
                      captureDelayMs: Number(e.target.value) * 1000
                    })
                  }
                />
              </div>
              <Tile className="rounded-lg border border-slate-200 p-4">
                <div className="text-sm font-semibold">Interaction</div>
                <Checkbox
                  id="edit-login-enabled"
                  labelText="Enable login"
                  checked={editJobCfg.login?.enabled || false}
                  onChange={(e) =>
                    setEditJobCfg({
                      ...editJobCfg,
                      login: {
                        ...(editJobCfg.login || { enabled: false, steps: [] }),
                        enabled: (e.target as HTMLInputElement).checked
                      }
                    })
                  }
                />
                {editJobCfg.login?.enabled ? (
                  <>
                    <div className="mt-3 text-xs text-muted">Login steps</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {(editJobCfg.login.steps || []).map((s: any, idx: number) => (
                        <Tile key={idx} style={{ padding: "8px 12px" }}>
                          <div className="text-xs text-muted">Step {idx + 1}</div>
                          <div className="text-sm font-semibold">{s.type}</div>
                          {s.selector && <div className="text-xs">{s.selector}</div>}
                          {s.value && <div className="text-xs">value: {s.value}</div>}
                          {s.key && <div className="text-xs">key: {s.key}</div>}
                          {s.url && <div className="text-xs">url: {s.url}</div>}
                          {s.state && <div className="text-xs">state: {s.state}</div>}
                          {Number.isFinite(s.ms) && <div className="text-xs">sleep: {s.ms}ms</div>}
                          <Button
                            kind="ghost"
                            size="sm"
                            onClick={() => {
                              const next = [...editJobCfg.login.steps];
                              next.splice(idx, 1);
                              setEditJobCfg({ ...editJobCfg, login: { ...editJobCfg.login, steps: next } });
                            }}
                          >
                            Remove
                          </Button>
                        </Tile>
                      ))}
                      {(editJobCfg.login.steps || []).length === 0 && (
                        <div className="text-xs text-muted">No steps yet.</div>
                      )}
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="text-xs text-muted">Add custom step</div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <Select
                          id="edit-login-step-type"
                          labelText="Step type"
                          value={editLoginStepType}
                          onChange={(e) => setEditLoginStepType(e.target.value)}
                        >
                          <SelectItem value="click" text="click" />
                          <SelectItem value="fill" text="fill" />
                          <SelectItem value="type" text="type" />
                          <SelectItem value="press" text="press" />
                          <SelectItem value="waitForSelector" text="waitForSelector" />
                          <SelectItem value="waitForURL" text="waitForURL" />
                          <SelectItem value="waitForLoadState" text="waitForLoadState" />
                          <SelectItem value="sleep" text="sleep" />
                          <SelectItem value="selectFrame" text="selectFrame" />
                          <SelectItem value="assertURLContains" text="assertURLContains" />
                          <SelectItem value="assertTextContains" text="assertTextContains" />
                          <SelectItem value="assertVisible" text="assertVisible" />
                        </Select>
                        <TextInput
                          id="edit-login-step-timeout"
                          labelText="Timeout (seconds)"
                          value={editLoginStepTimeoutSeconds}
                          onChange={(e) => setEditLoginStepTimeoutSeconds(e.target.value)}
                        />
                      </div>
                      {["click", "fill", "waitForSelector", "assertVisible", "selectFrame"].includes(editLoginStepType) && (
                        <TextInput
                          id="edit-login-step-selector"
                          labelText={editLoginStepType === "selectFrame" ? "Frame selector (optional)" : "Selector"}
                          value={editLoginStepSelector}
                          onChange={(e) => setEditLoginStepSelector(e.target.value)}
                        />
                      )}
                      {editLoginStepType === "fill" && (
                        <TextInput
                          id="edit-login-step-value"
                          labelText="Value"
                          value={editLoginStepValue}
                          onChange={(e) => setEditLoginStepValue(e.target.value)}
                        />
                      )}
                      {editLoginStepType === "type" && (
                        <TextInput
                          id="edit-login-step-type-value"
                          labelText="Text to type"
                          value={editLoginStepValue}
                          onChange={(e) => setEditLoginStepValue(e.target.value)}
                        />
                      )}
                      {editLoginStepType === "assertTextContains" && (
                        <TextInput
                          id="edit-login-step-assert-text"
                          labelText="Expected text"
                          value={editLoginStepValue}
                          onChange={(e) => setEditLoginStepValue(e.target.value)}
                        />
                      )}
                      {editLoginStepType === "press" && (
                        <TextInput
                          id="edit-login-step-key"
                          labelText="Key (Enter, Tab, ArrowDown, etc.)"
                          value={editLoginStepKey}
                          onChange={(e) => setEditLoginStepKey(e.target.value)}
                        />
                      )}
                      {editLoginStepType === "press" && (
                        <div className="text-xs text-muted">{pressKeyHint}</div>
                      )}
                      {["waitForURL", "assertURLContains", "selectFrame"].includes(editLoginStepType) && (
                        <TextInput
                          id="edit-login-step-url"
                          labelText={
                            editLoginStepType === "selectFrame"
                              ? "Frame URL contains (optional)"
                              : editLoginStepType === "assertURLContains"
                                ? "Expected URL contains"
                                : "URL or pattern"
                          }
                          value={editLoginStepUrl}
                          onChange={(e) => setEditLoginStepUrl(e.target.value)}
                        />
                      )}
                      {editLoginStepType === "waitForLoadState" && (
                        <Select
                          id="edit-login-step-state"
                          labelText="Load state"
                          value={editLoginStepState}
                          onChange={(e) => setEditLoginStepState(e.target.value)}
                        >
                          <SelectItem value="domcontentloaded" text="domcontentloaded" />
                          <SelectItem value="load" text="load" />
                          <SelectItem value="networkidle" text="networkidle" />
                        </Select>
                      )}
                      {editLoginStepType === "sleep" && (
                        <TextInput
                          id="edit-login-step-sleep"
                          labelText="Sleep (seconds)"
                          value={editLoginStepSleepSeconds}
                          onChange={(e) => setEditLoginStepSleepSeconds(e.target.value)}
                        />
                      )}
                      <div className="mt-3">
                        <Button
                          kind="secondary"
                          onClick={() => {
                            const step: any = { type: editLoginStepType };
                            const timeoutSec = Number(editLoginStepTimeoutSeconds);
                            if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
                              step.timeoutMs = Math.round(timeoutSec * 1000);
                            }
                            if (editLoginStepType === "click") {
                              if (!editLoginStepSelector) return setEditLoginStepStatus("Selector required for click.");
                              step.selector = editLoginStepSelector;
                            }
                            if (editLoginStepType === "fill") {
                              if (!editLoginStepSelector) return setEditLoginStepStatus("Selector required for fill.");
                              step.selector = editLoginStepSelector;
                              step.value = editLoginStepValue;
                            }
                            if (editLoginStepType === "type") {
                              step.value = editLoginStepValue;
                            }
                            if (editLoginStepType === "press") {
                              step.key = editLoginStepKey || "Enter";
                            }
                            if (editLoginStepType === "waitForSelector") {
                              if (!editLoginStepSelector) return setEditLoginStepStatus("Selector required for waitForSelector.");
                              step.selector = editLoginStepSelector;
                            }
                            if (editLoginStepType === "waitForURL") {
                              if (!editLoginStepUrl) return setEditLoginStepStatus("URL required for waitForURL.");
                              step.url = editLoginStepUrl;
                            }
                            if (editLoginStepType === "waitForLoadState") {
                              step.state = editLoginStepState || "domcontentloaded";
                            }
                            if (editLoginStepType === "sleep") {
                              const sleepSec = Number(editLoginStepSleepSeconds);
                              if (!Number.isFinite(sleepSec) || sleepSec < 0) {
                                return setEditLoginStepStatus("Sleep seconds must be >= 0.");
                              }
                              step.ms = Math.round(sleepSec * 1000);
                            }
                            if (editLoginStepType === "assertURLContains") {
                              if (!editLoginStepUrl) return setEditLoginStepStatus("Expected URL text is required.");
                              step.url = editLoginStepUrl;
                            }
                            if (editLoginStepType === "assertTextContains") {
                              if (!editLoginStepValue) return setEditLoginStepStatus("Expected text is required.");
                              step.value = editLoginStepValue;
                              if (editLoginStepSelector) step.selector = editLoginStepSelector;
                            }
                            if (editLoginStepType === "assertVisible") {
                              if (!editLoginStepSelector) return setEditLoginStepStatus("Selector required for assertVisible.");
                              step.selector = editLoginStepSelector;
                            }
                            if (editLoginStepType === "selectFrame") {
                              if (!editLoginStepSelector && !editLoginStepUrl) {
                                return setEditLoginStepStatus("Frame selector or URL contains is required.");
                              }
                              if (editLoginStepSelector) step.selector = editLoginStepSelector;
                              if (editLoginStepUrl) step.url = editLoginStepUrl;
                            }
                            setEditLoginStepStatus("");
                            setEditJobCfg({
                              ...editJobCfg,
                              login: {
                                enabled: true,
                                steps: [...editJobCfg.login.steps, step]
                              }
                            });
                          }}
                        >
                          Add custom step
                        </Button>
                        {editLoginStepStatus && <p className="mt-2 text-xs text-muted">{editLoginStepStatus}</p>}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-xs text-muted">Enable login to configure steps.</div>
                )}
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <div className="text-sm font-semibold">Interaction (non-login)</div>
                  <div className="text-xs text-muted">Run steps before capture without login.</div>
                  <Checkbox
                    id="edit-interaction-enabled"
                    className="mt-3"
                    labelText="Enable interaction"
                    checked={editJobCfg.interaction?.enabled || false}
                    onChange={(e) => {
                      const enabled = (e.target as HTMLInputElement).checked;
                      const hasPostLoginCapture = editCaptures.some(
                        (c) => c.phase === "postLogin" || c.phase === "both"
                      );
                      if (enabled && !hasPostLoginCapture) {
                        setEditCaptures([
                          ...editCaptures,
                          { name: "post-login", phase: "postLogin", mode: "page", fullPage: false }
                        ]);
                      }
                      setEditJobCfg({
                        ...editJobCfg,
                        interaction: {
                          ...(editJobCfg.interaction || { enabled: false, steps: [], captureMode: "afterInteraction", bypassLazyLoad: false }),
                          enabled
                        }
                      });
                    }}
                  />
                  {editJobCfg.interaction?.enabled ? (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Select
                          id="edit-interaction-capture-mode"
                          labelText="Capture mode"
                          value={editJobCfg.interaction?.captureMode || "afterInteraction"}
                          onChange={(e) =>
                            setEditJobCfg({
                              ...editJobCfg,
                              interaction: {
                                ...(editJobCfg.interaction || { enabled: true, steps: [] }),
                                captureMode: e.target.value
                              }
                            })
                          }
                        >
                          <SelectItem value="afterInteraction" text="After interaction" />
                          <SelectItem value="afterEachStep" text="After each step" />
                        </Select>
                        <Checkbox
                          id="edit-interaction-lazy-load"
                          labelText="Bypass lazy-load (auto scroll)"
                          checked={editJobCfg.interaction?.bypassLazyLoad || false}
                          onChange={(e) =>
                            setEditJobCfg({
                              ...editJobCfg,
                              interaction: {
                                ...(editJobCfg.interaction || { enabled: true, steps: [] }),
                                bypassLazyLoad: (e.target as HTMLInputElement).checked
                              }
                            })
                          }
                        />
                      </div>
                      <div className="mt-4 text-xs text-muted">Interaction steps</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {(editJobCfg.interaction?.steps || []).map((s: any, idx: number) => (
                          <Tile key={`edit-interaction-${idx}`} style={{ padding: "8px 12px" }}>
                            <div className="text-xs text-muted">Step {idx + 1}</div>
                            <div className="text-sm font-semibold">{s.type}</div>
                            {s.selector && <div className="text-xs">{s.selector}</div>}
                            {s.value && <div className="text-xs">value: {s.value}</div>}
                            {s.key && <div className="text-xs">key: {s.key}</div>}
                            {s.url && <div className="text-xs">url: {s.url}</div>}
                            {s.state && <div className="text-xs">state: {s.state}</div>}
                            {Number.isFinite(s.ms) && <div className="text-xs">sleep: {s.ms}ms</div>}
                            {s.type === "scroll" && (
                              <div className="text-xs">
                                scroll: {s.scrollTo || "bottom"}
                                {Number.isFinite(s.scrollSteps) ? `, steps ${s.scrollSteps}` : ""}
                              </div>
                            )}
                            <Button
                              kind="ghost"
                              size="sm"
                              onClick={() => {
                                const next = [...(editJobCfg.interaction?.steps || [])];
                                next.splice(idx, 1);
                                setEditJobCfg({
                                  ...editJobCfg,
                                  interaction: {
                                    ...(editJobCfg.interaction || { enabled: true, steps: [] }),
                                    steps: next
                                  }
                                });
                              }}
                            >
                              Remove
                            </Button>
                          </Tile>
                        ))}
                        {(!editJobCfg.interaction?.steps || editJobCfg.interaction.steps.length === 0) && (
                          <div className="text-xs text-muted">No interaction steps.</div>
                        )}
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="text-xs text-muted">Add interaction step</div>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <Select
                            id="edit-interaction-step-type"
                            labelText="Step type"
                            value={editInteractionStepType}
                            onChange={(e) => setEditInteractionStepType(e.target.value)}
                          >
                            <SelectItem value="click" text="click" />
                            <SelectItem value="fill" text="fill" />
                            <SelectItem value="type" text="type" />
                            <SelectItem value="press" text="press" />
                            <SelectItem value="waitForSelector" text="waitForSelector" />
                            <SelectItem value="waitForURL" text="waitForURL" />
                            <SelectItem value="waitForLoadState" text="waitForLoadState" />
                            <SelectItem value="sleep" text="wait" />
                            <SelectItem value="scroll" text="scroll" />
                            <SelectItem value="selectFrame" text="selectFrame" />
                            <SelectItem value="assertURLContains" text="assertURLContains" />
                            <SelectItem value="assertTextContains" text="assertTextContains" />
                            <SelectItem value="assertVisible" text="assertVisible" />
                          </Select>
                          <TextInput
                            id="edit-interaction-step-timeout"
                            labelText="Timeout (seconds)"
                            value={editInteractionStepTimeoutSeconds}
                            onChange={(e) => setEditInteractionStepTimeoutSeconds(e.target.value)}
                          />
                        </div>
                        {["click", "fill", "waitForSelector", "assertVisible", "selectFrame"].includes(editInteractionStepType) && (
                          <TextInput
                            id="edit-interaction-step-selector"
                            labelText={editInteractionStepType === "selectFrame" ? "Frame selector (optional)" : "Selector"}
                            value={editInteractionStepSelector}
                            onChange={(e) => setEditInteractionStepSelector(e.target.value)}
                          />
                        )}
                        {editInteractionStepType === "fill" && (
                          <TextInput
                            id="edit-interaction-step-value"
                            labelText="Value"
                            value={editInteractionStepValue}
                            onChange={(e) => setEditInteractionStepValue(e.target.value)}
                          />
                        )}
                        {editInteractionStepType === "type" && (
                          <TextInput
                            id="edit-interaction-step-type-value"
                            labelText="Text to type"
                            value={editInteractionStepValue}
                            onChange={(e) => setEditInteractionStepValue(e.target.value)}
                          />
                        )}
                        {editInteractionStepType === "assertTextContains" && (
                          <TextInput
                            id="edit-interaction-step-assert-text"
                            labelText="Expected text"
                            value={editInteractionStepValue}
                            onChange={(e) => setEditInteractionStepValue(e.target.value)}
                          />
                        )}
                        {editInteractionStepType === "press" && (
                          <TextInput
                            id="edit-interaction-step-key"
                            labelText="Key (Enter, Tab, ArrowDown, etc.)"
                            value={editInteractionStepKey}
                            onChange={(e) => setEditInteractionStepKey(e.target.value)}
                          />
                        )}
                        {editInteractionStepType === "press" && (
                          <div className="text-xs text-muted">{pressKeyHint}</div>
                        )}
                        {["waitForURL", "assertURLContains", "selectFrame"].includes(editInteractionStepType) && (
                          <TextInput
                            id="edit-interaction-step-url"
                            labelText={
                              editInteractionStepType === "selectFrame"
                                ? "Frame URL contains (optional)"
                                : editInteractionStepType === "assertURLContains"
                                  ? "Expected URL contains"
                                  : "URL or pattern"
                            }
                            value={editInteractionStepUrl}
                            onChange={(e) => setEditInteractionStepUrl(e.target.value)}
                          />
                        )}
                        {editInteractionStepType === "waitForLoadState" && (
                          <Select
                            id="edit-interaction-step-state"
                            labelText="Load state"
                            value={editInteractionStepState}
                            onChange={(e) => setEditInteractionStepState(e.target.value)}
                          >
                            <SelectItem value="domcontentloaded" text="domcontentloaded" />
                            <SelectItem value="load" text="load" />
                            <SelectItem value="networkidle" text="networkidle" />
                          </Select>
                        )}
                        {editInteractionStepType === "sleep" && (
                          <TextInput
                            id="edit-interaction-step-sleep"
                            labelText="Wait (seconds)"
                            value={editInteractionStepSleepSeconds}
                            onChange={(e) => setEditInteractionStepSleepSeconds(e.target.value)}
                          />
                        )}
                        {editInteractionStepType === "scroll" && (
                          <div className="grid grid-cols-3 gap-3">
                            <Select
                              id="edit-interaction-scroll-to"
                              labelText="Scroll to"
                              value={editInteractionScrollTo}
                              onChange={(e) => setEditInteractionScrollTo(e.target.value)}
                            >
                              <SelectItem value="bottom" text="bottom" />
                              <SelectItem value="top" text="top" />
                              <SelectItem value="selector" text="selector" />
                            </Select>
                            <TextInput
                              id="edit-interaction-scroll-steps"
                              labelText="Scroll steps"
                              type="number"
                              value={editInteractionScrollSteps}
                              onChange={(e) => setEditInteractionScrollSteps(e.target.value)}
                            />
                            <TextInput
                              id="edit-interaction-scroll-delay"
                              labelText="Delay per step (seconds)"
                              value={editInteractionScrollDelaySeconds}
                              onChange={(e) => setEditInteractionScrollDelaySeconds(e.target.value)}
                            />
                          </div>
                        )}
                        {editInteractionStepType === "scroll" && editInteractionScrollTo === "selector" && (
                          <TextInput
                            id="edit-interaction-scroll-selector"
                            labelText="Scroll selector"
                            value={editInteractionStepSelector}
                            onChange={(e) => setEditInteractionStepSelector(e.target.value)}
                          />
                        )}
                        <div className="mt-3">
                          <Button
                            kind="secondary"
                            onClick={() => {
                              const step: any = { type: editInteractionStepType };
                              const timeoutSec = Number(editInteractionStepTimeoutSeconds);
                              if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
                                step.timeoutMs = Math.round(timeoutSec * 1000);
                              }
                              if (editInteractionStepType === "click") {
                                if (!editInteractionStepSelector) return setEditInteractionStepStatus("Selector required for click.");
                                step.selector = editInteractionStepSelector;
                              }
                              if (editInteractionStepType === "fill") {
                                if (!editInteractionStepSelector) return setEditInteractionStepStatus("Selector required for fill.");
                                step.selector = editInteractionStepSelector;
                                step.value = editInteractionStepValue;
                              }
                              if (editInteractionStepType === "type") {
                                step.value = editInteractionStepValue;
                              }
                              if (editInteractionStepType === "press") {
                                step.key = editInteractionStepKey || "Enter";
                              }
                              if (editInteractionStepType === "waitForSelector") {
                                if (!editInteractionStepSelector) return setEditInteractionStepStatus("Selector required for waitForSelector.");
                                step.selector = editInteractionStepSelector;
                              }
                              if (editInteractionStepType === "waitForURL") {
                                if (!editInteractionStepUrl) return setEditInteractionStepStatus("URL required for waitForURL.");
                                step.url = editInteractionStepUrl;
                              }
                              if (editInteractionStepType === "waitForLoadState") {
                                step.state = editInteractionStepState || "domcontentloaded";
                              }
                              if (editInteractionStepType === "sleep") {
                                const sleepSec = Number(editInteractionStepSleepSeconds);
                                if (!Number.isFinite(sleepSec) || sleepSec < 0) {
                                  return setEditInteractionStepStatus("Wait seconds must be >= 0.");
                                }
                                step.ms = Math.round(sleepSec * 1000);
                              }
                              if (editInteractionStepType === "assertURLContains") {
                                if (!editInteractionStepUrl) return setEditInteractionStepStatus("Expected URL text is required.");
                                step.url = editInteractionStepUrl;
                              }
                              if (editInteractionStepType === "assertTextContains") {
                                if (!editInteractionStepValue) return setEditInteractionStepStatus("Expected text is required.");
                                step.value = editInteractionStepValue;
                                if (editInteractionStepSelector) step.selector = editInteractionStepSelector;
                              }
                              if (editInteractionStepType === "assertVisible") {
                                if (!editInteractionStepSelector) return setEditInteractionStepStatus("Selector required for assertVisible.");
                                step.selector = editInteractionStepSelector;
                              }
                              if (editInteractionStepType === "selectFrame") {
                                if (!editInteractionStepSelector && !editInteractionStepUrl) {
                                  return setEditInteractionStepStatus("Frame selector or URL contains is required.");
                                }
                                if (editInteractionStepSelector) step.selector = editInteractionStepSelector;
                                if (editInteractionStepUrl) step.url = editInteractionStepUrl;
                              }
                              if (editInteractionStepType === "scroll") {
                                step.scrollTo = editInteractionScrollTo || "bottom";
                                const steps = Number(editInteractionScrollSteps);
                                if (!Number.isFinite(steps) || steps < 1) {
                                  return setEditInteractionStepStatus("Scroll steps must be >= 1.");
                                }
                                step.scrollSteps = Math.round(steps);
                                const delaySec = Number(editInteractionScrollDelaySeconds);
                                if (!Number.isFinite(delaySec) || delaySec < 0) {
                                  return setEditInteractionStepStatus("Delay must be >= 0.");
                                }
                                step.scrollDelayMs = Math.round(delaySec * 1000);
                                if (editInteractionScrollTo === "selector") {
                                  if (!editInteractionStepSelector) return setEditInteractionStepStatus("Selector required for scroll.");
                                  step.selector = editInteractionStepSelector;
                                }
                              }
                              setEditInteractionStepStatus("");
                              const next = [...(editJobCfg.interaction?.steps || []), step];
                              setEditJobCfg({
                                ...editJobCfg,
                                interaction: {
                                  ...(editJobCfg.interaction || { enabled: true, steps: [] }),
                                  steps: next
                                }
                              });
                            }}
                          >
                            Add interaction step
                          </Button>
                          {editInteractionStepStatus && <p className="mt-2 text-xs text-muted">{editInteractionStepStatus}</p>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-xs text-muted">Enable interaction to add steps.</div>
                  )}
                </div>
              </Tile>
              <Tile className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-muted">Post-login steps (after login, before capture)</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(editJobCfg.postLoginSteps || []).map((s: any, idx: number) => (
                    <Tile key={`edit-post-${idx}`} style={{ padding: "8px 12px" }}>
                      <div className="text-xs text-muted">Step {idx + 1}</div>
                      <div className="text-sm font-semibold">{s.type}</div>
                      {s.selector && <div className="text-xs">{s.selector}</div>}
                      {s.value && <div className="text-xs">value: {s.value}</div>}
                      {s.key && <div className="text-xs">key: {s.key}</div>}
                      {s.url && <div className="text-xs">url: {s.url}</div>}
                      {s.state && <div className="text-xs">state: {s.state}</div>}
                      {Number.isFinite(s.ms) && <div className="text-xs">sleep: {s.ms}ms</div>}
                      <Button
                        kind="ghost"
                        size="sm"
                        onClick={() => {
                          const next = [...(editJobCfg.postLoginSteps || [])];
                          next.splice(idx, 1);
                          setEditJobCfg({ ...editJobCfg, postLoginSteps: next });
                        }}
                      >
                        Remove
                      </Button>
                    </Tile>
                  ))}
                  {(editJobCfg.postLoginSteps || []).length === 0 && (
                    <div className="text-xs text-muted">No post-login steps.</div>
                  )}
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="text-xs text-muted">Add post-login step</div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Select
                      id="edit-post-step-type"
                      labelText="Step type"
                      value={editPostStepType}
                      onChange={(e) => setEditPostStepType(e.target.value)}
                    >
                      <SelectItem value="click" text="click" />
                      <SelectItem value="fill" text="fill" />
                      <SelectItem value="type" text="type" />
                      <SelectItem value="press" text="press" />
                      <SelectItem value="waitForSelector" text="waitForSelector" />
                      <SelectItem value="waitForURL" text="waitForURL" />
                      <SelectItem value="waitForLoadState" text="waitForLoadState" />
                      <SelectItem value="sleep" text="sleep" />
                      <SelectItem value="selectFrame" text="selectFrame" />
                      <SelectItem value="assertURLContains" text="assertURLContains" />
                      <SelectItem value="assertTextContains" text="assertTextContains" />
                      <SelectItem value="assertVisible" text="assertVisible" />
                    </Select>
                    <TextInput
                      id="edit-post-step-timeout"
                      labelText="Timeout (seconds)"
                      value={editPostStepTimeoutSeconds}
                      onChange={(e) => setEditPostStepTimeoutSeconds(e.target.value)}
                    />
                  </div>
                  {["click", "fill", "waitForSelector", "assertVisible", "selectFrame"].includes(editPostStepType) && (
                    <TextInput
                      id="edit-post-step-selector"
                      labelText={editPostStepType === "selectFrame" ? "Frame selector (optional)" : "Selector"}
                      value={editPostStepSelector}
                      onChange={(e) => setEditPostStepSelector(e.target.value)}
                    />
                  )}
                  {editPostStepType === "fill" && (
                    <TextInput
                      id="edit-post-step-value"
                      labelText="Value"
                      value={editPostStepValue}
                      onChange={(e) => setEditPostStepValue(e.target.value)}
                    />
                  )}
                  {editPostStepType === "type" && (
                    <TextInput
                      id="edit-post-step-type-value"
                      labelText="Text to type"
                      value={editPostStepValue}
                      onChange={(e) => setEditPostStepValue(e.target.value)}
                    />
                  )}
                  {editPostStepType === "assertTextContains" && (
                    <TextInput
                      id="edit-post-step-assert-text"
                      labelText="Expected text"
                      value={editPostStepValue}
                      onChange={(e) => setEditPostStepValue(e.target.value)}
                    />
                  )}
                  {editPostStepType === "press" && (
                    <TextInput
                      id="edit-post-step-key"
                      labelText="Key (Enter, Tab, ArrowDown, etc.)"
                      value={editPostStepKey}
                      onChange={(e) => setEditPostStepKey(e.target.value)}
                    />
                  )}
                  {editPostStepType === "press" && (
                    <div className="text-xs text-muted">{pressKeyHint}</div>
                  )}
                  {["waitForURL", "assertURLContains", "selectFrame"].includes(editPostStepType) && (
                    <TextInput
                      id="edit-post-step-url"
                      labelText={
                        editPostStepType === "selectFrame"
                          ? "Frame URL contains (optional)"
                          : editPostStepType === "assertURLContains"
                            ? "Expected URL contains"
                            : "URL or pattern"
                      }
                      value={editPostStepUrl}
                      onChange={(e) => setEditPostStepUrl(e.target.value)}
                    />
                  )}
                  {editPostStepType === "waitForLoadState" && (
                    <Select
                      id="edit-post-step-state"
                      labelText="Load state"
                      value={editPostStepState}
                      onChange={(e) => setEditPostStepState(e.target.value)}
                    >
                      <SelectItem value="domcontentloaded" text="domcontentloaded" />
                      <SelectItem value="load" text="load" />
                      <SelectItem value="networkidle" text="networkidle" />
                    </Select>
                  )}
                  {editPostStepType === "sleep" && (
                    <TextInput
                      id="edit-post-step-sleep"
                      labelText="Sleep (seconds)"
                      value={editPostStepSleepSeconds}
                      onChange={(e) => setEditPostStepSleepSeconds(e.target.value)}
                    />
                  )}
                  <div className="mt-3">
                    <Button
                      kind="secondary"
                      onClick={() => {
                        const step: any = { type: editPostStepType };
                        const timeoutSec = Number(editPostStepTimeoutSeconds);
                        if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
                          step.timeoutMs = Math.round(timeoutSec * 1000);
                        }
                        if (editPostStepType === "click") {
                          if (!editPostStepSelector) return setEditPostStepStatus("Selector required for click.");
                          step.selector = editPostStepSelector;
                        }
                        if (editPostStepType === "fill") {
                          if (!editPostStepSelector) return setEditPostStepStatus("Selector required for fill.");
                          step.selector = editPostStepSelector;
                          step.value = editPostStepValue;
                        }
                        if (editPostStepType === "type") {
                          step.value = editPostStepValue;
                        }
                        if (editPostStepType === "press") {
                          step.key = editPostStepKey || "Enter";
                        }
                        if (editPostStepType === "waitForSelector") {
                          if (!editPostStepSelector) return setEditPostStepStatus("Selector required for waitForSelector.");
                          step.selector = editPostStepSelector;
                        }
                        if (editPostStepType === "waitForURL") {
                          if (!editPostStepUrl) return setEditPostStepStatus("URL required for waitForURL.");
                          step.url = editPostStepUrl;
                        }
                        if (editPostStepType === "waitForLoadState") {
                          step.state = editPostStepState || "domcontentloaded";
                        }
                        if (editPostStepType === "sleep") {
                          const sleepSec = Number(editPostStepSleepSeconds);
                          if (!Number.isFinite(sleepSec) || sleepSec < 0) {
                            return setEditPostStepStatus("Sleep seconds must be >= 0.");
                          }
                          step.ms = Math.round(sleepSec * 1000);
                        }
                        if (editPostStepType === "assertURLContains") {
                          if (!editPostStepUrl) return setEditPostStepStatus("Expected URL text is required.");
                          step.url = editPostStepUrl;
                        }
                        if (editPostStepType === "assertTextContains") {
                          if (!editPostStepValue) return setEditPostStepStatus("Expected text is required.");
                          step.value = editPostStepValue;
                          if (editPostStepSelector) step.selector = editPostStepSelector;
                        }
                        if (editPostStepType === "assertVisible") {
                          if (!editPostStepSelector) return setEditPostStepStatus("Selector required for assertVisible.");
                          step.selector = editPostStepSelector;
                        }
                        if (editPostStepType === "selectFrame") {
                          if (!editPostStepSelector && !editPostStepUrl) {
                            return setEditPostStepStatus("Frame selector or URL contains is required.");
                          }
                          if (editPostStepSelector) step.selector = editPostStepSelector;
                          if (editPostStepUrl) step.url = editPostStepUrl;
                        }
                        setEditPostStepStatus("");
                        const next = [...(editJobCfg.postLoginSteps || []), step];
                        const hasPostLoginCapture = editCaptures.some(
                          (c) => c.phase === "postLogin" || c.phase === "both"
                        );
                        if (!hasPostLoginCapture) {
                          setEditCaptures([
                            ...editCaptures,
                            { name: "post-login", phase: "postLogin", mode: "page", fullPage: false }
                          ]);
                        }
                        setEditJobCfg({ ...editJobCfg, postLoginSteps: next });
                      }}
                    >
                      Add post-login step
                    </Button>
                    {editPostStepStatus && <p className="mt-2 text-xs text-muted">{editPostStepStatus}</p>}
                  </div>
                </div>
              </Tile>
              <Tile className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-muted">Captures</div>
                <div className="mt-2 space-y-2">
                  {editCaptures.map((cap, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-3">
                      <TextInput
                        id={`edit-cap-name-${idx}`}
                        labelText="Name"
                        value={cap.name}
                        onChange={(e) => {
                          const next = [...editCaptures];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setEditCaptures(next);
                        }}
                      />
                      <Select
                        id={`edit-cap-phase-${idx}`}
                        labelText="Phase"
                        value={cap.phase}
                        onChange={(e) => {
                          const next = [...editCaptures];
                          next[idx] = { ...next[idx], phase: e.target.value };
                          setEditCaptures(next);
                        }}
                      >
                        <SelectItem value="preLogin" text="preLogin" />
                        <SelectItem value="postLogin" text="postLogin" />
                        <SelectItem value="both" text="both" />
                      </Select>
                      <Select
                        id={`edit-cap-mode-${idx}`}
                        labelText="Mode"
                        value={cap.mode}
                        onChange={(e) => {
                          const next = [...editCaptures];
                          next[idx] = { ...next[idx], mode: e.target.value };
                          setEditCaptures(next);
                        }}
                      >
                        <SelectItem value="page" text="page" />
                        <SelectItem value="element" text="element" />
                      </Select>
                      {cap.mode === "element" ? (
                        <TextInput
                          id={`edit-cap-selector-${idx}`}
                          labelText="Selector"
                          value={cap.selector || ""}
                          onChange={(e) => {
                            const next = [...editCaptures];
                            next[idx] = { ...next[idx], selector: e.target.value };
                            setEditCaptures(next);
                          }}
                        />
                      ) : (
                        <div className="text-xs text-muted">Selector not required</div>
                      )}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-cap-fullpage-${idx}`}
                          labelText="Full page"
                          checked={!!cap.fullPage}
                          disabled={cap.mode !== "page"}
                          onChange={(e) => {
                            const next = [...editCaptures];
                            next[idx] = { ...next[idx], fullPage: (e.target as HTMLInputElement).checked };
                            setEditCaptures(next);
                          }}
                        />
                        <Button
                          kind="ghost"
                          size="sm"
                          iconDescription="Remove capture"
                          onClick={() => {
                            const next = [...editCaptures];
                            next.splice(idx, 1);
                            setEditCaptures(next);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    kind="secondary"
                    onClick={() =>
                      setEditCaptures([
                        ...editCaptures,
                        { name: "capture", phase: "postLogin", mode: "page", fullPage: false }
                      ])
                    }
                  >
                    Add capture
                  </Button>
                </div>
              </Tile>
              <Tile className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-muted">Notifications</div>
                <div className="mt-2">
                  <MultiSelect
                    id="edit-notifications-select"
                    titleText="Enable notifications"
                    items={notifications}
                    itemToString={(item) =>
                      item ? `${item.name || item.id} (${item.config?.endpoint || "HTTP"})` : ""
                    }
                    selectedItems={notifications.filter((n) =>
                      (editJobCfg.notifications?.ids || []).includes(n.id)
                    )}
                    onChange={(e: any) => {
                      const ids = (e.selectedItems || []).map((n: any) => n.id);
                      setEditJobCfg({
                        ...editJobCfg,
                        notifications: {
                          enabled: ids.length > 0,
                          ids
                        }
                      });
                    }}
                    label="Select notifications"
                  />
                </div>
                {notifications.length === 0 && <div className="mt-2 text-xs text-muted">No notifications yet.</div>}
              </Tile>
              <Checkbox
                id="edit-schedule-enabled"
                labelText="Enable schedule"
                checked={editScheduleEnabled}
                onChange={(e) => setEditScheduleEnabled((e.target as HTMLInputElement).checked)}
              />
              <TextInput id="edit-times" labelText="Times (HH:MM)" value={editScheduleTimes} onChange={(e) => setEditScheduleTimes(e.target.value)} />
              <TextInput id="edit-tz" labelText="Timezone" value={editScheduleTz} onChange={(e) => setEditScheduleTz(e.target.value)} />
              <Select id="edit-mode" labelText="Mode" value={editScheduleMode} onChange={(e) => setEditScheduleMode(e.target.value)}>
                <SelectItem value="daily" text="Daily" />
                <SelectItem value="limited" text="Limited" />
              </Select>
              <TextInput id="edit-runs" labelText="Runs" type="number" value={String(editScheduleRuns)} onChange={(e) => setEditScheduleRuns(Number(e.target.value || 1))} />
              <div className="text-xs text-muted">
                Limited runs will execute only a set number of times, then auto-disable the schedule.
              </div>
              {editStatus && <p className="text-xs text-muted">{editStatus}</p>}
              </Stack>
            </Form>
          )}
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeEdit}>Cancel</Button>
          <Button kind="primary" onClick={saveEdit}>Save</Button>
        </ModalFooter>
      </ComposedModal>

      <Modal
        open={confirmDeleteOpen}
        onRequestClose={() => setConfirmDeleteOpen(false)}
        danger
        modalHeading="Delete job?"
        modalLabel="Jobs"
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        onRequestSubmit={() => {
          if (!confirmDeleteJob) return;
          const id = confirmDeleteJob.id;
          setConfirmDeleteOpen(false);
          setConfirmDeleteJob(null);
          deleteJob(id);
        }}
      >
        <p>
          This will delete the job and all related runs and artifacts.
        </p>
      </Modal>
    </div>
  );
}
