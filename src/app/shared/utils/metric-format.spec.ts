import { formatBytes, formatDelta, formatPercent, formatRate, formatUptime } from './metric-format';

describe('metric-format', () => {
  describe('formatDelta', () => {
    it('compares the live reading, not the last stored sample', () => {
      // The window ends at 39 but the poll says 45: the tile shows 45, so that
      // is what the change has to be about.
      expect(formatDelta(45, [38, 40, 42, 39, 41]).text).toBe('+5.0');
    });

    it('measures against the window median, not its first sample', () => {
      // One quiet sample an hour ago followed by a steady 40-ish rate: the first
      // sample would report a +42 swing the cluster never actually made.
      expect(formatDelta(43, [1, 38, 40, 42, 39, 41]).text).toBe('+3.5');
    });

    it('is not moved by a single spike inside the window', () => {
      const withSpike = [40, 41, 900, 39, 40, 41, 42];
      const without = [40, 41, 42, 39, 40, 41, 42];
      expect(formatDelta(44, withSpike).text).toBe(formatDelta(44, without).text);
    });

    it('formats the change in the unit of the value it sits under', () => {
      expect(formatDelta(80_000, [10_000, 10_000, 10_000, 10_000], formatRate).text).toBe('+68 KB/s');
    });

    it('flattens jitter inside a deadband proportional to the reading', () => {
      expect(formatDelta(50.3, [50, 50.2, 50.1, 50.4]).text).toBe('±0');
      expect(formatDelta(56, [50, 50.2, 50.1, 50.4]).text).toBe('+5.8');
    });

    it('reports direction, so a fall is not dressed up as a rise', () => {
      expect(formatDelta(40, [80, 80, 80, 80]).tone).toBe('down');
      expect(formatDelta(80, [40, 40, 40, 40]).tone).toBe('up');
    });

    it('says nothing when the window is too short to have a typical value', () => {
      expect(formatDelta(42, [42]).text).toBe('');
      expect(formatDelta(42, []).text).toBe('');
    });
  });

  describe('formatting', () => {
    it('scales bytes to the largest unit that keeps the number small', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(2048)).toBe('2 KB');
      expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
    });

    it('marks a missing reading rather than printing a zero', () => {
      expect(formatBytes(null)).toBe('—');
      expect(formatPercent(undefined)).toBe('—');
      expect(formatUptime(null)).toBe('—');
    });

    it('writes a rate as bytes per second', () => {
      expect(formatRate(2048)).toBe('2 KB/s');
    });

    it('drops minutes from an uptime measured in days', () => {
      expect(formatUptime(86_400 * 12 + 3600 * 4)).toBe('12d 4h');
      expect(formatUptime(3600 * 2 + 60 * 5)).toBe('2h 5m');
      expect(formatUptime(90)).toBe('1m');
    });
  });
});
