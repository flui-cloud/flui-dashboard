import { formatCountdown } from './sandbox.service';

describe('formatCountdown', () => {
  it('shows hours while there are hours left', () => {
    expect(formatCountdown(86_399)).toBe('23:59:59');
    expect(formatCountdown(3_600)).toBe('01:00:00');
  });

  it('drops to minutes and seconds under the hour', () => {
    expect(formatCountdown(3_599)).toBe('59:59');
    expect(formatCountdown(61)).toBe('01:01');
    expect(formatCountdown(9)).toBe('00:09');
  });

  it('never renders a negative clock', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-120)).toBe('00:00');
  });
});
