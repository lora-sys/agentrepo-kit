import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {init,inspect,doctor,map,execute,detect,locate,main} from '../bin/agentrepo.mjs';
const cli=fileURLToPath(new URL('../bin/agentrepo.mjs',import.meta.url));
const tmp=t=>{const r=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-lean-'));t.after(()=>fs.rmSync(r,{force:true,recursive:true}));return r};
const write=(r,p,s)=>{fs.mkdirSync(path.dirname(path.join(r,p)),{recursive:true});fs.writeFileSync(path.join(r,p),s)};
const read=(r,p)=>fs.readFileSync(path.join(r,p),'utf8');

test('empty repo: readonly inspection; init adds a short skeleton, no fake runnable commands',t=>{
 const root=tmp(t);const pre=inspect(root);assert.ok(pre.proposedFiles.includes('AGENTS.md'));assert.equal(fs.readdirSync(root).length,0);
 const dry=init(root,true);assert.equal(dry.dryRun,true);assert.equal(fs.readdirSync(root).length,0);
 const done=init(root);assert.equal(done.ok,true);assert.equal(done.created.length,8);assert.equal(read(root,'agentrepo.json').includes('"verify": null'),true);
 assert.ok(read(root,'AGENTS.md').split('\n').length<50);
 assert.equal(doctor(root).ok,false);assert.equal(execute(root,'verify').status,'NOT_CONFIGURED');
 assert.equal(init(root).created.length,0);
});

test('agents init writes one file, supports dry-run, and preserves existing AGENTS.md',t=>{
 const r=tmp(t);write(r,'README.md','# existing\n');
 const dry=spawnSync(process.execPath,[cli,'agents','init',r,'--dry-run','--json'],{encoding:'utf8'});
 assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).status,'WOULD_CREATE');assert.equal(fs.existsSync(path.join(r,'AGENTS.md')),false);
 const applied=spawnSync(process.execPath,[cli,'agents','init',r,'--json'],{encoding:'utf8'});
 assert.equal(applied.status,0,applied.stderr);assert.equal(JSON.parse(applied.stdout).status,'CREATED');
 assert.deepEqual(fs.readdirSync(r).sort(),['AGENTS.md','README.md']);assert.match(read(r,'AGENTS.md'),/^# agentrepo-lean-/);
 const original=read(r,'AGENTS.md');const repeat=spawnSync(process.execPath,[cli,'agents','init',r,'--json'],{encoding:'utf8'});
 assert.equal(repeat.status,0,repeat.stderr);assert.equal(JSON.parse(repeat.stdout).status,'PRESERVED');assert.equal(read(r,'AGENTS.md'),original);
});

test('node package: pnpm and scripts recognized without inventing commands',t=>{
 const r=tmp(t);write(r,'package.json',JSON.stringify({name:'demo',packageManager:'pnpm@9.4.0',scripts:{dev:'vite',test:'node --test',lint:'eslint src',typecheck:'tsc --noEmit'}}));write(r,'pnpm-lock.yaml','lockfileVersion: "9.0"\n');
 const d=detect(r);assert.equal(d.packageManager,'pnpm');assert.deepEqual(d.commands.setup,[['pnpm','install','--frozen-lockfile']]);assert.deepEqual(d.commands.verify,[['pnpm','run','lint'],['pnpm','run','typecheck'],['pnpm','run','test']]);assert.deepEqual(d.commands.dev,[['pnpm','run','dev']]);
});

test('make targets take precedence and are executable through the same CLI',t=>{
 const r=tmp(t);write(r,'Makefile','test:\n\t@echo ok\nverify:\n\t@echo verified\n');init(r);assert.deepEqual(detect(r).commands.verify,[['make','verify']]);assert.equal(execute(r,'verify',{jsonOutput:true}).status,'PASS');
});

test('existing project instructions, workflows, architecture and README remain byte-for-byte unchanged',t=>{
 const r=tmp(t);for(const [p,s] of Object.entries({'AGENTS.md':'# rules\nnever touch CI\n','README.md':'# product\n','docs/architecture.md':'# OWN MAP\n','.github/workflows/ci.yml':'name: CI\n','docs/development.md':'# my env\n'}))write(r,p,s);
 const before=Object.fromEntries(['AGENTS.md','README.md','docs/architecture.md','.github/workflows/ci.yml','docs/development.md'].map(p=>[p,read(r,p)]));const state=init(r);assert.equal(state.reviewRequired!==null,true);for(const [p,s] of Object.entries(before))assert.equal(read(r,p),s);assert.equal(fs.existsSync(path.join(r,'.github','workflows','agentrepo.yml')),false);
});

