export const LEGAL_COMPOUND_SPLITS: Record<string, string[]> = {
  손해배상청구: ["손해배상", "청구"],
  손해배상책임: ["손해배상", "책임"],
  채무불이행책임: ["채무불이행", "책임"],
  채무불이행으로: ["채무불이행"],
  임대차보증금: ["임대차", "보증금"],
  부당이득반환: ["부당이득", "반환"],
  소유권이전등기: ["소유권", "이전", "등기"],
  계약해제권: ["계약", "해제"],
  계약해지권: ["계약", "해지"],
  약정손해배상금: ["약정", "손해배상금"],
  위약금조항: ["위약금", "조항"],
  면책조항: ["면책", "조항"],
  자동갱신조항: ["자동갱신", "조항"],
  기한이익상실: ["기한이익", "상실"],
  점유취득시효: ["점유", "취득시효"],
  불법행위책임: ["불법행위", "책임"],
  근저당권설정: ["근저당권", "설정"],
  사용수익권: ["사용", "수익권"],
  양도담보계약: ["양도담보", "계약"],
  대여금반환청구: ["대여금", "반환", "청구"],
  추심금청구: ["추심금", "청구"],
  손실보상금: ["손실보상", "금"],
  부당해고구제: ["부당해고", "구제"],
  취업규칙불이익변경: ["취업규칙", "불이익변경"],
  소멸시효완성: ["소멸시효", "완성"],
  원상회복의무: ["원상회복", "의무"],
  연대보증채무: ["연대보증", "채무"],
  매매대금지급: ["매매대금", "지급"],
  공사대금청구: ["공사대금", "청구"],
  임금지급청구: ["임금", "지급", "청구"],
};

export function splitLegalCompound(word: string): string[] {
  const direct = LEGAL_COMPOUND_SPLITS[word];
  if (direct) return direct;

  const results: string[] = [];
  for (const [compound, split] of Object.entries(LEGAL_COMPOUND_SPLITS)) {
    if (!word.includes(compound) || word === compound) continue;
    const replaced = word.replace(compound, ` ${split.join(" ")} `);
    for (const token of replaced.split(/\s+/).filter(Boolean)) {
      results.push(...(LEGAL_COMPOUND_SPLITS[token] ?? [token]));
    }
    if (results.length > 0) {
      return [...new Set(results)];
    }
  }

  return [];
}
