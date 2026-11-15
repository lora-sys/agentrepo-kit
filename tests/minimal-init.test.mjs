import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {doInit,runCLI,doDoctor,doDocs,doVerify} from '../bin/agentrepo.mjs';
function tmp(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-minimal-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('minimal: seven-file fresh init, strict doc checks, and mandatory test gating',t=>{
 const root=tmp(t),r=doInit(root,{minimal:true});
 assert.equal(r.created.length,7);
 for(const f of ['AGENTS.md','agentrepo.json','docs/code-map.md','docs/development.md','.agentrepo/cli.mjs','.agentrepo/adoption.mjs','.agentrepo/.gitignore'])assert.ok(fs.existsSync(path.join(root,f)),f);
 for(const f of ['README.md','docs/architecture.html','.github/workflows/agentrepo.yml','eval/regressions.json'])assert.equal(fs.existsSync(path.join(root,f)),false,f);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'agentrepo.json'))).profile,'minimal');
 assert.equal(doDoctor(root).ok,true); assert.equal(doDocs(root,{strict:true}).ok,true);
 assert.equal(doVerify(root,{require:'test'}).ok,false);
 assert.equal(doInit(root,{minimal:true}).created.length,0);
});
test('minimal: existing repository policy and workflows are preserved',t=>{
 const root=tmp(t),original='# Team policy\nDo not change CI\n';
 fs.writeFileSync(path.join(root,'AGENTS.md'),original);
 fs.mkdirSync(path.join(root,'.github/workflows'),{recursive:true});
 fs.writeFileSync(path.join(root,'.github/workflows/ci.yml'),'name: Existing\n');
 assert.ok(doInit(root,{minimal:true,'dry-run':true}).preserved.includes('AGENTS.md'));
 assert.equal(fs.existsSync(path.join(root,'agentrepo.json')),false);
 doInit(root,{minimal:true});
 assert.equal(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'),original);
 assert.equal(fs.readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8'),'name: Existing\n');
});
test('minimal: public CLI flag works; source map drift still fails',t=>{
 const root=tmp(t);
 fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/a.js'),'export const a=1;\n');
 assert.equal(runCLI(['init',root,'--minimal']).created.length,7);
 fs.writeFileSync(path.join(root,'src/b.js'),'export const b=2;\n');
 assert.ok(doDocs(root).issues.some(x=>x.type==='stale-map'));
});
