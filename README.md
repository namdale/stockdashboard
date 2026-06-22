# Signal — 주식 시그널 콘솔

신뢰 소스 기반 실시간 주식 시그널 대시보드. **GitHub → Vercel** 배포용 Next.js 14 앱이며, PC 웹과 아이폰 홈 화면(PWA) 모두에서 동작합니다.

## 핵심 설계

- **신뢰 소스만**: 뉴스는 사전 정의된 화이트리스트(Reuters, Bloomberg, AP, SEC, Fed, 연합뉴스, 한국경제 등)를 통과한 항목만 표시. 그 외 출처는 자동 제외됩니다. (`app/lib/sources.ts`)
- **항상 최신성 표기**: 모든 데이터에 수집 시각과 신선도 등급(LIVE/FRESH/RECENT/STALE)이 붙습니다.
- **시그널 = 참고용 신호등**: 기술적(40%)+밸류에이션(30%)+뉴스감성(30%)을 종합해 매수/분할매수/중립/비중축소/매도 5단계로 표시. 투자 자문이 아닙니다.
- **API 키 없이도 작동**: 키 미설정 시 데모 데이터로 UI를 그대로 확인할 수 있고, 데모는 `demo` 배지로 명확히 구분됩니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 키 입력(선택)
npm run dev                  # http://localhost:3000
```

## API 키 (전부 무료, 선택사항)

| 키 | 용도 | 발급처 |
|----|------|--------|
| `TWELVE_DATA_API_KEY` | 미국·ETF 시세/차트 | twelvedata.com |
| `FINNHUB_API_KEY` | 종목 뉴스(신뢰소스 필터링) | finnhub.io |
| `FRED_API_KEY` | 금리·CPI·환율·유가 | fred.stlouisfed.org |
| `ANTHROPIC_API_KEY` | Claude 종합 코멘트(선택) | console.anthropic.com |

> **한국 주식(005930.KS 등)은 API 키 없이 작동합니다.** Yahoo Finance를 통해 자동 조회되며 계좌·키·환경변수가 전혀 필요 없습니다. 미국 종목도 `TWELVE_DATA_API_KEY`가 없으면 Yahoo로 자동 대체됩니다. (Yahoo는 약 15분 지연된 시세를 제공합니다.)

## GitHub 올리기

```bash
git init
git add .
git commit -m "Signal stock dashboard"
git branch -M main
git remote add origin https://github.com/<당신아이디>/signal-dashboard.git
git push -u origin main
```

## Vercel 배포

1. vercel.com → **New Project** → 방금 올린 저장소 Import
2. 프레임워크 자동 인식(Next.js) → **Settings → Environment Variables**에 위 키 입력
3. **Deploy** → 끝. `https://<프로젝트>.vercel.app` 주소 생성

## 아이폰 홈 화면 설치

1. 사파리로 배포된 주소 접속
2. 공유 버튼 → **홈 화면에 추가**
3. 네이티브 앱처럼 아이콘으로 실행(전체화면 PWA)

## 폴더 구조

```
app/
  api/quote   시세·52주·일봉 (Twelve Data)
  api/news    종목 뉴스 + 신뢰소스 화이트리스트 필터
  api/macro   금리·CPI·환율·유가 (FRED)
  api/signal  기술적+밸류+감성 종합 시그널 (+Claude 코멘트)
  lib/sources     신뢰소스 목록·신선도 판정
  lib/indicators  RSI·이동평균·시그널 스코어링
  components/      카드·매크로·테마 보드
public/manifest.json + 아이콘  (PWA)
```

## 면책

본 앱의 시그널·코멘트·테마는 공개 데이터와 규칙 기반 분석의 종합으로 **투자 자문이 아닙니다**. 최종 판단과 책임은 사용자에게 있습니다.
