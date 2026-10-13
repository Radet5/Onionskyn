/* ===== Onionskyn app, part 3: timeline, layers, properties, menus, export, import, init ===== */
const tlC = $('#tlCells'), tlR = $('#tlRuler'), tctx = tlC.getContext('2d'), rctx = tlR.getContext('2d');
const tlScroll = $('#tlScroll');
const MONO = '10.5px "IBM Plex Mono", ui-monospace, Menlo, monospace';

/* ---------- frame & layer navigation ---------- */
function setFrame(f) {
  f = clamp(f, 0, S.doc.frames - 1);
  if (f === S.frame) return;
  S.frame = f; pruneSel();
  invalidate(); updateTime(); if (!S.playing) refreshProps();
  keepPlayheadVisible();
}
function updateTime() {
  const d = S.doc;
  $('#tcode').innerHTML = 'Frame <b>' + fnum(S.frame) + '</b> / ' + d.frames + ' &middot; ' + (S.frame / d.fps).toFixed(2) + 's &middot; ' + d.fps + ' fps';
  $('#hFrame').textContent = 'Frame ' + fnum(S.frame) + ' / ' + d.frames;
}
function keepPlayheadVisible() {
  const lw = $('#tlLayers').offsetWidth, x = lw + S.frame * CW;
  if (x - tlScroll.scrollLeft < lw + 8) tlScroll.scrollLeft = Math.max(0, x - lw - 8);
  else if (x + CW > tlScroll.scrollLeft + tlScroll.clientWidth) tlScroll.scrollLeft = x + CW - tlScroll.clientWidth + 8;
}
function selectLayer(id, fromStage) {
  if (S.layerId !== id) {
    S.layerId = id;
    $$('.lrow').forEach((r) => r.classList.toggle('cur', r.dataset.id === id));
    if (!fromStage) { S.sel = S.sel.filter((s) => s.lid === id); S.nodeSel = null; }
  }
  refreshProps(); invalidate();
}
const EYE = '<svg viewBox="0 0 16 16"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 16 16"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" opacity=".35"/><path d="M3 13L13 3"/></svg>';
const LOCK = '<svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>';
const UNLOCK = '<svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2" opacity=".35"/><path d="M5.5 7V5a2.5 2.5 0 014.7-1.2" opacity=".6"/></svg>';
function buildLayerList() {
  const box = $('#tlLayers');
  box.textContent = '';
  const ls = layers();
  for (let i = ls.length - 1; i >= 0; i--) {
    const l = ls[i];
    const row = document.createElement('div');
    row.className = 'lrow' + (l.id === S.layerId ? ' cur' : '') + (l.mask ? ' mask' : '') + (l.masked ? ' masked' : '');
    row.dataset.id = l.id;
    row.innerHTML = '<span class="sw"></span><span class="lname"></span><button class="ib vis" title="Show / hide layer" aria-label="Toggle visibility"></button><button class="ib lck" title="Lock / unlock layer" aria-label="Toggle lock"></button>';
    row.querySelector('.sw').style.background = 'hsl(' + ((i * 67 + 215) % 360) + ' 62% 56%)';
    const nm = row.querySelector('.lname');
    nm.textContent = l.name; nm.title = l.mask ? 'Mask layer: its shapes reveal the masked layers below' : l.masked ? 'Masked by the layer above' : '';
    const vis = row.querySelector('.vis'), lck = row.querySelector('.lck');
    vis.innerHTML = l.visible ? EYE : EYE_OFF; vis.classList.toggle('on', l.visible);
    lck.innerHTML = l.locked ? LOCK : UNLOCK; lck.classList.toggle('on', l.locked);
    row.addEventListener('pointerdown', (e) => { if (e.target.closest('button') || e.target.tagName === 'INPUT') return; selectLayer(l.id); });
    vis.addEventListener('click', () => { pushUndo(); l.visible = !l.visible; if (!l.visible) pruneSel(); buildLayerList(); commit(); });
    lck.addEventListener('click', () => { pushUndo(); l.locked = !l.locked; buildLayerList(); commit(); });
    nm.addEventListener('dblclick', () => renameLayer(l, nm));
    box.appendChild(row);
  }
}
function renameLayer(l, el) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = l.name; inp.setAttribute('aria-label', 'Layer name');
  el.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const fin = (ok) => {
    if (done) return; done = true;
    const v = inp.value.trim();
    if (ok && v && v !== l.name) { pushUndo(); l.name = v.slice(0, 40); }
    buildLayerList(); commit();
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fin(true); else if (e.key === 'Escape') fin(false); e.stopPropagation(); });
  inp.addEventListener('blur', () => fin(true));
}
function toggleMask() {
  const ls = layers(), l = curLayer(), i = ls.indexOf(l);
  pushUndo();
  if (l.mask) {
    delete l.mask;
    for (let j = i - 1; j >= 0 && ls[j].masked; j--) delete ls[j].masked;
    toast('Mask removed.');
  } else if (l.masked) { delete l.masked; toast('Layer is no longer masked.'); }
  else if (i + 1 < ls.length && (ls[i + 1].mask || ls[i + 1].masked)) { l.masked = true; toast('Layer is now masked by the layer above.'); }
  else {
    l.mask = true;
    if (i > 0 && !ls[i - 1].mask) { ls[i - 1].masked = true; toast('“' + l.name + '” is now a mask. The layer below it is masked.'); }
    else toast('“' + l.name + '” is now a mask. Select a layer below it and press Mask again to add it.');
  }
  refreshAll();
}
function layerOp(op) {
  const ls = layers(), l = curLayer(), i = ls.indexOf(l);
  pushUndo();
  if (op === 'add') {
    let n = ls.length + 1; while (ls.some((x) => x.name === 'Layer ' + n)) n++;
    const nl = C.mkLayer('Layer ' + n); ls.splice(i + 1, 0, nl); S.layerId = nl.id;
  } else if (op === 'dup') {
    const c = clone(l); c.id = uid(); c.name = l.name + ' copy'; ls.splice(i + 1, 0, c); S.layerId = c.id;
  } else if (op === 'up') { if (i >= ls.length - 1) { H.stack.pop(); return; } [ls[i], ls[i + 1]] = [ls[i + 1], ls[i]]; }
  else if (op === 'down') { if (i <= 0) { H.stack.pop(); return; } [ls[i], ls[i - 1]] = [ls[i - 1], ls[i]]; }
  else if (op === 'del') {
    if (ls.length < 2) { H.stack.pop(); toast('A document needs at least one layer.'); return; }
    ls.splice(i, 1); S.layerId = ls[Math.min(i, ls.length - 1)].id; pruneSel();
  }
  refreshAll();
}

/* ---------- frame actions ---------- */
function frameAction(kind) {
  const l = curLayer(), f = S.frame, d = S.doc;
  if (!l) return;
  pushUndo();
  let fail = '';
  switch (kind) {
    case 'frame': C.insertFrames(l, f, 1, d); break;
    case 'rmframe': C.removeFrames(l, f, 1, d); S.frame = clamp(S.frame, 0, d.frames - 1); break;
    case 'key': if (C.kfAt(l, f)) fail = 'There is already a keyframe on this frame.'; else C.insertKeyframe(l, f, false); break;
    case 'blank': C.insertKeyframe(l, f, true); S.sel = S.sel.filter((s) => s.lid !== l.id); break;
    case 'clearkey': if (!C.clearKeyframe(l, f)) fail = 'Select a keyframe (other than the first) to clear.'; break;
    case 'motion': case 'shape': {
      const r = C.setTweenAt(d, l, f, kind);
      if (!r.ok) fail = r.msg;
      else {
        const bad = kind === 'shape' ? C.shapeTweenIssues(l, f) : 0;
        if (bad) toast((r.msg ? r.msg + ' ' : '') + bad + (bad === 1 ? ' shape' : ' shapes') + ' here can’t morph smoothly (different number of parts, or open vs closed), so ' + (bad === 1 ? 'it' : 'they') + ' will switch at the end of the tween.');
        else if (r.msg) toast(r.msg);
      }
      break;
    }
    case 'notween': C.setTweenAt(d, l, f, 'none'); break;
  }
  if (fail) { H.stack.pop(); updateHistoryButtons(); toast(fail); return; }
  pruneSel(); refreshAll();
}
$$('[data-fr]').forEach((b) => b.addEventListener('click', () => frameAction(b.dataset.fr)));

/* ---------- timeline drawing ---------- */
function sizeTimeline() {
  const n = S.doc.frames, W = n * CW + 24, Hc = layers().length * RH;
  const set = (c, w, h) => {
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; c.style.width = w + 'px'; c.style.height = h + 'px'; }
  };
  set(tlC, W, Hc); set(tlR, W, RULER);
}
/* ---------- audio waveforms on the timeline ---------- */
const WAVE = new Map();
function getWave(name) {
  const s = (S.doc.sounds || {})[name];
  if (!s || !s.b64) return null;
  let w = WAVE.get(name);
  if (w && w.sig === s.b64.length) return w.state === 'ready' ? w : null;
  w = { sig: s.b64.length, state: 'pending' };
  WAVE.set(name, w);
  (async () => {
    try {
      const bin = atob(s.b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const buf = await new AC(1, 1, 44100).decodeAudioData(u8.buffer);
      const per = Math.max(1, Math.floor(buf.sampleRate / 1000)), nb = Math.ceil(buf.length / per), pk = new Float32Array(nb);
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let b = 0; b < nb; b++) {
          let m = 0;
          const e = Math.min(buf.length, (b + 1) * per);
          for (let i = b * per; i < e; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > m) m = v; }
          if (m > pk[b]) pk[b] = m;
        }
      }
      let mx = 0;
      for (let b = 0; b < nb; b++) if (pk[b] > mx) mx = pk[b];
      w.peaks = pk; w.dur = buf.duration; w.max = Math.max(mx, 0.05); w.state = 'ready';
    } catch (e) { w.state = 'fail'; }
    invalidate();
  })();
  return null;
}
function drawWaves(ctx, l, y, cy, n) {
  const pxms = CW * S.doc.fps / 1000, maxX = n * CW, amp = RH / 2 - 3;
  for (const k of l.kfs) {
    const sd = k.sound;
    if (!sd || sd.sync === 'stop') continue;
    const w = getWave(sd.name);
    if (!w) continue;
    const wpx = w.dur * 1000 * pxms, plays = sd.loop === -1 ? 999 : (sd.loop | 0) + 1;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y + 1, maxX, RH - 2); ctx.clip();
    ctx.fillStyle = CSSV.accent; ctx.globalAlpha = l.visible ? 0.6 : 0.28;
    for (let pl = 0; pl < plays; pl++) {
      const start = k.f * CW + pl * wpx;
      if (start >= maxX) break;
      const cols = Math.ceil(Math.min(wpx, maxX - start));
      for (let c = 0; c < cols; c++) {
        const b0 = Math.floor(c / pxms), b1 = Math.min(w.peaks.length, Math.max(b0 + 1, Math.ceil((c + 1) / pxms)));
        let m = 0;
        for (let b = b0; b < b1; b++) if (w.peaks[b] > m) m = w.peaks[b];
        const h = Math.max(0.6, m / w.max * amp);
        ctx.fillRect(start + c, cy - h, 1, h * 2);
      }
      ctx.globalAlpha *= 0.9; ctx.fillRect(start + wpx - 1, y + 3, 1, RH - 6); ctx.globalAlpha /= 0.9;
    }
    ctx.restore();
  }
}
function drawTimeline() {
  if (!S.doc) return;
  sizeTimeline();
  const d = S.doc, n = d.frames, ls = layers().slice().reverse(), W = n * CW + 24, Hc = ls.length * RH;
  const ctx = tctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = CSSV.cell; ctx.fillRect(0, 0, W, Hc);
  for (let f = 4; f < n; f += 5) { ctx.fillStyle = CSSV.cell5; ctx.fillRect(f * CW, 0, CW, Hc); }
  ctx.strokeStyle = CSSV.line2; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let f = 0; f <= n; f++) { const x = f * CW + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, Hc); }
  for (let r = 1; r <= ls.length; r++) { const y = r * RH - 0.5; ctx.moveTo(0, y); ctx.lineTo(n * CW, y); }
  ctx.stroke();
  ls.forEach((l, r) => {
    const y = r * RH, cy = y + RH / 2;
    ctx.save();
    if (!l.visible) ctx.globalAlpha = 0.45;
    for (let i = 0; i < l.kfs.length; i++) {
      const k = l.kfs[i], nx = l.kfs[i + 1], end = nx ? nx.f : n;
      if (k.f >= n) break;
      const x0 = k.f * CW, x1 = Math.min(end, n) * CW, has = k.objs.length > 0;
      if (has || k.tween !== 'none') {
        ctx.fillStyle = k.tween === 'motion' ? CSSV.motion : k.tween === 'shape' ? CSSV.shape : CSSV.held;
        ctx.fillRect(x0 + 1, y + 1, x1 - x0 - 1, RH - 2);
      }
      ctx.strokeStyle = CSSV.key; ctx.fillStyle = CSSV.key; ctx.lineWidth = 1.25;
      if (k.tween !== 'none' && nx) {
        ctx.beginPath(); ctx.moveTo(x0 + CW / 2 + 5, cy); ctx.lineTo(x1 - CW / 2 + 1, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 - CW / 2 - 4, cy - 4); ctx.lineTo(x1 - CW / 2 + 1, cy); ctx.lineTo(x1 - CW / 2 - 4, cy + 4); ctx.stroke();
      } else if (has && x1 - x0 > CW) {
        ctx.strokeRect(x1 - CW + 4.5, cy - 4.5, CW - 9, 9);
      }
      ctx.beginPath(); ctx.arc(x0 + CW / 2, cy, 3.6, 0, Math.PI * 2);
      if (has) ctx.fill(); else { ctx.fillStyle = CSSV.cell; ctx.fill(); ctx.stroke(); }
      if (k.sound) { ctx.fillStyle = CSSV.fg; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♪', x0 + CW / 2, cy + 11); ctx.textAlign = 'start'; }
      if (k.script) { ctx.fillStyle = CSSV.fg; ctx.font = '700 9px ' + 'sans-serif'; ctx.textAlign = 'center'; ctx.fillText('a', x0 + CW / 2, cy - 6); ctx.textAlign = 'start'; }
    }
    ctx.restore();
    drawWaves(ctx, l, y, cy, n);
    if (l.id === S.layerId) { ctx.strokeStyle = CSSV.accent; ctx.lineWidth = 2; ctx.strokeRect(S.frame * CW + 1, y + 1, CW - 2, RH - 2); }
  });
  const px = S.frame * CW + CW / 2;
  ctx.strokeStyle = CSSV.playhead; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, Hc); ctx.stroke();

  const rc = rctx;
  rc.setTransform(dpr, 0, 0, dpr, 0, 0);
  rc.fillStyle = CSSV.panel; rc.fillRect(0, 0, W, RULER);
  rc.strokeStyle = CSSV.line; rc.lineWidth = 1;
  rc.beginPath(); rc.moveTo(0, RULER - 0.5); rc.lineTo(W, RULER - 0.5); rc.stroke();
  rc.fillStyle = CSSV.mut; rc.strokeStyle = CSSV.line; rc.font = MONO; rc.textAlign = 'center'; rc.textBaseline = 'middle';
  rc.beginPath();
  for (let f = 0; f < n; f++) {
    const major = (f + 1) % 5 === 0 || f === 0;
    const x = f * CW + CW / 2;
    rc.moveTo(x, RULER - (major ? 6 : 3)); rc.lineTo(x, RULER);
    if (major) rc.fillText(String(f + 1), x, 9);
  }
  rc.stroke();
  rc.fillStyle = CSSV.playhead;
  rc.beginPath(); rc.rect(S.frame * CW + 1, 2, CW - 2, RULER - 8); rc.fill();
  rc.beginPath(); rc.moveTo(px - 4, RULER - 6); rc.lineTo(px + 4, RULER - 6); rc.lineTo(px, RULER - 1); rc.closePath(); rc.fill();
  rc.fillStyle = '#fff'; rc.fillText(String(S.frame + 1), px, 9);
}

/* ---------- timeline interaction ---------- */
let tlDrag = null;
function cellAt(e, canvas) {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  return { f: clamp(Math.floor(x / CW), 0, S.doc.frames - 1), row: Math.floor(y / RH) };
}
tlC.addEventListener('pointerdown', (e) => {
  if (e.button === 2) return;
  tlC.setPointerCapture(e.pointerId);
  if (S.playing) stopPlay();
  const c = cellAt(e, tlC), ls = layers().slice().reverse(), l = ls[c.row];
  if (l) selectLayer(l.id);
  setFrame(c.f);
  const kf = l && C.kfAt(l, c.f);
  if (kf) autoTab('frame');
  tlDrag = kf && kf.f > 0 ? { type: 'kf', layer: l, cur: c.f, moved: false } : { type: 'scrub' };
});
tlC.addEventListener('pointermove', (e) => {
  if (!tlDrag) return;
  const c = cellAt(e, tlC);
  if (tlDrag.type === 'scrub') setFrame(c.f);
  else if (c.f !== tlDrag.cur && c.f > 0 && !C.kfAt(tlDrag.layer, c.f)) {
    if (!tlDrag.moved) { pushUndo(); tlDrag.moved = true; }
    C.moveKeyframe(tlDrag.layer, tlDrag.cur, c.f);
    tlDrag.cur = c.f; S.frame = c.f; updateTime(); invalidate();
  }
});
const endTl = () => { if (tlDrag && tlDrag.moved) commit(); tlDrag = null; };
tlC.addEventListener('pointerup', endTl); tlC.addEventListener('pointercancel', endTl);
tlR.addEventListener('pointerdown', (e) => { tlR.setPointerCapture(e.pointerId); if (S.playing) stopPlay(); tlDrag = { type: 'scrub' }; setFrame(cellAt(e, tlR).f); });
tlR.addEventListener('pointermove', (e) => { if (tlDrag && tlDrag.type === 'scrub') setFrame(cellAt(e, tlR).f); });
tlR.addEventListener('pointerup', endTl); tlR.addEventListener('pointercancel', endTl);
tlC.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const c = cellAt(e, tlC), l = layers().slice().reverse()[c.row];
  if (l) selectLayer(l.id);
  setFrame(c.f);
  showMenu(null, [
    { label: 'Insert frame', kbd: 'F5', fn: () => frameAction('frame') },
    { label: 'Insert keyframe', kbd: 'F6', fn: () => frameAction('key') },
    { label: 'Insert blank keyframe', kbd: 'F7', fn: () => frameAction('blank') },
    '-',
    { label: 'Remove frame', kbd: '⇧F5', fn: () => frameAction('rmframe') },
    { label: 'Clear keyframe', kbd: '⇧F6', fn: () => frameAction('clearkey') },
    '-',
    { label: 'Create motion tween', fn: () => frameAction('motion') },
    { label: 'Create shape tween', fn: () => frameAction('shape') },
    { label: 'Remove tween', fn: () => frameAction('notween') }
  ], { x: e.clientX, y: e.clientY });
});

