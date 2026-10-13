// Runtime script API: small Documents whose Keyframe scripts call stop(), gotoAndPlay(label), gotoAndStop(frame) and drive a named Movie clip
// from the parent Timeline, run in the exported HTML5 player. Frames here are the API's, counted from 0.
// The player is loaded from a file with requestAnimationFrame stubbed, so its Timelines move only on rt.tick().
const {start}=require('./audit_lib');const fs=require('fs');const path=require('path');
const xf=(x,y)=>({x,y,sx:1,sy:1,r:0});
const nd=(x,y)=>({x,y,ix:0,iy:0,ox:0,oy:0});
let lastId=0;const id=()=>'o'+(++lastId);
const box=()=>({id:id(),kind:'path',contours:[{closed:true,nodes:[nd(-10,-10),nd(10,-10),nd(10,10),nd(-10,10)]}],fill:'#FF0000',fa:1,stroke:null,sa:1,sw:0,cap:'round',join:'round',op:1,t:xf(0,0)});
const kf=(f,objs,o={})=>({f,objs,tween:'none',ease:{type:'linear',amt:50},...o});
const layer=(name,kfs)=>({id:id(),name,visible:true,locked:false,kfs});
const doc=(frames,layers,lib={})=>({name:'Scripts',w:100,h:100,fps:24,bg:'#FFFFFF',frames,layers,lib,sounds:{},images:{}});
// a Layer with a Keyframe at Frame 0 and at each Frame of `kfs` ({frame: {script, label}}), each holding the Objects from `objs()`
const scripted=(name,kfs,objs=()=>[box()])=>layer(name,[...new Set([0,...Object.keys(kfs).map(Number)])].sort((a,b)=>a-b).map((f)=>kf(f,objs(),kfs[f]||{})));
// a 6 Frame Symbol with a label 'spin' on its Frame 3, and a Scene that holds one Movie clip of it named `wheel` and runs `scripts` ({frame: script})
const wheelSym=()=>({frames:6,layers:[layer('W',[kf(0,[box()]),kf(3,[box()],{label:'spin'})])]});
const wheelDoc=(scripts={})=>{const wheel={id:id(),kind:'clip',sym:'Wheel',name:'wheel',mc:true,mode:'loop',first:0,pv:[0,0],op:1,t:xf(50,50)};
 return doc(20,[scripted('Movie clip',Object.fromEntries(Object.entries(scripts).map(([f,script])=>[f,{script}])),()=>[wheel])],{Wheel:wheelSym()});};

(async()=>{const T=await start();
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'scripts-'));let n=0;
// exports Document d as an HTML5 player, then ticks it `ticks` times. Returns the current Frame of the Scene and of each named Movie clip in `clips`
// before the first tick and after each one, the Runtime's own error list, and any page or console error or error thrown out of a tick.
const run=async(d,ticks,clips=[])=>{await T.st((d)=>window.__FC.loadDoc(d),d);
 const html=path.join(TMP,'player'+(++n)+'.html');fs.writeFileSync(html,await T.st(()=>window.__FC.buildPlayer({controls:false,sound:false}).html));
 // not T.watch: a script that throws is reported on the console on purpose, so each case checks its own errors
 const p=await T.ctx.newPage(),seen=[];p.on('pageerror',(e)=>seen.push('PAGEERR '+e.message));p.on('console',(m)=>{if(m.type()==='error')seen.push(m.text());});
 await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;});await p.goto('file://'+html);await p.waitForFunction(()=>!!window.__rt,null,{polling:50});
 const r=await p.evaluate(([ticks,clips])=>{const rt=window.__rt,at=()=>({root:rt.root.currentFrame,...Object.fromEntries(clips.map((c)=>[c,rt.root[c]?rt.root[c].currentFrame:null]))});
  const seq=[at()],thrown=[];for(let i=0;i<ticks;i++){try{rt.tick();}catch(e){thrown.push('TICK-THROW '+e.message);}seq.push(at());}
  return {seq,thrown,errors:rt.errors.slice()};},[ticks,clips]);
 await p.close();return {seq:r.seq,errors:r.errors,seen:[...seen,...r.thrown]};};
const trail=(r,k='root')=>r.seq.map((s)=>s[k]).join(',');
const clean=(r,what)=>T.ok(!r.errors.length&&!r.seen.length,what+': no errors ('+[...r.errors,...r.seen].join('; ')+')');

// stop(): a 10 Frame Scene stops itself on Frame 3 and stays there, where it would otherwise have looped back to Frame 0
{const r=await run(doc(10,[scripted('Script',{3:{script:'this.stop();'}})]),10);
 T.ok(r.seq[3].root===3,'stop(): the Scene reaches Frame 3 ('+trail(r)+')');
 T.ok(r.seq[10].root===3,'stop(): after 10 ticks the Scene is still on Frame 3 ('+trail(r)+')');clean(r,'stop()');}

