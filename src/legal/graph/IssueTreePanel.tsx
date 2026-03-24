// 쟁점 트리 패널
// 법률 문서에서 추출된 쟁점을 계층적 트리로 표시

import React, { useState } from "react";
import type { TopicCluster, StructuralGap } from "../../graph/types";

/**
 * 쟁점 트리 노드
 */
export interface IssueNode {
  id: string;
  title: string;
  description?: string;
  level: "main" | "sub" | "detail";
  relatedStatutes?: string[];   // 관련 법령
  relatedCitations?: string[]; // 관련 판례
  strength?: "strong" | "medium" | "weak"; // 논거 강도
  children?: IssueNode[];
  isGap?: boolean;              // 논리 공백 여부
  relatedNodeIds?: string[];
}

const LEGAL_CONCEPT_MAP: Record<string, string> = {
  계약: "계약 효력·이행 쟁점",
  손해: "손해배상 범위 쟁점",
  책임: "책임 귀속 쟁점",
  시효: "소멸시효 완성 여부",
  임대: "임대차 관계 쟁점",
  대금: "대금 지급 쟁점",
  해제: "계약 해제 가부",
  부당: "부당이득 반환 쟁점",
  점유: "점유권 쟁점",
  등기: "소유권 이전 등기 쟁점",
  불법행위: "불법행위 성립 쟁점",
  채무불이행: "채무불이행 책임 쟁점",
};

/**
 * 그래프 데이터에서 쟁점 트리 생성
 */
export function buildIssueTree(
  clusters: TopicCluster[],
  gaps: StructuralGap[],
  aiResult?: string
): IssueNode[] {
  const maxCentrality = Math.max(...clusters.map((cluster) => cluster.centrality), 0.001);

  // 클러스터 → 쟁점 변환
  const mainIssues: IssueNode[] = clusters.slice(0, 5).map((cluster, i) => ({
    id: `issue-${i}`,
    title: mapClusterToIssue(cluster.name || `쟁점 ${i + 1}`),
    description: `관련 개념: ${cluster.nodes.slice(0, 4).join(", ")}`,
    level: "main" as const,
    strength: normalizeStrength(cluster.centrality, maxCentrality),
    relatedNodeIds: cluster.nodes,
    children: cluster.nodes.slice(0, 3).map((node, j) => ({
      id: `issue-${i}-sub-${j}`,
      title: node,
      level: "sub" as const,
      relatedNodeIds: [node],
    })),
  }));

  // 구조적 갭 → 미해결 쟁점으로 추가
  const gapIssues: IssueNode[] = gaps.slice(0, 3).map((gap, i) => ({
    id: `gap-${i}`,
    title: `[미연결] ${gap.between[0]} ↔ ${gap.between[1]}`,
    description: "이 영역 간의 논리적 연결이 부족합니다.",
    level: "main" as const,
    isGap: true,
    strength: "weak",
    relatedNodeIds: gap.between,
  }));

  return [...mainIssues, ...gapIssues];
}

// ── 컴포넌트 ──────────────────────────────────────────────

interface IssueTreePanelProps {
  clusters: TopicCluster[];
  gaps: StructuralGap[];
  aiResult?: string;
  onIssueSelect?: (issue: IssueNode) => void;
}

/**
 * 쟁점 트리 패널 컴포넌트
 */
export function IssueTreePanel({
  clusters,
  gaps,
  aiResult,
  onIssueSelect,
}: IssueTreePanelProps): React.JSX.Element {
  const issues = buildIssueTree(clusters, gaps, aiResult);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(issues.slice(0, 2).map((i) => i.id))
  );
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const select = (issue: IssueNode) => {
    setSelected(issue.id);
    onIssueSelect?.(issue);
  };

  if (issues.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center">
        쟁점 데이터가 없습니다. 먼저 문서를 분석하세요.
      </div>
    );
  }

  return (
    <div className="issue-tree overflow-y-auto h-full">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
        쟁점 구조 ({issues.filter((i) => !i.isGap).length}개 / 공백 {issues.filter((i) => i.isGap).length}개)
      </div>

      <div className="py-2">
        {issues.map((issue) => (
          <IssueNodeItem
            key={issue.id}
            issue={issue}
            expanded={expanded}
            selected={selected}
            onToggle={toggle}
            onSelect={select}
          />
        ))}
      </div>
    </div>
  );
}

// ── 쟁점 노드 아이템 ──────────────────────────────────────

interface IssueNodeItemProps {
  issue: IssueNode;
  expanded: Set<string>;
  selected: string | null;
  depth?: number;
  onToggle: (id: string) => void;
  onSelect: (issue: IssueNode) => void;
}

function IssueNodeItem({
  issue,
  expanded,
  selected,
  depth = 0,
  onToggle,
  onSelect,
}: IssueNodeItemProps): React.JSX.Element {
  const hasChildren = (issue.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(issue.id);
  const isSelected = selected === issue.id;

  return (
    <div>
      <div
        className={`
          lexgraph-issue-node
          flex items-start gap-1 px-2 py-1.5 cursor-pointer text-sm
          hover:bg-gray-50 dark:hover:bg-gray-800
          ${isSelected ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500" : ""}
          ${issue.isGap ? "opacity-70" : ""}
        `}
        style={{ ["--lg-depth" as string]: depth } as React.CSSProperties}
        onClick={onSelect}
      >
        {/* 확장 아이콘 */}
        <button
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-400"
          onClick={(e) => { e.stopPropagation(); onToggle(issue.id); }}
        >
          {hasChildren ? (isExpanded ? "▾" : "▸") : "•"}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 강도 배지 */}
            {issue.strength && !issue.isGap && (
              <StrengthBadge strength={issue.strength} />
            )}
            {/* 공백 배지 */}
            {issue.isGap && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                공백
              </span>
            )}
            {/* 제목 */}
            <span className={`${depth === 0 ? "font-medium" : "text-gray-600 dark:text-gray-400"} truncate`}>
              {issue.title}
            </span>
          </div>

          {/* 설명 */}
          {isSelected && issue.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {issue.description}
            </p>
          )}

          {/* 관련 법령 */}
          {isSelected && issue.relatedStatutes && issue.relatedStatutes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {issue.relatedStatutes.map((s, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 하위 노드 */}
      {hasChildren && isExpanded && (
        <div>
          {issue.children!.map((child) => (
            <IssueNodeItem
              key={child.id}
              issue={child}
              expanded={expanded}
              selected={selected}
              depth={depth + 1}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function mapClusterToIssue(clusterName: string): string {
  const matched = Object.entries(LEGAL_CONCEPT_MAP).find(
    ([keyword]) => clusterName.includes(keyword) || keyword.includes(clusterName)
  );
  return matched?.[1] ?? `"${clusterName}" 관련 법률 쟁점`;
}

function normalizeStrength(
  clusterCentrality: number,
  maxCentrality: number
): IssueNode["strength"] {
  const normalized = Math.min(0.9, (clusterCentrality / maxCentrality) * 0.7 + 0.2);
  if (normalized >= 0.7) return "strong";
  if (normalized >= 0.45) return "medium";
  return "weak";
}

function StrengthBadge({ strength }: { strength: "strong" | "medium" | "weak" }): React.JSX.Element {
  const styles = {
    strong: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    medium: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    weak: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
  };
  const labels = { strong: "강", medium: "중", weak: "약" };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[strength]}`}>
      {labels[strength]}
    </span>
  );
}
