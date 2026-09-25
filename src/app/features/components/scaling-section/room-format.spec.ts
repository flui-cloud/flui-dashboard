import { FleetRoom } from '../../model/scaling-group.models';
import { roomLine, share } from './room-format';

const room = (fit: FleetRoom['largestFit']): FleetRoom => ({ nodes: [], largestFit: fit });

describe('the room line', () => {
  it('says the largest app that still fits, and what a bigger one does', () => {
    expect(
      roomLine(room({ memoryMi: 2150, cpuMillicores: 1430, node: 'master' }), null),
    ).toBe(
      'The largest app that still fits: 2.1 GiB · 1.4 CPU (on master). Anything bigger makes Flui buy a node.',
    );
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
