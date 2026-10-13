const {start}=require('./audit_lib');
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;const ok=T.ok;
await T.newDoc();
await page.mouse.click(5,5);
const box=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const cx=box.x+box.w/2,cy=box.y+box.h/2;
const objs=()=>page.evaluate(()=>window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).length);
const line=async(x0,y0,x1,y1)=>{await page.mouse.move(x0,y0);await page.mouse.down();for(let i=1;i<=12;i++){await page.mouse.move(x0+(x1-x0)*i/12,y0+(y1-y0)*i/12);await page.waitForTimeout(5);}await page.mouse.up();await page.waitForTimeout(60);};
// closed loop of 4 pencil lines (gap-free corners overlap a little)
await page.keyboard.press('y');
const left=cx-100,right=cx+100,top=cy-70,bottom=cy+70;
await line(left-4,top,right+4,top);await line(right,top-4,right,bottom+4);await line(right+4,bottom,left-4,bottom);await line(left,bottom+4,left,top-4);
const n0=await objs();
await page.keyboard.press('k');await page.waitForTimeout(80);
ok(await page.evaluate(()=>getComputedStyle(document.querySelector('#bgap')).display!=='none'&&document.querySelector('#bgap').offsetParent!==null),'gap option visible with bucket');
await page.mouse.click(cx,cy);await page.waitForTimeout(150);
ok((await objs())===n0+1,'clicking enclosed empty space adds a fill shape');
const px=await page.evaluate(({x,y})=>{const s=document.querySelector('#stage');const c=s.getContext('2d');const r=s.getBoundingClientRect();const d=window.devicePixelRatio||1;return Array.from(c.getImageData(Math.round(x*d),Math.round(y*d),1,1).data);},{x:cx-box.x,y:cy-box.y});
ok(px[3]>200&&px[2]>150&&px[0]<120,'filled pixel is the fill colour '+px);
await page.keyboard.press('Control+z');await page.waitForTimeout(80);
ok((await objs())===n0,'undo removes the fill');
// outside the loop: open space -> toast, nothing added
await page.mouse.click(cx+170,cy);await page.waitForTimeout(100);
ok((await objs())===n0,'open space adds nothing');
// loop with a gap
await page.keyboard.press('Control+a');await page.keyboard.press('Delete');await page.waitForTimeout(60);
await page.keyboard.press('y');
await line(left-4,top,right+4,top);await line(right,top-4,right,bottom+4);await line(right+4,bottom,left-4,bottom);await line(left,bottom+4,left,top+40);
const n1=await objs();
await page.keyboard.press('k');
await page.evaluate(()=>{document.querySelector('#bgap').value='none';document.querySelector('#bgap').dispatchEvent(new Event('change',{bubbles:true}));});
await page.mouse.click(cx,cy);await page.waitForTimeout(120);
ok((await objs())===n1,'gap with "close no gaps" adds nothing');
await page.evaluate(()=>{document.querySelector('#bgap').value='large';document.querySelector('#bgap').dispatchEvent(new Event('change',{bubbles:true}));});
await page.mouse.click(cx,cy);await page.waitForTimeout(120);
ok((await objs())===n1,'gap of ~30px is still too big for "large"');
// small gap
await page.keyboard.press('Control+a');await page.keyboard.press('Delete');await page.waitForTimeout(60);
await page.keyboard.press('y');
await line(left-4,top,right+4,top);await line(right,top-4,right,bottom+4);await line(right+4,bottom,left-4,bottom);await line(left,bottom+4,left,top+14);
const n2=await objs();
await page.keyboard.press('k');
await page.mouse.click(cx,cy);await page.waitForTimeout(120);
ok((await objs())===n2+1,'"large" closes a ~10px gap');
await T.finish();})();
