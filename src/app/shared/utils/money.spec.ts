import { formatMoney, formatMonthly } from './money';

describe('formatMoney', () => {
  it('writes two decimals and the currency whatever precision arrives', () => {
    expect(formatMoney('11.2400')).toBe('€11.24');
    expect(formatMoney('10.3600000000')).toBe('€10.36');
    expect(formatMoney(0.0049)).toBe('€0.00');
    expect(formatMoney(1234.5)).toBe('€1,234.50');
    expect(formatMoney(3, 'USD')).toBe('$3.00');
  });

  it('shows a dash for a figure that does not exist rather than a zero', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney('not a number')).toBe('—');
    expect(formatMonthly(null)).toBe('—');
  });

  it('quotes a monthly price per month', () => {
    expect(formatMonthly('4.5100000000')).toBe('€4.51/mo');
  });
});
