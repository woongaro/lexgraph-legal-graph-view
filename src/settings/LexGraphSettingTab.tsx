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
      text: "한국 법률 특화 InfraNodus Advanced Graph View 플러그인",
      cls: "setting-item-description",
    });

    // ── InfraNodus API 설정 ──────────────────────────────
    containerEl.createEl("h3", { text: "InfraNodus API" });

    new Setting(containerEl)
      .setName("InfraNodus API 키")
      .setDesc("InfraNodus > 구독 페이지에서 API 키를 발급받으세요.")
      .addText((text) =>
        text
          .setPlaceholder("API 키 입력")
          .setValue(this.plugin.settings.INFRANODUS_API_KEY)
          .onChange(async (value) => {
            await this.plugin.saveSettings({ INFRANODUS_API_KEY: value });
          })
      );

    new Setting(containerEl)
      .setName("AI 모델")
      .setDesc("분석에 사용할 AI 모델을 선택하세요.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("gpt-4o-mini", "GPT-4o Mini (빠름/경제적)")
          .addOption("gpt-4o", "GPT-4o (최고 품질)")
          .addOption("gpt-4", "GPT-4")
          .addOption("gpt-3.5-turbo", "GPT-3.5 Turbo (저렴)")
          .setValue(this.plugin.settings.AI_MODEL)
          .onChange(async (value) => {
            await this.plugin.saveSettings({
              AI_MODEL: value as LexGraphSettings["AI_MODEL"],
            });
          })
      );

    // ── 법률 특화 설정 ──────────────────────────────────
    containerEl.createEl("h3", { text: "⚖️ 법률 분석 설정" });

    new Setting(containerEl)
      .setName("법률 모드 활성화")
      .setDesc("한국 법률 문서 특화 분석 기능을 활성화합니다.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.LEGAL_MODE_ENABLED)
          .onChange(async (value) => {
            await this.plugin.saveSettings({ LEGAL_MODE_ENABLED: value });
            this.display(); // 설정 새로고침
          })
      );

    if (this.plugin.settings.LEGAL_MODE_ENABLED) {
      new Setting(containerEl)
        .setName("문서 유형")
        .setDesc("분석할 법률 문서 유형을 선택하세요. '자동'으로 설정하면 내용을 분석하여 자동 감지합니다.")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("auto", "🔍 자동 감지")
            .addOption("judgment", "📄 판결문")
            .addOption("contract", "📝 계약서")
            .addOption("statute", "⚖️ 법령")
            .addOption("brief", "📋 준비서면")
            .addOption("general", "📃 일반 텍스트")
            .setValue(this.plugin.settings.LEGAL_DOCUMENT_TYPE)
            .onChange(async (value) => {
              await this.plugin.saveSettings({
                LEGAL_DOCUMENT_TYPE: value as LexGraphSettings["LEGAL_DOCUMENT_TYPE"],
              });
            })
        );

      new Setting(containerEl)
        .setName("AI 분석 모드")
        .setDesc("기본 AI 분석 유형을 선택하세요.")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("issue_spotting", "🎯 쟁점 탐지")
            .addOption("counter_argument", "⚔️ 반박 논거 생성")
            .addOption("brief_outline", "📋 준비서면 아웃라인")
            .addOption("risk_analysis", "⚠️ 계약 위험 분석")
            .addOption("general", "💬 일반 분석")
            .setValue(this.plugin.settings.LEGAL_ANALYSIS_MODE)
            .onChange(async (value) => {
              await this.plugin.saveSettings({
                LEGAL_ANALYSIS_MODE: value as LexGraphSettings["LEGAL_ANALYSIS_MODE"],
              });
            })
        );

      new Setting(containerEl)
        .setName("법률 불용어 제거")
        .setDesc("조사, 상용 어미, 법률 형식어를 제거하여 핵심 법률 용어만 그래프에 반영합니다.")
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
        .setDesc("판례 번호를 대법원 종합법률정보와 연결합니다.")
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

    // ── 텍스트 처리 설정 ────────────────────────────────
    containerEl.createEl("h3", { text: "텍스트 처리" });

    new Setting(containerEl)
      .setName("단일 페이지 처리")
      .setDesc("단일 파일 분석 시 텍스트 처리 방식")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("All Text", "전체 텍스트")
          .addOption("[[Wiki Links]] Only", "위키링크만")
          .setValue(this.plugin.settings.SINGLE_PAGE_GRAPH_PROCESSING)
          .onChange(async (value) => {
            await this.plugin.saveSettings({
              SINGLE_PAGE_GRAPH_PROCESSING: value as LexGraphSettings["SINGLE_PAGE_GRAPH_PROCESSING"],
            });
          })
      );

    new Setting(containerEl)
      .setName("연결된 언급 포함")
      .setDesc("[[위키링크]] 형태의 연결된 언급을 분석에 포함합니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("For all pages", "모든 페이지")
          .addOption("For empty pages only", "빈 페이지만")
          .addOption("Never", "포함 안 함")
          .setValue(this.plugin.settings.INCLUDE_LINKED_MENTIONS)
          .onChange(async (value) => {
            await this.plugin.saveSettings({
              INCLUDE_LINKED_MENTIONS: value as LexGraphSettings["INCLUDE_LINKED_MENTIONS"],
            });
          })
      );

    // ── 고급 설정 ────────────────────────────────────────
    containerEl.createEl("h3", { text: "고급 설정" });

    new Setting(containerEl)
      .setName("InfraNodus API URL")
      .setDesc("개발자 모드. 기본값: https://infranodus.com")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.INFRANODUS_API_URL)
          .onChange(async (value) => {
            await this.plugin.saveSettings({ INFRANODUS_API_URL: value });
          })
      );

    new Setting(containerEl)
      .setName("InfraNodus Graph URL")
      .setDesc("개발자 모드. 기본값: https://graph.infranodus.com")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.INFRANODUS_GRAPH_URL)
          .onChange(async (value) => {
            await this.plugin.saveSettings({ INFRANODUS_GRAPH_URL: value });
          })
      );
  }
}
