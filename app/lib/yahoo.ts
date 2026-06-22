// app/lib/yahoo.ts
// Yahoo Finance v8 chart endpoint client. No API key required.
// Works for Korean (.KS / .KQ), US, ETF, index, and crypto symbols in a single request.
// Note: Yahoo publishes no official API; the v8 chart endpoint powers their site and has
// been stable for years, but a User-Agent header is required to avoid being blocked.

export interface YahooQuote {
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

const HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Fetch from Yahoo, trying both load-balanced hosts for resilience. */
async function yahooFetch(path: string): Promise<any> {
  let lastErr: any;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        lastErr = new Error(`Yahoo HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Yahoo 요청 실패");
}

export async function getYahooQuote(symbol: string): Promise<YahooQuote> {
  // 6 months of daily candles gives enough history for RSI/SMA60.
  const data = await yahooFetch(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`
  );

  const result = data?.chart?.result?.[0];
  if (!result) {
    const msg = data?.chart?.error?.description || "데이터 없음";
    throw new Error(msg);
  }

  const meta = result.meta || {};
  const quoteBlock = result.indicators?.quote?.[0] || {};
  const rawCloses: (number | null)[] = quoteBlock.close || [];
  // Yahoo can include null entries (holidays/halts); drop them.
  const closes = rawCloses.filter((c): c is number => typeof c === "number");

  const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? closes[closes.length - 2] ?? price;
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;

  return {
    symbol,
    name: meta.longName || meta.shortName || symbol,
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    currency: meta.currency || "USD",
    weekHigh52: Number((meta.fiftyTwoWeekHigh ?? Math.max(...closes, price)).toFixed(2)),
    weekLow52: Number((meta.fiftyTwoWeekLow ?? Math.min(...closes, price)).toFixed(2)),
    closes: closes.length ? closes : [price],
    asOf: new Date().toISOString(),
    source: "Yahoo Finance",
    isDemo: false,
  };
}
