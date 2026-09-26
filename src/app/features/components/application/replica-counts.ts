/**
 * One reading of an application's replicas for every place on its page: the
 * cluster as read now first, the metrics series only when the cluster has not
 * answered yet, because the series lags a scale by a scrape or two.
 */
export function replicaCountsOf(
  runtime: { replicas?: { ready?: number | null; desired?: number | null } | null } | null | undefined,
  metrics: { replicas_ready?: number | null; replicas_desired?: number | null } | null | undefined,
  storedReplicas: number | null | undefined,
): { ready: number; desired: number } {
  const live = runtime?.replicas;
  const ready = live?.ready ?? metrics?.replicas_ready ?? 0;
  const desired =
    live?.desired ?? metrics?.replicas_desired ?? storedReplicas ?? 0;
  return { ready, desired };
}
