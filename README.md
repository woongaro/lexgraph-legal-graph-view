# LexGraph — Korean Legal AI Graph View for Obsidian

Analyze Korean legal documents using [InfraNodus](https://infranodus.com) knowledge graphs. Automatically detects legal issues, generates counter-arguments, and visualizes party relationships for judgments, contracts, and statutes.

> **대상 사용자**: 한국 법률 전문가, 변호사, 법학 연구자

---

## 주요 기능

| 탭 | 기능 |
|----|------|
| 그래프 | InfraNodus 지식 그래프 — 핵심 개념 클러스터·구조적 공백 시각화 |
| 쟁점 | 판결문·계약서에서 법률 쟁점 자동 탐지 (민법·형법·행정법 패턴) |
| 당사자 | 원고·피고 관계도 — 역할·법인 여부 분류 |
| 증거 | 증거·사실 매트릭스 — 쟁점별 증거력 평가 |
| AI 분석 | 쟁점 탐지 / 반박 논거 / 준비서면 아웃라인 / 위험 분석 |

### 지원 문서 유형

- **판결문** — 대법원·고등법원·지방법원 (사건번호 자동 파싱)
- **계약서** — 용역·공급·임대차 계약
- **법령** — 조문 단위 분석
- **준비서면** — 논거 구조 시각화
- **일반 문서** — 자동 감지

### 법률 AI 분석 모드

| 모드 | 설명 | API 필요 |
|------|------|---------|
| 쟁점 탐지 | 규칙 기반 + 그래프 클러스터 분석 | 선택 |
| 반박 논거 | 취약점 패턴 (인과관계·과실·손해·계약·시효) | 선택 |
| 준비서면 아웃라인 | InfraNodus AI 기반 구조 생성 | 필수 |
| 위험 분석 | 계약 조항 위험도 평가 | 필수 |

---

## 설치 방법

### 커뮤니티 플러그인 (권장)

1. Obsidian 설정 → 커뮤니티 플러그인 → 탐색
2. "LexGraph" 검색 → 설치 → 활성화

### 수동 설치

1. [최신 릴리즈](https://github.com/woongaro/lexgraph-legal-graph-view/releases/latest)에서 `main.js`, `manifest.json`, `styles.css` 다운로드
2. `.obsidian/plugins/lexgraph-legal-graph-view/` 폴더 생성 후 파일 복사
3. Obsidian 재시작 → 설정 → 커뮤니티 플러그인에서 "LexGraph" 활성화

---

## 설정

### 필수 설정

| 항목 | 설명 |
|------|------|
| InfraNodus API 키 | [infranodus.com/subscription](https://infranodus.com/subscription) 에서 발급 |

### 법률 모드 설정

| 항목 | 설명 |
|------|------|
| 법률 모드 활성화 | 한국 법률 특화 전처리 활성화 |
| 문서 유형 | 자동 감지 또는 판결문/계약서/법령/준비서면 수동 지정 |
| 불용어 제거 | 법률 상용구 자동 필터링 (500+ 단어 사전) |
| 엔티티 강조 | 법령 조항·판례 인용·당사자 하이라이트 |
| 쟁점 패널 | 쟁점 트리 패널 활성화 |
| 증거 매트릭스 | 증거-쟁점 연결 매트릭스 활성화 |
| 당사자 관계도 | 당사자 VS 레이아웃 활성화 |

---

## 사용 방법

### 기본 사용

1. 분석할 법률 문서(.md)를 Obsidian에서 열기
2. 리본 아이콘 클릭 (또는 명령 팔레트에서 "현재 파일의 법률 그래프 열기")
3. 우측 패널에서 각 탭 확인

### 명령 팔레트 (Ctrl+P / Cmd+P)

| 명령 | 설명 |
|------|------|
| 현재 파일의 법률 그래프 열기 | 활성 문서를 그래프로 분석 |
| 쟁점 분석 실행 | 법률 쟁점 자동 탐지 |
| 반박 논거 생성 | 취약점·반박 전략 도출 |
| 준비서면 아웃라인 생성 | AI 기반 서면 구조 작성 |
| 현재 폴더 전체 법률 분석 | 폴더 내 모든 문서 통합 분석 |

### 텍스트 선택 분석

1. 판결문 일부를 드래그 선택
2. 우클릭 → "LexGraph: 선택 텍스트 분석"

---

## 데이터 및 개인정보

- 문서 내용은 그래프 생성을 위해 InfraNodus API로 전송됩니다
- `doNotSave: true` 옵션이 기본 적용되어 서버에 저장되지 않습니다
- API 키는 Obsidian 로컬 데이터에만 저장됩니다
- 법제처 Open API 사용 시 해당 기관의 이용약관이 적용됩니다

---

## 문제 신고

[GitHub Issues](https://github.com/woongaro/lexgraph-legal-graph-view/issues)에 다음을 포함하여 신고해 주세요:

- 사용 중인 Obsidian 버전
- 플러그인 버전
- 재현 방법
- 오류 메시지 (Ctrl+Shift+I 개발자 콘솔)

---

## 기술 스택

- **그래프 엔진**: [InfraNodus API](https://infranodus.com) (외부 서비스)
- **법령 DB**: [법제처 Open API](https://www.law.go.kr) (무료)
- **NLP**: 규칙 기반 한국어 법률 전처리
- **UI**: React 18 + Tailwind CSS

---

## 라이선스

MIT License — [LICENSE](LICENSE) 참조
