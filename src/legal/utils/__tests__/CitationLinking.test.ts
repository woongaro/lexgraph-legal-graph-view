import { describe, expect, it } from "vitest";
import { linkifyCaseCitations } from "../CitationLinking";

describe("linkifyCaseCitations", () => {
  it("텍스트 내 사건번호를 외부 링크로 변환한다", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>대법원 2019다12345 및 2020두54321 참조</p>";

    const count = await linkifyCaseCitations(root);
    const anchors = root.querySelectorAll("a.lexgraph-case-link");

    expect(count).toBe(2);
    expect(anchors).toHaveLength(2);
    expect(anchors[0].getAttribute("href")).toContain("2019%EB%8B%A412345");
  });

  it("기존 링크와 코드 블록은 건드리지 않는다", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p><a href="https://example.com">2019다12345</a></p>
      <code>2020두54321</code>
      <p>2021나11111</p>
    `;

    const count = await linkifyCaseCitations(root);

    expect(count).toBe(1);
    expect(root.querySelectorAll("a.lexgraph-case-link")).toHaveLength(1);
    expect(root.querySelector("code")?.textContent).toBe("2020두54321");
  });
});
