// LexGraph 메인 React 앱 컴포넌트

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type LexGraphPlugin from "../main";
import type { GraphState } from "../views/LexGraphView";
import type { GraphLayoutState } from "../graph/types";
import { GraphCanvas } from "../graph/GraphCanvas";
import { IssueTreePanel, buildIssueTree, type IssueNode } from "../legal/graph/IssueTreePanel";
import { EvidenceMatrix, type Evidence, type FactItem } from "../legal/graph/EvidenceMatrix";
import { PartyRelationPanel } from "../legal/graph/PartyRelationPanel";
import { extractEvidence, extractFacts } from "../legal/preprocessor/EvidenceExtractor";
import { extractPartyRelations } from "../legal/preprocessor/PartyRelationExtractor";
import { AiResultRenderer } from "./AiResultRenderer";
import { MojLawClient, type LawArticle } from "../legal/api/MojLawClient";
import { SupremeCourtClient, type CaseDetail } from "../legal/api/SupremeCourtClient";

type PanelId = "graph" | "issues" | "parties" | "evidence" | "analysis";

interface TabDef {
  id: PanelId;
  label: string;
  icon: string;
  settingKey?: keyof LexGraphPlugin["settings"];
}

const TABS: TabDef[] = [
  { id: "graph", label: "그래프", icon: "graph" },
  { id: "issues", label: "쟁점", icon: "target", settingKey: "LEGAL_ISSUE_PANEL_ENABLED" },
  { id: "parties", label: "당사자", icon: "users", settingKey: "LEGAL_PARTY_GRAPH_ENABLED" },
  { id: "evidence", label: "증거", icon: "list", settingKey: "LEGAL_EVIDENCE_MATRIX_ENABLED" },
  { id: "analysis", label: "AI분석", icon: "brain-cog" },
];

interface LexGraphAppProps {
  plugin: LexGraphPlugin;
  initialState: GraphState;
  onStateChange: (state: GraphState) => void;
  onRegisterSetState: (setter: (state: GraphState) => void) => void;
}

