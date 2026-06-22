// app/api/macro/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FRED_KEY = process.env.FRED_API_KEY;

interface MacroSeries {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  asOf: string | null;
  source: string;
  url: string;
}

const SERIES: { id: string; label: string; unit: string }[] = [
  { id: "DGS10", label: "美 10년 국채 금리", unit: "%" },
  { id: "DGS2", label: "美 2년 국채 금리", unit: "%" },
  { id: "FEDFUNDS", label: "연방기금금리", unit: "%" },
  { id: "CPIAUCSL", label: "미국 CPI(YoY)", unit: "%" },
  { id: "DEXKOUS", label: "원/달러 환율", unit: "₩" },
  { id: "DCOILWTICO", label: "WTI 유가", unit: "$" },
];

// Source page each metric links to when clicked.
const SOURCE_URL: Record<string, string> = {
  DGS10: "https://fred.stlouisfed.org/series/DGS10",
  DGS2: "https://fred.stlouisfed.org/series/DGS2",
  FEDFUNDS: "https://fred.stlouisfed.org/series/FEDFUNDS",
  CPIAUCSL: "https://fred.stlouisfed.org/series/CPIAUCSL",
  DEXKOUS: "https://fred.stlouisfed.org/series/DEXKOUS",
  DCOILWTICO: "https://fred.stlouisfed.org/series/DCOILWTICO",
  NZDKRW: "https://www.google.com/finance/quote/NZD-KRW",
};

async function fetchSeries(id: string): Promise<{ value: number | null; asOf: string | null }> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const data = await res.json();
  const obs = data?.observations?.[0];
  if (!obs || obs.value === ".") return { value: null, asOf: obs?.date ?? null };
  return { value: parseFloat(obs.value), asOf: obs.date };
}

/**
 * CPI as a year-over-year inflation rate (%), which is what people mean by "CPI".
 * The raw CPIAUCSL series is an index level (~320), so we pull 13 months and compare
 * the latest month to the same month a year earlier.
 */
async function fetchCpiYoY(): Promise<{ value: number | null; asOf: string | null }> {
  // Pull 18 months so we always have a data point ~12 months before the latest,
  // even with FRED's publication lag or occasional gaps.
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=18`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const data = await res.json();
  const obs = (data?.observations || []).filter((o: any) => o.value !== ".");
  if (obs.length < 2) {
    return { value: null, asOf: obs[0]?.date ?? null };
  }
  const latest = parseFloat(obs[0].value);
  // Prefer the entry ~12 months back; if not present, use the oldest we have.
  const yearAgoObs = obs[12] ?? obs[obs.length - 1];
  const yearAgo = parseFloat(yearAgoObs.value);
  if (!yearAgo) return { value: null, asOf: obs[0].date };
  const yoy = ((latest - yearAgo) / yearAgo) * 100;
  return { value: Number(yoy.toFixed(1)), asOf: obs[0].date };
}

/**
 * NZD→KRW via ExchangeRate-API open access (no key required).
 * There's no direct NZD/KRW series, so we read USD-based rates and cross-compute:
 * KRW per NZD = (KRW per USD) / (NZD per USD).
 * Cached 1h to stay well under the open endpoint's rate limit.
 */
async function fetchNzdKrw(): Promise<MacroSeries> {
  const base: MacroSeries = {
    id: "NZDKRW",
    label: "원/뉴질랜드달러",
    value: null,
    unit: "₩",
    asOf: null,
    source: "ExchangeRate-API",
    url: SOURCE_URL.NZDKRW,
  };
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const krwPerUsd = data?.rates?.KRW;
    const nzdPerUsd = data?.rates?.NZD;
    if (krwPerUsd && nzdPerUsd) {
      base.value = Number((krwPerUsd / nzdPerUsd).toFixed(2));
      // er-api returns last-update timestamps; prefer the UTC date string.
      base.asOf = (data.time_last_update_utc || "").slice(0, 16) || new Date().toISOString().slice(0, 10);
    }
  } catch (e: any) {
    base.source = `ExchangeRate-API 오류: ${e.message}`;
  }
  return base;
}

function demoMacro(): MacroSeries[] {
  const today = new Date().toISOString().slice(0, 10);
  const vals: Record<string, number> = {
    DGS10: 4.21,
    DGS2: 3.86,
    FEDFUNDS: 4.0,
    CPIAUCSL: 2.9,
    DEXKOUS: 1372.5,
    DCOILWTICO: 68.9,
  };
  return SERIES.map((s) => ({
    id: s.id,
    label: s.label,
    value: vals[s.id],
    unit: s.unit,
    asOf: today,
    source: "demo (FRED 키 미설정)",
    url: SOURCE_URL[s.id] || "",
  }));
}

const NZDKRW_DEMO: MacroSeries = {
  id: "NZDKRW",
  label: "원/뉴질랜드달러",
  value: 838.5,
  unit: "₩",
  asOf: new Date().toISOString().slice(0, 10),
  source: "demo",
  url: SOURCE_URL.NZDKRW,
};

export async function GET() {
  // NZD/KRW always comes from ExchangeRate-API (no key), independent of FRED.
  const nzdKrwPromise = fetchNzdKrw();

  // Reorders the strip so WTI oil is last, with NZD/KRW just before it.
  function order(base: MacroSeries[], nzdKrw: MacroSeries): MacroSeries[] {
    const oil = base.filter((s) => s.id === "DCOILWTICO");
    const rest = base.filter((s) => s.id !== "DCOILWTICO");
    return [...rest, nzdKrw, ...oil];
  }

  if (!FRED_KEY) {
    const nzdKrw = await nzdKrwPromise;
    const series = order(demoMacro(), nzdKrw.value != null ? nzdKrw : NZDKRW_DEMO);
    return NextResponse.json({ series, isDemo: true, fetchedAt: new Date().toISOString() });
  }
  try {
    const [results, nzdKrw] = await Promise.all([
      Promise.all(
        SERIES.map(async (s) => {
          const { value, asOf } =
            s.id === "CPIAUCSL" ? await fetchCpiYoY() : await fetchSeries(s.id);
          return { id: s.id, label: s.label, value, unit: s.unit, asOf, source: "FRED", url: SOURCE_URL[s.id] || "" } as MacroSeries;
        })
      ),
      nzdKrwPromise,
    ]);
    const series = order(results, nzdKrw.value != null ? nzdKrw : NZDKRW_DEMO);
    return NextResponse.json({ series, isDemo: false, fetchedAt: new Date().toISOString() });
  } catch (e: any) {
    const nzdKrw = await nzdKrwPromise.catch(() => NZDKRW_DEMO);
    const series = order(demoMacro(), nzdKrw.value != null ? nzdKrw : NZDKRW_DEMO);
    return NextResponse.json({ series, isDemo: true, error: e.message, fetchedAt: new Date().toISOString() });
  }
}
