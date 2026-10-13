// The rich fixture Document, for any suite to use: every Object kind, both Tween types with non-linear Eases (one bezier), a Mask layer with
// Masked layers, nested Symbols used as a Movie clip and as a Graphic, a Sound on a Keyframe, frame labels and Keyframe scripts.
// richDoc() returns a fresh copy each call. Ids are fixed so a saved copy can be compared to it; it is already normalised (normalizeDoc changes nothing).
const fs=require('fs');const path=require('path');
const FX=path.join(__dirname,'fixtures');
const b64=(f)=>fs.readFileSync(path.join(FX,f)).toString('base64');
const xf=(x,y,sx=1,sy=1,r=0)=>({x,y,sx,sy,r});
const nd=(x,y,ix=0,iy=0,ox=0,oy=0)=>({x,y,ix,iy,ox,oy});
const rect=(w,h)=>({closed:true,nodes:[nd(-w/2,-h/2),nd(w/2,-h/2),nd(w/2,h/2),nd(-w/2,h/2)]});
const blob=(r)=>{const k=r*0.5523;return {closed:true,nodes:[{...nd(0,-r,-k,0,k,0),s:true},{...nd(r,0,0,-k,0,k),s:true},{...nd(0,r,k,0,-k,0),s:true},{...nd(-r,0,0,k,0,-k),s:true}]};};
const pathObj=(id,contours,t,st={})=>({id,kind:'path',contours,fill:'#3F5BFF',fa:1,stroke:'#1B2030',sa:0.8,sw:2.5,cap:'round',join:'miter',op:1,t,...st});
const kf=(f,objs,o={})=>({f,objs,tween:'none',ease:{type:'linear',amt:50},...o});
const layer=(id,name,kfs,o={})=>({id,name,visible:true,locked:false,kfs,...o});
// the Group tweened on the Masked layer and the Spoke Graphic tweened inside Wheel, at a given opacity and transform
const group=(op,t)=>({id:'g1',kind:'group',children:[pathObj('gp1',[rect(60,40)],xf(-20,0)),{id:'tx2',kind:'text',runs:[{t:'in a group',font:'Georgia',size:14,c:'#112233',b:false,i:true}],align:'left',ls:0,fill:'#112233',fa:1,op:1,t:xf(0,30)}],op,t});
const spokeAt=(op,t)=>({id:'wc1',kind:'clip',sym:'Spoke',mc:false,mode:'once',first:0,pv:[0,0],op,t});
exports.richDoc=function(){
 const png=b64('t.png'),wav=b64('t.wav');
 const spoke={frames:1,layers:[layer('Ls1','Spoke',[kf(0,[pathObj('sp1',[rect(4,30)],xf(0,-15),{fill:'#E04040',stroke:null})])])]};
 const wheel={frames:12,layers:[
  layer('Lw1','Rim',[kf(0,[pathObj('wr1',[blob(30),blob(24)],xf(0,0),{fill:'#202020',fa:0.9})])]),
  layer('Lw2','Spokes',[
   kf(0,[spokeAt(1,xf(0,0))],{tween:'motion',ease:{type:'inout',amt:70},label:'spin'}),
   kf(11,[spokeAt(0.5,xf(0,0,1,1,3.14159))])])]};
 const scene=[
  layer('L1','Backdrop',[
   kf(0,[{id:'im1',kind:'image',img:'t.png',w:200,h:100,op:0.75,t:xf(20,30,0.5,0.5,0.1)}],{sound:{name:'t.wav',sync:'stream',loop:2},label:'intro',script:'this.gotoAndPlay("loop");'})]),
  layer('L2','Masked art',[
   kf(0,[group(0.9,xf(200,150,1.2,1.2,0.2))],{tween:'motion',ease:{type:'bezier',amt:50,p:[0.25,-0.4,0.6,1.35]}}),
   kf(10,[group(0.4,xf(320,180,1,1,-0.3))],{label:'loop'})],{masked:true}),
  layer('L3','Masked shape',[
   kf(0,[pathObj('ms1',[rect(80,80)],xf(240,135),{fill:'#2FBF8A'})],{tween:'shape',ease:{type:'out',amt:80}}),
   kf(16,[pathObj('ms1',[blob(50)],xf(260,140),{fill:'#FF5A4D'})])],{masked:true,locked:true}),
  layer('L4','Mask',[kf(0,[pathObj('mk1',[blob(110)],xf(240,135),{stroke:null})])],{mask:true}),
  layer('L5','Symbols',[
   kf(0,[{id:'c1',kind:'clip',sym:'Wheel',name:'wheel_mc',mc:true,mode:'loop',first:0,pv:[0,0],op:1,t:xf(80,200)},
    {id:'c2',kind:'clip',sym:'Wheel',mc:false,mode:'single',first:4,pv:[5,-5],op:1,t:xf(400,200,0.6,0.6)}],{script:'this.wheel_mc.stop();\n// second line'}),
   kf(20,[],{tween:'none'})]),
  layer('L6','Text',[
   kf(0,[{id:'tx1',kind:'text',name:'title',runs:[{t:'Rich ',font:'Arial',size:24,c:'#000000',b:true,i:false},{t:'fixture',font:'Courier New',size:18,c:'#FF0000',b:false,i:true}],align:'center',ls:1.5,w:220,fill:'#000000',fa:1,op:1,t:xf(240,20)}])],{visible:false})];
 return {name:'Rich fixture',w:480,h:270,fps:30,bg:'#F4F1E8',frames:24,layers:scene,lib:{Spoke:spoke,Wheel:wheel},
  sounds:{'t.wav':{name:'t.wav',mime:'audio/wav',b64:wav,size:8044,ids:['snd_link']}},
  images:{'t.png':{name:'t.png',mime:'image/png',b64:png,w:200,h:100,size:344}}};};
