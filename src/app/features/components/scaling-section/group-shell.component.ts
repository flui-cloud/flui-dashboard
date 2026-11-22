import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { SectionGroup } from '../../model/scaling-section.models';
import { GroupDraftStore } from './group-draft.store';
import { LookOnlyDirective } from '../../../shared/directives/look-only.directive';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ScalingGroupStore } from './scaling-group.store';
import { SectionFailureComponent, SectionSkeletonComponent } from './section-states.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTabs, TabLink } from '../../../ui/patterns/tabs';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { groupModeStatus } from './scaling-tabs-format';

interface TabMarker {
  count: number;
  why: string;
}

interface ShellTab {
  path: string;
  label: string;
  marker: TabMarker | null;
}

@Component({
  selector: 'app-scaling-group-shell',
  imports: [
    LookOnlyDirective,
    RouterLink,
    RouterOutlet,
    SectionFailureComponent,
    SectionSkeletonComponent,
    FlAlert,
    FlCopyId,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlTabs,
    FlButton,
    FlStatus,
  ],
  providers: [ScalingGroupStore, GroupDraftStore],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="title()" [breadcrumb]="breadcrumb()" data-testid="group-header">
        @if (mode(); as m) {
          <fl-status headerStatus [tone]="m.tone" [label]="m.label" data-testid="group-status" />
        }
        @if (group(); as g) {
          <div headerMeta class="flex flex-col gap-1.5">
            <span class="flex flex-wrap items-center gap-x-3.5 gap-y-1">
              <span class="fl-mono" data-testid="group-cluster">{{ g.clusterName }}</span>
              <span data-testid="group-provider">{{ g.provider }}</span>
              <fl-copy-id [value]="g.id" label="group ID" />
            </span>
            <span data-testid="group-line">{{ line() }}</span>
            @if (!g.capability.hasCatalogue) {
              <span data-testid="no-market-note">
                No Machines tab: {{ g.provider }} publishes no prices, so this group asks for a
                requirement instead.
              </span>
            }
          </div>
        }
        @if (group()) {
          <fl-tabs [tabs]="tabLinks()" label="Scaling group" data-testid="group-tabs" />
        }
      </fl-page-header>

      @if (loading()) {
        <fl-panel data-testid="group-loading">
          <app-section-skeleton
            variant="lines"
            [count]="2"
            label="this scaling group"
            testid="group-header"
          />
          <app-section-skeleton
            variant="table"
            [count]="4"
            label="this scaling group"
            testid="group-body"
          />
        </fl-panel>
      } @else if (failed()) {
        <app-section-failure [message]="failed() ?? ''" testid="group" (retry)="store.reload()" />
      } @else if (group()) {
        @if (markers().length) {
          <fl-alert tone="warning" title="Needs attention" data-testid="group-markers">
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              @for (tab of markers(); track tab.path) {
                <li [attr.data-testid]="'tab-marker-' + tab.path">
                  <a class="fl-link" [routerLink]="['/scaling', groupId(), tab.path]">{{
                    tab.label
                  }}</a>: {{ tab.marker?.why }}
                </li>
              }
            </ul>
          </fl-alert>
        }

        <div [appLookOnly]="sandbox.inSandbox()">
          <router-outlet />
        </div>
      } @else {
        <fl-panel data-testid="no-such-group">
          <fl-empty-state title="No such group" [body]="missingBody()">
            <a flButton size="sm" routerLink="/scaling" data-testid="no-such-group-back">
              Back to all clusters
            </a>
          </fl-empty-state>
        </fl-panel>
      }
    </div>
  `,
})
export class ScalingGroupShellComponent {
  protected readonly sandbox = inject(SandboxService);
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

  protected readonly group = computed<SectionGroup | null>(() => this.store.group().data);

  /** What this group does, and nothing else. */
  protected readonly line = computed(() => {
    const g = this.group();
    return g ? this.buys(g) : '';
  });

  private buys(g: SectionGroup): string {
    if (g.capability.canProvision) {
      const [first] = g.acts.says.split('. ');
      return first.endsWith('.') ? first : `${first}.`;
    }
    if (g.capability.hasCatalogue) {
      return 'Flui can name a machine and raise an alarm; only a person can add it.';
    }
    return 'Flui can only ask for a machine; a person attaches it.';
  }

  protected readonly title = computed(() => this.group()?.name ?? 'Scaling group');

  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: 'Scaling', link: '/scaling' },
    { label: this.group()?.name ?? this.groupId() ?? 'Group' },
  ]);

  protected readonly mode = computed(() => {
    const g = this.group();
    return g ? groupModeStatus(g) : null;
  });

  protected readonly missingBody = computed(
    () =>
      `Nothing is configured under ${this.groupId() ?? 'this ID'}. A cluster without one will not grow, and will raise no alarm when it should have.`,
  );

  protected readonly tabLinks = computed<TabLink[]>(() => {
    const id = this.groupId();
    return this.tabs().map((tab) => ({ label: tab.label, link: ['/scaling', id, tab.path] }));
  });

  protected readonly markers = computed(() => this.tabs().filter((tab) => tab.marker !== null));

  protected readonly tabs = computed<ShellTab[]>(() => {
    const g = this.group();
    if (!g) return [];

    const tabs: ShellTab[] = [
      {
        path: 'now',
        label: 'Now',
        marker: this.nowMarker(g),
      },
      {
        path: 'group',
        label: 'Group',
        marker: this.groupMarker(g),
      },
    ];

    if (g.capability.hasCatalogue) {
      tabs.push({
        path: 'market',
        label: 'Machines',
        marker: this.marketMarker(g),
      });
    }

    tabs.push({
      path: 'history',
      label: 'History',
      marker: null,
    });

    return tabs;
  });

  private nowMarker(g: SectionGroup): TabMarker | null {
    const preview = this.store.preview().data;
    const nodes = this.store.row().data?.nodes ?? null;
    const blocked = g.standingOrders.filter((o) => o.drainable !== null && !o.drainable.ok).length;

    const why: string[] = [];
    if (preview?.pending && !preview.chosen) {
      why.push('an app has nowhere to run and no machine fits, so this only alerts');
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
        `hourly billing only is on, and ${g.provider} bills by the month so it refuses every machine this provider has`,
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
          why: `${unread} first-choice machine is up nowhere the catalogue can see`,
        }
      : null;
  }
}
