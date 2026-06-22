// app/api/quote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getYahooQuote } from "@/app/lib/yahoo";

// Runs on Node.js (Yahoo needs a real User-Agent header; no edge constraints).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TD_KEY = process.env.TWELVE_DATA_API_KEY;

/** Korean tickers are written with a .KS (KOSPI) or .KQ (KOSDAQ) suffix. */
function isKoreanTicker(symbol: string): boolean {
  return /\.(KS|KQ)$/i.test(symbol);
}

interface QuotePayload {
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

// Deterministic demo series so the app is usable before API keys are configured.
function demoQuote(symbol: string): QuotePayload {
  let seed = 0;
  for (const c of symbol) seed += c.charCodeAt(0);
  const base = 40 + (seed % 160);
  const closes: number[] = [];
  let p = base;
  for (let i = 0; i < 90; i++) {
    const wave = Math.sin((i + seed) / 6) * base * 0.04;
    const drift = (((seed * (i + 1)) % 7) - 3) * base * 0.006;
    p = Math.max(1, base + wave + drift + i * base * 0.002);
    closes.push(Number(p.toFixed(2)));
  }
  const price = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const high = Math.max(...closes) * 1.05;
  const low = Math.min(...closes) * 0.95;
  return {
    symbol,
    name: symbol,
    price,
    change: Number((price - prev).toFixed(2)),
    changePercent: Number((((price - prev) / prev) * 100).toFixed(2)),
    currency: "USD",
    weekHigh52: Number(high.toFixed(2)),
    weekLow52: Number(low.toFixed(2)),
    closes,
    asOf: new Date().toISOString(),
    source: "demo",
    isDemo: true,
  };
}

async function fetchTwelveData(symbol: string): Promise<QuotePayload> {
  // Time series for indicators
  const tsUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=1day&outputsize=90&apikey=${TD_KEY}`;
  const qUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
    symbol
  )}&apikey=${TD_KEY}`;

  const [tsRes, qRes] = await Promise.all([fetch(tsUrl), fetch(qUrl)]);
  const ts = await tsRes.json();
  const q = await qRes.json();

  if (ts.status === "error" || q.status === "error") {
    throw new Error(q.message || ts.message || "Twelve Data error");
  }

  const closes: number[] = (ts.values || [])
    .map((v: any) => parseFloat(v.close))
    .reverse();

  const price = parseFloat(q.close);
  return {
    symbol,
    name: q.name || symbol,
    price,
    change: parseFloat(q.change),
    changePercent: parseFloat(q.percent_change),
    currency: q.currency || "USD",
    weekHigh52: parseFloat(q.fifty_two_week?.high ?? "0"),
    weekLow52: parseFloat(q.fifty_two_week?.low ?? "0"),
    closes,
    asOf: new Date().toISOString(),
    source: "Twelve Data",
    isDemo: false,
  };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  // Korean tickers (.KS/.KQ) → Yahoo Finance (no key needed, handles KRW).
  if (isKoreanTicker(symbol)) {
    try {
      return NextResponse.json(await getYahooQuote(symbol));
    } catch (e: any) {
      const fallback = demoQuote(symbol);
      fallback.currency = "KRW";
      fallback.source = `demo (Yahoo 오류: ${e.message})`;
      return NextResponse.json(fallback);
    }
  }

  // US / ETF / others: prefer Twelve Data if a key is set, else Yahoo, else demo.
  try {
    if (TD_KEY) return NextResponse.json(await fetchTwelveData(symbol));
    return NextResponse.json(await getYahooQuote(symbol));
  } catch (e: any) {
    // Twelve Data failed or wasn't set — try Yahoo before giving up to demo.
    try {
      return NextResponse.json(await getYahooQuote(symbol));
    } catch {
      const fallback = demoQuote(symbol);
      fallback.source = `demo (provider error: ${e.message})`;
      return NextResponse.json(fallback);
    }
  }
}
