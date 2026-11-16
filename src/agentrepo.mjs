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
/* @agentrepo-project-templates */
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
