import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ToastService } from '../../../shared/services/toast.service';
import { SectionGroup } from '../../model/scaling-section.models';
import { WriteScalingGroup } from '../../model/scaling-group.models';
import { ScalingApiService } from '../../service/scaling-api.service';

@Component({
  selector: 'app-scaling-mode',
  standalone: true,
  imports: [ExplainComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2" data-testid="scaling-mode">
      <app-explain
        [floating]="true"
        [label]="label()"
        [labelClass]="labelClass()"
        testid="scaling-mode-label"
      >
        {{ group().acts.says }}
        <ng-content />
      </app-explain>

      @if (canSwitch()) {
        @if (!confirming()) {
          <button
            type="button"
            class="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            data-testid="scaling-mode-switch"
            (click)="confirming.set(true)"
          >
            Switch to automatic
          </button>
        } @else {
          <span class="inline-flex flex-wrap items-center gap-2 text-xs" data-testid="scaling-mode-confirm">
            <span>{{ promise() }}</span>
            <button
              type="button"
              class="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground disabled:opacity-50"
              [disabled]="saving()"
              data-testid="scaling-mode-switch-confirm"
              (click)="switchToAutomatic()"
            >
              {{ saving() ? 'Switching…' : 'Switch' }}
            </button>
            <button
              type="button"
              class="px-1.5 py-1 text-muted-foreground hover:text-foreground"
              [disabled]="saving()"
              (click)="confirming.set(false)"
            >
              Cancel
            </button>
          </span>
        }
      }
    </div>
  `,
})
export class ScalingModeComponent {
  private readonly api = inject(ScalingApiService);
  private readonly toast = inject(ToastService);

  readonly group = input.required<SectionGroup>();
  readonly switched = output<SectionGroup>();

  protected readonly confirming = signal(false);
  protected readonly saving = signal(false);

  protected readonly label = computed(() => {
    const g = this.group();
    if (g.acts.label) return g.acts.label;
    if (!g.capability.canProvision) return 'Alarm only';
    return g.acts.acts ? 'Automatic' : 'Manual — Flui does not buy';
  });

  protected readonly attention = computed(() => {
    const g = this.group();
    return g.acts.attention ?? (g.capability.canProvision && !g.acts.acts);
  });

  protected readonly labelClass = computed(() =>
    this.attention()
      ? 'rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
      : 'rounded-md bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary',
  );

  protected readonly canSwitch = computed(() => {
    const g = this.group();
    return g.capability.canProvision && g.provision === 'manual';
  });

  protected readonly promise = computed(() => {
    const g = this.group();
    const nodes = `${g.bounds.max} ${g.bounds.max === 1 ? 'node' : 'nodes'}`;
    const cap = g.limits.maxMonthlyCost;
    return cap === null
      ? `Flui will buy on its own, up to ${nodes}, with no money ceiling.`
      : `Flui will buy on its own, up to €${cap} a month and ${nodes}.`;
  });

  protected async switchToAutomatic(): Promise<void> {
    const g = this.group();
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.updateGroup(g.id, { provision: 'automatic' } as WriteScalingGroup),
      );
      this.toast.showSuccess({
        title: 'Group switched to automatic',
        message: saved.acts.label ?? this.promise(),
      });
      this.confirming.set(false);
      this.switched.emit(saved);
    } catch (err: unknown) {
      const e = err as { error?: { message?: string | string[] }; message?: string };
      const message = e?.error?.message ?? e?.message ?? 'The group was not changed.';
      this.toast.showError({
        title: 'Group not switched',
        message: Array.isArray(message) ? message.join(' ') : message,
      });
    } finally {
      this.saving.set(false);
    }
  }
}
