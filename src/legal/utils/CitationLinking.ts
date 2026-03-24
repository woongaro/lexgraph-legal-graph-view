import { SupremeCourtClient } from "../api/SupremeCourtClient";

const CASE_NUMBER_PATTERN = /\b\d{4}[가-힣]{1,6}\d+\b/g;
const previewCache = new Map<string, Promise<string>>();

interface CitationLinkOptions {
  oc?: string;
  enablePreview?: boolean;
}

export async function linkifyCaseCitations(
  root: HTMLElement,
  options: CitationLinkOptions = {}
): Promise<number> {
  const textNodes = collectEligibleTextNodes(root);
  let replacements = 0;

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    if (!CASE_NUMBER_PATTERN.test(text)) continue;
    CASE_NUMBER_PATTERN.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CASE_NUMBER_PATTERN.exec(text)) !== null) {
      const caseNumber = match[0];
      const start = match.index;
      const end = start + caseNumber.length;

      if (start > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, start)));
      }

      const anchor = document.createElement("a");
      anchor.href = SupremeCourtClient.getCaseUrl(caseNumber);
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.className = "external-link lexgraph-case-link";
      anchor.textContent = caseNumber;
      anchor.title = `대법원 종합법률정보에서 ${caseNumber} 검색`;
      if (options.enablePreview && options.oc?.trim()) {
        attachCasePreview(anchor, caseNumber, options.oc.trim());
      }
      fragment.append(anchor);
      lastIndex = end;
      replacements += 1;
    }

    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
    CASE_NUMBER_PATTERN.lastIndex = 0;
  }

  return replacements;
}

function attachCasePreview(anchor: HTMLAnchorElement, caseNumber: string, oc: string): void {
  let loaded = false;

  anchor.addEventListener("mouseenter", () => {
    if (loaded) return;
    loaded = true;

    void getCasePreview(caseNumber, oc)
      .then((preview) => {
        if (preview) {
          anchor.title = preview;
        }
      })
      .catch(() => {
        loaded = false;
      });
  });
}

function getCasePreview(caseNumber: string, oc: string): Promise<string> {
  const cacheKey = `${oc}:${caseNumber}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const client = new SupremeCourtClient(oc);
    const summary = await client.getCaseSummary(caseNumber);
    if (!summary) return `판례번호: ${caseNumber}`;

    const lines = [
      `${summary.title} (${summary.caseNumber})`,
      `${summary.court} ${summary.decisionDate}`.trim(),
    ];
    if (summary.abstractText) {
      lines.push(summary.abstractText.slice(0, 180));
    } else if (summary.summaryText) {
      lines.push(summary.summaryText.slice(0, 180));
    }
    return lines.filter(Boolean).join("\n");
  })();

  previewCache.set(cacheKey, promise);
  return promise;
}

function collectEligibleTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (["A", "CODE", "PRE", "SCRIPT", "STYLE"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
}
