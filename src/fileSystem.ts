const LAST_PATH_KEY = 'gtdown_last_path';

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
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
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
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
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
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
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

// Tauri only — browsers can't reopen a file by path without a user gesture
export async function restoreLastFile(): Promise<{ path: string; content: string; name: string } | null> {
  if (!isTauri()) return null;
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
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
