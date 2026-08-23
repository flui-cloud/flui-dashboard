import {
  formatCountdown,
  isSandboxRefusal,
  sandboxAreaForUrl,
  sandboxFailureMessage,
  sandboxRefusalCode,
} from './sandbox.service';

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

describe('telling a refusal from a failure', () => {
  const refusal = (code: string) => ({ status: 403, error: { code } });

  it('recognises the route fence', () => {
    expect(isSandboxRefusal(refusal('SANDBOX_ROUTE_FORBIDDEN'))).toBe(true);
  });

  it('recognises the codes the single-code check used to miss', () => {
    expect(isSandboxRefusal(refusal('SANDBOX_STAND_IN'))).toBe(true);
    expect(isSandboxRefusal(refusal('SANDBOX_READ_ONLY'))).toBe(true);
    expect(isSandboxRefusal(refusal('SANDBOX_CLUSTER_NOT_OWNED'))).toBe(true);
  });

  it('covers a code the API has not shipped yet', () => {
    expect(isSandboxRefusal(refusal('SANDBOX_SOMETHING_NEW'))).toBe(true);
  });

  it('leaves an ordinary failure alone', () => {
    expect(isSandboxRefusal({ status: 500, error: { code: 'INTERNAL' } })).toBe(
      false,
    );
    expect(isSandboxRefusal({ status: 403, error: 'Forbidden' })).toBe(false);
    expect(isSandboxRefusal(new Error('offline'))).toBe(false);
    expect(isSandboxRefusal(null)).toBe(false);
  });

  it('hands back the code so a caller can say which limit it was', () => {
    expect(sandboxRefusalCode(refusal('SANDBOX_STAND_IN'))).toBe(
      'SANDBOX_STAND_IN',
    );
    expect(sandboxRefusalCode({ error: { code: 42 } })).toBeNull();
  });

  it('puts nothing in the error slot for a refusal, and the fallback otherwise', () => {
    expect(sandboxFailureMessage(refusal('SANDBOX_STAND_IN'), 'broke')).toBeNull();
    expect(sandboxFailureMessage(new Error('offline'), 'broke')).toBe('broke');
  });
});

describe('the area a screen belongs to', () => {
  it('reads the area off the route', () => {
    expect(sandboxAreaForUrl('/infrastructure/keys')).toBe('keys');
    expect(sandboxAreaForUrl('/infrastructure/domains/zones')).toBe('dns-zones');
    expect(sandboxAreaForUrl('/management/backup/policies')).toBe('backups');
  });

  it('lets the longer prefix win', () => {
    expect(sandboxAreaForUrl('/infrastructure/platform-components')).toBe(
      'platform-config',
    );
  });

  it('claims nothing it was not given', () => {
    expect(sandboxAreaForUrl('/dashboard')).toBeNull();
    expect(sandboxAreaForUrl('/applications/abc')).toBeNull();
  });
});
