// 그래프 공유 타입 (로컬 그래프 엔진)

export interface GraphNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  community?: number;
  centrality?: number;
  nodeType?: "issue" | "fact" | "law" | "party" | "evidence" | "concept" | "document";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight?: number;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphViewportState {
  scale: number;
  tx: number;
  ty: number;
}

export interface GraphCanvasSize {
  width: number;
  height: number;
}

export interface GraphLayoutState {
  graphKey: string;
  positions: Record<string, GraphPoint>;
  viewport: GraphViewportState;
  canvasSize: GraphCanvasSize;
}

/**
 * 토픽 클러스터 — 레이블 전파로 탐지된 개념 묶음
 */
export interface TopicCluster {
  id: number;
  name: string;
  nodes: string[];
  centrality: number;
  color?: string;
}

/**
 * 구조적 갭 — 클러스터 간 논리적 단절
 */
export interface StructuralGap {
  between: [string, string];
  betweennessScore: number;
  suggestedConnection?: string;
}

/**
 * 로컬 그래프 빌드 결과
 */
export interface LocalGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: TopicCluster[];
  gaps: StructuralGap[];
  topNodes: string[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    clusterCount: number;
    density: number;
  };
}
