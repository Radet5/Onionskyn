const {start}=require('./audit_lib');const fs=require('fs');
const SP=require('os').tmpdir();
(async()=>{const T=await start({viewport:{width:1300,height:850}});const page=T.page;
const dot=()=>page.evaluate(()=>document.getElementById('mFile').classList.contains('dirty'));
console.log('dirty at start',await dot());
await page.keyboard.press('r');const box=await page.locator('#stage').boundingBox();await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+200,box.y+180,{steps:4});await page.mouse.up();
console.log('dirty after draw',await dot());
// beforeunload
const dlg=[];page.on('dialog',d=>{dlg.push(d.type());d.dismiss();});
await page.evaluate(()=>{window.__bu=false;});
const prevented=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});console.log('beforeunload prevented',prevented);
const [d]=await Promise.all([page.waitForEvent('download'),page.keyboard.press('Control+s')]);await d.saveAs(require('os').tmpdir()+'/p.json');
await page.waitForTimeout(300);console.log('dirty after save',await dot());
const j=JSON.parse(fs.readFileSync(require('os').tmpdir()+'/p.json','utf8'));console.log('project meta',j.version,j.appVersion,!!j.saved);
// report modal
await page.click('#mFile');await page.getByText('Report a problem').click();await page.waitForTimeout(200);
console.log((await page.inputValue('#rpDiag')).split('\n').slice(0,8).join('\n'));
await page.screenshot({path:SP+'/report.png'});
// newer version warning
j.version=9;fs.writeFileSync(require('os').tmpdir()+'/p9.json',JSON.stringify(j));await page.keyboard.press('Escape');
await page.setInputFiles('#fileIn',require('os').tmpdir()+'/p9.json');await page.waitForTimeout(400);console.log('toasts',await page.evaluate(()=>[...document.querySelectorAll('#toast div')].map(x=>x.textContent)));
await T.finish();})();
