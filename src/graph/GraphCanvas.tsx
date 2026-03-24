// GraphCanvas — HTML5 Canvas 기반 force-directed 그래프 시각화
// Fruchterman-Reingold 알고리즘, d3 의존성 없음

import React, { useRef, useEffect, useState } from "react";
import type { LocalGraphResult } from "./types";

interface GraphCanvasProps {
  graphData: LocalGraphResult;
  isDark?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

interface Vec2 { x: number; y: number }

// ── Fruchterman-Reingold 레이아웃 ─────────────────────────

function computeLayout(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
  W: number,
  H: number
): Map<string, Vec2> {
  const pos = new Map<string, Vec2>();

  // 원형 초기 배치
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / nodeIds.length;
    const r = Math.min(W, H) * 0.35;
    pos.set(id, { x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle) });
  });

  if (nodeIds.length <= 1) return pos;

  const k = Math.sqrt((W * H) / nodeIds.length);
  let t = Math.min(W, H) * 0.12;
  const ITERS = 60;
  const margin = 24;

  for (let iter = 0; iter < ITERS; iter++) {
    const disp = new Map<string, Vec2>();
    nodeIds.forEach((id) => disp.set(id, { x: 0, y: 0 }));

    // 반발력
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const u = nodeIds[i], v = nodeIds[j];
        const pu = pos.get(u)!, pv = pos.get(v)!;
        const dx = pu.x - pv.x, dy = pu.y - pv.y;
        const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
        const f = (k * k) / dist;
        const du = disp.get(u)!, dv = disp.get(v)!;
        du.x += (dx / dist) * f; du.y += (dy / dist) * f;
        dv.x -= (dx / dist) * f; dv.y -= (dy / dist) * f;
      }
    }

    // 인력
    for (const e of edges) {
      const pu = pos.get(e.source), pv = pos.get(e.target);
      if (!pu || !pv) continue;
      const dx = pv.x - pu.x, dy = pv.y - pu.y;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
      const f = (dist * dist) / k;
      const du = disp.get(e.source)!, dv = disp.get(e.target)!;
      du.x += (dx / dist) * f; du.y += (dy / dist) * f;
      dv.x -= (dx / dist) * f; dv.y -= (dy / dist) * f;
    }

    // 위치 반영 + 경계 클램핑
    for (const id of nodeIds) {
      const d = disp.get(id)!;
      const len = Math.sqrt(d.x * d.x + d.y * d.y);
      if (len === 0) continue;
      const scale = Math.min(len, t) / len;
      const p = pos.get(id)!;
      p.x = Math.min(W - margin, Math.max(margin, p.x + d.x * scale));
      p.y = Math.min(H - margin, Math.max(margin, p.y + d.y * scale));
    }

    t *= 0.94;
  }

  return pos;
}

// ── 그리기 ────────────────────────────────────────────────

function drawGraph(
  canvas: HTMLCanvasElement,
  graphData: LocalGraphResult,
  pos: Map<string, Vec2>,
  isDark: boolean,
  hovered: string | null
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width, H = canvas.height;
  const bg = isDark ? "#1e1e2e" : "#f8f8f8";
  const edgeColor = isDark ? "rgba(180,180,180,0.18)" : "rgba(100,100,100,0.18)";
  const labelColor = isDark ? "#e0e0e0" : "#333333";

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 엣지
  const maxW = Math.max(1, ...graphData.edges.map((e) => e.weight ?? 1));
  for (const edge of graphData.edges) {
    const pu = pos.get(edge.source), pv = pos.get(edge.target);
    if (!pu || !pv) continue;
    ctx.beginPath();
    ctx.moveTo(pu.x, pu.y);
    ctx.lineTo(pv.x, pv.y);
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = Math.max(0.5, ((edge.weight ?? 1) / maxW) * 2.5);
    ctx.stroke();
  }

  // 노드
  const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
  for (const node of graphData.nodes) {
    const p = pos.get(node.id);
    if (!p) continue;
    const r = (node.size ?? 8) * (hovered === node.id ? 1.3 : 1);
    const color = node.color ?? "#4f86c6";

    // 그림자 (hover)
    if (hovered === node.id) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
      ctx.fill();
    }

    // 원
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 레이블 (크기 큰 노드만)
    const nodeData = nodeMap.get(node.id);
    if ((nodeData?.centrality ?? 0) > 0.3 || r >= 8) {
      ctx.fillStyle = labelColor;
      ctx.font = `${Math.min(11, Math.max(9, r))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.label, p.x, p.y + r + 2);
    }
  }
}

// ── React 컴포넌트 ─────────────────────────────────────────

export function GraphCanvas({ graphData, isDark = false, onNodeClick }: GraphCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef<Map<string, Vec2>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);

  // 레이아웃 계산 + 초기 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;

    const W = canvas.clientWidth || 400;
    const H = canvas.clientHeight || 400;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d");
    ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);

    const nodeIds = graphData.nodes.map((n) => n.id);
    posRef.current = computeLayout(nodeIds, graphData.edges, W, H);
    drawGraph(canvas, graphData, posRef.current, isDark, hoveredRef.current);
  }, [graphData, isDark]);

  // hover 재그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;
    drawGraph(canvas, graphData, posRef.current, isDark, hovered);
  }, [hovered, graphData, isDark]);

  function getHitNode(e: React.MouseEvent<HTMLCanvasElement>): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const node of graphData.nodes) {
      const p = posRef.current.get(node.id);
      if (!p) continue;
      const r = (node.size ?? 8) + 4;
      const dx = mx - p.x, dy = my - p.y;
      if (dx * dx + dy * dy <= r * r) return node.id;
    }
    return null;
  }

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
      <div className="flex gap-2 px-2 py-1 text-xs text-gray-400 flex-shrink-0">
        <span>노드 {graphData.stats.nodeCount}</span>
        <span>엣지 {graphData.stats.edgeCount}</span>
        <span>클러스터 {graphData.stats.clusterCount}</span>
      </div>
      {/* 캔버스 */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full cursor-pointer"
        onMouseMove={(e) => {
          const hit = getHitNode(e);
          if (hit !== hoveredRef.current) {
            hoveredRef.current = hit;
            setHovered(hit);
          }
        }}
        onMouseLeave={() => {
          hoveredRef.current = null;
          setHovered(null);
        }}
        onClick={(e) => {
          const hit = getHitNode(e);
          if (hit) onNodeClick?.(hit);
        }}
      />
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
