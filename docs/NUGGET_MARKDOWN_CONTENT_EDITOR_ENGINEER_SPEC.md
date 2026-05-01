# Nugget / article body content editor — engineer recreation spec

This document describes the **non-WYSIWYG** content editor used when authors write the body text that later appears on article/nugget cards. Another engineer can use it to reimplement the same behavior in this codebase or elsewhere.

---

## 1. Executive summary

| Aspect | Detail |
|--------|--------|
| **Paradigm** | **Markdown as plain text** in a native `<textarea>`, not a contenteditable WYSIWYG surface. |
| **Primary implementation** | Custom React component `RichTextEditor` (`src/components/RichTextEditor.tsx`). |
| **Rich-text dependency** | **None.** No TipTap, ProseMirror, Quill, Slate, CodeMirror, Monaco, etc. for this field. |
| **Rendered output** | Stored string is Markdown; cards and detail views render with **`react-markdown`** + **`remark-gfm`** (display path is separate from the editor). |

The component name `RichTextEditor` is **historical/misleading**: it means “helpers for rich-ish text,” not HTML-in-the-edit-surface.

---

## 2. Component layering

Bottom-up:

1. **`RichTextEditor`** — textarea, toolbar inserts Markdown, paste normalization.
2. **`ContentEditor`** — thin wrapper: wires `RichTextEditor`, optional error/warning lines, validates image files before `onImagePaste`, clears errors on edit (`src/components/CreateNuggetModal/ContentEditor.tsx`).
3. **`NuggetContentEditorPanel`** — optionally lazy-loads `ContentEditor` in a `<Suspense>` boundary for bundle splitting (`src/components/CreateNuggetModal/NuggetContentEditorPanel.tsx`).

**Call sites:**

- **`CreateNuggetModal`** passes `content` state, `setContent`, `onImagePaste` (upload pipeline), validation hooks, plus legacy props `isAiLoading` / `onAiSummarize` (stubs/unused AI path).
- **`AdminConfigPage`** uses `RichTextEditor` directly for some admin copy fields (same editor primitives).

Lazy loading is controlled by `isNuggetEditorLazySplitEnabled()` → `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` (default **true** — editor in async chunk). Set to `false` to inline editor in the main modal chunk (`src/config/nuggetPerformanceConfig.ts`).

---

## 3. Public API — `RichTextEditor`

### Props (`RichTextEditorProps`)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | yes | Controlled Markdown body. |
| `onChange` | `(value: string) => void` | yes | Parent receives updated Markdown. |
| `placeholder` | `string` | no |textarea `placeholder`. |
| `className` | `string` | no | Applied to outer wrapper (`space-y-2 ${className}`). Default `''`. Used e.g. for `min-h-[120px]`. |
| `label` | `string` | no | Optional `<label>` above the control. |
| `error` | `string` | no | Shows small red helper under the chrome (duplicated/error UX sometimes lives in parent instead). |
| `onImagePaste` | `(file: File) => void` | no | Called per pasted image **file** when clipboard contains images. |

### DOM / styling (reference)

- Outer: bordered rounded container (`rounded-xl`), light/dark background, `focus-within:ring-2` on primary color.
- Toolbar: row of icon buttons, bottom border, horizontal scroll if needed.
- Textarea: full width, `min-h-[200px]` in base component (overridable via parent `className` on wrapper only for min-height on container — note the **textarea** itself hardcodes `min-h-[200px]` in the component), `font-mono`, `text-sm`, `resize-y`, transparent background, no visible border (chrome provides border).

*Recreation note:* If you need a single `min-height` for the whole control, adjust the **textarea** `className` in your port; upstream passes `className="min-h-[120px]"` on the **wrapper** but the inner textarea still uses `min-h-[200px]` — be aware of that nuance when matching pixel-perfect layout.

---

## 4. Public API — `ContentEditor`

Extends behavior around `RichTextEditor`:

