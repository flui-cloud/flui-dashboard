import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SectionGroup, ShapeCatalogue } from '../../model/scaling-section.models';
import { GroupDraftStore } from './group-draft.store';
import { ScalingGroupStore } from './scaling-group.store';
import { ScalingMarketTabComponent } from './tab-market.component';
import { ARM_WARNING } from '../../../shared/components/architecture-badge.component';

const GROUP = {
  id: 'g-1',
  clusterName: 'prod-eu',
  capability: { provider: 'hetzner', canProvision: true, hasCatalogue: true, billing: 'hourly' },
  limits: { hourlyBillingOnly: false, maxMonthlyCost: 100 },
  shapes: ['cx33', 'cax21'],
  standingOrders: [],
} as unknown as SectionGroup;

const CATALOGUE: ShapeCatalogue = {
  provider: 'hetzner',
  reading: 'read',
  ageSeconds: 60,
  stale: false,
  says: 'Read a minute ago.',
  shapes: [
    {
      shape: 'cx33',
      allowed: true,
      architecture: 'x86',
      outlook: { state: 'available', upIn: ['fsn1'], downIn: [], sinceHours: null, ageSeconds: 60 },
      why: 'Up where this group buys.',
    },
    {
      shape: 'cax21',
      allowed: true,
      architecture: 'arm',
      outlook: { state: 'available', upIn: ['fsn1'], downIn: [], sinceHours: null, ageSeconds: 60 },
      why: 'Up where this group buys.',
    },
  ],
};

describe('the catalogue tab of a scaling group', () => {
  let fixture: ComponentFixture<ScalingMarketTabComponent>;

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  beforeEach(() => {
    const outlook: Record<string, unknown> = {};
    for (const s of CATALOGUE.shapes) outlook[s.shape] = s.outlook;
    const store = {
      groupId: signal('g-1'),
      group: signal({ data: GROUP, loading: false, failed: null }),
      catalogue: signal({ data: CATALOGUE, loading: false, failed: null }),
      outlook: signal(outlook),
      reload: () => undefined,
    };
    TestBed.configureTestingModule({
      imports: [ScalingMarketTabComponent],
      providers: [
        provideRouter([]),
        { provide: ScalingGroupStore, useValue: store },
        { provide: GroupDraftStore, useValue: { draft: () => null } },
      ],
    });
    fixture = TestBed.createComponent(ScalingMarketTabComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('names the architecture of every machine', () => {
    const badge = (shape: string) =>
      find('shape-' + shape)?.querySelector('[data-testid="architecture-badge"]')?.textContent?.trim();
    expect(badge('cx33')).toBe('x86');
    expect(badge('cax21')).toBe('Arm');
  });

  it('keeps an x86 machine on its place in the list', () => {
    expect(find('allowed-cx33')?.getAttribute('data-allowance')).toBe('preferred');
  });

  it('keeps an arm machine on its place in the list too', () => {
    const cell = find('allowed-cax21')!;
    expect(cell.getAttribute('data-allowance')).toBe('preferred');
    expect(cell.textContent).toContain('preference 2');
  });

  it('warns once under the table when an arm machine is listed', () => {
    expect(find('market-architecture-warning')?.textContent?.trim()).toBe(ARM_WARNING);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="market-architecture-warning"]').length).toBe(1);
  });
});
