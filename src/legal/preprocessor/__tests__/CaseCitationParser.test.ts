// 판례 인용 파서 단위 테스트

import { describe, it, expect } from "vitest";
import {
  parseCaseNumber,
  parseFullCitation,
  extractAllCitations,
  groupCitationsByCase,
} from "../CaseCitationParser";

describe("parseCaseNumber", () => {
  it("민사 대법원 사건번호를 파싱한다", () => {
    const result = parseCaseNumber("2023다12345");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.caseTypeCode).toBe("다");
    expect(result!.caseNumber).toBe(12345);
    expect(result!.courtLevel).toBe("supreme");
    expect(result!.isValid).toBe(true);
  });

  it("형사 지방법원 사건번호를 파싱한다", () => {
    const result = parseCaseNumber("2022고단5678");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2022);
    expect(result!.courtLevel).toBe("district");
  });

  it("헌법재판소 사건번호를 파싱한다", () => {
    const result = parseCaseNumber("2021헌바123");
    expect(result).not.toBeNull();
    expect(result!.courtLevel).toBe("constitutional");
    expect(result!.caseTypeName).toBe("위헌법률심판");
  });

  it("유효하지 않은 형식은 null을 반환한다", () => {
    expect(parseCaseNumber("invalid")).toBeNull();
    expect(parseCaseNumber("")).toBeNull();
    expect(parseCaseNumber("1800다123")).toBeNull(); // 연도 범위 초과
  });

  it("대법원 URL을 생성한다", () => {
    const result = parseCaseNumber("2023다12345");
    expect(result!.url).toContain("glaw.scourt.go.kr");
    expect(result!.url).toContain(encodeURIComponent("2023다12345"));
  });
});

describe("parseFullCitation", () => {
  it("완전한 판례 인용을 파싱한다", () => {
    const text = "대법원 2020. 3. 15. 선고 2019다12345 판결 참조";
    const results = parseFullCitation(text);

    expect(results).toHaveLength(1);
    expect(results[0].court).toBe("대법원");
    expect(results[0].decisionDate).toBe("2020.3.15");
    expect(results[0].caseNumber).toBe(12345);
    expect(results[0].decisionType).toBe("판결");
  });

  it("여러 판례 인용을 파싱한다", () => {
    const text = `
      대법원 2020. 3. 15. 선고 2019다12345 판결,
      대법원 2021. 5. 20. 선고 2020도99999 판결 참조.
    `;
    const results = parseFullCitation(text);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe("extractAllCitations", () => {
  it("완전한 인용과 단독 번호를 모두 추출한다", () => {
    const text = `
      대법원 2020. 3. 15. 선고 2019다12345 판결 및
      2022가단11111 사건에서도 동일한 법리를 적용하였다.
    `;
    const result = extractAllCitations(text);

    expect(result.full).toHaveLength(1);
    expect(result.standalone).toHaveLength(1);
    expect(result.all).toHaveLength(2);
  });
});

describe("groupCitationsByCase", () => {
  it("같은 번호로 심급별 그룹화한다", () => {
    const citations = [
      parseCaseNumber("2020고단1234"),  // 1심
      parseCaseNumber("2021노1234"),     // 항소심
    ].filter(Boolean) as ReturnType<typeof parseCaseNumber>[];

    const groups = groupCitationsByCase(citations as Parameters<typeof groupCitationsByCase>[0]);
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});
