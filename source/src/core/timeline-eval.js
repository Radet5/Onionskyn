import { lerp, nz } from './util.js';
import { lerpHex } from './color.js';
import { entriesToObjs } from './mask.js';
import { ease } from './easing.js';
import { morphContours } from './morph.js';

let _lib = {};            /* symbol library of the current document (name -> {layers, frames}) */
let _ctxEl = null;        /* unwrapped elapsed frames of the enclosing clip (movie clips nested in clips keep playing) */
export function setLib(l) { _lib = l || {}; }
export function kidsOf(o) {
  if (o.kind === 'group') return o.children || [];
  if (o.kind === 'clip') {
    const lib = _lib[o.sym];
    if (!lib) return [];
    const f = o._f || 0, ents = [], prev = _ctxEl;
    _ctxEl = o._el == null ? null : o._el;
    for (const l of lib.layers) { if (l.visible === false) continue; ents.push({ layer: l, objs: evalLayerObjs(l, f) }); }
    _ctxEl = prev;
    return entriesToObjs(ents);
  }
  return [];
}
/* ---------- timeline evaluation ---------- */
function lerpT(a, b, p) { return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), sx: lerp(a.sx, b.sx, p), sy: lerp(a.sy, b.sy, p), r: lerp(a.r, b.r, p) }; }
function lerpPaint(o, a, b, p) {
  for (const k of ['fill', 'stroke']) {
    const ak = k === 'fill' ? 'fa' : 'sa';
    const ca = a[k], cb = b[k];
    if (ca && cb) { o[k] = lerpHex(ca, cb, p); o[ak] = lerp(nz(a[ak], 1), nz(b[ak], 1), p); }
    else if (ca || cb) { o[k] = ca || cb; o[ak] = lerp(ca ? nz(a[ak], 1) : 0, cb ? nz(b[ak], 1) : 0, p); }
  }
  o.sw = lerp(a.sw || 0, b.sw || 0, p);
}
function lerpObj(a, b, p, mode) {
  const o = Object.assign({}, a);
  o.t = lerpT(a.t, b.t, p);
  o.op = lerp(nz(a.op, 1), nz(b.op, 1), p);
  if (a.kind === 'text' && b.kind === 'text') { lerpPaint(o, a, b, p); return o; }
  if (a.kind === 'path' && b.kind === 'path') {
    lerpPaint(o, a, b, p);
    if (a.grad && b.grad && a.grad.type === b.grad.type && a.grad.stops.length === b.grad.stops.length) {
      o.grad = { type: a.grad.type, stops: a.grad.stops.map((s, i) => ({ o: lerp(s.o, b.grad.stops[i].o, p), c: lerpHex(s.c, b.grad.stops[i].c, p), a: lerp(nz(s.a, 1), nz(b.grad.stops[i].a, 1), p) })), m: a.grad.m && b.grad.m ? a.grad.m.map((v, i) => lerp(v, b.grad.m[i], p)) : (a.grad.m || b.grad.m) };
    }
    if (mode === 'shape') { const m = morphContours(a.contours, b.contours, p); if (m) o.contours = m; }
  }
  return o;
}
export function kfIndexAt(layer, t) {
  let idx = -1;
  for (let i = 0; i < layer.kfs.length; i++) { if (layer.kfs[i].f <= t) idx = i; else break; }
  return idx;
}
export function kfAt(layer, f) { return layer.kfs.find((k) => k.f === f) || null; }
export function kfFor(layer, f) { const i = kfIndexAt(layer, f); return i < 0 ? null : layer.kfs[i]; }
function withClips(layer, i, t, objs) {
  let any = false;
  for (const o of objs) if (o.kind === 'clip') { any = true; break; }
  if (!any) return objs;
  return objs.map((o) => {
    if (o.kind !== 'clip') return o;
    const lib = _lib[o.sym], n = lib ? lib.frames : 1;
    let start;
    if (o.mc) { let j = i; while (j > 0 && layer.kfs[j - 1].objs.some((x) => x.id === o.id && x.kind === 'clip')) j--; start = layer.kfs[j].f; }
    else start = layer.kfs[i].f;
    /* playback mode and first frame belong to graphic symbols (as in Animate); a movie clip always loops from its first frame */
    const el = Math.max(0, (o.mc && _ctxEl != null ? _ctxEl : t) - start), first = o.mc ? 0 : (o.first || 0), mode = o.mc ? 'loop' : o.mode;
    const f = mode === 'single' ? first : mode === 'once' ? Math.min(first + el, n - 1) : (first + el) % n;
    const c = Object.assign({}, o);
    Object.defineProperty(c, '_f', { value: f, enumerable: false });
    Object.defineProperty(c, '_el', { value: el, enumerable: false });
    return c;
  });
}
/* which object in the next keyframe each object tweens to: same id first; for a shape tween, leftover shapes pair up in drawing order, so drawing a new shape in a blank keyframe still morphs */
export function tweenPairs(kf, next) {
  const byId = new Map(next.objs.map((o) => [o.id, o])), pairs = new Map(), used = new Set();
  for (const a of kf.objs) { const b = byId.get(a.id); if (b && b.kind === a.kind) { pairs.set(a, b); used.add(b); } }
  if (kf.tween === 'shape') {
    const free = next.objs.filter((o) => o.kind === 'path' && !used.has(o));
    let q = 0;
    for (const a of kf.objs) if (!pairs.has(a) && a.kind === 'path' && q < free.length) pairs.set(a, free[q++]);
  }
  return pairs;
}
/* how many shapes in a shape tween cannot morph smoothly (different part counts or open/closed mismatch) */
export function shapeTweenIssues(layer, f) {
  const i = kfIndexAt(layer, f); if (i < 0) return 0;
  const kf = layer.kfs[i], next = layer.kfs[i + 1]; if (!next) return 0;
  let n = 0;
  for (const [a, b] of tweenPairs(kf, next)) if (a.kind === 'path' && b.kind === 'path' && !morphContours(a.contours, b.contours, 0.5)) n++;
  return n;
}
export function evalLayerObjs(layer, t) {
  const i = kfIndexAt(layer, t);
  if (i < 0) return [];
  const kf = layer.kfs[i], next = layer.kfs[i + 1];
  if (kf.tween && kf.tween !== 'none' && next && t > kf.f) {
    const p = (t - kf.f) / (next.f - kf.f);
    const e = ease(kf.ease && kf.ease.type, kf.ease && kf.ease.amt, p, kf.ease && kf.ease.p);
    const pairs = tweenPairs(kf, next);
    return withClips(layer, i, t, kf.objs.map((a) => { const b = pairs.get(a); return b ? lerpObj(a, b, e, kf.tween) : a; }));
  }
  return withClips(layer, i, t, kf.objs);
}
export function evalDoc(doc, t) {
  _lib = doc.lib || {};
  return doc.layers.map((layer) => ({ layer, objs: layer.visible === false ? [] : evalLayerObjs(layer, t) }));
}
export function sortKfs(layer) { layer.kfs.sort((a, b) => a.f - b.f); }
