import {placeCategories,straightLineMeters,validPoint,type PlaceCategory,type NearbyPlace,type PublicPoint} from '../../../models/NearbyPlace';
export type AmenityCategory=PlaceCategory;
export interface NearbyAmenityQuery extends PublicPoint {radiusMeters:number;categories:readonly PlaceCategory[]}
export type NearbyFailure='timeout'|'rate_limit'|'query'|'response'|'unavailable'|'network'|'rejected';
export class NearbyPlacesError extends Error {constructor(message:string,readonly kind:NearbyFailure='unavailable',readonly status?:number,readonly retryAfterMs?:number){super(message);this.name='NearbyPlacesError';}}
export interface NearbyDiagnostic {endpoint:string;status:number|null;kind:NearbyFailure|'success';elapsedMs:number}
export const OVERPASS_ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'] as const;
export const OVERPASS_USER_AGENT='RentLease/0.1 (+https://github.com/ZhuRaiko/Rentlease-Frontend)';
function traceNearby(event:NearbyDiagnostic){if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[NEARBY-PLACES]',event);}

function generalized(query:NearbyAmenityQuery):NearbyAmenityQuery {
  if(!validPoint(query)||!Number.isInteger(query.radiusMeters)||query.radiusMeters<100||query.radiusMeters>3000||!query.categories.length||query.categories.some(c=>!placeCategories.includes(c)))throw new NearbyPlacesError('Nearby places search parameters are invalid.','query');
  return {...query,latitude:Number(query.latitude.toFixed(3)),longitude:Number(query.longitude.toFixed(3)),categories:[...new Set(query.categories)].sort()};
}
export function buildNearbyQuery(query:NearbyAmenityQuery):string {
  const q=generalized(query),around=`(around:${q.radiusMeters},${q.latitude},${q.longitude})`;
  // Apply a cheap spatial index bound before radius geometry work, including ways/relations.
  const latDelta=q.radiusMeters/110000,south=Math.max(-90,q.latitude-latDelta),north=Math.min(90,q.latitude+latDelta);
  const lonDelta=Math.min(180,q.radiusMeters/(110000*Math.max(.001,Math.cos(Math.max(Math.abs(south),Math.abs(north))*Math.PI/180))));
  const west=q.longitude-lonDelta,east=q.longitude+lonDelta;
  const box=`(${south},${west < -180||east>180?-180:west},${north},${west < -180||east>180?180:east})`;
  const amenity=q.categories.flatMap(c=>c==='school'?['school','college','university']:c==='hospital'?['hospital','clinic']:c==='transport_terminal'?['bus_station','ferry_terminal']:[]);
  const tags=[...(amenity.length?[`[amenity~"^(${amenity.join('|')})$"]`]:[]),
    ...(q.categories.includes('hospital')?['[healthcare~"^(hospital|clinic)$"]']:[]),
    ...(q.categories.includes('mall')?['[shop=mall]']:[]),
    ...(q.categories.includes('transport_terminal')?['[public_transport=station]','[railway~"^(station|halt)$"]']:[])];
  // No recursion, full geometry, metadata or per-category network calls. 501 detects truncation.
  return `[out:json][timeout:8][maxsize:16777216];(${tags.map(tag=>`nwr${tag}${box}${around};`).join('')});out center qt 501;`;
}
export function retryAfterMilliseconds(value:string|null,now:number):number {
  if(value===null)return 60000;
  if(/^\d+$/.test(value.trim())){const delay=Number(value)*1000;return Number.isFinite(delay)?Math.max(1000,delay):60000;}
  const date=Date.parse(value);return Number.isFinite(date)?Math.max(1000,date-now):60000;
}

const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown):string|undefined=>typeof v==='string'&&v.trim()?v.trim().slice(0,300):undefined;
function category(t:Record<string,unknown>):PlaceCategory|null {
  if(['school','college','university'].includes(String(t.amenity)))return 'school';
  if(['hospital','clinic'].includes(String(t.amenity))||['hospital','clinic'].includes(String(t.healthcare)))return 'hospital';
  if(t.shop==='mall')return 'mall';
  if(['bus_station','ferry_terminal'].includes(String(t.amenity))||t.public_transport==='station'||['station','halt'].includes(String(t.railway)))return 'transport_terminal';
  return null;
}
export function parseNearbyPlaces(raw:unknown,query:NearbyAmenityQuery):NearbyPlace[] {
  const root=obj(raw);if(typeof root.remark==='string'&&/timed out|timeout/i.test(root.remark))throw new NearbyPlacesError('Nearby places timed out. Please retry.','timeout');
  if(root.remark||!Array.isArray(root.elements)||root.elements.length>500)throw new NearbyPlacesError('Nearby places response was incomplete. Please try again later.','response');
  const q=generalized(query),places:NearbyPlace[]=[];
  for(const value of root.elements){const e=obj(value),t=obj(e.tags),name=text(t.name)??text(t['name:en']),cat=category(t),point=e.type==='node'?e:obj(e.center);
    const location={latitude:point.lat as number,longitude:point.lon as number};
    if(!name||!cat||!q.categories.includes(cat)||!['node','way','relation'].includes(String(e.type))||!Number.isSafeInteger(e.id)||Number(e.id)<=0||typeof point.lat!=='number'||typeof point.lon!=='number'||!validPoint(location))continue;
    const distance=straightLineMeters(q,location);if(distance>q.radiusMeters)continue;
    const address=['addr:housenumber','addr:street','addr:city'].map(k=>text(t[k])).filter(Boolean).join(', ');
    const place:NearbyPlace={osmType:e.type as NearbyPlace['osmType'],osmId:e.id as number,name,category:cat,location:{latitude:Number(location.latitude.toFixed(5)),longitude:Number(location.longitude.toFixed(5))},distanceMeters:Math.round(distance),...(address?{address}:{}),...(text(t.opening_hours)?{openingHours:text(t.opening_hours)!}:{}),...(text(t.operator)?{operator:text(t.operator)!}:{}),...(text(t.wikidata)?{wikidata:text(t.wikidata)!}:{})};
    if(places.some(p=>(p.osmType===place.osmType&&p.osmId===place.osmId)||(p.osmType!==place.osmType&&p.category===cat&&p.name.toLocaleLowerCase()===name.toLocaleLowerCase()&&(!p.wikidata||!place.wikidata||p.wikidata===place.wikidata)&&straightLineMeters(p.location,location)<=40)))continue;
    places.push(place);
  }
  return places.sort((a,b)=>a.distanceMeters-b.distanceMeters||a.name.localeCompare(b.name)||a.osmId-b.osmId);
}
const aborted=()=>Object.assign(new Error('Nearby places request canceled.'),{name:'AbortError'});
export function createOverpassService(fetcher:typeof fetch=fetch,now:()=>number=Date.now,timeoutMs=12000,diagnose:(event:NearbyDiagnostic)=>void=traceNearby){
  const cache=new Map<string,{expires:number;rows:NearbyPlace[]}>();
  let rateLimitedUntil=0;
  const failures=new Map<string,{until:number;error:NearbyPlacesError}>();
  const pending=new Map<string,{controller:AbortController;promise:Promise<NearbyPlace[]>;users:Set<symbol>}>();
  function load(query:NearbyAmenityQuery,signal?:AbortSignal):Promise<NearbyPlace[]> {
    if(signal?.aborted)return Promise.reject(aborted());
    const q=generalized(query),key=JSON.stringify(q),saved=cache.get(key);
    if(saved&&saved.expires>now())return Promise.resolve(saved.rows);
    if(rateLimitedUntil>now())return Promise.reject(new NearbyPlacesError('Nearby places is busy. Please wait before retrying.','rate_limit',429,rateLimitedUntil-now()));
    const failed=failures.get(key);if(failed&&failed.until>now())return Promise.reject(failed.error);
    let entry=pending.get(key);
    if(!entry){const controller=new AbortController(),deadline=now()+timeoutMs;
      const current={controller,promise:null as unknown as Promise<NearbyPlace[]>,users:new Set<symbol>()};
      const attempt=async(endpoint:string)=>{
        const attemptController=new AbortController();let timedOut=false,status:number|null=null;const start=now();
        const cancel=()=>attemptController.abort();controller.signal.addEventListener('abort',cancel,{once:true});
        const timer=setTimeout(()=>{timedOut=true;attemptController.abort();},Math.max(1,deadline-now()));
        const interrupted=new Promise<never>((_,reject)=>attemptController.signal.addEventListener('abort',()=>reject(timedOut?new NearbyPlacesError('Nearby places timed out. Please retry.','timeout'):aborted()),{once:true}));
        try {const rows=await Promise.race([interrupted,(async()=>{
          const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json','User-Agent':OVERPASS_USER_AGENT},body:`data=${encodeURIComponent(buildNearbyQuery(q))}`,signal:attemptController.signal});
          status=response.status;
          if(status===429){const retryAfter=retryAfterMilliseconds(response.headers.get('retry-after'),now());rateLimitedUntil=Math.max(rateLimitedUntil,now()+retryAfter);throw new NearbyPlacesError('Nearby places is busy. Please wait before retrying.','rate_limit',status,retryAfter);}
          if(status===400)throw new NearbyPlacesError('Nearby places search could not be processed. Please retry later.','query',status);
          if(!response.ok)throw new NearbyPlacesError('Nearby places service is unavailable. Please retry later.',[403,406].includes(status)?'rejected':'unavailable',status);
          if(Number(response.headers.get('content-length'))>2000000)throw new NearbyPlacesError('Nearby places response is too large.','response');
          const body=await response.text();if(body.length>2000000)throw new NearbyPlacesError('Nearby places response is too large.','response');
          let raw:unknown;try{raw=JSON.parse(body);}catch{throw new NearbyPlacesError('Nearby places response could not be read.','response');}
          return parseNearbyPlaces(raw,q);
        })()]);
          if(controller.signal.aborted)throw aborted();diagnose({endpoint,status,kind:'success',elapsedMs:now()-start});return rows;
        }catch(e){if(controller.signal.aborted)throw aborted();
          const error=timedOut?new NearbyPlacesError('Nearby places timed out. Please retry.','timeout'):e instanceof NearbyPlacesError?e:new NearbyPlacesError('Could not load nearby places. Check your connection and retry.','network');
          diagnose({endpoint,status,kind:error.kind,elapsedMs:now()-start});throw error;
        }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);attemptController.abort();}
      };
      const request=async()=>{
        const started=now();
        try{return await attempt(OVERPASS_ENDPOINTS[0]);}catch(e){
          if(controller.signal.aborted)throw aborted();
          // A fast gateway/rejection failure may use one alternate within the SAME total budget.
          // Never repeat a stalled request, bypass rate limits, or retry invalid queries.
          if(!(e instanceof NearbyPlacesError)||now()-started>=3000||now()>=deadline||![406,502,503,504].includes(e.status??0))throw e;
          return attempt(OVERPASS_ENDPOINTS[1]);
        }
      };
      current.promise=request().then(rows=>{failures.delete(key);if(!controller.signal.aborted){cache.delete(key);cache.set(key,{rows,expires:now()+300000});if(cache.size>20)cache.delete(cache.keys().next().value!);}return rows;}).catch(error=>{if(!controller.signal.aborted&&error instanceof NearbyPlacesError){failures.delete(key);failures.set(key,{until:now()+Math.max(15000,error.retryAfterMs??0),error});if(failures.size>20)failures.delete(failures.keys().next().value!);}throw error;}).finally(()=>{if(pending.get(key)===current)pending.delete(key);});
      entry=current;pending.set(key,entry);
    }
    const active=entry,token=Symbol();active.users.add(token);
    return new Promise((resolve,reject)=>{let done=false;const finish=()=>{if(done)return false;done=true;signal?.removeEventListener('abort',cancel);active.users.delete(token);return true;};
      const cancel=()=>{if(!finish())return;reject(aborted());if(!active.users.size){if(pending.get(key)===active)pending.delete(key);active.controller.abort();}};
      signal?.addEventListener('abort',cancel,{once:true});
      active.promise.then(rows=>{if(finish())resolve(rows);},error=>{if(finish())reject(error);});
    });
  }
  return {load,peek(query:NearbyAmenityQuery){const saved=cache.get(JSON.stringify(generalized(query)));return saved&&saved.expires+1500000>now()?saved.rows:null;}};
}
const service=createOverpassService();
export function fetchNearbyAmenities(query:NearbyAmenityQuery,signal?:AbortSignal):Promise<NearbyPlace[]>{return service.load(query,signal);}

export function cachedNearbyAmenities(query:NearbyAmenityQuery):NearbyPlace[]|null{return service.peek(query);}
