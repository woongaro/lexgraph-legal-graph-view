// 법률 엔티티 추출기
// 정규식 패턴 기반으로 판결문, 계약서, 법령 등에서 핵심 엔티티를 추출

/**
 * 법률 엔티티 타입
 */
export type LegalEntityType =
  | "case_number"     // 사건번호 (2023다12345)
  | "statute"         // 법령 조항 (「민법」 제750조)
  | "court"           // 법원명
  | "party"           // 당사자 (원고/피고 등)
  | "date"            // 날짜
  | "amount"          // 금액
  | "person"          // 인명
  | "citation"        // 판례 인용
  | "article"         // 조항 번호 (제1조 제1항)
  | "penalty"         // 형량 (징역 X년)
  | "contract_clause" // 계약 조항 패턴
  ;

/**
 * 추출된 법률 엔티티
 */
export interface LegalEntity {
  type: LegalEntityType;
  value: string;
  normalized?: string;  // 정규화된 형태
  position: {
    start: number;
    end: number;
  };
  context?: string;     // 주변 텍스트 (±50자)
}

/**
 * 엔티티 추출 결과
 */
export interface ExtractionResult {
  entities: LegalEntity[];
  caseNumbers: string[];
  statutes: StatuteRef[];
  parties: PartyInfo[];
  dates: string[];
  citations: CaseCitation[];
}

/**
 * 법령 참조 구조
 */
export interface StatuteRef {
  lawName: string;
  articleNumber: string;
  paragraphNumber?: string;
  subNumber?: string;
  fullRef: string;
}

/**
 * 당사자 정보
 */
export interface PartyInfo {
  role: string;  // 원고, 피고, 항소인, 피항소인 등
  name?: string; // 이름 (다음에 오는 텍스트에서 추출)
  isCompany?: boolean;
}

/**
 * 판례 인용
 */
export interface CaseCitation {
  caseNumber: string;
  court?: string;
  date?: string;
  fullCitation: string;
}

// ── 정규식 패턴 ───────────────────────────────────────────

/**
 * 사건번호 패턴
 * 예: 2023다12345, 2022가단11111, 2021나22222, 2020도33333
 * 예: 2023헌바123, 2022헌마456
 */
const CASE_NUMBER_PATTERN =
  /\d{4}[가나다라마바사아자차카타파하][가-힣]{0,4}\d+/g;

/**
 * 법령 조항 패턴
 * 예: 「민법」 제750조, 민법 제750조 제1항, 「형법」 제347조의2
 */
const STATUTE_PATTERN =
  /(?:[「『]([^」』]+)[」』]\s*)?(?:제(\d+)조(?:의\d+)?(?:\s*제(\d+)항(?:\s*제(\d+)호)?)?)/g;

/**
 * 법원명 패턴
 */
const COURT_PATTERN =
  /(대법원|헌법재판소|(?:[가-힣]+고등법원|서울고등법원|부산고등법원|대구고등법원|광주고등법원|대전고등법원)|(?:[가-힣]+지방법원(?:\s+[가-힣]+지원)?)|(?:[가-힣]+가정법원)|(?:[가-힣]+행정법원)|(?:[가-힣]+회생법원))/g;

/**
 * 당사자 역할 패턴
 */
const PARTY_ROLE_PATTERN =
  /(원고|피고|항소인|피항소인|상고인|피상고인|신청인|피신청인|청구인|피청구인|채권자|채무자|임대인|임차인|매도인|매수인|보증인|피보증인|고소인|피고소인|피의자|피고인)/g;

/**
 * 날짜 패턴
 * 예: 2023. 3. 15., 2023년 3월 15일
 */
const DATE_PATTERN =
  /(?:\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\.?)|(?:\d{4}년\s*\d{1,2}월\s*\d{1,2}일)/g;

/**
 * 금액 패턴
 * 예: 1,000,000원, 금 100만원, 1억 원
 */
const AMOUNT_PATTERN =
  /(?:금\s*)?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\s*만|\s*억|\s*천)?\s*원(?:\s*(?:정|이상|이하|상당))?/g;

/**
 * 형사 형량 패턴
 */
const PENALTY_PATTERN =
  /(?:징역|금고|벌금|과료|구류|몰수)\s*\d+(?:\s*년\s*\d+\s*월|\s*년|\s*개월|\s*월|\s*원)/g;

/**
 * 대법원 판례 인용 패턴
 * 예: 대법원 2020. 3. 15. 선고 2019다12345 판결
 */
