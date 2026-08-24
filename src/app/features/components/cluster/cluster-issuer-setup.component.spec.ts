import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClusterIssuerSetupComponent } from './cluster-issuer-setup.component';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { ClusterIssuerWebSocketService } from '../../service/cluster-issuer-websocket.service';
import { PermissionService } from '../../../core/services/permission.service';

describe('deleting the wildcard issuers of a cluster', () => {
  let fixture: ComponentFixture<ClusterIssuerSetupComponent>;

  async function mount(can: boolean): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ClusterIssuerSetupComponent],
      providers: [
        {
          provide: ClusterDnsZoneService,
          useValue: {
            getIssuers: () =>
              Promise.resolve([
                {
                  name: 'letsencrypt-production-wildcard',
                  ready: true,
                  email: 'a@b.c',
                  solverType: 'dns01',
                },
              ]),
            deleteIssuersByType: () => Promise.resolve(true),
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
        { provide: PermissionService, useValue: { can: () => can } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClusterIssuerSetupComponent);
    fixture.componentRef.setInput('clusterId', 'cluster-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const deleteButton = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('[data-testid="dns-issuers-delete"]');

  afterEach(() => TestBed.resetTestingModule());

  // First, so the refusal test below proves a gate and not an empty page.
  it('offers the delete control to a principal who may manage the cluster', async () => {
    await mount(true);
    expect(deleteButton()).not.toBeNull();
  });

  it('offers no delete control to one who may not — the route asks cluster:manage', async () => {
    await mount(false);
    expect(fixture.nativeElement.textContent).toContain(
      'letsencrypt-production-wildcard',
    );
    expect(deleteButton()).toBeNull();
  });
});
