// IssueSpotter 단위 테스트

import { describe, it, expect } from "vitest";
import { spotIssues } from "../IssueSpotter";
import type { TopicCluster, StructuralGap } from "../../../infranodus/types";
import type { ExtractionResult } from "../../preprocessor/LegalEntityExtractor";

const emptyEntities = (): ExtractionResult => ({
  entities: [],
  caseNumbers: [],
  statutes: [],
  parties: [],
  dates: [],
  citations: [],
});

const sampleClusters: TopicCluster[] = [
  { name: "채무불이행", nodes: ["채무", "불이행", "지연", "손해"], centrality: 0.8 },
  { name: "과실상계", nodes: ["과실", "상계", "기여", "책임"], centrality: 0.6 },
];

const sampleGaps: StructuralGap[] = [
  { between: ["인과관계", "손해"], betweennessScore: 0.4 },
  { between: ["고의", "과실"], betweennessScore: 0.2 },
];

describe("spotIssues", () => {
  it("판결문에서 채무불이행 쟁점을 탐지한다", () => {
    const text = "피고는 계약에서 정한 납품기한을 도과하여 채무불이행이 성립한다.";
    const result = spotIssues(text, "judgment", [], [], emptyEntities());

    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    const found = result.issues.find((i) => i.title.includes("채무불이행"));
    expect(found).toBeDefined();
  });

  it("손해배상 청구 패턴을 탐지한다", () => {
    const text = "원고는 피고에게 손해배상 청구를 제기하였고, 불법행위로 인한 손해배상 책임이 있다.";
    const result = spotIssues(text, "judgment", [], [], emptyEntities());

    const damageIssue = result.issues.find((i) => i.title.includes("손해배상"));
    expect(damageIssue).toBeDefined();
    // 2회 이상 등장 → 신뢰도 높아야 함
    expect(damageIssue!.confidence).toBeGreaterThan(0.5);
  });

  it("그래프 클러스터에서 추가 쟁점을 도출한다", () => {
    const text = "계약 당사자 간 분쟁이 발생하였다.";
    const result = spotIssues(text, "judgment", sampleClusters, [], emptyEntities());

    // 클러스터 기반 쟁점이 포함되어야 함
    const clusterIssue = result.issues.find((i) => i.sources.includes("graph_cluster"));
    expect(clusterIssue).toBeDefined();
  });

  it("구조적 공백이 경고로 반환된다", () => {
    const text = "피고의 책임이 인정된다.";
    const result = spotIssues(text, "judgment", [], sampleGaps, emptyEntities());

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain("인과관계");
  });

  it("계약서 문서 유형에서 계약 쟁점을 탐지한다", () => {
    const text = "甲은 계약 해제를 통보하였으며, 乙은 부당이득 반환을 요구하였다.";
    const result = spotIssues(text, "contract", [], [], emptyEntities());

    const contractIssue = result.issues.find((i) => i.title.includes("계약 효력"));
    expect(contractIssue).toBeDefined();
  });

  it("법령 엔티티가 있을 때 신뢰도가 보강된다", () => {
    const text = "민법 제390조의 채무불이행 책임이 인정된다.";
    const entities: ExtractionResult = {
      ...emptyEntities(),
      statutes: [{ lawName: "민법", articleNumber: "390", paragraph: "1", fullRef: "민법 제390조" }],
    };
    const result = spotIssues(text, "judgment", [], [], entities);

    const issue = result.issues.find((i) => i.title.includes("채무불이행"));
    expect(issue).toBeDefined();
  });

  it("분석 품질이 올바르게 평가된다 (high/medium/low)", () => {
    const richText = "채무불이행이 성립하고 손해배상 청구 및 불법행위가 인정되며 소멸시효 문제도 있다.";
    // 3개 이상의 클러스터가 있어야 high 품질
    const threeClusters: TopicCluster[] = [
      ...sampleClusters,
      { name: "불법행위", nodes: ["불법", "행위", "침해"], centrality: 0.5 },
    ];
    const result = spotIssues(richText, "judgment", threeClusters, sampleGaps, emptyEntities());

    expect(["high", "medium", "low"]).toContain(result.analysisQuality);
    expect(result.analysisQuality).toBe("high");
  });

  it("최대 10개 쟁점만 반환한다", () => {
    const text = "채무불이행, 손해배상, 불법행위, 소멸시효, 임대차 보증금 반환, 부당이득 반환, 계약 해제, 사기죄 성립, 횡령죄 성립, 고의 여부, 정당방위 성립, 집행유예 적부";
    const result = spotIssues(text, "brief", sampleClusters, [], emptyEntities());

    expect(result.issues.length).toBeLessThanOrEqual(10);
  });

  it("신뢰도 내림차순으로 정렬된다", () => {
    const text = "손해배상 손해배상 손해배상 채무불이행";
    const result = spotIssues(text, "judgment", [], [], emptyEntities());

    for (let i = 1; i < result.issues.length; i++) {
      expect(result.issues[i - 1].confidence).toBeGreaterThanOrEqual(result.issues[i].confidence);
    }
  });
});
