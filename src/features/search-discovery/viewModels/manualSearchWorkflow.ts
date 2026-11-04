import type {NearbyPlace,PublicPoint} from '../../../shared/models/NearbyPlace';
import {NearbyPlacesError} from '../../../shared/services/maps/overpass/overpassService';
import { defaultSearchFilters, ManualSearchError, type SearchInput, type SearchListing, type SearchDetail, type SearchFilters, type SearchSort, type SearchAmenity, type AvailableLocation } from '../models/ManualSearch';
interface Service {
  user(): Promise<string>;
  search(owner: string,input: SearchInput,signal?: AbortSignal): Promise<SearchListing[]>;
  locations(owner: string,text: string,offset: number,signal?: AbortSignal): Promise<{ locations: AvailableLocation[]; received: number }>;
  detail(owner: string,id: string,signal?: AbortSignal): Promise<SearchDetail>;
  inquire?(owner:string,listingId:string):Promise<string>;
  cachedPlaces?(point:PublicPoint):NearbyPlace[]|null;
  places?(owner:string,point:PublicPoint,signal?:AbortSignal):Promise<NearbyPlace[]>;
  catalogue(): Promise<SearchAmenity[]>;
}
const placesInitial=()=>({placesStale:false,placesPhase:'idle' as 'idle'|'loading'|'success'|'error',placesRows:[] as NearbyPlace[],placesError:null as string|null});
const initial = () => ({...placesInitial(), phase:'idle' as 'idle'|'loading'|'success'|'error', rows:[] as SearchListing[], query:'',filters:defaultSearchFilters(),sort:'Recently Listed' as SearchSort,error:null as string|null,more:false,refreshing:false,hasMore:false,locations:[] as AvailableLocation[],locationsStatus:'idle' as 'idle'|'loading'|'success'|'error',locationsBusy:false,locationsError:null as string|null,locationsMore:false,amenities:[] as SearchAmenity[],catalogueError:null as string|null,detail:null as SearchDetail|null,inquiryBusy:false,inquiryError:null as string|null,detailBusy:false,detailError:null as string|null,selectedId:null as string|null });
export function createManualSearchWorkflow(service: Service, options:{publishedOnly?:boolean}={}) {
  let state = initial(), disposed = false, generation = 0, locationGeneration = 0, detailGeneration = 0, nextOffset = 0, locationOffset = 0;
  let activeLocationKey: string | null = null;
  let searchController: AbortController|null = null, locationController: AbortController|null = null, detailController: AbortController|null = null;
  let placesGeneration=0,placesController:AbortController|null=null;
  const cancelPlaces=()=>{placesGeneration++;placesController?.abort();};
  const listeners = new Set<() => void>();
  const update = (patch: Partial<typeof state>) => { if (!disposed) { state={...state,...patch}; listeners.forEach(fn=>fn()); } };
  const identityFailure = (e: unknown) => { if (e instanceof ManualSearchError && e.identity) { invalidate(); nextOffset=0; locationOffset=0; update({...initial(),phase:'error',error:e.message,locationsStatus:'error',locationsError:e.message,detailError:e.message}); return true; } return false; };
  const safe = (e: unknown) => e instanceof ManualSearchError ? e.message : 'Could not load rentals. Check your connection and try again.';
  const check = async (owner: string) => { if (await service.user() !== owner) throw new ManualSearchError('Your account changed. Start a new search.',true); };
  let retryRefresh=false;
  const run = async (append=false,refresh=false) => {
    retryRefresh=refresh;
    if (disposed) return; const g=++generation; searchController?.abort(); const controller=searchController=new AbortController(); const offset=append?nextOffset:0;
    update({ phase:append||refresh?'success':'loading',rows:append||refresh?state.rows:[],more:append,refreshing:refresh,error:null,hasMore:append||refresh?state.hasMore:false });
    const input={ query:state.query,filters:state.filters,sort:state.sort,offset,...(options.publishedOnly?{publishedOnly:true}:{}) };
    try { const owner=await service.user(); if(disposed||g!==generation)return; const page=await service.search(owner,input,controller.signal); await check(owner); if(disposed||g!==generation)return;
      const rows=append?[...state.rows]:[], ids=new Set(rows.map(r=>r.listingId)); for(const row of page)if(!ids.has(row.listingId)){ rows.push(row);ids.add(row.listingId); }
      nextOffset=offset+page.length;retryRefresh=false;update({ rows,phase:'success',more:false,refreshing:false,hasMore:page.length===20 });
    } catch(e) { if(!disposed&&g===generation&&!identityFailure(e))update({ phase:'error',more:false,refreshing:false,error:safe(e),...(e instanceof ManualSearchError&&e.identity?{rows:[],hasMore:false}:{}) }); }
  };
  const locations = async (text='',append=false) => {
    if(disposed)return; const offset=append?locationOffset:0; const key=JSON.stringify([text,offset]);
    if(state.locationsBusy && activeLocationKey===key)return;
    activeLocationKey=key; const g=++locationGeneration;locationController?.abort();const controller=locationController=new AbortController();
    update({ locationsStatus:'loading',locationsBusy:true,locationsError:null,locations:append?state.locations:[] });
    try { const owner=await service.user();const page=await service.locations(owner,text,offset,controller.signal); await check(owner);if(disposed||g!==locationGeneration)return;
      const result=new Map((append?state.locations:[]).map(l=>[l.key,l]));page.locations.forEach(l=>result.set(l.key,l)); locationOffset=offset+page.received;update({locationsStatus:'success',locations:[...result.values()],locationsMore:page.received===20});
    } catch(e){if(!disposed&&g===locationGeneration&&!identityFailure(e))update({locationsStatus:'error',locationsError:safe(e)});}finally{if(!disposed&&g===locationGeneration){activeLocationKey=null;update({locationsBusy:false});}}
  };
  const openDetail = async (id:string) => {
    if(disposed)return;cancelPlaces();update(placesInitial());const g=++detailGeneration;detailController?.abort();const controller=detailController=new AbortController();update({selectedId:id,detail:null,detailBusy:true,detailError:null,inquiryBusy:false,inquiryError:null});
    try{const owner=await service.user();const detail=await service.detail(owner,id,controller.signal);await check(owner);if(!disposed&&g===detailGeneration){update({detail,detailBusy:false});void loadPlaces();}}
    catch(e){if(!disposed&&g===detailGeneration&&!identityFailure(e))update({detailError:safe(e)});}finally{if(!disposed&&g===detailGeneration)update({detailBusy:false});}
  };
  const invalidate=()=>{cancelPlaces();activeLocationKey=null;generation++;locationGeneration++;detailGeneration++;searchController?.abort();locationController?.abort();detailController?.abort();};
  const loadPlaces=async()=>{
    if(disposed||state.placesPhase==='loading'||!state.detail?.publicLocation)return;
    const detail=state.detail,g=++placesGeneration;placesController?.abort();const controller=placesController=new AbortController();
    const cached=service.cachedPlaces?.(detail.publicLocation!)??null;
    update({placesPhase:'loading',placesError:null,...(cached?{placesRows:cached,placesStale:true}:{})});
    try{const owner=await service.user();if(disposed||g!==placesGeneration)return;
      if(!service.places)throw new NearbyPlacesError('Nearby places service is unavailable.');
      const rows=await service.places(owner,detail.publicLocation!,controller.signal);await check(owner);
      if(!disposed&&g===placesGeneration&&state.detail===detail)update({placesRows:rows,placesPhase:'success',placesStale:false});
    }catch(e){if(!disposed&&g===placesGeneration&&!identityFailure(e))update({placesPhase:'error',placesError:e instanceof NearbyPlacesError?e.message:'Could not load nearby places. Check your connection and retry.'});}
  };
  return {
    async startInquiry():Promise<string|null>{
      if(disposed||state.inquiryBusy||!state.detail||!service.inquire)return null;const g=detailGeneration,detail=state.detail;
      update({inquiryBusy:true,inquiryError:null});try{const owner=await service.user();if(owner===detail.ownerId)throw new ManualSearchError('This is your listing.');if(disposed||g!==detailGeneration)return null;
        const id=await service.inquire(owner,detail.listingId);await check(owner);return !disposed&&g===detailGeneration?id:null;
      }catch(e){if(!disposed&&g===detailGeneration&&!identityFailure(e))update({inquiryError:safe(e)});return null;}finally{if(!disposed&&g===detailGeneration)update({inquiryBusy:false});}
    },
    loadPlaces,
    getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){disposed=false;},
    reset(){invalidate();nextOffset=0;locationOffset=0;update(initial());},dispose(){invalidate();disposed=true;state=initial();listeners.clear();},
    async search(query:string,filters?:SearchFilters){update({query,...(filters?{filters}:{})});await run();},async applyFilters(filters:SearchFilters){update({filters:{...filters,types:[...filters.types],amenityIds:[...filters.amenityIds]}});await run();},async sort(sort:SearchSort){update({sort});await run();},
    async ensureLoaded(){if(disposed||state.phase!=='idle')return;await run();},
    async refresh(){if(disposed||state.phase==='loading'||state.more||state.refreshing)return;await run(false,true);},
    async loadMore(){if(!state.hasMore||state.more||state.refreshing||state.phase!=='success')return;await run(true);},async retry(){if(state.phase==='loading'||state.more||state.refreshing)return;await run(!retryRefresh&&state.rows.length>0,retryRefresh);},
    locations,cancelLocations(){activeLocationKey=null;locationGeneration++;locationController?.abort();update({locationsBusy:false,locationsStatus:state.locationsStatus==='loading'?'idle':state.locationsStatus});},openDetail,cancelDetail(){cancelPlaces();update(placesInitial());detailGeneration++;detailController?.abort();update({detail:null,selectedId:null,detailBusy:false,detailError:null,inquiryBusy:false,inquiryError:null});},
    async catalogue(){const g=generation;try{const amenities=await service.catalogue();if(!disposed&&g===generation)update({amenities,catalogueError:null});}catch(e){if(!disposed&&g===generation)update({catalogueError:safe(e)});}},
  };
}
