import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';
import { AlarmExit, WriteScalingGroup } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingGroupStore } from './scaling-group.store';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-scaling-now-blocked',
  imports: [RouterLink, FlAlert, FlButton, FlSpinner],
  host: { class: 'block' },
  template: `
    @if (blocked(); as b) {
      <fl-alert tone="warning" [title]="b.headline" data-testid="alarm-block">
        @if (whyOpen() && asks()) {
          <span class="block max-w-prose">{{ asks() }}</span>
        }
        @if (confirmingExit(); as exit) {
          <span class="mt-1 block text-fl-ink">{{ confirmText(exit) }}</span>
        }

        <ng-container alertActions>
          @if (confirmingExit(); as exit) {
            <button
              flButton="primary"
              size="sm"
              type="button"
              [disabled]="saving()"
              (click)="apply(exit)"
              [attr.data-testid]="'alarm-exit-confirm-' + exit.kind"
            >
              @if (saving()) {
                <fl-spinner label="Saving" />
              }
              {{ saving() ? 'Saving…' : 'Confirm' }}
            </button>
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [disabled]="saving()"
              (click)="confirming.set(null)"
            >
              Cancel
            </button>
          } @else {
            @for (exit of b.exits; track exit.kind) {
              @if (exit.kind === 'attach') {
                <a
                  flButton
                  size="sm"
                  [routerLink]="['/cluster', group().clusterId, 'nodes']"
                  data-testid="alarm-exit-attach"
                  >{{ exit.label }}</a
                >
              } @else if (exit.kind === 'add-shape' && !exit.shape) {
                <a
                  flButton
                  size="sm"
                  [routerLink]="['/scaling', group().id, 'group']"
                  data-testid="alarm-exit-add-shape"
                  >{{ exit.label }}</a
                >
              } @else {
                <button
                  flButton
                  size="sm"
                  type="button"
                  (click)="confirming.set(exit.kind)"
                  [attr.data-testid]="'alarm-exit-' + exit.kind"
                >
                  {{ exit.label }}
                </button>
              }
            }
          }
          @if (asks()) {
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [attr.aria-expanded]="whyOpen()"
              (click)="whyOpen.set(!whyOpen())"
              data-testid="alarm-why"
            >
              {{ whyOpen() ? 'Hide why' : 'Why' }}
            </button>
          }
        </ng-container>
      </fl-alert>
    }
  `,
})
export class ScalingNowBlockedComponent {
  readonly group = input.required<SectionGroup>();
  private readonly store = inject(ScalingGroupStore);
  private readonly api = inject(ScalingApiService);
  private readonly toast = inject(ToastService);

  protected readonly whyOpen = signal(false);
  protected readonly confirming = signal<AlarmExit['kind'] | null>(null);
  protected readonly saving = signal(false);

  protected readonly confirmingExit = computed(() => {
    const kind = this.confirming();
    return kind ? (this.blocked()?.exits.find((e) => e.kind === kind) ?? null) : null;
  });

  protected readonly blocked = computed(() => {
    const preview = this.store.preview().data;
    const alarm = this.store.row().data?.openAlarm ?? null;
    if (!preview?.blocked) return null;
    const purchaseAlarm = alarm !== null && alarm.kind !== 'give-back';
    return preview.pending || purchaseAlarm ? preview.blocked : null;
  });

  protected readonly asks = computed(
    () => this.store.preview().data?.asks ?? this.store.row().data?.openAlarm?.asks ?? null,
  );

  protected confirmText(exit: AlarmExit): string {
    const g = this.group();
    switch (exit.kind) {
      case 'raise-cap':
        return `Set the spending ceiling from ${g.limits.maxMonthlyCost === null ? 'none' : '€' + g.limits.maxMonthlyCost.toFixed(2)} to €${exit.toEur}?`;
      case 'raise-max-nodes':
        return `Set max nodes from ${g.bounds.max} to ${exit.toNodes}?`;
      case 'add-shape':
        return `Add ${exit.shape} after ${g.shapes.join(', ') || 'the current list'}?`;
      default:
        return '';
    }
  }

  protected async apply(exit: AlarmExit): Promise<void> {
    const g = this.group();
    const body = this.bodyFor(exit, g);
    if (!body) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.updateGroup(g.id, body as WriteScalingGroup));
      this.toast.showSuccess({ title: 'Group saved', message: exit.label });
      this.confirming.set(null);
      this.store.reload();
    } catch (err: unknown) {
      const e = err as { error?: { message?: string | string[] }; message?: string };
      const message = e?.error?.message ?? e?.message ?? 'The group was not changed.';
      this.toast.showError({
        title: 'Group not saved',
        message: Array.isArray(message) ? message.join(' ') : message,
      });
    } finally {
      this.saving.set(false);
    }
  }

  private bodyFor(exit: AlarmExit, g: SectionGroup): Partial<WriteScalingGroup> | null {
    switch (exit.kind) {
      case 'raise-cap':
        return exit.toEur === null
          ? null
          : {
              limits: { hourlyBillingOnly: g.limits.hourlyBillingOnly, maxMonthlyCost: exit.toEur },
            };
      case 'raise-max-nodes':
        return exit.toNodes === null ? null : { bounds: { ...g.bounds, max: exit.toNodes } };
      case 'add-shape':
        return exit.shape ? { shapes: [...g.shapes, exit.shape] } : null;
      default:
        return null;
    }
  }
}
