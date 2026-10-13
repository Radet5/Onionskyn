# ES modules bundled by esbuild, with Core shared through `window.FCCore`

The source is split into ES modules, and esbuild bundles three separate IIFE entries (Core, Runtime, editor) that get inlined into the single shipped HTML file. Editor code writes `import … from '@core'`, and the build aliases that to a shim that re-exports `window.FCCore`. It does not bundle Core's source a second time.

Two constraints force this. First, HTML exports embed the Core and Runtime scripts by reading their own `<script id="fcCore">`/`<script id="fcRuntime">` text, so Core has to stay a standalone script. Second, Core holds module-level state (the active Library, loaded images, the text-measuring context), so a second bundled copy would split that state and silently break rendering.

## Considered Options

- **Concatenate smaller files into one shared scope** (the original approach): no tooling, but dependencies stay implicit.
- **Native `<script type="module">`**: breaks opening the file from `file://` and breaks single-file shipping.
- **Bundle Core into the editor**: duplicates Core's state and breaks embedding in exports.
