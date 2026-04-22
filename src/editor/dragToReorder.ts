import { WidgetType, Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, EditorSelection } from '@codemirror/state';

let dragSourceLine = -1;
let dropIndicator: HTMLElement | null = null;

// Widget has no stored state → eq() is always true → DOM elements are reused on every rebuild,
// preventing CodeMirror from thinking something changed at position 0 and scrolling there.
class DragHandleWidget extends WidgetType {
  eq(_other: DragHandleWidget) {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const handle = document.createElement('span');
    handle.className = 'cm-drag-handle';
    handle.draggable = true;
    handle.title = 'Drag to reorder';
    handle.innerHTML = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="2.5" r="1.3"/>
      <circle cx="7" cy="2.5" r="1.3"/>
      <circle cx="3" cy="7" r="1.3"/>
      <circle cx="7" cy="7" r="1.3"/>
      <circle cx="3" cy="11.5" r="1.3"/>
      <circle cx="7" cy="11.5" r="1.3"/>
    </svg>`;

    handle.addEventListener('dragstart', (e) => {
      // Detect line number from current DOM position at drag time — no stale stored state
      const rect = handle.getBoundingClientRect();
      const pos = view.posAtCoords({ x: rect.left + 5, y: rect.top + 5 });
      dragSourceLine = pos !== null ? view.state.doc.lineAt(pos).number : -1;
      if (dragSourceLine < 1) { e.preventDefault(); return; }
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', String(dragSourceLine));
      document.body.style.cursor = 'grabbing';
      view.dom.classList.add('cm-dragging');
    });

    return handle;
  }

  ignoreEvent() {
    return false;
  }
}

const sharedWidget = new DragHandleWidget();

function getDropIndicator(): HTMLElement {
  if (!dropIndicator) {
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'cm-drop-indicator';
    document.body.appendChild(dropIndicator);
  }
  return dropIndicator;
}

// Only rebuild on viewportChanged (new lines scrolling into view), NOT on docChanged.
// This prevents the widget at position 0 from being "recreated" on every keystroke,
// which was causing CodeMirror to scroll back to the heading.
function buildHandleDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      builder.add(
        line.from,
        line.from,
        Decoration.widget({ widget: sharedWidget, side: -1 })
      );
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

function lineAtY(view: EditorView, y: number): number {
  const pos = view.posAtCoords({ x: view.dom.getBoundingClientRect().left + 40, y });
  if (pos === null) return -1;
  return view.state.doc.lineAt(pos).number;
}

export const dragToReorderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    listeners: Array<[string, EventListener]> = [];
    view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      this.decorations = buildHandleDecos(view);
      this.setupListeners();
    }

    update(update: ViewUpdate) {
      // Only rebuild when the viewport changes (new lines enter/leave view),
      // NOT on every doc change or selection change.
      if (update.viewportChanged) {
        this.decorations = buildHandleDecos(update.view);
      }
    }

    setupListeners() {
      const { dom } = this.view;

      const onDragOver = (e: DragEvent) => {
        if (dragSourceLine < 1) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        const targetLineNum = lineAtY(this.view, e.clientY);
        if (targetLineNum < 1) return;
        const lineCount = this.view.state.doc.lines;
        const line = this.view.state.doc.line(Math.min(targetLineNum, lineCount));
        const coords = this.view.coordsAtPos(line.from);
        if (!coords) return;
        const ind = getDropIndicator();
        ind.style.display = 'block';
        ind.style.top = (coords.top - 1) + 'px';
        ind.style.left = this.view.dom.getBoundingClientRect().left + 'px';
        ind.style.width = this.view.dom.getBoundingClientRect().width + 'px';
      };

      const onDragEnd = () => {
        dragSourceLine = -1;
        document.body.style.cursor = '';
        dom.classList.remove('cm-dragging');
        if (dropIndicator) dropIndicator.style.display = 'none';
      };

      const onDrop = (e: DragEvent) => {
        e.preventDefault();
        document.body.style.cursor = '';
        dom.classList.remove('cm-dragging');
        if (dropIndicator) dropIndicator.style.display = 'none';
        if (dragSourceLine < 1) return;

        const targetLineNum = lineAtY(this.view, e.clientY);
        if (targetLineNum < 1 || targetLineNum === dragSourceLine) {
          dragSourceLine = -1;
          return;
        }

        const doc = this.view.state.doc;
        const lines = doc.toString().split('\n');
        const srcIdx = dragSourceLine - 1;
        const tgtIdx = targetLineNum - 1;

        if (srcIdx < 0 || srcIdx >= lines.length || tgtIdx < 0 || tgtIdx >= lines.length) {
          dragSourceLine = -1;
          return;
        }

        const [removed] = lines.splice(srcIdx, 1);
        lines.splice(tgtIdx, 0, removed);
        const newContent = lines.join('\n');
        const prefix = lines.slice(0, tgtIdx).join('\n');
        const newPos = prefix.length + (tgtIdx > 0 ? 1 : 0);

        this.view.dispatch({
          changes: { from: 0, to: doc.length, insert: newContent },
          selection: EditorSelection.cursor(newPos),
        });

        dragSourceLine = -1;
      };

      dom.addEventListener('dragover', onDragOver as EventListener);
      dom.addEventListener('dragend', onDragEnd as EventListener);
      dom.addEventListener('drop', onDrop as EventListener);

      this.listeners = [
        ['dragover', onDragOver as EventListener],
        ['dragend', onDragEnd as EventListener],
        ['drop', onDrop as EventListener],
      ];
    }

    destroy() {
      const { dom } = this.view;
      for (const [event, listener] of this.listeners) {
        dom.removeEventListener(event, listener);
      }
      document.body.style.cursor = '';
      if (dropIndicator) dropIndicator.style.display = 'none';
    }
  },
  { decorations: (v) => v.decorations }
);
