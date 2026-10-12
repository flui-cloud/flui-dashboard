import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApplicationService } from '../../service/application.service';
import {
  DbSession,
  DbSessionsInfo,
  DbSessionsService,
} from '../../service/db-sessions.service';
import { AppSessionsTabComponent } from './app-sessions-tab.component';

const session = (over: Partial<DbSession> = {}): DbSession => ({
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
  xactAgeMs: 2000,
  queryAgeMs: 2000,
  stateAgeMs: 2000,
  writing: false,
  query: 'SELECT ?',
  blockedBy: [],
  blocks: 0,
  actions: { cancel: true, terminate: true, reason: null },
  ...over,
});

const INFO: DbSessionsInfo = {
  engine: 'postgres',
  capturedAt: '2026-10-12T07:00:05.000Z',
  truncated: false,
  maxConnections: 100,
  total: 3,
  counts: { active: 1, idle: 0, idleInTransaction: 1, waiting: 0, blocked: 1 },
  sessions: [
    session({
      pid: 11,
      state: 'idle in transaction',
      blocks: 1,
      clientApp: { id: 'a-1', name: 'talk-api' },
      actions: { cancel: false, terminate: true, reason: 'No statement is running to cancel.' },
    }),
    session({ pid: 12, blockedBy: [11], query: 'UPDATE t SET v = ?' }),
    session({
      pid: 13,
      kind: 'replication',
      clientAddr: '10.99.0.2',
      actions: { cancel: false, terminate: false, reason: 'A replica reads from this session.' },
    }),
  ],
  pooler: null,
};

const POSTGRES_APP = {
  id: 'db-1',
  category: 'database',
  labels: { 'flui.cloud/db-engine': 'postgres', 'flui.cloud/app-type': 'building-block' },
  imageRef: 'ghcr.io/flui-cloud/flui-postgres:17',
};

describe('AppSessionsTabComponent', () => {
  let fixture: ComponentFixture<AppSessionsTabComponent>;
  let act: jasmine.Spy;
  let list: jasmine.Spy;
  let closeClient: jasmine.Spy;
  const selected = signal<unknown>(POSTGRES_APP);

  beforeEach(async () => {
    selected.set(POSTGRES_APP);
    list = jasmine.createSpy('list').and.callFake(() => of(INFO));
    act = jasmine
      .createSpy('act')
      .and.callFake(() => of({ pid: 12, action: 'terminate', message: 'Session 12 closed.' }));
    closeClient = jasmine
      .createSpy('closeClient')
      .and.callFake(() => of({ clientId: 5, pod: 'pg-pooler-1', message: 'Pooled connection 5 closed.' }));
    await TestBed.configureTestingModule({
      imports: [AppSessionsTabComponent],
      providers: [
        { provide: ApplicationService, useValue: { selectedApplication: selected } },
        { provide: DbSessionsService, useValue: { list, act, closeClient } },
      ],
    }).compileComponents();
  });

  const render = (): HTMLElement => {
    fixture = TestBed.createComponent(AppSessionsTabComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const q = (el: HTMLElement, id: string) =>
    el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it('says the database in one line before any table', () => {
    const el = render();
    expect(q(el, 'sessions-summary')?.textContent).toContain('3 connected · 1 running · 1 blocked');
    expect(list).toHaveBeenCalledWith('db-1', false);
  });

  it('marks the blocker and draws the waiting session under it', () => {
    const el = render();
    expect(q(el, 'session-blocking-11')?.textContent).toContain('blocking 1');
    const rows = Array.from(el.querySelectorAll('tbody tr')).map((r) => r.getAttribute('data-testid'));
    expect(rows.indexOf('session-12')).toBe(rows.indexOf('session-11') + 1);
  });

  it('keeps details behind a click', () => {
    const el = render();
    expect(q(el, 'session-detail-12')).toBeNull();
    q(el, 'session-12')!.click();
    fixture.detectChanges();
    expect(q(el, 'session-detail-12')?.textContent).toContain('UPDATE t SET v = ?');
  });

  it('turns off what the API refuses and says why', () => {
    const el = render();
    const cancel = q(el, 'session-cancel-13') as HTMLButtonElement;
    const close = q(el, 'session-terminate-13') as HTMLButtonElement;
    expect(cancel.disabled).toBeTrue();
    expect(close.disabled).toBeTrue();
    expect(close.title).toBe('A replica reads from this session.');
    expect((q(el, 'session-cancel-11') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('asks before closing a session, then sends the start time the list returned', () => {
    const el = render();
    (q(el, 'session-terminate-12') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(act).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Close this session?');
    const confirm = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Close session',
    ) as HTMLButtonElement;
    confirm.click();
    fixture.detectChanges();
    expect(act).toHaveBeenCalledWith(
      'db-1',
      jasmine.objectContaining({ pid: 12, backendStart: '2026-10-12T07:00:00.123Z' }),
      'terminate',
    );
    expect(q(el, 'sessions-notice')?.textContent).toContain('Session 12 closed.');
  });

  it('reads nothing for a database that is not PostgreSQL', () => {
    selected.set({ ...POSTGRES_APP, labels: { 'flui.cloud/db-engine': 'mariadb', 'flui.cloud/app-type': 'building-block' } });
    const el = render();
    expect(q(el, 'sessions-unsupported')).not.toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('keeps the pooler behind a disclosure and closes a pooled connection after asking', () => {
    list.and.callFake(() =>
      of({
        ...INFO,
        pooler: {
          mode: 'transaction',
          paused: false,
          upstream: 'local',
          reason: null,
          pools: [
            {
              pod: 'pg-pooler-1',
              database: 'app',
              user: 'app',
              clientsActive: 1,
              clientsWaiting: 0,
              serversActive: 1,
              serversIdle: 0,
              maxWaitMs: 0,
            },
          ],
          clients: [
            {
              pod: 'pg-pooler-1',
              id: 5,
              addr: '10.42.0.15',
              clientApp: { id: 'a-1', name: 'talk-api' },
              user: 'app',
              database: 'app',
              state: 'active',
              waitMs: 0,
              serverPid: 12,
              applicationName: '',
              connectTime: '2026-10-12 07:00:00 UTC',
              canClose: true,
            },
          ],
        },
      }),
    );
    const el = render();
    expect(q(el, 'sessions-pooler-summary')?.textContent).toContain('transaction mode · 1 clients · 0 waiting');
    expect(q(el, 'pooled-client-5')).toBeNull();
    q(el, 'sessions-pooler-toggle')!.click();
    fixture.detectChanges();
    (q(el, 'pooled-client-close-5') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(closeClient).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Close this pooled connection?');
    const confirm = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Close connection',
    ) as HTMLButtonElement;
    confirm.click();
    fixture.detectChanges();
    expect(closeClient).toHaveBeenCalledWith(
      'db-1',
      jasmine.objectContaining({ id: 5, pod: 'pg-pooler-1', connectTime: '2026-10-12 07:00:00 UTC' }),
    );
    expect(q(el, 'sessions-notice')?.textContent).toContain('Pooled connection 5 closed.');
  });
});