export function LexGraphApp({
  plugin,
  initialState,
  onStateChange,
  onRegisterSetState,
}: LexGraphAppProps): React.JSX.Element {
  const [state, setStateInternal] = useState<GraphState>(initialState);
  const stateRef = useRef<GraphState>(initialState);
  const [activePanel, setActivePanel] = useState<PanelId>("graph");
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const manualIdRef = useRef(0);

  const setState = useCallback(
    (newState: GraphState) => {
      stateRef.current = newState;
      setStateInternal(newState);
      onStateChange(newState);
    },
    [onStateChange]
  );

  useEffect(() => {
    onRegisterSetState(setState);
  }, [setState, onRegisterSetState]);

  const visibleTabs = TABS.filter((tab) => {
    if (!tab.settingKey) return true;
    return plugin.settings[tab.settingKey] !== false;
  });

  const isDark = document.body.classList.contains("theme-dark");
  const colorScheme =
    plugin.settings.COLOR_SCHEME === "auto"
      ? isDark ? "dark" : "light"
      : plugin.settings.COLOR_SCHEME;

  const clusters = state.graphData?.clusters ?? [];
  const gaps = state.graphData?.gaps ?? [];
  const issueNodes = useMemo(
    () => buildIssueTree(clusters, gaps, state.aiResult),
    [clusters, gaps, state.aiResult]
  );
  const extractedEvidence = useMemo(
    () => extractEvidence(state.lastRawText ?? "", issueNodes),
    [state.lastRawText, issueNodes]
  );
  const evidenceItems = useMemo(
    () => [...extractedEvidence, ...(state.manualEvidence ?? [])],
    [extractedEvidence, state.manualEvidence]
  );
  const removableEvidenceIds = useMemo(
    () => new Set((state.manualEvidence ?? []).map((item) => item.id)),
    [state.manualEvidence]
  );
  const extractedFacts = useMemo(
    () => extractFacts(state.lastRawText ?? "", issueNodes, extractedEvidence),
    [state.lastRawText, issueNodes, extractedEvidence]
  );
  const factItems = useMemo(
    () => [...extractedFacts, ...(state.manualFacts ?? [])],
    [extractedFacts, state.manualFacts]
  );
  const removableFactIds = useMemo(
    () => new Set((state.manualFacts ?? []).map((item) => item.id)),
    [state.manualFacts]
  );
  const partyRelations = useMemo(
    () => extractPartyRelations(state.lastRawText ?? "", state.entities?.parties ?? []),
    [state.lastRawText, state.entities?.parties]
  );
  const hasData = !!state.graphData || !!state.aiResult || !!state.aiGraphResult;

  useEffect(() => {
    setHighlightedNodeIds(new Set());
  }, [state.graphData]);

  useEffect(() => {
    if (!plugin.settings.GRAPH_STATE_PERSISTENCE_ENABLED) return;
    if (!state.sourceKey) return;
    plugin.queuePersistedDocumentState(state.sourceKey, {
      graphLayoutState: state.graphLayoutState,
      manualEvidence: state.manualEvidence ?? [],
      manualFacts: state.manualFacts ?? [],
    });
  }, [
    plugin,
    plugin.settings.GRAPH_STATE_PERSISTENCE_ENABLED,
    state.graphLayoutState,
    state.manualEvidence,
    state.manualFacts,
    state.sourceKey,
  ]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!state.graphData) return;

    const connected = new Set<string>([nodeId]);
    state.graphData.edges.forEach((edge) => {
      if (edge.source === nodeId) connected.add(edge.target);
      if (edge.target === nodeId) connected.add(edge.source);
    });

    setHighlightedNodeIds(connected);
    setActivePanel("issues");
  }, [state.graphData]);

  const handleIssueSelect = useCallback((issue: IssueNode) => {
    const related = issue.relatedNodeIds ?? [];
    setHighlightedNodeIds(new Set(related));
  }, []);

  const handleLayoutStateChange = useCallback((graphLayoutState: GraphLayoutState) => {
    const nextState = { ...stateRef.current, graphLayoutState };
    setState(nextState);
  }, [setState]);

  const handleAddEvidence = useCallback((evidence: Omit<Evidence, "id">) => {
    manualIdRef.current += 1;
    setState({
      ...stateRef.current,
      manualEvidence: [
        ...(stateRef.current.manualEvidence ?? []),
        {
          id: `manual-evidence-${Date.now()}-${manualIdRef.current}`,
          ...evidence,
        },
      ],
    });
    setActivePanel("evidence");
  }, [setState]);

  const handleAddFact = useCallback((fact: Omit<FactItem, "id">) => {
    manualIdRef.current += 1;
    setState({
      ...stateRef.current,
      manualFacts: [
        ...(stateRef.current.manualFacts ?? []),
        {
          id: `manual-fact-${Date.now()}-${manualIdRef.current}`,
          ...fact,
        },
      ],
    });
    setActivePanel("evidence");
  }, [setState]);

  const handleRemoveEvidence = useCallback((evidenceId: string) => {
    setState({
      ...stateRef.current,
      manualEvidence: (stateRef.current.manualEvidence ?? []).filter((item) => item.id !== evidenceId),
    });
  }, [setState]);

  const handleRemoveFact = useCallback((factId: string) => {
    setState({
      ...stateRef.current,
      manualFacts: (stateRef.current.manualFacts ?? []).filter((item) => item.id !== factId),
    });
  }, [setState]);

  const handleUpdateEvidence = useCallback((evidenceId: string, evidence: Omit<Evidence, "id">) => {
    setState({
      ...stateRef.current,
      manualEvidence: (stateRef.current.manualEvidence ?? []).map((item) =>
        item.id === evidenceId ? { id: evidenceId, ...evidence } : item
      ),
    });
  }, [setState]);

  const handleUpdateFact = useCallback((factId: string, fact: Omit<FactItem, "id">) => {
    setState({
      ...stateRef.current,
      manualFacts: (stateRef.current.manualFacts ?? []).map((item) =>
        item.id === factId ? { id: factId, ...fact } : item
      ),
    });
  }, [setState]);

  return (
    <div className={`lexgraph-app h-full flex flex-col text-sm ${colorScheme}`}>
      <Header state={state} />

      <TabBar
        tabs={visibleTabs}
        active={activePanel}
        onChange={setActivePanel}
        hasData={hasData}
      />

      <div className="flex-1 overflow-hidden relative">
        {state.isLoading && <LoadingOverlay metadata={state.metadata} />}

        {!state.isLoading && state.error && (
          <ErrorPanel error={state.error} />
        )}

        {!state.isLoading && !state.error && !state.graphData && activePanel === "graph" && (
          <EmptyPanel />
        )}

        {/* 그래프 캔버스 */}
        {state.graphData && (
          <div className={`w-full h-full ${activePanel === "graph" ? "block" : "hidden"}`}>
            <GraphCanvas
              graphData={state.graphData}
              isDark={colorScheme === "dark"}
              onNodeClick={handleNodeClick}
              highlightedNodeIds={highlightedNodeIds}
              edgeLabelsEnabled={!!state.aiGraphResult}
              initialLayoutState={state.graphLayoutState}
              onLayoutStateChange={handleLayoutStateChange}
            />
          </div>
        )}

        {/* 쟁점 트리 */}
        {activePanel === "issues" && !state.isLoading && (
          <div className="h-full overflow-hidden">
            {clusters.length > 0 ? (
              <IssueTreePanel
                clusters={clusters}
                gaps={gaps}
                aiResult={state.aiResult}
                onIssueSelect={handleIssueSelect}
              />
            ) : (
              <NoDataPanel message="쟁점 분석을 위해 먼저 그래프를 생성하세요." />
            )}
          </div>
        )}

        {/* 당사자 관계도 */}
        {activePanel === "parties" && !state.isLoading && (
          <div className="h-full overflow-hidden">
            <PartyRelationPanel
              parties={state.entities?.parties ?? []}
              relations={partyRelations}
              caseNumbers={state.entities?.caseNumbers ?? []}
            />
          </div>
        )}

        {/* 증거 매트릭스 */}
        {activePanel === "evidence" && !state.isLoading && (
          <div className="h-full overflow-hidden">
            <EvidenceMatrix
              data={{
                issues: issueNodes,
                facts: factItems,
                evidence: evidenceItems,
              }}
              onAddEvidence={handleAddEvidence}
              onAddFact={handleAddFact}
              editableEvidenceIds={removableEvidenceIds}
              editableFactIds={removableFactIds}
              removableEvidenceIds={removableEvidenceIds}
              removableFactIds={removableFactIds}
              onUpdateEvidence={handleUpdateEvidence}
              onUpdateFact={handleUpdateFact}
              onRemoveEvidence={handleRemoveEvidence}
              onRemoveFact={handleRemoveFact}
            />
          </div>
        )}

        {/* AI 분석 결과 */}
        {activePanel === "analysis" && !state.isLoading && (
          <AnalysisPanel state={state} plugin={plugin} />
        )}
      </div>

      {state.metadata && <Footer metadata={state.metadata} />}
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

function Header({
  state,
}: {
  state: GraphState;
}): React.JSX.Element {
  const docTypeLabel = state.metadata?.detectedType
    ? DOC_TYPE_LABELS[state.metadata.detectedType] ?? ""
    : "";

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold">LexGraph</span>
        {state.aiGraphResult && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            AI 그래프
          </span>
        )}
        {docTypeLabel && state.metadata?.detectedType !== "general" && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            {docTypeLabel}
          </span>
        )}
      </div>
      {state.metadata && (
        <div className="text-xs text-gray-400">
          {formatLength(state.metadata.processedLength)}
        </div>
      )}
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onChange,
  hasData,
}: {
  tabs: TabDef[];
  active: PanelId;
  onChange: (id: PanelId) => void;
  hasData: boolean;
}): React.JSX.Element {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`
            flex items-center gap-1 px-2.5 py-2 text-xs whitespace-nowrap border-b-2 -mb-px
            ${active === tab.id
              ? "border-blue-500 text-blue-600 dark:text-blue-400 font-medium"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }
            ${!hasData && tab.id !== "graph" ? "opacity-40 cursor-not-allowed" : ""}
          `}
          onClick={() => (hasData || tab.id === "graph") && onChange(tab.id)}
          disabled={!hasData && tab.id !== "graph"}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

