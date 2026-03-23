// 법률 텍스트 전처리기
// InfraNodus API에 전달하기 전에 법률 문서 텍스트를 정제

import { getLegalStopwords } from "./KoreanLegalStopwords";
import {
  extractLegalEntities,
  statutesToKeywords,
  citationsToKeywords,
  type ExtractionResult,
} from "./LegalEntityExtractor";
import type { LegalDocumentType } from "../../settings/LexGraphSettings";

/**
 * 전처리 옵션
 */
export interface PreprocessOptions {
  documentType?: LegalDocumentType;
  removeStopwords?: boolean;
  stopwordsMode?: "strict" | "standard" | "aggressive";
  extractEntities?: boolean;
  enhanceWithEntities?: boolean;   // 추출된 엔티티를 텍스트에 보강
  removeMarkdown?: boolean;
  removeNumbers?: boolean;         // 단독 숫자 제거
  maxLength?: number;              // 최대 텍스트 길이 (API 제한)
  chunkSize?: number;              // 청킹 크기 (0 = 청킹 안 함)
}

/**
 * 전처리 결과
 */
export interface PreprocessResult {
  processedText: string;
  chunks?: string[];               // maxLength 초과 시 청킹
  documentType: LegalDocumentType;
  entities: ExtractionResult;
  metadata: DocumentMetadata;
}

/**
 * 문서 메타데이터
 */
export interface DocumentMetadata {
  originalLength: number;
  processedLength: number;
  caseNumbers: string[];
  parties: string[];
  courts: string[];
  mainStatutes: string[];
  citationCount: number;
  detectedType: LegalDocumentType;
}

const DEFAULT_OPTIONS: Required<PreprocessOptions> = {
  documentType: "auto",
  removeStopwords: true,
  stopwordsMode: "standard",
  extractEntities: true,
  enhanceWithEntities: true,
  removeMarkdown: true,
  removeNumbers: false,
  maxLength: 10000,
  chunkSize: 5000,
};

/**
 * 법률 문서 유형 자동 감지
 */
export function detectDocumentType(text: string): LegalDocumentType {
  const judgmentScore = countPatterns(text, [
    /주\s*문/,
    /이\s*유/,
    /(?:원고|피고)의\s*(?:청구|주장)/,
    /선고/,
    /판결/,
    /대법원|고등법원|지방법원/,
  ]);

  const contractScore = countPatterns(text, [
    /제\s*\d+\s*조/,
    /(?:갑|을|병)\s*(?:과|는|이)/,
    /계약(?:서|을|의)/,
    /(?:甲|乙)/,
    /(?:체결|이행|이행기|이행지체)/,
    /손해배상/,
  ]);

  const statuteScore = countPatterns(text, [
    /법률\s*제/,
    /조항/,
    /시행(?:령|규칙)/,
    /공포/,
    /개정/,
    /부\s*칙/,
  ]);

  const briefScore = countPatterns(text, [
    /청구취지/,
    /청구원인/,
    /증거방법/,
    /준비서면/,
    /항변/,
    /사실(?:관계|확인)/,
  ]);

  const scores: [LegalDocumentType, number][] = [
    ["judgment", judgmentScore],
    ["contract", contractScore],
    ["statute", statuteScore],
    ["brief", briefScore],
  ];

  scores.sort((a, b) => b[1] - a[1]);

  if (scores[0][1] === 0) return "general";
  if (scores[0][1] < 2) return "general";
  return scores[0][0];
}

/**
 * 패턴 매칭 개수 계산
 */
