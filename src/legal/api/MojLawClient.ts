// 법제처 국가법령정보 API 클라이언트
// https://open.law.go.kr/LSO/openApi.do

/**
 * 법령 검색 결과
 */
export interface LawSearchResult {
  lawId: string;
  lawName: string;
  lawType: string;       // 법률, 대통령령, 부령 등
  promulgationDate: string;
  enforcementDate: string;
  ministry: string;      // 소관부처
  articleCount: number;
}

/**
 * 법령 조문
 */
export interface LawArticle {
  articleNumber: string;  // 제X조
  articleTitle?: string;  // 조항 제목
  paragraphs: LawParagraph[];
  relatedArticles?: string[];
  annotations?: string;
}

/**
 * 법령 조항 단락
 */
export interface LawParagraph {
  number?: string;         // 항 번호
  content: string;
  subItems?: LawSubItem[];
}

/**
 * 법령 하위 항목 (호, 목)
 */
export interface LawSubItem {
  type: "호" | "목";
  number: string;
  content: string;
}

/**
 * 법령 전문
 */
export interface LawContent {
  lawId: string;
  lawName: string;
  chapter?: string;
  articles: LawArticle[];
  lastUpdated: string;
}

// ── API 클라이언트 ──────────────────────────────────────

const MOJ_API_BASE = "https://www.law.go.kr/DRF";
const DEFAULT_OC = "test"; // 공개 테스트 계정 (실제 사용 시 발급된 ID 필요)

/**
 * 법제처 API 클라이언트
 * 공개 API: https://open.law.go.kr
 */
export class MojLawClient {
  private readonly oc: string;

  constructor(apiKey?: string) {
    this.oc = apiKey || DEFAULT_OC;
  }

  /**
   * 법령명으로 검색
   */
  async searchByName(query: string): Promise<LawSearchResult[]> {
    const url = new URL(`${MOJ_API_BASE}/lawSearch.do`);
    url.searchParams.set("OC", this.oc);
    url.searchParams.set("target", "law");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("query", query);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`법제처 API 오류: ${response.status}`);

    const data = await response.json() as MojSearchResponse;
    return this.parseSearchResults(data);
  }

  /**
   * 법령 ID로 전문 조회
   */
  async getLawContent(lawId: string): Promise<LawContent | null> {
    const url = new URL(`${MOJ_API_BASE}/lawService.do`);
    url.searchParams.set("OC", this.oc);
    url.searchParams.set("target", "law");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("ID", lawId);

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json() as MojLawResponse;
    return this.parseLawContent(data, lawId);
  }

  /**
   * 법령명 + 조항으로 특정 조문 조회
   */
  async getArticle(lawName: string, articleNumber: string): Promise<LawArticle | null> {
    const searchResults = await this.searchByName(lawName);
    if (searchResults.length === 0) return null;

    const lawContent = await this.getLawContent(searchResults[0].lawId);
    if (!lawContent) return null;

    const normalizedNum = articleNumber.replace(/\s+/g, "");
    return (
      lawContent.articles.find(
        (a) => a.articleNumber.replace(/\s+/g, "") === normalizedNum
      ) ?? null
    );
  }

  /**
   * 법령 조항 텍스트 포맷 (단일 문자열)
   */
  static formatArticle(article: LawArticle): string {
    const lines: string[] = [];
    const title = article.articleTitle ? ` (${article.articleTitle})` : "";
    lines.push(`${article.articleNumber}${title}`);

    for (const para of article.paragraphs) {
      const paraNum = para.number ? `  ① ` : "  ";
      lines.push(`${paraNum}${para.content}`);

      for (const sub of para.subItems ?? []) {
        lines.push(`    ${sub.number}. ${sub.content}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * 응답 파싱 — 검색 결과
   */
  private parseSearchResults(data: MojSearchResponse): LawSearchResult[] {
    const items = data?.LawSearch?.law ?? [];
    return items.map((item) => ({
      lawId: item.법령ID ?? "",
      lawName: item.법령명한글 ?? "",
      lawType: item.법령구분명 ?? "",
      promulgationDate: item.공포일자 ?? "",
      enforcementDate: item.시행일자 ?? "",
      ministry: item.소관부처명 ?? "",
      articleCount: parseInt(item.조문수 ?? "0", 10),
    }));
  }

  /**
   * 응답 파싱 — 법령 전문
   */
  private parseLawContent(data: MojLawResponse, lawId: string): LawContent {
    const law = data?.법령 ?? {};
    const articles = this.parseArticles(law.조문 ?? []);

    return {
      lawId,
      lawName: law.기본정보?.법령명한글 ?? "",
      articles,
      lastUpdated: law.기본정보?.시행일자 ?? "",
    };
  }

  /**
   * 조문 배열 파싱
   */
  private parseArticles(rawArticles: MojArticleRaw[]): LawArticle[] {
    return rawArticles.map((raw): LawArticle => ({
      articleNumber: raw.조문번호 ?? "",
      articleTitle: raw.조문제목,
      paragraphs: this.parseParagraphs(raw.항 ?? []),
    }));
  }

  /**
   * 항 배열 파싱
   */
  private parseParagraphs(rawParas: MojParagraphRaw[]): LawParagraph[] {
    return rawParas.map((raw): LawParagraph => ({
      number: raw.항번호,
      content: raw.항내용 ?? "",
      subItems: this.parseSubItems(raw.호 ?? []),
    }));
  }

  private parseSubItems(rawItems: MojSubItemRaw[]): LawSubItem[] {
    return rawItems.map((raw): LawSubItem => ({
      type: "호",
      number: raw.호번호 ?? "",
      content: raw.호내용 ?? "",
    }));
  }
}

// ── 타입 정의 (API 응답 구조) ──────────────────────────

interface MojSearchResponse {
  LawSearch?: {
    law?: Array<{
      법령ID?: string;
      법령명한글?: string;
      법령구분명?: string;
      공포일자?: string;
      시행일자?: string;
      소관부처명?: string;
      조문수?: string;
    }>;
  };
}

interface MojLawResponse {
  법령?: {
    기본정보?: {
      법령명한글?: string;
      시행일자?: string;
    };
    조문?: MojArticleRaw[];
  };
}

interface MojArticleRaw {
  조문번호?: string;
  조문제목?: string;
  항?: MojParagraphRaw[];
}

interface MojParagraphRaw {
  항번호?: string;
  항내용?: string;
  호?: MojSubItemRaw[];
}

interface MojSubItemRaw {
  호번호?: string;
  호내용?: string;
}
