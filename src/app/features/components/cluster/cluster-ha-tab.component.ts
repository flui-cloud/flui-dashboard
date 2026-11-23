import { Component, computed, effect, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCrown, lucidePlug } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import {
  ClusterHaMissingRole,
  ClusterHaService,
  ClusterHaView,
  ClusterHaZone,
} from '../../service/cluster-ha.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert, AlertTone } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlErrorState } from '../../../ui/patterns/states';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';

const ROLE: Record<ClusterHaView['missing'][number]['role'], string> = {
  server: 'a server',
  'data-host': 'a node for copies of data',
};

interface ZoneCard extends ClusterHaZone {
  missing: Array<{ role: ClusterHaMissingRole['role']; label: string; why: string }>;
}

@Component({
  selector: 'app-cluster-ha-tab',
  imports: [
    FlPanel,
    FlTable,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlErrorState,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
  ],
  providers: [provideIcons({ lucideCrown, lucidePlug })],
  host: { class: 'fl-stack' },
  template: `
    @if (view(); as v) {
      <div class="fl-stack" data-testid="cluster-ha-tab">
        <fl-panel title="Availability">
          <div class="flex flex-col gap-4">
            <fl-status [tone]="modeTone()" [label]="headline()" />
            <fl-key-value>
              <fl-kv-item key="Region">
                {{ v.region || '—' }}
                @if (v.region && v.topology && !v.topology.validated) {
                  <span class="block text-fl-caption text-fl-ink-muted"
                    >Forced: Flui has not validated this region</span
                  >
                }
              </fl-kv-item>
              <fl-kv-item key="Servers"
                ><span class="fl-num"
                  >{{ v.servers.ready }} of {{ v.servers.count }} ready</span
                ></fl-kv-item
              >
              <fl-kv-item key="Locations">{{
                v.servers.zones.length ? v.servers.zones.join(', ') : '—'
              }}</fl-kv-item>
              @if (leader()) {
                <fl-kv-item key="Leads the cluster" [mono]="true">{{ leader() }}</fl-kv-item>
              }
              @if (reachedThrough()) {
                <fl-kv-item key="Flui connects through" [mono]="true">{{
                  reachedThrough()
                }}</fl-kv-item>
              }
            </fl-key-value>
            @for (w of v.warnings; track w) {
              <fl-alert tone="warning" title="Availability at risk">{{ w }}</fl-alert>
            }
            <div>
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [attr.aria-expanded]="open()"
                (click)="open.set(!open())"
              >
                {{ open() ? 'Hide' : 'What it survives' }}
              </button>
            </div>
            @if (open()) {
              <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="ha-survives">
                @for (s of v.survives; track s) {
                  <li><fl-status tone="success" [label]="'Survives ' + s" /></li>
                }
                @for (s of v.doesNotSurvive; track s) {
                  <li><fl-status tone="neutral" [label]="'Does not survive ' + s" /></li>
                }
                @if (others().length) {
                  <li class="text-fl-body-sm text-fl-ink-muted">
                    If {{ reachedThrough() }} is lost, Flui moves to {{ others().join(', ') }}.
                  </li>
                }
              </ul>
            }
          </div>
        </fl-panel>

        @if (zones().length) {
          <div class="fl-grid-3">
            @for (z of zones(); track z.zone) {
              <fl-panel [title]="z.zone" [attr.data-testid]="'ha-zone-' + z.zone">
                <fl-tag panelActions>{{ z.role === 'data' ? 'Data' : 'Vote only' }}</fl-tag>
                <div class="flex flex-col gap-3 text-fl-body-sm">
                  <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
                    @for (s of z.servers; track s) {
                      <li class="fl-row">
                        <span class="fl-mono">{{ s }}</span>
                        @if (s === leader()) {
                          <span class="fl-row text-fl-ink-muted" title="Leads the cluster">
                            <fl-icon name="lucideCrown" [size]="13" /> leads
                          </span>
                        }
                        @if (s === reachedThrough()) {
                          <span
                            class="fl-row text-fl-ink-muted"
                            title="Flui reaches the cluster through this server"
                          >
                            <fl-icon name="lucidePlug" [size]="13" /> Flui
                          </span>
                        }
                      </li>
                    }
                  </ul>
                  @if (z.role === 'data') {
                    <p class="m-0 text-fl-ink-muted">
                      Copies of data on
                      {{ z.dataHosts.length ? z.dataHosts.join(', ') : 'no node yet' }}
                    </p>
                  }
                  @for (m of z.missing; track m.role) {
                    <fl-alert tone="warning" [title]="'Needs ' + m.label">
                      {{ m.why }}
                      <button
                        alertActions
                        flButton
                        size="sm"
                        type="button"
                        [disabled]="adding()"
                        [attr.aria-label]="'Add ' + m.label"
                        [attr.data-testid]="'ha-add-' + m.role + '-' + z.zone"
                        (click)="ask(m.role, z.zone)"
                      >
                        Add
                      </button>
                    </fl-alert>
                  }
                </div>
              </fl-panel>
            }
          </div>
        }

        @if (trips().length) {
          <fl-panel
            title="Between locations"
            [count]="trips().length"
            [flush]="true"
            data-testid="ha-round-trips"
          >
            <span panelActions class="text-fl-caption text-fl-ink-muted">{{ measured() }}</span>
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Locations</th>
                    <th scope="col" class="is-num">Round trip</th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of trips(); track t.from + t.to) {
                    <tr>
                      <td class="fl-mono">{{ t.from }} ↔ {{ t.to }}</td>
                      <td class="is-num">
                        {{ t.ms === null ? 'no answer' : t.ms.toFixed(1) + ' ms' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="m-0 border-t border-fl-border px-4 py-3 text-fl-caption text-fl-ink-muted">
              A write that waits for a copy takes at least this long.
            </p>
          </fl-panel>
        }

        @if (notice()) {
          <fl-alert [tone]="noticeTone()" [title]="noticeTitle()" data-testid="ha-add-notice">
            {{ notice() }}
          </fl-alert>
        }
      </div>
    } @else if (failed()) {
      <fl-panel title="Availability">
        <fl-error-state
          title="Could not load availability"
          reason="Flui could not read this cluster's nodes right now"
          [compact]="true"
          (retry)="retry()"
        />
      </fl-panel>
    }
  `,
})
export class ClusterHaTabComponent {
  private readonly clusters = inject(ClusterService);
  private readonly ha = inject(ClusterHaService);
  private readonly confirm = inject(ConfirmService);

