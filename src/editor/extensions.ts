import { keymap, EditorView, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { tagDecorationPlugin } from './tagDecoration';
import { projectDecorationPlugin } from './projectDecoration';
import { strikethroughPlugin } from './strikethroughDecoration';
import { noteDecorationPlugin } from './noteDecoration';
import { todoKeymap } from './keymap';
import { filterTagField, filterHashField, filterProjectField, filterDecoField, tagClickHandler } from './tagFilter';
import { baseTheme } from './theme';

export function createExtensions(
  onSave: () => void,
  onFilterChange?: (tags: string[]) => void,
  onHashFilterChange?: (tags: string[]) => void,
) {
  return [
    history(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(false),
    markdown(),
    filterTagField,
    filterHashField,
    filterProjectField,
    filterDecoField,
    tagClickHandler,
    tagDecorationPlugin,
    projectDecorationPlugin,
    strikethroughPlugin,
    noteDecorationPlugin,
    keymap.of([
      ...todoKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      {
        key: 'Mod-s',
        run: () => { onSave(); return true; },
        preventDefault: true,
      },
      {
        key: 'Mod-Shift-c',
        run: (view) => {
          navigator.clipboard.writeText(view.state.doc.toString());
          return true;
        },
        preventDefault: true,
      },
    ]),
    // Lift filter state changes up to React
    EditorView.updateListener.of((update) => {
      const atPrev = update.startState.field(filterTagField);
      const atNext = update.state.field(filterTagField);
      if (atPrev !== atNext) onFilterChange?.(atNext);

      const hashPrev = update.startState.field(filterHashField);
      const hashNext = update.state.field(filterHashField);
      if (hashPrev !== hashNext) onHashFilterChange?.(hashNext);
    }),
    baseTheme,
    EditorView.lineWrapping,
  ];
}
