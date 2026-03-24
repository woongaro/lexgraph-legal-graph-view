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
import type { GraphLayoutState, LocalGraphResult } from "../graph/types";
import type { Evidence, FactItem } from "../legal/graph/EvidenceMatrix";
import { buildLocalGraph } from "../graph/LocalGraphEngine";
import { callAi, isAiConfigured } from "../ai/LocalAiClient";
import { buildLegalPrompt } from "../legal/ai/LegalPromptTemplates";
import { spotIssues } from "../legal/ai/IssueSpotter";
import { generateCounterArguments, formatCounterAnalysis } from "../legal/ai/CounterArgumentGen";
import { LexGraphApp } from "../components/LexGraphApp";
import type { AiGraphResult } from "../graph/AiGraphBuilder";
import { buildAiGraph, convertAiGraphToLocalGraph } from "../graph/AiGraphBuilder";
import { MojLawClient } from "../legal/api/MojLawClient";
import { SupremeCourtClient } from "../legal/api/SupremeCourtClient";
import { buildFolderGraph, type FolderGraphDocument } from "../graph/FolderGraphBuilder";

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
  aiGraphResult?: AiGraphResult;
  lastFilePath?: string;
  lastRawText?: string;
  lastSourceLabel?: string;
  isAiGraph?: boolean;
  aiGraphMeta?: {
    summary: string;
    extractedIssues: string[];
  };
  graphLayoutState?: GraphLayoutState;
  manualEvidence?: Evidence[];
  manualFacts?: FactItem[];
  sourceKey?: string;
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

  getPersistenceKey(): string | undefined {
    return this.graphState.sourceKey;
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
      lastSourceLabel: params.sourcePath ?? params.filePath,
    });

    try {
      const settings = this.plugin.settings;
      const sourceKey = getPersistenceSourceKey(params);
      let rawText = params.processedText ?? "";
      let graphText = params.processedText ?? "";

      if (!rawText && params.filePath && !params.isFolder) {
        const file = this.app.vault.getAbstractFileByPath(params.filePath);
        if (file) {
          const { TFile } = await import("obsidian");
          if (file instanceof TFile) {
            rawText = await this.app.vault.cachedRead(file);
            const linkedMentions = await this.collectLinkedMentions(file, rawText);
            if (linkedMentions) {
              rawText = `${rawText}\n\n---\n\n${linkedMentions}`;
            }
            graphText = params.processedText || rawText;
          }
        }
      }

      if (!rawText && params.isFolder && params.filePath) {
        rawText = await this.readFolderContents(params.filePath);
        graphText = rawText;
      }

      if (settings.SINGLE_PAGE_GRAPH_PROCESSING === "[[Wiki Links]] Only") {
        graphText = this.extractWikiLinksOnly(rawText || graphText);
      }

      if (!graphText.trim()) {
        this.updateState({ isLoading: false, error: "분석할 텍스트가 없습니다." });
        return;
      }

      let graphData: LocalGraphResult | undefined;
      let aiGraphResult: AiGraphResult | undefined;

      if (isAiConfigured(settings) && settings.AI_GRAPH_ENABLED) {
        try {
          aiGraphResult = await buildAiGraph(
            rawText || graphText,
            params.documentType ?? "general",
            settings
          );
          graphData = convertAiGraphToLocalGraph(aiGraphResult);
        } catch (error) {
          console.warn("AI graph generation failed:", error);
          if (!settings.AI_GRAPH_FALLBACK) {
            throw error;
          }
        }
      }

      if (!graphData && params.isFolder && params.filePath) {
        const folderGraphDocs = await this.readFolderGraphDocuments(params.filePath);
        graphData = buildFolderGraph(folderGraphDocs);
      }

      if (!graphData) {
        graphData = buildLocalGraph(graphText);
      }

      if (graphData.nodes.length === 0) {
        this.updateState({
          isLoading: false,
          error: "텍스트에서 충분한 법률 개념을 추출하지 못했습니다. 더 긴 문서를 분석해보세요.",
        });
        return;
      }

      const persistedState = sourceKey
        ? this.plugin.getPersistedDocumentState(sourceKey)
        : undefined;

      this.updateState({
        isLoading: false,
        graphData,
        documentType: params.documentType ?? "general",
        aiGraphResult,
        aiResult: undefined,
        lastRawText: rawText || graphText,
        isAiGraph: !!aiGraphResult,
        aiGraphMeta: aiGraphResult
          ? {
              summary: aiGraphResult.summary,
              extractedIssues: aiGraphResult.issues,
            }
          : undefined,
        graphLayoutState: persistedState?.graphLayoutState,
        manualEvidence: persistedState?.manualEvidence ?? [],
        manualFacts: persistedState?.manualFacts ?? [],
        sourceKey,
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
      const rawTextFromState = this.graphState.lastRawText;

      if (!rawTextFromState && !lastPath) {
        new Notice("먼저 문서를 분석하세요.");
        return;
      }

      let rawText = rawTextFromState ?? "";
      if (!rawText && lastPath) {
        const file = this.app.vault.getAbstractFileByPath(lastPath);
        const { TFile } = await import("obsidian");
        if (!(file instanceof TFile)) return;
        rawText = await this.app.vault.cachedRead(file);
      }

      const docType = this.graphState.documentType;
      const entities = this.graphState.entities ?? emptyEntities();
      const supplementalContext = await this.buildApiSupplementalContext(entities);
      const analysisText = supplementalContext
        ? `${rawText}\n\n[국가법령정보 참고]\n${supplementalContext}`
        : rawText;
      const graphData = this.graphState.graphData;
      const clusters = graphData?.clusters ?? [];
      const gaps = graphData?.gaps ?? [];

      // 쟁점 탐지: 로컬 처리
      if (mode === "issue_spotting") {
        const result = spotIssues(analysisText, docType, clusters, gaps, entities);
        this.updateState({ aiResult: formatIssueSpotResult(result) });
        new Notice(`쟁점 ${result.issues.length}개 탐지 완료`);
        return;
      }

      // 반박 논거: 로컬 처리
      if (mode === "counter_argument") {
        const issueResult = spotIssues(analysisText, docType, clusters, gaps, entities);
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
      const activeGraphData = graphData ?? buildLocalGraph(analysisText);
      const topNodes = activeGraphData.topNodes;

      const promptResult = buildLegalPrompt({
        mode,
        documentType: docType,
        topNodes,
        clusters: activeGraphData.clusters,
        gaps: activeGraphData.gaps,
        entities,
        additionalContext: supplementalContext,
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

  private async buildApiSupplementalContext(entities: ExtractionResult): Promise<string> {
    const settings = this.plugin.settings;
    if (settings.LEGAL_DB_INTEGRATION !== "enabled") return "";
    const oc = settings.LEGAL_OPEN_API_OC.trim();
    if (!oc) return "";

    const lawClient = new MojLawClient(oc);
    const caseClient = new SupremeCourtClient(oc);

    const statuteTargets = entities.statutes
      .filter((statute) => statute.lawName && statute.lawName !== "미상")
      .filter((statute, index, arr) =>
        arr.findIndex((target) => `${target.lawName}:${target.articleNumber}` === `${statute.lawName}:${statute.articleNumber}`) === index
      )
      .slice(0, 2);

    const caseTargets = entities.citations
      .map((citation) => citation.caseNumber)
      .filter(Boolean)
      .filter((caseNumber, index, arr) => arr.indexOf(caseNumber) === index)
      .slice(0, 2);

    const lawTexts = await Promise.all(
      statuteTargets.map(async (statute) => {
        try {
          const article = await lawClient.getArticle(statute.lawName, `제${statute.articleNumber}조`);
          if (!article) return "";
          const firstParagraph = article.paragraphs[0]?.content ?? "";
          return `[법령] ${statute.lawName} 제${statute.articleNumber}조: ${firstParagraph}`;
        } catch {
          return "";
        }
      })
    );

    const caseTexts = await Promise.all(
      caseTargets.map(async (caseNumber) => {
        try {
          const detail = await caseClient.getCaseDetail(caseNumber);
          if (!detail) return "";
          const holding = detail.holdings?.[0] || detail.reasoning || "";
          return `[판례] ${detail.caseNumber} ${detail.title}: ${holding.slice(0, 220)}`;
        } catch {
          return "";
        }
      })
    );

    return [...lawTexts, ...caseTexts].filter(Boolean).join("\n");
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

  private async readFolderGraphDocuments(folderPath: string): Promise<FolderGraphDocument[]> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) return [];

    const { TFolder, TFile } = await import("obsidian");
    if (!(folder instanceof TFolder)) return [];

    const docs: FolderGraphDocument[] = [];
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const content = await this.app.vault.cachedRead(child);
      const links = this.app.metadataCache.getFileCache(child)?.links?.map((link) => link.link) ?? [];
      docs.push({
        id: child.path,
        title: child.basename,
        content,
        links,
      });
    }

    return docs;
  }

  async saveAnalysisToNote(): Promise<void> {
    const {
      aiResult,
      aiGraphResult,
      graphData,
      lastSourceLabel,
      lastFilePath,
      documentType,
      manualEvidence = [],
      manualFacts = [],
    } = this.graphState;
    const markdown = aiResult || formatAiGraphSummary(aiGraphResult);

    if (!markdown) {
      new Notice("저장할 분석 결과가 없습니다.");
      return;
    }

    const sourceLabel = lastSourceLabel ?? lastFilePath ?? "문서";
    const baseName = stripExtension(sourceLabel.split("/").pop() ?? sourceLabel);
    const date = new Date();
    const dateLabel = date.toLocaleDateString("ko-KR");
    const fileName = `${baseName} - LexGraph분석 ${dateLabel}.md`;
    const content = [
      `# ${stripExtension(fileName)}`,
      "",
      `> 분석 일시: ${date.toLocaleString("ko-KR")}`,
      `> 원본: ${sourceLabel}`,
      `> 문서 유형: ${documentType}`,
      "",
      markdown,
      "",
      ...(manualEvidence.length > 0
        ? [
            "## 수동 추가 증거",
            ...manualEvidence.map((item) => `- ${item.name}${item.description ? `: ${item.description}` : ""}`),
            "",
          ]
        : []),
      ...(manualFacts.length > 0
        ? [
            "## 수동 추가 사실",
            ...manualFacts.map((item) => `- ${item.description}`),
            "",
          ]
        : []),
      "---",
      "",
      "## 그래프 통계",
      `- 노드: ${graphData?.stats.nodeCount ?? 0}개`,
      `- 엣지: ${graphData?.stats.edgeCount ?? 0}개`,
      `- 클러스터: ${graphData?.stats.clusterCount ?? 0}개`,
      `- 그래프 밀도: ${graphData?.stats.density ?? 0}`,
    ].join("\n");

    try {
      await this.app.vault.create(fileName, content);
      new Notice(`분석 결과 저장 완료: ${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "동일한 이름의 파일이 이미 존재합니다.";
      new Notice(`저장 실패: ${message}`);
    }
  }

  private extractWikiLinksOnly(text: string): string {
    const wikiLinks = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g) ?? [];
    return wikiLinks
      .map((link) => {
        const inner = link.slice(2, -2);
        return inner.includes("|") ? inner.split("|")[0] : inner;
      })
      .join(" ");
  }

  private async collectLinkedMentions(file: import("obsidian").TFile, currentContent: string): Promise<string> {
    const mode = this.plugin.settings.INCLUDE_LINKED_MENTIONS;
    if (mode === "Never") return "";
    if (mode === "For empty pages only" && currentContent.trim().length > 100) return "";

    const links = this.app.metadataCache.getFileCache(file)?.links ?? [];
    const contents: string[] = [];
    const { TFile } = await import("obsidian");

    for (const link of links.slice(0, 10)) {
      const linked = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
      if (linked instanceof TFile) {
        contents.push(await this.app.vault.cachedRead(linked));
      }
    }

    return contents.join("\n\n");
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

function formatAiGraphSummary(result?: AiGraphResult): string {
  if (!result) return "";

  const lines = ["## AI 그래프 요약", ""];
  if (result.summary) {
    lines.push(result.summary, "");
  }
  if (result.issues.length > 0) {
    lines.push("### 핵심 쟁점");
    result.issues.forEach((issue, index) => lines.push(`${index + 1}. ${issue}`));
    lines.push("");
  }
  lines.push(`- 노드: ${result.nodes.length}개`);
  lines.push(`- 엣지: ${result.edges.length}개`);
  return lines.join("\n");
}

function stripExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

function getPersistenceSourceKey(params: GraphLoadParams): string | undefined {
  if (params.filePath) return params.filePath;
  return undefined;
}
