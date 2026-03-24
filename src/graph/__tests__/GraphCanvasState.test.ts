import { describe, expect, it } from "vitest";
import {
  createGraphViewKey,
  restoreGraphLayoutState,
  scalePositionRecord,
} from "../GraphCanvasState";
import type { LocalGraphResult } from "../types";

describe("GraphCanvasState", () => {
  it("그래프 키를 결정론적으로 생성한다", () => {
    const graph: LocalGraphResult = {
      nodes: [
        { id: "b", label: "B" },
        { id: "a", label: "A" },
      ],
      edges: [
        { id: "2", source: "b", target: "a" },
      ],
      clusters: [],
      gaps: [],
      topNodes: [],
      stats: {
        nodeCount: 2,
        edgeCount: 1,
        clusterCount: 0,
        density: 1,
      },
    };

    expect(createGraphViewKey(graph)).toBe(createGraphViewKey({
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [{ id: "3", source: "a", target: "b" }],
    }));
  });

  it("저장된 좌표와 뷰포트를 새 캔버스 크기로 비례 복원한다", () => {
    const scaled = scalePositionRecord(
      { alpha: { x: 50, y: 25 } },
      { width: 100, height: 50 },
      { width: 200, height: 150 }
    );
    expect(scaled.alpha).toEqual({ x: 100, y: 75 });

    const restored = restoreGraphLayoutState(
      {
        graphKey: "demo",
        positions: { alpha: { x: 50, y: 25 } },
        viewport: { scale: 1.5, tx: 20, ty: 10 },
        canvasSize: { width: 100, height: 50 },
      },
      { width: 200, height: 150 }
    );

    expect(restored.positions.alpha).toEqual({ x: 100, y: 75 });
    expect(restored.viewport).toEqual({ scale: 1.5, tx: 40, ty: 30 });
  });
});
