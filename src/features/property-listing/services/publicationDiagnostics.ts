export interface PublicationDiagnostic { stage: 'preflight-read' | 'post-rpc-read' | 'status-read' | 'rpc' | 'journal'; code: string; classification: 'backend_permission' | 'read_failed' | 'verification_failed' | 'rejected' | 'transport_unknown' | 'local_storage'; rpcSent: boolean }
export function publicationDiagnostic(stage: PublicationDiagnostic['stage'], error: unknown, rpcSent: boolean, classification?: PublicationDiagnostic['classification']): PublicationDiagnostic {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(error.code) ? error.code : 'unknown';
  return {stage,code,rpcSent,classification:classification??(code==='42501'?'backend_permission':rpcSent?'verification_failed':'read_failed')};
}
export function tracePublicationDiagnostic(event:PublicationDiagnostic) {
  if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[PUBLICATION-DIAG]',{stage:event.stage,code:event.code,classification:event.classification,rpcSent:event.rpcSent});
}
