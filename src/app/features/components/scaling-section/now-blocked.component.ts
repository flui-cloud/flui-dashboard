import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBell } from '@ng-icons/lucide';
import { ToastService } from '../../../shared/services/toast.service';
import { AlarmExit, WriteScalingGroup } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingGroupStore } from './scaling-group.store';

@Component({
  selector: 'app-scaling-now-blocked',
  standalone: true,
  imports: [NgIcon, RouterLink],
  providers: [provideIcons({ lucideBell })],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (blocked(); as b) {
      <section
        class="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 text-sm"
        data-testid="alarm-block"
      >
        <p class="m-0 flex items-center gap-2 font-semibold text-foreground">
          <ng-icon name="lucideBell" class="h-4 w-4 shrink-0 text-amber-500" />
          {{ b.headline }}
          @if (asks()) {
            <button
              type="button"
              class="ml-1 text-[13px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              (click)="whyOpen.set(!whyOpen())"
              data-testid="alarm-why"
            >
              {{ whyOpen() ? 'Hide' : 'Why' }}
            </button>
          }
        </p>
        @if (whyOpen() && asks()) {
          <p class="m-0 mt-2 max-w-[80ch] text-[13px] text-muted-foreground">{{ asks() }}</p>
        }

        <div class="mt-3 flex flex-wrap items-center gap-2">
          @for (exit of b.exits; track exit.kind) {
            @if (confirming() === exit.kind) {
              <span class="inline-flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs">
                {{ confirmText(exit) }}
                <button
                  type="button"
                  class="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-50"
                  [disabled]="saving()"
                  (click)="apply(exit)"
                  [attr.data-testid]="'alarm-exit-confirm-' + exit.kind"
                >
                  {{ saving() ? 'Saving…' : 'Confirm' }}
                </button>
                <button type="button" class="text-muted-foreground" (click)="confirming.set(null)">Cancel</button>
              </span>
            } @else if (exit.kind === 'attach') {
              <a
                [routerLink]="['/cluster', group().clusterId, 'nodes']"
                class="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                data-testid="alarm-exit-attach"
              >{{ exit.label }}</a>
            } @else if (exit.kind === 'add-shape' && !exit.shape) {
              <a
                [routerLink]="['/scaling', group().id, 'group']"
                class="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                data-testid="alarm-exit-add-shape"
              >{{ exit.label }}</a>
            } @else {
              <button
                type="button"
                class="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                (click)="confirming.set(exit.kind)"
                [attr.data-testid]="'alarm-exit-' + exit.kind"
              >
                {{ exit.label }}
              </button>
            }
          }
        </div>
      </section>
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

  protected readonly blocked = computed(() => {
    const preview = this.store.preview().data;
    const alarmOpen = this.store.row().data?.openAlarm ?? null;
    if (!preview?.blocked) return null;
    return preview.pending || alarmOpen ? preview.blocked : null;
  });

  protected readonly asks = computed(
    () => this.store.preview().data?.asks ?? this.store.row().data?.openAlarm?.asks ?? null,
  );

  protected confirmText(exit: AlarmExit): string {
    const g = this.group();
    switch (exit.kind) {
      case 'raise-cap':
        return `Set the monthly ceiling from ${g.limits.maxMonthlyCost === null ? 'none' : '€' + g.limits.maxMonthlyCost} to €${exit.toEur}?`;
      case 'raise-max-nodes':
        return `Set the node ceiling from ${g.bounds.max} to ${exit.toNodes}?`;
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
          : { limits: { hourlyBillingOnly: g.limits.hourlyBillingOnly, maxMonthlyCost: exit.toEur } };
      case 'raise-max-nodes':
        return exit.toNodes === null ? null : { bounds: { ...g.bounds, max: exit.toNodes } };
      case 'add-shape':
        return exit.shape ? { shapes: [...g.shapes, exit.shape] } : null;
      default:
        return null;
    }
  }
}
