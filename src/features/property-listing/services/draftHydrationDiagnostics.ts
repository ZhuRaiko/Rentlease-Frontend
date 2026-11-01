export type HydrationStage = 'listing' | 'property' | 'amenities' | 'photos' | 'verification' | 'publication_lookup' | 'total';
export interface HydrationDiagnostic { stage: HydrationStage; durationMs: number; request: number; result: 'success' | 'error' | 'cancelled'; code: string }
export function traceHydration(event: HydrationDiagnostic) {
  if(typeof __DEV__ !== 'undefined' && __DEV__) console.info('[DRAFT-HYDRATION-DIAG]',event);
}
export async function measureHydration<T>(stage: HydrationStage, action: () => PromiseLike<T>, request=0, diagnose=traceHydration, now=()=>Date.now()): Promise<T> {
 const start=now();let result:HydrationDiagnostic['result']='success',code='none';
 try {
   const value=await action();
   const failure=Array.isArray(value)?value.find(item=>item&&typeof item==='object'&&'error'in item&&item.error):value;
   if(value===false||(failure&&typeof failure==='object'&&'error'in failure&&failure.error)){
     result='error';const error=failure&&typeof failure==='object'&&'error'in failure?failure.error:null;
     const raw=error&&typeof error==='object'&&'code'in error?error.code:null;
     code=typeof raw==='string'&&/^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(raw)?raw:'unknown';
   }
   return value;
 } catch(error) {result='error';const raw=error&&typeof error==='object'&&'code'in error?error.code:undefined;code=typeof raw==='string'&&/^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(raw)?raw:'unknown';throw error;}
 finally { try {diagnose({stage,durationMs:Math.max(0,now()-start),request,result,code});}catch{/* Diagnostics cannot affect requests. */} }
}
