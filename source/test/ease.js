const {start}=require('./audit_lib');
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;
// the sample's Ball layer: a Motion tween from Frame 1 (y 70) to Frame 13 (y 258), eased 'in' 60; code indexes Frames from 0
const ease=()=>page.evaluate(()=>{const F=window.__FC;return F.C.kfFor(F.S.doc.layers.find(l=>l.name==='Ball'),0).ease;});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
await page.evaluate(()=>{const F=window.__FC,S=F.S;const l=S.doc.layers.find(l=>l.name==='Ball');S.layerId=l.id;F.setFrame(0);F.refreshProps();F.setTab('frame');});
await page.waitForFunction(()=>getComputedStyle(document.getElementById('easeBox')).display!=='none');
const orig=await ease();
T.ok(same(orig,{type:'in',amt:60}),'sample Ball tween starts eased in '+JSON.stringify(orig));
// presets: 'Back out' is option 10
await page.selectOption('#easePreset','10');
T.ok(await page.inputValue('#easeType')==='bezier','preset sets the Ease type select to bezier');
const BACK_OUT={type:'bezier',amt:50,p:[0.175,0.885,0.32,1.275]};
T.ok(same(await ease(),BACK_OUT),'preset sets a bezier Ease with its points '+JSON.stringify(await ease()));
await page.keyboard.press('Control+z');
T.ok(same(await ease(),orig),'undo restores the Ease from before the preset '+JSON.stringify(await ease()));
await page.keyboard.press('Control+Shift+z');
const preset=await ease();
T.ok(same(preset,BACK_OUT),'redo brings the preset back');
// drag the first curve handle 40px right and 30px up, in canvas units (EZ in src/app3.js: 260x180, 22 padding, y from -0.6 to 1.6)
const q=preset.p,EZ={w:260,h:180,pad:22,lo:-0.6,hi:1.6},cw=EZ.w-2*EZ.pad,ch=EZ.h-2*EZ.pad;
const cv=await page.locator('#easeCv').boundingBox();
const sx=cv.width/EZ.w,sy=cv.height/EZ.h,hx=EZ.pad+q[0]*cw,hy=EZ.h-EZ.pad-(q[1]-EZ.lo)/(EZ.hi-EZ.lo)*ch;
await page.mouse.move(cv.x+hx*sx,cv.y+hy*sy);await page.mouse.down();await page.mouse.move(cv.x+(hx+40)*sx,cv.y+(hy-30)*sy,{steps:5});await page.mouse.up();
const dragged=await ease();const want=[q[0]+40/cw,q[1]+30/ch*(EZ.hi-EZ.lo)];
T.ok(Math.abs(dragged.p[0]-want[0])<0.01&&Math.abs(dragged.p[1]-want[1])<0.01,'dragging handle 1 moves it to '+want.map(v=>v.toFixed(3))+': '+JSON.stringify(dragged.p));
T.ok(dragged.p[2]===q[2]&&dragged.p[3]===q[3],'dragging handle 1 leaves handle 2 at '+q.slice(2));
// halfway through the Tween the value follows the dragged curve, not a straight line
const mid=await page.evaluate((p)=>{const C=window.__FC.C,l=window.__FC.S.doc.layers.find(l=>l.name==='Ball');return {y:C.evalLayerObjs(l,6)[0].t.y,want:70+(258-70)*C.bezierEase(0.5,...p)};},dragged.p);
T.ok(Math.abs(mid.y-mid.want)<1e-6,'frame 6 is at y '+mid.want.toFixed(2)+' on the curve: '+mid.y.toFixed(2));
T.ok(Math.abs(mid.y-164)>5,'frame 6 is away from the linear y 164: '+mid.y.toFixed(2));
await page.keyboard.press('Control+z');
T.ok(same(await ease(),preset),'undo restores the curve from before the drag '+JSON.stringify(await ease()));
await T.finish();})();
