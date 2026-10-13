import { PI, clamp } from './util.js';

/* ---------- easing ---------- */
export function bezierEase(p, x1, y1, x2, y2) {
  if (p <= 0) return 0; if (p >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  let t = p;
  for (let i = 0; i < 8; i++) { const e = X(t) - p; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
  let lo = 0, hi = 1; t = p;
  for (let i = 0; i < 40; i++) { const e = X(t); if (Math.abs(e - p) < 1e-6) break; if (e < p) lo = t; else hi = t; t = (lo + hi) / 2; }
  return Y(t);
}
export function ease(type, amt, p, pts) {
  if (type === 'bezier' && pts && pts.length === 4) return bezierEase(p, +pts[0], +pts[1], +pts[2], +pts[3]);
  const a = clamp(amt == null ? 50 : amt, 0, 100) / 100, k = 1 + a * 3;
  switch (type) {
    case 'in': return Math.pow(p, k);
    case 'out': return 1 - Math.pow(1 - p, k);
    case 'inout': return p < 0.5 ? 0.5 * Math.pow(2 * p, k) : 1 - 0.5 * Math.pow(2 * (1 - p), k);
    case 'bounce':
      if (p < 1 / 2.75) return 7.5625 * p * p;
      if (p < 2 / 2.75) { p -= 1.5 / 2.75; return 7.5625 * p * p + 0.75; }
      if (p < 2.5 / 2.75) { p -= 2.25 / 2.75; return 7.5625 * p * p + 0.9375; }
      p -= 2.625 / 2.75; return 7.5625 * p * p + 0.984375;
    case 'elastic': return p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * PI / 3)) + 1;
    default: return p;
  }
}
