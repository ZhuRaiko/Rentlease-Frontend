/** Advisory review heuristics, not fitted training bounds or publication rules. */
export function propertyMeasurementWarnings(property:Record<string,unknown>):string[]{
 const warnings:string[]=[],area=property.floor_area_sqm,beds=property.bedrooms,baths=property.bathrooms;
 const known=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 if(!known(area)||area===0)warnings.push('Floor area can be omitted when saving, but a positive floor area in square meters is needed for estimation.');
 else if(area<10||area>1000)warnings.push('Double-check the floor area and square-meter units. This size is unusual; it is not a model eligibility limit.');
 if(known(beds)&&beds>20||known(baths)&&baths>20)warnings.push('Double-check the bedroom and bathroom counts before using an estimate.');
 if(known(area)&&known(beds)&&beds>0&&area/beds<5)warnings.push('Floor area looks small relative to the bedroom count. Check that floor area and lot area were not confused.');
 if(beds===0||baths===0)warnings.push('Confirm that zero means no bedrooms or bathrooms. Existing saved zeros may include older form defaults.');
 return warnings;
}
