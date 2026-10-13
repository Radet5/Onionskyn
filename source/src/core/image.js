import { root } from './util.js';

/* ---------- bitmaps (doc.images[name] = { name, mime, b64, w, h, size }) ---------- */
export let _images = {}; const _imgEls = new Map();
export function setImages(m) { _images = m || {}; }
export function imgEl(name) {
  const rec = _images[name];
  if (!rec || !rec.b64 || typeof Image === 'undefined') return null;
  const sig = rec.mime + ':' + rec.b64.length;
  let e = _imgEls.get(name);
  if (!e || e.sig !== sig) {
    const el = new Image();
    e = { el, sig, ok: false, p: null };
    e.p = new Promise((res) => {
      el.onload = () => { e.ok = true; res(true); if (root.FCCore && root.FCCore.onImageLoad) root.FCCore.onImageLoad(name); };
      el.onerror = () => { res(false); };
    });
    el.src = 'data:' + rec.mime + ';base64,' + rec.b64;
    _imgEls.set(name, e);
  }
  return e.ok ? e.el : null;
}
export function preloadImages() {
  const ps = [];
  for (const n of Object.keys(_images)) { imgEl(n); const e = _imgEls.get(n); if (e) ps.push(e.p); }
  return Promise.all(ps);
}
