import { describe, expect, it } from "vitest";
import { findLegalHighlightMatches } from "../LegalHighlightPatterns";

describe("findLegalHighlightMatches", () => {
  it("사건번호와 법령 조문, 당사자를 추출한다", () => {
    const matches = findLegalHighlightMatches(
      "원고는 대법원 2019다12345 판결과 민법 제390조를 근거로 주장하였다."
    );

    const classes = matches.map((match) => match.className);
    expect(classes).toContain("lexgraph-entity-party");
    expect(classes).toContain("lexgraph-entity-case-number");
    expect(classes).toContain("lexgraph-entity-statute");
    expect(classes).toContain("lexgraph-entity-court");
  });
});
