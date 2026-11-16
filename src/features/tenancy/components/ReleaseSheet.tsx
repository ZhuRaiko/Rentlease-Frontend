import {Modal,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {releaseSheetView,RELEASE_RETRY_LABEL} from '../models/CancelledRentals';
import type {ReleaseRequest} from '../viewModels/tenancyReleaseWorkflow';
import {StatusButton} from '../../../shared/components/StatusParts';
/** The confirmation before a held reservation is released: one plain sentence, the effect, and two buttons. A failure is one amber line with a 48dp Retry. */
export function ReleaseSheet({request,saving,error,onConfirm,onRetry,onKeep}:{request:ReleaseRequest|null;saving:boolean;error:string|null;onConfirm:()=>void;onRetry:()=>void;onKeep:()=>void}){
  const insets=useSafeAreaInsets(),{height}=useWindowDimensions();
  if(!request)return null;
  const view=releaseSheetView(request.role,{listing:request.listing,range:request.range,other:request.other});
  return <Modal visible transparent animationType="slide" onRequestClose={()=>{if(!saving)onKeep();}}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.sheet}>
      <View accessible={false} style={styles.grab}/>
      <ScrollView style={{maxHeight:height*0.8}} contentContainerStyle={[styles.body,{paddingBottom:spacing.lg+insets.bottom}]}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>{view.title}</Text>
      <Text style={ui.body}>{view.body}</Text>
      <View style={styles.note}><Text style={styles.noteText}>{view.note}</Text></View>
      {error?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}><Text style={styles.errorText}>{error}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${RELEASE_RETRY_LABEL}: ${view.confirmLabel}`} disabled={saving} onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>{RELEASE_RETRY_LABEL}</Text></Pressable></View>:null}
      <StatusButton tone="primary" label={saving?'Releasing…':view.confirmLabel} disabled={saving} onPress={onConfirm}/>
      <StatusButton label={view.keepLabel} disabled={saving} onPress={onKeep}/>
      </ScrollView>
    </View></View></Modal>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},
  sheet:{paddingTop:spacing.md,paddingHorizontal:spacing.md,gap:spacing.sm,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:colors.background},body:{gap:spacing.sm},
  grab:{alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:colors.border},
  note:{padding:spacing.sm,borderRadius:radius.control,backgroundColor:colors.identitySurface},noteText:{...ui.supporting,color:colors.identityInk},
  error:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm,paddingLeft:spacing.sm,borderRadius:radius.control,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},
  errorText:{...ui.supporting,flexGrow:1,flexShrink:1,flexBasis:140,color:colors.warning,fontWeight:'600'},retry:{minHeight:48,minWidth:48,paddingHorizontal:spacing.sm,alignItems:'center',justifyContent:'center'},retryText:{...ui.supporting,color:colors.primaryAction,fontWeight:'700',textDecorationLine:'underline'},
});
