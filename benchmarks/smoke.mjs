#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {doInit,scenarioEval,replayDream,auditEval} from '../bin/agentrepo.mjs';
const t=fs.mkdtempSync(path.join(os.tmpdir(),'agentrepo-smoke-'));
try{
  doInit(t);
  const scenarios=scenarioEval(path.join(t,'eval/scenarios.json'));
  const dream=replayDream();
  const audit=auditEval();
  const report={ok:scenarios.ok&&dream.ok&&audit.ok,scenarios:{passed:scenarios.passed,total:scenarios.total},dream:{passed:dream.passed,total:dream.total},audit:{matrix:audit.matrix,precision:audit.precision,recall:audit.recall},notice:'No real model tokens or autonomous coding trials were measured.'};
  console.log(JSON.stringify(report,null,2));
  if(!report.ok)process.exitCode=1;
}finally{fs.rmSync(t,{recursive:true,force:true});}
