import { clone } from './util.js';
import { mkKf } from './factories.js';
import { kfIndexAt, kfAt, kfFor, evalLayerObjs, sortKfs } from './timeline-eval.js';

/* ---------- keyframe editing ---------- */
export function ensureEditable(layer, f) {
  const i = kfIndexAt(layer, f);
  if (i < 0) { const k = mkKf(f); layer.kfs.push(k); sortKfs(layer); return k; }
  const kf = layer.kfs[i], next = layer.kfs[i + 1];
  if (kf.f !== f && kf.tween !== 'none' && next) {
    const k = { f, objs: clone(evalLayerObjs(layer, f)), tween: kf.tween, ease: Object.assign({}, kf.ease, kf.ease && kf.ease.p ? { p: kf.ease.p.slice() } : {}) };
    layer.kfs.splice(i + 1, 0, k);
    return k;
  }
  return kf;
}
export function insertKeyframe(layer, f, blank) {
  const ex = kfAt(layer, f);
  if (ex) { if (blank) { ex.objs = []; ex.tween = 'none'; } return ex; }
  const cur = kfFor(layer, f);
  const k = mkKf(f, blank ? [] : clone(evalLayerObjs(layer, f)));
  if (cur && cur.tween !== 'none' && !blank) {
    const next = layer.kfs[layer.kfs.indexOf(cur) + 1];
    if (next) { k.tween = cur.tween; k.ease = Object.assign({}, cur.ease, cur.ease && cur.ease.p ? { p: cur.ease.p.slice() } : {}); }
  }
  layer.kfs.push(k); sortKfs(layer);
  return k;
}
export function insertFrames(layer, f, n, doc) {
  for (const k of layer.kfs) if (k.f > f) k.f += n;
  doc.frames += n;
}
export function removeFrames(layer, f, n, doc) {
  layer.kfs = layer.kfs.filter((k) => k.f === 0 || k.f < f || k.f >= f + n);
  for (const k of layer.kfs) if (k.f >= f + n) k.f -= n;
  const mx = Math.max(...doc.layers.map((l) => l.kfs[l.kfs.length - 1].f)) + 1;
  doc.frames = Math.max(mx, doc.frames - n, 1);
}
export function clearKeyframe(layer, f) {
  const k = kfAt(layer, f);
  if (!k || f === 0) return false;
  layer.kfs.splice(layer.kfs.indexOf(k), 1);
  return true;
}
export function moveKeyframe(layer, from, to) {
  const k = kfAt(layer, from);
  if (!k || from === 0 || to <= 0 || kfAt(layer, to)) return false;
  k.f = to; sortKfs(layer);
  return true;
}
/* returns {ok, msg} ; creates an end keyframe at the last doc frame when none follows */
export function setTweenAt(doc, layer, f, type) {
  const i = kfIndexAt(layer, f);
  if (i < 0) return { ok: false, msg: 'No keyframe here.' };
  const kf = layer.kfs[i];
  if (type === 'none') { kf.tween = 'none'; return { ok: true }; }
  let next = layer.kfs[i + 1];
  let msg = '';
  if (!next) {
    const last = doc.frames - 1;
    if (last <= kf.f) return { ok: false, msg: 'Add frames after this keyframe first.' };
    next = mkKf(last, clone(kf.objs));
    layer.kfs.push(next); sortKfs(layer);
    msg = 'Added an end keyframe at frame ' + (last + 1) + '.';
  }
  kf.tween = type;
  return { ok: true, msg };
}
