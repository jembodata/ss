"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, API_BASE } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import { useToast } from "@/components/ToastProvider";
import {
  Button,
  Modal,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile
} from "@carbon/react";

function RunsContent() {
  const params = useSearchParams();
  const runId = params.get("runId");
  const jobId = params.get("jobId");
  const [runs, setRuns] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [jobNameMap, setJobNameMap] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { push } = useToast();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<string | null>(null);

  useEffect(() => {
    if (runId) {
      let active = true;
      const load = () => {
        api.runs
          .get(runId)
          .then((data) => {
            if (!active) return;
            setDetail(data);
            setStatus("");
          })
          .catch(() => {
            if (!active) return;
            setStatus("Failed to load run.");
            push("error", "Run failed", "Failed to load run.");
          });
      };
      load();
      const interval = setInterval(load, 4000);
      return () => {
        active = false;
        clearInterval(interval);
      };
      return;
    }
    api.runs
      .list(jobId || undefined)
      .then((data) => {
        setRuns(data);
        setStatus("");
      })
      .catch(() => {
        setStatus("Failed to load runs.");
        push("error", "Runs failed", "Failed to load runs.");
      });
  }, [runId, jobId]);

  useEffect(() => {
    api.jobs
      .list()
      .then((jobs) => {
        const map: Record<string, string> = {};
        jobs.forEach((j: any) => {
          map[j.id] = j.name || j.id;
        });
        setJobNameMap(map);
      })
      .catch(() => {});
  }, []);

  async function deleteRun(id: string) {
    try {
      await api.runs.remove(id);
      if (runId) {
        window.location.href = "/runs";
        return;
      }
      const data = await api.runs.list(jobId || undefined);
      setRuns(data);
      push("success", "Run deleted", id);
    } catch {}
  }
  function requestDelete(id: string) {
    setConfirmDeleteRun(id);
    setConfirmDeleteOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(runs.length / pageSize));
  const pageItems = runs.slice((page - 1) * pageSize, page * pageSize);
  const formatDateTime = (value: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} - ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };


  return (
    <div className="space-y-6">
      <AppHeader />

      {detail ? (
        <Tile>
          <h2 className="text-lg font-semibold">Run Detail</h2>
          <div className="text-sm">
            <p><strong>Run:</strong> {detail.run.id}</p>
            <p><strong>Status:</strong> {detail.run.status}</p>
            {detail.run.error && <p><strong>Error:</strong> {detail.run.error}</p>}
          </div>
          {["queued", "running"].includes(detail.run.status) && (
            <div className="mt-3 text-sm text-muted">
              <span className="typing-dots">Processing</span>
            </div>
          )}
          {detail.run.log_tail && (
            <Tile className="mt-4">
              <div className="text-sm font-semibold">Live progress</div>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{detail.run.log_tail}</pre>
            </Tile>
          )}
          <div className="mt-3">
            <Button kind="ghost" onClick={() => requestDelete(detail.run.id)}>Delete run</Button>
          </div>
          <div className="mt-4 grid gap-4">
            {(detail.artifacts || []).map((a: any) => (
              <Tile key={a.id}>
                <div className="text-sm">{a.name}</div>
                <div className="text-xs text-muted">{a.object_key}</div>
                <img className="mt-2" src={`${API_BASE}/artifact/${encodeURIComponent(a.bucket)}/${encodeURIComponent(a.object_key)}`} />
              </Tile>
            ))}
          </div>
        </Tile>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Runs</h2>
            <p className="text-sm text-muted">Recent executions</p>
          </div>
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableHeader>Run ID</TableHeader>
                <TableHeader>Job</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Scheduled</TableHeader>
                <TableHeader>Started</TableHeader>
                <TableHeader>Ended</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageItems.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{jobNameMap[r.job_id] || r.job_id}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{formatDateTime(r.scheduled_at)}</TableCell>
                  <TableCell>{formatDateTime(r.started_at)}</TableCell>
                  <TableCell>{formatDateTime(r.ended_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" kind="ghost" href={`/runs?runId=${r.id}`}>View</Button>
                      <Button size="sm" kind="ghost" onClick={() => requestDelete(r.id)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!pageItems.length && (
                <TableRow>
                  <TableCell colSpan={7}>{status}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={pageSize}
            pageSizes={[5, 10, 20]}
            totalItems={runs.length}
            onChange={({ page, pageSize }) => {
              setPage(page);
              setPageSize(pageSize);
            }}
          />
        </div>
      )}
      <Modal
        open={confirmDeleteOpen}
        onRequestClose={() => setConfirmDeleteOpen(false)}
        danger
        modalHeading="Delete run?"
        modalLabel="Runs"
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        onRequestSubmit={() => {
          if (!confirmDeleteRun) return;
          const id = confirmDeleteRun;
          setConfirmDeleteOpen(false);
          setConfirmDeleteRun(null);
          deleteRun(id);
        }}
      >
        <p>
          This run and its artifacts will be permanently deleted.
        </p>
      </Modal>
    </div>
  );
}

export default function RunsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted">Loading runs...</div>}>
      <RunsContent />
    </Suspense>
  );
}
