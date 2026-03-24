import { callAi } from "../ai/LocalAiClient";
import type { LegalDocumentType, LexGraphSettings } from "../settings/LexGraphSettings";
import type { GraphEdge, GraphNode, LocalGraphResult, TopicCluster } from "./types";

export interface AiGraphNode {
  id: string;
  label: string;
  type: "issue" | "fact" | "law" | "party" | "evidence" | "concept";
  weight: number;
  description?: string;
}

export interface AiGraphEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface AiGraphResult {
  nodes: AiGraphNode[];
  edges: AiGraphEdge[];
  issues: string[];
  summary: string;
}

const AI_GRAPH_SYSTEM_PROMPT = [
  "당신은 한국 법률 문서 분석 전문가입니다.",
  "반드시 유효한 JSON만 반환하고, 코드펜스나 설명 문장은 절대 포함하지 마세요.",
  "노드는 법적 쟁점, 사실관계, 적용 법령, 당사자, 증거, 핵심 개념을 중심으로 추출하세요.",
  "엣지는 노드 간 법적 관계를 relation 필드에 한국어로 명시하세요.",
].join(" ");

const TYPE_TO_CLUSTER: Record<AiGraphNode["type"], number> = {
  issue: 0,
  fact: 1,
  law: 2,
  party: 3,
  evidence: 4,
  concept: 5,
};

const TYPE_ORDER: AiGraphNode["type"][] = [
  "issue",
  "fact",
  "law",
  "party",
  "evidence",
  "concept",
];

export const NODE_TYPE_COLORS: Record<AiGraphNode["type"], string> = {
  issue: "#e07b54",
  fact: "#5cad6e",
  law: "#4f86c6",
  party: "#9b6ed9",
  evidence: "#d4a843",
  concept: "#7bad59",
};

export const TYPE_LABELS: Record<AiGraphNode["type"], string> = {
  issue: "쟁점",
  fact: "사실관계",
  law: "적용 법령",
  party: "당사자",
  evidence: "증거",
  concept: "법률 개념",
};

export async function buildAiGraph(
  documentText: string,
  documentType: LegalDocumentType,
  settings: LexGraphSettings
): Promise<AiGraphResult> {
  const userPrompt = [
    `문서 유형: ${documentType}`,
    "",
    "다음 요구사항에 맞춰 지식 그래프를 JSON으로 반환하세요.",
    "1. nodes: 10~30개",
    "2. edges: 최소 15개",
    '3. node.type은 "issue"|"fact"|"law"|"party"|"evidence"|"concept" 중 하나',
    '4. relation은 "근거", "대립", "인용", "위반", "계약", "입증" 같은 한국어 관계명',
    "5. issues에는 핵심 쟁점 문자열만 넣기",
    "6. summary는 문서 한 줄 요약",
    "",
    JSON.stringify({
      nodes: [
        { id: "n1", label: "손해배상청구", type: "issue", weight: 9 },
        { id: "n2", label: "민법 제390조", type: "law", weight: 7 },
      ],
      edges: [
        { source: "n1", target: "n2", relation: "근거", weight: 4 },
      ],
      issues: ["채무불이행에 따른 손해배상 책임"],
      summary: "채무불이행과 손해배상 책임이 핵심인 민사 분쟁 문서",
    }, null, 2),
    "",
    "문서:",
    clipDocument(documentText),
  ].join("\n");

  const raw = await callAi(AI_GRAPH_SYSTEM_PROMPT, userPrompt, settings);
  return normalizeAiGraphResult(parseAiGraphResult(raw));
}

