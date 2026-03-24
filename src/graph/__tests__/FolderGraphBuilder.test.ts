import { describe, expect, it } from "vitest";
import { buildFolderGraph } from "../FolderGraphBuilder";

describe("buildFolderGraph", () => {
  it("문서 노드와 위키링크 엣지를 추가한다", () => {
    const graph = buildFolderGraph([
      {
        id: "a.md",
        title: "A",
        content: "채무불이행 책임과 손해배상 청구가 문제된다. [[B]]",
        links: ["B"],
      },
      {
        id: "b.md",
        title: "B",
        content: "민법 제390조와 손해배상 범위를 검토한다.",
        links: [],
      },
    ]);

    expect(graph.nodes.some((node) => node.id === "doc:a.md")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "doc:b.md")).toBe(true);
    expect(graph.edges.some((edge) => edge.label === "위키링크")).toBe(true);
  });

  it("문서 클러스터를 추가한다", () => {
    const graph = buildFolderGraph([
      {
        id: "a.md",
        title: "문서A",
        content: "손해배상청구와 채무불이행책임을 다툰다.",
        links: [],
      },
    ]);

    expect(graph.clusters.some((cluster) => cluster.name === "문서")).toBe(true);
  });

  it("공통 키워드를 공유하는 문서 사이에 약한 연결을 추가한다", () => {
    const graph = buildFolderGraph([
      {
        id: "a.md",
        title: "문서A",
        content: "손해배상청구와 손해배상 범위를 검토한다. 채무불이행 책임도 본다.",
        links: [],
      },
      {
        id: "b.md",
        title: "문서B",
        content: "손해배상 책임과 손해배상 산정 기준이 쟁점이다. 민법 제390조도 언급한다.",
        links: [],
      },
    ]);

    expect(
      graph.edges.some(
        (edge) =>
          edge.label === "공통개념" &&
          [edge.source, edge.target].includes("doc:a.md") &&
          [edge.source, edge.target].includes("doc:b.md")
      )
    ).toBe(true);
  });
});
