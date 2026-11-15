import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT=path.resolve(__dirname,'../..');
const ARMS=['baseline','minimal','full'];
const safeId=/^[a-z0-9][a-z0-9_-]{0,60}$/;
const sha40=/^[a-f\d]{40}$/i;
const MAX_ARCHIVE=256*1024*1024;
const MAX_STDIO=8*1024*1024;

export const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const object=x=>x && typeof x==='object' && !Array.isArray(x);
const fail=msg=>{throw new Error(msg);};
const assert=(ok,msg)=>{if(!ok)fail(msg);};
const rel=(base,p)=>path.resolve(base,p);

export function loadManifest(filename){
  const absolute=path.resolve(filename),base=path.dirname(absolute);
  const raw=fs.readFileSync(absolute,'utf8');
  const value=JSON.parse(raw);
  assert(value.schemaVersion===1,'manifest.schemaVersion must be 1');
  assert(safeId.test(value.id||''),'manifest.id invalid');
  assert(Array.isArray(value.repositories)&&value.repositories.length,'manifest.repositories required');
  assert(Array.isArray(value.tasks)&&value.tasks.length,'manifest.tasks required');
  assert(Number.isInteger(value.repeats)&&value.repeats>=1&&value.repeats<=20,'manifest.repeats must be 1..20');
  assert(Number.isInteger(value.seed)&&value.seed>=0,'manifest.seed must be a nonnegative integer');
  assert(value.arms?.length===3 && ARMS.every(a=>value.arms.includes(a)),'manifest.arms must include baseline, minimal, full');
  const repositories=new Map();
  for(const r of value.repositories){
    assert(safeId.test(r.id||''),'repository.id invalid');
    assert(!repositories.has(r.id),`duplicate repository ${r.id}`);
    assert(typeof r.path==='string'&&r.path.length>0,'repository.path required');
    assert(sha40.test(r.commit||''),`repository ${r.id} requires a 40-character pinned commit`);
    repositories.set(r.id,{...r,absolutePath:rel(base,r.path)});
  }
  const ids=new Set();
  for(const t of value.tasks){
    assert(safeId.test(t.id||''),'task.id invalid');
    assert(!ids.has(t.id),`duplicate task ${t.id}`);ids.add(t.id);
    assert(repositories.has(t.repository),`task ${t.id}: unknown repository`);
    assert(typeof t.prompt==='string'&&t.prompt.length>=10,`task ${t.id}: prompt required`);
    assert(object(t.acceptance)&&Array.isArray(t.acceptance.argv)&&t.acceptance.argv.length>0,`task ${t.id}: independent acceptance.argv required`);
    assert(t.acceptance.argv.every(a=>typeof a==='string'&&a.length>0),`task ${t.id}: invalid acceptance.argv`);
    assert(Number.isInteger(t.acceptance.timeoutMs)&&t.acceptance.timeoutMs>0,`task ${t.id}: acceptance timeoutMs required`);
    if(value.mode==='real')assert(/^[a-f0-9]{64}$/i.test(t.acceptance.oracleSha256||''),`task ${t.id}: pinned acceptance.oracleSha256 required`);
    if(t.expectedPaths!==undefined)assert(Array.isArray(t.expectedPaths)&&t.expectedPaths.every(s=>typeof s==='string'),`task ${t.id}: expectedPaths invalid`);
  }
  assert(object(value.agent),'manifest.agent required');
  assert(['codex','json-bridge','fixture'].includes(value.agent.kind),'unsupported agent.kind');
  assert(typeof value.agent.model==='string'&&value.agent.model.length>0,'agent.model required');
  assert(Number.isInteger(value.agent.timeoutMs)&&value.agent.timeoutMs>0,'agent.timeoutMs required');
  if(value.agent.kind==='json-bridge'||value.agent.kind==='fixture'){
    assert(Array.isArray(value.agent.argv)&&value.agent.argv.every(x=>typeof x==='string'&&x.length>0),'agent.argv required');
  }
  if(value.agent.kind==='fixture')assert(value.mode==='synthetic','fixture agent permitted only in synthetic mode');
  else assert(value.mode==='real','real agent requires mode=real');
  if(value.mode==='real'){
    assert(!/REPLACE|TBD|PLACEHOLDER/i.test(value.agent.model),'replace the placeholder agent.model');
    assert(!/REPLACE|TBD|PLACEHOLDER/i.test(value.agent.version||''),'replace agent.version');
    for(const t of value.tasks)assert(!/REPLACE_WITH/i.test(t.prompt),'replace task prompt '+t.id);
  }
  return {manifest:value,absolute,base,manifestHash:hash(raw),repositories};
}

