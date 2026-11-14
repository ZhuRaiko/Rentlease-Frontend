import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {AppButton} from '../../../shared/components/AppButton';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {RangeEstimateCard} from '../../../shared/components/RangeEstimateCard';
import {EstimatePropertyCard} from '../components/PriceEstimationCards';
import {PriceEstimationScaffold} from '../components/PriceEstimationScaffold';
import type {RentalPriceEstimationViewModel} from '../viewModels/useRentalPriceEstimationViewModel';
export function RentalPriceEstimationView({onClose,viewModel:vm}:{onClose:()=>void;viewModel:RentalPriceEstimationViewModel}){
 const property=vm.selected,result=vm.result;
 return <PriceEstimationScaffold title="Rental Price Estimate" description="The typical monthly rent range for similar places." onClose={onClose} onBack={()=>vm.backFromWorkspace(onClose)}>
 {!property?<><View accessibilityRole="tablist" style={styles.tabs}>{(['owned','published'] as const).map(source=><Pressable key={source} accessibilityRole="tab" accessibilityState={{selected:vm.source===source}} onPress={()=>vm.workflow.setSource(source)} style={[styles.tab,vm.source===source&&styles.active]}><Text style={ui.body}>{source==='owned'?'My properties':'Published rentals'}</Text></Pressable>)}</View>
 {vm.loading?<ActivityIndicator accessibilityLabel="Loading real properties" color={colors.primaryAction}/>:null}{!vm.loading&&!vm.error&&!vm.properties.length?<Text style={ui.supporting}>{vm.source==='owned'?'No owned properties found. You can also estimate accessible published rentals.':'No eligible published rentals found.'}</Text>:null}
 {vm.properties.map(p=><EstimatePropertyCard key={p.key} property={p} onPress={()=>vm.workflow.select(p)}/>)}{vm.more?<AppButton variant="secondary" label="Load more properties" disabled={vm.loading} onPress={()=>void vm.workflow.load(true)}/>:null}</>:<><Text style={ui.sectionTitle}>{property.title}</Text><Text style={ui.supporting}>{property.location}</Text><Text style={ui.body}>{property.propertyType} | {property.floorArea??'Unknown'} sq m floor area</Text>
 {property.warnings?.length?<View style={styles.group}><Text style={ui.supporting}>Review property data</Text>{property.warnings.map(w=><Text key={w} style={ui.supporting}>{w}</Text>)}</View>:null}
 {property.unavailable?<Text accessibilityRole="alert" style={ui.supporting}>{property.unavailable}</Text>:null}
 {vm.predicting?<View style={styles.group}><ActivityIndicator accessibilityLabel="Requesting the typical rent range" color={colors.primaryAction}/><Text style={ui.supporting}>Requesting the typical rent range. The service may take up to a minute to wake up on Render.</Text></View>:null}
 {result?<View style={[ui.panel,styles.result]}>{result.illustrativeRange?<RangeEstimateCard range={result.illustrativeRange} rent={result.askingRent} subject="listing"/>:<Text style={ui.supporting}>No typical range is available for this property.</Text>}{result.askingRent===null?<Text style={ui.supporting}>No asking rent is set for this selection.</Text>:null}<Text style={ui.supporting}>Received {new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}).format(new Date(result.predictedAt))} (Philippine time)</Text></View>:null}
 {!result&&!property.unavailable?<AppButton label={vm.predicting?'Estimating...':vm.error?'Retry estimate':'Show typical rent range'} disabled={vm.predicting||vm.loading} onPress={()=>void vm.workflow.predict()}/>:null}
 <Text style={ui.supporting}>The range is advisory, not a guaranteed market price. Missing lot area, parking count and location are imputed by the model. Cities or furnishing categories not represented in training may have a less useful range. No statistical confidence interval is supplied.</Text>
 <Text style={ui.supporting}>Only stored property features are sent through the secure estimator. Legal names, contact details, documents, and precise coordinates are not sent. This does not change the listing price.</Text></>}
 {vm.error?<View style={styles.group}><Text accessibilityRole="alert" style={[ui.supporting,{color:colors.restricted}]}>{vm.error}</Text>{!property?<AppButton label="Retry loading properties" variant="secondary" onPress={()=>void vm.workflow.load()} disabled={vm.loading}/>:null}</View>:null}
 </PriceEstimationScaffold>;
}
const styles=StyleSheet.create({tabs:{flexDirection:'row',gap:8,flexWrap:'wrap'},tab:{minHeight:48,padding:10,justifyContent:'center',borderRadius:10},active:{backgroundColor:colors.primaryPale},group:{gap:12},result:{padding:16,gap:10},price:{...ui.pageTitle,color:colors.primaryAction}});
