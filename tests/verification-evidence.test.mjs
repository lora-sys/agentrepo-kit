import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {init,doctor,execute,map} from '../bin/agentrepo.mjs';
const tmp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-proof-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir};
const write=(root,rel,body)=>{const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,body)};
const read=(root,rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const packageWithTest=(exit=0)=>JSON.stringify({name:'proof-sample',scripts:{test:`node -e "process.exit(${exit})"`}},null,2);

test('verification evidence: PASS is recorded only when explicitly executed',t=>{
 const root=tmp(t);write(root,'package.json',packageWithTest());write(root,'src/worker.js','export function worker(){return 42}\n');
 init(root);assert.equal(doctor(root).readiness,'NOT_VERIFIED');
 const before=read(root,'docs/development.md');
 const plain=execute(root,'verify',{jsonOutput:true});assert.equal(plain.status,'PASS');
 assert.equal(read(root,'docs/development.md'),before);
 const actual=execute(root,'verify',{jsonOutput:true,record:true});assert.equal(actual.status,'PASS');assert.equal(actual.record,'RECORDED');
 assert.equal(doctor(root).readiness,'RECORDED_PASS');
 const after=read(root,'docs/development.md');assert.match(after,/结果：\*\*PASS\*\*/);assert.match(after,/\| verify \| PASS \| 0 \|/);
 assert.doesNotMatch(after,/process\.exit\(0\)/); // proof stores results, not raw argv or output
 write(root,'src/worker.js','export function worker(){return 43}\n');
 assert.equal(doctor(root).readiness,'STALE');
});

test('verification evidence: changed test config invalidates prior PASS',t=>{
 const root=tmp(t);write(root,'package.json',packageWithTest());init(root);
 execute(root,'verify',{jsonOutput:true,record:true});assert.equal(doctor(root).readiness,'RECORDED_PASS');
 const config=JSON.parse(read(root,'agentrepo.json'));config.commands.verify=[[process.execPath,'-e','process.exit(4)']];
 write(root,'agentrepo.json',JSON.stringify(config));
 assert.equal(doctor(root).readiness,'STALE');
 const fail=execute(root,'verify',{jsonOutput:true,record:true});assert.equal(fail.status,'FAIL');
 assert.equal(fail.checks[0].exitCode,4);assert.equal(doctor(root).readiness,'RECORDED_FAIL');
});

test('verification evidence: project-owned development document cannot be overwritten',t=>{
 const root=tmp(t);write(root,'package.json',packageWithTest());write(root,'docs/development.md','# Project owned guide\n');init(root);
 const result=execute(root,'verify',{jsonOutput:true,record:true});
 assert.equal(result.record,'SKIP_PROJECT_OWNED_DOC');assert.equal(read(root,'docs/development.md'),'# Project owned guide\n');
 assert.equal(doctor(root).readiness,'NOT_VERIFIED');
});

test('verification evidence: failure without runnable checks stays NOT_VERIFIED',t=>{
 const root=tmp(t);init(root);assert.equal(execute(root,'verify',{jsonOutput:true,record:true}).status,'NOT_CONFIGURED');
 assert.equal(doctor(root).readiness,'NOT_VERIFIED');
});

test('architecture: named exports and test references are evidence, not invented API contracts',t=>{
 const root=tmp(t);
 write(root,'package.json',JSON.stringify({name:'demo',exports:{'.':{'import':'./src/index.js'},'./lite':'./src/lite.js'}}));
 write(root,'src/index.js','export function clsx(){}\nexport { clsx as cx };\n');
 write(root,'src/lite.js','export const lite = true;\n');
 write(root,'test/index.js',"import { clsx } from '../src/index.js';\n");init(root);
 const doc=read(root,'docs/architecture.md');
 assert.match(doc,/package\.json exports/);assert.match(doc,/src\/index\.js:1/);assert.match(doc,/`clsx`/);assert.match(doc,/`cx`/);
 assert.match(doc,/test\/index\.js:1/);assert.match(doc,/不代表已确认的公共 API/);
 assert.equal(map(root,false,true).status,'PASS');
 write(root,'src/index.js','export function names(){}\n');assert.equal(map(root,false,true).status,'FAIL');
});

test('bundled CLI: verify --record updates only managed section in target repo',t=>{
 const root=tmp(t);write(root,'package.json',packageWithTest());init(root);
 fs.appendFileSync(path.join(root,'docs/development.md'),'\nMaintainer note: keep this.\n');
 const r=spawnSync(process.execPath,[path.join(root,'.agentrepo/cli.mjs'),'verify','--record','--json'],{cwd:root,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).record,'RECORDED');
 assert.match(read(root,'docs/development.md'),/Maintainer note: keep this\./);
 const d=spawnSync(process.execPath,[path.join(root,'.agentrepo/cli.mjs'),'doctor','--json'],{cwd:root,encoding:'utf8'});
 assert.equal(JSON.parse(d.stdout).readiness,'RECORDED_PASS');
});


test('setup and test evidence: each command is recorded, dev success does not prove readiness',t=>{
 const root=tmp(t);write(root,'package.json',JSON.stringify({name:'demo',scripts:{test:'node -e "process.exit(0)"',dev:'node -e "process.exit(0)"'}}));init(root);
 const c=JSON.parse(read(root,'agentrepo.json'));c.commands.setup=[[process.execPath,'-e','process.exit(0)']];write(root,'agentrepo.json',JSON.stringify(c));
 assert.equal(execute(root,'setup',{jsonOutput:true,record:true}).record,'RECORDED');
 assert.equal(execute(root,'dev',{jsonOutput:true,record:true}).record,'RECORDED');
 assert.equal(execute(root,'test',{jsonOutput:true,record:true}).record,'RECORDED');
 const doc=read(root,'docs/development.md');
 assert.match(doc,/\| setup \| PASS \| 0 \|/);
 assert.match(doc,/\| test \| PASS \| 0 \|/);
 assert.match(doc,/\| dev \| EXITED_0_UNPROVEN \| 0 \|/);
 assert.equal(doctor(root).readiness,'NOT_VERIFIED');
});

test('missing development command can be recorded without claiming PASS',t=>{
 const root=tmp(t);init(root);const r=execute(root,'setup',{jsonOutput:true,record:true});
 assert.equal(r.status,'NOT_CONFIGURED');assert.equal(r.record,'RECORDED');
 assert.match(read(root,'docs/development.md'),/\| setup \| NOT_CONFIGURED \| none \|/);
});
