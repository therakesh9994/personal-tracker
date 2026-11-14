import { computeRecords } from '../service';

describe('computeRecords', () => {
  it('keeps the earliest achievement on ties', () => {
    const r = computeRecords([
      { setId: 'a', sessionId: 's1', weightKg: 100, reps: 5, achievedAt: 1 },
      { setId: 'b', sessionId: 's2', weightKg: 100, reps: 5, achievedAt: 2 },
    ]);
    expect(r.find((x) => x.recordType === 'max_weight')!.workoutSetId).toBe('a');
  });
  it('returns nothing for empty input', () => {
    expect(computeRecords([])).toEqual([]);
  });
  it('picks highest Epley estimate', () => {
    const r = computeRecords([
      { setId: 'a', sessionId: 's', weightKg: 100, reps: 5, achievedAt: 1 },
      { setId: 'b', sessionId: 's', weightKg: 80, reps: 12, achievedAt: 2 },
    ]);
    const e = r.find((x) => x.recordType === 'estimated_1rm')!;
    expect(e.workoutSetId).toBe('a');
    expect(e.value).toBeCloseTo(116.667, 2);
  });
});
