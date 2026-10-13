import { clamp, nz } from './util.js';
import { rgba } from './color.js';
import { matOf, minv, mapply } from './matrix.js';
import { tracePath } from './path.js';
import { _images, imgEl } from './image.js';
import { _mt, enterScratch, leaveScratch, maskedDraw } from './mask.js';
import { fontStr, layoutText } from './text.js';
import { localBounds } from './bounds.js';
import { kidsOf } from './timeline-eval.js';

/* ---------- drawing ---------- */
/* draw `draw` into a scratch canvas and composite it once at alpha `a`, so overlapping parts of one object fade together like a single layer (as in Animate and in the SVG export).
   `rect` (device pixels) limits the scratch work to where the object can paint; without it the whole canvas is used. */
export function groupAlpha(ctx, a, draw, rect) {
  if (a >= 0.999) { draw(ctx); return; }
  if (a <= 0.001) return;
  const cv = ctx.canvas, w = cv.width, h = cv.height, d = enterScratch();
  try {
    if (!_mt[d * 2]) _mt[d * 2] = document.createElement('canvas');
    const c = _mt[d * 2];
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const r = rect || { x: 0, y: 0, w, h };
    const cc = c.getContext('2d');
    cc.setTransform(1, 0, 0, 1, 0, 0); cc.globalCompositeOperation = 'source-over'; cc.globalAlpha = 1; cc.clearRect(r.x, r.y, r.w, r.h);
    cc.setTransform(ctx.getTransform());
    draw(cc);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= a; ctx.drawImage(c, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); ctx.restore();
  } finally { leaveScratch(); }
}
/* extra room (in the object's own units) its strokes and glyphs can paint beyond its bounds */
function paintPad(o) {
  if (o.kind === 'path') return o.stroke && o.sw > 0 ? o.sw * 1.5 : 0;
  if (o.kind === 'text') return Math.max(8, ...((o.runs || []).map((r) => (r.size || 16) * 0.5)));
  if (o.kind === 'group' || o.kind === 'clip') {
    let m = 0;
    for (const ch of kidsOf(o)) m = Math.max(m, paintPad(ch) * Math.max(1, Math.abs(ch.t.sx), Math.abs(ch.t.sy)));
    return m;
  }
  return 0;
}
function deviceRect(ctx, o) {
  const b = localBounds(o);
  if (!b) return null;
  const T = ctx.getTransform(), m = matOf(o.t);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]) {
    const q = mapply(m, x, y), p = T.transformPoint({ x: q[0], y: q[1] });
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const sc = Math.max(Math.hypot(T.a, T.b), Math.hypot(T.c, T.d), 1) * Math.max(1, Math.abs(o.t.sx), Math.abs(o.t.sy));
  const pad = paintPad(o) * sc + 3;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(cw, Math.ceil(x1 + pad)); y1 = Math.min(ch, Math.ceil(y1 + pad));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
}
export function drawObj(ctx, o, opt) {
  const op = nz(o.op, 1);
  const multi = o.kind === 'group' || o.kind === 'clip' || (o.kind !== 'text' && o.kind !== 'image' && o.fill && o.stroke && o.sw > 0);
  if (op < 0.999 && multi) {
    const r = deviceRect(ctx, o);
    if (r && (r.w <= 0 || r.h <= 0)) return; /* entirely off canvas */
    groupAlpha(ctx, op, (c) => drawObjRaw(c, o, opt, true), r || undefined);
    return;
  }
  drawObjRaw(ctx, o, opt, false);
}
function drawObjRaw(ctx, o, opt, noOp) {
  opt = opt || {};
  ctx.save();
  const m = matOf(o.t);
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  if (!noOp) ctx.globalAlpha *= nz(o.op, 1);
  if (o.kind === 'group' || o.kind === 'clip') {
    if (o.kind === 'clip' && o.pv) ctx.translate(-o.pv[0], -o.pv[1]);
    if (o.mask) maskedDraw(ctx, (c) => { for (const ch of o.children) drawObj(c, ch, opt); }, (c) => { for (const m of o.mask) drawObj(c, m, {}); });
    else for (const ch of kidsOf(o)) drawObj(ctx, ch, opt);
  } else if (o.kind === 'image') {
    const el = imgEl(o.img);
    if (el) { if (opt.tint) ctx.globalAlpha *= Math.min(0.5, opt.tint.a * 1.5); ctx.drawImage(el, 0, 0, o.w, o.h); }
    else if (!_images[o.img]) { ctx.fillStyle = 'rgba(128,128,128,.25)'; ctx.fillRect(0, 0, o.w, o.h); }
  } else if (o.kind === 'text') {
    const lay = layoutText(o);
    ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.ls || 0) + 'px';
    for (const l of lay.lines) {
      let x = l.x;
      for (const sg of l.segs) {
        ctx.font = fontStr(sg.r);
        ctx.fillStyle = opt.tint ? rgba(opt.tint.c, opt.tint.a) : rgba(sg.r.c || o.fill || '#000000', nz(o.fa, 1));
        ctx.fillText(sg.t, x, l.y); x += sg.w;
      }
    }
  } else {
    const p = new Path2D();
    tracePath(p, o.contours);
    if (o.fill) {
      const g = o.grad;
      if (g && !opt.tint && Math.abs(g.m[0] * g.m[3] - g.m[1] * g.m[2]) > 1e-12) {
        ctx.save();
        ctx.clip(p, o.nz ? 'nonzero' : 'evenodd');
        ctx.transform(g.m[0], g.m[1], g.m[2], g.m[3], g.m[4], g.m[5]);
        const gr = g.type === 'radial' ? ctx.createRadialGradient(0, 0, 0, 0, 0, 819.2) : ctx.createLinearGradient(-819.2, 0, 819.2, 0);
        for (const st of g.stops) gr.addColorStop(clamp(st.o, 0, 1), rgba(st.c, st.a * nz(o.fa, 1)));
        ctx.fillStyle = gr;
        ctx.fillRect(-1e6, -1e6, 2e6, 2e6);
        ctx.restore();
      } else {
        ctx.fillStyle = opt.tint ? rgba(opt.tint.c, opt.tint.a * nz(o.fa, 1)) : rgba(o.fill, nz(o.fa, 1));
        ctx.fill(p, o.nz ? 'nonzero' : 'evenodd');
      }
    }
    if (o.stroke && o.sw > 0) {
      ctx.strokeStyle = opt.tint ? rgba(opt.tint.c, opt.tint.a * nz(o.sa, 1)) : rgba(o.stroke, nz(o.sa, 1));
      ctx.lineWidth = o.sw; ctx.lineCap = o.cap || 'round'; ctx.lineJoin = o.join || 'round';
      ctx.stroke(p);
    }
  }
  ctx.restore();
}
export function hitObj(o, x, y, tol, hctx, anyAlpha) {
  const m = minv(matOf(o.t));
  const p = mapply(m, x, y);
  const sc = Math.max(Math.abs(o.t.sx), Math.abs(o.t.sy), 1e-6);
  const lt = tol / sc;
  if (o.kind === 'group' || o.kind === 'clip') {
    if (o.kind === 'clip' && o.pv) { p[0] += o.pv[0]; p[1] += o.pv[1]; }
    const kids = kidsOf(o);
    for (let i = kids.length - 1; i >= 0; i--) if (hitObj(kids[i], p[0], p[1], lt, hctx, anyAlpha)) return true;
    return false;
  }
  if (o.kind === 'text' || o.kind === 'image') {
    const b = localBounds(o);
    return !!b && p[0] >= b.x0 - lt && p[0] <= b.x1 + lt && p[1] >= b.y0 - lt && p[1] <= b.y1 + lt;
  }
  const path = new Path2D();
  tracePath(path, o.contours);
  if (o.fill && (anyAlpha || nz(o.fa, 1) > 0.02) && hctx.isPointInPath(path, p[0], p[1], o.nz ? 'nonzero' : 'evenodd')) return true;
  hctx.lineWidth = (o.stroke ? (o.sw || 0) : 0) + 2 * lt;
  return hctx.isPointInStroke(path, p[0], p[1]);
}
