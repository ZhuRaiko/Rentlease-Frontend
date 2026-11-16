import {ActivityIndicator,Pressable,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {ButtonRow,Slot,StatusButton,StatusChip} from '../../../shared/components/StatusParts';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {DisputeSheet} from '../components/DisputeSheet';
import {bannerText,ledgerSummary,monthShort,roleOf,rowChip,rowLine,rowTitle,RULE_LINE,type RentRow} from '../models/RentLedger';
import type {RentLedgerViewModel} from '../viewModels/useRentLedgerViewModel';

/**
 * The rent ledger screen body: month rows (horizon month on top), the landlord's waiting banner, and the rule line. Buttons come from
 * the row flags the server computed for this person. Everything is disabled while a write is in flight, so a tap cannot be doubled.
 */
export function RentLedgerPanel({accountId,counterpart,hasConversation,rent}:{accountId:string|undefined;counterpart:string;hasConversation:boolean;rent:RentLedgerViewModel}){
  const {width,fontScale}=useWindowDimensions(),stacked=fontScale>=1.3||width<340;
  const l=rent.ledger,role=l&&accountId?roleOf(l,accountId):null,locked=rent.saving||rent.busy,now=Date.now();
  const w=rent.workflow;
  const awaitingRow=l?.awaiting?rent.rows.find(r=>r.dueDate===l.awaiting!.dueDate):undefined;
  const banner=awaitingRow&&role==='landlord'?bannerText(awaitingRow,counterpart):null;
  const rowActions=(r:RentRow)=>{
    if(role==='tenant'&&r.canMarkPaid)return <StatusButton label="I've paid" accessibilityLabel={`I've paid for ${monthShort(r.dueDate)}`} disabled={locked} onPress={()=>void w.act('mark_paid',r.dueDate)}/>;
    // The waiting banner carries Mark received / Not received; rows only add Mark received where there is no tenant statement to answer (cash months, or a checked month).
    if(role==='landlord'&&r.canAcknowledge&&r.status!=='tenant_marked_paid')return <StatusButton label="Mark received" accessibilityLabel={`Mark received for ${monthShort(r.dueDate)}`} disabled={locked} onPress={()=>void w.act('acknowledge',r.dueDate)}/>;
    return null;
  };
  return <View style={styles.wrap}>
    {rent.busy&&!rent.ready?<ActivityIndicator accessibilityLabel="Loading the rent ledger" color={colors.primaryAction}/>:null}
    {rent.error&&!rent.dispute?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.amber}><Text style={styles.amberText}>{rent.error}</Text>
      {rent.pending?<Pressable accessibilityRole="button" accessibilityLabel="Retry" disabled={locked} onPress={()=>void w.retry()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
        :!rent.ready?<Pressable accessibilityRole="button" accessibilityLabel="Retry loading the rent ledger" disabled={locked} onPress={()=>void w.load()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>:null}</View>:null}
    {rent.chat?.error?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.amber}><Text style={styles.amberText}>{rent.chat.error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry sending the message" disabled={rent.chat.sending} onPress={()=>void w.retryChat()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>:null}
    {rent.notice?<Text accessibilityLiveRegion="polite" style={styles.notice}>{rent.notice}</Text>:null}
    {l&&role?<>
      <View style={styles.card}>
        <View style={styles.head}><Text accessibilityRole="header" style={ui.sectionTitle}>Rent ledger</Text><Text style={ui.supporting}>{ledgerSummary(l)}</Text></View>
        {rent.rows.length?rent.rows.map((r,i)=>{const chip=rowChip(r,role,counterpart),action=rowActions(r);return <View key={r.dueDate} style={[styles.row,i>0&&styles.rowDivider]}>
          <View style={styles.rowMain}>
            <Text style={styles.month}>{monthShort(r.dueDate)}</Text>
            <View style={styles.rowText}><Text style={ui.body}>{rowTitle(r)}</Text><Text style={ui.supporting}>{rowLine(r,role,counterpart,now)}</Text>{stacked?<StatusChip chip={chip}/>:null}</View>
            {stacked?null:<StatusChip chip={chip}/>}
          </View>
          {action}
        </View>;}):<Text style={ui.supporting}>No rent months are due yet.</Text>}
        {l.hasMore?<StatusButton label="Show older" disabled={locked} onPress={()=>void w.older()}/>:null}
      </View>
      {banner?<View style={styles.banner}>
        <Text accessibilityRole="header" style={styles.bannerTitle}>{banner.title}</Text>
        <Text style={styles.bannerBody}>{banner.body}</Text>
        <ButtonRow>
          <Slot><StatusButton tone="primary" label="Mark received" disabled={locked||!awaitingRow?.canAcknowledge} onPress={()=>void w.act('acknowledge',awaitingRow!.dueDate)}/></Slot>
          <Slot><StatusButton label="Not received" disabled={locked||!awaitingRow?.canDispute} onPress={()=>w.openDispute(awaitingRow!.dueDate)}/></Slot>
        </ButtonRow>
      </View>:null}
    </>:null}
    <View style={styles.rule}><Text accessible={false} style={styles.info}>i</Text><Text style={[ui.supporting,styles.ruleText]}>{RULE_LINE}</Text></View>
    <DisputeSheet dueDate={rent.dispute?.dueDate??null} name={counterpart} hasConversation={hasConversation} saving={rent.saving} error={rent.error} canRetry={!!rent.pending} onConfirm={()=>void w.confirmDispute()} onRetry={()=>void w.retry()} onCancel={w.closeDispute}/>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:spacing.md},
  card:{...ui.panel,padding:spacing.md,gap:spacing.sm,borderRadius:16},head:{flexDirection:'row',flexWrap:'wrap',alignItems:'baseline',justifyContent:'space-between',gap:spacing.xs},
  row:{gap:spacing.xs,paddingVertical:spacing.sm},rowDivider:{borderTopWidth:1,borderTopColor:colors.outline},
  rowMain:{flexDirection:'row',alignItems:'center',gap:spacing.sm},month:{...ui.body,width:44,fontWeight:'500'},rowText:{flex:1,minWidth:0,gap:2},
  banner:{padding:spacing.md,gap:spacing.sm,borderRadius:16,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},bannerTitle:{...ui.sectionTitle,color:colors.warning},bannerBody:{...ui.body,color:colors.warning},
  amber:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm,paddingLeft:spacing.sm,borderRadius:radius.control,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},
  amberText:{...ui.supporting,flexGrow:1,flexShrink:1,flexBasis:140,color:colors.warning,fontWeight:'600'},retry:{minHeight:48,minWidth:48,paddingHorizontal:spacing.sm,alignItems:'center',justifyContent:'center'},retryText:{...ui.supporting,color:colors.primaryAction,fontWeight:'700',textDecorationLine:'underline'},
  notice:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
  rule:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm,padding:spacing.md,borderRadius:16,borderWidth:1,borderColor:colors.outline,backgroundColor:colors.surface},
  info:{...ui.body,width:22,height:22,textAlign:'center',lineHeight:22,fontWeight:'700',color:colors.textSecondary,borderWidth:1.5,borderColor:colors.textSecondary,borderRadius:11,overflow:'hidden'},ruleText:{flex:1,minWidth:0},
});
