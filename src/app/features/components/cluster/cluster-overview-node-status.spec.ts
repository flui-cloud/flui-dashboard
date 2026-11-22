import {
  nodeStatusTone as tone,
  buildOverviewNodeRows,
  findNodeMetrics,
} from './cluster-overview-nodes';
import { InstanceWithLabels } from '../../model/instance.models';
import { ServerMetricsState } from '../../service/cluster-monitoring.service';

describe('cluster overview — a node status says what Flui knows', () => {
  it('is healthy only when the node actually joined', () => {
    expect(tone('ready')).toBe('success');
  });

  it('shows a node that never joined as a problem', () => {
    expect(tone('error')).toBe('error');
  });

  it('shows work in progress as progress, not as health', () => {
    expect(tone('creating')).toBe('progress');
    expect(tone('joining')).toBe('progress');
    expect(tone('deleting')).toBe('progress');
  });

  it('never calls a provider status healthy', () => {
    expect(tone('running')).not.toBe('success');
  });

  it('promises nothing about a value it does not recognise', () => {
    expect(tone(undefined)).toBe('neutral');
    expect(tone('something-new')).toBe('neutral');
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

const metrics = (
  serverId: string,
  instance: string,
  cpu: number,
  memory: number,
): ServerMetricsState =>
  ({
    serverId,
    instance,
    cpu: { current: cpu },
    memory: { current: memory },
  }) as ServerMetricsState;

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
    expect(rows).toHaveSize(6);
    expect(rows[0].role).toBe('master');
  });

  it('links to the server only when it has one at a provider', () => {
    expect(buildOverviewNodeRows([node({})], [])[0].link).toEqual([
      '/infrastructure/compute',
      'hetzner',
      '42',
    ]);
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
