import { buildLocalGraph, extractTopKeywords } from "./LocalGraphEngine";
import type { LocalGraphResult, TopicCluster } from "./types";

export interface FolderGraphDocument {
  id: string;
  title: string;
  content: string;
  links: string[];
}

const DOCUMENT_COLOR = "#6f80d8";
const DOCUMENT_CLUSTER_COLOR = "#8894df";
const DOC_KEYWORD_LIMIT = 8;

export function buildFolderGraph(documents: FolderGraphDocument[]): LocalGraphResult {
  if (documents.length === 0) {
    return buildLocalGraph("");
  }

  const mergedText = documents
    .map((doc) => `## ${doc.title}\n${doc.content}`)
    .join("\n\n---\n\n");
  const base = buildLocalGraph(mergedText);

  const nodes = [...base.nodes];
  const edges = [...base.edges];
  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const pageNodeIds: string[] = [];
  const seenEdges = new Set(edges.map((edge) => edge.id));
  const docIdByTitle = new Map(documents.map((doc) => [doc.title, doc.id]));
  const docKeywords = new Map<string, Set<string>>();

  for (const doc of documents) {
    const pageNodeId = `doc:${doc.id}`;
    pageNodeIds.push(pageNodeId);

    nodes.push({
      id: pageNodeId,
      label: doc.title,
      size: 16,
      color: DOCUMENT_COLOR,
      community: base.clusters.length,
      centrality: 0.85,
      nodeType: "document",
    });

    const keywords = extractTopKeywords(doc.content, DOC_KEYWORD_LIMIT).filter((keyword) => existingNodeIds.has(keyword));
    docKeywords.set(doc.id, new Set(keywords));
    for (const keyword of keywords) {
      const edgeId = createEdgeId(pageNodeId, keyword);
      if (seenEdges.has(edgeId)) continue;
      seenEdges.add(edgeId);
      edges.push({
        id: edgeId,
        source: pageNodeId,
        target: keyword,
        weight: 3,
        label: "언급",
      });
    }

    for (const link of doc.links) {
      const targetDocId = docIdByTitle.get(normalizeLinkTitle(link));
      if (!targetDocId || targetDocId === doc.id) continue;
      const targetNodeId = `doc:${targetDocId}`;
      const edgeId = createEdgeId(pageNodeId, targetNodeId);
      if (seenEdges.has(edgeId)) continue;
      seenEdges.add(edgeId);
      edges.push({
        id: edgeId,
        source: pageNodeId,
        target: targetNodeId,
        weight: 5,
        label: "위키링크",
      });
    }
  }

  for (let index = 0; index < documents.length; index++) {
    for (let otherIndex = index + 1; otherIndex < documents.length; otherIndex++) {
      const left = documents[index];
      const right = documents[otherIndex];
      const sharedKeywords = intersectKeywords(
        docKeywords.get(left.id) ?? new Set(),
        docKeywords.get(right.id) ?? new Set()
      );
      if (sharedKeywords.length === 0) continue;

      const leftNodeId = `doc:${left.id}`;
      const rightNodeId = `doc:${right.id}`;
      const edgeId = createEdgeId(leftNodeId, rightNodeId);
      if (seenEdges.has(edgeId)) continue;
      seenEdges.add(edgeId);
      edges.push({
        id: edgeId,
        source: leftNodeId,
        target: rightNodeId,
        weight: Math.min(4, 1 + sharedKeywords.length),
        label: "공통개념",
      });
    }
  }

  const clusters: TopicCluster[] = pageNodeIds.length > 0
    ? [
        ...base.clusters,
        {
          id: base.clusters.length,
          name: "문서",
          nodes: pageNodeIds,
          centrality: 0.8,
          color: DOCUMENT_CLUSTER_COLOR,
        },
      ]
    : base.clusters;

  const topNodes = [
    ...documents.slice(0, 3).map((doc) => doc.title),
    ...base.topNodes,
  ].slice(0, 10);

  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;

  return {
    nodes,
    edges,
    clusters,
    gaps: base.gaps,
    topNodes,
    stats: {
      nodeCount,
      edgeCount,
      clusterCount: clusters.length,
      density: Math.round(density * 1000) / 1000,
    },
  };
}

function createEdgeId(a: string, b: string): string {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}

function normalizeLinkTitle(link: string): string {
  return link.split("|")[0].trim();
}

function intersectKeywords(left: Set<string>, right: Set<string>): string[] {
  const shared: string[] = [];

  for (const keyword of left) {
    if (right.has(keyword)) {
      shared.push(keyword);
    }
  }

  return shared;
}
