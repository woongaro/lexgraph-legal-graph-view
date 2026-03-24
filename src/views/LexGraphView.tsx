// LexGraph View — Obsidian ItemView 확장
// 그래프 뷰 + 법률 분석 패널을 통합한 메인 뷰

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import React from "react";

import type LexGraphPlugin from "../main";
import type { LegalDocumentType, LegalAnalysisMode } from "../settings/LexGraphSettings";
import type { ExtractionResult } from "../legal/preprocessor/LegalEntityExtractor";
import type { DocumentMetadata } from "../legal/preprocessor/LegalTextPreprocessor";
import type { IssueSpotResult } from "../legal/ai/IssueSpotter";
import type { LocalGraphResult } from "../graph/types";
import { buildLocalGraph } from "../graph/LocalGraphEngine";
import { callAi, isAiConfigured } from "../ai/LocalAiClient";
import { buildLegalPrompt } from "../legal/ai/LegalPromptTemplates";
import { spotIssues } from "../legal/ai/IssueSpotter";
import { generateCounterArguments, formatCounterAnalysis } from "../legal/ai/CounterArgumentGen";
import { LexGraphApp } from "../components/LexGraphApp";

export const LEXGRAPH_VIEW_TYPE = "lexgraph-graph-view";

/**
 * 그래프 로드 파라미터
 */
export interface GraphLoadParams {
  filePath?: string;
  processedText?: string;
  sourcePath?: string;
  documentType?: LegalDocumentType;
  entities?: ExtractionResult | null;
  metadata?: DocumentMetadata | null;
  isFolder?: boolean;
}

/**
 * 그래프 상태
 */
export interface GraphState {
  isLoading: boolean;
  error?: string;
  graphData?: LocalGraphResult;
  documentType: LegalDocumentType;
  metadata?: DocumentMetadata | null;
  entities?: ExtractionResult | null;
  aiResult?: string;
  lastFilePath?: string;
}

/**
 * LexGraph 메인 뷰
 */
export class LexGraphView extends ItemView {
  private root: Root | null = null;
  private plugin: LexGraphPlugin;
  private graphState: GraphState = {
    isLoading: false,
    documentType: "general",
  };

  private setGraphStateCallback?: (state: GraphState) => void;

  constructor(leaf: WorkspaceLeaf, plugin: LexGraphPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return LEXGRAPH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "LexGraph 법률 분석";
  }

  getIcon(): string {
    return "lexgraph-icon";
  }

