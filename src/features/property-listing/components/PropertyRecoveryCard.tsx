import {useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {recentPropertyLabel,recoveryMessage,type RecentPropertyRow} from '../models/RecentProperty';
import {ListingButton} from './ListingButton';
/** What the person sees when a save could not be confirmed. One message, readable choices (newest first), and a way out behind one confirmation. */
export interface RecoveryState {recent:readonly RecentPropertyRow[];uncertainSince:number|null;recentChecked:boolean;confirming:boolean;busy:boolean}
export function PropertyRecoveryCard({state,onCheck,onUse,onStartFresh}:{state:RecoveryState;onCheck:()=>void;onUse:(id:string)=>void;onStartFresh:()=>void}){
  const [confirming,setConfirming]=useState(false);
  // Too soon to say whether the last save landed: a calm line and one Retry, nothing that could start a second copy.
  if(state.confirming&&!state.recent.length)return <View style={styles.card}><FeedbackNotice message={recoveryMessage(state)}/><ListingButton disabled={state.busy} label="Check again" tone="outline" onPress={onCheck}/></View>;
  return <View style={styles.card}>
    <FeedbackNotice tone="warning" message={recoveryMessage(state)}/>
    {!state.recentChecked?<ListingButton disabled={state.busy} label="Check recent owned properties" tone="outline" onPress={onCheck}/>:null}
    {state.recent.map(row=><ListingButton key={row.id} disabled={state.busy} label={recentPropertyLabel(row)} tone="outline" onPress={()=>onUse(row.id)}/>)}
    {confirming?<View style={styles.confirm}>
      <Text accessibilityLiveRegion="polite" style={ui.supporting}>Start fresh? This forgets the save that could not be confirmed. Properties you already have are not deleted.</Text>
      <ListingButton disabled={state.busy} label="Yes, start fresh" tone="outline" onPress={()=>{setConfirming(false);onStartFresh();}}/>
      <ListingButton label="Cancel" tone="outline" onPress={()=>setConfirming(false)}/>
    </View>:<ListingButton disabled={state.busy} label="None of these, start fresh" tone="outline" onPress={()=>setConfirming(true)}/>}
  </View>;
}
const styles=StyleSheet.create({card:{gap:spacing.sm},confirm:{gap:spacing.sm}});
