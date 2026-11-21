import {StyleSheet,Text,TextInput,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {ButtonRow,Slot,StatusButton,StatusChip} from '../../../shared/components/StatusParts';
import {COPY,type RespondView} from '../models/TenancyMoveIn';

/**
 * The other person's "Move-in request" screen (boards 06, 07 and 08): who asks, the date now and the date asked for, what stays, an optional note that is sent only
 * with Decline, then Decline and Accept pinned below. A clash with another stay or a date that has already passed switches Accept off; Decline is always on. No
 * counter-offer. Each check line is ONE text run.
 */
export function MoveInRequestBody({view,property,note,onNote,saving}:{view:RespondView;property:string;note:string;onNote:(text:string)=>void;saving:boolean}){
  const bad=view.state!=='ok'&&view.alert;
  return <View style={styles.wrap}>
    {bad&&view.alert?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.card,styles.red]}>
      <Text accessibilityRole="header" style={styles.redTitle}>{view.alert.title}</Text>
      <Text style={ui.body}>{view.alert.body}</Text>
      <View style={styles.pills}><View style={styles.pill}><Text style={styles.pillText}>{view.alert.asked}</Text></View>{view.alert.first?<View style={[styles.pill,styles.pillRed]}><Text style={[styles.pillText,{color:colors.white}]}>{view.alert.first}</Text></View>:null}</View>
    </View>:<View style={[styles.card,styles.amber]}>
      <StatusChip chip={{label:COPY.needsOk,tone:'warning'}}/>
      <Text accessibilityRole="header" style={styles.title}>{view.headline}</Text>
      <Text style={[ui.body,{color:colors.warning}]}>{property}</Text>
    </View>}
    <View style={[styles.card,styles.white]}>
      <View style={styles.cells}>
        <View style={styles.cell}><Text style={ui.supporting}>{COPY.nowMovesIn}</Text><Text style={[styles.value,bad?undefined:styles.struck]}>{view.now}</Text></View>
        <View style={[styles.cell,bad?undefined:styles.cellBlue]}><Text style={[ui.supporting,bad?undefined:{color:colors.identityInk,fontWeight:'700'}]}>{COPY.asksToMoveIn}</Text><Text style={styles.value}>{view.asks}</Text></View>
      </View>
      {!bad?<>
        <Check text={`${view.moveOutLine} · ${view.longer}`}/>
        <Check text={view.rentLine}/>
      </>:null}
    </View>
    <View style={styles.noteBlock}>
      <Text style={ui.body}><Text style={styles.bold}>{COPY.noteLabel}</Text>{` ${COPY.noteOptional}`}</Text>
      <TextInput accessibilityLabel={`${COPY.noteLabel} ${COPY.noteOptional}`} placeholder={view.notePlaceholder} placeholderTextColor={colors.textMuted} multiline maxLength={1000} editable={!saving} value={note} onChangeText={onNote} style={[ui.control,ui.body,styles.input]}/>
    </View>
  </View>;
}
/** The pinned buttons: Decline (red outline) and Accept (green). Both stay at least 48dp tall and wrap below each other at large text. */
export function MoveInRequestActions({view,saving,onAccept,onDecline}:{view:RespondView;saving:boolean;onAccept:()=>void;onDecline:()=>void}){
  return <ButtonRow>
    <Slot><StatusButton tone="dangerOutline" label={saving?'Working…':COPY.decline} disabled={saving||!view.canDecline} onPress={onDecline}/></Slot>
    <Slot><StatusButton tone="primary" label={COPY.accept} disabled={saving||!view.canAccept} onPress={onAccept}/></Slot>
  </ButtonRow>;
}
function Check({text}:{text:string}){return <View style={styles.check}><Text accessible={false} style={styles.tick}>✓</Text><Text style={[ui.body,styles.checkText]}>{text}</Text></View>;}
const styles=StyleSheet.create({
  wrap:{gap:spacing.sm},card:{padding:spacing.md,gap:spacing.sm,borderRadius:radius.card,borderWidth:1},
  amber:{borderColor:colors.warning,backgroundColor:colors.warningSurface},red:{borderColor:colors.restricted,backgroundColor:colors.restrictedSurface},white:{borderColor:colors.outline,backgroundColor:colors.background},
  title:{...ui.sectionTitle,fontWeight:'700'},redTitle:{...ui.sectionTitle,fontWeight:'700',color:colors.restricted},
  pills:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},pill:{paddingHorizontal:spacing.sm,paddingVertical:spacing.xxs,borderRadius:radius.pill,backgroundColor:colors.white},pillRed:{backgroundColor:colors.restricted},pillText:{...ui.supporting,fontWeight:'700',color:colors.ink},
  cells:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},cell:{flexGrow:1,flexShrink:1,flexBasis:130,padding:spacing.sm,gap:2,borderRadius:radius.control,backgroundColor:colors.canvas},cellBlue:{backgroundColor:colors.identitySurface},
  value:{...ui.sectionTitle,fontWeight:'700'},struck:{color:colors.textSecondary,textDecorationLine:'line-through'},
  check:{flexDirection:'row',alignItems:'flex-start',gap:spacing.xs},tick:{...ui.body,fontWeight:'700',color:colors.primaryAction},checkText:{flex:1,flexShrink:1},
  noteBlock:{gap:spacing.xs},bold:{fontWeight:'700'},input:{paddingHorizontal:12,paddingVertical:10,minHeight:96,textAlignVertical:'top',backgroundColor:colors.background},
});
