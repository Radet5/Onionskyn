const {start}=require('./audit_lib');
const SP=require('os').tmpdir();
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;const ok=T.ok;
// ---- geometry tests (rasterise outline, measure vertical thickness at x)
const R=await page.evaluate(()=>{
 const F=window.__FC, out={};
 const cv=document.createElement('canvas');cv.width=700;cv.height=300;const x=cv.getContext('2d',{willReadFrequently:true});
 const raster=(cs)=>{x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,700,300);x.fillStyle='#000';x.beginPath();for(const c of cs){c.nodes.forEach((n,i)=>i?x.lineTo(n.x,n.y):x.moveTo(n.x,n.y));x.closePath();}x.fill('nonzero');return x.getImageData(0,0,700,300).data;};
 const thick=(A,px)=>{let n=0;for(let y=0;y<300;y++)if(A[(y*700+px)*4+3]>127)n++;return n;};
 const hthick=(A,py)=>{let n=0;for(let xx=0;xx<700;xx++)if(A[(py*700+xx)*4+3]>127)n++;return n;};
 const line=(n=80,t0=0)=>Array.from({length:n+1},(_,i)=>({x:60+i/n*500,y:150,pr:1,t:t0+i*16}));
 const base={size:20,stab:0,smooth:0,round:100,angle:0,taper:0,vel:0,press:100,zoom:true,alpha:100,color:'#000'};
 // 1 no taper: constant thickness ~20
 let A=raster(F.fluidOutline(line(),Object.assign({},base),1));
 out.flatMid=thick(A,300);out.flatNear=thick(A,90);
 // 2 taper
 A=raster(F.fluidOutline(line(),Object.assign({},base,{taper:100}),1));
 out.tapMid=thick(A,310);out.tapNear=thick(A,75);out.tapEndNear=thick(A,545);
 // 3 roundness: thin horizontal ellipse (angle 0) -> horizontal line thin
 A=raster(F.fluidOutline(line(),Object.assign({},base,{round:20}),1));
 out.roundThin=thick(A,300);
 A=raster(F.fluidOutline(line(),Object.assign({},base,{round:20,angle:90}),1));
 out.roundThinRot=thick(A,300);
 // 4 pressure: pen pressure ramp
 const pr=line().map((p,i,a)=>Object.assign({},p,{pr:0.2+0.8*i/a.length}));
 A=raster(F.fluidOutline(pr,Object.assign({},base,{press:100}),1));out.prLo=thick(A,90);out.prHi=thick(A,520);
 A=raster(F.fluidOutline(pr,Object.assign({},base,{press:0}),1));out.prOff1=thick(A,90);out.prOff2=thick(A,520);
 // 5 stabiliser: jittery input -> lower roughness
 let sd=12345;const rnd=()=>{sd=(sd*1664525+1013904223)>>>0;return sd/4294967296;};const jit=Array.from({length:101},(_,i)=>({x:60+i*5,y:150+(rnd()-0.5)*20,pr:1,t:i*16}));
 const rough=(cs)=>{const A=raster(cs);const m=[];for(let xx=100;xx<500;xx++){let sy=0,n=0;for(let y=0;y<300;y++)if(A[(y*700+xx)*4+3]>127){sy+=y;n++;}m.push(n?sy/n:null);}let s=0,c=0;for(let i=1;i<m.length-1;i++)if(m[i-1]!=null&&m[i]!=null&&m[i+1]!=null){s+=Math.abs(m[i-1]-2*m[i]+m[i+1]);c++;}return c?s/c:0;};
 out.roughRaw=rough(F.fluidOutline(jit,Object.assign({},base,{stab:0,smooth:0,size:6}),1));
 out.roughStab=rough(F.fluidOutline(jit,Object.assign({},base,{stab:80,smooth:0,size:6}),1));
 out.roughSmooth=rough(F.fluidOutline(jit,Object.assign({},base,{stab:0,smooth:100,size:6}),1));
 // 6 velocity: fast vs slow section
 const vl=[];for(let i=0;i<=80;i++){const fast=i>40;vl.push({x:60+(i<=40?i*3:120+(i-40)*14),y:150,pr:1,t:i*16});}
 A=raster(F.fluidOutline(vl,Object.assign({},base,{vel:100}),1));out.velSlow=thick(A,90);out.velFast=thick(A,500);
 A=raster(F.fluidOutline(vl,Object.assign({},base,{vel:-100}),1));out.velSlowN=thick(A,90);out.velFastN=thick(A,500);
 A=raster(F.fluidOutline(vl,Object.assign({},base,{vel:0}),1));out.vel0a=thick(A,90);out.vel0b=thick(A,500);
 // 7 zoom size off: at z=2 a 20px brush is 10 world units
 A=raster(F.fluidOutline(line(),Object.assign({},base,{zoom:false}),2));out.zoomOffZ2=thick(A,300);
 A=raster(F.fluidOutline(line(),Object.assign({},base,{zoom:true}),2));out.zoomOnZ2=thick(A,300);
 // 8 single click -> dot; two identical points; NaN safety
 let cs=F.fluidOutline([{x:100,y:100,pr:1}],base,1);out.dot=cs[0].nodes.length;
 cs=F.fluidOutline([{x:100,y:100,pr:1},{x:100,y:100,pr:1}],base,1);out.dot2=cs[0].nodes.length;
 let nan=false;for(const st of [Object.assign({},base,{taper:100,stab:100,smooth:100,vel:100}),Object.assign({},base,{round:5,angle:180})])for(const pts of [line(),jit,vl,[{x:1,y:1}],[{x:1,y:1},{x:2,y:1}]]){const c=F.fluidOutline(pts,st,0.1);for(const n of c[0].nodes)if(!isFinite(n.x)||!isFinite(n.y))nan=true;}
 out.nan=nan;
 // 9 many points perf
 const big=Array.from({length:6000},(_,i)=>({x:50+i*0.1,y:150+Math.sin(i/90)*80,pr:1,t:i*4}));const t0=performance.now();const cb=F.fluidOutline(big,Object.assign({},base,{stab:50,smooth:100,taper:50}),1);out.perfMs=Math.round(performance.now()-t0);out.perfNodes=cb[0].nodes.length;
 return out;});