/* ---------- playback ---------- */
let playRAF = 0, lastT = 0, acc = 0;
const PLAY_ICO = '<path d="M4 2.5v11l9-5.5z"/>', PAUSE_ICO = '<path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z"/>';
function setPlayIcon() { $('#playIco').innerHTML = S.playing ? PAUSE_ICO : PLAY_ICO; $('#pPlay').setAttribute('aria-label', S.playing ? 'Stop' : 'Play'); }
function startPlay() {
  if (S.playing) return;
  S.playing = true;
  if (S.frame >= S.doc.frames - 1 && !S.loop) S.frame = 0;
  lastT = performance.now(); acc = 0; setPlayIcon();
  playRAF = requestAnimationFrame(playTick);
}
function playTick(now) {
  if (!S.playing) return;
  acc = Math.min(acc + now - lastT, 300); lastT = now;
  const step = 1000 / S.doc.fps;
  let moved = false;
  while (acc >= step) {
    acc -= step;
    let f = S.frame + 1;
    if (f >= S.doc.frames) { if (S.loop) f = 0; else { S.frame = S.doc.frames - 1; stopPlay(); updateTime(); return; } }
    S.frame = f; moved = true;
  }
  if (moved) { updateTime(); keepPlayheadVisible(); invalidate(); }
  playRAF = requestAnimationFrame(playTick);
}
function stopPlay() { S.playing = false; cancelAnimationFrame(playRAF); setPlayIcon(); pruneSel(); invalidate(); refreshProps(); }
function togglePlay() { S.playing ? stopPlay() : startPlay(); }

/* ---------- properties panel ---------- */
const setVal = (el, v) => { if (document.activeElement !== el) el.value = v; };
function refreshTransformFields() {
  const one = singleSel();
  const ids = ['tx', 'ty', 'tw', 'th', 'tr'];
  for (const id of ids) $('#' + id).disabled = !one;
  if (!one) { ids.forEach((id) => setVal($('#' + id), '')); return; }
  const o = one.o, lb = localBounds(o), wb = worldBounds(o);
  if (!lb || !wb) return;
  const r1 = (v) => String(Math.round(v * 10) / 10);
  setVal($('#tx'), r1((wb.x0 + wb.x1) / 2)); setVal($('#ty'), r1((wb.y0 + wb.y1) / 2));
  setVal($('#tw'), r1((lb.x1 - lb.x0) * Math.abs(o.t.sx))); setVal($('#th'), r1((lb.y1 - lb.y0) * Math.abs(o.t.sy)));
  setVal($('#tr'), r1(o.t.r));
}
let gsLast = null;
function gsSync(gr, one) {
  if (!gr) gsLast = null;
  if (arguments.length === 0) { const o = singleSel(); let g = null; if (o) walkPaths(o.o, (p) => { if (!g) g = p.grad; }); gr = g; one = o; }
  const box = $('#gradBox'); box.style.display = gr ? '' : 'none';
  if (!gr) return;
  const list = $('#gstops'), key = (one ? one.id : '') + ':' + gr.stops.length;
  if (list.dataset.key !== key) {
    list.dataset.key = key; list.innerHTML = '';
    gr.stops.forEach((st, i) => {
      const d = document.createElement('div'); d.className = 'gs'; d.dataset.i = i;
      d.innerHTML = '<input type="color" class="gc" aria-label="Stop colour"><input type="number" class="go" min="0" max="100" step="1" aria-label="Stop position in percent">%<input type="number" class="ga" min="0" max="100" step="1" aria-label="Stop opacity in percent" title="Opacity"><button type="button" class="gx btn" aria-label="Remove stop" title="Remove stop">\u00d7</button>';
      list.appendChild(d);
    });
  }
  gr.stops.forEach((st, i) => {
    const d = list.children[i]; if (!d) return;
    const set = (cls, v) => { const el = d.querySelector(cls); if (el && document.activeElement !== el && el.value !== String(v)) el.value = v; };
    set('.gc', st.c); set('.go', Math.round(st.o * 100)); set('.ga', Math.round(C.nz(st.a, 1) * 100));
    d.querySelector('.gx').disabled = gr.stops.length <= 2;
  });
}
window.gsSync = () => gsSync();
function refreshProps() {
  if (!S.doc) return;
  const sels = selEval(), one = sels.length === 1 ? sels[0] : null, st = S.style;
  $('#selInfo').textContent = sels.length ? (one ? (one.o.kind === 'group' ? 'group' : one.o.kind === 'clip' ? 'symbol' : one.o.kind === 'text' ? 'text' : one.o.kind === 'image' ? 'image' : 'path') : sels.length + ' objects') : 'none';
  let src = null;
  if (sels.length) walkPaths(sels[0].o, (p) => { if (!src) src = p; });
  const fill = src ? src.fill : (st.fillOn ? st.fill : null), stroke = src ? src.stroke : (st.strokeOn ? st.stroke : null);
  $('#fillOn').checked = !!fill; setVal($('#fillC'), fill || st.fill); setVal($('#fillA'), Math.round((src ? C.nz(src.fa, 1) : st.fa) * 100));
  $('#strokeOn').checked = !!stroke; setVal($('#strokeC'), stroke || st.stroke); setVal($('#strokeA'), Math.round((src ? C.nz(src.sa, 1) : st.sa) * 100));
  const gr = src && src.grad;
  const gType = gr ? gr.type : src ? 'solid' : (st.fillType || 'solid');
  setVal($('#fillType'), gType); setVal($('#fill2'), gr ? gr.stops[gr.stops.length - 1].c : st.fill2 || '#FFFFFF');
  $('#fill2').style.display = gr || gType !== 'solid' ? '' : 'none';
  $('#gEdit').checked = st.gradEdit !== false;
  gsSync(gr, one);
  let tx = null;
  for (const s of sels) if (s.o.kind === 'text') { tx = s.o; break; }
  const tr0 = tx ? tx.runs[0] : null;
  setVal($('#tFont'), tr0 ? tr0.font : st.font); setVal($('#tSize'), tr0 ? tr0.size : st.size);
  $('#tBold').checked = tr0 ? !!tr0.b : st.bold; $('#tItalic').checked = tr0 ? !!tr0.i : st.italic; setVal($('#tAlign'), tx ? tx.align || 'left' : st.align);
  { const k = curLayer() && C.kfAt(curLayer(), S.frame), nm = one && (one.o.kind === 'clip' || one.o.kind === 'text') ? one.o : null;
    $('#kfScript').disabled = !k; $('#kfLabel').disabled = !k; $('#iname').disabled = !nm;
    { const cl = one && one.o.kind === 'clip' ? one.o : null; $('#iclipRow').style.display = cl ? '' : 'none';
      if (cl) { setVal($('#itype'), cl.mc ? 'mc' : 'gr'); setVal($('#imode'), cl.mode || 'loop'); setVal($('#ifirst'), (cl.first || 0) + 1); $('#imode').style.display = $('#ifirst').style.display = cl.mc ? 'none' : ''; } }
    setVal($('#kfScript'), k && k.script || ''); setVal($('#kfLabel'), k && k.label || ''); setVal($('#iname'), nm && nm.name || '');
    refreshSoundSelect();
    $('#kfSound').disabled = !k; $('#kfSync').disabled = !k; $('#kfLoop').disabled = !k; $('#sndPlay').disabled = !k;
    { const sd = k && k.sound; setVal($('#kfSound'), sd ? sd.name : ''); setVal($('#kfSync'), sd ? sd.sync || 'event' : 'event'); setVal($('#kfLoop'), sd ? Math.max(0, sd.loop | 0) : 0); }
    $('#scriptInfo').textContent = k ? (k.script ? 'on frame ' + fnum(S.frame) : 'frame ' + fnum(S.frame)) : 'select a keyframe'; }
  setVal($('#sw'), src ? src.sw : st.sw); setVal($('#cap'), src ? src.cap || 'round' : st.cap); setVal($('#join'), src ? src.join || 'round' : st.join);
  setVal($('#opac'), one ? Math.round(C.nz(one.o.op, 1) * 100) : 100);
  $('#opac').disabled = !sels.length;
  $$('[data-act]').forEach((b) => { b.disabled = !sels.length; });
  refreshTransformFields();
  setVal($('#radius'), st.radius); setVal($('#smooth'), st.smooth);
  setVal($('#bsize'), st.bsize); setVal($('#bsizeR'), Math.min(200, st.bsize)); setVal($('#bshape'), st.bshape); $('#bpress').checked = !!st.bpress; $('#bmerge').checked = st.bmerge !== false; $('#bgap').value = st.bgap || 'small'; $('#ball').checked = !!st.ball; setVal($('#bangle'), st.bangle); setVal($('#bangleR'), st.bangle); setVal($('#bcolor'), st.bcolor); if (window.__angOff) window.__angOff(); fbSync();
  const l = curLayer(), kf = l && C.kfFor(l, S.frame), nx = kf && l.kfs[l.kfs.indexOf(kf) + 1];
  $('#tweenType').value = kf ? kf.tween : 'none';
  $('#easeType').value = kf && kf.ease ? kf.ease.type : 'linear'; setVal($('#easeAmt'), kf && kf.ease ? kf.ease.amt : 50);
  drawEaseCurve();
  $('#tweenInfo').textContent = kf ? 'span ' + fnum(kf.f) + ' to ' + (nx ? fnum(nx.f) : 'end') : '';
  const d = S.doc;
  setVal($('#dname'), d.name || 'My animation'); setVal($('#dw'), d.w); setVal($('#dh'), d.h); setVal($('#dfps'), d.fps); setVal($('#dframes'), d.frames); setVal($('#dbg'), /^#[0-9a-f]{6}$/i.test(d.bg) ? d.bg : '#ffffff');
  syncStyleUI();
  trackSelTab(sels); refreshAlignUI(sels.length); renderLibrary();
}
function syncStyleUI() {
  const st = S.style;
  setVal($('#swFill'), st.fill); setVal($('#swStroke'), st.stroke);
  $('#swFill').style.opacity = st.fillOn ? 1 : 0.35; $('#swStroke').style.opacity = st.strokeOn ? 1 : 0.35;
}
function syncOnionUI() {
  $('#onionOn').checked = S.onion.on; $('#pOnion').setAttribute('aria-pressed', String(S.onion.on));
  setVal($('#onionB'), S.onion.b); setVal($('#onionA'), S.onion.a);
}
function styleEdit(patch, fn) {
  Object.assign(S.style, patch);
  if (S.sel.length) {
    beginEditOnce();
    for (const lid of selLayerIds()) C.ensureEditable(getLayer(lid), S.frame);
    for (const s of S.sel) { const o = findEditable(s.lid, s.id); if (o) walkPaths(o, fn); }
    commit();
  } else syncStyleUI();
}
function bindProps() {
  const on = (sel, ev, fn) => $(sel).addEventListener(ev, fn);
  on('#fillOn', 'change', (e) => { const v = e.target.checked, c = $('#fillC').value; styleEdit({ fillOn: v, fill: c }, (p) => { p.fill = v ? c : null; if (v && p.fa == null) p.fa = 1; }); });
  on('#fillC', 'input', (e) => { const c = e.target.value; styleEdit({ fill: c, fillOn: true }, (p) => { p.fill = c; if (p.fa == null) p.fa = 1; }); });
  on('#fillC', 'input', (e) => { const c = e.target.value; styleEdit({ fill: c, fillOn: true }, (p) => { if (p.grad) p.grad.stops[0].c = c; }); });
  on('#fill2', 'input', (e) => { const c = e.target.value; styleEdit({ fill2: c }, (p) => { if (p.grad) p.grad.stops[p.grad.stops.length - 1].c = c; }); });
  on('#fillType', 'change', (e) => {
    const ty = e.target.value;
    styleEdit({ fillType: ty }, (p) => {
      if (p.kind !== 'path') return;
      if (ty === 'solid') { delete p.grad; return; }
      if (!p.fill) { p.fill = S.style.fill; p.fa = 1; }
      const c2 = $('#fill2').value || '#FFFFFF', old = p.grad;
      const g = makeGrad(ty, p.contours, p.fill, c2);
      if (!g) return;
      if (old && old.stops && old.stops.length > 2) { g.stops = old.stops.map((x) => Object.assign({}, x)); }
      p.grad = g;
    });
    refreshProps();
  });
  /* gradient stop list */
  const gsBox = $('#gstops');
  const gsEdit = (i, fn) => styleEdit({}, (p) => { if (p.grad && p.grad.stops[i]) fn(p.grad.stops[i], p); });
  gsBox.addEventListener('input', (e) => {
    const row = e.target.closest('.gs'); if (!row) return; const i = +row.dataset.i, t = e.target;
    if (t.classList.contains('gc')) gsEdit(i, (st, p) => { st.c = t.value; if (i === 0) p.fill = t.value; });
    else if (t.classList.contains('ga')) gsEdit(i, (st) => { st.a = Math.max(0, Math.min(1, (+t.value || 0) / 100)); });
  });
  gsBox.addEventListener('change', (e) => {
    const row = e.target.closest('.gs'); if (!row || !e.target.classList.contains('go')) return;
    const i = +row.dataset.i, v = Math.max(0, Math.min(100, +e.target.value || 0)) / 100;
    gsEdit(i, (st) => { st.o = v; });
  });
  gsBox.addEventListener('click', (e) => {
    const b = e.target.closest('.gx'); if (!b) return; const i = +b.closest('.gs').dataset.i;
    styleEdit({}, (p) => { if (p.grad && p.grad.stops.length > 2) p.grad.stops.splice(i, 1); });
  });
  on('#gAdd', 'click', () => {
    styleEdit({}, (p) => {
      if (!p.grad) return;
      const s = p.grad.stops.slice().sort((a, b) => a.o - b.o); let bi = 0, bg = -1;
      for (let i = 0; i < s.length - 1; i++) if (s[i + 1].o - s[i].o > bg) { bg = s[i + 1].o - s[i].o; bi = i; }
      const t = (s[bi].o + s[bi + 1].o) / 2, col = gradColorAt(s, t);
      p.grad.stops.push({ o: t, c: col.c, a: col.a }); p.grad.stops.sort((a, b) => a.o - b.o);
    });
  });
  on('#gEdit', 'change', (e) => { S.style.gradEdit = e.target.checked; invalidate(); });
  const textEdit = (patch, tpatch) => {
    Object.assign(S.style, patch);
    const sel = S.sel.map((s) => ({ s, o: null }));
    const has = S.sel.some((s) => { const o = findEval(s.lid, s.id); return o && o.kind === 'text'; });
    if (!has) return;
    beginEditOnce();
    for (const lid of selLayerIds()) C.ensureEditable(getLayer(lid), S.frame);
    for (const s of S.sel) { const o = findEditable(s.lid, s.id); if (o && o.kind === 'text') { if (tpatch.align) o.align = tpatch.align; const rp = Object.assign({}, tpatch); delete rp.align; o.runs.forEach((r) => Object.assign(r, rp)); } }
    commit();
  };
  on('#tFont', 'change', (e) => textEdit({ font: e.target.value }, { font: e.target.value }));
  on('#tSize', 'input', (e) => { const v = clamp(parseFloat(e.target.value) || 0, 1, 600); if (e.target.value) textEdit({ size: v }, { size: v }); });
  on('#tBold', 'change', (e) => textEdit({ bold: e.target.checked }, { b: e.target.checked }));
  on('#tItalic', 'change', (e) => textEdit({ italic: e.target.checked }, { i: e.target.checked }));
  on('#tAlign', 'change', (e) => textEdit({ align: e.target.value }, { align: e.target.value }));
  on('#fillA', 'input', (e) => { const a = e.target.value / 100; styleEdit({ fa: a }, (p) => { p.fa = a; }); });
  on('#strokeOn', 'change', (e) => { const v = e.target.checked, c = $('#strokeC').value; styleEdit({ strokeOn: v, stroke: c }, (p) => { p.stroke = v ? c : null; if (v && !(p.sw > 0)) p.sw = S.style.sw || 3; if (v && p.sa == null) p.sa = 1; }); });
  on('#strokeC', 'input', (e) => { const c = e.target.value; styleEdit({ stroke: c, strokeOn: true }, (p) => { p.stroke = c; if (!(p.sw > 0)) p.sw = S.style.sw || 3; }); });
  on('#strokeA', 'input', (e) => { const a = e.target.value / 100; styleEdit({ sa: a }, (p) => { p.sa = a; }); });
  on('#sw', 'input', (e) => { const v = clamp(parseFloat(e.target.value) || 0, 0, 200); styleEdit({ sw: v }, (p) => { p.sw = v; }); });
  on('#cap', 'change', (e) => { const v = e.target.value; styleEdit({ cap: v }, (p) => { p.cap = v; }); });
  on('#join', 'change', (e) => { const v = e.target.value; styleEdit({ join: v }, (p) => { p.join = v; }); });
  on('#swFill', 'input', (e) => { const c = e.target.value; styleEdit({ fill: c, fillOn: true }, (p) => { p.fill = c; if (p.fa == null) p.fa = 1; }); refreshProps(); });
  on('#swStroke', 'input', (e) => { const c = e.target.value; styleEdit({ stroke: c, strokeOn: true }, (p) => { p.stroke = c; if (!(p.sw > 0)) p.sw = S.style.sw || 3; }); refreshProps(); });
  on('#opac', 'input', (e) => {
    const v = e.target.value / 100;
    beginEditOnce();
    for (const lid of selLayerIds()) C.ensureEditable(getLayer(lid), S.frame);
    for (const s of S.sel) { const o = findEditable(s.lid, s.id); if (o) o.op = v; }
    commit();
  });
  const xf = (field) => (e) => {
    const val = parseFloat(e.target.value);
    const one = singleSel();
    if (!one || !isFinite(val)) return;
    beginEditOnce();
    C.ensureEditable(getLayer(one.lid), S.frame);
    const o = findEditable(one.lid, one.id);
    if (!o) return;
    const lb = localBounds(o);
    if (!lb) return;
    const cx = (lb.x0 + lb.x1) / 2, cy = (lb.y0 + lb.y1) / 2;
    const Cw = mapply(matOf(o.t), cx, cy);
    if (field === 'tx' || field === 'ty') {
      const wb = worldBounds(o);
      if (field === 'tx') o.t.x += val - (wb.x0 + wb.x1) / 2; else o.t.y += val - (wb.y0 + wb.y1) / 2;
    } else {
      if (field === 'tw' && lb.x1 - lb.x0 > 1e-6 && val > 0) o.t.sx = (o.t.sx < 0 ? -1 : 1) * val / (lb.x1 - lb.x0);
      if (field === 'th' && lb.y1 - lb.y0 > 1e-6 && val > 0) o.t.sy = (o.t.sy < 0 ? -1 : 1) * val / (lb.y1 - lb.y0);
      if (field === 'tr') o.t.r = val;
      const r = o.t.r * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      o.t.x = Cw[0] - (c * o.t.sx * cx - s * o.t.sy * cy);
      o.t.y = Cw[1] - (s * o.t.sx * cx + c * o.t.sy * cy);
    }
    invalidate(); clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700);
  };
  for (const id of ['tx', 'ty', 'tw', 'th', 'tr']) on('#' + id, 'input', xf(id));
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => arrange(b.dataset.act)));
  on('#radius', 'input', (e) => { S.style.radius = clamp(parseFloat(e.target.value) || 0, 0, 500); });
  on('#smooth', 'input', (e) => { S.style.smooth = +e.target.value; });
  $('#bshape').innerHTML = BRUSH_SHAPES.map((x) => '<option value="' + x[0] + '">' + x[1] + '</option>').join('');
  const setBSize = (v) => { S.style.bsize = clamp(Math.round(v) || 1, 1, 500); setVal($('#bsize'), S.style.bsize); setVal($('#bsizeR'), Math.min(200, S.style.bsize)); invalidate(); };
  on('#bsizeR', 'input', (e) => setBSize(+e.target.value)); on('#bsize', 'input', (e) => { if (e.target.value !== '') setBSize(+e.target.value); });
  const angOff = () => { const off = S.style.bshape === 'round'; $('#bangle').disabled = off; $('#bangleR').disabled = off; };
  on('#bshape', 'change', (e) => { S.style.bshape = e.target.value; angOff(); invalidate(); });
  const setBAng = (v) => { S.style.bangle = clamp(Math.round(v) || 0, 0, 180); setVal($('#bangle'), S.style.bangle); setVal($('#bangleR'), S.style.bangle); invalidate(); };
  on('#bangleR', 'input', (e) => setBAng(+e.target.value)); on('#bangle', 'input', (e) => { if (e.target.value !== '') setBAng(+e.target.value); });
  on('#bcolor', 'input', (e) => { S.style.bcolor = e.target.value; invalidate(); });
  window.__angOff = angOff;
  on('#bpress', 'change', (e) => { S.style.bpress = e.target.checked; });
  on('#bmerge', 'change', (e) => { S.style.bmerge = e.target.checked; });
  on('#bgap', 'change', (e) => { S.style.bgap = e.target.value; });
  on('#ball', 'change', (e) => { S.style.ball = e.target.checked; });
  window.__setBSize = setBSize;
  on('#tweenType', 'change', (e) => frameAction(e.target.value === 'none' ? 'notween' : e.target.value));
  const easeEdit = () => {
    const l = curLayer(), kf = l && C.kfFor(l, S.frame);
    if (!kf) return;
    beginEditOnce();
    const type = $('#easeType').value;
    kf.ease = type === 'bezier' ? { type, amt: 50, p: (kf.ease && kf.ease.p) || bezFor(kf.ease) } : { type, amt: +$('#easeAmt').value };
    commit();
  };
  on('#easeType', 'change', easeEdit); on('#easeAmt', 'input', easeEdit);
  on('#dname', 'input', (e) => { beginEditOnce(); S.doc.name = e.target.value.slice(0, 60); clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700); });
  const docNum = (id, key, lo, hi) => on('#' + id, 'change', (e) => {
    let v = Math.round(parseFloat(e.target.value));
    if (!isFinite(v)) { refreshProps(); return; }
    v = clamp(v, lo, hi);
    if (key === 'frames') {
      const mk = Math.max(...S.doc.layers.map((l) => l.kfs[l.kfs.length - 1].f)) + 1;
      if (v < mk) { v = mk; toast('Frames can’t go below the last keyframe (' + mk + ').'); }
    }
    pushUndo(); S.doc[key] = v;
    if (S.frame >= S.doc.frames) S.frame = S.doc.frames - 1;
    refreshAll(); if (key === 'w' || key === 'h') fitView();
  });
  docNum('dw', 'w', 16, 4096); docNum('dh', 'h', 16, 4096); docNum('dfps', 'fps', 1, 120); docNum('dframes', 'frames', 1, 900);
  on('#dbg', 'input', (e) => { beginEditOnce(); S.doc.bg = e.target.value; commit(); });
  on('#onionOn', 'change', (e) => { S.onion.on = e.target.checked; syncOnionUI(); invalidate(); });
  on('#pOnion', 'click', () => { S.onion.on = !S.onion.on; syncOnionUI(); invalidate(); });
  on('#onionB', 'input', (e) => { S.onion.b = clamp(parseInt(e.target.value, 10) || 0, 0, 5); invalidate(); });
  on('#onionA', 'input', (e) => { S.onion.a = clamp(parseInt(e.target.value, 10) || 0, 0, 5); invalidate(); });
}

