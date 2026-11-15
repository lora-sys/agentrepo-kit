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


test('quality: public guides stay task-focused and avoid defensive repetition',()=>{
  const budgets={
    'README.md':2200,
    'README.en.md':2500,
    'docs/USAGE.zh-CN.md':4500,
    'docs/ADOPTION.zh-CN.md':1400,
    'docs/EVAL.zh-CN.md':1200,
    'docs/GITHUB.zh-CN.md':700
  };
  for(const [file,max] of Object.entries(budgets)){
    const body=read(root,file);
    assert.ok(body.length<=max,file+': '+body.length+' characters exceed review budget '+max);
  }
  const joined=Object.keys(budgets).map(f=>read(root,f)).join('\n');
  for(const verbose of [
    '不要求用户从空白 Markdown 开始写',
    '二者职责不同',
    '不能自动取得原项目的架构决策权',
    '不是模型睡眠',
    '注意这里的 `eval/incidents.json` 指',
    '不能通过生成文件数判断接入是否完成'
  ]) assert.ok(!joined.includes(verbose),'defensive prose reintroduced: '+verbose);
  for(const key of ['adopt scan','adopt plan','adopt apply','adopt activate','adopt verify','adopt reconcile'])
    assert.ok(read(root,'docs/ADOPTION.zh-CN.md').includes(key),'adoption operation missing: '+key);
  for(const key of ['REQUIRES_REVIEW:FIELD','arch check --strict','docs review','eval report','SKIP'])
    assert.ok(read(root,'docs/USAGE.zh-CN.md').includes(key),'usage contract missing: '+key);
  for(const key of ['确定性','Agent','Token','SKIP'])
    assert.ok(read(root,'docs/EVAL.zh-CN.md').includes(key),'eval definition missing: '+key);
});
