import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SectionGroup, ShapeCatalogue } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { GroupChoicesService } from './group-choices.service';
import { ScalingGroupStore } from './scaling-group.store';
import { ScalingNowAddOrderComponent } from './now-add-order.component';
import { ARM_WARNING } from '../../../shared/components/architecture-badge.component';


const shape = (name: string, architecture: 'x86' | 'arm') => ({
  shape: name,
  allowed: true,
  architecture,
  outlook: null,
  why: '',
  facts: { cores: 4, memoryMi: 8192, hourlyEur: 0.01, monthlyEur: 7 },
});

describe('adding a machine to a scaling group', () => {
  let fixture: ComponentFixture<ScalingNowAddOrderComponent>;

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  async function render(shapes: string[]): Promise<void> {
    const catalogue: ShapeCatalogue = {
      provider: 'hetzner',
      reading: 'read',
      ageSeconds: 60,
      stale: false,
      says: '',
      shapes: [shape('cx33', 'x86'), shape('cax21', 'arm')],
    };
    TestBed.configureTestingModule({
      imports: [ScalingNowAddOrderComponent],
      providers: [
        { provide: ScalingApiService, useValue: { updateGroup: () => of({}) } },
        {
          provide: ScalingGroupStore,
          useValue: {
            catalogue: signal({ data: catalogue, loading: false, failed: null }),
            outlook: signal({}),
            reload: () => undefined,
          },
        },
        {
          provide: GroupChoicesService,
          useValue: {
            load: () => Promise.resolve(),
            labels: () => ({}),
            architectures: () => ({}),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ScalingNowAddOrderComponent);
    fixture.componentRef.setInput('group', {
      id: 'g-1',
      name: 'prod',
      provider: 'hetzner',
      provision: 'automatic',
      shapes,
      regions: ['fsn1'],
      bounds: { min: 1, desired: 1, max: 5 },
      standingOrders: [],
    } as unknown as SectionGroup);
    fixture.detectChanges();
    (find('add-order-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  const option = (value: string): HTMLOptionElement =>
    fixture.nativeElement.querySelector(`[data-testid="add-order-shape"] option[value="${value}"]`);

  it('names the architecture in each machine option', async () => {
    await render(['cx33']);
    expect(option('cx33').textContent).toContain('cx33 — x86 · 4 vCPU');
  });

  it('starts on the first machine listed, arm included', async () => {
    await render(['cax21', 'cx33']);
    expect((find('add-order-shape') as HTMLSelectElement).value).toBe('cax21');
  });

  it('offers an arm machine like any other, with the warning on hover', async () => {
    await render(['cax21', 'cx33']);
    expect(option('cax21').disabled).toBeFalse();
    expect(option('cax21').getAttribute('title')).toBe(ARM_WARNING);
    expect(option('cx33').getAttribute('title')).toBeNull();
  });

  it('lets an order for an arm machine go, warning about it', async () => {
    await render(['cax21']);
    expect((find('add-order-submit') as HTMLButtonElement).disabled).toBeFalse();
    expect(find('add-order-says')?.textContent).not.toContain(ARM_WARNING);
    expect(find('add-order-warning')?.textContent?.trim()).toBe(ARM_WARNING);
  });

  it('says no warning for an x86 machine', async () => {
    await render(['cx33']);
    expect(find('add-order-warning')).toBeNull();
  });
});
