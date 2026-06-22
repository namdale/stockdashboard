// app/api/signal/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  evaluateTechnicals,
  evaluateValuation,
  combineSignal,
  SIGNAL_LABEL,
} from "@/app/lib/indicators";

export const dynamic = "force-dynamic";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

interface SignalRequest {
  symbol: string;
  price: number;
  closes: number[];
  weekHigh52: number;
  weekLow52: number;
  pe?: number | null;
  sectorPe?: number | null;
  newsHeadlines?: { headline: string; sourceName: string; ageMinutes: number }[];
}

// Lightweight lexicon sentiment as a deterministic fallback when no LLM key is set.
function lexiconSentiment(headlines: { headline: string }[]): {
  score: number;
  notes: string[];
} {
  const pos = ["surge", "beat", "record", "growth", "upgrade", "rally", "strong", "profit", "상승", "호조", "최고", "개선"];
  const neg = ["fall", "miss", "cut", "downgrade", "lawsuit", "probe", "weak", "loss", "plunge", "하락", "부진", "악화", "조사"];
  let s = 0;
  let n = 0;
  const notes: string[] = [];
  for (const h of headlines) {
    const t = h.headline.toLowerCase();
    let local = 0;
    for (const w of pos) if (t.includes(w)) local += 1;
    for (const w of neg) if (t.includes(w)) local -= 1;
    if (local !== 0) {
      s += Math.sign(local);
      n++;
    }
  }
  const score = n > 0 ? Math.max(-1, Math.min(1, s / n)) : 0;
  if (n === 0) notes.push("감성 신호 없음(중립)");
  else notes.push(`뉴스 ${n}건 기준 감성 ${score > 0 ? "긍정" : score < 0 ? "부정" : "중립"}`);
  return { score, notes };
}

async function claudeAnalysis(req: SignalRequest, signalSummary: string): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null;
  try {
    const headlines = (req.newsHeadlines || [])
      .slice(0, 8)
      .map((h) => `- (${h.sourceName}, ${h.ageMinutes}분 전) ${h.headline}`)
      .join("\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `당신은 신중한 애널리스트입니다. 아래 데이터만 근거로, ${req.symbol}에 대해 한국어 2~3문장으로 현재 상황을 객관적으로 요약하세요. 단정적 투자권유는 피하고 근거를 명시하세요.\n\n종합 시그널: ${signalSummary}\n현재가: ${req.price}\n최근 신뢰소스 뉴스:\n${headlines || "(없음)"}`,
          },
        ],
      }),
    });
    const data = await res.json();
    const text = (data.content || [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SignalRequest;
  if (!body.symbol || !Array.isArray(body.closes)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const tech = evaluateTechnicals({
    closes: body.closes,
    price: body.price,
    weekHigh52: body.weekHigh52,
    weekLow52: body.weekLow52,
  });
  const val = evaluateValuation({ pe: body.pe, sectorPe: body.sectorPe });
  const sent = lexiconSentiment(body.newsHeadlines || []);

  const combined = combineSignal({
    technical: tech.score,
    valuation: val.score,
    sentiment: sent.score,
  });

  const label = SIGNAL_LABEL[combined.level];
  const signalSummary = `${label.ko} (점수 ${combined.score.toFixed(2)})`;
  const comment = await claudeAnalysis(body, signalSummary);

  return NextResponse.json({
    symbol: body.symbol,
    level: combined.level,
    levelLabel: label.ko,
    color: label.color,
    score: Number(combined.score.toFixed(3)),
    breakdown: {
      technical: { score: Number(tech.score.toFixed(3)), notes: tech.notes, rsi: tech.rsi, sma20: tech.sma20, sma60: tech.sma60 },
      valuation: { score: Number(val.score.toFixed(3)), notes: val.notes },
      sentiment: { score: Number(sent.score.toFixed(3)), notes: sent.notes },
    },
    comment,
    commentSource: comment ? "Claude (claude-sonnet-4-6)" : "rule-based (ANTHROPIC_API_KEY 미설정)",
    evaluatedAt: new Date().toISOString(),
    disclaimer: "본 시그널은 참고용이며 투자 자문이 아닙니다. 최종 판단과 책임은 사용자에게 있습니다.",
  });
}
