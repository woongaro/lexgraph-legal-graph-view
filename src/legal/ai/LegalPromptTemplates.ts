// 법률 특화 AI 프롬프트 템플릿
// InfraNodus AI에 전달하는 법률 분석 프롬프트

import type { LegalAnalysisMode, LegalDocumentType } from "../../settings/LexGraphSettings";
import type { TopicCluster, StructuralGap } from "../../infranodus/types";
import type { ExtractionResult } from "../preprocessor/LegalEntityExtractor";

/**
 * 프롬프트 생성 파라미터
 */
export interface PromptParams {
  mode: LegalAnalysisMode;
  documentType: LegalDocumentType;
  topNodes: string[];
  clusters: TopicCluster[];
  gaps: StructuralGap[];
  entities: ExtractionResult;
  additionalContext?: string;
}

/**
 * 완성된 프롬프트
 */
export interface LegalPrompt {
  systemPrompt: string;
  userPrompt: string;
  contextInfo: string;
}

/**
 * 법률 분석 프롬프트 생성
 */
export function buildLegalPrompt(params: PromptParams): LegalPrompt {
  const contextInfo = buildContextInfo(params);

  switch (params.mode) {
    case "issue_spotting":
      return buildIssueSpottingPrompt(params, contextInfo);
    case "counter_argument":
      return buildCounterArgumentPrompt(params, contextInfo);
    case "brief_outline":
      return buildBriefOutlinePrompt(params, contextInfo);
    case "risk_analysis":
      return buildRiskAnalysisPrompt(params, contextInfo);
    default:
      return buildGeneralLegalPrompt(params, contextInfo);
  }
}

/**
 * 컨텍스트 정보 생성 (모든 프롬프트 공통)
 */
function buildContextInfo(params: PromptParams): string {
  const lines: string[] = [];

  // 핵심 노드
  if (params.topNodes.length > 0) {
    lines.push(`핵심 개념: ${params.topNodes.slice(0, 10).join(", ")}`);
  }

  // 클러스터
  if (params.clusters.length > 0) {
    const clusterDesc = params.clusters
      .slice(0, 4)
      .map((c) => `[${c.name}]: ${c.nodes.slice(0, 5).join(", ")}`)
      .join("\n");
    lines.push(`\n주요 논점 클러스터:\n${clusterDesc}`);
  }

  // 구조적 갭
  if (params.gaps.length > 0) {
    const gapDesc = params.gaps
      .slice(0, 3)
      .map((g) => `• ${g.between[0]} ↔ ${g.between[1]}`)
      .join("\n");
    lines.push(`\n논리적 공백 (미연결 영역):\n${gapDesc}`);
  }

  // 법률 엔티티
  const { entities } = params;
  if (entities.caseNumbers.length > 0) {
    lines.push(`\n사건번호: ${entities.caseNumbers.slice(0, 3).join(", ")}`);
  }
  if (entities.parties.length > 0) {
    const partiesStr = entities.parties
      .slice(0, 4)
      .map((p) => (p.name ? `${p.role}(${p.name})` : p.role))
      .join(", ");
    lines.push(`당사자: ${partiesStr}`);
  }
  if (entities.citations.length > 0) {
    lines.push(
      `인용 판례 수: ${entities.citations.length}건`
    );
  }

  return lines.join("\n");
}

/**
 * 쟁점 탐지 프롬프트
 */
function buildIssueSpottingPrompt(
  params: PromptParams,
  contextInfo: string
): LegalPrompt {
  const docTypeKr = getDocumentTypeKorean(params.documentType);

  return {
    systemPrompt: `당신은 법률 문서 분석 전문가입니다.
주어진 법률 지식 그래프 데이터를 분석하여 핵심 법적 쟁점을 식별합니다.
한국 법률 체계(민법, 상법, 형법, 행정법, 헌법)에 정통합니다.
분석은 구체적이고 실용적이어야 합니다.`,

    userPrompt: `다음은 ${docTypeKr} 분석에서 도출된 법률 지식 그래프입니다.

[그래프 데이터]
${contextInfo}

위 그래프를 분석하여 다음을 제시하세요:

1. **핵심 법적 쟁점** (최대 3가지)
   - 각 쟁점의 구체적 내용
   - 관련 법령 및 조항
   - 판단의 핵심 기준

2. **논리적 취약점**
   - 그래프의 구조적 공백이 나타내는 논리 부재 영역
   - 보강이 필요한 주장이나 근거

3. **추가 검토 권고**
   - 현재 분석에서 다루지 않은 관련 법리
   - 검토가 필요한 판례

응답은 실무에서 바로 활용 가능한 수준으로 구체적으로 작성하세요.`,

    contextInfo,
  };
}

