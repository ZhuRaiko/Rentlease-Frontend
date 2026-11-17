import type {TenancyCardContext} from '../models/TenancyDetails';
import type {RentalRelationship} from '../models/TenancyWorkspace';
import type {RentalReservation} from '../../messaging-viewing/models/RentalReservation';
import type {TenancyActivity} from '../services/tenancyActivityService';

/** What one successful Tenancy tab read holds (and what the in-memory cache keeps per signed-in user). */
export interface WorkspaceData{tenancies:RentalRelationship[];reservations:RentalReservation[];contexts:Record<string,TenancyCardContext>;contextWarning:string|null;links:{reservation_id:string;tenancy_id:string}[]|null;offset:number;activity:TenancyActivity|null}
/** `loaded` = a real result (read or cached) is on screen. `busy` = a read is running. `error` = nothing to show and the first read failed. `refreshError` = a refresh failed but the data stays. */
export interface WorkspaceState extends Omit<WorkspaceData,'activity'>{owner:string|undefined;loaded:boolean;busy:boolean;error:string|null;refreshError:string|null}
export const blankWorkspace=(owner:string|undefined,busy:boolean,error:string|null=null):WorkspaceState=>({owner,tenancies:[],reservations:[],contexts:{},contextWarning:null,links:null,offset:0,loaded:false,busy,error,refreshError:null});
const fromData=(owner:string,data:WorkspaceData,busy:boolean):WorkspaceState=>({owner,tenancies:data.tenancies,reservations:data.reservations,contexts:data.contexts,contextWarning:data.contextWarning,links:data.links,offset:data.offset,loaded:true,busy,error:null,refreshError:null});
/** The first state for a user: the cached result at once (and a refresh pending), else an empty state that is loading. */
export const seedWorkspace=(owner:string|undefined,cached:WorkspaceData|null):WorkspaceState=>owner&&cached?fromData(owner,cached,true):blankWorkspace(owner,!!owner);
/** A read begins. Data already on screen for the same user stays; only `busy` turns on. Otherwise start from the seed. */
export const beginWorkspaceRefresh=(prev:WorkspaceState,owner:string,cached:WorkspaceData|null):WorkspaceState=>prev.owner===owner&&prev.loaded?{...prev,busy:true,error:null,refreshError:null}:seedWorkspace(owner,cached);
export const succeedWorkspace=(owner:string,data:WorkspaceData):WorkspaceState=>fromData(owner,data,false);
/** A read failed. With data on screen the data stays and the failure is a quiet `refreshError`; with none, the existing error state. */
export const failWorkspaceRefresh=(prev:WorkspaceState,owner:string,message:string):WorkspaceState=>prev.owner===owner&&prev.loaded?{...prev,busy:false,error:null,refreshError:message}:blankWorkspace(owner,false,message);
