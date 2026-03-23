// LexGraph 메인 React 앱 컴포넌트 (v2 — 전체 패널 통합)

import React, { useState, useEffect, useCallback } from "react";
import type LexGraphPlugin from "../main";
import type { GraphState } from "../views/LexGraphView";
import { IssueTreePanel, buildIssueTree } from "../legal/graph/IssueTreePanel";
import { EvidenceMatrix } from "../legal/graph/EvidenceMatrix";
import { PartyRelationPanel, buildPartyNodes } from "../legal/graph/PartyRelationPanel";

type PanelId = "graph" | "issues" | "parties" | "evidence" | "analysis";

interface TabDef {
  id: PanelId;
  label: string;
  icon: string;
  settingKey?: keyof LexGraphPlugin["settings"];
}

const TABS: TabDef[] = [
  { id: "graph", label: "그래프", icon: "🕸️" },
  { id: "issues", label: "쟁점", icon: "🎯", settingKey: "LEGAL_ISSUE_PANEL_ENABLED" },
  { id: "parties", label: "당사자", icon: "👥", settingKey: "LEGAL_PARTY_GRAPH_ENABLED" },
  { id: "evidence", label: "증거", icon: "📋", settingKey: "LEGAL_EVIDENCE_MATRIX_ENABLED" },
  { id: "analysis", label: "AI분석", icon: "🤖" },
];

interface LexGraphAppProps {
  plugin: LexGraphPlugin;
  initialState: GraphState;
  onStateChange: (state: GraphState) => void;
  onRegisterSetState: (setter: (state: GraphState) => void) => void;
}

/**
 * LexGraph 메인 앱
 */
