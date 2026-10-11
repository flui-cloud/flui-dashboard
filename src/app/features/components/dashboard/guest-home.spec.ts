import { NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { appTiles, bytes, copiesOf, historyRange } from './guest-home';

const point = (cpu: number, memory: number) => ({
  cpu_utilization_percent: cpu,
  memory_utilization_percent: memory,
  memory_usage_bytes: 35_291_136,
  network_receive_rate: 700,
  network_transmit_rate: 1000,
  replicas_ready: 1,
  replicas_desired: 1,
});

describe('guest home readings', () => {
  const reading = {
    history: { data_points: [point(0.2, 13), point(0.25, 13.1), point(0.2, 13), point(0.3, 13.2)] },
    traffic: { data_points: [{ requests_per_second: 2 }, { requests_per_second: 2.5 }] },
  };

  it('reads an application’s latest figures into tiles', () => {
    expect(appTiles(reading).map((t) => `${t.label} ${t.value}${t.unit ?? ''}`)).toEqual([
      'CPU 0.3%',
      'Memory 13.2%',
      'Requests 2.5/s',
      'Network 2 KB/s',
    ]);
  });

  it('draws each figure’s history in the operator’s colours', () => {
    const tiles = appTiles(reading);
    expect(tiles[0].spark).toEqual([0.2, 0.25, 0.2, 0.3]);
    expect(tiles.map((t) => t.color)).toEqual(NODE_SERIES_COLORS);
    expect(tiles[0].delta).toBeDefined();
  });

  it('shows dashes, not zeros, before the first reading', () => {
    expect(appTiles(undefined).map((t) => t.value)).toEqual(['—', '—', '—', '—']);
    expect(appTiles(undefined)[0].footnote).toBe('reading…');
  });

  it('counts copies from the latest reading', () => {
    expect(copiesOf(reading)).toBe('1/1');
    expect(copiesOf(undefined)).toBeNull();
  });

  it('asks for sixty points across the window', () => {
    const range = historyRange('3h', Date.parse('2026-10-11T12:00:00Z'));
    expect(range).toEqual({ start: '2026-10-11T09:00:00.000Z', end: '2026-10-11T12:00:00.000Z', step: '180s' });
  });

  it('writes sizes the way people read them', () => {
    expect(bytes(35_291_136)).toBe('34 MB');
    expect(bytes(1_536)).toBe('1.5 KB');
  });
});
