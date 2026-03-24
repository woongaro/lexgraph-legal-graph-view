// GraphCanvas — HTML5 Canvas 기반 force-directed 그래프 시각화
// Fruchterman-Reingold 알고리즘, d3 의존성 없음

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type {
  GraphCanvasSize,
  GraphLayoutState,
  GraphPoint,
  GraphViewportState,
  LocalGraphResult,
} from "./types";
import {
  createLayoutWorker,
  type LayoutWorkerRequest,
  type LayoutWorkerResponse,
  WORKER_LAYOUT_THRESHOLD,
} from "./LayoutWorker";
import {
  createGraphViewKey,
  positionMapToRecord,
  positionRecordToMap,
  restoreGraphLayoutState,
} from "./GraphCanvasState";

interface GraphCanvasProps {
  graphData: LocalGraphResult;
  isDark?: boolean;
  onNodeClick?: (nodeId: string) => void;
  highlightedNodeIds?: Set<string>;
  edgeLabelsEnabled?: boolean;
  initialLayoutState?: GraphLayoutState;
  onLayoutStateChange?: (state: GraphLayoutState) => void;
}

type Vec2 = GraphPoint;
type TransformState = GraphViewportState;

// ── Fruchterman-Reingold 레이아웃 ─────────────────────────

function initializeLayout(
  graphData: LocalGraphResult,
  W: number,
  H: number
): Map<string, Vec2> {
  const pos = new Map<string, Vec2>();
  const nodeIds = graphData.nodes.map((node) => node.id);
  const typedBuckets = groupNodesByPreferredType(graphData.nodes);

  if (typedBuckets.size > 1) {
    positionTypedNodes(pos, typedBuckets, W, H);
  } else {
    nodeIds.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / nodeIds.length;
      const r = Math.min(W, H) * 0.35;
      pos.set(id, { x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle) });
    });
  }

  return pos;
}

function groupNodesByPreferredType(nodes: LocalGraphResult["nodes"]): Map<string, string[]> {
  const buckets = new Map<string, string[]>();

  for (const node of nodes) {
    const type = inferPreferredType(node);
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type)!.push(node.id);
  }

  return buckets;
}

function inferPreferredType(node: LocalGraphResult["nodes"][number]): string {
  if (node.nodeType) return node.nodeType;
  if (/^제\d+조$/.test(node.label) || /[가-힣A-Za-z]+법$/.test(node.label)) return "law";
  if (/^(원고|피고|항소인|피항소인|상고인|피상고인|채권자|채무자)$/.test(node.label)) return "party";
  if (/갑제\d+호증|을제\d+호증|병제\d+호증/.test(node.label)) return "evidence";
  return "concept";
}

function positionTypedNodes(
  pos: Map<string, Vec2>,
  buckets: Map<string, string[]>,
  W: number,
  H: number
): void {
  const placements: Record<string, { x: number; y: number; spreadX: number; spreadY: number }> = {
    law: { x: W * 0.5, y: H * 0.16, spreadX: W * 0.45, spreadY: H * 0.08 },
    issue: { x: W * 0.5, y: H * 0.34, spreadX: W * 0.4, spreadY: H * 0.08 },
    concept: { x: W * 0.5, y: H * 0.52, spreadX: W * 0.48, spreadY: H * 0.18 },
    fact: { x: W * 0.5, y: H * 0.66, spreadX: W * 0.4, spreadY: H * 0.08 },
    evidence: { x: W * 0.5, y: H * 0.82, spreadX: W * 0.44, spreadY: H * 0.06 },
    document: { x: W * 0.16, y: H * 0.5, spreadX: W * 0.12, spreadY: H * 0.62 },
    party: { x: W * 0.84, y: H * 0.5, spreadX: W * 0.12, spreadY: H * 0.62 },
  };

  for (const [type, ids] of buckets.entries()) {
    const placement = placements[type] ?? placements.concept;
    ids.forEach((id, index) => {
      const count = ids.length;
      const colCount = Math.max(1, Math.ceil(Math.sqrt(count)));
      const rowCount = Math.max(1, Math.ceil(count / colCount));
      const col = index % colCount;
      const row = Math.floor(index / colCount);
      const x =
        placement.x +
        ((colCount === 1 ? 0 : col / (colCount - 1)) - 0.5) * placement.spreadX;
      const y =
        placement.y +
        ((rowCount === 1 ? 0 : row / (rowCount - 1)) - 0.5) * placement.spreadY;
      pos.set(id, { x, y });
    });
  }
}

