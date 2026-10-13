const fs=require('fs'); const path=require('path');
const {JSDOM}=require('jsdom'); const JSZip=require('jszip');
globalThis.DOMParser=new JSDOM('').window.DOMParser; globalThis.JSZip=JSZip;
// bundle Core from source the same way build.mjs does, so the suite tests src/core/ and not dist/
eval(require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../src/core/index.js')],bundle:true,write:false,format:'iife',banner:{js:"'use strict';"},target:'esnext',charset:'utf8',logLevel:'warning'}).outputFiles[0].text);
const C=globalThis.FCCore; let fails=0;
const ok=(c,m)=>{ if(!c){fails++;process.exitCode=1;console.log('FAIL',m);} else console.log('ok  ',m); };

// --- the exported API: Runtime and HTML exports depend on this exact key set
const KEYS=["uid","clamp","lerp","clone","nz","hexToRgb","rgbToHex","lerpHex","rgba","newT","matOf","mmul","minv","mapply","decompose","node","tracePath","pathD","bezPt","splitSeg","contoursBounds","localBounds","worldCorners","worldBounds","recenter","applyMatrixToNodes","setObjMatrix","ellipseContour","rectContour","mkPath","mkLayer","mkKf","mkDoc","normalizeDoc","groupEntries","drawUnits","maskedDraw","groupAlpha","tweenPairs","shapeTweenIssues","ease","bezierEase","morphContours","evalLayerObjs","evalDoc","kfIndexAt","kfAt","kfFor","sortKfs","ensureEditable","insertKeyframe","insertFrames","removeFrames","clearKeyframe","moveKeyframe","setTweenAt","drawObj","hitObj","frameSVG","objSVG","quantize","lzw","gifWriter","parseNum","parseEdges","assembleLoops","importFLA","setImages","preloadImages","setLib","setMeasure","kidsOf","layoutText"];
ok(JSON.stringify(Object.keys(C))===JSON.stringify(KEYS),'FCCore key set unchanged');

// --- tween eval
const doc=C.mkDoc(); const L=doc.layers[0];
const o=C.mkPath([C.ellipseContour(20,20)],{fill:'#ff0000'},{x:100,y:100}); L.kfs[0].objs.push(o);
const k2=C.mkKf(10,[Object.assign(C.clone(o),{t:{x:200,y:100,sx:2,sy:2,r:90}, fill:'#0000ff'})]); L.kfs.push(k2);
L.kfs[0].tween='motion';
let e=C.evalLayerObjs(L,5)[0];
ok(Math.abs(e.t.x-150)<1e-9 && Math.abs(e.t.sx-1.5)<1e-9 && Math.abs(e.t.r-45)<1e-9,'motion tween midpoint');
ok(e.fill==='#800080'||e.fill==='#7f007f'||e.fill==='#80007f','colour lerp '+e.fill);
L.kfs[0].ease={type:'in',amt:50};
e=C.evalLayerObjs(L,5)[0]; ok(e.t.x<150,'ease in slows start');
// ensureEditable splits tween
const kk=C.ensureEditable(L,5); ok(kk.f===5 && L.kfs.length===3 && kk.tween==='motion','ensureEditable splits span');
// setTweenAt with no next
const d2=C.mkDoc(); const l2=d2.layers[0]; l2.kfs[0].objs.push(C.mkPath([C.rectContour(10,10,0)],{}));
let r=C.setTweenAt(d2,l2,0,'shape'); ok(r.ok&&l2.kfs.length===2&&l2.kfs[1].f===47,'setTween creates end kf');
// morph rect->ellipse
const a=C.rectContour(40,40,0), b=C.ellipseContour(20,20);
const m=C.morphContours([a],[b],0.5); ok(m&&m[0].nodes.length===4,'morph 4->4');
const a8=C.rectContour(40,40,8); const m2=C.morphContours([a8],[b],0.5); ok(m2&&m2[0].nodes.length===8,'morph 8->4 subdivides');
// frames ops
C.insertFrames(L,5,2,doc); ok(L.kfs[2].f===12&&doc.frames===50,'insert frames shifts');
C.removeFrames(L,5,2,doc); ok(L.kfs[L.kfs.length-1].f===10,'remove frames shifts back');
// svg
const svg=C.frameSVG(doc,0); ok(/<svg/.test(svg)&&/<path/.test(svg),'svg export');

// --- GIF
const W=64,H=48; const w=C.gifWriter(W,H,true);
for(let f=0;f<4;f++){ const px=new Uint8ClampedArray(W*H*4); for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4; px[i]=(x*4+f*40)&255; px[i+1]=(y*5)&255; px[i+2]=(x*y+f*20)&255; px[i+3]=255;} w.addFrame(px,5); }
// flat colour frame (<=256 colours)
{ const px=new Uint8ClampedArray(W*H*4); for(let i=0;i<W*H;i++){px[i*4]=i%W<32?255:10;px[i*4+1]=40;px[i*4+2]=200;px[i*4+3]=255;} w.addFrame(px,5); }
fs.writeFileSync(require('os').tmpdir()+'/t.gif',Buffer.from(w.finish()));

