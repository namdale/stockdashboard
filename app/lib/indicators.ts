// app/lib/indicators.ts
// Pure technical-analysis math. No network calls. Used by the signal engine.

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** 52-week position as 0..1 (0 = at low, 1 = at high). */
export function rangePosition(
  current: number,
  low: number,
  high: number
): number | null {
  if (high <= low) return null;
  return Math.min(1, Math.max(0, (current - low) / (high - low)));
}

export interface TechnicalInputs {
  closes: number[]; // chronological, oldest -> newest
  price: number;
  weekHigh52: number;
  weekLow52: number;
}

export interface TechnicalResult {
  rsi: number | null;
  sma20: number | null;
  sma60: number | null;
  pricePosition: number | null; // 52w range position 0..1
  score: number; // -1 .. +1 (bearish .. bullish)
  notes: string[];
}

export function evaluateTechnicals(t: TechnicalInputs): TechnicalResult {
  const r = rsi(t.closes);
  const s20 = sma(t.closes, 20);
  const s60 = sma(t.closes, 60);
  const pos = rangePosition(t.price, t.weekLow52, t.weekHigh52);
  const notes: string[] = [];
  let score = 0;
  let parts = 0;

  if (r !== null) {
    parts++;
    if (r < 30) {
      score += 0.8;
      notes.push(`RSI ${r.toFixed(0)} — 과매도 구간`);
    } else if (r > 70) {
      score -= 0.8;
      notes.push(`RSI ${r.toFixed(0)} — 과매수 구간`);
    } else {
      score += (50 - r) / 50 * 0.3;
      notes.push(`RSI ${r.toFixed(0)} — 중립`);
    }
  }

  if (s20 !== null && s60 !== null) {
    parts++;
    if (s20 > s60) {
      score += 0.5;
      notes.push("20일선 > 60일선 (단기 상승추세)");
    } else {
      score -= 0.5;
      notes.push("20일선 < 60일선 (단기 하락추세)");
    }
  }

  if (pos !== null) {
    parts++;
    if (pos > 0.85) {
      score -= 0.3;
      notes.push("52주 고점 부근 — 추격매수 부담");
    } else if (pos < 0.2) {
      score += 0.4;
      notes.push("52주 저점 부근 — 낙폭과대 가능");
    }
  }

  const normalized = parts > 0 ? Math.max(-1, Math.min(1, score / parts)) : 0;
  return { rsi: r, sma20: s20, sma60: s60, pricePosition: pos, score: normalized, notes };
}

export interface ValuationInputs {
  pe?: number | null;
  sectorPe?: number | null;
  pb?: number | null;
}

export function evaluateValuation(v: ValuationInputs): {
  score: number;
  notes: string[];
} {
  const notes: string[] = [];
  let score = 0;
  let parts = 0;
  if (v.pe != null && v.sectorPe != null && v.sectorPe > 0) {
    parts++;
    const ratio = v.pe / v.sectorPe;
    if (ratio < 0.8) {
      score += 0.6;
      notes.push(`PER ${v.pe.toFixed(1)} — 업종평균 대비 저평가`);
    } else if (ratio > 1.25) {
      score -= 0.6;
      notes.push(`PER ${v.pe.toFixed(1)} — 업종평균 대비 고평가`);
    } else {
      notes.push(`PER ${v.pe.toFixed(1)} — 업종평균 수준`);
    }
  }
  const normalized = parts > 0 ? Math.max(-1, Math.min(1, score / parts)) : 0;
  return { score: normalized, notes };
}

export type SignalLevel = "buy" | "accumulate" | "hold" | "reduce" | "sell";

export function combineSignal(parts: {
  technical: number; // -1..1
  valuation: number; // -1..1
  sentiment: number; // -1..1
  weights?: { technical: number; valuation: number; sentiment: number };
}): { score: number; level: SignalLevel } {
  const w = parts.weights ?? { technical: 0.4, valuation: 0.3, sentiment: 0.3 };
  const total =
    parts.technical * w.technical +
    parts.valuation * w.valuation +
    parts.sentiment * w.sentiment;
  let level: SignalLevel;
  if (total >= 0.5) level = "buy";
  else if (total >= 0.2) level = "accumulate";
  else if (total > -0.2) level = "hold";
  else if (total > -0.5) level = "reduce";
  else level = "sell";
  return { score: total, level };
}

export const SIGNAL_LABEL: Record<SignalLevel, { ko: string; color: string }> = {
  buy: { ko: "매수 우위", color: "#16a34a" },
  accumulate: { ko: "분할매수", color: "#65a30d" },
  hold: { ko: "중립/보유", color: "#a16207" },
  reduce: { ko: "비중축소", color: "#ea580c" },
  sell: { ko: "매도 우위", color: "#dc2626" },
};
