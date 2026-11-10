import type {Coordinates,NearbyListing} from './GpsProximity';
export interface NearbyCamera { center:[number,number]; zoom:number; bearing?:number; pitch?:number; padding?:MapInsets }
export interface MapInsets {top:number;bottom:number;left:number;right:number}
export function nearbyMarkerSources(rows:readonly NearbyListing[],selectedId:string|null){
  const all=rows.map(row=>({type:'Feature' as const,id:row.listingId,geometry:{type:'Point' as const,coordinates:[row.publicLocation.longitude,row.publicLocation.latitude]},properties:{listingId:row.listingId,label:row.askingRentMonthly===null?'Rental':`\u20b1${new Intl.NumberFormat('en-PH',{notation:'compact',maximumFractionDigits:1}).format(Number(row.askingRentMonthly))}`}}));
  return {ordinary:{type:'FeatureCollection' as const,features:all.filter(f=>f.id!==selectedId)},selected:{type:'FeatureCollection' as const,features:all.filter(f=>f.id===selectedId)}};
}
// Presentation only; PostGIS remains authoritative for search distances.
export function approximateSearchOrigin(point:Coordinates):Coordinates {
  return {latitude:Math.round(point.latitude*1000)/1000,longitude:Math.round(point.longitude*1000)/1000};
}
export function radiusPolygon(origin:Coordinates,radiusKm:number):GeoJSON.Polygon {
  const lat=origin.latitude*Math.PI/180,lon=origin.longitude*Math.PI/180,angle=radiusKm/6371;
  const ring:number[][]=[];
  for(let i=0;i<=64;i++){
    const bearing=i/64*2*Math.PI;
    const y=Math.asin(Math.sin(lat)*Math.cos(angle)+Math.cos(lat)*Math.sin(angle)*Math.cos(bearing));
    const x=lon+Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(y));
    ring.push([x*180/Math.PI,y*180/Math.PI]);
  }
  return {type:'Polygon',coordinates:[ring]};
}
export function nearbyInitialCamera(origin:Coordinates,radiusKm:number,usableSize=260):NearbyCamera {
  return {center:[origin.longitude,origin.latitude],zoom:Math.max(2,Math.min(16,Math.log2(Math.max(80,usableSize)*156543*Math.cos(origin.latitude*Math.PI/180)/(radiusKm*2400))))};
}
