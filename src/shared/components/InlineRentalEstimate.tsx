import {useEffect} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {AppButton} from './AppButton';
import {colors} from '../theme/colors';
import {ui} from '../theme/ui';
import {type PredictionTarget,type PredictionReceipt} from '../models/RentalPrediction';
import {RangeEstimateCard} from './RangeEstimateCard';
import {useInlineRentalEstimate} from '../viewModels/useInlineRentalEstimate';
/** Posting wizard only (rendered just when a caller passes onResult or autoPredict): reports the result upward and requests once for a freshly saved property. */
function EstimateBridge({result,onResult,autoPredict,ready,workflow}:{result:PredictionReceipt|null;onResult?:((result:PredictionReceipt|null)=>void)|undefined;autoPredict:boolean;ready:boolean;workflow:{predict:()=>Promise<unknown>}}){
 useEffect(()=>{onResult?.(result);},[result]);
 useEffect(()=>{if(autoPredict&&ready)void workflow.predict();},[workflow,autoPredict]);
 return null;
}
export function InlineRentalEstimate({accountId,target,property,onReview,variant='details',onUseRent,disabled=false,askingRent,onResult,autoPredict=false}:{onResult?:((result:PredictionReceipt|null)=>void)|undefined;autoPredict?:boolean;askingRent?:number|undefined;variant?:'details'|'guidance'|'posting'|'spotlight';onUseRent?:((rent:number)=>void)|undefined;disabled?:boolean;accountId:string|undefined;target:PredictionTarget;property?:Record<string,unknown>|null;onReview?:(()=>void)|undefined}){
 const vm=useInlineRentalEstimate(accountId,target,property),result=vm.eligibility?.eligible===false?null:vm.result;
 const range=result?.illustrativeRange??null;
 // The rent shown against the range: the one the caller passes (the owner's field), else the listing's own.
 const rent=Number.isFinite(askingRent)&&askingRent!>0?askingRent!:result?.askingRent??null;
 const bridge=onResult||autoPredict?<EstimateBridge result={result??null} onResult={onResult} autoPredict={autoPredict} ready={vm.eligibility?.eligible===true&&!vm.busy} workflow={vm.workflow}/>:null;
 const noRange=result&&!range?<Text style={ui.supporting}>No typical range is available for this property. Your asking rent stays your choice.</Text>:null;
 if(variant==='spotlight')return <View style={styles.featureArea}>
 <View style={styles.featureHead}><View style={{flex:1,gap:4}}><Text style={styles.kicker}>Rental intelligence</Text><Text accessibilityRole="header" style={styles.featureTitle}>Is this rent fairly priced?</Text><Text style={styles.featureSubtitle}>See the typical rent range for similar places</Text></View><View accessible={false} style={styles.featureSymbol}><Text style={styles.symbolText}>{'₱'}</Text></View></View>
 <View style={styles.priceSpotlight}>
 {range?<RangeEstimateCard range={range} rent={rent} subject="listing"/>:null}
 {noRange}
 {vm.eligibility?.eligible===false?<Text style={styles.featureDescription}>{vm.eligibility.reason}</Text>:!(vm.error&&vm.retryable===false)?<Pressable accessibilityRole="button" accessibilityState={{busy:vm.busy,disabled:vm.busy}} disabled={vm.busy} onPress={()=>void vm.workflow.predict()} style={({pressed})=>[styles.featurePrimary,pressed?{opacity:.8}:null]}><Text style={styles.featurePrimaryText}>{vm.busy?'Estimating...':vm.error?'Retry estimate':result?'Estimate again':'Get Rental Price Estimate'}</Text></Pressable>:null}
 {vm.busy?<ActivityIndicator accessibilityLabel="Estimating rental price"/>:null}
 {vm.error?<Text accessibilityRole="alert" style={styles.featureDescription}>{vm.error}{result?' The previous range is shown; the latest request did not succeed.':''}</Text>:null}
 <Text style={styles.featureDescription}>Optional guidance based on saved property details. Eligibility and model availability apply. The landlord's price stays unchanged.</Text>
 </View></View>;
 if(variant==='posting'||variant==='guidance')return <View style={variant==='posting'?styles.postingBody:styles.guidance}>
 {bridge}
 {variant==='guidance'?<Text accessibilityRole="header" style={styles.guidanceHeading}>Rental price guidance</Text>:null}
 {vm.eligibility?.eligible===false?<Text style={ui.supporting}>{vm.eligibility.reason}</Text>:<>
 {(!result||vm.busy)&&(!vm.error||vm.retryable!==false)?<View style={styles.guidanceActions}><Pressable accessibilityRole="button" accessibilityLabel={vm.error?'Retry estimate':variant==='posting'?'Estimate Rental Price':'Get typical rent range'} accessibilityState={{disabled:disabled||vm.busy,busy:vm.busy}} disabled={disabled||vm.busy} onPress={()=>void vm.workflow.predict()} style={styles.smallAction}><Text style={styles.actionText}>{vm.busy?'Estimating…':vm.error?'Retry estimate':variant==='posting'?'Estimate Rental Price':'Get typical rent range'}</Text></Pressable>{vm.busy?<ActivityIndicator accessibilityLabel="Estimating rental price"/>:null}</View>:null}
 {range&&!vm.busy?<RangeEstimateCard range={range} rent={rent} onUseRent={onUseRent} disabled={disabled||vm.busy}/>:null}
 {!vm.busy?noRange:null}
 </>}
 {vm.error?<Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text>:null}
 </View>;
 return <View style={{gap:10}}>
 <Text accessibilityRole="header" style={ui.sectionTitle}>Typical rent range</Text>
 {vm.eligibility?.eligible===false?<View style={{gap:6}}><Text style={ui.supporting}>{vm.eligibility.reason}</Text>{onReview?<AppButton variant="secondary" label="Review property details" onPress={onReview}/>:null}</View>:null}
 {vm.eligibility?.eligible!==false&&!(vm.error&&vm.retryable===false)?<AppButton label={vm.busy?'Estimating…':vm.error?'Retry estimate':result?'Estimate again':'Estimate rental price'} disabled={vm.busy} onPress={()=>void vm.workflow.predict()}/>:null}
 {vm.busy?<View accessibilityLiveRegion="polite" style={{gap:6}}><ActivityIndicator accessibilityLabel="Estimating rental price"/><Text style={ui.supporting}>Render may take up to a minute to start.</Text></View>:null}
 {range?<RangeEstimateCard range={range} rent={rent}/>:null}
 {noRange}
 {vm.error?<View style={{gap:4}}><Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text>{vm.retryable===false?<Text style={ui.supporting}>Review saved details or account eligibility before estimating again.</Text>:null}</View>:null}
 </View>;
}

