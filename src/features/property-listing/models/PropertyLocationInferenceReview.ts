import {projectWebMercator,PUBLIC_LOCATION_GRID_METERS,WEB_MERCATOR_MAX_LATITUDE} from './PropertyLocationPrivacy';
/** REVIEW ONLY. Grid shape cannot prove provenance, freshness, consent or access.
 * No backend read, external call, coordinate output or inference wiring exists.
 * Legacy retained points may not use the current grid; never silently reproject them.
 */
export function reviewPublicGridPoint(value:unknown):{status:'unverified'|'grid_shape_only';transmissionAllowed:false}{
 const unverified={status:'unverified',transmissionAllowed:false} as const;
 if(!value||typeof value!=='object'||Array.isArray(value))return unverified;
 const point=value as Record<string,unknown>;
 if(Object.keys(point).sort().join(',')!=='latitude,longitude'||typeof point.latitude!=='number'||typeof point.longitude!=='number'||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>WEB_MERCATOR_MAX_LATITUDE||Math.abs(point.longitude)>180)return unverified;
 const projected=projectWebMercator({latitude:point.latitude,longitude:point.longitude});
 const centered=(v:number)=>Math.abs((v/PUBLIC_LOCATION_GRID_METERS-.5)-Math.round(v/PUBLIC_LOCATION_GRID_METERS-.5))<1e-7;
 return centered(projected.x)&&centered(projected.y)?{status:'grid_shape_only',transmissionAllowed:false}:unverified;
}
