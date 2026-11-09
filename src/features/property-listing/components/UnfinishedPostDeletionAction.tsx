import {Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {AppButton} from '../../../shared/components/AppButton';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function UnfinishedPostDeletionAction({viewModel:vm}:{viewModel:PropertyListingViewModel}){
 const state=vm.unfinishedPostState;
 return <View style={styles.section}>
  <FeedbackNotice message={state.error} tone="error"/>
  {state.status?.state==='live'&&!state.status.eligible&&state.status.reason?<Text style={ui.supporting}>{state.status.reason}</Text>:null}
  {state.status?.state==='live'&&state.status.eligible?<Pressable accessibilityRole="button" accessibilityLabel="Delete Unfinished Post" accessibilityState={{disabled:vm.unfinishedPostDeletionDisabled,busy:state.busy}} disabled={vm.unfinishedPostDeletionDisabled} onPress={vm.requestUnfinishedPostDeletion} style={styles.action}><Text style={styles.danger}>{state.busy?'Deleting...':'Delete Unfinished Post'}</Text></Pressable>:null}
  {state.pending.filter(job=>vm.screen==='dashboard'||job.propertyId===vm.workspacePropertyId).map(job=><Pressable key={job.propertyId} accessibilityRole="button" disabled={vm.portfolioActionsDisabled} accessibilityState={{disabled:vm.portfolioActionsDisabled,busy:state.busy}} onPress={()=>vm.resumeUnfinishedPostCleanup(job.propertyId)} style={styles.action}><Text style={ui.supporting}>{state.busy?'Finishing cleanup...':'Retry unfinished post photo cleanup'}</Text></Pressable>)}
  {state.propertyId&&state.error&&!state.pending.length?<Pressable accessibilityRole="button" disabled={state.busy} onPress={()=>void vm.unfinishedPost.retry()} style={styles.action}><Text style={ui.supporting}>Check deletion status</Text></Pressable>:null}
  <Modal transparent visible={state.confirming} onRequestClose={()=>vm.unfinishedPost.cancel()} animationType="fade"><View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}>
   <Text accessibilityRole="header" style={ui.sectionTitle}>Delete unfinished post?</Text>
   <Text style={ui.body}>This permanently removes this unfinished property and its draft listing. This cannot be undone.</Text>
   <AppButton label="Cancel" variant="secondary" onPress={()=>vm.unfinishedPost.cancel()}/>
   <AppButton label="Delete Permanently" variant="danger" onPress={vm.confirmUnfinishedPostDeletion}/>
  </View></View></Modal>
 </View>;
}
const styles=StyleSheet.create({section:{paddingHorizontal:spacing.lg,gap:spacing.xs},action:{minHeight:48,justifyContent:'center'},danger:{...ui.supporting,color:colors.restricted,fontWeight:'600'},backdrop:{flex:1,justifyContent:'center',padding:spacing.lg,backgroundColor:colors.overlay},dialog:{padding:spacing.lg,backgroundColor:colors.background,borderRadius:12,gap:spacing.md}});
