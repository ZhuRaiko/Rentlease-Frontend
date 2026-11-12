import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function harness(){
 let state={noticeId:4,notice:'Old saved message',pending:null as any,error:null as any},cursor=0;const slots:any[]=[],effects:any[]=[],listeners=new Set<()=>void>(),timers=new Map<number,()=>void>();let serial=0;
 const flow={getSnapshot:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},clearNotice(){state={...state,notice:null as any};listeners.forEach(f=>f());}};
 const req=(key:string)=>{assert.equal(key,'react');return{useState:(initial:any)=>{const at=cursor++;if(!slots[at])slots[at]={value:initial};return[slots[at].value,(v:any)=>slots[at].value=v];},useEffect:(fn:()=>any,deps:any[])=>{const at=cursor++;if(!slots[at]||deps.some((v,i)=>v!==slots[at].deps[i]))effects.push(()=>{slots[at]?.cleanup?.();slots[at]={deps,cleanup:fn()};});}};};
 const mod={exports:{} as any};new Function('require','module','exports','setTimeout','clearTimeout',ts.transpileModule(readFileSync('src/features/search-discovery/viewModels/useDiscoverySaveToast.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,mod,mod.exports,(fn:()=>void,ms:number)=>{assert.equal(ms,3500);timers.set(++serial,fn);return serial;},(id:number)=>timers.delete(id));
 return{render(owner:string|undefined='one',visible=true){cursor=0;const result=mod.exports.useDiscoverySaveToast(flow,owner,visible);effects.splice(0).forEach(fn=>fn());return result;},event(patch:Partial<typeof state>){state={...state,...patch};listeners.forEach(f=>f());},expire(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());},timers:()=>timers.size,notice:()=>state.notice,dispose(){slots.forEach(s=>s.cleanup?.());}};
}
test('save toast ignores old notices, shows only new confirmation, consumes and expires',()=>{
 const h=harness();assert.equal(h.render(),null);h.event({pending:{id:'listing'},notice:null as any});assert.equal(h.render(),null);h.event({noticeId:5,pending:null,notice:'Listing saved.'});assert.equal(h.render(),'Listing saved.');assert.equal(h.notice(),null);assert.equal(h.timers(),1);h.expire();assert.equal(h.render(),null);h.event({error:'lookup failed'});assert.equal(h.render(),null);h.dispose();
});
test('toast does not replay after navigation and masks account switches before effects',()=>{
 const h=harness();h.render();h.event({noticeId:5,notice:'Removed'});assert.equal(h.render(),'Removed');assert.equal(h.render('two'),null);h.render('two');h.event({noticeId:6,notice:'Saved for two'});assert.equal(h.render('two'),'Saved for two');assert.equal(h.render('two',false),null);h.render('two',true);assert.equal(h.render('two',true),null);h.dispose();assert.equal(h.timers(),0);
});
test('unknown outcomes and retries never announce success; successive successes replace timer',()=>{
 const h=harness();h.render();h.event({noticeId:5,notice:null as any,pending:{id:'listing'},error:'Outcome unknown'});assert.equal(h.render(),null);h.event({noticeId:6,notice:'Saved',pending:null,error:null});assert.equal(h.render(),'Saved');h.event({noticeId:7,notice:'Removed'});assert.equal(h.render(),'Removed');assert.equal(h.timers(),1);h.dispose();
});


test('native heart has no text glyph or image dependency and parses as valid TSX',()=>{
 const source=readFileSync('src/shared/components/HeartIcon.tsx','utf8');const parsed=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});assert.equal(parsed.diagnostics?.length,0);
 assert.doesNotMatch(source,/<Text|<Image|\\u2661|\\u2665/);assert.match(source,/filled/);assert.match(source,/no-hide-descendants/);
});
