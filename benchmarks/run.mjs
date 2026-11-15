#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {doInit,doDocs,doDoctor,locationEval,sourceFiles,runEval,locate} from '../bin/agentrepo.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const benchmark=JSON.parse(fs.readFileSync(path.join(here,'cases.json'),'utf8'));
const opt=(name)=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const src=opt('--projects-dir'),dest=opt('--output');
if(!src){console.error('Usage: node benchmarks/run.mjs --projects-dir DIR [--output FILE]');process.exit(2);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-eval-'));
const report={schemaVersion:2,kitVersion:'0.5.0',date:new Date().toISOString(),sourceLocation:path.resolve(src),sourceNotes:'Source snapshots are third-party code; not the complete Git history. See versions and source hashes.',projects:[],description:'Independent CLI/scaffold and source-path localization evaluations. No model execution and no measured model tokens.'};
function sourceHash(root,files){const h=crypto.createHash('sha256');for(const f of files){h.update(f);h.update('\0');h.update(fs.readFileSync(path.join(root,f)));h.update('\0');}return h.digest('hex');}
function allFiles(root){const results=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const abs=path.join(dir,e.name);if(e.isDirectory()){if(e.name!=='.git'&&e.name!=='node_modules')walk(abs);}else if(e.isFile())results.push(path.relative(root,abs).replaceAll(path.sep,'/'));}}walk(root);return results.sort();}

try{
for(const name of ['novnc','nvm','npm']){
  const from=path.join(path.resolve(src),name);if(!fs.existsSync(from))throw new Error('Missing source snapshot: '+from);
  const into=path.join(tmp,name);fs.cpSync(from,into,{recursive:true});
  const originalFiles=allFiles(into),hashBefore=sourceHash(into,originalFiles),before=sourceFiles(into);
  const fileBytes=new Map(before.map(f=>[f,fs.statSync(path.join(into,f)).size]));
  const pkgFile=path.join(into,'package.json');const version=fs.existsSync(pkgFile)?JSON.parse(fs.readFileSync(pkgFile,'utf8')).version:null;
  const init=doInit(into),again=doInit(into),doctor=doDoctor(into),docs=doDocs(into),reg=runEval(into,path.join(into,'eval/regressions.json'));
  const hashAfter=sourceHash(into,originalFiles);
  const cases=benchmark.cases.filter(x=>x.project===name);
  const caseFile=path.join(into,'.agentrepo','cache','location-cases.json');fs.mkdirSync(path.dirname(caseFile),{recursive:true});fs.writeFileSync(caseFile,JSON.stringify({cases}));
  const byMode={};for(const mode of ['filename','enhanced']){byMode[mode]=locationEval(into,caseFile,mode,3);}
  const payload=fs.readFileSync(path.join(into,'AGENTS.md'),'utf8');
  const allPaths=before.join('\n');
  const records=cases.map((c,i)=>{
    const a=byMode.filename.results[i],b=byMode.enhanced.results[i];
    const response=locate(into,c.query,{mode:'enhanced',k:3});
    const top3Paths=response.results.map(x=>x.file);
    const summaryBytes=Buffer.byteLength(payload+top3Paths.join('\n'));
    return {id:c.id,split:c.split,query:c.query,expected:c.expected,baselineRank:a.rank,rank:b.rank,baselineHit3:a.hitK,hit1:b.hit1,hit3:b.hitK,naiveManifestBytes:Buffer.byteLength(allPaths),targetedContextBytes:summaryBytes,top3:top3Paths};
  });
  const split=(key)=>{const rows=records.filter(r=>r.split===key);return {n:rows.length,filenameTop3:rows.filter(x=>x.baselineHit3).length,enhancedTop1:rows.filter(x=>x.hit1).length,enhancedTop3:rows.filter(x=>x.hit3).length};};
  report.projects.push({name,version,sourceFiles:before.length,originalFiles:originalFiles.length,sourceHashSha256:hashBefore,originalFilesUnchanged:originalFiles.every(f=>fs.existsSync(path.join(into,f))),sourceUnchanged:hashBefore===hashAfter,added:init.created.length,preserved:again.created.length===0,doctor:doctor.ok,docs:docs.ok,regression:{passed:reg.passed,total:reg.total},dev:split('dev'),test:split('test'),records});
}
const rows=report.projects.flatMap(p=>p.records),n=rows.length;const heldout=rows.filter(r=>r.split==='test');const dev=rows.filter(r=>r.split==='dev');
report.totals={cases:n,devCases:dev.length,heldoutCases:heldout.length,devTop3:dev.filter(r=>r.hit3).length,heldoutTop3:heldout.filter(r=>r.hit3).length,heldoutTop1:heldout.filter(r=>r.hit1).length,baselineTop3:rows.filter(r=>r.baselineHit3).length,enhancedTop3:rows.filter(r=>r.hit3).length,enhancedTop1:rows.filter(r=>r.hit1).length,baselineTop3Rate:rows.filter(r=>r.baselineHit3).length/n,enhancedTop3Rate:rows.filter(r=>r.hit3).length/n,enhancedTop1Rate:rows.filter(r=>r.hit1).length/n,structuralPassed:report.projects.reduce((s,p)=>s+p.regression.passed,0),structuralTotal:report.projects.reduce((s,p)=>s+p.regression.total,0),sourcePreserved:report.projects.every(p=>p.sourceUnchanged&&p.originalFilesUnchanged&&p.preserved),naiveManifestBytesMean:Math.round(rows.reduce((s,r)=>s+r.naiveManifestBytes,0)/n),targetedContextBytesMean:Math.round(rows.reduce((s,r)=>s+r.targetedContextBytes,0)/n),contextBytesChange:null};
report.totals.contextBytesChange=1-report.totals.targetedContextBytesMean/report.totals.naiveManifestBytesMean;
report.totals.contextNote='Bytes compare a full filename manifest versus AGENTS.md plus top-3 file paths, not comparable model input tokens. This is not a token reduction measurement.';
if(dest){fs.mkdirSync(path.dirname(path.resolve(dest)),{recursive:true});fs.writeFileSync(path.resolve(dest),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report.totals,null,2));
if(report.projects.some(p=>!p.sourceUnchanged||!p.preserved||!p.doctor||!p.docs||p.regression.passed!==p.regression.total))process.exitCode=1;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
