// 당사자 관계도 패널
// 법률 문서의 당사자들 간의 법률적 관계를 시각화

import React, { useEffect, useRef, useState } from "react";
import type { PartyInfo } from "../preprocessor/LegalEntityExtractor";

/**
 * 당사자 노드
 */
export interface PartyNode {
  id: string;
  role: string;
  name?: string;
  type: "individual" | "company" | "government" | "court" | "other";
  side: "claimant" | "respondent" | "third" | "neutral";
  representative?: string;  // 대리인
  attorney?: string;        // 변호인
}

/**
 * 당사자 간 법률 관계
 */
export interface PartyRelation {
  from: string;   // 당사자 ID
  to: string;     // 당사자 ID
  type: "contract" | "tort" | "employment" | "family" | "criminal" | "admin" | "other";
  label: string;
  isDisputed: boolean;
}

/**
 * 파싱된 PartyInfo에서 PartyNode 생성
 */
export function buildPartyNodes(parties: PartyInfo[]): PartyNode[] {
  return parties.map((party, i) => ({
    id: `party-${i}`,
    role: party.role,
    name: party.name,
    type: party.isCompany ? "company" : "individual",
    side: mapRoleToSide(party.role),
  }));
}

function mapRoleToSide(role: string): PartyNode["side"] {
  if (["원고", "항소인", "상고인", "신청인", "청구인", "채권자"].includes(role)) return "claimant";
  if (["피고", "피항소인", "피상고인", "피신청인", "피청구인", "채무자"].includes(role)) return "respondent";
  return "third";
}

// ── 컴포넌트 ──────────────────────────────────────────────

interface PartyRelationPanelProps {
  parties: PartyInfo[];
  relations?: PartyRelation[];
  caseNumbers?: string[];
}

/**
 * 당사자 관계도 패널
 */
