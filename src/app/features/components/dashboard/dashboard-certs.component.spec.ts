import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppDnsInfo, DashboardDnsService, DashboardDnsStatus } from '../../service/dashboard-dns.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardCertsComponent } from './dashboard-certs.component';

const app = (complete: boolean, domain: string | null): AppDnsInfo => ({
  applicationId: 'a',
  endpointId: domain ? 'e' : null,
  domain,
  certStatus: null,
  certMessage: null,
  ingressConfigured: complete,
  stagingCertConfigured: false,
  prodCertConfigured: complete,
  synced: complete,
  syncedDomain: complete ? domain : null,
  lastSyncedAt: complete ? '2026-09-27T12:00:00.000Z' : null,
  isComplete: complete,
});

describe('DashboardCertsComponent', () => {
  let fixture: ComponentFixture<DashboardCertsComponent>;
  const status = signal<DashboardDnsStatus | null>(null);

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  const build = async (firstStep: boolean) => {
    await TestBed.configureTestingModule({
      imports: [DashboardCertsComponent],
      providers: [
        provideRouter([]),
        {
          provide: DashboardDnsService,
          useValue: {
            status,
            loading: signal(false),
            targetClusterId: signal('c-1'),
            hasStatus: () => status() !== null,
            needsSetup: () => !status()?.dnsZoneConfigured,
            isFullyConfigured: () => !!status()?.fullyConfigured,
            refresh: () => undefined,
          },
        },
        {
          provide: NotificationService,
          useValue: {
            add: () => undefined,
            removeByCategory: () => undefined,
            hasCategory: () => true,
            registerAction: () => undefined,
            unregisterAction: () => undefined,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardCertsComponent);
    fixture.componentRef.setInput('firstStep', firstStep);
    fixture.detectChanges();
  };

  it('leads a fresh install with DNS as the first step', async () => {
    status.set({
      dnsZoneConfigured: false,
      hasEndpoints: false,
      fullyConfigured: false,
      fluiApi: app(false, null),
      fluiWeb: app(false, null),
      zitadel: app(false, null),
    });
    await build(true);
    const hero = q('certs-first-step')!;
    expect(hero.textContent).toContain('first step');
    expect(hero.textContent).toContain('DNS not configured');
    expect(hero.textContent).toContain('Set up DNS & Certificates');
    expect(hero.querySelectorAll('.border-b')).toHaveSize(3);
    expect(q('certs-card')).toBeNull();
  });

  it('shows the posture card with how many endpoints are synced', async () => {
    status.set({
      dnsZoneConfigured: true,
      hasEndpoints: true,
      fullyConfigured: false,
      fluiApi: app(true, 'api.example.com'),
      fluiWeb: app(true, 'dashboard.example.com'),
      zitadel: null,
    });
    await build(true);
    expect(q('certs-first-step')).toBeNull();
    expect(q('certs-subtitle')!.textContent).toContain('2 of 2 synced');
    expect(q('certs-card')!.textContent).toContain('dashboard.example.com');
  });
});
