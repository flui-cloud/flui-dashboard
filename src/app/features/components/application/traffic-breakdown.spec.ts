import { breakdownOf } from './traffic-breakdown';

const code = (c: string, rps: number) => ({ code: c, requests_per_second: rps });

describe('traffic breakdown', () => {
  const codes = [
    code('0', 0),
    code('304', 0.4),
    code('200', 0.36),
    code('401', 0.3),
    code('404', 0.03),
    code('204', 0),
    code('502', 0),
    code('503', 0),
  ];

  it('shows the four busiest and keeps the rest, zeros included, behind Show all', () => {
    const view = breakdownOf(codes, false);
    expect(view.rows.map((r) => r.code)).toEqual(['304', '200', '401', '404']);
    expect(view.hidden).toBe(4);
  });

  it('never shows an entry with no requests while others have some', () => {
    const view = breakdownOf([code('200', 1), code('500', 0), code('404', 0)], false);
    expect(view.rows.map((r) => r.code)).toEqual(['200']);
    expect(view.hidden).toBe(2);
  });

  it('still fills the box when nothing had a request', () => {
    const view = breakdownOf([code('200', 0), code('404', 0), code('500', 0), code('301', 0), code('503', 0)], false);
    expect(view.rows).toHaveSize(4);
    expect(view.hidden).toBe(1);
  });

  it('reads an unknown rate as no requests', () => {
    expect(breakdownOf([code('200', 1), { code: '500', requests_per_second: null }], false).rows).toHaveSize(1);
  });

  it('shows everything, busiest first, when asked', () => {
    const view = breakdownOf(codes, true);
    expect(view.rows).toHaveSize(codes.length);
    expect(view.rows[0].code).toBe('304');
    expect(view.hidden).toBe(0);
  });
});
