import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClusterHostLayerComponent } from './cluster-host-layer.component';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { PermissionService } from '../../../core/services/permission.service';
import { HostFirewallLayer } from '../../model/firewall-v2.models';

describe('the firewall on each node', () => {
  let fixture: ComponentFixture<ClusterHostLayerComponent>;
  let setHostLayer: jasmine.Spy;

  const layer = (over: Partial<HostFirewallLayer> = {}): HostFirewallLayer => ({
    applicable: true,
    enabled: false,
    state: 'off',
    reason: null,
    appliedAt: null,
    appliedNodes: null,
    lastAttemptAt: null,
    ...over,
  });

  async function mount(options: {
    layer: HostFirewallLayer;
    can?: boolean;
    fails?: boolean;
  }): Promise<void> {
    setHostLayer = options.fails
      ? jasmine.createSpy('setHostLayer').and.rejectWith({ error: { message: 'Not offered on this cluster' } })
      : jasmine
          .createSpy('setHostLayer')
          .and.callFake((_id: string, enabled: boolean) =>
            Promise.resolve({ id: 'fw-1', hostLayer: layer({ enabled, state: enabled ? 'pending' : 'off' }) }),
          );

    await TestBed.configureTestingModule({
      imports: [ClusterHostLayerComponent],
      providers: [
        { provide: FirewallV2Service, useValue: { setHostLayer } },
        { provide: PermissionService, useValue: { can: () => options.can ?? true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClusterHostLayerComponent);
    fixture.componentRef.setInput('clusterId', 'cluster-1');
    fixture.componentRef.setInput('layer', options.layer);
    fixture.detectChanges();
  }

  const el = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  afterEach(() => TestBed.resetTestingModule());

  it('shows the state and says a problem here does not touch the cluster firewall', async () => {
    await mount({ layer: layer({ enabled: true, state: 'applied', appliedNodes: 3 }) });
    expect(el('host-layer-state')?.textContent).toContain('On');
    expect(el('host-layer-nodes')?.textContent).toContain('3 nodes');
    expect(el('host-layer-independent')?.textContent).toContain(
      'never changes the status of the cluster firewall',
    );
    expect(el('host-layer-toggle')?.getAttribute('aria-checked')).toBe('true');
    expect(el('host-layer-reason')).toBeNull();
  });

  it('gives the reason when it is waiting or failed', async () => {
    await mount({
      layer: layer({
        enabled: true,
        state: 'blocked',
        reason: 'Flui does not know the private network of this cluster.',
      }),
    });
    expect(el('host-layer-state')?.textContent).toContain('Waiting');
    expect(el('host-layer-reason')?.textContent).toContain('does not know the private network');
  });

  it('says it is being removed while turning off', async () => {
    await mount({ layer: layer({ enabled: false, state: 'removing' }) });
    expect(el('host-layer-reason')?.textContent).toContain('Being removed');
  });

  it('turns it on through the API and hands the new firewall back', async () => {
    await mount({ layer: layer() });
    const changed = jasmine.createSpy('changed');
    fixture.componentInstance.changed.subscribe(changed);

    el('host-layer-toggle')!.click();
    await fixture.whenStable();

    expect(setHostLayer).toHaveBeenCalledWith('cluster-1', true);
    expect(changed).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'fw-1' }));
  });

  it('turns it off when it is on', async () => {
    await mount({ layer: layer({ enabled: true, state: 'applied' }) });
    el('host-layer-toggle')!.click();
    await fixture.whenStable();
    expect(setHostLayer).toHaveBeenCalledWith('cluster-1', false);
  });

  it('shows why the change was refused', async () => {
    await mount({ layer: layer(), fails: true });
    el('host-layer-toggle')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el('host-layer-error')?.textContent).toContain('Not offered on this cluster');
  });

  it('offers no change to one who may not manage the cluster', async () => {
    await mount({ layer: layer(), can: false });
    const toggle = el('host-layer-toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBeTrue();
    toggle.click();
    expect(setHostLayer).not.toHaveBeenCalled();
  });

  it('keeps the long explanation behind a button', async () => {
    await mount({ layer: layer() });
    expect(el('host-layer-explanation')).toBeNull();
    el('host-layer-more')!.click();
    fixture.detectChanges();
    expect(el('host-layer-explanation')?.textContent).toContain('provider');
  });
});
