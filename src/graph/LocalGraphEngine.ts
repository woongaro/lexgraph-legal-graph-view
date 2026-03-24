// 로컬 그래프 엔진 — 공출현 행렬 + 레이블 전파 클러스터링 + 갭 탐지
// InfraNodus 의존성 없이 완전 로컬 동작

import { getLegalStopwords } from "../legal/preprocessor/KoreanLegalStopwords";
import { splitLegalCompound } from "../legal/preprocessor/KoreanLegalCompounds";
import type { GraphNode, GraphEdge, TopicCluster, StructuralGap, LocalGraphResult } from "./types";

const MAX_NODES = 80;
const WINDOW_SIZE = 4;
const MAX_ITER_LABEL_PROP = 15;

const CLUSTER_COLORS = [
  "#4f86c6", "#e07b54", "#5cad6e", "#9b6ed9",
  "#d4a843", "#e05480", "#43a8d4", "#7bad59",
  "#c96cb8", "#5eb8a4",
];

export interface GraphBuildOptions {
  maxNodes?: number;
  windowSize?: number;
  minEdgeWeight?: number;
}

export function extractTopKeywords(text: string, maxKeywords = 12): string[] {
  const tokens = tokenize(text);
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([keyword]) => keyword);
}

/**
 * 텍스트에서 로컬 지식 그래프 생성
 */
export function buildLocalGraph(
  text: string,
  options: GraphBuildOptions = {}
): LocalGraphResult {
  const maxNodes = options.maxNodes ?? MAX_NODES;
  const windowSize = options.windowSize ?? WINDOW_SIZE;

  const tokens = tokenize(text);
  if (tokens.length < 5) return emptyResult();
  const minEdgeWeight = options.minEdgeWeight ?? Math.max(1, Math.floor(tokens.length / 300));

  // 1. 단어 빈도
  const wordFreq = new Map<string, number>();
  for (const tok of tokens) {
    wordFreq.set(tok, (wordFreq.get(tok) ?? 0) + 1);
  }

  // 2. 상위 N개 선택
  const topWords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxNodes)
    .map(([w]) => w);
  const topWordSet = new Set(topWords);

  // 3. 공출현 (sliding window)
  const coOccurrence = new Map<string, Map<string, number>>();
  for (let i = 0; i < tokens.length; i++) {
    const w1 = tokens[i];
    if (!topWordSet.has(w1)) continue;
    for (let j = i + 1; j < Math.min(i + windowSize + 1, tokens.length); j++) {
      const w2 = tokens[j];
      if (!topWordSet.has(w2) || w1 === w2) continue;
      const [a, b] = w1 < w2 ? [w1, w2] : [w2, w1];
      if (!coOccurrence.has(a)) coOccurrence.set(a, new Map());
      const inner = coOccurrence.get(a)!;
      inner.set(b, (inner.get(b) ?? 0) + 1);
    }
  }

  // 4. 엣지 + 인접 리스트 구축
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, Set<string>>();
  for (const [a, neighbors] of coOccurrence) {
    for (const [b, weight] of neighbors) {
      if (weight < minEdgeWeight) continue;
      edges.push({ id: `${a}--${b}`, source: a, target: b, weight });
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(a)!.add(b);
      adjacency.get(b)!.add(a);
    }
  }

  // 5. 연결된 노드만 유지 (최소 5개 보장)
  const connected = topWords.filter((w) => (adjacency.get(w)?.size ?? 0) > 0);
  const graphWords = connected.length >= 5 ? connected : topWords.slice(0, Math.max(5, connected.length));

  // 6. 레이블 전파 클러스터링
  const communities = labelPropagation(graphWords, adjacency);

  // 7. 커뮤니티 → TopicCluster 변환
  const communityMap = new Map<number, string[]>();
  for (const [word, comm] of communities) {
    if (!communityMap.has(comm)) communityMap.set(comm, []);
    communityMap.get(comm)!.push(word);
  }

  const clusters: TopicCluster[] = [];
  for (const [, clusterWords] of communityMap) {
    const sorted = [...clusterWords].sort(
      (a, b) => (wordFreq.get(b) ?? 0) - (wordFreq.get(a) ?? 0)
    );
    const idx = clusters.length;
    clusters.push({
      id: idx,
      name: sorted[0] ?? `클러스터 ${idx + 1}`,
      nodes: sorted,
      centrality: (wordFreq.get(sorted[0]) ?? 0) / Math.max(1, tokens.length),
      color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
    });
  }
  clusters.sort((a, b) => b.centrality - a.centrality);
  clusters.forEach((c, i) => {
    c.id = i;
    c.color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
  });

  // 8. 노드 구축
  const maxDegree = Math.max(1, ...graphWords.map((w) => adjacency.get(w)?.size ?? 0));
  const clusterByWord = new Map<string, TopicCluster>();
  for (const c of clusters) {
    for (const w of c.nodes) clusterByWord.set(w, c);
  }

  const nodes: GraphNode[] = graphWords.map((word) => ({
    id: word,
    label: word,
    community: clusterByWord.get(word)?.id ?? 0,
    centrality: (adjacency.get(word)?.size ?? 0) / maxDegree,
    size: Math.max(4, Math.min(18, (wordFreq.get(word) ?? 1) * 2)),
    color: clusterByWord.get(word)?.color ?? "#888888",
  }));

  // 9. 구조적 갭 탐지
  const gaps = detectGaps(clusters, adjacency);

  // 10. 상위 노드 (degree centrality 기준)
  const topNodes = [...nodes]
    .sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0))
    .slice(0, 10)
    .map((n) => n.label);

  const n = nodes.length;
  const density = n > 1 ? (2 * edges.length) / (n * (n - 1)) : 0;

  return {
    nodes,
    edges,
    clusters,
    gaps,
    topNodes,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      clusterCount: clusters.length,
      density: Math.round(density * 1000) / 1000,
    },
  };
}

