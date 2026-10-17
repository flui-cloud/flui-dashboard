import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FleetNode } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { ScalingNowFleetComponent } from './now-fleet.component';

const node = (id: string, architecture: FleetNode['architecture']): FleetNode => ({
  id,
  name: id,
  shape: 'cx33',
  region: 'fsn1',
  role: 'worker',
  hourlyEur: 0.01,
  architecture,
  since: '2026-10-01T00:00:00Z',
  standIn: false,
  neverReplace: null,
});

describe('the fleet of a scaling group', () => {
  let fixture: ComponentFixture<ScalingNowFleetComponent>;

  beforeEach(() => {
    const store = {
      fleet: signal({ data: { nodes: [node('n-1', 'x86'), node('n-2', null)], unavailable: null }, loading: false, failed: null }),
      row: signal({ data: { nodes: 2 }, loading: false, failed: null }),
      reload: () => undefined,
    };
    TestBed.configureTestingModule({
      imports: [ScalingNowFleetComponent],
      providers: [{ provide: ScalingGroupStore, useValue: store }],
    });
    fixture = TestBed.createComponent(ScalingNowFleetComponent);
    fixture.componentRef.setInput('group', { standingOrders: [] } as unknown as SectionGroup);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="fleet-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  const badgeOf = (id: string) =>
    fixture.nativeElement
      .querySelector(`[data-testid="node-${id}"]`)
      ?.querySelector('[data-testid="architecture-badge"]');

  it('names the architecture a node reports', () => {
    expect(badgeOf('n-1')?.textContent?.trim()).toBe('x86');
  });

  it('says nothing where the node did not report one', () => {
    expect(badgeOf('n-2')).toBeNull();
  });
});
