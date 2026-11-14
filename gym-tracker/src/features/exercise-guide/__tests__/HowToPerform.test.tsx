import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { EXERCISE_GUIDES } from '../guides';
import { HowToPerform } from '../HowToPerform';

// Reanimated's native runtime can't start in Jest; the figure is tested in guides.test.ts.
jest.mock('../ExerciseAnimation', () => {
  const { Text } = jest.requireActual('react-native');
  return { ExerciseAnimation: ({ playing }: { playing: boolean }) => <Text>{playing ? 'animating' : 'still'}</Text> };
});

let listener: ((v: boolean) => void) | null = null;

function mockReduceMotion(initial: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(initial);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, fn: (v: boolean) => void) => {
    listener = fn;
    return { remove: () => (listener = null) };
  }) as never);
}

afterEach(() => jest.restoreAllMocks());

const guide = EXERCISE_GUIDES.ex_sumo_deadlift;

describe('HowToPerform', () => {
  it('plays by default when reduce motion is off', async () => {
    mockReduceMotion(false);
    await render(<HowToPerform guide={guide} exerciseName="Sumo Deadlift" />);
    expect(await screen.findByText('animating')).toBeTruthy();
  });

  it('stays still with reduce motion on, follows later changes, and lets the user override', async () => {
    mockReduceMotion(true);
    await render(<HowToPerform guide={guide} exerciseName="Sumo Deadlift" />);
    expect(await screen.findByText('still')).toBeTruthy();

    await act(async () => listener?.(false));
    expect(screen.getByText('animating')).toBeTruthy();
    await act(async () => listener?.(true));
    expect(screen.getByText('still')).toBeTruthy();

    // An explicit choice wins over the system setting from then on.
    await fireEvent.press(screen.getByRole('button', { name: 'Play animation' }));
    expect(screen.getByText('animating')).toBeTruthy();
    await act(async () => listener?.(true));
    expect(screen.getByText('animating')).toBeTruthy();
  });

  it('marks back-of-body muscles that a front view cannot show', async () => {
    mockReduceMotion(false);
    await render(<HowToPerform guide={guide} exerciseName="Sumo Deadlift" />);
    expect(screen.getByText(/Hamstrings \(back, not shown\)/)).toBeTruthy();
    expect(screen.queryByText(/Traps \(back, not shown\)/)).toBeNull();
  });
});
