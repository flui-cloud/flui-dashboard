import type { AppHistoryPoint } from '../../model/application.models';
import { lastReadinessDip, recentThrottlePercent, throttleNotice } from './app-monitoring-history';

const at = (minute: number): string => new Date(Date.UTC(2026, 9, 9, 10, minute)).toISOString();

function point(minute: number, over: Partial<AppHistoryPoint> = {}): AppHistoryPoint {
  return { timestamp: minute * 60, datetime: at(minute), ...over };
}

describe('monitoring history signals', () => {
  it('takes the worst throttling of the last 15 minutes, not just the last point', () => {
    const points = [
      point(0, { cpu_throttled_percent: 90 }),
      point(40, { cpu_throttled_percent: 60 }),
      point(50, { cpu_throttled_percent: 10 }),
      point(55, { cpu_throttled_percent: 5 }),
    ];
    expect(recentThrottlePercent(points)).toBe(60);
    expect(throttleNotice(points)).toBe(60);
  });

  it('stays quiet below 25% and without throttling data', () => {
    expect(throttleNotice([point(0, { cpu_throttled_percent: 24.9 })])).toBeNull();
    expect(throttleNotice([point(0, { cpu_utilization_percent: 80 })])).toBeNull();
    expect(throttleNotice([])).toBeNull();
  });

  it('finds the last step where fewer replicas were ready than desired', () => {
    const points = [
      point(0, { replicas_ready: 1, replicas_desired: 2 }),
      point(10, { replicas_ready: 2, replicas_desired: 2 }),
      point(20, { replicas_ready: 0, replicas_desired: 2 }),
      point(30, { replicas_ready: 2, replicas_desired: 2 }),
      point(40, {}),
    ];
    expect(lastReadinessDip(points)).toBe(at(20));
  });

  it('reports no dip when every step was ready or carried no data', () => {
    expect(lastReadinessDip([point(0, { replicas_ready: 2, replicas_desired: 2 }), point(1, {})])).toBeNull();
  });
});
