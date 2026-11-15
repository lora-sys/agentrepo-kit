import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {doInit,doVerify,doDocs,doDoctor,placeholderStatus} from '../bin/agentrepo.mjs';

function make(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-prompt-contract-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
function write(root,file,text){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);}
function read(root,file){return fs.readFileSync(path.join(root,file),'utf8');}
function passTest(root){
  const p=path.join(root,'agentrepo.json');const cfg=JSON.parse(fs.readFileSync(p,'utf8'));
  cfg.commands.test=[process.execPath,'-e','process.exit(0)'];
  write(root,'agentrepo.json',JSON.stringify(cfg));
}

test('regression AR-016: passing code tests cannot mark unresolved business context as verified',t=>{
  const root=make(t);
  doInit(root); passTest(root);
  const result=doVerify(root,{require:'test'});
  assert.equal(result.ok,false);
  assert.ok(result.results.some(x=>x.name==='test'&&x.status==='PASS'));
  const gate=result.results.find(x=>x.name==='project-context');
  assert.equal(gate.status,'FAIL');
  assert.ok(gate.pending.some(x=>x.field==='MODULE_PATH'));
  assert.ok(gate.pending.some(x=>x.field==='ENVIRONMENT_AND_FIXTURES'));
  assert.ok(doDocs(root,{strict:true}).issues.some(x=>x.type==='unresolved-placeholder'));
  assert.equal(doDoctor(root).ok,true,'doctor must remain usable for diagnostics');
});

test('regression AR-016: resolving reviewed fields clears verification gate',t=>{
  const root=make(t);doInit(root);passTest(root);
  for(const f of ['README.md','docs/architecture.md','docs/development.md']){
    write(root,f,read(root,f).replace(/\{\{REQUIRES_REVIEW:[^}\n]*\}\}/g,'Verified against actual project evidence'));
  }
  assert.deepEqual(placeholderStatus(root),[]);
  assert.equal(doVerify(root,{require:'test'}).ok,true);
  assert.equal(doDocs(root,{strict:true}).ok,true);
});

test('regression AR-016: malformed and domain-specific placeholders are reported',t=>{
  const root=make(t);doInit(root);
  write(root,'docs/domains/payments.md','# Payment\n{{REQUIRES_REVIEW:lowercase}}\n');
  const pending=placeholderStatus(root);
  assert.ok(pending.some(x=>x.file==='docs/domains/payments.md'&&x.invalid));
  assert.equal(doVerify(root).ok,false);
  assert.ok(doDocs(root,{strict:true}).issues.some(x=>x.file==='docs/domains/payments.md'));
});

test('existing project policies remain untouched and invented npm commands are absent',t=>{
  const root=make(t);
  const policy='# Custom rule\nProtect public APIs\n';
  write(root,'AGENTS.md',policy);
  write(root,'cmd/main.go','package main\nfunc main(){}\n');
  doInit(root);
  assert.equal(read(root,'AGENTS.md'),policy);
  const dev=read(root,'docs/development.md');
  assert.ok(dev.includes('agentrepo.json.commands'));
  assert.match(dev,/\| Setup \| `commands\.setup` \|/);
  assert.doesNotMatch(dev,/npm ci|npm run dev/);
  assert.equal(doVerify(root).ok,false);
});

test('regression AR-017: command detection respects declared project manager and never assumes npm',t=>{
  const dir=make(t);
  write(dir,'package.json',JSON.stringify({name:'test',packageManager:'pnpm@9.0.0',scripts:{dev:'vite',test:'vitest run'}}));
  write(dir,'pnpm-lock.yaml','lockfileVersion: 9.0\n');
  doInit(dir);
  const cfg=JSON.parse(read(dir,'agentrepo.json'));
  assert.deepEqual(cfg.commands.test,['pnpm','run','test']);
  assert.deepEqual(cfg.commands.dev,['pnpm','run','dev']);
  assert.deepEqual(cfg.commands.setup,['pnpm','install','--frozen-lockfile']);
  const dev=read(dir,'docs/development.md');
  assert.ok(dev.includes('agentrepo.json.commands'));
  assert.ok(!dev.includes('npm ci'));
  assert.ok(!dev.includes('pnpm install'), 'do not duplicate potentially stale argv in development docs');
});

test('regression AR-017: unknown or conflicting package manager leaves commands unconfigured',t=>{
  const a=make(t);write(a,'package.json',JSON.stringify({name:'ambiguous',scripts:{test:'node --test'}}));
  doInit(a);assert.deepEqual(JSON.parse(read(a,'agentrepo.json')).commands,{});
  const b=make(t);write(b,'package.json',JSON.stringify({name:'conflict',scripts:{test:'node --test'}}));
  write(b,'yarn.lock','some data\n');write(b,'package-lock.json','{}');
  doInit(b);assert.deepEqual(JSON.parse(read(b,'agentrepo.json')).commands,{});
});
