import { Component, computed, inject, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { FleetNode } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { ArchitectureBadgeComponent } from '../../../shared/components/architecture-badge.component';
import { eurHour } from './now-format';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

interface NodeFlag {
  id: 'stand-in' | 'never-replace' | 'drain-blocker';
  label: string;
  why: string;
  tone: StatusTone;
}

interface FleetRow {
  node: FleetNode;
  price: string;
  flags: NodeFlag[];
}

@Component({
  selector: 'app-scaling-now-fleet',
  imports: [
    SectionFailureComponent,
    SectionSkeletonComponent,
    ArchitectureBadgeComponent,
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  host: { class: 'block' },
  template: `
    <fl-panel title="Fleet" [flush]="true" data-testid="fleet">
      <ng-container panelActions>
        <span class="text-fl-body-sm text-fl-ink-muted">{{ summary() }}</span>
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="open() ? 'fleet-nodes' : null"
          data-testid="fleet-toggle"
          (click)="open.set(!open())"
        >
          <fl-icon [name]="open() ? 'lucideChevronDown' : 'lucideChevronRight'" [size]="14" />
          {{ open() ? 'Hide nodes' : 'Show nodes' }}
        </button>
      </ng-container>

      @if (open()) {
        @if (loading()) {
          <div class="p-4">
            <app-section-skeleton variant="table" [count]="3" label="the fleet" testid="fleet" />
          </div>
        } @else if (failed()) {
          <div class="p-4">
            <app-section-failure
              [message]="failed() ?? ''"
              testid="fleet"
              (retry)="store.reload()"
            />
          </div>
        } @else if (unavailable()) {
          <div class="p-4" id="fleet-nodes">
            <fl-alert
              tone="info"
              title="The machines cannot be named yet"
              data-testid="fleet-unlisted"
            >
              {{ unavailable() }}
            </fl-alert>
          </div>
        } @else if (rows().length === 0) {
          <fl-empty-state
            id="fleet-nodes"
            title="No nodes"
            [compact]="true"
            data-testid="fleet-empty"
          />
        } @else {
          <div class="fl-table-wrap" id="fleet-nodes">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Node</th>
                  <th scope="col">Size</th>
                  <th scope="col">Region</th>
                  <th scope="col">Role</th>
                  <th scope="col" class="is-num">Price</th>
                  <th scope="col">Flags</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.node.id) {
                  <tr [attr.data-testid]="'node-' + row.node.id">
                    <th scope="row" class="fl-mono font-normal">{{ row.node.name }}</th>
                    <td>
                      <span class="inline-flex items-center gap-2">
                        <span class="fl-mono">{{ row.node.shape }}</span>
                        <app-architecture-badge [architecture]="row.node.architecture" />
                      </span>
                    </td>
                    <td class="fl-mono">{{ row.node.region }}</td>
                    <td>{{ row.node.role }}</td>
                    <td class="is-num fl-mono" [attr.data-testid]="'node-price-' + row.node.id">
                      {{ row.price }}
                    </td>
                    <td class="is-wrap">
                      @if (row.flags.length) {
                        <span class="flex flex-col gap-2">
                          @for (flag of row.flags; track flag.id + flag.why) {
                            <span
                              class="flex flex-col gap-0.5"
                              [attr.data-testid]="flag.id + '-' + row.node.id"
                            >
                              <fl-status [tone]="flag.tone" [label]="flag.label" />
                              <span class="text-fl-caption text-fl-ink-muted">{{ flag.why }}</span>
                            </span>
                          }
                        </span>
                      } @else {
                        <span class="text-fl-ink-muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </fl-panel>
  `,
})
export class ScalingNowFleetComponent {
  protected readonly store = inject(ScalingGroupStore);

  readonly group = input.required<SectionGroup>();

  protected readonly loading = computed(
    () => this.store.fleet().loading || this.store.row().loading,
  );

  protected readonly failed = computed(() => this.store.fleet().failed ?? this.store.row().failed);

  protected readonly unavailable = computed(() => this.store.fleet().data?.unavailable ?? null);

  private readonly fleet = computed(() => this.store.fleet().data?.nodes ?? []);

  protected readonly open = signal(false);

  protected readonly summary = computed(() => {
    const nodes = this.store.row().data?.nodes ?? null;
    if (nodes === null) return 'node count not read';

    const counts = new Map<string, number>();
    for (const node of this.fleet()) {
      counts.set(node.shape, (counts.get(node.shape) ?? 0) + 1);
    }
    const mix = [...counts.entries()].map(([shape, n]) => `${n}× ${shape}`).join(' · ');
    return `${nodes} node${nodes === 1 ? '' : 's'}${mix ? ' · ' + mix : ''}`;
  });

  protected readonly rows = computed<FleetRow[]>(() => {
    const orders = this.group().standingOrders;

    return this.fleet().map((node) => {
      const flags: NodeFlag[] = [];
      const claim = orders.find((o) => o.replaces === node.name) ?? null;

      if (node.standIn) {
        flags.push({
          id: 'stand-in',
          label: 'Stand-in',
          why: claim
            ? `Added in a hurry. A standing order waits on ${claim.shape} in ${claim.region} to swap it out.`
            : 'Added in a hurry. No standing order claims it.',
          tone: 'warning',
        });
      }

      const blockers = claim?.drainable?.ok === false ? claim.drainable.blockers : [];
      for (const blocker of blockers) {
        flags.push({
          id: 'drain-blocker',
          label: 'Drain blocked',
          why: `${blocker.what}. ${blocker.fix}`,
          tone: 'error',
        });
      }

      if (node.neverReplace) {
        flags.push({
          id: 'never-replace',
          label: 'Never replaced',
          why: node.neverReplace,
          tone: 'neutral',
        });
      }

      return {
        node,
        price: node.hourlyEur === null ? "operator's own" : eurHour(node.hourlyEur),
        flags,
      };
    });
  });
}
