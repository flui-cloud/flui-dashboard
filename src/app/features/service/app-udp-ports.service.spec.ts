import { udpPortsAdvice, udpPortsOf } from './app-udp-ports.service';

describe('app UDP ports', () => {
  const view = (state: 'open' | 'closed' | 'unmanaged' | 'pending' | 'not-published') => ({
    clusterId: 'c',
    firewallId: 'f',
    ports: [{ name: 'media', port: 10000, state }],
  });

  it('reads the ports an app was created with, whatever the client knows of them', () => {
    expect(udpPortsOf({ udpPorts: [{ name: 'media', port: 10000 }] })).toEqual([
      { name: 'media', port: 10000 },
    ]);
    expect(udpPortsOf({ udpPorts: null })).toEqual([]);
    expect(udpPortsOf(null)).toEqual([]);
  });

  it('points a closed port at Cluster Firewalls', () => {
    expect(udpPortsAdvice(view('closed'))).toContain('Cluster Firewalls');
  });

  it('says nothing when every port is open', () => {
    expect(udpPortsAdvice(view('open'))).toBeNull();
  });

  it('tells a trial guest the port will not exist', () => {
    expect(udpPortsAdvice(view('not-published'))).toContain('Trial');
  });
});
