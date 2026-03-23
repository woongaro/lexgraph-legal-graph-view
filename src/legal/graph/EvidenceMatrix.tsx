// 증거 매트릭스 컴포넌트
// 쟁점 ↔ 사실 ↔ 증거 3단 연결 구조 시각화

import React, { useState } from "react";
import type { IssueNode } from "./IssueTreePanel";

/**
 * 증거 항목
 */
export interface Evidence {
  id: string;
  type: "document" | "witness" | "expert" | "circumstantial" | "digital" | "other";
  name: string;
  description?: string;
  relevance: "high" | "medium" | "low";
  side: "claimant" | "respondent" | "neutral";
  issues: string[];    // 관련 쟁점 ID
  notes?: string;
}

/**
 * 사실 항목
 */
export interface FactItem {
  id: string;
  description: string;
  isDisputed: boolean;   // 다툼 있는 사실 여부
  evidence: string[];    // 관련 증거 ID
  issues: string[];      // 관련 쟁점 ID
}

/**
 * 매트릭스 데이터
 */
export interface MatrixData {
  issues: IssueNode[];
  facts: FactItem[];
  evidence: Evidence[];
}

// ── 증거 유형 아이콘/레이블 ─────────────────────────────────

const EVIDENCE_TYPE_INFO: Record<Evidence["type"], { icon: string; label: string }> = {
  document: { icon: "📄", label: "서증" },
  witness: { icon: "👤", label: "증인" },
  expert: { icon: "🔬", label: "감정" },
  circumstantial: { icon: "🔗", label: "정황" },
  digital: { icon: "💻", label: "디지털" },
  other: { icon: "📎", label: "기타" },
};

// ── 컴포넌트 ──────────────────────────────────────────────

interface EvidenceMatrixProps {
  data: MatrixData;
  onAddEvidence?: (evidence: Omit<Evidence, "id">) => void;
  onAddFact?: (fact: Omit<FactItem, "id">) => void;
}

/**
 * 증거 매트릭스 컴포넌트
 */
