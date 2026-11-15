#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
const VERSION = '1.0.0-rc.1';
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
function manual(root) { return `# Architecture\n\n## Main modules\n\n${archBlock(root)}\n\n## Public entrypoints and constraints\n\n填写已确认的业务入口、跨模块边界和不可破坏的接口；尚未确认时保留本节。\n\n## Update\n\nRun \`node .agentrepo/cli.mjs map --write\` after moving or adding source files.\n`; }
function agents(root, found) {
    return `# ${path.basename(root)}

## 优先级

本仓库已确认的禁令优先于通用 Skill 的默认步骤。已有项目规则和 CI 保留原文件。

## 命令与真实环境

- 工作目录：仓库根目录。
- 命令来源：\`agentrepo.json.commands\`。未配置返回 \`NOT_CONFIGURED\`。
- 验证入口：\`node .agentrepo/cli.mjs verify\`。只有命令实际执行且退出码为 0 才报告通过。
`;
}
function development(found) { return `# Development\n\n## Stack\n\n${found.stack.map(x => '- ' + x).join('\n')}\n\n## Commands\n\nThe sole command configuration is \`agentrepo.json.commands\`. Execute through the bundled CLI:\n\n\`\`\`sh\nnode .agentrepo/cli.mjs setup\nnode .agentrepo/cli.mjs dev\nnode .agentrepo/cli.mjs test\nnode .agentrepo/cli.mjs verify\n\`\`\`\n\nA missing command is \`NOT_CONFIGURED\`. \`verify\` fails when no verification command is configured. Exit code 0 means the executed checks passed.\n\n## Local services and env\n\nOnly non-secret variable names belong in \`.env.example\`. Document additional services here when confirmed.\n`; }
function plan(root) {
    if (exists(root) && !isRealDir(root))
        throw new Error('Target path is not a directory');
    const found = detect(root);
    const files = {
        'AGENTS.md': agents(root, found),
        'README.md': `# ${path.basename(root)}\n\nDescribe the product, intended users, and main entrypoints.\n`,
        'docs/architecture.md': manual(root),
        'docs/development.md': development(found),
        '.env.example': '# Add required environment variable names only. Do not include credentials.\n',
        'agentrepo.json': JSON.stringify({ schemaVersion: 1, commands: found.commands }, null, 2) + '\n',
        '.agentrepo/cli.mjs': text(SELF),
    };
    if (!exists(path.join(root, '.gitignore')))
        files['.gitignore'] = '.env\n.env.*\n!.env.example\nnode_modules/\n.agentrepo/cache/\n';
    const created = [], preserved = [];
    for (const [rel, body] of Object.entries(files)) {
        protect(root, rel);
        (exists(path.join(root, rel)) ? preserved : created).push(rel);
    }
    return { root, found, files, created, preserved };
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
const HELP = `AgentRepo Kit ${VERSION}\n\nUsage: agentrepo <inspect|init|adopt|doctor|map|locate|setup|dev|test|verify> [path]\n\n  inspect [path]      Read-only detection of project commands and existing rules\n  init [path]         Add only missing essentials; no install scripts run\n  init [path] --dry-run  Preview additions\n  adopt [path]        Same as read-only inspect for an existing project\n  adopt [path] --apply   Add missing files, preserving all existing files\n  doctor [path]       Check the verification command is configured\n  map [path] --check  Detect stale auto-generated map\n  map [path] --write  Refresh only the managed map section\n  locate <keywords>   Find candidate file paths\n  setup|dev|test|verify  Run configured argv; detect native commands before init\n\n  --json              JSON output for most commands\n`;
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
export { detect, plan, init, inspect, doctor, map, locate, execute, walk, directoryMap };
