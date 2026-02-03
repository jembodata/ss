"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile
} from "@carbon/react";

type Summary = {
  time: string;
  queue: Record<string, number>;
  runs: Record<string, number>;
};

type TrendPoint = {
  at: string;
  queueActive: number;
  queueWaiting: number;
  queueFailed: number;
  runsRunning: number;
  runsSuccess: number;
  runsFailed: number;
};

function MiniTrend({
  points,
  color = "#0f62fe"
}: {
  points: number[];
  color?: string;
}) {
  const width = 160;
  const height = 36;
  if (!points.length) return <div className="text-xs text-muted">No trend yet</div>;
  const max = Math.max(...points, 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - (p / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="trend">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={coords}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MonitoringPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [status, setStatus] = useState("Loading...");
  const { push } = useToast();

  async function load() {
    try {
      const res = await api.metrics.summary();
      setSummary(res);
      setTrend((prev) => {
        const next: TrendPoint[] = [
          ...prev,
          {
            at: res.time,
            queueActive: Number(res.queue?.active || 0),
            queueWaiting: Number(res.queue?.waiting || 0),
            queueFailed: Number(res.queue?.failed || 0),
            runsRunning: Number(res.runs?.running || 0),
            runsSuccess: Number(res.runs?.success || 0),
            runsFailed: Number(res.runs?.failed || 0)
          }
        ];
        return next.slice(-20);
      });
      setStatus("");
    } catch (e: any) {
      setStatus(e.message || "Failed to load metrics.");
      push("error", "Monitoring failed", e.message || "Failed to load metrics.");
    }
  }

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await load();
    };
    run();
    const interval = setInterval(run, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const rows = [
    { group: "Queue", key: "waiting", value: summary?.queue?.waiting ?? 0 },
    { group: "Queue", key: "active", value: summary?.queue?.active ?? 0 },
    { group: "Queue", key: "completed", value: summary?.queue?.completed ?? 0 },
    { group: "Queue", key: "failed", value: summary?.queue?.failed ?? 0 },
    { group: "Queue", key: "delayed", value: summary?.queue?.delayed ?? 0 },
    { group: "Queue", key: "paused", value: summary?.queue?.paused ?? 0 },
    { group: "Runs", key: "queued", value: summary?.runs?.queued ?? 0 },
    { group: "Runs", key: "running", value: summary?.runs?.running ?? 0 },
    { group: "Runs", key: "success", value: summary?.runs?.success ?? 0 },
    { group: "Runs", key: "failed", value: summary?.runs?.failed ?? 0 },
    { group: "Runs", key: "total", value: summary?.runs?.total ?? 0 }
  ];
  const cards = useMemo(
    () => [
      {
        title: "Queue Active",
        value: summary?.queue?.active ?? 0,
        points: trend.map((t) => t.queueActive),
        color: "#198038"
      },
      {
        title: "Queue Waiting",
        value: summary?.queue?.waiting ?? 0,
        points: trend.map((t) => t.queueWaiting),
        color: "#0f62fe"
      },
      {
        title: "Queue Failed",
        value: summary?.queue?.failed ?? 0,
        points: trend.map((t) => t.queueFailed),
        color: "#da1e28"
      },
      {
        title: "Runs Running",
        value: summary?.runs?.running ?? 0,
        points: trend.map((t) => t.runsRunning),
        color: "#198038"
      },
      {
        title: "Runs Success",
        value: summary?.runs?.success ?? 0,
        points: trend.map((t) => t.runsSuccess),
        color: "#24a148"
      },
      {
        title: "Runs Failed",
        value: summary?.runs?.failed ?? 0,
        points: trend.map((t) => t.runsFailed),
        color: "#da1e28"
      }
    ],
    [summary, trend]
  );

  return (
    <div className="space-y-6">
      <AppHeader />
      <Tile>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Monitoring</h2>
            <p className="text-sm text-muted">Queue and run metrics summary</p>
            <p className="text-xs text-muted">
              Last update: {summary?.time || "-"}
            </p>
            <p className="text-xs text-muted">
              Samples: {trend.length}/20
            </p>
          </div>
          <Button kind="ghost" size="sm" onClick={load}>Refresh</Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {cards.map((card) => (
            <Tile key={card.title}>
              <div className="text-xs text-muted">{card.title}</div>
              <div className="mt-1 text-2xl font-semibold">{card.value}</div>
              <div className="mt-2">
                <MiniTrend points={card.points} color={card.color} />
              </div>
            </Tile>
          ))}
        </div>

        <div className="mt-4">
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableHeader>Group</TableHeader>
                <TableHeader>Metric</TableHeader>
                <TableHeader>Value</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.group}-${row.key}`}>
                  <TableCell>{row.group}</TableCell>
                  <TableCell>{row.key}</TableCell>
                  <TableCell>{row.value}</TableCell>
                </TableRow>
              ))}
              {!summary && (
                <TableRow>
                  <TableCell colSpan={3}>{status}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Tile>
    </div>
  );
}
