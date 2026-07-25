export type ThermometerRow = {
  formName: string;
  raised: number | null;
  goal: number | null;
  percentOfGoal: number | null;
  thermometerLabel: string;
  lastUpdated: string;
};

/** Lookup keyed by Form Name / region name from the Sheet. */
export type ThermometerLookup = Record<string, ThermometerRow>;

export type ProgressBand = 'low' | 'mid' | 'high' | 'pending';
