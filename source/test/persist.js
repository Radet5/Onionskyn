// Autosave and reload: the rich fixture Document, with its Images and Sounds, comes back from browser storage after a page reload.
const {start}=require('./audit_lib');const {diffDocs}=require('./doc_compare');const {richDoc}=require('./fixture_doc');const fs=require('fs');const path=require('path');
(async()=>{const T=await start();const page=T.page;
const docNow=()=>T.st(()=>JSON.parse(JSON.stringify(window.__FC.S.doc)));
const same=(a,b,what)=>{const d=diffDocs(a,b);T.ok(d===null,what+(d?' — first difference: '+d:''));};
const fx=richDoc();const media={images:Object.keys(fx.images),sounds:Object.keys(fx.sounds)};
// waits until the browser holds the autosaved Document named want.name in localStorage and every named Image and Sound with data in IndexedDB,
// or until timeout ms pass; returns what it last saw
const stored=(want,timeout)=>T.st(async([want,timeout])=>{
 const get=(k)=>new Promise((res)=>{const r=indexedDB.open('flashcraft',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{const q=r.result.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>{res(q.result||{});r.result.close();};q.onerror=()=>res({});};r.onerror=()=>res({});});
 const withData=(o)=>Object.keys(o).filter((n)=>o[n]&&o[n].b64);
 const read=async()=>{let doc=null;try{doc=JSON.parse(localStorage.getItem('flashcraft.doc.v1'));}catch(e){}return {doc,images:withData(await get('images')),sounds:withData(await get('sounds'))};};
 const holds=(s)=>!!s.doc&&s.doc.name===want.name&&want.images.every((n)=>s.images.includes(n))&&want.sounds.every((n)=>s.sounds.includes(n));
 const end=Date.now()+timeout;let s=await read();
 while(!holds(s)&&Date.now()<end){await new Promise((r)=>requestAnimationFrame(r));s=await read();}
 return {...s,holds:holds(s)};},[want,timeout]);
// open the fixture as a Project file
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'persist-'));
const src=path.join(TMP,'fixture.onionskyn.json');fs.writeFileSync(src,JSON.stringify({app:'Onionskyn',version:2,doc:fx}));
await page.setInputFiles('#fileIn',src);
T.ok(await page.waitForFunction((n)=>window.__FC.S.doc.name===n,fx.name).then(()=>true,()=>false),'the fixture opens');
// wait for autosave to write the Document and the media
const s=await stored({name:fx.name,...media},5000);
T.ok(s.holds,'autosave stores the Document and every Image and Sound ('+JSON.stringify({doc:s.doc&&s.doc.name,images:s.images,sounds:s.sounds})+')');
// media live in IndexedDB only, so the autosaved Document stays small
T.ok(!!s.doc&&[...Object.values(s.doc.images||{}),...Object.values(s.doc.sounds||{})].every((m)=>!m.b64),'the autosaved Document holds no media data');
// reload and wait for the Document and its media to be restored
await page.reload();await page.waitForFunction(()=>!!window.__FC);
await page.waitForFunction(()=>{const d=window.__FC.S.doc;return [...Object.values(d.images),...Object.values(d.sounds)].every((m)=>m.b64);}).catch(()=>{});
const d=await docNow();
T.ok(d.name===fx.name,'reload restores the autosaved Document, not the sample');
for(const k of ['images','sounds'])for(const n of media[k])T.ok(!!(d[k][n]&&d[k][n].b64===fx[k][n].b64),k.slice(0,-1)+' '+n+' has its data after reload');
same(fx,d,'reload restores a Document equal to the fixture');
fs.rmSync(TMP,{recursive:true,force:true});
await T.finish();})();
