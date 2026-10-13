// Pixel checks: small Documents drawn at a Frame, with specific Stage points required to have specific colours. Unlike `parity`, which compares
// the editor and the exports with each other, these hold rendering to fixed expectations, so a Core bug that breaks every output alike fails here.
// No golden screenshots: points are chosen away from edges, so anti-aliasing and font changes do not move them.
const {start}=require('./audit_lib');const fs=require('fs');const path=require('path');
const RED=[255,0,0],GREEN=[0,255,0],BLUE=[0,0,255],WHITE=[255,255,255],BLACK=[0,0,0],PURPLE=[128,0,128],PINK=[255,128,128];
const xf=(x,y,sx=1,sy=1,r=0)=>({x,y,sx,sy,r});
const nd=(x,y)=>({x,y,ix:0,iy:0,ox:0,oy:0});
const rect=(w,h)=>({closed:true,nodes:[nd(-w/2,-h/2),nd(w/2,-h/2),nd(w/2,h/2),nd(-w/2,h/2)]});
let lastId=0;const id=()=>'o'+(++lastId);
const box=(w,h,fill,t,o={})=>({id:id(),kind:'path',contours:[rect(w,h)],fill,fa:1,stroke:null,sa:1,sw:0,cap:'round',join:'round',op:1,t,...o});
const kf=(f,objs,o={})=>({f,objs,tween:'none',ease:{type:'linear',amt:50},...o});
const layer=(name,kfs,o={})=>({id:id(),name,visible:true,locked:false,kfs,...o});
const clip=(sym,t,o={})=>({id:id(),kind:'clip',sym,mc:false,mode:'loop',first:0,pv:[0,0],op:1,t,...o});
const doc=(layers,o={})=>({name:'Pixels',w:240,h:120,fps:24,bg:'#FFFFFF',frames:10,layers,lib:{},sounds:{},images:{},...o});
// a 3 Frame Symbol: a 30x30 square, red, then green, then blue
const seq=()=>({frames:3,layers:[layer('Seq',[kf(0,[box(30,30,'#FF0000',xf(0,0))]),kf(1,[box(30,30,'#00FF00',xf(0,0))]),kf(2,[box(30,30,'#0000FF',xf(0,0))])])]});
const SEQ=[RED,GREEN,BLUE];

