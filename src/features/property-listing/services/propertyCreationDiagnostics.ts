export interface PropertyCreationDiagnostic {
  stage:'eligibility'|'validation'|'journal'|'rpc'|'receipt';
  code:string;
  classification:'authentication'|'account'|'role'|'tier1'|'backend_permission'|'validation'|'read_failed'|'transport_unknown'|'receipt_invalid'|'rejected'|'local_storage'|'identity';
  rpcSent:boolean;
  operation:'create_property_setup';
  outcome:'not_sent'|'confirmed_failed'|'uncertain';
  message:string;
  details:'absent'|'redacted';
  constraint?:string;
}
export function propertyCreationDiagnostic(stage:PropertyCreationDiagnostic['stage'],error:unknown,rpcSent:boolean,classification:PropertyCreationDiagnostic['classification']):PropertyCreationDiagnostic {
  const raw=error&&typeof error==='object'&&'code' in error?error.code:null;
  const code=typeof raw==='string'&&/^(?:[A-Z0-9]{5}|PGRST[0-9]{3})$/.test(raw)?raw:'unknown';
  // Never emit arbitrary backend text: constraint DETAIL can contain the entire
  // private row. SQLSTATE labels and explicitly known constraint names are enough
  // to distinguish a backend defect from invalid input without leaking that row.
  const source=error&&typeof error==='object'?error as {message?:unknown;details?:unknown}:{};
  const labels:Record<string,string>={
    '23514':'check_constraint_violation','23503':'foreign_key_violation',
    '23505':'unique_constraint_violation','23502':'not_null_violation',
    '42501':'insufficient_privilege','42883':'undefined_function',
    '42703':'undefined_column','42702':'ambiguous_column',
    '22P02':'invalid_text_representation','22003':'numeric_value_out_of_range',
    '22023':'invalid_parameter_value','P0001':'backend_validation_rejection',
  };
  const knownConstraints=['properties_floor_numbers','properties_floor_area_sqm_check',
    'properties_max_occupants_check','properties_bedrooms_check','properties_bathrooms_check',
    'properties_landlord_id_fkey','property_amenities_amenity_id_fkey',
    'property_amenities_property_id_fkey','property_amenities_pkey',
    'property_private_locations_property_id_fkey','property_private_locations_pkey'];
  const constraint=typeof source.message==='string'
    ?knownConstraints.find(name=>(source.message as string).includes('"'+name+'"')):undefined;
  const confirmed=stage==='rpc'&&(classification==='rejected'||classification==='backend_permission');
  return {stage,code,classification,rpcSent,operation:'create_property_setup',
    outcome:!rpcSent?'not_sent':confirmed?'confirmed_failed':'uncertain',
    message:labels[code]??'backend_message_redacted',
    details:source.details?'redacted':'absent',...(constraint?{constraint}:{})};
}
export function tracePropertyCreationDiagnostic(event:PropertyCreationDiagnostic) {
  if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[PROPERTY-CREATE-DIAG]',{stage:event.stage,code:event.code,classification:event.classification,rpcSent:event.rpcSent,operation:event.operation,outcome:event.outcome,message:event.message,details:event.details,...(event.constraint?{constraint:event.constraint}:{})});
}
