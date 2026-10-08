import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBell, lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import { ToastService } from '../../../shared/services/toast.service';
import { WriteScalingGroup } from '../../model/scaling-group.models';
import { GiveBackAlarm, SectionGroup } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingGroupStore } from './scaling-group.store';

/**
 * A fleet above its target whose spare node cannot be emptied: the bill is a
 * node too large and nothing is being bought. Two lines and two ways out; the
 * applications in the way only when somebody asks for them.
 */
@Component({
  selector: 'app-scaling-now-give-back',
  standalone: true,
  imports: [NgIcon, RouterLink],
  providers: [provideIcons({ lucideBell, lucideChevronDown, lucideChevronUp })],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 text-sm"
      data-testid="give-back-alarm"
    >
      <p class="m-0 flex items-start gap-2 font-semibold text-foreground">
        <ng-icon name="lucideBell" class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span>{{ headline() }}</span>
      </p>
      <p class="m-0 mt-1 pl-6 text-[13px] text-muted-foreground">
        {{ alarm().says }}, so Flui cannot give it back · open {{ age() }}
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-2 pl-6">
        @if (confirming()) {
          <span class="inline-flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs">
            Set the target from {{ alarm().target }} to {{ alarm().keepNodes }} nodes and keep {{ nodeName() }}?
            <button
              type="button"
              class="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-50"
              [disabled]="saving()"
              (click)="keep()"
              data-testid="give-back-keep-confirm"
            >
              {{ saving() ? 'Saving…' : 'Confirm' }}
            </button>
            <button type="button" class="text-muted-foreground" (click)="confirming.set(false)">Cancel</button>
          </span>
        } @else {
          <button
            type="button"
            class="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
            (click)="confirming.set(true)"
            data-testid="give-back-keep"
          >
            Keep {{ alarm().keepNodes }} nodes
          </button>
        }
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          (click)="open.set(!open())"
          data-testid="give-back-details"
        >
          What is in the way
          <ng-icon [name]="open() ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3.5 w-3.5" />
        </button>
      </div>

      @if (open()) {
        <div class="mt-3 space-y-3 border-t border-amber-500/20 pl-6 pt-3">
          @for (reason of alarm().reasons; track reason.kind) {
            <div>
              <p class="m-0 text-[13px] font-medium text-foreground">{{ reason.title }}</p>
              <p class="m-0 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                @for (item of reason.items; track item.label) {
                  @if (item.applicationId) {
                    <a
                      [routerLink]="['/apps/applications', item.applicationId]"
                      class="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >{{ item.label }}</a>
                  } @else {
                    <span class="font-mono text-xs text-foreground">{{ item.label }}</span>
                  }
                }
              </p>
              <p class="m-0 mt-1 text-xs text-muted-foreground">{{ reason.fix }}</p>
            </div>
          }
        </div>
      }
    </section>
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
    const cost = a.monthlyEur === null ? '' : ` costs about €${a.monthlyEur.toFixed(2)} a month and`;
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
