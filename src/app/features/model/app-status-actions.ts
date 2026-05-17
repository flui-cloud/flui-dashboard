/**
 * V3 status → available actions map.
 * Defines which actions are allowed for each application status.
 */

export type AppAction = 'deploy' | 'rollback' | 'stop' | 'start' | 'delete' | 'reconcile' | 'update_config';

export const STATUS_ACTIONS: Record<string, AppAction[]> = {
  pending:        ['deploy', 'delete'],
  awaiting_build: [],
  provisioning:   [],
  running:        ['deploy', 'rollback', 'stop', 'update_config', 'reconcile'],
  updating:       [],
  rolling_back:   [],
  stopped:        ['start', 'deploy', 'delete'],
  degraded:       ['deploy', 'rollback', 'stop', 'reconcile'],
  failed:         ['deploy', 'rollback', 'delete', 'reconcile'],
  deleting:       [],
};

export function isActionAvailable(status: string, action: AppAction): boolean {
  return (STATUS_ACTIONS[status] ?? []).includes(action);
}

export function getAvailableActions(status: string): AppAction[] {
  return STATUS_ACTIONS[status] ?? [];
}
