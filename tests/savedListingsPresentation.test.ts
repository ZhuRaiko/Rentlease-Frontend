import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
function cardHarness(width=411,fontScale=1){
 const file=resolve('src/features/search-discovery/components/SearchListingCard.tsx'),actual=createRequire(file),m={exports:{} as any};let failed=false;
 const req=(key:string):any=>{
  if(key==='react')return{useState:()=>[failed,(v:boolean)=>failed=v],useEffect:()=>{}};
  if(key==='react/jsx-runtime')return{jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};
  if(key==='react-native')return{Image:'Image',Text:'Text',View:'View',Pressable:'Pressable',useWindowDimensions:()=>({width,fontScale}),StyleSheet:{create:(v:any)=>v,absoluteFillObject:{position:'absolute',top:0,left:0,right:0,bottom:0}}};
  if(key.endsWith('/SaveListingButton'))return{SaveListingButton:'Heart'};
  return actual(key);
 };
 new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,m,m.exports);
 return(props:any)=>m.exports.SearchListingCard(props);
}
const listing={listingId:'listing-one',title:'A real rental with a very long title that must wrap without losing its identity',rent:1234567,barangay:'A long public barangay name',city:'imus',propertyType:'apartment',bedrooms:0,bathrooms:1,floorArea:null,thumbnailUrl:'https://example.test/authorized-cover'};
for(const [width,scale,horizontal] of [[411,1,true],[320,1,false],[411,1.5,false]] as const)test(`Saved card adapts at ${width}dp / ${scale} font scale`,()=>{
 const tree=cardHarness(width,scale)({listing,horizontal:true,onPress(){}}),all=nodes(tree);
 assert.equal(tree.props.style[1]?.flexDirection==='row',horizontal);
 const media=all.find(n=>Array.isArray(n.props?.style)&&n.props.style[1]?.minHeight);assert.equal(media.props.style[1].width,horizontal?'43%':'100%');
 const texts=all.filter(n=>n.type==='Text');assert.ok(texts.some(n=>n.props.children===listing.title));assert.ok(texts.some(n=>n.props.children==='0 bedrooms'));assert.ok(texts.some(n=>n.props.children==='1 bathroom'));
 assert.match(JSON.stringify(tree),/1,234,567/);assert.ok(!texts.some(n=>n.props.numberOfLines||n.props.allowFontScaling===false));
});
test('Saved photo and details navigate, while overlaid heart is a separate press target',()=>{
 let opened=0,removed=0;const save={saved:true,busy:false,locked:false,retry:false,onPress:()=>removed++};
 const tree=cardHarness()({listing,horizontal:true,onPress:()=>opened++,save}),all=nodes(tree),heart=all.find(n=>n.type==='Heart');
 assert.equal(heart.props.control,save);heart.props.control.onPress();assert.equal(removed,1);assert.equal(opened,0);
 const shell=all.find(n=>n.props?.style?.position==='absolute'&&n.props.style.top===6);assert.ok(shell);assert.equal(shell.props.children,heart);
 const presses=all.filter(n=>n.type==='Pressable');assert.equal(presses.length,2);presses.forEach(n=>n.props.onPress());assert.equal(opened,2);
 assert.ok(!presses.some(n=>nodes(n).includes(heart)));
});
test('Saved card failure and missing cover use a neutral placeholder, never sample images',()=>{
 const render=cardHarness();let tree=render({listing,horizontal:true,onPress(){}});nodes(tree).find(n=>n.type==='Image').props.onError();tree=render({listing,horizontal:true,onPress(){}});assert.ok(!nodes(tree).some(n=>n.type==='Image'));assert.match(JSON.stringify(tree),/Photo unavailable/);
 const absent=cardHarness()({listing:{...listing,thumbnailUrl:null,bedrooms:undefined,bathrooms:undefined},horizontal:true,onPress(){}});assert.match(JSON.stringify(absent),/bedroom count unavailable/);assert.doesNotMatch(JSON.stringify(absent),/undefined bedrooms|Verified Landlord|reviews|rating/);
});
test('Home and Search retain the existing nonhorizontal card presentation',()=>{
 const tree=cardHarness()({listing,onPress(){}});assert.equal(tree.props.style.borderRadius,undefined);assert.equal(tree.props.style.borderBottomWidth,1);assert.ok(!nodes(tree).some(n=>n.props?.style?.top===6));
});


test('Discovery variant uses actual price, zero counts and a separate overlaid heart',()=>{
 let opened=0,removed=0;const control={saved:true,onPress:()=>removed++},render=cardHarness(320,1.5);
 let tree=render({listing:{...listing,bathrooms:0},discovery:true,save:control,onPress:()=>opened++});const all=nodes(tree),heart=all.find(n=>n.type==='Heart');heart.props.control.onPress();assert.equal(opened,0);assert.equal(removed,1);
 assert.match(JSON.stringify(tree),/0 bathrooms/);assert.match(JSON.stringify(tree),/1,234,567/);assert.ok(all.some(n=>n.props?.style?.aspectRatio===1.65));
 const detail=all.find(n=>n.type==='Pressable'&&n.props.accessibilityRole==='button');detail.props.onPress();assert.equal(opened,1);assert.ok(!nodes(detail).includes(heart));
 const image=all.find(n=>n.type==='Image');image.props.onError();tree=render({listing,discovery:true,onPress(){}});assert.match(JSON.stringify(tree),/Photo unavailable/);assert.ok(!nodes(tree).some(n=>n.type==='Image'));
});
