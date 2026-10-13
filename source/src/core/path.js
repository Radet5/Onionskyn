import { lerp } from './util.js';

/* ---------- paths ---------- */
export function node(x, y) { return { x, y, ix: 0, iy: 0, ox: 0, oy: 0 }; }
export function tracePath(p, contours) {
  for (const c of contours) {
    const n = c.nodes;
    if (!n.length) continue;
    p.moveTo(n[0].x, n[0].y);
    const cnt = c.closed ? n.length : n.length - 1;
    for (let i = 0; i < cnt; i++) {
      const a = n[i], b = n[(i + 1) % n.length];
      if (a.ox || a.oy || b.ix || b.iy) p.bezierCurveTo(a.x + a.ox, a.y + a.oy, b.x + b.ix, b.y + b.iy, b.x, b.y);
      else p.lineTo(b.x, b.y);
    }
    if (c.closed) p.closePath();
  }
}
const f2 = (v) => +v.toFixed(3);
export function pathD(contours) {
  let d = '';
  for (const c of contours) {
    const n = c.nodes;
    if (!n.length) continue;
    d += 'M' + f2(n[0].x) + ' ' + f2(n[0].y);
    const cnt = c.closed ? n.length : n.length - 1;
    for (let i = 0; i < cnt; i++) {
      const a = n[i], b = n[(i + 1) % n.length];
      if (a.ox || a.oy || b.ix || b.iy) d += 'C' + f2(a.x + a.ox) + ' ' + f2(a.y + a.oy) + ' ' + f2(b.x + b.ix) + ' ' + f2(b.y + b.iy) + ' ' + f2(b.x) + ' ' + f2(b.y);
      else d += 'L' + f2(b.x) + ' ' + f2(b.y);
    }
    if (c.closed) d += 'Z';
  }
  return d;
}
export function bezPt(a, b, t) {
  const u = 1 - t;
  const x1 = a.x + a.ox, y1 = a.y + a.oy, x2 = b.x + b.ix, y2 = b.y + b.iy;
  return [
    u * u * u * a.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * b.x,
    u * u * u * a.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * b.y];
}
export function splitSeg(a, b, t) {
  const P0 = [a.x, a.y], P1 = [a.x + a.ox, a.y + a.oy], P2 = [b.x + b.ix, b.y + b.iy], P3 = [b.x, b.y];
  const L = (p, q) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  const Q0 = L(P0, P1), Q1 = L(P1, P2), Q2 = L(P2, P3), R0 = L(Q0, Q1), R1 = L(Q1, Q2), S = L(R0, R1);
  const na = Object.assign({}, a, { ox: Q0[0] - P0[0], oy: Q0[1] - P0[1] });
  const nb = Object.assign({}, b, { ix: Q2[0] - P3[0], iy: Q2[1] - P3[1] });
  const m = { x: S[0], y: S[1], ix: R0[0] - S[0], iy: R0[1] - S[1], ox: R1[0] - S[0], oy: R1[1] - S[1], s: true };
  return [na, m, nb];
}
export function contoursBounds(contours) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  for (const c of contours) {
    const n = c.nodes;
    for (const q of n) add(q.x, q.y);
    const cnt = c.closed ? n.length : n.length - 1;
    for (let i = 0; i < cnt; i++) {
      const a = n[i], b = n[(i + 1) % n.length];
      if (a.ox || a.oy || b.ix || b.iy) for (let k = 1; k < 12; k++) { const p = bezPt(a, b, k / 12); add(p[0], p[1]); }
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}
