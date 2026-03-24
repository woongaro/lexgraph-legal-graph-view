import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestUrl } from "obsidian";
import { MojLawClient } from "../MojLawClient";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn(),
}));

describe("MojLawClient", () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it("법령 검색 요청에 OC를 포함한다", async () => {
    const calls: string[] = [];
    vi.mocked(requestUrl).mockImplementation(async ({ url }) => {
      calls.push(String(url));
      return {
        status: 200,
        text: "",
        json: {
          LawSearch: {
            law: [
              {
                법령ID: "001",
                법령명한글: "민법",
                법령구분명: "법률",
                공포일자: "19580222",
                시행일자: "19580222",
                소관부처명: "법무부",
                조문수: "1118",
              },
            ],
          },
        },
      } as Awaited<ReturnType<typeof requestUrl>>;
    });

    const client = new MojLawClient("g4c");
    const result = await client.searchByName("민법");

    expect(calls[0]).toContain("OC=g4c");
    expect(calls[0]).toContain("target=law");
    expect(result[0].lawName).toBe("민법");
  });
});
