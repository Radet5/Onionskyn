import { clamp, clone } from './util.js';
import { hexToRgb, rgbToHex } from './color.js';
import { newT, mmul } from './matrix.js';
import { recenter, setObjMatrix } from './bounds.js';
import { mkPath, mkLayer, mkKf, normalizeDoc } from './factories.js';

/* ---------- FLA / XFL import ---------- */
export function parseNum(s) {
  if (s[0] === '#') {
    const parts = s.slice(1).split('.');
    let ip = parseInt(parts[0], 16);
    const nd = parts[0].length;
    if (nd >= 6 && ip >= Math.pow(2, nd * 4 - 1)) ip -= Math.pow(2, nd * 4);
    const frac = parts[1] ? parseInt(parts[1], 16) / Math.pow(16, parts[1].length) : 0;
    return ip + frac;
  }
  return parseFloat(s);
}
export function parseEdges(str) {
  const chains = [];
  str = str.replace(/S\d+/g, '');
  const re = /([!|\/\[\]])([^!|\/\[\]]*)/g;
  let m, cur = null, px = 0, py = 0;
  while ((m = re.exec(str))) {
    const cmd = m[1];
    const nums = m[2].trim().split(/\s+/).filter(Boolean).map(parseNum);
    if (cmd === '!') { px = nums[0]; py = nums[1]; cur = []; chains.push(cur); }
    else if ((cmd === '|' || cmd === '/') && nums.length >= 2) { cur.push({ x0: px, y0: py, x1: nums[0], y1: nums[1] }); px = nums[0]; py = nums[1]; }
    else if ((cmd === '[' || cmd === ']') && nums.length >= 4) { cur.push({ x0: px, y0: py, cx: nums[0], cy: nums[1], x1: nums[2], y1: nums[3] }); px = nums[2]; py = nums[3]; }
  }
  return chains.filter((c) => c.length);
}
const skey = (x, y) => x.toFixed(2) + '|' + y.toFixed(2);
export function assembleLoops(segs) {
  const map = new Map();
  segs.forEach((s, i) => { const k = skey(s.x0, s.y0); let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(i); });
  const used = new Uint8Array(segs.length), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const loop = [segs[i]];
    const startKey = skey(segs[i].x0, segs[i].y0);
    let end = skey(segs[i].x1, segs[i].y1);
    while (end !== startKey) {
      const cand = map.get(end);
      let nx = -1;
      if (cand) for (const j of cand) if (!used[j]) { nx = j; break; }
      if (nx < 0) break;
      used[nx] = 1; loop.push(segs[nx]); end = skey(segs[nx].x1, segs[nx].y1);
    }
    loops.push({ segs: loop, closed: end === startKey });
  }
  return loops;
}
/* segments (twips) -> contour (px) with cubic handles */
function segsToContour(segs, closed, scale) {
  const nodes = [];
  const cn = (s) => ({ x: s.x0 * scale, y: s.y0 * scale, ix: 0, iy: 0, ox: 0, oy: 0 });
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const n = cn(s);
    nodes.push(n);
    if (s.cx !== undefined) {
      const c1x = s.x0 + 2 / 3 * (s.cx - s.x0), c1y = s.y0 + 2 / 3 * (s.cy - s.y0);
      const c2x = s.x1 + 2 / 3 * (s.cx - s.x1), c2y = s.y1 + 2 / 3 * (s.cy - s.y1);
      n.ox = (c1x - s.x0) * scale; n.oy = (c1y - s.y0) * scale;
      s._in = [(c2x - s.x1) * scale, (c2y - s.y1) * scale];
    }
  }
  const last = segs[segs.length - 1];
  if (!closed) nodes.push({ x: last.x1 * scale, y: last.y1 * scale, ix: 0, iy: 0, ox: 0, oy: 0 });
  for (let i = 0; i < segs.length; i++) {
    const tgt = nodes[(i + 1) % nodes.length];
    if (segs[i]._in) { tgt.ix = segs[i]._in[0]; tgt.iy = segs[i]._in[1]; }
  }
  return { closed, nodes };
}
function xmlKids(el, name) {
  const out = [];
  if (!el) return out;
  for (const c of Array.from(el.children)) if (c.localName === name) out.push(c);
  return out;
}
function xmlKid(el, name) { return xmlKids(el, name)[0] || null; }
function attr(el, name, d) { const v = el && el.getAttribute(name); return v == null || v === '' ? d : v; }
function parseMatrixEl(el) {
  const M = el && xmlKid(xmlKid(el, 'matrix'), 'Matrix') || (el && el.localName === 'Matrix' ? el : null);
  if (!M) return [1, 0, 0, 1, 0, 0];
  return [+attr(M, 'a', 1), +attr(M, 'b', 0), +attr(M, 'c', 0), +attr(M, 'd', 1), +attr(M, 'tx', 0), +attr(M, 'ty', 0)];
}
function colorOf(el, rep) {
  if (!el) return { c: '#000000', a: 1 };
  const sc = el.localName === 'SolidColor' ? el : xmlKid(el, 'SolidColor');
  if (sc) return { c: attr(sc, 'color', '#000000').toUpperCase(), a: +attr(sc, 'alpha', 1) };
  const ents = xmlKids(el, 'GradientEntry');
  if (ents.length) {
    rep.gradient++;
    const stops = ents.map((e, i) => ({ o: clamp(+attr(e, 'ratio', i / Math.max(1, ents.length - 1)), 0, 1), c: attr(e, 'color', '#000000').toUpperCase(), a: +attr(e, 'alpha', 1) })).sort((x, y) => x.o - y.o);
    let r = 0, g = 0, bl = 0, al = 0;
    for (const st of stops) { const c = hexToRgb(st.c); r += c[0]; g += c[1]; bl += c[2]; al += st.a; }
    const n = stops.length;
    const out = { c: rgbToHex(r / n, g / n, bl / n), a: al / n };
    const m = parseMatrixEl(el);
    if (Math.abs(m[0] * m[3] - m[1] * m[2]) > 1e-12) out.grad = { type: el.localName === 'RadialGradient' ? 'radial' : 'linear', stops, m };
    return out;
  }
  if (el.localName === 'BitmapFill') { rep.bitmap++; return { c: '#999999', a: 1 }; }
  return { c: '#000000', a: 1 };
}
function importShape(el, idBase, rep) {
  const fills = new Map(), strokes = new Map();
  const fe = xmlKid(el, 'fills');
  for (const fs of xmlKids(fe, 'FillStyle')) fills.set(+attr(fs, 'index', 1), colorOf(fs.firstElementChild, rep));
  const se = xmlKid(el, 'strokes');
  for (const ss of xmlKids(se, 'StrokeStyle')) {
    const sol = ss.firstElementChild;
    if (!sol) continue;
    const fillEl = xmlKid(sol, 'fill');
    const col = colorOf(fillEl ? fillEl.firstElementChild : null, rep);
    const caps = attr(sol, 'caps', 'round'), joints = attr(sol, 'joints', 'round');
    strokes.set(+attr(ss, 'index', 1), { c: col.c, a: col.a, w: Math.max(+attr(sol, 'weight', 1), 0.25), cap: caps === 'none' ? 'butt' : caps, join: joints === 'miter' ? 'miter' : joints === 'bevel' ? 'bevel' : 'round' });
  }
  const fillSegs = new Map(), strokeContours = new Map();
  const ee = xmlKid(el, 'edges');
  for (const ed of xmlKids(ee, 'Edge')) {
    const s = attr(ed, 'edges', '');
    if (!s) continue;
    const chains = parseEdges(s);
    const f0 = +attr(ed, 'fillStyle0', 0), f1 = +attr(ed, 'fillStyle1', 0), st = +attr(ed, 'strokeStyle', 0);
    for (const ch of chains) {
      if (f1) { const a = fillSegs.get(f1) || []; fillSegs.set(f1, a); for (const sg of ch) a.push(Object.assign({}, sg)); }
      if (f0) {
        const a = fillSegs.get(f0) || []; fillSegs.set(f0, a);
        for (let i = ch.length - 1; i >= 0; i--) { const sg = ch[i]; a.push({ x0: sg.x1, y0: sg.y1, x1: sg.x0, y1: sg.y0, cx: sg.cx, cy: sg.cy }); }
      }
      if (st && strokes.has(st)) {
        const a = strokeContours.get(st) || []; strokeContours.set(st, a);
        const closed = skey(ch[0].x0, ch[0].y0) === skey(ch[ch.length - 1].x1, ch[ch.length - 1].y1) && ch.length > 1;
        a.push(segsToContour(ch.map((x) => Object.assign({}, x)), closed, 0.05));
      }
    }
  }
  const mat = parseMatrixEl(el);
  const out = [];
  const idents = Math.abs(mat[0] - 1) + Math.abs(mat[3] - 1) + Math.abs(mat[1]) + Math.abs(mat[2]) + Math.abs(mat[4]) + Math.abs(mat[5]) < 1e-9;
  const fin = (o) => { if (!idents) setObjMatrix(o, mat); recenter(o); out.push(o); };
  for (const k of Array.from(fillSegs.keys()).sort((a, b) => a - b)) {
    const st = fills.get(k);
    if (!st) continue;
    const loops = assembleLoops(fillSegs.get(k));
    const contours = loops.filter((l) => l.segs.length >= 2).map((l) => segsToContour(l.segs, true, 0.05));
    if (!contours.length) continue;
    const o = mkPath(contours, { fill: st.c, fa: st.a, stroke: null });
    if (st.grad) o.grad = { type: st.grad.type, stops: clone(st.grad.stops), m: st.grad.m.slice() };
    o.id = idBase + '-f' + k;
    fin(o);
  }
  for (const k of Array.from(strokeContours.keys()).sort((a, b) => a - b)) {
    const st = strokes.get(k);
    const contours = strokeContours.get(k).filter((c) => c.nodes.length >= 2);
    if (!contours.length) continue;
    const o = mkPath(contours, { fill: null, stroke: st.c, sa: st.a, sw: st.w, cap: st.cap, join: st.join });
    o.id = idBase + '-s' + k;
    fin(o);
  }
  return out;
}
function importElements(els, ctx, depth, idBase) {
  const out = [];
  let ei = 0;
  for (const el of els) {
    const id = idBase + '-' + ei++;
    const nm = el.localName;
    if (nm === 'DOMShape') out.push(...importShape(el, id, ctx.rep));
    else if (nm === 'DOMGroup') {
      const mem = xmlKid(el, 'members');
      const kids = importElements(mem ? Array.from(mem.children) : [], ctx, depth, id);
      if (kids.length) { const g = { id, kind: 'group', children: kids, op: 1, t: newT() }; setObjMatrix(g, parseMatrixEl(el)); out.push(g); }
    } else if (nm === 'DOMSymbolInstance') {
      const g = importInstance(el, ctx, depth, id);
      if (g) out.push(g);
    } else if (nm === 'DOMBitmapInstance') {
      const bm = ctx.bitmaps && ctx.bitmaps[attr(el, 'libraryItemName', '')];
      if (bm) { const g = { id, kind: 'image', img: bm.key, w: bm.w, h: bm.h, op: 1, t: newT() }; setObjMatrix(g, parseMatrixEl(el)); out.push(g); ctx.rep.images++; }
      else ctx.rep.bitmapMissing++;
    }
    else if (nm === 'DOMStaticText' || nm === 'DOMDynamicText' || nm === 'DOMInputText') { const t = importText(el, ctx, id); if (t) out.push(t); }
    else if (nm === 'DOMTLFText') ctx.rep.tlf++;
    else ctx.rep.other++;
  }
  return out;
}
function fontFace(face, attrs) {
  let f = String(face || 'Arial'), bold = false, italic = false;
  const parts = f.split('-');
  f = parts[0];
  const suf = (parts[1] || '').toLowerCase();
  if (/bold|black|heavy/.test(suf)) bold = true;
  if (/italic|oblique/.test(suf)) italic = true;
  f = f.replace(/MT$/, '').replace(/PS$/, '');
  if (f === 'Arial' && /^arial/i.test(face) === false) f = 'Arial';
  return { font: f || 'Arial', bold, italic };
}
function importText(el, ctx, id) {
  const runsEl = xmlKid(el, 'textRuns');
  const runs = [];
  let align = 'left', ls = 0;
  for (const tr of xmlKids(runsEl, 'DOMTextRun')) {
    const chars = xmlKid(tr, 'characters');
    const txt = chars ? chars.textContent : '';
    const ta = xmlKid(xmlKid(tr, 'textAttrs'), 'DOMTextAttrs');
    const ff = fontFace(attr(ta, 'face', 'Arial'));
    const r = { t: txt, font: ff.font, size: +attr(ta, 'size', 12) || 12, c: attr(ta, 'fillColor', '#000000').toUpperCase(), b: attr(ta, 'bold', 'false') === 'true' || ff.bold, i: attr(ta, 'italic', 'false') === 'true' || ff.italic };
    if (ta) { align = attr(ta, 'alignment', align); ls = +attr(ta, 'letterSpacing', ls) || 0; }
    runs.push(r);
  }
  if (!runs.length || !runs.some((r) => r.t)) return null;
  const dyn = el.localName !== 'DOMStaticText';
  const w = +attr(el, 'width', 0) || 0;
  const o = { id, kind: 'text', name: attr(el, 'name', ''), runs, align: align === 'center' || align === 'right' ? align : 'left', ls, fill: runs[0].c, fa: 1, op: 1, t: newT() };
  if (w && (dyn || o.align !== 'left')) { o.w = w; if (!dyn) o.nw = true; }
  let M = parseMatrixEl(el);
  if (dyn) { const isMulti = attr(el, 'lineType', 'single line') !== 'single line'; if (!isMulti) o.nw = true; }
  setObjMatrix(o, M);
  ctx.rep.textCount++;
  return o;
}
const RESERVED_SYM = /^(__proto__|constructor|prototype|toString|valueOf|hasOwnProperty|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__|isPrototypeOf|propertyIsEnumerable|toLocaleString)$/;
function importInstance(el, ctx, depth, id) {
  const rawName = attr(el, 'libraryItemName', '');
  const name = RESERVED_SYM.test(rawName) ? rawName + '_' : rawName;
  const item = ctx.lib.get(rawName);
  if (!item || depth > 12 || ctx.inProg.has(name)) { ctx.rep.missing++; return null; }
  const type = attr(el, 'symbolType', 'movie clip');
  if (!ctx.libOut[name]) {
    ctx.inProg.add(name);
    const tlEl = xmlKid(xmlKid(item, 'timeline'), 'DOMTimeline');
    ctx.libOut[name] = tlEl ? importTimeline(tlEl, ctx, depth + 1) : { layers: [], frames: 1 };
    ctx.inProg.delete(name);
  }
  const g = { id, kind: 'clip', sym: name, name: attr(el, 'name', ''), mc: type === 'movie clip', mode: 'loop', first: 0, pv: [0, 0], op: 1, t: newT() };
  if (type === 'button') { g.mode = 'single'; g.btn = true; ctx.rep.buttons++; }
  else if (type === 'graphic') {
    const lm = attr(el, 'loop', 'loop');
    g.mode = lm === 'single frame' ? 'single' : lm === 'play once' ? 'once' : 'loop';
    g.first = Math.max(0, parseInt(attr(el, 'firstFrame', 0), 10) || 0);
  }
  if (ctx.libOut[name].frames > 1 && g.mode !== 'single') ctx.rep.animatedSyms.add(name);
  const colorEl = xmlKid(el, 'color');
  const colEl = colorEl && xmlKid(colorEl, 'Color');
  if (colEl) g.op = clamp(+attr(colEl, 'alphaMultiplier', 1), 0, 1);
  let M = parseMatrixEl(el);
  const tp = xmlKid(xmlKid(el, 'transformationPoint'), 'Point');
  const px = tp ? +attr(tp, 'x', 0) : 0, py = tp ? +attr(tp, 'y', 0) : 0;
  if (px || py) { g.pv = [px, py]; M = mmul(M, [1, 0, 0, 1, px, py]); }
  setObjMatrix(g, M);
  return g;
}
function importTimeline(tl, ctx, depth) {
  const layersEl = xmlKid(tl, 'layers');
  const out = [];
  let maxF = 1;
  let li = 0; const types = {};
  for (const le of xmlKids(layersEl, 'DOMLayer')) {
    const idx = li++;
    const type = attr(le, 'layerType', 'normal');
    if (type === 'folder') continue;
    if (type === 'guide') { ctx.rep.guide++; continue; }
    const layer = mkLayer(attr(le, 'name', 'Layer'));
    types[idx] = type;
    if (type === 'mask') { layer.mask = true; ctx.rep.mask++; }
    else { const par = attr(le, 'parentLayerIndex', ''); if (par !== '' && types[+par] === 'mask') { layer.masked = true; ctx.rep.masked++; } }
    layer.visible = attr(le, 'visible', 'true') !== 'false';
    layer.locked = attr(le, 'locked', 'false') === 'true';
    layer.kfs = [];
    let end = 0;
    for (const fe of xmlKids(xmlKid(le, 'frames'), 'DOMFrame')) {
      const f = parseInt(attr(fe, 'index', 0), 10) || 0, dur = parseInt(attr(fe, 'duration', 1), 10) || 1;
      end = Math.max(end, f + dur);
      const els = xmlKid(fe, 'elements');
      const objs = els ? importElements(Array.from(els.children), ctx, depth, 'L' + idx) : [];
      const tt = attr(fe, 'tweenType', '');
      let tween = tt === 'motion' ? 'motion' : tt === 'shape' ? 'shape' : 'none';
      if (tt === 'motion object') ctx.rep.motionObject++;
      const acc = +attr(fe, 'acceleration', 0);
      const kf = mkKf(f, objs);
      const scEl = xmlKid(fe, 'Framescript') || xmlKid(fe, 'Actionscript');
      const scTxt = scEl ? (xmlKid(scEl, 'script') || scEl).textContent.trim() : '';
      if (scTxt) { kf.script = scTxt; ctx.rep.scripts++; }
      const sn = attr(fe, 'soundName', '');
      if (sn) {
        const lm = attr(fe, 'soundLoopMode', ''), cnt = parseInt(attr(fe, 'soundLoop', 0), 10) || 0;
        kf.sound = { name: sn, sync: attr(fe, 'soundSync', 'event'), loop: lm === 'loop' ? -1 : Math.max(0, cnt - 1) };
        ctx.rep.soundFrames++;
      }
      const lbl = attr(fe, 'name', ''); if (lbl && attr(fe, 'labelType', 'name') === 'name') kf.label = lbl;
      kf.tween = tween;
      kf.ease = { type: acc > 0 ? 'out' : acc < 0 ? 'in' : 'linear', amt: clamp(Math.abs(acc), 0, 100) };
      layer.kfs.push(kf);
    }
    if (!layer.kfs.length) layer.kfs.push(mkKf(0));
    layer.kfs.sort((a, b) => a.f - b.f);
    if (layer.kfs[0].f > 0) layer.kfs.unshift(mkKf(0));
    layer._end = end;
    maxF = Math.max(maxF, end);
    out.push(layer);
  }
  for (const l of out) {
    if (l._end > 0 && l._end < maxF) l.kfs.push(mkKf(l._end));
    delete l._end;
  }
  return { layers: out.reverse(), frames: maxF };
}
function parseXML(str) {
  const d = new DOMParser().parseFromString(str, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('badxml');
  return d.documentElement;
}
/* tolerant ZIP reader: walks central-directory records directly, ignoring the (sometimes wrong) end record */
function looseZip(buf) {
  const b = new Uint8Array(buf), dv = new DataView(buf), ents = new Map();
  for (let i = 0; i + 46 <= b.length; i++) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 1 && b[i + 3] === 2) {
      const method = dv.getUint16(i + 10, true), csize = dv.getUint32(i + 20, true), nl = dv.getUint16(i + 28, true), xl = dv.getUint16(i + 30, true), cl = dv.getUint16(i + 32, true), off = dv.getUint32(i + 42, true);
      if (off + 30 > b.length || b[off] !== 0x50 || b[off + 1] !== 0x4b || b[off + 2] !== 3 || b[off + 3] !== 4) continue;
      const name = new TextDecoder().decode(b.subarray(i + 46, i + 46 + nl));
      ents.set(name, { method, csize, off });
      i += 45 + nl + xl + cl;
    }
  }
  if (!ents.size) return null;
  const files = {};
  for (const n of ents.keys()) files[n] = { dir: n.endsWith('/') };
  const read = async (n) => {
    const e = ents.get(n);
    const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true);
    let data = b.subarray(start, start + e.csize);
    if (e.method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else if (e.method !== 0) throw new Error('Unsupported ZIP compression method ' + e.method);
    return data;
  };
  return { files, file: (n) => (ents.has(n) ? { async: async (t) => { const d = await read(n); return t === 'string' ? new TextDecoder().decode(d) : d; } } : null) };
}
function b64enc(u8) { let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
function pcmToWav(pcm, rate, ch) {
  const out = new Uint8Array(44 + pcm.length), dv = new DataView(out.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}
async function importSounds(rootEl, zip, base, names, rep) {
  const out = {}, norm = new Map();
  for (const n of names) norm.set(n.replace(/\\/g, '/'), n);
  const read = async (rel) => { const n = norm.get((base + rel).replace(/\\/g, '/')); return n ? zip.file(n).async('uint8array') : null; };
  const isMp3 = (d) => d && d.length > 4 && ((d[0] === 0xff && (d[1] & 0xe0) === 0xe0) || (d[0] === 0x49 && d[1] === 0x44 && d[2] === 0x33));
  for (const it of xmlKids(xmlKid(rootEl, 'media'), 'DOMSoundItem')) {
    try {
      const name = attr(it, 'name', '');
      if (!name) continue;
      const hr = attr(it, 'soundDataHRef', ''), href = attr(it, 'href', '');
      const data = hr ? await read('bin/' + hr) : null;
      const fm = /(\d+)\s*kHz\s+(\d+)\s*bit\s+(Mono|Stereo)/i.exec(attr(it, 'format', ''));
      const len = +attr(it, 'dataLength', 0);
      let bytes = null, mime = null;
      if (isMp3(data)) { bytes = len > 0 && len <= data.length ? data.subarray(0, len) : data; mime = 'audio/mpeg'; }
      else if (data && fm && +fm[2] === 16) {
        const rate = { 5: 5512, 11: 11025, 22: 22050, 44: 44100 }[+fm[1]] || 44100;
        bytes = pcmToWav(len > 0 && len <= data.length ? data.subarray(0, len) : data, rate, /stereo/i.test(fm[3]) ? 2 : 1); mime = 'audio/wav';
      }
      if (!bytes && href) {
        const o = (await read('LIBRARY/' + href)) || (await read(href));
        if (o) { bytes = o; mime = /\.wav$/i.test(href) ? 'audio/wav' : /\.ogg$/i.test(href) ? 'audio/ogg' : 'audio/mpeg'; }
      }
      if (!bytes) { rep.soundMissing++; continue; }
      out[name] = { name, mime, b64: b64enc(bytes), size: bytes.length, ids: [attr(it, 'linkageIdentifier', ''), attr(it, 'linkageClassName', '')].filter(Boolean) };
    } catch (e) { rep.soundMissing++; }
  }
  return out;
}
function imgDims(u) {
  try {
    if (u[0] === 0x89 && u[1] === 0x50) return [((u[16] << 24) | (u[17] << 16) | (u[18] << 8) | u[19]) >>> 0, ((u[20] << 24) | (u[21] << 16) | (u[22] << 8) | u[23]) >>> 0];
    if (u[0] === 0x47 && u[1] === 0x49) return [u[6] | (u[7] << 8), u[8] | (u[9] << 8)];
    if (u[0] === 0xff && u[1] === 0xd8) {
      let i = 2;
      while (i + 9 < u.length) {
        if (u[i] !== 0xff) { i++; continue; }
        const m = u[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [(u[i + 7] << 8) | u[i + 8], (u[i + 5] << 8) | u[i + 6]];
        i += 2 + ((u[i + 2] << 8) | u[i + 3]);
      }
    }
  } catch (e) { /* fall through */ }
  return null;
}
async function importBitmaps(rootEl, zip, base, names, rep) {
  const images = {}, map = {}, norm = new Map();
  for (const n of names) norm.set(n.replace(/\\/g, '/'), n);
  const read = async (rel) => { const n = norm.get((base + rel).replace(/\\/g, '/')); return n ? zip.file(n).async('uint8array') : null; };
  for (const it of xmlKids(xmlKid(rootEl, 'media'), 'DOMBitmapItem')) {
    try {
      const name = attr(it, 'name', ''), href = attr(it, 'href', '') || name;
      if (!name) continue;
      const data = (await read('LIBRARY/' + href)) || (await read(href));
      if (!data || data.length < 16) { rep.bitmapMissing++; continue; }
      const ext = (href.split('.').pop() || '').toLowerCase();
      const mime = data[0] === 0x89 ? 'image/png' : data[0] === 0xff ? 'image/jpeg' : data[0] === 0x47 ? 'image/gif' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      const dm = imgDims(data) || [Math.round(+attr(it, 'frameRight', 0) / 20) || 100, Math.round(+attr(it, 'frameBottom', 0) / 20) || 100];
      images[name] = { name, mime, b64: b64enc(data), w: dm[0], h: dm[1], size: data.length };
      map[name] = { key: name, w: dm[0], h: dm[1] };
    } catch (e) { rep.bitmapMissing++; }
  }
  return { images, map };
}
export async function importFLA(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw new Error('legacy');
  let zip;
  try { zip = await JSZip.loadAsync(buf); }
  catch (e) {
    /* some Animate builds write a wrong central-directory size; read entries by their own headers instead */
    zip = looseZip(buf);
    if (!zip) { const er = new Error('notzip'); er.detail = String(e && e.message || e); throw er; }
  }
  const names = Object.keys(zip.files);
  const domName = names.find((n) => /(^|\/)DOMDocument\.xml$/i.test(n) && !zip.files[n].dir);
  if (!domName) { const er = new Error('nodom'); er.detail = names.slice(0, 25).join(', ') || '(empty archive)'; throw er; }
  const base = domName.slice(0, domName.length - 'DOMDocument.xml'.length);
  let root;
  try { root = parseXML((await zip.file(domName).async('string')).replace(/^\uFEFF/, '')); }
  catch (e) { const er = new Error('badxml'); er.detail = String(e && e.message || e); throw er; }
  const rep = { soundFrames: 0, soundMissing: 0, sounds: 0, gradient: 0, bitmap: 0, images: 0, bitmapMissing: 0, tlf: 0, textCount: 0, mask: 0, masked: 0, guide: 0, missing: 0, other: 0, motionObject: 0, scripts: 0, buttons: 0, animatedSyms: new Set() };
  const lib = new Map();
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith(base) || !/^LIBRARY\/.*\.xml$/i.test(name.slice(base.length)) || zip.files[name].dir) continue;
    try {
      const el = parseXML(await zip.file(name).async('string'));
      if (el.localName === 'DOMSymbolItem') lib.set(attr(el, 'name', name.slice(base.length + 8, -4)), el);
    } catch (e) { /* skip unreadable library item */ }
  }
  const bms = await importBitmaps(root, zip, base, names, rep);
  const ctx = { rep, lib, libOut: {}, inProg: new Set(), bitmaps: bms.map };
  const timelines = xmlKid(root, 'timelines');
  const tls = xmlKids(timelines, 'DOMTimeline');
  if (!tls.length) throw new Error('nodom');
  const tl = importTimeline(tls[0], ctx, 0);
  const doc = {
    w: Math.round(+attr(root, 'width', 550)), h: Math.round(+attr(root, 'height', 400)), fps: +attr(root, 'frameRate', 24),
    bg: attr(root, 'backgroundColor', '#FFFFFF'), frames: tl.frames, layers: tl.layers, lib: ctx.libOut
  };
  normalizeDoc(doc);
  doc.images = bms.images;
  doc.sounds = await importSounds(root, zip, base, names, rep);
  rep.sounds = Object.keys(doc.sounds).length;
  rep.scenes = tls.length;
  rep.animatedSyms = Array.from(rep.animatedSyms);
  return { doc, report: rep };
}
