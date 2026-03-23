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
import { InfraNodusClient } from "../infranodus/InfraNodusClient";
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
  graphUrl?: string;
  documentType: LegalDocumentType;
  metadata?: DocumentMetadata | null;
  entities?: ExtractionResult | null;
  aiResult?: string;
  lastFilePath?: string;
  graphClusters?: import("../infranodus/types").TopicCluster[];
  graphGaps?: import("../infranodus/types").StructuralGap[];
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

  // React 상태 업데이트 콜백 (App 컴포넌트에서 주입)
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

    // React 루트 마운트
    this.root = createRoot(containerEl);
    this.root.render(
      <LexGraphApp
        plugin={this.plugin}
        initialState={this.graphState}
        onStateChange={(state) => {
          this.graphState = state;
        }}
        onRegisterSetState={(setter) => {
          this.setGraphStateCallback = setter;
        }}
      />
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  setTabTitle(title: string): void {
    const leaf = this.leaf as WorkspaceLeaf & { tabHeaderEl?: HTMLElement };
    if (leaf.tabHeaderEl) {
      const titleEl = leaf.tabHeaderEl.querySelector(".workspace-tab-header-inner-title");
      if (titleEl) titleEl.textContent = title;
    }
  }

  /**
   * 그래프 리로드 — 외부에서 호출
   */
  async reloadGraph(params: GraphLoadParams): Promise<void> {
    const { settings } = this.plugin;

    this.updateState({
      isLoading: true,
      error: undefined,
      documentType: params.documentType ?? "general",
      metadata: params.metadata,
      entities: params.entities,
      lastFilePath: params.filePath,
    });

    try {
      // 텍스트 준비
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

      // InfraNodus API로 그래프 생성
      if (!settings.INFRANODUS_API_KEY) {
        // API 키 없음 — 인증 안내 화면으로
        this.updateState({
          isLoading: false,
          error: "api_key_missing",
        });
        return;
      }

      const graphData = await InfraNodusClient.getGraphAndStatements({
        text,
        apiKey: settings.INFRANODUS_API_KEY,
        apiUrl: settings.INFRANODUS_API_URL,
        doNotSave: true,
        addStats: true,
        aiTopics: true,
      });

      if (graphData.error) {
        this.updateState({ isLoading: false, error: graphData.error });
        return;
      }

      // 그래프 데이터 추출
      const extracted = InfraNodusClient.extractDataFromGraphData(graphData);

      // 그래프 URL 구성 (iframe 렌더링용)
      const graphUrl = this.buildGraphUrl(text, params);

      this.updateState({
        isLoading: false,
        graphUrl,
        documentType: params.documentType ?? "general",
        graphClusters: extracted.topics,
        graphGaps: extracted.gaps,
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
      const clusters = this.graphState.graphClusters ?? [];
      const gaps = this.graphState.graphGaps ?? [];

      // 쟁점 탐지: 로컬 처리 (API 불필요)
      if (mode === "issue_spotting") {
        const result = spotIssues(rawText, docType, clusters, gaps, entities);
        this.updateState({ aiResult: formatIssueSpotResult(result) });
        new Notice(`쟁점 ${result.issues.length}개 탐지 완료`);
        return;
      }

      // 반박 논거: 로컬 처리 (API 불필요)
      if (mode === "counter_argument") {
        const issueResult = spotIssues(rawText, docType, clusters, gaps, entities);
        const counterResult = generateCounterArguments(issueResult.issues, clusters, gaps, entities);
        this.updateState({ aiResult: formatCounterAnalysis(counterResult) });
        new Notice("반박 논거 분석 완료");
        return;
      }

      // brief_outline / risk_analysis: InfraNodus AI 사용
      if (!settings.INFRANODUS_API_KEY) {
        new Notice("InfraNodus API 키를 설정하세요.");
        return;
      }

      // 그래프 데이터가 없으면 새로 조회
      let topics = clusters;
      let gapsList = gaps;
      let topNodes: string[] = [];

      if (topics.length === 0) {
        const graphData = await InfraNodusClient.getGraphAndStatements({
          text: rawText,
          apiKey: settings.INFRANODUS_API_KEY,
          apiUrl: settings.INFRANODUS_API_URL,
          doNotSave: true,
          addStats: true,
        });
        const extracted = InfraNodusClient.extractDataFromGraphData(graphData);
        topics = extracted.topics;
        gapsList = extracted.gaps;
        topNodes = extracted.topNodes;
      }

      const promptResult = buildLegalPrompt({
        mode,
        documentType: docType,
        topNodes,
        clusters: topics,
        gaps: gapsList,
        entities,
      });

      const adviceResponse = await InfraNodusClient.generateAdvice({
        prompt: promptResult.userPrompt,
        promptContext: promptResult.contextInfo,
        modelToUse: settings.AI_MODEL,
        apiKey: settings.INFRANODUS_API_KEY,
        apiUrl: settings.INFRANODUS_API_URL,
        mode: "legal",
      });

      if (adviceResponse.advice) {
        this.updateState({ aiResult: adviceResponse.advice });
        new Notice("법률 AI 분석 완료");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "분석 실패";
      new Notice(`AI 분석 오류: ${message}`);
    }
  }

  /**
   * 그래프 iframe URL 구성
   */
  private buildGraphUrl(text: string, params: GraphLoadParams): string {
    const { settings } = this.plugin;
    const encodedText = encodeURIComponent(text.slice(0, 2000));
    const theme = this.getColorScheme();

    let url = `${settings.INFRANODUS_GRAPH_URL}?text=${encodedText}&theme=${theme}`;

    if (settings.DEFAULT_GRAPH_MODE) {
      url += `&mode=${settings.DEFAULT_GRAPH_MODE}`;
    }

    return url;
  }

  /**
   * 현재 색상 테마 반환
   */
  private getColorScheme(): string {
    const { COLOR_SCHEME } = this.plugin.settings;
    if (COLOR_SCHEME !== "auto") return COLOR_SCHEME;

    const isDark = document.body.classList.contains("theme-dark");
    return isDark ? "dark" : "light";
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
