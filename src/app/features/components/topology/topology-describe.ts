import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyLinkDto } from '../../../core/api/model/topologyLinkDto';
import { TopologyInboundRuleDto } from '../../../core/api/model/topologyInboundRuleDto';
import { TopologyFocus } from './topology-state';
import { cpu, memory, overlayLabel, percent, rps, statusLabel, toneOf } from './topology-format';
import { isFailing } from './topology-graph';
import { shortName } from './topology-tiles';

const FLUI_NETWORK: Record<string, string> = {
  active: 'Connected',
  pending: 'Waiting for its first handshake',
  stale: 'Not answering',
  none: 'Not on it',
};

export interface InspectorRow {
  key: string;
  label: string;
  detail: string;
  tone?: string;
  focus?: TopologyFocus;
}

export interface InspectorView {
  kind: string;
  title: string;
  subtitle?: string;
  status?: string;
  tone?: string;
  reason?: string | null;
  facts: { label: string; value: string }[];
  sections: { title: string; rows: InspectorRow[] }[];
}

type Snapshot = TopologyResponseDto;
type Section = InspectorView['sections'][number];

export function describeFocus(focus: TopologyFocus | null, t: Snapshot | null): InspectorView | null {
  if (!focus || !t) return null;
  switch (focus.type) {
    case 'cluster':
      return describeCluster(t, focus.id);
    case 'server':
      return describeServer(t, focus.id);
    case 'stack':
      return describeStack(t, focus.id);
    case 'app':
      return describeApp(t, focus.id);
    case 'link':
      return describeLink(t, focus.id);
  }
}

const clusterNameIn = (t: Snapshot, id: string) => t.clusters.find((c) => c.id === id)?.name ?? '—';
const appIn = (t: Snapshot, id: string | undefined) => t.apps.find((a) => a.id === id);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** A section only when it has rows: an empty heading says nothing. */
const section = (title: string, rows: InspectorRow[]): Section[] => (rows.length ? [{ title, rows }] : []);

function routeUrl(l: TopologyLinkDto): string {
  const path = l.routePath && l.routePath !== '/' ? l.routePath : '';
  return `https://${l.routeHost ?? '—'}${path}`;
}

function describeCluster(t: Snapshot, id: string): InspectorView {
  const c = t.clusters.find((x) => x.id === id)!;
  const problems = t.apps.filter((a) => a.clusterId === c.id && a.status !== 'running');
  const open: Section[] = c.inbound
    ? [{ title: 'Open to the Internet', rows: c.inbound.length ? c.inbound.map((r, i) => inboundRow(r, i)) : [{ key: 'in-none', label: 'Nothing', detail: '' }] }]
    : [];
  return {
    kind: 'Cluster',
    title: c.name,
    subtitle: `${c.provider} · ${c.region}`,
    status: statusLabel(c.status),
    tone: toneOf(c.status),
    facts: [
      { label: 'Reached over', value: overlayLabel(c.overlay) },
      { label: 'Servers', value: `${c.counts.servers}` },
      { label: 'Apps', value: `${c.counts.apps}` },
      { label: 'Stacks', value: `${c.counts.stacks}` },
      ...(c.inbound === null ? [{ label: 'Firewall', value: 'None managed by Flui' }] : []),
    ],
    sections: [
      ...section('Needs attention', problems.map((a) => appRow(a, a.statusReason ?? statusLabel(a.status)))),
      ...open,
    ],
  };
}

function inboundRow(r: TopologyInboundRuleDto, i: number): InspectorRow {
  const what = r.port ? `:${r.port}` : r.protocol.toUpperCase();
  return {
    key: `in-${i}`,
    label: `${what} · ${r.description}`,
    detail: r.fromAnywhere ? 'from anywhere' : `from ${plural(r.sourceCount, 'range')}`,
  };
}

const ARCHITECTURE: Record<string, string> = { arm: 'Arm', x86: 'x86' };

function describeServer(t: Snapshot, id: string): InspectorView {
  const s = t.servers.find((x) => x.id === id)!;
  const hosted = t.apps.filter((a) => a.replicas.some((r) => r.serverId === s.id));
  const reserved = s.capacity ? `${memory(s.capacity.requestedMemMi)} of ${memory(s.capacity.allocatableMemMi)}` : '—';
  return {
    kind: 'Server',
    title: s.nodeName,
    subtitle: `${clusterNameIn(t, s.clusterId)} · ${s.provider}`,
    status: statusLabel(s.status),
    tone: toneOf(s.status),
    facts: [
      { label: 'Type', value: s.serverType ?? '—' },
      { label: 'Architecture', value: ARCHITECTURE[s.architecture ?? ''] ?? '—' },
      { label: 'Memory used', value: percent(s.capacity?.usedMemPct) },
      { label: 'CPU used', value: percent(s.capacity?.usedCpuPct) },
      { label: 'Memory reserved', value: reserved },
      { label: 'Replicas', value: `${s.podCount}` },
      { label: 'Flui network', value: FLUI_NETWORK[s.fluiNetwork] ?? '—' },
      { label: 'Private network', value: s.privateNetwork ? 'Yes' : 'No' },
    ],
    sections: [{
      title: 'Runs here',
      rows: hosted.map((a) => appRow(a, `×${a.replicas.find((r) => r.serverId === s.id)!.count}`)),
    }],
  };
}

