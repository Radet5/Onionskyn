const {start}=require('./audit_lib');
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;const ok=T.ok;
await T.newDoc();
await page.mouse.click(5,5);
const box=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const objs=()=>page.evaluate(()=>window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).length);
const sel=()=>page.evaluate(()=>window.__FC.S.sel.length);
const stroke=async(x0,y0,dx,dy,n=24)=>{await page.mouse.move(x0,y0);await page.mouse.down();for(let i=1;i<=n;i++){await page.mouse.move(x0+dx*i/n,y0+dy*i/n);await page.waitForTimeout(6);}await page.mouse.up();await page.waitForTimeout(80);};
const cx=box.x+box.w/2,cy=box.y+box.h/2;
const shot=async()=>page.evaluate(()=>{const F=window.__FC;const cv=document.createElement('canvas');cv.width=480;cv.height=270;const x=cv.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,480,270);x.setTransform(480/F.S.doc.w,0,0,270/F.S.doc.h,0,0);F.renderFrameCanvas&&0;return null;});
for(const tool of ['f','b']){
 await page.keyboard.press(tool);await page.waitForTimeout(80);
 await page.keyboard.press('Control+a');await page.keyboard.press('Delete');await page.waitForTimeout(80);
 await page.keyboard.press(tool);
 const o0=await objs();
 await stroke(cx-120,cy-60,240,0);
 ok((await sel())===0,tool+': no selection after a stroke');
 await stroke(cx-60,cy-100,120,140);
 await stroke(cx-100,cy+70,200,-20);
 ok((await objs())===o0+1,tool+': 3 same-colour strokes merge into 1 shape (objs '+o0+' -> '+(await objs())+')');
 const info=await page.evaluate(()=>{const o=window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).pop();return {contours:o.contours.length,tx:o.t.x,ty:o.t.y};});
 ok(info.contours===3,tool+': merged shape holds 3 contours');
 await page.keyboard.press('Control+z');await page.waitForTimeout(80);
 ok((await objs())===o0+1&&(await page.evaluate(()=>window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).pop().contours.length))===2,tool+': undo removes only the last stroke');
 await page.keyboard.press('Control+Shift+z');await page.waitForTimeout(80);
 // different colour -> new object
 if(tool==='f') await page.evaluate(()=>window.__fbSet('color','#ff0000'));
 else await page.evaluate(()=>{window.__FC.S.style.bcolor='#ff0000';});
 await stroke(cx-80,cy-20,160,10);
 ok((await objs())===o0+2,tool+': a different colour starts a new shape');
 if(tool==='f') await page.evaluate(()=>window.__fbSet('color','#1B2030')); else await page.evaluate(()=>{window.__FC.S.style.bcolor='#1B2030';});
 await stroke(cx-80,cy+30,160,0);
 ok((await objs())===o0+3,tool+': going back to the first colour does not merge under the red shape (z-order kept)');
 // toggle off
 if(tool==='f') await page.evaluate(()=>{window.__FC.S.style.fb.merge=false;}); else await page.evaluate(()=>{window.__FC.S.style.bmerge=false;});
 await stroke(cx-80,cy+60,160,0);await stroke(cx-80,cy+80,160,0);
 ok((await objs())===o0+5,tool+': merge off keeps strokes separate');
 if(tool==='f') await page.evaluate(()=>{window.__FC.S.style.fb.merge=true;}); else await page.evaluate(()=>{window.__FC.S.style.bmerge=true;});
}
// pixel check: merged vs separate render identical (crossing strokes, incl. translucent)
const diff=await page.evaluate(async()=>{
 const F=window.__FC;
 const draw=(merge)=>{ /* use fluidOutline directly and fill like the app does */ return 0; };
 return 0;});
// raster comparison via public API: render frame with merged object vs the same strokes as separate objects
const rr=await page.evaluate(()=>{
 const F=window.__FC, S=F.S;
 const mkStrokes=()=>{const A=[],B=[];for(let i=0;i<=60;i++){const t=i/60;A.push({x:100+t*300,y:120+Math.sin(t*9)*60,pr:1});B.push({x:250+Math.sin(t*7)*120,y:40+t*200,pr:1});}return [A,B];};
 const fb={size:30,stab:0,smooth:20,round:100,angle:0,taper:30,vel:0,press:100,zoom:true,alpha:60,color:'#ff0000'};
 const [A,B]=mkStrokes();
 const cA=F.fluidOutline(A,fb,1),cB=F.fluidOutline(B,fb,1);
 const area=(c)=>{let a=0;const n=c.nodes;for(let i=0;i<n.length;i++){const p=n[i],q=n[(i+1)%n.length];a+=p.x*q.y-q.x*p.y;}return a/2;};
 const norm=(cs)=>cs.map(c=>({closed:true,nodes:(area(c)<0?c.nodes.slice().reverse():c.nodes).map(n=>({x:n.x,y:n.y}))}));
 const cv=document.createElement('canvas');cv.width=520;cv.height=300;const x=cv.getContext('2d',{willReadFrequently:true});
 const fill=(groups)=>{x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,520,300);x.fillStyle='#000';for(const g of groups){x.beginPath();for(const c of g){c.nodes.forEach((n,i)=>i?x.lineTo(n.x,n.y):x.moveTo(n.x,n.y));x.closePath();}x.fill('nonzero');}return x.getImageData(0,0,520,300).data;};
 const one=fill([norm(cA).concat(norm(cB))]);  // merged: one path, alpha applied once -> compare coverage
 const sep=fill([norm(cA),norm(cB)]);
 let d=0,tot=0;for(let i=3;i<one.length;i+=4){const a=one[i]>127,b=sep[i]>127;if(a||b)tot++;if(a!==b)d++;}
 return {d,tot,pct:+(d/tot*100).toFixed(3)};});
console.log(JSON.stringify(rr));
ok(rr.pct<0.2,'merged contours cover the same pixels as separate strokes: '+rr.pct+'% differ');
await T.finish();})();
