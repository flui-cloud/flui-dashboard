import { FleetRoom } from '../../model/scaling-group.models';
import { nodeUsageLine, roomLine, share } from './room-format';

const room = (fit: FleetRoom['largestFit']): FleetRoom => ({ nodes: [], largestFit: fit });

describe('the room line', () => {
  it('says the largest app that still fits, and what a bigger one does', () => {
    expect(
      roomLine(room({ memoryMi: 2150, cpuMillicores: 1430, node: 'master' }), null),
    ).toBe(
      'The largest app that still fits: 2.1 GiB · 1.4 CPU (on master). Anything bigger makes Flui buy a node.',
    );
  });

  it('does not promise a purchase from a group that buys nothing', () => {
    expect(
      roomLine(room({ memoryMi: 2150, cpuMillicores: 1430, node: 'master' }), null, false),
    ).toContain('Anything bigger needs a new node, and this group buys none on its own.');
  });

  it('puts what is waiting against the most any node has left', () => {
    expect(
      roomLine(room({ memoryMi: 2150, cpuMillicores: 1430, node: 'master' }), {
        memory: '3072Mi',
        cpu: '50m',
      }),
    ).toContain('An app waiting needs 3072Mi and 50m; the most any node has left is 2.1 GiB');
  });

  it('says so when no node takes new apps', () => {
    expect(roomLine(room(null), null)).toBe('No node takes new apps right now.');
  });

  it('never fills a bar past full', () => {
    expect(share(9000, 8000)).toBe(100);
    expect(share(1, 0)).toBe(0);
  });
});

describe('the usage line under a node', () => {
  const node = {
    name: 'master',
    role: 'master' as const,
    takesWork: true,
    allocatable: { cpuMillicores: 4000, memoryMi: 7751 },
    requested: { cpuMillicores: 1320, memoryMi: 1884 },
    free: { cpuMillicores: 2480, memoryMi: 5355 },
  };

  it('puts use and limits beside the reservation, and says when limits pass what the node holds', () => {
    expect(
      nodeUsageLine({
        ...node,
        used: { cpuMillicores: 319, memoryMi: 4170 },
        limits: { cpuMillicores: 9110, memoryMi: 8000 },
      }),
    ).toEqual({
      text: 'In use now 4.1 GiB · 0.3 CPU — at their limits 7.8 GiB · 9.1 CPU, more memory than the node holds',
      overcommitted: true,
    });
  });

  it('leaves out usage it could not read', () => {
    expect(
      nodeUsageLine({ ...node, used: null, limits: { cpuMillicores: 2000, memoryMi: 4000 } })?.text,
    ).toBe('at their limits 3.9 GiB · 2.0 CPU');
  });

  it('says nothing to an older API that sends neither', () => {
    expect(nodeUsageLine(node)).toBeNull();
  });
});
