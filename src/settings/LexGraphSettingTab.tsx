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

    new Setting(containerEl).setName("LexGraph").setHeading();
    containerEl.createEl("p", {
      text: "Korean legal document knowledge graph analysis plugin",
      cls: "setting-item-description",
    });

    // ── AI 제공자 설정 ──────────────────────────────────
    new Setting(containerEl).setName("AI provider").setHeading();
    containerEl.createEl("p", {
      text: "Used for brief outline generation, contract risk analysis, and other AI-powered features. Issue spotting and counter-argument generation work without AI.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("AI provider")
      .setDesc("Select the AI service to use.")
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
        .setName("Gemini API key")
        .setDesc("Obtain from Google AI Studio (aistudio.google.com). A free tier is available.")
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
        .setName("OpenAI API key")
        .setDesc("Obtain from platform.openai.com. Uses gpt-4o-mini.")
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
        .setName("Claude API key")
        .setDesc("Obtain from console.anthropic.com. Uses claude-3-5-sonnet.")
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
      .setName("AI graph generation")
      .setDesc("AI extracts legal concept relationship graphs directly. API usage costs may apply.")
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
        .setName("Fallback to local graph on AI failure")
        .setDesc("If the AI response fails or JSON parsing is not possible, automatically switches to the co-occurrence graph.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.AI_GRAPH_FALLBACK)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ AI_GRAPH_FALLBACK: value });
            })
        );
    }

    // ── 법률 특화 설정 ──────────────────────────────────
    new Setting(containerEl).setName("Legal analysis").setHeading();

    new Setting(containerEl)
      .setName("Legal mode")
      .setDesc("Enable Korean legal document specialized analysis features.")
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
        .setName("Document type")
        .setDesc("Type of legal document to analyze. Set to 'Auto' to detect automatically from content.")
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
        .setName("Default AI analysis mode")
        .setDesc("Select the default AI analysis type.")
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
        .setName("Remove legal stopwords")
        .setDesc("Remove Korean legal particles and formal terms to include only core legal terms in the graph.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_STOPWORDS_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_STOPWORDS_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("Legal entity highlight")
        .setDesc("Automatically extract and display case numbers, statute references, and party information.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_ENTITY_HIGHLIGHT)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_ENTITY_HIGHLIGHT: value });
            })
        );

      new Setting(containerEl)
        .setName("Citation linking")
        .setDesc("Link case citation numbers to external case references.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_CITATION_LINK)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_CITATION_LINK: value });
            })
        );

      new Setting(containerEl)
        .setName("Issue tree panel")
        .setDesc("Display issue analysis results as a tree structure.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_ISSUE_PANEL_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_ISSUE_PANEL_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("Evidence matrix")
        .setDesc("Display an issue-fact-evidence connection matrix.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_EVIDENCE_MATRIX_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_EVIDENCE_MATRIX_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("Party relationship graph")
        .setDesc("Visualize legal relationships between parties.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.LEGAL_PARTY_GRAPH_ENABLED)
            .onChange(async (value) => {
              await this.plugin.saveSettings({ LEGAL_PARTY_GRAPH_ENABLED: value });
            })
        );

      new Setting(containerEl)
        .setName("National legal information Open API integration")
        .setDesc("Retrieve statute text and case information via the National Law Information Center Open API.")
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
          .setName("Open API OC parameter")
          .setDesc("Required. Enter the ID part of your email. E.g., if your email is g4c@korea.kr, enter g4c.")
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
    new Setting(containerEl).setName("Graph display").setHeading();

    new Setting(containerEl)
      .setName("Color theme")
      .setDesc("Select the graph color theme.")
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
      .setName("Graph update")
      .setDesc("Select how the graph updates when files change.")
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
      .setName("Save graph state")
      .setDesc("Save per-document node positions, zoom/pan, and manually entered evidence/facts to plugin data.")
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
