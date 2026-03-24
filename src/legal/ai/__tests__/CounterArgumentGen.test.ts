// CounterArgumentGen 단위·통합 테스트

import { describe, it, expect } from "vitest";
import { generateCounterArguments, formatCounterAnalysis } from "../CounterArgumentGen";
import { spotIssues } from "../IssueSpotter";
import type { TopicCluster, StructuralGap } from "../../../graph/types";
import type { ExtractionResult } from "../../preprocessor/LegalEntityExtractor";
import type { DetectedIssue } from "../IssueSpotter";

const emptyEntities = (): ExtractionResult => ({
  entities: [],
  caseNumbers: [],
  statutes: [],
  parties: [],
  dates: [],
  citations: [],
});

const mockIssues: DetectedIssue[] = [
  {
    id: "kw-0",
    title: "채무불이행 성립",
    description: "채무불이행 관련 표현이 발견됨",
    confidence: 0.8,
    sources: ["keyword_pattern"],
    legalBasis: ["민법 제390조"],
  },
  {
    id: "kw-1",
    title: "손해배상 책임",
    description: "손해배상 청구 관련 표현",
    confidence: 0.4,  // 낮은 신뢰도 → 반박 대상
    sources: ["keyword_pattern"],
    legalBasis: ["민법 제750조"],
  },
];

const mockGaps: StructuralGap[] = [
  { between: ["인과관계", "손해"], betweennessScore: 0.5 },
  { between: ["고의", "과실"], betweennessScore: 0.25 },
];

const mockClusters: TopicCluster[] = [
  { name: "계약", nodes: ["계약", "의무", "이행"], centrality: 0.7 },
];

describe("generateCounterArguments", () => {
  it("구조적 공백에서 반박 논거를 생성한다", () => {
    const result = generateCounterArguments([], mockClusters, mockGaps, emptyEntities());

    expect(result.arguments.length).toBeGreaterThan(0);
    // 인과관계 gap → 인과관계 취약점 패턴 매칭
    const causalArg = result.arguments.find((a) => a.targetIssue.includes("인과관계"));
    expect(causalArg).toBeDefined();
    expect(causalArg!.weakness).toContain("인과관계");
  });

  it("낮은 신뢰도 쟁점에서 반박 논거를 생성한다", () => {
    const result = generateCounterArguments(mockIssues, mockClusters, mockGaps, emptyEntities());

    // confidence < 0.6인 쟁점 → 반박 대상
    const weakArg = result.arguments.find((a) => a.id.startsWith("weak-"));
    expect(weakArg).toBeDefined();
    expect(weakArg!.targetIssue).toBe("손해배상 책임");
  });

  it("높은 betweennessScore gap은 high 위험도로 분류된다", () => {
    const result = generateCounterArguments([], mockClusters, mockGaps, emptyEntities());

    const highGap = result.arguments.find(
      (a) => a.id === "gap-0" && a.risk === "high"
    );
    expect(highGap).toBeDefined();  // betweennessScore 0.5 > 0.3 → high
  });

  it("전체 위험도가 올바르게 계산된다", () => {
    const result = generateCounterArguments(mockIssues, mockClusters, mockGaps, emptyEntities());

    expect(["high", "medium", "low"]).toContain(result.overallRisk);
  });

  it("판례가 있을 때 선제 대응 방안에 포함된다", () => {
    const entities: ExtractionResult = {
      ...emptyEntities(),
      citations: [
        { raw: "대법원 2020. 1. 22. 선고 2019다12345 판결", year: "2020", typeCode: "다", number: "12345", courtLevel: "supreme" },
      ],
      statutes: [],
    };

    const result = generateCounterArguments(mockIssues, mockClusters, mockGaps, entities);
    const hasCitationAction = result.preemptiveActions.some((a) => a.includes("판례"));
    expect(hasCitationAction).toBe(true);
  });

  it("날짜 엔티티가 있을 때 시효 경고가 포함된다", () => {
    const entities: ExtractionResult = {
      ...emptyEntities(),
      dates: ["2021. 3. 1."],
    };

    const result = generateCounterArguments([], mockClusters, mockGaps, entities);
    const hasDateWarning = result.preemptiveActions.some((a) => a.includes("시효"));
    expect(hasDateWarning).toBe(true);
  });

  it("최대 8개 반박 논거만 반환한다", () => {
    const manyGaps: StructuralGap[] = Array.from({ length: 15 }, (_, i) => ({
      between: [`개념${i}`, `손해`],
      betweennessScore: 0.1,
    }));

    const result = generateCounterArguments([], mockClusters, manyGaps, emptyEntities());
    expect(result.arguments.length).toBeLessThanOrEqual(8);
  });

  it("우선순위 오름차순으로 정렬된다", () => {
    const result = generateCounterArguments(mockIssues, mockClusters, mockGaps, emptyEntities());

    for (let i = 1; i < result.arguments.length; i++) {
      expect(result.arguments[i - 1].priority).toBeLessThanOrEqual(result.arguments[i].priority);
    }
  });
});

