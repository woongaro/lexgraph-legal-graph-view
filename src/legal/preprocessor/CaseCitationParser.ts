// 판례 인용 파서
// 한국 법원 판례 번호 체계를 파싱하여 구조화된 데이터로 변환

/**
 * 한국 법원 체계
 */
export type CourtLevel = "supreme" | "constitutional" | "high" | "district" | "family" | "admin" | "patent";

/**
 * 사건 종류 코드 매핑
 */
const CASE_TYPE_MAP: Record<string, string> = {
  // 민사 (대법원: 다, 고등법원: 나, 지방법원: 가/가단/가합)
  "다": "민사상고",
  "나": "민사항소",
  "가": "민사소액",
  "가단": "민사소액단독",
  "가합": "민사합의",
  // 형사 (대법원: 도, 고등법원: 노, 지방법원: 고/고단/고합)
  "도": "형사상고",
  "노": "형사항소",
  "고": "형사합의",
  "고단": "형사단독",
  "고합": "형사합의부",
  // 행정 (대법원: 두, 고등법원: 누, 지방법원: 구/구합/구단)
  "두": "행정상고",
  "누": "행정항소",
  "구": "행정합의",
  "구합": "행정합의부",
  "구단": "행정단독",
  // 헌법재판소
  "헌바": "위헌법률심판",
  "헌마": "헌법소원(권리구제)",
  "헌나": "권한쟁의",
  "헌라": "권한쟁의(라)",
  "헌사": "가처분",
  // 특허
  "허": "특허취소",
  "원": "특허원심",
  // 가사 (대법원: 므, 고등법원: 브)
  "브": "가사항소",
  "므": "가사상고",
};

/**
 * 파싱된 판례 인용 구조
 */
export interface ParsedCitation {
  raw: string;
  year: number;
  caseTypeCode: string;
  caseTypeName: string;
  caseNumber: number;
  court?: string;
  courtLevel?: CourtLevel;
  decisionDate?: string;
  decisionType?: "판결" | "결정" | "명령" | "전원합의체 판결";
  url?: string;              // 대법원 종합법률정보 URL
  isValid: boolean;
}

/**
 * 판례 인용 그룹 (같은 사건 여러 심급)
 */
export interface CitationGroup {
  caseId: string;           // 사건 식별자 (연도+번호 기반)
  citations: ParsedCitation[];
  hierarchy?: {
    firstInstance?: ParsedCitation;
    appeal?: ParsedCitation;
    finalAppeal?: ParsedCitation;
  };
}

// ── 정규식 ────────────────────────────────────────────────

/**
 * 단독 사건번호 패턴
 * 2023다12345, 2022가단11111, 2021헌바123
 */
const CASE_NUMBER_RE = /(\d{4})([가-힣]{1,6})(\d+)/g;

/**
 * 완전한 판례 인용 패턴
 * 대법원 2020. 3. 15. 선고 2019다12345 판결
 * 헌법재판소 2021. 4. 29. 선고 2019헌바123 전원재판부 결정
 */
