import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideListOrdered } from '@ng-icons/lucide';
import { ScalingPreview } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { LadderRow, ladderRows, rowsAgree } from './ladder-rows';
import { ScalingLadderDialogComponent } from './now-ladder-dialog.component';
import { ScalingGroupStore } from './scaling-group.store';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

const EMPTY_PREVIEW: ScalingPreview = {
  pending: null,
  opportunityHeldBecause: null,
  ladder: [],
  chosen: null,
  asks: null,
};

@Component({
  selector: 'app-scaling-now-ladder',
  imports: [
    RouterLink,
    ScalingLadderDialogComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
    FlAlert,
    FlPanel,
    FlTable,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideListOrdered })],
  host: { class: 'block' },
  template: `
    <fl-panel title="If a node were needed now" [flush]="true" data-testid="ladder">
      <ng-container panelActions>
        @if (!loading() && !failed() && !unsearchable() && rows().length) {
          <button
            flButton
            size="sm"
            type="button"
            data-testid="ladder-open-steps"
            (click)="stepping.set(true)"
          >
            <fl-icon name="lucideListOrdered" [size]="14" />
            See the {{ rows().length }} steps
          </button>
          @if (buyable(); as machine) {
            @if (!confirmBuy()) {
              <button
                flButton="primary"
                size="sm"
                type="button"
                data-testid="ladder-buy-once"
                (click)="confirmBuy.set(true)"
              >
                Add this {{ machine.shape }}
              </button>
            }
          }
        }
      </ng-container>

      @if (removable(); as node) {
        <div class="p-4 pb-0">
          <fl-alert
            tone="info"
            title="The fleet is above its target"
            data-testid="ladder-give-back"
          >
            @if (!confirmRemove()) {
              This manual group would remove <span class="fl-mono">{{ node }}</span>. Its work moves
              to the nodes that stay.
            } @else {
              <span data-testid="ladder-remove-confirm"
                >Drain and delete <span class="fl-mono">{{ node }}</span>? The group stays
                manual.</span
              >
            }
            <ng-container alertActions>
              @if (!confirmRemove()) {
                <button
                  flButton
                  size="sm"
                  type="button"
                  data-testid="ladder-remove-once"
                  (click)="confirmRemove.set(true)"
                >
                  Remove {{ node }}
                </button>
              } @else {
                <button
                  flButton="danger"
                  size="sm"
                  type="button"
                  [disabled]="removing()"
                  (click)="removeOnce(node)"
                  data-testid="ladder-remove-confirm-yes"
                >
                  @if (removing()) {
                    <fl-spinner label="Removing" />
                  }
                  {{ removing() ? 'Removing…' : 'Remove ' + node }}
                </button>
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [disabled]="removing()"
                  (click)="confirmRemove.set(false)"
                >
                  Cancel
                </button>
              }
            </ng-container>
          </fl-alert>
        </div>
      }

      @if (loading()) {
        <div class="p-4">
          <app-section-skeleton
            variant="cards"
            [count]="1"
            label="the urgency ladder"
            testid="ladder"
          />
        </div>
      } @else if (failed(); as message) {
        <div class="p-4">
          <app-section-failure [message]="message" testid="ladder" (retry)="store.reload()" />
        </div>
      } @else if (unsearchable()) {
        <div class="p-4">
          <fl-alert tone="warning" title="Not set up" data-testid="ladder-unsearchable">
            No machines are chosen, so there is nothing Flui may add and nothing for it to name when
            an app has nowhere to run.
            <a
              alertActions
              flButton
              size="sm"
              routerLink="../group"
              data-testid="ladder-choose-machines"
              >Choose machines</a
            >
          </fl-alert>
        </div>
      } @else if (rows().length) {
        <div class="flex flex-col gap-1 px-4 py-3">
          <fl-status
            [tone]="headline().tone"
            [label]="headline().verdict"
            data-testid="ladder-verdict"
          />
          <span class="text-fl-body-sm text-fl-ink-secondary" data-testid="ladder-why">
            {{ headline().why }}
          </span>
        </div>

        @if (buyable(); as machine) {
          @if (confirmBuy()) {
            <div class="px-4 pb-3">
              <fl-alert
                tone="info"
                [title]="'Add one ' + machine.shape + ' in ' + machine.region + machine.price + '?'"
                data-testid="ladder-buy-confirm"
              >
                The group stays manual.
                <ng-container alertActions>
                  <button
                    flButton="primary"
                    size="sm"
                    type="button"
                    [disabled]="buying()"
                    (click)="buyOnce(machine.shape, machine.region)"
                    data-testid="ladder-buy-confirm-yes"
                  >
                    @if (buying()) {
                      <fl-spinner label="Adding" />
                    }
                    {{ buying() ? 'Adding…' : 'Add ' + machine.shape }}
                  </button>
                  <button
                    flButton="ghost"
                    size="sm"
                    type="button"
                    [disabled]="buying()"
                    (click)="confirmBuy.set(false)"
                  >
                    Cancel
                  </button>
                </ng-container>
              </fl-alert>
            </div>
          }
        }

        <div class="fl-table-wrap border-t border-fl-border">
          <table flTable density="dense" aria-label="Steps of the search">
            <thead>
              <tr>
                <th scope="col" class="is-num">Step</th>
                <th scope="col">What it tries</th>
                <th scope="col">Machine</th>
                <th scope="col">Verdict</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.rung.step) {
                <tr
                  [class.is-selected]="row.chosen"
                  [attr.data-testid]="'ladder-row-' + row.rung.step"
                >
                  <td class="is-num">{{ row.rung.step }}</td>
                  <td class="is-wrap">{{ row.rung.describes }}</td>
                  <td class="fl-mono">{{ row.offer || '—' }}</td>
                  <td><fl-status [tone]="row.tone" [label]="row.verdict" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>

    @if (stepping()) {
      <app-scaling-ladder-dialog
        [rows]="rows()"
        [subtitle]="subtitle()"
        (closed)="stepping.set(false)"
      />
    }
  `,
})
export class ScalingNowLadderComponent {
  protected readonly store = inject(ScalingGroupStore);

