import {useMemo} from 'react';
import {getMapTilerStyleUrl} from '../services/maps/mapTiler/mapTilerConfig';
export function usePublicLocationMap(){return useMemo(()=>{try{return getMapTilerStyleUrl();}catch{return null;}},[]);}
