export type PortfolioStage = 'auth' | 'properties' | 'listings' | 'verifications' | 'covers' | 'hydration';
export interface PortfolioDiagnostic { operation: string; stage: PortfolioStage; code: string; classification: 'network' | 'authorization' | 'schema' | 'application_state' | 'backend'; message: string }
export function portfolioDiagnostic(stage: PortfolioStage, error: unknown): PortfolioDiagnostic {
  const raw = error && typeof error === 'object' ? error as {code?: unknown; message?: unknown; name?: unknown} : {};
  const code = typeof raw.code === 'string' && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(raw.code) ? raw.code : 'unknown';
  const text = typeof raw.message === 'string' ? raw.message : '';
  const classification = code === '42501' || code === 'PGRST301' || code === 'PGRST302' ? 'authorization'
    : code.startsWith('42') || ['PGRST200','PGRST202','PGRST204','PGRST205'].includes(code) ? 'schema'
    : code.startsWith('08') || /^(?:TypeError: )?(?:Failed to fetch|Network request failed|fetch failed)|network|timeout|aborted/i.test(text) ? 'network'
    : stage === 'auth' || stage === 'hydration' || !error ? 'application_state' : 'backend';
  // Allowlisted summaries only: backend messages can contain private row values.
  const message = classification === 'schema' ? (code === '42703' && /edit_version/.test(text) ? 'Requested listings.edit_version column is unavailable' : 'Requested database contract is unavailable')
    : classification === 'authorization' ? 'Backend denied portfolio access'
    : classification === 'network' ? 'Portfolio request could not reach the backend'
    : classification === 'application_state' ? 'Portfolio identity or response could not be verified' : 'Backend portfolio read failed';
  return {operation: stage === 'auth' ? 'auth.getUser' : stage === 'hydration' ? 'assemblePortfolio' : `select.${stage === 'verifications' ? 'verification_submissions' : stage === 'covers' ? 'property_photos' : stage}`, stage, code, classification, message};
}
export function tracePortfolioDiagnostic(event: PortfolioDiagnostic) {
  if(typeof __DEV__ !== 'undefined' && __DEV__) console.info('[PORTFOLIO-DIAG]', event);
}