const FULL_CITATION_RE =
  /(대법원|헌법재판소|(?:[가-힣]+고등법원)|(?:[가-힣]+지방법원(?:\s+[가-힣]+지원)?))\s+(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\.?\s+(?:선고|결정)\s+(\d{4}[가-힣]{1,6}\d+)\s+(판결|결정|전원합의체\s*판결|전원재판부\s*결정)/g;

/**
 * 판례집 인용 패턴
 * 대법원공보 제XXX호, 판례집 XX권 X집
 */
const REPORT_CITATION_RE =
  /(?:대법원공보|판례공보)\s+제?(\d+)호|(?:대법원판례집|판례집)\s+(\d+)권\s+(\d+)집/g;

// ── 파싱 함수 ─────────────────────────────────────────────

/**
 * 사건번호 파싱
 */
export function parseCaseNumber(caseNum: string): ParsedCitation | null {
  const match = caseNum.match(/^(\d{4})([가-힣]{1,6})(\d+)$/);
  if (!match) return null;

  const [, yearStr, typeCode, numStr] = match;
  const year = parseInt(yearStr, 10);
  const caseNumber = parseInt(numStr, 10);

  if (year < 1948 || year > 2030) return null;

  const caseTypeName = CASE_TYPE_MAP[typeCode] ?? `사건유형(${typeCode})`;

  return {
    raw: caseNum,
    year,
    caseTypeCode: typeCode,
    caseTypeName,
    caseNumber,
    courtLevel: inferCourtLevel(typeCode),
    isValid: true,
    url: buildSupremeCourtUrl(caseNum),
  };
}

/**
 * 완전한 판례 인용 파싱
 */
export function parseFullCitation(text: string): ParsedCitation[] {
  const results: ParsedCitation[] = [];

  for (const match of text.matchAll(FULL_CITATION_RE)) {
    const [raw, court, year, month, day, caseNum, decisionType] = match;

    const parsed = parseCaseNumber(caseNum);
    if (!parsed) continue;

    results.push({
      ...parsed,
      raw,
      court,
      courtLevel: getCourtLevel(court),
      decisionDate: `${year}.${month}.${day}`,
      decisionType: normalizeDecisionType(decisionType),
    });
  }

  return results;
}

/**
 * 텍스트에서 모든 판례 인용 추출 (완전 인용 + 단독 번호)
 */
export function extractAllCitations(text: string): {
  full: ParsedCitation[];
  standalone: ParsedCitation[];
  all: ParsedCitation[];
} {
  const full = parseFullCitation(text);
  // full 인용에 포함된 사건번호 문자열로 중복 제거
  const fullCaseNums = new Set(
    full.map((c) => `${c.year}${c.caseTypeCode}${c.caseNumber}`)
  );

  const standalone: ParsedCitation[] = [];
  for (const match of text.matchAll(CASE_NUMBER_RE)) {
    const parsed = parseCaseNumber(match[0]);
    if (!parsed) continue;
    const key = `${parsed.year}${parsed.caseTypeCode}${parsed.caseNumber}`;
    if (!fullCaseNums.has(key)) {
      standalone.push(parsed);
    }
  }

  return {
    full,
    standalone,
    all: [...full, ...standalone],
  };
}

/**
 * 판례 인용을 심급 기준으로 그룹화
 */
export function groupCitationsByCase(citations: ParsedCitation[]): CitationGroup[] {
  // 사건 번호 유사성 기반 그룹화
  const groups = new Map<string, ParsedCitation[]>();

  for (const citation of citations) {
    // 같은 사건 번호(연도 + 숫자)로 그룹화
    const key = `${citation.year}-${citation.caseNumber}`;
    const group = groups.get(key) ?? [];
    group.push(citation);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, cits]) => ({
    caseId: key,
    citations: cits,
    hierarchy: buildHierarchy(cits),
  }));
}

// ── 헬퍼 함수 ────────────────────────────────────────────

function inferCourtLevel(typeCode: string): CourtLevel {
  // 대법원: 다(민사상고), 도(형사상고), 두(행정상고), 므(가사상고)
  if (["다", "도", "두", "므"].includes(typeCode)) return "supreme";
  if (typeCode.startsWith("헌")) return "constitutional";
  // 고등법원: 나(민사항소), 노(형사항소), 누(행정항소), 브(가사항소)
  if (["나", "누", "브", "노"].includes(typeCode)) return "high";
  // 지방법원: 가/가합/가단(민사), 고/고합/고단(형사), 구/구합/구단(행정)
  return "district";
}

function getCourtLevel(courtName: string): CourtLevel {
  if (courtName === "대법원") return "supreme";
  if (courtName === "헌법재판소") return "constitutional";
  if (courtName.includes("고등법원")) return "high";
  if (courtName.includes("특허")) return "patent";
  if (courtName.includes("가정법원")) return "family";
  if (courtName.includes("행정법원")) return "admin";
  return "district";
}

function normalizeDecisionType(raw: string): ParsedCitation["decisionType"] {
  if (raw.includes("전원합의체")) return "전원합의체 판결";
  if (raw.includes("판결")) return "판결";
  if (raw.includes("결정")) return "결정";
  if (raw.includes("명령")) return "명령";
  return "판결";
}

function buildSupremeCourtUrl(caseNumber: string): string {
  const encoded = encodeURIComponent(caseNumber);
  return `https://glaw.scourt.go.kr/wsjo/lawinfo/sjo050.do?q=${encoded}`;
}

function buildHierarchy(citations: ParsedCitation[]): CitationGroup["hierarchy"] {
  const hierarchy: CitationGroup["hierarchy"] = {};

  for (const c of citations) {
    switch (c.courtLevel) {
      case "district": hierarchy.firstInstance = c; break;
      case "high": hierarchy.appeal = c; break;
      case "supreme": hierarchy.finalAppeal = c; break;
    }
  }

  return hierarchy;
}
