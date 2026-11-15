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


import {execFileSync,spawnSync} from 'node:child_process';

test('minimal bundle: can bootstrap another minimal repo without architecture HTML',t=>{
 const root=tmp(t), first=path.join(root,'first'), second=path.join(root,'second');
 doInit(first,{minimal:true});
 const cli=path.join(first,'.agentrepo/cli.mjs');
 assert.equal(fs.existsSync(path.join(first,'.agentrepo/architecture-template.html')),false);
 const r=JSON.parse(execFileSync(process.execPath,[cli,'init',second,'--minimal','--json'],{encoding:'utf8'}));
 assert.equal(r.ok,true);assert.equal(r.created.length,7);
 assert.equal(fs.existsSync(path.join(second,'.agentrepo/cli.mjs')),true);
 const doctor=JSON.parse(execFileSync(process.execPath,[path.join(second,'.agentrepo/cli.mjs'),'doctor','--json'],{cwd:second,encoding:'utf8'}));
 assert.equal(doctor.ok,true);
});

test('minimal bundle: adopt apply uses the available profile and preserves original AGENTS',t=>{
 const root=tmp(t), first=path.join(root,'minimal'), existing=path.join(root,'existing');
 doInit(first,{minimal:true});fs.mkdirSync(existing,{recursive:true});
 const policy='# Team rules\nDo not modify release jobs.\n';
 fs.writeFileSync(path.join(existing,'AGENTS.md'),policy);
 const cli=path.join(first,'.agentrepo/cli.mjs');
 execFileSync(process.execPath,[cli,'adopt','plan',existing,'--write','--json'],{encoding:'utf8'});
 const result=JSON.parse(execFileSync(process.execPath,[cli,'adopt','apply',existing,'--approve','--json'],{encoding:'utf8'}));
 assert.equal(result.status,'PENDING_ACTIVATION');
 assert.equal(JSON.parse(fs.readFileSync(path.join(existing,'agentrepo.json'),'utf8')).profile,'minimal');
 assert.equal(fs.readFileSync(path.join(existing,'AGENTS.md'),'utf8'),policy);
 assert.equal(fs.existsSync(path.join(existing,'.agentrepo/adoption-guide.md')),true);
 assert.equal(fs.existsSync(path.join(existing,'docs/architecture.html')),false);
});

test('minimal bundle: full-only features fail with a useful error, never ENOENT',t=>{
 const root=tmp(t), first=path.join(root,'minimal');doInit(first,{minimal:true});
 const cli=path.join(first,'.agentrepo/cli.mjs');
 for(const argv of [['init',path.join(root,'full')],['arch','view','--write']]){
   const out=spawnSync(process.execPath,[cli,...argv],{encoding:'utf8',cwd:first});
   assert.notEqual(out.status,0);
   assert.doesNotMatch(out.stderr,/ENOENT|no such file or directory/i);
   assert.match(out.stderr,/minimal|full initialization|full agentrepo/i);
 }
});
