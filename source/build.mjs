// Assembles src/ into a single standalone file: dist/onionskyn.html
// Core, Runtime and the editor are bundled separately by esbuild (see docs/adr/0001).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (p) => path.join(root, 'src', p);
const read = (p) => fs.readFileSync(src(p), 'utf8');

// `import … from '@core'` resolves to a shim over window.FCCore, so Core is never bundled twice (see docs/adr/0001).
const coreAlias = {
  name: 'core-alias',
  setup(b) { b.onResolve({ filter: /^@core$/ }, () => ({ path: src('core-shim.js') })); }
};

const common = { plugins: [coreAlias], bundle: true, write: false, format: 'iife', target: 'esnext', charset: 'utf8', legalComments: 'inline', logLevel: 'warning' };

async function bundle(opts) {
  const r = await build({ ...common, ...opts });
  return r.outputFiles[0].text;
}

// The editor files still share one scope; they are joined until they become real modules.
const editorSrc = "'use strict';\n" + ['app1.js', 'app2.js', 'app3.js'].map(read).join('\n');

const [core, runtime, editor] = await Promise.all([
  // ES modules are strict, but esbuild's IIFE output drops that; Core has always run strict
  bundle({ entryPoints: [src('core/index.js')], banner: { js: "'use strict';" } }),
  bundle({ entryPoints: [src('runtime.js')] }),
  bundle({ stdin: { contents: editorSrc, resolveDir: src('.'), sourcefile: 'editor.js' } })
]);

for (const [name, code] of Object.entries({ core, runtime, editor })) {
  if (/<\/script/i.test(code)) throw new Error(name + ': bundle contains a closing script tag');
  try { new Function(code); } catch (e) { throw new Error(name + ': syntax error: ' + e.message); }
}

const head = read('head.html');
const [before, after] = head.split('<!--JSZIP-->');
const html = before +
  '<script>\n' + read('vendor/jszip.min.js') + '\n</script>' + after +
  '<script id="fcCore">\n' + core + '</script>\n' +
  '<script id="fcRuntime">\n' + runtime + '</script>\n' +
  '<script>\n' + editor + '</script>\n';

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
// the shipped file: full document with doctype and charset so it renders the same when opened from disk
const shipped = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' + html;
fs.writeFileSync(path.join(root, 'dist/onionskyn.html'), shipped);
console.log('dist/onionskyn.html', shipped.length, 'bytes');
