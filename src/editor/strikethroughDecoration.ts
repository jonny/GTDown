import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Adds strikethrough to task lines containing @done
function buildStrikeDecos(view: EditorView): DecorationSet {
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.number !== cursorLine) {
        const isTask = /^\s*- /.test(line.text);
        if (isTask && /@done/.test(line.text)) {
          // Strikethrough from after "- " prefix to end of line
          const prefixMatch = line.text.match(/^(\s*- )/);
          const textStart = prefixMatch ? line.from + prefixMatch[1].length : line.from;
          if (line.to > textStart) {
            builder.add(textStart, line.to, Decoration.mark({ class: 'cm-task-done' }));
          }
        }
      }
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

export const strikethroughPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildStrikeDecos(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildStrikeDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
