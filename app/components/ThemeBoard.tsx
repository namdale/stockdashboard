"use client";

const THEMES = [
  {
    rank: "01 · 최우선 컨센서스",
    title: "전력 / 유틸리티 — AI의 진짜 병목은 전기",
    body:
      "AI 랙·반도체의 전력 소모가 극심해 한계 요인이 연산력이 아니라 전기 그 자체로 이동 중. 약 20년간 정체됐던 유틸리티 업계가 발전·송배전 확충을 위한 대규모 CapEx 사이클에 진입. 규제 유틸리티(정해진 수익률)와 시장가 판매가 가능한 독립발전사(IPP) 모두 수혜.",
    tickers: ["NEE", "VST", "CEG", "GEV", "한국 전력기기/변압기"],
  },
  {
    rank: "02",
    title: "구리 / 원자재 — 인프라엔 구리가 필수",
    body:
      "재생에너지·데이터센터 전력 인프라 구축의 수혜. 공급은 제약되는 반면 수요는 증가. 은(silver)도 가치저장 + 산업수요로 상승 여지 거론.",
    tickers: ["FCX", "COPX", "SCCO"],
  },
  {
    rank: "03",
    title: "데이터센터 인프라 · 건설 — '곡괭이와 삽' 우회 플레이",
    body:
      "인프라가 소프트웨어만큼 중요해지며 운영사·냉각·네트워킹 수요 견인. 부지 조성·산업단지 건설 기업은 어느 AI 플랫폼이 이기든 건설 규모·시기에 수혜.",
    tickers: ["DTCR", "VRT", "DLR", "EQIX"],
  },
  {
    rank: "04",
    title: "분산 테마 — 헬스케어 · 로보택시 · 방산",
    body:
      "헬스케어(XLV)는 방어 수요·규제 명확성·AI 생산성으로 구조적 강세. 로보택시(Waymo 확장), 방산·드론(국방예산 집행)도 주목.",
    tickers: ["XLV", "SHLD", "BOTZ"],
  },
];

export function ThemeBoard() {
  return (
    <div>
      {THEMES.map((t) => (
        <div className="theme-card" key={t.rank}>
          <div className="theme-rank">{t.rank}</div>
          <div className="theme-title">{t.title}</div>
          <div className="theme-body">{t.body}</div>
          <div className="theme-tickers">
            {t.tickers.map((tk) => (
              <span className="chip" key={tk}>
                {tk}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="macro-asof" style={{ marginTop: 8 }}>
        출처 종합: Deloitte 2026 반도체 전망 · Fidelity/BlackRock 2026 섹터 전망 · Global X · 아시아경제.
        티커는 테마 예시이며 추천이 아닙니다.
      </div>
    </div>
  );
}
