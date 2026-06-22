"use client";

import { useEffect, useState } from "react";
import type { Holding } from "../page";

interface FxData {
  nzdPer: Record<string, number>;
  asOf: string;
  source: string;
  isDemo: boolean;
}

interface Totals {
  valueNzd: number;
  costNzd: number;
  ready: boolean;
}

export function PortfolioSummary({
  symbols,
  holdings,
  hidePnl,
}: {
  symbols: string[];
  holdings: Record<string, Holding>;
  hidePnl: boolean;
}) {
  const [fx, setFx] = useState<FxData | null>(null);
  const [totals, setTotals] = useState<Totals>({ valueNzd: 0, costNzd: 0, ready: false });

  // Only symbols that actually have a holding entered are worth pricing.
  const held = symbols.filter(
    (s) => holdings[s] && holdings[s].shares > 0 && holdings[s].avgCost > 0
  );
  const heldKey = held.join(",");

  useEffect(() => {
    fetch("/api/fx")
      .then((r) => r.json())
      .then(setFx)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!fx || held.length === 0) {
      setTotals({ valueNzd: 0, costNzd: 0, ready: held.length === 0 });
      return;
    }
    let cancelled = false;
    async function compute() {
      let valueNzd = 0;
      let costNzd = 0;
      await Promise.all(
        held.map(async (s) => {
          try {
            const q = await fetch(`/api/quote?symbol=${encodeURIComponent(s)}`).then((r) => r.json());
            const h = holdings[s];
            const rate = fx!.nzdPer[q.currency] ?? null;
            if (rate == null) return; // unknown currency — skip rather than mislead
            valueNzd += q.price * h.shares * rate;
            costNzd += h.avgCost * h.shares * rate;
          } catch {
            /* skip on error */
          }
        })
      );
      if (!cancelled) setTotals({ valueNzd, costNzd, ready: true });
    }
    compute();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, heldKey]);

  if (held.length === 0) return null;

  const retAmt = totals.valueNzd - totals.costNzd;
  const retPct = totals.costNzd > 0 ? (retAmt / totals.costNzd) * 100 : 0;
  const gain = retAmt >= 0;
  const nz = (n: number) =>
    `NZ$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const mask = "••••";

  return (
    <div className="summary-card">
      <div className="summary-head">
        <span className="summary-title">전체 포트폴리오 (NZD 환산)</span>
        <span className="summary-fx">
          {fx?.isDemo ? "demo 환율" : `환율 ${fx?.source}`}
          {fx && !fx.isDemo && fx.nzdPer.USD ? ` · 1 USD = NZ$${fx.nzdPer.USD.toFixed(3)}` : ""}
        </span>
      </div>

      {!totals.ready ? (
        <div className="summary-loading">환산 중…</div>
      ) : (
        <div className="summary-grid">
          <div className="summary-item">
            <div className="si-label">평가금액</div>
            <div className="si-value">{hidePnl ? mask : nz(totals.valueNzd)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">투자원금</div>
            <div className="si-value">{hidePnl ? mask : nz(totals.costNzd)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">총 수익</div>
            <div
              className="si-value"
              style={{ color: hidePnl ? undefined : gain ? "#ff4d4d" : "#3d7bff" }}
            >
              {hidePnl ? mask : `${gain ? "+" : ""}${nz(retAmt)}`}
            </div>
          </div>
          <div className="summary-item">
            <div className="si-label">총 수익률</div>
            <div
              className="si-value"
              style={{ color: hidePnl ? undefined : gain ? "#ff4d4d" : "#3d7bff" }}
            >
              {hidePnl ? mask : `${gain ? "+" : ""}${retPct.toFixed(2)}%`}
            </div>
          </div>
        </div>
      )}
      <div className="summary-note">
        {held.length}개 보유 종목을 NZD로 환산 · 원화·달러 자동 변환
      </div>
    </div>
  );
}
