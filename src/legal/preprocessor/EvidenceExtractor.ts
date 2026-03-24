export interface IssueReference {
  id: string;
  title: string;
  relatedNodeIds?: string[];
}

export interface ExtractedEvidence {
  id: string;
  type: "document" | "witness" | "expert" | "circumstantial" | "digital" | "other";
  name: string;
  description?: string;
  relevance: "high" | "medium" | "low";
  side: "claimant" | "respondent" | "neutral";
  issues: string[];
  notes?: string;
}

export interface ExtractedFact {
  id: string;
  description: string;
  isDisputed: boolean;
  evidence: string[];
  issues: string[];
}

const EVIDENCE_PATTERNS: Array<{
  pattern: RegExp;
  type: ExtractedEvidence["type"];
  side: ExtractedEvidence["side"];
}> = [
  { pattern: /갑\s*제\s*(\d+)\s*호증(?:\s*의\s*(\d+))?(?:\s*\(([^)]+)\))?/g, type: "document", side: "claimant" },
  { pattern: /을\s*제\s*(\d+)\s*호증(?:\s*의\s*(\d+))?(?:\s*\(([^)]+)\))?/g, type: "document", side: "respondent" },
  { pattern: /병\s*제\s*(\d+)\s*호증(?:\s*의\s*(\d+))?(?:\s*\(([^)]+)\))?/g, type: "document", side: "neutral" },
  { pattern: /증인\s+([가-힣]{2,5})/g, type: "witness", side: "neutral" },
  { pattern: /감정인\s+([가-힣]{2,10})/g, type: "expert", side: "neutral" },
  { pattern: /(?:문자|카카오톡|이메일|녹취록?|통화내역|메신저)\s*(?:메시지|내용|기록|대화)?/g, type: "digital", side: "neutral" },
  { pattern: /(?:계약서|합의서|내용증명|세금계산서|입금내역|거래명세서)/g, type: "document", side: "neutral" },
];

const DISPUTED_FACT_PATTERN = /(다투|부인|쟁점|허위|사실과\s+다르|인정할\s+수\s+없)/;
const UNDISPUTED_FACT_PATTERN = /(다툼이\s*없|인정\s*사실|자백|명백하|확인된\s*사실)/;
const FACT_SENTENCE_PATTERN = /(원고는|피고는|당사자는|법원은|계약은|위 문서는|위 증거는|갑\s*제|을\s*제)/;

export function extractEvidence(text: string, issues: IssueReference[]): ExtractedEvidence[] {
  if (!text.trim()) return [];

  const results: ExtractedEvidence[] = [];

  for (const { pattern, type, side } of EVIDENCE_PATTERNS) {
    const matcher = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(text)) !== null) {
      const context = extractContext(text, match.index, 180);
      const name = normalizeEvidenceName(match[0]);
      const relatedIssues = findRelatedIssues(context, issues);

      results.push({
        id: `evidence-${results.length + 1}`,
        name,
        type,
        side,
        relevance: estimateRelevance(context, relatedIssues.length),
        issues: relatedIssues,
        description: match[3]?.trim() || summarizeContext(context, match[0]),
        notes: context,
      });
    }
  }

  return deduplicateEvidence(results).slice(0, 30);
}

export function extractFacts(
  text: string,
  issues: IssueReference[],
  evidence: ExtractedEvidence[] = []
): ExtractedFact[] {
  if (!text.trim()) return [];

  const sentences = splitSentences(text);
  const results: ExtractedFact[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 12) continue;
    if (!FACT_SENTENCE_PATTERN.test(trimmed) && !DISPUTED_FACT_PATTERN.test(trimmed) && !UNDISPUTED_FACT_PATTERN.test(trimmed)) {
      continue;
    }

    const issueIds = findRelatedIssues(trimmed, issues);
    const relatedEvidence = evidence
      .filter((item) => trimmed.includes(item.name) || overlapScore(trimmed, item.notes ?? item.description ?? item.name) >= 2)
      .map((item) => item.id)
      .slice(0, 4);

    results.push({
      id: `fact-${results.length + 1}`,
      description: trimmed,
      isDisputed: DISPUTED_FACT_PATTERN.test(trimmed) && !UNDISPUTED_FACT_PATTERN.test(trimmed),
      evidence: relatedEvidence,
      issues: issueIds,
    });
  }

  return deduplicateFacts(results).slice(0, 20);
}

function findRelatedIssues(context: string, issues: IssueReference[]): string[] {
  const normalizedContext = normalizeText(context);
  return issues
    .filter((issue) => {
      const keywords = issue.title
        .split(/[\s·,()/]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
      return keywords.some((keyword) => normalizedContext.includes(normalizeText(keyword)));
    })
    .map((issue) => issue.id)
    .slice(0, 4);
}

function estimateRelevance(context: string, relatedIssueCount: number): ExtractedEvidence["relevance"] {
  const weight =
    (/(입증|증명|근거|직접|핵심|중요)/.test(context) ? 2 : 0) +
    (/(다투|쟁점|손해|계약|책임|위반)/.test(context) ? 1 : 0) +
    Math.min(2, relatedIssueCount);

  if (weight >= 3) return "high";
  if (weight >= 1) return "medium";
  return "low";
}

function summarizeContext(context: string, keyword: string): string {
  const compact = context.replace(/\s+/g, " ").trim();
  if (!compact) return keyword;
  const index = compact.indexOf(keyword);
  if (index < 0) return compact.slice(0, 80);
  return compact.slice(Math.max(0, index - 20), Math.min(compact.length, index + keyword.length + 40)).trim();
}

function deduplicateEvidence(items: ExtractedEvidence[]): ExtractedEvidence[] {
  const seen = new Map<string, ExtractedEvidence>();

  for (const item of items) {
    const key = normalizeText(item.name);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }

    existing.issues = [...new Set([...existing.issues, ...item.issues])];
    if (existing.relevance === "low" && item.relevance !== "low") {
      existing.relevance = item.relevance;
    }
    if (!existing.description && item.description) {
      existing.description = item.description;
    }
  }

  return [...seen.values()];
}

function deduplicateFacts(items: ExtractedFact[]): ExtractedFact[] {
  const seen = new Map<string, ExtractedFact>();

  for (const item of items) {
    const key = normalizeText(item.description);
    if (!seen.has(key)) {
      seen.set(key, item);
      continue;
    }

    const existing = seen.get(key)!;
    existing.issues = [...new Set([...existing.issues, ...item.issues])];
    existing.evidence = [...new Set([...existing.evidence, ...item.evidence])];
    existing.isDisputed = existing.isDisputed || item.isDisputed;
  }

  return [...seen.values()];
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?다])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractContext(text: string, index: number, radius: number): string {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius)).replace(/\s+/g, " ").trim();
}

function normalizeEvidenceName(name: string): string {
  return name.replace(/\s+/g, "").trim();
}

function normalizeText(value: string): string {
  return value.replace(/[\s"'`.,()[\]{}<>]/g, "").toLowerCase();
}

function overlapScore(a: string, b: string): number {
  const tokensA = tokenizeForOverlap(a);
  const tokensB = new Set(tokenizeForOverlap(b));
  return tokensA.filter((token) => tokensB.has(token)).length;
}

function tokenizeForOverlap(value: string): string[] {
  return value
    .split(/[\s,.;:()[\]{}]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}
