// Checks the shared harness itself: each case runs a tiny suite in a child process and checks how it exits.
const {spawnSync}=require('child_process');
const libPath=JSON.stringify(require.resolve('./audit_lib'));
let bad=0;const ok=(c,m)=>{console.log(c?'ok  ':'FAIL',m);if(!c)bad++;};
const run=(body)=>{const r=spawnSync(process.execPath,['-e',`const {start}=require(${libPath});const until=async(c)=>{while(!c())await new Promise(f=>setTimeout(f,10));};(async()=>{const T=await start();const p=T.page;${body}\nawait T.finish();})();`],{encoding:'utf8',timeout:60000});return {code:r.status,out:r.stdout+r.stderr};};
let r=run(`T.ok(await T.st(()=>document.compatMode==='CSS1Compat'&&location.pathname.endsWith('/onionskyn.html')),'standards mode, shipped file');`);
ok(r.code===0,'clean suite on the shipped file exits 0 (exit '+r.code+') '+r.out.trim().split('\n').pop());
r=run(`T.ok(false,'deliberate');`);
ok(r.code===1,'failed check exits 1 (exit '+r.code+')');
r=run(`await p.evaluate(()=>setTimeout(()=>{throw new Error('deliberate page error')}));await until(()=>T.errs.length);`);
ok(r.code===1&&/^PAGEERR deliberate page error/m.test(r.out),'page error exits 1 and is printed (exit '+r.code+')');
r=run(`await p.evaluate(()=>console.error('deliberate console error'));await until(()=>T.errs.length);`);
ok(r.code===1&&/^CONSOLE deliberate console error/m.test(r.out),'console error exits 1 (exit '+r.code+')');
r=run(`const p2=T.watch(await T.ctx.newPage());await p2.setContent('<script>setTimeout(()=>{throw new Error("second page")})</script>');await until(()=>T.errs.length);`);
ok(r.code===1&&/PAGEERR second page/.test(r.out),'errors on a watched second page exit 1 (exit '+r.code+')');
r=run(`throw new Error('suite crashed');`);
ok(r.code!==0,'a crashing suite exits non-zero (exit '+r.code+')');
process.exit(bad?1:0);
