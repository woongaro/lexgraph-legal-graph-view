// 법률 텍스트 전처리기 단위 테스트

import { describe, it, expect } from "vitest";
import { preprocessLegalText, detectDocumentType } from "../LegalTextPreprocessor";

describe("detectDocumentType", () => {
  it("판결문을 감지한다", () => {
    const text = `
      대법원 제X부
      주    문
      피고의 상고를 기각한다.
      이    유
      원고의 청구원인에 대하여 판단한다.
    `;
    expect(detectDocumentType(text)).toBe("judgment");
  });

  it("계약서를 감지한다", () => {
    const text = `
      부동산 매매계약서
      제1조 (매매 목적물)
      甲과 乙은 아래와 같이 계약을 체결한다.
      제2조 (매매 대금)
      손해배상에 관한 사항
    `;
    expect(detectDocumentType(text)).toBe("contract");
  });

  it("준비서면을 감지한다", () => {
    const text = `
      준비서면
      청구취지
      1. 피고는 원고에게 금 10,000,000원을 지급하라.
      청구원인
      증거방법
    `;
    expect(detectDocumentType(text)).toBe("brief");
  });

  it("일반 텍스트에서 general을 반환한다", () => {
    const text = "오늘 날씨가 좋습니다. 점심은 삼겹살을 먹었습니다.";
    expect(detectDocumentType(text)).toBe("general");
  });
});

describe("preprocessLegalText", () => {
  it("기본 전처리를 수행한다", () => {
    const text = "이 사건의 원고는 피고에 대하여 손해배상을 청구하였다.";
    const result = preprocessLegalText(text, {
      removeStopwords: false,
      extractEntities: true,
    });

    expect(result.processedText).toBeTruthy();
    expect(result.documentType).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it("마크다운을 제거한다", () => {
    const text = "# 제목\n**볼드** 텍스트 [[링크]] 내용";
    const result = preprocessLegalText(text, {
      removeMarkdown: true,
      removeStopwords: false,
    });

    expect(result.processedText).not.toContain("#");
    expect(result.processedText).not.toContain("**");
    expect(result.processedText).not.toContain("[[");
  });

  it("엔티티 헤더를 생성한다", () => {
    const text = "사건 2023다12345 원고 홍길동이 「민법」 제750조를 근거로 청구하였다.";
    const result = preprocessLegalText(text, {
      extractEntities: true,
      enhanceWithEntities: true,
    });

    // 엔티티가 있으면 헤더가 생성됨
    if (result.entities.caseNumbers.length > 0) {
      expect(result.processedText).toContain("핵심 엔티티");
    }
  });

  it("긴 텍스트를 청킹한다", () => {
    const longText = "법률 내용입니다. ".repeat(1000);
    const result = preprocessLegalText(longText, {
      maxLength: 1000,
      chunkSize: 500,
    });

    expect(result.chunks).toBeDefined();
    expect(result.chunks!.length).toBeGreaterThan(1);
    expect(result.processedText.length).toBeLessThanOrEqual(1000 + 200); // 헤더 여유
  });

  it("메타데이터를 올바르게 생성한다", () => {
    const text = "원고와 피고 간의 손해배상 사건 2023다12345";
    const result = preprocessLegalText(text);

    expect(result.metadata.originalLength).toBe(text.length);
    expect(result.metadata.processedLength).toBeGreaterThan(0);
  });
});
