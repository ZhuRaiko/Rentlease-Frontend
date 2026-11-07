import {Pressable,StyleSheet,Text,TextInput,View,ActivityIndicator} from 'react-native';
import {PublicAvatar} from '../../../shared/components/PublicIdentityBadge';
import {AppButton} from '../../../shared/components/AppButton';
import {ui} from '../../../shared/theme/ui';
import {colors} from '../../../shared/theme/colors';
import type {usePublicIdentityEditorViewModel} from '../viewModels/usePublicIdentityEditorViewModel';
/** Inline presentation only; the parent ViewModel coordinates the single save action. */
export function PublicIdentityEditor({vm,suggestion,disabled=false}:{vm:ReturnType<typeof usePublicIdentityEditorViewModel>;suggestion?:string|undefined;disabled?:boolean}){
 const locked=disabled||vm.busy||vm.uncertain||!vm.baseline||vm.loading;
 return <View style={styles.section}>
 <Text style={ui.sectionTitle}>Profile photo</Text>
 <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" disabled={locked} onPress={()=>void vm.workflow.choose()} style={styles.photo}><PublicAvatar url={vm.photo?.uri??(vm.removeAvatar?null:vm.baseline?.avatarUrl)} size={80}/><Text style={styles.link}>Change photo</Text></Pressable>
 {(vm.photo||vm.baseline?.avatarPath)&&!vm.removeAvatar?<Pressable accessibilityRole="button" disabled={locked} onPress={vm.workflow.remove} style={styles.action}><Text style={styles.link}>Remove photo</Text></Pressable>:null}
 <Text style={ui.supporting}>Optional. Your profile photo is public. JPEG or PNG, up to 3 MB.</Text>
 <Text style={ui.body}>Display Name</Text><TextInput accessibilityLabel="Display Name" value={vm.nickname} editable={!locked} onChangeText={vm.workflow.setNickname} autoCapitalize="words" maxLength={60} style={styles.input} placeholder="Choose a Display Name"/>
 <Text style={ui.supporting}>This is the name other RentLease users will see.</Text>
 {!vm.baseline?.nickname&&suggestion&&!vm.nickname?<Pressable accessibilityRole="button" disabled={locked} onPress={()=>vm.workflow.setNickname(suggestion)} style={styles.action}><Text style={styles.link}>Use current account name: {suggestion}</Text><Text style={ui.supporting}>Suggestion only. It stays private until you confirm and save.</Text></Pressable>:null}
 <Text style={ui.supporting}>Use 2 to 30 letters or numbers. Clear to use Property Owner or Renter instead.</Text>
 {vm.consent?<Pressable accessibilityRole="checkbox" accessibilityState={{checked:vm.confirmed,disabled:locked}} disabled={locked} onPress={()=>vm.workflow.confirm(!vm.confirmed)} style={styles.action}><Text style={ui.body}>{vm.confirmed?'[x] ':'[ ] '}I understand the selected name and photo will be public.</Text></Pressable>:null}
 {vm.loading?<ActivityIndicator accessibilityLabel="Loading profile identity" color={colors.primaryAction}/>:null}
 {vm.error?<Text accessibilityRole="alert" style={styles.error}>{vm.error}</Text>:null}{vm.notice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{vm.notice}</Text>:null}
 {(!vm.baseline||vm.error)&&!vm.loading&&!vm.uncertain?<AppButton label="Reload saved profile" variant="secondary" disabled={busy(vm,disabled)} onPress={()=>void vm.workflow.load()}/>:null}
 {vm.cleanup.length?<AppButton label="Retry photo cleanup" variant="secondary" disabled={busy(vm,disabled)} onPress={()=>void vm.workflow.cleanup()}/>:null}
 </View>;
}
const busy=(vm:ReturnType<typeof usePublicIdentityEditorViewModel>,disabled:boolean)=>vm.busy||disabled;
const styles=StyleSheet.create({section:{gap:10,paddingVertical:12},photo:{alignItems:'center',gap:8,padding:8},action:{minHeight:48,justifyContent:'center',gap:4},link:{...ui.body,color:colors.primaryAction},input:{...ui.body,borderWidth:1,borderColor:colors.controlBorder,borderRadius:10,minHeight:48,padding:12},error:{...ui.supporting,color:colors.restricted}});
