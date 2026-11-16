/** A status as a labelled chip. Colors for each tone live in `shared/theme/statusColors`, so this model holds no UI. */
export type ChipTone = 'positive' | 'warning' | 'restricted' | 'info' | 'neutral' | 'urgent';
export interface Chip { label: string; tone: ChipTone }
