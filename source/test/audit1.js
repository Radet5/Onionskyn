const {start}=require('./audit_lib');
(async()=>{const T=await start();const p=T.page;
await T.step('new doc',()=>T.newDoc());
const nObjs=()=>T.st(()=>{const F=window.__FC;return F.S.doc.layers.map(l=>l.kfs.map(k=>k.objs.length).join('/')).join('|')});
for(const [tool,key] of [['rect','r'],['ellipse','o'],['line','l']]){
 await T.undoable('draw '+tool,async()=>{await p.keyboard.press(key);await T.drag(100,80,220,160);return nObjs();});}
await T.undoable('shift-square',async()=>{await p.keyboard.press('r');await T.drag(300,100,380,150,['Shift']);return nObjs();});
await T.undoable('alt-centre',async()=>{await T.drag(450,100,500,140,['Alt']);return nObjs();});
await T.undoable('pencil',async()=>{await p.keyboard.press('y');await T.drag(100,200,250,260);return nObjs();});
await T.undoable('brush',async()=>{await p.keyboard.press('b');await T.drag(300,200,450,280);return nObjs();});
await T.undoable('pen closed',async()=>{await p.keyboard.press('p');for(const [x,y] of [[500,200],[580,200],[580,280]])await T.click(x,y);await T.dbl(500,280);return nObjs();});
await T.undoable('pen curve+Enter',async()=>{await p.keyboard.press('p');await T.drag(50,300,80,330);await T.click(150,340);await p.keyboard.press('Enter');return nObjs();});
await T.step('pen Esc cancel',async()=>{await p.keyboard.press('p');await T.click(400,320);await p.keyboard.press('Escape');return nObjs();});
await T.undoable('text',async()=>{await p.keyboard.press('t');await T.click(250,320);await p.keyboard.type('Hello');await p.keyboard.press('Escape');return nObjs();});
await T.step('select all + props',async()=>{await p.keyboard.press('v');await p.keyboard.press('Control+a');return T.st(()=>window.__FC.S.sel.length);});
await T.undoable('fill color via props',async()=>{await p.evaluate(()=>window.__FC.setTab('obj'));await p.locator('#fillC').evaluate(e=>{e.value='#ff0000';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))});});
for(const v of ['linear','radial','solid'])await T.undoable('fill type '+v,()=>p.selectOption('#fillType',v));
await T.undoable('stroke on',()=>p.locator('#strokeOn').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}));
await T.undoable('stroke width',async()=>{await p.fill('#sw','8');await p.keyboard.press('Enter');});
await T.undoable('stroke cap',()=>p.selectOption('#cap','square'));
await T.undoable('stroke join',()=>p.selectOption('#join','bevel'));
await T.undoable('opacity',async()=>{await p.locator('#opac').evaluate(e=>{e.value=40;e.dispatchEvent(new Event('input',{bubbles:true}))});});
await T.step('select one object',async()=>{await p.locator('body').click({position:{x:5,y:5}});await p.keyboard.press('Escape');await T.click(300,40);await T.st(()=>{const F=window.__FC;const l=F.S.doc.layers[0];F.S.sel=[{lid:l.id,id:l.kfs[0].objs[0].id}];F.refreshProps();});});
for(const [id,v] of [['tx','50'],['ty','60'],['tw','90'],['th','70'],['tr','30']])await T.undoable('field '+id,async()=>{await p.fill('#'+id,v);await p.keyboard.press('Enter');});
for(const [id,v] of [['tw','0'],['th','-5'],['tw','abc'],['tx','']])await T.undoable('garbage field '+id+'='+JSON.stringify(v),async()=>{await p.fill('#'+id,v).catch(()=>{});await p.keyboard.press('Enter');},{mayNoop:true});
await T.undoable('group',async()=>{await p.keyboard.press('Control+a');await p.keyboard.press('Control+g');return nObjs();});
await T.undoable('ungroup',async()=>{await p.keyboard.press('Control+Shift+g');return nObjs();});
await T.undoable('duplicate',async()=>{await p.keyboard.press('Control+a');await p.keyboard.press('Control+d');return nObjs();});
await T.step('copy',()=>p.keyboard.press('Control+c'));
await T.undoable('paste',async()=>{await p.keyboard.press('Control+v');return nObjs();});
await T.undoable('cut',async()=>{await p.keyboard.press('Control+x');return nObjs();});
await T.undoable('paste again',async()=>{await p.keyboard.press('Control+v');return nObjs();});
// the pasted Objects are on top, so send them down before bringing them up
for(const k of ['Control+[','Control+Shift+[','Control+]','Control+Shift+]'])await T.undoable('arrange '+k,()=>p.keyboard.press(k));
for(const k of ['ArrowLeft','ArrowUp','Shift+ArrowRight','Shift+ArrowDown'])await T.undoable('nudge '+k,()=>p.keyboard.press(k));
await T.undoable('delete',async()=>{await p.keyboard.press('Delete');return nObjs();});
await T.step('undo x10 / redo x10',async()=>{for(let i=0;i<10;i++)await p.keyboard.press('Control+z');for(let i=0;i<10;i++)await p.keyboard.press('Control+y');return nObjs();});
// a fresh rectangle Path for the Paint bucket and Node edit Tools to work on
await T.undoable('draw target rect',async()=>{await p.keyboard.press('r');await T.drag(600,300,700,380);return nObjs();});
await T.undoable('bucket',async()=>{await T.st(()=>window.__FC.S.style.fill='#00ff00');await p.keyboard.press('k');await T.click(650,340);});
await T.step('bucket on empty stage',()=>T.click(10,10));
await T.step('dropper',async()=>{await p.keyboard.press('i');await T.click(160,120);await T.click(10,10);});
await T.step('node tool select',async()=>{await p.keyboard.press('a');await T.click(600,340);return T.st(()=>window.__FC.S.sel.length);});
await T.undoable('node tool drag node',()=>T.drag(600,300,620,280));
await T.undoable('node tool delete',()=>p.keyboard.press('Delete'));
await T.step('hand+zoom+fit',async()=>{await p.keyboard.press('h');await T.drag(200,200,250,250);for(const k of ['+','-','!'])await p.keyboard.press(k);await p.click('#zIn');await p.click('#zOut');});
await T.undoable('Convert F8 (all)',async()=>{await p.keyboard.press('v');await p.keyboard.press('Control+a');await p.keyboard.press('F8');return T.st(()=>Object.keys(window.__FC.S.doc.lib));});
await T.finish();})();
