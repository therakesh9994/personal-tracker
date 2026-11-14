import { createTestDb } from '@/test/testDb';
import * as E from '../service';
import * as W from '@/features/workouts/service';

const input = { name: 'Landmine Press', primaryMuscle: 'shoulders' as const, equipment: 'barbell' as const };

describe('exercise library', () => {
  beforeEach(() => createTestDb());

  it('searches and filters', () => {
    expect(E.listExercises({ search: 'bench' }).length).toBeGreaterThan(2);
    expect(E.listExercises({ muscle: 'biceps' }).every((e) => e.primaryMuscle === 'biceps')).toBe(true);
    expect(E.listExercises({ equipment: 'cable', muscle: 'triceps' }).map((e) => e.id)).toContain('ex_tricep_pushdown');
  });

  it('creates and edits custom exercises with validation', () => {
    const id = E.createCustomExercise(input);
    expect(() => E.createCustomExercise({ ...input, name: 'landmine press' })).toThrow(/already exists/);
    expect(() => E.createCustomExercise({ ...input, name: '' })).toThrow(/empty/);
    E.updateCustomExercise(id, { ...input, name: 'Landmine Press (1 arm)', secondaryMuscles: ['triceps', 'shoulders'] });
    const ex = E.getExercise(id)!;
    expect(ex.name).toBe('Landmine Press (1 arm)');
    expect(E.parseSecondary(ex)).toEqual(['triceps']);
    expect(() => E.updateCustomExercise('ex_bench_press', input)).toThrow(/Built-in/);
  });

  it('favorites float to the top', () => {
    E.toggleFavorite('ex_lateral_raise');
    expect(E.listExercises()[0].id).toBe('ex_lateral_raise');
    expect(E.listExercises({ favoritesOnly: true })).toHaveLength(1);
  });

  it('archives instead of deleting an exercise used in history', () => {
    const used = E.createCustomExercise(input);
    const unused = E.createCustomExercise({ ...input, name: 'Unused' });
    const sid = W.startWorkout();
    W.addExercise(sid, used);
    expect(E.deleteCustomExercise(used)).toBe('archived');
    expect(E.deleteCustomExercise(unused)).toBe('deleted');
    expect(E.listExercises({ search: 'Landmine' })).toHaveLength(0);
    expect(W.getSessionDetail(sid)!.exercises[0].exerciseName).toBe('Landmine Press');
  });
});