export function LexGraphApp({
  plugin,
  initialState,
  onStateChange,
  onRegisterSetState,
}: LexGraphAppProps): React.JSX.Element {
  const [state, setStateInternal] = useState<GraphState>(initialState);
  const [activePanel, setActivePanel] = useState<PanelId>("graph");

  const setState = useCallback(
    (newState: GraphState) => {
      setStateInternal(newState);
      onStateChange(newState);
    },
    [onStateChange]
  );

  useEffect(() => {
    onRegisterSetState(setState);
  }, [setState, onRegisterSetState]);

  // 활성화된 탭만 표시 (설정에서 비활성화된 탭 제외)
  const visibleTabs = TABS.filter((tab) => {
    if (!tab.settingKey) return true;
    return plugin.settings[tab.settingKey] !== false;
  });

  const isDark = document.body.classList.contains("theme-dark");
  const colorScheme =
    plugin.settings.COLOR_SCHEME === "auto"
      ? isDark ? "dark" : "light"
      : plugin.settings.COLOR_SCHEME;

  // 그래프 클러스터 및 갭 (AI 분석 결과에서 추출)
  const clusters = state.graphClusters ?? [];
  const gaps = state.graphGaps ?? [];

  return (
    <div className={`lexgraph-app h-full flex flex-col text-sm ${colorScheme}`}>
      {/* 헤더 */}
      <Header state={state} colorScheme={colorScheme} />

      {/* 탭 바 */}
      <TabBar
        tabs={visibleTabs}
        active={activePanel}
        onChange={setActivePanel}
        hasData={!!state.graphUrl || !!state.aiResult}
      />

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-hidden relative">
        {/* 로딩 */}
        {state.isLoading && <LoadingOverlay metadata={state.metadata} />}

        {/* 에러 */}
        {!state.isLoading && state.error && (
          <ErrorPanel error={state.error} plugin={plugin} />
        )}

        {/* 빈 상태 */}
        {!state.isLoading && !state.error && !state.graphUrl && activePanel === "graph" && (
          <EmptyPanel />
        )}

        {/* 그래프 iframe — hidden 클래스로 mount 유지 */}
        {state.graphUrl && (
          <iframe
            src={state.graphUrl}
            className={`w-full h-full border-0 ${activePanel === "graph" ? "block" : "hidden"}`}
            title="LexGraph 법률 지식 그래프"
            allow="clipboard-write"
          />
        )}

        {/* 쟁점 트리 */}
        {activePanel === "issues" && !state.isLoading && (
          <div className="h-full overflow-hidden">
            {clusters.length > 0 ? (
              <IssueTreePanel
                clusters={clusters}
                gaps={gaps}
                aiResult={state.aiResult}
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
              caseNumbers={state.entities?.caseNumbers ?? []}
            />
          </div>
        )}

        {/* 증거 매트릭스 */}
        {activePanel === "evidence" && !state.isLoading && (
          <div className="h-full overflow-hidden">
            <EvidenceMatrix
              data={{
                issues: buildIssueTree(clusters, gaps),
                facts: [],
                evidence: [],
              }}
            />
          </div>
        )}

        {/* AI 분석 결과 */}
        {activePanel === "analysis" && !state.isLoading && (
          <AnalysisPanel state={state} plugin={plugin} />
        )}
      </div>

      {/* 메타데이터 푸터 */}
      {state.metadata && <Footer metadata={state.metadata} />}
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

function Header({
  state,
  colorScheme,
}: {
  state: GraphState;
  colorScheme: string;
}): React.JSX.Element {
  const docTypeLabel = state.metadata?.detectedType
    ? DOC_TYPE_LABELS[state.metadata.detectedType] ?? ""
    : "";

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold">⚖️ LexGraph</span>
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
          <span>{tab.icon}</span>
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
        <div className="animate-pulse text-lg text-gray-400">⚖️ 분석 중...</div>
        {metadata?.detectedType && metadata.detectedType !== "general" && (
          <div className="text-xs text-gray-400">
            {DOC_TYPE_LABELS[metadata.detectedType]} 처리 중
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorPanel({ error, plugin }: { error: string; plugin: LexGraphPlugin }): React.JSX.Element {
  if (error === "api_key_missing") {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="text-3xl">🔑</div>
        <h3 className="font-semibold">API 키 필요</h3>
        <p className="text-xs text-gray-500">
          InfraNodus API 키를 설정하세요.
        </p>
        <a
          href={`${plugin.settings.INFRANODUS_API_URL}/subscription`}
          className="text-blue-500 text-xs underline"
        >
          API 키 발급
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 text-center space-y-2">
      <div className="text-2xl">⚠️</div>
      <p className="text-xs text-gray-500">{error}</p>
    </div>
  );
}

function EmptyPanel(): React.JSX.Element {
  return (
    <div className="p-6 text-center space-y-3 text-gray-400">
      <div className="text-3xl">⚖️</div>
      <p className="font-medium text-gray-600 dark:text-gray-300">LexGraph 법률 분석</p>
      <p className="text-xs">
        법률 문서를 열고 리본 아이콘을 클릭하거나<br />
        명령 팔레트에서 "법률 그래프 열기"를 실행하세요.
      </p>
      <div className="text-xs text-left max-w-48 mx-auto mt-2 space-y-1">
        <p>📄 판결문 — 쟁점/당사자/판례</p>
        <p>📝 계약서 — 조항 위험 분석</p>
        <p>⚖️ 법령 — 조문 구조</p>
        <p>📋 준비서면 — 논리 구조</p>
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
  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {state.aiResult ? (
        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
          {state.aiResult}
        </pre>
      ) : (
        <div className="text-center text-gray-400 py-6 space-y-2">
          <div className="text-2xl">🤖</div>
          <p className="text-xs">명령 팔레트에서 분석 유형 선택:</p>
          <div className="text-xs text-left max-w-48 mx-auto space-y-1 mt-1">
            <p>• 쟁점 분석 실행</p>
            <p>• 반박 논거 생성</p>
            <p>• 준비서면 아웃라인</p>
            <p>• 계약 위험 분석</p>
          </div>
        </div>
      )}
    </div>
  );
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
