import { defaultSearchFilters, ManualSearchError, type SearchInput, type SearchListing, type SearchDetail, type SearchFilters, type SearchSort, type SearchAmenity, type AvailableLocation } from '../models/ManualSearch';
interface Service {
  user(): Promise<string>;
  search(owner: string,input: SearchInput,signal?: AbortSignal): Promise<SearchListing[]>;
  locations(owner: string,text: string,offset: number,signal?: AbortSignal): Promise<{ locations: AvailableLocation[]; received: number }>;
  detail(owner: string,id: string,signal?: AbortSignal): Promise<SearchDetail>;
  catalogue(): Promise<SearchAmenity[]>;
}
const initial = () => ({ phase:'idle' as 'idle'|'loading'|'success'|'error', rows:[] as SearchListing[], query:'',filters:defaultSearchFilters(),sort:'Recently Listed' as SearchSort,error:null as string|null,more:false,hasMore:false,locations:[] as AvailableLocation[],locationsStatus:'idle' as 'idle'|'loading'|'success'|'error',locationsBusy:false,locationsError:null as string|null,locationsMore:false,amenities:[] as SearchAmenity[],catalogueError:null as string|null,detail:null as SearchDetail|null,detailBusy:false,detailError:null as string|null,selectedId:null as string|null });
export function createManualSearchWorkflow(service: Service) {
  let state = initial(), disposed = false, generation = 0, locationGeneration = 0, detailGeneration = 0, nextOffset = 0, locationOffset = 0;
  let activeLocationKey: string | null = null;
  let searchController: AbortController|null = null, locationController: AbortController|null = null, detailController: AbortController|null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<typeof state>) => { if (!disposed) { state={...state,...patch}; listeners.forEach(fn=>fn()); } };
  const identityFailure = (e: unknown) => { if (e instanceof ManualSearchError && e.identity) { invalidate(); nextOffset=0; locationOffset=0; update({...initial(),phase:'error',error:e.message,locationsStatus:'error',locationsError:e.message,detailError:e.message}); return true; } return false; };
  const safe = (e: unknown) => e instanceof ManualSearchError ? e.message : 'Could not load rentals. Check your connection and try again.';
  const check = async (owner: string) => { if (await service.user() !== owner) throw new ManualSearchError('Your account changed. Start a new search.',true); };
  const run = async (append=false) => {
    if (disposed) return; const g=++generation; searchController?.abort(); const controller=searchController=new AbortController(); const offset=append?nextOffset:0;
    update({ phase:append?'success':'loading',rows:append?state.rows:[],more:append,error:null,hasMore:append?state.hasMore:false });
    const input={ query:state.query,filters:state.filters,sort:state.sort,offset };
    try { const owner=await service.user(); if(disposed||g!==generation)return; const page=await service.search(owner,input,controller.signal); await check(owner); if(disposed||g!==generation)return;
      const rows=append?[...state.rows]:[], ids=new Set(rows.map(r=>r.listingId)); for(const row of page)if(!ids.has(row.listingId)){ rows.push(row);ids.add(row.listingId); }
      nextOffset=offset+page.length; update({ rows,phase:'success',more:false,hasMore:page.length===20 });
    } catch(e) { if(!disposed&&g===generation&&!identityFailure(e))update({ phase:'error',more:false,error:safe(e),...(e instanceof ManualSearchError&&e.identity?{rows:[],hasMore:false}:{}) }); }
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
    if(disposed)return;const g=++detailGeneration;detailController?.abort();const controller=detailController=new AbortController();update({selectedId:id,detail:null,detailBusy:true,detailError:null});
    try{const owner=await service.user();const detail=await service.detail(owner,id,controller.signal);await check(owner);if(!disposed&&g===detailGeneration)update({detail});}
    catch(e){if(!disposed&&g===detailGeneration&&!identityFailure(e))update({detailError:safe(e)});}finally{if(!disposed&&g===detailGeneration)update({detailBusy:false});}
  };
  const invalidate=()=>{activeLocationKey=null;generation++;locationGeneration++;detailGeneration++;searchController?.abort();locationController?.abort();detailController?.abort();};
  return {
    getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){disposed=false;},
    reset(){invalidate();nextOffset=0;locationOffset=0;update(initial());},dispose(){invalidate();disposed=true;state=initial();listeners.clear();},
    async search(query:string,filters?:SearchFilters){update({query,...(filters?{filters}:{})});await run();},async applyFilters(filters:SearchFilters){update({filters:{...filters,types:[...filters.types],amenityIds:[...filters.amenityIds]}});await run();},async sort(sort:SearchSort){update({sort});await run();},
    async loadMore(){if(!state.hasMore||state.more||state.phase!=='success')return;await run(true);},async retry(){if(state.phase==='loading'||state.more)return;await run(state.rows.length>0);},
    locations,cancelLocations(){activeLocationKey=null;locationGeneration++;locationController?.abort();update({locationsBusy:false,locationsStatus:state.locationsStatus==='loading'?'idle':state.locationsStatus});},openDetail,cancelDetail(){detailGeneration++;detailController?.abort();update({detail:null,selectedId:null,detailBusy:false,detailError:null});},
    async catalogue(){const g=generation;try{const amenities=await service.catalogue();if(!disposed&&g===generation)update({amenities,catalogueError:null});}catch(e){if(!disposed&&g===generation)update({catalogueError:safe(e)});}},
  };
}
