import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { EditorView } from '@codemirror/view';
import { TodoEditor } from './editor/TodoEditor';
import { openFile, saveFile, saveNewFile, copyMarkdown, getLastFileName, restoreLastFile } from './fileSystem';
import { setFilterEffect, setHashFilterEffect, setProjectFilterEffect } from './editor/tagFilter';
import { isProjectLine } from './editor/projectDecoration';
import { Sidebar } from './Sidebar';
import './App.css';

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

const SAMPLE_CONTENT = `Inbox:
\t- Write the spec @today
\t- Review PR @high
\t- Read the docs

Work:
\t- Fix login bug @done
\t- Deploy to staging @done
\t- Update dependencies @today

Personal:
\t- Call dentist @today
\t- Grocery run
\tRemember to check if the store has oat milk

`;

function archiveDone(content: string): string {
  const lines = content.split('\n');

  // Track which project section each line belongs to
  let currentProject: string | null = null;
  const lineProjects = lines.map(line => {
    if (isProjectLine(line)) currentProject = line.replace(/:\s*$/, '').trim();
    return currentProject;
  });

  // Pull out @done tasks that aren't already in the Done section
  const doneTasks: string[] = [];
  const remainingLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*- /.test(line) && /@done/.test(line) && lineProjects[i] !== 'Done') {
      doneTasks.push(line);
    } else {
      remainingLines.push(line);
    }
  }

  if (doneTasks.length === 0) return content;

  // Find an existing "Done:" section
  const doneHeaderIdx = remainingLines.findIndex(
    l => isProjectLine(l) && l.replace(/:\s*$/, '').trim() === 'Done'
  );

  if (doneHeaderIdx !== -1) {
    // Prepend to the top of the existing Done section
    remainingLines.splice(doneHeaderIdx + 1, 0, ...doneTasks);
  } else {
    // Create a new Done section at the bottom
    while (remainingLines.length > 0 && remainingLines[remainingLines.length - 1].trim() === '') {
      remainingLines.pop();
    }
    remainingLines.push('', 'Done:', ...doneTasks, '');
  }

  return remainingLines.join('\n');
}