function describeStack(t: Snapshot, id: string): InspectorView {
  const st = t.stacks.find((x) => x.id === id)!;
  const members = st.appIds.map((appId) => appIn(t, appId)!).filter(Boolean);
  return {
    kind: st.type === 'composed' ? 'Stack' : 'App',
    title: st.name,
    subtitle: clusterNameIn(t, st.clusterId),
    status: statusLabel(st.status),
    tone: toneOf(st.status),
    facts: [{ label: 'Apps', value: `${members.length}` }],
    sections: [{
      title: 'Apps',
      rows: members.map((a) => appRow(a, `×${a.replicaCount} on ${plural(a.replicas.length, 'server')}`)),
    }],
  };
}

function describeApp(t: Snapshot, id: string): InspectorView {
  const a = appIn(t, id)!;
  const routes = t.links.filter((l) => l.from.kind === 'internet' && l.to.appId === a.id);
  const ingress = routes.find((l) => l.traffic.measured) ?? routes[0];
  const talksTo = t.links.filter((l) => l.from.appId === a.id && l.to.appId);
  const calledBy = t.links.filter((l) => l.to.appId === a.id && l.from.appId);
  return {
    kind: 'App',
    title: a.displayName,
    subtitle: `${clusterNameIn(t, a.clusterId)} · ${a.exposure}`,
    status: statusLabel(a.status),
    tone: toneOf(a.status),
    reason: a.statusReason,
    facts: [
      { label: 'Replicas', value: `${a.replicaCount}` },
      { label: 'Memory request', value: memory(a.ramRequestMB) },
      { label: 'CPU request', value: cpu(a.cpuRequestM) },
      { label: 'Traffic in', value: ingress ? rps(ingress.traffic.rps) : '—' },
    ],
    sections: [
      { title: 'Replicas', rows: a.replicas.map((r) => replicaRow(t, r.serverId, r.count)) },
      ...section('Reachable from the Internet', routes.map(routeRow)),
      ...section('Called by', calledBy.map((l) => appRow(appIn(t, l.from.appId)!, l.label))),
      ...section('Talks to', talksTo.map((l) => appRow(appIn(t, l.to.appId)!, l.label))),
    ],
  };
}

function replicaRow(t: Snapshot, serverId: string, count: number): InspectorRow {
  const s = t.servers.find((x) => x.id === serverId);
  const siblings = t.servers.filter((x) => x.clusterId === s?.clusterId).map((x) => x.nodeName);
  return {
    key: serverId,
    label: s ? shortName(s.nodeName, siblings) : serverId,
    detail: `×${count} · ${s ? clusterNameIn(t, s.clusterId) : ''}`,
    focus: { type: 'server', id: serverId },
  };
}

function routeRow(l: TopologyLinkDto): InspectorRow {
  const detail = [l.targetPort ? `→ :${l.targetPort}` : '', l.traffic.measured ? rps(l.traffic.rps) : ''];
  return {
    key: l.id,
    label: routeUrl(l),
    detail: detail.filter(Boolean).join(' · '),
    tone: isFailing(l) ? 'error' : undefined,
    focus: { type: 'link', id: l.id },
  };
}

function crossingLabel(l: TopologyLinkDto): string {
  if (!l.crossCluster) return 'No';
  return l.viaTunnel ? 'Yes, over the Flui network' : 'Yes, on a public address';
}

function describeLink(t: Snapshot, id: string): InspectorView {
  const l = t.links.find((x) => x.id === id)!;
  const from = l.from.kind === 'internet' ? 'Internet' : (appIn(t, l.from.appId)?.displayName ?? '—');
  const to = appIn(t, l.to.appId)?.displayName ?? '—';
  return {
    kind: 'Link',
    title: `${from} → ${to}`,
    subtitle: l.routeHost ? routeUrl(l) : l.label,
    facts: [
      ...(l.targetPort ? [{ label: 'Delivered to', value: `:${l.targetPort}` }] : []),
      { label: 'Declared by', value: l.source.replace('-', ' ') },
      { label: 'Between clusters', value: crossingLabel(l) },
      { label: 'Traffic', value: l.traffic.measured ? rps(l.traffic.rps) : 'Not measured' },
      { label: 'Errors', value: l.traffic.measured ? percent(l.traffic.errorPct) : '—' },
    ],
    sections: [],
  };
}

function appRow(a: { id: string; displayName: string; status: string }, detail: string): InspectorRow {
  return { key: a.id, label: a.displayName, detail, tone: toneOf(a.status), focus: { type: 'app', id: a.id } };
}
