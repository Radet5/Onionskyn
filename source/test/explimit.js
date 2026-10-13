const {start}=require('./audit_lib');
(async()=>{const T=await start();const p=T.page;const ok=T.ok;
await T.st(()=>{const F=window.__FC;F.loadDoc(F.buildSample());});
await p.evaluate(()=>window.__FC.openExport('img'));
await p.fill('#xp','1600').catch(async()=>{});await p.keyboard.press('Tab');await p.waitForTimeout(100);
console.log('info',await T.st(()=>document.getElementById('xInfo').textContent));
await p.locator('#mFoot').getByRole('button',{name:'Export'}).click();await p.waitForTimeout(500);
ok(await T.st(()=>document.getElementById('mTitle').textContent==='Export is too large'),'too-large refused: '+await T.st(()=>document.getElementById('mTitle').textContent));
await T.finish();})();
