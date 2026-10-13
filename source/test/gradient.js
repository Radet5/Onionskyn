const {start}=require('./audit_lib');
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;const ok=T.ok;
await T.newDoc();
await page.mouse.click(5,5);
const box=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const cx=box.x+box.w/2,cy=box.y+box.h/2;
const last=()=>page.evaluate(()=>{const o=window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).pop();return o&&{grad:o.grad&&JSON.parse(JSON.stringify(o.grad)),fill:o.fill,n:o.contours&&o.contours.length};});
const setSel=async(id,v)=>{await page.evaluate(({id,v})=>{const e=document.querySelector(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));e.dispatchEvent(new Event('input',{bubbles:true}));},{id,v});await page.waitForTimeout(80);};
await page.keyboard.press('r');
await page.mouse.move(cx-100,cy-60);await page.mouse.down();await page.mouse.move(cx+100,cy+60,{steps:6});await page.mouse.up();await page.waitForTimeout(100);
await page.keyboard.press('v');await page.waitForTimeout(60);
await page.mouse.click(cx,cy);await page.waitForTimeout(80);
await setSel('#fillType','linear');
let g=(await last()).grad;
ok(g&&g.type==='linear'&&g.stops.length===2,'linear gradient applied with 2 stops');
ok(await page.evaluate(()=>document.querySelector('#gradBox').offsetParent!==null&&document.querySelectorAll('#gstops .gs').length===2),'stop list shows 2 rows');
await page.click('#gAdd');await page.waitForTimeout(80);
g=(await last()).grad;
ok(g.stops.length===3&&Math.abs(g.stops[1].o-0.5)<1e-6,'Add stop inserts a middle stop');
ok(await page.evaluate(()=>document.querySelectorAll('#gstops .gs').length===3),'stop list shows 3 rows');
await page.evaluate(()=>{const e=document.querySelectorAll('#gstops .gc')[1];e.value='#ff0000';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(80);
g=(await last()).grad;ok(g.stops[1].c.toLowerCase()==='#ff0000','middle stop colour edited');
await page.evaluate(()=>{const e=document.querySelectorAll('#gstops .go')[1];e.value='30';e.dispatchEvent(new Event('change',{bubbles:true}));});await page.waitForTimeout(80);
g=(await last()).grad;ok(Math.abs(g.stops[1].o-0.3)<1e-6,'middle stop position edited to 30%');
// canvas handle drag: end handle 'b'
const pt=(id)=>page.evaluate((id)=>{const F=window.__FC,S=F.S;const sel=S.sel[0];const l=S.doc.layers.find(l=>l.id===sel.lid);const o=F.C.evalLayerObjs(l,S.frame).find(o=>o.id===sel.id);const q=F.gradPts(o).find(q=>q.id===id);const s=F.w2s(q.x,q.y);const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x+s[0],y:r.y+s[1]};},id);
let pb=await pt('b');
await page.mouse.move(pb.x,pb.y);await page.mouse.down();await page.mouse.move(pb.x-30,pb.y+20,{steps:5});await page.mouse.up();await page.waitForTimeout(100);
g=(await last()).grad;
const pb2=await pt('b');
ok(Math.abs(pb2.x-(pb.x-30))<2&&Math.abs(pb2.y-(pb.y+20))<2,'dragging the end handle moves it ('+Math.round(pb2.x-pb.x)+','+Math.round(pb2.y-pb.y)+')');
ok(g.stops.length===3,'stops kept after handle drag');
// click on the line adds a stop
const pa=await pt('a'),pb3=await pt('b');
await page.mouse.click((pa.x*0.85+pb3.x*0.15),(pa.y*0.85+pb3.y*0.15));await page.waitForTimeout(100);
g=(await last()).grad;ok(g.stops.length===4,'clicking the gradient line adds a stop');
await page.keyboard.press('Control+z');await page.waitForTimeout(80);
g=(await last()).grad;ok(g.stops.length===3,'undo removes the added stop');
// remove via x button
await page.evaluate(()=>document.querySelectorAll('#gstops .gx')[1].click());await page.waitForTimeout(80);
g=(await last()).grad;ok(g.stops.length===2,'remove button deletes a stop');
ok(await page.evaluate(()=>document.querySelector('#gstops .gx').disabled),'remove disabled at 2 stops');
// radial keeps stops, handles c/r/y exist
await page.click('#gAdd');await setSel('#fillType','radial');
g=(await last()).grad;ok(g.type==='radial'&&g.stops.length===3,'switching to radial keeps stops');
const pr=await pt('r');
await page.mouse.move(pr.x,pr.y);await page.mouse.down();await page.mouse.move(pr.x+25,pr.y,{steps:4});await page.mouse.up();await page.waitForTimeout(100);
const pr2=await pt('r');ok(Math.abs(pr2.x-(pr.x+25))<2,'radial radius handle drags');
// solid again
await setSel('#fillType','solid');ok(!(await last()).grad,'solid removes the gradient');
// bucket with gradient: closed loop
await page.keyboard.press('Control+a');await page.keyboard.press('Delete');await page.waitForTimeout(60);
await page.keyboard.press('y');
const left=cx-100,right=cx+100,top=cy-70,bottom=cy+70;
const line=async(x0,y0,x1,y1)=>{await page.mouse.move(x0,y0);await page.mouse.down();for(let i=1;i<=10;i++){await page.mouse.move(x0+(x1-x0)*i/10,y0+(y1-y0)*i/10);await page.waitForTimeout(5);}await page.mouse.up();await page.waitForTimeout(50);};
await line(left-4,top,right+4,top);await line(right,top-4,right,bottom+4);await line(right+4,bottom,left-4,bottom);await line(left,bottom+4,left,top-4);
await page.keyboard.press('Escape');await page.keyboard.press('k');
await setSel('#fillType','radial');
await page.mouse.click(cx,cy);await page.waitForTimeout(150);
const bo=await page.evaluate(()=>{const o=window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs))[0];return {grad:o.grad&&o.grad.type,stops:o.grad&&o.grad.stops.length};});
await page.mouse.click(cx,cy);await page.keyboard.press('v');await page.mouse.click(cx,cy+30);await page.waitForTimeout(100);
ok(bo.grad==='radial'&&bo.stops===2,'bucket region fill uses the radial gradient');
await page.screenshot({path:require('os').tmpdir()+'/g.png'});await T.finish();})();
