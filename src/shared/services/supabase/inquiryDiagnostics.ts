export type InquiryOperation = 'start_property_inquiry' | 'get_messaging_inbox' | 'get_conversation_messages' | 'send_property_message';
export interface InquiryDiagnostic {operation:InquiryOperation;code:string;status:number|null}
// Never forward raw errors, parameters, account IDs, tokens, or message bodies.
export function inquiryDiagnostic(operation:InquiryOperation,error:unknown,status?:number):InquiryDiagnostic {
 const fields=error&&typeof error==='object'?error as Record<string,unknown>:{};
 return{operation,code:typeof fields.code==='string'&&/^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(fields.code)?fields.code:'unknown',status:typeof status==='number'&&Number.isInteger(status)&&status>=100&&status<=599?status:null};
}
export function traceInquiryDiagnostic(event:InquiryDiagnostic){
 if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[INQUIRY-DIAG] request failed',event);
}
