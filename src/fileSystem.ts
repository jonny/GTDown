import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const LAST_PATH_KEY = 'gtdown_last_path';
const OPEN_TABS_KEY = 'gtdown_open_tabs';

interface PersistedTabs {
  paths: string[];
  activePath: string | null;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function pathToName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function saveLastPath(path: string) {
  try { localStorage.setItem(LAST_PATH_KEY, path); } catch { /* ignore */ }
}

export function getLastFileName(): string | null {
  try {
    const path = localStorage.getItem(LAST_PATH_KEY);
    return path ? pathToName(path) : null;
  } catch { return null; }
}

// Stored so saveFile() can write back to the same file without re-prompting
let webFileHandle: FileSystemFileHandle | null = null;

export async function openFile(): Promise<{ path: string; content: string; name: string } | null> {
  if (isTauri()) {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: 'Markdown / Text', extensions: ['md', 'txt', 'taskpaper'] }],
      });
      if (!path || typeof path !== 'string') return null;
      const content = await readTextFile(path);
      saveLastPath(path);
      return { path, content, name: pathToName(path) };
    } catch {
      return null;
    }
  }

  // Browser: File System Access API (Chrome/Edge) gives a writable handle
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as unknown as {
        showOpenFilePicker: (opts: object) => Promise<FileSystemFileHandle[]>;
      }).showOpenFilePicker({
        types: [{ description: 'Markdown / Text', accept: { 'text/plain': ['.md', '.txt', '.taskpaper'] } }],
      });
      webFileHandle = handle;
      const file = await handle.getFile();
      const content = await file.text();
      saveLastPath(file.name);
      return { path: file.name, content, name: file.name };
    } catch {
      return null;
    }
  }

  // Fallback: plain file input (read-only, no save-back)
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.taskpaper';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const content = await file.text();
      resolve({ path: file.name, content, name: file.name });
    };
    input.click();
  });
}

export async function saveFile(path: string, content: string): Promise<void> {
  if (isTauri()) {
    await writeTextFile(path, content);
    return;
  }
  // Browser: write back via the stored file handle (only available after showOpenFilePicker)
  if (webFileHandle) {
    const writable = await webFileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
}

export async function saveNewFile(content: string): Promise<{ path: string; name: string } | null> {
  if (isTauri()) {
    try {
      const path = await save({
        defaultPath: 'todos.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!path) return null;
      await writeTextFile(path, content);
      saveLastPath(path);
      return { path, name: pathToName(path) };
    } catch {
      return null;
    }
  }

  // Browser: File System Access API save picker
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: 'todos.md',
        types: [{ description: 'Markdown', accept: { 'text/plain': ['.md'] } }],
      });
      webFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      saveLastPath(handle.name);
      return { path: handle.name, name: handle.name };
    } catch {
      return null;
    }
  }

  // Fallback: trigger a download
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'todos.md';
  a.click();
  URL.revokeObjectURL(url);
  return { path: 'todos.md', name: 'todos.md' };
}

export function saveOpenTabs(paths: string[], activePath: string | null): void {
  try {
    const data: PersistedTabs = { paths, activePath };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// Tauri only — browsers can't reopen a file by path without a user gesture
export async function restoreOpenTabs(): Promise<Array<{ path: string; content: string; name: string; active: boolean }> | null> {
  if (!isTauri()) return null;
  try {
    const raw = localStorage.getItem(OPEN_TABS_KEY);
    // Fall back to legacy single-file key on first run after upgrade
    if (!raw) {
      const path = localStorage.getItem(LAST_PATH_KEY);
      if (!path) return null;
      try {
        const content = await readTextFile(path);
        return [{ path, content, name: pathToName(path), active: true }];
      } catch {
        try { localStorage.removeItem(LAST_PATH_KEY); } catch { /* ignore */ }
        return null;
      }
    }
    const { paths, activePath } = JSON.parse(raw) as PersistedTabs;
    const results: Array<{ path: string; content: string; name: string; active: boolean }> = [];
    for (const path of paths) {
      try {
        const content = await readTextFile(path);
        results.push({ path, content, name: pathToName(path), active: path === activePath });
      } catch {
        // File missing or unreadable — skip it silently
      }
    }
    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

// Tauri only — browsers can't reopen a file by path without a user gesture
export async function restoreLastFile(): Promise<{ path: string; content: string; name: string } | null> {
  if (!isTauri()) return null;
  try {
    const path = localStorage.getItem(LAST_PATH_KEY);
    if (!path) return null;
    const content = await readTextFile(path);
    return { path, content, name: pathToName(path) };
  } catch {
    try { localStorage.removeItem(LAST_PATH_KEY); } catch { /* ignore */ }
    return null;
  }
}

export async function copyMarkdown(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}
