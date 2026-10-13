import { newT } from './matrix.js';
import { drawObj } from './render.js';

/* ---------- layer masks: a visible mask layer clips the contiguous 'masked' layers directly below it ---------- */
export function groupEntries(entries) {
  const units = [];
  let i = entries.length - 1;
  while (i >= 0) {
    const e = entries[i], L = e.layer;
    if (L.mask) {
      let j = i - 1; const mem = [];
      while (j >= 0 && entries[j].layer.masked) { mem.unshift(entries[j]); j--; }
      if (L.visible !== false && mem.length) units.unshift({ mask: e, members: mem });
      else for (let k = mem.length - 1; k >= 0; k--) units.unshift({ e: mem[k] });
      i = j;
    } else { units.unshift({ e }); i--; }
  }
  return units;
}
export const _mt = []; let _md = 0;
/* scratch canvases are taken in pairs by nesting depth; groupAlpha (render.js) shares them */
export function enterScratch() { return _md++; }
export function leaveScratch() { _md--; }
export function maskedDraw(ctx, drawMembers, drawMask) {
  const cv = ctx.canvas, w = cv.width, h = cv.height, d = _md++;
  try {
    for (let k = d * 2; k < d * 2 + 2; k++) if (!_mt[k]) _mt[k] = document.createElement('canvas');
    const a = _mt[d * 2], b = _mt[d * 2 + 1];
    if (a.width !== w || a.height !== h) { a.width = w; a.height = h; }
    if (b.width !== w || b.height !== h) { b.width = w; b.height = h; }
    const ac = a.getContext('2d'), bc = b.getContext('2d'), M = ctx.getTransform();
    for (const c of [ac, bc]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, w, h); c.setTransform(M); }
    drawMembers(ac); drawMask(bc);
    ac.setTransform(1, 0, 0, 1, 0, 0); ac.globalCompositeOperation = 'destination-in'; ac.drawImage(b, 0, 0); ac.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(a, 0, 0); ctx.restore();
  } finally { _md--; }
}
export function drawUnits(ctx, entries, opt, drawLayer) {
  drawLayer = drawLayer || ((c, e, isMask) => { for (const o of e.objs) drawObj(c, o, isMask ? {} : opt); });
  for (const u of groupEntries(entries)) {
    if (!u.mask) drawLayer(ctx, u.e, false);
    else maskedDraw(ctx, (c) => { for (const m of u.members) drawLayer(c, m, false); }, (c) => drawLayer(c, u.mask, true));
  }
}
export function entriesToObjs(entries) {
  const out = [];
  for (const u of groupEntries(entries)) {
    if (!u.mask) { for (const o of u.e.objs) out.push(o); continue; }
    const kids = []; for (const m of u.members) for (const o of m.objs) kids.push(o);
    out.push({ id: 'mg' + u.mask.layer.id, kind: 'group', mask: u.mask.objs, children: kids, op: 1, t: newT() });
  }
  return out;
}
