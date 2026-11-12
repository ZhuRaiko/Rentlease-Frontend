import {HeartIcon} from '../../../shared/components/HeartIcon';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {AppButton} from '../../../shared/components/AppButton';
export interface SaveControl {saved:boolean|undefined;busy:boolean;locked:boolean;retry:boolean;desired:boolean|undefined;onPress:()=>void}
export function SaveListingButton({control}:{control:SaveControl}){const disabled=control.busy||control.locked||control.saved===undefined&&!control.retry;
 const label=control.retry?(control.desired?'Retry saving listing':'Retry removing saved listing'):control.saved?'Remove from Saved Listings':control.saved===false?'Save listing':'Checking saved status';
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:control.saved===true,disabled,busy:control.busy}} disabled={disabled} onPress={control.onPress} style={{minWidth:48,minHeight:48,padding:10,alignItems:'center',justifyContent:'center',borderRadius:24,backgroundColor:colors.background}}>{control.busy?<ActivityIndicator color={colors.primaryAction}/>:control.retry?<Text accessible={false} style={{fontSize:24,color:colors.primaryAction}}>{'\u21bb'}</Text>:<HeartIcon filled={control.saved===true} color={disabled?colors.textMuted:control.saved?colors.primaryAction:colors.ink}/>}</Pressable>;
}
export function SavedListingsFeedback({error,notice,pending,busy,onRetry}:{error:string|null;notice:string|null;pending:boolean;busy:boolean;onRetry:()=>void}){return <View style={{gap:6}}>{error?<Text accessibilityRole="alert" style={ui.supporting}>{error}</Text>:null}{notice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{notice}</Text>:null}{error?<AppButton label={pending?'Retry same bookmark action':'Retry saved status'} variant="secondary" disabled={busy} onPress={onRetry}/>:null}</View>;}
