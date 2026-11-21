import {useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusButton} from '../../../shared/components/StatusParts';
import {dateLabel,monthOf} from '../models/TenancyExtension';
import {COPY,inMoveInBounds,weekdayDate,type SheetView} from '../models/TenancyMoveIn';
import {ExtensionCalendar} from './ExtensionCalendar';

/**
 * "When do you want to move in?" (boards 02, 03 and 05). Today or Pick a date, what changes and what does not, and Send request. The calendar only lets today
 * through the day before the current move-in be picked. When a send could not be confirmed, the sheet shows that state instead: Try again repeats the SAME
 * request (same operation id), Check status reads again. Each check line is ONE text run. A clash (23P01) stays on the sheet and Send stays off until the date changes.
 */
export function MoveInSheet({visible,view,start,saving,error,conflictDate,unconfirmed,onSend,onRetry,onCheck,onClose}:{visible:boolean;view:SheetView|null;/** The current move-in (for labels). */start:string|null;saving:boolean;error:string|null;conflictDate:string|null;
  /** The date of a request whose outcome is unknown, or null. */unconfirmed:string|null;onSend:(date:string)=>Promise<boolean>;onRetry:()=>Promise<boolean>;onCheck:()=>Promise<boolean>;onClose:()=>void}){
  const insets=useSafeAreaInsets();
  const [mode,setMode]=useState<'choose'|'pick'>('choose'),[useToday,setUseToday]=useState(true),[picked,setPicked]=useState<string|null>(null),[month,setMonth]=useState<{year:number;month:number}|null>(null),[lastSent,setLastSent]=useState<string|null>(null);
  useEffect(()=>{if(visible){setMode('choose');setUseToday(true);setPicked(null);setMonth(null);setLastSent(null);}},[visible]);
  if(!visible||!view||!start)return null;
  const newDate=useToday?view.today.date:picked,valid=!!newDate&&inMoveInBounds(newDate,view.bounds);
  const clash=conflictDate&&newDate&&newDate===lastSent?`Another stay starts ${dateLabel(conflictDate,start)}. Pick an earlier date.`:null;
  const shownError=error&&!conflictDate?error:null;
  const send=async()=>{if(!newDate||saving)return;setLastSent(newDate);if(await onSend(newDate))onClose();};
  const retry=async()=>{if(await onRetry())onClose();};
  // Check status closes the sheet only when it finds the request went through.
  const check=async()=>{if(await onCheck())onClose();};
  const canSend=valid&&!saving&&!clash;
  const calendarMonth=month??monthOf(picked??view.bounds.earliest);
  return <Modal visible transparent animationType="slide" onRequestClose={()=>{if(!saving)onClose();}}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.sheet}>
      <View accessible={false} style={styles.grab}/>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[ui.sectionTitle,styles.titleText]}>{unconfirmed?COPY.sheetTitle:mode==='choose'?COPY.sheetTitle:COPY.pickTitle}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" accessibilityState={{disabled:saving}} disabled={saving} onPress={onClose} style={styles.close}><Text accessible={false} style={styles.closeText}>✕</Text></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {unconfirmed?<>
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.unconfirmed}><Text style={styles.unconfirmedTitle}>{COPY.uncertainTitle}</Text><Text style={ui.supporting}>{COPY.uncertainText}</Text></View>
          <View style={styles.request}><Text style={ui.body}>{COPY.yourRequest(weekdayDate(unconfirmed))}</Text></View>
        </>:<>
          {mode==='choose'?<View style={styles.options}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${COPY.today}, ${view.today.sub}`} accessibilityState={{selected:useToday}} disabled={saving} onPress={()=>{setUseToday(true);setLastSent(null);}} style={[styles.option,useToday&&styles.optionOn]}>
              <Text style={[styles.optionLabel,useToday&&styles.optionLabelOn]}>{COPY.today}</Text><Text style={ui.supporting}>{view.today.sub}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${COPY.pick}, ${view.pickSub}`} accessibilityState={{selected:!useToday}} disabled={saving} onPress={()=>{setUseToday(false);setMode('pick');}} style={[styles.option,!useToday&&styles.optionOn]}>
              <Text style={[styles.optionLabel,!useToday&&styles.optionLabelOn]}>{`${COPY.pick} ›`}</Text><Text style={ui.supporting}>{view.pickSub}</Text></Pressable>
          </View>:<>
            <ExtensionCalendar bounds={view.bounds} selected={picked} month={calendarMonth} onMonth={setMonth} onSelect={d=>{setPicked(d);setUseToday(false);setLastSent(null);}}/>
            <Text style={ui.supporting}>{view.range}</Text>
          </>}
          <View style={styles.summary}>
            <View style={styles.compare}>
              <View style={styles.cell}><Text style={ui.supporting}>{COPY.nowMovesIn}</Text><Text style={styles.struck}>{shortOrDash(start,start)}</Text></View>
              <Text accessible={false} style={styles.arrow}>→</Text>
              <View style={styles.cell}><Text style={styles.newLabel}>{COPY.newMoveIn}</Text><Text style={styles.newValue}>{newDate?dateLabel(newDate,start):'—'}</Text></View>
            </View>
            <View style={styles.rule}/>
            <Check text={view.moveOutLine}/>
            <Check text={view.rentLine}/>
          </View>
          <Text style={ui.body}>{view.agree}</Text>
        </>}
      </ScrollView>
      <View style={[styles.footer,{paddingBottom:spacing.lg+insets.bottom}]}>
        {clash?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.clash}><Text style={styles.clashTitle}>{clash}</Text></View>:null}
        {shownError?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.clash}><Text style={styles.clashTitle}>{shownError}</Text></View>:null}
        {unconfirmed?<>
          <StatusButton tone="primary" label={saving?'Sending…':COPY.retry} disabled={saving} onPress={()=>void retry()}/>
          <StatusButton label={COPY.check} disabled={saving} onPress={()=>void check()}/>
        </>:<>
          <StatusButton tone="primary" label={saving?'Sending…':COPY.send} disabled={!canSend} onPress={()=>void send()}/>
          {mode==='pick'?<StatusButton label={COPY.back} disabled={saving} onPress={()=>{setMode('choose');if(!picked)setUseToday(true);}}/>:null}
        </>}
      </View>
    </View></View></Modal>;
}
const shortOrDash=(d:string|null,ref:string|null)=>d?dateLabel(d,ref):'—';
/** One check line: the mark and the whole sentence as a single text run, so nothing is split into separately spaced pieces. */
function Check({text}:{text:string}){return <View style={styles.check}><Text accessible={false} style={styles.tick}>✓</Text><Text style={[ui.body,styles.checkText]}>{text}</Text></View>;}
const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},
  sheet:{maxHeight:'92%',paddingTop:spacing.md,paddingHorizontal:spacing.md,gap:spacing.sm,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:colors.background},
  grab:{alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:colors.border},
  titleRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm},titleText:{flex:1,flexShrink:1},close:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},closeText:{...ui.body,fontWeight:'700'},
  scroll:{flexGrow:0,flexShrink:1},body:{gap:spacing.sm,paddingBottom:spacing.xs},footer:{gap:spacing.sm,paddingTop:spacing.xs},
  options:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},
  option:{flexGrow:1,flexBasis:'45%',minHeight:64,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,justifyContent:'center',gap:2,borderRadius:radius.card,borderWidth:1.5,borderColor:colors.outline,backgroundColor:colors.background},
  optionOn:{borderColor:colors.primaryAction,backgroundColor:colors.primaryPale},optionLabel:{...ui.body,fontWeight:'700'},optionLabelOn:{color:colors.primaryAction},
  summary:{padding:spacing.md,gap:spacing.sm,borderRadius:radius.card,backgroundColor:colors.canvas},
  compare:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.xs},cell:{flexGrow:1,flexShrink:1,flexBasis:110,gap:2},arrow:{...ui.sectionTitle,color:colors.controlBorder},
  struck:{...ui.body,fontWeight:'700',color:colors.textSecondary,textDecorationLine:'line-through'},newLabel:{...ui.supporting,fontWeight:'700',color:colors.primaryAction},newValue:{...ui.pageTitle,color:colors.ink},
  rule:{height:1,backgroundColor:colors.outline},check:{flexDirection:'row',alignItems:'flex-start',gap:spacing.xs},tick:{...ui.body,fontWeight:'700',color:colors.primaryAction},checkText:{flex:1,flexShrink:1},
  unconfirmed:{padding:spacing.md,gap:spacing.xxs,borderRadius:radius.card,borderWidth:1,borderColor:colors.outline,backgroundColor:colors.surface},unconfirmedTitle:{...ui.sectionTitle,fontWeight:'700'},
  request:{padding:spacing.sm,borderRadius:radius.control,backgroundColor:colors.canvas},
  clash:{padding:spacing.sm,gap:2,borderRadius:radius.control,borderWidth:1,borderColor:colors.restricted,backgroundColor:colors.restrictedSurface},clashTitle:{...ui.body,fontWeight:'700',color:colors.restricted},
});
