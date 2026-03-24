// 쟁점 자동 탐지기
// 규칙 기반 선처리 + InfraNodus 클러스터 기반 쟁점 식별

import type { TopicCluster, StructuralGap } from "../../graph/types";
import type { LegalDocumentType } from "../../settings/LexGraphSettings";
import type { ExtractionResult } from "../preprocessor/LegalEntityExtractor";

/**
 * 탐지된 쟁점
 */
export interface DetectedIssue {
  id: string;
  title: string;
  description: string;
  confidence: number;     // 0~1
  sources: IssueSource[];
  legalBasis?: string[];  // 관련 법령
  relatedClusters?: string[];
}

/**
 * 쟁점 탐지 소스
 */
export type IssueSource =
  | "keyword_pattern"   // 키워드 패턴
  | "graph_cluster"     // 그래프 클러스터
  | "structural_gap"    // 구조적 공백
  | "entity_analysis"   // 엔티티 분석
  | "ai_analysis";      // AI 분석 결과

/**
 * 쟁점 탐지 결과
 */
export interface IssueSpotResult {
  issues: DetectedIssue[];
  documentType: LegalDocumentType;
  analysisQuality: "high" | "medium" | "low";
  warnings: string[];
}

// ── 쟁점 키워드 패턴 (문서 유형별) ────────────────────────

const ISSUE_KEYWORD_PATTERNS: Record<string, { pattern: RegExp; issueType: string; basis?: string }[]> = {
  // 민사 공통
  common: [
    { pattern: /손해배상\s*(?:청구|책임)/, issueType: "손해배상 책임", basis: "민법 제750조, 제390조" },
    { pattern: /계약\s*(?:해제|취소|무효)/, issueType: "계약 효력", basis: "민법 제543조 이하" },
    { pattern: /부당이득\s*반환/, issueType: "부당이득 반환", basis: "민법 제741조" },
    { pattern: /소멸시효/, issueType: "소멸시효 완성", basis: "민법 제162조" },
    { pattern: /임대차\s*(?:보증금|반환)/, issueType: "임대차 보증금 반환", basis: "주택임대차보호법 제3조" },
    { pattern: /채무불이행/, issueType: "채무불이행 성립", basis: "민법 제390조" },
    { pattern: /불법행위/, issueType: "불법행위 성립", basis: "민법 제750조" },
  ],
  // 형사
  criminal: [
    { pattern: /(?:사기|기망)\s*(?:행위|죄)/, issueType: "사기죄 성립", basis: "형법 제347조" },
    { pattern: /횡령/, issueType: "횡령죄 성립", basis: "형법 제355조" },
    { pattern: /배임/, issueType: "배임죄 성립", basis: "형법 제355조" },
    { pattern: /고의(?:성|적)/, issueType: "고의 여부", basis: "형법 제13조" },
    { pattern: /공모\s*공동정범/, issueType: "공모 공동정범", basis: "형법 제30조" },
    { pattern: /정당방위/, issueType: "정당방위 성립", basis: "형법 제21조" },
    { pattern: /집행유예/, issueType: "양형 — 집행유예 적부", basis: "형법 제62조" },
  ],
  // 행정
  admin: [
    { pattern: /처분\s*(?:취소|위법)/, issueType: "행정처분 위법성", basis: "행정소송법 제4조" },
    { pattern: /재량권\s*(?:일탈|남용)/, issueType: "재량권 일탈·남용", basis: "행정소송법 제27조" },
    { pattern: /절차\s*(?:위반|하자)/, issueType: "절차적 위법", basis: "행정절차법 제2조" },
    { pattern: /비례\s*원칙/, issueType: "비례원칙 위반", basis: "행정기본법 제10조" },
    { pattern: /신뢰보호/, issueType: "신뢰보호원칙", basis: "행정기본법 제12조" },
  ],
  // 헌법
  constitutional: [
    { pattern: /기본권\s*침해/, issueType: "기본권 침해", basis: "헌법 제37조" },
    { pattern: /과잉금지\s*원칙/, issueType: "과잉금지원칙 위반", basis: "헌법 제37조 제2항" },
    { pattern: /평등\s*원칙/, issueType: "평등원칙 위반", basis: "헌법 제11조" },
    { pattern: /위헌/, issueType: "위헌 여부", basis: "헌법재판소법 제41조" },
  ],
};

/**
 * 문서 유형에서 쟁점 패턴 선택
 */
function getPatternsForType(docType: LegalDocumentType): typeof ISSUE_KEYWORD_PATTERNS.common {
  const patterns = [...ISSUE_KEYWORD_PATTERNS.common];

  switch (docType) {
    case "judgment":
      // 형사 여부는 사건번호로 판단 (임시: 모두 포함)
      patterns.push(...ISSUE_KEYWORD_PATTERNS.criminal);
      patterns.push(...ISSUE_KEYWORD_PATTERNS.admin);
      break;
    case "brief":
      patterns.push(...ISSUE_KEYWORD_PATTERNS.criminal);
      patterns.push(...ISSUE_KEYWORD_PATTERNS.admin);
      break;
  }

  return patterns;
}

