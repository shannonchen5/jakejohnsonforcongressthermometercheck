import type { ProgressBand } from '../types';
import { COLORS } from './colors';

/** red <25%, yellow 25–75%, green 75%+ */
export function getProgressBand(percentOfGoal: number | null | undefined): ProgressBand {
  if (percentOfGoal == null || !Number.isFinite(percentOfGoal)) return 'pending';
  if (percentOfGoal < 25) return 'low';
  if (percentOfGoal < 75) return 'mid';
  return 'high';
}

export function getBandColor(band: ProgressBand): string {
  switch (band) {
    case 'low':
      return COLORS.thermoLow;
    case 'mid':
      return COLORS.thermoMid;
    case 'high':
      return COLORS.thermoHigh;
    default:
      return COLORS.upcoming;
  }
}

export function clampFillPercent(percentOfGoal: number | null | undefined): number {
  if (percentOfGoal == null || !Number.isFinite(percentOfGoal)) return 0;
  return Math.max(0, Math.min(100, percentOfGoal));
}
