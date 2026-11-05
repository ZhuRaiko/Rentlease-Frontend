// Events are invalidation hints; protected RPCs remain the source of truth.
export function createRealtimeSync(sync:()=>Promise<unknown>){
 let stopped=false,busy=false,dirty=false;
 const drain=async()=>{if(stopped||busy)return;busy=true;try{while(dirty&&!stopped){dirty=false;try{await sync();}catch{/* Workflow exposes safe read errors. */}}}finally{busy=false;}};
 return{request(){if(!stopped){dirty=true;void drain();}},stop(){stopped=true;dirty=false;}};
}
