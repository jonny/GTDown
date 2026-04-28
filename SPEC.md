# GTDown Product Specification

## Overview

**GTDown** is a TaskPaper-inspired todo/task management application with a plain-text, keyboard-driven editing experience. It emphasizes simplicity, speed, and integration with the user's existing text workflow. The app is designed for quick task capture, organisation, and filtering without requiring a complex database or cloud backend.

**Tech Stack:**
- Frontend: React 19, TypeScript, CodeMirror 6
- Desktop: Tauri v2 (macOS, Windows, Linux)
- Build: Vite

**Platform Targets:**
- macOS desktop app (Tauri)
- Web browsers with File System Access API (Chrome, Edge)
- Fallback: any browser via `<input type="file">` (read-only)

---

## Data Model

GTDown works with plain-text files (`.md`, `.txt`, `.taskpaper`). The format is line-based and hierarchy-driven by indentation.

### Line Types

**Project Lines**
- Pattern: `^[^\t-].*:\s*$` — non-indented, ends with `:`, has non-whitespace content
- Examples: `Inbox:`, `Work:`, `Personal:`
- Semantics: Section headers that group related tasks

**Task Lines**
- Pattern: `^\s*- .*` — optional whitespace, then `- `, then content
- Examples: `	- Write the spec @today`, `	- Review PR @high`
- Semantics: An actionable item; the `- ` prefix is required
- Completion: add `@done` tag to mark complete

**Note Lines**
- Pattern: any indented, non-empty line that is not a task and not a project
- Examples: `	This is a note about the task above`
- Semantics: Free-form text associated with a task or project

**Empty Lines**
- Preserved in filtering logic; used as visual separators

### Tags and Labels

**@Tags (Contexts)**
- Pattern: `@[\w-]+`
- Examples: `@today`, `@done`, `@high`
- Special: `@done` marks a task complete

**#Labels (Categories)**
- Pattern: `#[\w-]+`
- Examples: `#work`, `#personal`

### Sample Document

```
Inbox:
	- Write the spec @today
	- Review PR @high
	- Read the docs

Work:
	- Fix login bug @done
	- Deploy to staging @done
	- Update dependencies @today

Personal:
	- Call dentist @today
	- Grocery run
	Remember to check if the store has oat milk

Done:
```

---

## Visual Rendering

### Project Lines
- **Class:** `.cm-project-line`
- **Style:** Bold, 1.1em, dark heading colour, bottom border
- Not decorated while the cursor is on that line

### Task Lines
- Default: normal text
- With `@done`: class `.cm-task-done` — strikethrough + 45% opacity

### Note Lines
- **Class:** `.cm-note-line`
- **Style:** 0.92em, muted colour
- Not decorated while the cursor is on that line

### Tags and Labels
- `@tags` — class `.cm-tag-at`, sky-blue colour, weight 500, slight border-radius
- `#labels` — class `.cm-tag-hash`, purple colour, weight 500, slight border-radius
- Neither is decorated on the cursor's current line

### Dark Mode
All colours use CSS custom properties; automatic via `@media (prefers-color-scheme: dark)`.

---

## Keyboard Shortcuts

| Shortcut | Behaviour |
|---|---|
| **Enter** | Context-aware line insertion (see below) |
| **Cmd+D** / Ctrl+D | Toggle `@done` on current task line |
| **Tab** | Indent current line (insert tab at line start) |
| **Shift+Tab** | Dedent — remove one tab or up to 2 spaces |
| **Backspace** | Delete empty `- ` task marker |
| **Escape** | Clear active @tag filter; if none, blur editor |
| **Opt+Cmd+↑** / Alt+Ctrl+↑ | Move selected line block up one line |
| **Opt+Cmd+↓** / Alt+Ctrl+↓ | Move selected line block down one line |
| **Cmd+S** / Ctrl+S | Manual save |
| **Cmd+Shift+C** / Ctrl+Shift+C | Copy document to clipboard as plain text |
| **Cmd+O** / Ctrl+O | Open file |
| **Cmd+N** / Ctrl+N | New file |

### Enter — Smart Insertion Rules

1. **Task line with content** → new task below at same indent
2. **Empty task line** → remove `- ` prefix, leave blank line
3. **Project line** → new tab-indented task beneath it (`\n\t- `)
4. **Indented note with content** → new task at same indent
5. **Empty indented note** → strip indentation, leave blank line
6. **Other** → default CodeMirror behaviour

### Move Line Block (Opt+Cmd+↑/↓)

- Block = lines covered by the current selection (collapsed selection = single line)
- If the selection ends exactly at the start of a line, that line is excluded from the block
- The block swaps with the line immediately above/below
- Cursor and selection position are preserved relative to the moved content
- No-op at the top (↑) or bottom (↓) of the document

