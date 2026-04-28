import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// A "project" line is any line that ends with ':' and has content before it.
// e.g. "Inbox:" or "Work:" or "My Project:"
export function isProjectLine(text: string): boolean {
  return /^[^\t-].*:\s*$/.test(text) && text.trim().length > 1;
}

function buildProjectDecos(view: EditorView): DecorationSet {
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.number !== cursorLine && isProjectLine(line.text) && line.from < line.to) {
        builder.add(line.from, line.to, Decoration.mark({ class: 'cm-project-line' }));
      }
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

export const projectDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildProjectDecos(view); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildProjectDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
