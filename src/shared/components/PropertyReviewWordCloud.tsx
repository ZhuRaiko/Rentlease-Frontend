import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {AppButton} from './AppButton';
import {useReviewWordCloud} from '../viewModels/useReviewWordCloud';
import {highlightSegments,termColors,type ReviewCloudProcessor} from '../models/ReviewWordCloud';
import {ui} from '../theme/ui';
import {colors} from '../theme/colors';
export function PropertyReviewWordCloud({accountId,propertyId,processor,compact=false}:{accountId:string|undefined;propertyId:string;processor?:ReviewCloudProcessor;compact?:boolean}){
 const vm=useReviewWordCloud(accountId,propertyId,processor),term=vm.cloud?.terms.find(t=>t.id===vm.selected);
 const rows=vm.corpus?.rows.filter(r=>!term||term.matches.some(m=>m.id===r.id))??[];
 return <View style={styles.panel}><Text style={ui.sectionTitle}>Frequently mentioned</Text>
 <Text style={ui.supporting}>English, Filipino and Taglish review themes. Colors are decorative, not sentiment ratings.</Text>
 {!accountId?<Text style={ui.supporting}>Sign in to view property review themes.</Text>:<>
 {vm.status==='loading'?<ActivityIndicator accessibilityLabel="Loading property review themes"/>:null}
 {vm.error?<Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text>:null}
 {vm.corpus?<Text style={ui.body}>{vm.corpus.count} eligible approved {vm.corpus.count===1?'property review':'property reviews'}{vm.corpus.count!==rows.filter(r=>r.text?.trim()).length&&!term?' (some are ratings only)':''}</Text>:null}
 {vm.status==='unavailable'?<Text style={ui.supporting}>Review themes are not connected yet. Approved original reviews remain available below; no word frequencies have been generated.</Text>:null}
 {vm.cloud?.status==='empty'?<Text style={ui.supporting}>No eligible approved property reviews yet.</Text>:null}
 {vm.cloud?.status==='insufficient_data'?<Text style={ui.supporting}>Not enough recurring terms yet. Themes need at least two usable reviews and two distinct reviews mentioning a term.</Text>:null}
 <View style={styles.terms}>{vm.cloud?.terms.map(t=><Pressable key={t.id} accessibilityRole="button" accessibilityState={{selected:vm.selected===t.id}} accessibilityLabel={`${t.text}, mentioned in ${t.review_count} distinct reviews`} onPress={()=>void vm.workflow.select(t.id)} style={[styles.term,vm.selected===t.id?styles.selected:null]}><Text style={{color:termColors[t.color],fontSize:Math.round(16*t.font_size_rem),fontWeight:'600',flexShrink:1}}>{t.text}</Text></Pressable>)}</View>
 {term?<><Text accessibilityLiveRegion="polite" style={ui.body}>{term.text}: {term.review_count} distinct reviews</Text><AppButton label="Clear selected term" variant="secondary" onPress={()=>void vm.workflow.select(null)}/>{rows.map(r=><View key={r.id} style={styles.review}><Text style={ui.body}>{highlightSegments(r.text??'',term.matches.find(m=>m.id===r.id)?.spans??[]).map((s,i)=><Text key={i} style={s.marked?styles.mark:undefined}>{s.text}</Text>)}</Text></View>)}</>:null}
 {!compact||vm.error?<AppButton label={compact?'Retry review themes':'Refresh review themes'} variant="secondary" disabled={vm.status==='loading'} onPress={()=>void vm.workflow.load()}/>:null}
 </>}
 </View>;
}
const styles=StyleSheet.create({panel:{gap:10,paddingVertical:12},terms:{flexDirection:'row',flexWrap:'wrap',gap:6},term:{minHeight:48,minWidth:48,maxWidth:'100%',paddingHorizontal:10,paddingVertical:8,justifyContent:'center',borderWidth:1,borderColor:'transparent',borderRadius:8,flexShrink:1},selected:{borderColor:colors.outline,backgroundColor:colors.surface},review:{borderTopWidth:1,borderColor:colors.outline,paddingTop:12},mark:{backgroundColor:'#E4F0DF',fontWeight:'700',color:colors.ink}});