(async()=>{const T=await start();
// draws Document d at Frame f with the editor's renderer and returns the colour at each [x,y]
const colours=(d,f,pts)=>T.st(async([d,f,pts])=>{const F=window.__FC;F.loadDoc(d);await F.C.preloadImages();const c=F.renderFrameCanvas(f,1).getContext('2d');
 return pts.map(([x,y])=>Array.from(c.getImageData(x,y,1,1).data).slice(0,3));},[d,f,pts]);
// the pixels whose colour differs from the background by more than 128 in some channel: how many, and the box holding them
const ink=(d,f)=>T.st(async([d,f])=>{const F=window.__FC;F.loadDoc(d);await F.C.preloadImages();const c=F.renderFrameCanvas(f,1),px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 let n=0,x0=1e9,y0=1e9,x1=-1,y1=-1;for(let i=0;i<px.length;i+=4){if(Math.max(255-px[i],255-px[i+1],255-px[i+2])<=128)continue;const p=i/4,x=p%c.width,y=(p-x)/c.width;n++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 return {n,box:[x0,y0,x1,y1]};},[d,f]);
const near=(got,want,tol)=>got.every((v,i)=>Math.abs(v-want[i])<=tol);
// one named check per point: [name, [x,y], want, tolerance]
const check=async(what,d,f,cases)=>{const got=await colours(d,f,cases.map((c)=>c[1]));
 cases.forEach(([name,pt,want,tol=3],i)=>T.ok(near(got[i],want,tol),what+', Frame '+f+': '+name+' at '+pt+' is '+want+' (got '+got[i]+')'));};

// Motion tween: a 60x6 red bar at (40,60) tweens linearly to a blue bar at (200,60), scaled 2 and turned 45°. Halfway (Frame 5) it is at
// (120,60), scaled 1.5 (90x9) and turned 22.5°, and purple. The points on its axis lie inside only at that scale and angle.
await check('Motion tween',doc([layer('L',[kf(0,[box(60,6,'#FF0000',xf(40,60),{id:'bar'})],{tween:'motion'}),kf(10,[box(60,6,'#0000FF',xf(200,60,2,2,45),{id:'bar'})])])]),5,[
 ['halfway position, halfway colour',[119,59],PURPLE],
 // 37.4 along the 22.5° axis: inside a bar 90 long, outside one 60 long (scale 1), or one at 0° or 45° (14 off its axis)
 ['the bar reaches 37 along its 22.5° axis',[154,74],PURPLE],
 // 51.3 along the axis: outside a bar 90 long, inside one 120 long (scale 2)
 ['the bar ends before 51 along its axis',[167,79],WHITE],
 ['the start position is empty',[40,60],WHITE]]);

// Shape tween: a 40x40 red square morphs into a 120x20 blue rectangle at the same place; halfway (Frame 5) it is an 80x30 purple rectangle
await check('Shape tween',doc([layer('L',[kf(0,[box(40,40,'#FF0000',xf(120,60))],{tween:'shape'}),kf(10,[box(120,20,'#0000FF',xf(120,60))])])]),5,[
 ['wider than the square',[155,60],PURPLE],
 ['narrower than the rectangle',[165,60],WHITE],
 ['taller than the rectangle',[120,73],PURPLE],
 ['shorter than the square',[120,78],WHITE]]);

// Graphic modes: three Graphic instances of the red, green, blue Symbol on a still parent. Loop cycles, play once holds on the last Frame,
// single frame never moves.
const modes=doc([layer('L',[kf(0,[clip('Seq',xf(40,60)),clip('Seq',xf(120,60),{mode:'once'}),clip('Seq',xf(200,60),{mode:'single'})])])],{lib:{Seq:seq()}});
for(let f=0;f<6;f++)await check('Graphic modes',modes,f,[['loop shows Symbol Frame '+(f%3+1),[40,60],SEQ[f%3]],
 ['play once shows Symbol Frame '+(Math.min(f,2)+1),[120,60],SEQ[Math.min(f,2)]],['single frame shows Symbol Frame 1',[200,60],RED]]);

// Movie clip: inside a single frame Graphic, whose own Timeline stands still, a Movie clip of the Symbol plays through it on the root's
// clock; one placed straight on the root plays alongside it
const holder={frames:1,layers:[layer('H',[kf(0,[clip('Seq',xf(0,0),{mc:true})])])]};
const mcDoc=doc([layer('L',[kf(0,[clip('Seq',xf(60,60),{mc:true}),clip('Holder',xf(180,60),{mode:'single'})])])],{lib:{Seq:seq(),Holder:holder}});
for(let f=0;f<6;f++)await check('Movie clip',mcDoc,f,[['on the root, Symbol Frame '+(f%3+1),[60,60],SEQ[f%3]],
 ['in a single frame Graphic, Symbol Frame '+(f%3+1),[180,60],SEQ[f%3]]]);

// the same in the exported player, where the parent Timeline is stopped by a script: the Movie clip keeps playing, the parent's marker
// (red on Frame 1, blue on Frame 2) stays red
{const d=doc([layer('Clip',[kf(0,[clip('Seq',xf(60,60),{mc:true})],{script:'this.stop();'})]),layer('Marker',[kf(0,[box(30,30,'#FF0000',xf(180,60))]),kf(1,[box(30,30,'#0000FF',xf(180,60))])])],{lib:{Seq:seq()}});
 await T.st((d)=>window.__FC.loadDoc(d),d);
 const p2=T.watch(await T.ctx.newPage());await p2.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'pixels-')),html=path.join(TMP,'player.html');
 fs.writeFileSync(html,await T.st(()=>window.__FC.buildPlayer({controls:false,sound:false,loop:false}).html));await p2.goto('file://'+html);
 await p2.waitForFunction(()=>!!window.__rt,null,{polling:50});
 for(let i=0;i<5;i++){const [c,m]=await p2.evaluate((i)=>{const rt=window.__rt;if(i)rt.tick();rt.render();const x=document.getElementById('cv').getContext('2d');
   return [[60,60],[180,60]].map(([px,py])=>Array.from(x.getImageData(px,py,1,1).data).slice(0,3));},i);
  T.ok(near(c,SEQ[i%3],3),'Movie clip in the player, after '+i+' ticks: the clip shows Symbol Frame '+(i%3+1)+' (got '+c+')');
  T.ok(near(m,RED,3),'Movie clip in the player, after '+i+' ticks: the stopped parent still shows its Frame 1 (got '+m+')');}
 await p2.close();fs.rmSync(TMP,{recursive:true,force:true});}

// Group alpha: a Group at 50% holding two overlapping red squares fades as one layer, so the overlap is no darker than either square alone
const grp={id:id(),kind:'group',children:[box(40,40,'#FF0000',xf(-10,0)),box(40,40,'#FF0000',xf(10,0))],op:0.5,t:xf(120,60)};
await check('Group alpha',doc([layer('L',[kf(0,[grp])])]),0,[['left square alone',[95,60],PINK],['the overlap',[120,60],PINK],['right square alone',[145,60],PINK]]);

// Gradients. Linear: red to blue across 160 in the middle of a 200 wide rectangle, so its ends hold the end colours.
// Radial: green to black over a radius of 40 at the centre of a 100x100 square.
// A gradient's matrix maps Core's gradient space, where a linear gradient runs from -819.2 to 819.2 and a radial one has radius 819.2.
const lin={type:'linear',stops:[{o:0,c:'#FF0000',a:1},{o:1,c:'#0000FF',a:1}],m:[160/1638.4,0,0,1,0,0]};
const rad={type:'radial',stops:[{o:0,c:'#00FF00',a:1},{o:1,c:'#000000',a:1}],m:[40/819.2,0,0,40/819.2,0,0]};
await check('Gradients',doc([layer('L',[kf(0,[box(200,40,'#888888',xf(120,30),{grad:lin}),box(100,100,'#888888',xf(120,120),{grad:rad})])])],{h:180}),0,[
 ['linear before its start is red',[25,30],RED],
 ['linear at its start',[40,30],RED,4],
 ['linear a quarter along',[80,30],[191,0,64],5],
 ['linear in the middle',[120,30],PURPLE,5],
 ['linear at its end',[199,30],BLUE,4],
 ['linear past its end is blue',[215,30],BLUE],
 ['radial at the centre is green',[119,119],GREEN,6],
 ['radial halfway out, right',[140,120],[0,128,0],6],
 ['radial halfway out, up',[119,99],[0,128,0],6],
 ['radial past its radius is black',[165,120],BLACK]]);

// Text: 40px black glyphs drawn from the top left of a Text object at (20,20) leave ink only inside the line box (48 high from y 20)
const txt={id:id(),kind:'text',runs:[{t:'MMMM',font:'Arial',size:40,c:'#000000',b:false,i:false}],align:'left',ls:0,fill:'#000000',fa:1,op:1,t:xf(20,20)};
{const r=await ink(doc([layer('L',[kf(0,[txt])])]),0),[x0,y0,x1,y1]=r.box;
 T.ok(r.n>400,'Text: the glyphs leave ink ('+r.n+' pixels)');
 T.ok(x0>=20&&x0<=30,'Text: the ink starts at the left of the text box ('+x0+')');
 T.ok(y0>=20&&y1<68,'Text: the ink lies inside the line box, y 20 to 68 ('+y0+'–'+y1+')');
 T.ok(x1>120&&x1<180,'Text: the ink spans four 40px glyphs, about 130 wide ('+x1+')');}

// Images: the 200x100 fixture (left half red, right half blue) at (40,10), scaled 0.5, covers x 40–140 and y 10–60
const png=fs.readFileSync(path.join(__dirname,'fixtures','t.png')).toString('base64');
const img={id:id(),kind:'image',img:'t.png',w:200,h:100,op:1,t:xf(40,10,0.5,0.5)};
await check('Images',doc([layer('L',[kf(0,[img])])],{images:{'t.png':{name:'t.png',mime:'image/png',b64:png,w:200,h:100,size:fs.statSync(path.join(__dirname,'fixtures','t.png')).size}}}),0,[
 ['the left half is red',[60,35],RED],['the right half is blue',[120,35],BLUE],['right of the image is empty',[150,35],WHITE],['below the image is empty',[60,65],WHITE]]);

await T.finish();})();
