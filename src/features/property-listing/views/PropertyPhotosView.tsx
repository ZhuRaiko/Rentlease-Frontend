import {KeyboardAwareScrollView as ScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {Image,KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {ScreenContainer} from '../../../shared/components/ScreenContainer';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {ListingButton} from '../components/ListingButton';
import {ListingField} from '../components/ListingControls';
import {movePhotoIds} from '../models/PropertyPhotoGrid';
import {PropertyPhotoGrid} from '../components/PropertyPhotoGrid';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

export function PropertyPhotosView({viewModel:vm,onClose}:{viewModel:PropertyListingViewModel;onClose:()=>void}){
 const state=vm.photoState,flow=vm.propertyPhotos;
 const disabled=state.busy||!state.loaded||state.needsReconcile||!!state.pendingSelections.length;
 const photo=state.photos.find(p=>p.id===state.detailId),index=state.photos.findIndex(p=>p.id===state.detailId);
 const pending=[...state.pendingSelections.map((p,i)=>({uri:p.uri,label:state.busy&&i===0?'Uploading...':'Waiting'})),...(state.uncertainSelection?[{uri:state.uncertainSelection.uri,label:'Check status'}]:[]),...(state.selected?[{uri:state.selected.uri,label:'Not uploaded'}]:[])];
 const header=<>
  <Text accessibilityRole="header" style={styles.heading}>{state.photos.length} of 10 photos</Text>
  <Text style={styles.copy}>Touch and hold to move. The first photo becomes the cover when the order is saved.</Text>
  <FeedbackNotice message={state.error} tone="error"/>
  <FeedbackNotice message={state.notice}/>
  {state.busy?<Text accessibilityLiveRegion="polite" style={styles.copy}>{state.batch.status==='running'?`Saving photo ${state.batch.current} of ${state.batch.total}...`:'Saving photo changes...'}</Text>:null}
  {state.needsReconcile||!state.loaded?<ListingButton label={state.needsReconcile?'Check saved photos':'Load saved photos'} disabled={state.busy} tone="outline" onPress={()=>void flow.checkStatus()}/>:null}
  {!state.propertyId?<ListingButton label="Go to My Listings" tone="outline" onPress={vm.goDashboard}/>:null}
 </>;
 const footer=<>
  {state.pendingSelections.length&&!state.busy?<ListingButton label="Continue remaining uploads" disabled={state.needsReconcile} onPress={()=>void flow.resumeQueue()}/>:null}
  {state.selected?<><ListingButton label="Upload selected photo" disabled={disabled} onPress={()=>void flow.upload()}/><ListingButton label="Discard selection" tone="outline" disabled={state.busy} onPress={flow.cancelSelection}/></>:null}
  <Text style={styles.helper}>JPEG, PNG or WebP, up to 10 MB each. Photos are public; keep documents and private access details out.</Text>
 </>;
 return <GestureHandlerRootView style={styles.root}>
  <ScreenHeader title="Property photos" onBack={vm.goBack} onClose={onClose}/>
  <PropertyPhotoGrid photos={state.photos} pending={pending} disabled={disabled} canAdd={!!state.propertyId&&state.photos.length+pending.length<10} onAdd={()=>void flow.addPhotos()} onOpen={flow.openDetail} onReorder={ids=>void flow.reorder(ids)} header={header} footer={footer}/>
  <Modal visible={!!photo} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>flow.back()}>
   <ScreenContainer padded={false}>
    <ScreenHeader title={`Photo ${index+1}`} onClose={flow.closeDetail} disabled={state.busy}/>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':undefined}>
     <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.detail}>
      {photo?<>
       <Image source={{uri:photo.publicUrl}} resizeMethod="resize" resizeMode="contain" accessibilityLabel={photo.alt_text||`Property photo ${index+1}`} style={styles.preview}/>
       <FeedbackNotice message={state.error} tone="error"/>
       <ListingField label="Description (optional)" placeholder="For example: Bedroom with window" multiline value={state.altDrafts[photo.id]??''} onChangeText={value=>flow.setAltDraft(photo.id,value)}/>
       <ListingButton label={state.busy?'Saving...':'Save description'} disabled={disabled||(state.altDrafts[photo.id]??'')===(photo.alt_text??'')} onPress={()=>void flow.saveDetail()}/>
       <View style={styles.moves}>
        <View style={styles.move}><ListingButton label="Move earlier" tone="outline" disabled={disabled||index===0} onPress={()=>void flow.reorder(movePhotoIds(state.photos.map(p=>p.id),index,index-1))}/></View>
        <View style={styles.move}><ListingButton label="Move later" tone="outline" disabled={disabled||index===state.photos.length-1} onPress={()=>void flow.reorder(movePhotoIds(state.photos.map(p=>p.id),index,index+1))}/></View>
       </View>
       {state.removeId===photo.id?<>
        <FeedbackNotice message="Remove this photo and its stored image? An active listing must remain complete enough for publication." tone="warning"/>
        <ListingButton label="Confirm remove photo" tone="danger" disabled={state.busy} onPress={()=>void flow.confirmRemove()}/>
        <ListingButton label="Keep photo" tone="outline" disabled={state.busy} onPress={flow.cancelRemove}/>
       </>:<ListingButton label="Remove photo" tone="danger" disabled={disabled} onPress={()=>flow.requestRemove(photo.id)}/>}
       {state.needsReconcile?<ListingButton label="Check saved photos" tone="outline" disabled={state.busy} onPress={()=>void flow.checkStatus()}/>:null}
      </>:null}
     </ScrollView>
    </KeyboardAvoidingView>
   </ScreenContainer>
  </Modal>
 </GestureHandlerRootView>;
}
const styles=StyleSheet.create({root:{flex:1},heading:{...ui.sectionTitle},copy:{...ui.body},helper:{...ui.body,color:colors.textMuted,fontSize:12},detail:{padding:16,gap:12,width:'100%',maxWidth:460,alignSelf:'center',paddingBottom:32},preview:{width:'100%',aspectRatio:4/3,backgroundColor:colors.background},moves:{flexDirection:'row',flexWrap:'wrap',gap:8},move:{flexGrow:1,flexBasis:140}});