export function matrix(ctx){
  const {manifest}=ctx;
  const t=[];
  for(const task of manifest.tasks)for(let repeat=1;repeat<=manifest.repeats;repeat++)for(const arm of ARMS)
    t.push({taskId:task.id,repoId:task.repository,arm,repeat,id:`${task.id}__${arm}__${String(repeat).padStart(2,'0')}`});
  let state=manifest.seed||1;
  for(let i=t.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[t[i],t[j]]=[t[j],t[i]];}
  return t;
}

function git(args,options={}){
  const r=spawnSync('git',args,{encoding:'utf8',maxBuffer:MAX_ARCHIVE,timeout:60000,...options});
  if(r.error||r.status!==0)fail(`git ${args.slice(0,3).join(' ')} failed: ${(r.stderr||r.error?.message||'').trim()}`);
  return r.stdout.trim();
}
export function verifySources(ctx){
  const repos=[];
  for(const [id,r] of ctx.repositories){
    assert(fs.existsSync(r.absolutePath),`source ${id} missing: ${r.absolutePath}`);
    const real=git(['-C',r.absolutePath,'rev-parse',`${r.commit}^{commit}`]);
    assert(real.toLowerCase()===r.commit.toLowerCase(),`source ${id} not pinned to a full commit SHA`);
    const origin=spawnSync('git',['-C',r.absolutePath,'remote','get-url','origin'],{encoding:'utf8'});
    repos.push({id,commit:real,source:r.absolutePath,origin:origin.status===0?origin.stdout.trim():null});
  }
  for(const t of ctx.manifest.tasks){
    if(ctx.manifest.mode!=='real')continue;
    const oracleRel=t.acceptance.argv.find(x=>x.startsWith('{suite}/') && /\.(?:mjs|cjs|js|sh|py)$/.test(x));
    assert(oracleRel, 'task '+t.id+': external {suite}/... acceptance script required');
    const oracle=oracleRel.replace('{suite}',ctx.base);
    assert(fs.existsSync(oracle), 'task '+t.id+': acceptance script missing');
    assert(hash(fs.readFileSync(oracle))===t.acceptance.oracleSha256.toLowerCase(), 'task '+t.id+': acceptance oracle hash drift');
  }
  return repos;
}

function archiveGit(repository,dest){
  const archive=spawnSync('git',['-C',repository.absolutePath,'archive','--format=tar',repository.commit],{maxBuffer:MAX_ARCHIVE,timeout:60000});
  if(archive.error||archive.status!==0)fail(`git archive failed: ${archive.stderr?.toString()||archive.error?.message||''}`);
  fs.mkdirSync(dest,{recursive:true});
  const untar=spawnSync('tar',['-xf','-','-C',dest],{input:archive.stdout,timeout:60000,maxBuffer:1024*1024});
  if(untar.error||untar.status!==0)fail(`tar extraction failed: ${untar.stderr?.toString()||untar.error?.message||''}`);
  // Reject symlinks in the fixture to prevent links escaping the isolated workspace.
  const stack=[dest];
  while(stack.length){
    const dir=stack.pop();for(const n of fs.readdirSync(dir)){
      const p=path.join(dir,n),st=fs.lstatSync(p);
      if(st.isSymbolicLink())fail(`source archive contains symlink; fixture review required: ${p}`);
      if(st.isDirectory())stack.push(p);
    }
  }
}

