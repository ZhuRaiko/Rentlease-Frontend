export interface CompletenessInput {
  title:string; description:string; rent:number; availableDate:boolean;
  floorArea:boolean; maxOccupants:boolean; location:boolean; photoCount:number; amenityCount:number;
}
export interface CompletenessContribution { key:keyof CompletenessInput; label:string; weight:number; complete:boolean }
export function listingCompleteness(input:CompletenessInput,serverScore?:number|null) {
  // The existing server weights are reused for both estimation and field guidance.
  // Integer contributions avoid floating-point accumulation.
  const contributions:CompletenessContribution[]=[
    {key:'title',label:'Add a listing title',weight:10,complete:!!input.title.trim()},
    {key:'description',label:'Write at least 30 characters',weight:15,complete:Array.from(input.description.trim()).length>=30},
    {key:'rent',label:'Add positive monthly rent',weight:10,complete:Number.isFinite(input.rent)&&input.rent>0},
    {key:'availableDate',label:'Add an availability date',weight:5,complete:input.availableDate},
    {key:'floorArea',label:'Add floor area',weight:10,complete:input.floorArea},
    {key:'maxOccupants',label:'Add maximum occupants',weight:5,complete:input.maxOccupants},
    {key:'location',label:'Confirm the property location',weight:15,complete:input.location},
    {key:'photoCount',label:'Add at least one property photo',weight:20,complete:input.photoCount>0},
    {key:'amenityCount',label:'Select at least one amenity',weight:10,complete:input.amenityCount>0},
  ];
  const authoritative=typeof serverScore==='number'&&Number.isFinite(serverScore)&&serverScore>=0&&serverScore<=1;
  const percent=authoritative?Math.round(serverScore*100):contributions.reduce((sum,item)=>sum+(item.complete?item.weight:0),0);
  // Threshold uses the raw authoritative number, not a rounded display value.
  const meetsThreshold=authoritative?serverScore>=0.8:percent>=80;
  return {contributions,percent,meetsThreshold,source:authoritative?'server' as const:'estimate' as const,next:authoritative?[]:contributions.filter(item=>!item.complete).sort((a,b)=>b.weight-a.weight).slice(0,3)};
}
export type ListingCompletenessState=ReturnType<typeof listingCompleteness>;
