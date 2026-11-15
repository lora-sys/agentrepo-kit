import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('../bin/agentrepo.mjs',import.meta.url));
test('npm-style symlink launches the CLI and successfully initializes an empty project',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-npm-bin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const link=path.join(root,'agentrepo');fs.symlinkSync(cli,link);
 const project=path.join(root,'project');const version=JSON.parse(execFileSync(link,['version','--json'],{encoding:'utf8'}));
 assert.equal(version.version,'0.8.0');
 const result=JSON.parse(execFileSync(link,['init',project,'--json'],{encoding:'utf8'}));
 assert.equal(result.ok,true);assert.equal(fs.existsSync(path.join(project,'.agentrepo/cli.mjs')),true);
});
