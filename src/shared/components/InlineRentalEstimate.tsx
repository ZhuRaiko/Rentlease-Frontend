import {useEffect,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {AppButton} from './AppButton';
import {colors} from '../theme/colors';
import {ui} from '../theme/ui';
import {formatMonthlyPhp,type PredictionTarget,type PredictionReceipt} from '../models/RentalPrediction';
import {useInlineRentalEstimate} from '../viewModels/useInlineRentalEstimate';
import {formatEstimatePeso,formatPeso} from '../models/Currency';
/** Posting wizard only (rendered just when a caller passes onResult or autoPredict): reports the result upward and requests once for a freshly saved property. */
function EstimateBridge({result,onResult,autoPredict,ready,workflow}:{result:PredictionReceipt|null;onResult?:((result:PredictionReceipt|null)=>void)|undefined;autoPredict:boolean;ready:boolean;workflow:{predict:()=>Promise<unknown>}}){
 useEffect(()=>{onResult?.(result);},[result]);
 useEffect(()=>{if(autoPredict&&ready)void workflow.predict();},[workflow,autoPredict]);
 return null;
}
const currency=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2});
const peso0={format:formatEstimatePeso};
export function InlineRentalEstimate({accountId,target,property,onReview,variant='details',onUseEstimate,disabled=false,askingRent,onResult,autoPredict=false}:{onResult?:((result:PredictionReceipt|null)=>void)|undefined;autoPredict?:boolean;askingRent?:number|undefined;variant?:'details'|'guidance'|'posting'|'spotlight';onUseEstimate?:((result:PredictionReceipt)=>void)|undefined;disabled?:boolean;accountId:string|undefined;target:PredictionTarget;property?:Record<string,unknown>|null;onReview?:(()=>void)|undefined}){
 const {height:screenHeight,width,fontScale}=useWindowDimensions();
 const [infoOpen,setInfoOpen]=useState(false);
 const [copyHeight,setCopyHeight]=useState(0),[viewportHeight,setViewportHeight]=useState(0);
 const vm=useInlineRentalEstimate(accountId,target,property),result=vm.eligibility?.eligible===false?null:vm.result;
 const range=result?.illustrativeRange;
 const narrow=width/Math.max(1,fontScale??1)<340||currency.format(range?.maximum??0).length>15;
 const marker=range&&result?(result.estimatedMonthlyRent-range.minimum)/(range.maximum-range.minimum)*100:null;
 if(variant==='spotlight')return <View style={styles.featureArea}>
 <View style={styles.featureHead}><View style={{flex:1,gap:4}}><Text style={styles.kicker}>Rental intelligence</Text><Text accessibilityRole="header" style={styles.featureTitle}>Is this rent fairly priced?</Text><Text style={styles.featureSubtitle}>Get an XGBoost-powered rental price estimate</Text></View><View accessible={false} style={styles.featureSymbol}><Text style={styles.symbolText}>{'\u20b1'}</Text></View></View>
 <View style={styles.priceSpotlight}>
 {range?<View style={styles.rangePanel}>
 <View style={styles.rangeHeader}><Text accessibilityRole="header" style={styles.rangeTitle}>Illustrative rental range</Text><Text style={styles.rangeChip}>{'\u00b1'}30%</Text></View>
 <View testID="rental-range-bounds" style={[styles.metrics,narrow?{flexDirection:'column'}:null]}>
 <View style={styles.rangeBound}><Text style={styles.metricLabel}>Lower bound</Text><Text style={styles.rangeAmount}>{currency.format(range.minimum)}</Text></View>
 <View style={styles.rangeBound}><Text style={styles.metricLabel}>Upper bound</Text><Text style={styles.rangeAmount}>{currency.format(range.maximum)}</Text></View>
 </View>
 <Text style={styles.metricLabel}>per month</Text>
 <View accessible accessibilityRole="image" accessibilityLabel={`Illustrative rental range from ${currency.format(range.minimum)} to ${currency.format(range.maximum)} per month. Model point estimate ${currency.format(result!.estimatedMonthlyRent)}. This is not a confidence interval.`} style={styles.interval}>
 <View style={styles.intervalRail}/><View style={[styles.intervalEnd,{left:0}]}/><View style={[styles.intervalEnd,{right:0}]}/>
 {marker!==null&&Number.isFinite(marker)&&marker>=0&&marker<=100?<View testID="rental-range-marker" style={[styles.intervalMarker,{left:`${marker}%`}]}/>:null}
 </View><Text style={styles.intervalCaption}>Model point estimate within the illustrative range</Text>
 </View>:null}

 <View style={[styles.metrics,narrow?{flexDirection:'column'}:null]}>
  <View style={styles.metric}><Text style={styles.metricLabel}>Landlord's asking rent</Text><Text style={styles.metricAmount}>{Number.isFinite(askingRent)?currency.format(askingRent!):result?.askingRent!=null?currency.format(result.askingRent):'Not available'}</Text><Text style={styles.metricLabel}>per month</Text></View>
  <View style={styles.metric}><Text style={styles.metricLabel}>Model's point estimate</Text>{result?<><Text style={styles.metricAmount}>{currency.format(result.estimatedMonthlyRent)}</Text><Text style={styles.metricLabel}>per month</Text></>:<Text style={styles.metricPending}>{vm.busy?'Estimating...':vm.eligibility?.eligible===false?'Not supported':vm.error?'Unavailable':'Not requested'}</Text>}</View>
 </View>
 {vm.eligibility?.eligible===false?<Text style={styles.featureDescription}>{vm.eligibility.reason}</Text>:!(vm.error&&vm.retryable===false)?<Pressable accessibilityRole="button" accessibilityState={{busy:vm.busy,disabled:vm.busy}} disabled={vm.busy} onPress={()=>void vm.workflow.predict()} style={({pressed})=>[styles.featurePrimary,pressed?{opacity:.8}:null]}><Text style={styles.featurePrimaryText}>{vm.busy?'Estimating...':vm.error?'Retry estimate':result?'Estimate again':'Get Rental Price Estimate'}</Text></Pressable>:null}
 {vm.busy?<ActivityIndicator accessibilityLabel="Estimating rental price"/>:null}
 {range?<Text style={styles.featureDescription}>The {'\u00b1'}30% range is illustrative, not a guaranteed rental price or calibrated confidence interval.</Text>:null}
 {vm.error?<Text accessibilityRole="alert" style={styles.featureDescription}>{vm.error}{result?' The previous estimate is shown; the latest request did not succeed.':''}</Text>:null}
 <Text style={styles.featureDescription}>Optional guidance based on saved property details. Eligibility and model availability apply. The landlord's price stays unchanged.</Text>
 </View></View>;
 if(variant==='posting')return <View style={styles.postingBody}>
 {onResult||autoPredict?<EstimateBridge result={result??null} onResult={onResult} autoPredict={autoPredict} ready={vm.eligibility?.eligible===true&&!vm.busy} workflow={vm.workflow}/>:null}
 {vm.eligibility?.eligible===false?<Text style={ui.supporting}>{vm.eligibility.reason}</Text>:<>
 {(!result||vm.busy)&&(!vm.error||vm.retryable!==false)?<View style={styles.guidanceActions}><Pressable accessibilityRole="button" accessibilityLabel={vm.error?'Retry estimate':'Estimate Rental Price'} accessibilityState={{disabled:disabled||vm.busy,busy:vm.busy}} disabled={disabled||vm.busy} onPress={()=>void vm.workflow.predict()} style={styles.smallAction}><Text style={styles.actionText}>{vm.busy?'Estimating\u2026':vm.error?'Retry estimate':result?'Estimate again':'Estimate Rental Price'}</Text></Pressable>{vm.busy?<ActivityIndicator accessibilityLabel="Estimating rental price"/>:null}</View>:null}
 {result?<>
 <View><Text style={styles.postingAmount}>{peso0.format(result.estimatedMonthlyRent)}</Text><Text style={ui.supporting}>per month · model estimate</Text></View>
 {range&&marker!==null&&Number.isFinite(marker)?<View style={{gap:4}}>
 <View accessible accessibilityRole="image" accessibilityLabel={`Illustrative rental range from ${peso0.format(range.minimum)} to ${peso0.format(range.maximum)} per month. Model estimate ${peso0.format(result.estimatedMonthlyRent)}.${Number.isFinite(askingRent)?` Your asking rent ${formatPeso(askingRent!)}.`:''} This is not a confidence interval.`} style={styles.postingBar}>
 <View style={styles.postingRail}/><View style={[styles.postingTick,{left:0}]}/><View style={[styles.postingTick,{right:0}]}/>
 {Number.isFinite(askingRent)&&askingRent!>0?<View testID="asking-rent-marker" style={[styles.askingMarker,{left:`${Math.min(100,Math.max(0,(askingRent!-range.minimum)/(range.maximum-range.minimum)*100))}%`}]}/>:null}
 <View testID="rental-range-marker" style={[styles.postingDot,{left:`${Math.min(100,Math.max(0,marker))}%`}]}/>
 </View>
 <View style={styles.postingBounds}><Text style={ui.supporting}>{peso0.format(range.minimum)}</Text><Text style={[ui.supporting,styles.boundsMid]}>illustrative range (±30%)</Text><Text style={ui.supporting}>{peso0.format(range.maximum)}</Text></View>
 {Number.isFinite(askingRent)&&askingRent!>0?<Text style={ui.supporting}>Orange marker: your asking rent. Not a confidence interval.</Text>:<Text style={ui.supporting}>The ±30% range is illustrative, not a statistical confidence interval.</Text>}
 </View>:<Text style={ui.supporting}>{'Your asking rent stays your choice. The \u00b130% range is illustrative, not a statistical confidence interval.'}</Text>}
 {onUseEstimate?<View style={styles.useRow}><Pressable accessibilityRole="button" accessibilityLabel="Use Estimated Price" accessibilityHint="Fills the asking rent field without saving" accessibilityState={{disabled:disabled||vm.busy}} disabled={disabled||vm.busy} onPress={()=>{if(!disabled&&!vm.busy)onUseEstimate(result);}} style={[styles.smallAction,{alignSelf:'flex-end'}]}><Text style={styles.actionText}>Use Estimated Price</Text></Pressable></View>:null}
 </>:null}
 </>}
 {vm.error?<Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text>:null}
 </View>;
 if(variant==='guidance')return <View style={styles.guidance}>
 {onResult||autoPredict?<EstimateBridge result={result??null} onResult={onResult} autoPredict={autoPredict} ready={vm.eligibility?.eligible===true&&!vm.busy} workflow={vm.workflow}/>:null}
 <Text accessibilityRole="header" style={styles.guidanceHeading}>Rental price guidance</Text>
 {vm.eligibility?.eligible===false?<Text style={ui.supporting}>{vm.eligibility.reason}</Text>:<>
 {(!result||vm.busy)&&(!vm.error||vm.retryable!==false)?<View style={styles.guidanceActions}><Pressable accessibilityRole="button" accessibilityLabel={vm.error?'Retry estimate':'Get estimated rent'} accessibilityState={{disabled:disabled||vm.busy,busy:vm.busy}} disabled={disabled||vm.busy} onPress={()=>void vm.workflow.predict()} style={styles.smallAction}><Text style={styles.actionText}>{vm.busy?'Estimating\u2026':vm.error?'Retry estimate':result?'Estimate again':'Get estimated rent'}</Text></Pressable>{vm.busy?<ActivityIndicator accessibilityLabel="Estimating rental price"/>:null}</View>:null}
 {result?<><Text style={ui.supporting}>XGBoost estimated rent</Text><Text style={styles.guidanceAmount}>{formatMonthlyPhp(result.estimatedMonthlyRent)}</Text>
 {result.illustrativeRange?<Text style={ui.supporting}>Illustrative range: {currency.format(result.illustrativeRange.minimum)}{'\u2013'}{currency.format(result.illustrativeRange.maximum)}</Text>:null}
 <Text style={ui.supporting}>{'Your asking rent stays your choice. The \u00b130% range is illustrative, not a statistical confidence interval.'}</Text>
 {onUseEstimate?<View style={styles.useRow}><Pressable accessibilityRole="button" accessibilityLabel={'Use estimate'} accessibilityHint="Fills the asking rent field without saving" accessibilityState={{disabled:disabled||vm.busy}} disabled={disabled||vm.busy} onPress={()=>{if(!disabled&&!vm.busy)onUseEstimate(result);}} style={[styles.smallAction,{alignSelf:'flex-end'}]}><Text style={styles.actionText}>{'Use estimate'}</Text></Pressable></View>:null}</>:null}
 </>}
 {vm.error?<Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text>:null}
 </View>;
 return <View style={{gap:10}}>
 <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text accessibilityRole="header" style={[ui.sectionTitle,{flex:1}]}>Rental Price Estimation</Text><Pressable accessibilityRole="button" accessibilityLabel="About rental price estimation" accessibilityHint="Opens estimation information" onPress={()=>setInfoOpen(true)} style={{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'}}><Text style={ui.body}>ⓘ</Text></Pressable></View>
 <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={()=>setInfoOpen(false)}>
 <View style={styles.backdrop}>
 <Pressable accessibilityRole="button" accessibilityLabel="Dismiss estimate information" onPress={()=>setInfoOpen(false)} style={styles.dismissBackdrop}/>
 <View accessibilityViewIsModal style={[styles.dialog,{maxHeight:screenHeight*.85}]}>
 <View style={styles.dialogHeader}><Text accessibilityRole="header" style={[ui.sectionTitle,{flex:1}]}>About rent estimates</Text><Pressable accessibilityRole="button" accessibilityLabel="Close estimate information" onPress={()=>setInfoOpen(false)} style={styles.close}><Text style={ui.sectionTitle}>×</Text></Pressable></View>
 <ScrollView style={styles.copyScroll} contentContainerStyle={styles.copy} bounces={false} scrollEnabled={copyHeight>viewportHeight+1} onContentSizeChange={(_,height)=>setCopyHeight(height)} onLayout={event=>setViewportHeight(event.nativeEvent.layout.height)}>
 <Text style={ui.body}>RentLease uses saved property details to estimate monthly rent. Results are advisory and may differ from actual rental prices.</Text>
 <Text style={ui.body}>The ±30% range is illustrative, not a confidence interval. Your listing price stays unchanged.</Text>
 <Text style={ui.supporting}>Precise coordinates and private identity details aren't sent to the model.</Text>
 </ScrollView>
 </View></View></Modal>
 {vm.eligibility?.eligible===false?<View style={{gap:6}}><Text style={ui.supporting}>{vm.eligibility.reason}</Text>{onReview?<AppButton variant="secondary" label="Review property details" onPress={onReview}/>:null}</View>:null}
 {vm.eligibility?.eligible!==false&&!(vm.error&&vm.retryable===false)?<AppButton label={vm.busy?'Estimating…':vm.error?'Retry estimate':result?'Estimate again':'Estimate rental price'} disabled={vm.busy} onPress={()=>void vm.workflow.predict()}/>:null}
 {vm.busy?<View accessibilityLiveRegion="polite" style={{gap:6}}><ActivityIndicator accessibilityLabel="Estimating rental price"/><Text style={ui.supporting}>Render may take up to a minute to start.</Text></View>:null}
 {result?<>
 <Text style={ui.supporting}>Estimated monthly rent</Text><Text style={ui.pageTitle}>{formatMonthlyPhp(result.estimatedMonthlyRent)}</Text>
 {result.illustrativeRange?<><Text style={ui.body}>Illustrative rental range (±30%)</Text><Text style={ui.body}>{currency.format(result.illustrativeRange.minimum)}–{currency.format(result.illustrativeRange.maximum)}</Text><Text style={ui.supporting}>per month</Text></>:null}
 {result.askingRent!==null?<Text style={ui.body}>Landlord asking rent: {formatMonthlyPhp(result.askingRent)}</Text>:<Text style={ui.supporting}>No asking rent is available for this property.</Text>}
 <Text style={ui.supporting}>Model: {result.modelVersion}</Text>
 </>:null}
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
