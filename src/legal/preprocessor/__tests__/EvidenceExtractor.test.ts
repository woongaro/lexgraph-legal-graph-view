import { describe, expect, it } from "vitest";
import {
  extractEvidence,
  extractFacts,
  type IssueReference,
} from "../EvidenceExtractor";

const issues: IssueReference[] = [
  { id: "issue-1", title: "손해배상 범위 쟁점" },
  { id: "issue-2", title: "계약 효력·이행 쟁점" },
];

describe("extractEvidence", () => {
  it("한국 소송 서증 패턴을 추출한다", () => {
    const text = "원고는 갑 제1호증(계약서) 및 을 제2호증을 제출하였다.";
    const result = extractEvidence(text, issues);

    expect(result.some((item) => item.name.includes("갑제1호증"))).toBe(true);
    expect(result.some((item) => item.name.includes("을제2호증"))).toBe(true);
  });

  it("디지털 증거를 추출한다", () => {
    const text = "카카오톡 메시지 내용과 이메일 기록이 손해배상 쟁점의 핵심 근거다.";
    const result = extractEvidence(text, issues);

    expect(result.some((item) => item.type === "digital")).toBe(true);
    expect(result.some((item) => item.relevance === "high")).toBe(true);
  });
});

describe("extractFacts", () => {
  it("다툼 있는 사실과 관련 증거를 연결한다", () => {
    const text = [
      "원고는 갑 제1호증(계약서)을 제출하였다.",
      "피고는 계약 체결 사실을 부인하고 있어 손해배상 범위가 쟁점이다.",
    ].join(" ");
    const evidence = extractEvidence(text, issues);
    const facts = extractFacts(text, issues, evidence);

    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((item) => item.isDisputed)).toBe(true);
  });
});
