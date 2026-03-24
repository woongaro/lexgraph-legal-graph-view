import { describe, expect, it } from "vitest";
import { buildLocalGraph } from "../LocalGraphEngine";

describe("buildLocalGraph", () => {
  it("같은 입력에 대해 결정론적인 그래프를 생성한다", () => {
    const text = [
      "원고는 피고의 채무불이행으로 손해배상 청구를 하였다.",
      "채무불이행과 손해배상 책임, 계약 해제가 반복적으로 문제된다.",
      "피고는 채무불이행 사실을 다투지만 손해배상 범위가 쟁점이다.",
    ].join(" ");

    const first = buildLocalGraph(text);
    const second = buildLocalGraph(text);

    expect(first.nodes).toEqual(second.nodes);
    expect(first.edges).toEqual(second.edges);
    expect(first.clusters).toEqual(second.clusters);
  });

  it("사건번호와 조문 패턴을 토큰 후보로 보존한다", () => {
    const text = [
      "2019다12345 사건은 민법 제390조 위반과 관련된다.",
      "2019다12345 사건에서 민법 제390조 및 제390조 책임이 반복 언급된다.",
      "당사자들은 2019다12345 사건과 민법 제390조 적용을 다툰다.",
    ].join(" ");

    const result = buildLocalGraph(text, { maxNodes: 40, minEdgeWeight: 1 });
    const labels = result.nodes.map((node) => node.label);

    expect(labels).toContain("2019다12345");
    expect(labels).toContain("제390조");
  });
});
