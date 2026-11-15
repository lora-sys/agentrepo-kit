import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { adoptScan, adoptPlan, adoptApply, adoptActivate, adoptVerify, doInit, runCLI, placeholderStatus, doDoctor, adoptReconcile } from '../bin/agentrepo.mjs';

function project(t, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentrepo-adoption-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  for (const [name, value] of Object.entries(files)) {
    const full=path.join(root,name);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,value);
  }
  return root;
}
const file=(root,rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const original={
  'AGENTS.md':'# Original policy\nNever change public API without review.\n',
  'CLAUDE.md':'Project-specific agent guidance.\n',
  '.cursor/rules/style.mdc':'Our style.\n',
  '.github/workflows/deploy.yml':'name: User workflow\n',
  '.github/ISSUE_TEMPLATE/bug.yml':'name: Custom issue\n',
  'docs/pull_request_template.md':'Original PR template\n',
  'HISTORY.md':'Original historical releases\n',
  'README.md':'# Existing project\n',
  'package.json':'{"name":"existing","scripts":{"test":"node --test"}}\n'
};

test('adopt: scan detects original project governance and has no side effects',t=>{
  const root=project(t,original);
  const scan=adoptScan(root);
  assert.ok(scan.byCategory.agent.includes('AGENTS.md'));
  assert.ok(scan.byCategory.otherAgent.includes('CLAUDE.md'));
  assert.deepEqual(scan.byCategory.workflow,['.github/workflows/deploy.yml']);
  assert.ok(scan.byCategory.pr.includes('docs/pull_request_template.md'));
  assert.equal(fs.existsSync(path.join(root,'.agentrepo')),false);
});

test('adopt: plan must be reviewed; apply preserves originals and requires approval',t=>{
  const root=project(t,original);adoptPlan(root,{write:true});
  assert.throws(()=>adoptApply(root,{},doInit),/--approve/);
  const result=adoptApply(root,{approve:true},doInit);
  assert.equal(result.status,'PENDING_ACTIVATION');
  for(const [name,value] of Object.entries(original))assert.equal(file(root,name),value);
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/agentrepo.yml')),false);
  assert.equal(fs.existsSync(path.join(root,'.github/pull_request_template.md')),false);
  assert.equal(fs.existsSync(path.join(root,'CHANGELOG.md')),false);
  assert.ok(file(root,'.agentrepo/adoption-guide.md').includes('Original project rules'));
  assert.equal(adoptVerify(root,{},placeholderStatus,doDoctor).ok,false);
});

test('adopt: changed original policy blocks stale adoption plans',t=>{
  const root=project(t,original);adoptPlan(root,{write:true});
  fs.appendFileSync(path.join(root,'AGENTS.md'),'New owner rule.\n');
  assert.throws(()=>adoptApply(root,{approve:true},doInit),/changed since adoption plan/);
  assert.equal(fs.existsSync(path.join(root,'agentrepo.json')),false);
});

test('adopt: activate explicitly appends a minimal bridge without changing original text',t=>{
  const root=project(t,original);adoptPlan(root,{write:true});adoptApply(root,{approve:true},doInit);
  assert.throws(()=>adoptActivate(root,{}),/--approve/);
  const first=adoptActivate(root,{approve:true,reason:'Reviewed original project policies and approved bridge'});
  assert.equal(first.bridged,true);
  assert.ok(file(root,'AGENTS.md').startsWith(original['AGENTS.md']));
  assert.match(file(root,'AGENTS.md'),/agentrepo-adoption-link:v1/);
  assert.equal(adoptActivate(root,{approve:true,reason:'Reviewed original project policies and approved bridge'}).status,'ALREADY_ACTIVE');
  assert.equal((file(root,'AGENTS.md').match(/agentrepo-adoption-link:v1/g)||[]).length,1);
  assert.equal(adoptVerify(root,{},placeholderStatus,doDoctor).status,'REVIEW_REQUIRED');
});

test('adopt: generated docs can be reviewed and verified without modifying original repo rules',t=>{
  const root=project(t,original);adoptPlan(root,{write:true});adoptApply(root,{approve:true},doInit);adoptActivate(root,{approve:true,reason:'Reviewed original project policies and approved bridge'});
  for(const rel of ['docs/architecture.md','docs/development.md']) {
    const p=path.join(root,rel);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/\{\{REQUIRES_REVIEW:[A-Z0-9_]+\}\}/g,'Confirmed against source and existing project rules.'));
  }
  const result=adoptVerify(root,{},placeholderStatus,doDoctor);
  assert.equal(result.status,'INTEGRATION_CHECKS_PASS',JSON.stringify(result.issues));
  fs.appendFileSync(path.join(root,'CLAUDE.md'),'New policy.\n');
  const stale=adoptVerify(root,{},placeholderStatus,doDoctor);
  assert.equal(stale.ok,false);
  assert.match(stale.issues.join(' '),/CLAUDE.md/);
  assert.throws(()=>adoptReconcile(root,{approve:true}),/--reason/);
  const reconciled=adoptReconcile(root,{approve:true,reason:'Reviewed the new CLAUDE instructions with repository owner'});
  assert.deepEqual(reconciled.changed,['CLAUDE.md']);
  assert.equal(adoptVerify(root,{},placeholderStatus,doDoctor).ok,true);
});