export default function App() {
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [hashFilterTag, setHashFilterTag] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [content, setContent] = useState(SAMPLE_CONTENT);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<EditorView | null>(null);
  const filePathRef = useRef<string | null>(null);
  const contentRef = useRef(content);

  filePathRef.current = filePath;
  contentRef.current = content;

  const lastFileName = getLastFileName();

  // On mount: restore last file directly — no permission prompt needed in Tauri
  useEffect(() => {
    restoreLastFile().then((result) => {
      if (!result) return;
      setFilePath(result.path);
      filePathRef.current = result.path;
      setFileName(result.name);
      setContent(result.content);
      setSaveStatus('saved');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save immediately when the window loses focus (switching apps, closing)
  useEffect(() => {
    const onHide = () => {
      const path = filePathRef.current;
      if (!path) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveFile(path, contentRef.current).then(() => setSaveStatus('saved')).catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Parse projects, @tags, and #labels from document content
  const { projects, allTags, allHashtags } = useMemo(() => {
    const projectList: Array<{ name: string; lineNum: number }> = [];
    const tagSet = new Set<string>();
    const hashSet = new Set<string>();
    content.split('\n').forEach((line, i) => {
      if (/^[^\t-].*:\s*$/.test(line) && line.trim().length > 1) {
        projectList.push({ name: line.replace(/:\s*$/, '').trim(), lineNum: i + 1 });
      }
      for (const m of line.matchAll(/@([\w-]+)/g)) tagSet.add('@' + m[1]);
      for (const m of line.matchAll(/#([\w-]+)/g)) hashSet.add('#' + m[1]);
    });
    return { projects: projectList, allTags: Array.from(tagSet).sort(), allHashtags: Array.from(hashSet).sort() };
  }, [content]);

  const handleSetFilter = useCallback((tag: string | null) => {
    editorRef.current?.dispatch({ effects: setFilterEffect.of(tag) });
  }, []);

  const handleSetHashFilter = useCallback((tag: string | null) => {
    editorRef.current?.dispatch({ effects: setHashFilterEffect.of(tag) });
  }, []);

  const handleSetProjectFilter = useCallback((name: string | null) => {
    setProjectFilter(name);
    editorRef.current?.dispatch({ effects: setProjectFilterEffect.of(name) });
  }, []);

  const triggerAutoSave = useCallback((newContent: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('unsaved');
    saveTimeoutRef.current = setTimeout(async () => {
      const path = filePathRef.current;
      if (!path) return;
      setSaveStatus('saving');
      try {
        await saveFile(path, newContent);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 600);
  }, []);

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    contentRef.current = newContent;
    triggerAutoSave(newContent);
  }, [triggerAutoSave]);

  const handleSave = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const path = filePathRef.current;
    if (path) {
      setSaveStatus('saving');
      try {
        await saveFile(path, contentRef.current);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    } else {
      const result = await saveNewFile(contentRef.current);
      if (result) {
        setFilePath(result.path);
        filePathRef.current = result.path;
        setFileName(result.name);
        setSaveStatus('saved');
      }
    }
  }, []);

  const handleOpen = useCallback(async () => {
    const result = await openFile();
    if (!result) return;
    setFilePath(result.path);
    filePathRef.current = result.path;
    setFileName(result.name);
    setContent(result.content);
    setSaveStatus('saved');
  }, []);

  const handleNew = useCallback(async () => {
    const result = await saveNewFile('');
    if (!result) return;
    setFilePath(result.path);
    filePathRef.current = result.path;
    setFileName(result.name);
    setContent('');
    setSaveStatus('saved');
  }, []);

  const handleCopy = useCallback(async () => {
    await copyMarkdown(contentRef.current);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleArchiveDone = useCallback(() => {
    const view = editorRef.current;
    if (!view) return;
    const newContent = archiveDone(view.state.doc.toString());
    if (newContent === view.state.doc.toString()) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newContent } });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        handleOpen();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNew();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleOpen, handleNew]);

  const statusLabel: Record<SaveStatus, string> = {
    saved: 'Saved',
    unsaved: 'Unsaved',
    saving: 'Saving…',
    error: 'Error saving',
  };

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <span className="app-title">GTDown</span>
          {fileName && <span className="file-name">{fileName}</span>}
          {!fileName && lastFileName && (
            <span className="file-name hint">Last: {lastFileName}</span>
          )}
        </div>
        <div className="toolbar-right">
          {projectFilter && (
            <button
              className="filter-chip filter-chip--project"
              onClick={() => handleSetProjectFilter(null)}
              title="Clear project filter"
            >
              {projectFilter} ×
            </button>
          )}
          {filterTag && (
            <button
              className="filter-chip"
              onClick={() => handleSetFilter(null)}
              title="Clear filter (Escape)"
            >
              {filterTag} ×
            </button>
          )}
          {hashFilterTag && (
            <button
              className="filter-chip filter-chip--hash"
              onClick={() => handleSetHashFilter(null)}
              title="Clear label filter"
            >
              {hashFilterTag} ×
            </button>
          )}
          {filePath && (
            <span className={`save-status save-status--${saveStatus}`}>
              {statusLabel[saveStatus]}
            </span>
          )}
          <button className="toolbar-btn" onClick={handleOpen} title="Open file (Cmd+O)">Open</button>
          <button className="toolbar-btn" onClick={handleNew} title="New file (Cmd+N)">New</button>
          <button className="toolbar-btn" onClick={handleSave} title="Save (Cmd+S)">Save</button>
          <button className="toolbar-btn toolbar-btn--copy" onClick={handleCopy} title="Copy as markdown (Cmd+Shift+C)">
            {copied ? 'Copied!' : 'Copy MD'}
          </button>
          <button className="toolbar-btn" onClick={handleArchiveDone} title="Move @done tasks to Done section">Archive Done</button>
        </div>
      </header>

      <div className="body-wrap">
        {sidebarOpen && (
          <Sidebar
            projects={projects}
            tags={allTags}
            hashtags={allHashtags}
            activeFilter={filterTag}
            activeHashFilter={hashFilterTag}
            activeProjectFilter={projectFilter}
            onSetProjectFilter={handleSetProjectFilter}
            onSetFilter={handleSetFilter}
            onSetHashFilter={handleSetHashFilter}
          />
        )}
        <main className="editor-wrap">
          <TodoEditor
            initialContent={content}
            onChange={handleChange}
            onSave={handleSave}
            onFilterChange={setFilterTag}
            onHashFilterChange={setHashFilterTag}
            editorRef={editorRef}
          />
        </main>
      </div>
    </div>
  );
}
