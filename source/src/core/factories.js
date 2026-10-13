import { uid, clamp, nz } from './util.js';
import { newT } from './matrix.js';
import { node } from './path.js';

/* ---------- object factories ---------- */
const KAPPA = 0.5522847498;
export function ellipseContour(rx, ry) {
  const kx = rx * KAPPA, ky = ry * KAPPA;
  return {
    closed: true, nodes: [
      { x: 0, y: -ry, ix: -kx, iy: 0, ox: kx, oy: 0, s: true },
      { x: rx, y: 0, ix: 0, iy: -ky, ox: 0, oy: ky, s: true },
      { x: 0, y: ry, ix: kx, iy: 0, ox: -kx, oy: 0, s: true },
      { x: -rx, y: 0, ix: 0, iy: ky, ox: 0, oy: -ky, s: true }]
  };
}
export function rectContour(w, h, r) {
  const hw = w / 2, hh = h / 2;
  r = clamp(r || 0, 0, Math.min(hw, hh));
  if (r < 0.01) return { closed: true, nodes: [node(-hw, -hh), node(hw, -hh), node(hw, hh), node(-hw, hh)] };
  const k = r * KAPPA;
  const N = (x, y, ix, iy, ox, oy) => ({ x, y, ix, iy, ox, oy });
  return {
    closed: true, nodes: [
      N(-hw + r, -hh, -k, 0, 0, 0), N(hw - r, -hh, 0, 0, k, 0),
      N(hw, -hh + r, 0, -k, 0, 0), N(hw, hh - r, 0, 0, 0, k),
      N(hw - r, hh, k, 0, 0, 0), N(-hw + r, hh, 0, 0, -k, 0),
      N(-hw, hh - r, 0, k, 0, 0), N(-hw, -hh + r, 0, 0, 0, -k)]
  };
}
export function mkPath(contours, st, t) {
  st = st || {};
  return {
    id: uid(), kind: 'path', contours,
    fill: st.fill === undefined ? '#3F5BFF' : st.fill, fa: nz(st.fa, 1),
    stroke: st.stroke === undefined ? null : st.stroke, sa: nz(st.sa, 1), sw: nz(st.sw, 3),
    cap: st.cap || 'round', join: st.join || 'round', op: 1,
    t: Object.assign(newT(), t || {})
  };
}
export function mkLayer(name) {
  return { id: uid(), name: name || 'Layer', visible: true, locked: false, kfs: [mkKf(0)] };
}
export function mkKf(f, objs) { return { f, objs: objs || [], tween: 'none', ease: { type: 'linear', amt: 50 } }; }
export function mkDoc() {
  const l = mkLayer('Layer 1');
  return { w: 640, h: 360, fps: 24, bg: '#FFFFFF', frames: 48, layers: [l], lib: {}, sounds: {}, images: {} };
}
export function normalizeDoc(d) {
  d.w = clamp(+d.w || 640, 16, 4096); d.h = clamp(+d.h || 360, 16, 4096);
  d.lib = d.lib || {}; d.sounds = d.sounds || {}; d.images = d.images || {};
  d.fps = clamp(+d.fps || 24, 1, 120); d.bg = d.bg || '#FFFFFF'; d.frames = clamp(Math.round(+d.frames || 1), 1, 900);
  if (!Array.isArray(d.layers) || !d.layers.length) d.layers = [mkLayer('Layer 1')];
  for (const l of d.layers) {
    l.id = l.id || uid(); l.name = l.name || 'Layer'; l.visible = l.visible !== false; l.locked = !!l.locked;
    if (!Array.isArray(l.kfs) || !l.kfs.length) l.kfs = [mkKf(0)];
    l.kfs.sort((a, b) => a.f - b.f);
    if (l.kfs[0].f !== 0) l.kfs.unshift(mkKf(0));
    for (const k of l.kfs) { k.objs = k.objs || []; k.tween = k.tween || 'none'; k.ease = k.ease || { type: 'linear', amt: 50 }; }
    const mx = l.kfs[l.kfs.length - 1].f + 1;
    if (mx > d.frames) d.frames = mx;
  }
  d.frames = Math.min(d.frames, 900);
  return d;
}
