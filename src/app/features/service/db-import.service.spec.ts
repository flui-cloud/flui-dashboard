import { bytesText } from './db-import.service';

describe('db import in the dashboard', () => {
  it('sizes bytes for people', () => {
    expect(bytesText(900)).toBe('900 B');
    expect(bytesText(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(bytesText(250 * 1024 * 1024 * 1024)).toBe('250 GB');
  });
});
