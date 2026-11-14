/**
 * Smoke test: every tab and the exercise screens render against a real (in-memory)
 * database without throwing or logging errors.
 */
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { createTestDb } from '@/test/testDb';
import TabLayout from '@/app/(tabs)/_layout';
import Home from '@/app/(tabs)/index';
import Workout from '@/app/(tabs)/workout';
import Progress from '@/app/(tabs)/progress';
import Nutrition from '@/app/(tabs)/nutrition';
import Profile from '@/app/(tabs)/profile';
import ExerciseLibrary from '@/app/exercise/index';
import ExerciseDetail from '@/app/exercise/[id]';

// Skia has no JS fallback in Jest; charts are stubbed (they are not under test here).
jest.mock('@/components/Charts', () => {
  const { View } = jest.requireActual('react-native');
  const Stub = () => <View />;
  return { LineChart: Stub, BarChart: Stub, DistributionBars: Stub, DayBars: Stub };
});
// Reanimated's native runtime can't start in Jest; the figure's maths is unit-tested separately.
jest.mock('@/features/exercise-guide/ExerciseAnimation', () => {
  const { View } = jest.requireActual('react-native');
  return { ExerciseAnimation: ({ accessibilityLabel }: { accessibilityLabel: string }) => <View accessibilityLabel={accessibilityLabel} /> };
});

const routes = {
  _layout: () => <Stack />,
  '(tabs)/_layout': TabLayout,
  '(tabs)/index': Home,
  '(tabs)/workout': Workout,
  '(tabs)/progress': Progress,
  '(tabs)/nutrition': Nutrition,
  '(tabs)/profile': Profile,
  'exercise/index': ExerciseLibrary,
  'exercise/[id]': ExerciseDetail,
};

let errors: unknown[][] = [];
const origError = console.error;

beforeEach(() => {
  createTestDb();
  errors = [];
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
});

afterEach(() => {
  console.error = origError;
});

const URLS = ['/', '/workout', '/progress', '/nutrition', '/profile', '/exercise', '/exercise/ex_bench_press', '/exercise/ex_rowing_machine'];

describe('screens render', () => {
  it.each(URLS)('%s', async (url) => {
    await renderRouter(routes, { initialUrl: url });
    expect(screen.toJSON()).toBeTruthy();
    expect(errors.map((e) => e.map(String).join(' ').slice(0, 800))).toEqual([]);
  });
});