const styles=StyleSheet.create({
 rangePanel:{backgroundColor:colors.background,borderWidth:1,borderColor:colors.outline,borderRadius:14,paddingVertical:15,paddingHorizontal:13,gap:12},rangeHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:5},rangeTitle:{...ui.body,fontSize:13,lineHeight:20,fontWeight:'700'},rangeChip:{...ui.supporting,fontSize:10,lineHeight:16,fontWeight:'800',color:colors.primaryAction,backgroundColor:colors.primaryPale,paddingVertical:4,paddingHorizontal:8,borderRadius:20},rangeBound:{flex:1,minWidth:0,gap:4},rangeAmount:{...ui.body,fontSize:21,lineHeight:29,fontWeight:'700',letterSpacing:-.7,color:colors.primaryAction},interval:{height:24,marginHorizontal:4,justifyContent:'center'},intervalRail:{height:14,borderRadius:99,backgroundColor:colors.accountCredentialSurface,borderWidth:1,borderColor:colors.controlBorder},intervalEnd:{position:'absolute',height:22,width:2,backgroundColor:colors.primaryAction},intervalMarker:{position:'absolute',height:16,width:16,marginLeft:-8,borderRadius:8,borderWidth:3,borderColor:colors.background,backgroundColor:colors.primaryAction},intervalCaption:{...ui.supporting,fontSize:10,lineHeight:16,textAlign:'center'},
 featureArea:{gap:11},featureHead:{flexDirection:'row',alignItems:'flex-start',gap:10},kicker:{...ui.supporting,color:colors.primaryAction,fontSize:10,lineHeight:16,fontWeight:'800',letterSpacing:.95,textTransform:'uppercase'},featureTitle:{...ui.sectionTitle,fontSize:18,lineHeight:24,color:colors.ink},featureSubtitle:{...ui.supporting,fontSize:12,lineHeight:18},featureSymbol:{width:35,height:35,borderRadius:10,backgroundColor:colors.primaryPale,alignItems:'center',justifyContent:'center'},symbolText:{...ui.body,color:colors.primaryAction,fontSize:19,fontWeight:'600'},priceSpotlight:{padding:15,gap:10,borderRadius:16,borderWidth:1,borderColor:colors.outline,backgroundColor:colors.primaryPale},metrics:{flexDirection:'row',gap:9},metric:{flex:1,minWidth:0,paddingVertical:11,paddingHorizontal:10,gap:4,borderWidth:1,borderColor:colors.outline,borderRadius:11,backgroundColor:colors.background},metricLabel:{...ui.supporting,fontSize:11,lineHeight:16},metricAmount:{...ui.body,color:colors.ink,fontSize:15,lineHeight:22,fontWeight:'600',letterSpacing:-.3},metricPending:{...ui.supporting,fontSize:12,lineHeight:18,fontWeight:'600'},featurePrimary:{minHeight:48,padding:12,borderRadius:11,backgroundColor:colors.primaryAction,alignItems:'center',justifyContent:'center'},featurePrimaryText:{...ui.body,color:colors.white,fontSize:13,fontWeight:'700',textAlign:'center'},featureDescription:{...ui.supporting,fontSize:11,lineHeight:17},
 postingBody:{gap:12},postingAmount:{...ui.pageTitle,fontSize:30,lineHeight:36,color:colors.primaryAction,fontWeight:'700'},
 postingBar:{height:28,marginHorizontal:6,justifyContent:'center'},postingRail:{height:8,borderRadius:5,backgroundColor:colors.border},postingTick:{position:'absolute',width:2,height:20,top:4,backgroundColor:colors.primaryAction},
 postingDot:{position:'absolute',top:6,width:16,height:16,marginLeft:-8,borderRadius:8,borderWidth:3,borderColor:colors.primaryPale,backgroundColor:colors.primaryAction},
 askingMarker:{position:'absolute',top:0,width:0,height:0,marginLeft:-6,borderLeftWidth:6,borderRightWidth:6,borderTopWidth:9,borderLeftColor:'transparent',borderRightColor:'transparent',borderTopColor:colors.reviewOrange},
 postingBounds:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:8},boundsMid:{flexShrink:1,textAlign:'center'},
 guidance:{borderTopWidth:1,borderTopColor:colors.outline,paddingTop:12,gap:4},
 guidanceHeading:{...ui.supporting,color:colors.ink,fontWeight:'600'},guidanceAmount:{...ui.body,fontSize:16,fontWeight:'700'},
 guidanceActions:{flexDirection:'row',alignItems:'center',gap:8},useRow:{alignItems:'flex-end'},
 smallAction:{minHeight:48,paddingHorizontal:12,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:colors.controlBorder,borderRadius:12,alignSelf:'flex-start'},actionText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
 dismissBackdrop:{position:'absolute',top:0,bottom:0,left:0,right:0},
 backdrop:{flex:1,justifyContent:'center',alignItems:'center',padding:20,backgroundColor:'rgba(0,0,0,0.35)'},
 dialog:{width:'100%',maxWidth:340,backgroundColor:colors.background,borderRadius:12,padding:18,flexShrink:1},
 dialogHeader:{flexDirection:'row',alignItems:'center',gap:8},
 close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 copyScroll:{flexGrow:0,flexShrink:1},copy:{gap:12,paddingTop:6},
});
