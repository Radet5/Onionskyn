import { PI } from './util.js';

/* ---------- matrices: [a,b,c,d,e,f] canvas convention ---------- */
export function newT() { return { x: 0, y: 0, sx: 1, sy: 1, r: 0 }; }
export function matOf(t) {
  const c = Math.cos(t.r * PI / 180), s = Math.sin(t.r * PI / 180);
  return [c * t.sx, s * t.sx, -s * t.sy, c * t.sy, t.x, t.y];
}
export function mmul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
export function minv(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return [1, 0, 0, 1, -m[4], -m[5]];
  const id = 1 / det;
  return [m[3] * id, -m[1] * id, -m[2] * id, m[0] * id, (m[2] * m[5] - m[3] * m[4]) * id, (m[1] * m[4] - m[0] * m[5]) * id];
}
export function mapply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
export function decompose(m) {
  const sx = Math.hypot(m[0], m[1]);
  const r = Math.atan2(m[1], m[0]);
  const det = m[0] * m[3] - m[1] * m[2];
  const sy = sx > 1e-12 ? det / sx : Math.hypot(m[2], m[3]);
  const h = sx > 1e-12 ? (m[0] * m[2] + m[1] * m[3]) / sx : 0;
  const skew = Math.abs(h) / (Math.max(Math.abs(sx), Math.abs(sy)) || 1);
  return { x: m[4], y: m[5], sx, sy, r: r * 180 / PI, skew };
}
