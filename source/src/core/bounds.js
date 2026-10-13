import { newT, matOf, mmul, mapply, decompose } from './matrix.js';
import { contoursBounds } from './path.js';
import { layoutText } from './text.js';
import { kidsOf } from './timeline-eval.js';

export function localBounds(o) {
  if (o.kind === 'path') return contoursBounds(o.contours);
  if (o.kind === 'text') { const l = layoutText(o); return { x0: 0, y0: 0, x1: Math.max(l.w, 1), y1: Math.max(l.h, 1) }; }
  if (o.kind === 'image') return { x0: 0, y0: 0, x1: Math.max(o.w || 1, 1), y1: Math.max(o.h || 1, 1) };
  let b = null;
  for (const ch of kidsOf(o)) {
    const cb = localBounds(ch);
    if (!cb) continue;
    const m = matOf(ch.t);
    for (const [x, y] of [[cb.x0, cb.y0], [cb.x1, cb.y0], [cb.x1, cb.y1], [cb.x0, cb.y1]]) {
      const p = mapply(m, x, y);
      if (!b) b = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] };
      else { b.x0 = Math.min(b.x0, p[0]); b.y0 = Math.min(b.y0, p[1]); b.x1 = Math.max(b.x1, p[0]); b.y1 = Math.max(b.y1, p[1]); }
    }
  }
  if (b && o.kind === 'clip' && o.pv) { b.x0 -= o.pv[0]; b.x1 -= o.pv[0]; b.y0 -= o.pv[1]; b.y1 -= o.pv[1]; }
  return b;
}
export function worldCorners(o, pm) {
  const b = localBounds(o);
  if (!b) return null;
  const m = pm ? mmul(pm, matOf(o.t)) : matOf(o.t);
  return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map((p) => mapply(m, p[0], p[1]));
}
export function worldBounds(o) {
  const c = worldCorners(o);
  if (!c) return null;
  const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
/* shift a path's nodes so its bounds centre becomes the local origin */
export function recenter(o) {
  if (o.kind !== 'path') return o;
  const b = contoursBounds(o.contours);
  if (!b) return o;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  for (const c of o.contours) for (const n of c.nodes) { n.x -= cx; n.y -= cy; }
  if (o.grad) o.grad.m = mmul([1, 0, 0, 1, -cx, -cy], o.grad.m);
  const p = mapply(matOf(o.t), cx, cy);
  o.t.x = p[0]; o.t.y = p[1];
  return o;
}
export function applyMatrixToNodes(contours, m) {
  for (const c of contours) for (const n of c.nodes) {
    const p = mapply(m, n.x, n.y);
    const i = [m[0] * n.ix + m[2] * n.iy, m[1] * n.ix + m[3] * n.iy];
    const o = [m[0] * n.ox + m[2] * n.oy, m[1] * n.ox + m[3] * n.oy];
    n.x = p[0]; n.y = p[1]; n.ix = i[0]; n.iy = i[1]; n.ox = o[0]; n.oy = o[1];
  }
}
/* assign full matrix m to object (bakes skew into geometry when needed) */
export function setObjMatrix(o, m) {
  const d = decompose(m);
  if (d.skew < 1e-3 || o.kind === 'clip' || o.kind === 'text' || o.kind === 'image') { o.t = { x: d.x, y: d.y, sx: d.sx, sy: d.sy, r: d.r }; return o; }
  if (o.kind === 'path') {
    applyMatrixToNodes(o.contours, m);
    if (o.grad) o.grad.m = mmul(m, o.grad.m);
    o.t = newT();
  } else {
    const kids = o.children || [];
    o.t = newT();
    for (const ch of kids) setObjMatrix(ch, mmul(m, matOf(ch.t)));
  }
  return o;
}
