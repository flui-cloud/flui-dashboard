import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ClusterDnsZoneSectionComponent } from './cluster-dns-zone-section.component';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { ClusterIssuerWebSocketService } from '../../service/cluster-issuer-websocket.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';

describe('taking a DNS zone off a cluster', () => {
  let fixture: ComponentFixture<ClusterDnsZoneSectionComponent>;

  const assignment = {
    id: 'assign-1',
    dnsZoneId: 'zone-1',
    reconciliationStatus: 'IN_SYNC',
    wildcardCertificate: false,
    dnsZone: { id: 'zone-1', zoneName: 'example.com', dnsProvider: 'hetzner' },
  } as unknown as ClusterDnsZoneResponseDto;

  async function mount(can: boolean): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ClusterDnsZoneSectionComponent],
      providers: [
        provideRouter([]),
        {
          provide: ClusterDnsZoneService,
          useValue: {
            getIssuers: () => Promise.resolve([]),
            getWildcard: () => Promise.resolve(null),
            error: () => null,
          },
        },
        {
          provide: ClusterIssuerWebSocketService,
          useValue: {
            subscribeToCluster: () => undefined,
            unsubscribeFromCluster: () => undefined,
          },
        },
        {
          provide: SandboxService,
          useValue: {
            inSandbox: signal(false),
            levelOf: () => 'full',
            whyFor: () => '',
          },
        },
        { provide: PermissionService, useValue: { can: () => can } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClusterDnsZoneSectionComponent);
    fixture.componentRef.setInput('assignments', [assignment]);
    fixture.componentRef.setInput('availableZones', []);
    fixture.componentRef.setInput('clusterId', 'cluster-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const removeButton = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('[data-testid="zone-remove"]');

  afterEach(() => TestBed.resetTestingModule());

  // First, so the refusal test below proves a gate and not an empty page.
  it('offers Remove to a principal who may manage the cluster', async () => {
    await mount(true);
    expect(removeButton()).not.toBeNull();
  });

  it('offers no Remove to one who may not — the route asks cluster:manage', async () => {
    await mount(false);
    expect(fixture.nativeElement.textContent).toContain('example.com');
    expect(removeButton()).toBeNull();
  });

  it('leaves the confirmation unreachable when the control is gone', async () => {
    await mount(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="zone-remove-confirm"]'),
    ).toBeNull();
  });
});
