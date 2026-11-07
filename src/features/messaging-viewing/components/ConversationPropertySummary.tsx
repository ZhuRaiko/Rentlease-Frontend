import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {PropertyPhotoThumbnail} from '../../../shared/components/PropertyPhotoThumbnail';
import {FullscreenDocumentImage} from '../../../shared/components/FullscreenDocumentImage';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import type {ConversationProperty} from '../models/ConversationProperty';
export function ConversationPropertySummary({context,title,loading,error,onRetry,onViewListing}:{context?:ConversationProperty|undefined;title:string;loading:boolean;error:string|null;onRetry:()=>void;onViewListing?:((id:string)=>void)|undefined}){
 const [index,setIndex]=useState<number|null>(null),[failed,setFailed]=useState(false);const photos=context?.photos??[],photo=index===null?undefined:photos[index];
 return <View style={styles.section}><View style={styles.row}><PropertyPhotoThumbnail photos={photos} size={64} onPressPhoto={i=>{setFailed(false);setIndex(i);}}/><View style={styles.text}><Text numberOfLines={2} style={styles.title}>{context?.title??title}</Text>{context?.availability?<Text style={styles.status}>{context.availability}</Text>:null}{context?.canViewListing&&onViewListing?<Pressable accessibilityRole="button" onPress={()=>onViewListing(context.listingId)} style={styles.action}><Text style={styles.link}>View Listing</Text></Pressable>:null}</View></View>
 {loading?<Text style={ui.supporting}>Loading property information...</Text>:null}{error?<Pressable accessibilityRole="button" accessibilityLabel="Retry property information" onPress={onRetry} style={styles.action}><Text style={ui.supporting}>{error} Retry</Text></Pressable>:null}{context?.photoError&&!error?<Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}><Text style={ui.supporting}>Property photos could not load. Retry photos</Text></Pressable>:null}{!loading&&!error&&!context?<Text style={ui.supporting}>Listing details are unavailable. This conversation is still available.</Text>:null}
 <FullscreenDocumentImage visible={!!photo} uri={photo?.url??null} title="Property photo" error={failed?'This photo could not load. Try another photo or close the preview.':null} onImageError={()=>setFailed(true)} onClose={()=>setIndex(null)} {...(index!==null&&index>0?{onPrevious:()=>{setFailed(false);setIndex(index-1);}}:{})} {...(index!==null&&index<photos.length-1?{onNext:()=>{setFailed(false);setIndex(index+1);}}:{})}/>
 </View>;
}
const styles=StyleSheet.create({section:{gap:6},row:{flexDirection:'row',gap:12,alignItems:'center'},text:{flex:1,minWidth:0},title:{...ui.sectionTitle,fontSize:15},status:{...ui.supporting,color:colors.primaryAction},action:{minHeight:48,justifyContent:'center'},link:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'}});
