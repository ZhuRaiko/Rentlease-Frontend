import {Modal,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusButton} from '../../../shared/components/StatusParts';
import {DISPUTE_SEND_LABEL,NO_CONVERSATION_NOTE,disputeMessage} from '../models/RentLedger';
import {shortDate} from '../../../shared/utils/rentalDates';
/**
 * "Not received": shows the exact chat message before anything is sent. Confirming records "not received" first; the message follows and a
 * failure to send never undoes the record. With no conversation the sheet says so and no message is sent.
 */
export function DisputeSheet({dueDate,name,hasConversation,saving,error,canRetry,onConfirm,onRetry,onCancel}:{dueDate:string|null;name:string;hasConversation:boolean;saving:boolean;error:string|null;canRetry:boolean;onConfirm:()=>void;onRetry:()=>void;onCancel:()=>void}){
  const insets=useSafeAreaInsets(),{height}=useWindowDimensions();
  if(!dueDate)return null;
  return <Modal visible transparent animationType="slide" onRequestClose={()=>{if(!saving)onCancel();}}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.sheet}>
      <View accessible={false} style={styles.grab}/>
      <ScrollView style={{maxHeight:height*0.8}} contentContainerStyle={[styles.body,{paddingBottom:spacing.lg+insets.bottom}]}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>{`Rent for ${shortDate(dueDate)} not received?`}</Text>
        {hasConversation?<>
          <Text style={ui.body}>{`This marks it as not received in the ledger and sends ${name} this message in your chat:`}</Text>
          <View accessible accessibilityLabel={`Message: ${disputeMessage(dueDate)}`} style={styles.quote}><Text style={ui.body}>{disputeMessage(dueDate)}</Text></View>
        </>:<>
          <Text style={ui.body}>{`This marks it as not received in the ledger.`}</Text>
          <View style={styles.note}><Text style={styles.noteText}>{NO_CONVERSATION_NOTE}</Text></View>
        </>}
        {error?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}><Text style={styles.errorText}>{error}</Text>
          {canRetry?<Pressable accessibilityRole="button" accessibilityLabel="Retry" disabled={saving} onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>:null}</View>:null}
        <StatusButton tone="primary" label={saving?'Saving…':DISPUTE_SEND_LABEL} disabled={saving} onPress={onConfirm}/>
        <StatusButton label="Cancel" disabled={saving} onPress={onCancel}/>
      </ScrollView>
    </View></View></Modal>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},
  sheet:{paddingTop:spacing.md,paddingHorizontal:spacing.md,gap:spacing.sm,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:colors.background},body:{gap:spacing.sm},
  grab:{alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:colors.border},
  quote:{padding:spacing.sm,borderRadius:radius.control,borderWidth:1,borderColor:colors.outline,backgroundColor:colors.surface},
  note:{padding:spacing.sm,borderRadius:radius.control,backgroundColor:colors.identitySurface},noteText:{...ui.supporting,color:colors.identityInk},
  error:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm,paddingLeft:spacing.sm,borderRadius:radius.control,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},
  errorText:{...ui.supporting,flexGrow:1,flexShrink:1,flexBasis:140,color:colors.warning,fontWeight:'600'},retry:{minHeight:48,minWidth:48,paddingHorizontal:spacing.sm,alignItems:'center',justifyContent:'center'},retryText:{...ui.supporting,color:colors.primaryAction,fontWeight:'700',textDecorationLine:'underline'},
});
