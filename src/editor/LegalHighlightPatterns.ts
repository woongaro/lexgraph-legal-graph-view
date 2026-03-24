export interface LegalHighlightMatch {
  from: number;
  to: number;
  className: string;
}

const PATTERNS: Array<{ regex: RegExp; className: string }> = [
  {
    regex: /\d{4}[가-힣]{1,6}\d+/g,
    className: "lexgraph-entity-case-number",
  },
  {
    regex: /(?:[「『][^」』]+[」』]\s*)?(?:[가-힣A-Za-z·ㆍ]+(?:법|규칙|시행령|시행규칙)\s*)?제\s*\d+\s*조(?:의\s*\d+)?(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?/g,
    className: "lexgraph-entity-statute",
  },
  {
    regex: /(원고|피고|항소인|피항소인|상고인|피상고인|신청인|피신청인|청구인|피청구인|채권자|채무자|임대인|임차인|매도인|매수인|피고인|피의자)/g,
    className: "lexgraph-entity-party",
  },
  {
    regex: /(대법원|헌법재판소|[가-힣]+고등법원|[가-힣]+지방법원(?:\s+[가-힣]+지원)?|[가-힣]+행정법원|[가-힣]+가정법원)/g,
    className: "lexgraph-entity-court",
  },
];

export function findLegalHighlightMatches(text: string, offset = 0): LegalHighlightMatch[] {
  const matches: LegalHighlightMatch[] = [];

  for (const { regex, className } of PATTERNS) {
    const matcher = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(text)) !== null) {
      matches.push({
        from: offset + match.index,
        to: offset + match.index + match[0].length,
        className,
      });
    }
  }

  return deduplicateMatches(matches);
}

function deduplicateMatches(matches: LegalHighlightMatch[]): LegalHighlightMatch[] {
  const sorted = [...matches].sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (a.to !== b.to) return b.to - a.to;
    return a.className.localeCompare(b.className);
  });

  const result: LegalHighlightMatch[] = [];
  const occupied: Array<{ from: number; to: number }> = [];

  for (const match of sorted) {
    const overlaps = occupied.some((range) => match.from < range.to && match.to > range.from);
    if (overlaps) continue;
    occupied.push({ from: match.from, to: match.to });
    result.push(match);
  }

  return result;
}
