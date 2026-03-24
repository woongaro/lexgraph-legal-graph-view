# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**LexGraph** — 한국 법률 실무자(변호사, 법무사, 로스쿨 연구자)를 위한 Obsidian 플러그인.
한국어 법률 문서(판결문·계약서·준비서면·법령)를 분석하여 쟁점 중심 지식 그래프로 시각화한다.

- 플러그인 ID: `lexgraph-legal-graph-view`
- 테스트 볼트 경로: `/Users/woongaro/MyProjects/test11/vault/test-vault`

## 빌드 및 개발 명령

```bash
# 개발 (watch 모드)
npm run dev

# 프로덕션 빌드 → main.js + styles.css
npm run build

# 테스트 실행 (jsdom 환경)
npm test

# 테스트 watch 모드
npm run test:watch

# 단일 테스트 파일 실행
npx vitest run src/legal/ai/__tests__/IssueSpotter.test.ts

# 빌드 + 테스트 볼트 배포 (원스텝)
./scripts/deploy-to-vault.sh

# Obsidian 플러그인 재로드 (콘솔에서)
# app.plugins.disablePlugin('lexgraph-legal-graph-view').then(() => app.plugins.enablePlugin('lexgraph-legal-graph-view'))
```

## 아키텍처 개요

### 핵심 데이터 흐름
```
Obsidian 노트 → LegalTextPreprocessor → LocalGraphEngine → LexGraphView → LexGraphApp (React)
                 ↓                        ↓
          LegalEntityExtractor       GraphCanvas.tsx
          CaseCitationParser         IssueTreePanel.tsx
                                     EvidenceMatrix.tsx
                                     PartyRelationPanel.tsx
```

### 중요 설계 결정사항

1. **완전 로컬 그래프 엔진**: `src/graph/LocalGraphEngine.ts`가 InfraNodus API 없이 동작. 공출현(co-occurrence) 행렬 + 레이블 전파(label propagation) 알고리즘으로 토픽 클러스터 생성. `obsidian`은 external로 번들에서 제외됨.

2. **형태소 분석 없음**: 외부 NLP 라이브러리(konlpy 등) 미사용. 규칙 기반 패턴 매칭 + 법률 불용어 사전(`KoreanLegalStopwords.ts`) 방식 채택. Obsidian 플러그인 번들 크기 제약 때문.

3. **AI는 선택적**: `src/ai/LocalAiClient.ts`에서 Gemini/OpenAI/Claude REST API 직접 호출(SDK 없음). `isAiConfigured()` 체크 필수. issue_spotting·counter_argument는 AI 없이 로컬 동작, brief_outline·risk_analysis만 AI 필요.

4. **법률 DB는 공개 API**: 법제처(`MojLawClient.ts`), 대법원(`SupremeCourtClient.ts`) — 별도 인증키 불필요(법제처는 선택적).

### 디렉토리 구조
```
src/
├── main.ts                    # 플러그인 진입점, 커맨드·이벤트 등록
├── settings/                  # LexGraphSettings.ts (타입+기본값), LexGraphSettingTab.tsx
├── views/LexGraphView.tsx     # Obsidian ItemView, runLegalAnalysis() 메서드
├── components/LexGraphApp.tsx # 5탭 React UI (그래프/쟁점/당사자/증거/AI분석)
├── graph/                     # LocalGraphEngine.ts, GraphCanvas.tsx, types.ts
├── ai/LocalAiClient.ts        # 멀티 AI REST 클라이언트
├── legal/
│   ├── preprocessor/          # 텍스트 전처리, 엔티티 추출, 판례 인용 파서
│   ├── ai/                    # 프롬프트 템플릿, 쟁점 탐지, 반박 논거 생성
│   ├── graph/                 # IssueTreePanel, EvidenceMatrix, PartyRelationPanel
│   └── api/                   # 법제처·대법원 API 클라이언트
├── infranodus/                # InfraNodus API 클라이언트 (선택적 연동)
└── utils/graphUtils.ts        # openGraphSideView() 헬퍼
```

### 법률 문서 유형
| 타입 | 설명 |
|------|------|
| `judgment` | 판결문 — 사건번호·법원·당사자·쟁점 추출 |
| `contract` | 계약서 — 조항 구조·위험 조항 감지 |
| `statute` | 법령 — 조문 계층 구조·타 법령 참조 링크 |
| `brief` | 준비서면 — 청구취지·청구원인·항변 분류 |
| `auto` | 자동 감지 (기본값) |

## 테스트

테스트 파일은 `src/**/__tests__/` 아래에 위치. 테스트 커버리지는 `src/legal/**`에만 적용됨.

현재 통과 상태: **48/48** (IssueSpotter 9개, CounterArgumentGen 12개, LegalEntityExtractor, LegalTextPreprocessor, CaseCitationParser)

## 빌드 산출물

- `main.js` — esbuild CJS 번들 (~1.1MB)
- `styles.css` — Tailwind CSS 빌드 (~15KB)
- `manifest.json` — Obsidian 플러그인 메타데이터

**배포 필수 파일 3개**: `main.js`, `styles.css`, `manifest.json`

## AI 협업 (Gemini와 병행)

- Claude 담당: TypeScript 코드, API 클라이언트, 비즈니스 로직
- Gemini 담당: UI 시각 검증, 브라우저 테스트
- 핸드오프: `.agent/shared/HANDOFF.md` (현재 상태), `.agent/shared/GEMINI_TASK.md`
- 동일 파일 동시 수정 방지: Gemini는 `src/` 파일 수정 금지
