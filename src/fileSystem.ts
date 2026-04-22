import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const LAST_PATH_KEY = 'tadalist_last_path';

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

export async function openFile(): Promise<{ path: string; content: string; name: string } | null> {
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

export async function saveFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

export async function saveNewFile(content: string): Promise<{ path: string; name: string } | null> {
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

// On startup: try to reopen the last file directly — no permission prompt needed in Tauri
export async function restoreLastFile(): Promise<{ path: string; content: string; name: string } | null> {
  try {
    const path = localStorage.getItem(LAST_PATH_KEY);
    if (!path) return null;
    const content = await readTextFile(path);
    return { path, content, name: pathToName(path) };
  } catch {
    // File moved/deleted — clear the stale path
    try { localStorage.removeItem(LAST_PATH_KEY); } catch { /* ignore */ }
    return null;
  }
}

export async function copyMarkdown(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}