test('adopt: a project without AGENTS receives generated instructions and no duplicate bridge',t=>{
  const root=project(t,{'src/app.js':'export const a=1;\n'});
  adoptPlan(root,{write:true});adoptApply(root,{approve:true},doInit);
  assert.equal(adoptActivate(root,{approve:true,reason:'Reviewed original project policies and approved bridge'}).bridged,false);
  assert.doesNotMatch(file(root,'AGENTS.md'),/agentrepo-adoption-link:v1/);
});

test('adopt: CLI commands operate from any directory, and generated local CLI runs adoption verify',t=>{
  const root=project(t,original);
  assert.equal(runCLI(['adopt','plan',root,'--write'],root).saved,true);
  assert.equal(runCLI(['adopt','apply',root,'--approve'],root).status,'PENDING_ACTIVATION');
  assert.equal(runCLI(['adopt','activate',root,'--approve','--reason','Reviewed all original agent instruction files'],root).status,'ACTIVE_PENDING_REVIEW');
  const exec=path.join(root,'.agentrepo','cli.mjs');
  const result=execFileSync(process.execPath,[exec,'adopt','scan','--json'],{cwd:root,encoding:'utf8'});
  assert.ok(JSON.parse(result).byCategory.agent.includes('AGENTS.md'));
});

test('adopt: application refuses a symlinked managed destination',t=>{
  const root=project(t,original);adoptPlan(root,{write:true});
  const victim=path.join(root,'victim');fs.mkdirSync(victim);
  fs.symlinkSync(victim,path.join(root,'docs','plans'));
  assert.throws(()=>adoptApply(root,{approve:true},doInit),/Symlink/);
  assert.equal(fs.existsSync(path.join(victim,'architecture.md')),false);
});

test('adopt: stale plan can only be regenerated with explicit refresh approval',t=>{
  const root=project(t,original);adoptPlan(root,{write:true});
  fs.appendFileSync(path.join(root,'CONTRIBUTING.md'),'New process.\n');
  assert.throws(()=>adoptApply(root,{approve:true},doInit),/changed since adoption plan/);
  assert.throws(()=>adoptPlan(root,{write:true}),/plan exists/);
  assert.throws(()=>adoptPlan(root,{write:true,refresh:true}),/--approve/);
  assert.equal(adoptPlan(root,{write:true,refresh:true,approve:true}).saved,true);
  assert.equal(adoptApply(root,{approve:true},doInit).status,'PENDING_ACTIVATION');
});

test('adopt: activation refuses a missing review reason',t=>{
  const root=project(t,original);adoptPlan(root,{write:true});adoptApply(root,{approve:true},doInit);
  assert.throws(()=>adoptActivate(root,{approve:true}),/--reason/);
  assert.equal(file(root,'AGENTS.md'),original['AGENTS.md']);
});
