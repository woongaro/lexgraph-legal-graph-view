// 그래프 유틸리티 함수

import { App, WorkspaceLeaf } from "obsidian";
import { LEXGRAPH_VIEW_TYPE } from "../views/LexGraphView";

/**
 * 그래프 사이드 뷰 열기 또는 포커스
 */
export async function openGraphSideView(app: App): Promise<WorkspaceLeaf | null> {
  const existingLeaves = app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);

  if (existingLeaves.length > 0) {
    app.workspace.setActiveLeaf(existingLeaves[0], { focus: true });
    void app.workspace.revealLeaf(existingLeaves[0]);
    return existingLeaves[0];
  }

  // 새 사이드 뷰 생성
  const leaf = app.workspace.getRightLeaf(false);
  if (!leaf) return null;

  await leaf.setViewState({ type: LEXGRAPH_VIEW_TYPE });
  app.workspace.setActiveLeaf(leaf, { focus: true });
  void app.workspace.revealLeaf(leaf);

  return leaf;
}

/**
 * 그래프 이름 인코딩 (InfraNodus 그래프 이름 규칙)
 */
export function encodeGraphName(
  graphName: string,
  prefix?: string,
  vaultName?: string
): string {
  let encoded = graphName.replace(/[\s%&=?#/\\]/g, "_");

  if (prefix) {
    encoded = `${prefix}_${encoded}`;
  }
  if (vaultName) {
    encoded = `${vaultName}_${encoded}`;
  }

  // URL 인코딩 문자 제거, 최대 32자
  return encoded
    .replace(/%[0-9A-Fa-f]{2}/g, "_")
    .slice(0, 32) || "from_lexgraph";
}

/**
 * 텍스트 길이 포맷 (KB/문자 수)
 */
export function formatTextLength(length: number): string {
  if (length < 1000) return `${length}자`;
  return `${(length / 1000).toFixed(1)}K자`;
}
