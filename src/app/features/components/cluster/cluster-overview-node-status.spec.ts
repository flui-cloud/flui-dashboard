import { nodeStatusDot as dot, buildOverviewNodeRows, findNodeMetrics } from './cluster-overview-nodes';
import { InstanceWithLabels } from '../../model/instance.models';
import { ServerMetricsState } from '../../service/cluster-monitoring.service';

describe('cluster overview — a node dot says what Flui knows', () => {
  it('is healthy only when the node actually joined', () => {
    expect(dot('ready')).toBe('dot-healthy');
  });

  it('shows a node that never joined as a problem', () => {
    // The case this exists for: the server is up, the bootstrap failed, and the
    // provider still calls it running.
    expect(dot('error')).toBe('dot-degraded');
  });

  it('shows work in progress as pending, not as health', () => {
    expect(dot('creating')).toBe('dot-pending');
    expect(dot('joining')).toBe('dot-pending');
    expect(dot('deleting')).toBe('dot-pending');
  });

  it('never calls a provider status healthy', () => {
    // `running` describes the machine, and a machine can be running with
    // nothing on it.
    expect(dot('running')).not.toBe('dot-healthy');
  });

  it('promises nothing about a value it does not recognise', () => {
    expect(dot(undefined)).toBe('dot-pending');
    expect(dot('something-new')).toBe('dot-pending');
  });
});

const node = (over: Partial<InstanceWithLabels> & { role?: string }): InstanceWithLabels => {
  const { role, ...rest } = over;
  return {
    id: 'n1',
    name: 'node-1',
    provider: 'hetzner',
    providerId: '42',
    status: 'running',
    region: 'fsn1',
    dataCenter: 'fsn1',
    cpuCores: 4,
    ramMb: 8192,
    metadata: { labels: { 'managed-by': 'flui-cloud', 'flui-node-type': role ?? 'worker' } },
    ...rest,
  } as InstanceWithLabels;
};

const metrics = (serverId: string, instance: string, cpu: number, memory: number): ServerMetricsState =>
  ({ serverId, instance, cpu: { current: cpu }, memory: { current: memory } }) as ServerMetricsState;

describe('cluster overview — node rows', () => {
  it('reads CPU and memory from the metrics of the same node', () => {
    const [row] = buildOverviewNodeRows([node({})], [metrics('n1', '10.0.0.2:9100', 12, 40)]);
    expect(row.cpu).toBe(12);
    expect(row.memory).toBe(40);
  });

  it('falls back to the node address when the metrics carry another id', () => {
    const n = node({ ipConfig: { v4: { ip: '10.0.0.2', gateway: '', netmaskCidr: 24 } } });
    expect(findNodeMetrics(n, [metrics('other', '10.0.0.2:9100', 1, 2)])?.serverId).toBe('other');
  });

  it('shows no usage rather than a borrowed one when nothing matches', () => {
    const [row] = buildOverviewNodeRows([node({})], [metrics('x', '10.9.9.9:9100', 50, 50)]);
    expect(row.cpu).toBeNull();
    expect(row.memory).toBeNull();
  });

  it('puts the master first and stops at six rows', () => {
    const nodes = Array.from({ length: 8 }, (_, i) =>
      node({ id: `n${i}`, name: `node-${i}`, role: i === 5 ? 'master' : 'worker' }),
    );
    const rows = buildOverviewNodeRows(nodes, []);
    expect(rows.length).toBe(6);
    expect(rows[0].role).toBe('master');
  });

  it('links to the server only when it has one at a provider', () => {
    expect(buildOverviewNodeRows([node({})], [])[0].link).toEqual(['/infrastructure/compute', 'hetzner', '42']);
    expect(buildOverviewNodeRows([node({ provider: 'byos' as never })], [])[0].link).toBeNull();
  });

  it('names a node that never joined', () => {
    const [row] = buildOverviewNodeRows([node({ status: 'error' as never })], []);
    expect(row.statusLabel).toBe('never joined');
    expect(row.failed).toBe(true);
  });

  it('carries the CPU architecture the node reports, and none it does not', () => {
    expect(buildOverviewNodeRows([node({ architecture: 'x86' })], [])[0].architecture).toBe('x86');
    expect(buildOverviewNodeRows([node({})], [])[0].architecture).toBeNull();
  });
});
