import {YourListingLabel} from './YourListingLabel';
import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {PropertyPhotoThumbnail} from '../../../shared/components/PropertyPhotoThumbnail';
import {FullscreenDocumentImage} from '../../../shared/components/FullscreenDocumentImage';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import type {ConversationProperty} from '../models/ConversationProperty';
/**
 * The property block in Chat. `defaultCollapsed` shows ONE compact row (thumbnail, title, status) that expands on tap; `compact` (keyboard open)
 * shrinks it to a single title line. With neither, the full block shows, as before.
 */
export function ConversationPropertySummary({context,title,loading,error,onRetry,onViewListing,defaultCollapsed=false,compact=false}:{context?:ConversationProperty|undefined;title:string;loading:boolean;error:string|null;onRetry:()=>void;onViewListing?:((id:string)=>void)|undefined;defaultCollapsed?:boolean;compact?:boolean}){
 const [index,setIndex]=useState<number|null>(null),[failed,setFailed]=useState(false),[expanded,setExpanded]=useState(!defaultCollapsed);const photos=context?.photos??[],photo=index===null?undefined:photos[index],name=context?.title??title;
 const gallery=<FullscreenDocumentImage visible={!!photo} uri={photo?.url??null} title="Property photo" error={failed?'This photo could not load. Try another photo or close the preview.':null} onImageError={()=>setFailed(true)} onClose={()=>setIndex(null)} {...(index!==null&&index>0?{onPrevious:()=>{setFailed(false);setIndex(index-1);}}:{})} {...(index!==null&&index<photos.length-1?{onNext:()=>{setFailed(false);setIndex(index+1);}}:{})}/>;
 if(compact)return <View style={styles.section}><Text style={styles.title}>{name}</Text>{gallery}</View>;
 const open=!defaultCollapsed||expanded;
 return <View style={styles.section}><View style={styles.row}><PropertyPhotoThumbnail photos={photos} size={open?64:48} onPressPhoto={i=>{setFailed(false);setIndex(i);}}/><View style={styles.text}><Text numberOfLines={open?2:1} style={styles.title}>{name}</Text><YourListingLabel owned={context?.ownsProperty===true}/>{context?.availability?<Text style={styles.status}>{context.availability}</Text>:null}{open&&context?.canViewListing&&onViewListing?<Pressable accessibilityRole="button" onPress={()=>onViewListing(context.listingId)} style={styles.action}><Text style={styles.link}>View Listing</Text></Pressable>:null}</View>
 {defaultCollapsed?<Pressable accessibilityRole="button" accessibilityLabel={expanded?'Hide property details':'Show property details'} accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)} style={styles.toggle}><Text style={styles.link}>{expanded?'▴':'▾'}</Text></Pressable>:null}</View>
 {open?<>{loading?<Text style={ui.supporting}>Loading property information...</Text>:null}{error?<Pressable accessibilityRole="button" accessibilityLabel="Retry property information" onPress={onRetry} style={styles.action}><Text style={ui.supporting}>{error} Retry</Text></Pressable>:null}{context?.photoError&&!error?<Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}><Text style={ui.supporting}>Property photos could not load. Retry photos</Text></Pressable>:null}{!loading&&!error&&!context?<Text style={ui.supporting}>Listing details are unavailable. This conversation is still available.</Text>:null}</>:null}
 {gallery}
 </View>;
}
const styles=StyleSheet.create({section:{gap:6},row:{flexDirection:'row',gap:12,alignItems:'center'},text:{flex:1,minWidth:0},title:{...ui.sectionTitle,fontSize:15},status:{...ui.supporting,color:colors.primaryAction},action:{minHeight:48,justifyContent:'center'},toggle:{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'},link:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'}});
