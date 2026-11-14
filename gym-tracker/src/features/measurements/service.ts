import { asc, desc, eq, gte, isNotNull, and } from 'drizzle-orm';
import { z } from 'zod';
import { bodyMeasurements, type BodyMeasurement } from '@/database/schema';
import { getDb } from '@/database/client';
import { ValidationError, validate } from '@/utils/errors';
import { newId } from '@/utils/id';
import { notifyDataChanged } from '@/stores/dataStore';

export const MEASUREMENT_FIELDS = [
  { key: 'weightKg', label: 'Body weight', kind: 'weight' },
  { key: 'bodyFatPct', label: 'Body fat', kind: 'percent' },
  { key: 'chestCm', label: 'Chest', kind: 'length' },
  { key: 'waistCm', label: 'Waist', kind: 'length' },
  { key: 'hipsCm', label: 'Hips', kind: 'length' },
  { key: 'leftArmCm', label: 'Left arm', kind: 'length' },
  { key: 'rightArmCm', label: 'Right arm', kind: 'length' },
  { key: 'leftThighCm', label: 'Left thigh', kind: 'length' },
  { key: 'rightThighCm', label: 'Right thigh', kind: 'length' },
  { key: 'leftCalfCm', label: 'Left calf', kind: 'length' },
  { key: 'rightCalfCm', label: 'Right calf', kind: 'length' },
  { key: 'neckCm', label: 'Neck', kind: 'length' },
] as const;

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]['key'];

const len = z.number().min(1, 'Measurement looks too small.').max(300, 'Measurement looks too large.').nullable();

export const measurementSchema = z.object({
  measuredAt: z.number().int(),
  weightKg: z.number().min(20, 'Body weight looks too small.').max(400, 'Body weight looks too large.').nullable(),
  bodyFatPct: z.number().min(2, 'Body fat must be between 2 and 75%.').max(75, 'Body fat must be between 2 and 75%.').nullable(),
  chestCm: len,
  waistCm: len,
  hipsCm: len,
  leftArmCm: len,
  rightArmCm: len,
  leftThighCm: len,
  rightThighCm: len,
  leftCalfCm: len,
  rightCalfCm: len,
  neckCm: len,
  notes: z.string().max(500).default(''),
});
export type MeasurementInput = z.input<typeof measurementSchema>;

function ensureSomething(v: z.infer<typeof measurementSchema>) {
  const any = MEASUREMENT_FIELDS.some((f) => v[f.key] != null);
  if (!any) throw new ValidationError('Enter at least one measurement.');
}

/** Values are expected in kg / cm (convert from display units before calling). */
export function addMeasurement(input: MeasurementInput): string {
  const v = validate(measurementSchema, input);
  ensureSomething(v);
  const id = newId();
  const nowMs = Date.now();
  getDb().insert(bodyMeasurements).values({ id, ...v, createdAt: nowMs, updatedAt: nowMs }).run();
  notifyDataChanged();
  return id;
}

export function updateMeasurement(id: string, input: MeasurementInput): void {
  const v = validate(measurementSchema, input);
  ensureSomething(v);
  getDb().update(bodyMeasurements).set({ ...v, updatedAt: Date.now() }).where(eq(bodyMeasurements.id, id)).run();
  notifyDataChanged();
}

export function deleteMeasurement(id: string): void {
  getDb().delete(bodyMeasurements).where(eq(bodyMeasurements.id, id)).run();
  notifyDataChanged();
}

export function getMeasurement(id: string): BodyMeasurement | null {
  return getDb().select().from(bodyMeasurements).where(eq(bodyMeasurements.id, id)).get() ?? null;
}

export function listMeasurements(opts: { limit?: number; offset?: number } = {}): BodyMeasurement[] {
  return getDb()
    .select()
    .from(bodyMeasurements)
    .orderBy(desc(bodyMeasurements.measuredAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0)
    .all();
}

export function latestWeight(): { weightKg: number; measuredAt: number } | null {
  const t = weightTrend();
  return t ? { weightKg: t.latest, measuredAt: t.measuredAt } : null;
}

/** Last two weight readings, for trend display. */
export function weightTrend(): { latest: number; previous: number | null; measuredAt: number } | null {
  const r = getDb()
    .select({ weightKg: bodyMeasurements.weightKg, measuredAt: bodyMeasurements.measuredAt })
    .from(bodyMeasurements)
    .where(isNotNull(bodyMeasurements.weightKg))
    .orderBy(desc(bodyMeasurements.measuredAt))
    .limit(2)
    .all();
  if (!r[0]) return null;
  return { latest: r[0].weightKg!, previous: r[1]?.weightKg ?? null, measuredAt: r[0].measuredAt };
}

/** Time series for one measurement field since `since`. */
export function measurementSeries(key: MeasurementKey, since = 0): { x: number; y: number }[] {
  const col = bodyMeasurements[key];
  return getDb()
    .select({ x: bodyMeasurements.measuredAt, y: col })
    .from(bodyMeasurements)
    .where(and(isNotNull(col), gte(bodyMeasurements.measuredAt, since)))
    .orderBy(asc(bodyMeasurements.measuredAt))
    .all()
    .map((r) => ({ x: r.x, y: r.y as number }));
}
