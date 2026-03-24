// 멀티 AI 제공자 클라이언트
// Gemini / OpenAI / Claude REST API 직접 호출 (SDK 없음)
// Obsidian 플러그인은 Electron 위에서 실행되므로 CORS 제한 없음

import { requestUrl } from "obsidian";
import type { LexGraphSettings } from "../settings/LexGraphSettings";

export type AiProvider = "gemini" | "openai" | "claude";

/**
 * AI 호출 — settings에서 제공자와 API 키를 읽어 적절한 API로 라우팅
 */
export async function callAi(
  systemPrompt: string,
  userPrompt: string,
  settings: LexGraphSettings
): Promise<string> {
  const provider = settings.AI_PROVIDER;

  switch (provider) {
    case "gemini":
      return callGemini(systemPrompt, userPrompt, settings.GEMINI_API_KEY);
    case "openai":
      return callOpenAI(systemPrompt, userPrompt, settings.OPENAI_API_KEY);
    case "claude":
      return callClaude(systemPrompt, userPrompt, settings.CLAUDE_API_KEY);
    default:
      throw new Error("AI 제공자가 설정되지 않았습니다. 설정 > AI 제공자를 선택하세요.");
  }
}

/**
 * AI 제공자가 설정되어 있는지 확인
 */
export function isAiConfigured(settings: LexGraphSettings): boolean {
  if (settings.AI_PROVIDER === "none") return false;
  if (settings.AI_PROVIDER === "gemini") return !!settings.GEMINI_API_KEY;
  if (settings.AI_PROVIDER === "openai") return !!settings.OPENAI_API_KEY;
  if (settings.AI_PROVIDER === "claude") return !!settings.CLAUDE_API_KEY;
  return false;
}

// ── Gemini ────────────────────────────────────────────────

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
  };

  const resp = await requestUrl({
    url,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    throw: false,
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`Gemini API 오류 (${resp.status}): ${resp.text}`);
  }

  const data = resp.json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(`Gemini: ${data.error.message}`);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini API에서 빈 응답을 받았습니다.");
  return text;
}

// ── OpenAI ────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다.");

  const resp = await requestUrl({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
    throw: false,
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`OpenAI API 오류 (${resp.status}): ${resp.text}`);
  }

  const data = resp.json as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(`OpenAI: ${data.error.message}`);

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI API에서 빈 응답을 받았습니다.");
  return text;
}

// ── Claude (Anthropic) ────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) throw new Error("Claude API 키가 설정되지 않았습니다.");

  const resp = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    throw: false,
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`Claude API 오류 (${resp.status}): ${resp.text}`);
  }

  const data = resp.json as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(`Claude: ${data.error.message}`);

  const text = data.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Claude API에서 빈 응답을 받았습니다.");
  return text;
}
