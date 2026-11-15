// Explicit synthetic process fixture. Never use to make real-model claims.
import fs from 'node:fs';
import path from 'node:path';
const root=process.env.AGENTREPO_EVAL_WORKSPACE;
if(!root)throw Error('Fixture has no workspace');
fs.writeFileSync(path.join(root,'src/answer.js'),'export const answer = 42;\n');
console.log(JSON.stringify({status:'synthetic',usage:{inputTokens:100,outputTokens:20},locatedPaths:['src/answer.js']}));
