import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideChartLine,
  lucideGauge,
  lucideSettings2,
  lucideStore,
} from '@ng-icons/lucide';
import { SectionGroup } from '../../model/scaling-section.models';
import { GroupDraftStore } from './group-draft.store';
import { ScalingGroupStore } from './scaling-group.store';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';

interface TabMarker {
  count: number;
  why: string;
}

interface ShellTab {
  path: string;
  label: string;
  icon: string;
  marker: TabMarker | null;
}

@Component({
  selector: 'app-scaling-group-shell',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NgIcon,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  providers: [
    ScalingGroupStore,
    GroupDraftStore,
    provideIcons({
      lucideArrowLeft,
      lucideChartLine,
      lucideGauge,
      lucideSettings2,
      lucideStore,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5 p-4 md:p-6">
      <a
        routerLink="/scaling"
        class="inline-flex items-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="back-to-overview"
      >
        <ng-icon name="lucideArrowLeft" class="h-3.5 w-3.5" />
        All clusters
      </a>

      @if (loading()) {
        <div class="space-y-5" data-testid="group-loading">
          <app-section-skeleton variant="lines" [count]="2" label="this scaling group" testid="group-header" />
          <app-section-skeleton variant="table" [count]="4" label="this scaling group" testid="group-body" />
        </div>
      } @else if (failed()) {
        <app-section-failure
          [message]="failed() ?? ''"
          testid="group"
          (retry)="store.reload()"
        />
      } @else {
        @if (group(); as g) {
          <header class="space-y-2" data-testid="group-header">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1
                class="m-0 text-xl font-semibold text-foreground"
                data-testid="group-name"
              >
                {{ g.name }}
              </h1>
              <span
                class="font-mono text-[13px] text-muted-foreground"
                data-testid="group-cluster"
              >
                {{ g.clusterName }}
              </span>
              <span
                class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                data-testid="group-provider"
              >
                {{ g.provider }}
              </span>
            </div>

            <p class="m-0 text-[13px] text-muted-foreground" data-testid="group-line">
              {{ line() }}
            </p>

            @if (!g.capability.hasCatalogue) {
              <p
                class="m-0 text-[13px] text-muted-foreground"
                data-testid="no-market-note"
              >
                No Market tab: {{ g.provider }} publishes no catalogue, so there are
                no shapes and no prices to read — what this group asks for is a
                requirement instead.
              </p>
            }
          </header>

          <div class="relative border-b border-border">
            <nav
              class="-mb-px flex gap-1 overflow-x-auto pr-8"
              aria-label="Scaling group"
              data-testid="group-tabs"
            >
              @for (tab of tabs(); track tab.path) {
                <a
                  [routerLink]="[tab.path]"
                  routerLinkActive
                  #rla="routerLinkActive"
                  [routerLinkActiveOptions]="{ exact: true }"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                  [attr.data-testid]="'tab-' + tab.path"
                  class="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-5"
                  [class]="
                    rla.isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                  "
                >
                  <ng-icon [name]="tab.icon" class="h-4 w-4 flex-shrink-0" />
                  <span>{{ tab.label }}</span>

                  @if (tab.marker; as marker) {
                    @if (marker.count > 1) {
                      <span
                        class="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-amber-500/15 px-1 text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                        [attr.data-testid]="'tab-marker-' + tab.path"
                        aria-hidden="true"
                      >
                        {{ marker.count }}
                      </span>
                    } @else {
                      <span
                        class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"
                        [attr.data-testid]="'tab-marker-' + tab.path"
                        aria-hidden="true"
                      ></span>
                    }
                    <span class="sr-only">— {{ marker.why }}</span>
                  }
                </a>
              }
            </nav>
            <div
              class="pointer-events-none absolute bottom-0 right-0 top-0 w-10 bg-gradient-to-l from-background to-transparent"
            ></div>
          </div>

          <router-outlet />
          } @else {
          <section class="card-surface space-y-2 p-6" data-testid="no-such-group">
            <h1 class="m-0 text-lg font-semibold text-foreground">No such group</h1>
            <p class="m-0 max-w-prose text-sm text-muted-foreground">
              Nothing is configured under
              <span class="font-mono text-foreground">{{ groupId() ?? '—' }}</span
              >. A cluster with no scaling group is a real state — it will not grow,
              and nothing will raise an alarm when it should have — so the overview
              lists it rather than hiding it.
            </p>
            <a
              routerLink="/scaling"
              class="card-link w-fit"
              data-testid="no-such-group-back"
            >
              Back to all clusters
            </a>
          </section>
        }
      }
    </div>
  `,
})
export class ScalingGroupShellComponent {
  protected readonly store = inject(ScalingGroupStore);
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly groupId = computed(() => this.params().get('groupId'));

  constructor() {
    this.store.setGroup(this.route.snapshot.paramMap.get('groupId'));
    effect(() => this.store.setGroup(this.groupId()));
  }

  protected readonly loading = computed(() => this.store.group().loading);
  protected readonly failed = computed(() => this.store.group().failed);

  protected readonly group = computed<SectionGroup | null>(
    () => this.store.group().data,
  );

  protected readonly line = computed(() => {
    const g = this.group();
    if (!g) return '';
    if (!g.capability.hasCatalogue) return this.buys(g);
    return `${this.buys(g)} It reads ${g.provider}'s catalogue, which informs and never decides.`;
  });

  private buys(g: SectionGroup): string {
    if (g.capability.canProvision) {
      const [first] = g.acts.says.split('. ');
      return first.endsWith('.') ? first : `${first}.`;
    }
    if (g.capability.hasCatalogue) {
      return 'Flui can name a shape and raise an alarm; only a person can buy it.';
    }
    return 'Flui can only ask for a machine; a person attaches it.';
  }

  protected readonly tabs = computed<ShellTab[]>(() => {
    const g = this.group();
    if (!g) return [];

    const tabs: ShellTab[] = [
      { path: 'now', label: 'Now', icon: 'lucideGauge', marker: this.nowMarker(g) },
      {
        path: 'group',
        label: 'Group',
        icon: 'lucideSettings2',
        marker: this.groupMarker(g),
      },
    ];

    if (g.capability.hasCatalogue) {
      tabs.push({
        path: 'market',
        label: 'Market',
        icon: 'lucideStore',
        marker: this.marketMarker(g),
      });
    }

    tabs.push({
      path: 'history',
      label: 'History',
      icon: 'lucideChartLine',
      marker: null,
    });

    return tabs;
  });

  private nowMarker(g: SectionGroup): TabMarker | null {
    const preview = this.store.preview().data;
    const nodes = this.store.row().data?.nodes ?? null;
    const blocked = g.standingOrders.filter(
      (o) => o.drainable !== null && !o.drainable.ok
    ).length;

    const why: string[] = [];
    if (preview?.pending && !preview.chosen) {
      why.push('a pod is pending and no rung wins, so this only alerts');
    }
    if (nodes !== null && nodes < g.bounds.min) {
      why.push(`the fleet is ${nodes} where the floor is ${g.bounds.min}`);
    }
    if (blocked) {
      why.push(`${blocked} standing order cannot proceed`);
    }

    return why.length ? { count: why.length, why: why.join('; ') } : null;
  }

  private groupMarker(g: SectionGroup): TabMarker | null {
    const why: string[] = [];
    if (g.limits.hourlyBillingOnly && g.capability.billing === 'monthly') {
      why.push(
        `hourly billing only is on, and ${g.provider} bills by the month — it refuses every shape this provider has`,
      );
    }
    if (g.capability.canProvision && !g.acts.acts) {
      why.push('this group decides and nothing it decides reaches a provider');
    }
    return why.length ? { count: why.length, why: why.join('; ') } : null;
  }

  private marketMarker(g: SectionGroup): TabMarker | null {
    if (!this.store.catalogue().data) return null;
    const outlook = this.store.outlook();
    const unread = g.shapes.filter((shape) => {
      const reading = outlook[shape];
      return !reading || reading.upIn.length === 0;
    }).length;

    return unread
      ? {
          count: unread,
          why: `${unread} preferred shape is up nowhere the catalogue can see`,
        }
      : null;
  }
}
