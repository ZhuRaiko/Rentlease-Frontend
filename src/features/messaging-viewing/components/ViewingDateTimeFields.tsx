import {useState} from 'react';
import {DateTimePickerAndroid} from '@react-native-community/datetimepicker';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {colors} from '../../../shared/theme/colors';
import {manilaParts,type ViewingDraft} from '../models/PropertyViewing';
/** Native picker edits calendar/wall-clock fields; the model converts Manila time to UTC. */
export function ViewingDateTimeFields({draft,onChange,disabled}:{draft:ViewingDraft;onChange:(p:Partial<ViewingDraft>)=>void;disabled:boolean}){
 const [error,setError]=useState<string|null>(null);
 const open=(field:'date'|'start'|'end')=>{if(disabled)return;setError(null);try{
 const today=manilaParts(new Date().toISOString()),time=(field==='end'?draft.end:draft.start)||today.time;
 const value=new Date(`${draft.date||today.date}T${time}:00+08:00`);
 DateTimePickerAndroid.open({value,timeZoneName:'Asia/Manila',mode:field==='date'?'date':'time',is24Hour:false,onValueChange:(_event,date)=>{const selected=manilaParts(date.toISOString());onChange({[field]:field==='date'?selected.date:selected.time});},onError:()=>setError('The date picker could not open. Please reopen this screen.')});
 }catch{setError('The date picker could not open. Check your Android development app.');}};
 return <View style={styles.fields}><Text style={ui.supporting}>All appointment times are Philippine time (Asia/Manila, UTC+8).</Text>{(['date','start','end'] as const).map(field=><Pressable key={field} accessibilityRole="button" accessibilityLabel={`Choose viewing ${field}`} accessibilityState={{disabled}} disabled={disabled} onPress={()=>open(field)} style={styles.field}><Text style={ui.body}>{field==='date'?'Date':field==='start'?'Start time':'End time'}</Text><Text style={ui.body}>{draft[field]||'Choose'}</Text></Pressable>)}{error?<Text accessibilityRole="alert" style={ui.supporting}>{error}</Text>:null}</View>;
}
const styles=StyleSheet.create({fields:{gap:10},field:{minHeight:48,borderColor:colors.controlBorder,borderWidth:1,borderRadius:10,padding:12,flexDirection:'row',justifyContent:'space-between',gap:12,flexWrap:'wrap'}});