/* ---------- easing curve editor ---------- */
const EASE_PRESETS = [['Linear', [0, 0, 1, 1]], ['Ease', [0.25, 0.1, 0.25, 1]], ['Ease in', [0.42, 0, 1, 1]], ['Ease out', [0, 0, 0.58, 1]], ['Ease in-out', [0.42, 0, 0.58, 1]], ['Sine in-out', [0.37, 0, 0.63, 1]], ['Cubic out', [0.215, 0.61, 0.355, 1]], ['Expo out', [0.16, 1, 0.3, 1]], ['Snap', [0.8, 0, 0.2, 1]], ['Back in', [0.6, -0.28, 0.735, 0.045]], ['Back out', [0.175, 0.885, 0.32, 1.275]], ['Back in-out', [0.68, -0.55, 0.265, 1.55]]];
function bezFor(e) {
  if (!e) return [0.25, 0.1, 0.25, 1];
  if (e.p) return e.p.slice();
  const k = 1 + clamp(e.amt == null ? 50 : e.amt, 0, 100) / 100 * 3;
  if (e.type === 'in') return [0.3 + 0.2 * (k - 1) / 3, 0, 1, 1].map((v, i) => (i === 0 ? +Math.min(0.75, 0.2 + (k - 1) * 0.18).toFixed(2) : v));
  if (e.type === 'out') return [0, 0, +Math.max(0.25, 0.8 - (k - 1) * 0.18).toFixed(2), 1];
  if (e.type === 'inout') return [+Math.min(0.7, 0.2 + (k - 1) * 0.15).toFixed(2), 0, +Math.max(0.3, 0.8 - (k - 1) * 0.15).toFixed(2), 1];
  if (e.type === 'linear' || !e.type) return [0, 0, 1, 1];
  return [0.25, 0.1, 0.25, 1];
}
const EZ = { w: 260, h: 180, pad: 22, lo: -0.6, hi: 1.6, drag: -1 };
const ezX = (x) => EZ.pad + x * (EZ.w - 2 * EZ.pad);
const ezY = (y) => EZ.h - EZ.pad - (y - EZ.lo) / (EZ.hi - EZ.lo) * (EZ.h - 2 * EZ.pad);
const ezInvX = (px) => (px - EZ.pad) / (EZ.w - 2 * EZ.pad);
const ezInvY = (py) => EZ.lo + (EZ.h - EZ.pad - py) / (EZ.h - 2 * EZ.pad) * (EZ.hi - EZ.lo);
function drawEaseCurve() {
  const cv = $('#easeCv'); if (!cv) return;
  const l = curLayer(), kf = l && C.kfFor(l, S.frame), on = !!(kf && kf.tween && kf.tween !== 'none');
  $('#easeBox').style.display = on ? '' : 'none';
  if (!on) return;
  const e = kf.ease || { type: 'linear' }, isB = e.type === 'bezier';
  $('#easeAmtRow').style.display = isB ? 'none' : '';
  const q = isB && e.p ? e.p : bezFor(e), ctx = cv.getContext('2d'), cs = getComputedStyle(document.documentElement);
  const acc = cs.getPropertyValue('--accent').trim() || '#3F5BFF', mut = cs.getPropertyValue('--mut').trim() || '#888', line = cs.getPropertyValue('--line').trim() || '#ccc';
  ctx.clearRect(0, 0, EZ.w, EZ.h);
  ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.setLineDash([3, 3]);
  for (const y of [0, 1]) { ctx.beginPath(); ctx.moveTo(ezX(0), ezY(y)); ctx.lineTo(ezX(1), ezY(y)); ctx.stroke(); }
  for (const x of [0, 1]) { ctx.beginPath(); ctx.moveTo(ezX(x), ezY(0)); ctx.lineTo(ezX(x), ezY(1)); ctx.stroke(); }
  ctx.setLineDash([]);
  if (isB) { ctx.strokeStyle = mut; ctx.beginPath(); ctx.moveTo(ezX(0), ezY(0)); ctx.lineTo(ezX(q[0]), ezY(q[1])); ctx.moveTo(ezX(1), ezY(1)); ctx.lineTo(ezX(q[2]), ezY(q[3])); ctx.stroke(); }
  ctx.strokeStyle = acc; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 80; i++) { const t = i / 80, v = isB ? C.bezierEase(t, q[0], q[1], q[2], q[3]) : C.ease(e.type, e.amt, t); i ? ctx.lineTo(ezX(t), ezY(v)) : ctx.moveTo(ezX(t), ezY(v)); }
  ctx.stroke();
  if (isB) for (const [i, x, y] of [[0, q[0], q[1]], [1, q[2], q[3]]]) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(ezX(x), ezY(y), 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  for (let i = 0; i < 4; i++) setVal($('#bz' + i), q[i]);
  const ps = $('#easePreset'); if (!ps.options.length) { ps.innerHTML = '<option value="">Presets…</option>' + EASE_PRESETS.map((x, i) => '<option value="' + i + '">' + x[0] + '</option>').join(''); }
  $('#easeHint').textContent = isB ? 'cubic-bezier(' + q.map((v) => +(+v).toFixed(2)).join(', ') + ') · drag the dots, or type values.' : 'Drag the curve handles (or pick a preset) to turn this into a custom curve.';
}
function setBez(q) {
  const l = curLayer(), kf = l && C.kfFor(l, S.frame);
  if (!kf) return;
  beginEditOnce();
  kf.ease = { type: 'bezier', amt: 50, p: [clamp(q[0], 0, 1), clamp(q[1], -1, 2), clamp(q[2], 0, 1), clamp(q[3], -1, 2)].map((v) => Math.round(v * 1000) / 1000) };
  commit();
}
function bindEase() {
  const cv = $('#easeCv'), pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * EZ.w / r.width, (e.clientY - r.top) * EZ.h / r.height]; };
  cv.addEventListener('pointerdown', (e) => {
    const l = curLayer(), kf = l && C.kfFor(l, S.frame); if (!kf) return;
    const q = kf.ease && kf.ease.type === 'bezier' && kf.ease.p ? kf.ease.p : bezFor(kf.ease), [px, py] = pos(e);
    const d0 = Math.hypot(px - ezX(q[0]), py - ezY(q[1])), d1 = Math.hypot(px - ezX(q[2]), py - ezY(q[3]));
    if (Math.min(d0, d1) > 16) return;
    cv.setPointerCapture(e.pointerId); EZ.drag = d0 <= d1 ? 0 : 1;
    if (!(kf.ease && kf.ease.type === 'bezier')) setBez(q);
  });
  cv.addEventListener('pointermove', (e) => {
    if (EZ.drag < 0) return;
    const l = curLayer(), kf = l && C.kfFor(l, S.frame); if (!kf || !kf.ease || !kf.ease.p) return;
    const [px, py] = pos(e), q = kf.ease.p.slice();
    q[EZ.drag * 2] = ezInvX(px); q[EZ.drag * 2 + 1] = ezInvY(py);
    setBez(q);
  });
  const up = () => { EZ.drag = -1; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  for (let i = 0; i < 4; i++) $('#bz' + i).addEventListener('input', () => { const q = [0, 1, 2, 3].map((j) => parseFloat($('#bz' + j).value)); if (q.every((v) => isFinite(v))) setBez(q); });
  $('#easePreset').addEventListener('change', (e) => { if (e.target.value !== '') setBez(EASE_PRESETS[+e.target.value][1]); e.target.value = ''; });
}

/* ---------- arrange / group / clipboard ---------- */
function editableSel() {
  const out = [];
  for (const lid of selLayerIds()) {
    const l = getLayer(lid);
    if (!l || l.locked) continue;
    const kf = C.ensureEditable(l, S.frame);
    out.push({ l, kf, ids: S.sel.filter((s) => s.lid === lid).map((s) => s.id) });
  }
  return out;
}
function arrange(act) {
  if (act === 'edit') { const one = singleSel(); if (one && one.o.kind === 'clip') enterSym(one.o.sym); else toast('Select an imported symbol first.'); return; }
  if (act === 'group') return groupSel();
  if (act === 'ungroup') return ungroupSel();
  if (act === 'dup') return duplicateSel();
  if (act === 'del') return deleteSel();
  if (!S.sel.length) return;
  pushUndo();
  for (const { kf, ids } of editableSel()) {
    const set = new Set(ids), objs = kf.objs;
    if (act === 'front') kf.objs = objs.filter((o) => !set.has(o.id)).concat(objs.filter((o) => set.has(o.id)));
    else if (act === 'back') kf.objs = objs.filter((o) => set.has(o.id)).concat(objs.filter((o) => !set.has(o.id)));
    else if (act === 'forward') { for (let i = objs.length - 2; i >= 0; i--) if (set.has(objs[i].id) && !set.has(objs[i + 1].id)) [objs[i], objs[i + 1]] = [objs[i + 1], objs[i]]; }
    else if (act === 'backward') { for (let i = 1; i < objs.length; i++) if (set.has(objs[i].id) && !set.has(objs[i - 1].id)) [objs[i], objs[i - 1]] = [objs[i - 1], objs[i]]; }
  }
  commit();
}
function groupSel() {
  const lids = selLayerIds();
  if (S.sel.length < 2) { toast('Select two or more objects to group.'); return; }
  if (lids.length > 1) { toast('Grouping works within a single layer.'); return; }
  const l = getLayer(lids[0]);
  if (l.locked) return;
  pushUndo();
  const kf = C.ensureEditable(l, S.frame);
  const objs = kf.objs.filter((o) => S.sel.some((s) => s.id === o.id));
  if (objs.length < 2) { H.stack.pop(); return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of objs) { const b = worldBounds(o); if (b) { x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); } }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const g = { id: uid(), kind: 'group', children: [], op: 1, t: { x: cx, y: cy, sx: 1, sy: 1, r: 0 } };
  const top = Math.max(...objs.map((o) => kf.objs.indexOf(o)));
  for (const o of objs) { o.t.x -= cx; o.t.y -= cy; g.children.push(o); }
  kf.objs = kf.objs.filter((o) => !objs.includes(o));
  kf.objs.splice(Math.min(top - objs.length + 1, kf.objs.length), 0, g);
  S.sel = [{ lid: l.id, id: g.id }];
  commit();
}
function ungroupSel() {
  const groups = selEval().filter((s) => s.o.kind === 'group');
  if (!groups.length) { toast('Select a group to ungroup.'); return; }
  pushUndo();
  const newSel = [];
  for (const lid of new Set(groups.map((g) => g.lid))) {
    const l = getLayer(lid);
    if (l.locked) continue;
    const kf = C.ensureEditable(l, S.frame);
    for (const gs of groups.filter((g) => g.lid === lid)) {
      const idx = kf.objs.findIndex((o) => o.id === gs.id);
      if (idx < 0) continue;
      const g = kf.objs[idx], kids = [];
      for (const c of g.children) {
        C.setObjMatrix(c, mmul(matOf(g.t), matOf(c.t)));
        c.op = C.nz(c.op, 1) * C.nz(g.op, 1); c.id = uid();
        kids.push(c); newSel.push({ lid, id: c.id });
      }
      kf.objs.splice(idx, 1, ...kids);
    }
  }
  S.sel = newSel; commit();
}
function duplicateSel() {
  if (!S.sel.length) return;
  pushUndo();
  const newSel = [];
  for (const { l, kf, ids } of editableSel()) {
    for (const id of ids) {
      const i = kf.objs.findIndex((o) => o.id === id);
      if (i < 0) continue;
      const c = clone(kf.objs[i]); c.id = uid(); c.t.x += 12; c.t.y += 12;
      kf.objs.splice(i + 1, 0, c); newSel.push({ lid: l.id, id: c.id });
    }
  }
  S.sel = newSel; commit();
}
function deleteSel() {
  if (!S.sel.length) return;
  pushUndo();
  for (const { kf, ids } of editableSel()) kf.objs = kf.objs.filter((o) => !ids.includes(o.id));
  S.sel = []; S.nodeSel = null; commit();
}
function copySel() { S.clipboard = selEval().map((s) => clone(s.o)); if (S.clipboard.length) toast('Copied ' + S.clipboard.length + (S.clipboard.length > 1 ? ' objects' : ' object')); }
let pasteN = 0;
function pasteClip() {
  if (!S.clipboard.length) return;
  const l = curLayer();
  if (!l || l.locked || !l.visible) { toast('Pick an unlocked, visible layer to paste into.'); return; }
  pushUndo();
  const kf = C.ensureEditable(l, S.frame);
  pasteN++;
  const sel = [];
  for (const o of S.clipboard) { const c = clone(o); c.id = uid(); c.t.x += 10 * pasteN; c.t.y += 10 * pasteN; kf.objs.push(c); sel.push({ lid: l.id, id: c.id }); }
  S.sel = sel; commit();
}
function nudge(dx, dy) {
  if (!S.sel.length) return;
  beginEditOnce();
  for (const { kf, ids } of editableSel()) for (const o of kf.objs) if (ids.includes(o.id)) { o.t.x += dx; o.t.y += dy; }
  commit();
}

/* ---------- menus & modal ---------- */
let menuEl = null, menuAnchor = null;
function closeMenu() { if (menuEl) menuEl.remove(); menuEl = null; if (menuAnchor) menuAnchor.setAttribute('aria-expanded', 'false'); menuAnchor = null; }
function showMenu(anchor, items, pos) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu-pop'; m.setAttribute('role', 'menu');
  for (const it of items) {
    if (it === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button');
    b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span></span>' + (it.kbd ? '<kbd></kbd>' : '');
    b.firstChild.textContent = it.label;
    if (it.kbd) b.lastChild.textContent = it.kbd;
    b.disabled = !!it.disabled;
    b.addEventListener('click', () => { closeMenu(); it.fn(); });
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = anchor ? anchor.getBoundingClientRect() : null;
  let x = pos ? pos.x : r.left, y = pos ? pos.y : r.bottom + 4;
  const mr = m.getBoundingClientRect();
  x = Math.min(x, window.innerWidth - mr.width - 8); y = Math.min(y, window.innerHeight - mr.height - 8);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = Math.max(8, y) + 'px';
  menuEl = m; menuAnchor = anchor;
  if (anchor) anchor.setAttribute('aria-expanded', 'true');
}
window.addEventListener('pointerdown', (e) => { if (menuEl && !menuEl.contains(e.target) && e.target !== menuAnchor) closeMenu(); }, true);
const modalBg = $('#modalBg');
let modalCancel = null;
function openModal(title, html, buttons) {
  closeMenu();
  $('#mTitle').textContent = title;
  $('#mBody').innerHTML = html;
  const f = $('#mFoot'); f.textContent = '';
  for (const b of buttons || [{ label: 'Close' }]) {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' primary' : ''); el.textContent = b.label;
    el.addEventListener('click', () => { if (b.fn) b.fn(); if (!b.keep) closeModal(); });
    f.appendChild(el);
  }
  modalBg.classList.add('on');
  const first = f.querySelector('.primary') || f.querySelector('button');
  if (first) first.focus();
  return $('#mBody');
}
function closeModal() { modalBg.classList.remove('on'); $('#modal').classList.remove('wide'); if (modalCancel) { const c = modalCancel; modalCancel = null; c(); } }
modalBg.addEventListener('pointerdown', (e) => { if (e.target === modalBg && !modalCancel) closeModal(); });

