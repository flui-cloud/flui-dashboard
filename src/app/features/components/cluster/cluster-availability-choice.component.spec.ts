import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HaPlanResponseDto } from '../../../core/api/model/haPlanResponseDto';
import { ClusterService } from '../../service/cluster.service';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import {
  AvailabilityChoice,
  ClusterAvailabilityChoiceComponent,
} from './cluster-availability-choice.component';

const size = (id: string, pricePerHour: number, architecture: 'x86' | 'arm' = 'x86') => ({
  id,
  name: id,
  vcpu: 2,
  ram: 4,
  disk: 40,
  storageType: 'local' as const,
  pricePerHour,
  cpuType: 'shared' as const,
  architecture,
  bareMetal: false,
  managedFirewall: true,
  supportsHourlyBilling: true,
  blockStoragePricePerGbMonthly: null,
});

const sizes = [size('cx23', 0.01), size('cpx22', 0.02), size('cax21', 0.015, 'arm')];

const possible: HaPlanResponseDto = {
  layoutAvailable: true,
  possible: true,
  refusal: null,
  completeLaterHelps: false,
  region: 'eu-central',
  measured: true,
  servers: [
    { zone: 'fsn1', shape: 'cpx22', role: 'data', first: true },
    { zone: 'nbg1', shape: 'cpx22', role: 'data', first: false },
    { zone: 'hel1', shape: 'cpx22', role: 'vote', first: false },
  ],
  later: [],
};

const refused: HaPlanResponseDto = {
  layoutAvailable: true,
  possible: false,
  refusal: 'hel1 has none of cpx22 available now. Sizes every location has: cx23.',
  completeLaterHelps: true,
  region: null,
  measured: true,
  servers: [],
  later: [],
};

const noLayout: HaPlanResponseDto = {
  layoutAvailable: false,
  possible: false,
  refusal: 'Flui has no highly available layout for this region.',
  completeLaterHelps: false,
  region: null,
  measured: true,
  servers: [],
  later: [],
};

