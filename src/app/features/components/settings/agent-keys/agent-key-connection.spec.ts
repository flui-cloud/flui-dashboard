import { ConnectedKey, readKeyConnection } from './agent-key-connection';

const NOW = new Date('2026-08-25T12:00:00.000Z').getTime();
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

const key = (over: Partial<ConnectedKey> = {}): ConnectedKey =>
  ({
    id: 'k1',
    name: 'laptop',
    revoked: false,
    createdAt: ago(86_400_000),
    current: false,
    ...over,
  }) as ConnectedKey;

describe('reading a key as a connection', () => {
  describe('has it ever spoken', () => {
    it('says nothing was recorded rather than claiming it was never used', () => {
      const c = readKeyConnection(key(), '1.0.0', NOW);
      expect(c.everUsed).toBeFalse();
      expect(c.seen).toBe('no use recorded yet');
    });

    it('reads a very recent contact as live', () => {
      const c = readKeyConnection(key({ lastUsedAt: ago(30_000) }), '1.0.0', NOW);
      expect(c.everUsed).toBeTrue();
      expect(c.seen).toBe('in use right now');
    });

    it('scales the phrase with the distance', () => {
      expect(readKeyConnection(key({ lastUsedAt: ago(600_000) }), '1.0.0', NOW).seen)
        .toBe('last used 10 minutes ago');
      expect(readKeyConnection(key({ lastUsedAt: ago(7_200_000) }), '1.0.0', NOW).seen)
        .toBe('last used 2 hours ago');
      expect(readKeyConnection(key({ lastUsedAt: ago(3 * 86_400_000) }), '1.0.0', NOW).seen)
        .toBe('last used 3 days ago');
    });
  });

  describe('what is it working from', () => {
    it('keeps silence apart from staleness', () => {
      const silent = readKeyConnection(key({ lastUsedAt: ago(60_000) }), '1.0.0', NOW);
      expect(silent.everCheckedIn).toBeFalse();
      expect(silent.outOfDate).toBeFalse();
      expect(silent.skill).toBe('never said which instructions it is working from');
    });

    it('names the version and the one this instance publishes when they differ', () => {
      const c = readKeyConnection(key({ skillVersion: '0.9.0' }), '1.0.0', NOW);
      expect(c.everCheckedIn).toBeTrue();
      expect(c.outOfDate).toBeTrue();
      expect(c.skill).toBe(
        'working from skill 0.9.0 — this instance publishes 1.0.0',
      );
    });

    it('says so plainly when the agent is current', () => {
      const c = readKeyConnection(key({ skillVersion: '1.0.0' }), '1.0.0', NOW);
      expect(c.outOfDate).toBeFalse();
      expect(c.skill).toBe('working from skill 1.0.0, the current one');
    });

    it('accuses nobody while the current version is unknown', () => {
      const c = readKeyConnection(key({ skillVersion: '0.9.0' }), null, NOW);
      expect(c.outOfDate).toBeFalse();
      expect(c.skill).toBe('working from skill 0.9.0');
    });

    it('treats a blank declaration as no declaration', () => {
      expect(readKeyConnection(key({ skillVersion: '  ' }), '1.0.0', NOW).everCheckedIn)
        .toBeFalse();
    });
  });

  it('describes a busy but stale agent as busy and stale', () => {
    const c = readKeyConnection(
      key({ lastUsedAt: ago(60_000), skillVersion: '0.1.0' }),
      '1.0.0',
      NOW,
    );
    expect(c.everUsed).toBeTrue();
    expect(c.outOfDate).toBeTrue();
  });
});