/**
 * 반박 논거 생성 프롬프트
 */
function buildCounterArgumentPrompt(
  params: PromptParams,
  contextInfo: string
): LegalPrompt {
  return {
    systemPrompt: `당신은 법률 논리 분석 전문가입니다.
상대방의 주장에서 취약점을 찾고 효과적인 반박 논거를 생성합니다.
논리적 연결의 부재와 증거의 공백을 식별합니다.`,

    userPrompt: `다음 법률 문서의 그래프 구조를 분석하여 반박 전략을 수립하세요.

[현재 문서 구조]
${contextInfo}

다음을 분석하세요:

1. **주요 논거의 취약점**
   - 인과관계 단절 지점
   - 증거 부족 영역
   - 법리 적용의 문제점

2. **구조적 공백 활용**
   - 상대방이 입증하지 못한 부분
   - 연결되지 않은 개념 클러스터의 의미

3. **선제적 방어 전략**
   - 예상되는 공격 포인트
   - 미리 보강해야 할 논거

각 항목에 대해 구체적인 법적 근거와 함께 제시하세요.`,

    contextInfo,
  };
}

/**
 * 준비서면 아웃라인 생성 프롬프트
 */
function buildBriefOutlinePrompt(
  params: PromptParams,
  contextInfo: string
): LegalPrompt {
  return {
    systemPrompt: `당신은 법률 문서 작성 전문가입니다.
분석된 쟁점 구조를 바탕으로 체계적인 준비서면 아웃라인을 생성합니다.
한국 법원 실무에 맞는 형식을 따릅니다.`,

    userPrompt: `다음 법률 분석 데이터를 바탕으로 준비서면 아웃라인을 작성하세요.

[분석 데이터]
${contextInfo}

다음 형식으로 준비서면 아웃라인을 작성하세요:

**청구취지**
(이 문서에서 추구하는 결론)

**청구원인**
I. 사실관계
   1. [첫 번째 핵심 사실]
   2. [두 번째 핵심 사실]

II. 법률적 주장
   1. [첫 번째 쟁점] — [관련 법령]
      가. 주장
      나. 근거
   2. [두 번째 쟁점] — [관련 법령]

**예상 항변에 대한 반박**
I. 예상 항변 1
   반박:

**결론**

각 항목에 그래프에서 확인된 핵심 개념과 법령을 연결하여 구체적으로 작성하세요.`,

    contextInfo,
  };
}

/**
 * 계약 위험 분석 프롬프트
 */
function buildRiskAnalysisPrompt(
  params: PromptParams,
  contextInfo: string
): LegalPrompt {
  return {
    systemPrompt: `당신은 계약 법률 리스크 분석 전문가입니다.
계약서의 조항 구조를 분석하여 잠재적 법적 위험을 식별합니다.
한국 법원 판례와 계약법 이론에 기반한 분석을 제공합니다.`,

    userPrompt: `다음 계약서 분석 데이터에서 법적 위험 요소를 식별하세요.

[계약서 분석 데이터]
${contextInfo}

다음 관점에서 분석하세요:

1. **고위험 조항** (즉각적 주의 필요)
   - 일방에게 불리한 조항
   - 법적 효력 논란 가능 조항
   - 관련 판례

2. **누락된 필수 조항**
   - 계약 유형에 필수적이나 없는 조항
   - 향후 분쟁 소지 영역

3. **모호한 표현**
   - 해석 분쟁 가능성이 있는 용어
   - 명확화 권고 사항

4. **전체 위험도 평가**
   - 상/중/하 단계 평가
   - 협상 우선순위 제안

실제 법원 판례를 근거로 분석하세요.`,

    contextInfo,
  };
}

/**
 * 일반 법률 분석 프롬프트
 */
function buildGeneralLegalPrompt(
  params: PromptParams,
  contextInfo: string
): LegalPrompt {
  return {
    systemPrompt: `당신은 법률 문서 분석 전문가입니다.`,

    userPrompt: `다음 법률 문서를 분석하여 핵심 내용과 법적 시사점을 제시하세요.

[분석 데이터]
${contextInfo}

1. 핵심 법적 내용 요약
2. 주요 법령 및 법리
3. 실무적 시사점`,

    contextInfo,
  };
}

/**
 * 문서 유형 한국어 명칭
 */
function getDocumentTypeKorean(type: LegalDocumentType): string {
  const names: Record<LegalDocumentType, string> = {
    auto: "법률 문서",
    judgment: "판결문",
    contract: "계약서",
    statute: "법령",
    brief: "준비서면",
    general: "법률 문서",
  };
  return names[type];
}