const CASE_CITATION_PATTERN =
  /(대법원|헌법재판소|각급법원)\s*(\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\.?)\s*(?:선고|결정)\s*(\d{4}[가-힣]+\d+)\s*(?:판결|결정|전원합의체\s*판결)?/g;

// ── 추출 함수 ───────────────────────────────────────────

/**
 * 텍스트에서 모든 법률 엔티티를 추출
 */
export function extractLegalEntities(text: string): ExtractionResult {
  const entities: LegalEntity[] = [];
  const caseNumbers: string[] = [];
  const statutes: StatuteRef[] = [];
  const parties: PartyInfo[] = [];
  const dates: string[] = [];
  const citations: CaseCitation[] = [];

  // 1. 사건번호 추출
  for (const match of text.matchAll(CASE_NUMBER_PATTERN)) {
    caseNumbers.push(match[0]);
    entities.push({
      type: "case_number",
      value: match[0],
      position: { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
      context: getContext(text, match.index ?? 0, 50),
    });
  }

  // 2. 법령 조항 추출
  for (const match of text.matchAll(STATUTE_PATTERN)) {
    const ref: StatuteRef = {
      lawName: match[1] ?? "미상",
      articleNumber: match[2] ?? "",
      paragraphNumber: match[3],
      subNumber: match[4],
      fullRef: match[0],
    };
    statutes.push(ref);
    entities.push({
      type: "statute",
      value: match[0],
      normalized: `${ref.lawName} 제${ref.articleNumber}조`,
      position: { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
    });
  }

  // 3. 당사자 역할 추출
  for (const match of text.matchAll(PARTY_ROLE_PATTERN)) {
    // 역할명 다음에 오는 이름 추출 시도
    const afterRole = text.slice(match.index! + match[0].length, match.index! + match[0].length + 20);
    const nameMatch = afterRole.match(/^\s+([가-힣]{2,5}(?:\s*주식회사|\s*유한회사)?)/);

    parties.push({
      role: match[0],
      name: nameMatch?.[1]?.trim(),
      isCompany: nameMatch?.[1]?.includes("회사") ?? false,
    });

    entities.push({
      type: "party",
      value: match[0],
      position: { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
    });
  }

  // 4. 날짜 추출
  for (const match of text.matchAll(DATE_PATTERN)) {
    dates.push(match[0]);
    entities.push({
      type: "date",
      value: match[0],
      position: { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
    });
  }

  // 5. 판례 인용 추출
  for (const match of text.matchAll(CASE_CITATION_PATTERN)) {
    const citation: CaseCitation = {
      court: match[1],
      date: match[2],
      caseNumber: match[3],
      fullCitation: match[0],
    };
    citations.push(citation);
    entities.push({
      type: "citation",
      value: match[0],
      normalized: `${match[1]} ${match[3]}`,
      position: { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
    });
  }

  // 6. 형량 추출
  for (const match of text.matchAll(PENALTY_PATTERN)) {
    entities.push({
      type: "penalty",
      value: match[0],
      position: { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
    });
  }

  return {
    entities,
    caseNumbers: [...new Set(caseNumbers)],
    statutes,
    parties: deduplicateParties(parties),
    dates: [...new Set(dates)],
    citations,
  };
}

/**
 * 당사자 목록에서 중복 제거 (같은 역할명 첫 번째 유지)
 */
function deduplicateParties(parties: PartyInfo[]): PartyInfo[] {
  const seen = new Set<string>();
  return parties.filter((p) => {
    const key = `${p.role}:${p.name ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 위치 주변의 컨텍스트 텍스트 추출
 */
function getContext(text: string, pos: number, radius: number): string {
  const start = Math.max(0, pos - radius);
  const end = Math.min(text.length, pos + radius);
  return text.slice(start, end).replace(/\n/g, " ");
}

/**
 * 법령 조항 참조를 키워드 목록으로 변환 (그래프 노드용)
 */
export function statutesToKeywords(statutes: StatuteRef[]): string[] {
  return statutes.map((s) =>
    s.lawName !== "미상"
      ? `${s.lawName} 제${s.articleNumber}조`
      : `제${s.articleNumber}조`
  );
}

/**
 * 판례 인용을 키워드 목록으로 변환 (그래프 노드용)
 */
export function citationsToKeywords(citations: CaseCitation[]): string[] {
  return citations.map((c) => c.caseNumber);
}
