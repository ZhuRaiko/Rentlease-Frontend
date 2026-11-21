import {parseModelPrediction,type PredictionReceipt} from './RentalPrediction';
import type {ExactEstimate} from './RentalStatistics';

/**
 * A prediction receipt plus the model's exact estimate and exact band, for the Statistical analysis sheet ONLY. The cards keep using the receipt's range, rounded
 * outward to the nearest 500 pesos; nothing here changes that. `exact` is null when the service response had no verifiable band.
 */
export type EstimateReceipt = PredictionReceipt & { exact?: ExactEstimate | null };

/**
 * Reads the exact values from the Edge function's response. They are NOT recomputed from the rounded range: the estimate and the bounds are the numbers the model
 * service returned, and the same check as the rest of the app (the band must be the estimate plus and minus 30%, to the centavo) decides whether they are usable.
 */
export function parseExactEstimate(wire: unknown): ExactEstimate | null {
  if (!wire || typeof wire !== 'object') return null;
  const r = wire as Record<string, unknown>, range = r.illustrativeRange && typeof r.illustrativeRange === 'object' ? r.illustrativeRange as Record<string, unknown> : null;
  try {
    const model = parseModelPrediction({ estimated_rent_monthly: r.estimatedMonthlyRent, currency: r.currency, model_version: r.modelVersion, range_min: range?.minimum, range_max: range?.maximum });
    return model.illustrativeRange ? { estimate: model.estimatedMonthlyRent, minimum: model.illustrativeRange.minimum, maximum: model.illustrativeRange.maximum } : null;
  } catch { return null; }
}
export const withExactEstimate = (receipt: PredictionReceipt, wire: unknown): EstimateReceipt => ({ ...receipt, exact: parseExactEstimate(wire) });