  async onOpen(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("lexgraph-view");

    this.root = createRoot(containerEl);
    this.root.render(
      <LexGraphApp
        plugin={this.plugin}
        initialState={this.graphState}
        onStateChange={(state) => { this.graphState = state; }}
        onRegisterSetState={(setter) => { this.setGraphStateCallback = setter; }}
      />
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  /**
   * 그래프 리로드 — 외부에서 호출
   */
  async reloadGraph(params: GraphLoadParams): Promise<void> {
    this.updateState({
      isLoading: true,
      error: undefined,
      documentType: params.documentType ?? "general",
      metadata: params.metadata,
      entities: params.entities,
      lastFilePath: params.filePath,
    });

    try {
      let text = params.processedText ?? "";

      if (!text && params.filePath && !params.isFolder) {
        const file = this.app.vault.getAbstractFileByPath(params.filePath);
        if (file) {
          const { TFile } = await import("obsidian");
          if (file instanceof TFile) {
            text = await this.app.vault.cachedRead(file);
          }
        }
      }

      if (!text && params.isFolder && params.filePath) {
        text = await this.readFolderContents(params.filePath);
      }

      if (!text.trim()) {
        this.updateState({ isLoading: false, error: "분석할 텍스트가 없습니다." });
        return;
      }

      // 로컬 그래프 빌드
      const graphData = buildLocalGraph(text);

      if (graphData.nodes.length === 0) {
        this.updateState({
          isLoading: false,
          error: "텍스트에서 충분한 법률 개념을 추출하지 못했습니다. 더 긴 문서를 분석해보세요.",
        });
        return;
      }

      this.updateState({
        isLoading: false,
        graphData,
        documentType: params.documentType ?? "general",
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      this.updateState({ isLoading: false, error: message });
      new Notice(`LexGraph 오류: ${message}`);
    }
  }

  /**
   * 법률 AI 분석 실행
   */
  async runLegalAnalysis(mode: LegalAnalysisMode): Promise<void> {
    const { settings } = this.plugin;

    new Notice("법률 AI 분석 실행 중...");

    try {
      const lastPath = this.graphState.lastFilePath;
      if (!lastPath) {
        new Notice("먼저 문서를 분석하세요.");
        return;
      }

      const file = this.app.vault.getAbstractFileByPath(lastPath);
      const { TFile } = await import("obsidian");
      if (!(file instanceof TFile)) return;

      const rawText = await this.app.vault.cachedRead(file);
      const docType = this.graphState.documentType;
      const entities = this.graphState.entities ?? emptyEntities();
      const graphData = this.graphState.graphData;
      const clusters = graphData?.clusters ?? [];
      const gaps = graphData?.gaps ?? [];

      // 쟁점 탐지: 로컬 처리
      if (mode === "issue_spotting") {
        const result = spotIssues(rawText, docType, clusters, gaps, entities);
        this.updateState({ aiResult: formatIssueSpotResult(result) });
        new Notice(`쟁점 ${result.issues.length}개 탐지 완료`);
        return;
      }

      // 반박 논거: 로컬 처리
      if (mode === "counter_argument") {
        const issueResult = spotIssues(rawText, docType, clusters, gaps, entities);
        const counterResult = generateCounterArguments(issueResult.issues, clusters, gaps, entities);
        this.updateState({ aiResult: formatCounterAnalysis(counterResult) });
        new Notice("반박 논거 분석 완료");
        return;
      }

      // brief_outline / risk_analysis / general: AI 사용
      if (!isAiConfigured(settings)) {
        new Notice("AI 제공자 및 API 키를 설정 탭에서 입력하세요.");
        this.updateState({ aiResult: "AI 제공자가 설정되지 않았습니다.\n설정 > AI 제공자를 선택하고 API 키를 입력하세요." });
        return;
      }

      // 그래프 없으면 빌드
      const activeGraphData = graphData ?? buildLocalGraph(rawText);
      const topNodes = activeGraphData.topNodes;

      const promptResult = buildLegalPrompt({
        mode,
        documentType: docType,
        topNodes,
        clusters: activeGraphData.clusters,
        gaps: activeGraphData.gaps,
        entities,
      });

      const aiText = await callAi(
        promptResult.systemPrompt,
        promptResult.userPrompt,
        settings
      );

      this.updateState({ aiResult: aiText });
      new Notice("법률 AI 분석 완료");

    } catch (err) {
      const message = err instanceof Error ? err.message : "분석 실패";
      new Notice(`AI 분석 오류: ${message}`);
    }
  }

  /**
   * 폴더 내 모든 마크다운 파일 내용 읽기
   */
  private async readFolderContents(folderPath: string): Promise<string> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) return "";

    const { TFolder, TFile } = await import("obsidian");
    if (!(folder instanceof TFolder)) return "";

    const contents: string[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        const content = await this.app.vault.cachedRead(child);
        contents.push(`## ${child.basename}\n${content}`);
      }
    }

    return contents.join("\n\n---\n\n");
  }

  /**
   * React 상태 업데이트
   */
  private updateState(partial: Partial<GraphState>): void {
    this.graphState = { ...this.graphState, ...partial };
    this.setGraphStateCallback?.(this.graphState);
  }
}

// ── 파일-외부 헬퍼 ─────────────────────────────────────────

function emptyEntities() {
  return { entities: [], caseNumbers: [], statutes: [], parties: [], dates: [], citations: [] };
}

function formatIssueSpotResult(result: IssueSpotResult): string {
  const lines: string[] = [];
  const qualityMap = { high: "높음", medium: "보통", low: "낮음" };

  lines.push(`## 쟁점 분석 결과\n`);
  lines.push(`**문서 유형**: ${result.documentType} | **분석 품질**: ${qualityMap[result.analysisQuality]}\n`);

  if (result.issues.length === 0) {
    lines.push("탐지된 쟁점이 없습니다.");
    return lines.join("\n");
  }

  lines.push(`### 탐지된 쟁점 (${result.issues.length}건)\n`);

  result.issues.forEach((issue, i) => {
    const pct = Math.round(issue.confidence * 100);
    lines.push(`#### ${i + 1}. ${issue.title} (신뢰도: ${pct}%)`);
    lines.push(issue.description);
    if (issue.legalBasis?.length) {
      lines.push(`**법적 근거**: ${issue.legalBasis.join(", ")}`);
    }
    lines.push("");
  });

  if (result.warnings.length > 0) {
    lines.push("### 주의사항");
    result.warnings.forEach((w, i) => lines.push(`${i + 1}. ${w}`));
  }

  return lines.join("\n");
}
