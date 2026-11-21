/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {ACCURACY,SHEET_COPY,STATS_SOURCE,askingMarker,bandPosition,cityLabelFor,estimateFraction,formatExactPeso,formatPercent,formatR2,formatWholePeso,statisticsView,statsGroupFor,typeLabelFor,usableExact,type ExactEstimate} from '../src/shared/models/RentalStatistics';
import {parseExactEstimate,withExactEstimate} from '../src/shared/models/RentalExactEstimate';
import {parsePredictionReceipt} from '../src/shared/models/RentalPrediction';

const exact:ExactEstimate={estimate:35512.40,minimum:24858.68,maximum:46166.12};
const target={propertyId:'10000000-0000-4000-8000-000000000001'};
const wire=(over:Record<string,unknown>={})=>({target,estimatedMonthlyRent:35512.40,currency:'PHP',modelVersion:'v1',askingRent:32000,predictedAt:'2026-11-22T00:00:00Z',illustrativeRange:{minimum:24858.68,maximum:46166.12},...over});

// ---- which accuracy group
test('the group comes from the property type: house, or apartment / condominium; anything else has none',()=>{
  assert.equal(statsGroupFor('house'),'house');assert.equal(statsGroupFor(' House '),'house');
  for(const t of ['apartment','condominium','Condominium','apartment_condominium','apartment condominium','apartment-condominium'])assert.equal(statsGroupFor(t),'apartment_condominium',t);
  for(const t of ['studio','room','boarding_house','townhouse','',null,undefined,42,{}])assert.equal(statsGroupFor(t),null,String(t));
  assert.equal(typeLabelFor('condominium'),'Condominium');assert.equal(typeLabelFor('house'),'House');assert.equal(typeLabelFor('studio'),null);assert.equal(cityLabelFor('dasmarinas'),'Dasmariñas');assert.equal(cityLabelFor('manila'),null);
});
test('the accuracy figures are the fixed thesis values, with their source',()=>{
  assert.deepEqual(ACCURACY.apartment_condominium,{group:'apartment_condominium',label:'apartments and condominiums',n:501,within30:78.44,mae:7017.80,mape:21.12,r2:0.6253,simpleMedianWithin30:48.50});
  assert.deepEqual(ACCURACY.house,{group:'house',label:'houses',n:490,within30:76.73,mae:10382.78,mape:22.68,r2:0.3743,simpleMedianWithin30:67.14});
  assert.equal(ACCURACY.apartment_condominium.n+ACCURACY.house.n,991);assert.equal(STATS_SOURCE,'held-out test of 991 listings, RentLease thesis, Chapter 5');assert.equal(SHEET_COPY.source,'Source: held-out test of 991 listings, RentLease thesis, Chapter 5.');
});

// ---- number formatting
test('percentages show one decimal, money the whole peso, R² two decimals',()=>{
  const c=ACCURACY.apartment_condominium,h=ACCURACY.house;
  assert.deepEqual([formatPercent(c.within30),formatWholePeso(c.mae),formatPercent(c.mape),formatR2(c.r2),formatPercent(c.simpleMedianWithin30)],['78.4%','₱7,018','21.1%','0.63','48.5%']);
  assert.deepEqual([formatPercent(h.within30),formatWholePeso(h.mae),formatPercent(h.mape),formatR2(h.r2),formatPercent(h.simpleMedianWithin30)],['76.7%','₱10,383','22.7%','0.37','67.1%']);
  assert.equal(formatWholePeso(0.4),'₱0');assert.equal(formatWholePeso(999999.5),'₱1,000,000');
});
test('the exact estimate and band keep their centavos',()=>{
  assert.deepEqual([formatExactPeso(exact.estimate),formatExactPeso(exact.minimum),formatExactPeso(exact.maximum)],['₱35,512.40','₱24,858.68','₱46,166.12']);
  assert.equal(formatExactPeso(1234567.5),'₱1,234,567.50');assert.equal(formatExactPeso(5000),'₱5,000.00');
});

