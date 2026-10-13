const {start}=require('./audit_lib');
(async()=>{const T=await start();const p=T.page;
const objs=()=>T.st(()=>window.__FC.S.doc.layers.map(l=>l.name+':'+l.kfs.map(k=>k.f+(k.tween!=='none'?'~':'')+'['+k.objs.length+']').join(',')).join(' | '));
await T.step('new doc',()=>T.newDoc());
await T.undoable('draw ball',async()=>{await p.keyboard.press('o');await T.drag(80,120,140,180);await p.keyboard.press('v');});
await T.undoable('F6 key at 12',async()=>{await T.st(()=>window.__FC.setFrame(12));await p.keyboard.press('F6');return objs();});
await T.step('select ball',()=>T.click(110,150));
await T.undoable('move ball',()=>p.keyboard.press('Shift+ArrowRight'));
// setup for the Motion tween; one nudge is checked above
await T.step('move ball further',async()=>{for(let i=0;i<20;i++)await p.keyboard.press('Shift+ArrowRight');return objs();});
await T.undoable('motion tween via menu',async()=>{await T.st(()=>{window.__FC.setTab('frame');window.__FC.setFrame(3);});await p.getByRole('button',{name:'Motion',exact:true}).click();return objs();});
await T.step('tween props',()=>T.st(()=>{window.__FC.setTab('frame');window.__FC.setFrame(0)}));
// the new Tween starts linear, so begin with another type
for(const v of ['in','out','inout','linear','bezier'])await T.undoable('ease type '+v,async()=>{await p.selectOption('#easeType',v);return T.st(()=>JSON.stringify(window.__FC.S.doc.layers[0].kfs[0].ease));});
// start on the first handle, which sits at ease (0,0): canvas (22,121) of 260x180
await T.undoable('bezier drag',async()=>{const b=await p.locator('#easeCv').boundingBox();if(b){await p.mouse.move(b.x+b.width*22/260,b.y+b.height*(158-0.6/2.2*136)/180);await p.mouse.down();await p.mouse.move(b.x+b.width*0.5,b.y+b.height*0.2,{steps:3});await p.mouse.up();}});
await T.undoable('F7 blank key at 24',async()=>{await T.st(()=>window.__FC.setFrame(24));await p.keyboard.press('F7');return objs();});
await T.undoable('draw rect at 24',async()=>{await p.keyboard.press('r');await T.drag(300,100,380,180);await p.keyboard.press('v');return objs();});
await T.undoable('F6 key at 30',async()=>{await T.st(()=>window.__FC.setFrame(30));await p.keyboard.press('F6');return objs();});
await T.step('play 1s + stop',async()=>{await p.keyboard.press('Enter');await p.waitForTimeout(800);await p.keyboard.press('Enter');return T.st(()=>window.__FC.S.frame);});
await T.step('frame nav keys',async()=>{for(const k of [',','.','Shift+,','Shift+.']){await p.keyboard.press(k);}});
await T.step('go to the key at 30',()=>T.st(()=>window.__FC.setFrame(30)));
for(const [k,what] of [['F5','insert frame'],['Shift+F6','clear keyframe'],['Shift+F5','remove frame']])await T.undoable(k+' '+what,async()=>{await p.keyboard.press(k);return objs();});
// the new Layer is on top, so it moves down before it moves up
for(const id of ['lAdd','lDup','lDown','lUp','lDel'])await T.undoable('layer button '+id,async()=>{await p.click('#'+id);return objs();});
// the last Layer cannot be deleted, so the later presses change nothing
for(let i=1;i<=6;i++)await T.undoable('delete layer #'+i,async()=>{await p.click('#lDel');return objs();},{mayNoop:true});
await T.undoable('layer mask on',()=>p.click('#lMask'));
await T.undoable('layer mask off',()=>p.click('#lMask'));
for(const b of ['vis','lck'])for(const on of ['off','on'])await T.undoable('layer toggle '+b+' '+on,()=>p.locator('#tlLayers .'+b).first().click());
await T.step('lock/visibility toggles',async()=>{const eyes=p.locator('#tlLayers [aria-label*="isib"], #tlLayers .eye, #tlLayers button');const n=await eyes.count();for(let i=0;i<n;i++)await eyes.nth(i).click().catch(()=>{});return n;});
await T.step('draw on locked/hidden layer',async()=>{await p.keyboard.press('r');await T.drag(100,100,150,150);return T.toast();});
await T.step('onion skin',async()=>{await p.click('#pOnion');await p.click('#pOnion');await T.st(()=>window.__FC.setTab('doc'));await p.locator('#onionOn').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}).catch(()=>{});await p.fill('#onionB','3').catch(()=>{});await p.fill('#onionA','3').catch(()=>{});});
await T.step('doc tab',()=>T.st(()=>window.__FC.setTab('doc')));
for(const [id,v] of [['dname','Test'],['dw','800'],['dh','450'],['dfps','12'],['dframes','100']])await T.undoable('doc prop '+id,async()=>{await p.fill('#'+id,v);await p.keyboard.press('Enter');});
await T.undoable('doc prop dbg',async()=>{await p.locator('#dbg').evaluate(e=>{e.value='#223344';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))});return T.st(()=>{const d=window.__FC.S.doc;return [d.w,d.h,d.fps,d.frames,d.bg]});});
for(const [id,v] of [['dw','0'],['dw','99999'],['dh','-3'],['dfps','0'],['dfps','500'],['dframes','0'],['dframes','100000'],['dframes','5']])
 await T.undoable('doc prop garbage '+id+'='+v,async()=>{await p.fill('#'+id,v);await p.keyboard.press('Enter');return T.st(()=>{const d=window.__FC.S.doc;return [d.w,d.h,d.fps,d.frames]});},{mayNoop:true});
await T.step('shrink frames below last keyframe',async()=>{return objs();});
await T.step('tabs all',async()=>{for(const t of ['obj','text','align','frame','lib','doc'])await T.st((t)=>window.__FC.setTab(t),t).catch(()=>{});await p.evaluate(()=>{for(const t of ['obj','text','align','frame','lib','doc'])document.querySelector('#tab-'+t).click()});});
await T.step('help/theme/report',async()=>{await p.click('#bHelp');await p.keyboard.press('Escape');await p.click('#bTheme');await p.click('#bTheme');await p.click('#mFile');await p.locator('button:has-text("Report a problem")').first().click();await p.keyboard.press('Escape');});
// the code editor commits on every input and each keyup ends the edit gesture, so today one keystroke is one history entry
await T.undoable('code editor open/type/close',async()=>{await p.keyboard.press('F9');await p.keyboard.type('x');await p.keyboard.press('Escape');return objs();});
await T.step('preview open/close',async()=>{await p.click('#bPreview');await p.waitForTimeout(800);await p.click('#prevClose');});
await T.finish();})();
