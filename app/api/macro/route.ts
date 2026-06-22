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
}

const SERIES: { id: string; label: string; unit: string }[] = [
  { id: "DGS10", label: "美 10년 국채 금리", unit: "%" },
  { id: "DGS2", label: "美 2년 국채 금리", unit: "%" },
  { id: "FEDFUNDS", label: "연방기금금리", unit: "%" },
  { id: "CPIAUCSL", label: "미국 CPI(지수)", unit: "" },
  { id: "DEXKOUS", label: "원/달러 환율", unit: "₩" },
  { id: "DCOILWTICO", label: "WTI 유가", unit: "$" },
];

async function fetchSeries(id: string): Promise<{ value: number | null; asOf: string | null }> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const data = await res.json();
  const obs = data?.observations?.[0];
  if (!obs || obs.value === ".") return { value: null, asOf: obs?.date ?? null };
  return { value: parseFloat(obs.value), asOf: obs.date };
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
    CPIAUCSL: 320.4,
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
  }));
}

const NZDKRW_DEMO: MacroSeries = {
  id: "NZDKRW",
  label: "원/뉴질랜드달러",
  value: 838.5,
  unit: "₩",
  asOf: new Date().toISOString().slice(0, 10),
  source: "demo",
};

export async function GET() {
  // NZD/KRW always comes from ExchangeRate-API (no key), independent of FRED.
  const nzdKrwPromise = fetchNzdKrw();

  if (!FRED_KEY) {
    const nzdKrw = await nzdKrwPromise;
    // Use live NZD/KRW even when FRED isn't configured; rest is demo.
    const series = [...demoMacro(), nzdKrw.value != null ? nzdKrw : NZDKRW_DEMO];
    return NextResponse.json({ series, isDemo: true, fetchedAt: new Date().toISOString() });
  }
  try {
    const [results, nzdKrw] = await Promise.all([
      Promise.all(
        SERIES.map(async (s) => {
          const { value, asOf } = await fetchSeries(s.id);
          return { id: s.id, label: s.label, value, unit: s.unit, asOf, source: "FRED" } as MacroSeries;
        })
      ),
      nzdKrwPromise,
    ]);
    const series = [...results, nzdKrw.value != null ? nzdKrw : NZDKRW_DEMO];
    return NextResponse.json({ series, isDemo: false, fetchedAt: new Date().toISOString() });
  } catch (e: any) {
    const nzdKrw = await nzdKrwPromise.catch(() => NZDKRW_DEMO);
    const series = [...demoMacro(), nzdKrw.value != null ? nzdKrw : NZDKRW_DEMO];
    return NextResponse.json({ series, isDemo: true, error: e.message, fetchedAt: new Date().toISOString() });
  }
}
