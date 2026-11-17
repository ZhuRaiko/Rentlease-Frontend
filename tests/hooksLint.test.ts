// Rules of Hooks is checked by ESLint; this makes `npm test` fail on a violation too, so the bug cannot reach a device
// even when only the tests are run. (exhaustive-deps stays a warning and is not asserted here.)
import test from 'node:test';
import assert from 'node:assert/strict';
test('src has no react-hooks/rules-of-hooks violations',async()=>{
  const {ESLint}=require('eslint');
  const results=await new ESLint({cwd:process.cwd()}).lintFiles(['App.tsx','src']);
  const bad=results.flatMap((r:any)=>r.messages.filter((m:any)=>m.ruleId==='react-hooks/rules-of-hooks'||m.fatal).map((m:any)=>`${r.filePath}:${m.line} ${m.message}`));
  assert.deepEqual(bad,[]);
});
