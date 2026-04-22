import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// A note is any non-empty line that is NOT a project (ends with ':') and NOT a task (starts with '- ')
function buildNoteDecos(view: EditorView): DecorationSet {
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.number !== cursorLine) {
        const text = line.text;
        const trimmed = text.trim();
        const isProject = /^[^\t-].*:\s*$/.test(text) && trimmed.length > 1;
        const isTask = /^\s*- /.test(text);
        if (trimmed.length > 0 && !isProject && !isTask) {
          builder.add(line.from, line.to, Decoration.mark({ class: 'cm-note-line' }));
        }
      }
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

export const noteDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildNoteDecos(view); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildNoteDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
