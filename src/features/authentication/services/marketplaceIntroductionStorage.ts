import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMarketplaceIntroductionService } from './marketplaceIntroductionService';

export const marketplaceIntroductionStorage = createMarketplaceIntroductionService(AsyncStorage);
