import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {PublishedRentalReviews} from './RentalReviews';
import {PropertyReviewWordCloud} from './PropertyReviewWordCloud';
import {ui} from '../theme/ui';
import {colors} from '../theme/colors';
export function RentalFeedbackSection({accountId,propertyId,ownerId}:{accountId:string|undefined;propertyId:string;ownerId:string}){
 const [tab,setTab]=useState<'Property'|'Landlord'|'Themes'>('Property');
 const tabs=<View style={{flexDirection:'row',gap:3,padding:3,borderRadius:10,backgroundColor:colors.surface}}>{(['Property','Landlord','Themes'] as const).map(label=><Pressable key={label} accessibilityRole="tab" accessibilityState={{selected:tab===label}} onPress={()=>setTab(label)} style={{flex:1,minWidth:0,minHeight:48,padding:6,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:tab===label?colors.background:'transparent'}}><Text style={{...ui.supporting,fontSize:12,color:tab===label?colors.primaryAction:colors.ink,fontWeight:'600'}}>{label}</Text></Pressable>)}</View>;
 return <View style={{gap:11}}><View style={{gap:4}}><Text style={{...ui.supporting,fontSize:10,lineHeight:16,fontWeight:'800',letterSpacing:.95,textTransform:'uppercase',color:colors.primaryAction}}>Community feedback</Text><Text accessibilityRole="header" style={{...ui.sectionTitle,fontSize:18,lineHeight:24}}>Ratings & Reviews</Text><Text style={{...ui.supporting,fontSize:12,lineHeight:18}}>Approved feedback from completed rentals.</Text></View>
 <View style={{borderWidth:1,borderColor:colors.outline,borderRadius:15,padding:13,gap:11}}>
 {tab==='Themes'?<><View style={{gap:4,paddingBottom:12,borderBottomWidth:1,borderBottomColor:colors.outline}}><Text style={{...ui.body,fontWeight:'700'}}>Property review themes</Text><Text style={ui.supporting}>Explore words from approved property feedback.</Text></View>{tabs}<PropertyReviewWordCloud compact accountId={accountId} propertyId={propertyId}/></>:<PublishedRentalReviews compact navigation={tabs} key={`${accountId}:${tab}:${tab==='Property'?propertyId:ownerId}`} accountId={accountId} kind={tab==='Property'?'property':'user'} targetId={tab==='Property'?propertyId:ownerId}/>}
 </View></View>;
}
