import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, EmptyState, NumberInput, ProgressBar } from '../ui';

describe('UI components', () => {
  it('Button fires onPress and exposes an accessible label', async () => {
    const onPress = jest.fn();
    await render(<Button title="Start workout" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled Button does not fire', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('NumberInput commits parsed numbers immediately and ignores partial input', async () => {
    const onCommit = jest.fn();
    await render(<NumberInput value={null} onCommit={onCommit} accessibilityLabel="Weight" />);
    const input = screen.getByLabelText('Weight');
    await fireEvent.changeText(input, '72,5');
    expect(onCommit).toHaveBeenLastCalledWith(72.5);
    await fireEvent.changeText(input, '-');
    expect(onCommit).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(input, '');
    expect(onCommit).toHaveBeenLastCalledWith(null);
  });

  it('integer NumberInput rounds', async () => {
    const onCommit = jest.fn();
    await render(<NumberInput value={5} onCommit={onCommit} decimals={false} accessibilityLabel="Reps" />);
    await fireEvent.changeText(screen.getByLabelText('Reps'), '8.6');
    expect(onCommit).toHaveBeenLastCalledWith(9);
  });

  it('EmptyState renders title, message and action', async () => {
    const onAction = jest.fn();
    await render(<EmptyState title="No workouts yet" message="Start one" action="Go" onAction={onAction} />);
    expect(screen.getByText('No workouts yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('ProgressBar clamps its accessible value', async () => {
    await render(<ProgressBar progress={1.7} />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });
});

describe('NumberInput debounced commits', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { flushPendingInputs } = require('../ui');
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('commits once after typing pauses, not per keystroke', async () => {
    const onCommit = jest.fn();
    await render(<NumberInput value={null} onCommit={onCommit} debounceMs={500} accessibilityLabel="Kg" />);
    const input = screen.getByLabelText('Kg');
    for (const t of ['1', '10', '102', '102.5']) await fireEvent.changeText(input, t);
    expect(onCommit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(102.5);
  });

  it('flushPendingInputs commits immediately (buttons call it before onPress)', async () => {
    const onCommit = jest.fn();
    await render(<NumberInput value={null} onCommit={onCommit} debounceMs={500} accessibilityLabel="Reps" />);
    await fireEvent.changeText(screen.getByLabelText('Reps'), '12');
    flushPendingInputs();
    expect(onCommit).toHaveBeenCalledWith(12);
    jest.advanceTimersByTime(1000);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('a Button press flushes pending input before running its handler', async () => {
    const order: string[] = [];
    await render(
      <>
        <NumberInput value={null} onCommit={() => order.push('commit')} debounceMs={500} accessibilityLabel="W" />
        <Button title="Done" onPress={() => order.push('press')} />
      </>,
    );
    await fireEvent.changeText(screen.getByLabelText('W'), '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(order).toEqual(['commit', 'press']);
  });
});
