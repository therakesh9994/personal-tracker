import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useQuery } from '../useQuery';
import { notifyDataChanged } from '@/stores/dataStore';

function Probe({ fn, enabled }: { fn: () => number; enabled: boolean }) {
  const { data } = useQuery(fn, [], { enabled });
  return <Text>{data == null ? 'none' : String(data)}</Text>;
}

describe('useQuery enabled option', () => {
  it('does not run while disabled, even when data changes, and runs again when enabled', async () => {
    const fn = jest.fn(() => 42);
    const r = await render(<Probe fn={fn} enabled />);
    expect(fn).toHaveBeenCalledTimes(1);
    await r.rerender(<Probe fn={fn} enabled={false} />);
    await act(() => {
      notifyDataChanged();
      notifyDataChanged();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    await r.rerender(<Probe fn={fn} enabled />);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(r.getByText('42')).toBeTruthy();
  });
});
