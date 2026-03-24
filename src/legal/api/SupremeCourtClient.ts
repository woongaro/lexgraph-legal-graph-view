// 국가법령정보 Open API 기반 판례 클라이언트
// 공식 가이드:
// - 판례 목록 조회 API: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide
// - 판례 본문 조회 API: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide

export interface CaseSummary {
  caseId: string;
  caseNumber: string;
  court: string;
  decisionDate: string;
  caseType: string;
  title: string;
  abstractText?: string;
  summaryText?: string;
  url: string;
  isPublic: boolean;
  dataSourceName?: string;
}

export interface CaseDetail {
  caseId: string;
  caseNumber: string;
  court: string;
  decisionDate: string;
  title: string;
  mainText?: string;
  reasoning?: string;
  holdings?: string[];
  keywords?: string[];
  relatedStatutes?: string[];
  citations?: string[];
  citedBy?: string[];
  judgmentType?: string;
  sentenceText?: string;
}

export interface CaseSearchParams {
  query?: string;
  caseNumber?: string;
  courtType?: "대법원" | "고등법원" | "지방법원" | "헌법재판소" | "";
  startDate?: string;
  endDate?: string;
  courtTypeCode?: "400201" | "400202" | "";
  page?: number;
  pageSize?: number;
  referencedLawName?: string;
  dataSourceName?: string;
}

const LAW_OPEN_API_BASE = "https://www.law.go.kr/DRF";
const DEFAULT_OC = "test";

export class SupremeCourtClient {
  private readonly oc: string;

  constructor(oc?: string) {
    this.oc = oc?.trim() || DEFAULT_OC;
  }

  static getCaseUrl(caseNumber: string): string {
    const encoded = encodeURIComponent(caseNumber.trim());
    return `https://glaw.scourt.go.kr/wsjo/panre/sjo060.do?q=${encoded}&nq=&w=pan&section=pan_tot&subw=&subsection=&aq=&eq=&op=&st=1&c1=&c2=&c3=&c4=&pg=1`;
  }

  async searchCases(params: CaseSearchParams): Promise<CaseSummary[]> {
    const url = new URL(`${LAW_OPEN_API_BASE}/lawSearch.do`);
    url.searchParams.set("OC", this.oc);
    url.searchParams.set("target", "prec");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("display", String(params.pageSize ?? 10));
    url.searchParams.set("page", String(params.page ?? 1));

    if (params.query?.trim()) url.searchParams.set("query", params.query.trim());
    if (params.caseNumber?.trim()) url.searchParams.set("nb", params.caseNumber.trim());
    if (params.courtType?.trim()) url.searchParams.set("curt", params.courtType.trim());
    if (params.courtTypeCode?.trim()) url.searchParams.set("org", params.courtTypeCode.trim());
    if (params.startDate && params.endDate) {
      url.searchParams.set("prncYd", `${params.startDate}~${params.endDate}`);
    }
    if (params.referencedLawName?.trim()) url.searchParams.set("JO", params.referencedLawName.trim());
    if (params.dataSourceName?.trim()) url.searchParams.set("datSrcNm", params.dataSourceName.trim());

    const data = await fetchJson(url.toString(), "판례 목록");
    return this.parseSearchResults(data);
  }

  async getCaseSummary(caseNumber: string): Promise<CaseSummary | null> {
    const results = await this.searchCases({ caseNumber, pageSize: 5 });
    const normalized = normalizeCaseNumber(caseNumber);
    return (
      results.find((item) => normalizeCaseNumber(item.caseNumber) === normalized) ??
      results[0] ??
      null
    );
  }

  async batchGetSummaries(caseNumbers: string[]): Promise<CaseSummary[]> {
    const numbers = caseNumbers
      .map((caseNumber) => normalizeCaseNumber(caseNumber))
      .filter(Boolean);
    if (numbers.length === 0) return [];

    const results = await this.searchCases({
      caseNumber: [...new Set(numbers)].join(","),
      pageSize: Math.min(100, numbers.length),
    });

    const byNumber = new Map(results.map((item) => [normalizeCaseNumber(item.caseNumber), item]));
    return numbers
      .map((number) => byNumber.get(number))
      .filter((item): item is CaseSummary => item !== undefined);
  }

  async getCaseDetail(caseNumber: string): Promise<CaseDetail | null> {
    const summary = await this.getCaseSummary(caseNumber);
    if (!summary) return null;
    return this.getCaseDetailById(summary.caseId);
  }

  async getCaseDetailById(caseId: string): Promise<CaseDetail | null> {
    if (!caseId.trim()) return null;

    const url = new URL(`${LAW_OPEN_API_BASE}/lawService.do`);
    url.searchParams.set("OC", this.oc);
    url.searchParams.set("target", "prec");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("ID", caseId.trim());

    const data = await fetchJson(url.toString(), "판례 본문");
    return this.parseCaseDetail(data);
  }

