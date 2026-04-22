import { EditorView } from '@codemirror/view';

const baseTheme = EditorView.baseTheme({
  '&': {
    fontSize: '16px',
    fontFamily: "'iA Writer Mono S', 'Fira Code', 'JetBrains Mono', 'Menlo', 'Consolas', monospace",
    lineHeight: '1.75',
    caretColor: 'var(--color-accent)',
  },
  '.cm-content': {
    padding: '0 0 120px 0',
    caretColor: 'var(--color-accent)',
  },
  '.cm-line': {
    padding: '0 2px',
    position: 'relative',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-accent)',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--color-selection) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--color-selection) !important',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },

  // Project lines (e.g. "Inbox:")
  '.cm-project-line': {
    fontWeight: '700',
    fontSize: '1.1em',
    color: 'var(--color-heading)',
    borderBottom: '1px solid var(--color-border)',
    display: 'block',
    paddingBottom: '2px',
  },

  // Completed task strikethrough
  '.cm-task-done': {
    textDecoration: 'line-through',
    opacity: '0.45',
  },

  // Tag chips — @context
  '.cm-tag-at': {
    color: 'var(--color-tag-at)',
    fontWeight: '500',
    borderRadius: '3px',
    padding: '0 2px',
    cursor: 'default',
  },

  // Label chips — #category
  '.cm-tag-hash': {
    color: 'var(--color-tag-hash)',
    fontWeight: '500',
    borderRadius: '3px',
    padding: '0 2px',
    cursor: 'default',
  },

  // Drag handle (shown via line hover)
  '.cm-drag-handle': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    opacity: '0',
    position: 'absolute',
    left: '-28px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--color-drag-handle)',
    padding: '2px',
    borderRadius: '3px',
    transition: 'opacity 0.1s',
    userSelect: 'none',
  },
  '.cm-line:hover .cm-drag-handle': {
    opacity: '1',
  },
  '.cm-drag-handle:active': {
    cursor: 'grabbing',
  },
  '.cm-dragging': {
    opacity: '0.5',
  },

  // Note / description lines (indented text under a task)
  '.cm-note-line': {
    color: 'var(--color-text-muted)',
    fontSize: '0.92em',
  },

  // Drop indicator line
  '.cm-drop-indicator': {
    position: 'fixed',
    height: '2px',
    backgroundColor: 'var(--color-accent)',
    pointerEvents: 'none',
    zIndex: '1000',
    display: 'none',
    borderRadius: '1px',
  },
});

export { baseTheme };
