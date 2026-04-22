import { EditorView, Decoration, type DecorationSet, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder, type EditorState, type Transaction } from '@codemirror/state';
import { isProjectLine } from './projectDecoration';

export const setFilterEffect = StateEffect.define<string | null>();
export const setHashFilterEffect = StateEffect.define<string | null>();

// Stores the active @tag filter, or null
export const filterTagField = StateField.define<string | null>({
  create: () => null,
  update: (value: string | null, tr: Transaction) => {
    for (const effect of tr.effects) {
      if (effect.is(setFilterEffect)) return effect.value;
    }
    return value;
  },
});

// Stores the active #tag filter, or null
export const filterHashField = StateField.define<string | null>({
  create: () => null,
  update: (value: string | null, tr: Transaction) => {
    for (const effect of tr.effects) {
      if (effect.is(setHashFilterEffect)) return effect.value;
    }
    return value;
  },
});

// Zero-height block widget used to collapse hidden lines
class HiddenRangeWidget extends WidgetType {
  eq() { return true; }
  toDOM() { return document.createElement('div'); }
  get estimatedHeight() { return 0; }
  ignoreEvent() { return true; }
}

const hiddenRangeWidget = new HiddenRangeWidget();

function lineMatchesFilter(text: string, filter: string): boolean {
  const negative = filter.startsWith('!');
  const tag = negative ? filter.slice(1) : filter;
  const hasTag = text.includes(tag);
  return negative ? !hasTag : hasTag;
}

function buildFilterDecos(state: EditorState): DecorationSet {
  const atFilter = state.field(filterTagField);
  const hashFilter = state.field(filterHashField);
  if (!atFilter && !hashFilter) return Decoration.none;

  const doc = state.doc;

  // Pass 1: determine visibility for every line (project headers default to false)
  const visible = new Array<boolean>(doc.lines + 1).fill(false);
  for (let i = 1; i <= doc.lines; i++) {
    const text = doc.line(i).text;
    if (isProjectLine(text) || !text.trim()) continue; // handled below / collapsed
    const atOk = !atFilter || lineMatchesFilter(text, atFilter);
    const hashOk = !hashFilter || lineMatchesFilter(text, hashFilter);
    visible[i] = atOk && hashOk;
  }

  // Pass 2: show a project header only if its section contains a visible task
  for (let i = 1; i <= doc.lines; i++) {
    if (!isProjectLine(doc.line(i).text)) continue;
    for (let j = i + 1; j <= doc.lines; j++) {
      if (isProjectLine(doc.line(j).text)) break; // reached next section
      if (visible[j]) { visible[i] = true; break; }
    }
  }

  // Build replace decorations over consecutive hidden runs
  const builder = new RangeSetBuilder<Decoration>();
  let hideStart: number | null = null;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (!visible[i]) {
      if (hideStart === null) hideStart = line.from;
    } else if (hideStart !== null) {
      builder.add(hideStart, line.from, Decoration.replace({ widget: hiddenRangeWidget, block: true }));
      hideStart = null;
    }
  }

  if (hideStart !== null) {
    builder.add(hideStart, doc.line(doc.lines).to, Decoration.replace({ widget: hiddenRangeWidget, block: true }));
  }

  return builder.finish();
}

// StateField (not ViewPlugin) — block replace decorations must come from a StateField
export const filterDecoField = StateField.define<DecorationSet>({
  create: (state) => buildFilterDecos(state),
  update: (decos, tr) => {
    if (
      tr.docChanged ||
      tr.state.field(filterTagField) !== tr.startState.field(filterTagField) ||
      tr.state.field(filterHashField) !== tr.startState.field(filterHashField)
    ) {
      return buildFilterDecos(tr.state);
    }
    return decos;
  },
  provide: f => EditorView.decorations.from(f),
});

// Cmd/Ctrl+click on a tag span to toggle its filter; same tag again clears it
export const tagClickHandler = EditorView.domEventHandlers({
  click: (e: MouseEvent, view: EditorView) => {
    const target = e.target as HTMLElement;
    const isAtTag = target.classList.contains('cm-tag-at');
    const isHashTag = target.classList.contains('cm-tag-hash');
    if ((!isAtTag && !isHashTag) || !(e.metaKey || e.ctrlKey)) return false;
    const tag = target.textContent?.trim() || null;
    if (!tag) return false;
    if (isHashTag) {
      const current = view.state.field(filterHashField);
      view.dispatch({ effects: setHashFilterEffect.of(current === tag ? null : tag) });
    } else {
      const current = view.state.field(filterTagField);
      view.dispatch({ effects: setFilterEffect.of(current === tag ? null : tag) });
    }
    return true;
  },
});
