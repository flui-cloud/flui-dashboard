import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ManagementNetwork, ManagementNetworkCardComponent } from './management-network-card.component';

const network = (over: Partial<ManagementNetwork> = {}): ManagementNetwork => ({
  enabled: true,
  source: 'default',
  unavailable: null,
  hub: { address: '10.250.0.1', endpoint: '5.6.7.8:51821', keyed: true },
  members: [
    { clusterId: 'w', clusterName: 'scw', nodeName: 'scw-master', address: '10.250.0.2', status: 'stale', lastHandshakeAt: '2026-09-26T10:10:00Z' },
  ],
  ...over,
});

describe('the Flui network card', () => {
  let fixture: ComponentFixture<ManagementNetworkCardComponent>;
  let put: jasmine.Spy;

  const build = async (n: ManagementNetwork, compact = false): Promise<void> => {
    put = jasmine.createSpy('put').and.returnValue(of({ ...n, enabled: !n.enabled }));
    await TestBed.configureTestingModule({
      imports: [ManagementNetworkCardComponent],
      providers: [
        { provide: HttpClient, useValue: { get: () => of(n), put } },
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
        { provide: ToastService, useValue: { showSuccess: () => undefined, showError: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ManagementNetworkCardComponent);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const find = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  it('shows the members with their last handshake, and a quiet one as such', async () => {
    await build(network());
    expect(find('flui-network-members')!.textContent).toContain('10.250.0.2');
    expect(find('flui-network-members')!.textContent).toContain('quiet');
  });

  it('says in one line how it is run', async () => {
    await build(network(), true);
    expect(find('flui-network-line')!.textContent).toContain('on · control end 10.250.0.1 · 1 member · 1 quiet');
  });

  it('will not offer to switch on where it cannot work, and says why', async () => {
    await build(network({ enabled: false, unavailable: 'The control cluster has no address the other clusters can reach.' }));
    expect((find('flui-network-toggle') as HTMLButtonElement).disabled).toBeTrue();
    expect(find('flui-network-unavailable')!.textContent).toContain('no address');
  });

  it('switches after a confirmation', async () => {
    await build(network());
    find('flui-network-toggle')!.click();
    fixture.detectChanges();
    (find('flui-network-confirm')!.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(put).toHaveBeenCalledWith('/api/v1/infrastructure/management-network', { enabled: false });
  });
});
