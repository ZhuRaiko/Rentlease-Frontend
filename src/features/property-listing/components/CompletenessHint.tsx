import { Text } from 'react-native';
import { ui } from '../../../shared/theme/ui';
import type { CompletenessInput, ListingCompletenessState } from '../models/ListingCompleteness';

// Presentation consumes the existing model metadata; no score/threshold logic here.
export function CompletenessHint({ value, factor, hidden = false }: {
  value: ListingCompletenessState;
  factor: keyof CompletenessInput;
  hidden?: boolean;
}) {
  const item = value.contributions.find(contribution => contribution.key === factor);
  if (hidden || !item || item.complete) return null;
  return <Text style={ui.supporting}>{`${item.label} \u00b7 +${item.weight}% completeness`}</Text>;
}