  readonly clusterId = computed(() => this.clusters.cluster()?.id ?? null);
  readonly view = signal<ClusterHaView | null>(null);
  readonly failed = signal(false);
  readonly open = signal(false);

  readonly headline = computed(() => {
    const v = this.view();
    if (!v) return '';
    if (v.unsupported) return v.unsupported;
    if (v.level === 'three-locations') return 'Survives the loss of a whole location';
    return 'Standard: does not survive the loss of a location';
  });

  readonly modeTone = computed<StatusTone>(() => {
    const v = this.view();
    return v && !v.unsupported && v.level === 'three-locations' ? 'success' : 'neutral';
  });

  readonly zones = computed<ZoneCard[]>(() => {
    const v = this.view();
    return (v?.topology?.zones ?? []).map((z) => ({
      ...z,
      missing: v!.missing
        .filter((m) => m.zone === z.zone)
        .map((m) => ({ role: m.role, label: ROLE[m.role], why: m.why })),
    }));
  });

  readonly leader = computed(() => this.view()?.observed?.etcdLeader?.node ?? null);
  readonly reachedThrough = computed(() => this.view()?.observed?.reachedThrough ?? null);
  readonly others = computed(() =>
    (this.view()?.observed?.reachableServers ?? []).filter((s) => s !== this.reachedThrough()),
  );
  readonly trips = computed(() => this.view()?.observed?.roundTrips ?? []);

  readonly measured = computed(() => {
    const at = this.view()?.observed?.at;
    if (!at) return '';
    const minutes = Math.round((Date.now() - Date.parse(at)) / 60_000);
    return minutes < 1 ? 'measured just now' : `measured ${minutes} min ago`;
  });

  readonly pending = signal<{
    role: ClusterHaMissingRole['role'];
    zone: string;
    label: string;
  } | null>(null);
  readonly notice = signal<string | null>(null);
  readonly noticeTone = signal<AlertTone>('info');
  readonly noticeTitle = computed(() =>
    this.noticeTone() === 'error' ? 'Could not add the node' : 'Node on its way',
  );
  readonly adding = signal(false);

  async ask(role: ClusterHaMissingRole['role'], zone: string): Promise<void> {
    const label = ROLE[role];
    this.pending.set({ role, zone, label });
    const ok = await this.confirm.confirm({
      title: `Add ${label} in ${zone}`,
      body: 'Flui buys a machine in this location and joins it to the cluster with its role. It is billed from then on, and scaling never removes it.',
      confirmLabel: 'Add it',
    });
    if (ok) this.add();
  }

  add(): void {
    const id = this.clusterId();
    const p = this.pending();
    if (!id || !p) return;
    this.adding.set(true);
    this.ha.addNode(id, p.role, p.zone).subscribe({
      next: () => {
        this.adding.set(false);
        this.noticeTone.set('info');
        this.notice.set(
          `Adding ${p.label} in ${p.zone}. It joins in a few minutes; this page shows it once it has.`,
        );
      },
      error: (e: { error?: { message?: string } }) => {
        this.adding.set(false);
        this.noticeTone.set('error');
        this.notice.set(e?.error?.message ?? 'The request was refused.');
      },
    });
  }

  retry(): void {
    const id = this.clusterId();
    if (id) this.load(id);
  }

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (id) this.load(id);
    });
  }

  private load(id: string): void {
    this.ha.get(id).subscribe({
      next: (v) => {
        this.failed.set(false);
        this.view.set(v);
      },
      error: () => {
        this.view.set(null);
        this.failed.set(true);
      },
    });
  }
}
