import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {calendarMonth,dateLabel,shiftMonth} from '../models/TenancyExtension';

const WEEKDAYS=['S','M','T','W','T','F','S'];
/** A plain month grid. Only days inside the window can be pressed; every other day is drawn greyed and is not a button. Cells are 48dp tall. */
export function ExtensionCalendar({bounds,selected,month,onMonth,onSelect}:{bounds:{earliest:string;latest:string};selected:string|null;month:{year:number;month:number};onMonth:(m:{year:number;month:number})=>void;onSelect:(date:string)=>void}){
  const cal=calendarMonth(month,bounds,selected);
  return <View style={styles.wrap}>
    <View style={styles.head}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{disabled:!cal.hasEarlier}} disabled={!cal.hasEarlier} onPress={()=>onMonth(shiftMonth(month,-1))} style={[styles.nav,!cal.hasEarlier&&styles.off]}><Text style={styles.navText}>‹</Text></Pressable>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{cal.title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{disabled:!cal.hasLater}} disabled={!cal.hasLater} onPress={()=>onMonth(shiftMonth(month,1))} style={[styles.nav,!cal.hasLater&&styles.off]}><Text style={styles.navText}>›</Text></Pressable>
    </View>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.row}>{WEEKDAYS.map((d,i)=><Text key={i} style={styles.weekday}>{d}</Text>)}</View>
    {cal.weeks.map((week,w)=><View key={w} style={styles.row}>{week.map((cell,i)=>cell
      ?cell.enabled
        ?<Pressable key={i} accessibilityRole="button" accessibilityLabel={dateLabel(cell.date,bounds.earliest)} accessibilityState={{selected:cell.selected}} onPress={()=>onSelect(cell.date)} style={[styles.cell,cell.selected&&styles.selected]}><Text style={[styles.day,cell.selected&&styles.daySelected]}>{cell.day}</Text></Pressable>
        :<View key={i} accessible={false} style={styles.cell}><Text style={[styles.day,styles.dayOff]}>{cell.day}</Text></View>
      :<View key={i} style={styles.cell}/>)}</View>)}
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:spacing.xxs},head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nav:{width:48,height:48,alignItems:'center',justifyContent:'center'},navText:{...ui.sectionTitle,color:colors.primaryAction},off:{opacity:0.3},
  title:{...ui.body,fontWeight:'700',flexShrink:1,textAlign:'center'},row:{flexDirection:'row'},weekday:{flex:1,textAlign:'center',...ui.supporting},
  cell:{flex:1,height:48,alignItems:'center',justifyContent:'center',borderRadius:radius.control},selected:{backgroundColor:colors.primaryAction},
  day:{...ui.body},daySelected:{color:colors.white,fontWeight:'700'},dayOff:{color:colors.textMuted},
});
