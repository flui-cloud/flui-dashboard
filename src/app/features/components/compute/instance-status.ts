import { StatusTone } from '../../../ui/primitives/status';
import { InstanceOwnership } from '../../model/instance.models';

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  running: { label: 'Running', tone: 'success' },
  stopped: { label: 'Stopped', tone: 'neutral' },
  starting: { label: 'Starting', tone: 'progress' },
  stopping: { label: 'Stopping', tone: 'progress' },
  provisioning: { label: 'Provisioning', tone: 'progress' },
  rebuilding: { label: 'Rebuilding', tone: 'progress' },
  migrating: { label: 'Migrating', tone: 'progress' },
  deleting: { label: 'Deleting', tone: 'progress' },
  error: { label: 'Error', tone: 'error' },
  failed: { label: 'Failed', tone: 'error' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};

export const INSTANCE_STATUS_FILTERS = ['running', 'stopped', 'starting', 'stopping', 'error'].map(
  (value) => ({ value, label: STATUS[value].label }),
);

export function instanceStatusTone(status: string | null | undefined): StatusTone {
  return STATUS[(status ?? '').toLowerCase()]?.tone ?? 'neutral';
}

export function instanceStatusLabel(status: string | null | undefined): string {
  const known = STATUS[(status ?? '').toLowerCase()];
  if (known) return known.label;
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const OWNERSHIP: Record<
  InstanceOwnership,
  { label: string; tone: StatusTone; hint: string | null }
> = {
  self: { label: 'Managed by Flui', tone: 'success', hint: null },
  'other-flui': {
    label: 'Other installation',
    tone: 'warning',
    hint: 'Provisioned by another Flui installation sharing this cloud provider account',
  },
  unmanaged: { label: 'Unmanaged', tone: 'neutral', hint: null },
};

export function instanceOwnershipView(ownership: InstanceOwnership): {
  label: string;
  tone: StatusTone;
  hint: string | null;
} {
  return OWNERSHIP[ownership] ?? OWNERSHIP.unmanaged;
}

export function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

export function formatDisk(mb: number): string {
  if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(0)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}
