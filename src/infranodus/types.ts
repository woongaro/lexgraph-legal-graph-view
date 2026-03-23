// InfraNodus API 응답 타입 정의

/**
 * 그래프 노드
 */
export interface GraphNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  community?: number;
  centrality?: number;
  attributes?: Record<string, unknown>;
}

/**
 * 그래프 엣지
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight?: number;
  attributes?: Record<string, unknown>;
}

/**
 * 그래프 데이터 (Graphology JSON 형식)
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  attributes?: Record<string, unknown>;
}

/**
 * 토픽 클러스터
 */
export interface TopicCluster {
  id: number;
  name: string;
  nodes: string[];
  centrality: number;
  color?: string;
}

/**
 * 구조적 갭 (연결되지 않은 클러스터 사이)
 */
export interface StructuralGap {
  between: [string, string];  // 두 클러스터 이름
  betweennessScore: number;
  suggestedConnection?: string;
}

/**
 * AI 분석 결과 토픽
 */
export interface AiTopic {
  name: string;
  description?: string;
  relatedNodes: string[];
}

/**
 * InfraNodus API - getGraphAndStatements 응답
 */
export interface GraphAndStatementsResponse {
  graph?: GraphData;
  topics?: TopicCluster[];
  gaps?: StructuralGap[];
  stats?: GraphStats;
  statements?: string[];
  aiTopics?: AiTopic[];
  error?: string;
  errorCode?: number;
}

/**
 * 그래프 통계
 */
export interface GraphStats {
  nodes: number;
  edges: number;
  density: number;
  modularity?: number;
  avgDegree?: number;
}

/**
 * AI 분석 프롬프트 요청
 */
export interface PromptContext {
  prompt: string;
  promptContext: string;
}

/**
 * AI 조언 요청 파라미터
 */
export interface AdviceParams {
  prompt: string;
  promptContext?: string;
  modelToUse: string;
  apiKey: string;
  apiUrl: string;
  mode?: string;
}

/**
 * AI 조언 응답
 */
export interface AdviceResponse {
  advice?: string;
  error?: string;
}

/**
 * 텍스트 내보내기 파라미터
 */
export interface ExportTextParams {
  text: string;
  contextName: string;
  apiKey: string;
  apiUrl: string;
}

/**
 * 텍스트 내보내기 응답
 */
export interface ExportTextResponse {
  success: boolean;
  graphName?: string;
  error?: string;
}
