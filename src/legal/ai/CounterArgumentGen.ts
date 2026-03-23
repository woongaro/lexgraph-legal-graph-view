// 반박 논거 생성기
// 현재 문서의 논리 구조 취약점을 분석하여 반박 전략 도출

import type { TopicCluster, StructuralGap } from "../../infranodus/types";
import type { DetectedIssue } from "./IssueSpotter";
import type { ExtractionResult } from "../preprocessor/LegalEntityExtractor";

/**
 * 반박 논거 항목
 */
export interface CounterArgument {
  id: string;
  targetIssue: string;        // 공격 대상 쟁점
  weakness: string;           // 취약점 설명
  counterStrategy: string;    // 반박 전략
  evidenceNeeded: string[];   // 필요 증거/자료
  legalBasis?: string[];      // 관련 법령/판례
  risk: "high" | "medium" | "low";  // 우리 측 위험도
  priority: number;           // 1(최우선) ~ 5
}

/**
 * 반박 분석 결과
 */
export interface CounterAnalysis {
  arguments: CounterArgument[];
  overallRisk: "high" | "medium" | "low";
  keyVulnerabilities: string[];
  preemptiveActions: string[];  // 선제 대응 방안
}

// ── 취약점 패턴 ──────────────────────────────────────────

/**
 * 법률 논리 취약점 패턴
 * gap.between 쌍에서 예상되는 취약점 분류
 */
const VULNERABILITY_PATTERNS = [
  {
    keywords: ["인과관계", "causation"],
    weakness: "인과관계 입증 불충분",
    strategy: "피해와 행위 사이의 직접적 인과고리를 공격하거나, 중간 원인을 제시하여 인과관계를 단절시킨다.",
    evidence: ["피해 발생 시점 증거", "제3자 기여 요인 자료", "전문가 감정서"],
    basis: ["민법 제750조 인과관계 요건", "상당인과관계설 판례"],
  },
  {
    keywords: ["고의", "과실", "negligence"],
    weakness: "고의 또는 과실 입증 불충분",
    strategy: "주관적 요건(고의·과실)의 존재를 부정하거나, 상당한 주의를 다했음을 주장한다.",
    evidence: ["당시 주의의무 이행 자료", "업계 표준 준수 증거", "내부 절차 문서"],
    basis: ["민법 제750조 과실 요건", "형법 제13조 고의"],
  },
  {
    keywords: ["손해", "피해", "damage"],
    weakness: "손해 범위·액수 산정 불명확",
    strategy: "청구된 손해액의 과다를 지적하고, 실제 손해와 청구액 사이의 괴리를 입증한다.",
    evidence: ["손해액 계산 근거 서류", "시장 가격 자료", "유사 사례 비교"],
    basis: ["손해배상 범위 제한 원칙", "과실상계 민법 제396조"],
  },
  {
    keywords: ["계약", "의무", "obligation"],
    weakness: "계약 의무 해석 불명확",
    strategy: "계약 조항의 해석을 다투거나, 상대방의 선행 의무 불이행을 항변으로 제출한다.",
    evidence: ["계약서 원본", "교신 기록", "이행 현황 자료"],
    basis: ["민법 제390조 채무불이행", "동시이행항변권 제536조"],
  },
  {
    keywords: ["시효", "기간", "deadline"],
    weakness: "시효 또는 제척기간 도과 가능성",
    strategy: "청구권의 소멸시효 완성 또는 제척기간 도과를 항변으로 제출한다.",
    evidence: ["행위 발생 시점 증거", "청구 제출 일자 기록"],
    basis: ["민법 제162조 소멸시효", "관련 특별법 제척기간"],
  },
];

// ── 메인 함수 ─────────────────────────────────────────────

/**
 * 반박 논거 생성
 */
