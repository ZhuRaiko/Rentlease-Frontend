/** API taxonomy at dee06f16fe182361b1d9d7e6ecf35f41703bf1a6; not training coverage. */
export const houseModelSubtypes=['house','townhouse','beach_house','villa'] as const;
export const combinedModelSubtypes=['apartment','room','condominium','studio','loft','penthouse','condotel'] as const;
export type RentalModelSubtype=typeof houseModelSubtypes[number]|typeof combinedModelSubtypes[number];
export type RentalRequestCategory='house'|'apartment'|'condominium'|'apartment_condominium';
export function modelPropertyCategory(parent:'house'|'apartment'|'condominium',subtype:unknown):{property_type:RentalRequestCategory;property_subtype:RentalModelSubtype}{
 // Preserve the original request for legacy unknown subtype, including reference fixtures.
 if(subtype===null||subtype===undefined)return {property_type:parent,property_subtype:parent};
 const allowed:readonly string[]=parent==='house'?houseModelSubtypes:combinedModelSubtypes;
 if(typeof subtype!=='string'||!allowed.includes(subtype))throw new Error('Invalid stored subtype.');
 return {property_type:parent==='house'?'house':'apartment_condominium',property_subtype:subtype as RentalModelSubtype};
}
