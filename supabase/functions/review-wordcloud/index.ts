import {createWordCloudHandler} from './handler.ts';
declare const Deno:{env:{get:(name:string)=>string|undefined};serve:(handler:(request:Request)=>Promise<Response>)=>void};
Deno.serve(createWordCloudHandler({supabaseUrl:(Deno.env.get('SUPABASE_URL')??'').replace(/\/$/,''),anonKey:Deno.env.get('SUPABASE_ANON_KEY')??'',nlpUrl:Deno.env.get('NLP_API_URL')??'https://rentlease-ml.onrender.com',nlpSecret:Deno.env.get('NLP_SHARED_SECRET')??''}));
