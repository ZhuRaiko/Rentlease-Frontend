/// <reference types="node" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

function slider(value=3,disabled=false){
  const path=resolve('src/features/search-discovery/components/NearbyRadiusSlider.tsx'),actual=createRequire(path),mod={exports:{} as any};let handlers:any;
  const req=(key:string):any=>{
    if(key==='react')return {useState:(v:any)=>[v,()=>{}],useRef:(v:any)=>({current:v}),useMemo:(fn:any)=>fn(),useEffect:(fn:any)=>fn()};
    if(key==='react-native')return {View:'View',Text:'Text',StyleSheet:{create:(v:any)=>v},PanResponder:{create:(v:any)=>{handlers=v;return {panHandlers:{}};}}};
    if(key==='react/jsx-runtime')return {jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};
    return actual(key);
  };
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',code)(req,mod,mod.exports);
  const calls:number[]=[],tree=mod.exports.NearbyRadiusSlider({value,disabled,onComplete:(n:number)=>calls.push(n)}),control=tree.props.children[1];
  control.props.onLayout({nativeEvent:{layout:{width:200}}});
  return {calls,control,handlers,radius:mod.exports.sliderRadius};
}
test('radius slider clamps at 1/20 and rounds to integer kilometers',()=>{
  const s=slider();assert.equal(s.radius(-100,200),1);assert.equal(s.radius(300,200),20);
  for(let km=1;km<=20;km++)assert.equal(s.radius((km-1)/19*200,200),km);
  assert.deepEqual(s.control.props.accessibilityValue,{min:1,max:20,now:3,text:'3 kilometers'});
});
test('slider dragging searches only on release; responder cancellation never searches',()=>{
  const s=slider();s.handlers.onPanResponderGrant({nativeEvent:{locationX:0}});s.handlers.onPanResponderMove(null,{dx:200});assert.deepEqual(s.calls,[]);
  s.handlers.onPanResponderRelease();assert.deepEqual(s.calls,[20]);
  const canceled=slider();canceled.handlers.onPanResponderGrant({nativeEvent:{locationX:200}});canceled.handlers.onPanResponderTerminate();assert.deepEqual(canceled.calls,[]);
});
test('adjustable actions step once, ignore unknown actions and honor disabled/limits',()=>{
  const action=(s:ReturnType<typeof slider>,name:string)=>s.control.props.onAccessibilityAction({nativeEvent:{actionName:name}});
  const s=slider();action(s,'increment');action(s,'decrement');action(s,'activate');assert.deepEqual(s.calls,[4,2]);
  const low=slider(1),high=slider(20),disabled=slider(3,true);action(low,'decrement');action(high,'increment');action(disabled,'increment');assert.deepEqual([...low.calls,...high.calls,...disabled.calls],[]);assert.equal(disabled.handlers.onStartShouldSetPanResponder(),false);
});
