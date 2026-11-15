import {Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {AppButton} from '../../../shared/components/AppButton';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {deleteDialogBody,deleteDialogTitle,unfinishedPostName} from '../models/UnfinishedPostMenu';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
/**
 * The single confirmation for deleting an unfinished post, plus its error and cleanup recovery. There is no delete control here:
 * it is triggered from a My Rentals card menu or the posting editor menu, and both end in this dialog.
 */
export function UnfinishedPostDeletionAction({viewModel:vm}:{viewModel:PropertyListingViewModel}){
 const state=vm.unfinishedPostState,onWorkspace=!!state.propertyId&&state.propertyId===vm.workspacePropertyId;
 const item=vm.portfolioState.items.find(x=>x.propertyId===state.propertyId);
 const name=unfinishedPostName(item,onWorkspace?vm.draft?.title:null);
 const photoCount=onWorkspace&&vm.photoState?vm.photoState.photos.length:null;
 const cardIds=new Set(vm.portfolioState.items.map(x=>x.propertyId));
 // A card shows its own cleanup banner; only a job with no card (or on an editor screen) gets a link here.
 const orphans=state.pending.filter(job=>vm.screen==='dashboard'?!cardIds.has(job.propertyId):job.propertyId===vm.workspacePropertyId);
 return <View style={styles.section}>
  <FeedbackNotice message={state.error} tone="error"/>
  {orphans.map(job=><Pressable key={job.propertyId} accessibilityRole="button" disabled={vm.portfolioActionsDisabled} accessibilityState={{disabled:vm.portfolioActionsDisabled,busy:state.busy}} onPress={()=>vm.resumeUnfinishedPostCleanup(job.propertyId)} style={styles.action}><Text style={ui.supporting}>{state.busy?'Finishing cleanup...':'Retry unfinished post photo cleanup'}</Text></Pressable>)}
  {state.propertyId&&state.error&&!state.pending.length?<Pressable accessibilityRole="button" disabled={state.busy} onPress={()=>void vm.unfinishedPost.retry()} style={styles.action}><Text style={ui.supporting}>Check deletion status</Text></Pressable>:null}
  <Modal transparent visible={state.confirming&&state.status?.state==='live'&&state.status.eligible} onRequestClose={()=>vm.unfinishedPost.cancel()} animationType="fade"><View style={styles.backdrop}><View accessibilityViewIsModal accessibilityLabel="Delete Unfinished Post" style={styles.dialog}>
   <Text accessibilityRole="header" style={ui.sectionTitle}>{deleteDialogTitle(name)}</Text>
   <Text style={ui.body}>{deleteDialogBody(photoCount)} This cannot be undone.</Text>
   <AppButton label="Cancel" variant="secondary" onPress={()=>vm.unfinishedPost.cancel()}/>
   <AppButton label="Delete Permanently" variant="danger" onPress={vm.confirmUnfinishedPostDeletion}/>
  </View></View></Modal>
 </View>;
}
const styles=StyleSheet.create({section:{paddingHorizontal:spacing.lg,gap:spacing.xs},action:{minHeight:48,justifyContent:'center'},backdrop:{flex:1,justifyContent:'center',padding:spacing.lg,backgroundColor:colors.overlay},dialog:{padding:spacing.lg,backgroundColor:colors.background,borderRadius:12,gap:spacing.md}});