// ---- where the asking price sits in the exact band
test('the asking price is placed inside the exact band as a share of its width',()=>{
  const p=bandPosition(32000,exact)!;assert.equal(p.side,'inside');assert.ok(Math.abs(p.fraction-(32000-24858.68)/(46166.12-24858.68))<1e-12);assert.ok(p.fraction>0.33&&p.fraction<0.34);
  assert.equal(bandPosition(exact.minimum,exact)!.fraction,0);assert.equal(bandPosition(exact.minimum,exact)!.side,'inside','exactly at the low end is inside');
  assert.equal(bandPosition(exact.maximum,exact)!.fraction,1);assert.equal(bandPosition(exact.maximum,exact)!.side,'inside');
  assert.ok(Math.abs(estimateFraction(exact)-0.5)<1e-9,'the model\'s symmetric band puts the estimate in the middle');
});
test('an asking price outside the band is clamped to the nearer edge and labeled',()=>{
  assert.deepEqual(bandPosition(20000,exact),{fraction:0,side:'below'});assert.deepEqual(bandPosition(60000,exact),{fraction:1,side:'above'});
  assert.deepEqual(askingMarker(60000,exact),{fraction:1,label:'Asking ₱60,000 · above the band',side:'above',align:'end'});
  assert.deepEqual(askingMarker(20000,exact),{fraction:0,label:'Asking ₱20,000 · below the band',side:'below',align:'start'});
  assert.deepEqual(askingMarker(32000,exact),{fraction:bandPosition(32000,exact)!.fraction,label:'Asking ₱32,000',side:'inside',align:'center'});
  assert.equal(askingMarker(25000,exact)!.align,'start');assert.equal(askingMarker(45000,exact)!.align,'end');
});
test('no marker without a usable asking price or a usable band',()=>{
  for(const asking of [null,undefined,0,-5,Number.NaN,Infinity])assert.equal(bandPosition(asking,exact),null,String(asking));
  assert.equal(bandPosition(32000,null),null);assert.equal(bandPosition(32000,undefined),null);assert.equal(askingMarker(null,exact),null);
});

// ---- missing or unusable exact values: hidden, never invented
test('incomplete or inconsistent exact values are not usable',()=>{
  assert.deepEqual(usableExact(exact),exact);
  for(const bad of [null,undefined,{estimate:1,minimum:2,maximum:3},{estimate:5,minimum:6,maximum:4},{estimate:5,minimum:0,maximum:9},{estimate:Number.NaN,minimum:1,maximum:9},{estimate:5,minimum:1,maximum:'9'},{minimum:1,maximum:9}])assert.equal(usableExact(bad as any),null,JSON.stringify(bad));
});
test('without exact values the exact card and the band are hidden; the accuracy sections stay, and no number is made up',()=>{
  for(const missing of [undefined,null,{estimate:35512.4,minimum:1,maximum:2} as ExactEstimate]){
    const v=statisticsView({propertyType:'condominium',exact:missing,asking:32000})!;
    assert.equal(v.exact,null);assert.equal(v.band,null);assert.equal(v.accuracy.percent,'78.4%');assert.deepEqual(v.compare,{medianPercent:'48.5%',modelPercent:'78.4%',medianFraction:0.485,modelFraction:0.7844});
    assert.doesNotMatch(JSON.stringify(v),/35,512|24,858|46,166/);
  }
});
test('the Statistics tab for a condominium and for a house',()=>{
  const c=statisticsView({propertyType:'condominium',exact,asking:32000,city:'imus'})!;
  assert.deepEqual(c.exact,{intro:'Condominium in Imus. The model’s exact estimate is ',estimate:'₱35,512.40',suffix:' a month.'});
  assert.deepEqual([c.band!.low,c.band!.mid,c.band!.high],['₱24,858.68','₱35,512.40','₱46,166.12']);assert.equal(c.band!.marker!.label,'Asking ₱32,000');assert.match(c.band!.label,/₱24,858\.68 to ₱46,166\.12.*₱35,512\.40.*Asking ₱32,000/);
  assert.equal(c.accuracy.percent,'78.4%');assert.equal(c.accuracy.sentence,'of 501 test listings were within 30% of the real asking rent (apartments and condominiums)');
  assert.deepEqual(c.accuracy.tiles.map(t=>t.value),['₱7,018','21.1%','0.63']);assert.equal(c.accuracy.note,null);
  const h=statisticsView({propertyType:'house',exact,asking:60000})!;
  assert.equal(h.accuracy.percent,'76.7%');assert.equal(h.accuracy.sentence,'of 490 test listings were within 30% of the real asking rent (houses)');assert.deepEqual(h.accuracy.tiles.map(t=>t.value),['₱10,383','22.7%','0.37']);
  assert.equal(h.accuracy.note,'Estimates for houses are less accurate than for condominiums.');assert.deepEqual([h.compare.medianPercent,h.compare.modelPercent],['67.1%','76.7%']);assert.equal(h.band!.marker!.side,'above');
  assert.equal(h.exact!.intro,'House. The model’s exact estimate is ','no city line when none is given');
  assert.equal(statisticsView({propertyType:'studio',exact}),null,'no group: nothing to show');
});
test('what to keep in mind: four lines, no scatter section, a source line',()=>{
  assert.equal(SHEET_COPY.keep.length,4);assert.deepEqual(SHEET_COPY.steps.map(s=>s.title),['Reads the saved details','Compares with similar listings','Returns a typical range']);
  assert.equal(SHEET_COPY.steps[0]!.text,'The model uses the property details you saved, such as type, location and floor area.');
});

