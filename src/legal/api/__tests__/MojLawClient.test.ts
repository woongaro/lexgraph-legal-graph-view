import { describe, expect, it } from "vitest";
import { MojLawClient } from "../MojLawClient";

describe("MojLawClient", () => {
  it("법령 검색 요청에 OC를 포함한다", async () => {
    const calls: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return {
        ok: true,
        json: async () => ({
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
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const client = new MojLawClient("g4c");
      const result = await client.searchByName("민법");
      expect(calls[0]).toContain("OC=g4c");
      expect(calls[0]).toContain("target=law");
      expect(result[0].lawName).toBe("민법");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
