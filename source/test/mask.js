const {start}=require('./audit_lib');
const SP=require('os').tmpdir();
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;
const build=()=>page.evaluate(()=>{const F=window.__FC,C=F.C;
 const doc=C.mkDoc();doc.w=200;doc.h=200;doc.bg='#ffffff';doc.frames=1;
 const mk=(name,objs)=>{const l=C.mkLayer(name);l.kfs[0].objs=objs;return l;};
 const rect=C.mkPath([C.rectContour(200,200,0)],{fill:'#ff0000',stroke:null},{x:100,y:100});
 const circ=C.mkPath([C.ellipseContour(40,40)],{fill:'#000000',stroke:null},{x:100,y:100});
 const below=mk('below',[rect]);below.masked=true;const mask=mk('mask',[circ]);mask.mask=true;
 doc.layers=[below,mask];
 // symbol containing the same mask structure, placed on a second doc layer is tested separately
 F.loadDoc(doc);return true;});
await build();
const px=(x,y)=>page.evaluate(([x,y])=>{const F=window.__FC,C=F.C,S=F.S;const cv=document.createElement('canvas');cv.width=200;cv.height=200;const c=cv.getContext('2d');c.fillStyle=S.doc.bg;c.fillRect(0,0,200,200);C.drawUnits(c,C.evalDoc(S.doc,0),{});return Array.from(c.getImageData(x,y,1,1).data).join(',');},[x,y]);
console.log('inside circle',await px(100,100),'| outside',await px(10,10));
console.log('svg has mask',await page.evaluate(()=>{const s=window.__FC.C.frameSVG(window.__FC.S.doc,0);return s.includes('<mask')&&s.includes('mask-type:alpha')}));
// runtime in exported player
const html=await page.evaluate(()=>window.__FC.buildPlayer({controls:false}).html);
const p2=T.watch(await T.ctx.newPage());await p2.setContent(html);await p2.waitForFunction(()=>!!window.__rt);
console.log('player',await p2.evaluate(()=>{const cv=document.getElementById('cv'),c=cv.getContext('2d'),d=cv.width/200;const a=c.getImageData(100*d,100*d,1,1).data,o=c.getImageData(10*d,10*d,1,1).data;return Array.from(a).join(',')+' | '+Array.from(o).join(',')}));
// symbol with mask inside, placed as clip
await page.evaluate(()=>{const F=window.__FC,C=F.C,S=F.S;const sym={frames:1,layers:JSON.parse(JSON.stringify(S.doc.layers))};const d2=C.mkDoc();d2.w=200;d2.h=200;d2.bg='#fff';d2.frames=1;d2.lib={Sym:sym};
 const clip={id:'c1',kind:'clip',sym:'Sym',mc:true,mode:'loop',first:0,pv:[0,0],op:1,t:{x:0,y:0,sx:1,sy:1,r:0}};d2.layers[0].kfs[0].objs=[clip];F.loadDoc(d2);});
console.log('symbol inside',await px(100,100),'| outside',await px(10,10));
// UI toggle
await page.evaluate(()=>{const F=window.__FC,C=F.C;const d=C.mkDoc();d.layers=[C.mkLayer('A'),C.mkLayer('B'),C.mkLayer('C')];F.loadDoc(d);F.S.layerId=d.layers[2].id;});
await page.click('#lMask');
console.log('after mask on C',await page.evaluate(()=>window.__FC.S.doc.layers.map(l=>l.name+':'+(l.mask?'M':'')+(l.masked?'m':'')).join(' ')));
await page.evaluate(()=>{const F=window.__FC;F.S.layerId=F.S.doc.layers[0].id;});await page.click('#lMask');
console.log('A below masked layer joins',await page.evaluate(()=>window.__FC.S.doc.layers.map(l=>l.name+':'+(l.mask?'M':'')+(l.masked?'m':'')).join(' ')));
await page.click('#lMask');console.log('toggle off A',await page.evaluate(()=>window.__FC.S.doc.layers.map(l=>l.name+':'+(l.mask?'M':'')+(l.masked?'m':'')).join(' ')));
await T.finish();})();
