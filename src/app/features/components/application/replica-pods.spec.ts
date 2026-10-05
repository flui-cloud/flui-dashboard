import { ReplicaPod, placementOf, replicaPodsOf } from './replica-pods';

const pod = (name: string, phase: string, ready: boolean, node: string | null = 'node-1'): ReplicaPod => ({
  name,
  node,
  phase,
  ready,
});

describe('replicaPodsOf', () => {
  it('keeps the ready pod and folds the ended pods of earlier rollouts into one count', () => {
    const { current, older } = replicaPodsOf(
      [
        pod('a', 'Failed', false),
        pod('b', 'Running', true),
        pod('c', 'Failed', false),
        pod('d', 'Succeeded', false),
        pod('e', 'Unknown', false),
      ],
      1,
    );
    expect(current.map((p) => p.name)).toEqual(['b']);
    expect(older).toBe(4);
  });

  it('shows a pod still starting or waiting for a node while it is part of the desired count', () => {
    const { current, older } = replicaPodsOf(
      [pod('a', 'Running', true), pod('b', 'Pending', false, null)],
      2,
    );
    expect(current.map((p) => p.name)).toEqual(['a', 'b']);
    expect(older).toBe(0);
  });

  it('counts a surplus pod of a rollout as older, never a ready one', () => {
    const { current, older } = replicaPodsOf(
      [pod('new', 'Running', false), pod('old', 'Running', true)],
      1,
    );
    expect(current.map((p) => p.name)).toEqual(['old']);
    expect(older).toBe(1);
  });

  it('keeps every ready pod when the desired count lags a scale', () => {
    const { current, older } = replicaPodsOf([pod('a', 'Running', true), pod('b', 'Running', true)], 1);
    expect(current).toHaveSize(2);
    expect(older).toBe(0);
  });

  it('answers nothing without pods', () => {
    expect(replicaPodsOf(undefined, 3)).toEqual({ current: [], older: 0 });
  });
});

describe('placementOf', () => {
  it('joins the server type and region it knows', () => {
    expect(placementOf({ ...pod('a', 'Running', true), serverType: 'cx22', region: 'fsn1' })).toBe('cx22 · fsn1');
    expect(placementOf({ ...pod('a', 'Running', true), serverType: null, region: 'fsn1' })).toBe('fsn1');
  });
});