export function convertAiGraphToLocalGraph(aiResult: AiGraphResult): LocalGraphResult {
  const nodes: GraphNode[] = aiResult.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    community: TYPE_TO_CLUSTER[node.type],
    centrality: clamp(node.weight / 10, 0.1, 1),
    size: Math.max(6, Math.min(20, node.weight * 1.6)),
    color: NODE_TYPE_COLORS[node.type],
    nodeType: node.type,
  }));

  const edges: GraphEdge[] = aiResult.edges.map((edge, index) => ({
    id: `ai-edge-${index}`,
    source: edge.source,
    target: edge.target,
    weight: edge.weight,
    label: edge.relation,
  }));

  const clusters: TopicCluster[] = TYPE_ORDER
    .map((type) => {
      const typeNodes = aiResult.nodes.filter((node) => node.type === type);
      if (typeNodes.length === 0) return null;

      return {
        id: TYPE_TO_CLUSTER[type],
        name: TYPE_LABELS[type],
        nodes: typeNodes.map((node) => node.id),
        centrality:
          typeNodes.reduce((sum, node) => sum + node.weight, 0) /
          Math.max(1, typeNodes.length * 10),
        color: NODE_TYPE_COLORS[type],
      } satisfies TopicCluster;
    })
    .filter((cluster): cluster is TopicCluster => cluster !== null);

  const topNodes = [...aiResult.nodes]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map((node) => node.label);

  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;

  return {
    nodes,
    edges,
    clusters,
    gaps: [],
    topNodes,
    stats: {
      nodeCount,
      edgeCount,
      clusterCount: clusters.length,
      density: Math.round(density * 1000) / 1000,
    },
  };
}

function clipDocument(text: string): string {
  const normalized = text.trim();
  if (normalized.length <= 14000) return normalized;
  return `${normalized.slice(0, 10000)}\n\n[중략]\n\n${normalized.slice(-3500)}`;
}

function parseAiGraphResult(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? raw).trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  const jsonText =
    firstBrace >= 0 && lastBrace >= firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI JSON 파싱 실패";
    throw new Error(`AI 그래프 응답을 JSON으로 해석하지 못했습니다: ${message}`);
  }
}

function normalizeAiGraphResult(value: unknown): AiGraphResult {
  if (!value || typeof value !== "object") {
    throw new Error("AI 그래프 응답이 객체 형식이 아닙니다.");
  }

  const record = value as Record<string, unknown>;
  const rawNodes = Array.isArray(record.nodes) ? record.nodes : [];
  const rawEdges = Array.isArray(record.edges) ? record.edges : [];
  const rawIssues = Array.isArray(record.issues) ? record.issues : [];
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";

  const nodes = rawNodes
    .map((node, index) => normalizeNode(node, index))
    .filter((node): node is AiGraphNode => node !== null);

  if (nodes.length < 3) {
    throw new Error("AI 그래프 응답에서 유효한 노드를 충분히 추출하지 못했습니다.");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges
    .map((edge) => normalizeEdge(edge))
    .filter((edge): edge is AiGraphEdge => edge !== null)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target);

  if (edges.length === 0) {
    throw new Error("AI 그래프 응답에서 유효한 엣지를 추출하지 못했습니다.");
  }

  const issues = rawIssues
    .filter((issue): issue is string => typeof issue === "string")
    .map((issue) => issue.trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    nodes,
    edges,
    issues,
    summary,
  };
}

function normalizeNode(value: unknown, index: number): AiGraphNode | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = normalizeNodeType(record.type);
  const label = typeof record.label === "string" ? record.label.trim() : "";

  if (!type || !label) return null;

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `ai-node-${index + 1}`,
    label,
    type,
    weight: clampNumber(record.weight, 1, 10, 5),
    description: typeof record.description === "string" ? record.description.trim() : undefined,
  };
}

function normalizeEdge(value: unknown): AiGraphEdge | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const source = typeof record.source === "string" ? record.source.trim() : "";
  const target = typeof record.target === "string" ? record.target.trim() : "";
  const relation = typeof record.relation === "string" ? record.relation.trim() : "";

  if (!source || !target) return null;

  return {
    source,
    target,
    relation: relation || "관련",
    weight: clampNumber(record.weight, 1, 5, 2),
  };
}

function normalizeNodeType(value: unknown): AiGraphNode["type"] | null {
  if (typeof value !== "string") return null;
  return TYPE_ORDER.includes(value as AiGraphNode["type"])
    ? (value as AiGraphNode["type"])
    : null;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric, min, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
