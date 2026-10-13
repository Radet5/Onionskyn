const {start}=require('./audit_lib');
const SP=require('os').tmpdir();
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;
// select Ball layer keyframe 0 (motion tween): click timeline cell
const tl=await page.locator('#tlC, #tl canvas').first().boundingBox();
const rows=await page.evaluate(()=>{const S=window.__FC.S;return S.doc.layers.map(l=>l.name)});console.log(rows);
await page.evaluate(()=>{const F=window.__FC,S=F.S;const l=S.doc.layers.find(l=>l.name==='Ball');S.layerId=l.id;F.setFrame(0);F.refreshProps();F.setTab('frame');});
await page.waitForTimeout(150);
console.log('curve visible',await page.evaluate(()=>getComputedStyle(document.getElementById('easeBox')).display));
await page.selectOption('#easePreset','10'); // back out
await page.waitForTimeout(100);
console.log('type',await page.inputValue('#easeType'),await page.evaluate(()=>JSON.stringify(window.__FC.C.kfFor(window.__FC.S.doc.layers.find(l=>l.name==='Ball'),0).ease)));
// drag handle 1
const cv=await page.locator('#easeCv').boundingBox();
const q=await page.evaluate(()=>window.__FC.C.kfFor(window.__FC.S.doc.layers.find(l=>l.name==='Ball'),0).ease.p);
const sx=cv.width/260, sy=cv.height/180;const hx=22+q[0]*(260-44), hy=180-22-(q[1]+0.6)/2.2*(180-44);
await page.mouse.move(cv.x+hx*sx,cv.y+hy*sy);await page.mouse.down();await page.mouse.move(cv.x+(hx+40)*sx,cv.y+(hy-30)*sy,{steps:5});await page.mouse.up();
const after=await page.evaluate(()=>JSON.stringify(window.__FC.C.kfFor(window.__FC.S.doc.layers.find(l=>l.name==='Ball'),0).ease.p));console.log('after drag',after);
// value inside the span uses bezier
const v=await page.evaluate(()=>{const F=window.__FC,S=F.S;const l=S.doc.layers.find(l=>l.name==='Ball');const a=F.C.evalLayerObjs(l,3)[0].t.y,k0=F.C.evalLayerObjs(l,0)[0].t.y,k1=F.C.evalLayerObjs(l,6)[0].t.y;return [k0,a,k1]});console.log('y at 0,3,6',v);
// undo restores
await page.keyboard.press('Control+z');console.log('after undo',await page.evaluate(()=>JSON.stringify(window.__FC.C.kfFor(window.__FC.S.doc.layers.find(l=>l.name==='Ball'),0).ease.p)));
await page.screenshot({path:SP+'/ease-ui.png'});
await T.finish();})();
