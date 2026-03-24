import { vi } from "vitest";

export const requestUrl = vi.fn();
export const addIcon = vi.fn();

export class Notice {
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}

export class Component {}

export const MarkdownRenderer = {
  render: vi.fn(async () => {}),
};

export class Plugin {
  app: unknown;
}

export class TFile {}

export class MarkdownView {
  file: TFile | null = null;
}

export class WorkspaceLeaf {
  view = {
    getViewType: () => "",
  };

  async setViewState(): Promise<void> {}
}

export class ItemView {
  app: unknown;
  leaf: WorkspaceLeaf;
  containerEl = document.createElement("div");

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
  }
}

export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl = document.createElement("div");

  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
  }
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}

  setName(): this {
    return this;
  }

  setDesc(): this {
    return this;
  }

  setHeading(): this {
    return this;
  }

  addDropdown(callback: (component: {
    addOption: (...args: unknown[]) => unknown;
    setValue: (...args: unknown[]) => unknown;
    onChange: (...args: unknown[]) => unknown;
  }) => unknown): this {
    callback({
      addOption: () => component,
      setValue: () => component,
      onChange: () => component,
    });
    return this;
  }

  addText(callback: (component: {
    setPlaceholder: (...args: unknown[]) => unknown;
    setValue: (...args: unknown[]) => unknown;
    onChange: (...args: unknown[]) => unknown;
  }) => unknown): this {
    callback({
      setPlaceholder: () => component,
      setValue: () => component,
      onChange: () => component,
    });
    return this;
  }

  addToggle(callback: (component: {
    setValue: (...args: unknown[]) => unknown;
    onChange: (...args: unknown[]) => unknown;
  }) => unknown): this {
    callback({
      setValue: () => component,
      onChange: () => component,
    });
    return this;
  }
}

const component = {
  addOption: () => component,
  setValue: () => component,
  onChange: () => component,
  setPlaceholder: () => component,
};
