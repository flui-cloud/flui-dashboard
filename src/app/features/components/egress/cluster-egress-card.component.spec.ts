import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClusterEgressCardComponent } from './cluster-egress-card.component';
import { EgressService, EgressView } from '../../service/egress.service';
import { PermissionService } from '../../../core/services/permission.service';

describe('the outbound ports of a cluster', () => {
  let fixture: ComponentFixture<ClusterEgressCardComponent>;
  let setCluster: jasmine.Spy;

  const open: EgressView = { open: true, ports: [], summary: 'Outbound traffic is open on every port.' };

  async function mount(options: { view: EgressView; can: boolean }): Promise<void> {
    setCluster = jasmine.createSpy('setCluster').and.callFake((_id: string, ports: EgressView['ports']) =>
      Promise.resolve({
        open: false,
        ports,
        summary: 'Outbound traffic leaving the cluster is allowed on ports 80, 443; for any other port ask your administrator.',
        applied: 3,
        failed: [],
      }),
    );
    await TestBed.configureTestingModule({
      imports: [ClusterEgressCardComponent],
      providers: [
        { provide: EgressService, useValue: { cluster: () => Promise.resolve(options.view), setCluster, openCluster: jasmine.createSpy() } },
        { provide: PermissionService, useValue: { can: (key: string) => options.can && key === 'egress:manage' } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ClusterEgressCardComponent);
    fixture.componentRef.setInput('clusterId', 'cluster-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  afterEach(() => TestBed.resetTestingModule());

  it('shows the rule to anyone and the change only to who may make it', async () => {
    await mount({ view: open, can: false });
    expect(el('egress-summary')?.textContent).toContain('open on every port');
    expect(el('egress-edit')).toBeNull();
  });

  it('refuses what is not a port before asking the server', async () => {
    await mount({ view: open, can: true });
    el('egress-edit')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = el('egress-input') as HTMLInputElement;
    input.value = '443, smtp';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el('egress-save')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el('egress-problem')?.textContent).toContain('"smtp" is not a port');
    expect(setCluster).not.toHaveBeenCalled();
  });

  it('saves the ports and says how many application spaces carry them', async () => {
    await mount({ view: open, can: true });
    el('egress-edit')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    el('egress-save')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(setCluster).toHaveBeenCalledWith('cluster-1', [
      { port: 80, protocol: 'TCP' },
      { port: 443, protocol: 'TCP' },
    ]);
    expect(el('egress-summary')?.textContent).toContain('80, 443');
    expect(el('egress-outcome')?.textContent).toContain('3 application spaces');
  });
});
