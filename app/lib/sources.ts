// app/lib/sources.ts
// Curated whitelist of high-trust financial/news sources.
// Only news from these domains is surfaced to the user. Everything else is filtered out.
// This is the core of the "정확하고 신뢰도 높은 소스" requirement.

export interface TrustedSource {
  domain: string;
  name: string;
  tier: 1 | 2; // tier 1 = primary wires/regulators, tier 2 = established financial press
  region: "global" | "us" | "kr";
}

export const TRUSTED_SOURCES: TrustedSource[] = [
  // Tier 1 — wires, exchanges, regulators, central banks
  { domain: "reuters.com", name: "Reuters", tier: 1, region: "global" },
  { domain: "apnews.com", name: "Associated Press", tier: 1, region: "global" },
  { domain: "bloomberg.com", name: "Bloomberg", tier: 1, region: "global" },
  { domain: "sec.gov", name: "U.S. SEC", tier: 1, region: "us" },
  { domain: "federalreserve.gov", name: "Federal Reserve", tier: 1, region: "us" },
  { domain: "bls.gov", name: "U.S. Bureau of Labor Statistics", tier: 1, region: "us" },
  { domain: "fred.stlouisfed.org", name: "FRED (St. Louis Fed)", tier: 1, region: "us" },
  { domain: "bok.or.kr", name: "Bank of Korea", tier: 1, region: "kr" },
  { domain: "krx.co.kr", name: "Korea Exchange", tier: 1, region: "kr" },

  // Tier 2 — established financial press
  { domain: "wsj.com", name: "Wall Street Journal", tier: 2, region: "us" },
  { domain: "ft.com", name: "Financial Times", tier: 2, region: "global" },
  { domain: "cnbc.com", name: "CNBC", tier: 2, region: "us" },
  { domain: "marketwatch.com", name: "MarketWatch", tier: 2, region: "us" },
  { domain: "barrons.com", name: "Barron's", tier: 2, region: "us" },
  { domain: "morningstar.com", name: "Morningstar", tier: 2, region: "global" },
  { domain: "yna.co.kr", name: "Yonhap News", tier: 2, region: "kr" },
  { domain: "mk.co.kr", name: "Maeil Business", tier: 2, region: "kr" },
  { domain: "hankyung.com", name: "Korea Economic Daily", tier: 2, region: "kr" },
  { domain: "sedaily.com", name: "Seoul Economic Daily", tier: 2, region: "kr" },
];

const DOMAIN_MAP = new Map(TRUSTED_SOURCES.map((s) => [s.domain, s]));

/** Returns the TrustedSource if a URL belongs to the whitelist, else null. */
export function matchTrustedSource(url: string): TrustedSource | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, src] of DOMAIN_MAP) {
      if (host === domain || host.endsWith("." + domain)) return src;
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

/** Freshness buckets used to label and rank every data point shown to the user. */
export type Freshness = "live" | "fresh" | "recent" | "stale";

export function freshnessOf(publishedAt: string | number | Date): {
  level: Freshness;
  ageMinutes: number;
} {
  const ts = new Date(publishedAt).getTime();
  const ageMinutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
  let level: Freshness;
  if (ageMinutes <= 15) level = "live";
  else if (ageMinutes <= 60 * 6) level = "fresh";
  else if (ageMinutes <= 60 * 48) level = "recent";
  else level = "stale";
  return { level, ageMinutes };
}

export function formatAge(ageMinutes: number): string {
  if (ageMinutes < 1) return "방금 전";
  if (ageMinutes < 60) return `${ageMinutes}분 전`;
  const h = Math.round(ageMinutes / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return `${d}일 전`;
}