/* ---------- files ---------- */
const safeName = (s) => (String(s || 'animation').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'animation').slice(0, 60);
async function saveFile(name, data) {
  let dl = null;
  const hasClaude = !!(window.claude && window.claude.use);
  try { if (hasClaude) dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data }); toast('Saved ' + name); return true; }
    catch (err) {
      if (err && err.code === 'declined') return false;
      if (err && err.code === 'rejected_extension') toast('This view can’t save .' + name.split('.').pop() + ' files.');
      else toast('Could not save the file' + (err && err.message ? ': ' + err.message : '.'));
    }
    return false;
  }
  if (hasClaude) { toast('Saving files is not available in this view.'); return false; }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return true;
}
function saveProject() {
  exitAllSyms();
  const name = safeName(S.doc.name);
  if (missingMedia().images + missingMedia().sounds) toast('Warning: some images or sounds are missing from this project (they couldn’t be restored after reload), so they will not be in the saved file.');
  saveFile(name + '.onionskyn.json', JSON.stringify({ app: 'Onionskyn', version: PROJECT_VERSION, appVersion: APP_VERSION, saved: new Date().toISOString(), doc: S.doc })).then((ok) => { if (ok) clearDirty(); });
}
function loadDoc(doc) {
  S.edit = []; updateCrumb();
  doc.lib = doc.lib || {}; doc.sounds = doc.sounds || {}; doc.images = doc.images || {};
  S.doc = doc; C.setLib(doc.lib); C.setImages(doc.images); persistSounds(); persistImages(); sndSig = null; libSig = ''; autosaveWarned = false; clearDirty(); S.frame = 0; S.sel = []; S.nodeSel = null; S.pen = null; S.draw = null;
  S.layerId = doc.layers[doc.layers.length - 1].id;
  H.stack = []; H.redo = [];
  stopPlay();
  buildLayerList(); fitView(); refreshAll();
}
function updateCrumb() {
  const c = $('#crumb');
  c.classList.toggle('on', S.edit.length > 0);
  if (!S.edit.length) return;
  $('#crumbPath').textContent = 'Scene 1 › ' + S.edit.map((e) => e.sym.split('/').pop()).join(' › ');
}
function enterSym(sym) {
  if (S.playing) stopPlay();
  if (!enterSymRaw(sym)) { toast('That symbol is not in the library.'); return; }
  S.frame = 0; S.layerId = layers()[layers().length - 1].id; S.sel = []; S.nodeSel = null; S.pen = null; S.draw = null;
  buildLayerList(); fitView(); refreshAll(); updateCrumb();
  if (S.doc.frames === 1 && !enterSym.hinted) { enterSym.hinted = true; toast('This symbol has 1 frame. Press F5 (or + Frame) to add frames, then F6 for keyframes, to animate it.'); }
}
function exitSym() {
  if (!S.edit.length) return;
  if (S.playing) stopPlay();
  const e = exitSymRaw();
  S.frame = clamp(e.frame, 0, S.doc.frames - 1); S.layerId = getLayer(e.layerId) ? e.layerId : layers()[layers().length - 1].id; S.sel = []; S.nodeSel = null;
  buildLayerList(); fitView(); refreshAll(); updateCrumb();
}
function exitAllSyms() { while (S.edit.length) exitSym(); }
function newDoc() {
  const d = C.mkDoc();
  d.name = 'Untitled';
  loadDoc(d);
}
function confirmReplace(what, go) {
  openModal(what, '<p>This replaces your current animation. Use <b>File → Save project</b> first if you want to keep it.</p>', [{ label: 'Cancel' }, { label: 'Replace', primary: true, fn: go }]);
}
$('#fileIn').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (f) openFile(f);
});
async function openFile(file) {
  let buf;
  try { buf = await file.arrayBuffer(); } catch (err) { toast('Could not read that file.'); return; }
  if (isImageFile(file)) { await importImages([file]); return; }
  if (/^audio\//.test(file.type) || /\.(mp3|wav|ogg|m4a)$/i.test(file.name)) { const n = await addSoundFile(file); if (n) toast('Added sound ' + n); return; }
  const u = new Uint8Array(buf);
  if ((u[0] === 0x50 && u[1] === 0x4b) || (u[0] === 0xd0 && u[1] === 0xcf)) return importFLAFile(buf, file.name);
  try {
    const j = JSON.parse(new TextDecoder().decode(u));
    const doc = j.doc || j;
    if (!doc || !Array.isArray(doc.layers)) throw new Error('x');
    if (j.version > PROJECT_VERSION) toast('This project was saved by a newer Onionskyn (' + (j.appVersion || 'v' + j.version) + '). Some things may not load correctly.');
    C.normalizeDoc(doc);
    if (!doc.name) doc.name = file.name.replace(/\.[^.]+$/, '').replace(/\.(flashcraft|onionskyn)$/, '');
    loadDoc(doc); toast('Opened ' + file.name);
  } catch (err) { toast('That file is not a Onionskyn project or a .fla.'); }
}
async function importFLAFile(buf, fname) {
  if (typeof JSZip === 'undefined') { openModal('FLA import unavailable', '<p>The ZIP library did not load, so .fla files can’t be read in this view. Check your connection and reload.</p>'); return; }
  openModal('Importing ' + fname, '<p>Reading the document…</p>', [{ label: 'Close' }]);
  await new Promise((r) => setTimeout(r, 30));
  try {
    const { doc, report } = await C.importFLA(buf);
    doc.name = fname.replace(/\.[^.]+$/, '');
    loadDoc(doc);
    const notes = [];
    const plural = (n, s) => n + ' ' + s + (n === 1 ? '' : 's');
    if (report.animatedSyms.length) notes.push(plural(report.animatedSyms.length, 'animated symbol') + ' imported with their inner timelines (e.g. ' + report.animatedSyms.slice(0, 3).join(', ') + '); they play on their own.');
    if (report.gradient) notes.push(plural(report.gradient, 'gradient fill') + ' imported as real gradients.');
    if (report.textCount) notes.push(plural(report.textCount, 'text field') + ' imported as editable text; fonts not installed on this device fall back to a similar one.');
    if (report.buttons) notes.push(plural(report.buttons, 'button') + ' shown in the Up state.');
    if (report.scripts) notes.push('JavaScript in ' + plural(report.scripts, 'frame') + ' was imported (marked “a” on the timeline). It runs in ▶ Preview and the HTML export, never in the editor. Scripts that need CreateJS features beyond MovieClip basics, events, text and Ticker, or that load files, may report errors in Preview.');
    if (report.sounds) notes.push(plural(report.sounds, 'sound') + ' imported' + (report.soundFrames ? ' (' + plural(report.soundFrames, 'timeline sound') + ' marked ♪)' : '') + '. Sounds play in ▶ Preview and the HTML export; the editor timeline stays silent (use ▶ in the Library tab to audition).' + (report.soundMissing ? ' ' + plural(report.soundMissing, 'sound') + ' could not be read.' : ''));
    if (report.images) notes.push(plural(report.images, 'bitmap image') + ' imported' + (report.bitmapMissing ? ' (' + report.bitmapMissing + ' could not be read)' : '') + '.');
    if (report.bitmap) notes.push(plural(report.bitmap, 'bitmap fill') + ' skipped (only placed images are imported).');
    if (report.tlf) notes.push(plural(report.tlf, 'TLF text field') + ' skipped.');
    if (report.mask) notes.push(plural(report.mask, 'mask layer') + ' imported' + (report.masked ? ' with ' + plural(report.masked, 'masked layer') : '') + '. Mask shapes appear as a faint blue overlay in the editor and clip the layers below them in Preview and exports.');
    if (report.guide) notes.push(plural(report.guide, 'guide layer') + ' skipped; tweens along motion guides run in a straight line.');
    if (report.motionObject) notes.push(plural(report.motionObject, 'new-style motion tween') + ' kept as still frames (only classic and shape tweens import).');
    if (report.missing) notes.push(plural(report.missing, 'symbol instance') + ' referenced a missing library item.');
    if (report.scenes > 1) notes.push('Only the first of ' + report.scenes + ' scenes was imported.');
    const body = '<p><b>' + doc.w + ' × ' + doc.h + '</b> at ' + doc.fps + ' fps, ' + plural(doc.layers.length, 'layer') + ', ' + plural(doc.frames, 'frame') + '.</p>' +
      (notes.length ? '<p>Import notes:</p><ul>' + notes.map((n) => '<li>' + n.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>').join('') + '</ul>' : '<p>Everything in this file imported cleanly.</p>');
    openModal('Imported ' + fname, body, [{ label: 'Done', primary: true }]);
  } catch (err) {
    const m = err && err.message, det = String(err && err.detail || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const msg = m === 'legacy' ? '<p>This is a legacy binary FLA (Flash CS4 or older). In Flash or Animate choose <b>File → Save As</b>, pick the <b>Flash CS5/CS6</b> or current Animate <b>.fla</b> format, then import that copy.</p>'
      : m === 'nodom' ? '<p>The archive opened, but it has no <code>DOMDocument.xml</code>. What it contains:</p><p><code>' + det + '</code></p>'
      : m === 'notzip' ? '<p>This file is not a readable ZIP archive.</p><p class="hint">' + det + '</p>'
      : m === 'badxml' ? '<p>The document XML could not be parsed.</p><p class="hint">' + det + '</p>'
      : '<p>Unexpected problem while reading the file:</p><p><code>' + String(m || err).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</code></p>';
    openModal('Could not import ' + fname, msg);
  }
}
function pickFile() { $('#fileIn').click(); }
const stageWrap = $('#stagewrap');
['dragenter', 'dragover'].forEach((ev) => window.addEventListener(ev, (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); $('#drop').classList.add('on'); } }));
['dragleave', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { if (ev === 'drop') { e.preventDefault(); const fl = Array.from((e.dataTransfer && e.dataTransfer.files) || []); const imgs = fl.filter(isImageFile); if (imgs.length > 1 && imgs.length === fl.length) importImages(imgs); else if (fl[0]) openFile(fl[0]); } if (ev === 'drop' || e.target === document.documentElement || !e.relatedTarget) $('#drop').classList.remove('on'); }));

/* ---------- export ---------- */
const tickMs = (ms) => new Promise((r) => setTimeout(r, ms || 0));
function renderFrameCanvas(t, scale, o) {
  o = o || {};
  const d = S.doc, c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(d.w * scale)); c.height = Math.max(1, Math.round(d.h * scale));
  const x = c.getContext('2d', { willReadFrequently: true });
  x.scale(c.width / d.w, c.height / d.h);
  if (!o.transparent) { x.fillStyle = d.bg; x.fillRect(0, 0, d.w, d.h); }
  drawFrameObjs(x, t);
  return c;
}
const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));

