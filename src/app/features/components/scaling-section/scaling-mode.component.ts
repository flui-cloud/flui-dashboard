import { Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ToastService } from '../../../shared/services/toast.service';
import { SectionGroup } from '../../model/scaling-section.models';
import { WriteScalingGroup } from '../../model/scaling-group.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { groupModeStatus } from './scaling-tabs-format';

let nextCapId = 0;

@Component({
  selector: 'app-scaling-mode',
  imports: [ExplainComponent, FlButton, FlStatus],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-3" data-testid="scaling-mode">
      <div class="flex flex-wrap items-center gap-3">
        <fl-status
          class="min-w-0 whitespace-normal"
          [tone]="mode().tone"
          [label]="label()"
          data-testid="scaling-mode-status"
        />
        <app-explain
          [floating]="true"
          label="What this means"
          labelClass="text-fl-body-sm text-fl-ink-muted"
          testid="scaling-mode-label"
        >
          {{ group().acts.says }}
          <ng-content />
        </app-explain>
        @if (canSwitch() && !confirming()) {
          <button
            flButton
            size="sm"
            type="button"
            data-testid="scaling-mode-switch"
            (click)="confirming.set(true)"
          >
            {{ switchLabel() }}
          </button>
        }
      </div>

      @if (canSwitch() && confirming()) {
        <div class="flex flex-wrap items-end gap-3" data-testid="scaling-mode-confirm">
          @if (needsCap()) {
            <div class="fl-field">
              <label class="fl-field__label" [for]="capId">Spending ceiling</label>
              <div class="fl-input w-32">
                <span class="text-fl-body-sm">€</span>
                <input
                  [id]="capId"
                  type="number"
                  min="1"
                  step="1"
                  class="fl-mono"
                  data-testid="scaling-mode-cap"
                  [value]="capOrSuggested() ?? ''"
                  (input)="cap.set(asAmount($any($event.target).value))"
                />
              </div>
            </div>
          }
          <p class="m-0 max-w-prose flex-1 text-fl-body-sm">{{ promise() }}</p>
          <span class="inline-flex items-center gap-2">
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [disabled]="saving()"
              (click)="confirming.set(false)"
            >
              Cancel
            </button>
            <button
              flButton="primary"
              size="sm"
              type="button"
              [disabled]="saving() || !ceiling()"
              data-testid="scaling-mode-switch-confirm"
              (click)="switchToAutomatic()"
            >
              {{ saving() ? 'Switching…' : 'Switch' }}
            </button>
          </span>
        </div>
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
  protected readonly cap = signal<number | null>(null);

  protected readonly capId = `scaling-mode-cap-${nextCapId++}`;

  protected readonly mode = computed(() => groupModeStatus(this.group()));

  protected readonly label = computed(() => this.mode().label);

  /** An automatic group only buys under a spending ceiling, the safety net, so one without it is asked for it here. */
  protected readonly needsCap = computed(() => {
    const cap = Number(this.group().limits.maxMonthlyCost);
    return Number.isNaN(cap) || cap <= 0;
  });

  protected readonly canSwitch = computed(() => {
    const g = this.group();
    return g.capability.canProvision && (g.provision === 'manual' || this.needsCap());
  });

  protected readonly switchLabel = computed(() =>
    this.group().provision === 'automatic' ? 'Set a spending ceiling' : 'Switch to automatic',
  );

  /** What the API proposes: a ceiling covering the worst case, so it only stops a runaway. */
  private readonly suggested = computed(() => this.group().cost?.suggestedCeilingEur ?? null);

  protected readonly capOrSuggested = computed(() => this.cap() ?? this.suggested());

  protected readonly ceiling = computed(() => {
    const cap = this.needsCap() ? this.capOrSuggested() : this.group().limits.maxMonthlyCost;
    return cap !== null && cap > 0 ? cap : null;
  });

  protected readonly promise = computed(() => {
    const g = this.group();
    const nodes = `${g.bounds.max} ${g.bounds.max === 1 ? 'node' : 'nodes'}`;
    const cap = this.ceiling();
    const worst = g.cost?.scenarios.find((s) => s.kind === 'worst-case')?.highEur ?? null;
    const ifFull = worst === null ? '' : ` At ${nodes} all month: €${worst.toFixed(2)}.`;
    return cap === null
      ? `Flui adds nodes on its own, up to ${nodes}, only under a spending ceiling.${ifFull}`
      : `Flui will add nodes on its own, up to ${nodes}, never past a spending ceiling of €${cap.toFixed(2)} a month.${ifFull}`;
  });

  protected asAmount(value: string): number | null {
    const amount = Number(value);
    return value.trim() !== '' && Number.isFinite(amount) ? amount : null;
  }

  protected async switchToAutomatic(): Promise<void> {
    const g = this.group();
    const cap = this.ceiling();
    if (cap === null) return;
    this.saving.set(true);
    try {
      const body: Partial<WriteScalingGroup> = { provision: 'automatic' };
      if (this.needsCap()) {
        body.limits = { hourlyBillingOnly: g.limits.hourlyBillingOnly, maxMonthlyCost: cap };
      }
      const saved = await firstValueFrom(this.api.updateGroup(g.id, body as WriteScalingGroup));
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
