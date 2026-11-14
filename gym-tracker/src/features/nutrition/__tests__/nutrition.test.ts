import { createTestDb } from '@/test/testDb';
import * as N from '../service';
import { dailyTotals, goalProgress, mealTotals } from '../calculations';
import { getGoalsForDay, setGoals } from '@/features/settings/service';

const oats = { name: 'Oats', servingSize: 40, servingUnit: 'g', calories: 150, proteinG: 5, carbsG: 27, fatG: 3 };

describe('nutrition', () => {
  beforeEach(() => createTestDb());

  it('creates foods with validation', () => {
    expect(N.createFood(oats)).toBeTruthy();
    expect(() => N.createFood({ ...oats, name: ' ' })).toThrow(/empty/);
    expect(() => N.createFood({ ...oats, calories: -1 })).toThrow(/negative/);
    expect(() => N.createFood({ ...oats, servingSize: 0 })).toThrow(/greater than 0/);
    expect(N.listFoods('oa')).toHaveLength(1);
  });

  it('logs meals and computes quantity-scaled totals', () => {
    const day = new Date(2026, 4, 10, 12).getTime();
    const f1 = N.createFood(oats);
    const f2 = N.createFood({ name: 'Chicken', servingSize: 100, servingUnit: 'g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    N.logFood({ foodId: f1, meal: 'breakfast', quantity: 1.5, loggedAt: day });
    const e2 = N.logFood({ foodId: f2, meal: 'dinner', quantity: 2, loggedAt: day });
    N.logFood({ foodId: f2, meal: 'dinner', quantity: 1, loggedAt: day - 86_400_000 }); // other day
    const d = N.getDayNutrition(day);
    expect(d.entries).toHaveLength(2);
    expect(d.totals.calories).toBeCloseTo(225 + 330);
    expect(d.totals.protein).toBeCloseTo(7.5 + 62);
    expect(d.byMeal.dinner.calories).toBeCloseTo(330);
    expect(d.byMeal.lunch.calories).toBe(0);

    N.updateEntry(e2, { quantity: 1 });
    expect(N.getDayNutrition(day).totals.calories).toBeCloseTo(225 + 165);
    N.deleteEntry(e2);
    expect(N.getDayNutrition(day).entries).toHaveLength(1);
    expect(() => N.updateEntry(e2, { quantity: 0 })).toThrow(/greater than 0/);
  });

  it('keeps a historical snapshot when the food changes', () => {
    const f = N.createFood(oats);
    const day = Date.now();
    N.logFood({ foodId: f, meal: 'snack', quantity: 1, loggedAt: day });
    N.updateFood(f, { ...oats, name: 'Oats v2', calories: 999 });
    N.deleteFood(f);
    const [entry] = N.getDayNutrition(day).entries;
    expect(entry).toMatchObject({ foodName: 'Oats', caloriesPerServing: 150 });
    expect(N.listFoods()).toHaveLength(0); // removed from food list
  });

  it('tracks water in ml', () => {
    const day = new Date(2026, 4, 10, 9).getTime();
    N.addWater(250, day);
    const id = N.addWater(500, day + 1000);
    expect(N.getDayWater(day).totalMl).toBe(750);
    N.deleteWater(id);
    expect(N.getDayWater(day).totalMl).toBe(250);
    expect(() => N.addWater(-5)).toThrow();
    expect(N.getWaterHistory()).toEqual([{ day: '2026-05-10', totalMl: 250 }]);
  });

  it('stores goal history so past days keep their goals', () => {
    const d1 = new Date(2026, 0, 1, 10).getTime();
    const d2 = new Date(2026, 0, 10, 10).getTime();
    expect(getGoalsForDay(d1)).toBeNull();
    setGoals({ calories: 2500, proteinG: 150, carbsG: null, fatG: null, waterMl: 3000 }, d1);
    setGoals({ calories: 2200, proteinG: 160, carbsG: null, fatG: null, waterMl: 3000 }, d2);
    expect(getGoalsForDay(d1 + 86_400_000)?.calories).toBe(2500);
    expect(getGoalsForDay(d2)?.calories).toBe(2200);
  });
});

describe('nutrition calculations', () => {
  const e = (meal: any, q: number, c: number) => ({ meal, quantity: q, caloriesPerServing: c, proteinPerServing: 1, carbsPerServing: 2, fatPerServing: 3 });
  it('aggregates by meal and day', () => {
    const list = [e('lunch', 2, 100), e('lunch', 1, 50), e('snack', 0.5, 200)];
    expect(dailyTotals(list)).toEqual({ calories: 350, protein: 3.5, carbs: 7, fat: 10.5 });
    expect(mealTotals(list).lunch.calories).toBe(250);
  });
  it('computes goal progress', () => {
    expect(goalProgress(1000, 2000)).toBe(0.5);
    expect(goalProgress(1000, null)).toBeNull();
    expect(goalProgress(1000, 0)).toBeNull();
  });
});
