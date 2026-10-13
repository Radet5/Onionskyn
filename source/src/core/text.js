/* 2D context used to measure text */
let _mctx = null;
export function setMeasure(c) { _mctx = c; }
export function fontStr(r) { return (r.i ? 'italic ' : '') + (r.b ? 'bold ' : '') + Math.max(1, r.size || 16) + 'px "' + (r.font || 'Arial') + '", Helvetica, Arial, sans-serif'; }
function measureW(r, str, ls) {
  if (_mctx) { _mctx.font = fontStr(r); return _mctx.measureText(str).width + (ls || 0) * str.length; }
  return str.length * (r.size || 16) * 0.55 + (ls || 0) * str.length;
}
/* distance from the top of a text line (where the canvas draws it) down to the alphabetic baseline, so SVG text sits where canvas text does; null if the browser can't measure it */
export function baselineDrop(r) {
  if (!_mctx) return null;
  try {
    _mctx.font = fontStr(r); _mctx.textBaseline = 'top';
    const m = _mctx.measureText('Hg'); _mctx.textBaseline = 'alphabetic';
    return typeof m.alphabeticBaseline === 'number' && isFinite(m.alphabeticBaseline) && m.alphabeticBaseline !== 0 ? -m.alphabeticBaseline : null;
  } catch (e) { return null; }
}
export function layoutText(o) {
  const lines = [];
  let cur = { segs: [], w: 0, h: 0 };
  const push = () => { lines.push(cur); cur = { segs: [], w: 0, h: 0 }; };
  const wrapW = o.w > 0 ? o.w : 0;
  for (const r of o.runs) {
    const lh = (r.size || 16) * 1.2;
    String(r.t).split(/\r\n|\r|\n/).forEach((part, pi) => {
      if (pi > 0) push();
      cur.h = Math.max(cur.h, lh);
      if (!part) return;
      if (wrapW && !o.nw) {
        for (const w of part.split(/(\s+)/)) {
          if (!w) continue;
          const ww = measureW(r, w, o.ls);
          if (cur.w + ww > wrapW && cur.w > 0 && w.trim()) push();
          cur.h = Math.max(cur.h, lh);
          cur.segs.push({ r, t: w, w: ww }); cur.w += ww;
        }
      } else { const ww = measureW(r, part, o.ls); cur.segs.push({ r, t: part, w: ww }); cur.w += ww; }
    });
  }
  lines.push(cur);
  let y = 0, mw = 0;
  for (const l of lines) { if (!l.h) l.h = ((o.runs[0] && o.runs[0].size) || 16) * 1.2; l.y = y; y += l.h; mw = Math.max(mw, l.w); }
  const bw = wrapW || mw;
  for (const l of lines) l.x = o.align === 'center' ? (bw - l.w) / 2 : o.align === 'right' ? bw - l.w : 0;
  return { lines, w: bw, h: y };
}
