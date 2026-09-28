import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingCost } from '../../model/scaling-group.models';
import { GroupCostComponent } from './group-cost.component';

const COST: ScalingCost = {
  priced: true,
  says: "Priced on DEV1-M (€0.0137/h, €10.00 a month), the provider's list price.",
  unpricedShapes: [],
  scenarios: [
    { kind: 'at-min', label: 'Always at the minimum, 1 node', lowEur: 10, highEur: 10 },
    { kind: 'worst-case', label: 'At the maximum (5 nodes) all month', lowEur: 50, highEur: 50 },
  ],
  ceiling: {
    monthlyEur: 20,
    nodesWithin: 2,
    stopsBeforeMax: true,
    says: 'Spending ceiling €20.00 a month, below the worst case.',
  },
  suggestedCeilingEur: 50,
};

describe('what the node limits cost', () => {
  let fixture: ComponentFixture<GroupCostComponent>;
  let cost: jasmine.Spy;

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const build = (needsCeiling: boolean): void => {
    cost = jasmine.createSpy('cost').and.returnValue(of(COST));
    TestBed.configureTestingModule({
      imports: [GroupCostComponent],
      providers: [{ provide: ScalingApiService, useValue: { cost } }],
    });
    fixture = TestBed.createComponent(GroupCostComponent);
    fixture.componentRef.setInput('clusterId', 'c-1');
    fixture.componentRef.setInput('draft', { bounds: { min: 1, max: 5 } });
    fixture.componentRef.setInput('needsCeiling', needsCeiling);
  };

  it('shows the scenarios and the ceiling the API priced, never a sum of its own', fakeAsync(() => {
    build(false);
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    expect(cost).toHaveBeenCalledWith('c-1', { bounds: { min: 1, max: 5 } });
    expect(find('cost-worst-case')!.textContent).toContain('€50.00/mo');
    expect(find('group-cost-ceiling')!.textContent).toContain('below the worst case');
    expect(find('group-cost-use-suggested')).toBeNull();
  }));

  it('offers the ceiling that covers the worst case when automatic buying has none', fakeAsync(() => {
    build(true);
    const used: number[] = [];
    fixture.componentInstance.useCeiling.subscribe((v) => used.push(v));
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    find('group-cost-use-suggested')!.click();
    expect(used).toEqual([50]);
  }));

  it('asks for nothing while a node limit is out of range', fakeAsync(() => {
    build(false);
    fixture.componentRef.setInput('draft', null);
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    expect(cost).not.toHaveBeenCalled();
    expect(find('group-cost')!.textContent).toContain('Fix the node limits');
  }));
});
