# GTDown

A TaskPaper-inspired todo app with a plain-text, keyboard-driven editing experience. Available as a macOS desktop app (Tauri) and in the browser.

## File format

```
Project:
    - task @context #label
    - completed task @done
    plain note text
```

Projects are lines ending in `:`. Tasks start with `- `. Notes are any other indented line.

## Features

- **Filtering** — click a project, tag, or label in the sidebar to filter the view. Filters combine.
- **Archive Done** — moves all `@done` tasks into a `Done:` section at the bottom of the document.
- **Auto-save** — saves on every keystroke (when a file is open) and on window blur.
- **Drag to reorder** — drag handle on each line to reorder tasks.
- **Open/save** — works with any `.md`, `.txt`, or `.taskpaper` file.

## Running locally

```bash
npm install
npm run dev               # web app at http://localhost:5173
npx @tauri-apps/cli dev   # desktop app (requires Rust)
```

## Building the desktop app

```bash
npx @tauri-apps/cli build
# → src-tauri/target/release/bundle/dmg/GTDown_0.1.0_aarch64.dmg
```

> First launch on other machines: right-click → Open to bypass Gatekeeper (app is unsigned).

## Stack

Vite · React · TypeScript · CodeMirror 6 · Tauri v2
