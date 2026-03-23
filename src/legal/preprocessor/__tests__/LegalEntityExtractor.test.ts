// 법률 엔티티 추출기 단위 테스트

import { describe, it, expect } from "vitest";
import { extractLegalEntities, statutesToKeywords, citationsToKeywords } from "../LegalEntityExtractor";

describe("extractLegalEntities", () => {
  it("사건번호를 정확히 추출한다", () => {
    const text = "사건 2023다12345 및 2022가단11111에 관하여";
    const result = extractLegalEntities(text);

    expect(result.caseNumbers).toContain("2023다12345");
    expect(result.caseNumbers).toContain("2022가단11111");
    expect(result.caseNumbers).toHaveLength(2);
  });

  it("법령 조항을 추출한다", () => {
    const text = "「민법」 제750조 제1항에 따르면 「형법」 제347조가 적용된다.";
    const result = extractLegalEntities(text);

    expect(result.statutes.length).toBeGreaterThanOrEqual(1);
    const civil = result.statutes.find((s) => s.articleNumber === "750");
    expect(civil).toBeDefined();
    expect(civil?.lawName).toBe("민법");
  });

  it("당사자 역할을 추출한다", () => {
    const text = "원고 홍길동은 피고 주식회사 가나다에 대하여 손해배상을 청구하였다.";
    const result = extractLegalEntities(text);

    const roles = result.parties.map((p) => p.role);
    expect(roles).toContain("원고");
    expect(roles).toContain("피고");
  });

  it("날짜를 추출한다", () => {
    const text = "2023. 3. 15. 이 사건 계약이 체결되었다.";
    const result = extractLegalEntities(text);

    expect(result.dates).toHaveLength(1);
    expect(result.dates[0]).toContain("2023");
  });

  it("대법원 판례 인용을 추출한다", () => {
    const text = "대법원 2020. 3. 15. 선고 2019다12345 판결 참조";
    const result = extractLegalEntities(text);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].caseNumber).toBe("2019다12345");
    expect(result.citations[0].court).toBe("대법원");
  });

  it("빈 텍스트에서 빈 결과를 반환한다", () => {
    const result = extractLegalEntities("");
    expect(result.caseNumbers).toHaveLength(0);
    expect(result.entities).toHaveLength(0);
  });
});

describe("statutesToKeywords", () => {
  it("법령 조항을 키워드로 변환한다", () => {
    const statutes = [
      { lawName: "민법", articleNumber: "750", fullRef: "「민법」 제750조" },
    ];
    const keywords = statutesToKeywords(statutes as Parameters<typeof statutesToKeywords>[0]);
    expect(keywords).toContain("민법 제750조");
  });

  it("법령명 미상인 경우 조항만 표시한다", () => {
    const statutes = [
      { lawName: "미상", articleNumber: "1", fullRef: "제1조" },
    ];
    const keywords = statutesToKeywords(statutes as Parameters<typeof statutesToKeywords>[0]);
    expect(keywords[0]).toBe("제1조");
  });
});

describe("citationsToKeywords", () => {
  it("판례 인용을 사건번호 목록으로 변환한다", () => {
    const citations = [
      { caseNumber: "2019다12345", fullCitation: "대법원 2020. 3. 15. 선고 2019다12345 판결" },
    ];
    const keywords = citationsToKeywords(citations as Parameters<typeof citationsToKeywords>[0]);
    expect(keywords).toContain("2019다12345");
  });
});
