import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { EditorView } from '@codemirror/view';
import { TodoEditor } from './editor/TodoEditor';
import { openFile, saveFile, saveNewFile, copyMarkdown, saveOpenTabs, restoreOpenTabs } from './fileSystem';
import { setFilterEffect, setHashFilterEffect, setProjectFilterEffect } from './editor/tagFilter';
import { isProjectLine } from './editor/projectDecoration';
import { Sidebar } from './Sidebar';
import './App.css';

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

interface Tab {
  id: string;
  filePath: string | null;
  fileName: string | null;
  content: string;
  saveStatus: SaveStatus;
  filterTags: string[];
  hashFilterTags: string[];
  projectFilter: string | null;
}

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

  let currentProject: string | null = null;
  const lineProjects = lines.map(line => {
    if (isProjectLine(line)) currentProject = line.replace(/:\s*$/, '').trim();
    return currentProject;
  });

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

  const doneHeaderIdx = remainingLines.findIndex(
    l => isProjectLine(l) && l.replace(/:\s*$/, '').trim() === 'Done'
  );

  if (doneHeaderIdx !== -1) {
    remainingLines.splice(doneHeaderIdx + 1, 0, ...doneTasks);
  } else {
    while (remainingLines.length > 0 && remainingLines[remainingLines.length - 1].trim() === '') {
      remainingLines.pop();
    }
    remainingLines.push('', 'Done:', ...doneTasks, '');
  }

  return remainingLines.join('\n');
}

