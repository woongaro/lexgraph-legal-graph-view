import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceMatrix } from "../EvidenceMatrix";

describe("EvidenceMatrix", () => {
  const baseData = {
    issues: [
      {
        id: "issue-1",
        title: "손해배상 범위",
        description: "쟁점",
        isGap: false,
        confidence: 0.8,
        children: [],
        relatedNodeIds: ["손해배상"],
      },
    ],
    facts: [],
    evidence: [
      {
        id: "ev-1",
        type: "document" as const,
        name: "갑 제1호증",
        relevance: "high" as const,
        side: "claimant" as const,
        issues: ["issue-1"],
      },
    ],
  };

  it("증거 추가 폼으로 입력한 값을 콜백에 전달한다", () => {
    const onAddEvidence = vi.fn();

    render(<EvidenceMatrix data={baseData} onAddEvidence={onAddEvidence} />);

    fireEvent.click(screen.getByRole("button", { name: "+ 증거 추가" }));
    fireEvent.change(screen.getByLabelText("증거명"), {
      target: { value: "을 제2호증 지급명령" },
    });
    fireEvent.click(screen.getByLabelText("손해배상 범위"));
    fireEvent.click(screen.getByRole("button", { name: "증거 저장" }));

    expect(onAddEvidence).toHaveBeenCalledWith(expect.objectContaining({
      name: "을 제2호증 지급명령",
      issues: ["issue-1"],
      type: "document",
    }));
  });

  it("사실 추가 폼으로 사실과 연결 증거를 저장한다", () => {
    const onAddFact = vi.fn();

    render(<EvidenceMatrix data={baseData} onAddFact={onAddFact} />);

    fireEvent.click(screen.getByRole("button", { name: "+ 사실 추가" }));
    fireEvent.change(screen.getByLabelText("사실 설명"), {
      target: { value: "피고는 기한까지 대금을 지급하지 않았다." },
    });
    fireEvent.click(screen.getByLabelText("손해배상 범위"));
    fireEvent.click(screen.getByLabelText("갑 제1호증"));
    fireEvent.click(screen.getByRole("button", { name: "사실 저장" }));

    expect(onAddFact).toHaveBeenCalledWith(expect.objectContaining({
      description: "피고는 기한까지 대금을 지급하지 않았다.",
      issues: ["issue-1"],
      evidence: ["ev-1"],
      isDisputed: true,
    }));
  });

  it("수동 항목에만 삭제 버튼을 노출하고 콜백을 호출한다", () => {
    const onRemoveEvidence = vi.fn();

    render(
      <EvidenceMatrix
        data={{
          ...baseData,
          evidence: [
            ...baseData.evidence,
            {
              id: "manual-evidence-1",
              type: "document",
              name: "수동 증거",
              relevance: "medium",
              side: "neutral",
              issues: [],
            },
          ],
        }}
        removableEvidenceIds={new Set(["manual-evidence-1"])}
        onRemoveEvidence={onRemoveEvidence}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /증거 \(2\)/ }));
    expect(screen.getAllByRole("button", { name: "삭제" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(onRemoveEvidence).toHaveBeenCalledWith("manual-evidence-1");
  });

  it("수동 증거를 편집하면 수정 콜백을 호출한다", () => {
    const onUpdateEvidence = vi.fn();

    render(
      <EvidenceMatrix
        data={{
          ...baseData,
          evidence: [
            ...baseData.evidence,
            {
              id: "manual-evidence-1",
              type: "document",
              name: "수동 증거",
              description: "초기 설명",
              relevance: "medium",
              side: "neutral",
              issues: ["issue-1"],
            },
          ],
        }}
        editableEvidenceIds={new Set(["manual-evidence-1"])}
        onUpdateEvidence={onUpdateEvidence}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /증거 \(2\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    const input = screen.getByDisplayValue("수동 증거");
    fireEvent.change(input, { target: { value: "수정된 수동 증거" } });
    fireEvent.click(screen.getByRole("button", { name: "증거 수정" }));

    expect(onUpdateEvidence).toHaveBeenCalledWith(
      "manual-evidence-1",
      expect.objectContaining({
        name: "수정된 수동 증거",
        description: "초기 설명",
      })
    );
  });
});
