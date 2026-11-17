import {useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusButton} from '../../../shared/components/StatusParts';
import {SHEET,dateLabel,extensionBounds,monthOf,quickChoices,type ExtensionRead} from '../models/TenancyExtension';
import {ExtensionCalendar} from './ExtensionCalendar';

type Key='m1'|'m3'|'m6'|'custom';
/**
 * The tenant's "How much longer do you want to stay?" sheet: +1, +3, +6 months (each with its resulting date) or "Pick a date", the new end date,
 * "Rent stays", Send request. A clash (23P01) stays on the sheet as an inline alert with the first clashing date only; Send stays off until the
 * date changes. Every hook runs before the sheet decides whether to draw anything.
 */
export function ExtensionSheet({visible,read,ownerName,rent,saving,error,conflictDate,onSend,onClose}:{visible:boolean;read:ExtensionRead|null;ownerName:string;rent:number|null;saving:boolean;error:string|null;conflictDate:string|null;onSend:(date:string)=>Promise<boolean>;onClose:()=>void}){
  const insets=useSafeAreaInsets();
  const [mode,setMode]=useState<'choose'|'pick'>('choose'),[key,setKey]=useState<Key>('m1'),[picked,setPicked]=useState<string|null>(null),[month,setMonth]=useState<{year:number;month:number}|null>(null),[lastSent,setLastSent]=useState<string|null>(null);
  useEffect(()=>{if(visible){setMode('choose');setKey('m1');setPicked(null);setMonth(null);setLastSent(null);}},[visible]);
  const bounds=read?extensionBounds(read):null,choices=read?quickChoices(read):[],end=read?.currentEndDate??null;
  if(!visible||!read||!bounds||!end)return null;
  const newEnd=key==='custom'?picked:choices.find(c=>c.key===key)?.date??null;
  const clash=conflictDate&&newEnd&&newEnd===lastSent?SHEET.clash(conflictDate,end):null;
  const shownError=error&&!conflictDate?error:null;
  const send=async()=>{if(!newEnd||saving)return;setLastSent(newEnd);if(await onSend(newEnd))onClose();};
  const canSend=!!newEnd&&!saving&&!clash;
  const calendarMonthState=month??monthOf(picked??bounds.earliest);
  return <Modal visible transparent animationType="slide" onRequestClose={()=>{if(!saving)onClose();}}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.sheet}>
      <View accessible={false} style={styles.grab}/>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={ui.sectionTitle}>{mode==='choose'?SHEET.title:SHEET.pickTitle}</Text>
        {mode==='choose'?<View style={styles.options}>
          {choices.map(c=><Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`${c.label}, ${c.sub}`} accessibilityState={{selected:key===c.key}} disabled={saving} onPress={()=>{setKey(c.key);setLastSent(null);}} style={[styles.option,key===c.key&&styles.optionOn]}>
            <Text style={[styles.optionLabel,key===c.key&&styles.optionLabelOn]}>{c.label}</Text><Text style={ui.supporting}>{c.sub}</Text></Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel={SHEET.pick} accessibilityState={{selected:key==='custom'}} disabled={saving} onPress={()=>{setKey('custom');setMode('pick');}} style={[styles.option,key==='custom'&&styles.optionOn]}>
            <Text style={[styles.optionLabel,key==='custom'&&styles.optionLabelOn]}>{SHEET.pick}</Text></Pressable>
        </View>:<>
          <ExtensionCalendar bounds={bounds} selected={picked} month={calendarMonthState} onMonth={setMonth} onSelect={d=>{setPicked(d);setKey('custom');setLastSent(null);}}/>
          <Text style={ui.supporting}>{SHEET.range(bounds,end)}</Text>
        </>}
        <View style={styles.facts}>
          <View style={styles.fact}><Text style={ui.supporting}>{SHEET.newEnd}</Text><Text style={styles.factValue}>{newEnd?dateLabel(newEnd,end):'—'}</Text></View>
          <View style={styles.fact}><Text style={ui.supporting}>{SHEET.rent}</Text><Text style={styles.factValue}>{SHEET.rentStays(rent)}</Text></View>
        </View>
        {mode==='choose'?<Text style={ui.supporting}>{SHEET.agree(ownerName)}</Text>:null}
      </ScrollView>
      {/* The alerts and the two buttons are pinned under the scrolling part: Send request, and the reason it is off, are always in view at large text. */}
      <View style={[styles.footer,{paddingBottom:spacing.lg+insets.bottom}]}>
        {clash?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.clash}><Text style={styles.clashTitle}>{clash.title}</Text><Text style={ui.supporting}>{clash.body}</Text></View>:null}
        {shownError?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.clash}><Text style={styles.clashTitle}>{shownError}</Text></View>:null}
        <StatusButton tone="primary" label={saving?'Sending…':SHEET.send} disabled={!canSend} onPress={()=>void send()}/>
        {mode==='choose'?<StatusButton label={SHEET.notNow} disabled={saving} onPress={onClose}/>:<StatusButton label={SHEET.back} disabled={saving} onPress={()=>{setMode('choose');if(!picked)setKey('m1');}}/>}
      </View>
    </View></View></Modal>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},
  sheet:{maxHeight:'92%',paddingTop:spacing.md,paddingHorizontal:spacing.md,gap:spacing.sm,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:colors.background},body:{gap:spacing.sm,paddingBottom:spacing.xs},scroll:{flexGrow:0,flexShrink:1},footer:{gap:spacing.sm,paddingTop:spacing.xs},
  grab:{alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:colors.border},
  options:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},
  option:{flexGrow:1,flexBasis:'45%',minHeight:56,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,alignItems:'center',justifyContent:'center',borderRadius:radius.control,borderWidth:1.5,borderColor:colors.controlBorder,backgroundColor:colors.background},
  optionOn:{borderColor:colors.primaryAction,backgroundColor:colors.primaryPale},optionLabel:{...ui.body,fontWeight:'600'},optionLabelOn:{color:colors.primaryAction,fontWeight:'700'},
  facts:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},fact:{flexGrow:1,flexBasis:130,padding:spacing.sm,gap:2,borderRadius:radius.control,backgroundColor:colors.identitySurface},factValue:{...ui.body,fontWeight:'700'},
  clash:{padding:spacing.sm,gap:2,borderRadius:radius.control,borderWidth:1,borderColor:colors.restricted,backgroundColor:colors.restrictedSurface},clashTitle:{...ui.body,fontWeight:'700',color:colors.restricted},
});
