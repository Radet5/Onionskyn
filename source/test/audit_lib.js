const {chromium}=require('playwright');const {diffDocs}=require('./doc_compare');const path=require('path');
// Every browser suite starts here: it loads the shipped dist/onionskyn.html, and page or console errors fail the suite (see T.finish).
exports.start=async function(opts={}){
 const b=await chromium.launch();const ctx=await b.newContext({viewport:opts.viewport||{width:1300,height:760},acceptDownloads:true});const page=await ctx.newPage();
 const errs=[];
 // collect errors from a page; suites call this for any extra page they open (exported players, previews)
 const watch=(pg)=>{pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  pg.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|net::|Failed to load resource|sandbox/.test(m.text()))errs.push('CONSOLE '+m.text())});return pg;};
 watch(page);
 await page.addInitScript(()=>{window.__FC_TEST=true;});
 await page.goto('file://'+path.resolve(__dirname,'../dist/onionskyn.html'));await page.waitForFunction(()=>!!window.__FC);
 page.setDefaultTimeout(3000);const T={b,ctx,page,errs,watch,fails:0,notes:[]};
 T.ok=(c,m)=>{console.log(c?'ok  ':'FAIL',m);if(!c)T.fails++;return c;};
 T.sp=async(x,y)=>{const v=await page.evaluate(()=>({l:document.querySelector('#stage').getBoundingClientRect().left,t:document.querySelector('#stage').getBoundingClientRect().top,z:window.__FC.S.view.z,px:window.__FC.S.view.px,py:window.__FC.S.view.py}));return [v.l+v.px+x*v.z,v.t+v.py+y*v.z];};
 T.drag=async(x0,y0,x1,y1,mods=[])=>{const [a,c]=await T.sp(x0,y0),[d,e]=await T.sp(x1,y1);for(const m of mods)await page.keyboard.down(m);await page.mouse.move(a,c);await page.mouse.down();await page.mouse.move((a+d)/2,(c+e)/2,{steps:4});await page.mouse.move(d,e,{steps:4});await page.mouse.up();for(const m of mods)await page.keyboard.up(m);await page.waitForTimeout(60);};
 T.click=async(x,y,o={})=>{const [a,c]=await T.sp(x,y);await page.mouse.click(a,c,o);await page.waitForTimeout(60);};
 T.dbl=async(x,y)=>{const [a,c]=await T.sp(x,y);await page.mouse.dblclick(a,c);await page.waitForTimeout(80);};
 T.inv=()=>page.evaluate(()=>{
  const F=window.__FC,S=F.S,C=F.C,bad=[];const d=S.doc;
  const fin=(v)=>typeof v==='number'&&isFinite(v);
  if(!d.lib)bad.push('no lib');if(!d.sounds)bad.push('no sounds');if(!d.images)bad.push('no images');
  const chkObj=(o,where)=>{if(!o.id)bad.push(where+' obj no id');if(o.t&&!['x','y','sx','sy','r'].every(k=>fin(o.t[k])))bad.push(where+' bad t '+JSON.stringify(o.t));
   if(o.kind==='path'){for(const c of o.contours||[])for(const n of c.nodes||[])if(![n.x,n.y].every(fin))bad.push(where+' bad node');}
   if(o.kind==='group')o.children.forEach(c=>chkObj(c,where+'>g'));
   if(o.kind==='clip'&&!d.lib[o.sym])bad.push(where+' clip missing sym '+o.sym);
   if(o.kind==='image'&&!d.images[o.img])bad.push(where+' image missing');};
  const chkLayers=(ls,w)=>{const ids=new Set();for(const l of ls){if(ids.has(l.id))bad.push(w+' dup layer id');ids.add(l.id);if(!l.kfs||!l.kfs.length)bad.push(w+' no kfs');else{if(l.kfs[0].f!==0)bad.push(w+' first kf not 0');let p=-1;for(const k of l.kfs){if(k.f<=p)bad.push(w+' kf order');p=k.f;const oi=new Set();for(const o of k.objs){if(oi.has(o.id))bad.push(w+' dup obj id');oi.add(o.id);chkObj(o,w+'/'+l.name);}}}}};
  // unwind to root for checking
  const p=S.edit.length;chkLayers(d.layers,'root');for(const k of Object.keys(d.lib))chkLayers(d.lib[k].layers,'sym '+k);
  if(!(d.frames>=1))bad.push('frames');if(!(S.frame>=0&&S.frame<d.frames))bad.push('frame out of range '+S.frame);
  for(const s of S.sel){if(!F.C.evalLayerObjs)break;}
  return bad;});
 T.step=async(name,fn)=>{const n0=errs.length;let r;try{r=await fn();}catch(e){errs.push('STEP-THROW '+e.message.split('\n')[0]);}
  await page.waitForTimeout(80);const bad=await T.inv().catch(e=>['inv threw '+e.message]);const ne=errs.splice(n0);
  const fl=await page.evaluate(()=>window.__FC.S.doc&&0).catch(()=>0);
  if(bad.length||ne.length){T.fails++;console.log('FAIL',name,JSON.stringify(bad.slice(0,4)),ne.slice(0,3));}else console.log('ok  ',name,r===undefined?'':JSON.stringify(r));return r;};
 // the Document as history stores it: unwound to the root Timeline, without media
 T.histDoc=()=>page.evaluate(()=>JSON.parse(window.__FC.snap()).doc);
 T.sameDoc=(want,got,what)=>{const d=diffDocs(want,got);return T.ok(d===null,what+(d?' — first difference: '+d:''));};
 // runs one user action as a step: it must change the Document and add exactly one history entry (an earlier entry that changed nothing would hide
 // a skipped one from undo), then undo must give back the Document from before and redo the Document from after.
 // With {mayNoop:true} an action that may be rejected (garbage input, deleting the last Layer) passes when it changes nothing.
 T.undoable=async(name,fn,opts={})=>T.step(name,async()=>{const before=await T.histDoc();const n0=await page.evaluate(()=>{const H=window.__FC.H;H.stack.splice(0,H.stack.length-5);return H.stack.length;});
  const r=await fn();const after=await T.histDoc();const {sel,n1}=await page.evaluate(()=>({sel:window.__FC.S.sel,n1:window.__FC.H.stack.length}));
  if(opts.mayNoop&&diffDocs(before,after)===null)return 'no change';
  if(!T.ok(diffDocs(before,after)!==null,name+': changes the Document'))return r;
  T.ok(n1===n0+1,name+': adds one history entry (added '+(n1-n0)+')');
  // a real click, so its pointerup also ends any open edit gesture as it would for a user
  const press=async(id)=>{if(await page.$eval(id,b=>b.disabled))return false;await page.click(id);return true;};
  if(!T.ok(await press('#bUndo'),name+': undo is available'))return r;T.sameDoc(before,await T.histDoc(),name+': undo gives back the Document from before');
  if(!T.ok(await press('#bRedo'),name+': redo is available'))return r;T.sameDoc(after,await T.histDoc(),name+': redo gives back the Document from after');
  // redo does not bring back the selection undo dropped; restore it so the next action works on it
  await page.evaluate((sel)=>{const F=window.__FC;F.S.sel=sel;F.refreshProps();},sel);
  return r;});
 T.newDoc=async()=>{await page.click('#mFile');await page.getByText('New animation',{exact:true}).click();await page.getByRole('button',{name:'Replace'}).click();await page.waitForFunction(()=>!document.getElementById('modalBg').classList.contains('on'));};
 T.toast=()=>page.evaluate(()=>document.getElementById('toast').innerText.split('\n').pop());
 T.st=(f,a)=>page.evaluate(f,a);
 // prints errors no step claimed, closes the browser and exits non-zero if any check failed or any error was seen
 T.finish=async()=>{for(const e of errs)console.log(e);await b.close();const bad=T.fails||errs.length;console.log(bad?'FAILS '+T.fails+', errors '+errs.length:'ALL OK');process.exit(bad?1:0);};
 return T;};
