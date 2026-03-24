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

const EVIDENCE_TYPE_INFO: Record<Evidence["type"], { icon: string; label: string }> = {
  document: { icon: "📄", label: "서증" },
  witness: { icon: "👤", label: "증인" },
  expert: { icon: "🔬", label: "감정" },
  circumstantial: { icon: "🔗", label: "정황" },
  digital: { icon: "💻", label: "디지털" },
  other: { icon: "📎", label: "기타" },
};

interface EvidenceMatrixProps {
  data: MatrixData;
  onAddEvidence?: (evidence: Omit<Evidence, "id">) => void;
  onAddFact?: (fact: Omit<FactItem, "id">) => void;
  editableEvidenceIds?: Set<string>;
  editableFactIds?: Set<string>;
  removableEvidenceIds?: Set<string>;
  removableFactIds?: Set<string>;
  onUpdateEvidence?: (evidenceId: string, evidence: Omit<Evidence, "id">) => void;
  onUpdateFact?: (factId: string, fact: Omit<FactItem, "id">) => void;
  onRemoveEvidence?: (evidenceId: string) => void;
  onRemoveFact?: (factId: string) => void;
}

type EditorState =
  | { kind: "evidence"; item?: Evidence }
  | { kind: "fact"; item?: FactItem }
  | null;