// ── 메인 탐지 함수 ───────────────────────────────────────

/**
 * 텍스트에서 쟁점 자동 탐지
 */
export function spotIssues(
  text: string,
  docType: LegalDocumentType,
  clusters: TopicCluster[],
  gaps: StructuralGap[],
  entities: ExtractionResult
): IssueSpotResult {
  const issues: DetectedIssue[] = [];
  const warnings: string[] = [];

  // 1. 키워드 패턴 기반 탐지
  const keywordIssues = detectByKeywords(text, docType);
  issues.push(...keywordIssues);

  // 2. 그래프 클러스터 기반 탐지
  const clusterIssues = detectByClusters(clusters);
  // 중복 제거하며 병합
  for (const ci of clusterIssues) {
    const existing = issues.find((i) =>
      i.title.toLowerCase().includes(ci.title.toLowerCase().slice(0, 5))
    );
    if (existing) {
      existing.relatedClusters = [...(existing.relatedClusters ?? []), ...(ci.relatedClusters ?? [])];
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      issues.push(ci);
    }
  }

  // 3. 구조적 공백 → 미탐지 쟁점 경고
  const gapWarnings = detectGapWarnings(gaps, issues);
  warnings.push(...gapWarnings);

  // 4. 엔티티 기반 보강
  enrichWithEntities(issues, entities);

  // 신뢰도 순 정렬
  issues.sort((a, b) => b.confidence - a.confidence);

  // 품질 평가
  const analysisQuality: IssueSpotResult["analysisQuality"] =
    issues.length >= 3 && clusters.length >= 3
      ? "high"
      : issues.length >= 1
      ? "medium"
      : "low";

  return {
    issues: issues.slice(0, 10),  // 최대 10개
    documentType: docType,
    analysisQuality,
    warnings,
  };
}

/**
 * 키워드 패턴으로 쟁점 탐지
 */
function detectByKeywords(text: string, docType: LegalDocumentType): DetectedIssue[] {
  const patterns = getPatternsForType(docType);
  const detected: DetectedIssue[] = [];

  for (let i = 0; i < patterns.length; i++) {
    const { pattern, issueType, basis } = patterns[i];
    if (pattern.test(text)) {
      // 패턴 출현 빈도로 신뢰도 결정
      const matches = text.match(new RegExp(pattern.source, "g"));
      const frequency = matches?.length ?? 1;
      const confidence = Math.min(0.9, 0.5 + frequency * 0.1);

      detected.push({
        id: `kw-${i}`,
        title: issueType,
        description: `텍스트에서 "${issueType}" 관련 표현이 ${frequency}회 발견되었습니다.`,
        confidence,
        sources: ["keyword_pattern"],
        legalBasis: basis ? [basis] : [],
      });
    }
  }

  return detected;
}

/**
 * 그래프 클러스터에서 쟁점 탐지
 */
function detectByClusters(clusters: TopicCluster[]): DetectedIssue[] {
  return clusters.slice(0, 5).map((cluster, i) => ({
    id: `cl-${i}`,
    title: cluster.name || `법률 논점 ${i + 1}`,
    description: `주요 개념: ${cluster.nodes.slice(0, 4).join(", ")}`,
    confidence: cluster.centrality ?? 0.5,
    sources: ["graph_cluster" as IssueSource],
    relatedClusters: [cluster.name],
  }));
}

/**
 * 구조적 공백에서 경고 생성
 */
function detectGapWarnings(gaps: StructuralGap[], detectedIssues: DetectedIssue[]): string[] {
  return gaps.slice(0, 3).map(
    (gap) =>
      `"${gap.between[0]}"과 "${gap.between[1]}" 사이의 논리적 연결이 부족합니다. 이 영역의 쟁점을 추가로 검토하세요.`
  );
}

/**
 * 엔티티 정보로 쟁점 보강
 */
function enrichWithEntities(issues: DetectedIssue[], entities: ExtractionResult): void {
  if (entities.statutes.length > 0) {
    // 법령이 이미 탐지된 쟁점과 관련되는지 확인
    for (const issue of issues) {
      const relatedStatutes = entities.statutes
        .filter((s) => {
          const issueKeyword = issue.title.replace(/\s+/g, "");
          return s.lawName.includes("민법") && issue.title.includes("계약")
            || s.lawName.includes("형법") && ["사기", "횡령", "배임"].some((k) => issue.title.includes(k));
        })
        .map((s) => `${s.lawName} 제${s.articleNumber}조`);

      if (relatedStatutes.length > 0) {
        issue.legalBasis = [...new Set([...(issue.legalBasis ?? []), ...relatedStatutes])];
        issue.confidence = Math.min(1, issue.confidence + 0.05);
      }
    }
  }
}
