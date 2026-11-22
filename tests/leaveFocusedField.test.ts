import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function load(rn:any,raf:(f:()=>void)=>void){
  const mod={exports:{} as any};
  const req=(k:string)=>{if(k==='react-native')return rn;throw new Error('unexpected '+k);};
  new Function('require','module','exports','requestAnimationFrame',ts.transpileModule(readFileSync('src/shared/utils/leaveFocusedField.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,mod,mod.exports,raf);
  return mod.exports.leaveFocusedField as (then:()=>void)=>void;
}
test('leaving a screen blurs the focused field and dismisses the keyboard first, and runs the screen change two frames later',()=>{
  const log:string[]=[];const frames:(()=>void)[]=[];
  const leave=load({Keyboard:{dismiss:()=>log.push('dismiss')},TextInput:{State:{currentlyFocusedInput:()=>({blur:()=>log.push('blur')})}}},f=>frames.push(f));
  leave(()=>log.push('then'));
  assert.deepEqual(log,['blur','dismiss'],'nothing navigates in the same commit as the blur');
  frames.shift()!();assert.deepEqual(log,['blur','dismiss'],'still waiting after one frame');
  frames.shift()!();assert.deepEqual(log,['blur','dismiss','then'],'the screen change runs after the second frame');
});
test('with no focused field it still dismisses the keyboard and then continues',()=>{
  const log:string[]=[];const frames:(()=>void)[]=[];
  const leave=load({Keyboard:{dismiss:()=>log.push('dismiss')},TextInput:{State:{currentlyFocusedInput:()=>null}}},f=>frames.push(f));
  leave(()=>log.push('then'));frames.shift()!();frames.shift()!();
  assert.deepEqual(log,['dismiss','then']);
});
test('both ways out of step 2 (Continue to Price and the step tabs) go through it',()=>{
  // Source check: the view's wiring has no other observable seam in this harness.
  const view=readFileSync('src/features/property-listing/views/ListingDetailsView.tsx','utf8');
  assert.match(view,/onPress:\(\)=>leaveFocusedField\(vm\.continuePostingEstimate\)/);
  assert.match(view,/onSelect=\{target=>leaveFocusedField\(\(\)=>vm\.goToPostingStep\(target\)\)\}/);
});
