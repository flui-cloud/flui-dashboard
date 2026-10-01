import { CreateBackupPolicyDto } from '../../../../core/api/model/createBackupPolicyDto';
import { policyDtoOf } from './policy-wizard.dto';

const form = (over: Partial<CreateBackupPolicyDto> = {}): CreateBackupPolicyDto => ({
  name: 'protect-pg',
  clusterId: 'c1',
  scope: 'applications',
  engineClass: 'volume_copy',
  cronSchedule: '',
  retentionDays: 30,
  retentionMaxCopies: 14,
  profile: 'single',
  destinations: [],
  ...over,
});

const draft = { profile: 'single' as const, pauseDuringCopy: false, keepMonthly: false, namespacesText: '', labelSelector: '' };

describe('policyDtoOf', () => {
  it('sends the chosen application ids, never typed text', () => {
    const dto = policyDtoOf({
      ...draft,
      form: form(),
      destinations: [
        { destinationId: 'd1', role: 'primary' },
        { destinationId: '', role: 'replica' },
      ],
      applicationIds: ['app-1'],
      pauseDuringCopy: true,
    });
    expect(dto.scopeSelector).toEqual({ applicationIds: ['app-1'] });
    expect(dto.destinations).toEqual([{ destinationId: 'd1', role: 'primary', priority: 0 }]);
    expect(dto.metadata).toEqual({ pauseDuringCopy: true });
    expect('cronSchedule' in dto).toBeFalse();
    expect('retentionMaxCopies' in dto).toBeFalse();
  });

  it('keeps the copies limit for a database and reads namespaces from the list', () => {
    const db = policyDtoOf({ ...draft, form: form({ engineClass: 'database' }), destinations: [], applicationIds: ['pg'] });
    expect(db.retentionMaxCopies).toBe(14);
    const ns = policyDtoOf({
      ...draft,
      form: form({ engineClass: 'platform', scope: 'namespaces' }),
      destinations: [],
      applicationIds: [],
      namespacesText: 'prod, app-prod ,',
    });
    expect(ns.scopeSelector).toEqual({ namespaces: ['prod', 'app-prod'] });
  });
});
