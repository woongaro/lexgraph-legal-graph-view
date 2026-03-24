import type {
  GraphCanvasSize,
  GraphLayoutState,
  GraphPoint,
  GraphViewportState,
  LocalGraphResult,
} from "./types";

export function createGraphViewKey(graphData: LocalGraphResult): string {
  const nodeIds = graphData.nodes
    .map((node) => node.id)
    .sort()
    .join("|");
  const edgeIds = graphData.edges
    .map((edge) => (edge.source < edge.target
      ? `${edge.source}--${edge.target}`
      : `${edge.target}--${edge.source}`))
    .sort()
    .join("|");

  return `${graphData.stats.nodeCount}:${graphData.stats.edgeCount}:${nodeIds}::${edgeIds}`;
}

export function positionMapToRecord(
  positions: Map<string, GraphPoint>
): Record<string, GraphPoint> {
  const record: Record<string, GraphPoint> = {};

  for (const [id, point] of positions.entries()) {
    record[id] = { x: point.x, y: point.y };
  }

  return record;
}

export function positionRecordToMap(
  positions: Record<string, GraphPoint>
): Map<string, GraphPoint> {
  return new Map(
    Object.entries(positions).map(([id, point]) => [id, { x: point.x, y: point.y }])
  );
}

export function scalePositionRecord(
  positions: Record<string, GraphPoint>,
  from: GraphCanvasSize,
  to: GraphCanvasSize
): Record<string, GraphPoint> {
  if (!from.width || !from.height || !to.width || !to.height) {
    return { ...positions };
  }

  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  const scaled: Record<string, GraphPoint> = {};

  for (const [id, point] of Object.entries(positions)) {
    scaled[id] = {
      x: point.x * scaleX,
      y: point.y * scaleY,
    };
  }

  return scaled;
}

export function scaleViewportState(
  viewport: GraphViewportState,
  from: GraphCanvasSize,
  to: GraphCanvasSize
): GraphViewportState {
  if (!from.width || !from.height || !to.width || !to.height) {
    return { ...viewport };
  }

  return {
    scale: viewport.scale,
    tx: viewport.tx * (to.width / from.width),
    ty: viewport.ty * (to.height / from.height),
  };
}

export function restoreGraphLayoutState(
  state: GraphLayoutState,
  nextCanvasSize: GraphCanvasSize
): GraphLayoutState {
  return {
    graphKey: state.graphKey,
    positions: scalePositionRecord(state.positions, state.canvasSize, nextCanvasSize),
    viewport: scaleViewportState(state.viewport, state.canvasSize, nextCanvasSize),
    canvasSize: nextCanvasSize,
  };
}
