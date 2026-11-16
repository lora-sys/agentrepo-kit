import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {init} from '../bin/agentrepo.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(dir,p)=>fs.readFileSync(path.join(dir,p),'utf8');
function work(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-template-'));t.after(()=>fs.rmSync(d,{force:true,recursive:true}));return d;}

test('template source and distributable CLI are byte-identical after build',()=>{
 const run=spawnSync(process.execPath,['scripts/build-cli.mjs','--check'],{cwd:base,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
});

test('generated project AGENTS is self-sufficient without global modes or skills',t=>{
 const root=work(t);init(root);const agents=read(root,'AGENTS.md');
 assert.ok(agents.split('\n').length<=150);
 assert.ok(agents.indexOf('## 优先级')<agents.indexOf('## 执行步骤'));
 for(const word of ['## 项目上下文','## 执行步骤','## 安全边界','## 项目专属约束','node .agentrepo/cli.mjs verify','NOT_CONFIGURED']) assert.ok(agents.includes(word),word);
 assert.doesNotMatch(agents,/lora-mode|全局 Skill|System Prompt/);
 assert.ok(fs.existsSync(path.join(root,'.agentrepo/cli.mjs')));
 assert.equal(fs.existsSync(path.join(root,'.agents/skills')),false);
 const nested=spawnSync(process.execPath,[path.join(root,'.agentrepo/cli.mjs'),'doctor','--json'],{cwd:root,encoding:'utf8'});
 assert.notEqual(nested.status,null);
 assert.ok(!nested.stderr.includes('ENOENT'));
});

test('all editable project markdown is rendered from canonical templates',t=>{
 const root=work(t);init(root);
 for(const p of ['AGENTS.md','README.md','docs/architecture.md','docs/development.md','.env.example','.gitignore']){
   const template=read(base,'templates/project/'+(p==='.gitignore'?'gitignore.tmpl':p));
   const result=read(root,p);
   assert.ok(template.length>0);
   assert.doesNotMatch(result,/\{\{(?:PROJECT_NAME|CODE_MAP|STACK_LIST)\}\}/);
   assert.ok(result.trim().length>0);
 }
 assert.ok(read(root,'docs/architecture.md').includes('agentrepo:map:start'));
});

test('existing project AGENTS and project documents remain unchanged',t=>{
 const root=work(t);
 fs.writeFileSync(path.join(root,'AGENTS.md'),'# Original\nDo not merge automatically.\n');
 fs.writeFileSync(path.join(root,'README.md'),'# Existing project\n');
 init(root);
 assert.equal(read(root,'AGENTS.md'),'# Original\nDo not merge automatically.\n');
 assert.equal(read(root,'README.md'),'# Existing project\n');
});

test('bundled CLI can initialize another project without template files',t=>{
 const outer=work(t),a=path.join(outer,'a'),b=path.join(outer,'b');fs.mkdirSync(a);init(a);
 const c=path.join(a,'.agentrepo/cli.mjs');
 const run=spawnSync(process.execPath,[c,'init',b,'--json'],{cwd:outer,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.ok(read(b,'AGENTS.md').includes('## 执行步骤'));
 assert.ok(read(b,'docs/development.md').includes('NOT_CONFIGURED'));
});

test('npm package includes every editable template and a standalone bundle',()=>{
 const out=spawnSync('npm',['pack','--dry-run','--json'],{cwd:base,encoding:'utf8'});
 assert.equal(out.status,0,out.stderr);
 const names=JSON.parse(out.stdout)[0].files.map(x=>x.path);
 for(const name of ['src/agentrepo.mjs','scripts/build-cli.mjs','bin/agentrepo.mjs','templates/AGENTS.project.md','templates/project/AGENTS.md','templates/project/README.md','templates/project/docs/architecture.md','templates/project/docs/development.md','templates/project/.env.example','templates/project/gitignore.tmpl']) assert.ok(names.includes(name),`npm package missing ${name}`);
});
