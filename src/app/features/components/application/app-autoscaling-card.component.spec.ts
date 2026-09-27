import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from '../../../shared/services/toast.service';
import { AppAutoscaling, AppRuntimeService } from '../../service/app-runtime.service';
import { AppAutoscalingCardComponent } from './app-autoscaling-card.component';

const state = (over: Partial<AppAutoscaling> = {}): AppAutoscaling => ({
  enabled: false,
  min: 1,
  max: 1,
  targetCPU: 80,
  rangeFrom: 'app',
  running: false,
  ...over,
});

describe('the autoscaling card of an app', () => {
  let fixture: ComponentFixture<AppAutoscalingCardComponent>;
  let setAutoscaling: jasmine.Spy;

  const build = async (a: AppAutoscaling): Promise<void> => {
    setAutoscaling = jasmine.createSpy('setAutoscaling').and.callFake(
      async (_id: string, body: Partial<AppAutoscaling>) => ({ ...a, ...body, running: true }),
    );
    await TestBed.configureTestingModule({
      imports: [AppAutoscalingCardComponent],
      providers: [
        { provide: AppRuntimeService, useValue: { autoscaling: async () => a, setAutoscaling } },
        { provide: ToastService, useValue: { showSuccess: () => undefined, showError: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AppAutoscalingCardComponent);
    fixture.componentRef.setInput('appId', 'a-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const find = <T extends HTMLElement>(testid: string): T | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const type = (testid: string, value: string): void => {
    const input = find<HTMLInputElement>(testid)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('turns autoscaling on with a range for an app published from an image', async () => {
    await build(state());
    const box = find<HTMLInputElement>('autoscaling-enabled')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    type('autoscaling-max', '4');
    find<HTMLButtonElement>('autoscaling-save')!.click();
    await fixture.whenStable();
    expect(setAutoscaling).toHaveBeenCalledWith('a-1', { enabled: true, min: 1, max: 4, targetCPU: 80 });
  });

  it('will not save a range that cannot grow', async () => {
    await build(state({ enabled: true, min: 2, max: 4 }));
    type('autoscaling-max', '2');
    expect(find('autoscaling-problem')!.textContent).toContain('above min');
    expect(find<HTMLButtonElement>('autoscaling-save')!.disabled).toBeTrue();
  });

  it('leaves the range of a flui.yaml app to its manifest', async () => {
    await build(state({ enabled: true, min: 1, max: 3, rangeFrom: 'manifest' }));
    expect(find<HTMLInputElement>('autoscaling-min')!.disabled).toBeTrue();
    expect(find('autoscaling-manifest')).not.toBeNull();
    type('autoscaling-cpu', '60');
    find<HTMLButtonElement>('autoscaling-save')!.click();
    await fixture.whenStable();
    expect(setAutoscaling).toHaveBeenCalledWith('a-1', { enabled: true, targetCPU: 60 });
  });
});