/* player HTML: opts = { debug, sound, loop, center, resp, fill, controls, bg, hidden, pack } */
function buildPlayer(opts) {
  opts = opts || {};
  const sound = opts.sound !== false, loop = opts.loop !== false, center = opts.center || 'both', resp = opts.resp || 'none', fill = opts.fill === 'fill';
  const controls = opts.controls !== false, zip = opts.pack === 'zip', bgMode = opts.bg || 'stage';
  const core = document.getElementById('fcCore').textContent.replace(/<\/script/gi, '<\\/script');
  const rtm = document.getElementById('fcRuntime').textContent.replace(/<\/script/gi, '<\\/script');
  let d = S.doc;
  if (opts.hidden || bgMode === 'transparent') {
    d = JSON.parse(JSON.stringify(S.doc, sound ? undefined : noSounds));
    if (opts.hidden) { d.layers.forEach((l) => { l.visible = true; }); for (const k of Object.keys(d.lib || {})) d.lib[k].layers.forEach((l) => { l.visible = true; }); }
    if (bgMode === 'transparent') d.bg = 'transparent';
  }
  const data = JSON.stringify(d, sound ? undefined : noSounds).replace(/</g, '\\u003c');
  const title = String(d.name || 'Animation').replace(/[&<>"]/g, '');
  const boot = `(function(){
var doc=window.FC_DOC||JSON.parse(document.getElementById('fcDoc').textContent);
var cv=document.getElementById('cv'),btn=document.getElementById('pp'),bar=document.getElementById('bar'),ctl=document.getElementById('ctl'),err=document.getElementById('err');
var DEBUG=${opts.debug ? 'true' : 'false'},RESP='${resp}',FILL=${fill},CONTROLS=${controls};
var rt=FCRuntime.create(doc,cv,{loop:${loop},onError:function(m){if(window.console)console.error(m);if(DEBUG){try{parent.postMessage({fcErr:m},'*')}catch(e){}err.textContent=m;err.style.display='block';}}});
window.__rt=rt;rt.start();
if(rt.hasScripts||!CONTROLS){ctl.style.display='none';}
if(!rt.hasScripts){
 var tg=function(){var p=!rt.isPaused();rt.setPaused(p);btn.textContent=p?'Play':'Pause';};
 btn.onclick=tg;cv.onclick=tg;
 bar.max=Math.max(0,doc.frames-1);bar.oninput=function(){rt.setPaused(true);btn.textContent='Play';rt.scrub(+bar.value);};
 setInterval(function(){if(!rt.isPaused())bar.value=rt.root.currentFrame;},100);
 document.addEventListener('keydown',function(e){if(e.key===' '){e.preventDefault();tg();}});
}
function fit(){
 if(RESP==='none')return;
 var vw=document.documentElement.clientWidth,vh=window.innerHeight-(ctl.style.display==='none'?0:46),s;
 if(RESP==='width')s=vw/doc.w;else if(RESP==='height')s=vh/doc.h;else s=FILL?Math.max(vw/doc.w,vh/doc.h):Math.min(vw/doc.w,vh/doc.h);
 cv.style.maxWidth='none';cv.style.width=Math.round(doc.w*s)+'px';
}
window.addEventListener('resize',fit);fit();
})();`;
  const al = center === 'both' || center === 'h' ? 'center' : 'flex-start', jc = center === 'both' || center === 'v' ? 'center' : 'flex-start';
  const pageBg = bgMode === 'page' ? d.bg : bgMode === 'transparent' ? 'transparent' : '#1b1f2a';
  const flat = resp !== 'none';
  const css = 'html,body{margin:0;background:' + pageBg + ';color:#e8ebf3;font:14px system-ui,sans-serif;min-height:100%}body{display:flex;flex-direction:column;align-items:' + al + ';justify-content:' + jc + ';gap:' + (flat ? 0 : 10) + 'px;padding:' + (flat ? 0 : 12) + 'px;box-sizing:border-box;min-height:100vh' + (flat && fill ? ';overflow:hidden' : '') + '}canvas{display:block;max-width:100%;height:auto;' + (bgMode === 'stage' ? 'box-shadow:0 6px 24px rgba(0,0,0,.45);' : '') + 'touch-action:manipulation}.c{display:flex;gap:10px;align-items:center;width:min(' + d.w + 'px,100%);' + (flat ? 'padding:6px 10px;box-sizing:border-box;' : '') + '}.c input{flex:1}button{height:30px;padding:0 14px;border-radius:6px;border:1px solid #4a5370;background:#2a3040;color:inherit}#err{display:none;position:fixed;left:8px;right:8px;bottom:8px;background:#5b1620;color:#ffd9de;padding:6px 10px;border-radius:6px;font:12px ui-monospace,monospace}';
  const bodyHtml = '<canvas id="cv" style="width:' + d.w + 'px"></canvas><div class="c" id="ctl"><button id="pp">Pause</button><input id="bar" type="range" min="0" value="0" aria-label="Frame"></div><div id="err"></div>\n';
  const head = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>\n<style>' + css + '</style></head>\n';
  if (zip) {
    return { html: head + '<body>' + bodyHtml + '<script src="libs/onionskyn-core.js"><\/script>\n<script src="libs/onionskyn-runtime.js"><\/script>\n<script src="animation.js"><\/script>\n<script src="main.js"><\/script></body></html>\n', core, rtm, boot, anim: 'window.FC_DOC=' + data + ';\n' };
  }
  return { html: head + '<body>' + bodyHtml + '<script id="fcDoc" type="application/json">' + data + '<\/script>\n<script>' + core + '<\/script>\n<script>' + rtm + '<\/script>\n<script>' + boot + '<\/script></body></html>\n' };
}
function buildPlayerHTML(debug, withSound) { return buildPlayer({ debug: !!debug, sound: withSound !== false }).html; }
function openPreview() {
  exitAllSyms();
  if (S.playing) stopPlay();
  const fr = $('#prevFrame');
  $('#prevErr').textContent = '';
  $('#prev').classList.add('on');
  fr.setAttribute('allow', 'autoplay');
  fr.srcdoc = buildPlayerHTML(true, true);
}
window.addEventListener('message', (e) => {
  const fr = $('#prevFrame');
  if (e.source === fr.contentWindow && e.data && e.data.fcErr) { $('#prevErr').textContent = String(e.data.fcErr).slice(0, 200); logPush(FCLOG.errs, 'preview: ' + e.data.fcErr); }
});

/* ---------- export dialog (settings per format, remembered) ---------- */
const LS_EXP = 'flashcraft.export';
const XFMT = [{ id: 'html', n: 'HTML5 player', d: '.html or .zip' }, { id: 'gif', n: 'Animated GIF', d: '.gif' }, { id: 'img', n: 'Image (this frame)', d: 'PNG, JPEG, SVG' }, { id: 'seq', n: 'Image sequence', d: '.zip of frames' }, { id: 'vid', n: 'Video', d: 'WebM or MP4' }];
const xDefaults = () => ({
  fmt: 'html', name: '',
  html: { loop: true, hidden: false, center: 'both', resp: 'none', fill: 'fit', controls: true, sound: true, bg: 'stage', pack: 'single' },
  gif: { scale: 100, all: true, from: 1, to: 0, fps: 0, colors: 256, dither: 'diffusion', ditherAmt: 100, transp: false, matte: '#ffffff', loop: 'forever', loopN: 3 },
  img: { type: 'png', scale: 100, quality: 90, transp: false },
  seq: { type: 'png', scale: 100, quality: 90, transp: false, all: true, from: 1, to: 0, pad: 4 },
  vid: { scale: 100, span: 'all', from: 1, to: 0, start: 0, dur: 0, format: 'webm', quality: 'high', alpha: false, repeat: 1 }
});
let XS = null;
function loadXS() {
  const base = xDefaults();
  try {
    const raw = JSON.parse(localStorage.getItem(LS_EXP) || 'null');
    if (raw && typeof raw === 'object') for (const k of Object.keys(base)) if (raw[k] !== undefined) base[k] = typeof base[k] === 'object' ? Object.assign(base[k], raw[k]) : raw[k];
  } catch (e) { /* defaults */ }
  return base;
}
function saveXS() { try { localStorage.setItem(LS_EXP, JSON.stringify(XS)); } catch (e) { /* ignore */ } }
const xGet = (p) => { const a = p.split('.'); return a.length > 1 ? XS[a[0]][a[1]] : XS[a[0]]; };
const xSet = (p, v) => { const a = p.split('.'); if (a.length > 1) XS[a[0]][a[1]] = v; else XS[a[0]] = v; };
const xBase = () => safeName(XS.name || S.doc.name);
const fRow = (label, inner, when) => '<div class="xr"' + (when ? ' data-when="' + when + '"' : '') + '><span>' + label + '</span><div class="xc">' + inner + '</div></div>';
const fChk = (p, label, when, title) => '<div class="xr xchk"' + (when ? ' data-when="' + when + '"' : '') + '><span></span><div class="xc"><label class="chk"' + (title ? ' title="' + title + '"' : '') + '><input type="checkbox" data-s="' + p + '"> ' + label + '</label></div></div>';
const fNum = (p, min, max, w) => '<input type="number" data-s="' + p + '" min="' + min + '" max="' + max + '" step="1"' + (w ? ' style="width:' + w + 'px"' : '') + '>';
const fSel = (p, opts) => '<select data-s="' + p + '">' + opts.map((o) => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select>';
const fSize = () => fRow('Size', '<input type="number" id="xw" data-size="w" min="1" max="8192" style="width:70px" aria-label="Width"> × <input type="number" id="xh" data-size="h" min="1" max="8192" style="width:70px" aria-label="Height"> px &nbsp;<input type="number" id="xp" data-size="p" min="5" max="800" style="width:60px" aria-label="Percent"> %');
const fRange = (k) => fChk(k + '.all', 'All frames') + fRow('Frame range', fNum(k + '.from', 1, 900, 64) + ' to ' + fNum(k + '.to', 0, 900, 64) + ' <span class="hint" style="margin:0">(0 = last)</span>', '!' + k + '.all');
function xBodyHTML(f) {
  const hasMR = typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  const vopts = [['webm', 'WebM (VP9)'], ['webm8', 'WebM (VP8)'], ['mp4', 'MP4 (H.264)']].filter((o) => hasMR && XMIME[o[0]]().length);
  if (f === 'html') return fChk('html.loop', 'Loop timeline')
    + fChk('html.hidden', 'Include hidden layers', null, 'Layers you have hidden in the editor are normally left out')
    + fRow('Centre stage', fSel('html.center', [['both', 'Both'], ['h', 'Horizontal'], ['v', 'Vertical'], ['none', 'Off']]))
    + fRow('Make responsive', fSel('html.resp', [['none', 'Off'], ['both', 'Both'], ['width', 'Fit width'], ['height', 'Fit height']]))
    + fRow('Scale mode', fSel('html.fill', [['fit', 'Fit in view'], ['fill', 'Fill visible area (crops)']]), 'html.resp=both')
    + fRow('Background', fSel('html.bg', [['stage', 'Stage colour on dark page'], ['page', 'Stage colour fills page'], ['transparent', 'Transparent']]))
    + fChk('html.controls', 'Show play / scrub controls', null, 'Hidden automatically when the animation has scripts')
    + fChk('html.sound', 'Include sounds', null) + '<p class="hint" id="xSndNote"></p>'
    + fRow('Package', fSel('html.pack', [['single', 'Single .html file'], ['zip', '.zip with separate files']]));
  if (f === 'gif') return fSize() + fRange('gif')
    + fRow('Frame rate', fNum('gif.fps', 0, 50, 64) + ' fps <span class="hint" style="margin:0">(0 = ' + S.doc.fps + ')</span>')
    + fRow('Colours', fSel('gif.colors', [['256', '256'], ['128', '128'], ['64', '64'], ['32', '32'], ['16', '16'], ['8', '8'], ['4', '4'], ['2', '2']]))
    + fRow('Dither', fSel('gif.dither', [['none', 'None'], ['diffusion', 'Diffusion'], ['pattern', 'Pattern']]) + ' ' + fNum('gif.ditherAmt', 0, 100, 60) + ' %', '')
    + fChk('gif.transp', 'Transparency') + fRow('Matte', '<input type="color" data-s="gif.matte" aria-label="Matte colour"> <span class="hint" style="margin:0">edge colour blended into semi-transparent pixels</span>', 'gif.transp')
    + fRow('Looping', fSel('gif.loop', [['forever', 'Forever'], ['once', 'Play once'], ['count', 'Repeat…']]) + ' ' + fNum('gif.loopN', 2, 99, 56) + ' times', '')
    + '<p class="hint">GIF frame timing is in hundredths of a second, so playback speed is rounded.</p>';
  if (f === 'img') return fRow('Type', fSel('img.type', [['png', 'PNG'], ['jpeg', 'JPEG'], ['svg', 'SVG (vector)']]))
    + fSize() + fRow('Quality', fNum('img.quality', 1, 100, 64) + ' %', 'img.type=jpeg')
    + fChk('img.transp', 'Transparent background', 'img.type!=jpeg');
  if (f === 'seq') return fRow('Type', fSel('seq.type', [['png', 'PNG'], ['jpeg', 'JPEG']]))
    + fSize() + fRange('seq') + fRow('Quality', fNum('seq.quality', 1, 100, 64) + ' %', 'seq.type=jpeg')
    + fChk('seq.transp', 'Transparent background', 'seq.type!=jpeg')
    + fRow('Number digits', fNum('seq.pad', 1, 6, 56));
  if (!hasMR || !vopts.length) return '<p>This browser can’t record video. Try Chrome, Edge or Firefox.</p>';
  return fRow('Format', fSel('vid.format', vopts)) + fRow('Quality', fSel('vid.quality', [['low', 'Low (2 Mbps)'], ['medium', 'Medium (5 Mbps)'], ['high', 'High (10 Mbps)'], ['max', 'Maximum (20 Mbps)']]))
    + fSize()
    + fChk('vid.alpha', 'Ignore stage colour (alpha channel)', 'vid.format!=mp4', 'Works in Chrome and Edge with WebM')
    + fRow('Span', fSel('vid.span', [['all', 'Entire movie'], ['frames', 'Frame range'], ['time', 'Time']]))
    + fRow('Frames', fNum('vid.from', 1, 900, 64) + ' to ' + fNum('vid.to', 0, 900, 64) + ' <span class="hint" style="margin:0">(0 = last)</span>', 'vid.span=frames')
    + fRow('Time', 'start ' + '<input type="number" data-s="vid.start" min="0" step="0.1" style="width:64px"> s &nbsp;length <input type="number" data-s="vid.dur" min="0" step="0.1" style="width:64px"> s', 'vid.span=time')
    + fRow('Repeat', fNum('vid.repeat', 1, 20, 56) + ' time(s)')
    + '<p class="hint">Video is recorded in real time, so it takes as long as the clip plays. Sounds are not included.</p>';
}
const XMIME = {
  webm: () => ['video/webm;codecs=vp9', 'video/webm'].filter((m) => MediaRecorder.isTypeSupported(m)),
  webm8: () => ['video/webm;codecs=vp8'].filter((m) => MediaRecorder.isTypeSupported(m)),
  mp4: () => ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'].filter((m) => MediaRecorder.isTypeSupported(m))
};
function xFrames(s) {
  const n = S.doc.frames;
  if (s.span === 'time') {
    const a = clamp(Math.round((+s.start || 0) * S.doc.fps), 0, n - 1), len = +s.dur > 0 ? Math.max(1, Math.round(s.dur * S.doc.fps)) : n;
    return [a, Math.min(n - 1, a + len - 1)];
  }
  if (s.all || s.span === 'all') return [0, n - 1];
  const a = clamp((s.from | 0) || 1, 1, n), b = s.to ? clamp(s.to | 0, a, n) : n;
  return [a - 1, b - 1];
}
function xDims(s, even) {
  const d = S.doc; let w = Math.max(1, Math.round(d.w * s.scale / 100)), h = Math.max(1, Math.round(d.h * s.scale / 100));
  if (even) { w += w & 1; h += h & 1; }
  return [w, h];
}
let xSndBytes = 0;
function exportLimit(fmt, s) {
  if (!['gif', 'img', 'seq', 'vid'].includes(fmt) || (fmt === 'img' && s.type === 'svg')) return '';
  const [w, h] = xDims(s, fmt === 'vid'), f = fmt === 'img' ? 1 : (() => { const a = xFrames(s); return a[1] - a[0] + 1; })();
  if (w > 8192 || h > 8192 || w * h > 40e6) return 'The output would be ' + w + ' × ' + h + ' px, which is more than a browser can draw in one image (limit about 8192 px a side or 40 megapixels). Lower the scale and try again.';
  if ((fmt === 'gif' || fmt === 'seq') && w * h * f > 3e9) return 'This would render ' + f + ' frames of ' + w + ' × ' + h + ' px, which is more than a browser tab can keep in memory. Lower the scale or export a shorter frame range.';
  return '';
}
function xSync(active) {
  const d = S.doc, body = $('#mBody');
  for (const el of body.querySelectorAll('[data-s]')) {
    if (el === active) continue;
    const v = xGet(el.dataset.s);
    if (el.type === 'checkbox') el.checked = !!v; else if (String(el.value) !== String(v)) el.value = v;
  }
  const s = XS[XS.fmt];
  if (s && s.scale != null) {
    const [w, h] = xDims(s);
    for (const [id, v] of [['xw', w], ['xh', h], ['xp', Math.round(s.scale * 10) / 10]]) { const el = $('#' + id); if (el && el !== active) el.value = v; }
  }
  const test = (expr) => {
    let neg = false, m;
    if ((m = /^(.+?)!=(.+)$/.exec(expr))) return String(xGet(m[1])) !== m[2];
    if ((m = /^(.+?)=(.+)$/.exec(expr))) return String(xGet(m[1])) === m[2];
    if (expr[0] === '!') { neg = true; expr = expr.slice(1); }
    return neg ? !xGet(expr) : !!xGet(expr);
  };
  for (const row of body.querySelectorAll('[data-when]')) {
    const on = test(row.dataset.when);
    row.classList.toggle('off', !on);
    row.querySelectorAll('input,select').forEach((i) => { i.disabled = !on; });
  }
  const nm = $('#xName'); if (nm && nm !== active) nm.value = XS.name;
  nm.placeholder = safeName(d.name);
  let info = '';
  const fr = (a) => a[1] - a[0] + 1;
  if (XS.fmt === 'html') {
    const sz = (xSndBytes && XS.html.sound ? xSndBytes * 1.34 : 0) + 190000 + JSON.stringify(d, noSounds).length;
    info = 'About ' + (sz > 1e6 ? (sz / 1048576).toFixed(1) + ' MB' : Math.round(sz / 1024) + ' KB') + ' · ' + d.w + ' × ' + d.h + ' px, ' + d.frames + ' frames at ' + d.fps + ' fps' + (XS.html.pack === 'zip' ? ' · index.html, main.js, animation.js, libs/' : '');
    const nt = $('#xSndNote'); if (nt) nt.textContent = xSndBytes ? 'This animation has sounds (about ' + (xSndBytes / 1048576).toFixed(1) + ' MB); they are embedded in the file.' : '';
  } else if (XS.fmt === 'gif') { const [w, h] = xDims(s), f = fr(xFrames(s)); info = w + ' × ' + h + ' px · ' + f + ' frames · ' + (f / (100 / Math.max(2, Math.round(100 / (s.fps || d.fps)))) ).toFixed(1) + ' s'; }
  else if (XS.fmt === 'img') { const [w, h] = xDims(s); info = s.type === 'svg' ? 'Frame ' + fnum(S.frame) + ' as vector, ' + d.w + ' × ' + d.h + ' units' : w + ' × ' + h + ' px · frame ' + fnum(S.frame); }
  else if (XS.fmt === 'seq') { const [w, h] = xDims(s); info = w + ' × ' + h + ' px · ' + fr(xFrames(s)) + ' images in a .zip'; }
  else { const [w, h] = xDims(s, true), f = fr(xFrames(s)); info = w + ' × ' + h + ' px · ' + f + ' frames · ' + (f * s.repeat / d.fps).toFixed(1) + ' s'; }
  { const le = exportLimit(XS.fmt, s || {}); if (le) info += ' · ⚠ too large, lower the scale or range'; }
  $('#xInfo').textContent = info;
}
function openExport(fmt) {
  exitAllSyms();
  if (!XS) XS = loadXS();
  if (fmt) XS.fmt = fmt;
  xSndBytes = Object.values(S.doc.sounds || {}).reduce((a, s) => a + (s.size || 0), 0);
  $('#modal').classList.add('wide');
  const body = openModal('Export', '<div class="xd"><div class="xlist" role="tablist" aria-label="Export format">' + XFMT.map((f) => '<button role="tab" data-xf="' + f.id + '"><b>' + f.n + '</b><em>' + f.d + '</em></button>').join('') + '</div><div class="xopts"><div class="xr"><span>File name</span><div class="xc"><input type="text" id="xName" spellcheck="false" aria-label="File name"></div></div><div id="xFields"></div><p class="hint" id="xInfo" style="margin-top:10px"></p></div></div>',
    [{ label: 'Cancel' }, { label: 'Export', primary: true, keep: true, fn: startExport }]);
  const showFmt = () => {
    $$('[data-xf]', body).forEach((b) => { const on = b.dataset.xf === XS.fmt; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $('#xFields').innerHTML = xBodyHTML(XS.fmt);
    $$('#mFoot button').forEach((b) => { if (b.textContent === 'Export') b.disabled = XS.fmt === 'vid' && typeof MediaRecorder === 'undefined'; });
    xSync(null); saveXS();
  };
  body.addEventListener('click', (e) => { const b = e.target.closest('[data-xf]'); if (b) { XS.fmt = b.dataset.xf; showFmt(); } });
  body.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest('[data-xf]')) {
      e.preventDefault(); const ids = XFMT.map((f) => f.id), i = ids.indexOf(XS.fmt); XS.fmt = ids[(i + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length]; showFmt(); $('[data-xf="' + XS.fmt + '"]', body).focus();
    }
  });
  const onEdit = (e) => {
    const el = e.target;
    if (el.id === 'xName') { XS.name = el.value.slice(0, 60); saveXS(); return; }
    const sz = el.dataset && el.dataset.size, s = XS[XS.fmt];
    if (sz) {
      const v = parseFloat(el.value);
      if (v > 0) { s.scale = clamp(sz === 'w' ? v / S.doc.w * 100 : sz === 'h' ? v / S.doc.h * 100 : v, 1, 1600); saveXS(); xSync(el); }
      return;
    }
    if (!el.dataset || !el.dataset.s) return;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? 0 : parseFloat(el.value)) : el.value;
    if (el.dataset.s === 'gif.colors') v = parseInt(v, 10);
    xSet(el.dataset.s, v); saveXS(); xSync(el);
  };
  body.addEventListener('input', onEdit); body.addEventListener('change', onEdit);
  showFmt();
}
function exportDialog(kind) { openExport({ zip: 'seq', gif: 'gif', video: 'vid', vid: 'vid', html: 'html', img: 'img', seq: 'seq' }[kind] || undefined); }
function exportStill(kind) { if (!XS) XS = loadXS(); XS.img.type = kind === 'svg' ? 'svg' : 'png'; openExport('img'); }
function exportHTML() { openExport('html'); }

async function startExport() {
  const fmt = XS.fmt, s = XS[fmt] || {}, d = S.doc, name = xBase();
  saveXS();
  $('#modal').classList.remove('wide');
  let cancelled = false;
  openModal('Exporting…', '<div class="bar"><i id="xBar"></i></div><div class="hint" id="xMsg">Starting…</div>', [{ label: 'Cancel' }]);
  modalCancel = () => { cancelled = true; };
  const prog = (i, n, msg) => { $('#xBar').style.width = Math.round(i / n * 100) + '%'; $('#xMsg').textContent = msg || ('Frame ' + i + ' of ' + n); };
  const wasPlaying = S.playing; if (wasPlaying) stopPlay();
  try { await C.preloadImages(); } catch (e) { /* draw what loaded */ }
  const limitErr = exportLimit(fmt, s);
  if (limitErr) { modalCancel = null; openModal('Export is too large', '<p>' + limitErr + '</p>'); return; }
  const finish = async (fname, blob) => { modalCancel = null; closeModal(); await saveFile(fname, blob); };
  try {
    if (fmt === 'html') {
      prog(0, 1, 'Building…'); await tickMs();
      const r = buildPlayer({ sound: s.sound, loop: s.loop, center: s.center, resp: s.resp, fill: s.fill, controls: s.controls, bg: s.bg, hidden: s.hidden, pack: s.pack });
      if (s.pack === 'zip') {
        if (typeof JSZip === 'undefined') throw new Error('The ZIP library did not load.');
        const z = new JSZip();
        z.file('index.html', r.html); z.file('main.js', r.boot); z.file('animation.js', r.anim);
        z.file('libs/onionskyn-core.js', r.core); z.file('libs/onionskyn-runtime.js', r.rtm);
        return await finish(name + '-html.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
      }
      return await finish(name + '.html', new Blob([r.html], { type: 'text/html' }));
    }
    if (fmt === 'img') {
      if (s.type === 'svg') { const sd = s.transp ? Object.assign({}, d, { bg: 'transparent' }) : d; return await finish(name + '-' + String(S.frame + 1).padStart(3, '0') + '.svg', new Blob([C.frameSVG(sd, S.frame)], { type: 'image/svg+xml' })); }
      const jpeg = s.type === 'jpeg', c = renderFrameCanvas(S.frame, s.scale / 100, { transparent: s.transp && !jpeg });
      const b = await toBlob(c, jpeg ? 'image/jpeg' : 'image/png', s.quality / 100);
      if (!b) throw new Error('Could not encode the image.');
      return await finish(name + '-' + String(S.frame + 1).padStart(3, '0') + (jpeg ? '.jpg' : '.png'), b);
    }
    const [a, b] = xFrames(s), n = b - a + 1;
    if (fmt === 'seq') {
      if (typeof JSZip === 'undefined') throw new Error('The ZIP library did not load.');
      const zip = new JSZip(), jpeg = s.type === 'jpeg';
      for (let f = a; f <= b; f++) {
        if (cancelled) return;
        const blob = await toBlob(renderFrameCanvas(f, s.scale / 100, { transparent: s.transp && !jpeg }), jpeg ? 'image/jpeg' : 'image/png', s.quality / 100);
        zip.file(name + '_' + String(f + 1).padStart(clamp(s.pad | 0, 1, 6), '0') + (jpeg ? '.jpg' : '.png'), blob);
        prog(f - a + 1, n); await tickMs();
      }
      prog(n, n, 'Packing ZIP…');
      return await finish(name + '-frames.zip', await zip.generateAsync({ type: 'blob', compression: 'STORE' }));
    }
    if (fmt === 'gif') {
      const [w, h] = xDims(s), fps = s.fps > 0 ? s.fps : d.fps, delay = Math.max(2, Math.round(100 / fps));
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s.matte || '#ffffff') || [0, 'ff', 'ff', 'ff'];
      const gw = C.gifWriter(w, h, { loop: s.loop === 'forever' ? 0 : s.loop === 'once' ? -1 : (s.loopN > 1 ? s.loopN - 1 : -1), colors: s.colors, dither: s.dither, ditherAmt: s.ditherAmt / 100, transparent: s.transp, matte: [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] });
      for (let f = a; f <= b; f++) {
        if (cancelled) return;
        const c = renderFrameCanvas(f, s.scale / 100, { transparent: s.transp });
        gw.addFrame(c.getContext('2d').getImageData(0, 0, c.width, c.height).data, delay);
        prog(f - a + 1, n, 'Encoding frame ' + (f - a + 1) + ' of ' + n); await tickMs();
      }
      const blob = new Blob([gw.finish()], { type: 'image/gif' });
      return await finish(name + '.gif', blob);
    }
    /* video */
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('This browser can’t record video.');
    const mimes = XMIME[s.format] ? XMIME[s.format]() : [];
    if (!mimes.length) throw new Error('This browser can’t record that video format. Pick another one.');
    const [w, h] = xDims(s, true), c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { alpha: !!s.alpha });
    const draw = (f) => { x.setTransform(1, 0, 0, 1, 0, 0); if (s.alpha && s.format !== 'mp4') x.clearRect(0, 0, w, h); else { x.fillStyle = d.bg; x.fillRect(0, 0, w, h); } x.setTransform(w / d.w, 0, 0, h / d.h, 0, 0); drawFrameObjs(x, f); };
    draw(a);
    const bps = { low: 2e6, medium: 5e6, high: 10e6, max: 20e6 }[s.quality] || 1e7;
    const rec = new MediaRecorder(c.captureStream(d.fps), { mimeType: mimes[0], videoBitsPerSecond: bps });
    const chunks = [];
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start();
    const reps = clamp(s.repeat | 0 || 1, 1, 20), total = n * reps, t0 = performance.now();
    for (let i = 0; i < total; i++) {
      if (cancelled) { rec.stop(); return; }
      draw(a + (i % n)); prog(i + 1, total, 'Recording frame ' + (i + 1) + ' of ' + total);
      await tickMs(Math.max(1, t0 + (i + 1) * 1000 / d.fps - performance.now()));
    }
    rec.stop(); await done;
    const mp4 = /mp4/.test(mimes[0]);
    return await finish(name + (mp4 ? '.mp4' : '.webm'), new Blob(chunks, { type: mp4 ? 'video/mp4' : 'video/webm' }));
  } catch (err) {
    modalCancel = null; closeModal();
    openModal('Export failed', '<p>' + String(err && err.message || err).replace(/</g, '&lt;') + '</p>');
  } finally {
    if (wasPlaying) startPlay();
  }
}

/* ---------- help ---------- */
function showHelp() {
  const rows = [['V / A', 'Selection / node edit'], ['P / Y / B / F', 'Pen / pencil / brush / fluid brush'], ['[ and ]', 'Brush size smaller / larger'], ['L R O', 'Line, rectangle, ellipse'], ['T', 'Text (Esc or click away to finish)'], ['K / I / H', 'Bucket, eyedropper, hand'],
    ['F8', 'Convert selection to symbol (Fn+F8 on some laptops)'], ['F9', 'Script editor'],
    ['F5 / F6 / F7', 'Insert frame / keyframe / blank keyframe'], ['⇧F5 / ⇧F6', 'Remove frame / clear keyframe'], [', and .', 'Previous / next frame'],
    ['Enter', 'Play or stop (finishes a pen path)'], ['Ctrl+G / ⇧G', 'Group / ungroup'], ['Ctrl+C X V D', 'Copy, cut, paste, duplicate'],
    ['Ctrl+Z / ⇧Z', 'Undo / redo'], ['Ctrl+S', 'Save project'], ['Arrows', 'Nudge (⇧ = 10 px)'], ['Space-drag', 'Pan the stage'], ['Ctrl+wheel', 'Zoom'], ['Shift / Alt', 'Constrain / from centre while drawing']];
  openModal('Keyboard shortcuts', '<table>' + rows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table><p class="hint">Right-click a timeline cell for frame and tween actions. Editing a frame inside a tween adds a keyframe there.</p><p class="hint">Onionskyn ' + APP_VERSION + ' · Something broken? File → Report a problem.</p>');
}


/* ---------- sounds ---------- */
const idb = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('flashcraft', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
};
function persistSounds() { try { idb.put('sounds', S.doc.sounds || {}).catch(() => {}); } catch (e) { /* storage unavailable */ } }
async function restoreSounds() {
  const sn = S.doc.sounds || {};
  if (!Object.values(sn).some((s) => s.ext && !s.b64)) return;
  try {
    const saved = await idb.get('sounds');
    if (saved) for (const k of Object.keys(sn)) if (saved[k] && saved[k].b64) sn[k] = saved[k];
  } catch (e) { /* none saved */ }
  refreshSoundSelect();
  warnMissingMedia();
}
function missingMedia() {
  const n = (o) => Object.values(o || {}).filter((m) => m && !m.b64).length;
  return { images: n(S.doc.images), sounds: n(S.doc.sounds) };
}
let mediaWarnedAt = 0;
function warnMissingMedia(prefix, force) {
  const m = missingMedia();
  if (!m.images && !m.sounds) return false;
  if (!force && Date.now() - mediaWarnedAt < 4000) return true;
  mediaWarnedAt = Date.now();
  const parts = []; if (m.images) parts.push(m.images + (m.images === 1 ? ' image' : ' images')); if (m.sounds) parts.push(m.sounds + (m.sounds === 1 ? ' sound' : ' sounds'));
  toast((prefix || '') + parts.join(' and ') + ' couldn’t be restored from this browser’s storage. Re-import them from the Library tab; open a saved project file to get them back.');
  return true;
}
function persistImages() { try { idb.put('images', S.doc.images || {}).catch(() => {}); } catch (e) { /* storage unavailable */ } }
async function restoreImages() {
  const im = S.doc.images || {};
  if (!Object.values(im).some((s) => s.ext && !s.b64)) return;
  try {
    const saved = await idb.get('images');
    if (saved) for (const k of Object.keys(im)) if (saved[k] && saved[k].b64) im[k] = saved[k];
  } catch (e) { /* none saved */ }
  C.setImages(S.doc.images); C.preloadImages().then(() => { invalidate(); renderLibrary(true); });
  warnMissingMedia();
}
function loadImgEl(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url; }); }
async function addImageFile(file) {
  try {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onerror = () => rej(r.error); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
    const el = await loadImgEl(url);
    let w = el.naturalWidth || el.width, h = el.naturalHeight || el.height, mime = file.type || 'image/png', dataUrl = url;
    if (!w || !h) { w = 300; h = 300; }
    const big = url.length * 0.75 > 1500000 || Math.max(w, h) > 2400;
    if (big && mime !== 'image/svg+xml') {
      const k = Math.min(1, 2048 / Math.max(w, h)), cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      cv.getContext('2d').drawImage(el, 0, 0, cv.width, cv.height);
      mime = /png|gif|webp/.test(mime) ? 'image/png' : 'image/jpeg';
      dataUrl = cv.toDataURL(mime, 0.9); w = cv.width; h = cv.height;
    }
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const im = S.doc.images || (S.doc.images = {});
    let name = file.name || 'image.png', i = 2;
    while (im[name]) name = (file.name || 'image.png').replace(/(\.[^.]*)?$/, ' ' + i++ + '$1');
    im[name] = { name, mime, b64, w, h, size: Math.round(b64.length * 0.75) };
    C.setImages(im); persistImages(); await C.preloadImages();
    return name;
  } catch (e) { toast('Could not read ' + (file.name || 'that image') + ' as a picture.'); return false; }
}
function placeImage(name) {
  const im = (S.doc.images || {})[name]; if (!im) return false;
  const k = Math.min(1, S.doc.w * 0.8 / im.w, S.doc.h * 0.8 / im.h);
  const o = { id: uid(), kind: 'image', img: name, w: im.w, h: im.h, op: 1, t: { x: S.doc.w / 2 - im.w * k / 2, y: S.doc.h / 2 - im.h * k / 2, sx: k, sy: k, r: 0 } };
  if (!addObject(o)) { toast('Select an unlocked, visible layer to place the image on.'); return false; }
  renderLibrary(true); return true;
}
async function importImages(files) {
  let n = 0, last = '';
  for (const f of files) { const nm = await addImageFile(f); if (nm) { placeImage(nm); n++; last = nm; } }
  if (n) toast(n > 1 ? 'Placed ' + n + ' images' : 'Placed ' + last);
}
const isImageFile = (f) => /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || '');
let sndSig = '';
function refreshSoundSelect() {
  const names = Object.keys(S.doc.sounds || {}), sig = names.join('\u0001');
  if (sig === sndSig) return;
  sndSig = sig;
  const sel = $('#kfSound'), cur = sel.value;
  sel.textContent = '';
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = names.length ? 'None' : 'None (no sounds yet)'; sel.appendChild(o0);
  for (const n of names) { const o = document.createElement('option'); o.value = n; o.textContent = n.split('/').pop(); sel.appendChild(o); }
  sel.value = cur;
}
let audition = null;
function stopAudition() { if (audition) { audition.pause(); audition = null; } $$('[data-sp]').forEach((b) => { b.textContent = '▶'; }); $('#sndPlay').textContent = '▶'; }
function auditionSound(name, btn) {
  const wasPlaying = audition && audition._name === name;
  stopAudition();
  const s = (S.doc.sounds || {})[name];
  if (wasPlaying) return;
  if (!s || !s.b64) { toast('That sound’s audio data is not loaded.'); return; }
  const bin = atob(s.b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const a = new Audio(URL.createObjectURL(new Blob([u8], { type: s.mime || 'audio/mpeg' })));
  a._name = name; audition = a;
  a.addEventListener('ended', () => { if (audition === a) stopAudition(); });
  a.play().then(() => { if (btn) btn.textContent = '■'; }).catch(() => { toast('Could not play that sound here.'); audition = null; });
}
function addSoundFile(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onerror = () => { toast('Could not read ' + file.name); resolve(false); };
    r.onload = () => {
      const url = String(r.result), b64 = url.slice(url.indexOf(',') + 1);
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const mime = file.type || (ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg');
      const sn = S.doc.sounds || (S.doc.sounds = {});
      let name = file.name, i = 2;
      while (sn[name]) name = file.name.replace(/(\.[^.]*)?$/, ' ' + i++ + '$1');
      sn[name] = { name, mime, b64, size: Math.round(b64.length * 0.75), ids: [] };
      persistSounds(); refreshSoundSelect(); resolve(name);
    };
    r.readAsDataURL(file);
  });
}
function showSounds() {
  const sn = S.doc.sounds || {}, names = Object.keys(sn);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = names.map((n, i) => '<div class="row" style="grid-template-columns:30px minmax(0,1fr) 62px 30px;align-items:center"><button class="mini1" data-sp="' + i + '" aria-label="Play ' + esc(n) + '">▶</button><span title="' + esc(n) + (sn[n].ids && sn[n].ids.length ? ' — id: ' + esc(sn[n].ids.join(', ')) : '') + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(n.split('/').pop()) + '</span><em style="color:var(--mut);font-style:normal">' + Math.max(1, Math.round((sn[n].size || 0) / 1024)) + ' KB</em><button class="mini1" data-sd="' + i + '" aria-label="Remove ' + esc(n) + '">✕</button></div>').join('');
  const body = openModal('Sound library', (names.length ? '<div style="max-height:46vh;overflow:auto">' + rows + '</div><p class="hint">Pick a sound for a keyframe in the <b>Frame</b> tab. Scripts can play them by name with <code>createjs.Sound.play("id")</code>. Sounds play in Preview and the HTML export.</p>' : '<p>No sounds yet. Add an MP3, WAV or OGG file, or import a .fla that contains sounds.</p>'),
    [{ label: 'Add sound…', keep: true, fn: () => $('#sndIn').click() }, { label: 'Close', primary: true, fn: stopAudition }]);
  body.addEventListener('click', (e) => {
    const pl = e.target.closest('[data-sp]'), dl = e.target.closest('[data-sd]');
    if (pl) auditionSound(names[+pl.dataset.sp], pl);
    else if (dl) { stopAudition(); delete S.doc.sounds[names[+dl.dataset.sd]]; persistSounds(); refreshSoundSelect(); showSounds(); }
  });
}

