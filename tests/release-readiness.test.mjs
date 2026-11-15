import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('release: required open-source repository files exist',()=>{
  for(const file of ['README.md','README.en.md','LICENSE','AGENTS.md','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','CHANGELOG.md','.github/workflows/ci.yml','.github/ISSUE_TEMPLATE/config.yml','.github/pull_request_template.md','.github/ISSUE_TEMPLATE/bug_report.yml','docs/EVAL.zh-CN.md','docs/PUBLISHING.zh-CN.md','examples/architecture-demo.html']){
    assert.ok(fs.statSync(path.join(root,file)).isFile(),file);
  }
  assert.match(read('LICENSE'),/MIT License/);
});

test('release: package metadata and CLI entry are consistent',()=>{
  const p=JSON.parse(read('package.json'));
  assert.equal(p.license,'MIT');
  assert.equal(p.bin.agentrepo,'./bin/agentrepo.mjs');
  assert.match(p.repository.url,/github.com\/lora-sys\/agentrepo-kit/);
  assert.ok(fs.statSync(path.join(root,p.bin.agentrepo)).isFile());
});

test('release: CLI entry is executable on POSIX (regression for CI EACCES)', {skip: process.platform === 'win32'}, () => {
  const entry=path.join(root,'bin/agentrepo.mjs');
  const mode=fs.statSync(entry).mode;
  assert.ok(mode & 0o111, `${entry} has no executable bit. Run chmod +x bin/agentrepo.mjs and commit the file mode.`);
});

test('release: relative markdown links in main READMEs resolve',()=>{
  for(const file of ['README.md','README.en.md']){
    const content=read(file);
    const matches=[...content.matchAll(/\]\(([^)]+)\)/g)];
    for(const [,target] of matches){
      if(/^(https?:|mailto:|#)/.test(target))continue;
      const pathname=target.split('#',1)[0];
      assert.ok(fs.existsSync(path.resolve(root,pathname)),`${file}: ${target}`);
    }
  }
});

test('release: CLI source version matches package metadata', () => {
  const p=JSON.parse(read('package.json'));
  const src=read('bin/agentrepo.mjs');
  assert.ok(src.startsWith(`#!/usr/bin/env node\n// AgentRepo Kit v${p.version}.`));
  assert.ok(src.includes(`const VERSION = '${p.version}'`));
});
