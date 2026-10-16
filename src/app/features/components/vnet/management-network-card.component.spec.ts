import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { PermissionService } from '../../../core/services/permission.service';
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
  let post: jasmine.Spy;
  let del: jasmine.Spy;

  const demotion = { clusterId: 'w', clusterName: 'scw', from: '10.250.0.2:6443', to: '5.6.7.9:6443', changed: true, held: true };

  const build = async (n: ManagementNetwork, compact = false, canManage = true): Promise<void> => {
    put = jasmine.createSpy('put').and.returnValue(of({ ...n, enabled: !n.enabled }));
    post = jasmine.createSpy('post').and.returnValue(of(demotion));
    del = jasmine.createSpy('delete').and.returnValue(of({ ...demotion, held: false }));
    await TestBed.configureTestingModule({
      imports: [ManagementNetworkCardComponent],
      providers: [
        { provide: HttpClient, useValue: { get: () => of(n), put, post, delete: del } },
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
        { provide: PermissionService, useValue: { can: (key: string) => canManage && key === 'cluster:manage' } },
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

  it("says why members stay pending when the control's end is not set up", async () => {
    await build(network({ hubProblem: 'Cannot reach node 5.6.7.8:22 over SSH' }));
    expect(find('flui-network-hub-problem')!.textContent).toContain('Cannot reach node 5.6.7.8:22');
  });

  it('names it in the one line as well', async () => {
    await build(network({ hubProblem: 'Cannot reach node 5.6.7.8:22 over SSH' }), true);
    expect(find('flui-network-line')!.textContent).toContain('control end not set up');
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

  const hubs = (): ManagementNetwork['hubs'] => [
    { address: '10.250.0.1', endpoint: '5.6.7.8:51821', keyed: true, nodeId: 'n1', nodeName: 'master', primary: true, status: 'active', membersReached: 2, membersNotReached: 0 },
    { address: '10.250.0.3', endpoint: '5.6.7.10:51821', keyed: true, nodeId: 'n2', nodeName: 'worker-1', primary: false, status: 'active', membersReached: 1, membersNotReached: 1 },
  ];

  it('shows every control end with its status', async () => {
    await build(network({ hubs: hubs() }));
    expect(find('flui-network-hubs')!.textContent!.replace(/\s+/g, ' ')).toContain('Control ends: master ✓, worker-1 ✓ (1 not reached)');
  });

  it('names every control end in the one line', async () => {
    await build(network({ hubs: hubs() }), true);
    expect(find('flui-network-line')!.textContent).toContain('on · control ends: master ✓, worker-1 ✓ (1 not reached) · 1 member');
  });

  it('says which control end does not reach a member', async () => {
    await build(network({ hubs: hubs(), members: [{ ...network().members[0], unreachedFrom: ['worker-1'] }] }));
    expect(find('flui-network-unreached')!.textContent).toContain('not reached from worker-1');
  });

  it('offers the public address after a confirmation, once per cluster', async () => {
    const m = network().members[0];
    await build(network({ members: [m, { ...m, nodeName: 'scw-worker', address: '10.250.0.4' }] }));
    expect(fixture.nativeElement.querySelectorAll('[data-testid="flui-network-demote"]').length).toBe(1);
    find('flui-network-demote')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Flui will manage this cluster over its public address until you release it.');
    expect(post).not.toHaveBeenCalled();
    const confirm = [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLButtonElement) => b.textContent!.trim() === 'Use public address' && !b.dataset['testid']) as HTMLButtonElement;
    confirm.click();
    await fixture.whenStable();
    expect(post).toHaveBeenCalledWith('/api/v1/infrastructure/management-network/clusters/w/demote', {});
  });

  it('shows a held cluster and releases it', async () => {
    await build(network({ members: [{ ...network().members[0], heldOffOverlay: true }] }));
    expect(find('flui-network-held')!.textContent).toContain('held on its public address');
    expect(find('flui-network-demote')).toBeNull();
    find('flui-network-release')!.click();
    await fixture.whenStable();
    expect(del).toHaveBeenCalledWith('/api/v1/infrastructure/management-network/clusters/w/demote');
  });

  it('counts held clusters in the one line', async () => {
    await build(network({ members: [{ ...network().members[0], heldOffOverlay: true }] }), true);
    expect(find('flui-network-line')!.textContent).toContain('1 held on public address');
  });

  it('offers no emergency action without cluster:manage', async () => {
    await build(network({ members: [{ ...network().members[0], heldOffOverlay: true }] }), false, false);
    expect(find('flui-network-release')).toBeNull();
    expect(find('flui-network-demote')).toBeNull();
  });
});
