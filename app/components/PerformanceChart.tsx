"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const HISTORY_KEY = "signal.history";

interface Snapshot {
  date: string; // YYYY-MM-DD
  ts: number; // epoch ms
  valueNzd: number;
  costNzd: number;
}

type RangeKey = "1D" | "1W" | "1M" | "1Y" | "5Y" | "10Y" | "ALL";

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "1D", label: "일", days: 1 },
  { key: "1W", label: "주", days: 7 },
  { key: "1M", label: "월", days: 30 },
  { key: "1Y", label: "년", days: 365 },
  { key: "5Y", label: "5년", days: 365 * 5 },
  { key: "10Y", label: "10년", days: 365 * 10 },
  { key: "ALL", label: "전체", days: null },
];

function loadHistory(): Snapshot[] {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

/** Record at most one snapshot per calendar day (last write wins for the day). */
export function recordSnapshot(valueNzd: number, costNzd: number) {
  if (valueNzd <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const hist = loadHistory();
  const filtered = hist.filter((s) => s.date !== today);
  filtered.push({ date: today, ts: Date.now(), valueNzd, costNzd });
  filtered.sort((a, b) => a.ts - b.ts);
  // Keep it bounded (~11 years of daily points).
  const trimmed = filtered.slice(-4000);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function PerformanceChart({ hidePnl }: { hidePnl: boolean }) {
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [range, setRange] = useState<RangeKey>("1M");

  useEffect(() => {
    setHistory(loadHistory());
    // Re-read shortly after mount in case a snapshot was just written this session.
    const t = setTimeout(() => setHistory(loadHistory()), 1500);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    const cutoff = days ? Date.now() - days * 86400000 : 0;
    const pts = history.filter((s) => s.ts >= cutoff);
    return pts.map((s) => ({
      date: s.date.slice(5), // MM-DD
      ret: s.costNzd > 0 ? Number((((s.valueNzd - s.costNzd) / s.costNzd) * 100).toFixed(2)) : 0,
      value: Number(s.valueNzd.toFixed(2)),
    }));
  }, [history, range]);

  const latest = data.length ? data[data.length - 1] : null;
  const first = data.length ? data[0] : null;
  const periodChange = latest && first ? latest.ret - first.ret : 0;
  const gain = periodChange >= 0;

  return (
    <div className="perf-card">
      <div className="perf-head">
        <span className="perf-title">총 수익률 추이</span>
        <div className="perf-ranges">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={"perf-range" + (range === r.key ? " active" : "")}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {history.length < 2 ? (
        <div className="perf-empty">
          📊 기록을 수집하는 중입니다.
          <br />
          매일 접속하면 포트폴리오 수익률이 하루씩 기록되어, 이 그래프가 점점 채워집니다.
          <br />
          <span className="perf-empty-sub">
            (현재 {history.length}일치 기록 · 최소 2일부터 그래프 표시)
          </span>
        </div>
      ) : data.length < 2 ? (
        <div className="perf-empty">
          이 기간({RANGES.find((r) => r.key === range)?.label})에는 아직 데이터가 부족합니다. 더
          짧은 기간을 선택하거나 기록이 쌓일 때까지 기다려 주세요.
        </div>
      ) : (
        <>
          <div className="perf-summary">
            <span
              className="perf-change"
              style={{ color: hidePnl ? "var(--text-dim)" : gain ? "#ff4d4d" : "#3d7bff" }}
            >
              {hidePnl ? "••••" : `${gain ? "▲ +" : "▼ "}${periodChange.toFixed(2)}%p`}
            </span>
            <span className="perf-current">
              현재 {hidePnl ? "••••" : `${latest!.ret >= 0 ? "+" : ""}${latest!.ret}%`}
            </span>
          </div>
          <div className="perf-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--text-faint)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line)" }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-faint)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (hidePnl ? "" : `${v}%`)}
                  width={42}
                />
                <ReferenceLine y={0} stroke="var(--line)" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elev)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--text-dim)" }}
                  formatter={(v: number) => [hidePnl ? "••••" : `${v}%`, "수익률"]}
                />
                <Line
                  type="monotone"
                  dataKey="ret"
                  stroke={gain ? "#ff4d4d" : "#3d7bff"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      <div className="perf-note">오늘부터 매일 자동 기록 · 기기에만 저장됩니다</div>
    </div>
  );
}
