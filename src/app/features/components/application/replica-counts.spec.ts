import { replicaCountsOf } from './replica-counts';

describe('replicaCountsOf', () => {
  it('reads the cluster first, so a fresh scale is not hidden by a lagging series', () => {
    expect(
      replicaCountsOf({ replicas: { ready: 3, desired: 4 } }, { replicas_ready: 1, replicas_desired: 1 }, 1),
    ).toEqual({ ready: 3, desired: 4 });
  });

  it('falls back to the series, then to the stored count, until the cluster answers', () => {
    expect(replicaCountsOf(null, { replicas_ready: 1, replicas_desired: 2 }, 5)).toEqual({ ready: 1, desired: 2 });
    expect(replicaCountsOf(null, null, 2)).toEqual({ ready: 0, desired: 2 });
  });
});
