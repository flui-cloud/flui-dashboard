import {
  joinCpu,
  joinMemory,
  memoryMi,
  readableMemory,
  splitCpu,
  splitMemory,
} from './resource-quantity';

describe('resource quantities', () => {
  it('always writes whole Mi, never a fraction of a byte', () => {
    expect(joinMemory(2.26, 'Gi')).toBe('2315Mi');
    expect(joinMemory(1.5, 'Gi')).toBe('1536Mi');
    expect(joinMemory(2, 'Gi')).toBe('2Gi');
    expect(joinMemory(300.2, 'Mi')).toBe('301Mi');
    expect(joinMemory(0, 'Mi')).toBeNull();
    expect(joinMemory(Number.NaN, 'Gi')).toBeNull();
  });

  it('always writes whole millicores', () => {
    expect(joinCpu(1.6, 'cores')).toBe('1600m');
    expect(joinCpu(2, 'cores')).toBe('2');
    expect(joinCpu(250, 'm')).toBe('250m');
    expect(joinCpu(-1, 'm')).toBeNull();
  });

  it('reads what the cluster stores, including millibytes', () => {
    expect(memoryMi('2426656522240m')).toBe(2315);
    expect(splitMemory('2Gi')).toEqual({ amount: 2, unit: 'Gi' });
    expect(splitMemory('1536Mi')).toEqual({ amount: 1.5, unit: 'Gi' });
    expect(splitMemory('2315Mi')).toEqual({ amount: 2315, unit: 'Mi' });
    expect(splitMemory('nonsense')).toBeNull();
    expect(splitCpu('1.5')).toEqual({ amount: 1.5, unit: 'cores' });
    expect(splitCpu('250m')).toEqual({ amount: 250, unit: 'm' });
    expect(readableMemory('1536Mi')).toBe('1.5 GiB');
  });
});
