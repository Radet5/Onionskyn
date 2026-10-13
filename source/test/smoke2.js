const {start}=require('./audit_lib');
const fs=require('fs');
(async()=>{
  const T=await start({viewport:{width:1360,height:820}});const page=T.page;const ok=T.ok;
  const G=(fn,...a)=>page.evaluate(fn,...a);
  const box=await page.locator('#stage').boundingBox();
  const W2S=async(x,y)=>{ const v=await G(()=>__FC.S.view); return [box.x+x*v.z+v.px, box.y+y*v.z+v.py]; };
  const click=async(x,y,o)=>{ const p=await W2S(x,y); await page.mouse.click(p[0],p[1],o); };
  const drag=async(x0,y0,x1,y1,steps=6)=>{ const a=await W2S(x0,y0), b=await W2S(x1,y1); await page.mouse.move(a[0],a[1]); await page.mouse.down(); await page.mouse.move(b[0],b[1],{steps}); await page.mouse.up(); };
  // new blank doc via API
  await G(()=>{ const d=__FC.C.mkDoc(); d.name='t'; __FC.loadDoc(d); }); await page.waitForTimeout(100);
  // draw ellipse
  await page.keyboard.press('o'); await drag(100,100,200,180);
  let n=await G(()=>__FC.S.doc.layers[0].kfs[0].objs.length); ok(n===1,'ellipse created');
  // node tool: select + drag a node
  await page.keyboard.press('a'); await click(150,100); // top node region? top node at (150,100)
  const before=await G(()=>JSON.stringify(__FC.S.doc.layers[0].kfs[0].objs[0].contours[0].nodes[0]));
  await drag(150,100,150,60);
  const after=await G(()=>JSON.stringify(__FC.S.doc.layers[0].kfs[0].objs[0].contours[0].nodes[0]));
  ok(before!==after,'node dragged '+after.slice(0,60));
  // double click on node toggles to corner
  const ns=await G(()=>__FC.S.nodeSel); ok(!!ns,'node selected');
  // add node by dbl click on a segment
  const nc0=await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].contours[0].nodes.length);
  const seg=await G(()=>{ const o=__FC.S.doc.layers[0].kfs[0].objs[0]; const c=o.contours[0]; const q=__FC.C.bezPt(c.nodes[1],c.nodes[2],0.5); return [q[0]+o.t.x,q[1]+o.t.y]; });
  const sp=await W2S(seg[0],seg[1]); await page.mouse.dblclick(sp[0],sp[1]);
  const nc1=await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].contours[0].nodes.length); ok(nc1===nc0+1,'node added by dblclick '+nc0+'->'+nc1);
  await page.keyboard.press('Delete'); const nc2=await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].contours[0].nodes.length); ok(nc2===nc0,'node deleted');
  // select tool: scale via handle
  await page.keyboard.press('v');
  const info=await G(()=>{ const o=__FC.S.doc.layers[0].kfs[0].objs[0]; return {sx:o.t.sx, hs:null}; });
  const hnd=await G(()=>{ const o=__FC.S.doc.layers[0].kfs[0].objs[0]; const b=__FC.C.localBounds(o); const m=__FC.C.matOf(o.t); return __FC.C.mapply(m,b.x1,b.y1); });
  await drag(hnd[0],hnd[1],hnd[0]+60,hnd[1]+30);
  const sx=await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].t.sx); ok(sx>1.3,'scaled by corner handle sx='+sx.toFixed(2));
  // rotate handle
  const rotP=await G(()=>{ const o=__FC.S.doc.layers[0].kfs[0].objs[0]; const b=__FC.C.localBounds(o); const m=__FC.C.matOf(o.t); const n=__FC.C.mapply(m,(b.x0+b.x1)/2,b.y0); const c=__FC.C.mapply(m,(b.x0+b.x1)/2,(b.y0+b.y1)/2); const dx=n[0]-c[0],dy=n[1]-c[1],l=Math.hypot(dx,dy); const z=__FC.S.view.z; return [n[0]+dx/l*26/z,n[1]+dy/l*26/z]; });
  const cen=await G(()=>{ const o=__FC.S.doc.layers[0].kfs[0].objs[0]; return [o.t.x,o.t.y]; });
  await drag(rotP[0],rotP[1],cen[0]+120,cen[1]);
  const rr=await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].t.r); ok(Math.abs(rr-90)<25&&rr!==0,'rotated r='+rr.toFixed(1));
  // props fields: set W via input
  await page.fill('#tw','200'); await page.waitForTimeout(50);
  const wv=await G(()=>{ const o=__FC.S.doc.layers[0].kfs[0].objs[0]; const b=__FC.C.localBounds(o); return (b.x1-b.x0)*Math.abs(o.t.sx); }); ok(Math.abs(wv-200)<0.5,'W field sets width '+wv.toFixed(1));
  await G(()=>document.activeElement.blur());
  // fill color change
  await G(()=>{ const i=document.getElementById('fillC'); i.value='#ff00aa'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); });
  ok((await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].fill))==='#ff00aa','fill colour applied');
  await G(()=>document.activeElement&&document.activeElement.blur());
  // undo chain
  const u0=await G(()=>document.getElementById('bUndo').disabled); ok(!u0,'undo enabled');
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+Shift+z');
  // duplicate, group, ungroup
  await page.keyboard.press('Control+d'); n=await G(()=>__FC.S.doc.layers[0].kfs[0].objs.length); ok(n===2,'duplicated');
  await page.keyboard.press('Control+a'); await page.keyboard.press('Control+g');
  let gi=await G(()=>__FC.S.doc.layers[0].kfs[0].objs.map(o=>o.kind).join(',')); ok(gi==='group','grouped -> '+gi);
  await page.keyboard.press('Control+Shift+g');
  gi=await G(()=>__FC.S.doc.layers[0].kfs[0].objs.map(o=>o.kind).join(',')); ok(gi==='path,path','ungrouped -> '+gi);
  // arrow nudge
  const x0=await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].t.x); await page.keyboard.press('Shift+ArrowRight'); const x1=await G(()=>__FC.S.doc.layers[0].kfs[0].objs.find(o=>o.id===__FC.S.sel[0].id).t.x); ok(Math.abs(x1-x0-10)<1e-6||x1!==x0,'nudge');
  // bucket
  await page.keyboard.press('Escape'); await G(()=>{ __FC.S.style.fill='#00ff00'; }); await page.keyboard.press('k');
  const o1=await G(()=>{const o=__FC.S.doc.layers[0].kfs[0].objs[0]; return [o.t.x,o.t.y];});
  await click(o1[0],o1[1]); ok((await G(()=>__FC.S.doc.layers[0].kfs[0].objs[0].fill))==='#00ff00' || (await G(()=>__FC.S.doc.layers[0].kfs[0].objs[1].fill))==='#00ff00','bucket fills');
  // layer ops
  await page.click('#lAdd'); ok((await G(()=>__FC.S.doc.layers.length))===2,'layer added');
  await page.click('#lDup'); ok((await G(()=>__FC.S.doc.layers.length))===3,'layer duplicated');
  await page.click('#lDel'); ok((await G(()=>__FC.S.doc.layers.length))===2,'layer deleted');
  await page.click('#lUp'); await page.click('#lDown');
  // rename layer
  await page.dblclick('.lrow.cur .lname'); await page.keyboard.type('Hero'); await page.keyboard.press('Enter');
  ok((await G(()=>__FC.S.doc.layers.map(l=>l.name).join(',')).then(s=>s.includes('Hero'))),'layer renamed');
  // lock/hide
  await page.click('.lrow.cur .vis'); ok((await G(()=>__FC.S.doc.layers.some(l=>!l.visible))),'layer hidden'); await page.click('.lrow.cur .vis');
  // frames: F6 on layer 1, motion tween
  await page.keyboard.press('Escape'); await G(()=>__FC.setFrame(0));
  await page.keyboard.press('v'); 
  // put a keyframe at 20, move object, create tween
  const lid=await G(()=>__FC.S.doc.layers[0].id); await G(()=>{ const l=__FC.S.doc.layers[0]; document.querySelector('.lrow:last-child')?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); });
  await G(()=>__FC.setFrame(20)); await page.keyboard.press('F6');
  await page.keyboard.press('Control+a'); await page.keyboard.press('Shift+ArrowRight');
  await G(()=>__FC.setFrame(0)); await page.click('[data-fr="motion"]');
  const tw=await G(()=>__FC.S.doc.layers.map(l=>l.name+':'+l.kfs.map(k=>k.f+k.tween[0]).join(',')).join(' | ')); console.log(tw);
  // onion skin
  await G(()=>{ __FC.setFrame(10); }); await page.click('#pOnion'); await page.waitForTimeout(100);
  await page.screenshot({path:require('os').tmpdir()+'/s4.png'});
  // context menu
  const cell=await page.locator('#tlCells').boundingBox(); await page.mouse.click(cell.x+16*5+8,cell.y+13,{button:'right'}); await page.waitForTimeout(100);
  ok((await G(()=>!!document.querySelector('.menu-pop'))),'timeline context menu'); await page.screenshot({path:require('os').tmpdir()+'/s5.png'}); await page.keyboard.press('Escape');
  // save project + reopen
  const [dl]=await Promise.all([page.waitForEvent('download'),page.keyboard.press('Control+s')]); await dl.saveAs(require('os').tmpdir()+'/proj.json'); console.log('saved',dl.suggestedFilename());
  const proj=JSON.parse(fs.readFileSync(require('os').tmpdir()+'/proj.json','utf8')); ok(proj.doc&&proj.doc.layers.length===2,'project JSON layers');
  await G(()=>__FC.loadDoc(__FC.C.mkDoc())); await page.setInputFiles('#fileIn',require('os').tmpdir()+'/proj.json'); await page.waitForTimeout(300);
  ok((await G(()=>__FC.S.doc.layers.length))===2,'project reopened');
  // exports: png/svg
  await G(()=>__FC.exportDialog('img')); const [d1]=await Promise.all([page.waitForEvent('download'),page.click('#mFoot .primary')]); console.log('png',d1.suggestedFilename());
  await G(()=>__FC.exportDialog('img')); await page.selectOption('[data-s="img.type"]','svg'); const [d2]=await Promise.all([page.waitForEvent('download'),page.click('#mFoot .primary')]); await d2.saveAs(require('os').tmpdir()+'/f.svg'); console.log('svg',d2.suggestedFilename(), fs.readFileSync(require('os').tmpdir()+'/f.svg','utf8').length);
  // webm
  await G(()=>{ const d=__FC.S.doc; d.frames=12; d.fps=12; }); await G(()=>__FC.exportDialog('video'));
  const [d3]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.click('#mFoot .primary')]); await d3.saveAs(require('os').tmpdir()+'/v.webm'); console.log('webm',d3.suggestedFilename(),fs.statSync(require('os').tmpdir()+'/v.webm').size);
  // mobile
  await page.setViewportSize({width:400,height:760}); await page.waitForTimeout(500);
  await page.click('#bProps'); await page.waitForTimeout(400); await page.screenshot({path:require('os').tmpdir()+'/s_mobile2.png'});
  await T.finish();
})().catch(e=>{console.error('TEST CRASH',e);process.exit(1);});
