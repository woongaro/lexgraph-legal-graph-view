import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestUrl } from "obsidian";
import { SupremeCourtClient } from "../SupremeCourtClient";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn(),
}));

describe("SupremeCourtClient", () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it("판례 검색 URL은 사건번호를 포함한다", () => {
    expect(SupremeCourtClient.getCaseUrl("2019다12345")).toContain("2019");
  });

  it("caseNumber 기반 목록 조회 요청을 만든다", async () => {
    const calls: string[] = [];
    vi.mocked(requestUrl).mockImplementation(async ({ url }) => {
      calls.push(String(url));
      return {
        status: 200,
        text: "",
        json: {
          PrecSearch: {
            prec: [
              {
                판례일련번호: "228541",
                사건명: "손해배상",
                사건번호: "2019다12345",
                선고일자: "20200101",
                법원명: "대법원",
                사건종류명: "민사",
                판례상세링크: "https://example.com/case",
              },
            ],
          },
        },
      } as Awaited<ReturnType<typeof requestUrl>>;
    });

    const client = new SupremeCourtClient("g4c");
    const result = await client.getCaseSummary("2019다12345");

    expect(calls[0]).toContain("OC=g4c");
    expect(calls[0]).toContain("target=prec");
    expect(calls[0]).toContain("nb=2019%EB%8B%A412345");
    expect(result?.caseId).toBe("228541");
  });
});