export function EvidenceMatrix({ data, onAddEvidence, onAddFact }: EvidenceMatrixProps): React.JSX.Element {
  const [view, setView] = useState<"matrix" | "evidence" | "facts">("matrix");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const filteredEvidence = selectedIssue
    ? data.evidence.filter((e) => e.issues.includes(selectedIssue))
    : data.evidence;

  const filteredFacts = selectedIssue
    ? data.facts.filter((f) => f.issues.includes(selectedIssue))
    : data.facts;

  return (
    <div className="evidence-matrix h-full flex flex-col text-sm">
      {/* 탭 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-2">
        {(["matrix", "evidence", "facts"] as const).map((v) => (
          <button
            key={v}
            className={`px-3 py-2 text-xs border-b-2 -mb-px ${
              view === v
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setView(v)}
          >
            {v === "matrix" ? "매트릭스" : v === "evidence" ? `증거 (${data.evidence.length})` : `사실 (${data.facts.length})`}
          </button>
        ))}
      </div>

      {/* 쟁점 필터 */}
      {data.issues.length > 0 && (
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
          <button
            className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
              selectedIssue === null
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            onClick={() => setSelectedIssue(null)}
          >
            전체
          </button>
          {data.issues.filter((i) => !i.isGap).map((issue) => (
            <button
              key={issue.id}
              className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                selectedIssue === issue.id
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
              onClick={() => setSelectedIssue(selectedIssue === issue.id ? null : issue.id)}
            >
              {issue.title.slice(0, 12)}{issue.title.length > 12 ? "…" : ""}
            </button>
          ))}
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {view === "matrix" && (
          <MatrixView issues={data.issues} facts={filteredFacts} evidence={filteredEvidence} />
        )}
        {view === "evidence" && (
          <EvidenceList evidence={filteredEvidence} />
        )}
        {view === "facts" && (
          <FactList facts={filteredFacts} />
        )}
      </div>

      {/* 추가 버튼 */}
      {(onAddEvidence || onAddFact) && (
        <div className="flex gap-2 p-2 border-t border-gray-200 dark:border-gray-700">
          {onAddEvidence && (
            <button
              className="flex-1 text-xs py-1.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
              onClick={() => {/* 증거 추가 모달 */}}
            >
              + 증거 추가
            </button>
          )}
          {onAddFact && (
            <button
              className="flex-1 text-xs py-1.5 rounded bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100"
              onClick={() => {/* 사실 추가 모달 */}}
            >
              + 사실 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 서브 뷰 ───────────────────────────────────────────────

function MatrixView({
  issues,
  facts,
  evidence,
}: {
  issues: IssueNode[];
  facts: FactItem[];
  evidence: Evidence[];
}): React.JSX.Element {
  const displayIssues = issues.filter((i) => !i.isGap).slice(0, 6);

  if (displayIssues.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        쟁점이 없습니다. AI 분석을 실행하면 자동으로 채워집니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="px-2 py-2 text-left font-medium text-gray-500 w-32">증거 / 쟁점</th>
            {displayIssues.map((issue) => (
              <th key={issue.id} className="px-2 py-2 text-center font-medium text-gray-600 dark:text-gray-400 max-w-20">
                <div className="truncate max-w-16">{issue.title.slice(0, 10)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {evidence.slice(0, 10).map((ev) => (
            <tr key={ev.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-2 py-2">
                <div className="flex items-center gap-1">
                  <span>{EVIDENCE_TYPE_INFO[ev.type].icon}</span>
                  <span className="truncate max-w-24">{ev.name}</span>
                </div>
                <div className={`text-xs mt-0.5 ${
                  ev.side === "claimant" ? "text-blue-500" :
                  ev.side === "respondent" ? "text-red-500" : "text-gray-400"
                }`}>
                  {ev.side === "claimant" ? "원고측" : ev.side === "respondent" ? "피고측" : "중립"}
                </div>
              </td>
              {displayIssues.map((issue) => {
                const relevant = ev.issues.includes(issue.id);
                return (
                  <td key={issue.id} className="px-2 py-2 text-center">
                    {relevant ? (
                      <span className={`inline-block w-4 h-4 rounded-full ${
                        ev.relevance === "high" ? "bg-green-400" :
                        ev.relevance === "medium" ? "bg-yellow-400" : "bg-gray-300"
                      }`} title={`관련성: ${ev.relevance}`} />
                    ) : (
                      <span className="inline-block w-4 h-4 text-gray-200 dark:text-gray-700">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {evidence.length === 0 && (
        <div className="p-4 text-center text-gray-400">
          증거 항목이 없습니다.
        </div>
      )}
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: Evidence[] }): React.JSX.Element {
  if (evidence.length === 0) {
    return <div className="p-4 text-center text-gray-400">증거가 없습니다.</div>;
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {evidence.map((ev) => (
        <div key={ev.id} className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <span className="text-base">{EVIDENCE_TYPE_INFO[ev.type].icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{ev.name}</div>
              {ev.description && (
                <div className="text-xs text-gray-500 truncate">{ev.description}</div>
              )}
            </div>
            <RelevanceBadge relevance={ev.relevance} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FactList({ facts }: { facts: FactItem[] }): React.JSX.Element {
  if (facts.length === 0) {
    return <div className="p-4 text-center text-gray-400">사실 항목이 없습니다.</div>;
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {facts.map((fact) => (
        <div key={fact.id} className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <div className="flex items-start gap-2">
            <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
              fact.isDisputed ? "bg-red-400" : "bg-green-400"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{fact.description}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {fact.isDisputed ? "⚠️ 다툼 있는 사실" : "✓ 다툼 없는 사실"}
                {" · "}증거 {fact.evidence.length}개
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RelevanceBadge({ relevance }: { relevance: Evidence["relevance"] }): React.JSX.Element {
  const styles = {
    high: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    medium: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    low: "bg-gray-100 dark:bg-gray-700 text-gray-500",
  };
  const labels = { high: "고관련", medium: "중관련", low: "저관련" };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[relevance]}`}>
      {labels[relevance]}
    </span>
  );
}
