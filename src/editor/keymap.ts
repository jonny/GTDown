import { type KeyBinding } from '@codemirror/view';
import { EditorSelection, Transaction } from '@codemirror/state';
import { setFilterEffect, filterTagField } from './tagFilter';

// On Enter:
//  - Task line with content → new task below (tab-indented)
//  - Empty task line → remove task prefix
//  - Project line → start first task: \n\t-
//  - Indented non-task line with content → continue indentation
//  - Indented empty non-task line → revert to plain line
const handleEnter = (view: import('@codemirror/view').EditorView): boolean => {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const text = line.text;

  // Task line? (starts with optional whitespace then "- ")
  const taskMatch = text.match(/^(\s*)(- )(.*)/);
  if (taskMatch) {
    const indent = taskMatch[1];
    const taskContent = taskMatch[3];
    if (taskContent.trim() === '') {
      // Empty task → remove prefix, leave blank line
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: EditorSelection.cursor(line.from),
        annotations: Transaction.userEvent.of('input'),
      });
    } else {
      // Insert new task line with same indentation
      const insert = '\n' + indent + '- ';
      view.dispatch({
        changes: { from, to: state.selection.main.to, insert },
        selection: EditorSelection.cursor(from + insert.length),
        annotations: Transaction.userEvent.of('input'),
      });
    }
    return true;
  }

  // Project line (ends with ':')? Start first task indented with tab
  if (/^[^\t-].*:\s*$/.test(text) && text.trim().length > 1) {
    const insert = '\n\t- ';
    view.dispatch({
      changes: { from, to: state.selection.main.to, insert },
      selection: EditorSelection.cursor(from + insert.length),
      annotations: Transaction.userEvent.of('input'),
    });
    return true;
  }

  // Indented non-task (note) line? Create a new task at the same indentation
  const noteMatch = text.match(/^([ \t]+)/);
  if (noteMatch) {
    const indent = noteMatch[1];
    const noteContent = text.slice(indent.length);
    if (noteContent.trim() === '') {
      // Empty indented line → strip indent
      view.dispatch({
        changes: { from: line.from, to: from, insert: '' },
        selection: EditorSelection.cursor(line.from),
        annotations: Transaction.userEvent.of('input'),
      });
    } else {
      // Non-empty note → start a new task below with same indentation
      const insert = '\n' + indent + '- ';
      view.dispatch({
        changes: { from, to: state.selection.main.to, insert },
        selection: EditorSelection.cursor(from + insert.length),
        annotations: Transaction.userEvent.of('input'),
      });
    }
    return true;
  }

  return false;
};

// Cmd+D: toggle @done on the current task line
const handleDone = (view: import('@codemirror/view').EditorView): boolean => {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  if (!/^\s*- /.test(line.text)) return false;
  if (/@done/.test(line.text)) {
    const newText = line.text.replace(/\s*@done/, '');
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: newText },
      annotations: Transaction.userEvent.of('input'),
    });
  } else {
    view.dispatch({
      changes: { from: line.to, insert: ' @done' },
      annotations: Transaction.userEvent.of('input'),
    });
  }
  return true;
};

const handleTab = (view: import('@codemirror/view').EditorView): boolean => {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: '\t' },
    selection: EditorSelection.cursor(from + 1),
    annotations: Transaction.userEvent.of('input'),
  });
  return true;
};

const handleShiftTab = (view: import('@codemirror/view').EditorView): boolean => {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const text = line.text;
  const indent = text.match(/^(\s+)/);
  if (!indent) return false;
  // Remove one tab or up to 2 spaces
  const firstChar = indent[1][0];
  const removeCount = firstChar === '\t' ? 1 : Math.min(2, indent[1].length);
  view.dispatch({
    changes: { from: line.from, to: line.from + removeCount, insert: '' },
    selection: EditorSelection.cursor(Math.max(line.from, from - removeCount)),
    annotations: Transaction.userEvent.of('input'),
  });
  return true;
};

const handleBackspace = (view: import('@codemirror/view').EditorView): boolean => {
  const { state } = view;
  const { from, to } = state.selection.main;
  if (from !== to) return false;
  const line = state.doc.lineAt(from);
  const text = line.text;
  // Only handle backspace when cursor is at end of an empty "- " task line
  const emptyTaskMatch = text.match(/^(\s*- )$/);
  if (!emptyTaskMatch) return false;
  if (from === line.to) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: EditorSelection.cursor(line.from),
      annotations: Transaction.userEvent.of('delete'),
    });
    return true;
  }
  return false;
};

// Alt+Cmd+Up/Down: move the selected block of lines up or down by one line
const handleMoveUp = (view: import('@codemirror/view').EditorView): boolean => {
  const { state } = view;
  const sel = state.selection.main;
  const firstLine = state.doc.lineAt(sel.from);
  const lastLine = !sel.empty && sel.to === state.doc.lineAt(sel.to).from
    ? state.doc.lineAt(sel.to - 1)
    : state.doc.lineAt(sel.to);

  if (firstLine.number === 1) return true;

  const prevLine = state.doc.line(firstLine.number - 1);
  const blockText = state.doc.sliceString(firstLine.from, lastLine.to);
  const delta = -(prevLine.text.length + 1);

  view.dispatch({
    changes: { from: prevLine.from, to: lastLine.to, insert: blockText + '\n' + prevLine.text },
    selection: EditorSelection.range(sel.anchor + delta, sel.head + delta),
    annotations: Transaction.userEvent.of('move'),
    scrollIntoView: true,
  });
  return true;
};

const handleMoveDown = (view: import('@codemirror/view').EditorView): boolean => {
  const { state } = view;
  const sel = state.selection.main;
  const firstLine = state.doc.lineAt(sel.from);
  const lastLine = !sel.empty && sel.to === state.doc.lineAt(sel.to).from
    ? state.doc.lineAt(sel.to - 1)
    : state.doc.lineAt(sel.to);

  if (lastLine.number === state.doc.lines) return true;

  const nextLine = state.doc.line(lastLine.number + 1);
  const blockText = state.doc.sliceString(firstLine.from, lastLine.to);
  const delta = nextLine.text.length + 1;

  view.dispatch({
    changes: { from: firstLine.from, to: nextLine.to, insert: nextLine.text + '\n' + blockText },
    selection: EditorSelection.range(sel.anchor + delta, sel.head + delta),
    annotations: Transaction.userEvent.of('move'),
    scrollIntoView: true,
  });
  return true;
};

// Escape: clear any active tag filter first; if none, blur the editor
const handleEscape = (view: import('@codemirror/view').EditorView): boolean => {
  const activeFilter = view.state.field(filterTagField, false);
  if (activeFilter) {
    view.dispatch({ effects: setFilterEffect.of(null) });
    return true;
  }
  view.contentDOM.blur();
  return true;
};

export const todoKeymap: readonly KeyBinding[] = [
  { key: 'Enter', run: handleEnter },
  { key: 'Mod-d', run: handleDone, preventDefault: true },
  { key: 'Tab', run: handleTab, preventDefault: true },
  { key: 'Shift-Tab', run: handleShiftTab, preventDefault: true },
  { key: 'Backspace', run: handleBackspace },
  { key: 'Escape', run: handleEscape },
  { key: 'Alt-Mod-ArrowUp', run: handleMoveUp, preventDefault: true },
  { key: 'Alt-Mod-ArrowDown', run: handleMoveDown, preventDefault: true },
];
