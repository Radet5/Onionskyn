import { lerp } from './util.js';
import { splitSeg } from './path.js';

/* ---------- shape morphing ---------- */
function segCount(c) { return c.closed ? c.nodes.length : Math.max(0, c.nodes.length - 1); }
function segLen(a, b) {
  const x1 = a.x + a.ox, y1 = a.y + a.oy, x2 = b.x + b.ix, y2 = b.y + b.iy;
  return Math.hypot(x1 - a.x, y1 - a.y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(b.x - x2, b.y - y2);
}
function subdivideTo(c, target) {
  const nodes = c.nodes.map((n) => Object.assign({}, n));
  for (let guard = 0; guard < 5000; guard++) {
    const segs = c.closed ? nodes.length : nodes.length - 1;
    if (segs >= target) break;
    let bi = 0, bl = -1;
    for (let i = 0; i < segs; i++) { const l = segLen(nodes[i], nodes[(i + 1) % nodes.length]); if (l > bl) { bl = l; bi = i; } }
    const j = (bi + 1) % nodes.length;
    const r = splitSeg(nodes[bi], nodes[j], 0.5);
    nodes[bi] = r[0]; nodes[j] = r[2];
    nodes.splice(bi + 1, 0, r[1]);
  }
  return nodes;
}
function signedArea(nodes) {
  let s = 0;
  for (let i = 0; i < nodes.length; i++) { const a = nodes[i], b = nodes[(i + 1) % nodes.length]; s += a.x * b.y - b.x * a.y; }
  return s / 2;
}
function reverseNodes(nodes) {
  return nodes.slice().reverse().map((n) => Object.assign({}, n, { ix: n.ox, iy: n.oy, ox: n.ix, oy: n.iy }));
}
function alignNodes(A, B, closed) {
  let nb = B;
  if (closed) {
    if (signedArea(A) * signedArea(nb) < 0) nb = reverseNodes(nb);
    const n = A.length;
    if (n <= 240) {
      let best = 0, bc = Infinity;
      for (let k = 0; k < n; k++) {
        let cst = 0;
        for (let i = 0; i < n; i++) { const q = nb[(i + k) % n]; cst += (A[i].x - q.x) ** 2 + (A[i].y - q.y) ** 2; }
        if (cst < bc) { bc = cst; best = k; }
      }
      if (best) nb = nb.slice(best).concat(nb.slice(0, best));
    }
  } else {
    const n = nb.length;
    const d0 = Math.hypot(A[0].x - nb[0].x, A[0].y - nb[0].y) + Math.hypot(A[A.length - 1].x - nb[n - 1].x, A[A.length - 1].y - nb[n - 1].y);
    const d1 = Math.hypot(A[0].x - nb[n - 1].x, A[0].y - nb[n - 1].y) + Math.hypot(A[A.length - 1].x - nb[0].x, A[A.length - 1].y - nb[0].y);
    if (d1 < d0) nb = reverseNodes(nb);
  }
  return nb;
}
function lerpNode(a, b, p) {
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), ix: lerp(a.ix, b.ix, p), iy: lerp(a.iy, b.iy, p), ox: lerp(a.ox, b.ox, p), oy: lerp(a.oy, b.oy, p) };
}
export function morphContours(A, B, p) {
  if (!A.length || A.length !== B.length) return null;
  const out = [];
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = B[i];
    if (a.closed !== b.closed || a.nodes.length < 2 || b.nodes.length < 2) return null;
    const tgt = Math.max(segCount(a), segCount(b));
    const na = subdivideTo(a, tgt);
    const nb = alignNodes(na, subdivideTo(b, tgt), a.closed);
    out.push({ closed: a.closed, nodes: na.map((n, j) => lerpNode(n, nb[j], p)) });
  }
  return out;
}