| Prop | Type | Notes |
|------|------|--------|
| `value` / `onChange` | `string` / callback | Forwarded to `RichTextEditor` via `handleChange`. |
| `isAiLoading` | `boolean` | **Unused** (backward compatibility). |
| `onAiSummarize` | `() => void` | **Unused** (backward compatibility). |
| `onImagePaste` | `(file: File) => void` | Optional; only invoked if `isImageFile(file)` where `isImageFile` = `file.type.startsWith('image/')` (`src/utils/imageOptimizer.ts`). |
| `error` / `warning` | `string \| null` | Rendered under editor; styling differs (error vs amber warning). |
| `onTouchedChange` | `(touched: boolean) => void` | Set `true` on any change. |
| `onErrorChange` | `(error: string \| null) => void` | When user types and `error` was set, parent error cleared via `null`. |

Default placeholder in modal path:

`Share an insight, observation, or paste content... (You can also paste images directly here)`

---

## 5. Local state vs parent sync (`RichTextEditor`)

The editor keeps **`localValue`** in React state synced from **`value`**, but avoids fighting the parent on every keystroke in edge cases.

### Rules

1. **`lastEmittedToParentRef`** — If incoming `value` equals what we last pushed to the parent, treat it as an **echo** and do not reset local state from parent.
2. **`flushGenerationRef`** — Incremented when parent `value` changes for real (not echo) or on blur invalidation; pending microtasks check generation and **abort** if stale.
3. **`queueDeferredParentFlush`** — First change schedules **one** `queueMicrotask` that calls `onChange` with the pending string. Coalesces rapid updates so heavy parent work does not run before paint.
4. **`compositionRef` / IME** — On `compositionstart`, bump generation, cancel scheduled flush flags, set composing. On `compositionend`, sync local value and call `scheduleParentSync`. During composition, **do not** flush to parent via microtask (only update local state).
5. **`onBlur`** — **`flushParentSyncNow`**: bump generation, cancel deferred flush, set `lastEmittedToParentRef` to current local value, call **`onChange` immediately**.

### Implementation intent

- Responsive typing (local state updates on every `onChange` from textarea).
- Safer IME (CJK, etc.).
- Parent gets batched updates per microtask while focused; guaranteed final value on blur.

---

## 6. Toolbar — exact Markdown insert semantics

All operations use `textarea.selectionStart` / `selectionEnd` and `localValue` (current text). After mutation, restore focus and selection.

### Wrapping selection (`insertFormat(startTag, endTag)`)

- `newText = before + startTag + selectedText + endTag + after`
- Caret after insert: **`[start + startTag.length, end + startTag.length]`** — i.e. selection spans the former selection, now inside the wrappers.

Mappings:

| Control | Behavior |
|---------|----------|
| Bold | `insertFormat('**', '**')` |
| Italic | `insertFormat('*', '*')` |
| Inline code | `insertFormat('`', '`')` |
| Link | `insertFormat('[', '](url)')` |

### Line-prefix (`insertLineFormat(prefix)`)

- Find **`lineStart`** = index after last `\n` before caret (or `0`).
- Insert `prefix` at `lineStart`: `before + prefix + after`
- Caret moves forward by **`prefix.length`**.

Mappings:

| Control | Prefix |
|---------|--------|
| H1 | `# ` |
| H2 | `## ` |
| Bullet list | `- ` |
| Numbered list | `1. ` |
| Quote | `> ` |

Toolbar buttons are plain `<button type="button">` with Lucide icons; **`title`** attribute carries the tooltip text.

---

## 7. Paste handling

Handled in **`onPaste`** on the textarea. Order matters.

### 7.1 Image paste

1. Iterate `e.clipboardData.items`.
2. For each item, detect image: `type` starts with `image/` or `kind === 'file'` with type containing `image`.
3. `getAsFile()`; validate size/type heuristics (including empty `type` + size &lt; 50MB treated as possible image).
4. If `type` missing, synthesize a `File` with name `screenshot-{timestamp}-{index}.png` and inferred MIME.
5. If **any** images collected: **`preventDefault` + `stopPropagation`**, then for each file call **`onImagePaste(file)`** if provided; **`return`** (do not fall through to HTML paste).

