// app/api/fx/route.ts
// Exchange rates for converting holdings into a single base currency (NZD).
// Uses ExchangeRate-API open access (no key). Falls back to reasonable demo rates.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface FxResponse {
  // How many NZD one unit of the currency is worth.
  nzdPer: Record<string, number>;
  asOf: string;
  source: string;
  isDemo: boolean;
}

const DEMO: FxResponse = {
  nzdPer: { NZD: 1, USD: 1.64, KRW: 0.00119 },
  asOf: new Date().toISOString().slice(0, 10),
  source: "demo",
  isDemo: true,
};

export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const usdToKrw = data?.rates?.KRW;
    const usdToNzd = data?.rates?.NZD;
    if (!usdToKrw || !usdToNzd) return NextResponse.json(DEMO);

    // NZD value of 1 unit of each currency.
    const nzdPerUsd = usdToNzd; // 1 USD = usdToNzd NZD
    const nzdPerKrw = usdToNzd / usdToKrw; // 1 KRW = (NZD/USD)/(KRW/USD)
    return NextResponse.json({
      nzdPer: { NZD: 1, USD: Number(nzdPerUsd.toFixed(6)), KRW: Number(nzdPerKrw.toFixed(8)) },
      asOf: (data.time_last_update_utc || "").slice(0, 16) || new Date().toISOString().slice(0, 10),
      source: "ExchangeRate-API",
      isDemo: false,
    } as FxResponse);
  } catch {
    return NextResponse.json(DEMO);
  }
}
