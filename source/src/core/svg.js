import { nz } from './util.js';
import { matOf } from './matrix.js';
import { pathD } from './path.js';
import { _images } from './image.js';
import { groupEntries } from './mask.js';
import { baselineDrop, layoutText } from './text.js';
import { kidsOf, evalDoc } from './timeline-eval.js';

/* ---------- SVG ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
let _gid = 0;
function svgMasked(maskObjs, inner) {
  const id = 'm' + (++_gid);
  return '<mask id="' + id + '" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">' + maskObjs.map(objSVG).join('') + '</mask><g mask="url(#' + id + ')">' + inner + '</g>';
}
function layersSVG(entries) {
  let body = '';
  for (const u of groupEntries(entries)) {
    if (!u.mask) { for (const o of u.e.objs) body += objSVG(o); continue; }
    let inner = ''; for (const m of u.members) for (const o of m.objs) inner += objSVG(o);
    body += svgMasked(u.mask.objs, inner);
  }
  return body;
}
export function objSVG(o) {
  const m = matOf(o.t), tr = 'matrix(' + m.map((n) => +n.toFixed(5)).join(' ') + ')', op = nz(o.op, 1);
  const opa = op < 1 ? ' opacity="' + +op.toFixed(3) + '"' : '';
  if (o.kind === 'group') { const inner = o.children.map(objSVG).join(''); return '<g transform="' + tr + '"' + opa + '>' + (o.mask ? svgMasked(o.mask, inner) : inner) + '</g>'; }
  if (o.kind === 'clip') {
    const pv = o.pv ? '<g transform="translate(' + -o.pv[0] + ' ' + -o.pv[1] + ')">' : '<g>';
    return '<g transform="' + tr + '"' + opa + '>' + pv + kidsOf(o).map(objSVG).join('') + '</g></g>';
  }
  if (o.kind === 'image') {
    const rec = _images[o.img];
    return rec && rec.b64 ? '<image transform="' + tr + '" width="' + +(o.w || 0).toFixed(2) + '" height="' + +(o.h || 0).toFixed(2) + '" preserveAspectRatio="none"' + opa + ' xlink:href="data:' + rec.mime + ';base64,' + rec.b64 + '"/>' : '';
  }
  if (o.kind === 'text') {
    const lay = layoutText(o);
    let out = '<g transform="' + tr + '"' + opa + '>';
    for (const l of lay.lines) {
      let x = l.x;
      for (const sg of l.segs) {
        const r = sg.r;
        const drop = baselineDrop(r);
        out += '<text x="' + +x.toFixed(2) + '" y="' + +(drop == null ? l.y : l.y + drop).toFixed(2) + '"' + (drop == null ? ' dominant-baseline="text-before-edge"' : '') + ' xml:space="preserve" font-family="' + esc(r.font || 'Arial') + ', Helvetica, sans-serif" font-size="' + (r.size || 16) + '"' + (r.b ? ' font-weight="bold"' : '') + (r.i ? ' font-style="italic"' : '') + ' fill="' + esc(r.c || o.fill || '#000000') + '" fill-opacity="' + +nz(o.fa, 1).toFixed(3) + '">' + String(sg.t).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
        x += sg.w;
      }
    }
    return out + '</g>';
  }
  let defs = '', fillAttr;
  if (o.fill && o.grad) {
    const id = 'g' + (++_gid), g = o.grad;
    const stops = g.stops.map((st) => '<stop offset="' + +st.o.toFixed(4) + '" stop-color="' + esc(st.c) + '" stop-opacity="' + +(st.a * nz(o.fa, 1)).toFixed(3) + '"/>').join('');
    defs = g.type === 'radial'
      ? '<radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="819.2" gradientTransform="matrix(' + g.m.map((n) => +n.toFixed(6)).join(' ') + ')">' + stops + '</radialGradient>'
      : '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="-819.2" y1="0" x2="819.2" y2="0" gradientTransform="matrix(' + g.m.map((n) => +n.toFixed(6)).join(' ') + ')">' + stops + '</linearGradient>';
    defs = '<defs>' + defs + '</defs>';
    fillAttr = 'fill="url(#' + id + ')" fill-rule="' + (o.nz ? 'nonzero' : 'evenodd') + '"';
  } else fillAttr = o.fill ? 'fill="' + esc(o.fill) + '" fill-opacity="' + +nz(o.fa, 1).toFixed(3) + '" fill-rule="' + (o.nz ? 'nonzero' : 'evenodd') + '"' : 'fill="none"';
  const stroke = o.stroke && o.sw > 0 ? ' stroke="' + esc(o.stroke) + '" stroke-opacity="' + +nz(o.sa, 1).toFixed(3) + '" stroke-width="' + +o.sw.toFixed(3) + '" stroke-linecap="' + (o.cap || 'round') + '" stroke-linejoin="' + (o.join || 'round') + '"' : '';
  return defs + '<path transform="' + tr + '" d="' + pathD(o.contours) + '" ' + fillAttr + stroke + opa + '/>';
}
export function frameSVG(doc, t) {
  _gid = 0;
  let body = '';
  body = layersSVG(evalDoc(doc, t));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + doc.w + '" height="' + doc.h + '" viewBox="0 0 ' + doc.w + ' ' + doc.h + '">\n' + (doc.bg && doc.bg !== 'transparent' ? '<rect width="100%" height="100%" fill="' + esc(doc.bg) + '"/>\n' : '') + body + '\n</svg>\n';
}
