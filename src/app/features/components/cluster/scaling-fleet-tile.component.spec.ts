import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingFleetTileComponent } from './scaling-fleet-tile.component';

const row = (over: Partial<ClusterScalingRow> = {}): ClusterScalingRow =>
  ({
    clusterId: 'c-1',
    clusterName: 'prod',
    capability: { provider: 'hetzner', canProvision: true, hasCatalogue: true, billing: 'hourly' },
    groupId: 'g-1',
    groupCount: 1,
    bounds: { min: 2, desired: 2, max: 3 },
    nodes: 2,
    acts: false,
    ...over,
  }) as ClusterScalingRow;

describe('the nodes tile moves the group floor', () => {
  let fixture: ComponentFixture<ScalingFleetTileComponent>;
  let api: {
    setFloor: jasmine.Spy;
    preview: jasmine.Spy;
    approvePurchase: jasmine.Spy;
    approveRemoval: jasmine.Spy;
  };

  const build = async (r: ClusterScalingRow, acts = false): Promise<void> => {
    api = {
      setFloor: jasmine.createSpy('setFloor').and.returnValue(
        of({ acts: { acts, says: 'This group buys on its own.' } }),
      ),
      preview: jasmine.createSpy('preview').and.returnValue(
        of({
          chosen: { shape: 'cx23', region: 'fsn1', hourlyEur: 0.006 },
          giveBack: { nodeId: 'n-2', node: 'prod-worker-1', onItsOwn: false },
        }),
      ),
      approvePurchase: jasmine.createSpy('approvePurchase').and.returnValue(of({ did: 'Ordered a cx23.' })),
      approveRemoval: jasmine.createSpy('approveRemoval').and.returnValue(of({ did: 'Draining prod-worker-1.' })),
    };
    await TestBed.configureTestingModule({
      imports: [ScalingFleetTileComponent],
      providers: [
        { provide: ScalingApiService, useValue: api },
        { provide: ToastService, useValue: { showSuccess: () => undefined, showError: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ScalingFleetTileComponent);
    fixture.componentRef.setInput('row', r);
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLButtonElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const click = async (testid: string): Promise<void> => {
    find(testid)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('raises the floor by one and asks to approve the purchase on a manual group', async () => {
    await build(row());
    await click('tile-fleet-plus');
    expect(find('tile-fleet-confirm')!.textContent).toContain('Hold 3 nodes');
    await click('tile-fleet-confirm-yes');
    expect(api.setFloor).toHaveBeenCalledWith('g-1', 3);
    expect(find('tile-fleet-buy')!.textContent).toContain('Buy one cx23 in fsn1');
    await click('tile-fleet-buy-yes');
    expect(api.approvePurchase).toHaveBeenCalledWith('g-1', { shape: 'cx23', region: 'fsn1' });
  });

  it('lowers the floor by one and asks to approve the node that goes', async () => {
    await build(row());
    await click('tile-fleet-minus');
    await click('tile-fleet-confirm-yes');
    expect(api.setFloor).toHaveBeenCalledWith('g-1', 1);
    expect(find('tile-fleet-give-back')!.textContent).toContain('prod-worker-1');
    await click('tile-fleet-give-back-yes');
    expect(api.approveRemoval).toHaveBeenCalledWith('g-1', 'prod-worker-1');
  });

  it('says in the tile why a removal was refused', async () => {
    await build(row());
    api.approveRemoval.and.returnValue(
      throwError(() => ({ error: { message: 'Nothing was removed: A node joined at 21:18 UTC.' } })),
    );
    await click('tile-fleet-minus');
    await click('tile-fleet-confirm-yes');
    await click('tile-fleet-give-back-yes');
    expect(find('tile-fleet-waiting')!.textContent).toContain('A node joined at 21:18 UTC');
  });

  it('asks nothing more of an automatic group', async () => {
    await build(row({ acts: true }), true);
    await click('tile-fleet-plus');
    await click('tile-fleet-confirm-yes');
    expect(api.preview).not.toHaveBeenCalled();
    expect(find('tile-fleet-waiting')!.textContent).toContain('buys on its own');
  });

  it('offers again, after a reload, the purchase a manual group is waiting on', async () => {
    await build(row({ nodes: 1 }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.preview).toHaveBeenCalledWith('g-1');
    expect(find('tile-fleet-buy')!.textContent).toContain('Buy one cx23 in fsn1');
  });

  it('brings a floor above the fleet back down without buying or removing anything', async () => {
    await build(row({ nodes: 1, bounds: { min: 2, desired: 2, max: 2 } }));
    await fixture.whenStable();
    await click('tile-fleet-minus');
    expect(find('tile-fleet-confirm')!.textContent).toContain('Nothing is bought or removed');
    api.preview.calls.reset();
    await click('tile-fleet-confirm-yes');
    expect(api.setFloor).toHaveBeenCalledWith('g-1', 1);
    expect(api.preview).not.toHaveBeenCalled();
    expect(find('tile-fleet-waiting')!.textContent).toContain('Back to 1 node');
  });

  it('offers nothing when the fleet already holds the floor', async () => {
    await build(row());
    await fixture.whenStable();
    expect(api.preview).not.toHaveBeenCalled();
    expect(find('tile-fleet-buy')).toBeNull();
  });

  it('keeps both buttons off where Flui cannot buy', async () => {
    await build(row({ groupId: null, capability: { provider: 'byos', canProvision: false, hasCatalogue: false, billing: 'none' } }));
    expect(find('tile-fleet-plus')!.disabled).toBeTrue();
    expect(find('tile-fleet-minus')!.disabled).toBeTrue();
  });

  it('never offers to give back the master', async () => {
    await build(row({ nodes: 1, bounds: { min: 1, desired: 1, max: 3 } }));
    expect(find('tile-fleet-minus')!.disabled).toBeTrue();
  });
});
