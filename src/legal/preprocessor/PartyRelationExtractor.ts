import type { PartyInfo } from "./LegalEntityExtractor";

export interface ExtractedPartyRelation {
  from: string;
  to: string;
  type: "contract" | "tort" | "employment" | "family" | "criminal" | "admin" | "other";
  label: string;
  isDisputed: boolean;
}

const RELATION_PATTERNS: Array<{
  re: RegExp;
  type: ExtractedPartyRelation["type"];
  label: string;
}> = [
  { re: /원고(?:가|는|의)?\s*피고(?:와|에게|에)\s*(?:계약|매매|임대차|위임|도급|용역|약정)/, type: "contract", label: "계약 관계" },
  { re: /피고(?:가|는|의)?\s*원고(?:에게|에)\s*(?:손해|불법행위|가해)/, type: "tort", label: "불법행위 책임" },
  { re: /(?:사용자|회사)(?:와|는)\s*(?:근로자|직원)|고용\s*계약/, type: "employment", label: "고용 관계" },
  { re: /친권|상속|이혼|부양의무/, type: "family", label: "가족 관계" },
  { re: /고소인|피고인|피해자|피의자/, type: "criminal", label: "형사 관계" },
  { re: /처분청|원고\s*대\s*행정청|행정처분/, type: "admin", label: "행정 처분 관계" },
];

export function extractPartyRelations(
  text: string,
  parties: PartyInfo[]
): ExtractedPartyRelation[] {
  if (parties.length < 2 || !text.trim()) return [];

  const claimantIndex = parties.findIndex((party) => isClaimantRole(party.role));
  const respondentIndex = parties.findIndex((party) => isRespondentRole(party.role));

  if (claimantIndex < 0 || respondentIndex < 0) return [];

  const from = `party-${claimantIndex}`;
  const to = `party-${respondentIndex}`;
  const isDisputed = /(다투|다툰|다툼|부인|쟁점|항변|반박)/.test(text);
  const relations: ExtractedPartyRelation[] = [];

  for (const { re, type, label } of RELATION_PATTERNS) {
    if (!re.test(text)) continue;
    relations.push({ from, to, type, label, isDisputed });
  }

  if (relations.length === 0) {
    relations.push({
      from,
      to,
      type: "other",
      label: inferFallbackLabel(text),
      isDisputed,
    });
  }

  return deduplicateRelations(relations);
}

function inferFallbackLabel(text: string): string {
  if (/청구|지급|대금|채무/.test(text)) return "금전 채권 관계";
  if (/소유권|점유|등기/.test(text)) return "권리 귀속 관계";
  return "분쟁 관계";
}

function deduplicateRelations(items: ExtractedPartyRelation[]): ExtractedPartyRelation[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.from}:${item.to}:${item.type}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isClaimantRole(role: string): boolean {
  return ["원고", "항소인", "상고인", "신청인", "청구인", "채권자"].includes(role);
}

function isRespondentRole(role: string): boolean {
  return ["피고", "피항소인", "피상고인", "피신청인", "피청구인", "채무자"].includes(role);
}
