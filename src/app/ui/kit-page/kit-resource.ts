import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { CONSOLE_NAV } from '../../layout/console/console-nav.config';
import { FlActionsMenu, MenuAction } from '../overlays/actions-menu';
import { FlCopyId } from '../patterns/copy-id';
import { FlEmptyState } from '../patterns/states';
import { FlKeyValue, FlKvItem } from '../patterns/key-value';
import { FlPageHeader } from '../patterns/page-header';
import { FlPanel } from '../patterns/panel';
import { FlUsageBar } from '../patterns/usage-bar';
import { FlResourceNav, ResourceNavGroup } from '../frame/resource-nav';
import { FlSidenav, NavSection } from '../frame/sidenav';
import { FlTopbar } from '../frame/topbar';
import { FlButton } from '../primitives/button';
import { FlStatus } from '../primitives/status';
import { FlTag } from '../primitives/tag';
import { FlIcon } from '../primitives/icon';
import { KitFrameIcons } from './kit-frame-icons';

const BASE = '/kit/resource';

const GROUPS: readonly ResourceNavGroup[] = [
  { label: null, items: [{ label: 'Overview', link: `${BASE}/overview` }] },
  {
    label: 'Operate',
    items: [
      { label: 'Monitoring', link: `${BASE}/monitoring` },
      { label: 'Logs', link: `${BASE}/logs` },
      { label: 'Diagnoses', link: `${BASE}/diagnoses`, attention: true },
      { label: 'Debug pods', link: `${BASE}/debug-pods` },
      { label: 'Sessions', link: `${BASE}/sessions` },
    ],
  },
  {
    label: 'Deliver',
    items: [
      { label: 'Revisions', link: `${BASE}/revisions` },
      { label: 'Builds', link: `${BASE}/builds` },
      { label: 'Releases', link: `${BASE}/releases` },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Configuration', link: `${BASE}/configuration` },
      { label: 'Resources', link: `${BASE}/resources` },
      { label: 'DNS', link: `${BASE}/dns` },
      { label: 'Access', link: `${BASE}/access` },
      { label: 'Sign-in', link: `${BASE}/sign-in` },
      { label: 'Gateway', link: `${BASE}/gateway` },
      { label: 'Messaging', link: `${BASE}/messaging` },
      { label: 'Schedules', link: `${BASE}/schedules` },
    ],
  },
  { label: 'Data', items: [{ label: 'Backup', link: `${BASE}/backup` }] },
];

@Component({
  selector: 'fl-kit-resource',
  imports: [
    FlTopbar,
    FlSidenav,
    FlResourceNav,
    FlPageHeader,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlCopyId,
    FlUsageBar,
    FlStatus,
    FlTag,
    FlButton,
    FlActionsMenu,
    FlEmptyState,
    FlIcon,
  ],
  providers: [KitFrameIcons],
  host: { class: 'fl-shell' },
  template: `
    <fl-topbar home="/kit">
      <button
        topbarStart
        type="button"
        class="fl-topbar__icon fl-topbar__menu fl-topbar__menu--always"
        aria-label="Menu"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
      >
        <fl-icon name="lucideMenu" />
      </button>
    </fl-topbar>
    <div class="fl-shell__body">
      @if (open()) {
        <fl-sidenav
          class="fl-shell__nav fl-shell__nav--overlay"
          [sections]="sections"
          (navigate)="open.set(false)"
        />
        <button
          type="button"
          class="fl-shell__scrim"
          aria-label="Close menu"
          (click)="open.set(false)"
        ></button>
      }
      <main class="fl-shell__main">
        <div class="fl-page mx-auto max-w-screen-2xl">
          <fl-page-header
            title="dashboard"
            [breadcrumb]="[
              { label: 'Applications', link: '/kit/resource' },
              { label: 'dashboard' },
            ]"
          >
            <fl-status headerStatus tone="success" label="Running" />
            <fl-tag headerStatus>user app</fl-tag>
            <fl-copy-id
              headerMeta
              value="3012b9a0-cfc4-4a8d-8d34-ba57ff957e4e"
              label="application ID"
            />
            <ng-container headerActions>
              <a flButton href="https://example.com" target="_blank" rel="noopener">Open</a>
              <button flButton type="button">Restart</button>
              <fl-actions-menu [items]="actions" />
            </ng-container>
          </fl-page-header>

          <div class="fl-resource">
            <fl-resource-nav label="Application sections" [groups]="groups" />
            <div class="fl-stack">
              @if (section() === 'overview') {
                <fl-panel title="Details">
                  <button panelActions flButton size="sm" type="button">Edit</button>
                  <fl-key-value>
                    <fl-kv-item key="Replicas">1 of 1 ready</fl-kv-item>
                    <fl-kv-item key="Cluster">control-cluster-staging-hz · fsn1</fl-kv-item>
                    <fl-kv-item key="Resources">CPU 100m / 500m · Memory 128Mi / 256Mi</fl-kv-item>
                    <fl-kv-item key="Last deploy">13 Sep 2026, 17:26</fl-kv-item>
                    <fl-kv-item key="Image" [mono]="true"
                      >ghcr.io/example/paroline-dashboard:cc9fec3</fl-kv-item
                    >
                    <fl-kv-item key="Configuration">2 variables, 1 secret</fl-kv-item>
                    <fl-kv-item key="Public endpoint" [mono]="true"
                      >https://dashboard-ivelst.example.com</fl-kv-item
                    >
                  </fl-key-value>
                </fl-panel>
                <div class="fl-grid-2">
                  <fl-panel title="Live usage">
                    <div class="flex flex-col gap-4">
                      <fl-usage-bar [percent]="0.4" label="CPU" aside="CPU · 2m of 500m" />
                      <fl-usage-bar
                        [percent]="20"
                        label="Memory"
                        aside="Memory · 51.3 MB of 256Mi"
                      />
                    </div>
                  </fl-panel>
                  <fl-panel title="Latest release">
                    <div class="flex flex-col gap-2">
                      <fl-status tone="success" label="Succeeded" />
                      <span class="fl-mono text-fl-ink-muted"
                        >897e62c → cc9fec3 · 13 Sep 2026, 17:25</span
                      >
                    </div>
                  </fl-panel>
                </div>
              } @else {
                <fl-panel [title]="title()">
                  <fl-empty-state
                    title="Section content is not part of this prototype"
                    body="Only the layout and the navigation are under review here."
                  />
                </fl-panel>
              }
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class KitResource {
  private readonly route = inject(ActivatedRoute);
  protected readonly groups = GROUPS;
  protected readonly open = signal(false);
  protected readonly actions: readonly MenuAction[] = [
    { id: 'redeploy', label: 'Redeploy' },
    { id: 'stop', label: 'Stop' },
    { id: 'delete', label: 'Delete application', danger: true, separatorBefore: true },
  ];
  protected readonly section = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('section') ?? 'overview')),
    { initialValue: 'overview' },
  );
  protected readonly title = computed(
    () =>
      GROUPS.flatMap((g) => g.items).find((i) => String(i.link).endsWith(`/${this.section()}`))
        ?.label ?? '',
  );
  protected readonly sections: readonly NavSection[] = CONSOLE_NAV.map((group) => ({
    label: group.label,
    items: group.entries
      .filter((e) => !e.onlyWithSystemApps)
      .map((e) => ({
        id: e.id,
        label: e.label,
        link: '/kit',
        icon: e.icon,
        current: e.id === 'applications',
      })),
  }));
}
