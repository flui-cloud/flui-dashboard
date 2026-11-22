import { StatusTone } from '../../../ui/primitives/status';
import { VNetInfo, VNetStatus } from '../../model/vnet.models';

const STATUS: Record<VNetStatus, { tone: StatusTone; label: string }> = {
  [VNetStatus.ACTIVE]: { tone: 'success', label: 'Active' },
  [VNetStatus.PENDING]: { tone: 'progress', label: 'Pending' },
  [VNetStatus.FAILED]: { tone: 'error', label: 'Failed' },
  [VNetStatus.DELETING]: { tone: 'progress', label: 'Deleting' },
  [VNetStatus.DELETED]: { tone: 'neutral', label: 'Deleted' },
};

export function vnetStatus(status: VNetStatus | string): { tone: StatusTone; label: string } {
  return STATUS[status as VNetStatus] ?? { tone: 'neutral', label: status || 'Unknown' };
}

export function vnetProviderLabel(
  vnet: Pick<VNetInfo, 'implementation' | 'provider'>,
  displayName?: (id: string) => string | undefined,
): string {
  if (vnet.implementation === 'wireguard') return 'Built by Flui';
  return displayName?.(vnet.provider) ?? vnet.provider;
}
