// Sparse and malformed Project files: missing fields get their defaults, a bare Document opens, a newer format warns, and anything else is rejected.
const {start}=require('./audit_lib');const fs=require('fs');const path=require('path');
(async()=>{const T=await start();const page=T.page;const ok=T.ok;
// a hand-written Document with one Layer holding the given Keyframes; `drop` lists the Document fields to leave out
const kf=(f,objs=[])=>({f,objs,tween:'none',ease:{type:'linear',amt:50}});
const docWith=(over={},drop=[])=>{const d=Object.assign({name:'Sparse',w:320,h:200,fps:12,bg:'#112233',frames:10,
 layers:[{id:'L1',name:'One',visible:true,locked:false,kfs:[kf(0)]}],lib:{},sounds:{},images:{}},over);
 for(const k of drop)delete d[k];return d;};
const norm=(d)=>T.st((d)=>window.__FC.C.normalizeDoc(d),d);
// --- default-filling in Core
for(const [field,want] of [['fps',24],['bg','#FFFFFF'],['w',640],['h',360],['lib',{}],['sounds',{}],['images',{}]]){
 const got=(await norm(docWith({},[field])))[field];
 ok(JSON.stringify(got)===JSON.stringify(want),'missing '+field+' defaults to '+JSON.stringify(want)+' (got '+JSON.stringify(got)+')');}
const kfs=(frames)=>frames.map((f)=>kf(f,[{id:'o'+f,kind:'path',contours:[],t:{x:0,y:0,sx:1,sy:1,r:0}}]));
const layerWith=(k)=>docWith({layers:[{id:'L1',name:'One',kfs:k}]});
{const l=(await norm(layerWith(kfs([6,0,3])))).layers[0];
 ok(l.kfs.map((k)=>k.f).join()==='0,3,6'&&l.kfs.map((k)=>k.objs[0].id).join()==='o0,o3,o6','Keyframes out of order are sorted, each keeping its content ('+l.kfs.map((k)=>k.f)+')');}
{const l=(await norm(layerWith(kfs([4,8])))).layers[0];
 ok(l.kfs.map((k)=>k.f).join()==='0,4,8'&&l.kfs[0].objs.length===0&&l.kfs[1].objs[0].id==='o4','a Layer whose first Keyframe is not at Frame 1 gets an empty one there ('+l.kfs.map((k)=>k.f)+')');}
{const l=(await norm(layerWith([]))).layers[0];
 ok(l.kfs.length===1&&l.kfs[0].f===0&&l.kfs[0].objs.length===0,'a Layer with an empty Keyframe list gets one Keyframe at Frame 1');}
{const d=docWith();delete d.layers[0].kfs;const l=(await norm(d)).layers[0];
 ok(l.kfs.length===1&&l.kfs[0].f===0,'a Layer with no Keyframe list gets one Keyframe at Frame 1');}
{const d=await norm(docWith({frames:5000}));ok(d.frames===900,'frames above the 900 maximum are clamped to 900 (got '+d.frames+')');}
{const d=await norm(docWith({frames:10,layers:[{id:'L1',name:'One',kfs:kfs([0,2000])}]}));ok(d.frames===900,'a Keyframe beyond Frame 900 still leaves frames clamped to 900 (got '+d.frames+')');}
// --- opening files through the UI
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'sparse-'));
const write=(name,body)=>{const p=path.join(TMP,name);fs.writeFileSync(p,typeof body==='string'?body:JSON.stringify(body));return p;};
const docNow=()=>T.st(()=>JSON.parse(JSON.stringify(window.__FC.S.doc)));
const toasts=()=>T.st(()=>Array.from(document.querySelectorAll('#toast div'),(d)=>d.textContent));
const clearToasts=()=>T.st(()=>{document.getElementById('toast').innerHTML='';});
// opens a file through the file input and waits for the toast that starts with `msg`
const open=async(file,msg)=>{await clearToasts();await page.setInputFiles('#fileIn',file);
 return page.waitForFunction((m)=>Array.from(document.querySelectorAll('#toast div')).some((d)=>d.textContent.startsWith(m)),msg).then(()=>true,()=>false);};
const NEWER='This project was saved by a newer Onionskyn';
{const opened=await open(write('bare.json',docWith({name:'Bare'},['fps'])),'Opened bare.json');
 const {name,fps,w}=await docNow(),d={name,fps,w};
 ok(opened&&d.name==='Bare'&&d.w===320&&d.fps===24,'a bare Document with no {app, version, doc} wrapper opens, with defaults filled ('+JSON.stringify(d)+')');}
{const opened=await open(write('current.onionskyn.json',{app:'Onionskyn',version:2,doc:docWith({name:'Current'})}),'Opened current.onionskyn.json');
 ok(opened&&!(await toasts()).some((t)=>t.startsWith(NEWER)),'a Project file at the current version opens without the newer-version warning');}
{const opened=await open(write('newer.onionskyn.json',{app:'Onionskyn',version:999,appVersion:'9.0.0',doc:docWith({name:'Newer'})}),'Opened newer.onionskyn.json');
 const ts=await toasts();const {name}=await docNow();
 ok(opened&&name==='Newer'&&ts.some((t)=>t.startsWith(NEWER+' (9.0.0)')),'a Project file with a newer version opens and shows the newer-version warning ('+JSON.stringify(ts)+')');}
// rejected files leave the open Document exactly as it was
const REJECT='That file is not a Onionskyn project or a .fla.';
for(const [name,body,what] of [['plain.txt','hello, not json','plain text'],['other.json',{app:'Something',items:[1,2]},'JSON with no Layers'],['badlayers.json',{app:'Onionskyn',version:2,doc:{layers:'nope'}},'a wrapper whose Layers are not a list']]){
 const before=await docNow();
 const opened=await open(write(name,body),REJECT);const after=await docNow();
 ok(opened&&JSON.stringify(before)===JSON.stringify(after),what+' shows "not a Onionskyn project" and leaves the current Document untouched');}
fs.rmSync(TMP,{recursive:true,force:true});
await T.finish();})();