function setupGit(workspace){
  git(['-C',workspace,'init','-q']);
  git(['-C',workspace,'add','-A']);
  git(['-C',workspace,'-c','user.name=AgentRepo Eval','-c','user.email=eval@localhost','commit','-q','--allow-empty','-m','trial baseline']);
}

export function parseCodexJsonl(stdout){
  let input=0,output=0,cached=0,turns=0,valid=0,reasoning=0;
  for(const ln of stdout.split(/\r?\n/)){
    if(!ln.trim())continue;
    let event;try{event=JSON.parse(ln);}catch{continue;}
    if(event.type!=='turn.completed'||!object(event.usage))continue;
    const u=event.usage;
    if(!Number.isInteger(u.input_tokens)||!Number.isInteger(u.output_tokens)||u.input_tokens<0||u.output_tokens<0)continue;
    valid++;turns++;input+=u.input_tokens;output+=u.output_tokens;
    cached+=Number.isInteger(u.cached_input_tokens)?u.cached_input_tokens:0;
    reasoning+=Number.isInteger(u.reasoning_output_tokens)?u.reasoning_output_tokens:0;
  }
  return {usage:valid?{inputTokens:input,outputTokens:output,cachedInputTokens:cached,reasoningOutputTokens:reasoning}:null,turns};
}

export function parseJsonBridge(stdout){
  let value;try{value=JSON.parse(stdout.trim());}catch{return {usage:null,locatedPaths:null};}
  const u=value.usage;
  const valid=object(u)&&Number.isInteger(u.inputTokens)&&u.inputTokens>=0&&Number.isInteger(u.outputTokens)&&u.outputTokens>=0;
  return {usage:valid?{inputTokens:u.inputTokens,outputTokens:u.outputTokens,cachedInputTokens:u.cachedInputTokens||0}:null,locatedPaths:Array.isArray(value.locatedPaths)?value.locatedPaths.filter(x=>typeof x==='string').slice(0,3):null};
}

