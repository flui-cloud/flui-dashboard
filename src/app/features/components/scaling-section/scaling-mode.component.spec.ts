import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingModeComponent } from './scaling-mode.component';

const group = (over: Partial<SectionGroup> = {}): SectionGroup =>
  ({
    id: 'g-1',
    provision: 'manual',
    bounds: { min: 1, desired: 1, max: 3 },
    limits: { hourlyBillingOnly: true, maxMonthlyCost: null },
    capability: { canProvision: true, hasCatalogue: true, billing: 'hourly' },
    acts: { acts: false, says: 'Nothing is bought on its own.', label: 'Manual — Flui does not buy', attention: true },
    ...over,
  }) as unknown as SectionGroup;

describe('switching a group to automatic', () => {
  let fixture: ComponentFixture<ScalingModeComponent>;
  let updateGroup: jasmine.Spy;

  const build = async (g: SectionGroup): Promise<void> => {
    updateGroup = jasmine.createSpy('updateGroup').and.returnValue(of(g));
    await TestBed.configureTestingModule({
      imports: [ScalingModeComponent],
      providers: [
        { provide: ScalingApiService, useValue: { updateGroup } },
        { provide: ToastService, useValue: { showSuccess: () => undefined, showError: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ScalingModeComponent);
    fixture.componentRef.setInput('group', g);
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const open = (): void => {
    find('scaling-mode-switch')!.click();
    fixture.detectChanges();
  };

  it('asks for a spending ceiling when the group has none, and will not switch without it', async () => {
    await build(group());
    open();
    const confirm = find('scaling-mode-switch-confirm') as HTMLButtonElement;
    expect(find('scaling-mode-cap')).not.toBeNull();
    expect(confirm.disabled).toBeTrue();
    expect(find('scaling-mode-confirm')!.textContent).not.toContain('no money ceiling');
  });

  it('sends the ceiling with the switch', async () => {
    await build(group());
    open();
    const input = find('scaling-mode-cap') as HTMLInputElement;
    input.value = '40';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (find('scaling-mode-switch-confirm') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(updateGroup).toHaveBeenCalledWith('g-1', {
      provision: 'automatic',
      limits: { hourlyBillingOnly: true, maxMonthlyCost: 40 },
    });
  });

  it('keeps the ceiling the group already has', async () => {
    await build(group({ limits: { hourlyBillingOnly: true, maxMonthlyCost: 30 } } as Partial<SectionGroup>));
    open();
    expect(find('scaling-mode-cap')).toBeNull();
    (find('scaling-mode-switch-confirm') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(updateGroup).toHaveBeenCalledWith('g-1', { provision: 'automatic' });
  });

  it('offers to set a ceiling on an automatic group that has none', async () => {
    await build(group({ provision: 'automatic' }));
    expect(find('scaling-mode-switch')!.textContent).toContain('Set a spending ceiling');
  });

  it('proposes the ceiling the API computed to cover the worst case, in nodes first', async () => {
    await build(
      group({
        cost: {
          priced: true,
          says: '',
          unpricedShapes: [],
          scenarios: [{ kind: 'worst-case', label: 'At the maximum', lowEur: 30, highEur: 45 }],
          ceiling: { monthlyEur: null, nodesWithin: null, stopsBeforeMax: false, says: '' },
          suggestedCeilingEur: 45,
        },
      } as Partial<SectionGroup>),
    );
    open();
    expect((find('scaling-mode-cap') as HTMLInputElement).value).toBe('45');
    expect(find('scaling-mode-confirm')!.textContent).toContain('up to 3 nodes, never past a spending ceiling of €45.00');
    (find('scaling-mode-switch-confirm') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(updateGroup).toHaveBeenCalledWith('g-1', {
      provision: 'automatic',
      limits: { hourlyBillingOnly: true, maxMonthlyCost: 45 },
    });
  });
});
