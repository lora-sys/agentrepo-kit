import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadManifest,matrix,parseCodexJsonl,parseJsonBridge,summarize,runTrial,verifySources} from '../benchmarks/agent-eval/lib.mjs';
import {syntheticSmoke} from '../benchmarks/agent-eval/cli.mjs';

const fixtureDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../benchmarks/agent-eval/fixtures');
function setup(t,{badAgent=false}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agent-ab-fixture-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const src=path.join(dir,'source');fs.mkdirSync(src);fs.mkdirSync(path.join(src,'src'));
  fs.writeFileSync(path.join(src,'src/answer.js'),'export const answer = 1;\n');
  const g=(argv)=>{const r=spawnSync('git',['-C',src,...argv],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  g(['init','-q']);g(['add','-A']);g(['-c','user.name=Fixture','-c','user.email=f@local','commit','-q','-m','baseline']);
  const sha=g(['rev-parse','HEAD']);
  const m={schemaVersion:1,id:'fixture-run',mode:'synthetic',seed:42,repeats:2,arms:['baseline','minimal','full'],repositories:[{id:'fixture',path:'./source',commit:sha}],tasks:[{id:'change-answer',repository:'fixture',prompt:'Update the src/answer.js value to 42.',expectedPaths:['src/answer.js'],acceptance:{argv:[process.execPath,'{suite}/fixtures/accept.mjs','{workspace}'],timeoutMs:10000}}],agent:{kind:'fixture',model:'synthetic-no-llm',timeoutMs:10000,argv:[process.execPath,'{suite}/fixtures/agent.mjs']}};
  const dst=path.join(dir,'fixtures');fs.mkdirSync(dst);
  for(const file of ['accept.mjs','agent.mjs'])fs.copyFileSync(path.join(fixtureDir,file),path.join(dst,file));
  if(badAgent)fs.writeFileSync(path.join(dst,'agent.mjs'),`console.log(JSON.stringify({usage:{inputTokens:100,outputTokens:10}}));\n`);
  const mf=path.join(dir,'manifest.json');fs.writeFileSync(mf,JSON.stringify(m));
  return {ctx:loadManifest(mf),dir,repo:src,sha};
}

test('agent evaluation: codex usage counted only from valid completion events',()=>{
 const events=[{type:'turn.started'},{type:'turn.completed',usage:{input_tokens:800,cached_input_tokens:300,output_tokens:90,reasoning_output_tokens:22}},{type:'turn.completed',usage:{input_tokens:200,output_tokens:20}},{type:'turn.completed',usage:{input_tokens:-4,output_tokens:9}}].map(JSON.stringify).join('\n');
 assert.deepEqual(parseCodexJsonl(events),{usage:{inputTokens:1000,outputTokens:110,cachedInputTokens:300,reasoningOutputTokens:22},turns:2});
 assert.equal(parseCodexJsonl('I finished, trust me').usage,null);
 assert.equal(parseJsonBridge('{"status":"ok"}').usage,null);
});

test('agent evaluation: real-token pair comparisons never include synthetic or unpaired usage',()=>{
 const trials=['baseline','minimal','full'].map((arm,i)=>({taskId:'one',repository:'r',commit:'abc',repeat:1,manifestHash:'hash',arm,agent:{model:'codex-fixed'},success:true,manualInterventions:0,runClass:'coding-agent',usageComplete:true,usage:{inputTokens:[600,400,1000][i],outputTokens:[400,100,500][i]},top3Hit:null}));
 const out=summarize(trials);
 assert.equal(out.tokenComparisons.minimal.pairs,1);
 assert.equal(out.tokenComparisons.minimal.reductionRate,0.5);
 assert.equal(out.tokenComparisons.full.reductionRate,-0.5);
 assert.equal(out.groups.baseline.top3Measured,0);
 assert.equal(summarize(trials.map(r=>({...r,runClass:'synthetic-fixture'}))).trials,0);
 assert.equal(summarize(trials.slice(0,1)).tokenComparisons.minimal.reductionRate,null);
});

test('agent evaluation: manifest rejects unpinned sources and fixture agents presented as real',t=>{
 const {ctx,dir}=setup(t);const invalid=JSON.parse(fs.readFileSync(ctx.absolute,'utf8'));
 invalid.repositories[0].commit='main';fs.writeFileSync(ctx.absolute,JSON.stringify(invalid));
 assert.throws(()=>loadManifest(ctx.absolute),/40-character pinned commit/);
 invalid.repositories[0].commit='a'.repeat(40);invalid.mode='real';invalid.tasks[0].acceptance.oracleSha256='a'.repeat(64);fs.writeFileSync(ctx.absolute,JSON.stringify(invalid));
 assert.throws(()=>loadManifest(ctx.absolute),/fixture agent permitted only in synthetic mode/);
});

test('agent evaluation: fixed plan is deterministic, each arm and repeat present',t=>{
 const {ctx}=setup(t);const first=matrix(ctx),second=matrix(ctx);
 assert.deepEqual(first,second);assert.equal(first.length,6);
 assert.equal(new Set(first.map(x=>x.id)).size,6);
});

test('agent evaluation: trial results are append-only and source snapshot remains unchanged',async t=>{
 const {ctx,dir,repo}=setup(t);const out=path.join(dir,'out');const trial=matrix(ctx).find(x=>x.arm==='minimal');
 const r=await runTrial(ctx,trial,{outputDir:out,fixture:true});
 assert.equal(r.success,true);assert.equal(r.runClass,'synthetic-fixture');assert.equal(r.usage,null);
 assert.equal(fs.readFileSync(path.join(repo,'src/answer.js'),'utf8'),'export const answer = 1;\n');
 await assert.rejects(()=>runTrial(ctx,trial,{outputDir:out,fixture:true}),/refusing to overwrite/);
});

test('agent evaluation: independent acceptance rejects a fake agent that fails the task',async t=>{
 const {ctx,dir}=setup(t,{badAgent:true});const trial=matrix(ctx).find(x=>x.arm==='baseline');
 const r=await runTrial(ctx,trial,{outputDir:path.join(dir,'out'),fixture:true});
 assert.equal(r.status,'completed');assert.equal(r.agentOK,true);assert.equal(r.accepted,false);assert.equal(r.success,false);
});

test('agent evaluation: synthetic end-to-end checks A/B/C but never counts real trials',async()=>{
 await syntheticSmoke();
});

test('agent evaluation: CLI refuses paid execution without explicit approval',t=>{
 const {ctx,dir}=setup(t);const cli=path.resolve(fixtureDir,'../cli.mjs');
 const result=spawnSync(process.execPath,[cli,'run','--manifest',ctx.absolute,'--out',path.join(dir,'out'),'--task','change-answer','--arm','minimal','--repeat','1'],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/--execute/);
});

test('agent evaluation: proposed 3 repositories × 3 tasks × 3 arms × 3 repeats plan has exactly 81 trials',t=>{
 const {ctx,dir,sha}=setup(t);
 ctx.manifest.repositories=[{id:'novnc',path:'./source',commit:sha},{id:'nvm',path:'./source',commit:sha},{id:'npm',path:'./source',commit:sha}];
 ctx.manifest.tasks=[];
 for(const repository of ['novnc','nvm','npm'])for(const kind of ['bug','test','change'])ctx.manifest.tasks.push({id:`${repository}-${kind}`,repository,prompt:'A fixed accepted task that remains identical across arms.',acceptance:{argv:[process.execPath,'{suite}/fixtures/accept.mjs'],timeoutMs:10000}});
 ctx.manifest.repeats=3;
 const plan=matrix(ctx);
 assert.equal(plan.length,81);
 assert.equal(new Set(plan.map(x=>x.id)).size,81);
});
