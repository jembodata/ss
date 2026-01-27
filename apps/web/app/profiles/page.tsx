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
  ModalBody,
  ModalFooter,
  ModalHeader,
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
  TextInput
} from "@carbon/react";

type KeyValue = { key: string; value: string };

const defaultProfile = {
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 768 },
  userAgent: "",
  locale: "en-US",
  timezoneId: "Asia/Jakarta",
  blockResources: false,
  extraHeaders: {} as Record<string, string>
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

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCfg, setEditCfg] = useState({ ...defaultProfile });
  const [editHeaders, setEditHeaders] = useState<KeyValue[]>([]);
  const [editStatus, setEditStatus] = useState("");
  const [viewportPreset, setViewportPreset] = useState("custom");
  const [customViewport, setCustomViewport] = useState({
    width: defaultProfile.viewport.width,
    height: defaultProfile.viewport.height
  });
  const [userAgentPreset, setUserAgentPreset] = useState("custom");
  const [customUserAgent, setCustomUserAgent] = useState("");
  const { push } = useToast();

  useEffect(() => {
    api.profiles
      .list()
      .then((data) => {
        setProfiles(data);
        setStatus("");
      })
      .catch(() => setStatus("Failed to load profiles."));
  }, []);

  function toHeaderList(headers?: Record<string, string>) {
    if (!headers) return [];
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  }

  function applyViewportPreset(preset: string) {
    if (preset === "custom") return;
    const next = viewportPresets[preset];
    if (next) {
      setEditCfg({ ...editCfg, viewport: { ...next } });
      setCustomViewport({ ...next });
    }
  }

  function openEdit(profile: any) {
    const cfg = { ...defaultProfile, ...(profile.config || {}) };
    setEditId(profile.id);
    setEditName(profile.name || "");
    setEditCfg(cfg);
    setEditHeaders(toHeaderList(cfg.extraHeaders || {}));
    setEditStatus("");
    const preset = Object.entries(viewportPresets).find(
      ([, value]) => value.width === cfg.viewport?.width && value.height === cfg.viewport?.height
    );
    setViewportPreset(preset ? preset[0] : "custom");
    setCustomViewport({
      width: cfg.viewport?.width || defaultProfile.viewport.width,
      height: cfg.viewport?.height || defaultProfile.viewport.height
    });
    const uaPreset = Object.entries(userAgentPresets).find(([, value]) => value === (cfg.userAgent || ""));
    setUserAgentPreset(uaPreset ? uaPreset[0] : "custom");
    setCustomUserAgent(cfg.userAgent || "");
    setShowEdit(true);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditStatus("Saving...");
    const extraHeaders = editHeaders.reduce<Record<string, string>>((acc, cur) => {
      if (!cur.key) return acc;
      acc[cur.key] = cur.value || "";
      return acc;
    }, {});
    try {
      await api.profiles.update(editId, {
        name: editName,
        config: { ...editCfg, extraHeaders }
      });
      const data = await api.profiles.list();
      setProfiles(data);
      setEditStatus("Saved.");
      setShowEdit(false);
      push("success", "Profile updated", editName || editId);
    } catch (err: any) {
      setEditStatus(err.message || "Save failed.");
      push("error", "Profile update failed", err.message || "Save failed.");
    }
  }

  async function deleteProfile(id: string) {
    if (!confirm("Delete profile and all related jobs?")) return;
    setStatus("Deleting...");
    try {
      await api.profiles.remove(id);
      const data = await api.profiles.list();
      setProfiles(data);
      setStatus("Deleted.");
      push("success", "Profile deleted", id);
    } catch (err: any) {
      setStatus(err.message || "Delete failed.");
      push("error", "Delete failed", err.message || "Delete failed.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(profiles.length / pageSize));
  const pageItems = profiles.slice((page - 1) * pageSize, page * pageSize);

  const headerCount = useMemo(() => editHeaders.filter((h) => h.key).length, [editHeaders]);

  return (
    <div className="space-y-6">
      <AppHeader />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Profiles</h2>
          <p className="text-sm text-muted">Existing browser profiles</p>
        </div>
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>ID</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Viewport</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.id}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.config?.viewport ? `${p.config.viewport.width}x${p.config.viewport.height}` : "-"}</TableCell>
                <TableCell>{p.created_at}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" kind="ghost" onClick={() => openEdit(p)}>Edit</Button>
                    <Button size="sm" kind="ghost" onClick={() => deleteProfile(p.id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!pageItems.length && (
              <TableRow>
                <TableCell colSpan={5}>{status}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          pageSize={pageSize}
          pageSizes={[5, 10, 20]}
          totalItems={profiles.length}
          onChange={({ page, pageSize }) => {
            setPage(page);
            setPageSize(pageSize);
          }}
        />
      </div>

      <ComposedModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        size="lg"
        preventCloseOnClickOutside
        className="modal-fixed"
      >
        <ModalHeader label="Profiles" title="Edit Profile" />
        <ModalBody>
          <Form aria-label="Edit profile form">
            <Stack gap={6}>
              <TextInput id="edit-profile-name" labelText="Profile name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Select
                id="edit-viewport-preset"
                labelText="Viewport preset"
                value={viewportPreset}
                onChange={(e) => {
                  const next = e.target.value;
                  setViewportPreset(next);
                  applyViewportPreset(next);
                }}
              >
                <SelectItem value="custom" text="Custom" />
                <SelectItem value="mobile" text="Mobile" />
                <SelectItem value="tablet" text="Tablet" />
                <SelectItem value="laptop" text="Laptop" />
                <SelectItem value="desktop" text="Desktop" />
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  id="edit-viewport-width"
                  labelText="Viewport width"
                  type="number"
                  value={String(viewportPreset === "custom" ? customViewport.width : editCfg.viewport.width)}
                  onChange={(e) => {
                    const width = Number(e.target.value || 0);
                    const next = { ...customViewport, width };
                    setCustomViewport(next);
                    setEditCfg({ ...editCfg, viewport: next });
                    setViewportPreset("custom");
                  }}
                />
                <TextInput
                  id="edit-viewport-height"
                  labelText="Viewport height"
                  type="number"
                  value={String(viewportPreset === "custom" ? customViewport.height : editCfg.viewport.height)}
                  onChange={(e) => {
                    const height = Number(e.target.value || 0);
                    const next = { ...customViewport, height };
                    setCustomViewport(next);
                    setEditCfg({ ...editCfg, viewport: next });
                    setViewportPreset("custom");
                  }}
                />
              </div>
              <TextInput id="edit-profile-locale" labelText="Locale" value={editCfg.locale} onChange={(e) => setEditCfg({ ...editCfg, locale: e.target.value })} />
              <TextInput id="edit-profile-tz" labelText="Timezone" value={editCfg.timezoneId} onChange={(e) => setEditCfg({ ...editCfg, timezoneId: e.target.value })} />
              <Select
                id="edit-profile-ua-preset"
                labelText="User agent preset"
                value={userAgentPreset}
                onChange={(e) => {
                  const next = e.target.value;
                  setUserAgentPreset(next);
                  if (next === "custom") {
                    setEditCfg({ ...editCfg, userAgent: customUserAgent });
                  } else {
                    const ua = userAgentPresets[next] || "";
                    setCustomUserAgent(ua);
                    setEditCfg({ ...editCfg, userAgent: ua });
                  }
                }}
              >
                <SelectItem value="custom" text="Custom" />
                <SelectItem value="default" text="Default" />
                <SelectItem value="chromeWindows" text="Chrome (Windows)" />
                <SelectItem value="edgeWindows" text="Edge (Windows)" />
                <SelectItem value="chromeAndroid" text="Chrome (Android)" />
                <SelectItem value="safariIphone" text="Safari (iPhone)" />
                <SelectItem value="safariIpad" text="Safari (iPad)" />
              </Select>
              {userAgentPreset === "custom" && (
                <TextInput
                  id="edit-profile-ua"
                  labelText="User agent"
                  value={customUserAgent}
                  onChange={(e) => {
                    setCustomUserAgent(e.target.value);
                    setEditCfg({ ...editCfg, userAgent: e.target.value });
                  }}
                />
              )}
              <Checkbox
                id="edit-profile-ignore"
                labelText="Ignore HTTPS errors"
                checked={editCfg.ignoreHTTPSErrors}
                onChange={(e) => setEditCfg({ ...editCfg, ignoreHTTPSErrors: (e.target as HTMLInputElement).checked })}
              />
              <Checkbox
                id="edit-profile-block"
                labelText="Block resources"
                checked={editCfg.blockResources}
                onChange={(e) => setEditCfg({ ...editCfg, blockResources: (e.target as HTMLInputElement).checked })}
              />
              <div className="space-y-2">
                <div className="text-sm font-semibold">Extra headers</div>
                {editHeaders.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2">
                    <TextInput
                      id={`edit-header-key-${idx}`}
                      labelText="Key"
                      value={item.key}
                      onChange={(e) => {
                        const next = [...editHeaders];
                        next[idx] = { ...next[idx], key: e.target.value };
                        setEditHeaders(next);
                      }}
                    />
                    <TextInput
                      id={`edit-header-value-${idx}`}
                      labelText="Value"
                      value={item.value}
                      onChange={(e) => {
                        const next = [...editHeaders];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setEditHeaders(next);
                      }}
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    kind="secondary"
                    onClick={() => setEditHeaders([...editHeaders, { key: "", value: "" }])}
                  >
                    Add header
                  </Button>
                  {editHeaders.length > 0 && (
                    <Button
                      kind="ghost"
                      onClick={() => setEditHeaders(editHeaders.slice(0, -1))}
                    >
                      Remove last
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {headerCount ? `${headerCount} header(s) configured.` : "No extra headers."}
                </div>
              </div>
              {editStatus && <p className="text-xs text-muted">{editStatus}</p>}
            </Stack>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setShowEdit(false)}>Cancel</Button>
          <Button kind="primary" onClick={saveEdit}>Save Changes</Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
