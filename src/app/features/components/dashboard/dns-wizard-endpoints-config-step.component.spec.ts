import { validatePrefix } from './dns-wizard-endpoints-config-step.component';

describe('direct mode address prefix', () => {
  it('accepts one or several labels, since each address gets its own certificate', () => {
    expect(validatePrefix('dashboard')).toBeNull();
    expect(validatePrefix('dashboard-demo')).toBeNull();
    expect(validatePrefix('dashboard.demo')).toBeNull();
  });

  it('refuses empty parts and invalid characters', () => {
    expect(validatePrefix('dashboard..demo')).toBe('Cannot have empty parts');
    expect(validatePrefix('.demo')).toBe('Cannot have empty parts');
    expect(validatePrefix('dash_board')).toBe('Letters, numbers, hyphens and dots only');
    expect(validatePrefix('a'.repeat(64))).toBe('Each part must be 63 characters or fewer');
  });
});
