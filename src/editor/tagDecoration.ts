import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate, MatchDecorator } from '@codemirror/view';

const atTagMatcher = new MatchDecorator({
  regexp: /@[\w-]+/g,
  decoration: () => Decoration.mark({ class: 'cm-tag-at' }),
});

const hashTagMatcher = new MatchDecorator({
  regexp: /#[\w-]+/g,
  decoration: () => Decoration.mark({ class: 'cm-tag-hash' }),
});

function buildTagDecos(view: EditorView): DecorationSet {
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const ranges: ReturnType<typeof Decoration.prototype.range>[] = [];

  for (const matcher of [atTagMatcher, hashTagMatcher]) {
    const all = matcher.createDeco(view);
    const iter = all.iter();
    while (iter.value !== null) {
      if (view.state.doc.lineAt(iter.from).number !== cursorLine) {
        ranges.push(iter.value.range(iter.from, iter.to));
      }
      iter.next();
    }
  }

  if (ranges.length === 0) return Decoration.none;
  ranges.sort((a, b) => a.from - b.from);
  return Decoration.set(ranges, true);
}

export const tagDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildTagDecos(view); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildTagDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
