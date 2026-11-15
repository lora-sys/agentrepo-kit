// Existing-repository adoption protocol. Never reinterpret or overwrite project rules.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const output = value => JSON.stringify(value, null, 2) + '\n';
const IGNORE = new Set(['.git', '.agentrepo', 'node_modules', 'dist', 'build', 'coverage', 'vendor', '.venv', 'venv', '.next', '.cache', 'target']);
const PLAN = '.agentrepo/adoption-plan.json';
const STATE = '.agentrepo/adoption-state.json';
const GUIDE = '.agentrepo/adoption-guide.md';
const LINK_MARKER = '<!-- agentrepo-adoption-link:v1 -->';

function safe(root, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0')) throw new Error('Invalid adoption path');
  const base = path.resolve(root);
  const file = path.resolve(base, rel);
  if (file === base || !file.startsWith(base + path.sep)) throw new Error('Adoption path escapes repository');
  let walk = base;
  for (const part of path.relative(base, file).split(path.sep)) {
    walk = path.join(walk, part);
    try { if (fs.lstatSync(walk).isSymbolicLink()) throw new Error('Adoption refuses symlink paths'); }
    catch (error) { if (error.code === 'ENOENT') break; throw error; }
  }
  return file;
}
const readable = file => { try { return fs.statSync(file).isFile(); } catch { return false; } };
function readJson(root, rel) { return JSON.parse(fs.readFileSync(safe(root, rel), 'utf8')); }
function writeNew(root, rel, data) {
  const file = safe(root, rel);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, data, {flag: 'wx'});
}
function writeManaged(root, rel, data) {
  const file = safe(root, rel);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  // Managed files only. Other project files must never be overwritten here.
  const temporary = file + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, data, {flag: 'wx'});
  try { fs.renameSync(temporary, file); } catch (error) { fs.rmSync(temporary, {force: true}); throw error; }
}
function filesUnder(root, max = 20000) {
  const found = [], todo = [path.resolve(root)];
  while (todo.length) {
    const directory = todo.pop();
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory() && !IGNORE.has(item.name)) todo.push(path.join(directory, item.name));
      else if (item.isFile()) found.push(path.relative(root, path.join(directory, item.name)).replaceAll('\\', '/'));
      if (found.length > max) throw new Error('Adoption inventory exceeds safe file limit');
    }
  }
  return found.sort();
}
function category(file) {
  if (/(^|\/)AGENTS\.md$/i.test(file)) return 'agent';
  if (/(^|\/)(?:CLAUDE|GEMINI)\.md$/i.test(file) || /^\.cursor\/rules\/.*\.mdc$/i.test(file) || /^\.claude\/rules\/.*\.md$/i.test(file) || /^\.github\/(?:copilot-instructions\.md|instructions\/.*\.instructions\.md)$/i.test(file)) return 'otherAgent';
  if (/^(?:\.github\/|docs\/)?(?:CODEOWNERS|CONTRIBUTING\.md|SECURITY\.md)$/i.test(file)) return 'governance';
  if (/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(file)) return 'workflow';
  if (/^\.github\/ISSUE_TEMPLATE\/[^/]+\.(?:yml|yaml|md)$/i.test(file)) return 'issue';
  if (/^(?:\.github\/|docs\/)?(?:pull_request_template\.(?:md|txt)|PULL_REQUEST_TEMPLATE\/[^/]+\.(?:md|txt))$/i.test(file)) return 'pr';
  if (/^(?:docs\/)?(?:CHANGELOG|CHANGES|HISTORY|NEWS|RELEASES)(?:\.[\w-]+)?$/i.test(file)) return 'changelog';
  if (/^(?:README(?:\.[\w-]+)?|Makefile|package\.json|pnpm-workspace\.yaml|pyproject\.toml|go\.mod|Cargo\.toml|\.nvmrc|\.node-version|\.tool-versions|\.editorconfig)$/i.test(file)) return 'project';
  if (/^(?:docs\/)?(?:architecture|development)\.md$/i.test(file)) return 'architecture';
  return null;
}
export function adoptScan(root) {
  root = path.resolve(root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw new Error('Adoption requires an existing real directory');
  const entries = filesUnder(root).flatMap(file => {
    const group = category(file);
    if (!group) return [];
    const bytes = fs.readFileSync(safe(root, file));
    return [{path: file, category: group, sha256: hash(bytes), bytes: bytes.length}];
  });
  const byCategory = {};
  for (const entry of entries) (byCategory[entry.category] ??= []).push(entry.path);
  return {ok: true, mode: 'read-only', root, precedence: 'existing repository rules > explicitly approved AgentRepo additions > default template', entries, byCategory,
    warnings: ['Inventory identifies rule files, not their semantic meaning. Review conflicts manually.', 'No existing file is modified by scan.']};
}
function digest(entries) { return hash(output(entries.map(({path, sha256}) => [path, sha256]))); }
export function adoptPlan(root, opts = {}) {
  const scan = adoptScan(root);
  const plan = {schemaVersion: 1, kind: 'existing-repository-adoption', root: scan.root,
    baseline: scan.entries, baselineDigest: digest(scan.entries),
    precedence: scan.precedence,
    steps: [
      {id: 'install', operation: 'add missing scaffold files only', requiresApproval: true},
      {id: 'bridge', operation: 'add a short bridge to existing AGENTS.md, preserving every existing rule', requiresApproval: true},
      {id: 'confirm', operation: 'review project-specific placeholders and run genuine verification', requiresApproval: false}
    ],
    ruleFiles: scan.byCategory,
    requiredReview: ['Resolve conflicts between existing project-specific agent instructions.', 'Confirm project run/test commands and architecture boundaries.', 'Check no new workflow supersedes existing CI.'],
    writesOnApply: [STATE, GUIDE, 'only missing files from agentrepo init'],
    status: 'PROPOSED'};
  if (opts.write) {
    if (readable(safe(root, STATE))) throw new Error('Adoption already applied. Use adopt verify; do not discard its provenance.');
    if (readable(safe(root, PLAN))) {
      if (!opts.refresh || !opts.approve) throw new Error('Adoption plan exists. To regenerate after inspecting changes, use adopt plan --write --refresh --approve.');
      writeManaged(root, PLAN, output(plan));
    } else writeNew(root, PLAN, output(plan));
  }
  return {ok: true, plan, saved: Boolean(opts.write), path: opts.write ? PLAN : null};
}
function ensureBaseline(root, entries, expected, permittedAdditions = []) {
  const current = adoptScan(root);
  const prior = new Map(entries.map(item => [item.path, item.sha256]));
  const now = new Map(current.entries.map(item => [item.path, item.sha256]));
  const allowed = new Set(permittedAdditions);
  const changed = [...new Set([...prior.keys(), ...now.keys()])]
    .filter(key => (prior.has(key) ? prior.get(key) !== now.get(key) : !allowed.has(key))).sort();
  if (digest(entries) !== expected || changed.length) {
    throw new Error('Original project policy or configuration changed since adoption plan: ' + changed.join(', ') + '. Reinspect before proceeding.');
  }
}
function guide(plan) {
  const lines = ['# Existing repository adoption', '', '## Authority', '',
    'Original project rules, CI, release processes, public contracts, and owner decisions take precedence.',
    'AgentRepo adds discoverability, checks and a handoff mechanism; it does not overrule existing instructions.',
    '', '## Discovered project rules', ''];
  for (const [name, paths] of Object.entries(plan.ruleFiles)) {
    lines.push('### ' + name, '', ...paths.map(file => '- `' + file + '`'), '');
  }
  lines.push('## Mandatory review', '',
    '- [ ] Read the original AGENTS.md and other agent instructions; resolve conflicts before enabling any new requirement.',
    '- [ ] Confirm test, setup and dev commands against actual project behavior.',
    '- [ ] Confirm docs/architecture.md, code boundaries and source paths with evidence.',
    '- [ ] Review original GitHub workflow, Issue, PR and release policy; do not replace it.',
    '- [ ] Run agentrepo verify and record PASS, FAIL and SKIP accurately.',
    '- [ ] Resolve project-specific placeholders in the newly generated docs.',
    '', '## How to finish', '',
    'Run `agentrepo adopt activate --approve` only after reviewing the exact bridge to AGENTS.md.',
    'Run `agentrepo adopt verify` to inspect remaining issues.',
    'Strict readiness is only achieved when remaining placeholders have been resolved.', '');
  return lines.join('\n');
}
export function adoptApply(root, opts = {}, init) {
  if (!opts.approve) throw new Error('adopt apply requires --approve after reviewing adopt plan');
  if (typeof init !== 'function') throw new Error('Adoption initializer unavailable');
  const plan = readJson(root, PLAN);
  if (plan.schemaVersion !== 1 || plan.root !== path.resolve(root) || plan.status !== 'PROPOSED') throw new Error('Invalid adoption plan');
  if (readable(safe(root, STATE))) throw new Error('Adoption already applied; inspect with adopt verify');
  ensureBaseline(root, plan.baseline, plan.baselineDigest);
  const initialHadAgentRules = plan.baseline.some(item => item.path === 'AGENTS.md');
  // Since planning already created .agentrepo/, init must still treat this as an existing project.
  const installed = init(root);
  writeNew(root, GUIDE, guide(plan));
  const state = {schemaVersion: 1, projectRoot: path.resolve(root), baseline: plan.baseline,
    baselineDigest: plan.baselineDigest, originalAgentRules: initialHadAgentRules,
    activated: false, bridgeAdded: false, installed: installed.created,
    precedence: plan.precedence, status: 'PENDING_ACTIVATION'};
  writeNew(root, STATE, output(state));
  return {ok: true, status: state.status, installedCount: installed.created.length,
    preserved: installed.preserved, guide: GUIDE, next: 'Review original rules, then adopt activate --approve'};
}
export function adoptActivate(root, opts = {}) {
  if (!opts.approve) throw new Error('adopt activate requires --approve after reviewing original rules');
  const state = readJson(root, STATE);
  if (state.schemaVersion !== 1) throw new Error('Unsupported adoption state');
  if (state.activated) return {ok: true, status: 'ALREADY_ACTIVE', bridged: state.bridgeAdded};
  if (typeof opts.reason !== 'string' || opts.reason.trim().length < 12) throw new Error('adopt activate requires --reason with a concrete review decision (at least 12 characters)');
  ensureBaseline(root, state.baseline, state.baselineDigest, state.installed);
  const agentFile = safe(root, 'AGENTS.md');
  if (!readable(agentFile)) throw new Error('No AGENTS.md entrypoint found; check initialization');
  let bridged = false;
  if (state.originalAgentRules) {
    const original = fs.readFileSync(agentFile, 'utf8');
    if (!original.includes(LINK_MARKER)) {
      const bridge = `\n\n${LINK_MARKER}\n## AgentRepo integration\n\nExisting project instructions above have priority. For adoption state and remaining checks see [AgentRepo adoption guide](.agentrepo/adoption-guide.md). Run \`node .agentrepo/cli.mjs adopt verify\` before claiming takeover is complete.\n`;
      // Approval is mandatory and the original file is only appended, not replaced.
      fs.appendFileSync(agentFile, bridge);
      bridged = true;
    }
  }
  // Only original project files are pinned. Generated template docs can be edited freely.
  if (state.originalAgentRules) {
    const agent = state.baseline.find(item => item.path === 'AGENTS.md');
    if (agent) { const content = fs.readFileSync(agentFile); agent.sha256 = hash(content); agent.bytes = content.length; }
  }
  state.baselineDigest = digest(state.baseline);
  state.activated = true;
  state.activationReview = {reason: opts.reason.trim(), baselineDigest: state.baselineDigest};
  state.bridgeAdded = bridged;
  state.status = 'ACTIVE_PENDING_REVIEW';
  writeManaged(root, STATE, output(state));
  return {ok: true, status: state.status, bridged, next: 'Fill project-specific placeholders and run adopt verify'};
}
export function adoptVerify(root, opts = {}, pending = () => [], doctor = () => ({ok: true})) {
  if (!readable(safe(root, STATE))) return {ok: false, status: 'NOT_APPLIED',issues: ['Run adopt plan --write, then adopt apply --approve']};
  const state = readJson(root, STATE), issues = [];
  if (!state.activated) issues.push('Activation not approved. Run adopt activate --approve after reviewing original rules.');
  try { ensureBaseline(root, state.baseline, state.baselineDigest, state.installed); }
  catch (error) { issues.push(error.message); }
  if (!readable(safe(root, GUIDE))) issues.push('Adoption guide missing');
  if (state.originalAgentRules && (!readable(safe(root, 'AGENTS.md')) || !fs.readFileSync(safe(root, 'AGENTS.md'),'utf8').includes(LINK_MARKER))) issues.push('Existing AGENTS.md is missing the approved adoption bridge');
  if (state.activated && !state.activationReview?.reason) issues.push('No activation review reason recorded');
  const unresolved = pending(root);
  if (unresolved.length) issues.push(`Unreviewed project-specific placeholders: ${unresolved.map(item => `${item.file}:${item.field}`).join(', ')}`);
  let d; try { d = doctor(root); if (!d.ok) issues.push('Project doctor found failing checks'); }
  catch (error) { issues.push('Project doctor could not run: ' + error.message); }
  const ready = issues.length === 0;
  return {ok: ready, status: ready ? 'INTEGRATION_CHECKS_PASS' : state.activated ? 'REVIEW_REQUIRED' : 'PENDING_ACTIVATION',
    activated: state.activated, originalProjectPriority: true,
    issues, pending: unresolved, checkStatuses: d?.checks ?? [],
    note: 'This checks adoption integrity and placeholders, not semantic correctness or test execution.'};
}

export function adoptReconcile(root, opts = {}) {
  if (!opts.approve || typeof opts.reason !== 'string' || opts.reason.trim().length < 12) throw new Error('adopt reconcile requires --approve and a concrete --reason');
  const state = readJson(root, STATE);
  if (!state.activated) throw new Error('Activate adoption before reconciling');
  const current = adoptScan(root);
  const ignored = new Set(state.installed);
  const next = current.entries.filter(entry => !ignored.has(entry.path));
  const previous = new Map(state.baseline.map(entry => [entry.path, entry.sha256]));
  const updated = new Map(next.map(entry => [entry.path, entry.sha256]));
  const changed = [...new Set([...previous.keys(), ...updated.keys()])].filter(key => previous.get(key) !== updated.get(key)).sort();
  if (!changed.length) return {ok: true, status: 'NO_CHANGE', changed};
  const before = state.baselineDigest;
  state.baseline = next;
  state.baselineDigest = digest(next);
  state.reconciliations ??= [];
  state.reconciliations.push({before, after: state.baselineDigest, changed, reason: opts.reason.trim()});
  writeManaged(root, STATE, output(state));
  return {ok: true, status: 'RECONCILED', changed, note: 'Baseline reviewed and updated. Does not prove that new rules are semantically compatible.'};
}
