#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
const VERSION = '1.0.0-rc.2';
const SELF = fileURLToPath(import.meta.url);
const SOURCES = new Set(['src', 'app', 'apps', 'lib', 'libs', 'packages', 'internal', 'cmd', 'api', 'server', 'client', 'frontend', 'backend', 'tests', 'test', 'scripts']);
const OMIT = new Set(['.git', 'node_modules', '.next', '.nuxt', 'dist', 'build', 'out', 'coverage', '.venv', 'venv', 'vendor', 'target', '.cache', '.agentrepo', '.turbo']);
const exists = p => fs.existsSync(p);
const text = p => fs.readFileSync(p, 'utf8');
const json = p => JSON.parse(text(p));
const safeRoot = p => path.resolve(p || '.');
function isRealFile(p) { try {
    return fs.lstatSync(p).isFile();
}
catch {
    return false;
} }
function isRealDir(p) { try {
    return fs.lstatSync(p).isDirectory();
}
catch {
    return false;
} }
function protect(root, rel) { const parts = rel.split('/'); let dir = root; for (const name of parts) {
    dir = path.join(dir, name);
    if (exists(dir) && fs.lstatSync(dir).isSymbolicLink())
        throw new Error(`Symlink path blocked: ${rel}`);
} }
function walk(root, limit = 5000) { const output = []; const folders = [['', 0]]; while (folders.length && output.length < limit) {
    const [rel, depth] = folders.pop();
    let ents = [];
    try {
        ents = fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    }
    catch {
        continue;
    }
    for (const e of ents) {
        if (OMIT.has(e.name) || e.name.startsWith('.git') || e.isSymbolicLink())
            continue;
        const f = path.posix.join(rel, e.name);
        if (e.isFile())
            output.push(f);
        else if (e.isDirectory() && depth < 5)
            folders.push([f, depth + 1]);
        if (output.length >= limit)
            break;
    }
} return output.sort(); }
function makeTargets(root) { const f = path.join(root, 'Makefile'); if (!isRealFile(f))
    return new Set(); const out = new Set(); for (const l of text(f).split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z0-9_.-]+)\s*:(?!\=)/);
    if (m)
        out.add(m[1]);
} return out; }
function commandFor(pm, script) { return pm === 'npm' ? ['npm', 'run', script] : [pm, 'run', script]; }
function detect(root) {
    const files = new Set(walk(root));
    const res = { stack: [], packageManager: null, commands: { setup: null, dev: null, test: null, verify: null }, evidence: [], warnings: [] };
    const mk = makeTargets(root);
    const named = ['setup', 'dev', 'test', 'verify'];
    for (const n of named)
        if (mk.has(n)) {
            res.commands[n] = [['make', n]];
            res.evidence.push(`Makefile: ${n}`);
        }
    if (files.has('package.json')) {
        const p = json(path.join(root, 'package.json'));
        const lock = files.has('pnpm-lock.yaml') ? 'pnpm' : files.has('yarn.lock') ? 'yarn' : files.has('bun.lockb') || files.has('bun.lock') ? 'bun' : 'npm';
        const declared = typeof p.packageManager === 'string' ? p.packageManager.split('@')[0] : null;
        const pm = ['pnpm', 'yarn', 'npm', 'bun'].includes(declared) ? declared : lock;
        res.packageManager = pm;
        res.stack.push('Node.js');
        res.evidence.push('package.json');
        if (declared && declared !== lock && lock !== 'npm')
            res.warnings.push(`packageManager=${declared}, lockfile=${lock}: review before setup`);
        const scripts = p.scripts || {};
        const has = k => typeof scripts[k] === 'string' && !/^echo\s+["']?Error:/i.test(scripts[k]);
        const deps = [...(Object.keys(p.dependencies || {})), ...(Object.keys(p.devDependencies || {}))];
        if (deps.includes('next'))
            res.stack.push('Next.js');
        else if (deps.includes('vite'))
            res.stack.push('Vite');
        else if (deps.includes('react'))
            res.stack.push('React');
        if (!res.commands.setup)
            res.commands.setup = [[pm, ...(pm === 'npm' ? (files.has('package-lock.json') || files.has('npm-shrinkwrap.json') ? ['ci'] : ['install']) : pm === 'pnpm' ? (files.has('pnpm-lock.yaml') ? ['install', '--frozen-lockfile'] : ['install']) : pm === 'yarn' ? ['install'] : ['install'])]];
        if (!res.commands.dev && has('dev'))
            res.commands.dev = [commandFor(pm, 'dev')];
        else if (!res.commands.dev && has('start'))
            res.commands.dev = [commandFor(pm, 'start')];
        if (!res.commands.test && has('test'))
            res.commands.test = [commandFor(pm, 'test')];
        if (!res.commands.verify) {
            const steps = ['lint', 'typecheck', 'check', 'test'].filter(k => has(k) && k !== 'check:all').map(k => commandFor(pm, k));
            if (steps.length)
                res.commands.verify = steps;
        }
        if (has('verify') && !mk.has('verify'))
            res.commands.verify = [commandFor(pm, 'verify')];
    }
    if (files.has('go.mod')) {
        res.stack.push('Go');
        res.evidence.push('go.mod');
        res.commands.setup ||= [['go', 'mod', 'download']];
        res.commands.test ||= [['go', 'test', './...']];
        res.commands.verify ||= [['go', 'test', './...']];
    }
    if (files.has('Cargo.toml')) {
        res.stack.push('Rust');
        res.evidence.push('Cargo.toml');
        res.commands.setup ||= [['cargo', 'fetch']];
        res.commands.test ||= [['cargo', 'test']];
        res.commands.verify ||= [['cargo', 'fmt', '--check'], ['cargo', 'test']];
    }
    if (files.has('pyproject.toml') || files.has('requirements.txt')) {
        res.stack.push('Python');
        res.evidence.push(files.has('pyproject.toml') ? 'pyproject.toml' : 'requirements.txt');
        if (!res.commands.test)
            res.warnings.push('Python test runner not inferred; configure agentrepo.json.commands.test');
    }
    if (!res.stack.length)
        res.stack.push('Unknown');
    if (!res.commands.verify && res.commands.test)
        res.commands.verify = res.commands.test;
    return res;
}
function directoryMap(root) { const files = walk(root); const dirs = [...new Set(files.map(f => f.split('/')[0]).filter(n => SOURCES.has(n)))].sort(); return dirs.map(dir => ({ path: dir + '/', files: files.filter(f => f.startsWith(dir + '/')).length })); }
function sourceDigest(root) { const m = directoryMap(root), f = walk(root).filter(s => s.match(/\.(?:[cm]?[jt]sx?|py|go|rs|sh)$/)); return crypto.createHash('sha256').update(JSON.stringify({ m, f })).digest('hex').slice(0, 16); }
function archBlock(root) { const d = directoryMap(root); const lines = ['<!-- agentrepo:map:start -->', `Source map fingerprint: \`${sourceDigest(root)}\``, '', '| Path | Files | Responsibility |', '| --- | ---: | --- |', ...(d.length ? d.map(x => `| \`${x.path}\` | ${x.files} | 待项目维护者确认 |`) : ['| 未发现常见源码目录 | 0 | 新项目可在添加代码后更新 |']), '<!-- agentrepo:map:end -->']; return lines.join('\n'); }
const PROJECT_TEMPLATES = Object.freeze({
  "AGENTS.md": "# {{PROJECT_NAME}}\n\n## 优先级\n\n先遵守本仓库已有的明确限制和任务授权。项目专属约束经维护者确认后写在本文件；通用执行步骤如下。不要用模板内容覆盖已有规则。\n\n## 项目上下文\n\n- 项目目标与使用者：`README.md`。\n- 模块入口与边界：`docs/architecture.md`。\n- 环境与命令：`docs/development.md`；可执行配置以 `agentrepo.json.commands` 为准。\n- 工作目录：仓库根目录。只读取任务相关的文件与测试。\n\n## 执行步骤\n\n1. 读取任务要求、相关代码和现有测试；通过 `node .agentrepo/cli.mjs locate \"关键词\"` 辅助定位。\n2. 确认影响的入口、调用方及公开接口；修改范围限制在任务相关文件。\n3. 对行为变化补充或修改能验证结果的测试；按仓库既有约定执行。\n4. 执行 `node .agentrepo/cli.mjs verify`；源码目录变化后执行 `node .agentrepo/cli.mjs map --check`。\n5. 报告修改的文件、实际运行的命令和退出状态。`PASS`、`FAIL`、`NOT_CONFIGURED` 不得混用。\n\n## 安全边界\n\n- 未获明确授权，不修改生产配置、发布流程、CI 或现有公共接口契约。\n- 不读取、打印或提交真实密钥和生产数据。\n- 不编造模块职责、依赖关系、命令结果及未执行的测试。\n- 验证失败或未配置时，明确报告并停止声称任务已验收。\n\n## 项目专属约束\n\n维护者确认高风险的业务不变量、禁止操作及替代动作后补充；没有确认前不要推断。\n",
  "README.md": "# {{PROJECT_NAME}}\n\n## 项目\n\n待维护者填写：项目用途、目标用户及主要入口。\n\n## 本地开发\n\n- 环境与命令：[`docs/development.md`](docs/development.md)\n- 模块与边界：[`docs/architecture.md`](docs/architecture.md)\n- Agent 工作约定：[`AGENTS.md`](AGENTS.md)\n\n在仓库根目录运行 `node .agentrepo/cli.mjs inspect` 检查命令检测结果；使用 `node .agentrepo/cli.mjs verify` 运行已配置的检查。\n",
  "docs/architecture.md": "# Architecture\n\n## 代码地图\n\n{{CODE_MAP}}\n\n## 业务入口与模块契约\n\n| 入口或模块 | 责任 | 公开契约 | 允许调用方 |\n| --- | --- | --- | --- |\n| 待确认 | 待确认 | 待确认 | 待确认 |\n\n仅填写从源码与维护者确认的事实；删除不适用的行。\n\n## 不可违反的边界\n\n待维护者确认跨层依赖和接口兼容约束。能静态检查的规则放入项目已有的 lint 或架构检查，并纳入 `verify`。\n\n源码文件变化后执行 `node .agentrepo/cli.mjs map --write`，然后执行 `node .agentrepo/cli.mjs map --check`。\n",
  "docs/development.md": "# Development\n\n## 检测到的技术栈\n\n{{STACK_LIST}}\n\n## 命令与验收\n\n工作目录为仓库根目录；唯一命令配置来源是 `agentrepo.json.commands`。\n\n| 场景 | 命令 | 通过条件 |\n| --- | --- | --- |\n| 安装 | `node .agentrepo/cli.mjs setup` | 已配置的命令退出码为 0 |\n| 开发 | `node .agentrepo/cli.mjs dev` | 项目按自身启动检查确认可用 |\n| 测试 | `node .agentrepo/cli.mjs test` | 已配置的命令退出码为 0 |\n| 验收 | `node .agentrepo/cli.mjs verify` | 所有配置的检查退出码为 0 |\n\n缺失命令返回 `NOT_CONFIGURED` 且退出码非 0。禁止猜测包管理器命令、端口、数据库或服务地址。\n\n## 本地环境\n\n维护者在本节填写必需服务、非敏感环境变量的含义，以及可复现的启动前置条件。变量名放在 `.env.example`，不要填写真实凭据。\n",
  ".env.example": "# Add required environment variable names only after confirming the project configuration.\n# Never store credentials or production values here.\n",
  ".gitignore": "# AgentRepo defaults for new repositories only\n.env\n.env.*\n!.env.example\nnode_modules/\n.agentrepo/cache/\n",
  "github/ISSUE_TEMPLATE/config.yml": "blank_issues_enabled: false\n{{CONTACT_LINKS}}\n",
  "github/ISSUE_TEMPLATE/bug_report.yml": "name: Bug report\ndescription: Report a reproducible Agent or repository setup failure\nlabels: [bug, needs-triage]\nbody:\n  - type: textarea\n    id: actual\n    attributes:\n      label: What happened?\n      description: Paste the exact error text, not a screenshot of text. Remove secrets and personal data.\n    validations:\n      required: true\n  - type: dropdown\n    id: installation\n    attributes:\n      label: How did you set it up?\n      options:\n        - Skill instructions only\n        - Downloaded or cloned CLI\n        - npm or npx\n        - Other\n    validations:\n      required: true\n  - type: input\n    id: version\n    attributes:\n      label: Version or commit SHA\n      placeholder: \"agentrepo version, commit SHA, or skill revision\"\n    validations:\n      required: true\n  - type: textarea\n    id: reproduction\n    attributes:\n      label: Reproduction steps\n      description: Start with an empty or minimal repository when possible.\n  - type: textarea\n    id: expected\n    attributes:\n      label: Expected behavior\n  - type: textarea\n    id: context\n    attributes:\n      label: Environment and agent context\n      description: OS, runtime version, agent/model and permissions, if relevant.\n  - type: textarea\n    id: diagnostics\n    attributes:\n      label: CLI diagnostics and logs\n      description: Output of `node .agentrepo/cli.mjs doctor` or failing command. Redact credentials and private paths.\n      render: shell\n",
  "github/ISSUE_TEMPLATE/feature_request.yml": "name: Feature request\ndescription: Describe a missing behavior and acceptance criteria\nlabels: [enhancement, needs-triage]\nbody:\n  - type: checkboxes\n    id: duplicates\n    attributes:\n      label: Existing issues\n      options:\n        - label: I searched open and closed issues for this request.\n          required: true\n  - type: textarea\n    id: problem\n    attributes:\n      label: Problem to solve\n      description: Describe the user-visible problem, not the implementation.\n    validations:\n      required: true\n  - type: textarea\n    id: expected\n    attributes:\n      label: Expected behavior and acceptance criteria\n    validations:\n      required: true\n  - type: textarea\n    id: alternatives\n    attributes:\n      label: Alternatives considered\n      description: Existing scripts, skills, plugins, connectors, MCP tools or manual steps.\n  - type: textarea\n    id: compatibility\n    attributes:\n      label: Existing repository compatibility\n      description: Explain which files or established workflows could change.\n",
  "github/ISSUE_TEMPLATE/question.yml": "name: Question\ndescription: Ask how to use or configure the project\nlabels: [question]\nbody:\n  - type: textarea\n    id: question\n    attributes:\n      label: Your question\n    validations:\n      required: true\n",
  "github/ISSUE_TEMPLATE/broken_skill_or_integration.yml": "name: Broken skill or integration\ndescription: Report a skill, connector or tool integration that stopped working\nlabels: [bug, needs-triage]\nbody:\n  - type: dropdown\n    id: kind\n    attributes:\n      label: Component type\n      options:\n        - Repository skill\n        - External connector or MCP\n        - Bundled CLI integration\n        - Other\n    validations:\n      required: true\n  - type: input\n    id: name\n    attributes:\n      label: Component name\n    validations:\n      required: true\n  - type: textarea\n    id: error\n    attributes:\n      label: Exact error output\n      description: Paste text and remove credentials. Fix-only pull requests for broken integrations do not require an issue first.\n      render: shell\n    validations:\n      required: true\n  - type: input\n    id: version\n    attributes:\n      label: Version or commit SHA\n    validations:\n      required: true\n  - type: textarea\n    id: upstream\n    attributes:\n      label: Known upstream changes\n      description: Renamed command, changed parameter, removed endpoint or permission changes.\n",
  "github/pull_request_template.md": "## Change\n\n- Related issue and expected behavior:\n- Files or interfaces affected:\n\n## Verification\n\n- [ ] I ran the relevant checks and recorded their commands and exit codes below.\n- [ ] Bug fix has a regression test, or I explained why a test is not appropriate.\n- [ ] Existing AGENTS.md, CI and project-owned files were preserved unless explicitly approved.\n- [ ] User-facing docs and CHANGELOG.md were updated when relevant.\n\n| Command | PASS / FAIL / NOT_CONFIGURED | Evidence |\n| --- | --- | --- |\n| | | |\n\n## Compatibility and risks\n\n- Changed public contracts, environment requirements, or migrations:\n- Skipped checks and follow-up work:\n",
  "github/workflows/agentrepo-ci.yml": "name: AgentRepo verification\non:\n  pull_request:\n  workflow_dispatch:\npermissions:\n  contents: read\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '22'\n      - name: Set up project\n        run: node .agentrepo/cli.mjs setup\n      - name: Verify project\n        run: node .agentrepo/cli.mjs verify\n",
  "github/CHANGELOG.md": "# Changelog\n\nNotable user-facing changes are recorded here using the Keep a Changelog format.\n\n## [Unreleased]\n"
});
function renderTemplate(name, fields={}) {
    const body = PROJECT_TEMPLATES[name];
    if (typeof body !== 'string') throw Error(`Unknown project template: ${name}`);
    const keys = Object.keys(fields);
    const result = body.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (whole, key) => {
        if (!Object.hasOwn(fields, key)) throw Error(`Missing template field ${key} in ${name}`);
        return String(fields[key]);
    });
    // Only known dynamic fields may remain. Project-owned facts are never fabricated.
    if (/\{\{[A-Z][A-Z0-9_]*\}\}/.test(result)) throw Error(`Unrendered template field: ${name}`);
    return result;
}
function manual(root) { return renderTemplate('docs/architecture.md', {CODE_MAP:archBlock(root)}); }
function agents(root) { return renderTemplate('AGENTS.md', {PROJECT_NAME:path.basename(root)}); }
function development(found) {return renderTemplate('docs/development.md', {STACK_LIST:found.stack.map(x => '- ' + x).join('\n')}); }
function plan(root) {
    if (exists(root) && !isRealDir(root))
        throw new Error('Target path is not a directory');
    const found = detect(root);
    const files = {
        'AGENTS.md': agents(root, found),
        'README.md': renderTemplate('README.md', {PROJECT_NAME:path.basename(root)}),
        'docs/architecture.md': manual(root),
        'docs/development.md': development(found),
        '.env.example': renderTemplate('.env.example'),
        'agentrepo.json': JSON.stringify({ schemaVersion: 1, commands: found.commands }, null, 2) + '\n',
        '.agentrepo/cli.mjs': text(SELF),
    };
    if (!exists(path.join(root, '.gitignore')))
        files['.gitignore'] = renderTemplate('.gitignore');
    const created = [], preserved = [];
    for (const [rel, body] of Object.entries(files)) {
        protect(root, rel);
        (exists(path.join(root, rel)) ? preserved : created).push(rel);
    }
    return { root, found, files, created, preserved };
}
function githubOrigin(root) {
    const p = path.join(root,'.git/config');
    if (!isRealFile(p)) return null;
    const conf=text(p), section=conf.match(/\[remote\s+"origin"\]([\s\S]*?)(?=\n\s*\[|$)/);
    if (!section) return null;
    const matched=section[1].match(/^\s*url\s*=\s*(\S+)\s*$/m);
    if (!matched) return null;
    const remote=matched[1];
    const m=remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
    if (!m) return null;
    return `https://github.com/${m[1]}/${m[2]}`;
}
function githubIssueTemplates(root) {
    const dir=path.join(root,'.github/ISSUE_TEMPLATE');
    if (!isRealDir(dir)) return [];
    return fs.readdirSync(dir).filter(f=>/\.(?:ya?ml|md)$/i.test(f)&& !/^config\.ya?ml$/i.test(f)).sort();
}
function githubPrTemplates(root) {
    const dirs=['','.github','docs','.github/PULL_REQUEST_TEMPLATE'];
    const choices=[];
    for (const d of dirs) {
        const p=path.join(root,d);
        if (!isRealDir(p)) continue;
        for (const file of fs.readdirSync(p)) {
            if ((d==='.github/PULL_REQUEST_TEMPLATE' && /\.(?:md|txt)$/i.test(file)) || (/^pull_request_template\.(?:md|txt)$/i.test(file))) choices.push(path.posix.join(d,file));
        }
    }
    return choices.sort();
}
function githubChangelogs(root) {
    if (!isRealDir(root)) return [];
    return fs.readdirSync(root).filter(f=>/^(?:changelog|changes|history|news)(?:\.md|\.txt)?$/i.test(f) && isRealFile(path.join(root,f))).sort();
}
function githubWorkflows(root) {
    const p=path.join(root,'.github/workflows');
    return isRealDir(p)?fs.readdirSync(p).filter(f=>/\.ya?ml$/i.test(f)).sort():[];
}
function githubPlan(root, workflow=false) {
    if (exists(root) && !isRealDir(root)) throw Error('Target path is not a directory');
    const issues=githubIssueTemplates(root), prs=githubPrTemplates(root), changelogs=githubChangelogs(root), workflows=githubWorkflows(root);
    const origin=githubOrigin(root),warnings=[], skipped=[];
    const files={};
    if (issues.length) skipped.push('Existing Issue forms preserved as a group');
    else {
        for (const name of ['bug_report.yml','feature_request.yml','question.yml','broken_skill_or_integration.yml']) {
            files['.github/ISSUE_TEMPLATE/'+name]=renderTemplate('github/ISSUE_TEMPLATE/'+name);
        }
        const links=origin?`contact_links:\n  - name: Good first issue or help wanted\n    url: ${origin}/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22%2Clabel%3A%22help%20wanted%22\n    about: Browse issues for first-time contributors\n  - name: Report a security vulnerability\n    url: ${origin}/security/policy\n    about: Do not disclose vulnerabilities in a public issue\n`:'';
        files['.github/ISSUE_TEMPLATE/config.yml']=renderTemplate('github/ISSUE_TEMPLATE/config.yml',{CONTACT_LINKS:links});
        if (!origin) warnings.push('No GitHub origin: contact links omitted; add them after connecting the repository.');
        warnings.push('Issue form labels require matching labels in the GitHub repository.');
    }
    if (prs.length) skipped.push('Existing PR templates preserved');
    else files['.github/pull_request_template.md']=renderTemplate('github/pull_request_template.md');
    if (changelogs.length) skipped.push('Existing changelog preserved');
    else files['CHANGELOG.md']=renderTemplate('github/CHANGELOG.md');
    if (workflow) {
        if (workflows.length) skipped.push('Existing CI workflows preserved');
        else {
            const config=isRealFile(path.join(root,'agentrepo.json'))?parseConfig(root):null;
            if (config?.commands?.setup?.length && config.commands.verify?.length && isRealFile(path.join(root,'.agentrepo/cli.mjs')) && detect(root).stack.includes('Node.js')) {
                files['.github/workflows/agentrepo-ci.yml']=renderTemplate('github/workflows/agentrepo-ci.yml');
            } else warnings.push('Workflow skipped: requires a Node repository with initialized CLI and configured setup/verify commands.');
        }
    }
    const created=[],preserved=[];
    for (const [rel] of Object.entries(files)) {
        protect(root,rel);
        (exists(path.join(root,rel))?preserved:created).push(rel);
    }
    return {ok:true,root,files,created,preserved,skipped,origin,warnings,existing:{issueForms:issues,prTemplates:prs,changelogs,workflows}};
}
function githubInit(root,apply=false,workflow=false) {
    const p=githubPlan(root,workflow);
    if (apply) {
        fs.mkdirSync(root,{recursive:true});
        for (const rel of p.created) {
            const target=path.join(root,rel);fs.mkdirSync(path.dirname(target),{recursive:true});
            fs.writeFileSync(target,p.files[rel],{flag:'wx',mode:0o644});
        }
    }
    const {files,...report}=p;
    return {...report,applied:apply};
}
function init(root, dry = false) { const p = plan(root); if (!dry) {
    if (!exists(root))
        fs.mkdirSync(root, { recursive: true });
    for (const rel of p.created) {
        const target = path.join(root, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, p.files[rel], { flag: 'wx', mode: rel.endsWith('cli.mjs') ? 0o755 : 0o644 });
    }
} return { ok: true, dryRun: dry, created: p.created, preserved: p.preserved, stack: p.found.stack, commands: p.found.commands, reviewRequired: p.preserved.includes('AGENTS.md') ? 'Existing AGENTS.md preserved; review whether it needs an entry for the CLI.' : null }; }
function inspect(root) { const a = plan(root); return { root, stack: a.found.stack, packageManager: a.found.packageManager, evidence: a.found.evidence, warnings: a.found.warnings, commands: a.found.commands, proposedFiles: a.created, preservedFiles: a.preserved, policyFiles: ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md', '.cursor/rules'].filter(f => exists(path.join(root, f))) }; }
function doctor(root) { const issues = []; const cfg = path.join(root, 'agentrepo.json'); if (!isRealFile(cfg))
    issues.push('agentrepo.json missing');
else {
    try {
        const c = json(cfg);
        if (!c.commands?.verify?.length)
            issues.push('verify command NOT_CONFIGURED');
    }
    catch (e) {
        issues.push('invalid agentrepo.json: ' + e.message);
    }
} return { ok: issues.length === 0, issues }; }
function map(root, write = false, check = false) { const f = path.join(root, 'docs/architecture.md'); if (!isRealFile(f))
    return { ok: false, problem: 'docs/architecture.md is missing' }; const old = text(f), start = '<!-- agentrepo:map:start -->', end = '<!-- agentrepo:map:end -->'; const a = old.indexOf(start), b = old.indexOf(end); if (a < 0 || b < 0 || b < a)
    return { ok: true, status: 'SKIP', problem: 'Architecture document is project-owned; no managed map markers' }; const expected = archBlock(root), actual = old.slice(a, b + end.length); if (check)
    return { ok: actual === expected, status: actual === expected ? 'PASS' : 'FAIL', problem: actual === expected ? null : 'stale architecture map' }; if (write && actual !== expected) {
    fs.writeFileSync(f, old.slice(0, a) + expected + old.slice(b + end.length));
    return { ok: true, status: 'UPDATED' };
} return { ok: true, status: actual === expected ? 'PASS' : 'STALE', map: directoryMap(root) }; }
function parseConfig(root) { const p = path.join(root, 'agentrepo.json'); if (!isRealFile(p))
    return { schemaVersion: 1, commands: detect(root).commands, source: 'detected' }; const c = json(p); if (!c.commands || typeof c.commands !== 'object')
    throw Error('Invalid agentrepo.json commands'); return c; }
function execute(root, which, { jsonOutput = false } = {}) {
    const cfg = parseConfig(root);
    const steps = cfg.commands[which];
    if (!Array.isArray(steps) || steps.length === 0) {
        return { ok: false, status: 'NOT_CONFIGURED', command: which, checks: [] };
    }
    const out = [];
    for (const argv of steps) {
        if (!Array.isArray(argv) || argv.length < 1 || argv.some(x => typeof x !== 'string' || !x || x.includes('\0')))
            throw Error(`Invalid argv for ${which}. Use arrays of strings.`);
        const r = spawnSync(argv[0], argv.slice(1), { cwd: root, stdio: jsonOutput ? 'pipe' : 'inherit', shell: false, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
        const ok = r.status === 0 && !r.error;
        out.push({ argv, exitCode: r.status, error: r.error?.message ?? null, status: ok ? 'PASS' : 'FAIL' });
        if (!ok)
            break;
    }
    return { ok: out.length === steps.length && out.every(x => x.status === 'PASS'), status: out.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', command: which, checks: out };
}
function locate(root, terms, limit = 5) { const ts = terms.toLowerCase().split(/\W+/).filter(Boolean); const scored = walk(root).map(f => { const s = f.toLowerCase(); let score = ts.reduce((acc, t) => acc + (s.includes(t) ? 1 + (s.split('/').at(-1).includes(t) ? 2 : 0) : 0), 0); return { path: f, score }; }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)); return scored.slice(0, limit); }
function output(o, asJson) { if (asJson)
    process.stdout.write(JSON.stringify(o, null, 2) + '\n');
else if (typeof o === 'string')
    process.stdout.write(o + '\n');
else
    process.stdout.write(JSON.stringify(o, null, 2) + '\n'); }
const HELP = `AgentRepo Kit ${VERSION}\n\nUsage: agentrepo <inspect|init|adopt|github|doctor|map|locate|setup|dev|test|verify> [path]\n\n  inspect [path]      Read-only detection of project commands and existing rules\n  init [path]         Add only missing essentials; no install scripts run\n  init [path] --dry-run  Preview additions\n  adopt [path]        Same as read-only inspect for an existing project\n  adopt [path] --apply   Add missing files, preserving all existing files\n  github [path]       Preview optional GitHub Issue, PR and changelog templates\n  github [path] --apply  Add missing GitHub templates only\n  github [path] --apply --workflow  Add CI only when compatible and explicitly requested\n  doctor [path]       Check the verification command is configured\n  map [path] --check  Detect stale auto-generated map\n  map [path] --write  Refresh only the managed map section\n  locate <keywords>   Find candidate file paths\n  setup|dev|test|verify  Run configured argv; detect native commands before init\n\n  --json              JSON output for most commands\n`;
function defaultWorkingDirectory() {
    return path.basename(path.dirname(SELF)) === ".agentrepo" ? path.dirname(path.dirname(SELF)) : process.cwd();
}
export function main(argv = process.argv.slice(2), cwd = defaultWorkingDirectory()) {
    const asJson = argv.includes('--json');
    const args = argv.filter(a => a !== '--json');
    const cmd = args[0] || 'help';
    if (['help', '--help', '-h'].includes(cmd)) {
        output(HELP, false);
        return 0;
    }
    if (cmd === 'version') {
        output(VERSION, asJson);
        return 0;
    }
    const where = cmd === 'locate' ? cwd : safeRoot(args.find((x, i) => i > 0 && !x.startsWith('--')) || cwd);
    let result;
    try {
        switch (cmd) {
            case 'inspect':
                result = inspect(where);
                break;
            case 'init':
                result = init(where, args.includes('--dry-run'));
                break;
            case 'adopt':
                result = args.includes('--apply') ? init(where, false) : inspect(where);
                break;
            case 'github':
                result = githubInit(where,args.includes('--apply'),args.includes('--workflow'));
                break;
            case 'doctor':
                result = doctor(where);
                break;
            case 'map':
                result = map(where, args.includes('--write'), args.includes('--check'));
                break;
            case 'locate':
                result = locate(where, args.slice(1).filter(x => !x.startsWith('--')).join(' '));
                break;
            case 'setup':
            case 'dev':
            case 'test':
            case 'verify':
                result = execute(where, cmd, { jsonOutput: asJson });
                break;
            default: throw Error(`Unknown command: ${cmd}. Run agentrepo --help`);
        }
    }
    catch (e) {
        output({ ok: false, error: e.message }, asJson);
        return 1;
    }
    output(result, asJson);
    return result?.ok === false ? 1 : 0;
}
function invokedAsCLI() {
    try {
        return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(SELF);
    } catch {
        return false;
    }
}
if (invokedAsCLI())
    process.exitCode = main();
export { detect, plan, init, inspect, doctor, map, locate, execute, walk, directoryMap, githubPlan, githubInit };
