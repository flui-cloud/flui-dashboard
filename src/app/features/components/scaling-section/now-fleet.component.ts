import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideLock,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { FleetNode } from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { TABLE, eurHour } from './now-format';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';

interface NodeFlag {
  id: 'stand-in' | 'never-replace' | 'drain-blocker';
  label: string;
  why: string;
  icon: string | null;
  pill: string;
}

interface FleetRow {
  node: FleetNode;
  price: string;
  flags: NodeFlag[];
}

@Component({
  selector: 'app-scaling-now-fleet',
  standalone: true,
  imports: [NgIcon, SectionFailureComponent, SectionSkeletonComponent],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideLock,
      lucideTriangleAlert,
    }),
  ],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-2" data-testid="fleet">
      <h2 class="m-0">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="open() ? 'fleet-nodes' : null"
          data-testid="fleet-toggle"
          (click)="open.set(!open())"
        >
          <ng-icon
            [name]="open() ? 'lucideChevronDown' : 'lucideChevronRight'"
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
          <span class="text-label">Fleet</span>
          <span class="text-[12px] text-muted-foreground">{{ summary() }}</span>
        </button>
      </h2>

      @if (open()) {
        @if (loading()) {
          <app-section-skeleton
            variant="table"
            [count]="3"
            label="the fleet"
            testid="fleet"
          />
        } @else if (failed()) {
          <app-section-failure [message]="failed() ?? ''" testid="fleet" (retry)="store.reload()" />
        } @else if (unavailable()) {
          <div [class]="t.card" id="fleet-nodes">
            <p class="m-0 max-w-prose text-sm text-foreground" data-testid="fleet-unlisted">
              The machines cannot be named yet.
            </p>
            <p class="m-0 mt-1.5 max-w-prose text-[13px] text-muted-foreground">
              {{ unavailable() }}
            </p>
          </div>
        } @else {
          <div [class]="t.card" id="fleet-nodes">
            <div [class]="t.scroll">
              <table [class]="t.table">
                <thead>
                  <tr [class]="t.headRow">
                    <th scope="col" [class]="t.th">Node</th>
                    <th scope="col" [class]="t.th">Shape · region</th>
                    <th scope="col" [class]="t.th">Role</th>
                    <th scope="col" [class]="t.thNum">Price</th>
                    <th scope="col" [class]="t.th">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.node.id) {
                    <tr [class]="t.row" [attr.data-testid]="'node-' + row.node.id">
                      <th scope="row" [class]="t.td + ' font-normal'">
                        <span [class]="t.mono">{{ row.node.name }}</span>
                      </th>
                      <td [class]="t.td">
                        <span [class]="t.mono">{{ row.node.shape }} · {{ row.node.region }}</span>
                      </td>
                      <td [class]="t.tdMuted">{{ row.node.role }}</td>
                      <td [class]="t.tdNum" [attr.data-testid]="'node-price-' + row.node.id">
                        {{ row.price }}
                      </td>
                      <td [class]="t.td">
                        @if (row.flags.length) {
                          <span class="flex flex-col gap-1">
                            @for (flag of row.flags; track flag.id + flag.why) {
                              <span
                                class="flex flex-col gap-0.5"
                                [attr.data-testid]="flag.id + '-' + row.node.id"
                              >
                                <span [class]="t.pill + ' ' + flag.pill + ' w-fit'">
                                  @if (flag.icon) {
                                    <ng-icon [name]="flag.icon" class="h-3 w-3" />
                                  }
                                  {{ flag.label }}
                                </span>
                                <span [class]="t.note">{{ flag.why }}</span>
                              </span>
                            }
                          </span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr [class]="t.row">
                      <td [class]="t.tdMuted" colspan="5" data-testid="fleet-empty">No nodes.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class ScalingNowFleetComponent {
  protected readonly store = inject(ScalingGroupStore);

  readonly group = input.required<SectionGroup>();

  protected readonly t = TABLE;

  protected readonly loading = computed(
    () => this.store.fleet().loading || this.store.row().loading,
  );

  protected readonly failed = computed(
    () => this.store.fleet().failed ?? this.store.row().failed,
  );

  protected readonly unavailable = computed(
    () => this.store.fleet().data?.unavailable ?? null,
  );

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
            ? `Bought in a hurry. A standing order waits on ${claim.shape} in ${claim.region} to swap it out.`
            : 'Bought in a hurry. No standing order claims it.',
          icon: null,
          pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        });
      }

      const blockers = claim?.drainable?.ok === false ? claim.drainable.blockers : [];
      for (const blocker of blockers) {
        flags.push({
          id: 'drain-blocker',
          label: 'Drain blocked',
          why: `${blocker.what}. ${blocker.fix}`,
          icon: 'lucideTriangleAlert',
          pill: 'bg-destructive/10 text-destructive',
        });
      }

      if (node.neverReplace) {
        flags.push({
          id: 'never-replace',
          label: 'Never replaced',
          why: node.neverReplace,
          icon: 'lucideLock',
          pill: 'bg-muted text-muted-foreground',
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
