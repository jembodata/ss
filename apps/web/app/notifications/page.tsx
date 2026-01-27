"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { api } from "@/lib/api";
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
  TextArea,
  TextInput,
  Tile
} from "@carbon/react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState("http");
  const [name, setName] = useState("Alert_1");
  const [endpoint, setEndpoint] = useState("http://");
  const [fileField, setFileField] = useState("file");
  const [body, setBody] = useState(`{\n  \"phone\": \"\",\n  \"message\": \"Monitor status: {{msg}}.\",\n  \"reply_message_id\": \"\"\n}`);
  const [headersEnabled, setHeadersEnabled] = useState(false);
  const [headers, setHeaders] = useState("{\n  \"Content-Type\": \"application/json\"\n}");
  const [testLog, setTestLog] = useState("");
  const [draftTestLog, setDraftTestLog] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { push } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const data = await api.notifications.list();
      setNotifications(data);
      setStatus("");
    } catch (err: any) {
      setStatus(err.message || "Failed to load notifications.");
      push("error", "Notifications failed", err.message || "Failed to load notifications.");
    }
  }

  async function createNotification() {
    setStatus("Saving...");
    try {
      await api.notifications.create({
        name,
        type,
        endpoint,
        body,
        headers: headersEnabled ? headers : "",
        fileField
      });
      setShowModal(false);
      await loadNotifications();
      setStatus("Created.");
      push("success", "Notification created", name);
    } catch (err: any) {
      setStatus(err.message || "Create failed.");
      push("error", "Create failed", err.message || "Create failed.");
    }
  }

  async function updateNotification() {
    if (!editingId) return;
    setStatus("Saving...");
    try {
      await api.notifications.update(editingId, {
        name,
        type,
        endpoint,
        body,
        headers: headersEnabled ? headers : "",
        fileField
      });
      setShowModal(false);
      await loadNotifications();
      setStatus("Updated.");
      push("success", "Notification updated", name);
    } catch (err: any) {
      setStatus(err.message || "Update failed.");
      push("error", "Update failed", err.message || "Update failed.");
    }
  }

  async function deleteNotification(id: string) {
    if (!confirm("Delete notification?")) return;
    setStatus("Deleting...");
    try {
      await api.notifications.remove(id);
      await loadNotifications();
      setStatus("Deleted.");
      push("success", "Notification deleted", id);
    } catch (err: any) {
      setStatus(err.message || "Delete failed.");
      push("error", "Delete failed", err.message || "Delete failed.");
    }
  }

  async function testNotification(id: string) {
    setStatus("Sending test...");
    setTestLog("");
    try {
      const res = await api.notifications.test(id);
      const bodyText = res.body ? res.body.slice(0, 800) : "";
      setTestLog(`Status: ${res.status ?? "-"}\n${bodyText}`);
      setStatus(res.ok ? "Test sent." : "Test failed.");
      push(res.ok ? "success" : "error", "Test notification", res.ok ? "Success" : "Failed");
    } catch (err: any) {
      setStatus(err.message || "Test failed.");
      push("error", "Test notification", err.message || "Test failed.");
    }
  }

  async function testDraftNotification() {
    setStatus("Sending test...");
    setDraftTestLog("");
    try {
      const res = await api.notifications.testDraft({
        type,
        endpoint,
        body,
        headers: headersEnabled ? headers : "",
        fileField
      });
      const bodyText = res.body ? res.body.slice(0, 800) : "";
      setDraftTestLog(`Status: ${res.status ?? "-"}\n${bodyText}`);
      setStatus(res.ok ? "Test sent." : "Test failed.");
      push(res.ok ? "success" : "error", "Test notification", res.ok ? "Success" : "Failed");
    } catch (err: any) {
      setStatus(err.message || "Test failed.");
      push("error", "Test notification", err.message || "Test failed.");
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setName("Alert_1");
    setEndpoint("http://");
    setType("http");
    setFileField("file");
    setBody("{\n  \"phone\": \"\",\n  \"message\": \"Monitor status: {{msg}}.\",\n  \"reply_message_id\": \"\"\n}");
    setHeadersEnabled(false);
    setHeaders("{\n  \"Content-Type\": \"application/json\"\n}");
    setDraftTestLog("");
    setShowModal(true);
  }

  function openEditModal(notification: any) {
    setEditingId(notification.id);
    setName(notification.name || "");
    setType(notification.type || "http");
    setEndpoint(notification.config?.endpoint || "");
    setFileField(notification.config?.fileField || "file");
    setBody(notification.config?.body || "{}");
    const headerObj = notification.config?.headers || {};
    const hasHeaders = headerObj && Object.keys(headerObj).length > 0;
    setHeadersEnabled(hasHeaders);
    setHeaders(JSON.stringify(headerObj || {}, null, 2));
    setDraftTestLog("");
    setShowModal(true);
  }

  const pageItems = notifications.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <AppHeader />

      <Tile>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted">Send a webhook after a successful run.</p>
          </div>
          <Button kind="primary" onClick={openCreateModal}>Setup Notification</Button>
        </div>
        <div className="mt-4">
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Type</TableHeader>
              <TableHeader>Endpoint</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
              {pageItems.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.name}</TableCell>
                  <TableCell>{n.type}</TableCell>
                  <TableCell>{n.config?.endpoint || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" kind="ghost" onClick={() => openEditModal(n)}>
                        Edit
                      </Button>
                      <Button size="sm" kind="ghost" onClick={() => testNotification(n.id)}>
                        Test
                      </Button>
                      <Button size="sm" kind="ghost" onClick={() => deleteNotification(n.id)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!pageItems.length && (
                <TableRow>
                  <TableCell colSpan={4}>{status || "No notifications yet."}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={pageSize}
            pageSizes={[5, 10, 20]}
            totalItems={notifications.length}
            onChange={({ page, pageSize }) => {
              setPage(page);
              setPageSize(pageSize);
            }}
          />
        </div>
        {status && <p className="text-xs text-muted">{status}</p>}
        {testLog && (
          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{testLog}</pre>
        )}
      </Tile>

      <ComposedModal
        open={showModal}
        onClose={() => setShowModal(false)}
        size="lg"
        preventCloseOnClickOutside
        className="modal-fixed"
      >
        <ModalHeader label="Notifications" title={editingId ? "Edit Notification" : "Setup Notification"} />
        <ModalBody>
          <Form aria-label="Notification form">
            <Stack gap={6}>
              <Select id="notify-type" labelText="Notification Type" value={type} onChange={(e) => setType(e.target.value)}>
                <SelectItem value="http" text="HTTP" />
              </Select>
              <TextInput id="notify-name" labelText="Friendly Name" value={name} onChange={(e) => setName(e.target.value)} />
              <TextInput id="notify-endpoint" labelText="Post URL" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
              <TextInput id="notify-file-field" labelText="File field name" value={fileField} onChange={(e) => setFileField(e.target.value)} />
              <TextArea
                id="notify-body"
                labelText="Request Body (JSON)"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
              />
              <div className="text-xs text-muted">
                JSON fields are sent as multipart form fields: {"{{msg}}"}, {"{{job.name}}"}, {"{{run.id}}"}, {"{{artifactUrl}}"}
              </div>
              <div className="text-xs text-muted">
                File is uploaded as multipart field named "file" by default.
              </div>
              <Checkbox
                id="notify-headers-toggle"
                labelText="Additional Headers"
                checked={headersEnabled}
                onChange={(e) => setHeadersEnabled((e.target as HTMLInputElement).checked)}
              />
              {headersEnabled && (
                <TextArea
                  id="notify-headers"
                  labelText="Additional Headers (JSON)"
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  rows={6}
                />
              )}
            </Stack>
            {draftTestLog && (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{draftTestLog}</pre>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button kind="secondary" onClick={testDraftNotification}>Test Notification</Button>
          <Button kind="primary" onClick={editingId ? updateNotification : createNotification}>
            {editingId ? "Save Changes" : "Save Notification"}
          </Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
