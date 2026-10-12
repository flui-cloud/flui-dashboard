import { DbSession, DbSessionsInfo } from '../../service/db-sessions.service';
import {
  confirmCopy,
  confirmDetails,
  formatAge,
  orderByBlocker,
  stateLabel,
  summaryLine,
  waitingOn,
  whoOf,
} from './app-sessions-view';

const sessionFixture = (over: Partial<DbSession> = {}): DbSession => ({
  pid: 1,
  backendStart: '2026-10-12T07:00:00.123Z',
  kind: 'client',
  via: 'direct',
  user: 'owner',
  database: 'app',
  applicationName: '',
  clientAddr: '10.42.0.15',
  clientApp: null,
  state: 'active',
  waitEventType: null,
  waitEvent: null,
  xactAgeMs: null,
  queryAgeMs: null,
  stateAgeMs: null,
  writing: false,
  query: 'SELECT ?',
  blockedBy: [],
  blocks: 0,
  actions: { cancel: true, terminate: true, reason: null },
  ...over,
});

const infoFixture = (over: Partial<DbSessionsInfo> = {}): DbSessionsInfo => ({
  engine: 'postgres',
  capturedAt: '2026-10-12T07:00:05.000Z',
  truncated: false,
  maxConnections: 100,
  total: 14,
  counts: { active: 3, idle: 10, idleInTransaction: 0, waiting: 0, blocked: 1 },
  sessions: [],
  pooler: null,
  ...over,
});

describe('app-sessions-view', () => {
  it('draws blocked sessions under the one they wait for', () => {
    const rows = orderByBlocker([
      sessionFixture({ pid: 3, blockedBy: [2] }),
      sessionFixture({ pid: 2, blockedBy: [1] }),
      sessionFixture({ pid: 1, blocks: 1 }),
    ]);
    expect(rows.map((r) => [r.session.pid, r.depth])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
  });

  it('says the whole database in one line, and the pooler when there is one', () => {
    expect(summaryLine(infoFixture())).toBe('14 connected · 3 running · 1 blocked');
    expect(
      summaryLine(
        infoFixture({
          pooler: {
            mode: 'transaction',
            paused: false,
            upstream: 'local',
            reason: null,
            pools: [
              {
                pod: 'p',
                database: 'app',
                user: 'app',
                clientsActive: 30,
                clientsWaiting: 2,
                serversActive: 5,
                serversIdle: 3,
                maxWaitMs: 0,
              },
            ],
            clients: [],
          },
        }),
      ),
    ).toBe('14 connected · 3 running · 1 blocked · 2 waiting in the pooler');
  });

  it('names the application, the pooler hop and the pod', () => {
    expect(whoOf(sessionFixture({ clientApp: { id: 'a', name: 'talk-api' } }))).toBe('talk-api');
    expect(whoOf(sessionFixture({ kind: 'pooler', via: 'pooler' }))).toBe('10.42.0.15 · via pooler');
    expect(whoOf(sessionFixture({ kind: 'local', via: 'socket', clientAddr: null }))).toBe(
      'Inside the database pod',
    );
  });

  it('falls back to the name the client gave itself, without the host the pooler appends', () => {
    expect(whoOf(sessionFixture({ applicationName: 'holder' }))).toBe('holder');
    expect(whoOf(sessionFixture({ via: 'pooler', applicationName: 'waiter - 10.42.0.140:47134' }))).toBe(
      'waiter · via pooler',
    );
  });

  it('calls a blocked session waiting, and says on what', () => {
    const s = sessionFixture({ blockedBy: [4], waitEventType: 'Lock', waitEvent: 'tuple' });
    expect(stateLabel(s)).toBe('waiting for a lock');
    expect(waitingOn(s)).toBe('session 4');
    expect(waitingOn(sessionFixture({ waitEventType: 'Client', waitEvent: 'ClientRead' }))).toBeNull();
  });

  it('reads ages plainly', () => {
    expect(formatAge(null)).toBe('—');
    expect(formatAge(65_000)).toBe('1m 5s');
  });

  it('shows the masked statement in the confirmation', () => {
    expect(confirmDetails(sessionFixture({ pid: 9, query: 'UPDATE t SET v = ?' }))).toContain(
      'Statement: UPDATE t SET v = ?',
    );
  });

  it('words each confirmation for what it does', () => {
    expect(confirmCopy(null)).toBeNull();
    expect(confirmCopy({ kind: 'session', session: sessionFixture(), action: 'cancel' })?.variant).toBe('warning');
    expect(confirmCopy({ kind: 'session', session: sessionFixture(), action: 'terminate' })?.variant).toBe('danger');
    const client = confirmCopy({
      kind: 'client',
      client: {
        pod: 'pg-pooler-1',
        id: 5,
        addr: '10.42.0.15',
        clientApp: null,
        user: 'app',
        database: 'app',
        state: 'active',
        waitMs: 0,
        serverPid: 12,
        applicationName: '',
        connectTime: '2026-10-12 07:00:00 UTC',
        canClose: true,
      },
    });
    expect(client?.confirmText).toBe('Close connection');
    expect(client?.details).toContain('Holds database session 12');
  });
});