// --- FLA
(async()=>{
 const z=new JSZip();
 const dom=`<?xml version="1.0"?><DOMDocument xmlns="http://ns.adobe.com/xfl/2008/" width="400" height="300" frameRate="12" backgroundColor="#CCCCCC">
 <symbols><Include href="Sym.xml"/></symbols>
 <timelines><DOMTimeline name="Scene 1"><layers>
  <DOMLayer name="mask1" layerType="mask"><frames><DOMFrame index="0"/></frames></DOMLayer>
  <DOMLayer name="Top" color="#4FFF4F"><frames>
    <DOMFrame index="0" duration="5" tweenType="motion" acceleration="-40"><elements>
      <DOMSymbolInstance libraryItemName="Sym" symbolType="graphic"><matrix><Matrix tx="50" ty="60"/></matrix><transformationPoint><Point x="10" y="20"/></transformationPoint></DOMSymbolInstance></elements></DOMFrame>
    <DOMFrame index="5" duration="5"><elements>
      <DOMSymbolInstance libraryItemName="Sym" symbolType="graphic"><matrix><Matrix a="2" d="2" tx="300" ty="200"/></matrix></DOMSymbolInstance></elements></DOMFrame>
  </frames></DOMLayer>
  <DOMLayer name="Shape"><frames><DOMFrame index="0" duration="10"><elements>
   <DOMShape><fills><FillStyle index="1"><SolidColor color="#FF0000"/></FillStyle><FillStyle index="2"><LinearGradient><GradientEntry color="#000000" ratio="0"/><GradientEntry color="#FFFFFF" ratio="1"/></LinearGradient></FillStyle></fills>
   <strokes><StrokeStyle index="1"><SolidStroke weight="4"><fill><SolidColor color="#0000FF"/></fill></SolidStroke></StrokeStyle></strokes>
   <edges>
     <Edge fillStyle1="1" strokeStyle="1" edges="!2000 2000|4000 2000|4000 4000|2000 4000|2000 2000"/>
     <Edge fillStyle0="2" edges="!#1388.00 #1388.80|#1770.00 #1388.80[#1900.00 #1500.00 #1770.00 #1770.00|#1388.00 #1770.00|#1388.00 #1388.80"/>
   </edges></DOMShape></elements></DOMFrame></frames></DOMLayer>
 </layers></DOMTimeline></timelines></DOMDocument>`;
 z.file('DOMDocument.xml',dom);
 z.file('LIBRARY/Sym.xml',`<DOMSymbolItem xmlns="http://ns.adobe.com/xfl/2008/" name="Sym" symbolType="graphic"><timeline><DOMTimeline name="Sym"><layers><DOMLayer name="L"><frames><DOMFrame index="0"><elements><DOMShape><fills><FillStyle index="1"><SolidColor color="#00AA00" alpha="0.5"/></FillStyle></fills><edges><Edge fillStyle1="1" edges="!0 0|400 0|400 400|0 400|0 0"/></edges></DOMShape></elements></DOMFrame></frames></DOMLayer></layers></DOMTimeline></timeline></DOMSymbolItem>`);
 const buf=await z.generateAsync({type:'arraybuffer'});
 const {doc:d,report}=await C.importFLA(buf);
 ok(d.w===400&&d.h===300&&d.fps===12&&d.bg==='#CCCCCC','FLA doc settings');
 ok(d.layers.length===3&&report.mask===1&&d.layers[2].mask===true,'FLA layers (mask imported as mask layer)');
 const top=d.layers[1]; ok(top.kfs.length===2&&top.kfs[0].tween==='motion'&&top.kfs[0].ease.type==='in','FLA tween+ease');
 const g0=top.kfs[0].objs[0]; ok(Math.abs(g0.t.x-60)<1e-9&&Math.abs(g0.t.y-80)<1e-9,'transformation point moves pivot: t='+g0.t.x+','+g0.t.y);
 const mid=C.evalLayerObjs(top,2)[0]; ok(mid&&mid.kind==='clip'&&mid.t.sx>1&&mid.t.sx<2,'FLA symbol motion tween interpolates '+(mid&&mid.t.sx));
 const sh=d.layers[0].kfs[0].objs; ok(sh.length===3,'FLA shape objs fill1+fill2+stroke = '+sh.length);
 ok(report.gradient===1,'gradient flagged');
 const f1=sh.find(o=>o.id.endsWith('-f1')); const bb=C.localBounds(f1); ok(f1&&Math.abs((bb.x1-bb.x0)-100)<0.01,'fill bounds 100px from twips');
 ok(C.parseNum('#FFFFFFFF.80')===-0.5 && C.parseNum('#1388.80')===5000.5,'hex fixed-point numbers');
 const f2=sh.find(o=>o.id.endsWith('-f2')); ok(f2&&f2.contours[0].nodes.length>=2,'second fill loop built');
 for(const bad of [new Uint8Array([0xD0,0xCF,0x11,0xE0]).buffer, new TextEncoder().encode('hello').buffer]){ try{ await C.importFLA(bad); ok(false,'bad file rejects'); }catch(e){ ok(['legacy','notzip'].includes(e.message),'bad file rejects: '+e.message); } }

 // ---- nested animation, gradient, text, script
 {
  const z2=new JSZip();
  z2.file('DOMDocument.xml',`<DOMDocument xmlns="http://ns.adobe.com/xfl/2008/" width="200" height="100" frameRate="12"><timelines><DOMTimeline name="Scene 1"><layers><DOMLayer name="mc"><frames><DOMFrame index="0" duration="6"><Actionscript><script><![CDATA[stop();]]></script></Actionscript><elements>
   <DOMSymbolInstance libraryItemName="Mover" symbolType="movie clip"><matrix><Matrix tx="10" ty="10"/></matrix></DOMSymbolInstance>
   <DOMStaticText width="80" height="20"><matrix><Matrix tx="5" ty="70"/></matrix><textRuns><DOMTextRun><characters>Hello</characters><textAttrs><DOMTextAttrs size="20" face="Arial-BoldMT" fillColor="#FF0000"/></textAttrs></DOMTextRun></textRuns></DOMStaticText>
   <DOMShape><fills><FillStyle index="1"><RadialGradient><matrix><Matrix a="0.03" d="0.03" tx="150" ty="30"/></matrix><GradientEntry color="#FFFFFF" ratio="0"/><GradientEntry color="#0000FF" ratio="1"/></RadialGradient></FillStyle></fills><edges><Edge fillStyle1="1" edges="!2000 400|3000 400|3000 1400|2000 1400|2000 400"/></edges></DOMShape>
  </elements></DOMFrame></frames></DOMLayer></layers></DOMTimeline></timelines></DOMDocument>`);
  z2.file('LIBRARY/Mover.xml',`<DOMSymbolItem xmlns="http://ns.adobe.com/xfl/2008/" name="Mover" symbolType="movie clip"><timeline><DOMTimeline name="Mover"><layers><DOMLayer name="a"><frames>
   <DOMFrame index="0" duration="3" tweenType="motion"><elements><DOMSymbolInstance libraryItemName="Dot" symbolType="graphic"><matrix><Matrix tx="0" ty="0"/></matrix></DOMSymbolInstance></elements></DOMFrame>
   <DOMFrame index="3" duration="3"><elements><DOMSymbolInstance libraryItemName="Dot" symbolType="graphic"><matrix><Matrix tx="60" ty="0"/></matrix></DOMSymbolInstance></elements></DOMFrame>
  </frames></DOMLayer></layers></DOMTimeline></timeline></DOMSymbolItem>`);
  z2.file('LIBRARY/Dot.xml',`<DOMSymbolItem xmlns="http://ns.adobe.com/xfl/2008/" name="Dot" symbolType="graphic"><timeline><DOMTimeline name="Dot"><layers><DOMLayer name="a"><frames><DOMFrame index="0"><elements><DOMShape><fills><FillStyle index="1"><SolidColor color="#00AA00"/></FillStyle></fills><edges><Edge fillStyle1="1" edges="!0 0|400 0|400 400|0 400|0 0"/></edges></DOMShape></elements></DOMFrame></frames></DOMLayer></layers></DOMTimeline></timeline></DOMSymbolItem>`);
  const r2=await C.importFLA(await z2.generateAsync({type:'arraybuffer'}));
  const d2=r2.doc, objs=d2.layers[0].kfs[0].objs;
  ok(Object.keys(d2.lib).sort().join()==='Dot,Mover','lib has nested symbols');
  ok(d2.lib.Mover.frames===6,'Mover has 6 frames');
  const clip=objs.find(o=>o.kind==='clip'); ok(clip&&clip.mc&&clip.mode==='loop','mc clip');
  const txt=objs.find(o=>o.kind==='text'); ok(txt&&txt.runs[0].b&&txt.runs[0].font==='Arial'&&txt.runs[0].c==='#FF0000'&&txt.runs[0].t==='Hello','text imported');
  const gp=objs.find(o=>o.kind==='path'); ok(gp&&gp.grad&&gp.grad.type==='radial'&&gp.grad.stops.length===2,'gradient kept');
  ok(r2.report.scripts===1&&r2.report.animatedSyms.includes('Mover'),'script counted, animated symbol reported');
  const at=(f)=>{ const e=C.evalDoc(d2,f)[0].objs.find(o=>o.kind==='clip'); return e; };
  C.setLib(d2.lib);
  const k0=C.kidsOf(at(0)), k4=C.kidsOf(at(4));
  ok(k0.length===1&&k4.length===1&&Math.abs(k4[0].t.x-k0[0].t.x)>10,'inner animation advances: '+k0[0].t.x+' -> '+k4[0].t.x);
  const k6=C.kidsOf(at(6)); ok(Math.abs(k6[0].t.x-k0[0].t.x)<1e-6,'mc loops');
  const svg=C.frameSVG(d2,4); ok(/radialGradient/.test(svg)&&/<text/.test(svg)&&/Hello/.test(svg),'svg has gradient and text');
  const nd=JSON.parse(JSON.stringify(d2)); C.normalizeDoc(nd); ok(nd.lib.Mover.frames===6,'lib survives JSON round trip');
 }
 console.log(fails?('FAILURES '+fails):'ALL PASS');
})();
{ // bezier easing
  const be=C.bezierEase;
  let ok1=true; for(let i=0;i<=10;i++){const t=i/10; if(Math.abs(be(t,0,0,1,1)-t)>1e-4) ok1=false;}
  ok(ok1,'bezier linear identity');
  ok(be(0.5,0.42,0,1,1)<0.5 && be(0.5,0,0,0.58,1)>0.5 && be(0,0.3,0.2,0.7,0.9)===0 && be(1,0.3,0.2,0.7,0.9)===1,'bezier in/out sides');
  let mx=0; for(let i=0;i<=100;i++) mx=Math.max(mx,be(i/100,0.175,0.885,0.32,1.275));
  ok(mx>1.05,'bezier back overshoot '+mx.toFixed(3));
  ok(Math.abs(C.ease('bezier',50,0.5,[0,0,1,1])-0.5)<1e-4,'bezier via ease()');
}