function countPatterns(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

/**
 * 메인 전처리 함수
 */
export function preprocessLegalText(
  rawText: string,
  options: PreprocessOptions = {}
): PreprocessResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const originalLength = rawText.length;

  // 1. 문서 유형 감지
  const documentType =
    opts.documentType !== "auto"
      ? opts.documentType
      : detectDocumentType(rawText);

  // 2. 엔티티 추출 (전처리 전 원본에서)
  const entities = opts.extractEntities
    ? extractLegalEntities(rawText)
    : {
        entities: [],
        caseNumbers: [],
        statutes: [],
        parties: [],
        dates: [],
        citations: [],
      };

  // 3. 텍스트 정제
  let text = rawText;

  // 마크다운 제거
  if (opts.removeMarkdown) {
    text = removeMarkdown(text);
  }

  // 문서 유형별 특수 처리
  text = applyDocumentTypeProcessing(text, documentType);

  // 불용어 제거
  if (opts.removeStopwords) {
    text = removeKoreanStopwords(text, opts.stopwordsMode);
  }

  // 불필요한 공백/특수문자 정리
  text = cleanWhitespace(text);

  // 4. 엔티티 보강 (중요 엔티티를 텍스트 앞에 추가)
  if (opts.enhanceWithEntities && opts.extractEntities) {
    const entityHeader = buildEntityHeader(entities, documentType);
    if (entityHeader) {
      text = entityHeader + "\n\n" + text;
    }
  }

  // 5. 길이 제한 및 청킹
  const chunks =
    text.length > opts.maxLength
      ? chunkText(text, opts.chunkSize || opts.maxLength)
      : undefined;

  const processedText = chunks ? chunks[0] : text;

  // 6. 메타데이터 구성
  const metadata: DocumentMetadata = {
    originalLength,
    processedLength: processedText.length,
    caseNumbers: entities.caseNumbers,
    parties: entities.parties.map((p) =>
      p.name ? `${p.role}(${p.name})` : p.role
    ),
    courts: [
      ...new Set(
        entities.entities
          .filter((e) => e.type === "court")
          .map((e) => e.value)
      ),
    ],
    mainStatutes: statutesToKeywords(entities.statutes.slice(0, 5)),
    citationCount: entities.citations.length,
    detectedType: documentType,
  };

  return {
    processedText,
    chunks,
    documentType,
    entities,
    metadata,
  };
}

/**
 * 마크다운 문법 제거 (Obsidian 노트에서)
 */
function removeMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")          // 헤더
    .replace(/\*\*(.*?)\*\*/g, "$1")       // 볼드
    .replace(/\*(.*?)\*/g, "$1")           // 이탤릭
    .replace(/`{1,3}[^`]*`{1,3}/g, "")    // 코드
    .replace(/\[\[([^\]]+)\]\]/g, "$1")   // 위키링크
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 마크다운 링크
    .replace(/^[-*+]\s+/gm, "")           // 목록
    .replace(/^\d+\.\s+/gm, "")           // 번호 목록
    .replace(/^>\s+/gm, "")               // 인용
    .replace(/---+/g, "")                  // 구분선
    .replace(/===(.*?)===/g, "$1")         // 하이라이트
    .replace(/~~(.*?)~~/g, "$1");          // 취소선
}

/**
 * 문서 유형별 특수 처리
 */
function applyDocumentTypeProcessing(
  text: string,
  docType: LegalDocumentType
): string {
  switch (docType) {
    case "judgment":
      return preprocessJudgment(text);
    case "contract":
      return preprocessContract(text);
    case "statute":
      return preprocessStatute(text);
    case "brief":
      return preprocessBrief(text);
    default:
      return text;
  }
}

/**
 * 판결문 전처리
 * - "주문" 이전의 헤더 정보는 메타데이터로만 사용
 * - "이유" 섹션을 핵심으로 추출
 */
function preprocessJudgment(text: string): string {
  // "이유" 섹션 이후를 핵심 분석 대상으로
  const reasonStart = text.search(/이\s*유/);
  if (reasonStart > 0) {
    const header = text.slice(0, reasonStart);
    const body = text.slice(reasonStart);
    // 헤더에서 당사자 정보만 유지
    const headerCompact = header.replace(/\s+/g, " ").slice(0, 300);
    return headerCompact + "\n" + body;
  }
  return text;
}

/**
 * 계약서 전처리
 * - 조항 구조를 보존하면서 형식 문자 정리
 */
function preprocessContract(text: string): string {
  // 조항 번호 앞에 줄바꿈 추가 (그래프 분석 단위 명확화)
  return text.replace(/(제\s*\d+\s*조)/g, "\n$1");
}

/**
 * 법령 전처리
 */
function preprocessStatute(text: string): string {
  // 부칙 이후 내용은 제거 (부칙은 본문 분석에 불필요)
  const appendixStart = text.search(/부\s*칙/);
  if (appendixStart > 0) {
    return text.slice(0, appendixStart);
  }
  return text;
}

/**
 * 준비서면 전처리
 */
function preprocessBrief(text: string): string {
  // 표지/형식 헤더 제거
  return text
    .replace(/준\s*비\s*서\s*면/g, "")
    .replace(/사\s*건\s*번\s*호[^\n]*/g, "")
    .replace(/재\s*판\s*부[^\n]*/g, "");
}

/**
 * 한국어 불용어 제거
 * 단어 경계 처리: 조사가 붙은 형태도 처리
 */
function removeKoreanStopwords(
  text: string,
  mode: "strict" | "standard" | "aggressive"
): string {
  const stopwords = getLegalStopwords(mode);

  // 단어 단위로 분리 (공백/줄바꿈 기준)
  return text
    .split(/(\s+)/)
    .map((token) => {
      // 공백 토큰은 그대로
      if (/^\s+$/.test(token)) return token;

      // 조사 제거: 단어 끝의 조사 패턴
      const stripped = stripPostposition(token);

      // 불용어 체크
      if (stopwords.has(stripped) || stopwords.has(token)) {
        return "";
      }

      return token;
    })
    .join("");
}

/**
 * 조사 제거 (간단한 규칙 기반)
 * 정확한 형태소 분석 없이 일반적인 조사 패턴 처리
 */
function stripPostposition(word: string): string {
  return word
    .replace(/(이|가|을|를|의|에서?|으로|로|과|와|도|은|는)$/, "")
    .replace(/(에게서?|한테서?|께서?)$/, "");
}

/**
 * 공백 및 특수문자 정리
 */
function cleanWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")         // 연속 공백 → 단일 공백
    .replace(/\n{3,}/g, "\n\n")      // 3개 이상 줄바꿈 → 2개
    .replace(/[^\S\n]+$/gm, "")      // 행 끝 공백 제거
    .trim();
}

/**
 * 엔티티 헤더 생성 (중요 엔티티를 텍스트 앞에 추가)
 * InfraNodus가 이를 그래프의 핵심 노드로 인식하도록
 */
function buildEntityHeader(
  entities: ExtractionResult,
  docType: LegalDocumentType
): string {
  const parts: string[] = [];

  if (entities.caseNumbers.length > 0) {
    parts.push(`사건번호: ${entities.caseNumbers.join(", ")}`);
  }

  if (entities.parties.length > 0) {
    const partyStr = entities.parties
      .slice(0, 4)
      .map((p) => (p.name ? `${p.role} ${p.name}` : p.role))
      .join(", ");
    parts.push(`당사자: ${partyStr}`);
  }

  const mainStatutes = statutesToKeywords(entities.statutes.slice(0, 5));
  if (mainStatutes.length > 0) {
    parts.push(`주요 법령: ${mainStatutes.join(", ")}`);
  }

  const citations = citationsToKeywords(entities.citations.slice(0, 3));
  if (citations.length > 0) {
    parts.push(`인용 판례: ${citations.join(", ")}`);
  }

  return parts.length > 0 ? `[핵심 엔티티]\n${parts.join("\n")}` : "";
}

/**
 * 텍스트를 지정된 크기로 청킹
 * 문장 경계를 존중하여 분리
 */
function chunkText(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      // 문장 경계 찾기 (마침표, 줄바꿈)
      const boundary = text.lastIndexOf(".", end);
      const newline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(boundary, newline);

      if (breakPoint > start + chunkSize * 0.7) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks.filter((c) => c.length > 0);
}
