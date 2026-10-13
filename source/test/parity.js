// Export parity: the rich fixture Document drawn at several Frames by the editor's renderer, the exported HTML5 player (Runtime) and the SVG
// export rasterized in the browser must give the same image, within a tolerance for anti-aliasing.
// Keyframe scripts and Sounds are left out: scripts move the player's Timeline (the fixture's jumps to "loop"), and this suite compares drawing.
const {start}=require('./audit_lib');const {richDoc}=require('./fixture_doc');const fs=require('fs');const path=require('path');
// a pixel differs when any channel differs by more than CH; a pair of images fails when more than SHARE of their pixels differ.
// Canvas and SVG anti-alias edges and text a little differently (channel differences up to about 36 here), so CH absorbs that; beyond it no
// pixel differs today. SHARE (about 65 pixels) leaves room for another Chromium's edges but not for a moved Object: shifting the small Wheel
// by 3 pixels changes about 700.
const CH=48,SHARE=0.0005;
// Keyframes (0, 10, 16), mid Motion tween (5), mid Shape tween (8), inside the looping Wheel Movie clip after it wrapped (14, its frame 2),
// and after the Symbols' Layer empties (20). In ascending order: the Runtime only steps forward.
const FRAMES=[0,5,8,10,14,16,20];
(async()=>{const T=await start();
const doc=richDoc();doc.sounds={};
for(const l of [...doc.layers,...Object.values(doc.lib).flatMap((s)=>s.layers)])for(const k of l.kfs){delete k.script;delete k.sound;}
await T.st(async(d)=>{const F=window.__FC;F.loadDoc(d);await F.C.preloadImages();},doc);
const W=doc.w,H=doc.h;
// each source returns the Frame's RGBA pixels at the Document's size
const editor=(f)=>T.st((f)=>{const c=window.__FC.renderFrameCanvas(f,1);return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);},f);
const svg=(f)=>T.st(async(f)=>{const F=window.__FC,d=F.S.doc;const url=URL.createObjectURL(new Blob([F.C.frameSVG(d,f)],{type:'image/svg+xml'}));
 const im=new Image();await new Promise((res,rej)=>{im.onload=res;im.onerror=()=>rej(new Error('SVG for Frame '+f+' did not load'));im.src=url;});URL.revokeObjectURL(url);
 const c=document.createElement('canvas');c.width=d.w;c.height=d.h;const x=c.getContext('2d');x.drawImage(im,0,0,d.w,d.h);return Array.from(x.getImageData(0,0,d.w,d.h).data);},f);
// the player: requestAnimationFrame is stubbed before it loads, so it draws only when told and its Timeline moves only on rt.tick()
const p2=T.watch(await T.ctx.newPage());await p2.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
// loaded from a file, since init scripts do not run for setContent
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'parity-')),html=path.join(TMP,'player.html');
fs.writeFileSync(html,await T.st(()=>window.__FC.buildPlayer({controls:false,sound:false,loop:false}).html));await p2.goto('file://'+html);
await p2.waitForFunction(()=>!!window.__rt,null,{polling:50});await p2.evaluate(()=>window.FCCore.preloadImages());
T.ok(await p2.evaluate(([w,h])=>{const cv=document.getElementById('cv');return cv.width===w&&cv.height===h;},[W,H]),'the player canvas is the Document size');
let at=0;
const runtime=async(f)=>{const n=f-at;if(n<0)throw new Error('FRAMES must ascend ('+at+' then '+f+')');at=f;return p2.evaluate((n)=>{const rt=window.__rt;for(let i=0;i<n;i++)rt.tick();rt.render();
 const cv=document.getElementById('cv');return Array.from(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data);},n);};
// share of differing pixels, the largest channel difference and the box holding the differing pixels
const diff=(a,b)=>{let n=0,max=0,x0=W,y0=H,x1=-1,y1=-1;
 for(let i=0;i<a.length;i+=4){let m=0;for(let c=0;c<4;c++)m=Math.max(m,Math.abs(a[i+c]-b[i+c]));max=Math.max(max,m);
  if(m>CH){n++;const p=i/4,x=p%W,y=(p-x)/W;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
 return {n,share:n/(W*H),max,box:n?[x0,y0,x1,y1]:null};};
const pct=(s)=>(100*s).toFixed(2)+'%';
for(const f of FRAMES){
 const e=await editor(f),p=await runtime(f),s=await svg(f);
 for(const [what,o] of [['player',p],['SVG',s]]){if(!T.ok(o.length===e.length,'Frame '+f+', editor vs '+what+': same image size ('+e.length/4+' vs '+o.length/4+' pixels)'))continue;
  const d=diff(e,o);T.ok(d.share<=SHARE,'Frame '+f+', editor vs '+what+': '+d.n+' pixels ('+pct(d.share)+') differ (allowed '+pct(SHARE)+'), largest channel difference '+d.max+(d.box?', in x '+d.box[0]+'–'+d.box[2]+', y '+d.box[1]+'–'+d.box[3]:''));}}
await p2.close();fs.rmSync(TMP,{recursive:true,force:true});
await T.finish();})();
