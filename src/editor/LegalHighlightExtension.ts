import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { findLegalHighlightMatches } from "./LegalHighlightPatterns";

export function createLegalHighlightExtension(): Extension {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  }, {
    decorations: (plugin) => plugin.decorations,
  });
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of view.visibleRanges) {
    const text = view.state.doc.sliceString(range.from, range.to);
    const matches = findLegalHighlightMatches(text, range.from);
    for (const match of matches) {
      builder.add(match.from, match.to, Decoration.mark({ class: match.className }));
    }
  }

  return builder.finish();
}
