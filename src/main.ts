// LexGraph: 법률 특화 InfraNodus Advanced Graph View Plugin for Obsidian
// main.ts — 플러그인 진입점

import {
  Plugin,
  MarkdownView,
  Notice,
  addIcon,
  TFile,
} from "obsidian";
import type { Extension } from "@codemirror/state";

import { DEFAULT_SETTINGS, type LexGraphSettings } from "./settings/LexGraphSettings";
import { LexGraphSettingTab } from "./settings/LexGraphSettingTab";
import { LexGraphView, LEXGRAPH_VIEW_TYPE } from "./views/LexGraphView";
import { preprocessLegalText } from "./legal/preprocessor/LegalTextPreprocessor";
import { openGraphSideView } from "./utils/graphUtils";
import { linkifyCaseCitations } from "./legal/utils/CitationLinking";
import { createLegalHighlightExtension } from "./editor/LegalHighlightExtension";
import {
  clonePersistedDocumentState,
  mergePersistedDocumentState,
  prunePersistedDocuments,
  readPluginData,
  type PersistedDocumentState,
  type PersistedDocumentStateInput,
} from "./state/PersistedGraphState";

// 플러그인 내 커스텀 이벤트 이름
const EVENT_SAVE_SETTINGS = "lexgraphSaveSettings";
const EVENT_SETTINGS_SAVED = "lexgraphSettingsSaved";

// 리본 아이콘 SVG
const LEXGRAPH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- 법원 저울 + 네트워크 그래프 결합 아이콘 -->
  <circle cx="20" cy="20" r="8" fill="currentColor" opacity="0.9"/>
  <circle cx="80" cy="20" r="8" fill="currentColor" opacity="0.9"/>
  <circle cx="50" cy="55" r="10" fill="currentColor"/>
  <circle cx="20" cy="80" r="6" fill="currentColor" opacity="0.7"/>
  <circle cx="80" cy="80" r="6" fill="currentColor" opacity="0.7"/>
  <line x1="20" y1="20" x2="50" y2="55" stroke="currentColor" stroke-width="2.5"/>
  <line x1="80" y1="20" x2="50" y2="55" stroke="currentColor" stroke-width="2.5"/>
  <line x1="20" y1="80" x2="50" y2="55" stroke="currentColor" stroke-width="2.5"/>
  <line x1="80" y1="80" x2="50" y2="55" stroke="currentColor" stroke-width="2.5"/>
  <line x1="20" y1="20" x2="80" y2="20" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <!-- 저울대 -->
  <rect x="47" y="60" width="6" height="20" fill="currentColor" opacity="0.6" rx="2"/>
  <rect x="35" y="78" width="30" height="4" fill="currentColor" opacity="0.6" rx="2"/>
