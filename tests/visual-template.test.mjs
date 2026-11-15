import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {doInit,doDocs,archView,buildArchitectureData,placeholderStatus,runCLI} from '../bin/agentrepo.mjs';
const root=t=>{const x=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-visual-'));t.after(()=>fs.rmSync(x,{recursive:true,force:true}));return x;};
const put=(r,f,c)=>{fs.mkdirSync(path.dirname(path.join(r,f)),{recursive:true});fs.writeFileSync(path.join(r,f),c);};
const get=(r,f)=>fs.readFileSync(path.join(r,f),'utf8');

test('complete ready-made docs with review placeholders and self-contained interactive HTML',t=>{
 const r=root(t);doInit(r);const html=get(r,'docs/architecture.html');
 assert.match(html,/Architecture explorer/);assert.match(html,/type="application\/json"/);
 assert.ok(html.includes('const data=JSON.parse'));
 assert.equal(placeholderStatus(r).length,5);
 assert.equal(doDocs(r).ok,true);
 assert.ok(doDocs(r,{strict:true}).issues.some(x=>x.type==='unresolved-placeholder'));
 assert.equal(runCLI(['arch','view','--check'],r).status,'PASS');
});
test('source edit invalidates generated graph; refresh restores and proof checks it',t=>{
 const r=root(t);put(r,'src/auth/signin.js','export const signin=1;');doInit(r);
 assert.equal(archView(r,{check:true}).ok,true);
 put(r,'src/auth/signin.js','export const signin=2;');assert.equal(archView(r,{check:true}).ok,false);
 assert.equal(archView(r,{write:true}).ok,true);
 assert.equal(archView(r,{check:true}).ok,true);
});
test('true file edges from dependency-cruiser JSON, no guessed edges or unresolved paths',t=>{
 const r=root(t);put(r,'src/ui/view.js',"import '../data/model.js'\n");put(r,'src/data/model.js','export default 5;');
 put(r,'src/utils/extra.js','export default 6;');doInit(r);
 assert.equal(buildArchitectureData(r).edges.length,0);
 const dep={modules:[{source:'src/ui/view.js',dependencies:[{resolved:'src/data/model.js'},{resolved:'src/does-not-exist.js'},{resolved:'node:fs',coreModule:true}]}]};
 put(r,'actual-depcruise.json',JSON.stringify(dep));
 const withDeps=buildArchitectureData(r,{input:'actual-depcruise.json'});
 assert.deepEqual(withDeps.edges.map(e=>[e.from,e.to,e.count]),[['src/ui','src/data',1]]);
 const view=archView(r,{input:'actual-depcruise.json',write:true});assert.equal(view.edgeCount,1);
 assert.equal(view.mode,'dependency-cruiser');assert.ok(get(r,'docs/architecture.html').includes('src/data'));
});
test('existing custom HTML never overwritten by init or arch view --write',t=>{
 const r=root(t);put(r,'docs/architecture.html','<html>my custom map</html>');const created=doInit(r);
 assert.ok(created.preserved.includes('docs/architecture.html'));
 assert.equal(get(r,'docs/architecture.html'),'<html>my custom map</html>');
 assert.throws(()=>archView(r,{write:true}),/Custom architecture HTML/);
 assert.equal(archView(r,{check:true}).status,'SKIP');
});
test('script tags and markup in untrusted file names are HTML escaped',t=>{
 const r=root(t);put(r,'src/a<script>alert(1)</script>.js','export default 1;');doInit(r);
 const html=get(r,'docs/architecture.html');
 assert.ok(!html.includes('"src/a<script>'));
 assert.ok(html.includes('\\u003cscript\\u003e'));
});
test('copied CLI works with its adjacent bundled HTML template',t=>{
 const r=root(t);doInit(r);put(r,'src/new.js','export default 1;');
 const run=spawnSync(process.execPath,[path.join(r,'.agentrepo/cli.mjs'),'arch','view','--write'],{cwd:r,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);assert.equal(archView(r,{check:true}).ok,true);
});
test('init on existing JS repository with dependency-cruiser binary does not require agentrepo.json upfront',t=>{
 const r=root(t);put(r,'src/a.js','export default 3;');put(r,'node_modules/.bin/depcruise',`#!/bin/sh\nprintf '{"modules":[]}\\n'\n`);fs.chmodSync(path.join(r,'node_modules/.bin/depcruise'),0o755);
 assert.ok(doInit(r).created.length>0);
});
