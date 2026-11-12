import {createNearbyHandler} from './handler.ts';
declare const Deno:{env:{get:(name:string)=>string|undefined};serve:(handler:(request:Request)=>Promise<Response>)=>void};
Deno.serve(createNearbyHandler({supabaseUrl:(Deno.env.get('SUPABASE_URL')??'').replace(/\/$/,''),anonKey:Deno.env.get('SUPABASE_ANON_KEY')??'',serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',providerKey:Deno.env.get('GEOAPIFY_API_KEY')??''}));
