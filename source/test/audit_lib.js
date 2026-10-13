const {chromium}=require('playwright');const path=require('path');
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
 T.newDoc=async()=>{await page.click('#mFile');await page.getByText('New animation',{exact:true}).click();await page.getByRole('button',{name:'Replace'}).click();await page.waitForFunction(()=>!document.getElementById('modalBg').classList.contains('on'));};
 T.toast=()=>page.evaluate(()=>document.getElementById('toast').innerText.split('\n').pop());
 T.st=(f,a)=>page.evaluate(f,a);
 // prints errors no step claimed, closes the browser and exits non-zero if any check failed or any error was seen
 T.finish=async()=>{for(const e of errs)console.log(e);await b.close();const bad=T.fails||errs.length;console.log(bad?'FAILS '+T.fails+', errors '+errs.length:'ALL OK');process.exit(bad?1:0);};
 return T;};
