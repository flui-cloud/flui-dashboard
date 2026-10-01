import { CreateBackupPolicyDto } from '../../../../core/api/model/createBackupPolicyDto';
import { BackupPolicyProfile } from '../../../model/backup.models';

export const PROFILE_DESCRIPTION: Record<BackupPolicyProfile, string> = {
  single: 'Primary only. 1× storage cost.',
  mirrored: 'Primary + 1 replica cross-provider. 2× cost. Recommended.',
  custom: 'Multiple destinations with custom retention.',
};

export interface PolicyWizardDraft {
  form: CreateBackupPolicyDto;
  profile: BackupPolicyProfile;
  destinations: Array<{ destinationId: string; role: 'primary' | 'replica' }>;
  pauseDuringCopy: boolean;
  keepMonthly: boolean;
  namespacesText: string;
  labelSelector: string;
  applicationIds: string[];
}

/** The create body the wizard's answers make. */
export function policyDtoOf(draft: PolicyWizardDraft): CreateBackupPolicyDto {
  const { form } = draft;
  const dto: CreateBackupPolicyDto = {
    ...form,
    profile: draft.profile,
    destinations: draft.destinations
      .filter((d) => d.destinationId)
      .map((d, i) => ({ destinationId: d.destinationId, role: d.role, priority: i })),
  };
  if (!dto.cronSchedule) delete dto.cronSchedule;
  if (form.engineClass === 'volume_copy') {
    delete dto.retentionMaxCopies;
    const metadata = {
      ...(draft.pauseDuringCopy ? { pauseDuringCopy: true } : {}),
      ...(draft.keepMonthly ? { keepMonthly: true } : {}),
    };
    if (Object.keys(metadata).length) dto.metadata = metadata;
  }
  if (form.scope === 'namespaces') {
    const namespaces = draft.namespacesText.split(',').map((s) => s.trim()).filter(Boolean);
    dto.scopeSelector = { namespaces };
  } else if (form.scope === 'label_selector') {
    dto.scopeSelector = { labelSelector: draft.labelSelector };
  } else if (form.scope === 'applications') {
    dto.scopeSelector = { applicationIds: draft.applicationIds };
  }
  return dto;
}
