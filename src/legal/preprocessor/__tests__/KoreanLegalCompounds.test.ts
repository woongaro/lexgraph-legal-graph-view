import { describe, expect, it } from "vitest";
import { splitLegalCompound } from "../KoreanLegalCompounds";

describe("splitLegalCompound", () => {
  it("등록된 법률 복합어를 분리한다", () => {
    expect(splitLegalCompound("채무불이행책임")).toEqual(["채무불이행", "책임"]);
  });

  it("복합어가 포함된 단어도 부분 분리한다", () => {
    const parts = splitLegalCompound("대여금반환청구권");
    expect(parts).toContain("대여금");
    expect(parts).toContain("반환");
    expect(parts).toContain("청구");
  });
});
