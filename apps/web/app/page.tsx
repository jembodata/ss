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
  MultiSelect,
  Pagination,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
  Tile,
  TextInput
} from "@carbon/react";

type KeyValue = { key: string; value: string };
type Capture = {
  name: string;
  phase: string;
  mode: string;
  fullPage?: boolean;
  selector?: string;
};

const defaultProfile = {
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 768 },
  userAgent: "",
  locale: "en-US",
  timezoneId: "Asia/Jakarta",
  blockResources: false,
  extraHeaders: {} as Record<string, string>
};

const defaultJob = {
  startUrl: "https://example.com",
  navigationTimeoutMs: 45000,
  captureDelayMs: 10000,
  login: { enabled: false, steps: [] as any[] },
  interaction: { enabled: false, steps: [] as any[], captureMode: "afterInteraction", bypassLazyLoad: false },
  postLoginSteps: [] as any[],
  captures: [{ name: "full-page", phase: "preLogin", mode: "page", fullPage: true }] as Capture[],
  upload: {
    enabled: false,
    endpoint: "",
    method: "POST",
    headers: {} as Record<string, string>,
    multipart: { fileField: "file", extraFields: {} as Record<string, string> },
    timeoutMs: 20000,
    retry: { max: 0, backoffMs: 1000 }
  },
  notifications: { enabled: false, ids: [] as string[] }
};

const viewportPresets: Record<string, { width: number; height: number }> = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1440, height: 900 },
  desktop: { width: 1920, height: 1080 }
};

const userAgentPresets: Record<string, string> = {
  default: "",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
};
const pressKeyHint = "Keys: Enter, Tab, Escape, ArrowUp/Down/Left/Right, Backspace, Delete, Home, End, PageUp, PageDown";

function parseTimes(raw: string) {
  const input = raw.trim();
  if (!input) return { error: "Schedule enabled but time is empty.", crons: [] as string[] };
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  const crons: string[] = [];
  for (const part of parts) {
    const match = part.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) return { error: `Invalid time: ${part}. Use HH:MM (24h).`, crons: [] };
    crons.push(`${match[2]} ${match[1].padStart(2, "0")} * * *`);
  }
  return { error: null, crons };
}

function formatRelative(ms: number) {
  if (!Number.isFinite(ms)) return "";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}