export function EvidenceMatrix({
  data,
  onAddEvidence,
  onAddFact,
  editableEvidenceIds = new Set(),
  editableFactIds = new Set(),
  removableEvidenceIds = new Set(),
  removableFactIds = new Set(),
  onUpdateEvidence,
  onUpdateFact,
  onRemoveEvidence,
  onRemoveFact,
}: EvidenceMatrixProps): React.JSX.Element {
  const [view, setView] = useState<"matrix" | "evidence" | "facts">("matrix");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(null);

  const issueOptions = data.issues.filter((issue) => !issue.isGap);
  const filteredEvidence = selectedIssue
    ? data.evidence.filter((evidence) => evidence.issues.includes(selectedIssue))
    : data.evidence;
  const filteredFacts = selectedIssue
    ? data.facts.filter((fact) => fact.issues.includes(selectedIssue))
    : data.facts;

  return (
    <div className="evidence-matrix h-full flex flex-col text-sm">
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-2">
        {(["matrix", "evidence", "facts"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-3 py-2 text-xs border-b-2 -mb-px ${
              view === tab
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setView(tab)}
          >
            {tab === "matrix" ? "매트릭스" : tab === "evidence" ? `증거 (${data.evidence.length})` : `사실 (${data.facts.length})`}
          </button>
        ))}
      </div>

      {issueOptions.length > 0 && (
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
          {issueOptions.map((issue) => (
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

      <div className="flex-1 overflow-y-auto">
        {view === "matrix" && (
          <MatrixView issues={data.issues} facts={filteredFacts} evidence={filteredEvidence} />
        )}
        {view === "evidence" && (
          <EvidenceList
            evidence={filteredEvidence}
            editableIds={editableEvidenceIds}
            removableIds={removableEvidenceIds}
            onEdit={(item) => setEditorState({ kind: "evidence", item })}
            onRemove={onRemoveEvidence}
          />
        )}
        {view === "facts" && (
          <FactList
            facts={filteredFacts}
            editableIds={editableFactIds}
            removableIds={removableFactIds}
            onEdit={(item) => setEditorState({ kind: "fact", item })}
            onRemove={onRemoveFact}
          />
        )}
      </div>

      {editorState && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/30">
          {editorState.kind === "evidence" && (onAddEvidence || onUpdateEvidence) && (
            <EvidenceEditor
              issues={issueOptions}
              selectedIssue={selectedIssue}
              initialValue={editorState.item}
              onSubmit={(evidence) => {
                if (editorState.item && onUpdateEvidence) {
                  onUpdateEvidence(editorState.item.id, evidence);
                } else {
                  onAddEvidence?.(evidence);
                }
                setEditorState(null);
              }}
              onCancel={() => setEditorState(null)}
            />
          )}
          {editorState.kind === "fact" && (onAddFact || onUpdateFact) && (
            <FactEditor
              issues={issueOptions}
              evidence={data.evidence}
              selectedIssue={selectedIssue}
              initialValue={editorState.item}
              onSubmit={(fact) => {
                if (editorState.item && onUpdateFact) {
                  onUpdateFact(editorState.item.id, fact);
                } else {
                  onAddFact?.(fact);
                }
                setEditorState(null);
              }}
              onCancel={() => setEditorState(null)}
            />
          )}
        </div>
      )}

      {(onAddEvidence || onAddFact) && (
        <div className="flex gap-2 p-2 border-t border-gray-200 dark:border-gray-700">
          {onAddEvidence && (
            <button
              className="flex-1 text-xs py-1.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
              onClick={() => setEditorState((current) => current?.kind === "evidence" && !current.item ? null : { kind: "evidence" })}
            >
              {editorState?.kind === "evidence" && !editorState.item ? "증거 입력 닫기" : "+ 증거 추가"}
            </button>
          )}
          {onAddFact && (
            <button
              className="flex-1 text-xs py-1.5 rounded bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100"
              onClick={() => setEditorState((current) => current?.kind === "fact" && !current.item ? null : { kind: "fact" })}
            >
              {editorState?.kind === "fact" && !editorState.item ? "사실 입력 닫기" : "+ 사실 추가"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MatrixView({
  issues,
  facts,
  evidence,
}: {
  issues: IssueNode[];
  facts: FactItem[];
  evidence: Evidence[];
}): React.JSX.Element {
  const displayIssues = issues.filter((issue) => !issue.isGap).slice(0, 6);

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
          {evidence.slice(0, 10).map((item) => (
            <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-2 py-2">
                <div className="flex items-center gap-1">
                  <span>{EVIDENCE_TYPE_INFO[item.type].icon}</span>
                  <span className="truncate max-w-24">{item.name}</span>
                </div>
                <div className={`text-xs mt-0.5 ${
                  item.side === "claimant" ? "text-blue-500" :
                  item.side === "respondent" ? "text-red-500" : "text-gray-400"
                }`}>
                  {item.side === "claimant" ? "원고측" : item.side === "respondent" ? "피고측" : "중립"}
                </div>
              </td>
              {displayIssues.map((issue) => {
                const relevant = item.issues.includes(issue.id);
                return (
                  <td key={issue.id} className="px-2 py-2 text-center">
                    {relevant ? (
                      <span className={`inline-block w-4 h-4 rounded-full ${
                        item.relevance === "high" ? "bg-green-400" :
                        item.relevance === "medium" ? "bg-yellow-400" : "bg-gray-300"
                      }`} title={`관련성: ${item.relevance}`} />
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
      {facts.length > 0 && (
        <div className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800">
          연결된 사실 {facts.length}건
        </div>
      )}
    </div>
  );
}

function EvidenceList({
  evidence,
  editableIds,
  removableIds,
  onEdit,
  onRemove,
}: {
  evidence: Evidence[];
  editableIds: Set<string>;
  removableIds: Set<string>;
  onEdit?: (item: Evidence) => void;
  onRemove?: (id: string) => void;
}): React.JSX.Element {
  if (evidence.length === 0) {
    return <div className="p-4 text-center text-gray-400">증거가 없습니다.</div>;
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {evidence.map((item) => (
        <div key={item.id} className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <span className="text-base">{EVIDENCE_TYPE_INFO[item.type].icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{item.name}</div>
              {item.description && (
                <div className="text-xs text-gray-500 truncate">{item.description}</div>
              )}
            </div>
            <RelevanceBadge relevance={item.relevance} />
            {onEdit && editableIds.has(item.id) && (
              <button
                className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => onEdit(item)}
              >
                편집
              </button>
            )}
            {onRemove && removableIds.has(item.id) && (
              <button
                className="text-[11px] px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                onClick={() => onRemove(item.id)}
              >
                삭제
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FactList({
  facts,
  editableIds,
  removableIds,
  onEdit,
  onRemove,
}: {
  facts: FactItem[];
  editableIds: Set<string>;
  removableIds: Set<string>;
  onEdit?: (item: FactItem) => void;
  onRemove?: (id: string) => void;
}): React.JSX.Element {
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
                {fact.isDisputed ? "다툼 있는 사실" : "다툼 없는 사실"}
                {" · "}증거 {fact.evidence.length}개
              </div>
            </div>
            {onEdit && editableIds.has(fact.id) && (
              <button
                className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => onEdit(fact)}
              >
                편집
              </button>
            )}
            {onRemove && removableIds.has(fact.id) && (
              <button
                className="text-[11px] px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                onClick={() => onRemove(fact.id)}
              >
                삭제
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceEditor({
  issues,
  selectedIssue,
  initialValue,
  onSubmit,
  onCancel,
}: {
  issues: IssueNode[];
  selectedIssue: string | null;
  initialValue?: Evidence;
  onSubmit: (evidence: Omit<Evidence, "id">) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [type, setType] = useState<Evidence["type"]>(initialValue?.type ?? "document");
  const [relevance, setRelevance] = useState<Evidence["relevance"]>(initialValue?.relevance ?? "medium");
  const [side, setSide] = useState<Evidence["side"]>(initialValue?.side ?? "neutral");
  const [issueIds, setIssueIds] = useState<string[]>(
    initialValue?.issues ?? (selectedIssue ? [selectedIssue] : [])
  );

  return (
    <EditorShell
      title={initialValue ? "증거 편집" : "증거 추가"}
      onCancel={onCancel}
      onSubmit={() => {
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          relevance,
          side,
          issues: issueIds,
        });
      }}
      submitLabel={initialValue ? "증거 수정" : "증거 저장"}
      disabled={!name.trim()}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">증거명</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="예: 갑 제1호증 매매계약서"
          className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <SelectField
          label="유형"
          value={type}
          onChange={(value) => setType(value as Evidence["type"])}
          options={Object.entries(EVIDENCE_TYPE_INFO).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <SelectField
          label="관련성"
          value={relevance}
          onChange={(value) => setRelevance(value as Evidence["relevance"])}
          options={[
            { value: "high", label: "높음" },
            { value: "medium", label: "보통" },
            { value: "low", label: "낮음" },
          ]}
        />
        <SelectField
          label="측"
          value={side}
          onChange={(value) => setSide(value as Evidence["side"])}
          options={[
            { value: "claimant", label: "원고측" },
            { value: "respondent", label: "피고측" },
            { value: "neutral", label: "중립" },
          ]}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">설명</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="입증 취지나 문서 설명"
          className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-y"
        />
      </label>

      <ChecklistField
        label="연결 쟁점"
        items={issues.map((issue) => ({ id: issue.id, label: issue.title }))}
        selectedIds={issueIds}
        onChange={setIssueIds}
        emptyLabel="쟁점이 없습니다."
      />
    </EditorShell>
  );
}

function FactEditor({
  issues,
  evidence,
  selectedIssue,
  initialValue,
  onSubmit,
  onCancel,
}: {
  issues: IssueNode[];
  evidence: Evidence[];
  selectedIssue: string | null;
  initialValue?: FactItem;
  onSubmit: (fact: Omit<FactItem, "id">) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [isDisputed, setIsDisputed] = useState(initialValue?.isDisputed ?? true);
  const [issueIds, setIssueIds] = useState<string[]>(
    initialValue?.issues ?? (selectedIssue ? [selectedIssue] : [])
  );
  const [evidenceIds, setEvidenceIds] = useState<string[]>(initialValue?.evidence ?? []);

  return (
    <EditorShell
      title={initialValue ? "사실 편집" : "사실 추가"}
      onCancel={onCancel}
      onSubmit={() => {
        if (!description.trim()) return;
        onSubmit({
          description: description.trim(),
          isDisputed,
          evidence: evidenceIds,
          issues: issueIds,
        });
      }}
      submitLabel={initialValue ? "사실 수정" : "사실 저장"}
      disabled={!description.trim()}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">사실 설명</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="예: 피고는 2024. 3. 1.까지 대금을 지급하지 않았다."
          className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-y"
        />
      </label>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={isDisputed}
            onChange={() => setIsDisputed(true)}
          />
          다툼 있음
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={!isDisputed}
            onChange={() => setIsDisputed(false)}
          />
          다툼 없음
        </label>
      </div>

      <ChecklistField
        label="연결 쟁점"
        items={issues.map((issue) => ({ id: issue.id, label: issue.title }))}
        selectedIds={issueIds}
        onChange={setIssueIds}
        emptyLabel="쟁점이 없습니다."
      />

      <ChecklistField
        label="연결 증거"
        items={evidence.map((item) => ({ id: item.id, label: item.name }))}
        selectedIds={evidenceIds}
        onChange={setEvidenceIds}
        emptyLabel="연결할 증거가 없습니다."
      />
    </EditorShell>
  );
}

function EditorShell({
  title,
  children,
  onCancel,
  onSubmit,
  submitLabel,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">{title}</div>
      <div className="space-y-2">{children}</div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700"
          onClick={onCancel}
        >
          취소
        </button>
        <button
          className="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40"
          onClick={onSubmit}
          disabled={disabled}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChecklistField({
  label,
  items,
  selectedIds,
  onChange,
  emptyLabel,
}: {
  label: string;
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyLabel: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500">{label}</div>
      {items.length === 0 ? (
        <div className="text-xs text-gray-400">{emptyLabel}</div>
      ) : (
        <div className="max-h-24 overflow-y-auto space-y-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5">
          {items.map((item) => (
            <label key={item.id} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => {
                  onChange(
                    selectedIds.includes(item.id)
                      ? selectedIds.filter((id) => id !== item.id)
                      : [...selectedIds, item.id]
                  );
                }}
              />
              <span className="break-all">{item.label}</span>
            </label>
          ))}
        </div>
      )}
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