/* ---------- code editor window ---------- */
const CED = { lid: null, f: 0, fs: 13, tm: 0 };
try { const v = parseFloat(localStorage.getItem('flashcraft.cedfs')); if (v >= 9 && v <= 26) CED.fs = v; } catch (e) { /* default */ }
const CED_KW = new Set('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch throw try typeof var void while with yield async await of'.split(' '));
const CED_BI = new Set('this createjs exportRoot stage window document console true false null undefined lib images Math JSON Date Array Object parseInt parseFloat setTimeout setInterval'.split(' '));
function cedHighlight(code) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|(0x[0-9a-f]+|\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?)|([A-Za-z_$][\w$]*)/gi;
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const t = esc(m[0]);
    if (m[1] != null) out += '<span class="tk-com">' + t + '</span>';
    else if (m[2] != null) out += '<span class="tk-str">' + t + '</span>';
    else if (m[3] != null) out += '<span class="tk-num">' + t + '</span>';
    else if (CED_KW.has(m[4])) out += '<span class="tk-kw">' + t + '</span>';
    else if (CED_BI.has(m[4])) out += '<span class="tk-bi">' + t + '</span>';
    else if (code[re.lastIndex] === '(') out += '<span class="tk-fn">' + t + '</span>';
    else out += t;
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}
const cedKf = () => { const l = getLayer(CED.lid); return l && C.kfAt(l, CED.f); };
function cedRender() {
  const ta = $('#cedTa'), v = ta.value;
  $('#cedHi').innerHTML = cedHighlight(v) + '\n ';
  const n = v.split('\n').length;
  let g = '';
  for (let i = 1; i <= n; i++) g += i + '\n';
  $('#cedGut').textContent = g;
  cedScroll(); cedStatus();
}
function cedScroll() {
  const ta = $('#cedTa');
  $('#cedHi').scrollTop = ta.scrollTop; $('#cedHi').scrollLeft = ta.scrollLeft; $('#cedGut').scrollTop = ta.scrollTop;
}
function cedStatus() {
  const ta = $('#cedTa'), v = ta.value, pos = ta.selectionStart, before = v.slice(0, pos).split('\n');
  let msg = '<span class="good">✓ no syntax errors</span>';
  if (v.trim()) { try { new Function(v); } catch (e) { if (e instanceof SyntaxError) msg = '<span class="bad">' + String(e.message).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'; else msg = ''; } } else msg = '';
  $('#cedStat').innerHTML = '<span>Ln ' + before.length + ', Col ' + (before[before.length - 1].length + 1) + '</span><span>' + v.split('\n').length + ' lines</span>' + msg;
}
function cedApplyFont() { $('#ced .cbody').style.fontSize = CED.fs + 'px'; try { localStorage.setItem('flashcraft.cedfs', String(CED.fs)); } catch (e) { /* ignore */ } }
function openCed() {
  const l = curLayer(), k = l && C.kfAt(l, S.frame);
  if (!k) { toast('Select a keyframe first (F6 adds one), then open its script.'); return; }
  CED.lid = l.id; CED.f = S.frame;
  const where = S.edit.length ? S.edit[S.edit.length - 1].sym.split('/').pop() + ' › ' : '';
  $('#cedTitle').textContent = 'Script — ' + where + l.name + ' · frame ' + (S.frame + 1);
  $('#ced').classList.add('on');
  const ta = $('#cedTa'); ta.value = k.script || '';
  cedApplyFont(); cedRender(); ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; ta.scrollLeft = 0; cedScroll(); cedStatus();
}
function closeCed() { $('#ced').classList.remove('on'); }
function cedCommit() {
  const k = cedKf();
  if (!k) { toast('That keyframe no longer exists.'); closeCed(); return; }
  const v = $('#cedTa').value;
  beginEditOnce();
  if (v.trim()) k.script = v; else delete k.script;
  clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700);
  drawTimeline(); refreshProps();
}
function cedInsert(ta, text) {
  ta.focus();
  if (!document.execCommand || !document.execCommand('insertText', false, text)) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
}
function cedKey(e) {
  const ta = $('#cedTa'), mod = e.ctrlKey || e.metaKey;
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); closeCed(); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); openPreview(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    if (s === en && !e.shiftKey) { cedInsert(ta, '  '); return; }
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    const blockEnd = en;
    const seg = v.slice(ls, blockEnd), lines = seg.split('\n');
    const out = lines.map((ln) => (e.shiftKey ? ln.replace(/^ {1,2}|^\t/, '') : '  ' + ln)).join('\n');
    ta.setSelectionRange(ls, blockEnd);
    cedInsert(ta, out);
    ta.setSelectionRange(ls, ls + out.length);
    return;
  }
  if (e.key === 'Enter' && !mod && !e.shiftKey) {
    e.preventDefault();
    const v = ta.value, s = ta.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1;
    const line = v.slice(ls, s), ind = /^\s*/.exec(line)[0];
    const opens = /[{(\[]\s*$/.test(line), nextCloses = /^[\])}]/.test(v.slice(ta.selectionEnd));
    if (opens && nextCloses) { cedInsert(ta, '\n' + ind + '  \n' + ind); const pos = s + 1 + ind.length + 2; ta.setSelectionRange(pos, pos); }
    else cedInsert(ta, '\n' + ind + (opens ? '  ' : ''));
    return;
  }
  if (mod && e.key === '/') {
    e.preventDefault();
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd, ls = v.lastIndexOf('\n', s - 1) + 1;
    const lines = v.slice(ls, en).split('\n'), all = lines.every((ln) => !ln.trim() || /^\s*\/\//.test(ln));
    const out = lines.map((ln) => (all ? ln.replace(/^(\s*)\/\/ ?/, '$1') : ln.replace(/^(\s*)/, '$1// '))).join('\n');
    ta.setSelectionRange(ls, en); cedInsert(ta, out); ta.setSelectionRange(ls, ls + out.length);
    return;
  }
}
function bindCed() {
  const ta = $('#cedTa');
  ta.addEventListener('input', () => { cedRender(); cedCommit(); });
  ta.addEventListener('scroll', cedScroll);
  ta.addEventListener('keydown', cedKey);
  ['keyup', 'click', 'select'].forEach((ev) => ta.addEventListener(ev, cedStatus));
  $('#cedClose').addEventListener('click', closeCed);
  $('#cedPrev').addEventListener('click', openPreview);
  $('#cedBig').addEventListener('click', () => { CED.fs = Math.min(26, CED.fs + 1); cedApplyFont(); cedScroll(); });
  $('#cedSmall').addEventListener('click', () => { CED.fs = Math.max(9, CED.fs - 1); cedApplyFont(); cedScroll(); });
  const head = $('#cedHead'), box = $('#ced');
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = box.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => { if (!drag) return; box.style.left = clamp(e.clientX - drag.dx, -200, innerWidth - 80) + 'px'; box.style.top = clamp(e.clientY - drag.dy, 0, innerHeight - 40) + 'px'; });
  head.addEventListener('pointerup', () => { drag = null; });
  new ResizeObserver(() => cedScroll()).observe(box);
  $('#kfPop').addEventListener('click', openCed);
  $('#kfScript').addEventListener('dblclick', openCed);
  // sounds
  $('#sndLib').addEventListener('click', showSounds);
  $('#sndPlay').addEventListener('click', (e) => { const n = $('#kfSound').value; if (n) auditionSound(n, e.currentTarget); else toast('Choose a sound first.'); });
  const kfHere2 = () => { const l = curLayer(); return l && C.kfAt(l, S.frame); };
  const setSnd = () => {
    const k = kfHere2(); if (!k) return;
    beginEditOnce();
    const name = $('#kfSound').value;
    if (name) k.sound = { name, sync: $('#kfSync').value, loop: clamp(parseInt($('#kfLoop').value, 10) || 0, 0, 99) }; else delete k.sound;
    clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700); drawTimeline();
  };
  ['kfSound', 'kfSync'].forEach((id) => $('#' + id).addEventListener('change', setSnd));
  $('#kfLoop').addEventListener('input', setSnd);
  $('#sndIn').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    let last = null;
    for (const f of files) last = (await addSoundFile(f)) || last;
    renderLibrary(true);
    if (last) { toast('Added ' + (files.length > 1 ? files.length + ' sounds' : last)); if (modalBg.classList.contains('on') && $('#mTitle').textContent === 'Sound library') showSounds(); }
  });
}


/* ---------- properties tabs ---------- */
const TABS = ['obj', 'text', 'brush', 'align', 'frame', 'lib', 'doc'];
const LS_TAB = 'flashcraft.tab', LS_PIN = 'flashcraft.tabpin';
function setTab(id) {
  if (!TABS.includes(id) || (id === 'brush' && S.tool !== 'fluid')) id = 'obj';
  S.tab = id;
  $$('#ptabs [role=tab]').forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  $$('#props .pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === id));
  try { localStorage.setItem(LS_TAB, id); } catch (e) { /* ignore */ }
  if (id === 'lib') renderLibrary(true);
}
function autoTab(id) { if (!S.tabPin) setTab(id); }
function setPin(v) {
  S.tabPin = !!v;
  const b = $('#ptabPin'); b.setAttribute('aria-pressed', String(S.tabPin));
  b.title = S.tabPin ? 'Tab locked — click to let tabs follow your selection' : 'Tabs follow your selection — click to lock this tab';
  try { localStorage.setItem(LS_PIN, S.tabPin ? '1' : ''); } catch (e) { /* ignore */ }
}
function bindTabs() {
  const tabs = $$('#ptabs [role=tab]');
  tabs.forEach((b) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const vis = tabs.filter((x) => !x.hidden), t = vis[e.key === 'Home' ? 0 : vis.length - 1]; setTab(t.dataset.tab); t.focus(); return; }
      if (!d) return;
      e.preventDefault(); const vis = tabs.filter((x) => !x.hidden), j = vis.indexOf(b), t = vis[(j + d + vis.length) % vis.length]; setTab(t.dataset.tab); t.focus();
    });
  });
  $('#ptabPin').addEventListener('click', () => setPin(!S.tabPin));
  let t0 = 'obj', pin = false;
  try { t0 = localStorage.getItem(LS_TAB) || 'obj'; pin = !!localStorage.getItem(LS_PIN); } catch (e) { /* ignore */ }
  setPin(pin); setTab(t0);
  $('#sndLib').addEventListener('click', () => setTab('lib'));
}
let selKey = '';
function trackSelTab(sels) {
  const k = S.sel.map((s) => s.id).join(',');
  if (k === selKey) return;
  selKey = k;
  if (!sels.length || S.tool === 'fluid') return;
  autoTab(sels.some((s) => s.o.kind === 'text') && sels.length === 1 ? 'text' : 'obj');
}