describe("formatCounterAnalysis", () => {
  it("마크다운 형식으로 출력된다", () => {
    const result = generateCounterArguments(mockIssues, mockClusters, mockGaps, emptyEntities());
    const formatted = formatCounterAnalysis(result);

    expect(formatted).toContain("## 반박 위험도");
    expect(formatted).toContain("### 예상 반박 논거");
  });

  it("위험도 이모지가 포함된다", () => {
    const result = generateCounterArguments(mockIssues, mockClusters, mockGaps, emptyEntities());
    const formatted = formatCounterAnalysis(result);

    // 고/중/저 위험도 중 하나의 이모지가 있어야 함
    const hasEmoji = formatted.includes("🔴") || formatted.includes("🟡") || formatted.includes("🟢");
    expect(hasEmoji).toBe(true);
  });
});

describe("IssueSpotter → CounterArgumentGen 통합 파이프라인", () => {
  it("판결문 텍스트에서 파이프라인 전체가 동작한다", () => {
    const judgmentText = `
      원고는 피고와 소프트웨어 개발 용역 계약을 체결하였다.
      피고는 납품기한을 도과하여 채무불이행이 성립한다.
      원고는 손해배상 청구를 제기하였으나, 인과관계 입증이 불충분하다.
      민법 제390조, 제393조, 제396조가 적용된다.
    `;

    const entities: ExtractionResult = {
      ...emptyEntities(),
      statutes: [
        { lawName: "민법", articleNumber: "390", paragraph: "1", fullRef: "민법 제390조" },
        { lawName: "민법", articleNumber: "393", paragraph: "1", fullRef: "민법 제393조" },
        { lawName: "민법", articleNumber: "396", paragraph: "1", fullRef: "민법 제396조" },
      ],
      dates: ["2021. 3. 1."],
    };

    // Stage 1: 쟁점 탐지
    const issueResult = spotIssues(judgmentText, "judgment", mockClusters, mockGaps, entities);
    expect(issueResult.issues.length).toBeGreaterThan(0);

    // Stage 2: 반박 논거 생성
    const counterResult = generateCounterArguments(
      issueResult.issues,
      mockClusters,
      mockGaps,
      entities
    );
    expect(counterResult.arguments.length).toBeGreaterThan(0);
    expect(counterResult.preemptiveActions.length).toBeGreaterThan(0);

    // Stage 3: 포맷
    const formatted = formatCounterAnalysis(counterResult);
    expect(formatted.length).toBeGreaterThan(100);
    expect(formatted).toContain("반박 위험도");
  });

  it("계약서 텍스트에서 계약 의무 취약점을 gap 기반으로 탐지한다", () => {
    const contractText = `
      甲은 乙에게 용역 대금으로 30,000,000원을 지급한다.
      乙이 계약에서 정한 의무를 이행하지 않는 경우 계약 해제할 수 있다.
      손해배상은 실제 발생한 손해를 한도로 한다.
    `;

    // 계약-의무 gap 추가 → VULNERABILITY_PATTERNS의 "계약" 키워드 패턴 매칭
    const contractGaps: StructuralGap[] = [
      { between: ["계약", "의무"], betweennessScore: 0.3 },
    ];

    const issueResult = spotIssues(contractText, "contract", [], contractGaps, emptyEntities());
    const counterResult = generateCounterArguments(
      issueResult.issues,
      [],
      contractGaps,
      emptyEntities()
    );

    // "계약"/"의무" gap → 계약 의무 취약점 패턴 매칭
    const contractArg = counterResult.arguments.find(
      (a) => a.weakness.includes("계약") || a.targetIssue.includes("계약")
    );
    expect(contractArg).toBeDefined();
  });
});
