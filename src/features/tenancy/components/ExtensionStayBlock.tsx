import {StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusButton,StatusChip} from '../../../shared/components/StatusParts';
import {SHEET,type TenantExtensionView} from '../models/TenancyExtension';

/**
 * The tenant's part of the stay card on tenancy details (v11 screens 1, 5 and 6): "Ask to extend", or Waiting with Cancel request, or the
 * Extended line. Nothing at all for a tenancy that is not active, while an early-end request is pending, or when the feature could not be read.
 */
export function ExtensionStayBlock({view,saving,notice,error,onAsk,onCancel}:{view:TenantExtensionView;saving:boolean;notice:string|null;error:string|null;onAsk:()=>void;onCancel:()=>void}){
  if(view.state==='hidden')return null;
  return <View style={styles.wrap}>
    {view.state==='waiting'?<View style={styles.waiting}>
      {view.chip?<StatusChip chip={view.chip}/>:null}
      {view.headline?<Text style={styles.headline}>{view.headline}</Text>:null}
      {view.body?<Text style={ui.supporting}>{view.body}</Text>:null}
      {view.canCancel?<StatusButton label={SHEET.cancel} disabled={saving} onPress={onCancel}/>:null}
    </View>:null}
    {view.state==='extended'?<View style={styles.extended}>{view.chip?<StatusChip chip={view.chip}/>:null}{view.headline?<Text style={styles.headline}>{view.headline}</Text>:null}</View>:null}
    {view.state==='declined'?<View style={styles.note}>{view.headline?<Text style={styles.headline}>{view.headline}</Text>:null}{view.body?<Text style={ui.supporting}>{view.body}</Text>:null}</View>:null}
    {notice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{notice}</Text>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    {view.canAsk?<StatusButton label={SHEET.ask} disabled={saving} onPress={onAsk}/>:null}
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:spacing.xs},
  waiting:{padding:spacing.sm,gap:spacing.xs,borderRadius:radius.control,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},
  extended:{padding:spacing.sm,gap:spacing.xs,borderRadius:radius.control,borderWidth:1,borderColor:colors.primaryAction,backgroundColor:colors.primaryPale},
  note:{padding:spacing.sm,gap:2,borderRadius:radius.control,backgroundColor:colors.surface},
  headline:{...ui.body,fontWeight:'700'},error:{...ui.supporting,color:colors.restricted,fontWeight:'600'},
});