export default function App() {
  const tabIdCounter = useRef(1);

  const [tabs, setTabs] = useState<Tab[]>([{
    id: 'tab-0',
    filePath: null,
    fileName: null,
    content: SAMPLE_CONTENT,
    saveStatus: 'saved',
    filterTags: [],
    hashFilterTags: [],
    projectFilter: null,
  }]);
  const [activeTabId, setActiveTabId] = useState('tab-0');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const editorRefsMap = useRef(new Map<string, EditorView>());
  const editorRef = useRef<EditorView | null>(null);
  const saveTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

  // Restore all open tabs from previous session on mount
  useEffect(() => {
    restoreOpenTabs().then(results => {
      if (!results || results.length === 0) return;
      const restoredTabs: Tab[] = results.map(r => ({
        id: `tab-${tabIdCounter.current++}`,
        filePath: r.path,
        fileName: r.name,
        content: r.content,
        saveStatus: 'saved' as SaveStatus,
        filterTags: [],
        hashFilterTags: [],
        projectFilter: null,
      }));
      const activeIdx = results.findIndex(r => r.active);
      const activeRestoredTab = restoredTabs[activeIdx === -1 ? 0 : activeIdx];
      setTabs(restoredTabs);
      setActiveTabId(activeRestoredTab.id);
      activeTabIdRef.current = activeRestoredTab.id;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist open tabs whenever the set of files or active tab changes
  useEffect(() => {
    const paths = tabs.flatMap(t => t.filePath ? [t.filePath] : []);
    saveOpenTabs(paths, activeTab.filePath);
  }, [tabs, activeTabId]); // tabs ref changes on content edits but saveOpenTabs is cheap

  // Save active tab immediately on window hide
  useEffect(() => {
    const onHide = () => {
      const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
      if (!tab?.filePath) return;
      const timeout = saveTimeoutsRef.current.get(tab.id);
      if (timeout) { clearTimeout(timeout); saveTimeoutsRef.current.delete(tab.id); }
      saveFile(tab.filePath, tab.content)
        .then(() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, saveStatus: 'saved' } : t)))
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Parse projects/@tags/#labels for the active tab
  const { projects, allTags, allHashtags } = useMemo(() => {
    const projectList: Array<{ name: string; lineNum: number }> = [];
    const tagSet = new Set<string>();
    const hashSet = new Set<string>();
    activeTab.content.split('\n').forEach((line, i) => {
      if (/^[^\t-].*:\s*$/.test(line) && line.trim().length > 1)
        projectList.push({ name: line.replace(/:\s*$/, '').trim(), lineNum: i + 1 });
      for (const m of line.matchAll(/@([\w-]+)/g)) tagSet.add('@' + m[1]);
      for (const m of line.matchAll(/#([\w-]+)/g)) hashSet.add('#' + m[1]);
    });
    return { projects: projectList, allTags: Array.from(tagSet).sort(), allHashtags: Array.from(hashSet).sort() };
  }, [activeTab.content]);

  // Register/unregister editors
  const handleEditorReady = useCallback((tabId: string, view: EditorView) => {
    editorRefsMap.current.set(tabId, view);
    if (tabId === activeTabIdRef.current) {
      editorRef.current = view;
      view.focus();
    }
  }, []);

  const handleEditorDestroy = useCallback((tabId: string) => {
    editorRefsMap.current.delete(tabId);
    if (tabId === activeTabIdRef.current) editorRef.current = null;
  }, []);

  // Tab switching
  const switchToTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    activeTabIdRef.current = tabId;
    const view = editorRefsMap.current.get(tabId);
    editorRef.current = view ?? null;
    setTimeout(() => editorRefsMap.current.get(tabId)?.focus(), 0);
  }, []);

  // Tab closing
  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      if (prev.length === 1) return prev;
      const idx = prev.findIndex(t => t.id === tabId);
      const newTabs = prev.filter(t => t.id !== tabId);
      if (tabId === activeTabIdRef.current) {
        const next = newTabs[Math.min(idx, newTabs.length - 1)];
        setActiveTabId(next.id);
        activeTabIdRef.current = next.id;
        editorRef.current = editorRefsMap.current.get(next.id) ?? null;
        setTimeout(() => editorRefsMap.current.get(next.id)?.focus(), 0);
      }
      const timeout = saveTimeoutsRef.current.get(tabId);
      if (timeout) { clearTimeout(timeout); saveTimeoutsRef.current.delete(tabId); }
      editorRefsMap.current.delete(tabId);
      return newTabs;
    });
  }, []);

  // Content change with debounced auto-save
  const handleTabChange = useCallback((tabId: string, newContent: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, content: newContent, saveStatus: 'unsaved' } : t));

    const existing = saveTimeoutsRef.current.get(tabId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
      const filePath = tabsRef.current.find(t => t.id === tabId)?.filePath;
      if (!filePath) { saveTimeoutsRef.current.delete(tabId); return; }
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, saveStatus: 'saving' } : t));
      try {
        await saveFile(filePath, newContent);
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, saveStatus: 'saved' } : t));
      } catch {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, saveStatus: 'error' } : t));
      }
      saveTimeoutsRef.current.delete(tabId);
    }, 600);
    saveTimeoutsRef.current.set(tabId, timeout);
  }, []);

  // Filter sync from editor (Cmd+click on tags, Escape)
  const handleFilterChange = useCallback((tags: string[]) => {
    const tabId = activeTabIdRef.current;
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, filterTags: tags } : t));
  }, []);

  const handleHashFilterChange = useCallback((tags: string[]) => {
    const tabId = activeTabIdRef.current;
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, hashFilterTags: tags } : t));
  }, []);

  // Filter changes from sidebar
  const handleSetFilter = useCallback((tag: string) => {
    const tabId = activeTabIdRef.current;
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      const next = tab.filterTags.includes(tag)
        ? tab.filterTags.filter(f => f !== tag)
        : [...tab.filterTags, tag];
      editorRef.current?.dispatch({ effects: setFilterEffect.of(next) });
      return prev.map(t => t.id === tabId ? { ...t, filterTags: next } : t);
    });
  }, []);

  const handleSetHashFilter = useCallback((tag: string) => {
    const tabId = activeTabIdRef.current;
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      const next = tab.hashFilterTags.includes(tag)
        ? tab.hashFilterTags.filter(f => f !== tag)
        : [...tab.hashFilterTags, tag];
      editorRef.current?.dispatch({ effects: setHashFilterEffect.of(next) });
      return prev.map(t => t.id === tabId ? { ...t, hashFilterTags: next } : t);
    });
  }, []);

  const handleSetProjectFilter = useCallback((name: string | null) => {
    const tabId = activeTabIdRef.current;
    editorRef.current?.dispatch({ effects: setProjectFilterEffect.of(name) });
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, projectFilter: name } : t));
  }, []);

  // Manual save
  const handleSave = useCallback(async () => {
    const tabId = activeTabIdRef.current;
    const tab = tabsRef.current.find(t => t.id === tabId);
    if (!tab) return;

    const timeout = saveTimeoutsRef.current.get(tabId);
    if (timeout) { clearTimeout(timeout); saveTimeoutsRef.current.delete(tabId); }

    if (tab.filePath) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, saveStatus: 'saving' } : t));
      try {
        await saveFile(tab.filePath, tab.content);
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, saveStatus: 'saved' } : t));
      } catch {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, saveStatus: 'error' } : t));
      }
    } else {
      const result = await saveNewFile(tab.content);
      if (result) {
        setTabs(prev => prev.map(t => t.id === tabId
          ? { ...t, filePath: result.path, fileName: result.name, saveStatus: 'saved' }
          : t
        ));
      }
    }
  }, []);

  // Open file (reuse existing tab if already open)
  const handleOpen = useCallback(async () => {
    const result = await openFile();
    if (!result) return;

    const existing = tabsRef.current.find(t => t.filePath === result.path);
    if (existing) {
      switchToTab(existing.id);
      return;
    }

    const id = `tab-${tabIdCounter.current++}`;
    setTabs(prev => [...prev, {
      id,
      filePath: result.path,
      fileName: result.name,
      content: result.content,
      saveStatus: 'saved',
      filterTags: [],
      hashFilterTags: [],
      projectFilter: null,
    }]);
    setActiveTabId(id);
    activeTabIdRef.current = id;
  }, [switchToTab]);

  // New file
  const handleNew = useCallback(async () => {
    const result = await saveNewFile('');
    if (!result) return;
    const id = `tab-${tabIdCounter.current++}`;
    setTabs(prev => [...prev, {
      id,
      filePath: result.path,
      fileName: result.name,
      content: '',
      saveStatus: 'saved',
      filterTags: [],
      hashFilterTags: [],
      projectFilter: null,
    }]);
    setActiveTabId(id);
    activeTabIdRef.current = id;
  }, []);

  const handleCopy = useCallback(async () => {
    const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
    if (!tab) return;
    await copyMarkdown(tab.content);
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

  const navigateTab = useCallback((direction: 'left' | 'right') => {
    const current = tabsRef.current;
    const idx = current.findIndex(t => t.id === activeTabIdRef.current);
    if (idx === -1 || current.length < 2) return;
    const next = direction === 'left'
      ? (idx - 1 + current.length) % current.length
      : (idx + 1) % current.length;
    switchToTab(current[next].id);
  }, [switchToTab]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') { e.preventDefault(); handleOpen(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); handleNew(); }
      else if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navigateTab('left'); }
      else if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navigateTab('right'); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleOpen, handleNew, navigateTab]);

  const statusLabel: Record<SaveStatus, string> = {
    saved: 'Saved', unsaved: 'Unsaved', saving: 'Saving…', error: 'Error saving',
  };

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <span className="app-title">GTDown</span>
        </div>
        <div className="toolbar-right">
          {activeTab.projectFilter && (
            <button className="filter-chip filter-chip--project" onClick={() => handleSetProjectFilter(null)} title="Clear project filter">
              {activeTab.projectFilter} ×
            </button>
          )}
          {activeTab.filterTags.map(tag => (
            <button key={tag} className="filter-chip" onClick={() => handleSetFilter(tag)} title="Remove filter">
              {tag} ×
            </button>
          ))}
          {activeTab.hashFilterTags.map(tag => (
            <button key={tag} className="filter-chip filter-chip--hash" onClick={() => handleSetHashFilter(tag)} title="Remove label filter">
              {tag} ×
            </button>
          ))}
          {activeTab.filePath && (
            <span className={`save-status save-status--${activeTab.saveStatus}`}>
              {statusLabel[activeTab.saveStatus]}
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

      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab${tab.id === activeTabId ? ' tab--active' : ''}`}
            onClick={() => switchToTab(tab.id)}
          >
            {tab.saveStatus === 'unsaved' && <span className="tab-dot" />}
            <span className="tab-label">{tab.fileName ?? 'Untitled'}</span>
            {tabs.length > 1 && (
              <span className="tab-close" onClick={e => closeTab(tab.id, e)} role="button" aria-label="Close tab">×</span>
            )}
          </button>
        ))}
      </div>

      <div className="body-wrap">
        {sidebarOpen && (
          <Sidebar
            projects={projects}
            tags={allTags}
            hashtags={allHashtags}
            activeFilter={activeTab.filterTags}
            activeHashFilter={activeTab.hashFilterTags}
            activeProjectFilter={activeTab.projectFilter}
            onSetProjectFilter={handleSetProjectFilter}
            onSetFilter={handleSetFilter}
            onSetHashFilter={handleSetHashFilter}
          />
        )}
        <main className="editor-wrap">
          {tabs.map(tab => (
            <div key={tab.id} className={`tab-panel${tab.id === activeTabId ? ' tab-panel--active' : ''}`}>
              <TodoEditor
                initialContent={tab.content}
                onChange={content => handleTabChange(tab.id, content)}
                onSave={handleSave}
                onFilterChange={handleFilterChange}
                onHashFilterChange={handleHashFilterChange}
                onEditorReady={view => handleEditorReady(tab.id, view)}
                onEditorDestroy={() => handleEditorDestroy(tab.id)}
              />
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