console.log(JSON.stringify(R));
ok(Math.abs(R.flatMid-20)<=2&&Math.abs(R.flatNear-20)<=2,'no taper keeps size (~20): '+R.flatMid+'/'+R.flatNear);
ok(R.tapMid>=17&&R.tapNear<R.tapMid*0.6&&R.tapEndNear<R.tapMid*0.6,'taper thins both ends: mid '+R.tapMid+' near '+R.tapNear+'/'+R.tapEndNear);
ok(R.roundThin<=7&&R.roundThinRot>=17,'roundness 20 thin; angle 90 rotates it: '+R.roundThin+' vs '+R.roundThinRot);
ok(R.prHi>R.prLo*2,'pressure scales width: '+R.prLo+' -> '+R.prHi);
ok(Math.abs(R.prOff1-R.prOff2)<=2,'pressure 0 ignores pen: '+R.prOff1+'/'+R.prOff2);
ok(R.roughStab<R.roughRaw*0.5,'stabilizer reduces wobble: '+R.roughRaw.toFixed(2)+' -> '+R.roughStab.toFixed(2));
ok(R.roughSmooth<R.roughRaw*0.7,'curve smoothing reduces wobble: '+R.roughSmooth.toFixed(2));
ok(R.velFast<R.velSlow*0.7,'velocity+ thins fast strokes: '+R.velSlow+' vs '+R.velFast);
ok(R.velFastN>R.velSlowN*1.15,'velocity- thickens fast strokes: '+R.velSlowN+' vs '+R.velFastN);
ok(Math.abs(R.vel0a-R.vel0b)<=2,'velocity 0 has no effect');
ok(R.zoomOffZ2>=8&&R.zoomOffZ2<=12&&R.zoomOnZ2>=18,'zoom size off keeps screen size: '+R.zoomOffZ2+' vs on '+R.zoomOnZ2);
ok(R.dot>=8,'single click makes a dot ('+R.dot+' nodes), 2 identical pts '+R.dot2);
ok(!R.nan,'no NaN/Infinity for extreme settings');
ok(R.perfMs<400,'6000-point stroke in '+R.perfMs+' ms, '+R.perfNodes+' nodes');
// ---- UI: key F, tab, drag to draw, undo, presets
await T.newDoc();
await page.mouse.click(5,5);
ok(await page.$eval('#tab-brush',e=>e.hidden||getComputedStyle(e).display==='none'),'Brush tab hidden before choosing the fluid brush');
await page.evaluate(()=>window.__FC.setTab('doc'));await page.waitForTimeout(50);
await page.keyboard.press('f');await page.waitForTimeout(100);
ok(await page.evaluate(()=>window.__FC.S.tool)==='fluid','F selects fluid brush');
ok(await page.$eval('#tab-brush',e=>!e.hidden&&getComputedStyle(e).display!=='none'),'Brush tab appears with the fluid brush');
ok(await page.evaluate(()=>document.querySelector('#pane-brush').classList.contains('on')),'Brush tab opens');
ok((await page.$$('#fbBox input[type=range]')).length===9,'9 sliders present');
const box=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const n0=await page.evaluate(()=>window.__FC.S.doc.layers.reduce((a,l)=>a+l.kfs.reduce((b,k)=>b+k.objs.length,0),0));
const cx=box.x+box.w/2,cy=box.y+box.h/2;
await page.mouse.move(cx-150,cy);await page.mouse.down();
for(let i=0;i<=40;i++){await page.mouse.move(cx-150+i*7.5,cy+Math.sin(i/6)*40);await page.waitForTimeout(8);}
await page.mouse.up();await page.waitForTimeout(150);
const n1=await page.evaluate(()=>window.__FC.S.doc.layers.reduce((a,l)=>a+l.kfs.reduce((b,k)=>b+k.objs.length,0),0));
ok(n1===n0+1,'dragging draws one object');
const ob=await page.evaluate(()=>{const o=window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).pop();return {kind:o.kind,fill:o.fill,fa:o.fa,nz:o.nz,nodes:o.contours?o.contours[0].nodes.length:(o.c&&o.c[0]&&o.c[0].nodes.length)};});
console.log(JSON.stringify(ob));
ok(ob.kind==='path'&&ob.fill==='#1B2030'&&ob.nz===true,'stroke is a filled nonzero path');
await page.keyboard.press('Control+z');await page.waitForTimeout(100);
const n2=await page.evaluate(()=>window.__FC.S.doc.layers.reduce((a,l)=>a+l.kfs.reduce((b,k)=>b+k.objs.length,0),0));
ok(n2===n0,'undo removes the stroke');
await page.keyboard.press('Control+Shift+z');await page.waitForTimeout(100);
ok(await page.evaluate(()=>window.__FC.S.doc.layers.reduce((a,l)=>a+l.kfs.reduce((b,k)=>b+k.objs.length,0),0))===n1,'redo brings it back');
// [ ] keys
const s0=await page.evaluate(()=>window.__FC.S.style.fb.size);await page.keyboard.press(']');const s1=await page.evaluate(()=>window.__FC.S.style.fb.size);await page.keyboard.press('[');const s2=await page.evaluate(()=>window.__FC.S.style.fb.size);
ok(s1>s0&&s2<s1,'[ and ] resize fluid brush '+s0+'->'+s1+'->'+s2);
ok(await page.evaluate(()=>window.__FC.S.tab)==='brush','tab stays on Brush after drawing/undo/redo with the fluid brush');
// slider/number sync
await page.fill('#fb_taperN','60');await page.waitForTimeout(50);
ok(await page.evaluate(()=>window.__FC.S.style.fb.taper)===60&&await page.inputValue('#fb_taper')==='60','number box drives taper and slider');
await page.fill('#fb_sizeN','9999');await page.waitForTimeout(50);
ok(await page.evaluate(()=>window.__FC.S.style.fb.size)===200,'size clamps to 200');
// presets
await page.fill('#fbName','Ink <b>test</b>');await page.click('#fbSave');await page.waitForTimeout(80);
let list=await page.$$eval('#fbList .fbitem button[data-fa]',els=>els.map(e=>e.textContent));
ok(list.length===1&&list[0]==='Ink <b>test</b>','preset saved, name shown as text (no HTML injection)');
ok(await page.evaluate(()=>document.querySelectorAll('#fbList b').length)===0,'no injected elements');
await page.fill('#fb_taperN','5');await page.waitForTimeout(50);
ok(!(await page.$eval('#fbUpdate',e=>e.disabled)),'Save changes enabled after edit');
await page.click('#fbUpdate');await page.waitForTimeout(50);
ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('flashcraft.fbpresets'))[0].taper)===5,'preset updated in storage');
await page.fill('#fb_taperN','90');await page.click('#fbList [data-fa="0"]');await page.waitForTimeout(50);
ok(await page.evaluate(()=>window.__FC.S.style.fb.taper)===5,'clicking preset applies it');
await page.click('#fbReset');await page.waitForTimeout(50);
ok(await page.evaluate(()=>window.__FC.S.style.fb.size)===12,'reset restores defaults');
await page.reload();await page.waitForTimeout(500);
await page.mouse.click(5,5);await page.evaluate(()=>window.__FC.setTab('doc'));await page.keyboard.press('f');await page.waitForTimeout(100);
ok((await page.$$('#fbList .fbitem')).length===1,'presets survive reload');
await page.click('#fbList [data-fd="0"]');await page.waitForTimeout(50);
ok((await page.$$('#fbList .fbitem')).length===0,'preset deleted');
await page.keyboard.press('v');await page.waitForTimeout(100);
ok(await page.$eval('#tab-brush',e=>e.hidden||getComputedStyle(e).display==='none'),'Brush tab hides again on other tools');
{const tt=await page.evaluate(()=>[window.__FC.S.tab,window.__FC.S.tabBefore]);console.log('tab after v:',tt);ok(tt[0]==='doc','returns to the tab you were on (doc)');}
await page.keyboard.press('b');await page.waitForTimeout(100);
ok(await page.$eval('#tab-brush',e=>e.hidden||getComputedStyle(e).display==='none'),'classic Brush tool shows no fluid tab');
await page.evaluate(()=>window.__FC.setTab('brush'));
ok(await page.evaluate(()=>window.__FC.S.tab)!=='brush','cannot open the Brush tab while another tool is active');
await page.keyboard.press('f');await page.waitForTimeout(100);
await page.evaluate(()=>window.__FC.setTab('brush'));
await page.keyboard.press('v');await page.waitForTimeout(100);
ok(await page.evaluate(()=>window.__FC.S.tab)!=='brush','leaving fluid from the Brush tab switches to another tab');
// switching tools doesn't throw; classic brush untouched
await page.keyboard.press('b');await page.keyboard.press('f');await page.keyboard.press('v');
await page.screenshot({path:SP+'/fluid.png'});
await T.finish();})();
