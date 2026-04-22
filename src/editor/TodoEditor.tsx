import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { createExtensions } from './extensions';

interface TodoEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onFilterChange?: (tag: string | null) => void;
  onHashFilterChange?: (tag: string | null) => void;
  editorRef?: React.MutableRefObject<EditorView | null>;
}

export function TodoEditor({ initialContent, onChange, onSave, onFilterChange, onHashFilterChange, editorRef }: TodoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onFilterChangeRef = useRef(onFilterChange);
  const onHashFilterChangeRef = useRef(onHashFilterChange);

  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onFilterChangeRef.current = onFilterChange;
  onHashFilterChangeRef.current = onHashFilterChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        createExtensions(
          () => onSaveRef.current(),
          (tag) => onFilterChangeRef.current?.(tag),
          (tag) => onHashFilterChangeRef.current?.(tag),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            prevContentRef.current = newContent;
            onChangeRef.current(newContent);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    if (editorRef) editorRef.current = view;

    // Focus the editor
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
      if (editorRef) editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When initialContent changes (new file opened), update the editor doc
  const prevContentRef = useRef(initialContent);
  useEffect(() => {
    if (!viewRef.current) return;
    if (initialContent === prevContentRef.current) return;
    prevContentRef.current = initialContent;

    const view = viewRef.current;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: initialContent },
    });
  }, [initialContent]);

  return <div ref={containerRef} className="editor-container" />;
}
