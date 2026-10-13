const {start}=require('./audit_lib');
// Each brush outline is compared with a reference drawn by stamping the same nib densely along the stroke.
// LIMIT is the largest share of differing pixels allowed per nib shape: the worst case measured over the four strokes, plus 1.5 points.
// Measured: round 3.71, square 1.10, diamond 3.03, ovalh 5.17, ovalv 5.66, flat 3.96 (resampling and simplifying the stroke cause the gap).
const LIMIT={round:5.2,square:2.6,diamond:4.5,ovalh:6.7,ovalv:7.2,flat:5.5};
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;
const res=await page.evaluate(()=>{
 const F=window.__FC;
 const strokes={wiggle:[],loop:[],zig:[]};
 for(let i=0;i<=120;i++){const t=i/120;strokes.wiggle.push({x:40+t*400,y:100+Math.sin(t*9)*50,pr:0.2+0.8*Math.abs(Math.sin(t*5))});}
 for(let i=0;i<=140;i++){const t=i/140*Math.PI*2.3;strokes.loop.push({x:300+Math.cos(t)*(60+t*6),y:300+Math.sin(t)*(60+t*6),pr:1});}
 for(let i=0;i<=8;i++)strokes.zig.push({x:60+i*40,y:i%2?340:260,pr:1});
 const cv=document.createElement('canvas');cv.width=520;cv.height=420;document.body.appendChild(cv);const x=cv.getContext('2d',{willReadFrequently:true});
 // reference nib vertices for each shape, matching nibOf in src/app2.js at angle 0 (22 points per ellipse at size 26)
 const ell=(rx,ry)=>Array.from({length:22},(_,i)=>{const a=i/22*Math.PI*2;return[Math.cos(a)*rx,Math.sin(a)*ry];});
 const NIB={round:ell(1,1),square:[[-1,-1],[1,-1],[1,1],[-1,1]],diamond:[[0,-1.3],[1.3,0],[0,1.3],[-1.3,0]],ovalh:ell(1,.42),ovalv:ell(.42,1),flat:ell(1.2,.17)};
 const result={};
 for(const shape of Object.keys(NIB)) for(const [nm,pts] of Object.entries(strokes)) for(const bpress of [false,true]){
  if(bpress&&nm!=='wiggle')continue;
  const st={bsize:26,bshape:shape,bpress,smooth:0};
  const cs=F.brushOutline(pts,st,1);
  x.clearRect(0,0,520,420);x.fillStyle='#000';x.beginPath();
  for(const c of cs){c.nodes.forEach((n,i)=>i?x.lineTo(n.x,n.y):x.moveTo(n.x,n.y));x.closePath();}
  x.fill('nonzero');const A=x.getImageData(0,0,520,420).data.slice();
  x.clearRect(0,0,520,420);
  const K=NIB[shape],base=13;
  const stamp=(p)=>{const s=bpress?0.15+0.85*p.pr:1;x.beginPath();K.forEach((v,i)=>{const px=p.x+v[0]*base*s,py=p.y+v[1]*base*s;i?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();x.fill();};
  for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(L/0.5));for(let k=0;k<=n;k++){const t=k/n;stamp({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,pr:a.pr+(b.pr-a.pr)*t});}}
  const B=x.getImageData(0,0,520,420).data;let diff=0,tot=0;for(let i=3;i<A.length;i+=4){const a=A[i]>127,b2=B[i]>127;if(a||b2)tot++;if(a!==b2)diff++;}
  result[shape+'/'+nm+(bpress?'/press':'')]=+(diff/tot*100).toFixed(2);
 }
 cv.remove();return result;});
for(const [k,v] of Object.entries(res)){const lim=LIMIT[k.split('/')[0]];T.ok(v<=lim,k+' differs from the stamped reference by '+v+'% (limit '+lim+'%)');}
T.ok(Object.keys(res).length===6*4,'checked 6 shapes x 4 strokes, the wiggle with and without pressure ('+Object.keys(res).length+')');
await T.finish();})();