**CreateNuggetModal** batches multiple images from one paste via a short `setTimeout` and upload pipeline — that batching is **modal-specific**, not inside `RichTextEditor`.

### 7.2 HTML paste

If `text/html` is present:

1. **`preventDefault`**.
2. Read `text/plain` as fallback.
3. If `html.length > 96_000` (**`MAX_SYNC_HTML_CLIPBOARD_CHARS`**): insert **`plainText`** only (avoid main-thread freeze from DOM parse + tree walk).
4. Else: parse HTML with **`DOMParser`**, `parseFromString(html, 'text/html')`, walk **`doc.body`** with recursive **`processNode`** to emit Markdown string.
5. If conversion yields empty string, use **`plainText`**.
6. Replace selection with resulting string and move caret to end of insertion.

Optional: in development, **`performance.mark` / `performance.measure`** around conversion for profiling.

### 7.3 `text/plain` only

No special case: **browser default paste** (no `preventDefault`).

---

## 8. HTML → Markdown conversion (must match for fidelity)

Recursive rules on **`HTMLElement.tagName`** (lowercase):

| Tag | Output pattern |
|-----|----------------|
| `#text` | `textContent` |
| `strong`, `b` | `**content**` if trimmed non-empty |
| `em`, `i` | `*content*` if trimmed non-empty |
| `p` | `\n\n{trim}\n` if trimmed |
| `br` | `\n` |
| `a` | `[text](href)` if `href` else text |
| `ul`, `ol` | wrap with newlines `\n...\n` |
| `li` | `- {trim}\n` |
| `h1` | `\n# {trim}\n\n` |
| `h2` | `\n## {trim}\n\n` |
| `h3` | `\n### {trim}\n\n` |
| `blockquote` | `\n> {trim}\n\n` |
| `code` | `` `{content}` `` |
| `pre` | fenced block `\n```\n{content}\n```\n` |
| `div` | `\n{content}\n` |
| default / unknown | children concatenation only |

Post-process: **`markdown.replace(/\n{3,}/g, '\n\n').trim()`**.

---

## 9. Dependencies (frontend)

Editor **does not** add npm packages beyond a typical React stack. Display stack (elsewhere):

- `react-markdown`
- `remark-gfm`
- `@tailwindcss/typography` (typography styling for rendered Markdown — separate from editor)

Icons: **`lucide-react`** for toolbar icons.

---

## 10. Testing / QA checklist for a port

- [ ] Toolbar wrap and line-prefix edits preserve undo expectations (native textarea undo may group oddly across programmatic selection changes — acceptable if matching current app).
- [ ] IME: compose a character without dropping characters or syncing parent mid-composition.
- [ ] Blur forces parent to latest string.
- [ ] Paste small HTML from Word/browser → Markdown approximates structure.
- [ ] Paste huge HTML → plain text path, no hang.
- [ ] Paste screenshot / image → `onImagePaste` fires, default paste suppressed.
- [ ] Controlled `value` reset from parent (e.g. form reset) updates textarea when not an echo of local `onChange`.

---

## 11. File reference map

| File | Purpose |
|------|---------|
| `src/components/RichTextEditor.tsx` | Core editor |
| `src/components/CreateNuggetModal/ContentEditor.tsx` | Form wrapper + validation UX |
| `src/components/CreateNuggetModal/NuggetContentEditorPanel.tsx` | Lazy vs sync `ContentEditor` |
| `src/components/CreateNuggetModal.tsx` | State, validation, image upload on paste |
| `src/config/nuggetPerformanceConfig.ts` | `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` |
| `src/utils/imageOptimizer.ts` | `isImageFile` |
| `src/components/card/atoms/CardContent.tsx` | Card body render path (Markdown renderer, not editor) |

---

## 12. Explicit non-goals (current design)

- No live preview pane inside the editor (preview is the rendered card/detail view).
- No collaborative cursors or CRDT.
- No sanitizer inside the textarea (sanitization belongs at render or server if required by product policy).

---

*Spec generated from implementation in Project Phoenix; update this doc if `RichTextEditor.tsx` behavior changes.*
