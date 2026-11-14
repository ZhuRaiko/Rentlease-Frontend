import {useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Switch,Text,View,useWindowDimensions} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {ListingButton} from './ListingButton';
import {useSheetBottomInset} from '../../../shared/components/useSheetBottomInset';
import type {useRentalLocationApproval} from '../../../shared/viewModels/useRentalLocationApproval';

/**
 * Posting-wizard presentation of the existing rental-location approval: one switch row plus a bottom sheet that holds every word of the
 * consent text, the point to confirm, the explicit confirm button, withdrawal, and the error and reload states. State and writes stay in
 * useRentalLocationApproval; nothing sent to any service changes. Turning the switch ON only opens the sheet: approval needs the confirm button.
 */
export function PostingLocationApproval({model,disabled}:{model:ReturnType<typeof useRentalLocationApproval>;disabled:boolean}){
  const [open,setOpen]=useState(false),{height}=useWindowDimensions(),sheetPadBottom=useSheetBottomInset(),s=model.state;
  if(!s&&!model.error)return null;
  const blocked=disabled||model.busy||!model.ready,canChange=!!s&&model.ready&&(s.approved||s.eligible);
  const notice=s?<Text style={ui.supporting}>{s.approved?'Approved for the current location.':s.eligible?'Not approved. Estimates can use the other saved details.':'A confirmed public grid location is unavailable. Estimates can use the other saved details.'}</Text>:null;
  const error=model.error?<><Text accessibilityRole="alert" style={ui.supporting}>{model.error}</Text><Pressable accessibilityRole="button" disabled={disabled||model.busy} style={styles.link} onPress={model.reload}><Text style={[ui.supporting,styles.linkText]}>Reload location permission</Text></Pressable></>:null;
  return <View style={styles.card}>
    <View style={styles.row}>
      <View style={styles.copy}><Text style={[ui.body,styles.bold]}>Include my approximate area</Text><Text style={ui.supporting}>Optional. The estimate works without it.</Text></View>
      <Switch accessibilityLabel="Include my approximate area in the estimate" accessibilityState={{disabled:blocked||!canChange,busy:model.busy}} disabled={blocked||!canChange} value={!!s?.approved} trackColor={{true:colors.primaryAction,false:colors.border}} onValueChange={on=>{if(on)setOpen(true);else void model.save(false);}}/>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="What's shared with the estimator" style={styles.link} onPress={()=>setOpen(true)}><Text style={[ui.supporting,styles.linkText]}>What's shared?</Text></Pressable>
    {!open?error:null}
    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.dismiss} onPress={()=>setOpen(false)}/>
        <View accessibilityViewIsModal style={[styles.sheet,{maxHeight:height*.85,paddingBottom:sheetPadBottom}]}>
          <View accessible={false} style={styles.handle}/>
          <View style={styles.row}><Text accessibilityRole="header" style={[ui.sectionTitle,styles.copy]}>What's shared with the estimator</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={()=>setOpen(false)}><Text style={ui.sectionTitle}>{'×'}</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={ui.supporting}>Approximate location for rent estimation (optional)</Text>
            <Text style={ui.supporting}>If you approve, RentLease sends only this property's confirmed approximate public map point to its rental price estimation provider. Exact locations are excluded. This permission applies to this location revision under policy rental-public-location-v1. Location or identity corrections require approval again. You can withdraw permission for future requests. Declining does not block estimation or publication.</Text>
            {s?.point?<Text style={ui.supporting}>Public map point to confirm: latitude {s.point.latitude.toFixed(6)}, longitude {s.point.longitude.toFixed(6)}. Confirm that this is the approximate public point for this property before approving.</Text>:null}
            {error}{notice}
            {canChange?<ListingButton tone="brand" disabled={blocked} label={model.busy?'Updating permission...':s!.approved?'Withdraw location permission':'I confirm the approximate public point and approve its use'} onPress={()=>{void model.save(!s!.approved).then(()=>setOpen(false));}}/>:null}
            <ListingButton tone="outline" label="Not now" onPress={()=>setOpen(false)}/>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  card:{borderWidth:1,borderColor:colors.outline,borderRadius:12,padding:spacing.md,gap:spacing.xs,backgroundColor:colors.background},
  row:{flexDirection:'row',alignItems:'center',gap:spacing.sm},copy:{flex:1,minWidth:0},bold:{fontWeight:'600'},
  link:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},linkText:{color:colors.primaryAction,fontWeight:'600'},
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},dismiss:{position:'absolute',top:0,bottom:0,left:0,right:0},
  sheet:{backgroundColor:colors.background,borderTopLeftRadius:18,borderTopRightRadius:18,padding:spacing.lg,gap:spacing.sm},
  handle:{alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:colors.border},
  sheetBody:{gap:spacing.sm,paddingBottom:spacing.md},close:{width:48,height:48,alignItems:'center',justifyContent:'center'},
});
