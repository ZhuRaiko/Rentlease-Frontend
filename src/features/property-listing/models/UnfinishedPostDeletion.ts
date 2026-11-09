export type DeletionState='live'|'cleanup_pending'|'completed';
export interface UnfinishedPostStatus {propertyId:string;state:DeletionState;eligible:boolean;reason:string|null}
export class UnfinishedPostError extends Error {}
export interface UnfinishedPostService {inspect(id:string):Promise<UnfinishedPostStatus>;remove(id:string):Promise<UnfinishedPostStatus>;pending():Promise<UnfinishedPostStatus[]>}