/* ---------- fluid brush panel ---------- */
const LS_FBP = 'flashcraft.fbpresets';
const FB_ROWS = [['size', 'Size', 1, 200], ['stab', 'Stabilizer', 0, 100], ['smooth', 'Curve smoothing', 0, 100], ['round', 'Roundness', 5, 100], ['angle', 'Angle', 0, 180], ['taper', 'Taper', 0, 100], ['vel', 'Velocity', -100, 100], ['press', 'Pressure', 0, 100], ['alpha', 'Fill opacity', 0, 100]];
const FB_KEYS = FB_ROWS.map((r) => r[0]).concat(['zoom', 'color']);
let fbPresets = [], fbActive = -1;
function fbLoad() { try { const a = JSON.parse(localStorage.getItem(LS_FBP) || '[]'); fbPresets = Array.isArray(a) ? a.filter((x) => x && typeof x.name === 'string').slice(0, 40) : []; } catch (e) { fbPresets = []; } }
function fbStore() { try { localStorage.setItem(LS_FBP, JSON.stringify(fbPresets)); } catch (e) { toast('Couldn’t save presets in this browser.'); } }
function fbCur() { const o = {}; for (const k of FB_KEYS) o[k] = S.style.fb[k]; return o; }
function fbSame(a, b) { return FB_KEYS.every((k) => a[k] === b[k]); }
function fbSet(key, v) {
  const r = FB_ROWS.find((x) => x[0] === key), fb = S.style.fb;
  if (r) { v = Number(v); if (!isFinite(v)) return; fb[key] = clamp(Math.round(v), r[2], r[3]); }
  else if (key === 'zoom') fb.zoom = !!v; else if (key === 'color') fb.color = String(v);
  fbSync(); invalidate();
}
function fbSync() {
  const box = $('#fbBox'); if (!box || !box.firstChild) return;
  const fb = S.style.fb;
  for (const r of FB_ROWS) { setVal($('#fb_' + r[0]), fb[r[0]]); setVal($('#fb_' + r[0] + 'N'), fb[r[0]]); }
  $('#fb_zoom').checked = !!fb.zoom; $('#fb_merge').checked = fb.merge !== false; setVal($('#fb_color'), fb.color);
  const act = fbPresets[fbActive];
  $('#fbUpdate').disabled = !(act && !fbSame(act, fbCur()));
  $$('#fbList .fbitem button[data-fa]').forEach((b) => b.setAttribute('aria-pressed', String(!!act && +b.dataset.fa === fbActive && fbSame(act, fbCur()))));
}
function fbRender() {
  const l = $('#fbList'); l.textContent = '';
  if (!fbPresets.length) { const p = document.createElement('div'); p.className = 'hint'; p.style.margin = '0'; p.textContent = 'No presets yet.'; l.appendChild(p); return; }
  fbPresets.forEach((pr, i) => {
    const d = document.createElement('div'); d.className = 'fbitem';
    const a = document.createElement('button'); a.dataset.fa = i; a.textContent = pr.name; a.title = 'Use this preset';
    const x = document.createElement('button'); x.dataset.fd = i; x.textContent = '✕'; x.title = 'Delete this preset'; x.setAttribute('aria-label', 'Delete preset ' + pr.name);
    d.appendChild(a); d.appendChild(x); l.appendChild(d);
  });
}
function bindFluid() {
  fbLoad();
  const box = $('#fbBox');
  let h = '<div class="fbr"><label>Fill colour</label><input type="color" id="fb_color" aria-label="Fluid brush colour" style="width:100%"></div>';
  for (const r of FB_ROWS) h += '<div class="fbr"><label for="fb_' + r[0] + '">' + r[1] + '</label><input type="range" id="fb_' + r[0] + '" min="' + r[2] + '" max="' + r[3] + '" step="1"><input type="number" id="fb_' + r[0] + 'N" min="' + r[2] + '" max="' + r[3] + '" step="1" aria-label="' + r[1] + ' value"></div>';
  h += '<label class="fbchk"><input type="checkbox" id="fb_zoom"> Zoom size with stage</label>';
  h += '<label class="fbchk" title="Strokes of the same colour drawn one after another join into a single shape. Turn off to keep every stroke separate."><input type="checkbox" id="fb_merge"> Merge strokes into one shape</label>';
  h += '<div class="hint" style="margin:0 0 4px">Velocity: positive = faster strokes get thinner, negative = thicker. Pressure needs a pen; velocity needs real mouse or pen movement.</div>';
  box.innerHTML = h;
  for (const r of FB_ROWS) {
    $('#fb_' + r[0]).addEventListener('input', (e) => fbSet(r[0], e.target.value));
    $('#fb_' + r[0] + 'N').addEventListener('input', (e) => { if (e.target.value !== '') fbSet(r[0], e.target.value); });
  }
  $('#fb_zoom').addEventListener('change', (e) => fbSet('zoom', e.target.checked));
  $('#fb_merge').addEventListener('change', (e) => { S.style.fb.merge = e.target.checked; });
  $('#fb_color').addEventListener('input', (e) => fbSet('color', e.target.value));
  $('#fbSave').addEventListener('click', () => {
    const nm = ($('#fbName').value || '').trim().slice(0, 40) || ('Preset ' + (fbPresets.length + 1));
    const i = fbPresets.findIndex((p) => p.name === nm), pr = Object.assign({ name: nm }, fbCur());
    if (i >= 0) fbPresets[i] = pr; else { fbPresets.push(pr); if (fbPresets.length > 40) fbPresets.shift(); }
    fbActive = fbPresets.findIndex((p) => p.name === nm); $('#fbName').value = ''; fbStore(); fbRender(); fbSync(); toast('Saved preset “' + nm + '”.');
  });
  $('#fbUpdate').addEventListener('click', () => { const a = fbPresets[fbActive]; if (!a) return; Object.assign(a, fbCur()); fbStore(); fbSync(); toast('Updated “' + a.name + '”.'); });
  $('#fbReset').addEventListener('click', () => { Object.assign(S.style.fb, FB_DEFAULT); fbActive = -1; fbSync(); invalidate(); });
  $('#fbList').addEventListener('click', (e) => {
    const a = e.target.closest('[data-fa]'), d = e.target.closest('[data-fd]');
    if (a) { const pr = fbPresets[+a.dataset.fa]; if (!pr) return; for (const k of FB_KEYS) if (pr[k] !== undefined) S.style.fb[k] = pr[k]; fbActive = +a.dataset.fa; fbSync(); invalidate(); }
    else if (d) { const i = +d.dataset.fd; fbPresets.splice(i, 1); if (fbActive === i) fbActive = -1; else if (fbActive > i) fbActive--; fbStore(); fbRender(); fbSync(); }
  });
  window.__fbSet = fbSet;
  window.__fbPresets = () => fbPresets;
  fbRender(); fbSync();
}

/* ---------- align / distribute ---------- */
function alignTargets() {
  const sels = selEval().filter((s) => { const l = getLayer(s.lid); return l && !l.locked; });
  for (const lid of new Set(sels.map((s) => s.lid))) C.ensureEditable(getLayer(lid), S.frame);
  const out = [];
  for (const s of sels) { const o = findEditable(s.lid, s.id); const b = o && worldBounds(o); if (b) out.push({ o, b }); }
  return out;
}
function alignSel(mode) {
  const n = selEval().length;
  if (!n) { toast('Select something to align.'); return; }
  pushUndo();
  const items = alignTargets();
  if (!items.length) { H.stack.pop(); return; }
  const toStage = $('#alignStage').checked || items.length === 1;
  const ref = toStage ? { x0: 0, y0: 0, x1: S.doc.w, y1: S.doc.h } : {
    x0: Math.min(...items.map((i) => i.b.x0)), y0: Math.min(...items.map((i) => i.b.y0)),
    x1: Math.max(...items.map((i) => i.b.x1)), y1: Math.max(...items.map((i) => i.b.y1))
  };
  for (const { o, b } of items) {
    if (mode === 'left') o.t.x += ref.x0 - b.x0;
    else if (mode === 'right') o.t.x += ref.x1 - b.x1;
    else if (mode === 'hcenter') o.t.x += (ref.x0 + ref.x1) / 2 - (b.x0 + b.x1) / 2;
    else if (mode === 'top') o.t.y += ref.y0 - b.y0;
    else if (mode === 'bottom') o.t.y += ref.y1 - b.y1;
    else if (mode === 'vcenter') o.t.y += (ref.y0 + ref.y1) / 2 - (b.y0 + b.y1) / 2;
  }
  commit();
}
function distribute(axis) {
  if (selEval().length < 3) { toast('Select three or more objects to distribute.'); return; }
  pushUndo();
  const items = alignTargets();
  if (items.length < 3) { H.stack.pop(); return; }
  const h = axis === 'h', c = (i) => (h ? (i.b.x0 + i.b.x1) : (i.b.y0 + i.b.y1)) / 2;
  items.sort((a, b) => c(a) - c(b));
  const first = c(items[0]), step = (c(items[items.length - 1]) - first) / (items.length - 1);
  items.forEach((it, i) => { const d = first + step * i - c(it); if (h) it.o.t.x += d; else it.o.t.y += d; });
  commit();
}
function bindAlign() {
  $$('[data-al]').forEach((b) => b.addEventListener('click', () => alignSel(b.dataset.al)));
  $$('[data-dist]').forEach((b) => b.addEventListener('click', () => distribute(b.dataset.dist)));
}
function refreshAlignUI(n) {
  $$('[data-al]').forEach((b) => { b.disabled = !n; });
  $$('[data-dist]').forEach((b) => { b.disabled = n < 3; });
  $('#alignInfo').textContent = n ? n + (n === 1 ? ' object' : ' objects') : 'select objects';
}

/* ---------- library tab ---------- */
let libSig = '';
const escH = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function renderLibrary(force) {
  if (!S.doc) return;
  const q = ($('#libFilter').value || '').trim().toLowerCase();
  const lib = S.doc.lib || {}, sn = S.doc.sounds || {}, imgs = S.doc.images || {};
  const syms = Object.keys(lib), snds = Object.keys(sn), inames = Object.keys(imgs);
  const sig = [q, S.edit.length, inames.join('|'), syms.map((k) => k + ':' + (lib[k].frames || 1)).join('|'), snds.join('|')].join('\u0002');
  if (!force && sig === libSig) return;
  libSig = sig;
  const hit = (n) => !q || n.toLowerCase().includes(q);
  const sv = syms.filter(hit), nv = snds.filter(hit), iv = inames.filter(hit);
  $('#libImgInfo').textContent = inames.length ? String(inames.length) : '';
  $('#libImgs').innerHTML = iv.length ? iv.map((n) => '<div class="libitem"><img class="thumb" alt="" src="data:' + escH(imgs[n].mime) + ';base64,' + (imgs[n].b64 || '') + '"><span class="nm" title="' + escH(n) + '">' + escH(n) + '<em>' + imgs[n].w + '×' + imgs[n].h + '</em></span><span class="acts"><button data-ip="' + escH(n) + '">Place</button><button data-id="' + escH(n) + '" aria-label="Remove ' + escH(n) + '">✕</button></span></div>').join('')
    : '<div class="libempty">' + (inames.length ? 'No images match.' : 'No images yet. Add a PNG, JPG, GIF or WebP, or drop one on the window.') + '</div>';
  $('#libSymInfo').textContent = syms.length ? String(syms.length) : '';
  $('#libSndInfo').textContent = snds.length ? String(snds.length) : '';
  $('#libSyms').innerHTML = sv.length ? sv.map((n) => '<div class="libitem"><span class="nm" title="' + escH(n) + '">' + escH(n.split('/').pop()) + '<em>' + Math.max(1, lib[n].frames || 1) + ' fr</em></span><span class="acts"><button data-lp="' + escH(n) + '" aria-label="Place ' + escH(n) + ' on stage">Place</button><button data-le="' + escH(n) + '" aria-label="Edit ' + escH(n) + '">Edit</button><button data-ld="' + escH(n) + '" aria-label="Delete ' + escH(n) + '">✕</button></span></div>').join('')
    : '<div class="libempty">' + (syms.length ? 'No symbols match.' : 'No symbols yet. Select objects and choose Convert to symbol, or import a .fla.') + '</div>';
  $('#libSnds').innerHTML = nv.length ? nv.map((n) => '<div class="libitem"><span class="nm" title="' + escH(n) + '">' + escH(n.split('/').pop()) + '<em>' + Math.max(1, Math.round((sn[n].size || 0) / 1024)) + ' KB</em></span><span class="acts"><button data-sp="' + escH(n) + '" aria-label="Play ' + escH(n) + '">▶</button><button data-sd="' + escH(n) + '" aria-label="Remove ' + escH(n) + '">✕</button></span></div>').join('')
    : '<div class="libempty">' + (snds.length ? 'No sounds match.' : 'No sounds yet. Add an MP3, WAV or OGG.') + '</div>';
}
function placeSymbol(sym) {
  if (!S.doc.lib[sym]) return;
  const o = { id: uid(), kind: 'clip', sym, mc: true, mode: 'loop', first: 0, pv: [0, 0], op: 1, t: { x: S.doc.w / 2, y: S.doc.h / 2, sx: 1, sy: 1, r: 0 } };
  if (S.edit.some((e) => e.sym === sym)) { toast('A symbol can’t contain itself.'); return; }
  if (addObject(o)) toast('Placed ' + sym.split('/').pop());
  else toast('This layer is locked or hidden.');
}
function convertToSymbol() {
  try { convertToSymbolRaw(); } catch (err) { toast('Could not convert: ' + (err && err.message || err)); FCLOG.errs.push('convert: ' + (err && err.stack || err)); }
}
function convertToSymbolRaw() {
  if (!S.doc.lib) S.doc.lib = {};
  const sels = selEval();
  if (!sels.length) { toast('Select objects to convert first.'); return; }
  const lids = selLayerIds();
  if (lids.length > 1) { toast('Convert works within a single layer.'); return; }
  const l = getLayer(lids[0]);
  if (l.locked) { toast('That layer is locked.'); return; }
  pushUndo();
  const kf = C.ensureEditable(l, S.frame);
  const objs = kf.objs.filter((o) => S.sel.some((s) => s.id === o.id));
  if (!objs.length) { H.stack.pop(); toast('Couldn’t find the selected objects on this frame. Click the shape again and retry.'); return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of objs) { const b = worldBounds(o); if (b) { x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); } }
  if (!isFinite(x0)) { H.stack.pop(); toast('That selection has no size to convert.'); return; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let i = 1; while (S.doc.lib['Symbol ' + i]) i++;
  const name = 'Symbol ' + i;
  for (const o of objs) { o.t.x -= cx; o.t.y -= cy; }
  S.doc.lib[name] = { frames: 1, layers: [{ id: uid(), name: 'Layer 1', visible: true, locked: false, kfs: [{ f: 0, objs: objs.slice(), tween: 'none' }] }] };
  C.setLib(S.doc.lib);
  const clip = { id: uid(), kind: 'clip', sym: name, mc: true, mode: 'loop', first: 0, pv: [0, 0], op: 1, t: { x: cx, y: cy, sx: 1, sy: 1, r: 0 } };
  const top = Math.max(...objs.map((o) => kf.objs.indexOf(o)));
  kf.objs = kf.objs.filter((o) => !objs.includes(o));
  kf.objs.splice(Math.min(top - objs.length + 1, kf.objs.length), 0, clip);
  S.sel = [{ lid: l.id, id: clip.id }];
  commit(); buildLayerList(); renderLibrary(true);
  toast('Created ' + name + '. Double-click it to edit.');
}
function bindLib() {
  $('#libFilter').addEventListener('input', () => renderLibrary());
  $('#libConvert').addEventListener('click', convertToSymbol);
  $('#objConvert').addEventListener('click', () => { convertToSymbol(); setTab('lib'); });
  $('#libAddSnd').addEventListener('click', () => $('#sndIn').click());
  $('#libAddImg').addEventListener('click', () => $('#imgIn').click());
  $('#imgIn').addEventListener('change', async (e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; await importImages(fs); });
  $('#libImgs').addEventListener('click', (e) => {
    const p = e.target.closest('[data-ip]'), d = e.target.closest('[data-id]');
    if (p) placeImage(p.dataset.ip);
    else if (d) {
      const n = d.dataset.id, used = JSON.stringify([S.doc.layers, S.doc.lib]).includes('"img":' + JSON.stringify(n));
      if (used) { toast('That image is used on the stage or in a symbol. Delete those first.'); return; }
      delete S.doc.images[n]; C.setImages(S.doc.images); persistImages(); renderLibrary(true); markDirty(); autosave();
    }
  });
  window.addEventListener('paste', async (e) => {
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const fs = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(isImageFile);
    if (fs.length) { e.preventDefault(); await importImages(fs); }
  });
  $('#libSyms').addEventListener('click', (e) => {
    const p = e.target.closest('[data-lp]'), ed = e.target.closest('[data-le]'), dl = e.target.closest('[data-ld]');
    if (p) placeSymbol(p.dataset.lp); else if (ed) enterSym(ed.dataset.le);
    else if (dl) {
      const n = dl.dataset.ld, tag = '"sym":' + JSON.stringify(n);
      const unwound = unwind();
      const used = JSON.stringify(S.doc.layers).includes(tag) || Object.keys(S.doc.lib).some((k) => k !== n && JSON.stringify(S.doc.lib[k].layers).includes(tag));
      rewind(unwound);
      if (used) { toast('That symbol is still used on the stage or in another symbol. Delete its instances first.'); return; }
      pushUndo(); const p0 = unwind(); delete S.doc.lib[n]; rewind(p0.filter((x) => x !== n)); C.setLib(S.doc.lib);
      commit(); renderLibrary(true); toast('Deleted ' + n + '. Undo brings it back.');
    }
  });
  $('#libSnds').addEventListener('click', (e) => {
    const pl = e.target.closest('[data-sp]'), dl = e.target.closest('[data-sd]');
    if (pl) auditionSound(pl.dataset.sp, pl);
    else if (dl) { stopAudition(); delete S.doc.sounds[dl.dataset.sd]; persistSounds(); refreshSoundSelect(); renderLibrary(true); }
  });
}


