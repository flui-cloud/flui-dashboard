import { formatEgressPorts, parseEgressPorts } from './egress.service';

describe('egress ports', () => {
  it('reads TCP by default and UDP when written', () => {
    expect(parseEgressPorts('80, 443,123/udp')).toEqual([
      { port: 80, protocol: 'TCP' },
      { port: 443, protocol: 'TCP' },
      { port: 123, protocol: 'UDP' },
    ]);
  });

  it('says why a value is not a port', () => {
    expect(parseEgressPorts('smtp')).toBe('"smtp" is not a port between 1 and 65535');
    expect(parseEgressPorts('25/icmp')).toBe('"25/icmp": the protocol must be tcp or udp');
  });

  it('writes ports back the way a person types them', () => {
    expect(formatEgressPorts([{ port: 443, protocol: 'TCP' }, { port: 123, protocol: 'UDP' }])).toBe('443, 123/udp');
  });
});