export function PartyRelationPanel({
  parties,
  relations = [],
  caseNumbers = [],
}: PartyRelationPanelProps): React.JSX.Element {
  const nodes = buildPartyNodes(parties);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);

  if (nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center">
        당사자 정보가 없습니다.
        <br />
        판결문 또는 소장을 분석하면 자동으로 추출됩니다.
      </div>
    );
  }

  const claimants = nodes.filter((n) => n.side === "claimant");
  const respondents = nodes.filter((n) => n.side === "respondent");
  const thirds = nodes.filter((n) => n.side === "third");

  const selectedNode = nodes.find((n) => n.id === selectedParty);

  return (
    <div className="party-panel p-3 space-y-3 overflow-y-auto h-full text-sm">
      {/* 사건번호 */}
      {caseNumbers.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          사건: {caseNumbers.slice(0, 2).join(", ")}
        </div>
      )}

      {relations.length > 0 && (
        <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
            관계도
          </div>
          <RelationGraph nodes={nodes} relations={relations} />
        </div>
      )}

      {/* 당사자 대립 구조 */}
      <div className="relative">
        {/* 원고측 */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            원고측 ({claimants.length})
          </div>
          {claimants.map((party) => (
            <PartyCard
              key={party.id}
              party={party}
              isSelected={selectedParty === party.id}
              onClick={() => setSelectedParty(selectedParty === party.id ? null : party.id)}
            />
          ))}
        </div>

        {/* VS 구분자 */}
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <div className="text-xs font-bold text-gray-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
            VS
          </div>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* 피고측 */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
            피고측 ({respondents.length})
          </div>
          {respondents.map((party) => (
            <PartyCard
              key={party.id}
              party={party}
              isSelected={selectedParty === party.id}
              onClick={() => setSelectedParty(selectedParty === party.id ? null : party.id)}
            />
          ))}
        </div>

        {/* 제3자 */}
        {thirds.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              기타 관계자 ({thirds.length})
            </div>
            {thirds.map((party) => (
              <PartyCard
                key={party.id}
                party={party}
                isSelected={selectedParty === party.id}
                onClick={() => setSelectedParty(selectedParty === party.id ? null : party.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 선택된 당사자 상세 */}
      {selectedNode && (
        <PartyDetail party={selectedNode} relations={relations} />
      )}

      {/* 관계 목록 */}
      {relations.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
            법률 관계 ({relations.length})
          </div>
          <div className="space-y-1">
            {relations.map((rel, i) => {
              const fromParty = nodes.find((n) => n.id === rel.from);
              const toParty = nodes.find((n) => n.id === rel.to);
              return (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{fromParty?.name ?? fromParty?.role}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    rel.isDisputed
                      ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  }`}>{rel.label}</span>
                  <span className="font-medium">{toParty?.name ?? toParty?.role}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────────────

function RelationGraph({
  nodes,
  relations,
}: {
  nodes: PartyNode[];
  relations: PartyRelation[];
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 280;
    const height = 180;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const positions: Record<string, { x: number; y: number }> = {};
    const claimants = nodes.filter((node) => node.side === "claimant");
    const respondents = nodes.filter((node) => node.side === "respondent");
    const thirds = nodes.filter((node) => node.side === "third");

    claimants.forEach((node, index) => {
      positions[node.id] = { x: 56, y: 38 + index * 42 };
    });
    respondents.forEach((node, index) => {
      positions[node.id] = { x: width - 56, y: 38 + index * 42 };
    });
    thirds.forEach((node, index) => {
      positions[node.id] = { x: width / 2, y: height - 30 - index * 34 };
    });

    for (const relation of relations) {
      const from = positions[relation.from];
      const to = positions[relation.to];
      if (!from || !to) continue;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = relation.isDisputed ? "#ef4444" : "#3b82f6";
      ctx.setLineDash(relation.isDisputed ? [5, 3] : []);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#6b7280";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(relation.label, (from.x + to.x) / 2, (from.y + to.y) / 2 - 6);
    }

    for (const node of nodes) {
      const pos = positions[node.id];
      if (!pos) continue;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.fillStyle =
        node.side === "claimant"
          ? "#dbeafe"
          : node.side === "respondent"
          ? "#fee2e2"
          : "#e5e7eb";
      ctx.fill();
      ctx.strokeStyle =
        node.side === "claimant"
          ? "#3b82f6"
          : node.side === "respondent"
          ? "#ef4444"
          : "#6b7280";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#374151";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((node.name ?? node.role).slice(0, 6), pos.x, pos.y);
    }
  }, [nodes, relations]);

  return <canvas ref={canvasRef} className="w-full h-[180px]" />;
}

function PartyCard({
  party,
  isSelected,
  onClick,
}: {
  party: PartyNode;
  isSelected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const sideColor = {
    claimant: "border-l-blue-400",
    respondent: "border-l-red-400",
    third: "border-l-gray-400",
    neutral: "border-l-gray-300",
  }[party.side];

  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
        border-l-2 ${sideColor}
        ${isSelected
          ? "bg-blue-50 dark:bg-blue-900/30"
          : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
        }
      `}
      onClick={onClick}
    >
      <PartyTypeBadge type={party.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{party.role}</span>
          {party.name && (
            <span className="font-medium truncate">{party.name}</span>
          )}
        </div>
        {party.attorney && (
          <div className="text-xs text-gray-400">대리: {party.attorney}</div>
        )}
      </div>
    </div>
  );
}

function PartyTypeBadge({ type }: { type: PartyNode["type"] }): React.JSX.Element {
  const config = {
    individual: {
      label: "인",
      className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    },
    company: {
      label: "법",
      className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    },
    government: {
      label: "정",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    court: {
      label: "법원",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    other: {
      label: "기",
      className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    },
  }[type];

  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ${config.className}`}
      aria-hidden="true"
    >
      {config.label}
    </span>
  );
}

function PartyDetail({
  party,
  relations,
}: {
  party: PartyNode;
  relations: PartyRelation[];
}): React.JSX.Element {
  const relatedRelations = relations.filter(
    (r) => r.from === party.id || r.to === party.id
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 text-xs space-y-1">
      <div className="font-semibold">{party.name ?? party.role} 상세</div>
      <div className="text-gray-500">유형: {party.type === "company" ? "법인" : "개인"}</div>
      {relatedRelations.length > 0 && (
        <div className="text-gray-500">
          법률 관계: {relatedRelations.length}건
        </div>
      )}
    </div>
  );
}
