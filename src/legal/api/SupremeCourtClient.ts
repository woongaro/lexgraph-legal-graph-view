// 대법원 종합법률정보 API 클라이언트
// https://glaw.scourt.go.kr

/**
 * 판례 검색 결과 요약
 */
export interface CaseSummary {
  caseNumber: string;
  court: string;
  decisionDate: string;
  caseType: string;
  title: string;
  abstractText?: string;
  url: string;
  isPublic: boolean;
}

/**
 * 판례 상세 정보
 */
export interface CaseDetail {
  caseNumber: string;
  court: string;
  decisionDate: string;
  title: string;
  mainText?: string;       // 주문
  reasoning?: string;      // 이유 (전문)
  holdings?: string[];     // 판시 사항 요약
  keywords?: string[];     // 키워드
  relatedStatutes?: string[]; // 관련 법령
  citations?: string[];    // 인용 판례
  citedBy?: string[];      // 이 판례를 인용한 판례
}

/**
 * 판례 검색 파라미터
 */
export interface CaseSearchParams {
  query: string;
  courtType?: "대법원" | "고등법원" | "지방법원" | "헌법재판소" | "";
  startDate?: string;      // YYYYMMDD
  endDate?: string;
  caseTypeCode?: string;   // 다, 도, 두 등
  page?: number;
  pageSize?: number;
}

// ── 클라이언트 ──────────────────────────────────────────

const GLAW_BASE = "https://glaw.scourt.go.kr/wsjo/lawinfo";
const GLAW_SEARCH = "https://glaw.scourt.go.kr/wsjo/panre/sjo060.do";

/**
 * 대법원 종합법률정보 클라이언트
 *
 * 주의: 대법원 종합법률정보는 공식 REST API가 없음.
 * 현재 구현은 공개된 URL 패턴 기반 링크 생성 + 제한적 검색 지원.
 * 실제 전문 조회는 사용자가 브라우저에서 직접 확인하도록 URL 제공.
 */
export class SupremeCourtClient {
  /**
   * 판례 번호로 대법원 종합법률정보 URL 생성
   */
  static getCaseUrl(caseNumber: string): string {
    const encoded = encodeURIComponent(caseNumber.trim());
    return `https://glaw.scourt.go.kr/wsjo/panre/sjo060.do?q=${encoded}&nq=&w=pan&section=pan_tot&subw=&subsection=&aq=&eq=&op=&st=1&c1=&c2=&c3=&c4=&pg=1`;
  }

  /**
   * 사건번호로 판례 요약 조회 시도
   * 대법원 공개 API가 없으므로 HTML 파싱 방식 (제한적)
   */
  static async getCaseSummary(caseNumber: string): Promise<CaseSummary | null> {
    // 공식 API 없음 → URL만 반환하여 사용자가 확인하도록
    return {
      caseNumber,
      court: inferCourtFromCaseNumber(caseNumber),
      decisionDate: "",
      caseType: inferCaseTypeFromNumber(caseNumber),
      title: caseNumber,
      url: this.getCaseUrl(caseNumber),
      isPublic: true,
    };
  }

  /**
   * 판례 번호 목록 → 요약 정보 배치 생성
   * (실제 API 없음 → 메타데이터만 생성)
   */
  static async batchGetSummaries(caseNumbers: string[]): Promise<CaseSummary[]> {
    return caseNumbers.map((cn) => ({
      caseNumber: cn,
      court: inferCourtFromCaseNumber(cn),
      decisionDate: "",
      caseType: inferCaseTypeFromNumber(cn),
      title: cn,
      url: this.getCaseUrl(cn),
      isPublic: true,
    }));
  }

  /**
   * 판례 검색 URL 생성 (브라우저에서 열기용)
   */
  static getSearchUrl(params: CaseSearchParams): string {
    const url = new URL(GLAW_SEARCH);
    url.searchParams.set("q", params.query);
    if (params.courtType) url.searchParams.set("c1", params.courtType);
    if (params.startDate) url.searchParams.set("fd", params.startDate);
    if (params.endDate) url.searchParams.set("td", params.endDate);
    url.searchParams.set("w", "pan");
    url.searchParams.set("section", "pan_tot");
    return url.toString();
  }

  /**
   * 공공데이터포털 판례 API (정식 키 필요)
   * https://www.data.go.kr — 법원행정처 판례 정보 서비스
   */
  static getPublicDataUrl(caseNumber: string): string {
    // 공공데이터포털을 통한 공식 API 엔드포인트
    return `https://apis.data.go.kr/B550928/panrye/getPanryeList?serviceKey=YOUR_KEY&판례번호=${encodeURIComponent(caseNumber)}`;
  }
}

// ── 헬퍼 함수 ─────────────────────────────────────────────

/**
 * 사건번호에서 법원 추론
 */
function inferCourtFromCaseNumber(caseNumber: string): string {
  const match = caseNumber.match(/^\d{4}([가-힣]{1,6})\d+$/);
  if (!match) return "법원";

  const typeCode = match[1];

  if (["도", "두", "므"].includes(typeCode)) return "대법원";
  if (typeCode.startsWith("헌")) return "헌법재판소";
  if (["나", "누", "노", "브"].some((c) => typeCode.includes(c))) return "고등법원";
  return "지방법원";
}

/**
 * 사건번호에서 사건 유형 추론
 */
function inferCaseTypeFromNumber(caseNumber: string): string {
  const match = caseNumber.match(/^\d{4}([가-힣]{1,6})\d+$/);
  if (!match) return "일반";

  const typeCode = match[1];

  const typeMap: Record<string, string> = {
    "도": "형사", "노": "형사항소", "고": "형사합의",
    "다": "민사", "나": "민사항소",
    "두": "행정", "누": "행정항소",
    "헌바": "위헌법률심판", "헌마": "헌법소원",
  };

  for (const [code, type] of Object.entries(typeMap)) {
    if (typeCode.includes(code)) return type;
  }

  return "민사";
}
