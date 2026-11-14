export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}
export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}
export function cmToDisplay(cm: number, unit: LengthUnit): number {
  return unit === 'cm' ? cm : cm / CM_PER_IN;
}
export function displayToCm(value: number, unit: LengthUnit): number {
  return unit === 'cm' ? value : value * CM_PER_IN;
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, decimals = 1): string {
  if (kg == null) return '–';
  return `${round(kgToDisplay(kg, unit), decimals)} ${unit}`;
}

export function formatLength(cm: number | null | undefined, unit: LengthUnit): string {
  if (cm == null) return '–';
  return `${round(cmToDisplay(cm, unit), 1)} ${unit}`;
}

export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = kgToDisplay(kg, unit);
  if (v >= 10000) return `${round(v / 1000, 1)}k ${unit}`;
  return `${Math.round(v)} ${unit}`;
}

/** Parse a user-typed decimal ("72,5" or "72.5"). Returns null for empty/invalid input. */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Whole number with thousands separators ("1,240"), independent of Intl support. */
export function formatInt(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? '-' : '';
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
