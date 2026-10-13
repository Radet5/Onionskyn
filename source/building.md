# Building from source

Onionskyn ships as one standalone HTML file, but that file is a build output. The source is split into a few small files in `src/`, and `build.sh` (which runs `build.mjs`) bundles them with esbuild into one file.

## Layout

| File | What it holds |
|---|---|
| `src/head.html` | The page markup and all the CSS |
| `src/core.js` | The document model: layers, keyframes, tweens, shapes, rendering, import and export |
| `src/runtime.js` | The small player that runs exported animations |
| `src/app1.js` | Editor state, history (undo and redo), stage rendering and overlays |
| `src/app2.js` | Tools: pen, pencil, brush, fluid brush, paint bucket, selection, gradients |
| `src/app3.js` | Panels, the Properties tabs, menus, shortcuts, saving and loading |
| `src/vendor/jszip.min.js` | JSZip, inlined for `.fla` import and project export (see `THIRD-PARTY.md`) |

`app1.js`, `app2.js` and `app3.js` are joined into one scope, so they share functions and variables, until they are split into real modules. `core.js` and `runtime.js` are bundled as separate scripts because HTML exports embed them (see `docs/adr/0001-esbuild-bundles-with-global-core.md` at the repo root). Never write a closing script tag inside a source file, because the build inlines everything into `<script>` blocks.

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
| `smoke2`, `beta` | Broad editor smoke tests, project save and load, the problem report |
| `brush`, `fluid`, `merge` | Brush tools, the Fluid Brush and its tab, stroke merging |
| `bucket`, `gradient` | Region fill, gradient editing and handles |
| `ease`, `mask`, `clip`, `sym`, `symdel` | Easing, masks, clipping, symbols |
| `xss`, `explimit`, `audit1` to `audit3` | Escaping in exports, export limits, long action sequences |

Test fixtures live in `test/fixtures/`.

## Notes for contributors

- Saved settings keep the `flashcraft.*` prefix in `localStorage` (the project's original name), so existing users keep their data.
- Rendering code is shared by the editor, the exports and the runtime, so a change to how a shape draws needs checking in all three.
- When you add a feature, add a suite for it and list it in `test/all.sh`.