/* ---------- report a problem ---------- */
const SUPPORT_EMAIL = 'onionskyn.support@gmail.com';
function diagnostics() {
  const d = S.doc, snd = Object.values(d.sounds || {}), sb = snd.reduce((a, x) => a + (x.size || 0), 0);
  let ls = 'ok', saved = 0;
  try { localStorage.setItem('flashcraft.t', '1'); localStorage.removeItem('flashcraft.t'); saved = (localStorage.getItem(LS_DOC) || '').length; } catch (e) { ls = 'blocked'; }
  const feat = [['indexedDB', typeof indexedDB !== 'undefined'], ['MediaRecorder', typeof MediaRecorder !== 'undefined'], ['WebM VP9', typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')], ['MP4', typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')], ['clipboard', !!(navigator.clipboard && navigator.clipboard.writeText)], ['JSZip', typeof JSZip !== 'undefined']].map((x) => x[0] + ':' + (x[1] ? 'yes' : 'no')).join(' ');
  let layers = d.layers.length, syms = Object.keys(d.lib || {}).length;
  return ['Onionskyn ' + APP_VERSION + ' (project format ' + PROJECT_VERSION + ')',
    'Browser: ' + navigator.userAgent,
    'Window: ' + innerWidth + '×' + innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x · theme ' + (document.documentElement.dataset.theme || 'auto'),
    'Features: ' + feat,
    'Storage: localStorage ' + ls + ', last autosave ' + Math.round(saved / 1024) + ' KB',
    'Document: ' + d.w + '×' + d.h + ' px, ' + d.fps + ' fps, ' + d.frames + ' frames, ' + layers + ' layers, ' + syms + ' symbols, ' + snd.length + ' sounds (' + (sb / 1048576).toFixed(1) + ' MB)',
    'State: tool ' + S.tool + ', tab ' + S.tab + ', frame ' + fnum(S.frame) + ', inside symbol ' + (S.edit.length ? S.edit.map((e) => e.sym).join(' > ') : 'no') + ', unsaved ' + (unsaved ? 'yes' : 'no'),
    'Recent errors:' + (FCLOG.errs.length ? '\n  ' + FCLOG.errs.join('\n  ') : ' none'),
    'Recent messages:' + (FCLOG.msgs.length ? '\n  ' + FCLOG.msgs.slice(-8).join('\n  ') : ' none')].join('\n');
}
function showReport() {
  const body = openModal('Report a problem', '<p style="margin:0 0 6px">Describe what happened and what you expected. The details below are included with it. They contain no drawing content, file names or personal data.</p><textarea id="rpText" rows="4" placeholder="What did you do, and what went wrong?" aria-label="What went wrong" style="width:100%;box-sizing:border-box"></textarea><textarea id="rpDiag" rows="10" readonly aria-label="Diagnostic details" style="width:100%;box-sizing:border-box;margin-top:8px;font:11px ui-monospace,monospace"></textarea><div class="hint" id="rpMsg"></div>',
    [{ label: 'Close' }, { label: 'Email report', primary: true, keep: true, fn: () => {
      const txt = ($('#rpText').value.trim() ? $('#rpText').value.trim() + '\n\n' : '') + $('#rpDiag').value;
      const cut = txt.length > 1800, a = document.createElement('a');
      a.href = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('Onionskyn ' + APP_VERSION + ' problem report') + '&body=' + encodeURIComponent(cut ? txt.slice(0, 1800) + '\n[…trimmed. Use Copy report and paste the rest]' : txt);
      document.body.appendChild(a); a.click(); a.remove();
      $('#rpMsg').textContent = 'Opening your email app to ' + SUPPORT_EMAIL + '. ' + (cut ? 'The report was long, so it was trimmed; use Copy report and paste the full text if you can. ' : '') + 'No email app? Use Copy report and send it to that address.';
    } }, { label: 'Copy report', keep: true, fn: async () => {
      const txt = ($('#rpText').value.trim() ? $('#rpText').value.trim() + '\n\n' : '') + $('#rpDiag').value;
      let ok = false;
      try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) { /* fall back */ }
      if (!ok) { const t = $('#rpDiag'); t.focus(); t.select(); try { ok = document.execCommand('copy'); } catch (e) { ok = false; } }
      $('#rpMsg').textContent = ok ? 'Copied. Paste it into an email to ' + SUPPORT_EMAIL + '.' : 'Couldn’t copy automatically. Select the text above and copy it by hand.';
    } }]);
  $('#rpDiag').value = diagnostics();
  $('#rpText').focus();
}

/* ---------- keyboard ---------- */
const KEYTOOL = { t: 'text', v: 'select', a: 'node', p: 'pen', y: 'pencil', b: 'brush', f: 'fluid', l: 'line', r: 'rect', o: 'ellipse', k: 'bucket', i: 'dropper', h: 'hand' };
window.addEventListener('keydown', (e) => {
  const t = e.target, tag = (t.tagName || '').toLowerCase();
  const typing = (tag === 'input' && ['text', 'number'].includes(t.type)) || tag === 'select' || tag === 'textarea';
  const mod = e.ctrlKey || e.metaKey, k = e.key;
  if (k === 'Escape') {
    if (modalBg.classList.contains('on')) { closeModal(); return; }
    if (menuEl) { closeMenu(); return; }
    if (typing) { t.blur(); return; }
    if (S.pen) cancelPen(); else if (S.sel.length) { S.sel = []; S.nodeSel = null; refreshProps(); invalidate(); } else if (S.edit.length) exitSym();
    return;
  }
  if (k === 'F9') { e.preventDefault(); if ($('#ced').classList.contains('on')) closeCed(); else openCed(); return; }
  if (k === 'F8') { e.preventDefault(); if (!modalBg.classList.contains('on')) { convertToSymbol(); setTab('lib'); } return; }
  if (modalBg.classList.contains('on')) return;
  if (typing) { if (k === 'Enter' && tag === 'input') t.blur(); return; }
  if (!mod && S.tool === 'fluid' && (k === '[' || k === ']')) { e.preventDefault(); const v = S.style.fb.size; window.__fbSet('size', k === ']' ? v + Math.max(1, Math.round(v * 0.15)) : v - Math.max(1, Math.round(v * 0.15))); return; }
  if (!mod && S.tool === 'brush' && (k === '[' || k === ']')) { e.preventDefault(); const v = S.style.bsize, nv = k === ']' ? v + Math.max(1, Math.round(v * 0.15)) : v - Math.max(1, Math.round(v * 0.15)); window.__setBSize(nv); return; }
  if (k === ' ') {
    e.preventDefault();
    if (tag === 'button') t.blur();
    if (!S.space) { S.space = true; stage.style.cursor = 'grab'; }
    return;
  }
  if (mod) {
    const lk = k.toLowerCase();
    if (lk === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (lk === 'y') { e.preventDefault(); redo(); }
    else if (lk === 'c') { e.preventDefault(); copySel(); }
    else if (lk === 'x') { e.preventDefault(); copySel(); deleteSel(); }
    else if (lk === 'v') { e.preventDefault(); pasteClip(); }
    else if (lk === 'd') { e.preventDefault(); duplicateSel(); }
    else if (lk === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); }
    else if (lk === 's') { e.preventDefault(); saveProject(); }
    else if (lk === 'a') { e.preventDefault(); S.sel = []; for (const l of layers()) if (l.visible && !l.locked) for (const o of C.evalLayerObjs(l, S.frame)) S.sel.push({ lid: l.id, id: o.id }); refreshProps(); invalidate(); }
    else if (k === ']' || k === '}') { e.preventDefault(); arrange(e.shiftKey ? 'front' : 'forward'); }
    else if (k === '[' || k === '{') { e.preventDefault(); arrange(e.shiftKey ? 'back' : 'backward'); }
    return;
  }
  if (k === 'F5') { e.preventDefault(); frameAction(e.shiftKey ? 'rmframe' : 'frame'); return; }
  if (k === 'F6') { e.preventDefault(); frameAction(e.shiftKey ? 'clearkey' : 'key'); return; }
  if (k === 'F7') { e.preventDefault(); frameAction('blank'); return; }
  if (k === 'Enter') { e.preventDefault(); if (S.pen) finishPen(false); else togglePlay(); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (S.tool === 'node' && S.nodeSel && deleteNode()) return; deleteSel(); return; }
  if (k === ',' || k === '<') { e.preventDefault(); if (S.playing) stopPlay(); setFrame(e.shiftKey ? 0 : S.frame - 1); return; }
  if (k === '.' || k === '>') { e.preventDefault(); if (S.playing) stopPlay(); setFrame(e.shiftKey ? S.doc.frames - 1 : S.frame + 1); return; }
  if (k.startsWith('Arrow')) {
    if (!S.sel.length) return;
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    nudge(k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0);
    return;
  }
  if (k === '+' || k === '=') { zoomAt(stageW / 2, stageH / 2, 1.25); return; }
  if (k === '-' || k === '_') { zoomAt(stageW / 2, stageH / 2, 0.8); return; }
  if (k === '!') { fitView(); return; }
  if (k === '?') { showHelp(); return; }
  const tl = KEYTOOL[k.toLowerCase()];
  if (tl) setTool(tl);
});
window.addEventListener('keyup', (e) => { if (e.key === ' ' && S.space) { S.space = false; const t = TOOLS.find((x) => x.id === S.tool); stage.style.cursor = t ? t.cur : 'default'; } });

/* ---------- sample animation ---------- */
function buildSample() {
  const d = C.mkDoc();
  d.name = 'Bouncing ball'; d.w = 640; d.h = 360; d.fps = 24; d.frames = 48; d.bg = '#F1F4FA';
  const T = (x, y, sx, sy, r) => ({ x, y, sx: sx == null ? 1 : sx, sy: sy == null ? 1 : sy, r: r || 0 });
  const withKfs = (layer, base, specs) => {
    layer.kfs = specs.map((s) => {
      const o = clone(base);
      o.t = s.t; if (s.fill) o.fill = s.fill; if (s.fa != null) o.fa = s.fa;
      if (s.contours) o.contours = s.contours;
      const k = C.mkKf(s.f, [o]);
      k.tween = s.tw || 'none'; k.ease = { type: s.e || 'linear', amt: s.a == null ? 50 : s.a };
      return k;
    });
  };
  const ground = C.mkLayer('Ground');
  ground.kfs[0].objs.push(C.mkPath([C.rectContour(640, 70, 0)], { fill: '#CFD8EC', stroke: null }, { x: 320, y: 325 }));
  ground.kfs[0].objs.push(C.mkPath([{ closed: false, nodes: [C.node(-320, 0), C.node(320, 0)] }], { fill: null, stroke: '#27304A', sw: 3, cap: 'butt' }, { x: 320, y: 290 }));
  const shadow = C.mkLayer('Shadow');
  withKfs(shadow, C.mkPath([C.ellipseContour(40, 8)], { fill: '#0B1020', fa: 0.12, stroke: null }), [
    { f: 0, t: T(140, 298, 0.5, 0.5), fa: 0.1, tw: 'motion', e: 'in', a: 60 },
    { f: 12, t: T(230, 298, 1.15, 1.15), fa: 0.38, tw: 'motion', e: 'out', a: 60 },
    { f: 24, t: T(320, 298, 0.5, 0.5), fa: 0.1, tw: 'motion', e: 'in', a: 60 },
    { f: 36, t: T(410, 298, 1.15, 1.15), fa: 0.38, tw: 'motion', e: 'out', a: 60 },
    { f: 47, t: T(500, 298, 0.5, 0.5), fa: 0.1 }]);
  const ball = C.mkLayer('Ball');
  withKfs(ball, C.mkPath([C.ellipseContour(36, 36)], { fill: '#FF5A4D', stroke: '#1B2030', sw: 4 }), [
    { f: 0, t: T(140, 70), tw: 'motion', e: 'in', a: 60 },
    { f: 12, t: T(230, 258, 1.22, 0.82), tw: 'motion', e: 'out', a: 60 },
    { f: 24, t: T(320, 70), tw: 'motion', e: 'in', a: 60 },
    { f: 36, t: T(410, 258, 1.22, 0.82), tw: 'motion', e: 'out', a: 60 },
    { f: 47, t: T(500, 70) }]);
  const morph = C.mkLayer('Morph');
  withKfs(morph, C.mkPath([C.rectContour(52, 52, 0)], { fill: '#3F5BFF', stroke: null }), [
    { f: 0, t: T(570, 62, 1, 1, 0), tw: 'shape', e: 'inout', a: 50 },
    { f: 24, t: T(570, 62, 1, 1, 45), fill: '#2FBF8A', contours: [C.ellipseContour(28, 28)], tw: 'shape', e: 'inout', a: 50 },
    { f: 47, t: T(570, 62, 1, 1, 90) }]);
  d.layers = [ground, shadow, ball, morph];
  return C.normalizeDoc(d);
}

/* ---------- init ---------- */
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode); else root.removeAttribute('data-theme');
  $('#bTheme').title = 'Theme: ' + (mode === 'light' || mode === 'dark' ? mode : 'system');
  readTheme(); invalidate();
}
function init() {
  readTheme();
  let theme = '';
  try { theme = localStorage.getItem(LS_THEME) || ''; } catch (e) { /* ignore */ }
  applyTheme(theme);
  $('#bTheme').addEventListener('click', () => {
    theme = theme === '' ? 'light' : theme === 'light' ? 'dark' : '';
    try { localStorage.setItem(LS_THEME, theme); } catch (e) { /* ignore */ }
    applyTheme(theme);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTheme(); invalidate(); });
  buildTools(); bindProps(); bindEase(); bindTabs(); bindFluid(); bindAlign(); bindLib();
  $('#crumbBack').addEventListener('click', exitSym);
  $('#bPreview').addEventListener('click', openPreview);
  bindCed();
  $('#prevClose').addEventListener('click', () => { $('#prev').classList.remove('on'); $('#prevFrame').srcdoc = ''; });
  $('#prevRestart').addEventListener('click', () => { $('#prevErr').textContent = ''; $('#prevFrame').srcdoc = buildPlayerHTML(true, true); });
  const kfHere = () => { const l = curLayer(); return l && C.kfAt(l, S.frame); };
  $('#kfScript').addEventListener('input', (e) => { const k = kfHere(); if (!k) return; beginEditOnce(); k.script = e.target.value; if (!k.script.trim()) delete k.script; invalidate(); clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700); drawTimeline(); });
  $('#kfLabel').addEventListener('input', (e) => { const k = kfHere(); if (!k) return; beginEditOnce(); k.label = e.target.value.trim(); if (!k.label) delete k.label; clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700); });
  const clipEdit = (fn) => {
    const one = singleSel(); if (!one || one.o.kind !== 'clip') return;
    beginEditOnce(); C.ensureEditable(getLayer(one.lid), S.frame);
    const o = findEditable(one.lid, one.id); if (!o) return;
    fn(o); markDirty(); invalidate(); clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700);
  };
  $('#itype').addEventListener('change', (e) => { clipEdit((o) => { o.mc = e.target.value === 'mc'; if (o.mc) { o.mode = 'loop'; o.first = 0; } }); refreshProps(); });
  $('#imode').addEventListener('change', (e) => clipEdit((o) => { o.mode = e.target.value; }));
  $('#ifirst').addEventListener('input', (e) => { const v = parseInt(e.target.value, 10); if (v >= 1) clipEdit((o) => { o.first = Math.min(v - 1, Math.max(0, ((S.doc.lib[o.sym] || {}).frames || 1) - 1)); }); });
  $('#iname').addEventListener('input', (e) => {
    const one = singleSel();
    if (!one || (one.o.kind !== 'clip' && one.o.kind !== 'text')) return;
    beginEditOnce(); C.ensureEditable(getLayer(one.lid), S.frame);
    const o = findEditable(one.lid, one.id); if (!o) return;
    o.name = e.target.value.trim().replace(/[^\w$]/g, '_');
    if (!o.name) delete o.name;
    clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#prev').classList.contains('on')) { $('#prevClose').click(); } }, true);
  let restored = false;
  try {
    const raw = localStorage.getItem(LS_DOC);
    if (raw) { const doc = JSON.parse(raw); if (doc && Array.isArray(doc.layers)) { S.doc = C.normalizeDoc(doc); restored = true; } }
  } catch (e) { restored = false; }
  if (!restored) S.doc = buildSample();
  S.doc.sounds = S.doc.sounds || {}; S.doc.images = S.doc.images || {};
  C.setLib(S.doc.lib); C.setImages(S.doc.images); C.onImageLoad = () => invalidate(); restoreSounds(); restoreImages();
  S.layerId = S.doc.layers[S.doc.layers.length - 1].id;
  resizeStage(); fitView(); setTool('select'); setPlayIcon();
  const ro = new ResizeObserver(() => { const first = !stageW; resizeStage(); if (first || S.autoFit) fitView(); });
  ro.observe($('#stagewrap'));
  window.addEventListener('resize', () => { resizeStage(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => invalidate());
  refreshAll();
  $('#swFill').value = S.style.fill; $('#swStroke').value = S.style.stroke;
  $('#pLoop').addEventListener('click', (e) => { S.loop = !S.loop; e.currentTarget.setAttribute('aria-pressed', String(S.loop)); });
  $('#pPlay').addEventListener('click', togglePlay);
  $('#pFirst').addEventListener('click', () => { stopPlay(); setFrame(0); });
  $('#pLast').addEventListener('click', () => { stopPlay(); setFrame(S.doc.frames - 1); });
  $('#pPrev').addEventListener('click', () => { stopPlay(); setFrame(S.frame - 1); });
  $('#pNext').addEventListener('click', () => { stopPlay(); setFrame(S.frame + 1); });
  $('#bUndo').addEventListener('click', undo); $('#bRedo').addEventListener('click', redo);
  $('#zIn').addEventListener('click', () => zoomAt(stageW / 2, stageH / 2, 1.25));
  $('#zOut').addEventListener('click', () => zoomAt(stageW / 2, stageH / 2, 0.8));
  $('#zVal').addEventListener('click', fitView);
  $('#bHelp').addEventListener('click', showHelp);
  $('#bProps').addEventListener('click', () => { const on = document.body.classList.toggle('props-open'); $('#bProps').setAttribute('aria-pressed', String(on)); setTimeout(() => { resizeStage(); }, 200); });
  $('#lAdd').addEventListener('click', () => layerOp('add')); $('#lDup').addEventListener('click', () => layerOp('dup'));
  $('#lMask').addEventListener('click', toggleMask);
  $('#lUp').addEventListener('click', () => layerOp('up')); $('#lDown').addEventListener('click', () => layerOp('down')); $('#lDel').addEventListener('click', () => layerOp('del'));
  $('#mFile').addEventListener('click', (e) => showMenu(e.currentTarget, [
    { label: 'New animation', fn: () => confirmReplace('New animation', newDoc) },
    { label: 'Load sample animation', fn: () => confirmReplace('Load sample', () => loadDoc(buildSample())) },
    '-',
    { label: 'Open project or .fla…', fn: pickFile },
    { label: 'Import image…', fn: () => $('#imgIn').click() },
    { label: 'Save project', kbd: 'Ctrl+S', fn: saveProject },
    '-',
    { label: 'Library & sounds…', fn: () => setTab('lib') },
    '-',
    { label: 'Report a problem…', fn: showReport }
  ]));
  $('#mExport').addEventListener('click', (e) => { exitAllSyms(); showMenu(e.currentTarget, [
    { label: 'Export settings…', fn: () => openExport() },
    '-',
    { label: 'HTML5 player…', fn: () => openExport('html') },
    { label: 'Animated GIF…', fn: () => openExport('gif') },
    { label: 'Image (this frame)…', fn: () => openExport('img') },
    { label: 'Image sequence…', fn: () => openExport('seq') },
    { label: 'Video…', fn: () => openExport('vid') }
  ]); });
  if (restored) toast('Restored your last session. File → Load sample brings back the demo.');
  else toast('Sample loaded. Press Enter to play, then try the Selection tool on the ball.');
  if (window.__FC_TEST) window.__FC = { renderFrameCanvas, snap, H, S, C, toggleMask, openExport, buildPlayer, brushOutline, fluidOutline, fbSet, gradPts, w2s, gradDown, refreshProps, setTab, alignSel, distribute, convertToSymbol, renderLibrary, frameAction, setFrame, setTool, importFLAFile, openFile, exportDialog, loadDoc, buildSample };
}
init();