function runLayoutIteration(
  pos: Map<string, Vec2>,
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
  W: number,
  H: number,
  temperature: number,
  pinnedNodeId: string | null
): number {
  const k = Math.sqrt((W * H) / nodeIds.length);
  const margin = 24;
  const disp = new Map<string, Vec2>();
  nodeIds.forEach((id) => disp.set(id, { x: 0, y: 0 }));

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const u = nodeIds[i];
      const v = nodeIds[j];
      const pu = pos.get(u)!;
      const pv = pos.get(v)!;
      const dx = pu.x - pv.x;
      const dy = pu.y - pv.y;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
      const f = (k * k) / dist;
      const du = disp.get(u)!;
      const dv = disp.get(v)!;
      du.x += (dx / dist) * f;
      du.y += (dy / dist) * f;
      dv.x -= (dx / dist) * f;
      dv.y -= (dy / dist) * f;
    }
  }

  for (const edge of edges) {
    const pu = pos.get(edge.source);
    const pv = pos.get(edge.target);
    if (!pu || !pv) continue;
    const dx = pv.x - pu.x;
    const dy = pv.y - pu.y;
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
    const f = (dist * dist) / k;
    const du = disp.get(edge.source)!;
    const dv = disp.get(edge.target)!;
    du.x += (dx / dist) * f;
    du.y += (dy / dist) * f;
    dv.x -= (dx / dist) * f;
    dv.y -= (dy / dist) * f;
  }

  for (const id of nodeIds) {
    if (id === pinnedNodeId) continue;
    const d = disp.get(id)!;
    const len = Math.sqrt(d.x * d.x + d.y * d.y);
    if (len === 0) continue;
    const scale = Math.min(len, temperature) / len;
    const p = pos.get(id)!;
    p.x = Math.min(W - margin, Math.max(margin, p.x + d.x * scale));
    p.y = Math.min(H - margin, Math.max(margin, p.y + d.y * scale));
  }

  return temperature * 0.94;
}

// ── 그리기 ────────────────────────────────────────────────

function drawGraph(
  canvas: HTMLCanvasElement,
  graphData: LocalGraphResult,
  pos: Map<string, Vec2>,
  isDark: boolean,
  hovered: string | null,
  highlightedNodeIds: Set<string>,
  transform: TransformState,
  edgeLabelsEnabled: boolean,
  visibleNodeIds: Set<string>
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;
  const bg = isDark ? "#1e1e2e" : "#f8f8f8";
  const edgeColor = isDark ? "rgba(180,180,180,0.18)" : "rgba(100,100,100,0.18)";
  const labelColor = isDark ? "#e0e0e0" : "#333333";
  const hasHighlights = highlightedNodeIds.size > 0;
  const hasFilter = visibleNodeIds.size > 0;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(transform.tx, transform.ty);
  ctx.scale(transform.scale, transform.scale);

  // 엣지
  const maxW = Math.max(1, ...graphData.edges.map((e) => e.weight ?? 1));
  for (const edge of graphData.edges) {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) continue;
    const pu = pos.get(edge.source), pv = pos.get(edge.target);
    if (!pu || !pv) continue;
    const isHighlighted =
      !hasHighlights ||
      (highlightedNodeIds.has(edge.source) && highlightedNodeIds.has(edge.target));

    ctx.beginPath();
    ctx.moveTo(pu.x, pu.y);
    ctx.lineTo(pv.x, pv.y);
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = Math.max(0.5, ((edge.weight ?? 1) / maxW) * 2.5);
    ctx.globalAlpha = isHighlighted ? 1 : 0.18;
    ctx.stroke();

    if (edge.label && edgeLabelsEnabled && (edge.weight ?? 0) >= 3) {
      ctx.save();
      ctx.globalAlpha = isHighlighted ? 0.9 : 0.3;
      ctx.fillStyle = isDark ? "rgba(214,214,214,0.9)" : "rgba(80,80,80,0.9)";
      ctx.font = `${Math.max(8, 10 / transform.scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(edge.label, (pu.x + pv.x) / 2, (pu.y + pv.y) / 2 - 4 / transform.scale);
      ctx.restore();
    }
  }

  // 노드
  const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
  for (const node of graphData.nodes) {
    if (!visibleNodeIds.has(node.id)) continue;
    const p = pos.get(node.id);
    if (!p) continue;
    const isHighlighted = !hasHighlights || highlightedNodeIds.has(node.id);
    const r = (node.size ?? 8) * (hovered === node.id ? 1.3 : 1);
    const color = node.color ?? "#4f86c6";

    // 그림자 (hover)
    if (hovered === node.id) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
      ctx.globalAlpha = 1;
      ctx.fill();
    }

    // 원
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = isHighlighted ? 1 : 0.2;
    ctx.fill();
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 레이블 (크기 큰 노드만)
    const nodeData = nodeMap.get(node.id);
    if ((nodeData?.centrality ?? 0) > 0.3 || r >= 8) {
      ctx.fillStyle = labelColor;
      ctx.globalAlpha = isHighlighted ? 1 : 0.35;
      ctx.font = `${Math.min(11, Math.max(9, r / Math.max(1, transform.scale))) + 1}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.label, p.x, p.y + r + 3 / transform.scale);
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  if (!hasFilter) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = isDark ? "#c7cad1" : "#5b6472";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("검색 결과가 없습니다.", W / 2, H / 2);
  }
}

