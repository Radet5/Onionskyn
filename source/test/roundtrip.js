// Project file save/load round-trip: the rich fixture Document survives Ctrl+S and reopening, and the golden v2 Project file still opens to it.
const {start}=require('./audit_lib');const {diffDocs}=require('./doc_compare');const fs=require('fs');const path=require('path');
(async()=>{const T=await start();const page=T.page;const ok=T.ok;
// the comparison itself
ok(diffDocs({a:1,b:[1,{c:'x'}]},{a:1,b:[1,{c:'x'}]})===null,'equal Documents compare equal');
ok(diffDocs({a:1,b:[1,{c:'x'}]},{a:1,b:[1,{c:'y'}]})==='b[1].c: "x" vs "y"','a changed value is named by its path');
ok(diffDocs({k:{f:0,ease:{type:'in'}}},{k:{f:0}})==='k.ease: missing on the right','a dropped field is named');
ok(diffDocs({k:{f:0}},{k:{f:0,extra:1}})==='k.extra: missing on the left','an added field is named');
ok(diffDocs({l:[1,2]},{l:[1]})==='l: length 2 vs 1','a dropped array entry is named');
ok(diffDocs({a:{x:1},b:2},{a:{x:2},b:3})==='a.x: 1 vs 2','only the first difference is named');
ok(diffDocs({a:null},{a:{}})==='a: null vs object','null and objects differ');
ok(diffDocs({a:[]},{a:{}})==='a: array vs object','arrays and objects differ');
ok(diffDocs({a:undefined,b:1},{b:1})===null,'an undefined field equals a missing one, as in JSON');
ok(diffDocs({saved:'x',doc:{w:1}},{saved:'y',doc:{w:1}},{ignore:['saved']})===null,'ignored paths are skipped');
ok(diffDocs({doc:{saved:'x'}},{doc:{saved:'y'}},{ignore:['saved']})==='doc.saved: "x" vs "y"','ignore matches the whole path, not a key anywhere');
// the fixture is already normalised, so loading it changes nothing
const {richDoc}=require('./fixture_doc');
ok(diffDocs(richDoc(),richDoc())===null,'the fixture is the same on every call');
const GOLDEN=path.join(__dirname,'fixtures/rich-v2.onionskyn.json');
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'roundtrip-'));
const docNow=()=>T.st(()=>JSON.parse(JSON.stringify(window.__FC.S.doc)));
// opens a file through the file input and waits until the Document named `name` is loaded
const open=async(file,name)=>{await T.st(()=>window.__FC.loadDoc(window.__FC.C.mkDoc()));await page.setInputFiles('#fileIn',file);
 return page.waitForFunction((n)=>window.__FC.S.doc.name===n,name).then(()=>true,()=>false);};
const same=(a,b,what)=>{const d=diffDocs(a,b);T.ok(d===null,what+(d?' — first difference: '+d:''));};
T.ok(diffDocs(richDoc(),await T.st((d)=>window.__FC.C.normalizeDoc(d),richDoc()))===null,'normalizeDoc leaves the fixture unchanged');
// open the fixture as a Project file
const src=path.join(TMP,'fixture.onionskyn.json');fs.writeFileSync(src,JSON.stringify({app:'Onionskyn',version:2,doc:richDoc()}));
T.ok(await open(src,'Rich fixture'),'the fixture opens');
same(richDoc(),await docNow(),'the opened Document equals the fixture');
// save with Ctrl+S and open the download again
const [dl]=await Promise.all([page.waitForEvent('download'),page.keyboard.press('Control+s')]);
const saved=path.join(TMP,'saved.onionskyn.json');await dl.saveAs(saved);
const j=JSON.parse(fs.readFileSync(saved,'utf8'));
T.ok(j.app==='Onionskyn'&&Number.isInteger(j.version)&&j.version>=2,'saved as a Project file (format version '+j.version+')');
same(richDoc(),j.doc,'the saved file holds the fixture');
T.ok(await open(saved,'Rich fixture'),'the saved file opens');
same(richDoc(),await docNow(),'save → reopen gives a Document equal to the fixture');
// the golden v2 Project file, saved by the app once; never regenerate it for a format the app still reads
if(process.env.WRITE_GOLDEN&&!fs.existsSync(GOLDEN)){fs.copyFileSync(saved,GOLDEN);console.log('wrote',GOLDEN);}
if(T.ok(fs.existsSync(GOLDEN),'the golden v2 Project file exists (run once with WRITE_GOLDEN=1 to create it)')){
 const g=JSON.parse(fs.readFileSync(GOLDEN,'utf8'));
 // the whole file, so a renamed or dropped envelope field shows too; only when it was saved and by which release may differ
 const d=diffDocs({app:'Onionskyn',version:2,doc:richDoc()},g,{ignore:['saved','appVersion']});
 T.ok(d===null,'the golden file is a v2 Project file holding the fixture'+(d?' — first difference: '+d:''));
 T.ok(await open(GOLDEN,'Rich fixture'),'the golden file opens');
 same(richDoc(),await docNow(),'the golden file opens to a Document equal to the fixture');}
fs.rmSync(TMP,{recursive:true,force:true});
await T.finish();})();
