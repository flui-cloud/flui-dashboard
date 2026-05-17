import { AddWorkerResponseDto } from '../../core/api/model/addWorkerResponseDto';
import { RemoveWorkerResponseDto } from '../../core/api/model/removeWorkerResponseDto';

export type WorkerOperationType = 'add_worker' | 'remove_worker';

export type OperationWarning =
  | { code: 'CORDON_FAILED'; reason: string }
  | { code: 'CORDON_SKIPPED'; reason: string }
  | { code: 'DRAIN_FAILED'; reason: string; details?: { nodeName: string } }
  | { code: 'DRAIN_SKIPPED'; reason: string };

export interface WorkerOperationEnvelope {
  operationId: string;
  clusterId: string;
  type: WorkerOperationType;
  estimatedDuration: string;
  createdAt: string;
}

export type AddWorkerErrorKind =
  | 'no-vnet'
  | 'not-ready'
  | 'max-nodes'
  | 'min-nodes'
  | 'count-range'
  | 'master-protected'
  | 'not-found'
  | 'generic';

export interface WorkerError {
  kind: AddWorkerErrorKind;
  message: string;
}

export function fromAddResponse(
  res: AddWorkerResponseDto,
  clusterId: string,
): WorkerOperationEnvelope {
  return {
    operationId: res.operation_id,
    clusterId,
    type: 'add_worker',
    estimatedDuration: res.estimated_duration,
    createdAt: res.created_at,
  };
}

export function fromRemoveResponse(
  res: RemoveWorkerResponseDto,
  clusterId: string,
): WorkerOperationEnvelope {
  return {
    operationId: res.operation_id,
    clusterId,
    type: 'remove_worker',
    estimatedDuration: res.estimated_duration,
    createdAt: res.created_at,
  };
}
