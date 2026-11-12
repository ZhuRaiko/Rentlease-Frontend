export type PlaceCategory = 'school' | 'hospital' | 'mall' | 'transport_terminal';
export interface PublicPoint { latitude:number; longitude:number }
export interface NearbyPlace {
  osmType?:'node'|'way'|'relation'; osmId?:number; providerId?:string; name:string; category:PlaceCategory;
  location:PublicPoint; distanceMeters:number;
  address?:string; openingHours?:string; operator?:string; wikidata?:string;
}
export const placeCategories:PlaceCategory[]=['school','hospital','mall','transport_terminal'];
export const placeCategoryLabels:Record<PlaceCategory,string>={school:'Schools and universities',hospital:'Hospitals and clinics',mall:'Shopping malls and centers',transport_terminal:'Transport terminals and stations'};
export function validPoint(p:PublicPoint):boolean {return Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180;}
// Decode only the explicitly selected public geography field. Never accepts a property object.
export function parsePublicPoint(value:unknown):PublicPoint|null {
  let longitude:unknown,latitude:unknown;
  if(value&&typeof value==='object'&&'type' in value&&value.type==='Point'&&'coordinates' in value&&Array.isArray(value.coordinates)&&value.coordinates.length===2){[longitude,latitude]=value.coordinates;}
  else if(typeof value==='string'&&/^(?:[0-9a-f]{42}|[0-9a-f]{50})$/i.test(value)){
    try {const bytes=Uint8Array.from(value.match(/../g)!,v=>parseInt(v,16)),view=new DataView(bytes.buffer),le=view.getUint8(0)===1;
      if(view.getUint8(0)>1)return null;const type=view.getUint32(1,le);if(type!==1&&type!==0x20000001)return null;
      const offset=type===1?5:9;if(bytes.length!==offset+16||(offset===9&&view.getUint32(5,le)!==4326))return null;
      longitude=view.getFloat64(offset,le);latitude=view.getFloat64(offset+8,le);
    }catch{return null;}
  }
  if(typeof latitude!=='number'||typeof longitude!=='number'||!validPoint({latitude,longitude}))return null;
  return {latitude,longitude};
}
export function straightLineMeters(a:PublicPoint,b:PublicPoint):number {
  const rad=(v:number)=>v*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 6371008.8*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
