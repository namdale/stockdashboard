// app/api/news/route.ts
import { NextRequest, NextResponse } from "next/server";
import { matchTrustedSource, freshnessOf } from "@/app/lib/sources";

export const dynamic = "force-dynamic";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

interface NewsItem {
  headline: string;
  url: string;
  sourceName: string;
  sourceTier: 1 | 2;
  publishedAt: string;
  ageMinutes: number;
  freshness: string;
  summary: string;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

async function fetchFinnhub(symbol: string): Promise<NewsItem[]> {
  const from = isoDaysAgo(7);
  const to = isoDaysAgo(0);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
    symbol
  )}&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  const items: NewsItem[] = [];
  for (const a of raw) {
    if (!a.url || !a.headline) continue;
    // CORE FILTER: only whitelisted trusted sources survive.
    const trusted = matchTrustedSource(a.url);
    if (!trusted) continue;
    const publishedAt = new Date((a.datetime || 0) * 1000).toISOString();
    const f = freshnessOf(publishedAt);
    items.push({
      headline: a.headline,
      url: a.url,
      sourceName: trusted.name,
      sourceTier: trusted.tier,
      publishedAt,
      ageMinutes: f.ageMinutes,
      freshness: f.level,
      summary: a.summary || "",
    });
  }
  // Newest first, tier-1 prioritized on ties.
  items.sort((a, b) => {
    const t = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (Math.abs(t) > 3600000) return t;
    return a.sourceTier - b.sourceTier;
  });
  return items.slice(0, 12);
}

function demoNews(symbol: string): NewsItem[] {
  const now = Date.now();
  const seeds = [
    { name: "Reuters", tier: 1 as const, domain: "reuters.com", min: 25 },
    { name: "Bloomberg", tier: 1 as const, domain: "bloomberg.com", min: 180 },
    { name: "CNBC", tier: 2 as const, domain: "cnbc.com", min: 600 },
    { name: "Yonhap News", tier: 2 as const, domain: "yna.co.kr", min: 1500 },
  ];
  return seeds.map((s) => {
    const publishedAt = new Date(now - s.min * 60000).toISOString();
    const f = freshnessOf(publishedAt);
    return {
      headline: `[데모] ${symbol} 관련 ${s.name} 헤드라인 예시`,
      url: `https://${s.domain}/`,
      sourceName: s.name,
      sourceTier: s.tier,
      publishedAt,
      ageMinutes: f.ageMinutes,
      freshness: f.level,
      summary:
        "FINNHUB_API_KEY를 설정하면 실제 신뢰 소스 뉴스로 대체됩니다. 데모 데이터는 신선도/정렬 UI 확인용입니다.",
    };
  });
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }
  try {
    const items = FINNHUB_KEY ? await fetchFinnhub(symbol) : demoNews(symbol);
    return NextResponse.json({
      symbol,
      items,
      isDemo: !FINNHUB_KEY,
      fetchedAt: new Date().toISOString(),
      note: "신뢰 소스 화이트리스트를 통과한 뉴스만 표시됩니다.",
    });
  } catch (e: any) {
    const items = demoNews(symbol);
    return NextResponse.json({
      symbol,
      items,
      isDemo: true,
      fetchedAt: new Date().toISOString(),
      note: `provider error: ${e.message} — 데모로 대체`,
    });
  }
}
