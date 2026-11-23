import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExplainComponent } from '../../../shared/components/explain.component';
import {
  ArchitectureBadgeComponent,
  architectureWarning,
} from '../../../shared/components/architecture-badge.component';
import { AvailabilityOutlook } from '../../model/scaling-group.models';
import { SectionGroup, ShapeSpec } from '../../model/scaling-section.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { GroupDraftStore } from './group-draft.store';
import { ScalingGroupStore } from './scaling-group.store';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';
import {
  CatalogueState,
  STALE_AFTER_SECONDS,
  STATE_LABEL,
  STATE_TONE,
  heldFor,
  readingAge,
  refusesWholeCatalogue,
} from './scaling-tabs-format';

type Allowance = 'preferred' | 'not-listed' | 'refused-by-limit';

interface MarketRow {
  shape: string;
  state: CatalogueState;
  stateLabel: string;
  up: string[];
  down: string[];
  age: string;
  stale: boolean;
  allowance: Allowance;
  rank: number | null;
  awaited: boolean;
  spec: string | null;
  architecture: string | null;
}

@Component({
  selector: 'app-scaling-market-tab',
  imports: [
    RouterLink,
    ExplainComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
    ArchitectureBadgeComponent,
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    FlStatus,
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (group(); as g) {
      <div class="fl-stack" data-testid="market-tab">
        @if (!g.capability.hasCatalogue) {
          <fl-panel title="Machines" data-testid="market-none">
            <fl-empty-state
              title="There is no market to read"
              [body]="
                g.clusterName +
                ' runs your own machines, so there are no prices and no availability to read. What a machine has to hold is on the Group tab.'
              "
            >
              <a
                flButton
                size="sm"
                [routerLink]="['/scaling', g.id, 'group']"
                data-testid="market-none-to-group"
              >
                What a machine has to hold
              </a>
            </fl-empty-state>
          </fl-panel>
        } @else if (loading()) {
          <fl-panel title="Catalogue" [flush]="true">
            <app-section-skeleton
              variant="table"
              [count]="4"
              label="the catalogue"
              testid="market"
            />
          </fl-panel>
        } @else if (failed()) {
          <app-section-failure
            [message]="failed() ?? ''"
            testid="market"
            (retry)="store.reload()"
          />
        } @else {
          @if (unread(); as catalogue) {
            <fl-alert
              [tone]="catalogue.reading === 'unreachable' ? 'warning' : 'info'"
              title="The catalogue was not read"
              [attr.data-reading]="catalogue.reading"
              data-testid="market-reading"
            >
              {{ catalogue.says }}
            </fl-alert>
          }

          <fl-panel title="Catalogue" [count]="rows().length" [flush]="true">
            <span
              panelActions
              class="text-fl-body-sm text-fl-ink-muted"
              data-testid="market-provider"
            >
              Read from <span class="fl-mono text-fl-ink">{{ g.capability.provider }}</span>
            </span>

            <div class="border-b border-fl-border px-4 py-3">
              <app-explain
                [floating]="true"
                label="The catalogue informs; it never decides."
                labelClass="text-fl-body-sm text-fl-ink-muted"
                testid="informs-not-decides"
              >
                A machine listed as up can still be refused when Flui tries to add it.
              </app-explain>
            </div>

            @if (rows().length) {
              <div class="fl-table-wrap">
                <table flTable density="dense">
                  <thead>
                    <tr>
                      <th scope="col">Machine</th>
                      <th scope="col">State</th>
                      <th scope="col">Up in</th>
                      <th scope="col">Down in</th>
                      <th scope="col" class="is-num">
                        <app-explain
                          [floating]="true"
                          label="Read"
                          labelClass="text-fl-caption font-semibold"
                          testid="read-why"
                        >
                          A machine read ten minutes ago may have sold out since.
                        </app-explain>
                      </th>
                      <th scope="col">In this group</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rows(); track row.shape) {
                      <tr [attr.data-testid]="'shape-' + row.shape" [attr.data-state]="row.state">
                        <td role="rowheader">
                          <span class="inline-flex items-center gap-1.5">
                            <span class="fl-mono">{{ row.shape }}</span>
                            <app-architecture-badge [architecture]="row.architecture" />
                          </span>
                          @if (row.spec) {
                            <span
                              class="block fl-mono text-fl-ink-muted"
                              [attr.data-testid]="'spec-' + row.shape"
                              >{{ row.spec }}</span
                            >
                          }
                        </td>
                        <td>
                          <fl-status
                            [tone]="tone(row.state)"
                            [label]="row.stateLabel"
                            [attr.data-testid]="'state-' + row.shape"
                          />
                        </td>
                        <td class="whitespace-normal">
                          @if (row.up.length) {
                            <span class="flex flex-wrap gap-x-2 gap-y-1">
                              @for (region of row.up; track region) {
                                <span
                                  class="fl-mono"
                                  [attr.data-testid]="'up-' + row.shape + '-' + region"
                                  >{{ region }}</span
                                >
                              }
                            </span>
                          } @else {
                            <span class="text-fl-ink-muted">Nowhere</span>
                          }
                        </td>
                        <td class="whitespace-normal">
                          @if (row.down.length) {
                            <span class="flex flex-wrap gap-x-2 gap-y-1">
                              @for (region of row.down; track region) {
                                <span
                                  class="fl-mono"
                                  [attr.data-testid]="'down-' + row.shape + '-' + region"
                                  >{{ region }}</span
                                >
                              }
                            </span>
                          } @else {
                            <span class="text-fl-ink-muted">Nowhere</span>
                          }
                        </td>
                        <td class="is-num" [attr.data-testid]="'read-' + row.shape">
                          @if (row.stale) {
                            <fl-status tone="warning" class="fl-mono" [label]="row.age" />
                          } @else {
                            <span class="fl-mono text-fl-ink-muted">{{ row.age }}</span>
                          }
                        </td>
                        <td>
                          <span
                            class="flex flex-col gap-0.5"
                            [attr.data-testid]="'allowed-' + row.shape"
                            [attr.data-allowance]="row.allowance"
                          >
                            @switch (row.allowance) {
                              @case ('preferred') {
                                <span class="fl-num">preference {{ row.rank }}</span>
                              }
                              @case ('refused-by-limit') {
                                <fl-status tone="error" label="Refused by limit" />
                              }
                              @default {
                                <span class="text-fl-ink-muted">Not on the list</span>
                              }
                            }
                            @if (row.awaited) {
                              <span class="text-fl-caption text-fl-ink-muted"
                                >A standing order waits on it</span
                              >
                            }
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <fl-empty-state
                [compact]="true"
                title="No machines to list"
                [body]="emptyLine()"
                data-testid="market-empty"
              />
            }

            <div class="flex flex-col gap-1 border-t border-fl-border px-4 py-3">
              <p class="m-0 text-fl-caption text-fl-ink-muted">
                Every row carries the age of its own reading. Nothing here is live.
              </p>
              @if (armWarning(); as warning) {
                <p
                  class="m-0 text-fl-caption text-fl-ink-muted"
                  data-testid="market-architecture-warning"
                >
                  {{ warning }}
                </p>
              }
            </div>
          </fl-panel>
        }
      </div>
    } @else {
      <fl-panel data-testid="market-tab-unknown">
        <fl-empty-state title="No such scaling group" [body]="unknownBody()">
          <a flButton size="sm" routerLink="/scaling" data-testid="back-to-scaling">
            Back to every cluster
          </a>
        </fl-empty-state>
      </fl-panel>
    }
  `,
})
export class ScalingMarketTabComponent {
  protected readonly store = inject(ScalingGroupStore);
  private readonly drafts = inject(GroupDraftStore);

  protected readonly groupId = this.store.groupId;

  protected readonly loading = computed(() => this.store.catalogue().loading);
  protected readonly failed = computed(() => this.store.catalogue().failed);

  protected readonly group = computed<SectionGroup | null>(() => {
    const id = this.groupId();
    return this.drafts.draft(id)?.group() ?? this.store.group().data;
  });

  protected readonly reading = computed(() => this.store.catalogue().data ?? null);

  protected readonly unread = computed(() => {
    const catalogue = this.reading();
    return catalogue && catalogue.reading !== 'read' ? catalogue : null;
  });

  protected readonly refusesEverything = computed(() => {
    const g = this.group();
    return g ? refusesWholeCatalogue(g.capability, g.limits.hourlyBillingOnly) : false;
  });

  protected readonly rows = computed<MarketRow[]>(() => {
    const g = this.group();
    if (!g) return [];

    const outlook = this.store.outlook();
    const listed = new Map((this.store.catalogue().data?.shapes ?? []).map((s) => [s.shape, s]));
    const awaited = new Set(g.standingOrders.map((o) => o.shape));
    const refused = this.refusesEverything();
    const allowed = g.shapes;
    const rest = Object.keys(outlook)
      .filter((shape) => !allowed.includes(shape))
      .sort((a, b) => a.localeCompare(b));

    return [...allowed, ...rest].map((shape): MarketRow => {
      const reading: AvailabilityOutlook | undefined = outlook[shape];
      const index = allowed.indexOf(shape);
      const age = reading?.ageSeconds ?? null;
      const onList = index !== -1;
      const state: CatalogueState = reading?.state ?? 'unknown';
      const entry = listed.get(shape);
      const architecture = entry?.architecture ?? null;
      const held = reading?.sinceHours ? heldFor(reading.sinceHours) : '';

      return {
        shape,
        state,
        stateLabel: held ? `${STATE_LABEL[state]} · ${held}` : STATE_LABEL[state],
        up: reading?.upIn ?? [],
        down: reading?.downIn ?? [],
        age: readingAge(age),
        stale: age === null || age > STALE_AFTER_SECONDS,
        allowance: this.allowance(onList, refused),
        rank: onList ? index + 1 : null,
        awaited: awaited.has(shape),
        spec: specLine(entry?.facts),
        architecture,
      };
    });
  });

  protected readonly armWarning = computed(
    () =>
      this.rows()
        .map((row) => architectureWarning(row.architecture))
        .find(Boolean) ?? null,
  );

  /**
   * The banner above already carries the reading's own sentence, so an unread
   * catalogue says here only that the rows are missing for that reason.
   */
  protected readonly emptyLine = computed(() => {
    const catalogue = this.reading();
    if (!catalogue) return 'Nothing has been read yet.';
    if (catalogue.reading !== 'read') return 'Nothing to list.';
    return "Read, and it names no machine this group may add. That is an answer about the group's list, not about the provider.";
  });

  protected tone(state: CatalogueState): StatusTone {
    return STATE_TONE[state];
  }

  protected readonly unknownBody = computed(
    () =>
      `Nothing is configured under ${this.groupId() ?? 'this ID'}, so there is no provider whose catalogue to read.`,
  );

  private allowance(onList: boolean, refused: boolean): Allowance {
    if (!onList) return 'not-listed';
    return refused ? 'refused-by-limit' : 'preferred';
  }
}

/** The price the spend ceiling counts, beside what the machine holds. */
function specLine(spec: ShapeSpec | null | undefined): string | null {
  if (!spec) return null;
  const parts = [`${spec.cores} vCPU`, `${Math.round(spec.memoryMi / 1024)} GB`];
  if (spec.hourlyEur !== null) parts.push(`€${spec.hourlyEur.toFixed(4)}/h`);
  if (spec.monthlyEur !== null) parts.push(`€${spec.monthlyEur.toFixed(2)}/mo`);
  return parts.join(' · ');
}