</svg>`;

/**
 * LexGraph 메인 플러그인 클래스
 */
export default class LexGraphPlugin extends Plugin {
  settings!: LexGraphSettings;

  private onSettingsSaveEvent!: EventListener;
  private editorExtensions: Extension[] = [];
  private persistedDocuments: Record<string, PersistedDocumentState> = {};
  private persistDataTimer: ReturnType<typeof setTimeout> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 설정 탭 등록
    this.addSettingTab(new LexGraphSettingTab(this.app, this));

    // 커스텀 아이콘 등록
    addIcon("lexgraph-icon", LEXGRAPH_ICON_SVG);

    // 그래프 뷰 타입 등록
    this.registerView(LEXGRAPH_VIEW_TYPE, (leaf) => new LexGraphView(leaf, this));
    this.registerEditorExtension(this.editorExtensions);
    this.syncEditorExtensions(true);

    // 설정 저장 이벤트 리스너
    this.onSettingsSaveEvent = (async (event: Event) => {
      const customEvent = event as CustomEvent<Partial<LexGraphSettings>>;
      const newSettings = customEvent.detail;
      if (!newSettings) {
        document.dispatchEvent(new CustomEvent(EVENT_SETTINGS_SAVED));
        return;
      }
      await this.saveSettings(newSettings);
      document.dispatchEvent(new CustomEvent(EVENT_SETTINGS_SAVED));
    }).bind(this);

    document.addEventListener(EVENT_SAVE_SETTINGS, this.onSettingsSaveEvent);

    // 리본 아이콘 추가
    this.addRibbonIcon("lexgraph-icon", "LexGraph: 법률 그래프 뷰", async () => {
      await this.openGraphForCurrentContext();
    });

    // 커맨드 팔레트 명령 등록
    this.registerCommands();

    this.registerMarkdownPostProcessor((el) => {
      if (!this.settings.LEGAL_CITATION_LINK) return;
      void linkifyCaseCitations(el, {
        oc: this.settings.LEGAL_OPEN_API_OC,
        enablePreview: this.settings.LEGAL_DB_INTEGRATION === "enabled",
      });
    });

    // active-leaf-change 이벤트 — 자동 그래프 업데이트
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", async (leaf) => {
        if (this.settings.RELOADING_GRAPH !== "automatic") return;
        if (!leaf) return;

        const viewType = leaf.view.getViewType();
        if (viewType !== "markdown") return;

        const markdownView = leaf.view as MarkdownView;
        const file = markdownView.file;
        if (!file) return;

        await this.reloadActiveGraphView(file.path);
      })
    );

    // 컨텍스트 메뉴 등록
    this.registerContextMenu();

  }

  onunload(): void {
    document.removeEventListener(EVENT_SAVE_SETTINGS, this.onSettingsSaveEvent);
    if (this.persistDataTimer) {
      clearTimeout(this.persistDataTimer);
      this.persistDataTimer = null;
    }
    void this.persistPluginData();
  }

  /**
   * 설정 로드
   */
  async loadSettings(): Promise<void> {
    const saved = readPluginData(await this.loadData());
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings);
    this.persistedDocuments = saved.persistedDocuments;

    const legacyOc =
      typeof (saved.settings as any)?.LEGAL_MOJ_API_KEY === "string"
        ? (saved.settings as any).LEGAL_MOJ_API_KEY.trim()
        : "";
    if (!this.settings.LEGAL_OPEN_API_OC && legacyOc) {
      this.settings.LEGAL_OPEN_API_OC = legacyOc;
    }
  }

  /**
   * 설정 저장
   */
  async saveSettings(newSettings?: Partial<LexGraphSettings>): Promise<void> {
    const shouldSyncEditorExtensions = !!newSettings && "LEGAL_ENTITY_HIGHLIGHT" in newSettings;
    if (newSettings) {
      this.settings = Object.assign(this.settings, newSettings);
    }
    await this.persistPluginData();
    if (shouldSyncEditorExtensions) {
      this.syncEditorExtensions(true);
    }
  }

  getPersistedDocumentState(sourceKey: string): PersistedDocumentState | undefined {
    if (!this.settings.GRAPH_STATE_PERSISTENCE_ENABLED) return undefined;
    return clonePersistedDocumentState(this.persistedDocuments[sourceKey]);
  }

  queuePersistedDocumentState(sourceKey: string, nextState: PersistedDocumentStateInput): void {
    if (!this.settings.GRAPH_STATE_PERSISTENCE_ENABLED) return;
    if (!sourceKey) return;
    this.persistedDocuments[sourceKey] = mergePersistedDocumentState(
      this.persistedDocuments[sourceKey],
      nextState
    );
    this.persistedDocuments = prunePersistedDocuments(this.persistedDocuments);
    this.schedulePersistPluginData();
  }

  async clearPersistedDocumentState(sourceKey: string): Promise<void> {
    if (!sourceKey) return;
    delete this.persistedDocuments[sourceKey];
    await this.persistPluginData();
  }

  private schedulePersistPluginData(delay = 250): void {
    if (this.persistDataTimer) {
      clearTimeout(this.persistDataTimer);
    }
    this.persistDataTimer = setTimeout(() => {
      this.persistDataTimer = null;
      void this.persistPluginData();
    }, delay);
  }

  private async persistPluginData(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      persistedDocuments: this.persistedDocuments,
    });
  }

  private syncEditorExtensions(refreshEditors: boolean): void {
    this.editorExtensions.length = 0;
    if (this.settings.LEGAL_ENTITY_HIGHLIGHT) {
      this.editorExtensions.push(createLegalHighlightExtension());
    }
    if (refreshEditors) {
      this.app.workspace.updateOptions();
    }
  }

  /**
   * 현재 컨텍스트에 맞는 그래프 열기
   */
  private async openGraphForCurrentContext(): Promise<void> {
    const workspace = this.app.workspace;
    const file = workspace.getActiveFile();

    if (!file) {
      // 검색 결과나 폴더 뷰가 열려있는 경우 처리
      new Notice("분석할 파일을 먼저 선택하세요.");
      return;
    }

    const content = await this.app.vault.cachedRead(file);

    // 법률 문서 전처리
    const preprocessed = this.settings.LEGAL_MODE_ENABLED
      ? preprocessLegalText(content, {
          documentType: this.settings.LEGAL_DOCUMENT_TYPE,
          removeStopwords: this.settings.LEGAL_STOPWORDS_ENABLED,
          extractEntities: true,
          enhanceWithEntities: true,
        })
      : { processedText: content, documentType: "general" as const, entities: null, metadata: null, chunks: undefined };

    const docTypeMsg = this.settings.LEGAL_MODE_ENABLED && preprocessed.documentType !== "general"
      ? `(${getDocumentTypeKorean(preprocessed.documentType)} 감지됨)`
      : "";

    new Notice(`LexGraph 그래프 생성 중... ${docTypeMsg}`);

    await openGraphSideView(this.app);

    const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
    const graphView = graphLeaves[0]?.view as LexGraphView | undefined;

    if (!graphView) return;

    await graphView.reloadGraph({
      filePath: file.path,
      processedText: preprocessed.processedText,
      documentType: preprocessed.documentType,
      entities: preprocessed.entities,
      metadata: preprocessed.metadata,
    });
  }

  /**
   * 활성 그래프 뷰 업데이트
   */
  private async reloadActiveGraphView(filePath: string): Promise<void> {
    const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
    if (graphLeaves.length === 0) return;

    const graphView = graphLeaves[0].view as LexGraphView;

    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    const content = await this.app.vault.cachedRead(file);
    const preprocessed = this.settings.LEGAL_MODE_ENABLED
      ? preprocessLegalText(content, {
          documentType: this.settings.LEGAL_DOCUMENT_TYPE,
          removeStopwords: this.settings.LEGAL_STOPWORDS_ENABLED,
        })
      : { processedText: content, documentType: "general" as const, entities: null, metadata: null, chunks: undefined };

    await graphView.reloadGraph({
      filePath,
      processedText: preprocessed.processedText,
      documentType: preprocessed.documentType,
      entities: preprocessed.entities,
      metadata: preprocessed.metadata,
    });
  }

  /**
   * 커맨드 팔레트 명령 등록
   */
  private registerCommands(): void {
    // 현재 파일 그래프 열기
    this.addCommand({
      id: "open-graph-current-file",
      name: "현재 파일의 법률 그래프 열기",
      callback: async () => {
        await this.openGraphForCurrentContext();
      },
    });

    // 쟁점 분석 실행 (로컬)
    this.addCommand({
      id: "run-issue-analysis",
      name: "쟁점 분석 실행 (로컬)",
      callback: async () => {
        const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
        if (graphLeaves.length === 0) {
          new Notice("먼저 그래프 뷰를 열어주세요.");
          return;
        }
        const graphView = graphLeaves[0].view as LexGraphView;
        await graphView.runLegalAnalysis("issue_spotting");
      },
    });

    // 반박 논거 생성 (로컬)
    this.addCommand({
      id: "generate-counter-arguments",
      name: "반박 논거 생성 (로컬)",
      callback: async () => {
        const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
        if (graphLeaves.length === 0) {
          new Notice("먼저 그래프 뷰를 열어주세요.");
          return;
        }
        const graphView = graphLeaves[0].view as LexGraphView;
        await graphView.runLegalAnalysis("counter_argument");
      },
    });

    // 준비서면 아웃라인 생성 (AI)
    this.addCommand({
      id: "generate-brief-outline",
      name: "준비서면 아웃라인 생성 (AI)",
      callback: async () => {
        const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
        if (graphLeaves.length === 0) {
          new Notice("먼저 그래프 뷰를 열어주세요.");
          return;
        }
        const graphView = graphLeaves[0].view as LexGraphView;
        await graphView.runLegalAnalysis("brief_outline");
      },
    });

    this.addCommand({
      id: "save-analysis-to-note",
      name: "현재 분석 결과를 노트로 저장",
      callback: async () => {
        const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
        if (graphLeaves.length === 0) {
          new Notice("그래프 뷰가 열려있지 않습니다.");
          return;
        }
        const graphView = graphLeaves[0].view as LexGraphView;
        await graphView.saveAnalysisToNote();
      },
    });

    this.addCommand({
      id: "clear-current-persisted-state",
      name: "현재 문서의 저장된 그래프 상태 초기화",
      callback: async () => {
        const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
        const graphView = graphLeaves[0]?.view as LexGraphView | undefined;
        const sourceKey = graphView?.getPersistenceKey();
        if (!sourceKey) {
          new Notice("초기화할 저장 상태가 없습니다.");
          return;
        }
        await this.clearPersistedDocumentState(sourceKey);
        new Notice("저장된 그래프 상태를 초기화했습니다. 그래프를 다시 열어주세요.");
      },
    });

    // 폴더 전체 분석
    this.addCommand({
      id: "analyze-folder",
      name: "현재 폴더 전체 법률 분석",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file?.parent) {
          new Notice("파일이 선택되지 않았습니다.");
          return;
        }
        new Notice(`폴더 분석 중: ${file.parent.path}`);
        await openGraphSideView(this.app);
        const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
        const graphView = graphLeaves[0]?.view as LexGraphView | undefined;
        if (!graphView) return;
        await graphView.reloadGraph({
          filePath: file.parent.path,
          isFolder: true,
        });
      },
    });
  }

  /**
   * 에디터 우클릭 컨텍스트 메뉴 등록
   */
  private registerContextMenu(): void {
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        menu.addItem((item) => {
          item
            .setTitle("LexGraph: 선택 텍스트 분석")
            .setIcon("lexgraph-icon")
            .onClick(async () => {
              const selectedText = editor.getSelection();
              if (!selectedText.trim()) {
                new Notice("분석할 텍스트를 선택하세요.");
                return;
              }
              await openGraphSideView(this.app);
              const graphLeaves = this.app.workspace.getLeavesOfType(LEXGRAPH_VIEW_TYPE);
              const graphView = graphLeaves[0]?.view as LexGraphView | undefined;
              if (!graphView) return;
              await graphView.reloadGraph({
                processedText: selectedText,
                sourcePath: "선택된 텍스트",
              });
            });
        });
      })
    );
  }
}

/**
 * 문서 유형 한국어 명칭
 */
function getDocumentTypeKorean(type: string): string {
  const names: Record<string, string> = {
    judgment: "판결문",
    contract: "계약서",
    statute: "법령",
    brief: "준비서면",
    general: "일반 문서",
    auto: "문서",
  };
  return names[type] ?? "문서";
}
