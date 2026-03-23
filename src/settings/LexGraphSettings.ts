// LexGraph 플러그인 설정 타입 및 기본값

export type AiModel = "gpt-4o" | "gpt-4o-mini" | "gpt-4" | "gpt-3.5-turbo" | "claude-3-5-sonnet" | "claude-3-haiku";
export type ColorScheme = "light" | "dark" | "auto";
export type ExportType = "auto" | "manual";
export type GraphReloadMode = "automatic" | "manual" | "into reading";
export type PageProcessingMode = "All Text" | "[[Wiki Links]] Only" | "Tags Only";
export type MobilePanelMode = "Side view" | "New tab";
export type LocateMode = "Force to Edit Mode" | "Stay in Current Mode";
export type MentionIncludeMode = "For all pages" | "For empty pages only" | "Never";

/**
 * 법률 문서 유형
 */
export type LegalDocumentType =
  | "auto"        // 자동 감지
  | "judgment"    // 판결문
  | "contract"    // 계약서
  | "statute"     // 법령
  | "brief"       // 준비서면
  | "general";    // 일반 텍스트

/**
 * 법률 분석 AI 프롬프트 모드
 */
export type LegalAnalysisMode =
  | "issue_spotting"    // 쟁점 탐지
  | "counter_argument"  // 반박 논거
  | "brief_outline"     // 준비서면 아웃라인
  | "risk_analysis"     // 위험 분석 (계약)
  | "general";          // 일반 분석

/**
 * 법령 DB 연동 여부
 */
export type LegalDbIntegration = "enabled" | "disabled";

/**
 * 전체 설정 인터페이스
 */
export interface LexGraphSettings {
  // === InfraNodus API 설정 ===
  INFRANODUS_API_KEY: string;
  INFRANODUS_API_URL: string;
  INFRANODUS_GRAPH_URL: string;

  // === AI 설정 ===
  AI_MODEL: AiModel;

  // === 그래프 표시 설정 ===
  COLOR_SCHEME: ColorScheme;
  DEFAULT_GRAPH_MODE: string;
  RELOADING_GRAPH: GraphReloadMode;

  // === 내보내기 설정 ===
  EXPORT_TYPE: ExportType;
  EXPORT_GRAPH: string;
  CONTEXT_NAME: string;
  AI_EXPORT_GRAPH: string;

  // === 페이지 처리 설정 ===
  SINGLE_PAGE_GRAPH_PROCESSING: PageProcessingMode;
  MULTI_PAGE_GRAPH_PROCESSING: PageProcessingMode;
  LINK_PAGE_TO_MENTIONS: string;
  INCLUDE_LINKED_MENTIONS: MentionIncludeMode;
  INCLUDE_UNLINKED_MENTIONS: MentionIncludeMode;
  USE_OWN_UNLINKED_SEARCH: "yes" | "no";

  // === 네비게이션 설정 ===
  WHEN_USING_LOCATE: LocateMode;
  MOBILE_OPEN_GRAPH_IN: MobilePanelMode;

  // === ⚖️ 법률 특화 설정 ===
  LEGAL_MODE_ENABLED: boolean;
  LEGAL_DOCUMENT_TYPE: LegalDocumentType;
  LEGAL_ANALYSIS_MODE: LegalAnalysisMode;
  LEGAL_ENTITY_HIGHLIGHT: boolean;
  LEGAL_CITATION_LINK: boolean;
  LEGAL_STOPWORDS_ENABLED: boolean;
  LEGAL_DB_INTEGRATION: LegalDbIntegration;
  LEGAL_MOJ_API_KEY: string;       // 법제처 API 키 (선택사항, 공개 API)
  LEGAL_ISSUE_PANEL_ENABLED: boolean;
  LEGAL_EVIDENCE_MATRIX_ENABLED: boolean;
  LEGAL_PARTY_GRAPH_ENABLED: boolean;
  LEGAL_KOREAN_MODE: boolean;       // 한국어 법률 모드
}

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS: LexGraphSettings = {
  // InfraNodus API
  INFRANODUS_API_KEY: "",
  INFRANODUS_API_URL: "https://infranodus.com",
  INFRANODUS_GRAPH_URL: "https://graph.infranodus.com",

  // AI
  AI_MODEL: "gpt-4o-mini",

  // 그래프
  COLOR_SCHEME: "auto",
  DEFAULT_GRAPH_MODE: "",
  RELOADING_GRAPH: "automatic",

  // 내보내기
  EXPORT_TYPE: "manual",
  EXPORT_GRAPH: "",
  CONTEXT_NAME: "",
  AI_EXPORT_GRAPH: "",

  // 페이지 처리
  SINGLE_PAGE_GRAPH_PROCESSING: "All Text",
  MULTI_PAGE_GRAPH_PROCESSING: "All Text",
  LINK_PAGE_TO_MENTIONS: "parent_and_paragraph",
  INCLUDE_LINKED_MENTIONS: "For empty pages only",
  INCLUDE_UNLINKED_MENTIONS: "Never",
  USE_OWN_UNLINKED_SEARCH: "no",

  // 네비게이션
  WHEN_USING_LOCATE: "Force to Edit Mode",
  MOBILE_OPEN_GRAPH_IN: "Side view",

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
