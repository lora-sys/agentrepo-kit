import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {doInit,archInit,archSync,archCheck} from '../bin/agentrepo.mjs';
const temp=t=>{const p=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-sync-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;};
test('custom architecture rule changes are caught before execution and sync regenerates managed config',t=>{
 const r=temp(t);fs.mkdirSync(path.join(r,'src'));fs.writeFileSync(path.join(r,'src/a.js'),'export const a=1;\n');doInit(r);archInit(r);
 const file=path.join(r,'agentrepo.json'),config=JSON.parse(fs.readFileSync(file,'utf8'));
 config.architecture={forbiddenImports:[{from:'^src/ui/',to:'^src/data/',reason:'no direct persistence'}]};fs.writeFileSync(file,JSON.stringify(config));
 assert.equal(archCheck(r,{strict:true}).ok,false);
 assert.equal(archSync(r).ok,true);
 assert.ok(JSON.parse(fs.readFileSync(path.join(r,'.dependency-cruiser.json'),'utf8')).forbidden.some(x=>x.comment==='no direct persistence'));
 assert.match(archCheck(r,{strict:true}).reason,/dependency-cruiser missing/);
});
test('architecture sync refuses to clobber manually edited config',t=>{
 const r=temp(t);fs.mkdirSync(path.join(r,'src'));fs.writeFileSync(path.join(r,'src/a.js'),'export const a=1;\n');doInit(r);archInit(r);
 const f=path.join(r,'.dependency-cruiser.json');fs.appendFileSync(f,'\n');
 const before=fs.readFileSync(f,'utf8');const result=archSync(r);
 assert.equal(result.ok,false);assert.equal(fs.readFileSync(f,'utf8'),before);
});