// ---- the exact values come from the service response, not from the rounded range
test('the exact estimate and band are read from the service response and are not rounded; the card range stays rounded to 500',()=>{
  assert.deepEqual(parseExactEstimate(wire()),exact);
  const receipt=withExactEstimate(parsePredictionReceipt(wire(),target),wire());
  assert.deepEqual(receipt.exact,exact);assert.deepEqual(receipt.illustrativeRange,{minimum:24500,maximum:46500},'the cards keep rounding outward to the nearest 500');
  assert.equal(JSON.stringify(parsePredictionReceipt(wire(),target)).includes('35512'),false,'the receipt parser itself still drops the point value');
});
test('a band that is not the estimate plus and minus 30%, or a missing one, gives no exact values',()=>{
  for(const bad of [wire({illustrativeRange:{minimum:1,maximum:999999}}),wire({illustrativeRange:undefined}),wire({illustrativeRange:null}),wire({estimatedMonthlyRent:10000}),wire({estimatedMonthlyRent:-1}),null,'x',{}])assert.equal(parseExactEstimate(bad),null,JSON.stringify(bad));
  assert.equal(withExactEstimate(parsePredictionReceipt(wire({illustrativeRange:undefined}),target),wire({illustrativeRange:undefined})).exact,null);
});

// ---- wiring: the entry shows only on a card with a range, in the right style
// Function components (the sheet's sections) are called, so their content is part of the tree.
const expand=(v:any):any=>v&&typeof v==='object'&&typeof v.type==='function'?expand(v.type(v.props)):v;
const nodes=(input:any):any[]=>{const v=expand(input);return v&&typeof v==='object'&&!(v.type==='Modal'&&v.props.visible===false)?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];};
function load(file:string,mocks:Record<string,any>,extra:Record<string,unknown>={}){
  const path=resolve(file),actual=createRequire(path),mod={exports:{} as any},jsx=(type:any,props:any)=>({type,props});
  const req=(key:string):any=>{
    if(key==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'};
    for(const [name,value] of Object.entries(mocks))if(key===name||key.endsWith('/'+name))return value;
    return actual(key);
  };
  new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);
  return mod.exports;
}
const rn={Modal:'Modal',ScrollView:'ScrollView',Text:'Text',View:'View',Pressable:'Pressable',StyleSheet:{create:(v:any)=>v,absoluteFill:{},flatten:(v:any)=>v},useWindowDimensions:()=>({height:640,width:320,fontScale:1.5})};
const reactMock={useState:(v:any)=>[typeof v==='function'?v():v,()=>{}],useEffect:()=>{}};
const renderCard=(props:Record<string,unknown>)=>load('src/shared/components/RangeEstimateCard.tsx',{react:reactMock,'react-native':rn,RangeSlider:{RangeSlider:'Slider'},RentalStatisticsButton:{RentalStatisticsButton:'StatsButton'}}).RangeEstimateCard({range:{minimum:24500,maximum:46500},rent:32000,...props});
test('the renter card puts a Statistics chip next to "How is this estimated?"; owner cards put the button under it',()=>{
  const stats={propertyType:'condominium',city:'imus',exact};
  const chip=nodes(renderCard({subject:'listing',showTitle:false,statistics:{variant:'chip',...stats}}));
  const chipEntry=chip.find(n=>n.type==='StatsButton');assert.equal(chipEntry.props.variant,'chip');assert.deepEqual(chipEntry.props.input,{propertyType:'condominium',exact,city:'imus',asking:32000},'the asking price comes from the card\'s rent');
  assert.ok(chip.some(n=>n.type==='View'&&[n.props.children].flat().some((c:any)=>c?.type==='StatsButton')),'the chip shares a row with the link');
  const button=nodes(renderCard({subject:'listing',statistics:{variant:'button',...stats}})).filter(n=>n.type==='StatsButton');assert.equal(button.length,1);assert.equal(button[0].props.variant,'button');
  const owner=nodes(renderCard({onUseRent(){},statistics:{variant:'button',...stats}}));assert.equal(owner.filter(n=>n.type==='StatsButton').length,1,'the owner slider card gets it too');
});
test('no Statistics entry without statistics input or for a property type the figures do not cover',()=>{
  assert.equal(nodes(renderCard({subject:'listing'})).filter(n=>n.type==='StatsButton').length,0);
  for(const propertyType of ['studio','boarding_house',undefined,null])assert.equal(nodes(renderCard({subject:'listing',statistics:{variant:'chip',propertyType,exact}})).filter(n=>n.type==='StatsButton').length,0,String(propertyType));
});
test('the entry works without exact values (an older result): the accuracy sections still open',()=>{
  const entry=nodes(renderCard({subject:'listing',statistics:{variant:'chip',propertyType:'house',exact:null}})).find(n=>n.type==='StatsButton');assert.equal(entry.props.input.exact,null);assert.ok(statisticsView(entry.props.input));
});

