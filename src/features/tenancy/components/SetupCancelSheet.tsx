import {Modal,StyleSheet,Text,useWindowDimensions,ScrollView,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusButton} from '../../../shared/components/StatusParts';
import {CANCEL_SHEET} from '../models/TenancySetupScreen';

/** The confirmation before a tenancy setup is cancelled: it says plainly that the cancel is for both people. Same sheet look as the release sheet. */
export function SetupCancelSheet({visible,saving,onConfirm,onKeep}:{visible:boolean;saving:boolean;onConfirm:()=>void;onKeep:()=>void}){
  const insets=useSafeAreaInsets(),{height}=useWindowDimensions();
  if(!visible)return null;
  return <Modal visible transparent animationType="slide" onRequestClose={()=>{if(!saving)onKeep();}}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.sheet}>
      <View accessible={false} style={styles.grab}/>
      <ScrollView style={{maxHeight:height*0.8}} contentContainerStyle={[styles.body,{paddingBottom:spacing.lg+insets.bottom}]}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>{CANCEL_SHEET.title}</Text>
        <View style={styles.note}><Text style={styles.noteText}>{CANCEL_SHEET.body}</Text></View>
        <StatusButton tone="dangerOutline" label={saving?'Cancelling…':CANCEL_SHEET.confirm} disabled={saving} onPress={onConfirm}/>
        <StatusButton label={CANCEL_SHEET.keep} disabled={saving} onPress={onKeep}/>
      </ScrollView>
    </View></View></Modal>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},
  sheet:{paddingTop:spacing.md,paddingHorizontal:spacing.md,gap:spacing.sm,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:colors.background},body:{gap:spacing.sm},
  grab:{alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:colors.border},
  note:{padding:spacing.sm,borderRadius:radius.control,borderWidth:1,borderColor:colors.restricted,backgroundColor:colors.restrictedSurface},noteText:{...ui.supporting,color:colors.restricted},
});
