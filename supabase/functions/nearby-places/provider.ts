import {straightLineMeters,validPoint,type NearbyPlace,type PlaceCategory,type PublicPoint} from '../../../src/shared/models/NearbyPlace.ts';
export class PlacesFailure extends Error{constructor(public code:string,public status=503,public retryAfter=60){super(code);}}
export const categories={school:['education.school','education.college','education.university'],hospital:['healthcare.hospital','healthcare.clinic_or_praxis'],mall:['commercial.shopping_mall'],transport_terminal:['public_transport.bus','public_transport.train','public_transport.ferry','public_transport.subway','public_transport.light_rail']} as const;
export const radius=2000;
export async function boundedJson(response:Response|Request,limit:number,signal?:AbortSignal):Promise<any>{
 if(!response.body)throw new PlacesFailure('invalid_response',502);const reader=response.body.getReader(),cancel=()=>{void reader.cancel();};signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new PlacesFailure('size_limit',502);chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const b of chunks){bytes.set(b,at);at+=b.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new PlacesFailure('invalid_response',502);}}finally{signal?.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});}
}
export function normalizeGeoapify(raw:any,origin:PublicPoint):NearbyPlace[]{
 if(raw?.type!=='FeatureCollection'||!Array.isArray(raw.features)||raw.features.length>100)throw new PlacesFailure('invalid_response',502);
 const result:NearbyPlace[]=[],seen=new Set<string>(),counts:Record<string,number>={};
 for(const f of raw.features){const p=f?.properties,g=f?.geometry;if(g?.type!=='Point'||!Array.isArray(g.coordinates)||g.coordinates.length!==2||typeof p?.place_id!=='string'||p.place_id.length>512||!Array.isArray(p.categories))throw new PlacesFailure('invalid_response',502);
  const location={latitude:g.coordinates[1],longitude:g.coordinates[0]};if(!validPoint(location))throw new PlacesFailure('invalid_response',502);
  if(typeof p.name!=='string'||!p.name.trim())continue;
  if(p.name.length>240)throw new PlacesFailure('invalid_response',502);
  let category=(Object.keys(categories) as PlaceCategory[]).find(key=>categories[key].some(c=>p.categories.some((x:unknown)=>typeof x==='string'&&(x===c||x.startsWith(c+'.')))));
  if(!category)continue;
  // Geoapify transport includes stops/platforms. No station/terminal claim without explicit source tags.
  const tags=p.datasource?.raw;
  if(category==='transport_terminal'&&!(tags?.amenity==='bus_station'||tags?.amenity==='ferry_terminal'||tags?.railway==='station'||tags?.public_transport==='station'))continue;
  const distanceMeters=straightLineMeters(origin,location);if(distanceMeters>radius)continue;
  const id=p.place_id;if(seen.has(id)||(counts[category]??0)>=20)continue;seen.add(id);counts[category]=(counts[category]??0)+1;
  result.push({providerId:id,name:p.name.trim(),category,location,distanceMeters});
 }
 return result.sort((a,b)=>a.distanceMeters-b.distanceMeters||a.name.localeCompare(b.name));
}
export async function geoapify(origin:PublicPoint,key:string,http:typeof fetch,signal:AbortSignal){
 const url=new URL('https://api.geoapify.com/v2/places');url.searchParams.set('apiKey',key);url.searchParams.set('categories',Object.values(categories).flat().join(','));url.searchParams.set('filter',`circle:${origin.longitude},${origin.latitude},${radius}`);url.searchParams.set('bias',`proximity:${origin.longitude},${origin.latitude}`);url.searchParams.set('limit','100');
 let response:Response;try{response=await http(url,{signal,redirect:'error'});}catch{throw new PlacesFailure(signal.aborted?'timeout':'temporarily_unavailable',signal.aborted?504:503);}
 if(!response.ok){const value=response.headers.get('retry-after'),seconds=value?Number(value):NaN;const retry=Number.isFinite(seconds)?seconds:value?Math.ceil((Date.parse(value)-Date.now())/1000):60;throw new PlacesFailure(response.status===429?'rate_limited':'temporarily_unavailable',response.status===429?429:503,Math.min(2147483647,Math.max(10,Number.isFinite(retry)?retry:60)));}
 return normalizeGeoapify(await boundedJson(response,512000,signal),origin);
}
