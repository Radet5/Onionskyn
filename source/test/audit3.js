const {start}=require('./audit_lib');const fs=require('fs');
const SP=require('os').tmpdir();
(async()=>{const T=await start();const p=T.page;
const lib=()=>T.st(()=>Object.keys(window.__FC.S.doc.lib).join(',')+' edit='+window.__FC.S.edit.length);
const cnt=()=>T.st(()=>window.__FC.S.doc.layers.map(l=>l.kfs.map(k=>k.objs.map(o=>o.kind[0]).join('')).join('/')).join('|'));
await T.step('new doc',()=>T.newDoc());
await T.undoable('draw',async()=>{await p.keyboard.press('o');await T.drag(80,120,140,180);await p.keyboard.press('v');return cnt();});
await T.undoable('convert',async()=>{await T.click(110,150);await p.click('#objConvert');return lib();});
for(let i=1;i<=3;i++)await T.undoable('place symbol via library #'+i,async()=>{await T.st(()=>window.__FC.setTab('lib'));await p.locator('#libSyms [data-lp]').first().click();return cnt();});
await T.step('enter symbol by dblclick',async()=>{await p.keyboard.press('v');await T.dbl(110,150);return lib();});
await T.undoable('draw inside symbol',async()=>{await p.keyboard.press('r');await T.drag(0,0,40,40);return cnt();});
// a new Symbol has one Frame; F5 lengthens its Timeline (the first F5 is checked, the rest are setup)
await T.undoable('insert frame inside symbol',()=>p.keyboard.press('F5'));
await T.step('insert more frames inside symbol',async()=>{for(let i=0;i<9;i++)await p.keyboard.press('F5');return T.st(()=>window.__FC.S.doc.frames);});
await T.undoable('keyframe inside symbol',async()=>{await T.st(()=>window.__FC.setFrame(10));await p.keyboard.press('F6');});
await T.undoable('motion tween inside symbol',async()=>{await T.st(()=>window.__FC.setFrame(5));await p.getByRole('button',{name:'Motion',exact:true}).click();return T.st(()=>JSON.stringify(window.__FC.S.doc.lib['Symbol 1'].layers[0].kfs.map(k=>[k.f,k.tween])));});
await T.step('undo/redo inside symbol',async()=>{for(let i=0;i<4;i++)await p.keyboard.press('Control+z');for(let i=0;i<4;i++)await p.keyboard.press('Control+y');return lib();});
await T.step('select all inside symbol',async()=>{await p.keyboard.press('Control+a');await p.keyboard.press('v');});
await T.undoable('convert nested symbol inside symbol',async()=>{await p.keyboard.press('F8');return lib();});
await T.step('exit via Esc/back',async()=>{await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.keyboard.press('Escape');if(await T.st(()=>window.__FC.S.edit.length))await p.click('#crumbBack');return lib();});
await T.step('instance props mode/first',async()=>{await T.st(()=>window.__FC.setTab('obj'));await T.click(110,150);const ids=await p.evaluate(()=>[...document.querySelectorAll('#pane-obj select, #pane-obj input')].map(e=>e.id).filter(Boolean));return ids.join(' ').slice(0,200);});
await T.step('copy symbol instance',()=>p.keyboard.press('Control+c'));
await T.undoable('add layer',()=>p.click('#lAdd'));
await T.undoable('paste on new layer',async()=>{await p.keyboard.press('Control+v');return cnt();});
await T.step('delete symbol from library (in use)',async()=>{await T.st(()=>window.__FC.setTab('lib'));return lib();});
await T.undoable('mask: add layer',()=>p.click('#lAdd'));
await T.undoable('mask: draw',async()=>{await p.keyboard.press('o');await T.drag(60,100,200,200);await p.keyboard.press('v');});
await T.undoable('mask: make mask layer',async()=>{await p.click('#lMask');return T.st(()=>JSON.stringify(window.__FC.S.doc.layers.map(l=>[l.name,!!l.mask,!!l.masked])));});
await T.step('mask undo/redo',async()=>{await p.keyboard.press('Control+z');await p.keyboard.press('Control+y');return T.st(()=>JSON.stringify(window.__FC.S.doc.layers.map(l=>[!!l.mask,!!l.masked])));});
// Images and Sounds are kept out of history, so these checks compare the rest of the Document
await T.undoable('image import',async()=>{const n=await T.st(()=>window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).length);await p.setInputFiles('#imgIn',[__dirname+'/fixtures/t.png']);
 await p.waitForFunction((n)=>window.__FC.S.doc.layers.flatMap(l=>l.kfs.flatMap(k=>k.objs)).length>n,n);return cnt();});
// Convert works within one layer, so select just the Image
await T.step('image: select it',async()=>{await p.keyboard.press('v');await T.st(()=>{const F=window.__FC;for(const l of F.S.doc.layers){const o=l.kfs[0].objs.find(o=>o.kind==='image');if(o){F.S.sel=[{lid:l.id,id:o.id}];F.S.layerId=l.id;F.refreshProps();}}});return T.st(()=>window.__FC.S.sel.length);});
await T.undoable('image: convert to symbol',async()=>{await p.click('#objConvert');return lib();});
// Sounds are kept out of history, so adding one is not undoable
await T.step('sound add',async()=>{await p.setInputFiles('#sndIn',[__dirname+'/fixtures/t.wav']);await p.waitForFunction(()=>Object.keys(window.__FC.S.doc.sounds).length>0);});
await T.undoable('sound assign',async()=>{await T.st(()=>{window.__FC.setTab('frame');window.__FC.setFrame(0);});await p.waitForFunction(()=>document.querySelector('#kfSound').options.length>1);await p.selectOption('#kfSound',{index:1});return T.st(()=>JSON.stringify(window.__FC.S.doc.layers.map(l=>l.kfs[0].sound||null)));});
await T.step('save project download',async()=>{const [dl]=await Promise.all([p.waitForEvent('download',{timeout:4000}),p.keyboard.press('Control+s')]);await dl.saveAs(SP+'/audit.onionskyn.json');return dl.suggestedFilename();});
await T.step('open saved project',async()=>{await p.setInputFiles('#fileIn',[SP+'/audit.onionskyn.json']);await p.waitForTimeout(500);return lib()+' '+await cnt();});
// the full Document check is in persist.js; here the media imported through the Library must come back too
await T.step('reload persistence',async()=>{const before=await lib();await p.waitForFunction(()=>(localStorage.getItem('flashcraft.doc.v1')||'').includes('"t.png"'));await p.reload();await p.waitForFunction(()=>!!window.__FC);
 const back=await p.waitForFunction(()=>{const d=window.__FC.S.doc,m=[...Object.values(d.images),...Object.values(d.sounds)];return m.length>=2&&m.every(i=>i.b64);}).then(()=>true,()=>false);
 T.ok(back,'every Image and Sound has its data after reload');T.ok(await lib()===before,'reload keeps the Library ('+before+')');return lib();});
for(const f of ['html','gif','img','seq','vid']){await T.step('export '+f,async()=>{await p.evaluate((f)=>window.__FC.openExport(f),f);await p.waitForTimeout(200);await p.locator('#mFoot').getByRole('button',{name:'Export'}).click();await p.waitForTimeout(2500);const t=await T.st(()=>document.getElementById('mTitle').textContent);await p.keyboard.press('Escape');return t;});}
await T.step('new doc after all',async()=>{await T.newDoc();return lib()+' '+await cnt();});
await T.finish();})();
