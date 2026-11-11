import {useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {AppButton} from './AppButton';
import {colors} from '../theme/colors';
import {ui} from '../theme/ui';
import {formatMonthlyPhp,type PredictionTarget,type PredictionReceipt} from '../models/RentalPrediction';
import {useInlineRentalEstimate} from '../viewModels/useInlineRentalEstimate';
const currency=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2});
export function InlineRentalEstimate({accountId,target,property,onReview,variant='details',onUseEstimate,disabled=false}:{variant?:'details'|'guidance'|'posting';onUseEstimate?:((result:PredictionReceipt)=>void)|undefined;disabled?:boolean;accountId:string|undefined;target:PredictionTarget;property?:Record<string,unknown>|null;onReview?:(()=>void)|undefined}){
 const {height:screenHeight}=useWindowDimensions();
 const [infoOpen,setInfoOpen]=useState(false);
 const [copyHeight,setCopyHeight]=useState(0),[viewportHeight,setViewportHeight]=useState(0);
 const vm=useInlineRentalEstimate(accountId,target,property),result=vm.eligibility?.eligible===false?null:vm.result;
 if(variant==='guidance'||variant==='posting')return <View style={styles.guidance}>
 <Text accessibilityRole="header" style={styles.guidanceHeading}>{variant==='posting'?'XGBoost rental estimate':'Rental price guidance'}</Text>
 {vm.eligibility?.eligible===false?<Text style={ui.supporting}>{vm.eligibility.reason}</Text>:<>
 {(!result||vm.busy)&&(!vm.error||vm.retryable!==false)?<View style={styles.guidanceActions}><Pressable accessibilityRole="button" accessibilityLabel={vm.error?'Retry estimate':variant==='posting'?'Estimate Rental Price':'Get estimated rent'} accessibilityState={{disabled:disabled||vm.busy,busy:vm.busy}} disabled={disabled||vm.busy} onPress={()=>void vm.workflow.predict()} style={styles.smallAction}><Text style={styles.actionText}>{vm.busy?'Estimating\u2026':vm.error?'Retry estimate':result?'Estimate again':variant==='posting'?'Estimate Rental Price':'Get estimated rent'}</Text></Pressable>{vm.busy?<ActivityIndicator accessibilityLabel="Estimating rental price"/>:null}</View>:null}
 {result?<><Text style={ui.supporting}>XGBoost estimated rent</Text><Text style={variant==='posting'?styles.postingAmount:styles.guidanceAmount}>{formatMonthlyPhp(result.estimatedMonthlyRent)}</Text>
 {result.illustrativeRange?<Text style={ui.supporting}>Illustrative range: {currency.format(result.illustrativeRange.minimum)}{'\u2013'}{currency.format(result.illustrativeRange.maximum)}</Text>:null}
 <Text style={ui.supporting}>{'Your asking rent stays your choice. The \u00b130% range is illustrative, not a statistical confidence interval.'}</Text>
 {onUseEstimate?<View style={styles.useRow}><Pressable accessibilityRole="button" accessibilityLabel={variant==='posting'?'Use Estimated Price':'Use estimate'} accessibilityHint="Fills the asking rent field without saving" accessibilityState={{disabled:disabled||vm.busy}} disabled={disabled||vm.busy} onPress={()=>{if(!disabled&&!vm.busy)onUseEstimate(result);}} style={[styles.smallAction,{alignSelf:'flex-end'}]}><Text style={styles.actionText}>{variant==='posting'?'Use Estimated Price':'Use estimate'}</Text></Pressable></View>:null}</>:null}
 </>}
 {vm.error?<Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text>:null}
 </View>;
 return <View style={{gap:10}}>
 <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text accessibilityRole="header" style={[ui.sectionTitle,{flex:1}]}>Rental Price Estimation</Text><Pressable accessibilityRole="button" accessibilityLabel="About rental price estimation" accessibilityHint="Opens estimation information" onPress={()=>setInfoOpen(true)} style={{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'}}><Text style={ui.body}>ⓘ</Text></Pressable></View>
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
 postingAmount:{...ui.pageTitle,fontSize:28,lineHeight:36,color:colors.primaryAction},
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
