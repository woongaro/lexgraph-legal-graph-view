// InfraNodus API 클라이언트
// 기존 main.js의 InfraNodus.* 메서드를 TypeScript로 재작성

import type {
  GraphAndStatementsResponse,
  AdviceParams,
  AdviceResponse,
  ExportTextParams,
  ExportTextResponse,
  TopicCluster,
  StructuralGap,
  AiTopic,
  PromptContext,
  GraphData,
} from "./types";

interface GetGraphParams {
  text: string;
  name?: string;
  apiKey: string;
  apiUrl: string;
  doNotSave?: boolean;
  addStats?: boolean;
  includeStatements?: boolean;
  compactGraph?: boolean;
  aiTopics?: boolean;
}

interface GetUserIdParams {
  apiKey: string;
  apiUrl: string;
}

/**
 * InfraNodus API와 통신하는 클라이언트 클래스
 */
export class InfraNodusClient {
  private static async request<T>(
    url: string,
    options: RequestInit
  ): Promise<T> {
    const response = await fetch(url, options);

    if (response.status === 401) {
      throw new ApiError("Invalid API key", 401);
    }
    if (response.status === 429) {
      throw new ApiError("API quota exceeded", 429);
    }
    if (!response.ok) {
      throw new ApiError(`API error: ${response.status}`, response.status);
    }

    return response.json() as Promise<T>;
  }

  /**
   * 텍스트를 InfraNodus 그래프로 변환
   */
  static async getGraphAndStatements(
    params: GetGraphParams
  ): Promise<GraphAndStatementsResponse> {
    const queryParams = new URLSearchParams({
      doNotSave: String(params.doNotSave ?? true),
      addStats: String(params.addStats ?? true),
      includeStatements: String(params.includeStatements ?? false),
      compactGraph: String(params.compactGraph ?? true),
    });

    const body = {
      name: params.name ?? "obsidian_analysis",
      text: params.text,
      ...(params.aiTopics ? { aiTopics: true } : {}),
    };

    return this.request<GraphAndStatementsResponse>(
      `${params.apiUrl}/api/v1/graphAndStatements?${queryParams}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * 사용자 ID 조회 (API 키 유효성 확인)
   */
  static async getUserId(params: GetUserIdParams): Promise<string | null> {
    try {
      const data = await this.request<{ uid?: string; name?: string }>(
        `${params.apiUrl}/api/v1/user`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${params.apiKey}`,
          },
        }
      );
      return data.uid ?? data.name ?? null;
    } catch {
      return null;
    }
  }

  /**
   * AI 조언 생성
   */
  static async generateAdvice(params: AdviceParams): Promise<AdviceResponse> {
    return this.request<AdviceResponse>(
      `${params.apiUrl}/api/v1/ai/advice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          prompt: params.prompt,
          promptContext: params.promptContext,
          model: params.modelToUse,
          mode: params.mode,
        }),
      }
    );
  }

  /**
   * 텍스트를 InfraNodus 그래프로 내보내기
   */
  static async exportText(params: ExportTextParams): Promise<ExportTextResponse> {
    try {
      await this.request<unknown>(
        `${params.apiUrl}/api/v1/import`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.apiKey}`,
          },
          body: JSON.stringify({
            name: params.contextName,
            text: params.text,
          }),
        }
      );
      return { success: true, graphName: params.contextName };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * 그래프 데이터에서 핵심 정보 추출
   */
  static extractDataFromGraphData(data: GraphAndStatementsResponse): {
    topics: TopicCluster[];
    gaps: StructuralGap[];
    topNodes: string[];
    aiTopics: AiTopic[];
  } {
    const topics = data.topics ?? [];
    const gaps = data.gaps ?? [];
    const aiTopics = data.aiTopics ?? [];

    // 중심성 기준 상위 노드 추출
    const topNodes = (data.graph?.nodes ?? [])
      .sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0))
      .slice(0, 10)
      .map((n) => n.label);

    return { topics, gaps, topNodes, aiTopics };
  }

  /**
   * AI 토픽 이름 생성
   */
  static async generateAiNamesForTopics(params: {
    topicsData: TopicCluster[];
    graphData: GraphData;
    apiKey: string;
    apiUrl: string;
    model: string;
  }): Promise<AiTopic[]> {
    const topicNames = params.topicsData.map((t) =>
      t.nodes.slice(0, 5).join(", ")
    );

    const prompt = `다음 개념 클러스터들에 대해 간결한 주제명을 생성하세요: ${topicNames.join("; ")}`;

    try {
      const response = await this.generateAdvice({
        prompt,
        modelToUse: params.model,
        apiKey: params.apiKey,
        apiUrl: params.apiUrl,
      });

      // 응답 파싱 (간단한 구현)
      return params.topicsData.map((topic, i) => ({
        name: `Topic ${i + 1}`,
        relatedNodes: topic.nodes,
      }));
    } catch {
      return params.topicsData.map((topic, i) => ({
        name: topic.name ?? `Topic ${i + 1}`,
        relatedNodes: topic.nodes,
      }));
    }
  }

  /**
   * AI 프롬프트 컨텍스트 생성
   */
  static generatePromptForAdvice(params: {
    topics: TopicCluster[];
    gaps: StructuralGap[];
    topNodes: string[];
    mode?: string;
  }): PromptContext {
    const topicsText = params.topics
      .slice(0, 5)
      .map((t) => `[${t.name}]: ${t.nodes.slice(0, 5).join(", ")}`)
      .join("\n");

    const gapsText = params.gaps
      .slice(0, 3)
      .map((g) => `${g.between[0]} ↔ ${g.between[1]}`)
      .join(", ");

    const promptContext = `
주요 개념: ${params.topNodes.slice(0, 10).join(", ")}
토픽 클러스터:
${topicsText}
구조적 갭: ${gapsText || "없음"}
    `.trim();

    const prompt =
      params.mode === "legal"
        ? "이 법률 문서의 핵심 쟁점을 분석하고, 논리적 취약점과 보완이 필요한 부분을 식별하세요."
        : "이 텍스트의 핵심 주제와 아이디어 갭을 분석하고, 발전시킬 방향을 제안하세요.";

    return { prompt, promptContext };
  }
}

/**
 * API 에러 클래스
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}
