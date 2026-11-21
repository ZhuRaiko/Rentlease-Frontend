import {ActivityIndicator,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {ButtonRow,Slot,StatusButton} from '../../../shared/components/StatusParts';
import {COPY,LOAD_ERROR,type MoveInBanner as Banner} from '../models/TenancyMoveIn';

/**
 * What the move-in request looks like on the Tenancy setup screen (boards 04, 09, 10 and 11): the amber "Waiting for <name>" card with Withdraw request, the green
 * "Move-in moved to <date>" card, and the "<name> declined" card with the note. Colors are existing theme tokens; the marks are decoration, so they are hidden from
 * screen readers (the text says everything).
 */
export function MoveInBanner({banner,saving,onWithdraw}:{banner:Banner;saving:boolean;onWithdraw:()=>void}){
  if(banner.kind==='waiting')return <View accessibilityLiveRegion="polite" style={[styles.card,styles.waiting]}>
    <View style={styles.head}><View accessible={false} style={[styles.mark,styles.markWhite]}><Text style={[styles.glyph,{color:colors.warning}]}>◔</Text></View>
      <View style={styles.grow}><Text style={styles.waitingTitle}>{banner.title}</Text><Text style={styles.headline}>{banner.headline}</Text></View></View>
    <Text style={[ui.body,{color:colors.warning}]}>{banner.body}</Text>
    {banner.canWithdraw?<View style={styles.alignStart}><StatusButton label={COPY.withdraw} disabled={saving} onPress={onWithdraw}/></View>:null}
  </View>;
  if(banner.kind==='accepted')return <View accessibilityLiveRegion="polite" style={[styles.card,styles.accepted]}>
    <View style={styles.head}><View accessible={false} style={[styles.mark,{backgroundColor:colors.primaryAction}]}><Text style={[styles.glyph,{color:colors.white}]}>✓</Text></View>
      <View style={styles.grow}><Text style={[styles.headline,{color:colors.primaryAction}]}>{banner.headline}</Text><Text style={[ui.body,{color:colors.primaryAction}]}>{banner.body}</Text></View></View>
  </View>;
  return <View accessibilityLiveRegion="polite" style={[styles.card,styles.declined]}>
    <View style={styles.head}><View accessible={false} style={[styles.mark,styles.markWhite]}><Text style={[styles.glyph,{color:colors.ink}]}>✕</Text></View>
      <View style={styles.grow}><Text style={styles.headline}>{banner.headline}</Text></View></View>
    {banner.note?<View style={styles.quote}><Text style={ui.body}>{`“${banner.note}”`}</Text></View>:null}
    <Text style={ui.supporting}>{banner.body}</Text>
  </View>;
}

/**
 * Everything that is not a result: the quiet loading line, the plain message when the details could not be read (with Reload), a refusal, a notice, and the
 * "we could not confirm it went through" alert with Try again (the SAME operation id) and Check status.
 */
export function MoveInStatusBlock({loading,loadFailed,error,notice,uncertain,saving,onReload,onRetry,onCheck}:{loading:boolean;loadFailed:boolean;error:string|null;notice:string|null;uncertain:boolean;saving:boolean;onReload:()=>void;onRetry:()=>void;onCheck:()=>void}){
  if(!loading&&!loadFailed&&!error&&!notice&&!uncertain)return null;
  return <View style={styles.stack}>
    {loading?<View accessibilityLiveRegion="polite" style={styles.loading}><ActivityIndicator accessibilityLabel={COPY.loading} color={colors.primaryAction}/><Text style={[ui.supporting,styles.grow]}>{COPY.loading}</Text></View>:null}
    {loadFailed?<View accessibilityRole="alert" style={[styles.card,styles.alert]}><Text style={styles.alertTitle}>{LOAD_ERROR}</Text><StatusButton label={COPY.reload} disabled={saving} onPress={onReload}/></View>:null}
    {uncertain?<View accessibilityRole="alert" style={[styles.card,styles.alert]}><Text style={styles.alertTitle}>{COPY.uncertainTitle}</Text><Text style={ui.supporting}>{COPY.uncertainText}</Text>
      <ButtonRow><Slot><StatusButton tone="primary" label={COPY.retry} disabled={saving} onPress={onRetry}/></Slot><Slot><StatusButton label={COPY.check} disabled={saving} onPress={onCheck}/></Slot></ButtonRow></View>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    {notice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{notice}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:spacing.xs},grow:{flex:1,flexShrink:1,gap:2},alignStart:{alignSelf:'flex-start'},
  card:{padding:spacing.md,gap:spacing.sm,borderRadius:radius.card,borderWidth:1},
  waiting:{borderColor:colors.warning,backgroundColor:colors.warningSurface},accepted:{borderColor:colors.primaryAction,backgroundColor:colors.primaryPale},declined:{borderColor:colors.border,backgroundColor:colors.surface},
  alert:{borderColor:colors.restricted,backgroundColor:colors.restrictedSurface},alertTitle:{...ui.body,fontWeight:'700',color:colors.restricted},
  head:{flexDirection:'row',alignItems:'center',gap:spacing.sm},mark:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},markWhite:{backgroundColor:colors.white},glyph:{...ui.sectionTitle,fontWeight:'700'},
  waitingTitle:{...ui.supporting,fontWeight:'700',color:colors.warning},headline:{...ui.sectionTitle,fontWeight:'700'},quote:{padding:spacing.sm,borderRadius:radius.control,backgroundColor:colors.white},
  loading:{flexDirection:'row',alignItems:'center',gap:spacing.sm},error:{...ui.supporting,color:colors.restricted,fontWeight:'600'},
});
