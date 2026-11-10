/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keyboardOverlap,focusedScrollOffset} from '../src/shared/models/KeyboardGeometry';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
test('only actual overlap is removed; Android resize is never counted twice',()=>{
 assert.equal(keyboardOverlap(800,500),300);assert.equal(keyboardOverlap(500,500),0);assert.equal(keyboardOverlap(460,500),0);assert.equal(keyboardOverlap(800,null),0);assert.equal(keyboardOverlap(NaN,500),0);assert.equal(keyboardOverlap(800,-1),0);
});
test('focus scrolling uses the actual viewport including fixed footers and does nothing for visible inputs',()=>{assert.equal(focusedScrollOffset(500,550,100,450,200),324);assert.equal(focusedScrollOffset(200,250,100,450,200),null);assert.equal(focusedScrollOffset(50,90,100,450,200),134);});
test('shared focus handler reveals only its own focused input and cleans up keyboard listeners',async()=>{
 const file=resolve('src/shared/components/KeyboardAwareScrollView.tsx'),actual=createRequire(file),mod={exports:{} as any},events=new Map<string,()=>void>(),cleanups:(()=>void)[]=[],scrolls:number[]=[];
 const input={measureInWindow:(cb:any)=>cb(0,470,100,100)};let current:any=input;
 const req=(key:string):any=>{if(key==='react')return{forwardRef:(fn:any)=>fn,useRef:(v:any)=>({current:v}),useCallback:(fn:any)=>fn,useEffect:(fn:any)=>cleanups.push(fn())};if(key==='react/jsx-runtime')return{jsx:(type:any,props:any)=>({type,props})};if(key==='react-native')return{ScrollView:'ScrollView',TextInput:{State:{currentlyFocusedInput:()=>current}},Keyboard:{isVisible:()=>true,metrics:()=>({screenY:500}),addListener:(event:string,cb:()=>void)=>{events.set(event,cb);return{remove:()=>events.delete(event)};}}};return actual(key);};
 new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);
 const tree=mod.exports.KeyboardAwareScrollView({},null);tree.props.ref({getNativeScrollRef:()=>({measureInWindow:(cb:any)=>cb(0,0,300,500)}),scrollTo:({y}:{y:number})=>scrolls.push(y)});tree.props.onFocus({});await new Promise(r=>setTimeout(r,110));assert.deepEqual(scrolls,[94]);
 current={measureInWindow:input.measureInWindow};events.get('keyboardDidShow')?.();await new Promise(r=>setTimeout(r,110));assert.deepEqual(scrolls,[94],'background forms must not scroll another screen\'s input');cleanups.forEach(fn=>fn());assert.equal(events.size,0);
});
test('major forms and native location modal use the shared strategy without changing Android resize configuration',()=>{
 for(const file of ['authentication/components/AuthScaffold','property-listing/components/ListingWizardScaffold','search-discovery/views/SearchLocationView','ratings-reports/components/RatingsReportsScaffold','user-verification/components/VerificationScaffold','rental-price-estimation/components/PriceEstimationScaffold'])assert.match(readFileSync('src/features/'+file+'.tsx','utf8'),/KeyboardAwareScrollView/);
 assert.match(readFileSync('src/shared/components/ScreenContainer.tsx','utf8'),/<KeyboardViewport>/);
 assert.match(readFileSync('src/features/property-listing/views/ListingComposerView.tsx','utf8'),/<ScreenContainer padded=\{false\}><PropertyLocationToolView/);
 assert.match(readFileSync('android/app/src/main/AndroidManifest.xml','utf8'),/windowSoftInputMode="adjustResize"/);
});