function cronToTime(cron: string) {
  const match = String(cron || "").trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (!match) return cron || "-";
  return `${match[2].padStart(2, "0")}:${match[1].padStart(2, "0")}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} - ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function Page() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileName, setProfileName] = useState("Profile");
  const [profileCfg, setProfileCfg] = useState(defaultProfile);
  const [profileHeaders, setProfileHeaders] = useState<KeyValue[]>([]);
  const [profileStatus, setProfileStatus] = useState("");
  const [viewportPreset, setViewportPreset] = useState("custom");
  const [customViewport, setCustomViewport] = useState({
    width: defaultProfile.viewport.width,
    height: defaultProfile.viewport.height
  });
  const [userAgentPreset, setUserAgentPreset] = useState("default");
  const [customUserAgent, setCustomUserAgent] = useState("");

  const [jobName, setJobName] = useState("Job");
  const [profileId, setProfileId] = useState("");
  const [jobCfg, setJobCfg] = useState(defaultJob);
  const [jobStatus, setJobStatus] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("Asia/Jakarta");
  const [scheduleMode, setScheduleMode] = useState<"daily" | "limited">("daily");
  const [scheduleRuns, setScheduleRuns] = useState(1);
  const [runningSchedules, setRunningSchedules] = useState<any[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(5);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobStep, setJobStep] = useState(0);
  const [loginUserSelector, setLoginUserSelector] = useState("#username");
  const [loginUserValue, setLoginUserValue] = useState("");
  const [loginPassSelector, setLoginPassSelector] = useState("#password");
  const [loginPassValue, setLoginPassValue] = useState("");
  const [loginTabAfterUser, setLoginTabAfterUser] = useState(true);
  const [loginTabAfterPass, setLoginTabAfterPass] = useState(true);
  const [loginSubmitType, setLoginSubmitType] = useState("press");
  const [loginSubmitKey, setLoginSubmitKey] = useState("Enter");
  const [loginSubmitSelector, setLoginSubmitSelector] = useState("");
  const [loginFlowReplace, setLoginFlowReplace] = useState(true);
  const [loginFlowStatus, setLoginFlowStatus] = useState("");
  const [loginStepType, setLoginStepType] = useState("fill");
  const [loginStepSelector, setLoginStepSelector] = useState("");
  const [loginStepValue, setLoginStepValue] = useState("");
  const [loginStepKey, setLoginStepKey] = useState("Enter");
  const [loginStepUrl, setLoginStepUrl] = useState("");
  const [loginStepState, setLoginStepState] = useState("domcontentloaded");
  const [loginStepSleepSeconds, setLoginStepSleepSeconds] = useState("1");
  const [loginStepTimeoutSeconds, setLoginStepTimeoutSeconds] = useState("30");
  const [loginStepStatus, setLoginStepStatus] = useState("");
  const [interactionStepType, setInteractionStepType] = useState("click");
  const [interactionStepSelector, setInteractionStepSelector] = useState("");
  const [interactionStepValue, setInteractionStepValue] = useState("");
  const [interactionStepKey, setInteractionStepKey] = useState("Enter");
  const [interactionStepUrl, setInteractionStepUrl] = useState("");
  const [interactionStepState, setInteractionStepState] = useState("domcontentloaded");
  const [interactionStepSleepSeconds, setInteractionStepSleepSeconds] = useState("1");
  const [interactionStepTimeoutSeconds, setInteractionStepTimeoutSeconds] = useState("30");
  const [interactionScrollTo, setInteractionScrollTo] = useState("bottom");
  const [interactionScrollSteps, setInteractionScrollSteps] = useState("6");
  const [interactionScrollDelaySeconds, setInteractionScrollDelaySeconds] = useState("0.25");
  const [interactionStepStatus, setInteractionStepStatus] = useState("");
  const [postStepType, setPostStepType] = useState("click");
  const [postStepSelector, setPostStepSelector] = useState("");
  const [postStepValue, setPostStepValue] = useState("");
  const [postStepKey, setPostStepKey] = useState("Enter");
  const [postStepUrl, setPostStepUrl] = useState("");
  const [postStepState, setPostStepState] = useState("domcontentloaded");
  const [postStepSleepSeconds, setPostStepSleepSeconds] = useState("1");
  const [postStepTimeoutSeconds, setPostStepTimeoutSeconds] = useState("30");
  const [postStepStatus, setPostStepStatus] = useState("");
  const [captures, setCaptures] = useState<Capture[]>(jobCfg.captures as Capture[]);
  const { push } = useToast();

  useEffect(() => {
    api.profiles.list().then(setProfiles).catch(() => {});
    api.notifications.list().then(setNotifications).catch(() => {});
    loadRunningSchedules();
  }, []);

  useEffect(() => {
    setProfileCfg((prev) => ({
      ...prev,
      extraHeaders: profileHeaders.reduce((acc, cur) => {
        if (cur.key) acc[cur.key] = cur.value;
        return acc;
      }, {} as Record<string, string>)
    }));
  }, [profileHeaders]);

  async function loadRunningSchedules() {
    try {
      const res = await api.schedules.running();
      setRunningSchedules(res.items || []);
      setScheduleStatus("");
    } catch (err: any) {
      setScheduleStatus(err.message || "Failed to load schedules.");
      push("error", "Schedules failed", err.message || "Failed to load schedules.");
    }
  }

  async function createProfile() {
    setProfileStatus("Creating profile...");
    try {
      const res = await api.profiles.create({ name: profileName, config: profileCfg });
      setProfileStatus(`Created ${res.id}`);
      setProfileId(res.id);
      const list = await api.profiles.list();
      setProfiles(list);
      push("success", "Profile created", `ID ${res.id}`);
    } catch (err: any) {
      setProfileStatus(err.message || "Failed to create profile.");
      push("error", "Profile failed", err.message || "Failed to create profile.");
    }
  }

  async function createJob() {
    if (!profileId) {
      setJobStatus("profileId required.");
      return;
    }
    if (scheduleEnabled) {
      const parsed = parseTimes(scheduleTimes);
      if (parsed.error) {
        setJobStatus(parsed.error);
        return;
      }
      if (scheduleMode === "limited" && scheduleRuns < 1) {
        setJobStatus("Run count must be >= 1.");
        return;
      }
    }
    setJobStatus("Creating job...");
    try {
      const res = await api.jobs.create({ name: jobName, profileId, config: { ...jobCfg, captures } });
      if (scheduleEnabled) {
        const parsed = parseTimes(scheduleTimes);
        await api.schedules.create(res.id, {
          crons: parsed.crons,
          timezone: scheduleTimezone || "Asia/Jakarta",
          mode: scheduleMode,
          remainingRuns: scheduleMode === "limited" ? scheduleRuns : null
        });
      }
      setJobStatus(`Created ${res.id}`);
      push("success", "Job created", `ID ${res.id}`);
    } catch (err: any) {
      setJobStatus(err.message || "Failed to create job.");
      push("error", "Job failed", err.message || "Failed to create job.");
    }
  }

  const jobConfig = useMemo(() => ({ ...jobCfg, captures }), [jobCfg, captures]);
  const jobSteps = ["Basics", "Interaction", "Captures & Schedule"];
  const scheduleItems = runningSchedules.slice(
    (schedulePage - 1) * schedulePageSize,
    schedulePage * schedulePageSize
  );

  return (
    <div className="space-y-6">
      <AppHeader />

      <div className="grid gap-6 md:grid-cols-2">
        <Tile>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Create Profile</h2>
            <Tag type="blue">Browser</Tag>
          </div>
          <p className="text-sm text-muted">Choose browser type and device</p>
          <div className="mt-4">
            <Button kind="primary" onClick={() => setShowProfileModal(true)}>Create Browser Profile</Button>
            <p className="mt-2 text-xs text-muted">{profileStatus}</p>
          </div>
        </Tile>
        <Tile>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Create Job</h2>
            <Tag type="purple">Wizard</Tag>
          </div>
          <p className="text-sm text-muted">Make Job to take screenshots</p>
          <div className="mt-4">
            <Button kind="primary" onClick={() => { setJobStep(0); setShowJobModal(true); }}>Create Jobs</Button>
            <p className="mt-2 text-xs text-muted">{jobStatus}</p>
          </div>
        </Tile>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Schedules Running</h2>
            <p className="text-sm text-muted">Upcoming runs from enabled schedules</p>
          </div>
          <Button kind="ghost" size="sm" onClick={loadRunningSchedules}>Refresh</Button>
        </div>
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Job</TableHeader>
              <TableHeader>Cron</TableHeader>
              <TableHeader>Next run (expected)</TableHeader>
              <TableHeader>Done today</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Mode</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {scheduleItems.map((item) => {
              const nextIso = item.nextExpectedIso ? formatDateTime(item.nextExpectedIso) : "-";
              const nextMillis = item.nextExpectedIso ? new Date(item.nextExpectedIso).getTime() - Date.now() : null;
              const nextIn = typeof nextMillis === "number" ? formatRelative(nextMillis) : "";
              const statusLabel = item.enabled === 1 ? "Active" : "Paused";
                  return (
                <TableRow key={item.key}>
                  <TableCell>{item.jobName || item.jobId || "-"}</TableCell>
                  <TableCell>{cronToTime(item.cron)}</TableCell>
                  <TableCell>{nextIso}{nextIn ? ` (in ${nextIn})` : ""}</TableCell>
                  <TableCell>{Number.isFinite(item.doneToday) ? item.doneToday : 0}</TableCell>
                  <TableCell>
                    <Tag type={item.enabled === 1 ? "green" : "red"}>{statusLabel}</Tag>
                  </TableCell>
                  <TableCell>{item.mode || "-"}</TableCell>
                </TableRow>
              );
            })}
            {!scheduleItems.length && (
              <TableRow>
                <TableCell colSpan={6}>{scheduleStatus || "No schedules running."}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination
          page={schedulePage}
          pageSize={schedulePageSize}
          pageSizes={[5, 10, 20]}
          totalItems={runningSchedules.length}
          onChange={({ page, pageSize }) => {
            setSchedulePage(page);
            setSchedulePageSize(pageSize);
          }}
        />
      </div>

      <ComposedModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        size="md"
        preventCloseOnClickOutside
        className="modal-fixed"
      >
        <ModalHeader label="Profile" title="New Profile" />
        <ModalBody>
          <Form aria-label="Profile form">
            <Stack gap={6}>
              <TextInput id="profile-name" labelText="Profile name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              <Select
                id="profile-viewport-preset"
                labelText="Viewport preset"
                value={viewportPreset}
                onChange={(e) => {
                  const preset = e.target.value;
                  setViewportPreset(preset);
                  if (preset !== "custom" && viewportPresets[preset]) {
                    const next = viewportPresets[preset];
                    setProfileCfg({ ...profileCfg, viewport: next });
                  }
                }}
              >
                <SelectItem value="custom" text="Custom" />
                <SelectItem value="mobile" text="Mobile" />
                <SelectItem value="tablet" text="Tablet" />
                <SelectItem value="laptop" text="Laptop Large" />
                <SelectItem value="desktop" text="Desktop" />
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  id="profile-vw"
                  labelText="Viewport width"
                  type="number"
                  value={String(viewportPreset === "custom" ? customViewport.width : profileCfg.viewport.width)}
                  disabled={viewportPreset !== "custom"}
                  onChange={(e) => {
                    const width = Number(e.target.value);
                    const next = { ...customViewport, width };
                    setCustomViewport(next);
                    setProfileCfg({ ...profileCfg, viewport: next });
                  }}
                />
                <TextInput
                  id="profile-vh"
                  labelText="Viewport height"
                  type="number"
                  value={String(viewportPreset === "custom" ? customViewport.height : profileCfg.viewport.height)}
                  disabled={viewportPreset !== "custom"}
                  onChange={(e) => {
                    const height = Number(e.target.value);
                    const next = { ...customViewport, height };
                    setCustomViewport(next);
                    setProfileCfg({ ...profileCfg, viewport: next });
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput id="profile-locale" labelText="Locale" value={profileCfg.locale} onChange={(e) => setProfileCfg({ ...profileCfg, locale: e.target.value })} />
                <TextInput id="profile-tz" labelText="Timezone" value={profileCfg.timezoneId} onChange={(e) => setProfileCfg({ ...profileCfg, timezoneId: e.target.value })} />
              </div>
              <Select
                id="profile-ua-preset"
                labelText="User agent"
                value={userAgentPreset}
                onChange={(e) => {
                  const preset = e.target.value;
                  setUserAgentPreset(preset);
                  if (preset !== "custom") {
                    setProfileCfg({ ...profileCfg, userAgent: userAgentPresets[preset] || "" });
                  } else {
                    setProfileCfg({ ...profileCfg, userAgent: customUserAgent });
                  }
                }}
              >
                <SelectItem value="default" text="Default (Playwright)" />
                <SelectItem value="chromeWindows" text="Chrome Windows" />
                <SelectItem value="chromeAndroid" text="Chrome Android" />
                <SelectItem value="safariIphone" text="Safari iPhone" />
                <SelectItem value="safariIpad" text="Safari iPad" />
                <SelectItem value="edgeWindows" text="Edge Windows" />
                <SelectItem value="custom" text="Custom" />
              </Select>
              {userAgentPreset === "custom" && (
                <TextInput
                  id="profile-ua"
                  labelText="Custom user agent"
                  value={customUserAgent}
                  onChange={(e) => {
                    setCustomUserAgent(e.target.value);
                    setProfileCfg({ ...profileCfg, userAgent: e.target.value });
                  }}
                />
              )}
              <Checkbox
                id="profile-ignore"
                labelText="Ignore HTTPS errors"
                checked={profileCfg.ignoreHTTPSErrors}
                onChange={(e) => setProfileCfg({ ...profileCfg, ignoreHTTPSErrors: (e.target as HTMLInputElement).checked })}
              />
              <Checkbox
                id="profile-block"
                labelText="Block images/fonts/media"
                checked={profileCfg.blockResources}
                onChange={(e) => setProfileCfg({ ...profileCfg, blockResources: (e.target as HTMLInputElement).checked })}
              />
              <div className="grid gap-2">
                <div className="text-xs text-muted">Extra headers</div>
                {profileHeaders.map((h, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-3">
                    <TextInput
                      id={`profile-header-key-${idx}`}
                      labelText="Header key"
                      value={h.key}
                      onChange={(e) => {
                        const next = [...profileHeaders];
                        next[idx] = { ...next[idx], key: e.target.value };
                        setProfileHeaders(next);
                      }}
                    />
                    <TextInput
                      id={`profile-header-val-${idx}`}
                      labelText="Header value"
                      value={h.value}
                      onChange={(e) => {
                        const next = [...profileHeaders];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setProfileHeaders(next);
                      }}
                    />
                  </div>
                ))}
                <Button kind="secondary" onClick={() => setProfileHeaders([...profileHeaders, { key: "", value: "" }])}>
                  Add header
                </Button>
              </div>
            </Stack>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setShowProfileModal(false)}>Cancel</Button>
          <Button kind="primary" onClick={() => { createProfile(); setShowProfileModal(false); }}>Create profile</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal
        open={showJobModal}
        onClose={() => setShowJobModal(false)}
        size="lg"
        preventCloseOnClickOutside
        className="modal-fixed"
      >
        <ModalHeader label="Wizard" title="Job Wizard" />
        <ModalBody>
          <Form aria-label="Job wizard form">
            <Stack gap={6}>
              <div className="flex flex-wrap items-center gap-2">
                {jobSteps.map((label, idx) => (
                  <Tag key={label} type={idx === jobStep ? "blue" : "cool-gray"}>
                    {idx + 1}. {label}
                  </Tag>
                ))}
              </div>

              {jobStep === 0 && (
                <Stack gap={5}>
                  <TextInput id="job-name" labelText="Job name" value={jobName} onChange={(e) => setJobName(e.target.value)} />
                  <Select id="job-profile" labelText="Profile ID" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                    <SelectItem value="" text="Select profile" />
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id} text={`${p.name} (${p.id})`} />
                    ))}
                  </Select>
                  <TextInput id="job-url" labelText="Start URL" value={jobCfg.startUrl} onChange={(e) => setJobCfg({ ...jobCfg, startUrl: e.target.value })} />
                  <div className="grid grid-cols-2 gap-4">
                    <TextInput
                      id="job-timeout"
                      labelText="Load timeout (seconds)"
                      type="number"
                      value={String(Math.round(jobCfg.navigationTimeoutMs / 1000))}
                      onChange={(e) => setJobCfg({ ...jobCfg, navigationTimeoutMs: Number(e.target.value) * 1000 })}
                    />
                    <TextInput
                      id="job-delay"
                      labelText="Capture delay (seconds)"
                      type="number"
                      value={String(Math.round(jobCfg.captureDelayMs / 1000))}
                      onChange={(e) => setJobCfg({ ...jobCfg, captureDelayMs: Number(e.target.value) * 1000 })}
                    />
                  </div>
                </Stack>
              )}

              {jobStep === 1 && (
                <Tile className="rounded-lg border border-slate-200 p-4">
                  <Checkbox
                    id="job-login-enabled"
                    labelText="Enable login"
                    checked={jobCfg.login.enabled}
                    onChange={(e) =>
                      setJobCfg({ ...jobCfg, login: { ...jobCfg.login, enabled: (e.target as HTMLInputElement).checked } })
                    }
                  />
                  {jobCfg.login.enabled ? (
                    <>
                      <div className="mt-3 text-xs text-muted">Login flow builder</div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <TextInput
                          id="login-user-selector"
                          labelText="Username selector (CSS)"
                          value={loginUserSelector}
                          onChange={(e) => setLoginUserSelector(e.target.value)}
                        />
                        <TextInput
                          id="login-user-value"
                          labelText="Username value"
                          value={loginUserValue}
                          onChange={(e) => setLoginUserValue(e.target.value)}
                        />
                        <TextInput
                          id="login-pass-selector"
                          labelText="Password selector (CSS)"
                          value={loginPassSelector}
                          onChange={(e) => setLoginPassSelector(e.target.value)}
                        />
                        <TextInput
                          id="login-pass-value"
                          labelText="Password value"
                          value={loginPassValue}
                          onChange={(e) => setLoginPassValue(e.target.value)}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Checkbox
                          id="login-tab-user"
                          labelText="Press Tab after username"
                          checked={loginTabAfterUser}
                          onChange={(e) => setLoginTabAfterUser((e.target as HTMLInputElement).checked)}
                        />
                        <Checkbox
                          id="login-tab-pass"
                          labelText="Press Tab after password"
                          checked={loginTabAfterPass}
                          onChange={(e) => setLoginTabAfterPass((e.target as HTMLInputElement).checked)}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Select
                          id="login-submit-type"
                          labelText="Submit action"
                          value={loginSubmitType}
                          onChange={(e) => setLoginSubmitType(e.target.value)}
                        >
                          <SelectItem value="press" text="press key" />
                          <SelectItem value="click" text="click selector" />
                          <SelectItem value="none" text="no submit" />
                        </Select>
                        {loginSubmitType === "press" ? (
                          <TextInput
                            id="login-submit-key"
                            labelText="Key (Enter, Tab, etc.)"
                            value={loginSubmitKey}
                            onChange={(e) => setLoginSubmitKey(e.target.value)}
                          />
                        ) : loginSubmitType === "click" ? (
                          <TextInput
                            id="login-submit-selector"
                            labelText="Submit button selector"
                            value={loginSubmitSelector}
                            onChange={(e) => setLoginSubmitSelector(e.target.value)}
                          />
                        ) : (
                          <div />
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Checkbox
                          id="login-flow-replace"
                          labelText="Replace existing steps"
                          checked={loginFlowReplace}
                          onChange={(e) => setLoginFlowReplace((e.target as HTMLInputElement).checked)}
                        />
                        <div />
                      </div>
                      <div className="mt-3">
                        <Button
                          kind="secondary"
                          onClick={() => {
                            if (!loginUserSelector || !loginPassSelector) {
                              setLoginFlowStatus("Username and password selectors are required.");
                              return;
                            }
                            if (loginSubmitType === "click" && !loginSubmitSelector) {
                              setLoginFlowStatus("Submit selector required for click.");
                              return;
                            }
                            const steps: any[] = [
                              { type: "fill", selector: loginUserSelector, value: loginUserValue },
                              ...(loginTabAfterUser ? [{ type: "press", key: "Tab" }] : []),
                              { type: "fill", selector: loginPassSelector, value: loginPassValue },
                              ...(loginTabAfterPass ? [{ type: "press", key: "Tab" }] : [])
                            ];
                            if (loginSubmitType === "press") {
                              steps.push({ type: "press", key: loginSubmitKey || "Enter" });
                            }
                            if (loginSubmitType === "click") {
                              steps.push({ type: "click", selector: loginSubmitSelector });
                            }
                            setLoginFlowStatus("");
                            const nextSteps = loginFlowReplace ? steps : [...jobCfg.login.steps, ...steps];
                            setJobCfg({ ...jobCfg, login: { enabled: true, steps: nextSteps } });
                          }}
                        >
                          Build login flow
                        </Button>
                        {loginFlowStatus && <p className="mt-2 text-xs text-muted">{loginFlowStatus}</p>}
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="text-xs text-muted">Flow preview</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {jobCfg.login.steps.map((s, idx) => (
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
                                  const next = [...jobCfg.login.steps];
                                  next.splice(idx, 1);
                                  setJobCfg({ ...jobCfg, login: { ...jobCfg.login, steps: next } });
                                }}
                              >
                                Remove
                              </Button>
                            </Tile>
                          ))}
                          {jobCfg.login.steps.length === 0 && (
                            <div className="text-xs text-muted">No steps yet.</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="text-xs text-muted">Add custom step (optional)</div>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <Select id="login-step-type" labelText="Step type" value={loginStepType} onChange={(e) => setLoginStepType(e.target.value)}>
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
                            id="login-step-timeout"
                            labelText="Timeout (seconds)"
                            value={loginStepTimeoutSeconds}
                            onChange={(e) => setLoginStepTimeoutSeconds(e.target.value)}
                          />
                        </div>
                        {['click', 'fill', 'waitForSelector', 'assertVisible', 'selectFrame'].includes(loginStepType) && (
                          <TextInput
                            id="login-step-selector"
                            labelText={loginStepType === "selectFrame" ? "Frame selector (optional)" : "Selector"}
                            value={loginStepSelector}
                            onChange={(e) => setLoginStepSelector(e.target.value)}
                          />
                        )}
                        {loginStepType === "fill" && (
                          <TextInput
                            id="login-step-value"
                            labelText="Value"
                            value={loginStepValue}
                            onChange={(e) => setLoginStepValue(e.target.value)}
                          />
                        )}
                        {loginStepType === "type" && (
                          <TextInput
                            id="login-step-type-value"
                            labelText="Text to type"
                            value={loginStepValue}
                            onChange={(e) => setLoginStepValue(e.target.value)}
                          />
                        )}
                        {loginStepType === "assertTextContains" && (
                          <TextInput
                            id="login-step-assert-text"
                            labelText="Expected text"
                            value={loginStepValue}
                            onChange={(e) => setLoginStepValue(e.target.value)}
                          />
                        )}
                      {loginStepType === "press" && (
                        <TextInput
                          id="login-step-key"
                          labelText="Key (Enter, Tab, ArrowDown, etc.)"
                          value={loginStepKey}
                          onChange={(e) => setLoginStepKey(e.target.value)}
                        />
                      )}
                      {loginStepType === "press" && (
                        <div className="text-xs text-muted">{pressKeyHint}</div>
                      )}
                        {["waitForURL", "assertURLContains", "selectFrame"].includes(loginStepType) && (
                          <TextInput
                            id="login-step-url"
                            labelText={
                              loginStepType === "selectFrame"
                                ? "Frame URL contains (optional)"
                                : loginStepType === "assertURLContains"
                                  ? "Expected URL contains"
                                  : "URL or pattern"
                            }
                            value={loginStepUrl}
                            onChange={(e) => setLoginStepUrl(e.target.value)}
                          />
                        )}
                        {loginStepType === "waitForLoadState" && (
                          <Select
                            id="login-step-state"
                            labelText="Load state"
                            value={loginStepState}
                            onChange={(e) => setLoginStepState(e.target.value)}
                          >
                            <SelectItem value="domcontentloaded" text="domcontentloaded" />
                            <SelectItem value="load" text="load" />
                            <SelectItem value="networkidle" text="networkidle" />
                          </Select>
                        )}
                        {loginStepType === "sleep" && (
                          <TextInput
                            id="login-step-sleep"
                            labelText="Sleep (seconds)"
                            value={loginStepSleepSeconds}
                            onChange={(e) => setLoginStepSleepSeconds(e.target.value)}
                          />
                        )}
                        <div className="mt-3">
                          <Button
                            kind="secondary"
                            onClick={() => {
                              const step: any = { type: loginStepType };
                              const timeoutSec = Number(loginStepTimeoutSeconds);
                              if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
                                step.timeoutMs = Math.round(timeoutSec * 1000);
                              }
                              if (loginStepType === "click") {
                                if (!loginStepSelector) return setLoginStepStatus("Selector required for click.");
                                step.selector = loginStepSelector;
                              }
                              if (loginStepType === "fill") {
                                if (!loginStepSelector) return setLoginStepStatus("Selector required for fill.");
                                step.selector = loginStepSelector;
                                step.value = loginStepValue;
                              }
                              if (loginStepType === "type") {
                                step.value = loginStepValue;
                              }
                              if (loginStepType === "press") {
                                step.key = loginStepKey || "Enter";
                              }
                              if (loginStepType === "waitForSelector") {
                                if (!loginStepSelector) return setLoginStepStatus("Selector required for waitForSelector.");
                                step.selector = loginStepSelector;
                              }
                              if (loginStepType === "waitForURL") {
                                if (!loginStepUrl) return setLoginStepStatus("URL required for waitForURL.");
                                step.url = loginStepUrl;
                              }
                              if (loginStepType === "waitForLoadState") {
                                step.state = loginStepState || "domcontentloaded";
                              }
                              if (loginStepType === "sleep") {
                                const sleepSec = Number(loginStepSleepSeconds);
                                if (!Number.isFinite(sleepSec) || sleepSec < 0) {
                                  return setLoginStepStatus("Sleep seconds must be >= 0.");
                                }
                                step.ms = Math.round(sleepSec * 1000);
                              }
                              if (loginStepType === "assertURLContains") {
                                if (!loginStepUrl) return setLoginStepStatus("Expected URL text is required.");
                                step.url = loginStepUrl;
                              }
                              if (loginStepType === "assertTextContains") {
                                if (!loginStepValue) return setLoginStepStatus("Expected text is required.");
                                step.value = loginStepValue;
                                if (loginStepSelector) step.selector = loginStepSelector;
                              }
                              if (loginStepType === "assertVisible") {
                                if (!loginStepSelector) return setLoginStepStatus("Selector required for assertVisible.");
                                step.selector = loginStepSelector;
                              }
                              if (loginStepType === "selectFrame") {
                                if (!loginStepSelector && !loginStepUrl) {
                                  return setLoginStepStatus("Frame selector or URL contains is required.");
                                }
                                if (loginStepSelector) step.selector = loginStepSelector;
                                if (loginStepUrl) step.url = loginStepUrl;
                              }
                              setLoginStepStatus("");
                              setJobCfg({ ...jobCfg, login: { enabled: true, steps: [...jobCfg.login.steps, step] } });
                            }}
                          >
                            Add custom step
                          </Button>
                          {loginStepStatus && <p className="mt-2 text-xs text-muted">{loginStepStatus}</p>}
                        </div>
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="text-xs text-muted">Post-login steps (after login, before capture)</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {jobCfg.postLoginSteps?.map((s: any, idx: number) => (
                            <Tile key={`post-${idx}`} style={{ padding: "8px 12px" }}>
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
                                  const next = [...(jobCfg.postLoginSteps || [])];
                                  next.splice(idx, 1);
                                  setJobCfg({ ...jobCfg, postLoginSteps: next });
                                }}
                              >
                                Remove
                              </Button>
                            </Tile>
                          ))}
                          {(!jobCfg.postLoginSteps || jobCfg.postLoginSteps.length === 0) && (
                            <div className="text-xs text-muted">No post-login steps.</div>
                          )}
                        </div>
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <div className="text-xs text-muted">Add post-login step</div>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <Select id="post-step-type" labelText="Step type" value={postStepType} onChange={(e) => setPostStepType(e.target.value)}>
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
                              id="post-step-timeout"
                              labelText="Timeout (seconds)"
                              value={postStepTimeoutSeconds}
                              onChange={(e) => setPostStepTimeoutSeconds(e.target.value)}
                            />
                          </div>
                          {["click", "fill", "waitForSelector", "assertVisible", "selectFrame"].includes(postStepType) && (
                            <TextInput
                              id="post-step-selector"
                              labelText={postStepType === "selectFrame" ? "Frame selector (optional)" : "Selector"}
                              value={postStepSelector}
                              onChange={(e) => setPostStepSelector(e.target.value)}
                            />
                          )}
                          {postStepType === "fill" && (
                            <TextInput
                              id="post-step-value"
                              labelText="Value"
                              value={postStepValue}
                              onChange={(e) => setPostStepValue(e.target.value)}
                            />
                          )}
                          {postStepType === "type" && (
                            <TextInput
                              id="post-step-type-value"
                              labelText="Text to type"
                              value={postStepValue}
                              onChange={(e) => setPostStepValue(e.target.value)}
                            />
                          )}
                          {postStepType === "assertTextContains" && (
                            <TextInput
                              id="post-step-assert-text"
                              labelText="Expected text"
                              value={postStepValue}
                              onChange={(e) => setPostStepValue(e.target.value)}
                            />
                          )}
                          {postStepType === "press" && (
                            <TextInput
                              id="post-step-key"
                              labelText="Key (Enter, Tab, ArrowDown, etc.)"
                              value={postStepKey}
                              onChange={(e) => setPostStepKey(e.target.value)}
                            />
                          )}
                          {postStepType === "press" && (
                            <div className="text-xs text-muted">{pressKeyHint}</div>
                          )}
                          {["waitForURL", "assertURLContains", "selectFrame"].includes(postStepType) && (
                            <TextInput
                              id="post-step-url"
                              labelText={
                                postStepType === "selectFrame"
                                  ? "Frame URL contains (optional)"
                                  : postStepType === "assertURLContains"
                                    ? "Expected URL contains"
                                    : "URL or pattern"
                              }
                              value={postStepUrl}
                              onChange={(e) => setPostStepUrl(e.target.value)}
                            />
                          )}
                          {postStepType === "waitForLoadState" && (
                            <Select
                              id="post-step-state"
                              labelText="Load state"
                              value={postStepState}
                              onChange={(e) => setPostStepState(e.target.value)}
                            >
                              <SelectItem value="domcontentloaded" text="domcontentloaded" />
                              <SelectItem value="load" text="load" />
                              <SelectItem value="networkidle" text="networkidle" />
                            </Select>
                          )}
                          {postStepType === "sleep" && (
                            <TextInput
                              id="post-step-sleep"
                              labelText="Sleep (seconds)"
                              value={postStepSleepSeconds}
                              onChange={(e) => setPostStepSleepSeconds(e.target.value)}
                            />
                          )}
                          <div className="mt-3">
                            <Button
                              kind="secondary"
                              onClick={() => {
                                const step: any = { type: postStepType };
                                const timeoutSec = Number(postStepTimeoutSeconds);
                                if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
                                  step.timeoutMs = Math.round(timeoutSec * 1000);
                                }
                                if (postStepType === "click") {
                                  if (!postStepSelector) return setPostStepStatus("Selector required for click.");
                                  step.selector = postStepSelector;
                                }
                                if (postStepType === "fill") {
                                  if (!postStepSelector) return setPostStepStatus("Selector required for fill.");
                                  step.selector = postStepSelector;
                                  step.value = postStepValue;
                                }
                                if (postStepType === "type") {
                                  step.value = postStepValue;
                                }
                                if (postStepType === "press") {
                                  step.key = postStepKey || "Enter";
                                }
                                if (postStepType === "waitForSelector") {
                                  if (!postStepSelector) return setPostStepStatus("Selector required for waitForSelector.");
                                  step.selector = postStepSelector;
                                }
                                if (postStepType === "waitForURL") {
                                  if (!postStepUrl) return setPostStepStatus("URL required for waitForURL.");
                                  step.url = postStepUrl;
                                }
                                if (postStepType === "waitForLoadState") {
                                  step.state = postStepState || "domcontentloaded";
                                }
                                if (postStepType === "sleep") {
                                  const sleepSec = Number(postStepSleepSeconds);
                                  if (!Number.isFinite(sleepSec) || sleepSec < 0) {
                                    return setPostStepStatus("Sleep seconds must be >= 0.");
                                  }
                                  step.ms = Math.round(sleepSec * 1000);
                                }
                                if (postStepType === "assertURLContains") {
                                  if (!postStepUrl) return setPostStepStatus("Expected URL text is required.");
                                  step.url = postStepUrl;
                                }
                                if (postStepType === "assertTextContains") {
                                  if (!postStepValue) return setPostStepStatus("Expected text is required.");
                                  step.value = postStepValue;
                                  if (postStepSelector) step.selector = postStepSelector;
                                }
                                if (postStepType === "assertVisible") {
                                  if (!postStepSelector) return setPostStepStatus("Selector required for assertVisible.");
                                  step.selector = postStepSelector;
                                }
                                if (postStepType === "selectFrame") {
                                  if (!postStepSelector && !postStepUrl) {
                                    return setPostStepStatus("Frame selector or URL contains is required.");
                                  }
                                  if (postStepSelector) step.selector = postStepSelector;
                                  if (postStepUrl) step.url = postStepUrl;
                                }
                                setPostStepStatus("");
                                const next = [...(jobCfg.postLoginSteps || []), step];
                                const hasPostLoginCapture = captures.some(
                                  (c) => c.phase === "postLogin" || c.phase === "both"
                                );
                                if (!hasPostLoginCapture) {
                                  setCaptures([
                                    ...captures,
                                    { name: "post-login", phase: "postLogin", mode: "page", fullPage: false }
                                  ]);
                                }
                                setJobCfg({ ...jobCfg, postLoginSteps: next });
                              }}
                            >
                              Add post-login step
                            </Button>
                            {postStepStatus && <p className="mt-2 text-xs text-muted">{postStepStatus}</p>}
                          </div>
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
                      id="interaction-enabled"
                      className="mt-3"
                      labelText="Enable interaction"
                      checked={jobCfg.interaction?.enabled || false}
                      onChange={(e) => {
                        const enabled = (e.target as HTMLInputElement).checked;
                        const hasPostLoginCapture = captures.some((c) => c.phase === "postLogin" || c.phase === "both");
                        if (enabled && !hasPostLoginCapture) {
                          setCaptures([
                            ...captures,
                            { name: "post-login", phase: "postLogin", mode: "page", fullPage: false }
                          ]);
                        }
                        setJobCfg({
                          ...jobCfg,
                          interaction: {
                            ...(jobCfg.interaction || { enabled: false, steps: [], captureMode: "afterInteraction", bypassLazyLoad: false }),
                            enabled
                          }
                        });
                      }}
                    />
                    {jobCfg.interaction?.enabled ? (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <Select
                            id="interaction-capture-mode"
                            labelText="Capture mode"
                            value={jobCfg.interaction?.captureMode || "afterInteraction"}
                            onChange={(e) =>
                              setJobCfg({
                                ...jobCfg,
                                interaction: {
                                  ...(jobCfg.interaction || { enabled: true, steps: [] }),
                                  captureMode: e.target.value
                                }
                              })
                            }
                          >
                            <SelectItem value="afterInteraction" text="After interaction" />
                            <SelectItem value="afterEachStep" text="After each step" />
                          </Select>
                          <Checkbox
                            id="interaction-lazy-load"
                            labelText="Bypass lazy-load (auto scroll)"
                            checked={jobCfg.interaction?.bypassLazyLoad || false}
                            onChange={(e) =>
                              setJobCfg({
                                ...jobCfg,
                                interaction: {
                                  ...(jobCfg.interaction || { enabled: true, steps: [] }),
                                  bypassLazyLoad: (e.target as HTMLInputElement).checked
                                }
                              })
                            }
                          />
                        </div>
                        <div className="mt-4 text-xs text-muted">Interaction steps</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {(jobCfg.interaction?.steps || []).map((s: any, idx: number) => (
                            <Tile key={`interaction-${idx}`} style={{ padding: "8px 12px" }}>
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
                                  const next = [...(jobCfg.interaction?.steps || [])];
                                  next.splice(idx, 1);
                                  setJobCfg({
                                    ...jobCfg,
                                    interaction: {
                                      ...(jobCfg.interaction || { enabled: true, steps: [] }),
                                      steps: next
                                    }
                                  });
                                }}
                              >
                                Remove
                              </Button>
                            </Tile>
                          ))}
                          {(!jobCfg.interaction?.steps || jobCfg.interaction.steps.length === 0) && (
                            <div className="text-xs text-muted">No interaction steps.</div>
                          )}
                        </div>
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <div className="text-xs text-muted">Add interaction step</div>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <Select
                              id="interaction-step-type"
                              labelText="Step type"
                              value={interactionStepType}
                              onChange={(e) => setInteractionStepType(e.target.value)}
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
                              id="interaction-step-timeout"
                              labelText="Timeout (seconds)"
                              value={interactionStepTimeoutSeconds}
                              onChange={(e) => setInteractionStepTimeoutSeconds(e.target.value)}
                            />
                          </div>
                          {["click", "fill", "waitForSelector", "assertVisible", "selectFrame"].includes(interactionStepType) && (
                            <TextInput
                              id="interaction-step-selector"
                              labelText={interactionStepType === "selectFrame" ? "Frame selector (optional)" : "Selector"}
                              value={interactionStepSelector}
                              onChange={(e) => setInteractionStepSelector(e.target.value)}
                            />
                          )}
                          {interactionStepType === "fill" && (
                            <TextInput
                              id="interaction-step-value"
                              labelText="Value"
                              value={interactionStepValue}
                              onChange={(e) => setInteractionStepValue(e.target.value)}
                            />
                          )}
                          {interactionStepType === "type" && (
                            <TextInput
                              id="interaction-step-type-value"
                              labelText="Text to type"
                              value={interactionStepValue}
                              onChange={(e) => setInteractionStepValue(e.target.value)}
                            />
                          )}
                          {interactionStepType === "assertTextContains" && (
                            <TextInput
                              id="interaction-step-assert-text"
                              labelText="Expected text"
                              value={interactionStepValue}
                              onChange={(e) => setInteractionStepValue(e.target.value)}
                            />
                          )}
                          {interactionStepType === "press" && (
                            <TextInput
                              id="interaction-step-key"
                              labelText="Key (Enter, Tab, ArrowDown, etc.)"
                              value={interactionStepKey}
                              onChange={(e) => setInteractionStepKey(e.target.value)}
                            />
                          )}
                          {interactionStepType === "press" && (
                            <div className="text-xs text-muted">{pressKeyHint}</div>
                          )}
                          {["waitForURL", "assertURLContains", "selectFrame"].includes(interactionStepType) && (
                            <TextInput
                              id="interaction-step-url"
                              labelText={
                                interactionStepType === "selectFrame"
                                  ? "Frame URL contains (optional)"
                                  : interactionStepType === "assertURLContains"
                                    ? "Expected URL contains"
                                    : "URL or pattern"
                              }
                              value={interactionStepUrl}
                              onChange={(e) => setInteractionStepUrl(e.target.value)}
                            />
                          )}
                          {interactionStepType === "waitForLoadState" && (
                            <Select
                              id="interaction-step-state"
                              labelText="Load state"
                              value={interactionStepState}
                              onChange={(e) => setInteractionStepState(e.target.value)}
                            >
                              <SelectItem value="domcontentloaded" text="domcontentloaded" />
                              <SelectItem value="load" text="load" />
                              <SelectItem value="networkidle" text="networkidle" />
                            </Select>
                          )}
                          {interactionStepType === "sleep" && (
                            <TextInput
                              id="interaction-step-sleep"
                              labelText="Wait (seconds)"
                              value={interactionStepSleepSeconds}
                              onChange={(e) => setInteractionStepSleepSeconds(e.target.value)}
                            />
                          )}
                          {interactionStepType === "scroll" && (
                            <div className="grid grid-cols-3 gap-3">
                              <Select
                                id="interaction-scroll-to"
                                labelText="Scroll to"
                                value={interactionScrollTo}
                                onChange={(e) => setInteractionScrollTo(e.target.value)}
                              >
                                <SelectItem value="bottom" text="bottom" />
                                <SelectItem value="top" text="top" />
                                <SelectItem value="selector" text="selector" />
                              </Select>
                              <TextInput
                                id="interaction-scroll-steps"
                                labelText="Scroll steps"
                                type="number"
                                value={interactionScrollSteps}
                                onChange={(e) => setInteractionScrollSteps(e.target.value)}
                              />
                              <TextInput
                                id="interaction-scroll-delay"
                                labelText="Delay per step (seconds)"
                                value={interactionScrollDelaySeconds}
                                onChange={(e) => setInteractionScrollDelaySeconds(e.target.value)}
                              />
                            </div>
                          )}
                          {interactionStepType === "scroll" && interactionScrollTo === "selector" && (
                            <TextInput
                              id="interaction-scroll-selector"
                              labelText="Scroll selector"
                              value={interactionStepSelector}
                              onChange={(e) => setInteractionStepSelector(e.target.value)}
                            />
                          )}
                          <div className="mt-3">
                            <Button
                              kind="secondary"
                              onClick={() => {
                                const step: any = { type: interactionStepType };
                                const timeoutSec = Number(interactionStepTimeoutSeconds);
                                if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
                                  step.timeoutMs = Math.round(timeoutSec * 1000);
                                }
                                if (interactionStepType === "click") {
                                  if (!interactionStepSelector) return setInteractionStepStatus("Selector required for click.");
                                  step.selector = interactionStepSelector;
                                }
                                if (interactionStepType === "fill") {
                                  if (!interactionStepSelector) return setInteractionStepStatus("Selector required for fill.");
                                  step.selector = interactionStepSelector;
                                  step.value = interactionStepValue;
                                }
                                if (interactionStepType === "type") {
                                  step.value = interactionStepValue;
                                }
                                if (interactionStepType === "press") {
                                  step.key = interactionStepKey || "Enter";
                                }
                                if (interactionStepType === "waitForSelector") {
                                  if (!interactionStepSelector) return setInteractionStepStatus("Selector required for waitForSelector.");
                                  step.selector = interactionStepSelector;
                                }
                                if (interactionStepType === "waitForURL") {
                                  if (!interactionStepUrl) return setInteractionStepStatus("URL required for waitForURL.");
                                  step.url = interactionStepUrl;
                                }
                                if (interactionStepType === "waitForLoadState") {
                                  step.state = interactionStepState || "domcontentloaded";
                                }
                                if (interactionStepType === "sleep") {
                                  const sleepSec = Number(interactionStepSleepSeconds);
                                  if (!Number.isFinite(sleepSec) || sleepSec < 0) {
                                    return setInteractionStepStatus("Wait seconds must be >= 0.");
                                  }
                                  step.ms = Math.round(sleepSec * 1000);
                                }
                                if (interactionStepType === "assertURLContains") {
                                  if (!interactionStepUrl) return setInteractionStepStatus("Expected URL text is required.");
                                  step.url = interactionStepUrl;
                                }
                                if (interactionStepType === "assertTextContains") {
                                  if (!interactionStepValue) return setInteractionStepStatus("Expected text is required.");
                                  step.value = interactionStepValue;
                                  if (interactionStepSelector) step.selector = interactionStepSelector;
                                }
                                if (interactionStepType === "assertVisible") {
                                  if (!interactionStepSelector) return setInteractionStepStatus("Selector required for assertVisible.");
                                  step.selector = interactionStepSelector;
                                }
                                if (interactionStepType === "selectFrame") {
                                  if (!interactionStepSelector && !interactionStepUrl) {
                                    return setInteractionStepStatus("Frame selector or URL contains is required.");
                                  }
                                  if (interactionStepSelector) step.selector = interactionStepSelector;
                                  if (interactionStepUrl) step.url = interactionStepUrl;
                                }
                                if (interactionStepType === "scroll") {
                                  step.scrollTo = interactionScrollTo || "bottom";
                                  const steps = Number(interactionScrollSteps);
                                  if (!Number.isFinite(steps) || steps < 1) {
                                    return setInteractionStepStatus("Scroll steps must be >= 1.");
                                  }
                                  step.scrollSteps = Math.round(steps);
                                  const delaySec = Number(interactionScrollDelaySeconds);
                                  if (!Number.isFinite(delaySec) || delaySec < 0) {
                                    return setInteractionStepStatus("Delay must be >= 0.");
                                  }
                                  step.scrollDelayMs = Math.round(delaySec * 1000);
                                  if (interactionScrollTo === "selector") {
                                    if (!interactionStepSelector) return setInteractionStepStatus("Selector required for scroll.");
                                    step.selector = interactionStepSelector;
                                  }
                                }
                                setInteractionStepStatus("");
                                const next = [...(jobCfg.interaction?.steps || []), step];
                                setJobCfg({
                                  ...jobCfg,
                                  interaction: {
                                    ...(jobCfg.interaction || { enabled: true, steps: [] }),
                                    steps: next
                                  }
                                });
                              }}
                            >
                              Add interaction step
                            </Button>
                            {interactionStepStatus && <p className="mt-2 text-xs text-muted">{interactionStepStatus}</p>}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-muted">Enable interaction to add steps.</div>
                    )}
                  </div>
                </Tile>
              )}

              {jobStep === 2 && (
                <Stack gap={5}>
                  <Tile className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs text-muted">Captures</div>
                    <div className="mt-2 space-y-2">
                      {captures.map((cap, idx) => (
                        <div key={idx} className="grid grid-cols-5 gap-3">
                          <TextInput
                            id={`cap-name-${idx}`}
                            labelText="Name"
                            value={cap.name}
                            onChange={(e) => {
                              const next = [...captures];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setCaptures(next);
                            }}
                          />
                          <Select
                            id={`cap-phase-${idx}`}
                            labelText="Phase"
                            value={cap.phase}
                            onChange={(e) => {
                              const next = [...captures];
                              next[idx] = { ...next[idx], phase: e.target.value };
                              setCaptures(next);
                            }}
                          >
                            <SelectItem value="preLogin" text="preLogin" />
                            <SelectItem value="postLogin" text="postLogin" />
                            <SelectItem value="both" text="both" />
                          </Select>
                          <Select
                            id={`cap-mode-${idx}`}
                            labelText="Mode"
                            value={cap.mode}
                            onChange={(e) => {
                              const next = [...captures];
                              next[idx] = { ...next[idx], mode: e.target.value };
                              setCaptures(next);
                            }}
                          >
                            <SelectItem value="page" text="page" />
                            <SelectItem value="element" text="element" />
                          </Select>
                          {cap.mode === "element" ? (
                            <TextInput
                              id={`cap-selector-${idx}`}
                              labelText="Selector"
                              value={cap.selector || ""}
                              onChange={(e) => {
                                const next = [...captures];
                                next[idx] = { ...next[idx], selector: e.target.value };
                                setCaptures(next);
                              }}
                            />
                          ) : (
                            <div className="text-xs text-muted">Selector not required</div>
                          )}
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`cap-fullpage-${idx}`}
                              labelText="Full page"
                              checked={!!cap.fullPage}
                              disabled={cap.mode !== "page"}
                              onChange={(e) => {
                                const next = [...captures];
                                next[idx] = { ...next[idx], fullPage: (e.target as HTMLInputElement).checked };
                                setCaptures(next);
                              }}
                            />
                            <Button
                              kind="ghost"
                              size="sm"
                              iconDescription="Remove capture"
                              onClick={() => {
                                const next = [...captures];
                                next.splice(idx, 1);
                                setCaptures(next);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button kind="secondary" onClick={() => setCaptures([...captures, { name: "capture", phase: "postLogin", mode: "page", fullPage: false }])}>
                        Add capture
                      </Button>
                    </div>
                  </Tile>
                  <Tile className="rounded-lg border border-slate-200 p-4">
                    <Checkbox
                      id="schedule-enabled"
                      labelText="Enable schedule"
                      checked={scheduleEnabled}
                      onChange={(e) => setScheduleEnabled((e.target as HTMLInputElement).checked)}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <TextInput id="schedule-times" labelText="Times (HH:MM)" value={scheduleTimes} onChange={(e) => { setScheduleTimes(e.target.value); setScheduleEnabled(true); }} />
                      <TextInput id="schedule-tz" labelText="Timezone" value={scheduleTimezone} onChange={(e) => setScheduleTimezone(e.target.value)} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <Select id="schedule-mode" labelText="Mode" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as "daily" | "limited")}>
                        <SelectItem value="daily" text="Daily" />
                        <SelectItem value="limited" text="Limited" />
                      </Select>
                      <TextInput id="schedule-runs" labelText="Runs (limited)" type="number" value={String(scheduleRuns)} onChange={(e) => setScheduleRuns(Number(e.target.value || 1))} />
                    </div>
                    <div className="mt-2 text-xs text-muted">
                      Limited runs will execute only a set number of times, then auto-disable the schedule.
                    </div>
                  </Tile>
                  <Tile className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs text-muted">Notifications</div>
                    <div className="mt-2">
                      <MultiSelect
                        id="notifications-select"
                        titleText="Enable notifications"
                        items={notifications}
                        itemToString={(item) =>
                          item ? `${item.name || item.id} (${item.config?.endpoint || "HTTP"})` : ""
                        }
                        selectedItems={notifications.filter((n) =>
                          (jobCfg.notifications?.ids || []).includes(n.id)
                        )}
                        onChange={(e: any) => {
                          const ids = (e.selectedItems || []).map((n: any) => n.id);
                          setJobCfg({
                            ...jobCfg,
                            notifications: {
                              enabled: ids.length > 0,
                              ids
                            }
                          });
                        }}
                        label="Select notifications"
                      />
                    </div>
                    {notifications.length === 0 && (
                      <div className="mt-2 text-xs text-muted">No notifications yet.</div>
                    )}
                  </Tile>
                </Stack>
              )}
            </Stack>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setShowJobModal(false)}>Cancel</Button>
          <Button kind="secondary" onClick={() => setJobStep(Math.max(0, jobStep - 1))} disabled={jobStep === 0}>
            Back
          </Button>
          {jobStep < jobSteps.length - 1 ? (
            <Button kind="primary" onClick={() => setJobStep(Math.min(jobSteps.length - 1, jobStep + 1))}>
              Next
            </Button>
          ) : (
            <Button kind="primary" onClick={() => { setJobCfg(jobConfig); createJob(); setShowJobModal(false); }}>
              Create job
            </Button>
          )}
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