describe('ClusterAvailabilityChoiceComponent', () => {
  let fixture: ComponentFixture<ClusterAvailabilityChoiceComponent>;
  let plan: jasmine.Spy;
  let emitted: AvailabilityChoice[];

  function render(answer: (q: { completeLater: boolean; shapes: string[] }) => HaPlanResponseDto) {
    plan = jasmine
      .createSpy('highAvailabilityPlan')
      .and.callFake(
        (q: { completeLater: boolean; shapes: string[] }) =>
          new Promise<HaPlanResponseDto>((resolve) => resolve(answer(q))),
      );
    TestBed.configureTestingModule({
      imports: [ClusterAvailabilityChoiceComponent],
      providers: [
        { provide: ClusterService, useValue: { highAvailabilityPlan: plan } },
        {
          provide: ProviderWizardService,
          useValue: {
            serverTypesData: signal({
              'hetzner:fsn1': sizes,
              'hetzner:nbg1': sizes,
              'hetzner:hel1': sizes,
            }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ClusterAvailabilityChoiceComponent);
    fixture.componentRef.setInput('provider', 'hetzner');
    fixture.componentRef.setInput('region', 'fsn1');
    fixture.componentRef.setInput('serverTypeId', 'cpx22');
    emitted = [];
    fixture.componentInstance.changed.subscribe((c) => emitted.push(c));
    settle();
  }

  function settle() {
    fixture.detectChanges();
    tick(300);
    flushMicrotasks();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const last = () => emitted[emitted.length - 1];

  function chooseThreeLocations() {
    q('availability-three-locations')!.click();
    settle();
  }

  it('hides the option when the provider declares no layout for the location', fakeAsync(() => {
    render(() => noLayout);
    expect(plan).toHaveBeenCalledWith({
      provider: 'hetzner',
      region: 'fsn1',
      shapes: ['cpx22'],
      completeLater: false,
    });
    expect(q('availability-choice')).toBeNull();
    expect(last().level).toBe('standard');
    expect(last().ready).toBeTrue();
  }));

  it('hides the option when the plan cannot be asked', fakeAsync(() => {
    render(() => {
      throw new Error('offline');
    });
    expect(q('availability-choice')).toBeNull();
  }));

  it('shows one row per location with its role and size, the first marked, and the cost of all three', fakeAsync(() => {
    render(() => possible);
    expect(q('availability-choice')).not.toBeNull();
    chooseThreeLocations();

    const rows = el().querySelectorAll('[data-testid="ha-plan-server"]');
    expect(rows).toHaveSize(3);
    expect(rows[0].textContent).toContain('fsn1');
    expect(rows[0].textContent).toContain('copies of data');
    expect(rows[0].querySelector('[data-testid="ha-plan-first"]')).not.toBeNull();
    expect(rows[2].textContent).toContain('hel1');
    expect(rows[2].textContent).toContain('votes');
    expect(rows[2].querySelector('[data-testid="ha-plan-first"]')).toBeNull();
    expect(q('ha-plan-cost')!.textContent).toContain('for 3 servers');

    expect(last()).toEqual(
      jasmine.objectContaining({
        level: 'three-locations',
        shapes: ['cpx22'],
        completeLater: false,
        ready: true,
      }),
    );
    expect(last().pricePerHour).toBeCloseTo(0.06, 5);
  }));

  it('says when Flui has the three zones only on the provider\'s word', fakeAsync(() => {
    render(() => possible);
    chooseThreeLocations();
    expect(q('ha-plan-unmeasured')).toBeNull();

    TestBed.resetTestingModule();
    render(() => ({ ...possible, region: 'nl-ams', measured: false }));
    chooseThreeLocations();
    expect(q('ha-plan-unmeasured')!.textContent).toContain('Flui has not measured them yet');
  }));

  it('offers only sizes of the same architecture as fallbacks and asks again in order', fakeAsync(() => {
    render(() => possible);
    chooseThreeLocations();

    expect(q('ha-fallback-cx23')).not.toBeNull();
    expect(q('ha-fallback-cax21')).toBeNull();
    q('ha-fallback-cx23')!.click();
    settle();

    expect(plan).toHaveBeenCalledWith(jasmine.objectContaining({ shapes: ['cpx22', 'cx23'] }));
    expect(last().shapes).toEqual(['cpx22', 'cx23']);
  }));

  it('shows the refusal in one line, is not ready, and re-asks with complete-later', fakeAsync(() => {
    render((query) =>
      query.completeLater
        ? {
            ...possible,
            servers: possible.servers.slice(0, 2),
            later: ['hel1'],
          }
        : refused,
    );
    chooseThreeLocations();
    expect(q('ha-complete-later')).not.toBeNull();

    expect(q('ha-refusal')!.textContent!.trim()).toBe(refused.refusal!);
    expect(q('ha-plan')).toBeNull();
    expect(last().ready).toBeFalse();

    const box = q('ha-complete-later') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    settle();

    expect(plan).toHaveBeenCalledWith(jasmine.objectContaining({ completeLater: true }));
    expect(q('ha-refusal')).toBeNull();
    expect(el().querySelectorAll('[data-testid="ha-plan-server"]')).toHaveSize(2);
    expect(q('ha-plan-later')!.textContent).toContain('hel1');
    expect(last()).toEqual(
      jasmine.objectContaining({ completeLater: true, ready: true, later: ['hel1'] }),
    );
    expect((q('ha-complete-later') as HTMLInputElement).checked).toBeTrue();
  }));

  it('does not offer complete-later when it would not help', fakeAsync(() => {
    render(() => ({
      ...refused,
      refusal: 'The first server goes in a location for data: fsn1 or nbg1.',
      completeLaterHelps: false,
    }));
    chooseThreeLocations();

    expect(q('ha-refusal')).not.toBeNull();
    expect(q('ha-complete-later')).toBeNull();
    expect(last().ready).toBeFalse();
  }));

  it('does not offer complete-later when the plan already goes ahead', fakeAsync(() => {
    render(() => possible);
    chooseThreeLocations();

    expect(q('ha-plan')).not.toBeNull();
    expect(q('ha-complete-later')).toBeNull();
  }));
});
