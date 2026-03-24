import { describe, expect, it } from "vitest";
import { extractPartyRelations } from "../PartyRelationExtractor";

describe("extractPartyRelations", () => {
  it("원고-피고 계약 관계를 추출한다", () => {
    const relations = extractPartyRelations(
      "원고는 피고와 매매계약을 체결하고 대금 지급을 청구하였다.",
      [
        { role: "원고", name: "홍길동" },
        { role: "피고", name: "주식회사 가나다", isCompany: true },
      ]
    );

    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe("contract");
    expect(relations[0].label).toContain("계약");
  });

  it("명시 패턴이 없으면 일반 분쟁 관계로 보정한다", () => {
    const relations = extractPartyRelations(
      "원고는 피고에 대하여 대금 지급을 청구하고 피고는 이를 다툰다.",
      [
        { role: "원고", name: "홍길동" },
        { role: "피고", name: "김철수" },
      ]
    );

    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe("other");
    expect(relations[0].isDisputed).toBe(true);
  });
});
