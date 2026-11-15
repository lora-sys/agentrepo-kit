import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {scenarioEval,doInit,doDocs,locate} from '../bin/agentrepo.mjs';
const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-v5-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};
const write=(root,p,txt)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),txt);};
test('regression corpus runs all isolated scenarios including the npm documentation error',t=>{
  const root=fixture(t);doInit(root);
  const report=scenarioEval(path.join(root,'eval/scenarios.json'));
  assert.equal(report.total,10);
  assert.equal(report.passed,10,JSON.stringify(report.results.filter(x=>!x.passed)));
});
test('scenario runner refuses path traversal in untrusted fixtures',t=>{
  const root=fixture(t),cases={schemaVersion:1,cases:[{id:'escape',files:{'../evil.txt':'pwn'},steps:[{action:'init',expect:true}]}]};
  write(root,'evil-cases.json',JSON.stringify(cases));
  assert.throws(()=>scenarioEval(path.join(root,'evil-cases.json')),/escapes repository/);
});
test('managed docs link check ignores root routes but catches real missing paths',t=>{
  const root=fixture(t);write(root,'docs/content/npm-routes.md','[Install](/commands/npm-install)\n');doInit(root);
  assert.equal(doDocs(root).ok,true);
  write(root,'docs/domains/auth.md','[missing](../nowhere.md)\n');
  assert.ok(doDocs(root).issues.some(x=>x.target==='../nowhere.md'));
});
test('task subject phrase ranks exact named module before generic content references',t=>{
  const root=fixture(t);
  write(root,'lib/cli/exit-handler.js','class ExitHandler { exit(error) { return error } }\n');
  write(root,'lib/utils/error-message.js','const errorMessage="exit error npm CLI fails"\n');
  write(root,'bin/npm-cli.js','const npmCLI="npm CLI error exit fails"\n');
  doInit(root);
  const result=locate(root,'exit handling error after npm CLI fails',{k:3});
  assert.equal(result.results[0].file,'lib/cli/exit-handler.js');
});