---

## Toolbar / UI

### Left Side
- **Sidebar toggle** (☰) — show/hide sidebar
- **App title** — "GTDown"
- **File name** — current open file; shows `Last: {name}` (italic, muted) when no file is open

### Right Side

**Filter chips** (visible when a filter is active)
- Project chip — dark style, × to clear
- @Tag chip — blue style, × to clear
- #Label chip — purple style, × to clear

**Save status** (when a file is open)
- `Saved` — green
- `Unsaved` — muted
- `Saving…` — blue
- `Error saving` — red

**Action buttons**
- **Open** — file picker (Cmd+O)
- **New** — new file (Cmd+N)
- **Save** — manual save (Cmd+S)
- **Copy MD** — copy to clipboard; shows "Copied!" for 2 s (Cmd+Shift+C)
- **Archive Done** — move all `@done` tasks to the Done section

---

## File I/O

### Open

| Platform | Mechanism |
|---|---|
| Tauri | Native file picker; path stored in `localStorage` (`gtdown_last_path`) |
| Browser (FSA) | `showOpenFilePicker()`, handle stored for save-back |
| Browser fallback | `<input type="file">` — read only, no save-back |

### Save

| Platform | Mechanism |
|---|---|
| Tauri | `writeTextFile(path, content)` via Tauri fs plugin |
| Browser (FSA) | `FileSystemFileHandle.createWritable()` |
| Browser fallback | Download triggered on each save |

**Auto-save:** debounced 600 ms after each document change; also fires immediately on window blur.

### New File

| Platform | Mechanism |
|---|---|
| Tauri | Native save picker, default `todos.md` |
| Browser (FSA) | `showSaveFilePicker()`, default `todos.md` |
| Browser fallback | Download with filename `todos.md` |

### Last File Restoration
On launch (Tauri only), the last opened path is restored from `localStorage` without a permission prompt. If the file is missing, the stored path is cleared.

---

## Filtering System

Three independent filter axes — project, @tag, #label — combinable with AND logic.

### Activating Filters
- **Sidebar:** click a project, tag, or label
- **Editor:** Cmd/Ctrl+click on any `@tag` or `#label` in the text
- Clicking the same item again clears that filter

### Negative Filters
Prefix with `!` to exclude (e.g. `!@done` = show all non-done tasks). Used internally by the "Not Done" saved search.

### Visibility Algorithm (three passes)

1. **Task/note visibility** — a line is visible if it matches all active filters (project section, @tag, #label)
2. **Project header visibility** — a header is visible if it has at least one visible task/note
3. **Empty line visibility** — visible if their surrounding section has visible content; root-level empty lines always visible

Hidden lines are replaced with zero-height block widgets (collapsed, not removed).

### Clearing Filters
- Click the × on a toolbar filter chip
- Press **Escape** (clears @tag filter only)
- Click the same sidebar item again

### Saved Searches (sidebar, fixed)
| Name | Filter |
|---|---|
| Today | `@today` |
| Not Done | `!@done` |
| Done | `@done` |

---

## Archive Done

Moves all `@done` tasks from their original locations into a "Done:" section at the end of the document.

### Rules
1. Scan for task lines (`^\s*- `) containing `@done` that are not already inside a "Done:" section
2. If a "Done:" section exists, append the collected tasks at the bottom of it
3. If no "Done:" section exists, create one at the end of the document
4. Remove the original task lines from their source positions

### Before / After Example

**Before:**
```
Inbox:
	- Write the spec @done
	- Review PR

Work:
	- Fix login bug @done
	- Deploy to staging
```

**After:**
```
Inbox:
	- Review PR

Work:
	- Deploy to staging

Done:
	- Write the spec @done
	- Fix login bug @done
```

---

## Sidebar

Toggled by the ☰ button. Sections:

**Projects** — all project lines in document order; click to filter, click again to clear.

**Searches** — fixed saved searches (Today, Not Done, Done).

**Tags** — unique `@tags` found in the document, sorted alphabetically; hidden if none exist.

**Labels** — unique `#labels` found in the document, sorted alphabetically; hidden if none exist.

Empty state: "No projects yet" shown when no projects exist.

---

## Implementation Notes

- **Cursor-line decoration suppression:** decorations (project style, note style, tags) are not applied to the line the cursor is currently on, preventing flicker during editing.
- **Negative filters** (`!@tag`) are functional but not exposed in the UI beyond the fixed "Not Done" search.
- **Filter combining** is AND across all three axes simultaneously.
- **Last file restore** works on Tauri only; browsers require a user gesture to re-open a file handle.