function baseEnv(){
  const keys=['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','SYSTEMROOT','WINDIR','USERPROFILE','NODE_OPTIONS'];
  return Object.fromEntries(keys.filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
}
export async function execute(argv,{cwd,timeoutMs,env={},maxStdout=MAX_STDIO}={}){
  assert(Array.isArray(argv)&&argv.length>0,'empty argv');
  return await new Promise(resolve=>{
    let stdout='',stderr='',overflow=false,timedOut=false,done=false;
    const child=spawn(argv[0],argv.slice(1),{cwd,env:{...baseEnv(),...env},shell:false,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
    const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')child.kill('SIGKILL');else{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}},timeoutMs);
    const take=(which,buf)=>{
      const value=buf.toString('utf8');
      if(which==='stdout')stdout+=value;else stderr+=value;
      if(stdout.length+stderr.length>maxStdout){overflow=true;if(process.platform==='win32')child.kill('SIGKILL');else{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}}
    };
    child.stdout.on('data',x=>take('stdout',x));child.stderr.on('data',x=>take('stderr',x));
    child.once('error',e=>{if(done)return;done=true;clearTimeout(timer);resolve({code:null,stdout,stderr,spawnError:e.message,timedOut,overflow});});
    child.once('close',(code,signal)=>{if(done)return;done=true;clearTimeout(timer);resolve({code,signal,stdout,stderr,timedOut,overflow});});
  });
}

function interpolate(argv,vars){return argv.map(s=>s.replace(/\{(workspace|suite|taskId|prompt)\}/g,(_,key)=>vars[key]));}
function agentArgv(manifest,vars){
  if(manifest.agent.kind==='codex')return ['codex','exec','--ephemeral','--json','--sandbox','workspace-write','--ignore-user-config',...(manifest.agent.model?['--model',manifest.agent.model]:[]),vars.prompt];
  return interpolate(manifest.agent.argv,vars);
}

function readUsage(manifest,stdout){
  return manifest.agent.kind==='codex'?parseCodexJsonl(stdout):parseJsonBridge(stdout);
}

export async function runTrial(ctx,entry,{outputDir,executePaid=false,fixture=false}={}){
  const {manifest}=ctx;
  if(manifest.mode==='real'&&!executePaid)fail('Real model runs require --allow-paid and a reviewed manifest');
  if(manifest.mode==='synthetic'&&!fixture)fail('Synthetic fixture requires --fixture; it is never counted as a real Agent run');
  const task=manifest.tasks.find(x=>x.id===entry.taskId);
  const repo=ctx.repositories.get(task.repository);
  verifySources(ctx);
  if(manifest.mode==='real'&&manifest.agent.kind==='codex'){
    const v=spawnSync('codex',['--version'],{encoding:'utf8',timeout:10000});
    assert(v.status===0 && (v.stdout||v.stderr||'').includes(manifest.agent.version||''),'Codex CLI version does not match pinned agent.version');
  }
  const trialDir=path.join(path.resolve(outputDir),'trials',entry.id);
  assert(!fs.existsSync(trialDir),`refusing to overwrite trial result ${trialDir}`);
  fs.mkdirSync(trialDir,{recursive:true});
  const workspace=path.join(trialDir,'workspace');
  const resultPath=path.join(trialDir,'result.json');
  let stage='setup',modelRun=null,accepted=null,preparation=null;
  const started=Date.now();
  try{
    archiveGit(repo,workspace);
    if(entry.arm!=='baseline'){
      const opts=['init',workspace,'--json'];if(entry.arm==='minimal')opts.push('--minimal');
      preparation=await execute([process.execPath,path.join(KIT_ROOT,'bin/agentrepo.mjs'),...opts],{cwd:workspace,timeoutMs:60000});
      if(preparation.code!==0)fail(`scaffold initialization failed: ${preparation.stderr.slice(0,500)}`);
    }
    setupGit(workspace);
    stage='agent';
    const vars={workspace,suite:ctx.base,taskId:entry.taskId,prompt:task.prompt};
    const env={AGENTREPO_EVAL_TASK:entry.taskId,AGENTREPO_EVAL_ARM:entry.arm,AGENTREPO_EVAL_WORKSPACE:workspace};
    // Never forward API keys into a repository-editing agent subprocess. Use preauthenticated CLI access.
    modelRun=await execute(agentArgv(manifest,vars),{cwd:workspace,timeoutMs:manifest.agent.timeoutMs,env});
    stage='acceptance';
    const acceptArgv=interpolate(task.acceptance.argv,vars);
    accepted=await execute(acceptArgv,{cwd:workspace,timeoutMs:task.acceptance.timeoutMs});
    const parsed=readUsage(manifest,modelRun.stdout);
    const real=manifest.mode==='real';
    const usage=real?parsed.usage:null;
    const located=parsed.locatedPaths;
    const expected=task.expectedPaths??[];
    const top3Hit=located&&expected.length?located.some(x=>expected.includes(x)):null;
    const agentOK=modelRun.code===0&&!modelRun.timedOut&&!modelRun.overflow;
    const acceptedOK=accepted.code===0&&!accepted.timedOut&&!accepted.overflow;
    const result={schemaVersion:1,benchmarkId:manifest.id,taskId:entry.taskId,repository:repo.id,commit:repo.commit,oracleSha256:task.acceptance.oracleSha256||null,arm:entry.arm,repeat:entry.repeat,trialId:entry.id,mode:manifest.mode,agent:{kind:manifest.agent.kind,model:manifest.agent.model,version:manifest.agent.version??null},manifestHash:ctx.manifestHash,agentOK,accepted:acceptedOK,success:agentOK&&acceptedOK,top3Hit,manualInterventions:0,usage,usageComplete:real?Boolean(usage):false,elapsedMs:Date.now()-started,exit:{agent:modelRun.code,acceptance:accepted.code},timedOut:{agent:!!modelRun.timedOut,acceptance:!!accepted.timedOut},overflow:{agent:!!modelRun.overflow,acceptance:!!accepted.overflow},runClass:real?'coding-agent':'synthetic-fixture',status:'completed'};
    fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');
    return result;
  }catch(e){
    const result={schemaVersion:1,benchmarkId:manifest.id,taskId:entry.taskId,repository:repo.id,commit:repo.commit,arm:entry.arm,repeat:entry.repeat,trialId:entry.id,mode:manifest.mode,runClass:manifest.mode==='real'?'coding-agent':'synthetic-fixture',success:false,status:'harness_error',stage,error:String(e.message),usage:null,usageComplete:false,elapsedMs:Date.now()-started};
    fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');return result;
  }
}

export function summarize(results,{includeSynthetic=false}={}){
  const accepted=results.filter(r=>includeSynthetic||r.runClass==='coding-agent');
  const groups={};
  for(const arm of ARMS){
    const subset=accepted.filter(r=>r.arm===arm),withUsage=subset.filter(r=>r.usageComplete&&r.usage);
    const successes=subset.filter(r=>r.success);
    const top3=subset.filter(r=>r.top3Hit!==null&&r.top3Hit!==undefined);
    const sum=x=>x.reduce((a,b)=>a+b,0);
    const tokenCount=x=>x.usage.inputTokens+x.usage.outputTokens;
    groups[arm]={runs:subset.length,successes:successes.length,successRate:subset.length?successes.length/subset.length:null,top3Hits:top3.filter(r=>r.top3Hit).length,top3Measured:top3.length,tokenRecorded:withUsage.length,totalTokens:withUsage.length?sum(withUsage.map(tokenCount)):null,tokensPerSuccess:successes.length===withUsage.filter(x=>x.success).length&&successes.length?sum(successes.map(tokenCount))/successes.length:null,meanManualInterventions:subset.length?sum(subset.map(x=>x.manualInterventions??0))/subset.length:null};
  }
  const pairs={};
  for(const arm of ['minimal','full']){
    let referenceTokens=0,armTokens=0,pairCount=0;
    const baseline=new Map(accepted.filter(r=>r.arm==='baseline'&&r.usageComplete&&r.usage)
      .map(r=>[[r.taskId,r.repository,r.commit,r.repeat,r.agent?.model,r.manifestHash].join('::'),r]));
    for(const trial of accepted.filter(r=>r.arm===arm&&r.usageComplete&&r.usage)){
      const key=[trial.taskId,trial.repository,trial.commit,trial.repeat,trial.agent?.model,trial.manifestHash].join('::');
      const ref=baseline.get(key);if(!ref)continue;
      const total=x=>x.usage.inputTokens+x.usage.outputTokens;
      referenceTokens+=total(ref);armTokens+=total(trial);pairCount++;
    }
    pairs[arm]={pairs:pairCount,baselineTokens:pairCount?referenceTokens:null,armTokens:pairCount?armTokens:null,reductionRate:pairCount&&referenceTokens>0?1-armTokens/referenceTokens:null};
  }
  return {runClass:includeSynthetic?'synthetic-included':'real-only',trials:accepted.length,groups,tokenComparisons:pairs,warning:'Missing or unpaired provider usage is never treated as zero. Calculate reductions only on identical task/repeat pairs with valid real token usage.'};
}

export function readTrials(outputDir){
  const root=path.join(path.resolve(outputDir),'trials');
  if(!fs.existsSync(root))return [];
  return fs.readdirSync(root).sort().flatMap(id=>{
    const file=path.join(root,id,'result.json');return fs.existsSync(file)?[JSON.parse(fs.readFileSync(file,'utf8'))]:[];
  });
}
