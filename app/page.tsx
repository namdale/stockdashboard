"use client";

import { useEffect, useState, useCallback } from "react";
import { HoldingCard } from "./components/HoldingCard";
import { MacroStrip } from "./components/MacroStrip";
import { ThemeBoard } from "./components/ThemeBoard";
import { PortfolioSummary } from "./components/PortfolioSummary";
import { PerformanceChart, recordSnapshot } from "./components/PerformanceChart";

const DEFAULT_SYMBOLS = ["NVDA", "AAPL", "005930.KS"];
const STORAGE_KEY = "signal.symbols";
const HOLDINGS_KEY = "signal.holdings";
const HIDE_KEY = "signal.hidePnl";

export interface Holding {
  shares: number;
  avgCost: number;
}

export default function Page() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [now, setNow] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Record<string, Holding>>({});
  const [hidePnl, setHidePnl] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      setSymbols(Array.isArray(saved) && saved.length ? saved : DEFAULT_SYMBOLS);
    } catch {
      setSymbols(DEFAULT_SYMBOLS);
    }
    try {
      const h = JSON.parse(localStorage.getItem(HOLDINGS_KEY) || "{}");
      if (h && typeof h === "object") setHoldings(h);
    } catch {
      /* ignore */
    }
    setHidePnl(localStorage.getItem(HIDE_KEY) === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings));
  }, [holdings]);

  useEffect(() => {
    localStorage.setItem(HIDE_KEY, hidePnl ? "1" : "0");
  }, [hidePnl]);

  const setHolding = useCallback((symbol: string, h: Holding | null) => {
    setHoldings((prev) => {
      const next = { ...prev };
      if (h && (h.shares > 0 || h.avgCost > 0)) next[symbol] = h;
      else delete next[symbol];
      return next;
    });
  }, []);

  useEffect(() => {
    if (symbols.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const add = useCallback(() => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    setSymbols((prev) => (prev.includes(s) ? prev : [...prev, s]));
    setInput("");
  }, [input]);

  const remove = useCallback((s: string) => {
    setSymbols((prev) => prev.filter((x) => x !== s));
  }, []);

  // Move a card from one position to another (used by drag-drop and arrow buttons).
  const reorder = useCallback((from: number, to: number) => {
    setSymbols((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDrop = useCallback(
    (to: number) => {
      if (dragIndex !== null) reorder(dragIndex, to);
      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex, reorder]
  );

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              SIG<span>∎</span>NAL
            </div>
            <div className="brand-sub">신뢰소스 · 최신성 기반 시그널 콘솔</div>
          </div>
          <div className="clock">{now} KST</div>
        </div>
      </div>

      <div className="wrap">
        <MacroStrip />

        <div className="eyebrow">보유 종목 추가</div>
        <div className="add-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="티커 입력 — 예: NVDA, MSFT, 005930.KS (한국주식은 .KS)"
          />
          <button className="btn" onClick={add}>
            추가
          </button>
        </div>

        <div className="eyebrow port-head">
          <span>포트폴리오 · {symbols.length}종목</span>
          <button
            className="hide-toggle"
            onClick={() => setHidePnl((v) => !v)}
            title={hidePnl ? "수익 정보 표시" : "수익 정보 숨기기"}
          >
            {hidePnl ? "👁 수익 보기" : "🙈 수익 숨기기"}
          </button>
        </div>
        <PortfolioSummary
          symbols={symbols}
          holdings={holdings}
          hidePnl={hidePnl}
          onTotals={(t) => recordSnapshot(t.valueNzd, t.costNzd)}
        />
        <PerformanceChart hidePnl={hidePnl} />
        {symbols.length === 0 ? (
          <div className="empty">티커를 추가하면 시세·뉴스·시그널이 표시됩니다.</div>
        ) : (
          <>
            <div className="reorder-hint">⠿ 핸들을 드래그해서 종목 순서를 바꿀 수 있어요</div>
            <div className="grid">
              {symbols.map((s, i) => (
                <div
                  key={s}
                  className={
                    "card-slot" +
                    (dragIndex === i ? " dragging" : "") +
                    (overIndex === i && dragIndex !== i ? " drop-target" : "")
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overIndex !== i) setOverIndex(i);
                  }}
                  onDrop={() => handleDrop(i)}
                >
                  <span
                    className="drag-handle"
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    title="드래그하여 순서 변경"
                    aria-label="드래그하여 순서 변경"
                  >
                    ⠿
                  </span>
                  <HoldingCard
                    symbol={s}
                    onRemove={() => remove(s)}
                    holding={holdings[s] || null}
                    hidePnl={hidePnl}
                    onHoldingChange={(h) => setHolding(s, h)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="eyebrow">AI 반도체 다음 호황 · 테마 리서치</div>
        <ThemeBoard />

        <div className="disclaimer">
          본 대시보드의 시그널·코멘트는 공개 데이터와 규칙 기반 분석을 종합한 <b>참고 자료</b>이며
          투자 자문이 아닙니다. 뉴스는 사전 정의된 신뢰 소스 화이트리스트(Reuters, Bloomberg, AP, SEC,
          Fed, 연합뉴스 등)를 통과한 항목만 표시되며, 모든 데이터에는 수집 시각·신선도가 표기됩니다.
          최종 투자 판단과 책임은 사용자에게 있습니다.
        </div>
      </div>
    </>
  );
}
