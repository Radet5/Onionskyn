# Building from source

Onionskyn ships as one standalone HTML file, but that file is a build output. The source is split into a few small files in `src/`, and `build.sh` (which runs `build.mjs`) bundles them with esbuild into one file.

## Layout

| File | What it holds |
|---|---|
| `src/head.html` | The page markup and all the CSS |
| `src/core/` | Core, as ES modules: the document model, tweens, shapes, rendering, import and export (table below) |
| `src/core-shim.js` | What `import … from '@core'` resolves to: `window.FCCore`, so Core is never bundled twice |
| `src/runtime.js` | The small player that runs exported animations |
| `src/app1.js` | Editor state, history (undo and redo), stage rendering and overlays |
| `src/app2.js` | Tools: pen, pencil, brush, fluid brush, paint bucket, selection, gradients |
| `src/app3.js` | Panels, the Properties tabs, menus, shortcuts, saving and loading |
| `src/vendor/jszip.min.js` | JSZip, inlined for `.fla` import and project export (see `THIRD-PARTY.md`) |

`app1.js`, `app2.js` and `app3.js` are joined into one scope, so they share functions and variables, until they are split into real modules. Core (`src/core/index.js`) and `runtime.js` are bundled as separate scripts because HTML exports embed them (see `docs/adr/0001-esbuild-bundles-with-global-core.md` at the repo root). Never write a closing script tag inside a source file, because the build inlines everything into `<script>` blocks.

Core modules in `src/core/`:

| Module | What it holds |
|---|---|
| `index.js` | Builds the `FCCore` object and puts it on `window`. Its key set is fixed: Runtime and HTML exports depend on it |
| `util.js` | `uid`, `clamp`, `lerp`, `clone`, `nz` |
| `color.js`, `matrix.js` | Hex colours; 2D matrices and Object transforms |
| `path.js` | Bezier contours: tracing, SVG path data, bounds, splitting |
| `image.js` | Loaded bitmaps (set with `setImages`) |
| `mask.js` | Mask layer grouping and the scratch canvases used for masks and group alpha |
| `text.js` | Text measuring (set with `setMeasure`) and layout |
| `bounds.js` | Object bounds and baking matrices into Objects |
| `factories.js` | The document model: `mkDoc`, `mkLayer`, `mkKf`, `mkPath`, `normalizeDoc` |
| `easing.js`, `morph.js` | Ease curves; Shape tween contour morphing |
| `timeline-eval.js` | Evaluating a Timeline at a Frame, including Symbol instances (the Library is set with `setLib`) |
| `keyframe-edit.js` | Inserting, moving and clearing Keyframes and Frames, setting Tweens |
| `render.js` | Drawing Objects to a canvas and hit testing |
| `svg.js`, `gif.js` | SVG export; the GIF encoder |
| `fla-import.js` | `.fla`/XFL import |

## Build

You need Node.js 18 or newer and `npm install` (for esbuild).

```bash
./build.sh
```

This writes `dist/onionskyn.html`, checks the syntax of every inline script, and prints the file size. That file is the whole app: open it straight from disk, or publish it as `index.html` on GitHub Pages.

## Tests

The tests drive the real app in headless Chromium and check the document model and rendering.

```bash
npm install
npx playwright install chromium
npm test
```

`npm test` rebuilds the app and then runs each suite, printing one `PASS` or `FAIL` line per suite. It takes a few minutes. To run one suite, use `node test/bucket.js`, for example.

| Suite | Covers |
|---|---|
| `core`, `flaedge` | Document model, GIF writer, `.fla` import edge cases |
| `harness` | The shared browser harness: a failed check, page error or console error fails a suite, and `T.undoable` catches an action that skips history |
| `smoke2`, `beta` | Broad editor smoke tests, project save and load, the problem report |
| `roundtrip` | Saving the rich fixture Document with Ctrl+S and reopening it, and opening the golden v2 Project file; nothing may change |
| `sparse` | Opening sparse, malformed and foreign files: defaults for missing fields, Keyframe repair, the 900 frame maximum, bare Documents, the newer-version warning, rejecting other files |
| `persist` | Autosave and reload: the rich fixture Document comes back equal, with every Image and Sound restored from browser storage |
| `parity` | Export parity: the rich fixture Document at several Frames (Keyframes, mid Tweens, inside a looping Movie clip) drawn by the editor, the exported HTML5 player and the SVG export must match pixel for pixel: no more than 0.05% of pixels may differ by more than 48 in any channel |
| `pixels` | Rendering held to fixed colours at chosen Stage points, so a Core bug that breaks the editor and every export alike still fails: Motion and Shape tween midpoints, Graphic modes, a Movie clip playing while its parent stands still (in the editor and the player), Group alpha, linear and radial gradients, Text and Images |
| `brush`, `fluid`, `merge` | Brush tools, the Fluid Brush and its tab, stroke merging |
| `bucket`, `gradient` | Region fill, gradient editing and handles |
| `ease`, `mask`, `clip`, `symdel` | Easing, Masks, Symbol instance type and Graphic modes (with undo), Symbols |
| `xss`, `explimit`, `audit1` to `audit3` | Escaping in exports, export limits, long action sequences where undo and redo must restore each action exactly |

Test fixtures live in `test/fixtures/`. Two helpers are there for any suite to use:

- `test/fixture_doc.js`: `richDoc()` returns the rich fixture Document, with every Object kind, both Tween types, a bezier Ease, a Mask layer, nested Symbols, a Sound, frame labels and Keyframe scripts.
- `test/doc_compare.js`: `diffDocs(a, b, {ignore})` compares two Documents and returns `null`, or a line naming the first field that differs.

`test/fixtures/rich-v2.onionskyn.json` is the fixture as the app saved it in Project file format version 2. It stands in for a user's old file, so never regenerate or edit it: the suite requires it to keep opening to a Document equal to `richDoc()`. When the format version goes up, keep it and its check, and add a golden file for the new version beside it. `WRITE_GOLDEN=1 node test/roundtrip.js` writes the golden file only when it is missing. If you change `richDoc()`, the golden check fails, because the old file does not contain the change; give the new content its own fixture or golden file instead.

## Notes for contributors

- Saved settings keep the `flashcraft.*` prefix in `localStorage` (the project's original name), so existing users keep their data.
- Rendering code is shared by the editor, the exports and the runtime, so a change to how a shape draws needs checking in all three. The `parity` suite compares them for the rich fixture Document. The `pixels` suite checks what the editor draws (and the player, for a Movie clip) against fixed colours, which catches a Core change that breaks all three alike. A new Object kind or drawing option is not compared until a Document the `parity` suite draws holds it; adding it to `richDoc()` also needs a new golden file (see Tests).
- When you add a feature, add a suite for it and list it in `test/all.sh`.
- Browser suites start with `start()` from `test/audit_lib.js` and end with `await T.finish()`, so a failed `T.ok` check or any page or console error makes the suite exit non-zero. In new or changed test code, wait on a condition (`page.waitForFunction`) rather than a fixed `waitForTimeout`.
- Run an action that changes the Document through `T.undoable(name, fn)` instead of `T.step`. It requires the action to change the Document and add exactly one history entry, then requires undo to give back the Document from before and redo the Document from after. A `fn` must be one user action, so split a step that does several.
