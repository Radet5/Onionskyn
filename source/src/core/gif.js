/* ---------- GIF encoder ---------- */
export function quantize(rgba, n, maxC) {
  maxC = Math.max(2, Math.min(256, maxC | 0 || 256));
  const hist = new Map();
  for (let i = 0; i < n; i++) {
    const k = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const keys = Array.from(hist.keys());
  const palette = new Uint8Array(256 * 3);
  const lut = new Map();
  let count = 0;
  if (keys.length <= maxC) {
    count = keys.length;
    keys.forEach((k, i) => { palette[i * 3] = k >> 16; palette[i * 3 + 1] = (k >> 8) & 255; palette[i * 3 + 2] = k & 255; lut.set(k, i); });
  } else {
    // median cut on 15-bit reduced colours
    const red = new Map();
    for (const [k, c] of hist) {
      const r = k >> 16, g = (k >> 8) & 255, b = k & 255;
      const rk = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let e = red.get(rk);
      if (!e) { e = { rk, c: 0, r: 0, g: 0, b: 0 }; red.set(rk, e); }
      e.c += c; e.r += r * c; e.g += g * c; e.b += b * c;
    }
    const items = Array.from(red.values());
    const boxes = [items];
    const range = (box) => {
      let rl = 255, rh = 0, gl = 255, gh = 0, bl = 255, bh = 0;
      for (const e of box) {
        const r = e.r / e.c, g = e.g / e.c, b = e.b / e.c;
        if (r < rl) rl = r; if (r > rh) rh = r; if (g < gl) gl = g; if (g > gh) gh = g; if (b < bl) bl = b; if (b > bh) bh = b;
      }
      return [rh - rl, gh - gl, bh - bl];
    };
    while (boxes.length < maxC) {
      let bi = -1, bs = 0, bch = 0;
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].length < 2) continue;
        const rg = range(boxes[i]);
        const mx = Math.max(rg[0], rg[1], rg[2]);
        if (mx > bs) { bs = mx; bi = i; bch = rg.indexOf(mx); }
      }
      if (bi < 0) break;
      const box = boxes[bi];
      const key = bch === 0 ? (e) => e.r / e.c : bch === 1 ? (e) => e.g / e.c : (e) => e.b / e.c;
      box.sort((a, b) => key(a) - key(b));
      let tot = 0; for (const e of box) tot += e.c;
      let acc = 0, cut = 1;
      for (let i = 0; i < box.length - 1; i++) { acc += box[i].c; if (acc >= tot / 2) { cut = i + 1; break; } cut = i + 1; }
      boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
    }
    count = boxes.length;
    const rkIndex = new Map();
    boxes.forEach((box, i) => {
      let c = 0, r = 0, g = 0, b = 0;
      for (const e of box) { c += e.c; r += e.r; g += e.g; b += e.b; rkIndex.set(e.rk, i); }
      palette[i * 3] = Math.round(r / c); palette[i * 3 + 1] = Math.round(g / c); palette[i * 3 + 2] = Math.round(b / c);
    });
    for (const k of keys) {
      const r = k >> 16, g = (k >> 8) & 255, b = k & 255;
      lut.set(k, rkIndex.get(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)));
    }
  }
  const idx = new Uint8Array(n);
  for (let i = 0; i < n; i++) idx[i] = lut.get((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]);
  return { palette, idx, count };
}
/* remap pixels to a palette with dithering: mode 'diffusion' (Floyd-Steinberg) or 'pattern' (ordered 4x4); skip = mask of transparent pixels */
function remapDither(rgba, w, h, q, mode, amt, skip) {
  const pal = q.palette, cnt = q.count, cache = new Int16Array(32768).fill(-1), idx = new Uint8Array(w * h);
  const near = (r, g, b) => {
    r = r < 0 ? 0 : r > 255 ? 255 : r | 0; g = g < 0 ? 0 : g > 255 ? 255 : g | 0; b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let v = cache[k]; if (v >= 0) return v;
    let best = 0, bd = 1e9;
    for (let i = 0; i < cnt; i++) { const dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b, d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < bd) { bd = d; best = i; } }
    cache[k] = best; return best;
  };
  if (mode === 'pattern') {
    const M = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; if (skip && skip[p]) continue;
      const o = ((M[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * 72 * amt;
      idx[p] = near(rgba[p * 4] + o, rgba[p * 4 + 1] + o, rgba[p * 4 + 2] + o);
    }
    return idx;
  }
  const buf = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { buf[i * 3] = rgba[i * 4]; buf[i * 3 + 1] = rgba[i * 4 + 1]; buf[i * 3 + 2] = rgba[i * 4 + 2]; }
  const spread = (p, er, eg, eb, f) => { buf[p * 3] += er * f; buf[p * 3 + 1] += eg * f; buf[p * 3 + 2] += eb * f; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (skip && skip[p]) continue;
    const r = buf[p * 3], g = buf[p * 3 + 1], b = buf[p * 3 + 2], i = near(r, g, b);
    idx[p] = i;
    const er = (r - pal[i * 3]) * amt, eg = (g - pal[i * 3 + 1]) * amt, eb = (b - pal[i * 3 + 2]) * amt;
    if (x + 1 < w) spread(p + 1, er, eg, eb, 7 / 16);
    if (y + 1 < h) { if (x > 0) spread(p + w - 1, er, eg, eb, 3 / 16); spread(p + w, er, eg, eb, 5 / 16); if (x + 1 < w) spread(p + w + 1, er, eg, eb, 1 / 16); }
  }
  return idx;
}
export function lzw(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, next = eoi + 1;
  const out = [];
  let cur = 0, bits = 0;
  const emit = (code) => {
    cur |= code << bits; bits += codeSize;
    while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; }
  };
  let dict = new Map();
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found === undefined) {
      emit(prefix);
      if (next === 4096) {
        emit(clear); dict = new Map(); next = eoi + 1; codeSize = minCode + 1;
      } else {
        if (next >= (1 << codeSize)) codeSize++;
        dict.set(key, next++);
      }
      prefix = k;
    } else prefix = found;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) out.push(cur & 255);
  return out;
}
/* GifWriter: header(w,h,loops) -> addFrame(rgba, delayCs) -> finish() */
export function gifWriter(w, h, o) {
  if (typeof o !== 'object' || o === null) o = { loop: o ? 0 : -1 };
  const loop = o.loop == null ? 0 : o.loop, maxC = Math.max(2, Math.min(256, o.colors | 0 || 256)), tr = !!o.transparent;
  const matte = o.matte || [255, 255, 255], dith = o.dither || 'none', amt = o.ditherAmt == null ? 1 : o.ditherAmt;
  const bytes = [];
  const push = (...a) => { for (const v of a) bytes.push(v); };
  const w16 = (v) => push(v & 255, (v >> 8) & 255);
  push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); w16(w); w16(h); push(0x00, 0, 0);
  if (loop >= 0) { push(0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 3, 1); w16(loop); push(0); }
  return {
    addFrame(rgbaData, delayCs) {
      const n = w * h;
      let src = rgbaData, skip = null;
      if (tr) {
        src = new Uint8ClampedArray(rgbaData); skip = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          const a = src[i * 4 + 3];
          if (a < 128) { skip[i] = 1; src[i * 4] = matte[0]; src[i * 4 + 1] = matte[1]; src[i * 4 + 2] = matte[2]; }
          else if (a < 255) for (let c = 0; c < 3; c++) src[i * 4 + c] = Math.round((src[i * 4 + c] * a + matte[c] * (255 - a)) / 255);
        }
      }
      const q = quantize(src, n, tr ? maxC - 1 : maxC);
      const idx = dith === 'none' || q.count <= 1 ? q.idx : remapDither(src, w, h, q, dith, amt, skip);
      let ti = -1;
      if (tr) { ti = q.count; for (let i = 0; i < n; i++) if (skip[i]) idx[i] = ti; }
      const total = q.count + (tr ? 1 : 0);
      let bits = 1; while ((1 << bits) < total) bits++;
      push(0x21, 0xf9, 4, tr ? 0x09 : 0x04, delayCs & 255, (delayCs >> 8) & 255, tr ? ti : 0, 0);
      push(0x2c); w16(0); w16(0); w16(w); w16(h); push(0x80 | (bits - 1));
      for (let i = 0; i < (1 << bits) * 3; i++) bytes.push(i < q.count * 3 ? q.palette[i] : 0);
      const minCode = Math.max(2, bits);
      push(minCode);
      const data = lzw(idx, minCode);
      for (let i = 0; i < data.length; i += 255) {
        const len = Math.min(255, data.length - i);
        bytes.push(len);
        for (let j = 0; j < len; j++) bytes.push(data[i + j]);
      }
      bytes.push(0);
    },
    finish() { bytes.push(0x3b); return new Uint8Array(bytes); }
  };
}
