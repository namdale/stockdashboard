"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  weekHigh52: number;
  weekLow52: number;
  closes: number[];
  asOf: string;
  source: string;
  isDemo: boolean;
}

interface NewsItem {
  headline: string;
  url: string;
  sourceName: string;
  sourceTier: 1 | 2;
  ageMinutes: number;
  freshness: string;
}

interface Signal {
  level: string;
  levelLabel: string;
  color: string;
  score: number;
  breakdown: {
    technical: { score: number; rsi: number | null };
    valuation: { score: number };
    sentiment: { score: number };
  };
  comment: string | null;
  commentSource: string;
}

function ageText(m: number) {
  if (m < 1) return "방금";
  if (m < 60) return `${m}분`;
  if (m < 1440) return `${Math.round(m / 60)}시간`;
  return `${Math.round(m / 1440)}일`;
}

export function HoldingCard({ symbol, onRemove }: { symbol: string; onRemove: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsDemo, setNewsDemo] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [q, n] = await Promise.all([
          fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`).then((r) => r.json()),
          fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setQuote(q);
        setNews(n.items || []);
        setNewsDemo(!!n.isDemo);

        const sig = await fetch("/api/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol,
            price: q.price,
            closes: q.closes,
            weekHigh52: q.weekHigh52,
            weekLow52: q.weekLow52,
            newsHeadlines: (n.items || []).map((i: NewsItem) => ({
              headline: i.headline,
              sourceName: i.sourceName,
              ageMinutes: i.ageMinutes,
            })),
          }),
        }).then((r) => r.json());
        if (!cancelled) setSignal(sig);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (err) return <div className="card">오류: {err}</div>;
  if (!quote) return <div className="card loading">{symbol} 불러오는 중…</div>;

  const up = quote.change >= 0;
  const sparkData = quote.closes.map((v, i) => ({ i, v }));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="sym">
            {quote.symbol}
            {quote.isDemo && <span className="badge-demo">demo</span>}
          </div>
          <div className="name">{quote.name}</div>
        </div>
        <div>
          <div className="price">
            {quote.currency === "USD" ? "$" : ""}
            {quote.price.toLocaleString()}
            {quote.currency === "KRW" ? "원" : ""}
          </div>
          <div className={`chg ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"} {Math.abs(quote.change).toFixed(2)} ({quote.changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div className="spark">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Line
              type="monotone"
              dataKey="v"
              stroke={up ? "#3ddc84" : "#ff5c5c"}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {signal && (
        <>
          <div className="signal" style={{ color: signal.color }}>
            <span className="signal-dot" />
            {signal.levelLabel}
            <span className="signal-score">{signal.score >= 0 ? "+" : ""}{signal.score}</span>
          </div>
          <div className="breakdown">
            <BdRow label="기술적" v={signal.breakdown.technical.score} />
            <BdRow label="밸류" v={signal.breakdown.valuation.score} />
            <BdRow label="뉴스" v={signal.breakdown.sentiment.score} />
          </div>
          {signal.comment && (
            <div className="comment">
              {signal.comment}
              <div className="comment-src">— {signal.commentSource}</div>
            </div>
          )}
        </>
      )}

      <div className="eyebrow" style={{ margin: "16px 0 4px" }}>
        신뢰소스 뉴스{newsDemo && <span className="badge-demo">demo</span>}
      </div>
      <div className="news-list">
        {news.length === 0 && <div className="loading">최근 신뢰소스 뉴스 없음</div>}
        {news.slice(0, 4).map((n, i) => (
          <a className="news-item" key={i} href={n.url} target="_blank" rel="noopener noreferrer">
            <span className={`fresh-tag fresh-${n.freshness}`}>{n.freshness.toUpperCase()}</span>
            <div>
              <div className="news-head">{n.headline}</div>
              <div className="news-meta">
                <span className={n.sourceTier === 1 ? "tier1" : ""}>{n.sourceName}</span> ·{" "}
                {ageText(n.ageMinutes)} 전
                {n.sourceTier === 1 ? " · TIER-1" : ""}
              </div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <span className="macro-asof">
          시세: {quote.source} · {new Date(quote.asOf).toLocaleTimeString("ko-KR")}
        </span>
        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={onRemove}>
          제거
        </button>
      </div>
    </div>
  );
}

function BdRow({ label, v }: { label: string; v: number }) {
  const pct = Math.abs(v) * 50;
  const color = v >= 0 ? "#3ddc84" : "#ff5c5c";
  return (
    <div className="bd-row">
      <span className="bd-key">{label}</span>
      <span className="bd-bar">
        <span
          className="bd-fill"
          style={{
            background: color,
            width: `${pct}%`,
            left: v >= 0 ? "50%" : `${50 - pct}%`,
          }}
        />
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color, width: 38, textAlign: "right" }}>
        {v >= 0 ? "+" : ""}
        {v.toFixed(2)}
      </span>
    </div>
  );
}
