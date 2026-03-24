import type { GraphLayoutState } from "../graph/types";
import type { Evidence, FactItem } from "../legal/graph/EvidenceMatrix";
import type { LexGraphSettings } from "../settings/LexGraphSettings";

export interface PersistedDocumentState {
  graphLayoutState?: GraphLayoutState;
  manualEvidence: Evidence[];
  manualFacts: FactItem[];
  updatedAt: number;
}

export interface PersistedDocumentStateInput {
  graphLayoutState?: GraphLayoutState;
  manualEvidence?: Evidence[];
  manualFacts?: FactItem[];
}

export interface LexGraphPluginData {
  settings: Partial<LexGraphSettings>;
  persistedDocuments: Record<string, PersistedDocumentState>;
}

const MAX_PERSISTED_DOCUMENTS = 80;

export function readPluginData(raw: unknown): LexGraphPluginData {
  if (!isRecord(raw)) {
    return { settings: {}, persistedDocuments: {} };
  }

  if ("settings" in raw || "persistedDocuments" in raw) {
    return {
      settings: isRecord(raw.settings) ? raw.settings as Partial<LexGraphSettings> : {},
      persistedDocuments: normalizePersistedDocuments(raw.persistedDocuments),
    };
  }

  return {
    settings: raw as Partial<LexGraphSettings>,
    persistedDocuments: {},
  };
}

export function mergePersistedDocumentState(
  current: PersistedDocumentState | undefined,
  next: PersistedDocumentStateInput
): PersistedDocumentState {
  return {
    graphLayoutState: next.graphLayoutState ?? current?.graphLayoutState,
    manualEvidence: cloneArray(next.manualEvidence ?? current?.manualEvidence ?? []),
    manualFacts: cloneArray(next.manualFacts ?? current?.manualFacts ?? []),
    updatedAt: Date.now(),
  };
}

export function clonePersistedDocumentState(
  state: PersistedDocumentState | undefined
): PersistedDocumentState | undefined {
  if (!state) return undefined;

  return {
    graphLayoutState: state.graphLayoutState
      ? {
          graphKey: state.graphLayoutState.graphKey,
          positions: cloneRecord(state.graphLayoutState.positions),
          viewport: { ...state.graphLayoutState.viewport },
          canvasSize: { ...state.graphLayoutState.canvasSize },
        }
      : undefined,
    manualEvidence: cloneArray(state.manualEvidence),
    manualFacts: cloneArray(state.manualFacts),
    updatedAt: state.updatedAt,
  };
}

export function prunePersistedDocuments(
  states: Record<string, PersistedDocumentState>,
  limit = MAX_PERSISTED_DOCUMENTS
): Record<string, PersistedDocumentState> {
  const entries = Object.entries(states);
  if (entries.length <= limit) return states;

  return Object.fromEntries(
    entries
      .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
      .slice(0, limit)
  );
}

function normalizePersistedDocuments(raw: unknown): Record<string, PersistedDocumentState> {
  if (!isRecord(raw)) return {};

  const normalized: Record<string, PersistedDocumentState> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    normalized[key] = {
      graphLayoutState: isRecord(value.graphLayoutState)
        ? value.graphLayoutState as GraphLayoutState
        : undefined,
      manualEvidence: Array.isArray(value.manualEvidence) ? cloneArray(value.manualEvidence) : [],
      manualFacts: Array.isArray(value.manualFacts) ? cloneArray(value.manualFacts) : [],
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    };
  }

  return normalized;
}

function cloneArray<T>(value: T[]): T[] {
  return value.map((item) => {
    if (isRecord(item)) {
      return { ...item } as T;
    }
    return item;
  });
}

function cloneRecord<T>(value: Record<string, T>): Record<string, T> {
  const cloned: Record<string, T> = {};
  for (const [key, item] of Object.entries(value)) {
    cloned[key] = isRecord(item) ? { ...item } as T : item;
  }
  return cloned;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
