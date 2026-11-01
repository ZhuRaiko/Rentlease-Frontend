export interface DraftSaveDiagnostic {
  operation: 'save_listing_draft'|'update_listing_draft'; stage: 'preflight'|'rpc'|'receipt'|'reload';
  code:string; rpcSent:boolean; outcome:'not_sent'|'confirmed_failed'|'uncertain';
  message:'Save could not start'|'Backend rejected the draft'|'Save response could not be confirmed';
}
export function draftSaveDiagnostic(stage:DraftSaveDiagnostic['stage'],error:unknown,rpcSent:boolean,rejected:boolean,operation:DraftSaveDiagnostic['operation']='save_listing_draft'):DraftSaveDiagnostic {
  const code=error && typeof error==='object' && 'code' in error && typeof error.code==='string' && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(error.code)?error.code:'unknown';
  return {operation,stage,code,rpcSent,outcome:rejected?'confirmed_failed':rpcSent?'uncertain':'not_sent',message:rejected?'Backend rejected the draft':rpcSent?'Save response could not be confirmed':'Save could not start'};
}
export function traceDraftSaveDiagnostic(event:DraftSaveDiagnostic) {
  if(typeof __DEV__!=='undefined'&&__DEV__) console.info('[LISTING-DRAFT-DIAG]',event);
}
