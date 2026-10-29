import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCrown,
  lucidePlug,
  lucideShieldAlert,
  lucideShieldCheck,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import {
  ClusterHaMissingRole,
  ClusterHaService,
  ClusterHaView,
  ClusterHaZone,
} from '../../service/cluster-ha.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

const ROLE: Record<ClusterHaView['missing'][number]['role'], string> = {
  server: 'a server',
  'data-host': 'a node for copies of data',
};

interface ZoneCard extends ClusterHaZone {
  missing: Array<{ role: ClusterHaMissingRole['role']; label: string }>;
}

@Component({
  selector: 'app-cluster-ha-tab',
  standalone: true,
  imports: [NgIconComponent, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideCrown,
      lucidePlug,
      lucideShieldAlert,
      lucideShieldCheck,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <div class="space-y-4" data-testid="cluster-ha-tab">
        <div class="card-surface p-4">
          <div class="flex items-center gap-2">
            <ng-icon
              [name]="
                v.level === 'three-locations'
                  ? 'lucideShieldCheck'
                  : 'lucideShieldAlert'
              "
              class="h-4 w-4"
              [class]="
                v.level === 'three-locations'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              "
            />
            <span class="text-sm font-medium">{{ headline() }}</span>
          </div>
          @if (v.region) {
            <p class="m-0 mt-1 text-xs text-muted-foreground">
              {{ v.region
              }}{{
                v.topology && !v.topology.validated
                  ? ', forced: Flui has not validated this region'
                  : ''
              }}
            </p>
          }
          @for (w of v.warnings; track w) {
            <p class="m-0 mt-1 text-xs text-amber-700 dark:text-amber-400">
              {{ w }}
            </p>
          }
          <button
            type="button"
            class="mt-3 text-xs text-primary hover:underline"
            (click)="open.set(!open())"
          >
            {{ open() ? 'Hide' : 'What it survives' }}
          </button>
          @if (open()) {
            <ul
              class="m-0 mt-2 list-none space-y-1 p-0 text-xs"
              data-testid="ha-survives"
            >
              @for (s of v.survives; track s) {
                <li class="text-emerald-700 dark:text-emerald-400">
                  Survives {{ s }}
                </li>
              }
              @for (s of v.doesNotSurvive; track s) {
                <li class="text-muted-foreground">Does not survive {{ s }}</li>
              }
              @if (others().length) {
                <li class="text-muted-foreground">
                  If {{ reachedThrough() }} is lost, Flui moves to
                  {{ others().join(', ') }}.
                </li>
              }
            </ul>
          }
        </div>

        @if (zones().length) {
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            @for (z of zones(); track z.zone) {
              <div
                class="card-surface p-4"
                [attr.data-testid]="'ha-zone-' + z.zone"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{{ z.zone }}</span>
                  <span
                    class="rounded px-1.5 py-0.5 text-[11px] font-medium"
                    [class]="
                      z.role === 'data'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                        : 'bg-muted text-muted-foreground'
                    "
                  >
                    {{ z.role === 'data' ? 'Data' : 'Vote only' }}
                  </span>
                </div>
                <ul class="m-0 mt-3 list-none space-y-1.5 p-0 text-xs">
                  @for (s of z.servers; track s) {
                    <li class="flex items-center gap-1.5">
                      <span>{{ s }}</span>
                      @if (s === leader()) {
                        <span
                          class="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400"
                          title="Leads the cluster"
                        >
                          <ng-icon name="lucideCrown" class="h-3 w-3" /> leads
                        </span>
                      }
                      @if (s === reachedThrough()) {
                        <span
                          class="inline-flex items-center gap-0.5 text-primary"
                          title="Flui reaches the cluster through this server"
                        >
                          <ng-icon name="lucidePlug" class="h-3 w-3" /> Flui
                        </span>
                      }
                    </li>
                  }
                  @if (z.role === 'data') {
                    <li class="text-muted-foreground">
                      Copies of data on
                      {{
                        z.dataHosts.length
                          ? z.dataHosts.join(', ')
                          : 'no node yet'
                      }}
                    </li>
                  }
                  @for (m of z.missing; track m.role) {
                    <li
                      class="flex items-center justify-between gap-2 text-amber-700 dark:text-amber-400"
                    >
                      <span>Needs {{ m.label }}</span>
                      <button
                        type="button"
                        class="rounded-md border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
                        [attr.data-testid]="'ha-add-' + m.role + '-' + z.zone"
                        (click)="ask(m.role, z.zone)"
                      >
                        Add
                      </button>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        }

        @if (trips().length) {
          <div class="card-surface p-4" data-testid="ha-round-trips">
            <div class="flex items-center justify-between">
              <span class="text-label">Between locations</span>
              <span class="text-xs text-muted-foreground">{{
                measured()
              }}</span>
            </div>
            <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              @for (t of trips(); track t.from + t.to) {
                <div class="text-sm">
                  <span class="text-muted-foreground"
                    >{{ t.from }} ↔ {{ t.to }}</span
                  >
                  <span class="ml-2 font-medium tabular-nums">
                    {{ t.ms === null ? 'no answer' : t.ms.toFixed(1) + ' ms' }}
                  </span>
                </div>
              }
            </div>
            <p class="m-0 mt-2 text-xs text-muted-foreground">
              A write that waits for a copy takes at least this long.
            </p>
          </div>
        }

        @if (notice()) {
          <p
            class="m-0 text-xs text-muted-foreground"
            data-testid="ha-add-notice"
          >
            {{ notice() }}
          </p>
        }
      </div>
      <app-confirmation-dialog
        [title]="
          'Add ' + (pending()?.label ?? '') + ' in ' + (pending()?.zone ?? '')
        "
        message="Flui buys a machine in this location and joins it to the cluster with its role. It is billed from then on, and scaling never removes it."
        confirmText="Add it"
        cancelText="Not now"
        variant="info"
        (confirmed)="add()"
      />
    } @else if (failed()) {
      <div class="card-surface p-4 text-sm text-muted-foreground">
        Flui could not read this cluster's nodes right now.
      </div>
    }
  `,
})
export class ClusterHaTabComponent {
  private readonly clusters = inject(ClusterService);
  private readonly ha = inject(ClusterHaService);

  readonly clusterId = computed(() => this.clusters.cluster()?.id ?? null);
  readonly view = signal<ClusterHaView | null>(null);
  readonly failed = signal(false);
  readonly open = signal(false);

  readonly headline = computed(() => {
    const v = this.view();
    if (!v) return '';
    if (v.unsupported) return v.unsupported;
    if (v.level === 'three-locations')
      return 'Survives the loss of a whole location';
    return 'Standard: does not survive the loss of a location';
  });

  readonly zones = computed<ZoneCard[]>(() => {
    const v = this.view();
    return (v?.topology?.zones ?? []).map((z) => ({
      ...z,
      missing: v!.missing
        .filter((m) => m.zone === z.zone)
        .map((m) => ({ role: m.role, label: ROLE[m.role] })),
    }));
  });

  readonly leader = computed(
    () => this.view()?.observed?.etcdLeader?.node ?? null,
  );
  readonly reachedThrough = computed(
    () => this.view()?.observed?.reachedThrough ?? null,
  );
  readonly others = computed(() =>
    (this.view()?.observed?.reachableServers ?? []).filter(
      (s) => s !== this.reachedThrough(),
    ),
  );
  readonly trips = computed(() => this.view()?.observed?.roundTrips ?? []);

  readonly measured = computed(() => {
    const at = this.view()?.observed?.at;
    if (!at) return '';
    const minutes = Math.round((Date.now() - Date.parse(at)) / 60_000);
    return minutes < 1 ? 'measured just now' : `measured ${minutes} min ago`;
  });

  readonly dialog = viewChild(ConfirmationDialogComponent);
  readonly pending = signal<{
    role: ClusterHaMissingRole['role'];
    zone: string;
    label: string;
  } | null>(null);
  readonly notice = signal<string | null>(null);

  ask(role: ClusterHaMissingRole['role'], zone: string): void {
    this.pending.set({ role, zone, label: ROLE[role] });
    this.dialog()?.open();
  }

  add(): void {
    const id = this.clusterId();
    const p = this.pending();
    if (!id || !p) return;
    this.dialog()?.setProcessing(true);
    this.ha.addNode(id, p.role, p.zone).subscribe({
      next: () => {
        this.dialog()?.close();
        this.notice.set(
          `Adding ${p.label} in ${p.zone}. It joins in a few minutes; this page shows it once it has.`,
        );
      },
      error: (e: { error?: { message?: string } }) => {
        this.dialog()?.close();
        this.notice.set(e?.error?.message ?? 'The request was refused.');
      },
    });
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
