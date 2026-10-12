import {
  DbPooledClient,
  DbSession,
  DbSessionAction,
  DbSessionsInfo,
} from '../../service/db-sessions.service';

export type PendingAction =
  | { kind: 'session'; session: DbSession; action: DbSessionAction }
  | { kind: 'client'; client: DbPooledClient };

export interface SessionRow {
  session: DbSession;
  depth: number;
}

export function formatAge(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** The name a client gave itself; the pooler appends " - <host>:<port>". */
function declaredName(applicationName: string | null | undefined): string | null {
  const name = (applicationName ?? '').replace(/ - [^ ]+:\d+$/, '').trim();
  return name || null;
}

export function whoOf(s: DbSession): string {
  if (s.kind === 'replication') return 'Replication';
  if (s.kind === 'local') return 'Inside the database pod';
  const base = s.clientApp?.name ?? declaredName(s.applicationName) ?? s.clientAddr ?? 'Unknown';
  return s.via === 'pooler' ? `${base} · via pooler` : base;
}

export function stateLabel(s: DbSession): string {
  if (s.blockedBy.length) return 'waiting for a lock';
  if (s.state === 'idle in transaction') return 'idle in transaction';
  return s.state;
}

export function stateTone(s: DbSession): 'running' | 'waiting' | 'idle' | 'held' {
  if (s.blockedBy.length) return 'waiting';
  if (s.state === 'active') return 'running';
  if (s.state.startsWith('idle in transaction')) return 'held';
  return 'idle';
}

export function waitingOn(s: DbSession): string | null {
  if (s.blockedBy.length) return `session ${s.blockedBy.join(', ')}`;
  if (s.waitEventType && !['Client', 'Activity'].includes(s.waitEventType)) {
    return `${s.waitEventType} · ${s.waitEvent ?? ''}`;
  }
  return null;
}

/** One line for the whole database, the answer before any table. */
export function summaryLine(info: DbSessionsInfo): string {
  const parts = [
    `${info.total} connected`,
    `${info.counts.active} running`,
    `${info.counts.blocked} blocked`,
  ];
  if (info.counts.idleInTransaction) {
    parts.push(`${info.counts.idleInTransaction} idle in transaction`);
  }
  if (info.pooler) {
    const waiting = info.pooler.pools.reduce((n, p) => n + p.clientsWaiting, 0);
    parts.push(`${waiting} waiting in the pooler`);
  }
  return parts.join(' · ');
}

export function poolerSummary(info: DbSessionsInfo): string {
  const p = info.pooler;
  if (!p) return '';
  const waiting = p.pools.reduce((n, x) => n + x.clientsWaiting, 0);
  return `${p.mode} mode · ${p.clients.length} clients · ${waiting} waiting${p.paused ? ' · paused' : ''}`;
}

/** Blocked sessions are drawn under the session they wait for. */
export function orderByBlocker(sessions: DbSession[]): SessionRow[] {
  const byPid = new Map(sessions.map((s) => [s.pid, s]));
  const children = new Map<number, DbSession[]>();
  const roots: DbSession[] = [];
  for (const s of sessions) {
    const parent = s.blockedBy.find((p) => p !== s.pid && byPid.has(p));
    if (parent === undefined) roots.push(s);
    else children.set(parent, [...(children.get(parent) ?? []), s]);
  }
  const out: SessionRow[] = [];
  const seen = new Set<number>();
  const visit = (s: DbSession, depth: number): void => {
    if (seen.has(s.pid)) return;
    seen.add(s.pid);
    out.push({ session: s, depth });
    for (const c of children.get(s.pid) ?? []) visit(c, depth + 1);
  };
  roots.forEach((r) => visit(r, 0));
  sessions.forEach((s) => visit(s, 0));
  return out;
}

export function confirmDetails(s: DbSession): string[] {
  return [
    `Session ${s.pid}, ${whoOf(s)}`,
    `State: ${stateLabel(s)}${s.xactAgeMs !== null ? `, transaction open for ${formatAge(s.xactAgeMs)}` : ''}`,
    s.query ? `Statement: ${s.query}` : 'No statement',
  ];
}

export function pooledClientWho(c: DbPooledClient): string {
  return c.clientApp?.name ?? c.addr;
}

export interface ConfirmCopy {
  title: string;
  message: string;
  confirmText: string;
  variant: 'danger' | 'warning';
  details: string[];
}

export function confirmCopy(p: PendingAction | null): ConfirmCopy | null {
  if (!p) return null;
  if (p.kind === 'client') {
    const c = p.client;
    return {
      title: 'Close this pooled connection?',
      message:
        'The connection is closed, with the server connection it holds, and its open transaction, if any, is rolled back. The application has to reconnect.',
      confirmText: 'Close connection',
      variant: 'danger',
      details: [
        `Client ${c.id} on ${c.pod}, ${pooledClientWho(c)}`,
        `State: ${c.state}, connected ${c.connectTime}`,
        c.serverPid ? `Holds database session ${c.serverPid}` : 'Holds no database session',
      ],
    };
  }
  return p.action === 'terminate'
    ? {
        title: 'Close this session?',
        message:
          'The connection is closed and its open transaction, if any, is rolled back. The application has to reconnect.',
        confirmText: 'Close session',
        variant: 'danger',
        details: confirmDetails(p.session),
      }
    : {
        title: 'Cancel this query?',
        message:
          'The statement stops with an error in the application that sent it. The connection stays open.',
        confirmText: 'Cancel query',
        variant: 'warning',
        details: confirmDetails(p.session),
      };
}
