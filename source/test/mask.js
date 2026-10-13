const {start}=require('./audit_lib');
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;
// a red square filling a 200x200 Document (the player check scales by that width) on a Masked layer, under a Mask layer holding a circle of radius 40 at the centre
const RED='255,0,0,255',BG='255,255,255,255',IN=[100,100],OUT=[10,10];
await page.evaluate(()=>{const F=window.__FC,C=F.C;
 const doc=C.mkDoc();doc.w=200;doc.h=200;doc.bg='#ffffff';doc.frames=1;
 const mk=(name,objs)=>{const l=C.mkLayer(name);l.kfs[0].objs=objs;return l;};
 const rect=C.mkPath([C.rectContour(200,200,0)],{fill:'#ff0000',stroke:null},{x:100,y:100});
 const circ=C.mkPath([C.ellipseContour(40,40)],{fill:'#000000',stroke:null},{x:100,y:100});
 const below=mk('below',[rect]);below.masked=true;const mask=mk('mask',[circ]);mask.mask=true;
 doc.layers=[below,mask];F.loadDoc(doc);
 // the Stage tints Mask layer shapes as an editing aid; hide that so its pixels show only the drawn Frame
 F.S.drawGhostOff=true;});
// reads one Stage canvas pixel at Document coordinates, once a fresh frame has been drawn
const stagePx=async(x,y)=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 return page.evaluate(([x,y])=>{const S=window.__FC.S,cv=document.getElementById('stage'),d=window.devicePixelRatio||1;
  return Array.from(cv.getContext('2d').getImageData(Math.round(d*(S.view.px+x*S.view.z)),Math.round(d*(S.view.py+y*S.view.z)),1,1).data).join(',');},[x,y]);};
const check=async(where,px)=>{const i=await px(IN),o=await px(OUT);
 T.ok(i===RED,where+': inside the mask the Masked layer shows ('+i+')');
 T.ok(o===BG,where+': outside the mask the background shows ('+o+')');};
await check('Stage',(p)=>stagePx(...p));
const svg=await page.evaluate(()=>window.__FC.C.frameSVG(window.__FC.S.doc,0));
T.ok(/<mask[\s>]/.test(svg)&&svg.includes('mask-type:alpha')&&/mask="url\(#/.test(svg),'SVG export defines the mask and applies it');
// the exported HTML5 player
const html=await page.evaluate(()=>window.__FC.buildPlayer({controls:false}).html);
const p2=T.watch(await T.ctx.newPage());await p2.setContent(html);await p2.waitForFunction(()=>!!window.__rt);
const playerPx=([x,y])=>p2.evaluate(([x,y])=>{const cv=document.getElementById('cv'),d=cv.width/200;return Array.from(cv.getContext('2d').getImageData(x*d,y*d,1,1).data).join(',');},[x,y]);
await p2.waitForFunction(()=>{const cv=document.getElementById('cv');return cv.getContext('2d').getImageData(cv.width/2,cv.height/2,1,1).data[3]===255;});
await check('player',playerPx);
await p2.close();
// the same Mask layer inside a Symbol, placed on the Scene as a Movie clip
await page.evaluate(()=>{const F=window.__FC,C=F.C,S=F.S;const sym={frames:1,layers:JSON.parse(JSON.stringify(S.doc.layers))};const d2=C.mkDoc();d2.w=200;d2.h=200;d2.bg='#fff';d2.frames=1;d2.lib={Sym:sym};
 const clip={id:'c1',kind:'clip',sym:'Sym',mc:true,mode:'loop',first:0,pv:[0,0],op:1,t:{x:0,y:0,sx:1,sy:1,r:0}};d2.layers[0].kfs[0].objs=[clip];F.loadDoc(d2);});
await check('Symbol',(p)=>stagePx(...p));
// toggling Mask from the Layer panel; Layers are listed bottom to top
const flags=()=>page.evaluate(()=>window.__FC.S.doc.layers.map(l=>l.name+':'+(l.mask?'M':'')+(l.masked?'m':'')).join(' '));
const toggle=async(i,want,what)=>{await page.evaluate((i)=>{const F=window.__FC;F.S.layerId=F.S.doc.layers[i].id;},i);await page.click('#lMask');const got=await flags();T.ok(got===want,what+': '+got+' (want '+want+')');};
await page.evaluate(()=>{const F=window.__FC,C=F.C;const d=C.mkDoc();d.layers=[C.mkLayer('A'),C.mkLayer('B'),C.mkLayer('C')];F.loadDoc(d);});
await toggle(2,'A: B:m C:M','Mask on C masks the Layer below it');
await toggle(0,'A:m B:m C:M','Mask on A, under a Masked layer, joins the mask');
await toggle(0,'A: B:m C:M','Mask again on A unmasks it');
await toggle(2,'A: B: C:','Mask again on C removes the mask and frees its Masked layers');
await T.finish();})();
