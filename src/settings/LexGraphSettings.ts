// LexGraph 플러그인 설정 타입 및 기본값

export type AiProvider = "gemini" | "openai" | "claude" | "none";
export type ColorScheme = "light" | "dark" | "auto";
export type GraphReloadMode = "automatic" | "manual" | "into reading";
export type PageProcessingMode = "All Text" | "[[Wiki Links]] Only";
export type MentionIncludeMode = "For all pages" | "For empty pages only" | "Never";

/**
 * 법률 문서 유형
 */
export type LegalDocumentType =
  | "auto"
  | "judgment"
  | "contract"
  | "statute"
  | "brief"
  | "general";

/**
 * 법률 분석 AI 프롬프트 모드
 */
export type LegalAnalysisMode =
  | "issue_spotting"
  | "counter_argument"
  | "brief_outline"
  | "risk_analysis"
  | "general";

export type LegalDbIntegration = "enabled" | "disabled";

/**
 * 전체 설정 인터페이스
 */
export interface LexGraphSettings {
  // === AI 제공자 설정 ===
  AI_PROVIDER: AiProvider;
  GEMINI_API_KEY: string;
  OPENAI_API_KEY: string;
  CLAUDE_API_KEY: string;

  // === 그래프 표시 설정 ===
  COLOR_SCHEME: ColorScheme;
  RELOADING_GRAPH: GraphReloadMode;

  // === 페이지 처리 설정 ===
  SINGLE_PAGE_GRAPH_PROCESSING: PageProcessingMode;
  INCLUDE_LINKED_MENTIONS: MentionIncludeMode;

  // === ⚖️ 법률 특화 설정 ===
  LEGAL_MODE_ENABLED: boolean;
  LEGAL_DOCUMENT_TYPE: LegalDocumentType;
  LEGAL_ANALYSIS_MODE: LegalAnalysisMode;
  LEGAL_ENTITY_HIGHLIGHT: boolean;
  LEGAL_CITATION_LINK: boolean;
  LEGAL_STOPWORDS_ENABLED: boolean;
  LEGAL_DB_INTEGRATION: LegalDbIntegration;
  LEGAL_MOJ_API_KEY: string;
  LEGAL_ISSUE_PANEL_ENABLED: boolean;
  LEGAL_EVIDENCE_MATRIX_ENABLED: boolean;
  LEGAL_PARTY_GRAPH_ENABLED: boolean;
  LEGAL_KOREAN_MODE: boolean;
}

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS: LexGraphSettings = {
  // AI 제공자
  AI_PROVIDER: "none",
  GEMINI_API_KEY: "",
  OPENAI_API_KEY: "",
  CLAUDE_API_KEY: "",

  // 그래프
  COLOR_SCHEME: "auto",
  RELOADING_GRAPH: "automatic",

  // 페이지 처리
  SINGLE_PAGE_GRAPH_PROCESSING: "All Text",
  INCLUDE_LINKED_MENTIONS: "For empty pages only",

  // 법률 특화
  LEGAL_MODE_ENABLED: true,
  LEGAL_DOCUMENT_TYPE: "auto",
  LEGAL_ANALYSIS_MODE: "issue_spotting",
  LEGAL_ENTITY_HIGHLIGHT: true,
  LEGAL_CITATION_LINK: true,
  LEGAL_STOPWORDS_ENABLED: true,
  LEGAL_DB_INTEGRATION: "enabled",
  LEGAL_MOJ_API_KEY: "",
  LEGAL_ISSUE_PANEL_ENABLED: true,
  LEGAL_EVIDENCE_MATRIX_ENABLED: true,
  LEGAL_PARTY_GRAPH_ENABLED: true,
  LEGAL_KOREAN_MODE: true,
};
