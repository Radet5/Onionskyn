const {start}=require('./audit_lib');
const SP=require('os').tmpdir();
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;
const res=await page.evaluate(()=>{
 const F=window.__FC; const out=[];
 const strokes={wiggle:[],loop:[],zig:[]};
 for(let i=0;i<=120;i++){const t=i/120;strokes.wiggle.push({x:40+t*400,y:100+Math.sin(t*9)*50,pr:0.2+0.8*Math.abs(Math.sin(t*5))});}
 for(let i=0;i<=140;i++){const t=i/140*Math.PI*2.3;strokes.loop.push({x:300+Math.cos(t)*(60+t*6),y:300+Math.sin(t)*(60+t*6),pr:1});}
 for(let i=0;i<=8;i++)strokes.zig.push({x:60+i*40,y:i%2?340:260,pr:1});
 const cv=document.createElement('canvas');cv.width=520;cv.height=420;document.body.appendChild(cv);const x=cv.getContext('2d',{willReadFrequently:true});
 const result={};
 for(const shape of ['round','square','diamond','ovalh','ovalv','flat','ovalh']) for(const [nm,pts] of Object.entries(strokes)){
  for(const bpress of [false,true]){
   if(bpress&&nm!=='wiggle')continue;
   const st={bsize:26,bshape:shape,bpress,smooth:0};
   const cs=F.brushOutline(pts,st,1);
   x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,520,420);x.fillStyle='#000';x.beginPath();
   for(const c of cs){c.nodes.forEach((n,i)=>i?x.lineTo(n.x,n.y):x.moveTo(n.x,n.y));x.closePath();}
   x.fill('nonzero');const A=x.getImageData(0,0,520,420).data.slice();
   // reference: dense stamps of the nib (sample original polyline densely)
   x.clearRect(0,0,520,420);x.fillStyle='#000';
   const base=13,K=nibRef(shape);
   function nibRef(sh){const n=24,ell=(rx,ry,rot)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2,px=Math.cos(a)*rx,py=Math.sin(a)*ry,c=Math.cos(rot),s=Math.sin(rot);return[px*c-py*s,px*s+py*c];});
    return sh==='square'?[[-1,-1],[1,-1],[1,1],[-1,1]]:sh==='diamond'?[[0,-1.3],[1.3,0],[0,1.3],[-1.3,0]]:sh==='ovalh'?ell(1,.42,0):sh==='ovalv'?ell(.42,1,0):sh==='flat'?ell(1.15,.2,-Math.PI/4):sh==='ovalh'?ell(1.15,.2,Math.PI/4):ell(1,1,0);}
   const stamp=(p)=>{const s=bpress?(0.2*0+ (0.15+0.85*p.pr)):1;x.beginPath();K.forEach((v,i)=>{const px=p.x+v[0]*base*s,py=p.y+v[1]*base*s;i?x.lineTo(px,py):x.moveTo(px,py);});x.closePath();x.fill();};
   for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(L/0.5));for(let k=0;k<=n;k++){const t=k/n;stamp({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,pr:a.pr+(b.pr-a.pr)*t});}}
   const B=x.getImageData(0,0,520,420).data;let diff=0,tot=0;for(let i=3;i<A.length;i+=4){const a=A[i]>127,b2=B[i]>127;if(a||b2)tot++;if(a!==b2)diff++;}
   if((shape==='round'&&nm==='loop')||(shape==='diamond'&&nm==='zig')||(shape==='flat'&&nm==='wiggle'&&bpress)){const o=x.createImageData(520,420);for(let i=0;i<A.length;i+=4){const a=A[i+3]>127,b2=B[i+3]>127;const j=i;if(a&&b2){o.data[j]=o.data[j+1]=o.data[j+2]=60;o.data[j+3]=255;}else if(a){o.data[j]=255;o.data[j+3]=255;}else if(b2){o.data[j+2]=255;o.data[j+3]=255;}else{o.data[j]=o.data[j+1]=o.data[j+2]=255;o.data[j+3]=255;}}x.putImageData(o,0,0);(window.__imgs=window.__imgs||[]).push(cv.toDataURL());}
   result[shape+'/'+nm+(bpress?'/press':'')]=+(diff/tot*100).toFixed(2)+'% n='+cs[0].nodes.length;
  }}
 return result;});
const imgs=await page.evaluate(()=>window.__imgs);imgs.forEach((u,i)=>require('fs').writeFileSync(require('os').tmpdir()+'/bd'+i+'.png',Buffer.from(u.split(',')[1],'base64')));await T.finish();})();