// gotoAndPlay(label): on Frame 2 the Scene jumps to the label 'loop' on Frame 6, so it never shows Frames 3 to 5, and plays on from there
{const r=await run(doc(10,[scripted('Script',{2:{script:'this.gotoAndPlay("loop");'},6:{label:'loop'}})]),7);
 T.ok(r.seq[2].root===6,'gotoAndPlay(label): the tick that runs the script lands on the labelled Frame 6 ('+trail(r)+')');
 T.ok(!r.seq.some((s)=>s.root>=3&&s.root<=5),'gotoAndPlay(label): Frames 3 to 5 are skipped ('+trail(r)+')');
 T.ok(r.seq.slice(3).some((s)=>s.root===7),'gotoAndPlay(label): the Scene plays on to Frame 7 ('+trail(r)+')');clean(r,'gotoAndPlay(label)');}

// gotoAndStop(frame): on Frame 1 the Scene jumps to Frame 5 and stops there
{const r=await run(doc(10,[scripted('Script',{1:{script:'this.gotoAndStop(5);'}})]),10);
 T.ok(r.seq[1].root===5,'gotoAndStop(frame): the tick that runs the script lands on Frame 5 ('+trail(r)+')');
 T.ok(r.seq[10].root===5,'gotoAndStop(frame): after 10 ticks the Scene is still on Frame 5 ('+trail(r)+')');clean(r,'gotoAndStop(frame)');}

// a named Movie clip controlled from the Scene's scripts. Left alone, the 6 Frame Movie clip plays along with the Scene.
{const r=await run(wheelDoc(),8,['wheel']);
 T.ok(trail(r,'wheel')==='0,1,2,3,4,5,0,1,2','Movie clip left alone: it plays and loops ('+trail(r,'wheel')+')');clean(r,'Movie clip left alone');}
{const r=await run(wheelDoc({0:'this.wheel.stop();'}),8,['wheel']);
 T.ok(r.seq.every((s)=>s.wheel===0),'this.wheel.stop(): the Movie clip stays on its Frame 0 ('+trail(r,'wheel')+')');
 T.ok(r.seq[8].root===8,'this.wheel.stop(): the Scene plays on ('+trail(r)+')');clean(r,'this.wheel.stop()');}
{const r=await run(wheelDoc({0:'this.wheel.gotoAndStop(4);'}),8,['wheel']);
 T.ok(r.seq.every((s)=>s.wheel===4),'this.wheel.gotoAndStop(4): the Movie clip is on its Frame 4 and stays there ('+trail(r,'wheel')+')');clean(r,'this.wheel.gotoAndStop(4)');}
{const r=await run(wheelDoc({0:'this.wheel.gotoAndPlay("spin");'}),3,['wheel']);
 T.ok(r.seq[0].wheel===3,'this.wheel.gotoAndPlay(label): the Movie clip starts on its labelled Frame 3 ('+trail(r,'wheel')+')');
 T.ok(r.seq.slice(1).some((s)=>s.wheel===4),'this.wheel.gotoAndPlay(label): the Movie clip plays on to its Frame 4 ('+trail(r,'wheel')+')');clean(r,'this.wheel.gotoAndPlay(label)');}
// sent mid-play: the Scene's Frame 3 script sends the Movie clip, which has played to its Frame 3, back to its Frame 1
{const r=await run(wheelDoc({3:'this.wheel.gotoAndStop(1);'}),6,['wheel']);
 T.ok(trail(r,'wheel')==='0,1,2,1,1,1,1','this.wheel.gotoAndStop(1) on Scene Frame 3: the Movie clip plays to its Frame 2, then holds its Frame 1 ('+trail(r,'wheel')+')');
 clean(r,'this.wheel.gotoAndStop(1) on Scene Frame 3');}

// a script that throws: the Runtime reports it and plays on. On the Scene's Frame 2 the 'Throws' Layer's script throws before a stop() that
// therefore never runs. Scripts run from the last Layer in the list to the first, so the 'After' Layer's script on the same Frame runs next and
// sends the Scene to Frame 4; it plays on, and the 'After' Layer's stop() on Frame 6 runs too.
{const r=await run(doc(10,[scripted('After',{2:{script:'this.gotoAndPlay(4);'},6:{script:'this.stop();'}}),scripted('Throws',{2:{script:'throw new Error("boom"); this.stop();'}})]),10);
 T.ok(r.seq[2].root===4,'a script that throws: the next script on the same Frame still runs, sending the Scene to Frame 4 ('+trail(r)+')');
 T.ok(r.seq[10].root===6,'a script that throws: the Scene plays on and a later script stops it on Frame 6 ('+trail(r)+')');
 // the Runtime's message counts Frames from 1, so Frame 2 here is its "frame 3"
 T.ok(r.errors.length===1&&/boom/.test(r.errors[0])&&/frame 3\b/.test(r.errors[0]),'a script that throws: the Runtime records one error naming it and its Frame ('+r.errors.join('; ')+')');
 T.ok(r.seen.length===1&&/^Script error.*boom/.test(r.seen[0]),'a script that throws: the player logs it once to the console ('+r.seen.join('; ')+')');}

fs.rmSync(TMP,{recursive:true,force:true});
await T.finish();})();
