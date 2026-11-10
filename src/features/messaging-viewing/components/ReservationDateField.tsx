import {useState} from 'react';
import {DateTimePickerAndroid} from '@react-native-community/datetimepicker';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {philippineDate,reservationDateLabel} from '../models/RentalReservation';
export function ReservationDateField({value,onChange,disabled}:{value:string;onChange:(date:string)=>void;disabled:boolean}){
 const [error,setError]=useState<string|null>(null);
 const open=()=>{if(disabled)return;setError(null);try{DateTimePickerAndroid.open({value:new Date(`${value||philippineDate()}T12:00:00+08:00`),mode:'date',timeZoneName:'Asia/Manila',onValueChange:(_event,date)=>onChange(philippineDate(date.getTime())),onError:()=>setError('The calendar could not open. Reopen this screen and try again.')});}catch{setError('The calendar could not open. Check your Android development app.');}};
 return <View style={styles.group}><Text style={ui.body}>Preferred move-in date (Philippine time)</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose preferred move-in date" disabled={disabled} accessibilityState={{disabled}} style={styles.field} onPress={open}><Text style={ui.body}>{value?reservationDateLabel(value):'Choose date'}</Text></Pressable>{error?<Text accessibilityRole="alert" style={ui.supporting}>{error}</Text>:null}</View>;
}
const styles=StyleSheet.create({group:{gap:8},field:{minHeight:48,borderWidth:1,borderColor:colors.controlBorder,borderRadius:10,padding:12,justifyContent:'center'}});