export function generateCounterArguments(
  issues: DetectedIssue[],
  clusters: TopicCluster[],
  gaps: StructuralGap[],
  entities: ExtractionResult
): CounterAnalysis {
  const args: CounterArgument[] = [];

  // 1. 구조적 공백 기반 취약점
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    const [from, to] = gap.between;

    const matchedPattern = VULNERABILITY_PATTERNS.find((p) =>
      p.keywords.some(
        (k) => from.toLowerCase().includes(k) || to.toLowerCase().includes(k)
      )
    );

    if (matchedPattern) {
      args.push({
        id: `gap-${i}`,
        targetIssue: `${from} ↔ ${to} 연결 취약`,
        weakness: matchedPattern.weakness,
        counterStrategy: matchedPattern.strategy,
        evidenceNeeded: matchedPattern.evidence,
        legalBasis: matchedPattern.basis,
        risk: gap.betweennessScore > 0.3 ? "high" : "medium",
        priority: i + 1,
      });
    } else {
      args.push({
        id: `gap-${i}`,
        targetIssue: `${from} ↔ ${to} 논리 연결 부재`,
        weakness: `"${from}"과 "${to}" 사이의 논리적 연결이 약합니다.`,
        counterStrategy: "두 개념 간의 논리적 비약을 공격하고, 독립적으로 반박한다.",
        evidenceNeeded: ["관련 사실 자료", "전문가 의견서"],
        risk: "medium",
        priority: i + 1,
      });
    }
  }

  // 2. 쟁점별 취약점 분석
  for (const issue of issues.filter((i) => i.confidence < 0.6)) {
    args.push({
      id: `weak-${issue.id}`,
      targetIssue: issue.title,
      weakness: `${issue.title} 쟁점의 입증 신뢰도가 낮습니다 (${Math.round(issue.confidence * 100)}%).`,
      counterStrategy: "낮은 신뢰도의 주장에 대해 증거 부족을 지적하고, 거증책임 전환을 도모한다.",
      evidenceNeeded: ["반증 자료", "전문가 증언"],
      legalBasis: issue.legalBasis,
      risk: "medium",
      priority: 3,
    });
  }

  // 우선순위 및 위험도 순 정렬
  args.sort((a, b) => a.priority - b.priority);

  // 전체 위험도 평가
  const highRiskCount = args.filter((a) => a.risk === "high").length;
  const overallRisk: CounterAnalysis["overallRisk"] =
    highRiskCount >= 2 ? "high" : highRiskCount >= 1 ? "medium" : "low";

  // 핵심 취약점 목록
  const keyVulnerabilities = args
    .filter((a) => a.risk === "high")
    .map((a) => a.weakness)
    .slice(0, 3);

  // 선제 대응 방안
  const preemptiveActions = buildPreemptiveActions(args, entities);

  return {
    arguments: args.slice(0, 8),
    overallRisk,
    keyVulnerabilities,
    preemptiveActions,
  };
}

/**
 * 선제 대응 방안 생성
 */
function buildPreemptiveActions(
  args: CounterArgument[],
  entities: ExtractionResult
): string[] {
  const actions: string[] = [];

  // 증거 보강이 필요한 영역
  const evidenceNeeds = new Set(args.flatMap((a) => a.evidenceNeeded));
  if (evidenceNeeds.size > 0) {
    actions.push(`다음 자료를 선제적으로 확보하세요: ${[...evidenceNeeds].slice(0, 3).join(", ")}`);
  }

  // 인용 판례가 있으면 활용
  if (entities.citations.length > 0) {
    actions.push(`인용된 ${entities.citations.length}건의 판례를 면밀히 검토하여 우리 측에 불리한 법리를 미리 식별하세요.`);
  }

  // 법령 조항 관련
  if (entities.statutes.length > 3) {
    actions.push(`언급된 법령 조항(${entities.statutes.length}건)의 현행 해석론과 최신 판례 동향을 확인하세요.`);
  }

  // 기간 관련 경고
  const hasDates = entities.dates.length > 0;
  if (hasDates) {
    actions.push("시효 기간 및 제척기간 계산을 재확인하세요. 특히 최근 날짜 변경 사항에 주의하세요.");
  }

  return actions.slice(0, 5);
}

/**
 * 반박 분석 결과를 마크다운으로 포맷
 */
export function formatCounterAnalysis(analysis: CounterAnalysis): string {
  const lines: string[] = [];

  // 위험도 헤더
  const riskEmoji = { high: "🔴", medium: "🟡", low: "🟢" }[analysis.overallRisk];
  lines.push(`## 반박 위험도: ${riskEmoji} ${analysis.overallRisk.toUpperCase()}\n`);

  // 핵심 취약점
  if (analysis.keyVulnerabilities.length > 0) {
    lines.push("### 핵심 취약점");
    analysis.keyVulnerabilities.forEach((v, i) => {
      lines.push(`${i + 1}. ${v}`);
    });
    lines.push("");
  }

  // 반박 논거
  lines.push("### 예상 반박 논거");
  analysis.arguments.slice(0, 5).forEach((arg, i) => {
    const riskBadge = { high: "[고위험]", medium: "[중위험]", low: "[저위험]" }[arg.risk];
    lines.push(`\n#### ${i + 1}. ${arg.targetIssue} ${riskBadge}`);
    lines.push(`**취약점**: ${arg.weakness}`);
    lines.push(`**전략**: ${arg.counterStrategy}`);
    if (arg.legalBasis?.length) {
      lines.push(`**법적 근거**: ${arg.legalBasis.join(", ")}`);
    }
    if (arg.evidenceNeeded.length > 0) {
      lines.push(`**필요 자료**: ${arg.evidenceNeeded.slice(0, 2).join(", ")}`);
    }
  });

  // 선제 대응
  if (analysis.preemptiveActions.length > 0) {
    lines.push("\n### 선제 대응 방안");
    analysis.preemptiveActions.forEach((a, i) => {
      lines.push(`${i + 1}. ${a}`);
    });
  }

  return lines.join("\n");
}
