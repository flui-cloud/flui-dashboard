import { isAddressOrCidr } from './cidr-validator';

describe('isAddressOrCidr', () => {
  it('accepts addresses and ranges the gateway accepts', () => {
    for (const v of [
      '203.0.113.7',
      '203.0.113.0/24',
      '0.0.0.0/0',
      '2001:db8::/32',
      '::1',
      '::/0',
    ]) {
      expect(isAddressOrCidr(v)).withContext(v).toBeTrue();
    }
  });

  it('rejects what the proxy would reject', () => {
    for (const v of [
      '999.1.1.1/40',
      '::::',
      '10.0.0.0/33',
      '2001:db8::/129',
      '10.0.0.0/',
      '10.0.0/8',
      '1.2.3.4/8/8',
      'abc',
    ]) {
      expect(isAddressOrCidr(v)).withContext(v).toBeFalse();
    }
  });
});
