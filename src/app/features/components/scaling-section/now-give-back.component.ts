import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import { ToastService } from '../../../shared/services/toast.service';
import { WriteScalingGroup } from '../../model/scaling-group.models';
import { GiveBackAlarm, SectionGroup } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingGroupStore } from './scaling-group.store';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

/**
 * A fleet above its target whose spare node cannot be emptied: the bill is a
 * node too large and nothing is being bought. Two lines and two ways out; the
 * applications in the way only when somebody asks for them.
 */
@Component({
  selector: 'app-scaling-now-give-back',
  imports: [RouterLink, FlAlert, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp })],
  host: { class: 'block' },
  template: `
    <fl-alert tone="warning" [title]="headline()" data-testid="give-back-alarm">
      <span class="block">{{ alarm().says }}, so Flui cannot remove it. Open {{ age() }}.</span>

      @if (confirming()) {
        <span class="mt-2 block text-fl-ink">
          Set the target from {{ alarm().target }} to {{ alarm().keepNodes }} nodes and keep
          {{ nodeName() }}?
        </span>
      }

      @if (open()) {
        <span class="mt-3 flex flex-col gap-3 border-t border-fl-warning-border pt-3">
          @for (reason of alarm().reasons; track reason.kind) {
            <span class="flex flex-col gap-1">
              <span class="font-medium text-fl-ink">{{ reason.title }}</span>
              <span class="flex flex-wrap gap-x-3 gap-y-1">
                @for (item of reason.items; track item.label) {
                  @if (item.applicationId) {
                    <a
                      class="fl-link fl-mono"
                      [routerLink]="['/apps/applications', item.applicationId]"
                      >{{ item.label }}</a
                    >
                  } @else {
                    <span class="fl-mono text-fl-ink">{{ item.label }}</span>
                  }
                }
              </span>
              <span class="text-fl-caption text-fl-ink-muted">{{ reason.fix }}</span>
            </span>
          }
        </span>
      }

      <ng-container alertActions>
        @if (confirming()) {
          <button
            flButton="primary"
            size="sm"
            type="button"
            [disabled]="saving()"
            (click)="keep()"
            data-testid="give-back-keep-confirm"
          >
            @if (saving()) {
              <fl-spinner label="Saving" />
            }
            {{ saving() ? 'Saving…' : 'Keep ' + alarm().keepNodes + ' nodes' }}
          </button>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [disabled]="saving()"
            (click)="confirming.set(false)"
          >
            Cancel
          </button>
        } @else {
          <button
            flButton
            size="sm"
            type="button"
            (click)="confirming.set(true)"
            data-testid="give-back-keep"
          >
            Keep {{ alarm().keepNodes }} nodes
          </button>
        }
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [attr.aria-expanded]="open()"
          (click)="open.set(!open())"
          data-testid="give-back-details"
        >
          What is in the way
          <fl-icon [name]="open() ? 'lucideChevronUp' : 'lucideChevronDown'" [size]="14" />
        </button>
      </ng-container>
    </fl-alert>
  `,
})
export class ScalingNowGiveBackComponent {
  readonly group = input.required<SectionGroup>();
  readonly alarm = input.required<GiveBackAlarm>();
  readonly age = input.required<string>();

  private readonly store = inject(ScalingGroupStore);
  private readonly api = inject(ScalingApiService);
  private readonly toast = inject(ToastService);

  protected readonly open = signal(false);
  protected readonly confirming = signal(false);
  protected readonly saving = signal(false);

  protected readonly nodeName = computed(() => this.alarm().node ?? 'the extra node');

  protected readonly headline = computed(() => {
    const a = this.alarm();
    const cost =
      a.monthlyEur === null ? '' : ` costs about €${a.monthlyEur.toFixed(2)} a month and`;
    const target = `${a.target} ${a.target === 1 ? 'node' : 'nodes'}`;
    return `${this.nodeName()}${cost} is above the target of ${target}`;
  });

  protected async keep(): Promise<void> {
    const g = this.group();
    const keepNodes = this.alarm().keepNodes;
    const body: Partial<WriteScalingGroup> = {
      bounds: { ...g.bounds, desired: keepNodes, max: Math.max(g.bounds.max, keepNodes) },
    };
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.updateGroup(g.id, body as WriteScalingGroup));
      this.toast.showSuccess({ title: 'Group saved', message: `Target set to ${keepNodes} nodes` });
      this.confirming.set(false);
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
}
