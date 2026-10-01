import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FleetReadState, FleetService, NeedsYou } from '../../service/fleet.service';
import { DashboardDnsService } from '../../service/dashboard-dns.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardNeedsYouComponent } from './dashboard-needs-you.component';

const NEEDS: NeedsYou = {
  generatedAt: '2026-09-27T12:00:00.000Z',
  count: 2,
  items: [
    {
      id: 'cluster:c-9',
      kind: 'cluster_broken',
      level: 'critical',
      title: 'wc-9 is in error',
      detail: 'Open the cluster to see what failed',
      action: { label: 'Open cluster', path: '/cluster/c-9/overview' },
    },
    {
      id: 'credential:github_app',
      kind: 'credential',
      level: 'warning',
      title: 'Connect your GitHub account',
      detail: 'The GitHub App is set up; your account is not linked yet',
      action: { label: 'Manage', path: '/settings?tab=github' },
      credential: { kind: 'github_app', status: 'missing', expiresAt: null },
    },
    {
      id: 'cluster:c-2',
      kind: 'cluster_operation',
      level: 'info',
      title: 'wc-2 is being created',
      detail: 'Provisioning cluster · nothing to do',
      action: null,
    },
  ],
};

describe('DashboardNeedsYouComponent', () => {
  let fixture: ComponentFixture<DashboardNeedsYouComponent>;
  const state = signal<FleetReadState>('ready');
  const needs = signal<NeedsYou | null>(NEEDS);
  const needsSetup = signal(false);
  let fleet: { needsYou: typeof needs; needsYouState: typeof state; loadNeedsYou: jasmine.Spy };
  let notifications: { triggerAction: jasmine.Spy };

  const el = (): HTMLElement => fixture.nativeElement;
  const q = (id: string) => el().querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    state.set('ready');
    needs.set(NEEDS);
    needsSetup.set(false);
    fleet = { needsYou: needs, needsYouState: state, loadNeedsYou: jasmine.createSpy('loadNeedsYou') };
    notifications = { triggerAction: jasmine.createSpy('triggerAction') };
    await TestBed.configureTestingModule({
      imports: [DashboardNeedsYouComponent],
      providers: [
        provideRouter([]),
        { provide: FleetService, useValue: fleet },
        {
          provide: DashboardDnsService,
          useValue: { hasStatus: () => true, needsSetup: () => needsSetup() },
        },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardNeedsYouComponent);
    fixture.detectChanges();
  });

  it('lists what the API raised, most urgent first, with a count of what asks for action', () => {
    expect(q('needs-you-count')?.textContent?.trim()).toBe('2');
    const rows = Array.from(el().querySelectorAll('[data-testid^="needs-you-cluster"], [data-testid^="needs-you-credential"]')).map((r) => r.textContent);
    expect(rows[0]).toContain('wc-9 is in error');
    expect(rows[1]).toContain('Connect your GitHub account');
    expect(rows[2]).toContain('wc-2 is being created');
  });

  it('links an item to its path, keeping the query', () => {
    const link = q('needs-you-credential:github_app') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/settings?tab=github');
    expect((q('needs-you-cluster:c-2') as HTMLElement).tagName).toBe('DIV');
  });

  it('adds the DNS step when DNS is not set up, and opens the wizard from it', () => {
    needsSetup.set(true);
    fixture.detectChanges();
    expect(q('needs-you-count')?.textContent?.trim()).toBe('3');
    const dns = q('needs-you-dns') as HTMLButtonElement;
    expect(dns.textContent).toContain('Set up DNS & certificates');
    dns.click();
    expect(notifications.triggerAction).toHaveBeenCalledWith('open-cert-wizard');
  });

  it('lists the apps with data and no backup, each with a link that opens a prefilled policy', () => {
    needs.set({
      generatedAt: '',
      count: 1,
      items: [
        {
          id: 'backup:apps-without-backup',
          kind: 'apps_without_backup',
          level: 'warning',
          title: '2 apps with data and no backup',
          detail: 'pg and umami-db',
          action: { label: 'Open backups', path: '/management/backup' },
          applications: [
            {
              applicationId: 'a-1',
              name: 'pg',
              kind: 'DATABASE',
              clusterId: 'c-1',
              clusterName: 'wc-1',
              reason: 'left_out',
              lastSuccessAt: null,
              protect: { label: 'Protect', path: '/management/backup/policies/new?clusterId=c-1&applicationId=a-1' },
            },
          ],
        },
      ],
    });
    fixture.detectChanges();
    const protect = q('needs-you-protect-a-1') as HTMLAnchorElement;
    expect(protect.textContent).toContain('Protect');
    expect(protect.getAttribute('href')).toBe('/management/backup/policies/new?clusterId=c-1&applicationId=a-1');
    expect(q('needs-you-backup:apps-without-backup')!.textContent).toContain('pg');
    expect((q('needs-you-app-a-1') as HTMLAnchorElement).getAttribute('href')).toBe('/apps/applications/a-1');
    needs.set(NEEDS);
  });

  it('opens the application instead of offering a policy that would not help, and says why', () => {
    needs.set({
      generatedAt: '',
      count: 1,
      items: [
        {
          id: 'backup:apps-without-backup',
          kind: 'apps_without_backup',
          level: 'warning',
          title: '1 app with data and no backup',
          detail: 'Orders DB',
          action: { label: 'Open backups', path: '/apps/applications/a-2/snapshots' },
          applications: [
            {
              applicationId: 'a-2',
              name: 'Orders DB',
              slug: 'pg-orders',
              kind: 'DATABASE',
              clusterId: 'c-1',
              clusterName: 'wc-1',
              reason: 'no_policy',
              pendingReason: 'the database is not running yet',
              lastSuccessAt: null,
              protect: null,
              open: { label: 'Open application', path: '/apps/applications/a-2' },
              backups: { label: 'Open backups', path: '/apps/applications/a-2/snapshots' },
            },
          ],
        },
      ],
    });
    fixture.detectChanges();
    expect(q('needs-you-protect-a-2')).toBeNull();
    const open = q('needs-you-open-a-2') as HTMLAnchorElement;
    expect(open.textContent).toContain('Open backups');
    expect(open.getAttribute('href')).toBe('/apps/applications/a-2/snapshots');
    expect((q('needs-you-app-a-2') as HTMLAnchorElement).getAttribute('href')).toBe('/apps/applications/a-2');
    expect(q('needs-you-why-a-2')!.textContent).toContain('The database is not running yet.');
    expect(q('needs-you-backup:apps-without-backup')!.textContent).toContain('pg-orders · wc-1');
    needs.set(NEEDS);
  });

  it('says nothing needs the person when the list is empty', () => {
    needs.set({ generatedAt: '', count: 0, items: [] });
    fixture.detectChanges();
    expect(q('needs-you-empty')).not.toBeNull();
    expect(q('needs-you-count')).toBeNull();
  });

  it('offers a retry when the read failed', () => {
    needs.set(null);
    state.set('error');
    fixture.detectChanges();
    (q('needs-you-error')!.querySelector('button') as HTMLButtonElement).click();
    expect(fleet.loadNeedsYou).toHaveBeenCalled();
  });

  it('hides itself when the read is refused', () => {
    state.set('forbidden');
    fixture.detectChanges();
    expect(q('needs-you')).toBeNull();
  });
});
