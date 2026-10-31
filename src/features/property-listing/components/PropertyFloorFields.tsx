import {StyleSheet,Text,View} from 'react-native';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {colors} from '../../../shared/theme/colors';
import {propertyFloorConfiguration,type DraftProperty} from '../models/DraftProperty';
import type {PropertyFormFocus} from './usePropertyFormFocus';
import {ListingField} from './ListingControls';
interface Props {
  propertyType?:DraftProperty['propertyType'];floorNumber:string;totalFloors:string;editable?:boolean;focus?:PropertyFormFocus|undefined;
  errors:{floorNumber:string|null;totalFloors:string|null};
  onChange:(field:'floorNumber'|'totalFloors',value:string)=>void;
}
export function PropertyFloorFields({propertyType=null,floorNumber,totalFloors,editable=true,errors,onChange,focus}:Props) {
  const config=propertyFloorConfiguration(propertyType),message=[...new Set([errors.floorNumber,errors.totalFloors].filter(Boolean))].join(' ');
  return <View collapsable={false} ref={focus?.section('floors')} style={styles.section}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Property floor information</Text>
    <Text style={ui.supporting}>{config.example}</Text>
    <View style={styles.row}>
      {config.showFloor?<View style={styles.cell}><ListingField inputRef={focus?.field('floorNumber')} label={`${config.floorLabel} (optional)`} placeholder="e.g. 2" keyboardType="numeric" editable={editable} value={floorNumber} invalid={!!errors.floorNumber} onChangeText={value=>onChange('floorNumber',value)}/></View>:null}
      <View style={styles.cell}><ListingField inputRef={focus?.field('totalFloors')} label={`${config.totalLabel} (optional)`} placeholder={config.showFloor?'e.g. 5':'e.g. 2'} keyboardType="numeric" editable={editable} value={totalFloors} invalid={!!errors.totalFloors} onChangeText={value=>onChange('totalFloors',value)}/></View>
    </View>
    {!config.showFloor&&floorNumber.trim()?<Text style={ui.supporting}>Your previous rental floor entry is kept locally. It is not sent for a whole house.</Text>:null}
    {message?<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({section:{gap:spacing.sm},row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},cell:{flexGrow:1,flexBasis:130,minWidth:0},error:{...ui.supporting,color:colors.restricted}});
