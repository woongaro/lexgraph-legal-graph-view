import type { GraphEdge } from "./types";

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutWorkerRequest {
  type: "layout";
  jobId: number;
  nodeIds: string[];
  edges: Array<Pick<GraphEdge, "source" | "target">>;
  positions: Record<string, LayoutPoint>;
  width: number;
  height: number;
  iterations: number;
  initialTemperature: number;
}

export interface LayoutWorkerResponse {
  type: "layoutResult";
  jobId: number;
  positions: Record<string, LayoutPoint>;
  iterations: number;
  finalTemperature: number;
}

export const WORKER_LAYOUT_THRESHOLD = 60;

let layoutWorkerUrl: string | null = null;

const LAYOUT_WORKER_SOURCE = `
self.onmessage = function(event) {
  var data = event.data;
  if (!data || data.type !== "layout") return;

  var positions = data.positions || {};
  var nodeIds = data.nodeIds || [];
  var edges = data.edges || [];
  var width = data.width || 0;
  var height = data.height || 0;
  var iterations = data.iterations || 0;
  var temperature = data.initialTemperature || 0;

  for (var iter = 0; iter < iterations && temperature > 0.8; iter++) {
    temperature = runLayoutIteration(positions, nodeIds, edges, width, height, temperature);
  }

  self.postMessage({
    type: "layoutResult",
    jobId: data.jobId,
    positions: positions,
    iterations: iterations,
    finalTemperature: temperature
  });
};

function runLayoutIteration(positions, nodeIds, edges, width, height, temperature) {
  var count = Math.max(1, nodeIds.length);
  var k = Math.sqrt((width * height) / count);
  var margin = 24;
  var disp = {};

  for (var i = 0; i < nodeIds.length; i++) {
    disp[nodeIds[i]] = { x: 0, y: 0 };
  }

  for (var a = 0; a < nodeIds.length; a++) {
    for (var b = a + 1; b < nodeIds.length; b++) {
      var u = nodeIds[a];
      var v = nodeIds[b];
      var pu = positions[u];
      var pv = positions[v];
      if (!pu || !pv) continue;

      var dx = pu.x - pv.x;
      var dy = pu.y - pv.y;
      var dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
      var force = (k * k) / dist;
      disp[u].x += (dx / dist) * force;
      disp[u].y += (dy / dist) * force;
      disp[v].x -= (dx / dist) * force;
      disp[v].y -= (dy / dist) * force;
    }
  }

  for (var edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
    var edge = edges[edgeIndex];
    var from = positions[edge.source];
    var to = positions[edge.target];
    if (!from || !to) continue;

    var edgeDx = to.x - from.x;
    var edgeDy = to.y - from.y;
    var edgeDist = Math.max(0.5, Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy));
    var edgeForce = (edgeDist * edgeDist) / Math.max(0.0001, k);
    disp[edge.source].x += (edgeDx / edgeDist) * edgeForce;
    disp[edge.source].y += (edgeDy / edgeDist) * edgeForce;
    disp[edge.target].x -= (edgeDx / edgeDist) * edgeForce;
    disp[edge.target].y -= (edgeDy / edgeDist) * edgeForce;
  }

  for (var nodeIndex = 0; nodeIndex < nodeIds.length; nodeIndex++) {
    var nodeId = nodeIds[nodeIndex];
    var offset = disp[nodeId];
    var pos = positions[nodeId];
    if (!offset || !pos) continue;

    var length = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
    if (length === 0) continue;

    var scale = Math.min(length, temperature) / length;
    pos.x = Math.min(width - margin, Math.max(margin, pos.x + offset.x * scale));
    pos.y = Math.min(height - margin, Math.max(margin, pos.y + offset.y * scale));
  }

  return temperature * 0.94;
}
`;

export function createLayoutWorker(): Worker | null {
  if (
    typeof Worker === "undefined" ||
    typeof URL === "undefined" ||
    typeof Blob === "undefined"
  ) {
    return null;
  }

  try {
    if (!layoutWorkerUrl) {
      layoutWorkerUrl = URL.createObjectURL(
        new Blob([LAYOUT_WORKER_SOURCE], { type: "text/javascript" })
      );
    }
    return new Worker(layoutWorkerUrl);
  } catch {
    return null;
  }
}
