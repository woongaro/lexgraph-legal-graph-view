// LexGraph 설정 탭 UI

import { App, PluginSettingTab, Setting } from "obsidian";
import type LexGraphPlugin from "../main";
import type { LexGraphSettings } from "./LexGraphSettings";

export class LexGraphSettingTab extends PluginSettingTab {
  private plugin: LexGraphPlugin;

  constructor(app: App, plugin: LexGraphPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "LexGraph 설정" });
    containerEl.createEl("p", {
      text: "한국 법률 문서 지식 그래프 분석 플러그인",
      cls: "setting-item-description",
    });

    // ── AI 제공자 설정 ──────────────────────────────────
    containerEl.createEl("h3", { text: "AI 제공자" });
    containerEl.createEl("p", {
      text: "준비서면 아웃라인, 계약 위험 분석 등 AI 분석 기능에 사용됩니다. 쟁점 탐지·반박 논거는 AI 없이 로컬 동작합니다.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("AI 제공자 선택")
      .setDesc("사용할 AI 서비스를 선택하세요.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("none", "사용 안 함")
          .addOption("gemini", "Google Gemini")
          .addOption("openai", "OpenAI (GPT)")
          .addOption("claude", "Anthropic Claude")
          .setValue(this.plugin.settings.AI_PROVIDER)
          .onChange(async (value) => {
            await this.plugin.saveSettings({
              AI_PROVIDER: value as LexGraphSettings["AI_PROVIDER"],
            });
            this.display();
          })
      );

    const provider = this.plugin.settings.AI_PROVIDER;

    if (provider === "gemini" || provider === "none") {
      new Setting(containerEl)
        .setName("Gemini API 키")
        .setDesc("Google AI Studio (aistudio.google.com)에서 발급받으세요. 무료 티어 제공.")
        .addText((text) =>
          text
            .setPlaceholder("AIza...")
            .setValue(this.plugin.settings.GEMINI_API_KEY)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ GEMINI_API_KEY: value.trim() });
            })
        );
    }

    if (provider === "openai" || provider === "none") {
      new Setting(containerEl)
        .setName("OpenAI API 키")
        .setDesc("platform.openai.com에서 발급받으세요. gpt-4o-mini 사용.")
        .addText((text) =>
          text
            .setPlaceholder("sk-...")
            .setValue(this.plugin.settings.OPENAI_API_KEY)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ OPENAI_API_KEY: value.trim() });
            })
        );
    }

    if (provider === "claude" || provider === "none") {
      new Setting(containerEl)
        .setName("Claude API 키")
        .setDesc("console.anthropic.com에서 발급받으세요. claude-3-5-sonnet 사용.")
        .addText((text) =>
          text
            .setPlaceholder("sk-ant-...")
            .setValue(this.plugin.settings.CLAUDE_API_KEY)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ CLAUDE_API_KEY: value.trim() });
            })
        );
    }

    new Setting(containerEl)
      .setName("AI 기반 그래프 생성")
      .setDesc("AI가 법률 개념 관계 그래프를 직접 추출합니다. API 호출 비용이 발생할 수 있습니다.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.AI_GRAPH_ENABLED)
          .onChange(async (value) => {
            await this.plugin.saveSettings({ AI_GRAPH_ENABLED: value });
            this.display();
          })
      );

    if (this.plugin.settings.AI_GRAPH_ENABLED) {
      new Setting(containerEl)
        .setName("AI 그래프 실패 시 로컬 그래프 사용")
        .setDesc("AI 응답이 실패하거나 JSON 파싱이 불가능하면 기존 공출현 그래프로 자동 전환합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.AI_GRAPH_FALLBACK)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ AI_GRAPH_FALLBACK: value });
            })
        );
    }

    // ── 법률 특화 설정 ──────────────────────────────────
    containerEl.createEl("h3", { text: "법률 분석 설정" });

    new Setting(containerEl)
      .setName("법률 모드 활성화")
      .setDesc("한국 법률 문서 특화 분석 기능을 활성화합니다.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.LEGAL_MODE_ENABLED)
          .onChange(async (value) => {
            await this.plugin.saveSettings({ LEGAL_MODE_ENABLED: value });
            this.display();
          })
      );

    if (this.plugin.settings.LEGAL_MODE_ENABLED) {
      new Setting(containerEl)
        .setName("문서 유형")
        .setDesc("분석할 법률 문서 유형. '자동'으로 설정하면 내용을 분석하여 자동 감지합니다.")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("auto", "자동 감지")
            .addOption("judgment", "판결문")
            .addOption("contract", "계약서")
            .addOption("statute", "법령")
            .addOption("brief", "준비서면")
            .addOption("general", "일반 텍스트")
            .setValue(this.plugin.settings.LEGAL_DOCUMENT_TYPE)
            .onChange(async (value) => {
              await this.plugin.saveSettings({
                LEGAL_DOCUMENT_TYPE: value as LexGraphSettings["LEGAL_DOCUMENT_TYPE"],
              });
            })
        );

      new Setting(containerEl)
        .setName("기본 AI 분석 모드")
        .setDesc("기본 AI 분석 유형을 선택하세요.")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("issue_spotting", "쟁점 탐지 (로컬)")
            .addOption("counter_argument", "반박 논거 생성 (로컬)")
            .addOption("brief_outline", "준비서면 아웃라인 (AI)")
            .addOption("risk_analysis", "계약 위험 분석 (AI)")
            .addOption("general", "일반 분석 (AI)")
            .setValue(this.plugin.settings.LEGAL_ANALYSIS_MODE)
            .onChange(async (value) => {
              await this.plugin.saveSettings({
                LEGAL_ANALYSIS_MODE: value as LexGraphSettings["LEGAL_ANALYSIS_MODE"],
              });
            })
        );

      new Setting(containerEl)
        .setName("법률 불용어 제거")
        .setDesc("조사·어미·법률 형식어를 제거하여 핵심 법률 용어만 그래프에 반영합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_STOPWORDS_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_STOPWORDS_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("법률 엔티티 하이라이트")
        .setDesc("사건번호, 법령 조항, 당사자 정보를 자동 추출하여 표시합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_ENTITY_HIGHLIGHT)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_ENTITY_HIGHLIGHT: value });
            })
        );

      new Setting(containerEl)
        .setName("판례 인용 연결")
        .setDesc("판례 번호를 외부 판례 링크와 연결합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_CITATION_LINK)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_CITATION_LINK: value });
            })
        );

      new Setting(containerEl)
        .setName("쟁점 트리 패널")
        .setDesc("쟁점 분석 결과를 트리 구조로 표시합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_ISSUE_PANEL_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_ISSUE_PANEL_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("증거 매트릭스")
        .setDesc("쟁점-사실-증거 연결 매트릭스를 표시합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_EVIDENCE_MATRIX_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_EVIDENCE_MATRIX_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("당사자 관계도")
        .setDesc("당사자 간 법률 관계를 시각화합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_PARTY_GRAPH_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_PARTY_GRAPH_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("국가법령정보 Open API 연동")
        .setDesc("법령 조문과 판례 정보를 국가법령정보 Open API로 조회합니다.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_DB_INTEGRATION === "enabled")
            .onChange(async (value) => {
              await this.plugin.saveSettings({
                LEGAL_DB_INTEGRATION: value ? "enabled" : "disabled",
              });
              this.display();
            })
        );

      if (this.plugin.settings.LEGAL_DB_INTEGRATION === "enabled") {
        new Setting(containerEl)
          .setName("Open API 요청변수 OC")
          .setDesc("필수값. 사용자 이메일의 ID를 입력하세요. 예: g4c@korea.kr 이면 OC는 g4c")
          .addText((text) =>
            text
              .setPlaceholder("g4c")
              .setValue(this.plugin.settings.LEGAL_OPEN_API_OC)
              .onChange(async (value) => {
                await this.plugin.saveSettings({ LEGAL_OPEN_API_OC: value.trim() });
              })
          );
      }
    }

    // ── 그래프 표시 설정 ────────────────────────────────
    containerEl.createEl("h3", { text: "그래프 표시" });

    new Setting(containerEl)
      .setName("색상 테마")
      .setDesc("그래프 색상 테마를 선택하세요.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", "자동 (Obsidian 테마 따름)")
          .addOption("light", "라이트")
          .addOption("dark", "다크")
          .setValue(this.plugin.settings.COLOR_SCHEME)
          .onChange(async (value) => {
            await this.plugin.saveSettings({
              COLOR_SCHEME: value as LexGraphSettings["COLOR_SCHEME"],
            });
          })
      );

    new Setting(containerEl)
      .setName("그래프 업데이트")
      .setDesc("파일 변경 시 그래프 업데이트 방식을 선택하세요.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("automatic", "자동 (파일 변경 시)")
          .addOption("manual", "수동")
          .addOption("into reading", "읽기 모드 전환 시")
          .setValue(this.plugin.settings.RELOADING_GRAPH)
          .onChange(async (value) => {
            await this.plugin.saveSettings({
              RELOADING_GRAPH: value as LexGraphSettings["RELOADING_GRAPH"],
            });
          })
      );

    new Setting(containerEl)
      .setName("그래프 상태 저장")
      .setDesc("문서별 노드 위치, 줌/패닝, 수동 증거/사실 입력을 플러그인 데이터에 저장합니다.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.GRAPH_STATE_PERSISTENCE_ENABLED)
          .onChange(async (value) => {
            await this.plugin.saveSettings({
              GRAPH_STATE_PERSISTENCE_ENABLED: value,
            });
          })
      );
  }
}
