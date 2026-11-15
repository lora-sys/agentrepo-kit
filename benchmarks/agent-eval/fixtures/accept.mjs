// Hidden fixture oracle, invoked by the runner outside the agent workspace.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
assert.match(fs.readFileSync(path.join(process.argv[2],'src/answer.js'),'utf8'),/answer\s*=\s*42/);
