import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {sharedStub} from './support/sharedStubs';

// The shared listing card, rendered for real with stand-in children. Saved listings, Discover, For You, search results and the nearby list all render it.
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
export function cardHarness(){
 const file=resolve('src/features/search-discovery/components/ListingCard.tsx'),actual=createRequire(file),m={exports:{} as any};let failed=false;
 const req=(key:string):any=>{
  if(key==='react')return{useState:()=>[failed,(v:boolean)=>failed=v],useEffect:()=>{}};
  if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>typeof type==='function'?type(props):{type,props};return{jsx,jsxs:jsx};}
  if(key==='react-native')return{Image:'Image',Text:'Text',View:'View',Pressable:'Pressable',StyleSheet:{create:(v:any)=>v}};
  if(key.endsWith('/SaveListingButton'))return{SaveListingButton:'Heart'};
  return sharedStub(file,key)??actual(key);
 };
 new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,m,m.exports);
 return(props:any)=>m.exports.ListingCard(props);
}
const model={id:'listing-one',title:'A real rental with a very long title that must wrap without losing its identity',thumbnailUrl:'https://example.test/authorized-cover',propertyType:'Apartment',rent:'1,234,567',location:'A long public barangay name, Imus',bedrooms:2,bathrooms:1,notes:[]};
const texts=(tree:any)=>nodes(tree).filter(n=>n.type==='Text');

test('long titles wrap in full: no line limit and no font-scale cap, so nothing is cut off at 320dp / 150%',()=>{
 const all=texts(cardHarness()({model,onPress(){}}));
 assert.ok(all.some(n=>n.props.children===model.title));assert.ok(all.every(n=>!n.props.numberOfLines&&n.props.allowFontScaling!==false&&!n.props.adjustsFontSizeToFit));
});
test('the photo and the body both open the details, and the heart is a separate press target that does not open them',()=>{
 let opened=0,removed=0;const save={saved:true,busy:false,locked:false,retry:false,onPress:()=>removed++};
 const tree=cardHarness()({model,onPress:()=>opened++,save}),all=nodes(tree),heart=all.find(n=>n.type==='Heart');
 assert.equal(heart.props.control,save);heart.props.control.onPress();assert.equal(removed,1);assert.equal(opened,0);
 const presses=all.filter(n=>n.type==='Pressable');assert.equal(presses.length,2);presses.forEach(n=>n.props.onPress());assert.equal(opened,2);
 assert.ok(!presses.some(n=>nodes(n).includes(heart)),'the heart sits outside both');
 assert.match(presses[1].props.accessibilityLabel,/^View A real rental.*PHP 1,234,567 per month/);
});
test('a failed or missing cover shows the neutral No photo block, never a sample image',()=>{
 const render=cardHarness();let tree=render({model,onPress(){}});nodes(tree).find(n=>n.type==='Image').props.onError();tree=render({model,onPress(){}});
 assert.ok(!nodes(tree).some(n=>n.type==='Image'));assert.ok(texts(tree).some(n=>n.props.children==='No photo'));
 assert.ok(texts(cardHarness()({model:{...model,thumbnailUrl:null},onPress(){}})).some(n=>n.props.children==='No photo'));
});
test('the card invents nothing: no rating, review count, match score or verification text',()=>{
 assert.doesNotMatch(JSON.stringify(cardHarness()({model:{...model,thumbnailUrl:null,bedrooms:null,bathrooms:null},onPress(){}})),/rating|reviews|matchScore|Verified|undefined/i);
});
