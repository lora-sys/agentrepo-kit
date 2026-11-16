import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {githubPlan,githubInit,init} from '../bin/agentrepo.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-github-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
const put=(r,p,v)=>{fs.mkdirSync(path.dirname(path.join(r,p)),{recursive:true});fs.writeFileSync(path.join(r,p),v);};
const get=(r,p)=>fs.readFileSync(path.join(r,p),'utf8');
const forms=['bug_report.yml','feature_request.yml','question.yml','broken_skill_or_integration.yml'];

test('GitHub: scan is read-only; explicit apply adds YAML issue forms, PR and changelog',t=>{
 const r=tmp(t);const scan=githubInit(r,false);
 assert.equal(scan.created.length,7);assert.equal(fs.readdirSync(r).length,0);
 assert.equal(scan.warnings.some(w=>w.includes('contact links')),true);
 const result=githubInit(r,true);
 assert.equal(result.created.length,7);assert.equal(result.applied,true);
 assert.equal(get(r,'.github/ISSUE_TEMPLATE/config.yml').trim(),'blank_issues_enabled: false');
 for(const n of forms)assert.match(get(r,'.github/ISSUE_TEMPLATE/'+n),/^name: .+\ndescription:/);
 assert.match(get(r,'.github/pull_request_template.md'),/## Verification/);
 assert.match(get(r,'CHANGELOG.md'),/Unreleased/);
 assert.equal(fs.existsSync(path.join(r,'.github/workflows/agentrepo-ci.yml')),false);
 assert.equal(githubInit(r,true).created.length,0);
});

test('GitHub: detects GitHub origin and emits two true contact links',t=>{
 const r=tmp(t);
 put(r,'.git/config','[core]\n\tbare = false\n[remote "origin"]\n\turl = git@github.com:team/project.git\n');
 const result=githubInit(r,true);
 assert.equal(result.origin,'https://github.com/team/project');
 const config=get(r,'.github/ISSUE_TEMPLATE/config.yml');
 assert.match(config,/contact_links:/);assert.match(config,/https:\/\/github\.com\/team\/project\/security\/policy/);
 assert.match(config,/https:\/\/github\.com\/team\/project\/issues\?q=/);
 assert.equal((config.match(/  - name:/g)||[]).length,2);
});

test('GitHub: existing issue forms are authoritative; never mix two sets',t=>{
 const r=tmp(t);put(r,'.github/ISSUE_TEMPLATE/bug_custom.yml','name: Custom\ndescription: Existing\nbody: []\n');
 put(r,'docs/PULL_REQUEST_TEMPLATE.md','# Original PR\n');put(r,'HISTORY.md','# Historical changes\n');
 put(r,'.github/workflows/check.yml','name: Existing\n');
 const before={a:get(r,'.github/ISSUE_TEMPLATE/bug_custom.yml'),b:get(r,'docs/PULL_REQUEST_TEMPLATE.md'),c:get(r,'HISTORY.md'),d:get(r,'.github/workflows/check.yml')};
 const result=githubInit(r,true,true);
 assert.deepEqual(result.created,[]);
 assert.equal(get(r,'.github/ISSUE_TEMPLATE/bug_custom.yml'),before.a);
 assert.equal(get(r,'docs/PULL_REQUEST_TEMPLATE.md'),before.b);
 assert.equal(get(r,'HISTORY.md'),before.c);
 assert.equal(get(r,'.github/workflows/check.yml'),before.d);
 assert.equal(fs.existsSync(path.join(r,'.github/ISSUE_TEMPLATE/config.yml')),false);
});

test('GitHub: no workflow without separate flag or configured Node setup and verify',t=>{
 const r=tmp(t);init(r);assert.equal(githubPlan(r,true).created.some(p=>p.includes('workflows')),false);
 assert.ok(githubPlan(r,true).warnings.some(w=>w.includes('Workflow skipped')));
 const rc=tmp(t);put(rc,'package.json',JSON.stringify({scripts:{test:'node --test'}}));
 init(rc);assert.equal(githubPlan(rc,false).created.some(p=>p.includes('workflows')),false);
 assert.ok(githubPlan(rc,true).created.includes('.github/workflows/agentrepo-ci.yml'));
 githubInit(rc,true,true);
 assert.match(get(rc,'.github/workflows/agentrepo-ci.yml'),/contents: read/);
 assert.match(get(rc,'.github/workflows/agentrepo-ci.yml'),/node .agentrepo\/cli.mjs verify/);
});

test('GitHub: refuses symlink target and does not write through it',t=>{
 const r=tmp(t),outside=tmp(t);fs.symlinkSync(outside,path.join(r,'.github'),'dir');
 assert.throws(()=>githubInit(r,true),/Symlink path blocked/);
 assert.equal(fs.readdirSync(outside).length,0);
});

test('GitHub: bundled CLI can add templates to a second project with no source templates',t=>{
 const rootDir=tmp(t),a=path.join(rootDir,'a'),b=path.join(rootDir,'b');fs.mkdirSync(a);fs.mkdirSync(b);init(a);
 const nested=path.join(a,'.agentrepo/cli.mjs');
 const out=spawnSync(process.execPath,[nested,'github',b,'--apply','--json'],{encoding:'utf8'});
 assert.equal(out.status,0,`${out.stderr}\n${out.stdout}`);
 assert.equal(JSON.parse(out.stdout).created.length,7);
 assert.ok(fs.existsSync(path.join(b,'.github/ISSUE_TEMPLATE/bug_report.yml')));
});

test('GitHub: templates are first-class sources and the setup Skill has no external agent dependency',()=>{
 const skill=get(root,'skills/agentrepo-setup/SKILL.md');
 assert.match(skill,/name: agentrepo-setup/);assert.match(skill,/Does not require npm/);
 assert.doesNotMatch(skill,/lora-mode/);
 const formsDir=path.join(root,'templates/github/ISSUE_TEMPLATE');
 for(const name of forms){const body=fs.readFileSync(path.join(formsDir,name),'utf8');assert.match(body,/\nbody:\n/);assert.match(body,/validations:/);}
 assert.match(fs.readFileSync(path.join(root,'.github/ISSUE_TEMPLATE/config.yml'),'utf8'),/blank_issues_enabled: false/);
 const p=spawnSync('npm',['pack','--dry-run','--json'],{cwd:root,encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
 const names=JSON.parse(p.stdout)[0].files.map(x=>x.path);
 for(const n of ['skills/agentrepo-setup/SKILL.md','templates/github/ISSUE_TEMPLATE/bug_report.yml','templates/github/workflows/agentrepo-ci.yml'])assert.ok(names.includes(n),n);
});