  readonly group = input.required<SectionGroup>();

  protected readonly stepping = signal(false);
  private readonly api = inject(ScalingApiService);
  private readonly toast = inject(ToastService);
  protected readonly confirmBuy = signal(false);
  protected readonly buying = signal(false);
  protected readonly confirmRemove = signal(false);
  protected readonly removing = signal(false);

  protected readonly removable = computed(() => {
    const g = this.group();
    const giveBack = this.store.preview().data?.giveBack;
    if (!g.capability.canProvision || !giveBack || giveBack.onItsOwn) return null;
    return giveBack.node;
  });

  protected async removeOnce(node: string): Promise<void> {
    this.removing.set(true);
    try {
      const decision = await firstValueFrom(this.api.approveRemoval(this.group().id, node));
      this.toast.showSuccess({ title: 'Node being removed', message: decision.did });
      this.confirmRemove.set(false);
      this.store.reload();
    } catch (err: unknown) {
      const e = err as { error?: { message?: string | string[] }; message?: string };
      const message = e?.error?.message ?? e?.message ?? 'Nothing was removed.';
      this.toast.showError({
        title: 'Nothing removed',
        message: Array.isArray(message) ? message.join(' ') : message,
      });
      this.store.reload();
    } finally {
      this.removing.set(false);
    }
  }

  protected readonly buyable = computed(() => {
    const g = this.group();
    const preview = this.store.preview().data;
    const chosen = preview?.chosen;
    if (!g.capability.canProvision || g.provision !== 'manual') return null;
    if (!chosen?.shape || !chosen.region || g.purchase?.state === 'buying') return null;
    const price = chosen.hourlyEur === null ? '' : ` at €${chosen.hourlyEur}/h`;
    return { shape: chosen.shape, region: chosen.region, price };
  });

  protected async buyOnce(shape: string, region: string): Promise<void> {
    this.buying.set(true);
    try {
      const decision = await firstValueFrom(
        this.api.approvePurchase(this.group().id, { shape, region }),
      );
      this.toast.showSuccess({ title: 'Node being added', message: decision.did });
      this.confirmBuy.set(false);
      this.store.reload();
    } catch (err: unknown) {
      const e = err as { error?: { message?: string | string[] }; message?: string };
      const message = e?.error?.message ?? e?.message ?? 'Nothing was added.';
      this.toast.showError({
        title: 'Nothing added',
        message: Array.isArray(message) ? message.join(' ') : message,
      });
      this.store.reload();
    } finally {
      this.buying.set(false);
    }
  }

  protected readonly loading = computed(() => this.store.preview().loading);
  protected readonly failed = computed(() => this.store.preview().failed);

  private readonly preview = computed<ScalingPreview>(
    () => this.store.preview().data ?? EMPTY_PREVIEW,
  );

  protected readonly rows = computed<LadderRow[]>(() =>
    ladderRows({
      group: this.group(),
      preview: this.preview(),
      outlook: this.store.outlook(),
      read: this.store.catalogue().data?.reading === 'read',
    }),
  );

  /**
   * The rung that decided, or — where none did — the first one, whose reason is
   * the whole story when every rung repeats it. Where they disagree, the line
   * says so rather than promoting one failure over the others.
   */
  protected readonly headline = computed<LadderRow>(() => {
    const rows = this.rows();
    const chosen = rows.find((r) => r.chosen);
    if (chosen) return this.withOffer(chosen);

    const first = rows[0];
    if (rowsAgree(rows)) return first;

    return {
      ...first,
      why: `Nothing this group may add fits, each for its own reason. ${rows.length} steps were tried.`,
    };
  });

  /**
   * No rung ever named a machine, so no search happened and there is no ladder
   * to read — only a setup that was never finished. Derived from the rungs
   * rather than the group's own fields, so whatever leaves the engine with no
   * candidate to weigh lands here.
   */
  protected readonly unsearchable = computed(() => {
    const deciding = this.rows().filter((r) => r.rung.outcome !== 'alert');
    return deciding.length > 0 && deciding.every((r) => !r.rung.shape);
  });

  protected readonly subtitle = computed(() => {
    const waiting = this.preview().pending;
    return waiting
      ? `Measured against ${waiting.cpu} · ${waiting.memory}.`
      : 'Nothing is waiting — this is what the next stuck app would meet.';
  });

  /** A winning rung names a machine, and the machine is the point of the line. */
  private withOffer(row: LadderRow): LadderRow {
    if (!row.offer) return row;
    return { ...row, why: `${row.offer} — ${row.why}` };
  }
}
