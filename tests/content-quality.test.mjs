import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {doInit} from '../bin/agentrepo.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(dir,p)=>fs.readFileSync(path.join(dir,p),'utf8');

test('quality: generated instructions stay concise without dropping critical rules', t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-quality-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  doInit(dir);
  for(const [file,max] of Object.entries({
    'AGENTS.md':1150,
    'docs/architecture.md':900,
    'docs/development.md':700,
    'docs/github.md':520,
    '.github/pull_request_template.md':520,
    'CHANGELOG.md':220
  })){
    const body=read(dir,file);
    assert.ok(body.length<=max,`${file} has ${body.length} chars, limit ${max}`);
    assert.ok(!/^\s*(\S.+)\n\1\s*$/gm.test(body),`${file} repeats a line`);
  }
  const agents=read(dir,'AGENTS.md');
  for(const required of ['existing project rules','verify','PASS','FAIL','SKIP','docs check','arch check','plans/','secrets']){
    assert.ok(agents.toLowerCase().includes(required.toLowerCase()),`missing AGENTS rule ${required}`);
  }
  const arch=read(dir,'docs/architecture.md');
  for(const key of ['REQUIRES_REVIEW:MODULE_RESPONSIBILITIES_AND_CONTRACTS','REQUIRES_REVIEW:PROJECT_SPECIFIC_BOUNDARIES','dependency-cruiser','forbiddenImports'])
    assert.ok(arch.includes(key),`missing architecture evidence ${key}`);
  const dev=read(dir,'docs/development.md');
  assert.match(dev,/REQUIRES_REVIEW:ENVIRONMENT_AND_FIXTURES/);
  const pr=read(dir,'.github/pull_request_template.md');
  assert.match(pr,/Existing project instructions/);
  assert.match(pr,/PASS, FAIL or SKIP/);
  assert.doesNotMatch(read(dir,'CHANGELOG.md'),/^### (?:Added|Changed|Fixed|Security)\s*$/m);
});

test('quality: repository rules have no duplicate numbering or stale test totals',()=>{
  const instructions=read(root,'AGENTS.md');
  const ruleNumbers=[...instructions.matchAll(/^(\d+)\. /gm)].map(x=>Number(x[1]));
  assert.deepEqual(ruleNumbers,ruleNumbers.map((_,i)=>i+1),'rule numbers must be consecutive');
  assert.doesNotMatch(read(root,'README.md'),/当前源码的自动化基线为 42 项/);
  assert.doesNotMatch(instructions,/last recorded validation.*ROUND6/);
});
