#!/usr/bin/env node
// AgentRepo Kit v0.5.0. Standalone Node.js CLI with no third-party dependencies.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VERSION = '0.6.0';
const IGNORE = new Set(['.git', '.agentrepo', 'node_modules', '.venv', 'venv', 'dist', 'build', 'coverage', '.next', '.cache', '.turbo', '__pycache__', 'vendor', '.npm', '.pnpm-store', 'target', '.pytest_cache']);
const SOURCE_ROOTS = ['src', 'app', 'apps', 'lib', 'core', 'packages', 'services', 'tests', 'test', 'internal', 'cmd', 'bin', 'scripts', 'utils'];
const SOURCE_EXT = new Set(['.js','.jsx','.mjs','.cjs','.ts','.tsx','.mts','.cts','.py','.go','.rs','.java','.kt','.rb','.sh','.bash','.zsh','.php','.cs','.swift','.c','.h','.cc','.cpp','.vue','.svelte','.html','.css','.scss','.json','.yaml','.yml']);
const STOPWORDS = new Set('which where what who how does do are is the a an for to from of in on with that this find locate module code implement implementation function file files responsible used using and or at into when by it i we our as be can look please change fix support type test tests does after before'.split(' '));
const clean = p => String(p).replaceAll('\\','/');
const sha = txt => crypto.createHash('sha256').update(txt).digest('hex');
const json = data => JSON.stringify(data,null,2)+'\n';
const canRead = p => { try {return fs.statSync(p).isFile();} catch {return false;} };
const fileText = p => fs.readFileSync(p,'utf8');
const parseJson = p => JSON.parse(fileText(p));
const format = (o, pretty=true) => pretty ? JSON.stringify(o,null,2) : JSON.stringify(o);
function argsOf(tokens) {
  const pos=[]; const opts={};
  for (let i=0;i<tokens.length;i++) {
    const x=tokens[i];
    if (!x.startsWith('--')) {pos.push(x);continue;}
    const eq=x.indexOf('=');const key=x.slice(2,eq<0?undefined:eq);
    if (['dry-run','json','check','write','help','strict','arch'].includes(key)) opts[key]=true;
    else if(eq>=0) opts[key]=x.slice(eq+1);
    else if(tokens[i+1]!==undefined && !tokens[i+1].startsWith('--')) opts[key]=tokens[++i];
    else opts[key]=true;
  }
  return {pos,opts};
}
function ensureSafeRel(root, rel, allowMissing=true) {
  if(typeof rel!=='string' || !rel || rel.includes('\u0000')) throw new Error('Unsafe path');
  const out=path.resolve(root,rel);const base=path.resolve(root);
  if(out!==base&&!out.startsWith(base+path.sep)) throw new Error(`Path escapes repository: ${rel}`);
  if(out===base) throw new Error('Path must be a file below repository root');
  let walk=base;
  for(const part of path.relative(base,out).split(path.sep)) {
    walk=path.join(walk,part);
    try { if(fs.lstatSync(walk).isSymbolicLink()) throw new Error(`Symlink not allowed in managed paths: ${walk}`); }
    catch(e) {if(e.code==='ENOENT'&&allowMissing) break; throw e;}
  }
  return out;
}
function writeIfMissing(root, rel, content, dryRun=false) {
  const out=ensureSafeRel(root,rel);
  if(fs.existsSync(out)) return false;
  if(!dryRun) {fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,content,{flag:'wx'});}
  return true;
}
function walkFiles(root, options={}) {
  const max=options.max ?? 20000; const found=[]; const queue=[root];
  while(queue.length) {
    const dir=queue.pop();let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name));} catch {continue;}
    for(const ent of entries) {
      if(ent.isSymbolicLink()) continue;
      if(ent.isDirectory()) {if(!IGNORE.has(ent.name))queue.push(path.join(dir,ent.name));}
      else if(ent.isFile()) {found.push(clean(path.relative(root,path.join(dir,ent.name))));if(found.length>=max)return found.sort();}
    }
  }
  return found.sort();
}
function sourceFiles(root) {
  return walkFiles(root).filter(f=>(SOURCE_EXT.has(path.extname(f).toLowerCase()) || /^(test|tests)\//.test(f) || ['Makefile','Dockerfile','bash_completion','nvm-exec'].includes(f)) && !f.startsWith('docs/') && !f.startsWith('eval/') && !f.startsWith('benchmarks/') && !f.endsWith('.lock') && f !== 'agentrepo.json' && !f.startsWith('.github/'));
}
function detect(root) {
  const pkg=canRead(path.join(root,'package.json'))?parseJson(path.join(root,'package.json')):null;
  let stack='generic'; if(pkg)stack='node'; else if(canRead(path.join(root,'pyproject.toml')))stack='python';else if(canRead(path.join(root,'go.mod')))stack='go';else if(canRead(path.join(root,'Cargo.toml')))stack='rust';else if(canRead(path.join(root,'Makefile')))stack='make';
  const commands={};
  if(pkg)for(const [key,task] of Object.entries({setup:'install',dev:'dev',test:'test',lint:'lint',typecheck:'typecheck',e2e:'test:e2e',architecture:'check:architecture'})) {
    if(key==='setup') {if(canRead(path.join(root,'package-lock.json')))commands.setup=['npm','ci'];continue;}
    if(typeof pkg.scripts?.[task]==='string')commands[key]=['npm','run',task];
  }
  const src=SOURCE_ROOTS.filter(x=>{try{return fs.statSync(path.join(root,x)).isDirectory();}catch{return false;}});
  if(!src.length)src.push('.');
  return {stack,sourceRoots:src,commands};
}
function mapText(root) {
  const files=sourceFiles(root);const dirs=new Map();
  for(const f of files){const pieces=f.split('/');const section=pieces.length>1?pieces.slice(0,Math.min(pieces.length-1,2)).join('/'):'(root)';dirs.set(section,(dirs.get(section)||0)+1);}
  const rows=[...dirs].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,70).map(([p,n])=>`| \`${p}\` | ${n} |`);
  return `# Generated source map\n\nGenerated from the current file tree. Do not edit this index manually.\nUse \`node .agentrepo/cli.mjs locate "keywords"\` to search relevant source files.\n\nSource files: ${files.length}. Sections: ${dirs.size}.\n\n| Section | Files |\n| --- | ---: |\n${rows.join('\n')}\n`;
}
// One source of truth for the HTML architecture: real source inventory plus
// dependency-cruiser JSON. Missing analyzer => zero edges, never guessed links.
function sourceFingerprint(root){
  const h=crypto.createHash('sha256');
  for(const f of sourceFiles(root)){
    h.update(f);h.update('\0');
    try{h.update(fs.readFileSync(path.join(root,f)));}catch{h.update('unreadable');}
    h.update('\0');
  }
  return h.digest('hex');
}
function groupOf(f){
  const parts=clean(f).replace(/^\.\//,'').split('/');
  if(parts.length<=1)return '(root)';
  return parts.slice(0,Math.min(2,parts.length-1)).join('/');
}
function cruiseJson(root,opts={}){
  if(opts.skipCruiser)return null;
  if(opts.input){const p=ensureSafeRel(root,opts.input,false);return parseJson(p);}
  const binary=path.join(root,'node_modules','.bin',process.platform==='win32'?'depcruise.cmd':'depcruise');
  if(!fs.existsSync(binary))return null;
  const c=canRead(path.join(root,'agentrepo.json'))?config(root):detect(root);
  const roots=(c.sourceRoots||[]).filter(x=>x==='.'||fs.existsSync(path.join(root,x)));
  const r=spawnSync(binary,['--no-config','--output-type','json',...(roots.length?roots:['.'])],{
    cwd:root,encoding:'utf8',shell:false,timeout:120000,maxBuffer:32*1024*1024});
  if(r.error||r.status!==0)throw new Error('dependency-cruiser JSON analysis failed: '+(r.error?.message||r.stderr?.slice(-500)||'exit '+r.status));
  let data;try{data=JSON.parse(r.stdout);}catch{throw new Error('dependency-cruiser returned non-JSON output');}
  return data;
}
function buildArchitectureData(root,opts={}){
  const files=sourceFiles(root).filter(f=>!f.startsWith('.agentrepo/'));
  const index=new Map();
  for(const f of files){const id=groupOf(f);if(!index.has(id))index.set(id,[]);index.get(id).push(f);}
  const modules=[...index].sort(([a],[b])=>a.localeCompare(b)).map(([id,fs])=>({id,files:fs}));
  const knownFiles=new Set(files);
  const cruise=cruiseJson(root,opts);
  let edges=[];
  if(cruise){
    if(!Array.isArray(cruise.modules))throw new Error('Invalid dependency-cruiser JSON: modules array missing');
    const relations=new Map();
    for(const m of cruise.modules){
      if(typeof m.source!=='string'||!Array.isArray(m.dependencies))continue;
      const source=clean(m.source).replace(/^\.\//,'');
      if(!knownFiles.has(source))continue;
      for(const d of m.dependencies){
        if(typeof d.resolved!=='string'||d.coreModule||d.couldNotResolve)continue;
        let dest=clean(d.resolved).replace(/^\.\//,'');
        if(path.isAbsolute(dest))dest=clean(path.relative(root,dest));
        if(!knownFiles.has(dest))continue;
        const from=groupOf(source),to=groupOf(dest);
        if(from===to)continue;
        const key=JSON.stringify([from,to]);
        if(!relations.has(key))relations.set(key,{from,to,count:0,examples:[]});
        const hit=relations.get(key);hit.count++;
        if(hit.examples.length<6)hit.examples.push(source+' → '+dest);
      }
    }
    edges=[...relations.values()].sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to));
  }
  return {schemaVersion:1,project:path.basename(root),fileCount:files.length,
    fingerprint:sourceFingerprint(root),mode:cruise?'dependency-cruiser':'inventory',modules,edges};
}
function architectureTemplate(){return fs.readFileSync(new URL('./architecture-template.html',import.meta.url),'utf8');}
function renderArchitectureHtml(root,opts={}){
  const data=buildArchitectureData(root,opts);
  const html=architectureTemplate().replace('__SOURCE_HASH__',data.fingerprint)
    .replace('__PROJECT_TITLE__',data.project.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'))
    .replace('__GRAPH_DATA__',JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026'));
  return {html,data};
}
function archView(root,opts={}){
  const file='docs/architecture.html';
  const rendered=renderArchitectureHtml(root,opts);
  const full=ensureSafeRel(root,file);
  const matches=canRead(full)&&fileText(full)===rendered.html;
  if(opts.write){
    if(canRead(full) && !fileText(full).includes('name="agentrepo-source-hash"'))
      throw new Error('Custom architecture HTML is not managed by AgentRepo. Refusing to overwrite.');
    fs.mkdirSync(path.dirname(full),{recursive:true});
    fs.writeFileSync(full,rendered.html);
  }
  const custom=canRead(full)&&!fileText(full).includes('name="agentrepo-source-hash"');
  return {ok:opts.check?(matches||custom):true,status:opts.check?(custom?'SKIP':matches?'PASS':'FAIL'):'PASS',
    file,written:!!opts.write,mode:rendered.data.mode,moduleCount:rendered.data.modules.length,
    edgeCount:rendered.data.edges.length,warning:custom?'Custom architecture HTML preserved; content freshness cannot be automatically verified':rendered.data.mode==='inventory'?'No dependency-cruiser results: diagram contains no dependency edges':undefined};
}
function placeholderStatus(root){
  const docs=['README.md','docs/architecture.md','docs/development.md'];
  const pending=[];
  for(const f of docs){
    if(!canRead(path.join(root,f)))continue;
    for(const m of fileText(path.join(root,f)).matchAll(/\{\{REQUIRES_REVIEW:([A-Z][A-Z0-9_]*)\}\}/g))
      pending.push({file:f,field:m[1]});
  }
  return pending;
}

const DEFAULT_SCENARIOS = [{"id":"site-routes-preserved","description":"Existing site-route documentation is not reinterpreted as local filesystem paths","files":{"docs/content/commands.md":"# docs\n\n[Install](/commands/npm-install)\n"},"steps":[{"action":"init","expect":true},{"action":"docs-check","expect":true}]},{"id":"broken-managed-link","description":"Broken managed documentation link must fail","files":{"docs/architecture.md":"# Architecture\n\n[Missing](never-created.md)\n"},"steps":[{"action":"init","expect":true},{"action":"docs-check","expect":false}]},{"id":"stale-map-detected","description":"A source file added after init invalidates the index and can be repaired","files":{"src/a.js":"export const a=1;\n"},"steps":[{"action":"init","expect":true},{"action":"write","path":"src/b.js","content":"export const b=2;\n","expect":true},{"action":"docs-check","expect":false},{"action":"map-write","expect":true},{"action":"docs-check","expect":true}]},{"id":"preserve-human-agent-guidance","description":"Initializing an existing repo must preserve AGENTS.md","files":{"AGENTS.md":"Human-written instructions.\n","src/index.js":"export const a=1;\n"},"steps":[{"action":"init","expect":true},{"action":"init-again","expect":true},{"action":"contains","path":"AGENTS.md","content":"Human-written instructions.\n","expect":true}]},{"id":"shell-architecture-skipped","description":"Do not force JavaScript dependency checker on shell project","files":{"nvm.sh":"nvm() { :; }\n"},"steps":[{"action":"init","expect":true},{"action":"arch-skip","expect":true}]},{"id":"arch-rules-generated","description":"JavaScript module checker configuration is generated","files":{"src/a.js":"import \"./b.js\";\n","src/b.js":"export default 1;\n"},"steps":[{"action":"init","expect":true},{"action":"arch-init","expect":true},{"action":"arch-config","expect":true}]}];
function template(root) {
  const d=detect(root);const docsRulePaths=[...new Set([...d.sourceRoots.filter(p=>p!=='.'&&!['test','tests','scripts','utils'].includes(p)).map(p=>`${p}/**`),'*.sh','*.bash','*.zsh','*.js','*.ts','*.py','*.go','nvm-exec','bash_completion','Makefile','Dockerfile'])];
  const cfg={version:2,project:path.basename(path.resolve(root)),stack:d.stack,sourceRoots:d.sourceRoots,commands:d.commands,architecture:{forbiddenImports:[]},docRules:[{id:'architecture',doc:'docs/architecture.md',watch:docsRulePaths}],requiredChecks:[]};
  return {
    'README.md':`# ${path.basename(path.resolve(root))}\n\n## 项目目标\n\n{{REQUIRES_REVIEW:PROJECT_PURPOSE}}\n\n## 使用者\n\n{{REQUIRES_REVIEW:PRIMARY_USERS}}\n\n## 快速开始\n\n请先阅读 [开发与验证](docs/development.md)，安装、启动和测试命令以 agentrepo.json 中经过确认的配置为准。\n\n## 架构\n\n[架构说明](docs/architecture.md) · [可交互架构图](docs/architecture.html)\n\n## Agent 工作方式\n\n阅读 AGENTS.md，然后执行 \`node .agentrepo/cli.mjs doctor\`。\n`,
    'agentrepo.json':json(cfg),
    'AGENTS.md':`# Agent instructions\n\nRead \`README.md\` for product purpose and \`docs/architecture.md\` for module boundaries.\nUse \`docs/code-map.md\` only for a quick index; locate source with \`node .agentrepo/cli.mjs locate "keywords"\`.\nCheck \`docs/development.md\` for commands. Consult decisions and task plans only when relevant.\n\n## Execution\n\n- Inspect affected implementation, contracts, and tests before editing.\n- Avoid unrelated changes and preserve public APIs unless the task requires otherwise.\n- Run \`node .agentrepo/cli.mjs verify\`; report failed or skipped checks accurately.\n- Run \`node .agentrepo/cli.mjs docs check\` when source paths or interfaces change.\n- Architecture text is in \`docs/architecture.md\`; inspect interactive verified dependencies in \`docs/architecture.html\` or refresh using \`node .agentrepo/cli.mjs arch view --write\`. Never invent graph edges.\n- For JS/TS repositories initialize and run dependency-cruiser via \`node .agentrepo/cli.mjs arch init\` then \`arch check --strict\`.\n- For long tasks, maintain a specific plan in \`docs/plans/\` with remaining work and observed results.\n- Use isolated worktrees and disposable test data for concurrent or risky work.\n- Do not commit credentials or modify production systems without approval.\n`,
    'docs/architecture.md':`# 架构说明\n\n## 项目目标\n\n本项目的目标只在 [README](../README.md) 中维护，避免两份描述产生冲突。\n\n## 真实结构\n\n[查看可交互架构图](architecture.html)。图中的文件来自源码扫描，依赖线仅由 dependency-cruiser 实际解析得到。未安装工具时只展示文件与模块，不推测调用关系。\n\n[代码目录索引](code-map.md) 由 CLI 自动生成，不要手工复制。\n\n## 模块职责与公开接口\n\n{{REQUIRES_REVIEW:MODULE_RESPONSIBILITIES_AND_CONTRACTS}}\n\n填写要求：每个模块说明职责、公开 API、输入输出以及对应源码路径。无法从代码确认时标记未知。\n\n## 必须遵守的架构约束\n\n1. 不得未经任务授权改变现有公开 API 的行为。\n2. 跨模块依赖通过明确的公开接口，禁止未声明的逆向层级引用。\n3. 外部输入在系统边界校验，密钥不得提交到仓库。\n4. 修改现有模块契约时同步修改相关回归测试和本文档。\n5. 对 JavaScript 或 TypeScript 项目，使用 dependency-cruiser 检测循环依赖及自定义边界。\n\n项目专属禁止依赖规则：\n\n{{REQUIRES_REVIEW:PROJECT_SPECIFIC_BOUNDARIES}}\n\n确认后应将机器可执行的规则填写进 agentrepo.json 的 architecture.forbiddenImports，再运行 arch init 或 arch sync。\n\n## 验证\n\n- \`node .agentrepo/cli.mjs arch view --write\` 更新可视化。\n- \`node .agentrepo/cli.mjs arch check --strict\` 运行实际架构约束检查。\n- \`node .agentrepo/cli.mjs docs check --strict\` 检查链接、索引、可视化新鲜度和待确认占位符。\n\n## 设计决策\n\n重大架构变更请记录于 [决策记录](decisions/README.md)。架构图不代替决策理由。\n`,
    'docs/development.md':`# 开发与验证\n\n## 运行环境\n\n检测到的项目类型：${d.stack}。检测结果不保证命令可运行，需通过真实执行确认。\n\n项目运行前提、数据库及测试数据：\n\n{{REQUIRES_REVIEW:ENVIRONMENT_AND_FIXTURES}}\n\n不要提交真实密钥或生产数据。建议在 \`.env.example\` 中列出变量名和安全占位值。\n\n## 统一操作入口\n\n\`node .agentrepo/cli.mjs doctor\` 检查配置与待确认项。\n\`node .agentrepo/cli.mjs verify\` 执行 agentrepo.json 的实际检查，未配置的项目返回 SKIP。\n\`node .agentrepo/cli.mjs locate "关键字"\` 在真实代码中定位文件。\n\`node .agentrepo/cli.mjs docs check\` 检查文档链接与代码索引。\n\`node .agentrepo/cli.mjs docs check --strict\` 检查占位符和架构图的新鲜度。\n\`node .agentrepo/cli.mjs arch view --write\` 生成独立 HTML 架构图。\n\`node .agentrepo/cli.mjs eval run\` 执行已登记的回归检查。\n\n## 任务完成标准\n\n1. 修改前先定位相关源文件、测试与接口。\n2. 修改后执行相关测试和静态检查，并记录通过、失败及跳过项。\n3. 公共接口变化必须更新相应文档与回归测试。\n4. 长任务在 docs/plans 中留交接记录，不把调试日志整份提交。\n5. 未运行的检查不得表述为通过。\n`,
    'docs/decisions/README.md':'# 架构决策\n\n只记录难以从代码还原的设计理由。使用 [决策记录模板](_TEMPLATE.md)，填写背景、备选方案、决定、影响范围和验收。小修改不需要建立决策文件。\n',
    'docs/decisions/_TEMPLATE.md':'# 决策编号与标题\n\n状态：待决策\n\n## 背景\n\n{{DECISION_CONTEXT}}\n\n## 可选方案\n\n{{ALTERNATIVES_AND_TRADEOFFS}}\n\n## 决定及理由\n\n{{DECISION_AND_RATIONALE}}\n\n## 影响的代码与验证\n\n{{AFFECTED_PATHS_AND_TESTS}}\n',
    'docs/plans/README.md':'# 长期任务\n\n只有跨多次会话或复杂的开发任务需要保存计划。复制 [任务交接模板](_TEMPLATE.md) 为独立文件，保留任务边界、验收结果、剩余工作和阻塞项。\n',
    'docs/plans/_TEMPLATE.md':'# 任务名称\n\n状态：待开始\n\n## 目标与验收条件\n\n{{TASK_GOAL_AND_ACCEPTANCE}}\n\n## 修改范围\n\n{{AFFECTED_FILES_AND_MODULES}}\n\n## 已完成和验证结果\n\n{{VERIFIED_RESULTS}}\n\n## 未完成和下一步\n\n{{REMAINING_WORK_AND_BLOCKERS}}\n',
    'docs/code-map.md':mapText(root),
    'docs/architecture.html':renderArchitectureHtml(root,{skipCruiser:true}).html,
    '.agentrepo/architecture-template.html':architectureTemplate(),
    'eval/README.md':'# Evaluations\n\nRun `eval scenarios` for isolated failure fixtures, `eval dream` for deterministic repair simulation, and `eval audit` for labeled diagnostic accuracy.\n\n\`regressions.json\` contains executable scaffold-level checks. \`tasks.json\` holds agent coding tasks; acceptance must be independent of the agent.\n\nRun \`node .agentrepo/cli.mjs eval run\` to exercise deterministic cases.\nUse \`node .agentrepo/cli.mjs eval report --input <trials.json>\` for genuine model trials with measured token usage.\nUse \`eval add-failure\` to turn a reproduced read-only failure into a permanent executable regression case. Inspect \`incidents.json\` for confirmed tool regressions.\nNever claim the deterministic checks measure agent task completion or token consumption.\n',
    'eval/tasks.json':json({schemaVersion:1,tasks:[],instructions:'Specify task ID, repository commit, prompt, independent acceptance script, resources, and repetitions. Hold out expected patches.'}),
    'eval/incidents.json':json({schemaVersion:1,principle:'Every confirmed CLI defect should become a deterministic test before it is fixed.',incidents:[
      {id:'AR-001',cause:'Untracked source changes initially escaped doc drift checks',guard:'tests/scaffold.test.mjs: docs drift detects added untracked source',status:'fixed'},
      {id:'AR-002',cause:'Nested node:test context caused child test runs to be skipped',guard:'eval replay plus tests/replay.test.mjs',status:'fixed'},
      {id:'AR-003',cause:'Custom docs and extensionless Shell entrypoints were not monitored',guard:'tests/replay.test.mjs: domain links and shell doc review',status:'fixed'},
      {id:'AR-004',cause:'Unknown required checks were silently ignored',guard:'tests/replay.test.mjs: unknown required checks',status:'fixed'},
      {id:'AR-005',cause:'Eval promotion accepted a mutating CLI command that eval run would refuse',guard:'tests/replay.test.mjs: no mutating eval command',status:'fixed'},
      {id:'AR-006',cause:'Existing npm CLI docs use root-relative website routes; filesystem link audit wrongly flagged them',guard:'eval/scenarios.json site-routes-preserved and tests/scenarios.test.mjs',status:'fixed'},
      {id:'AR-007',cause:'npm-installed bin symlink was not recognized as CLI entrypoint, so commands silently exited',guard:'tests/install-entry.test.mjs: npm-style executable symlink',status:'fixed'},
      {id:'AR-008',cause:'Changing module boundaries after initial architecture generation left stale dependency-cruiser configuration',guard:'tests/architecture-sync.test.mjs',status:'fixed'},
      {id:'AR-009',cause:'Source locator failed to normalize execute/exec and handling/handler word forms',guard:'benchmarks/cases.json and tests/scenarios.test.mjs',status:'fixed'},
      {id:'AR-010',cause:'Long-running repair simulation updated code map but forgot the generated HTML architecture view',guard:'tests/replay.test.mjs plus eval view --check',status:'fixed'},
      {id:'AR-011',cause:'Existing custom architecture HTML could be overwritten by a generic view refresh',guard:'tests/visual-template.test.mjs',status:'fixed'}
    ]}),
    'eval/scenarios.json':json({schemaVersion:1,cases:DEFAULT_SCENARIOS}),
    'eval/regressions.json':json({schemaVersion:1,cases:[
      {id:'view',description:'Generated architecture HTML is current',argv:['arch','view','--check'],exitCode:0},
      {id:'doctor',description:'Project config remains valid',argv:['doctor'],exitCode:0},
      {id:'map',description:'Generated source index remains current',argv:['map','--check'],exitCode:0},
      {id:'docs',description:'Docs have valid local links',argv:['docs','check'],exitCode:0}
    ]}),
    '.agentrepo/cli.mjs':fs.readFileSync(fileURLToPath(import.meta.url),'utf8'),
    '.agentrepo/.gitignore':'cache/\nreports/\n',
    '.github/workflows/agentrepo.yml':`name: AgentRepo static checks\non:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  agentrepo:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '22'\n      - run: node .agentrepo/cli.mjs doctor\n      - run: node .agentrepo/cli.mjs map --check\n      - run: node .agentrepo/cli.mjs arch view --check\n      - run: node .agentrepo/cli.mjs eval run\n      - run: node .agentrepo/cli.mjs eval scenarios\n      - name: Source-doc drift\n        if: github.event_name == 'pull_request'\n        env:\n          BASE_SHA: \${{ github.event.pull_request.base.sha }}\n        run: node .agentrepo/cli.mjs docs check --base "$BASE_SHA"\n`
  };
}
function doInit(root, opts={}) {
  root=path.resolve(root);if(fs.existsSync(root) && (!fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()))throw new Error('Target must be a real directory');
  if(!fs.existsSync(root)&&!opts['dry-run'])fs.mkdirSync(root,{recursive:true});
  const files=template(root),created=[],preserved=[];
  // Plan the entire operation before mutating the target.
  for(const rel of Object.keys(files)) {const p=ensureSafeRel(root,rel);if(fs.existsSync(p))preserved.push(rel);else created.push(rel);}
  if(!opts['dry-run'])for(const rel of created)writeIfMissing(root,rel,files[rel]);
  const architecture=opts.arch && !opts['dry-run']?archInit(root,opts):undefined;
  return {root,created,preserved,dryRun:!!opts['dry-run'],architecture,warning:preserved.includes('AGENTS.md')?'AGENTS.md preserved; review the new guidance manually':undefined};
}
function config(root){const file=path.join(root,'agentrepo.json');if(!canRead(file))throw new Error(`No agentrepo.json in ${root}; run init`);const cfg=parseJson(file);if(![2].includes(cfg.version))throw new Error(`Unsupported config version: ${cfg.version}`);return cfg;}
function doDoctor(root){const c=config(root);const checks=[];
  for(const [name,argv] of Object.entries(c.commands||{})){checks.push({id:`command.${name}`,status:Array.isArray(argv)&&argv.length>0&&argv.every(x=>typeof x==='string'&&x)?'PASS':'FAIL'});}
  for(const d of ['AGENTS.md','docs/architecture.md','docs/development.md','docs/code-map.md','eval/regressions.json'])checks.push({id:d,status:canRead(path.join(root,d))?'PASS':'FAIL'});
  const allowedChecks=new Set(['setup','test','lint','typecheck','architecture','e2e']);
  for(const x of c.requiredChecks||[])if(!allowedChecks.has(x))checks.push({id:`required.${x}`,status:'FAIL',reason:'unknown verification check'});
  checks.push({id:'configured.tests',status:c.commands?.test?'PASS':'SKIP'});
  return {checks,pending:placeholderStatus(root),ok:!checks.some(x=>x.status==='FAIL')};
}
function managedDocs(root) {
  // Do not reinterpret existing application/site documentation as filesystem paths.
  // Projects like npm CLI use root-relative documentation website routes.
  const c=config(root);
  const prefixes=['docs/decisions/','docs/plans/','docs/domains/'];
  const explicit=new Set(['AGENTS.md','docs/architecture.md','docs/development.md','docs/code-map.md',...(c.docRules||[]).map(r=>r.doc)]);
  return walkFiles(root).filter(x=>x.endsWith('.md')&&(explicit.has(x)||prefixes.some(p=>x.startsWith(p))));
}
function mdLinks(root) {const issues=[];const docs=managedDocs(root);
  for(const f of docs){const txt=fileText(path.join(root,f));const re=/\[[^\]]*\]\(([^)]+)\)/g;for(const m of txt.matchAll(re)){
    const target=m[1].split('#')[0].split('?')[0];if(!target||target.startsWith('/')||/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(target)||target.startsWith('#'))continue;
    let decoded;try {decoded=decodeURIComponent(target);}catch {issues.push({file:f,target,error:'invalid URI encoding'});continue;}
    // Treat root-relative URLs in custom managed docs as site routes, not local paths.
    if(decoded.startsWith('/'))continue;
    const candidate=path.resolve(path.dirname(path.join(root,f)),decoded);
    if(!candidate.startsWith(path.resolve(root)+path.sep)&&candidate!==path.resolve(root)){issues.push({file:f,target,error:'outside repository'});continue;}
    if(!fs.existsSync(candidate))issues.push({file:f,target,error:'missing target'});
    else {let walk=path.resolve(root);for(const part of path.relative(walk,candidate).split(path.sep)){if(!part)continue;walk=path.join(walk,part);try{if(fs.lstatSync(walk).isSymbolicLink()){issues.push({file:f,target,error:'symlink target'});break;}}catch{break;}}}
  }}return issues;
}
function globRegex(glob){const s=clean(glob);let re='^';for(let i=0;i<s.length;i++){
  if(s[i]==='*'&&s[i+1]==='*'){i++;if(s[i+1]==='/'){i++;re+='(?:.*/)?';}else re+='.*';}
  else if(s[i]==='*')re+='[^/]*';else if(s[i]==='?')re+='[^/]';else re+=s[i].replace(/[\\^$+?.()|{}\[\]]/g,'\\$&');
}return new RegExp(re+'$');}
const globsMatch=(file,globs)=>globs.some(g=>globRegex(g).test(file));
function gitExec(root, argv){const r=spawnSync('git',argv,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});if(r.status!==0)throw new Error(`git ${argv[0]} failed: ${r.stderr?.trim()}`);return r.stdout.trim();}
function changed(root,base){
  if(typeof base!=='string' || !/^(?:[0-9a-f]{7,64}|[A-Za-z0-9][A-Za-z0-9._/-]*)$/.test(base) || base.includes('..'))throw new Error('Unsafe git base revision');
  // Include tracked modifications, deletions and new untracked files. A new source
  // file should invalidate its documentation even before `git add`.
  const tracked=gitExec(root,['diff','--name-only',base,'--']).split('\n').filter(Boolean);
  const untracked=gitExec(root,['ls-files','--others','--exclude-standard','--']).split('\n').filter(Boolean);
  return [...new Set([...tracked,...untracked].map(clean))].sort();
}
function proof(root,base,rule,affected){const items=affected.map(f=>[f,fs.existsSync(path.join(root,f))&&canRead(path.join(root,f))?sha(fs.readFileSync(path.join(root,f))):'missing']);
  return sha(json({base,rule:rule.id,files:items,doc:canRead(path.join(root,rule.doc))?sha(fs.readFileSync(path.join(root,rule.doc))):'missing'}));
}
function drift(root,base){const c=config(root);const changedFiles=changed(root,base);const issues=[];const reviewed=[];
  for(const rule of c.docRules||[]){const affected=changedFiles.filter(f=>globsMatch(f,rule.watch||[]));if(!affected.length)continue;
    if(changedFiles.includes(rule.doc)){reviewed.push({rule:rule.id,result:'doc-changed-requires-human-semantic-review',affected});continue;}
    const rev=path.join(root,'.agentrepo','reviews',`${rule.id}.json`);
    if(canRead(rev)) {const entry=parseJson(rev);if(entry.proof===proof(root,base,rule,affected)&&entry.reason?.trim().length>=20){reviewed.push({rule:rule.id,result:'attested',affected});continue;}}
    issues.push({rule:rule.id,doc:rule.doc,affected,reason:'Code changed without corresponding document change or valid review attestation'});
  }
  return {base,issues,reviewed,changedFiles,ok:issues.length===0};
}
function doReview(root,base,id,reason){if(!reason || reason.trim().length<20)throw new Error('Review reason must have at least 20 characters');const c=config(root);const rule=(c.docRules||[]).find(x=>x.id===id);if(!rule)throw new Error(`Unknown doc rule ${id}`);if(!/^[a-z0-9_-]+$/i.test(id))throw new Error('Unsafe review rule ID');const files=changed(root,base).filter(f=>globsMatch(f,rule.watch||[]));if(!files.length)throw new Error('No changed files match the review rule');const payload={schemaVersion:1,rule:id,base,reason,files,proof:proof(root,base,rule,files),createdAt:new Date().toISOString()};const dir=path.join(root,'.agentrepo','reviews');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${id}.json`),json(payload));return payload;}
function doDocs(root,opts={}) {const c=config(root),issues=[];const links=mdLinks(root);for(const item of links)issues.push({type:'link',...item});
  if(!canRead(path.join(root,'docs/code-map.md')) || fileText(path.join(root,'docs/code-map.md'))!==mapText(root))issues.push({type:'stale-map',file:'docs/code-map.md'});
  for(const rule of c.docRules||[]){if(!canRead(path.join(root,rule.doc)))issues.push({type:'missing-doc',file:rule.doc});if(!Array.isArray(rule.watch)||!rule.watch.length)issues.push({type:'unwatched-rule',rule:rule.id});}
  const ids=(c.docRules||[]).map(r=>r.id);if(new Set(ids).size!==ids.length)issues.push({type:'duplicate-rule'});
  if(opts.strict){
    const html=path.join(root,'docs/architecture.html');
    if(!canRead(html)||(fileText(html).includes('name="agentrepo-source-hash"')&&!fileText(html).includes(`name="agentrepo-source-hash" content="${sourceFingerprint(root)}"`)))
      issues.push({type:'stale-architecture-visual',file:'docs/architecture.html',hint:'Run agentrepo arch view --write'});
    for(const p of placeholderStatus(root))issues.push({type:'unresolved-placeholder',...p});
  }
  let change=null;if(opts.base){change=drift(root,opts.base);for(const item of change.issues)issues.push({type:'drift',...item});}
  return {ok:issues.length===0,issues,change,pending:placeholderStatus(root)};
}
function testCommand(root,argv,timeout=120000){if(!Array.isArray(argv)||argv.length===0||!argv.every(x=>typeof x==='string'))throw new Error('Command must be nonempty argv array');const started=Date.now();const env={...process.env,CI:'1'};delete env.NODE_TEST_CONTEXT;const r=spawnSync(argv[0],argv.slice(1),{cwd:root,encoding:'utf8',shell:false,timeout,env,maxBuffer:2*1024*1024});return {exitCode:r.status??-1,seconds:Number(((Date.now()-started)/1000).toFixed(3)),output:((r.stdout||'')+(r.stderr||'')).slice(-2000),error:r.error?.message};}
function doVerify(root,opts={}){const c=config(root),results=[];const required=new Set([...(c.requiredChecks||[]),...(opts.require?String(opts.require).split(','):[])]);
  for(const key of ['setup','test','lint','typecheck','architecture','e2e']){
    if(key==='setup'&&!opts['include-setup'])continue;
    const argv=c.commands?.[key];if(!argv){results.push({name:key,status:required.has(key)?'FAIL':'SKIP',reason:'not configured'});continue;}
    const result=testCommand(root,argv,Number(opts.timeout)||120000);results.push({name:key,status:result.exitCode===0?'PASS':'FAIL',...result});
  }
  return {results,ok:!results.some(x=>x.status==='FAIL')};
}

// dependency-cruiser is optional and installed in the *target* JS repository.
// Never download it implicitly, mutate package dependencies or claim a skipped check passed.
function hasJsSource(root) {return sourceFiles(root).some(f=>/\.(?:js|jsx|cjs|mjs|ts|tsx|mts|cts)$/.test(f)&&!/(^|\/)(?:test|tests|__tests__|fixtures)\//.test(f));}
function architectureRules(root){
  const rules={forbidden:[
    {name:'no-circular',severity:'error',comment:'Avoid cyclic module dependencies',from:{},to:{circular:true}},
    {name:'no-unresolved',severity:'warn',comment:'Investigate unresolved imports',from:{},to:{couldNotResolve:true}}
  ],options:{doNotFollow:{path:'node_modules'},exclude:'(?:^|/)(?:node_modules|dist|build|coverage|\\.next)(?:/|$)'}};
  const custom=config(root).architecture?.forbiddenImports||[];
  for(const item of custom){
    if(!item || typeof item.from!=='string' || typeof item.to!=='string' || !item.from || !item.to) throw new Error('Invalid forbiddenImports entry');
    rules.forbidden.push({name:`boundary-${rules.forbidden.length}`,severity:'error',comment:item.reason||'Module boundary violation',from:{path:item.from},to:{path:item.to}});
  }
  return rules;
}
function archStateFile(root){return path.join(root,'.agentrepo','arch-state.json');}
function archInit(root,opts={}) {
  if(!hasJsSource(root))return {ok:true,status:'SKIP',reason:'No non-test JavaScript or TypeScript source files detected'};
  const configRel='.dependency-cruiser.json',payload=json(architectureRules(root));
  const created=writeIfMissing(root,configRel,payload,!!opts['dry-run']);
  if(!opts['dry-run']){
    if(created){const state=archStateFile(root);ensureSafeRel(root,'.agentrepo/arch-state.json');fs.mkdirSync(path.dirname(state),{recursive:true});fs.writeFileSync(state,json({schemaVersion:1,sha256:sha(payload)}),{flag:'wx'});}
    const c=config(root);c.commands??={};
    if(!c.commands.architecture){c.commands.architecture=['node','.agentrepo/cli.mjs','arch','check','--strict'];fs.writeFileSync(path.join(root,'agentrepo.json'),json(c));}
  }
  return {ok:true,status:'PASS',created,config:configRel,configured:!opts['dry-run'],installation:'npm install --save-dev dependency-cruiser',notice:created?'Arch config generated; install dependency-cruiser before verify':'Arch config preserved. Use arch sync after editing agentrepo.json architecture boundaries.'};
}
function archSync(root,opts={}){
  if(!hasJsSource(root))return {ok:true,status:'SKIP',reason:'No JS or TS source code'};
  const conf=path.join(root,'.dependency-cruiser.json'),stateFile=archStateFile(root);
  if(!canRead(conf)||!canRead(stateFile))return {ok:false,status:'FAIL',reason:'No managed architecture config or state. Run arch init; existing user-authored configs are not overwritten.'};
  ensureSafeRel(root,'.dependency-cruiser.json',false);ensureSafeRel(root,'.agentrepo/arch-state.json',false);
  const state=parseJson(stateFile),current=fileText(conf);
  if(state.schemaVersion!==1||state.sha256!==sha(current))return {ok:false,status:'FAIL',reason:'Architecture configuration was modified outside AgentRepo; refusing to overwrite. Review or restore the config before sync.'};
  const next=json(architectureRules(root));
  if(!opts['dry-run']){fs.writeFileSync(conf,next);fs.writeFileSync(stateFile,json({schemaVersion:1,sha256:sha(next)}));}
  return {ok:true,status:'PASS',changed:next!==current,dryRun:!!opts['dry-run']};
}
function archCheck(root,opts={}){
  const cfg=config(root);
  if(!hasJsSource(root))return {ok:true,status:'SKIP',reason:'No JS or TS source code'};
  const configFile=path.join(root,'.dependency-cruiser.json');
  if(fs.existsSync(configFile))ensureSafeRel(root,'.dependency-cruiser.json',false);
  if(!canRead(configFile))return {ok:!opts.strict,status:opts.strict?'FAIL':'SKIP',reason:'No .dependency-cruiser.json; run agentrepo arch init'};
  if(canRead(archStateFile(root))){
    const state=parseJson(archStateFile(root));
    if(state.sha256!==sha(fileText(configFile))||fileText(configFile)!==json(architectureRules(root)))return {ok:false,status:'FAIL',reason:'Managed architecture rules are stale or modified. Run agentrepo arch sync before verification.'};
  }
  const binary=path.join(root,'node_modules','.bin',process.platform==='win32'?'depcruise.cmd':'depcruise');
  if(!fs.existsSync(binary))return {ok:!opts.strict,status:opts.strict?'FAIL':'SKIP',reason:'dependency-cruiser missing. Install as a local dev dependency. No automatic downloads.'};
  const rootCandidates=(cfg.sourceRoots||[]).filter(x=>x!=='.'&&fs.existsSync(path.join(root,x)) && fs.statSync(path.join(root,x)).isDirectory());
  const roots=(rootCandidates.length?rootCandidates:['.']).filter(x=>sourceFiles(root).some(f=>x==='.'||f.startsWith(x+'/')));
  const r=testCommand(root,[binary,...roots,'--config','.dependency-cruiser.json','--output-type','err'],Number(opts.timeout)||120000);
  return {ok:r.exitCode===0,status:r.exitCode===0?'PASS':'FAIL',exitCode:r.exitCode,output:r.output,seconds:r.seconds,error:r.error};
}
function segments(str){return clean(String(str)).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._/\-]+/g,' ').toLowerCase().match(/[a-z][a-z0-9]*|[0-9]+/g)||[];}
function tokens(text){return segments(text).filter(x=>!STOPWORDS.has(x)&&x.length>1).map(x=>{
  if(['execute','executing','executed','execution','executable','exec'].includes(x))return 'exec';
  if(['handling','handler','handled','handles','handle'].includes(x))return 'handle';
  if(['failure','failed','fails','failing','fail'].includes(x))return 'fail';
  if(['configuration','configured','configurations','configuring','config'].includes(x))return 'config';
  return x.endsWith('ies')?x.slice(0,-3)+'y':x.endsWith('s')&&x.length>4&&!x.endsWith('ss')?x.slice(0,-1):x;
});}
function keywordCounts(filePath,sourceRoot,mode='enhanced') {
  const scores=new Map();const add=(word,weight)=>scores.set(word,(scores.get(word)||0)+weight);
  for(const t of tokens(path.basename(filePath)))add(t,18);
  if(mode!=='filename') {
    for(const t of tokens(filePath))add(t,3);
    // Read a bounded source sample to index discoverable code identifiers and comments.
    let content='';try {const fd=fs.openSync(path.join(sourceRoot,filePath),'r');const b=Buffer.alloc(60000);const n=fs.readSync(fd,b,0,b.length,0);fs.closeSync(fd);content=b.subarray(0,n).toString('utf8');}catch{}
    const fr=new Map();for(const t of tokens(content).slice(0,11000))fr.set(t,(fr.get(t)||0)+1);
    for(const [t,n] of fr)add(t,Math.min(3,n)*0.5);
  }
  return scores;
}
function locate(root,query,opts={}) {
  const q=[...new Set(tokens(query))];const files=sourceFiles(root);const ranks=[];
  for(const f of files){const weights=keywordCounts(f,root,opts.mode||'enhanced');let score=0, hits=0;
    for(const t of q){if(weights.has(t)){hits++;score+=weights.get(t);}}
    if(!score)continue;
    score+=3*hits*hits/Math.max(1,q.length);score-=0.002*f.length;
    // Prefer filenames matching the beginning of a developer's task description.
    // This avoids high-frequency mentions in large unrelated files dominating clear module names.
    if(opts.mode!=='filename' && q.length>1){
      const names=tokens(path.basename(f,path.extname(f)));
      for(let i=0;i<names.length-1;i++){
        const pair=[names[i],names[i+1]];
        for(let j=0;j<q.length-1;j++)if(pair[0]===q[j]&&pair[1]===q[j+1])score+=j===0?16:5;
      }
    }
    // Implementation queries should not be crowded out by similarly named test fixtures.
    if(opts.mode!=='filename' && /^(test|tests)\//.test(f) && !/\b(test|tests|spec|regression)\b/i.test(query)) score*=0.08;
    if(opts.mode!=='filename' && /\.(json|ya?ml|html|css)$/.test(f) && !/\b(config|configuration|html|css|style|json|yaml)\b/i.test(query)) score*=0.6;
    ranks.push({file:f,score:Number(score.toFixed(3)),matched:hits});
  }
  ranks.sort((a,b)=>b.score-a.score||a.file.localeCompare(b.file));return {query,mode:opts.mode||'enhanced',total:files.length,results:ranks.slice(0,Number(opts.k)||5)};
}
const EVAL_COMMANDS = new Set(['doctor','map','docs','locate','verify','arch']);
function readOnlyEvalArgv(argv){
  if (!Array.isArray(argv) || !argv.every(a=>typeof a==='string')) return false;
  const [head,sub,...rest]=argv;
  if(head==='doctor' || head==='map') return argv.length===1 || (head==='map' && argv.length===2 && sub==='--check');
  if(head==='docs')return sub==='check' && rest.length===0;
  if(head==='arch')return sub==='view' && rest.length===1 && rest[0]==='--check';
  if(head==='locate')return typeof sub==='string' && !sub.startsWith('--') && argv.slice(2).every(x=>/^--(?:k|mode|json)(?:=.+)?$/.test(x));
  return false;
}
function runEval(root,file){const data=parseJson(file);if(data.schemaVersion!==1||!Array.isArray(data.cases))throw new Error('Invalid eval case file');const results=[];
  for(const c of data.cases){if(!/^[\w-]+$/.test(c.id)||!Array.isArray(c.argv)||c.argv.length<1)throw new Error(`Invalid case: ${c.id}`);
    if(!readOnlyEvalArgv(c.argv))throw new Error('Eval command disallowed. Only strictly read-only commands are allowed.');
    const r=testCommand(root,['node',path.join(root,'.agentrepo','cli.mjs'),...c.argv],Math.min(c.timeoutMs||30000,120000));
    const passed=r.exitCode===c.exitCode&&(c.contains===undefined||r.output.includes(c.contains));results.push({id:c.id,passed,...r});
  }return {ok:results.every(r=>r.passed),results,total:results.length,passed:results.filter(r=>r.passed).length};
}
function addFailure(root,opts){const file=path.join(root,'eval','regressions.json'),cases=parseJson(file);const id=opts.id,arr=JSON.parse(opts.argv||'null');if(!/^[\w-]+$/.test(id||''))throw new Error('A safe --id is required');if(!Array.isArray(arr)||!arr.length||!arr.every(x=>typeof x==='string'))throw new Error('--argv must be JSON array of strings');if(cases.cases.some(x=>x.id===id))throw new Error('Duplicate eval ID');if(!readOnlyEvalArgv(arr))throw new Error('Eval add-failure disallows mutating or arbitrary commands');const out={id,description:opts.description||'Captured regression',argv:arr,exitCode:Number(opts.exit??0)};if(opts.contains)out.contains=opts.contains;cases.cases.push(out);fs.writeFileSync(file,json(cases));return out;}
function locationEval(root,file,mode='enhanced',k=3){const data=parseJson(file);if(!Array.isArray(data.cases))throw new Error('Location cases must have cases array');const records=[];
  for(const c of data.cases){if(!canRead(path.join(root,c.expected)))throw new Error(`Ground truth path missing: ${c.expected}`);const res=locate(root,c.query,{mode,k:Math.max(k,5)});const rank=res.results.findIndex(x=>x.file===c.expected);records.push({id:c.id,query:c.query,expected:c.expected,rank:rank<0?null:rank+1,hit1:rank===0,hitK:rank>=0&&rank<k,top:res.results.slice(0,k).map(x=>x.file)});}
  return {mode,k,cases:records.length,hit1:records.filter(x=>x.hit1).length,hitK:records.filter(x=>x.hitK).length,hit1Rate:records.filter(x=>x.hit1).length/Math.max(records.length,1),hitKRate:records.filter(x=>x.hitK).length/Math.max(records.length,1),results:records};
}
function trialReport(file) {
  const x=parseJson(file);const trials=Array.isArray(x)?x:x.trials;
  if(!Array.isArray(trials)||!trials.length)throw new Error('No trials');
  const buckets={baseline:new Map(),improved:new Map()};
  for(const t of trials){
    if(!['baseline','improved'].includes(t.group)||typeof t.success!=='boolean'||!t.taskId||!Number.isInteger(t.repeat)||t.repeat<0)throw new Error('Trials require group, taskId, repeat, success');
    const key=`${t.taskId}#${t.repeat}`;
    if(buckets[t.group].has(key))throw new Error(`Duplicate trial: ${t.group}/${key}`);
    if(t.tokens!==undefined&&(!Number.isFinite(t.tokens)||t.tokens<0))throw new Error('Invalid token count');
    buckets[t.group].set(key,t);
  }
  const a=[...buckets.baseline.values()],b=[...buckets.improved.values()];
  const roll=items=>({n:items.length,successful:items.filter(t=>t.success).length,successRate:items.length?items.filter(t=>t.success).length/items.length:null,meanTokens:items.length&&items.every(t=>Number.isFinite(t.tokens))?items.reduce((sum,t)=>sum+t.tokens,0)/items.length:null,meanSeconds:items.length&&items.every(t=>Number.isFinite(t.seconds))?items.reduce((sum,t)=>sum+t.seconds,0)/items.length:null,meanInterventions:items.length&&items.every(t=>Number.isFinite(t.interventions))?items.reduce((sum,t)=>sum+t.interventions,0)/items.length:null});
  const keys=[...buckets.baseline.keys()];
  const comparable=keys.length>0&&keys.length===buckets.improved.size&&keys.every(k=>buckets.improved.has(k))&&keys.every(k=>{
    const l=buckets.baseline.get(k),r=buckets.improved.get(k);
    return l.model===r.model&&l.taskVersion===r.taskVersion&&l.environment===r.environment;
  });
  const base=roll(a),improved=roll(b);
  return {baseline:base,improved,comparable,tokenReductionRate:comparable&&base.meanTokens!==null&&improved.meanTokens!==null&&base.meanTokens>0?1-improved.meanTokens/base.meanTokens:null,notice:'This report only calculates token reduction from measured per-run usage, with task/repeat/model/version/environment pairing. No model usage is inferred.'};
}
// Deterministic 'dream' replay: an isolated, simulated coding-agent lifecycle.
// This is a real execution of edit/verify/fail/repair/docs/eval/handoff stages.
// No LLM is invoked; its results MUST NOT be reported as model accuracy.
function scenarioEval(casesFile=null) {
  const data=casesFile?parseJson(casesFile):{schemaVersion:1,cases:DEFAULT_SCENARIOS};
  if(data.schemaVersion!==1||!Array.isArray(data.cases)||data.cases.length>120)throw new Error('Invalid scenario suite');
  const report=[];
  for(const spec of data.cases){
    if(!/^[a-z0-9_-]+$/i.test(spec.id||'')||!Array.isArray(spec.steps)||spec.steps.length>30)throw new Error('Invalid scenario case');
    const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-scenario-'));const events=[];
    try{
      if(Object.keys(spec.files||{}).length>100)throw new Error('Too many fixture files');
      for(const [file,content] of Object.entries(spec.files||{})){
        if(typeof content!=='string'||content.length>100000)throw new Error('Invalid fixture content');
        const dest=ensureSafeRel(tmp,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content,{flag:'wx'});
      }
      for(const step of spec.steps){
        let actual=false;
        switch(step.action){
          case 'init':actual=doInit(tmp).created.length>0;break;
          case 'init-again':actual=doInit(tmp).created.length===0;break;
          case 'docs-check':actual=doDocs(tmp).ok;break;
          case 'map-write': {const out=ensureSafeRel(tmp,'docs/code-map.md');fs.writeFileSync(out,mapText(tmp));actual=true;break;}
          case 'write': {if(typeof step.content!=='string'||step.content.length>100000)throw new Error('Unsafe write action');const out=ensureSafeRel(tmp,step.path);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,step.content);actual=true;break;}
          case 'contains':actual=canRead(ensureSafeRel(tmp,step.path))&&fileText(path.join(tmp,step.path))===step.content;break;
          case 'arch-init':actual=archInit(tmp).status==='PASS';break;
          case 'arch-skip':actual=archInit(tmp).status==='SKIP';break;
          case 'arch-config':actual=canRead(path.join(tmp,'.dependency-cruiser.json'))&&parseJson(path.join(tmp,'.dependency-cruiser.json')).forbidden.some(r=>r.name==='no-circular');break;
          default:throw new Error(`Disallowed scenario action: ${step.action}`);
        }
        events.push({action:step.action,expected:step.expect,actual,passed:actual===step.expect});
      }
    }finally{fs.rmSync(tmp,{recursive:true,force:true});}
    report.push({id:spec.id,description:spec.description,passed:events.every(x=>x.passed),events});
  }
  return {method:'deterministic synthetic scenarios; NO MODEL EXECUTION',ok:report.every(x=>x.passed),passed:report.filter(x=>x.passed).length,total:report.length,results:report};
}
function replayDream(){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-replay-'));
  const events=[];const add=(phase,expected,actual,detail)=>events.push({phase,expected,actual,passed:expected===actual,detail});
  const project=path.join(temp,'app');
  const write=(rel,data)=>{const dst=ensureSafeRel(project,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,data);};
  try{
    fs.mkdirSync(project,{recursive:true});
    add('understand: initialize empty repo',true,doInit(project).created.length>=13);
    add('understand: valid config',true,doDoctor(project).ok);
    write('src/math.mjs','export const add = (a,b) => a-b;\n');
    write('tests/math.test.mjs',"import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {add} from '../src/math.mjs';\ntest('regression: addition',()=>assert.equal(add(2,3),5));\n");
    let cf=config(project);cf.commands.test=['node','--test','tests/math.test.mjs'];cf.requiredChecks=['test'];write('agentrepo.json',json(cf));
    add('locate: identify changed implementation',true,locate(project,'math addition').results.some(x=>x.file==='src/math.mjs'));
    const failing=doVerify(project);
    add('observe: incorrect function fails independent tests',true,failing.results.some(x=>x.name==='test'&&x.status==='FAIL'));
    write('src/math.mjs','export const add = (a,b) => a+b;\n');
    add('repair: correction passes test',true,doVerify(project).results.some(x=>x.name==='test'&&x.status==='PASS'));
    add('docs: changed tree triggers stale index',true,doDocs(project).issues.some(x=>x.type==='stale-map'));
    write('docs/code-map.md',mapText(project));
    archView(project,{write:true});
    add('docs: regenerating index restores consistency',true,doDocs(project).ok);
    const old=doInit(project);
    add('handoff: repeated init is idempotent',true,old.created.length===0);
    const regression=runEval(project,path.join(project,'eval/regressions.json'));
    add('eval: permanent read-only regression cases',true,regression.ok&&regression.total===4);
    write('eval/adversarial.json',json({schemaVersion:1,cases:[{id:'hostile',argv:['docs','review','--id','architecture'],exitCode:0}]}));
    let prevented=false;try{runEval(project,path.join(project,'eval/adversarial.json'));}catch(e){prevented=/disallow/.test(e.message);}
    add('safety: replay rejects a mutating eval case',true,prevented);
    const handoff={scope:'repair arithmetic',completed:['locate source','run failing test','repair','verify','regressions'],remaining:[],verification:{test:'PASS',docs:'PASS'},blockers:[]};
    write('docs/plans/replay-handoff.json',json(handoff));
    add('handoff: state can be read by a fresh process',true,parseJson(path.join(project,'docs/plans/replay-handoff.json')).verification.test==='PASS');
    const count=events.filter(e=>e.passed).length;
    return {ok:count===events.length,method:'deterministic isolated agent lifecycle replay; NO MODEL EXECUTION',passed:count,total:events.length,events};
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
// Diagnostic accuracy evaluation, independent of code-location hit rate.
// Fault labels are known to this harness; samples are deterministic and isolated.
function auditEval(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-audit-'));const cases=[];
  const add=(id,truth,predicted,detail)=>cases.push({id,truth:!!truth,predicted:!!predicted,correct:!!truth===!!predicted,detail});
  const fresh=(name,initial={})=>{const dir=path.join(tmp,name);fs.mkdirSync(dir,{recursive:true});for(const [f,body] of Object.entries(initial)){const d=path.join(dir,f);fs.mkdirSync(path.dirname(d),{recursive:true});fs.writeFileSync(d,body);}doInit(dir);return dir;};
  const write=(root,f,txt)=>{const p=ensureSafeRel(root,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,txt);};
  try{
    let r=fresh('empty');add('clean-init',false,!doDoctor(r).ok||!doDocs(r).ok);
    r=fresh('map',{ 'src/a.js':'export default 1;\n'});add('clean-code-map',false,!doDocs(r).ok);write(r,'src/new.js','export default 2;\n');add('stale-code-map',true,doDocs(r).issues.some(x=>x.type==='stale-map'));
    r=fresh('links');write(r,'docs/domains/auth.md','# Auth\n\n[valid](../architecture.md)\n');add('valid-local-link',false,!doDocs(r).ok);write(r,'docs/domains/auth.md','# Auth\n\n[broken](../missing.md)\n');add('broken-local-link',true,doDocs(r).issues.some(x=>x.type==='link'));
    r=fresh('site-routes',{'docs/content/getting-started.md':'[npm command](/commands/npm)\n'});add('site-route-not-a-file',false,!doDocs(r).ok);
    r=fresh('bad-uri');write(r,'docs/architecture.md','# Architecture\n\n[broken](oops%ZZ.md)\n');add('invalid-uri-encoding',true,doDocs(r).issues.some(x=>x.error==='invalid URI encoding'));
    r=fresh('required');add('optional-test-absent',false,!doVerify(r).ok);add('missing-required-test',true,!doVerify(r,{require:'test'}).ok);
    r=fresh('bad-config');const configFile=path.join(r,'agentrepo.json');const cfg=parseJson(configFile);cfg.requiredChecks=['nonexistent'];write(r,'agentrepo.json',json(cfg));add('unknown-required-check',true,!doDoctor(r).ok);
    r=fresh('arch',{ 'src/a.js':'import "./b.js";\n' });add('unconfigured-arch-is-skip',false,!archCheck(r).ok);archInit(r);add('strict-arch-missing-tool',true,!archCheck(r,{strict:true}).ok);
    r=fresh('shell',{ 'nvm-exec':'#!/bin/sh\necho before\n' });const git=(...x)=>gitExec(r,x);git('init','-q');git('config','user.email','audit@example.test');git('config','user.name','Audit');git('add','.');git('commit','-qm','init');const base=git('rev-parse','HEAD');add('clean-drift',false,!doDocs(r,{base}).ok);write(r,'nvm-exec','#!/bin/sh\necho after\n');add('changed-extensionless-entrypoint',true,doDocs(r,{base}).issues.some(x=>x.type==='drift'));
    const tp=cases.filter(x=>x.truth&&x.predicted).length,tn=cases.filter(x=>!x.truth&&!x.predicted).length,fp=cases.filter(x=>!x.truth&&x.predicted).length,fn=cases.filter(x=>x.truth&&!x.predicted).length;
    return {ok:fp===0&&fn===0,suite:'known-fault diagnostic fixtures (not coding-agent accuracy)',matrix:{tp,tn,fp,fn},accuracy:(tp+tn)/cases.length,precision:tp/(tp+fp||1),recall:tp/(tp+fn||1),cases};
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
function usage(){return `AgentRepo Kit ${VERSION}\nCommands:\n  agentrepo init [dir] [--dry-run] [--arch] [--json]\n  agentrepo doctor [--json]\n  agentrepo map [--check] [--json]\n  agentrepo locate "query" [--k 5] [--mode filename|enhanced] [--json]\n  agentrepo docs check [--base SHA] [--json]\n  agentrepo docs review --base SHA --id RULE --reason "..."\n  agentrepo arch init [--dry-run] / arch sync [--dry-run] / arch check [--strict]
  agentrepo arch view --write | --check [--input real-depcruise.json]
  agentrepo verify [--require test,lint] [--json]\n  agentrepo eval run [--cases eval/regressions.json] [--json]\n  agentrepo eval add-failure --id id --argv '["doctor"]' --exit 0\n  agentrepo eval locate --cases path/to/cases.json [--mode enhanced] [--k 3]\n  agentrepo eval scenarios [--cases eval/scenarios.json] (isolated fixture regression)
  agentrepo eval dream (deterministic repair and handoff simulation, not an LLM)
  agentrepo eval replay (alias for dream)
  agentrepo eval audit (known-fault detection precision/recall)
  agentrepo eval report --input trials.json\n`;}
function runCLI(tokens,root=process.cwd()){
  const {pos,opts}=argsOf(tokens),[head,sub,...rest]=pos;const jsonOut=!!opts.json;
  if(!head||['help','--help'].includes(head)||opts.help)return {help:usage(),ok:true};
  if(head==='version')return {version:VERSION,ok:true};
  if(head==='init')return {ok:true,...doInit(sub||'.',opts)};
  if(head==='doctor')return doDoctor(root);
  if(head==='map') {
    const t=mapText(root),file=path.join(root,'docs/code-map.md');if(opts.write){ensureSafeRel(root,'docs/code-map.md',false);fs.writeFileSync(file,t);return {ok:true,written:true};}
    const correct=canRead(file)&&fileText(file)===t;return {ok:correct,status:correct?'PASS':'FAIL',file:'docs/code-map.md',hint:'Run agentrepo map --write to regenerate'};
  }
  if(head==='locate') {if(!sub)throw new Error('locate requires query');return {ok:true,...locate(root,[sub,...rest].join(' '),opts)};}
  if(head==='docs'&&sub==='check')return doDocs(root,opts);
  if(head==='docs'&&sub==='review')return {ok:true,...doReview(root,opts.base,opts.id,opts.reason)};
  if(head==='arch'&&sub==='init')return archInit(root,opts);
  if(head==='arch'&&sub==='sync')return archSync(root,opts);
  if(head==='arch'&&sub==='check')return archCheck(root,opts);
  if(head==='arch'&&sub==='view')return archView(root,opts);
  if(head==='verify')return doVerify(root,opts);
  if(head==='eval'&&sub==='run')return runEval(root,path.resolve(root,opts.cases||'eval/regressions.json'));
  if(head==='eval'&&sub==='add-failure')return {ok:true,added:addFailure(root,opts)};
  if(head==='eval'&&sub==='locate')return {ok:true,...locationEval(root,path.resolve(root,opts.cases||'eval/location.json'),opts.mode||'enhanced',Number(opts.k)||3)};
  if(head==='eval'&&sub==='scenarios')return scenarioEval(path.resolve(root,opts.cases||'eval/scenarios.json'));
  if(head==='eval'&&['dream','replay'].includes(sub))return replayDream();
  if(head==='eval'&&sub==='audit')return auditEval();
  if(head==='eval'&&sub==='report')return {ok:true,...trialReport(path.resolve(root,opts.input||'eval/trials.json'))};
  throw new Error('Unknown command. Run agentrepo help.');
}
// Reused verbatim as a local project entrypoint. The CLI never needs npm install in the target.
// npm link and npm install expose this executable through a symlink. Compare real paths.
let entry='';try{entry=fs.realpathSync(process.argv[1]||'');}catch{entry=path.resolve(process.argv[1]||'');}
if(fs.realpathSync(fileURLToPath(import.meta.url))===entry){
  try{const parsed=argsOf(process.argv.slice(2));const r=runCLI(process.argv.slice(2));if(r.help)process.stdout.write(r.help);
    else if(parsed.opts.json)process.stdout.write(format(r,false)+'\n');
    else if(parsed.pos[0]==='locate')process.stdout.write(r.results.map(x=>`${x.score.toFixed(1)}\t${x.file}`).join('\n')+'\n');
    else process.stdout.write(format(r)+'\n');
    if(r.ok===false)process.exitCode=1;
  }catch(e){process.stderr.write(`agentrepo: ${e.message}\n`);process.exitCode=1;}
}
export {argsOf,doInit,doDoctor,doDocs,doVerify,drift,doReview,locate,locationEval,trialReport,runCLI,mapText,sourceFiles,globRegex,ensureSafeRel,runEval,archInit,archSync,archCheck,replayDream,scenarioEval,auditEval,readOnlyEvalArgv,renderArchitectureHtml,buildArchitectureData,archView,placeholderStatus};