function getFilteredNodes(
  graphData: LocalGraphResult,
  query: string
): Set<string> {
  if (!query.trim()) return new Set(graphData.nodes.map((node) => node.id));

  const q = query.trim().toLowerCase();
  const matched = new Set(
    graphData.nodes
      .filter((node) => node.label.toLowerCase().includes(q))
      .map((node) => node.id)
  );

  graphData.edges.forEach((edge) => {
    if (matched.has(edge.source)) matched.add(edge.target);
    if (matched.has(edge.target)) matched.add(edge.source);
  });

  return matched;
}

function exportAsPng(canvas: HTMLCanvasElement, filename = "lexgraph"): void {
  const link = document.createElement("a");
  link.download = `${filename}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function exportAsJson(
  graphData: LocalGraphResult,
  visibleNodeIds: Set<string>,
  filename = "lexgraph-data"
): void {
  const json = JSON.stringify({
    nodes: graphData.nodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((node) => ({
        id: node.id,
        label: node.label,
        type: node.nodeType ?? node.community,
        size: node.size,
      })),
    edges: graphData.edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        label: edge.label,
      })),
    clusters: graphData.clusters
      .map((cluster) => ({
        name: cluster.name,
        nodes: cluster.nodes.filter((nodeId) => visibleNodeIds.has(nodeId)),
      }))
      .filter((cluster) => cluster.nodes.length > 0),
  }, null, 2);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── React 컴포넌트 ─────────────────────────────────────────

export function GraphCanvas({
  graphData,
  isDark = false,
  onNodeClick,
  highlightedNodeIds = new Set(),
  edgeLabelsEnabled = false,
  initialLayoutState,
  onLayoutStateChange,
}: GraphCanvasProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef<Map<string, Vec2>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const transformRef = useRef<TransformState>({ scale: 1, tx: 0, ty: 0 });
  const dragNodeRef = useRef<string | null>(null);
  const isPanningRef = useRef(false);
  const pointerDownNodeRef = useRef<string | null>(null);
  const lastClientPosRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const layoutFrameRef = useRef<number | null>(null);
  const layoutWorkerRef = useRef<Worker | null>(null);
  const layoutJobRef = useRef(0);
  const layoutIterationRef = useRef(0);
  const layoutTemperatureRef = useRef(0);
  const persistTimerRef = useRef<number | null>(null);
  const canvasSizeRef = useRef<GraphCanvasSize>({ width: 0, height: 0 });
  const initialLayoutStateRef = useRef<GraphLayoutState | undefined>(initialLayoutState);
  const [searchQuery, setSearchQuery] = useState("");
  const drawOptionsRef = useRef({
    isDark,
    highlightedNodeIds,
    edgeLabelsEnabled,
  });
  const visibleNodeIdsRef = useRef<Set<string>>(new Set(graphData.nodes.map((node) => node.id)));
  const graphKey = useMemo(() => createGraphViewKey(graphData), [graphData]);

  const visibleNodeIds = getFilteredNodes(graphData, searchQuery);
  const visibleEdgeCount = graphData.edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  ).length;

  useEffect(() => {
    drawOptionsRef.current = {
      isDark,
      highlightedNodeIds,
      edgeLabelsEnabled,
    };
  }, [edgeLabelsEnabled, highlightedNodeIds, isDark]);

  useEffect(() => {
    initialLayoutStateRef.current = initialLayoutState;
  }, [initialLayoutState]);

  const drawCurrent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;
    drawGraph(
      canvas,
      graphData,
      posRef.current,
      drawOptionsRef.current.isDark,
      hoveredRef.current,
      drawOptionsRef.current.highlightedNodeIds,
      transformRef.current,
      drawOptionsRef.current.edgeLabelsEnabled,
      visibleNodeIdsRef.current
    );
  }, [graphData]);

  const persistLayoutState = useCallback(() => {
    if (!onLayoutStateChange || posRef.current.size === 0) return;
    const { width, height } = canvasSizeRef.current;
    if (!width || !height) return;

    onLayoutStateChange({
      graphKey,
      positions: positionMapToRecord(posRef.current),
      viewport: { ...transformRef.current },
      canvasSize: { width, height },
    });
  }, [graphKey, onLayoutStateChange]);

  const schedulePersistLayoutState = useCallback((delay = 120) => {
    if (!onLayoutStateChange) return;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistLayoutState();
    }, delay);
  }, [onLayoutStateChange, persistLayoutState]);

  useEffect(() => {
    visibleNodeIdsRef.current = visibleNodeIds;
    if (hoveredRef.current && !visibleNodeIds.has(hoveredRef.current)) {
      hoveredRef.current = null;
      setHovered(null);
    }
    drawCurrent();
  }, [drawCurrent, visibleNodeIds]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return { width: 0, height: 0 };

    const dpr = window.devicePixelRatio || 1;
    const width = wrapper.clientWidth || 400;
    const height = wrapper.clientHeight || 400;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvasSizeRef.current = { width, height };
    return { width, height };
  }, [graphKey]);

  const cancelLayoutWork = useCallback(() => {
    layoutJobRef.current += 1;

    if (layoutFrameRef.current !== null) {
      cancelAnimationFrame(layoutFrameRef.current);
      layoutFrameRef.current = null;
    }

    if (layoutWorkerRef.current) {
      layoutWorkerRef.current.terminate();
      layoutWorkerRef.current = null;
    }
  }, []);

  const scaleCurrentPositions = useCallback((
    previousSize: GraphCanvasSize,
    nextSize: GraphCanvasSize,
  ) => {
    if (posRef.current.size === 0) return;

    const restoredState = restoreGraphLayoutState(
      {
        graphKey,
        positions: positionMapToRecord(posRef.current),
        viewport: transformRef.current,
        canvasSize: previousSize,
      },
      nextSize
    );

    posRef.current = positionRecordToMap(restoredState.positions);
    transformRef.current = restoredState.viewport;
  }, [graphKey]);

  const runLayoutOnMainThread = useCallback((
    jobId: number,
    width: number,
    height: number,
  ) => {
    layoutIterationRef.current = 0;
    layoutTemperatureRef.current = Math.min(width, height) * 0.12;

    const step = () => {
      if (layoutJobRef.current !== jobId) return;
      if (graphData.nodes.length <= 1) {
        drawCurrent();
        return;
      }

      layoutTemperatureRef.current = runLayoutIteration(
        posRef.current,
        graphData.nodes.map((node) => node.id),
        graphData.edges,
        width,
        height,
        layoutTemperatureRef.current,
        dragNodeRef.current
      );
      layoutIterationRef.current += 1;
      drawCurrent();

      if (layoutIterationRef.current < 90 && layoutTemperatureRef.current > 0.8) {
        layoutFrameRef.current = requestAnimationFrame(step);
      } else {
        layoutFrameRef.current = null;
        schedulePersistLayoutState(0);
      }
    };

    layoutFrameRef.current = requestAnimationFrame(step);
  }, [drawCurrent, graphData, schedulePersistLayoutState]);

  const startLayout = useCallback(() => {
    const { width, height } = resizeCanvas();
    if (!width || !height || graphData.nodes.length === 0) return;

    cancelLayoutWork();
    const jobId = layoutJobRef.current;
    const savedState = initialLayoutStateRef.current;

    if (savedState && savedState.graphKey === graphKey) {
      const restoredState = restoreGraphLayoutState(savedState, { width, height });
      posRef.current = positionRecordToMap(restoredState.positions);
      transformRef.current = restoredState.viewport;
      drawCurrent();
      return;
    }

    transformRef.current = { scale: 1, tx: 0, ty: 0 };
    posRef.current = initializeLayout(graphData, width, height);
    drawCurrent();

    if (graphData.nodes.length < WORKER_LAYOUT_THRESHOLD) {
      runLayoutOnMainThread(jobId, width, height);
      return;
    }

    const worker = createLayoutWorker();
    if (!worker) {
      runLayoutOnMainThread(jobId, width, height);
      return;
    }

    layoutWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<LayoutWorkerResponse>) => {
      const data = event.data;
      if (!data || data.type !== "layoutResult" || data.jobId !== layoutJobRef.current) {
        return;
      }

      posRef.current = positionRecordToMap(data.positions);
      layoutTemperatureRef.current = data.finalTemperature;
      layoutIterationRef.current = data.iterations;
      layoutWorkerRef.current?.terminate();
      layoutWorkerRef.current = null;
      drawCurrent();
      schedulePersistLayoutState(0);
    };
    worker.onerror = () => {
      layoutWorkerRef.current?.terminate();
      layoutWorkerRef.current = null;
      if (layoutJobRef.current === jobId) {
        runLayoutOnMainThread(jobId, width, height);
      }
    };

    const payload: LayoutWorkerRequest = {
      type: "layout",
      jobId,
      nodeIds: graphData.nodes.map((node) => node.id),
      edges: graphData.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
      positions: positionMapToRecord(posRef.current),
      width,
      height,
      iterations: 90,
      initialTemperature: Math.min(width, height) * 0.12,
    };

    worker.postMessage(payload);
  }, [
    cancelLayoutWork,
    drawCurrent,
    graphData,
    graphKey,
    resizeCanvas,
    runLayoutOnMainThread,
    schedulePersistLayoutState,
  ]);

  const handleResize = useCallback(() => {
    const previousSize = canvasSizeRef.current;
    const { width, height } = resizeCanvas();
    if (!width || !height || graphData.nodes.length === 0) return;

    if (previousSize.width && previousSize.height && posRef.current.size > 0) {
      scaleCurrentPositions(previousSize, { width, height });
      drawCurrent();
      schedulePersistLayoutState();
      return;
    }

    drawCurrent();
  }, [drawCurrent, graphData.nodes.length, resizeCanvas, scaleCurrentPositions, schedulePersistLayoutState]);

  useEffect(() => {
    startLayout();

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      cancelLayoutWork();
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [cancelLayoutWork, graphKey, handleResize, startLayout]);

  useEffect(() => {
    hoveredRef.current = hovered;
    drawCurrent();
  }, [drawCurrent, hovered, highlightedNodeIds, isDark, edgeLabelsEnabled]);

  const toGraphCoords = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { scale, tx, ty } = transformRef.current;
    return {
      x: (clientX - rect.left - tx) / scale,
      y: (clientY - rect.top - ty) / scale,
    };
  }, []);

  const getHitNode = useCallback((clientX: number, clientY: number): string | null => {
    const coords = toGraphCoords(clientX, clientY);
    if (!coords) return null;
    const scale = transformRef.current.scale;

    for (let index = graphData.nodes.length - 1; index >= 0; index--) {
      const node = graphData.nodes[index];
      if (!visibleNodeIdsRef.current.has(node.id)) continue;
      const p = posRef.current.get(node.id);
      if (!p) continue;
      const r = (node.size ?? 8) + 6 / scale;
      const dx = coords.x - p.x;
      const dy = coords.y - p.y;
      if (dx * dx + dy * dy <= r * r) return node.id;
    }
    return null;
  }, [graphData.nodes, toGraphCoords]);

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs">
        그래프 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* 통계 배지 */}
      <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-400 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <span>노드 {visibleNodeIds.size}/{graphData.stats.nodeCount}</span>
        <span>엣지 {visibleEdgeCount}/{graphData.stats.edgeCount}</span>
        <span>클러스터 {graphData.stats.clusterCount}</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="노드 검색"
          className="ml-auto min-w-0 w-28 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px] text-gray-600 dark:text-gray-300"
        />
        {searchQuery && (
          <button
            className="px-1.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px]"
            onClick={() => setSearchQuery("")}
          >
            초기화
          </button>
        )}
        <button
          className="px-1.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px]"
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) exportAsPng(canvas);
          }}
        >
          PNG
        </button>
        <button
          className="px-1.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px]"
          onClick={() => exportAsJson(graphData, visibleNodeIdsRef.current)}
        >
          JSON
        </button>
      </div>
      {/* 캔버스 */}
      <div ref={wrapperRef} className="flex-1 w-full min-h-0">
        <canvas
          ref={canvasRef}
          className="flex-1 w-full h-full cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.setPointerCapture(e.pointerId);
            cancelLayoutWork();

            const hit = getHitNode(e.clientX, e.clientY);
            pointerDownNodeRef.current = hit;
            movedRef.current = false;
            lastClientPosRef.current = { x: e.clientX, y: e.clientY };

            if (hit) {
              dragNodeRef.current = hit;
              const point = posRef.current.get(hit);
              const coords = toGraphCoords(e.clientX, e.clientY);
              if (point && coords) {
                dragOffsetRef.current = {
                  x: coords.x - point.x,
                  y: coords.y - point.y,
                };
              }
            } else {
              isPanningRef.current = true;
            }
          }}
          onPointerMove={(e) => {
            const hit = getHitNode(e.clientX, e.clientY);

            if (dragNodeRef.current) {
              const coords = toGraphCoords(e.clientX, e.clientY);
              const point = posRef.current.get(dragNodeRef.current);
              if (coords && point) {
                point.x = coords.x - dragOffsetRef.current.x;
                point.y = coords.y - dragOffsetRef.current.y;
                drawCurrent();
                movedRef.current = true;
              }
              return;
            }

            if (isPanningRef.current) {
              const dx = e.clientX - lastClientPosRef.current.x;
              const dy = e.clientY - lastClientPosRef.current.y;
              transformRef.current = {
                ...transformRef.current,
                tx: transformRef.current.tx + dx,
                ty: transformRef.current.ty + dy,
              };
              lastClientPosRef.current = { x: e.clientX, y: e.clientY };
              movedRef.current = true;
              drawCurrent();
              return;
            }

            if (hit !== hoveredRef.current) {
              hoveredRef.current = hit;
              setHovered(hit);
            }
          }}
          onPointerUp={(e) => {
            const canvas = canvasRef.current;
            if (canvas?.hasPointerCapture(e.pointerId)) {
              canvas.releasePointerCapture(e.pointerId);
            }

            const hit = getHitNode(e.clientX, e.clientY);
            const clickedNode =
              !movedRef.current &&
              pointerDownNodeRef.current !== null &&
              pointerDownNodeRef.current === hit
                ? hit
                : null;

            dragNodeRef.current = null;
            isPanningRef.current = false;
            pointerDownNodeRef.current = null;

            if (movedRef.current) {
              schedulePersistLayoutState(0);
            }

            if (clickedNode) {
              onNodeClick?.(clickedNode);
            }
          }}
          onPointerLeave={() => {
            if (dragNodeRef.current || isPanningRef.current) return;
            hoveredRef.current = null;
            setHovered(null);
          }}
          onWheel={(e) => {
            e.preventDefault();
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const { scale, tx, ty } = transformRef.current;
            const zoomFactor = Math.exp(-e.deltaY * 0.0015);
            const nextScale = Math.min(4, Math.max(0.3, scale * zoomFactor));
            const graphX = (mx - tx) / scale;
            const graphY = (my - ty) / scale;

            transformRef.current = {
              scale: nextScale,
              tx: mx - graphX * nextScale,
              ty: my - graphY * nextScale,
            };
            drawCurrent();
            schedulePersistLayoutState();
          }}
        />
      </div>
      {/* 클러스터 범례 */}
      {graphData.clusters.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 py-1 text-xs flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
          {graphData.clusters.slice(0, 6).map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.color ?? "#888" }}
              />
              <span className="text-gray-500 dark:text-gray-400">{c.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
