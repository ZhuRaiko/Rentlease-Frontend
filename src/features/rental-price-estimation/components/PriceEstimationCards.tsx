import {Pressable,Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {colors} from '../../../shared/theme/colors';
import {formatMonthlyPhp} from '../../../shared/models/RentalPrediction';
import type {EstimateProperty} from '../models/RentalPriceEstimate';
export function EstimatePropertyCard({property,onPress}:{property:EstimateProperty;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={'Review estimate inputs for '+property.title} onPress={onPress} style={{paddingVertical:16,gap:6,borderBottomWidth:1,borderColor:colors.outline}}><Text style={ui.sectionTitle}>{property.title}</Text><Text style={ui.supporting}>{property.location}</Text><Text style={ui.supporting}>{property.propertyType} | {property.bedrooms??'Unknown'} beds | {property.bathrooms??'Unknown'} baths | {property.floorArea??'Unknown'} sq m floor area</Text>{property.askingRent!==null?<Text style={ui.body}>Asking: {formatMonthlyPhp(property.askingRent)}</Text>:null}{property.unavailable?<Text style={ui.supporting}>{property.unavailable}</Text>:<Text style={[ui.body,{color:colors.primaryAction}]}>Review property</Text>}</Pressable>;
}
