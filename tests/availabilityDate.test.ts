import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {spawnSync} from 'node:child_process';
import {emptyListingDraft} from '../src/features/property-listing/models/PropertyListing';
import {listingDraftPayload} from '../src/features/property-listing/models/PersistedListingDraft';
import {availabilityDateFromLocal,availabilityDateToLocal,availabilityDateLabel} from '../src/features/property-listing/models/AvailabilityDate';
test('availability remains optional and invalid manual dates are not accepted',()=>{for(const v of ['', '2026-02-30','2026-13-01','Oct 30, 2026'])assert.equal(availabilityDateToLocal(v),null);assert.equal(availabilityDateLabel(''),'Select date');});
test('local calendar selection pads month/day, changes and preserves leap days',()=>{for(const v of ['2026-01-02','2024-02-29','2026-10-30','1999-01-01'])assert.equal(availabilityDateFromLocal(availabilityDateToLocal(v)!),v);assert.match(availabilityDateLabel('2026-10-30'),/Oct 30, 2026/);assert.throws(()=>availabilityDateFromLocal(new Date(NaN)));});
test('calendar normalization uses local components instead of shifting to UTC',()=>{const date=new Date(2026,9,30,0);date.toISOString=()=>{throw new Error('UTC conversion is forbidden')};assert.equal(availabilityDateFromLocal(date),'2026-10-30');assert.equal(availabilityDateToLocal('2026-10-30')!.getHours(),12);});
test('UTC, Manila and Honolulu selections retain the same calendar date',()=>{
  const source=ts.transpileModule(readFileSync('src/features/property-listing/models/AvailabilityDate.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  for(const TZ of ['UTC','Asia/Manila','Pacific/Honolulu']){const result=spawnSync(process.execPath,['-e',source+'; console.log(exports.availabilityDateFromLocal(new Date(2026,0,2,0)))'],{env:{...process.env,TZ},encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'2026-01-02');}
});
test('selected date retains ISO RPC contract and clearing uses existing optional null default',()=>{
  const form={...emptyListingDraft,title:'Home',description:'Rental home',askingRent:'10000',availableDate:availabilityDateFromLocal(new Date(2024,1,29))};
  assert.equal(listingDraftPayload('10000000-0000-4000-8000-000000000001',form).p_available_from,'2024-02-29');
  const cleared=listingDraftPayload('10000000-0000-4000-8000-000000000001',{...form,availableDate:''});assert.equal(cleared.p_available_from??null,null);
});
test('native calendar opens only on tap, selection/change normalize and clear remains optional',()=>{
  const path=resolve('src/features/property-listing/components/AvailabilityDateField.tsx'),actual=createRequire(path);let options:any=null;const changes:string[]=[];
  const req=(name:string):any=>name==='react'?{useState:()=>[null,()=>{}]}:name==='@react-native-community/datetimepicker'?{DateTimePickerAndroid:{open:(args:any)=>{options=args;}}}:name==='react-native'?{Pressable:'Pressable',View:'View',Text:'Text',StyleSheet:{create:(v:any)=>v}}:name==='react/jsx-runtime'?{jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})}:actual(name);
  const mod={exports:{} as any};new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);
  const render=(value:string)=>mod.exports.AvailabilityDateField({value,onChange:(v:string)=>changes.push(v)});
  const nodes=(n:any):any[]=>n&&typeof n==='object'?[n,...[n.props?.children].flat(Infinity).flatMap(nodes)]:[];
  let tree=render('');assert.equal(options===null,true);assert.equal(nodes(tree).some(n=>n.props?.accessibilityLabel==='Clear availability date'),false);
  nodes(tree).find(n=>n.props?.accessibilityLabel==='Select availability date').props.onPress();assert.equal(options.mode,'date');assert.equal(options.minimumDate,undefined);assert.equal(options.maximumDate,undefined);assert.equal(changes.length,0);
  options.onValueChange({},new Date(2026,9,30));assert.deepEqual(changes,['2026-10-30']);tree=render(changes[0]!);assert.match(JSON.stringify(tree),/Oct 30, 2026/);
  nodes(tree).find(n=>n.props?.accessibilityLabel?.startsWith('Change availability')).props.onPress();options.onValueChange({},new Date(2024,1,29));assert.equal(changes.at(-1),'2024-02-29');nodes(tree).find(n=>n.props?.accessibilityLabel==='Clear availability date').props.onPress();assert.equal(changes.at(-1),'');
});
