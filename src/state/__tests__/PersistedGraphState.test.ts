import { describe, expect, it } from "vitest";
import {
  clonePersistedDocumentState,
  mergePersistedDocumentState,
  prunePersistedDocuments,
  readPluginData,
} from "../PersistedGraphState";

describe("PersistedGraphState", () => {
  it("구버전 설정 저장 형식을 읽는다", () => {
    const parsed = readPluginData({
      AI_PROVIDER: "openai",
      LEGAL_OPEN_API_OC: "g4c",
    });

    expect(parsed.settings.AI_PROVIDER).toBe("openai");
    expect(parsed.persistedDocuments).toEqual({});
  });

  it("문서 상태를 병합하고 복제한다", () => {
    const merged = mergePersistedDocumentState(undefined, {
      manualEvidence: [{ id: "e1", name: "갑 제1호증", type: "document", relevance: "high", side: "claimant", issues: [] }],
    });
    const cloned = clonePersistedDocumentState(merged);

    expect(cloned?.manualEvidence[0].name).toBe("갑 제1호증");
    expect(cloned).not.toBe(merged);
  });

  it("오래된 문서 상태를 잘라낸다", () => {
    const pruned = prunePersistedDocuments({
      a: { manualEvidence: [], manualFacts: [], updatedAt: 1 },
      b: { manualEvidence: [], manualFacts: [], updatedAt: 3 },
      c: { manualEvidence: [], manualFacts: [], updatedAt: 2 },
    }, 2);

    expect(Object.keys(pruned)).toEqual(["b", "c"]);
  });
});
