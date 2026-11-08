import {createPredictionHandler} from './handler.ts';
// Narrow runtime declaration keeps application TypeScript checks independent of Deno installation.
declare const Deno:{env:{get:(name:string)=>string|undefined};serve:(handler:(request:Request)=>Promise<Response>)=>void};
Deno.serve(createPredictionHandler({supabaseUrl:Deno.env.get('SUPABASE_URL')??'',anonKey:Deno.env.get('SUPABASE_ANON_KEY')??'',mlUrl:Deno.env.get('ML_API_URL')??'https://rentlease-ml.onrender.com',mlSecret:Deno.env.get('ML_SHARED_SECRET')??''}));
