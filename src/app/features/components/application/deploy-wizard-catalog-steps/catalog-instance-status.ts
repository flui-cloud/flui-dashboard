import { CatalogReusableInstanceDto } from '../../../../core/api/model/catalogReusableInstanceDto';
import { StatusTone } from '../../../../ui/primitives/status';

type InstanceStatus = CatalogReusableInstanceDto.StatusEnum;

const STATES: Record<InstanceStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: 'progress', label: 'Pending' },
  awaiting_build: { tone: 'progress', label: 'Awaiting build' },
  provisioning: { tone: 'progress', label: 'Provisioning' },
  waiting_for_room: { tone: 'warning', label: 'Waiting for room' },
  running: { tone: 'success', label: 'Running' },
  degraded: { tone: 'warning', label: 'Degraded' },
  stopped: { tone: 'neutral', label: 'Stopped' },
  updating: { tone: 'progress', label: 'Updating' },
  rolling_back: { tone: 'progress', label: 'Rolling back' },
  failed: { tone: 'error', label: 'Failed' },
  deleting: { tone: 'progress', label: 'Deleting' },
  deleted: { tone: 'neutral', label: 'Deleted' },
};

export function instanceState(status: InstanceStatus): { tone: StatusTone; label: string } {
  return STATES[status] ?? { tone: 'neutral', label: status };
}
