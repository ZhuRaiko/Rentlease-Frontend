import { useState } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { spacing } from '../../../shared/theme/spacing';
import { availabilityDateFromLocal, availabilityDateLabel, availabilityDateToLocal } from '../models/AvailabilityDate';

export function AvailabilityDateField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [error,setError]=useState<string | null>(null);
  const open=()=>{
    if(disabled)return;
    setError(null);
    try {
      DateTimePickerAndroid.open({value:availabilityDateToLocal(value)??new Date(),mode:'date',
        onValueChange:(_event,date)=>onChange(availabilityDateFromLocal(date)),
        onError:()=>setError('The calendar could not open. Check that your development app includes the date picker.')});
    } catch { setError('The calendar could not open. Check that your development app includes the date picker.'); }
  };
  return <View style={styles.group}>
    <Text style={ui.body}>Available from (optional)</Text>
    <Pressable disabled={disabled} accessibilityState={{disabled}} accessibilityRole="button" accessibilityLabel={value?`Change availability date, ${availabilityDateLabel(value)}`:'Select availability date'} onPress={open} style={styles.control}>
      <Text style={styles.value}>{availabilityDateLabel(value)}</Text><View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.calendar}><View style={styles.calendarBar}/><Text style={styles.calendarDay}>···</Text></View>
    </Pressable>
    {value?<Pressable disabled={disabled} accessibilityState={{disabled}} accessibilityRole="button" accessibilityLabel="Clear availability date" style={styles.clear} onPress={()=>{setError(null);onChange('');}}><Text style={styles.clearText}>Clear date</Text></Pressable>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({group:{gap:spacing.xs},control:{minHeight:48,borderWidth:1,borderColor:colors.controlBorder,borderRadius:8,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm},value:{...ui.body,flex:1,flexShrink:1},calendar:{width:22,height:22,borderWidth:1.5,borderColor:colors.primaryAction,borderRadius:3,alignItems:'center'},calendarBar:{height:5,alignSelf:'stretch',borderBottomWidth:1.5,borderColor:colors.primaryAction},calendarDay:{fontSize:14,lineHeight:14,color:colors.primaryAction},clear:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},clearText:{...ui.body,color:colors.primaryAction},error:{...ui.supporting,color:colors.restricted}});