const range={minimum:24500,maximum:46500};
const base={target,currency:'PHP' as const,modelVersion:'t',askingRent:32000,predictedAt:'2026-11-22T00:00:00Z'};
function renderInline(vm:any,extra:Record<string,unknown>={}){
  return load('src/shared/components/InlineRentalEstimate.tsx',{react:{useEffect:()=>{},useState:()=>[false,()=>{}]},'react-native':{...rn,ActivityIndicator:'Loading'},AppButton:{AppButton:'Button'},RangeEstimateCard:{RangeEstimateCard:'RangeCard'},useInlineRentalEstimate:{useInlineRentalEstimate:()=>vm}}).InlineRentalEstimate({accountId:'A',target:{listingId:target.propertyId},...extra});
}
test('every estimate card passes what the sheet needs; renters get the chip, owners the button; no range, no entry',()=>{
  const property={property_type:'condominium',city:'imus'},result={...base,illustrativeRange:range,exact};
  const vm={busy:false,error:null,retryable:true,workflow:{predict(){}},eligibility:{eligible:true},result};
  const cardOf=(extra:Record<string,unknown>)=>nodes(renderInline(vm,{property,...extra})).find(n=>n.type==='RangeCard');
  assert.deepEqual(cardOf({variant:'spotlight',askingRent:32000}).props.statistics,{variant:'chip',propertyType:'condominium',city:'imus',exact});
  for(const variant of ['details','guidance','posting'])assert.deepEqual(cardOf({variant,onUseRent(){}}).props.statistics,{variant:'button',propertyType:'condominium',city:'imus',exact},variant);
  const old={...vm,result:{...base,illustrativeRange:range}};assert.equal(nodes(renderInline(old,{property,variant:'spotlight'})).find(n=>n.type==='RangeCard').props.statistics.exact,null,'an older result without exact values');
  const none={...vm,result:{...base}};for(const variant of ['spotlight','details','guidance'])assert.equal(nodes(renderInline(none,{property,variant})).filter(n=>n.type==='RangeCard').length,0,`${variant}: no estimate, no card, no entry`);
  const unavailable={...vm,eligibility:{eligible:false,reason:'x'},result:null};assert.equal(nodes(renderInline(unavailable,{property,variant:'spotlight'})).length,0);
});

