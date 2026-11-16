import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {init,inspect,doctor,locate,map} from '../bin/agentrepo.mjs';
const work=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-evidence-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
function put(root,p,s){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);}
const get=(root,p)=>fs.readFileSync(path.join(root,p),'utf8');

function fixture(root){
 put(root,'package.json',JSON.stringify({name:'example',main:'src/account/index.mjs',scripts:{test:'node --test',verify:'node --test'}}));
 put(root,'src/account/index.mjs',"import {createUser} from './email.mjs';\nexport {createUser};\n");
 put(root,'src/account/email.mjs',"export function createUser(email, emails){\n  if(emails.has(email)) throw new Error('duplicate email');\n  return {email};\n}\n");
 put(root,'tests/account.test.mjs',"import {createUser} from '../src/account/email.mjs';\n");
}

test('locate: searches real source lines and returns evidence, not only filenames',t=>{
 const root=work(t);fixture(root);init(root);
 const hit=locate(root,'duplicate email',5)[0];
 assert.equal(hit.path,'src/account/email.mjs');assert.equal(hit.line,2);assert.equal(hit.match,'content');
 assert.match(hit.snippet,/duplicate email/);
 assert.equal(locate(root,'account index',5).some(x=>x.path==='src/account/index.mjs'),true);
 assert.deepEqual(locate(root,'unmatchable_phrase_zz',5),[]);
});

test('locate: excludes .env secrets and redacts sensitive assignments',t=>{
 const root=work(t);put(root,'.env','API_KEY=abcsecret\n');
 put(root,'src/settings.js','const api_key = "abcsecret"; // unique_secret_marker\n');
 assert.equal(locate(root,'abcsecret').some(x=>x.path==='.env'),false);
 const hit=locate(root,'unique_secret_marker')[0];
 assert.equal(hit.path,'src/settings.js');assert.match(hit.snippet,/REDACTED/);
});

test('architecture: lists only configured entrypoints, resolved imports and test evidence',t=>{
 const root=work(t);fixture(root);init(root);
 const doc=get(root,'docs/architecture.md');
 assert.match(doc,/package\.json main/);
 assert.match(doc,/src\/account\/index\.mjs/);
 assert.match(doc,/src\/account\/email\.mjs/);
 assert.match(doc,/src\/account\/index\.mjs:1/);
 assert.match(doc,/tests\/account\.test\.mjs:1/);
 assert.match(doc,/不是完整调用图/);
 assert.match(doc,/待确认/);
 assert.equal(map(root,false,true).status,'PASS');
 // Changing an import changes the static evidence, so generated map is stale.
 put(root,'src/account/index.mjs',"export const entry = true;\n");
 assert.equal(map(root,false,true).status,'FAIL');
 assert.equal(map(root,true,false).status,'UPDATED');assert.equal(map(root,false,true).status,'PASS');
});

test('development: distinguishes detected commands from executed verification',t=>{
 const root=work(t);fixture(root);init(root);
 const dev=get(root,'docs/development.md');
 assert.match(dev,/DETECTED_UNVERIFIED/);
 assert.match(dev,/NOT_CONFIGURED/);
 assert.match(dev,/\["npm","run","verify"\]/);
 const status=inspect(root);assert.equal(status.commandStatus.verify,'DETECTED_UNVERIFIED');
 assert.equal(status.commandStatus.dev,'NOT_CONFIGURED');
 const health=doctor(root);assert.equal(health.ok,true);assert.equal(health.scope,'command-configuration');
 assert.equal(health.readiness,'NOT_VERIFIED');
});

test('architecture: does not invent business entrypoints from filenames',t=>{
 const root=work(t);put(root,'src/account/unknown.mjs','export function foo(){}\n');init(root);
 const arch=get(root,'docs/architecture.md');
 assert.match(arch,/未识别到可确认的入口/);
 assert.match(arch,/待维护者核对/);
 assert.doesNotMatch(arch,/Account service|User API/);
});


test('locate: long generated template lines do not outrank maintained source',t=>{
 const root=work(t);put(root,'src/logic.mjs',"const reason='special_case';\n");
 put(root,'bin/bundle.mjs',"const EMBEDDED = "+JSON.stringify('x'.repeat(650)+' special_case')+';\n');
 const result=locate(root,'special_case',5);
 assert.equal(result[0].path,'src/logic.mjs');
 assert.equal(result.some(x=>x.path==='bin/bundle.mjs'),false);
});


test('locate: prefers maintained source over generated CLI bundle',t=>{
 const root=work(t);
 put(root,'src/demo.mjs',"export const status = 'SINGLE_SOURCE';\n");
 put(root,'bin/demo.mjs',"const PROJECT_TEMPLATES = Object.freeze({});\nexport const status = 'SINGLE_SOURCE';\n");
 assert.equal(locate(root,'SINGLE_SOURCE',5).length,1);
 assert.equal(locate(root,'SINGLE_SOURCE',5)[0].path,'src/demo.mjs');
});
