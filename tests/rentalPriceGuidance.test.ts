/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
function load(file:string,overrides:Record<string,unknown>){const path=resolve(file),actual=createRequire(path),mod={exports:{} as any};const jsx=(type:any,props:any)=>({type,props});const req=(key:string):any=>key==='react/jsx-runtime'?{jsx,jsxs:jsx}:key==='react-native'?{View:'View',Text:'Text',StyleSheet:{create:(s:any)=>s}}:Object.keys(overrides).find(k=>key.endsWith(k))?overrides[Object.keys(overrides).find(k=>key.endsWith(k))!]:actual(key);new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(req,mod,mod.exports);return mod.exports;}
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
test('unsaved property guidance never constructs a prediction target or creates a property',()=>{
 const render=load('src/shared/components/RentalPriceGuidance.tsx',{'/InlineRentalEstimate':{InlineRentalEstimate:'Inline'}}).RentalPriceGuidance;
 const props={accountId:'owner',target:null,property:null,onUseEstimate(){assert.fail('no adoption');}};
 const tree=nodes(render(props));assert.ok(!tree.some(n=>n.type==='Inline'));assert.match(JSON.stringify(tree),/Save this draft/);assert.ok(!JSON.stringify(tree).includes('18000'));
 const target={propertyId:'00000000-0000-4000-8000-000000000001'};const saved=render({...props,target,property:{property_type:'house'}});assert.equal(saved.type,'Inline');assert.deepEqual(saved.props.target,target);assert.equal(saved.props.variant,'guidance');
});
test('asking-rent input is immediately followed by guidance, before description and without another estimator',()=>{
 const controls:Record<string,unknown>={'/ListingControls':{ChoiceChip:'Choice',ListingField:'Field'}};
 for(const name of ['PropertyVerificationAction','PropertyProgressFooter','PropertyReadinessNotice','CompletenessHint','AvailabilityDateField','FeedbackNotice','ListingButton','ComposerRecoveryFeedback','ListingWorkspaceFeedback','ListingWizardScaffold'])controls['/'+(name==='PropertyReadinessNotice'?'PropertyProgressFooter':name)]={...(controls['/'+(name==='PropertyReadinessNotice'?'PropertyProgressFooter':name)] as any),[name]:name};
 const render=load('src/features/property-listing/views/ListingDetailsView.tsx',controls).ListingDetailsView;
 const guidance={type:'Guidance',props:{}},vm:any={draftHydration:{status:'ready'},draft:{title:'Test',askingRent:'5000',description:'Test details',rentalTerm:'monthly'},propertySummary:{type:'House',bedrooms:1,bathrooms:1},listingDraftState:{busy:false},photoState:{busy:false},propertyValidationIssues:[],mediaItems:[],workspacePropertyId:'saved',completeness:{},propertyEditAvailable:false};
 const tree=render({viewModel:vm,onClose(){},priceGuidance:guidance}),children=tree.props.children.flat(Infinity).filter(Boolean);const index=children.findIndex((n:any)=>n.type==='Field'&&n.props.label==='Monthly asking rent');assert.ok(index>=0);assert.equal(children[index+1],guidance);assert.equal(children[index+2].props.label,'Description');assert.equal(children[index].props.value,'5000');assert.equal(nodes(tree).filter(n=>n.type==='Guidance').length,1);
});
