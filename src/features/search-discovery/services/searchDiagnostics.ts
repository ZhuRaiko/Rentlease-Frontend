export type SearchFailureClassification = 'eligibility' | 'backend_permission' | 'identity' | 'query' | 'network' | 'response';
export interface SearchDiagnostic {
  stage: 'gps_rpc' | 'available_locations';
  code: string;
  classification: SearchFailureClassification;
}
// Only categorical metadata crosses the diagnostic boundary. Never forward raw errors/parameters.
export function searchDiagnostic(stage: SearchDiagnostic['stage'], error: unknown, classification?: SearchFailureClassification): SearchDiagnostic {
  const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = typeof fields.code === 'string' && /^(?:[A-Z0-9]{5}|PGRST[0-9]{3})$/.test(fields.code) ? fields.code : 'unknown';
  const intentionalEligibility = code === '42501' && typeof fields.message === 'string' && fields.message.trim() === 'Tenant verification required';
  return { stage, code, classification: classification ?? (intentionalEligibility ? 'eligibility' : code === '42501' ? 'backend_permission' : code === '28000' || code === 'PGRST301' ? 'identity' : code.startsWith('PGRST') ? 'query' : 'network') };
}
export function traceSearchDiagnostic(event: SearchDiagnostic) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[SEARCH-DIAG] request failed', { stage: event.stage, code: event.code, classification: event.classification });
  }
}
