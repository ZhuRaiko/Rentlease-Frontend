import {useState} from 'react';
import {StyleSheet,Text,TextInput,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {ButtonRow,Slot,StatusButton,StatusChip} from '../../../shared/components/StatusParts';
import type {OwnerExtensionView} from '../models/TenancyExtension';

/**
 * The owner's "Extension request" screen (v11 screens 7 and 8): what is asked, rent stays, an optional note for a decline, Accept, Message and
 * Decline. Accept is always tappable: a clash (23P01) is only ever shown after the tap, as `clash`, on this same screen. No counter-offer.
 */
export function TenancyExtensionRequestPanel({view,asksTitle,clash,saving,error,notice,canMessage,onAccept,onDecline,onMessage}:{view:OwnerExtensionView|null;
  /** The heading used after a clash ("<name> asks to stay until <date>"). */asksTitle:string|null;clash:{title:string;body:string}|null;saving:boolean;error:string|null;notice:string|null;canMessage:boolean;onAccept:()=>void;onDecline:(note:string)=>void;onMessage:()=>void}){
  const [note,setNote]=useState('');
  if(!view)return <View style={styles.card}><Text style={ui.body}>No extension request is waiting for you.</Text>{notice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{notice}</Text>:null}</View>;
  return <View style={styles.wrap}>
    <View style={styles.alert}>
      <StatusChip chip={{label:'Needs your OK',tone:'warning'}}/>
      <Text accessibilityRole="header" style={styles.title}>{clash&&asksTitle?asksTitle:view.title}</Text>
      {!clash?<Text style={ui.supporting}>{view.property}</Text>:null}
    </View>
    {clash?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.clash}><Text style={styles.clashTitle}>{clash.title}</Text><Text style={ui.supporting}>{clash.body}</Text></View>:null}
    <View style={styles.card}>
      <View style={styles.cells}>
        <View style={styles.cell}><Text style={ui.supporting}>Now ends</Text><Text style={styles.value}>{view.now}</Text></View>
        <View style={[styles.cell,styles.cellBlue]}><Text style={ui.supporting}>Asks until</Text><Text style={styles.value}>{view.asks}</Text></View>
      </View>
      {!clash?<>
        <Fact label="Extra time" value={view.extra}/><Fact label="Rent" value={view.rent}/><Fact label="Rent due" value={view.rentDue}/>
      </>:null}
    </View>
    {!clash?<View style={styles.card}>
      <Text style={styles.label}>{view.noteLabel}</Text>
      <TextInput accessibilityLabel={view.noteLabel} placeholder={view.notePlaceholder} placeholderTextColor={colors.textMuted} multiline maxLength={1000} editable={!saving} value={note} onChangeText={setNote} style={[ui.control,ui.body,styles.input]}/>
    </View>:null}
    {notice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{notice}</Text>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    <StatusButton tone="primary" label={saving?'Working…':'Accept'} disabled={saving} onPress={onAccept}/>
    <ButtonRow>
      {canMessage?<Slot><StatusButton label={view.messageLabel} disabled={saving} onPress={onMessage}/></Slot>:null}
      <Slot><StatusButton tone="dangerOutline" label="Decline" disabled={saving} onPress={()=>onDecline(note)}/></Slot>
    </ButtonRow>
  </View>;
}
function Fact({label,value}:{label:string;value:string}){return <View style={styles.fact}><Text style={ui.supporting}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;}
const styles=StyleSheet.create({
  wrap:{gap:spacing.sm},
  alert:{padding:spacing.md,gap:spacing.xs,borderRadius:radius.control,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},title:{...ui.sectionTitle},
  card:{...ui.panel,padding:spacing.md,gap:spacing.sm,borderRadius:16},
  cells:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},cell:{flexGrow:1,flexBasis:130,padding:spacing.sm,gap:2,borderRadius:radius.control,backgroundColor:colors.surface},cellBlue:{backgroundColor:colors.identitySurface},value:{...ui.body,fontWeight:'700'},
  fact:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',gap:spacing.sm},factValue:{...ui.body,fontWeight:'700',flexShrink:1,textAlign:'right'},
  label:{...ui.body,fontWeight:'700'},input:{paddingHorizontal:12,paddingVertical:10,minHeight:72,textAlignVertical:'top'},
  clash:{padding:spacing.md,gap:spacing.xxs,borderRadius:radius.control,borderWidth:1,borderColor:colors.restricted,backgroundColor:colors.restrictedSurface},clashTitle:{...ui.body,fontWeight:'700',color:colors.restricted},
  error:{...ui.supporting,color:colors.restricted,fontWeight:'600'},
});