  private parseSearchResults(data: unknown): CaseSummary[] {
    const searchRoot = getRecord(data, "PrecSearch") ?? getRecord(data, "precSearch") ?? data;
    const rawItems = asArray(getRecord(searchRoot, "prec") ?? getRecord(searchRoot, "판례") ?? []);

    return rawItems
      .map((item) => this.parseSearchItem(item))
      .filter((item): item is CaseSummary => item !== null);
  }

  private parseSearchItem(value: unknown): CaseSummary | null {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const caseNumber = readString(item, ["사건번호", "caseNumber"]);
    const caseId = readString(item, ["판례일련번호", "판례정보일련번호", "prec id", "판례ID", "ID"]);
    if (!caseNumber || !caseId) return null;

    return {
      caseId,
      caseNumber,
      court: readString(item, ["법원명"]) || inferCourtFromCaseNumber(caseNumber),
      decisionDate: readString(item, ["선고일자"]),
      caseType: readString(item, ["사건종류명"]) || inferCaseTypeFromNumber(caseNumber),
      title: readString(item, ["사건명"]) || caseNumber,
      abstractText: readString(item, ["판시사항"]),
      summaryText: readString(item, ["판결요지"]),
      url: readString(item, ["판례상세링크"]) || SupremeCourtClient.getCaseUrl(caseNumber),
      isPublic: true,
      dataSourceName: readString(item, ["데이터출처명"]),
    };
  }

  private parseCaseDetail(data: unknown): CaseDetail | null {
    const root =
      getRecord(data, "판례정보") ??
      getRecord(data, "판례") ??
      getRecord(data, "PrecService") ??
      getRecord(data, "prec") ??
      (typeof data === "object" && data ? (data as Record<string, unknown>) : null);

    if (!root) return null;

    const caseNumber = readString(root, ["사건번호"]);
    const caseId = readString(root, ["판례정보일련번호", "판례일련번호", "ID"]);
    if (!caseNumber || !caseId) return null;

    return {
      caseId,
      caseNumber,
      court: readString(root, ["법원명"]) || inferCourtFromCaseNumber(caseNumber),
      decisionDate: readString(root, ["선고일자"]),
      title: readString(root, ["사건명"]) || caseNumber,
      mainText: readString(root, ["판례내용"]),
      reasoning: readString(root, ["판결요지"]),
      holdings: splitTextList(readString(root, ["판시사항"])),
      keywords: splitTextList(readString(root, ["판시사항"])),
      relatedStatutes: splitReferenceList(readString(root, ["참조조문"])),
      citations: splitReferenceList(readString(root, ["참조판례"])),
      citedBy: [],
      judgmentType: readString(root, ["판결유형"]),
      sentenceText: readString(root, ["선고"]),
    };
  }
}

async function fetchJson(url: string, resourceLabel: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${resourceLabel} 조회 실패: HTTP ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const resultMessage = typeof data.result === "string" ? data.result : "";
  const message = typeof data.msg === "string" ? data.msg : "";

  if (resultMessage || message) {
    throw new Error(`${resourceLabel} 조회 실패: ${message || resultMessage}`);
  }

  return data;
}

function getRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const entry = (value as Record<string, unknown>)[key];
  return entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function splitTextList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\n+|[;•]/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitReferenceList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\n+|,|;/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeCaseNumber(caseNumber: string): string {
  return caseNumber.replace(/\s+/g, "");
}

function inferCourtFromCaseNumber(caseNumber: string): string {
  const match = caseNumber.match(/^\d{4}([가-힣]{1,6})\d+$/);
  if (!match) return "법원";

  const typeCode = match[1];

  if (["도", "두", "므"].includes(typeCode)) return "대법원";
  if (typeCode.startsWith("헌")) return "헌법재판소";
  if (["나", "누", "노", "브"].some((c) => typeCode.includes(c))) return "고등법원";
  return "지방법원";
}

function inferCaseTypeFromNumber(caseNumber: string): string {
  const match = caseNumber.match(/^\d{4}([가-힣]{1,6})\d+$/);
  if (!match) return "일반";

  const typeCode = match[1];
  const typeMap: Record<string, string> = {
    도: "형사",
    노: "형사항소",
    고: "형사합의",
    다: "민사",
    나: "민사항소",
    두: "행정",
    누: "행정항소",
    헌바: "위헌법률심판",
    헌마: "헌법소원",
  };

  for (const [code, type] of Object.entries(typeMap)) {
    if (typeCode.includes(code)) return type;
  }

  return "민사";
}
