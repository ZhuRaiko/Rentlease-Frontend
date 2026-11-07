import * as ImagePicker from 'expo-image-picker';
import {File} from 'expo-file-system';
import {preparePublicAvatar,avatarByteLimit} from '../../../shared/models/PublicIdentity';
export interface IdentityPhoto {uri:string;width:number;height:number}
export const publicIdentityMedia={
 async pick():Promise<IdentityPhoto|null>{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)throw new Error('Allow photo access to choose a profile picture.');const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.85,exif:false,base64:false});if(result.canceled)return null;const photo=result.assets[0];if(!photo||photo.width<1||photo.height<1||photo.width>4096||photo.height>4096||(photo.fileSize??0)>avatarByteLimit)throw new Error('Choose a JPEG or PNG photo up to 3 MB and 4,096 pixels per side.');return{uri:photo.uri,width:photo.width,height:photo.height};},
 async prepare(photo:IdentityPhoto){const file=new File(photo.uri);if(file.size<1||file.size>avatarByteLimit)throw new Error('Choose a JPEG or PNG photo up to 3 MB.');return preparePublicAvatar(new Uint8Array(await file.arrayBuffer()));}
};
