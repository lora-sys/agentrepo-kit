#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'src/agentrepo.mjs'),'utf8');
const names=['AGENTS.md','README.md','docs/architecture.md','docs/development.md','.env.example','.gitignore'];
const githubNames=['ISSUE_TEMPLATE/config.yml','ISSUE_TEMPLATE/bug_report.yml','ISSUE_TEMPLATE/feature_request.yml','ISSUE_TEMPLATE/question.yml','ISSUE_TEMPLATE/broken_skill_or_integration.yml','pull_request_template.md','workflows/agentrepo-ci.yml','CHANGELOG.md'];
const registry=Object.fromEntries([...names.map(name=>[name,fs.readFileSync(path.join(root,'templates/project',name==='.gitignore'?'gitignore.tmpl':name),'utf8')]),...githubNames.map(name=>['github/'+name,fs.readFileSync(path.join(root,'templates/github',name),'utf8')])]);
const marker='/* @agentrepo-project-templates */';
if(source.split(marker).length!==2)throw Error('Expected exactly one project template marker');
const result=source.replace(marker,`const PROJECT_TEMPLATES = Object.freeze(${JSON.stringify(registry,null,2)});`);
const out=path.join(root,'bin/agentrepo.mjs');
if(process.argv.includes('--check')){
 if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==result){
   process.stderr.write('CLI bundle differs from source templates. Run npm run build:cli\n');
   process.exitCode=1;
 }else process.stdout.write('CLI bundle matches source templates\n');
}else{
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,result);fs.chmodSync(out,0o755);
 process.stdout.write('Generated self-contained bin/agentrepo.mjs\n');
}
