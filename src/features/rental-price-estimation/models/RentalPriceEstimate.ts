import type {PredictionTarget,PredictionReceipt} from '../../../shared/models/RentalPrediction';
import type {EstimateReceipt} from '../../../shared/models/RentalExactEstimate';
export type EstimateActor='tenant'|'landlord';
export type EstimateSource='owned'|'published';
export interface EstimateProperty {key:string;propertyId:string;target:PredictionTarget;title:string;location:string;propertyType:string;floorArea:number|null;bedrooms:number|null;bathrooms:number|null;askingRent:number|null;unavailable:string|null;warnings?:readonly string[]}
export type RentalPriceEstimate=PredictionReceipt&EstimateReceipt;
export interface EstimateState {owner:string|null;source:EstimateSource;properties:EstimateProperty[];more:boolean;loading:boolean;predicting:boolean;selected:EstimateProperty|null;result:EstimateReceipt|null;error:string|null}