// ── 토큰화 ───────────────────────────────────────────────

const LEGAL_STOPWORDS = getLegalStopwords("standard");

function tokenize(text: string): string[] {
  const preservedCaseNumbers = text.match(/\d{4}[가-힣]{1,5}\d+/g) ?? [];
  const preservedArticles = [...text.matchAll(/제\s*(\d+)\s*조/g)].map((match) => `제${match[1]}조`);

  const cleaned = text
    .replace(/\d{4}[가-힣]{1,5}\d+/g, " ")
    .replace(/제\s*(\d+)\s*조/g, " ")
    .replace(/[0-9]+/g, " ")
    .replace(/[^\uAC00-\uD7AF\uA960-\uA97F\u1100-\u11FFa-zA-Z\s]/g, " ");

  const tokens = tokenizeWithBigrams(cleaned);
  return [...tokens, ...preservedCaseNumbers, ...preservedArticles].filter(
    (token) => token.length >= 2 && !LEGAL_STOPWORDS.has(token)
  );
}

function tokenizeWithBigrams(text: string): string[] {
  const tokens: string[] = [];

  for (const word of text.split(/\s+/)) {
    const cleanedWord = word.trim();
    if (cleanedWord.length < 2) continue;
    if (!LEGAL_STOPWORDS.has(cleanedWord)) tokens.push(cleanedWord);

    const compoundParts = splitLegalCompound(cleanedWord);
    for (const part of compoundParts) {
      if (part.length >= 2 && !LEGAL_STOPWORDS.has(part)) {
        tokens.push(part);
      }
    }

    if (cleanedWord.length >= 4 && /^[가-힣]+$/.test(cleanedWord)) {
      for (let i = 0; i <= cleanedWord.length - 2; i++) {
        const gram = cleanedWord.slice(i, i + 2);
        if (!LEGAL_STOPWORDS.has(gram)) {
          tokens.push(gram);
        }
      }
    }
  }

  return tokens;
}

// ── 레이블 전파 클러스터링 ─────────────────────────────

function labelPropagation(
  words: string[],
  adjacency: Map<string, Set<string>>
): Map<string, number> {
  const labels = new Map<string, number>();
  words.forEach((w, i) => labels.set(w, i));
  const seed = createDeterministicSeed(words, adjacency);

  for (let iter = 0; iter < MAX_ITER_LABEL_PROP; iter++) {
    let changed = false;
    const shuffled = deterministicShuffle(words, seed + iter * 97);

    for (const word of shuffled) {
      const neighbors = adjacency.get(word);
      if (!neighbors || neighbors.size === 0) continue;

      const freq = new Map<number, number>();
      for (const nb of neighbors) {
        const lbl = labels.get(nb) ?? 0;
        freq.set(lbl, (freq.get(lbl) ?? 0) + 1);
      }

      let best = labels.get(word)!;
      let bestCnt = freq.get(best) ?? 0;
      for (const [lbl, cnt] of freq) {
        if (cnt > bestCnt) { best = lbl; bestCnt = cnt; }
      }

      if (best !== labels.get(word)) {
        labels.set(word, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 레이블 0부터 재매핑
  const unique = [...new Set(labels.values())];
  const remap = new Map(unique.map((l, i) => [l, i]));
  const result = new Map<string, number>();
  for (const [w, l] of labels) result.set(w, remap.get(l) ?? 0);
  return result;
}

function createDeterministicSeed(
  words: string[],
  adjacency: Map<string, Set<string>>
): number {
  let hash = 2166136261;
  const entries = [...words].sort();

  for (const word of entries) {
    for (let i = 0; i < word.length; i++) {
      hash ^= word.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const degree = adjacency.get(word)?.size ?? 0;
    hash ^= degree;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function deterministicShuffle(words: string[], seed: number): string[] {
  const shuffled = [...words];
  const random = createSeededRandom(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ── 구조적 갭 탐지 ───────────────────────────────────────

function detectGaps(
  clusters: TopicCluster[],
  adjacency: Map<string, Set<string>>
): StructuralGap[] {
  const gaps: StructuralGap[] = [];

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const c1 = clusters[i];
      const c2 = clusters[j];

      let interEdges = 0;
      for (const n1 of c1.nodes) {
        const nb = adjacency.get(n1);
        if (!nb) continue;
        for (const n2 of c2.nodes) {
          if (nb.has(n2)) interEdges++;
        }
      }

      const maxPossible = c1.nodes.length * c2.nodes.length;
      const gapScore = 1 - interEdges / Math.max(1, maxPossible);
      if (gapScore > 0.85) {
        gaps.push({ between: [c1.name, c2.name], betweennessScore: gapScore });
      }
    }
  }

  return gaps.sort((a, b) => b.betweennessScore - a.betweennessScore).slice(0, 5);
}

function emptyResult(): LocalGraphResult {
  return {
    nodes: [],
    edges: [],
    clusters: [],
    gaps: [],
    topNodes: [],
    stats: { nodeCount: 0, edgeCount: 0, clusterCount: 0, density: 0 },
  };
}
