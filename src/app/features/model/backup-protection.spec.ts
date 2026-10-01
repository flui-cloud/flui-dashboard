import {
  ProtectedApp,
  policyEngineLabel,
  protectedAppLine,
  protectionEngineLabel,
} from './backup-protection.models';
import { alertCtaLabel, alertCtaPath } from './backup-status.models';

function app(over: Partial<ProtectedApp>): ProtectedApp {
  return {
    applicationId: 'a1',
    name: 'shop',
    outcome: 'protected',
    at: '2026-10-01T02:00:00.000Z',
    ...over,
  };
}

describe('backup protection labels', () => {
  it('names each engine the way the CLI does', () => {
    expect(protectionEngineLabel('kopia')).toBe('Volume backups');
    expect(protectionEngineLabel('postgres-dump')).toBe('Scheduled dumps (postgres)');
    expect(protectionEngineLabel('pgbackrest')).toBe('Continuous backup (pgbackrest)');
    expect(protectionEngineLabel(undefined)).toBe('Protected');
  });

  it('says what each app got, or why it got nothing', () => {
    expect(protectedAppLine(app({ engine: 'kopia' }))).toBe('Volume backups');
    expect(protectedAppLine(app({ outcome: 'already_protected' }))).toBe('Already has a policy');
    expect(protectedAppLine(app({ outcome: 'needs_decision' }))).toBe('Needs a decision');
    expect(protectedAppLine(app({ outcome: 'skipped', reason: 'system' }))).toBe(
      'part of Flui, covered by the platform backup',
    );
    expect(protectedAppLine(app({ outcome: 'skipped', reason: 'no_data' }))).toBe('keeps no data');
    expect(protectedAppLine(app({ outcome: 'failed', reason: 'destination unreachable' }))).toBe(
      'destination unreachable',
    );
  });

  it('labels policies by engine, dumps apart from continuous', () => {
    expect(policyEngineLabel('volume_copy')).toBe('Volume backups');
    expect(policyEngineLabel('database', 'mariadb-dump')).toBe('Database (dumps)');
    expect(policyEngineLabel('database', 'mariadb')).toBe('Database (continuous)');
    expect(policyEngineLabel('platform')).toBe('Flui itself');
  });

  it('sends the needs-decision alert to the overview, where each volume is decided', () => {
    const alert = {
      severity: 'warning' as const,
      code: 'VOLUMES_NEED_DECISION',
      message: '2 volume(s) cannot be backed up consistently.',
    };
    expect(alertCtaPath(alert)).toBe('/management/backup/overview');
    expect(alertCtaLabel(alert)).toBe('Decide');
  });
});
