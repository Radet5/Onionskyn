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
