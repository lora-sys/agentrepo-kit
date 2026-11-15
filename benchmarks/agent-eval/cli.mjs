#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {loadManifest,matrix,verifySources,runTrial,readTrials,summarize,hash} from './lib.mjs';

const dirname=path.dirname(fileURLToPath(import.meta.url));
function argsOf(xs){
  const flags={};for(let i=0;i<xs.length;i++){const x=xs[i];if(x.startsWith('--')){const key=x.slice(2);flags[key]=xs[i+1]&&!xs[i+1].startsWith('--')?xs[++i]:true;}}
  return flags;
}
function print(o){console.log(JSON.stringify(o,null,2));}
const file=(p)=>path.resolve(String(p));
function help(){console.log(`AgentRepo real-agent evaluation harness
  node benchmarks/agent-eval/cli.mjs doctor --manifest FILE
  node benchmarks/agent-eval/cli.mjs plan --manifest FILE
  node benchmarks/agent-eval/cli.mjs run --manifest FILE --out DIR --task ID --arm minimal --repeat 1 --execute --allow-paid
  node benchmarks/agent-eval/cli.mjs run --manifest FILE --out DIR --all --execute --allow-paid
  node benchmarks/agent-eval/cli.mjs report --out DIR
  node benchmarks/agent-eval/cli.mjs smoke

The smoke command uses synthetic fixtures only. Real mode never runs without explicit cost approval.`);}
function programAvailable(name){const p=process.env.PATH||'';return p.split(path.delimiter).some(folder=>{try{fs.accessSync(path.join(folder,name),fs.constants.X_OK);return true;}catch{return false;}});}
async function main(argv=process.argv.slice(2)){
  const [cmd,...rest]=argv,opts=argsOf(rest);
  if(!cmd||['-h','--help','help'].includes(cmd)){help();return;}
  if(cmd==='report'){
    if(!opts.out)throw Error('--out is required');
    const results=readTrials(opts.out);
    const report=summarize(results,{includeSynthetic:opts['include-synthetic']===true});
    if(opts.markdown){
      const fmt=x=>x===null||x===undefined?'N/A':typeof x==='number'?String(Math.round(x*100)/100):String(x);
      const rows=['# AgentRepo A/B/C results','','| Arm | Trials | Success | Top 3 | Token records | Tokens per success |','| --- | ---: | ---: | ---: | ---: | ---: |'];
      for(const arm of ['baseline','minimal','full']){
        const g=report.groups[arm];rows.push('| '+arm+' | '+g.runs+' | '+g.successes+' | '+g.top3Hits+'/'+g.top3Measured+' | '+g.tokenRecorded+' | '+fmt(g.tokensPerSuccess)+' |');
      }
      rows.push('','Paired Token comparisons: minimal '+fmt(report.tokenComparisons.minimal.reductionRate)+', full '+fmt(report.tokenComparisons.full.reductionRate)+'.','',report.warning);
      const md=rows.join('\n')+'\n';
      if(opts.write)fs.writeFileSync(file(opts.write),md);
      console.log(md);return;
    }
    if(opts.write){fs.writeFileSync(file(opts.write),JSON.stringify(report,null,2)+'\n');}
    print(report);return;
  }
  if(cmd==='smoke'){
    await syntheticSmoke();return;
  }
  if(!opts.manifest)throw Error('--manifest is required');
  const ctx=loadManifest(opts.manifest);
  if(cmd==='doctor'){
    const repos=verifySources(ctx);
    const adapter=ctx.manifest.agent.kind;
    const available=adapter==='codex'?programAvailable('codex'):adapter==='fixture'||programAvailable(ctx.manifest.agent.argv[0]);
    let detectedAgentVersion=null,versionMatches=true;
    if(available&&adapter==='codex'){const v=spawnSync('codex',['--version'],{encoding:'utf8',timeout:10000});detectedAgentVersion=(v.stdout||v.stderr||'').trim();versionMatches=v.status===0&&detectedAgentVersion.includes(ctx.manifest.agent.version||'');}
    print({ok:available&&versionMatches,manifestHash:ctx.manifestHash,repositorySnapshots:repos,mode:ctx.manifest.mode,adapter,agentExecutableAvailable:available,detectedAgentVersion,versionMatches,plannedTrials:matrix(ctx).length});
    if(!available||!versionMatches)process.exitCode=2;return;
  }
  const all=matrix(ctx);
  const filtered=all.filter(t=>(!opts.task||t.taskId===opts.task)&&(!opts.arm||t.arm===opts.arm)&&(!opts.repeat||t.repeat===Number(opts.repeat)));
  if(!filtered.length)throw Error('no matching trials');
  if(cmd==='plan'){
    const snapshots=verifySources(ctx);
    print({benchmarkId:ctx.manifest.id,manifestHash:ctx.manifestHash,snapshots,mode:ctx.manifest.mode,trialCount:filtered.length,trials:filtered});return;
  }
  if(cmd==='run'){
    if(!opts.out)throw Error('--out is required');
    if(!opts.execute)throw Error('run is blocked without --execute');
    if(filtered.length>1&&!opts.all)throw Error('multiple trials require --all');
    if(ctx.manifest.mode==='real'&&!opts['allow-paid'])throw Error('real model execution requires --allow-paid');
    if(ctx.manifest.mode==='synthetic'&&!opts.fixture)throw Error('synthetic test execution requires --fixture');
    verifySources(ctx);
    const results=[];
    for(const trial of filtered){
      const result=await runTrial(ctx,trial,{outputDir:opts.out,executePaid:!!opts['allow-paid'],fixture:!!opts.fixture});
      results.push({trialId:trial.id,status:result.status,success:result.success,runClass:result.runClass});
    }
    print({count:results.length,results});return;
  }
  throw Error(`unknown command: ${cmd}`);
}
export async function syntheticSmoke(){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-agent-eval-smoke-'));
  try{
    const repo=path.join(temp,'source');fs.mkdirSync(repo);
    const git=(xs)=>{const r=spawnSync('git',['-C',repo,...xs],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
    git(['init','-q']);fs.mkdirSync(path.join(repo,'src'));
    fs.writeFileSync(path.join(repo,'src','answer.js'),'export const answer = 1;\n');
    git(['add','-A']);git(['-c','user.name=AgentRepo Eval','-c','user.email=eval@localhost','commit','-q','-m','snapshot']);
    const sha=git(['rev-parse','HEAD']);
    const manifest={schemaVersion:1,id:'self-test-fixture',mode:'synthetic',seed:43,repeats:1,arms:['baseline','minimal','full'],repositories:[{id:'fixture',path:'./source',commit:sha}],tasks:[{id:'change-answer',repository:'fixture',prompt:'Change src/answer.js exported answer to 42.',expectedPaths:['src/answer.js'],acceptance:{argv:[process.execPath,'{suite}/fixtures/accept.mjs','{workspace}'],timeoutMs:20000}}],agent:{kind:'fixture',model:'synthetic-no-llm',timeoutMs:15000,argv:[process.execPath,'{suite}/fixtures/agent.mjs']}};
    const mf=path.join(temp,'manifest.json');fs.writeFileSync(mf,JSON.stringify(manifest));
    const rootFixtures=path.join(temp,'fixtures');fs.mkdirSync(rootFixtures);
    for(const name of ['agent.mjs','accept.mjs'])fs.copyFileSync(path.join(dirname,'fixtures',name),path.join(rootFixtures,name));
    const ctx=loadManifest(mf),plan=matrix(ctx),out=path.join(temp,'out');
    verifySources(ctx);
    const results=[];for(const trial of plan)results.push(await runTrial(ctx,trial,{outputDir:out,fixture:true}));
    const summary=summarize(results);
    if(results.some(r=>r.status!=='completed'||!r.success))throw Error('synthetic fixture failed: '+JSON.stringify(results));
    if(summary.trials!==0)throw Error('synthetic fixtures leaked into real results');
    print({ok:true,label:'SYNTHETIC_ONLY',trials:results.length,successful:results.filter(x=>x.success).length,realTrialsIncluded:summary.trials});
  } finally{fs.rmSync(temp,{recursive:true,force:true});}
}
const current=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(current)main().catch(e=>{console.error(`ERROR: ${e.message}`);process.exitCode=1;});