function LoadingOverlay({ metadata }: { metadata?: GraphState["metadata"] }): React.JSX.Element {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
      <div className="text-center space-y-2">
        <div className="animate-pulse text-lg text-gray-400">분석 중...</div>
        {metadata?.detectedType && metadata.detectedType !== "general" && (
          <div className="text-xs text-gray-400">
            {DOC_TYPE_LABELS[metadata.detectedType]} 처리 중
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorPanel({ error }: { error: string }): React.JSX.Element {
  return (
    <div className="p-6 text-center space-y-2">
      <div className="text-2xl">!</div>
      <p className="text-xs text-gray-500">{error}</p>
    </div>
  );
}

function EmptyPanel(): React.JSX.Element {
  return (
    <div className="p-6 text-center space-y-3 text-gray-400">
      <p className="font-medium text-gray-600 dark:text-gray-300">LexGraph 법률 분석</p>
      <p className="text-xs">
        법률 문서를 열고 리본 아이콘을 클릭하거나<br />
        명령 팔레트에서 "법률 그래프 열기"를 실행하세요.
      </p>
      <div className="text-xs text-left max-w-48 mx-auto mt-2 space-y-1">
        <p>판결문 — 쟁점/당사자/판례</p>
        <p>계약서 — 조항 위험 분석</p>
        <p>법령 — 조문 구조</p>
        <p>준비서면 — 논리 구조</p>
      </div>
    </div>
  );
}

function NoDataPanel({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="p-4 text-center text-gray-400 text-xs">
      {message}
    </div>
  );
}

function AnalysisPanel({
  state,
  plugin,
}: {
  state: GraphState;
  plugin: LexGraphPlugin;
}): React.JSX.Element {
  const aiConfigured = plugin.settings.AI_PROVIDER !== "none";
  const markdownText = state.aiResult || formatAiGraphMarkdown(state);

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {markdownText ? (
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <AiResultRenderer app={plugin.app} text={markdownText} />
        </div>
      ) : (
        <div className="text-center text-gray-400 py-6 space-y-2">
          <p className="text-xs">명령 팔레트에서 분석 유형 선택:</p>
          <div className="text-xs text-left max-w-48 mx-auto space-y-1 mt-1">
            <p>• 쟁점 분석 실행 (로컬)</p>
            <p>• 반박 논거 생성 (로컬)</p>
            {aiConfigured ? (
              <>
                <p>• 준비서면 아웃라인 (AI)</p>
                <p>• 계약 위험 분석 (AI)</p>
              </>
            ) : (
              <p className="text-yellow-500">AI 기능: 설정에서 API 키 필요</p>
            )}
          </div>
        </div>
      )}

      {plugin.settings.LEGAL_DB_INTEGRATION === "enabled" && (
        <ExternalReferencePanel state={state} plugin={plugin} />
      )}
    </div>
  );
}

function ExternalReferencePanel({
  state,
  plugin,
}: {
  state: GraphState;
  plugin: LexGraphPlugin;
}): React.JSX.Element | null {
  const oc = plugin.settings.LEGAL_OPEN_API_OC.trim();
  const statutes = state.entities?.statutes ?? [];
  const citations = state.entities?.citations ?? [];
  const [selectedLawKey, setSelectedLawKey] = useState<string | null>(null);
  const [lawArticle, setLawArticle] = useState<LawArticle | null>(null);
  const [selectedCaseNumber, setSelectedCaseNumber] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lawCandidates = useMemo(
    () =>
      statutes
        .map((statute) => ({
          key: `${statute.lawName}:${statute.articleNumber}`,
          lawName: statute.lawName,
          articleNumber: `제${statute.articleNumber}조`,
          label:
            statute.lawName && statute.lawName !== "미상"
              ? `${statute.lawName} 제${statute.articleNumber}조`
              : `제${statute.articleNumber}조`,
        }))
        .filter((item) => item.lawName && item.lawName !== "미상")
        .filter((item, index, arr) => arr.findIndex((target) => target.key === item.key) === index)
        .slice(0, 5),
    [statutes]
  );

  const caseCandidates = useMemo(
    () =>
      citations
        .map((citation) => citation.caseNumber)
        .filter(Boolean)
        .filter((item, index, arr) => arr.indexOf(item) === index)
        .slice(0, 5),
    [citations]
  );

  if (lawCandidates.length === 0 && caseCandidates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <div>
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
          국가법령정보 Open API
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          공식 Open API 요청 변수 `OC`를 사용합니다.
          {!oc && " 설정에서 본인 OC를 입력하면 조문/판례 상세 조회가 활성화됩니다."}
        </p>
      </div>

      {lawCandidates.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">법령 조문 조회</div>
          <div className="flex flex-wrap gap-1">
            {lawCandidates.map((law) => (
              <button
                key={law.key}
                disabled={!oc || loading !== null}
                className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                onClick={async () => {
                  setLoading(law.key);
                  setError(null);
                  setSelectedLawKey(law.key);
                  setLawArticle(null);
                  try {
                    const client = new MojLawClient(oc);
                    const article = await client.getArticle(law.lawName, law.articleNumber);
                    setLawArticle(article);
                    if (!article) {
                      setError("조문을 찾지 못했습니다.");
                    }
                  } catch (fetchError) {
                    setError(fetchError instanceof Error ? fetchError.message : "조문 조회 실패");
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                {law.label}
              </button>
            ))}
          </div>
          {selectedLawKey && (
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2 text-xs whitespace-pre-wrap">
              {loading === selectedLawKey && "조문 조회 중..."}
              {lawArticle && loading !== selectedLawKey && formatLawArticle(lawArticle)}
            </div>
          )}
        </div>
      )}

      {caseCandidates.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">판례 요약 조회</div>
          <div className="flex flex-wrap gap-1">
            {caseCandidates.map((caseNumber) => (
              <button
                key={caseNumber}
                disabled={!oc || loading !== null}
                className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                onClick={async () => {
                  setLoading(caseNumber);
                  setError(null);
                  setSelectedCaseNumber(caseNumber);
                  setCaseDetail(null);
                  try {
                    const client = new SupremeCourtClient(oc);
                    const detail = await client.getCaseDetail(caseNumber);
                    setCaseDetail(detail);
                    if (!detail) {
                      setError("판례를 찾지 못했습니다.");
                    }
                  } catch (fetchError) {
                    setError(fetchError instanceof Error ? fetchError.message : "판례 조회 실패");
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                {caseNumber}
              </button>
            ))}
          </div>
          {selectedCaseNumber && (
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2 text-xs whitespace-pre-wrap">
              {loading === selectedCaseNumber && "판례 조회 중..."}
              {caseDetail && loading !== selectedCaseNumber && formatCaseDetail(caseDetail)}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-500">{error}</div>
      )}
    </div>
  );
}

function formatAiGraphMarkdown(state: GraphState): string {
  const result = state.aiGraphResult;
  if (!result) return "";

  const lines = ["## AI 그래프 분석", ""];
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

function formatLawArticle(article: LawArticle): string {
  return [
    `${article.articleNumber}${article.articleTitle ? ` (${article.articleTitle})` : ""}`,
    ...article.paragraphs.flatMap((paragraph) => {
      const lines = [`${paragraph.number ? `${paragraph.number} ` : ""}${paragraph.content}`.trim()];
      for (const subItem of paragraph.subItems ?? []) {
        lines.push(`${subItem.number}. ${subItem.content}`);
      }
      return lines;
    }),
  ].join("\n");
}

function formatCaseDetail(detail: CaseDetail): string {
  const lines = [
    `${detail.title} (${detail.caseNumber})`,
    `${detail.court} ${detail.decisionDate}`.trim(),
  ];

  if (detail.holdings?.length) {
    lines.push("", "판시사항");
    detail.holdings.slice(0, 5).forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  }

  if (detail.reasoning) {
    lines.push("", "판결요지", detail.reasoning);
  }

  if (detail.relatedStatutes?.length) {
    lines.push("", `참조조문: ${detail.relatedStatutes.join(", ")}`);
  }

  return lines.join("\n");
}

function Footer({ metadata }: { metadata: NonNullable<GraphState["metadata"]> }): React.JSX.Element {
  return (
    <div className="flex gap-3 px-3 py-1 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
      <span>{formatLength(metadata.originalLength)} → {formatLength(metadata.processedLength)}</span>
      {metadata.citationCount > 0 && <span>판례 {metadata.citationCount}건</span>}
      {metadata.mainStatutes.length > 0 && <span>법령 {metadata.mainStatutes.length}건</span>}
    </div>
  );
}

// ── 상수 및 헬퍼 ──────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  judgment: "판결문",
  contract: "계약서",
  statute: "법령",
  brief: "준비서면",
  general: "일반",
  auto: "자동",
};

function formatLength(length: number): string {
  if (length < 1000) return `${length}자`;
  return `${(length / 1000).toFixed(1)}K자`;
}
