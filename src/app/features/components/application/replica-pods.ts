export interface ReplicaPod {
  name: string;
  node: string | null;
  serverType?: string | null;
  region?: string | null;
  phase: string;
  ready: boolean;
}

const LIVE_PHASES = new Set(['Running', 'Pending']);

/**
 * The pods behind the replica count, and how many others the cluster still
 * lists: ended pods (failed, evicted, completed) and pods beyond the desired
 * count during a rollout. Ready pods come first, so a surplus is never one of them.
 */
export function replicaPodsOf<T extends ReplicaPod>(
  pods: readonly T[] | null | undefined,
  desired: number,
): { current: T[]; older: number } {
  const all = pods ?? [];
  const live = all
    .filter((p) => LIVE_PHASES.has(p.phase))
    .sort((a, b) => Number(b.ready) - Number(a.ready));
  const keep = Math.max(desired, live.filter((p) => p.ready).length);
  const current = live.slice(0, keep);
  return { current, older: all.length - current.length };
}

export function placementOf(pod: ReplicaPod): string {
  return [pod.serverType, pod.region].filter((v): v is string => !!v).join(' · ');
}