// ---- the sheet itself
const safeArea={useSafeAreaInsets:()=>({bottom:0,top:0,left:0,right:0})};
function renderSheet(input:Record<string,unknown>,onClose=()=>{},tab:'stats'|'works'='stats'){
  return load('src/shared/components/RentalStatisticsSheet.tsx',{react:{useState:()=>[tab,()=>{}],useEffect:()=>{}},'react-native':rn,'react-native-safe-area-context':safeArea}).RentalStatisticsSheet({visible:true,input,onClose});
}
const textOf=(tree:any[])=>tree.filter(n=>n.type==='Text').map(n=>[n.props.children].flat(Infinity).filter(c=>typeof c==='string'||typeof c==='number').join('')).join(' | ');
test('the sheet closes from the Close button, the Android back gesture and a tap outside; all targets are 48dp',()=>{
  let closed=0;const tree=renderSheet({propertyType:'condominium',exact,asking:32000},()=>{closed++;});const all=nodes(tree);
  assert.equal(tree.type,'Modal');assert.equal(tree.props.transparent,true);tree.props.onRequestClose();assert.equal(closed,1,'Android back');
  const close=all.find(n=>n.props?.accessibilityLabel==='Close');close.props.onPress();assert.equal(closed,2,'the Close button');
  const outside=all.find(n=>n.props?.accessibilityLabel==='Close statistical analysis');outside.props.onPress();assert.equal(closed,3,'tapping outside');
  const style=(n:any)=>Object.assign({},...[n.props.style].flat(Infinity).filter(Boolean).map((s:any)=>typeof s==='function'?{}:s));
  assert.ok(style(close).minHeight>=48&&style(close).minWidth>=48);for(const tab of all.filter(n=>n.props?.accessibilityRole==='tab'))assert.ok(style(tab).minHeight>=48);
  assert.deepEqual(all.filter(n=>n.props?.accessibilityRole==='tab').map(n=>n.props.accessibilityState.selected),[false,true],'opens on Statistics');
});
test('Statistics tab: exact card and band when available, the accuracy sections always; no scatter placeholder',()=>{
  const full=textOf(nodes(renderSheet({propertyType:'condominium',exact,asking:32000,city:'imus'})));
  for(const s of ['This estimate, exact','The ±30% accuracy band','How accurate it has been','78.4%','Compared with a simple average','Group median','XGBoost model','48.5%','What to keep in mind','Source: held-out test of 991 listings, RentLease thesis, Chapter 5.','₱35,512.40','Asking ₱32,000'])assert.ok(full.includes(s),s);
  assert.doesNotMatch(full,/Actual versus predicted|placeholder|Figure 5\.1\.5|less accurate than for condominiums/);
  const without=textOf(nodes(renderSheet({propertyType:'condominium',exact:null,asking:32000})));
  for(const s of ['This estimate, exact','accuracy band','₱35,512.40'])assert.ok(!without.includes(s),`hidden: ${s}`);for(const s of ['How accurate it has been','78.4%','Compared with a simple average'])assert.ok(without.includes(s),`kept: ${s}`);
  const house=textOf(nodes(renderSheet({propertyType:'house',exact,asking:60000})));assert.ok(house.includes('76.7%')&&house.includes('Estimates for houses are less accurate than for condominiums.')&&house.includes('Asking ₱60,000 · above the band'));
});
test('How it works tab keeps step 1 generic and says the range is rounded to the nearest ₱500',()=>{
  const works=textOf(nodes(renderSheet({propertyType:'condominium',exact},()=>{},'works')));
  assert.ok(works.includes('The model uses the property details you saved, such as type, location and floor area.'));assert.ok(works.includes('rounded to the nearest ₱500'));assert.ok(works.includes('The Statistics tab shows how accurate it has been.'));assert.ok(!works.includes('78.4%'));
});
test('the sheet draws nothing when closed or for a type without a group (and the source keeps the scatter TODO, with no placeholder)',()=>{
  assert.equal(load('src/shared/components/RentalStatisticsSheet.tsx',{react:{useState:()=>['stats',()=>{}],useEffect:()=>{}},'react-native':rn,'react-native-safe-area-context':safeArea}).RentalStatisticsSheet({visible:false,input:{propertyType:'house'},onClose(){}}),null);
  assert.equal(renderSheet({propertyType:'studio',exact}),null);
  // Source check (there is no render to observe a comment): the omitted figure is marked for later, and nothing placeholder-like ships.
  const source=readFileSync('src/shared/components/RentalStatisticsSheet.tsx','utf8');assert.match(source,/TODO\(thesis figure\)/);assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g,''),/Actual versus predicted|Figure placeholder/);
});
test('the sheet description stays in the pinned header at normal text size and scrolls with the content at large text (title, Close and tabs stay pinned)',()=>{
  const sheetAt=(fontScale:number)=>load('src/shared/components/RentalStatisticsSheet.tsx',{react:{useState:()=>['stats',()=>{}],useEffect:()=>{}},'react-native':{...rn,useWindowDimensions:()=>({height:640,width:320,fontScale})},'react-native-safe-area-context':safeArea}).RentalStatisticsSheet({visible:true,input:{propertyType:'condominium',exact},onClose(){}});
  const subtitle=(tree:any)=>SHEET_COPY.subtitle,inScroll=(tree:any)=>textOf(nodes(nodes(tree).find(n=>n.type==='ScrollView'))).includes(subtitle(tree));
  const normal=sheetAt(1),large=sheetAt(1.5);
  assert.equal(inScroll(normal),false);assert.ok(textOf(nodes(normal)).includes(SHEET_COPY.subtitle),'pinned above the tabs');
  assert.equal(inScroll(large),true);assert.equal(textOf(nodes(large)).split(SHEET_COPY.subtitle).length-1,1,'shown exactly once');
  for(const tree of [normal,large]){const all=nodes(tree);assert.ok(all.some(n=>n.props?.accessibilityLabel==='Close'));assert.equal(all.filter(n=>n.props?.accessibilityRole==='tab').length,2);const scroll=all.find(n=>n.type==='ScrollView');assert.ok(!nodes(scroll).some(n=>n.props?.accessibilityRole==='tab'||n.props?.accessibilityLabel==='Close'),'tabs and Close are outside the scrolling part');}
});