test('adopt is read-only without --apply; with --apply preserves all existing project code',t=>{
 const r=tmp(t);write(r,'src/api.js','export function ok(){}\n');write(r,'AGENTS.md','# custom\n');const before=read(r,'src/api.js');
 const a=spawnSync(process.execPath,[cli,'adopt',r,'--json'],{encoding:'utf8'});assert.equal(a.status,0);assert.equal(fs.existsSync(path.join(r,'agentrepo.json')),false);
 const b=spawnSync(process.execPath,[cli,'adopt',r,'--apply','--json'],{encoding:'utf8'});assert.equal(b.status,0,b.stderr);assert.equal(read(r,'src/api.js'),before);assert.equal(read(r,'AGENTS.md'),'# custom\n');
});

test('installed self-contained CLI reinitializes a second project',t=>{
 const r=tmp(t),a=path.join(r,'a'),b=path.join(r,'b');fs.mkdirSync(a);fs.mkdirSync(b);init(a);const nested=path.join(a,'.agentrepo/cli.mjs');
 const child=spawnSync(process.execPath,[nested,'init',b,'--json'],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.ok(fs.existsSync(path.join(b,'.agentrepo/cli.mjs')));assert.ok(read(b,'docs/architecture.md').includes('agentrepo:map:start'));
});

test('architecture one-page map reports drift and only updates managed block',t=>{
 const r=tmp(t);write(r,'src/main.js','export const a=1;\n');init(r);const f=path.join(r,'docs/architecture.md');fs.appendFileSync(f,'\n# Maintainer notes\nkeep this\n');
 write(r,'src/new.js','export const b=2;\n');assert.equal(map(r,false,true).status,'FAIL');assert.equal(map(r,true,false).status,'UPDATED');assert.equal(map(r,false,true).status,'PASS');assert.ok(read(r,'docs/architecture.md').endsWith('# Maintainer notes\nkeep this\n'));
});

test('project-owned architecture without markers never overwritten by map --write',t=>{
 const r=tmp(t);write(r,'docs/architecture.md','# custom graph\n');init(r);assert.equal(map(r,true,false).status,'SKIP');assert.equal(read(r,'docs/architecture.md'),'# custom graph\n');
});

test('symlinks cannot trick initializer into writing outside repository',t=>{
 const r=tmp(t),outside=tmp(t);fs.symlinkSync(outside,path.join(r,'docs'),'dir');assert.throws(()=>init(r),/Symlink path blocked/);assert.equal(fs.readdirSync(outside).length,0);
});

test('verify propagates failure, skips subsequent steps, and keeps explicit status',t=>{
 const r=tmp(t);init(r);let c=JSON.parse(read(r,'agentrepo.json'));c.commands.verify=[[process.execPath,'-e','process.exit(3)'],[process.execPath,'-e','process.exit(0)']];write(r,'agentrepo.json',JSON.stringify(c));const result=execute(r,'verify',{jsonOutput:true});assert.equal(result.status,'FAIL');assert.equal(result.checks.length,1);assert.equal(result.checks[0].exitCode,3);
});

test('only argv arrays allowed; shell text rejected',t=>{
 const r=tmp(t);init(r);const c=JSON.parse(read(r,'agentrepo.json'));c.commands.verify=['echo hacked'];write(r,'agentrepo.json',JSON.stringify(c));assert.throws(()=>execute(r,'verify'),/Invalid argv/);
});

test('go and rust have concrete standard test gates; Python avoids guessing toolchain',t=>{
 const go=tmp(t);write(go,'go.mod','module example.com/demo\n');assert.deepEqual(detect(go).commands.verify,[['go','test','./...']]);
 const rust=tmp(t);write(rust,'Cargo.toml','[package]\nname="hello"\n');assert.deepEqual(detect(rust).commands.verify,[['cargo','fmt','--check'],['cargo','test']]);
 const py=tmp(t);write(py,'pyproject.toml','[project]\nname="demo"\n');assert.equal(detect(py).commands.verify,null);
});

test('code locator finds paths without reading or changing business content',t=>{
 const r=tmp(t);write(r,'src/users/register.js','abc');write(r,'src/billing/pay.js','abc');assert.equal(locate(r,'user register')[0].path,'src/users/register.js');assert.equal(read(r,'src/billing/pay.js'),'abc');
});

test('CLI help explains limited scope and machine-readable inspect response',t=>{
 const r=tmp(t);const h=execFileSync(process.execPath,[cli,'--help'],{encoding:'utf8'});assert.match(h,/inspect\|init\|adopt/);assert.match(h,/agents init/);const o=JSON.parse(execFileSync(process.execPath,[cli,'inspect',r,'--json'],{encoding:'utf8'}));assert.equal(o.proposedFiles.includes('AGENTS.md'),true);
});

test('new project path can be dry-run without writing then initialized',t=>{
 const base=tmp(t),root=path.join(base,'new','project');const p=init(root,true);assert.equal(p.created.includes('AGENTS.md'),true);assert.equal(fs.existsSync(root),false);
 assert.equal(init(root).created.includes('AGENTS.md'),true);assert.ok(fs.existsSync(path.join(root,'AGENTS.md')));
});

test('native verification can run BEFORE initialization',t=>{
 const r=tmp(t);write(r,'package.json',JSON.stringify({name:'existing',version:'0.0.0',scripts:{test:'node -e "process.exit(0)"'}}));
 assert.equal(fs.existsSync(path.join(r,'agentrepo.json')),false);
 assert.equal(execute(r,'verify',{jsonOutput:true}).status,'PASS');
 assert.equal(fs.existsSync(path.join(r,'AGENTS.md')),false);
});

test('native verification fails before init when test script exits nonzero',t=>{
 const r=tmp(t);write(r,'package.json',JSON.stringify({name:'broken',scripts:{test:'node -e "process.exit(9)"'}}));
 assert.equal(execute(r,'verify',{jsonOutput:true}).status,'FAIL');
});

test('existing project with no test runner does not claim ready',t=>{
 const r=tmp(t);write(r,'README.md','# service\n');init(r);assert.deepEqual(doctor(r).issues,['verify command NOT_CONFIGURED']);
});

test('template AGENTS and development docs use existing project commands and policy priority',t=>{
 const r=tmp(t);init(r);const agents=read(r,'AGENTS.md');const dev=read(r,'docs/development.md');
 assert.match(agents,/遵守仓库已有规则/);
 assert.match(agents,/沿用项目现有结构与命令/);
 assert.match(agents,/仅在安全且获授权时运行相关检查/);
 assert.match(agents,/接口、依赖、CI、生产配置、提交和推送/);assert.match(dev,/NOT_CONFIGURED/);
 assert.doesNotMatch(agents,/System Prompt|Zero-shot|Attention|\.agentrepo\/cli\.mjs/);
});

test('bundled verify resolves its own project even if invoked from another cwd',t=>{
 const root=tmp(t), project=path.join(root,'project'),other=path.join(root,'other');fs.mkdirSync(project);fs.mkdirSync(other);
 write(project,'package.json',JSON.stringify({name:'demo',scripts:{test:'node -e "process.exit(0)"'}}));init(project);
 const nested=path.join(project,'.agentrepo/cli.mjs');
 const run=spawnSync(process.execPath,[nested,'verify','--json'],{cwd:other,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).status,'PASS');
});

test('npm-style symlink invokes CLI rather than silently exiting',t=>{
 const root=tmp(t),link=path.join(root,'agentrepo');fs.symlinkSync(cli,link);
 const result=spawnSync(link,['version'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/1\.0\.0-rc\.2/);
});

test('project AGENTS contains project-only entry and no generic workflow duplication',t=>{
 const r=tmp(t);write(r,'package.json',JSON.stringify({name:'demo',scripts:{test:'node --test'}}));init(r);
 const agents=read(r,'AGENTS.md');
 assert.ok(agents.split('\n').length<=150);
 assert.match(agents,/^# /);
 assert.match(agents,/^## 工作方式/m);
 assert.ok(agents.indexOf('遵守仓库已有规则')<agents.indexOf('## 工作方式'));
 assert.match(agents,/沿用项目现有结构与命令/);
 assert.doesNotMatch(agents,/## 项目专属规则/);
 assert.doesNotMatch(agents,/For bugs and behavior changes|lora-mode|通用 Skill|\.agentrepo\/cli\.mjs/);
 assert.doesNotMatch(agents,/pnpm|npm test|node --test/);
});

test('standalone project AGENTS extension is optional and contains project fields',t=>{
 const r=tmp(t);init(r);
 assert.equal(fs.existsSync(path.join(r,'templates/AGENTS.project.md')),false);
 const template=fs.readFileSync(fileURLToPath(new URL('../templates/AGENTS.project.md',import.meta.url)),'utf8');
 for(const key of ['## 过滤规则','## 项目特殊约束','## 致命陷阱','## 必须覆盖的影响面','## 本地环境特殊要求','## 特定任务流程'])assert.ok(template.includes(key),key);
 assert.match(template,/150 行以内/);assert.doesNotMatch(template,/lora-mode/);
});


test('repository contributor AGENTS has precedence and confirmed failure modes',()=>{
 const body=fs.readFileSync(fileURLToPath(new URL('../AGENTS.md',import.meta.url)),'utf8');
 assert.ok(body.split('\n').length<=150);
 assert.ok(body.indexOf('## 优先级')<body.indexOf('## 致命陷阱'));
 for(const frag of ['NOT_CONFIGURED','外部模板路径','已有的项目规范','npm run check'])assert.ok(body.includes(frag),frag);
});
