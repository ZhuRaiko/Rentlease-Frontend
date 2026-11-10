import {CareError,validateCareOperation,type CareOperation} from '../models/TenancyCare';
export interface CareStorage {getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>;removeItem(key:string):Promise<void>}
/** Account/tenancy-scoped recovery envelope. Removed only after confirmed result/rejection. */
export function createCareJournal(storage:CareStorage){
 const key=(actor:string,id:string)=>'rentlease.tenancy-care.v1:'+actor+':'+id;
 return {async read(actor:string,id:string):Promise<CareOperation|null>{const raw=await storage.getItem(key(actor,id));if(!raw)return null;try{const op=JSON.parse(raw) as CareOperation;if(op.tenancyId!==id||!['create','respond','check_reminder'].includes(op.action)||!op.payload||typeof op.payload!=='object')throw Error();validateCareOperation(op);return op;}catch{throw new CareError('Pending action could not be read. Keep this app data and request recovery support.');}},save:(actor:string,op:CareOperation)=>storage.setItem(key(actor,op.tenancyId),JSON.stringify(op)),clear:(actor:string,id:string)=>storage.removeItem(key(actor,id))};
}
export type CareJournal=ReturnType<typeof createCareJournal>;
