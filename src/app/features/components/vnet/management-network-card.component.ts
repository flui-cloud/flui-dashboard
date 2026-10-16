import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { ToastService } from '../../../shared/services/toast.service';

type PeerStatus = 'pending' | 'active' | 'stale';

export interface ManagementNetworkMember {
  clusterId: string;
  clusterName: string;
  nodeName: string | null;
  address: string;
  status: PeerStatus;
  lastHandshakeAt: string | null;
  /** Control nodes that have not seen this member recently; absent from older APIs. */
  unreachedFrom?: string[] | null;
  heldOffOverlay?: boolean;
}

export interface ManagementNetworkHubNode {
  address: string;
  endpoint: string | null;
  keyed: boolean;
  nodeId: string | null;
  nodeName: string | null;
  primary: boolean;
  status: PeerStatus;
  membersReached: number;
  membersNotReached: number;
}

export interface OverlayDemotion {
  clusterId: string;
  clusterName: string;
  from: string | null;
  to: string | null;
  changed: boolean;
  held: boolean;
}

export interface ManagementNetwork {
  enabled: boolean;
  source: 'setting' | 'install' | 'default';
  unavailable: string | null;
  /** @deprecated the primary end only; read `hubs`. */
  hub: { address: string; endpoint: string | null; keyed: boolean } | null;
  /** Every control node's end, the primary first; absent from older APIs. */
  hubs?: ManagementNetworkHubNode[];
  hubProblem?: string | null;
  members: ManagementNetworkMember[];
}

interface MemberCluster {
  clusterId: string;
  clusterName: string;
  held: boolean;
  members: ManagementNetworkMember[];
}

const HUB_MARK: Record<PeerStatus, string> = { active: '✓', pending: '…', stale: '!' };

/**
 * The Flui network: the tunnel that lets clusters on another provider than the
 * control be reached. `compact` is the one line "How it is run" shows.
 */
@Component({
  selector: 'app-management-network-card',
  standalone: true,
  imports: [ConfirmationDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compact()) {
      <p class="m-0 text-sm text-foreground" data-testid="flui-network-line">
        <span class="font-medium">Flui network:</span> {{ line() }}
      </p>
    } @else {
      <section class="card-surface p-4 space-y-3" data-testid="flui-network">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="m-0 text-base font-semibold text-foreground">Flui network</h2>
            <p class="m-0 text-xs text-sub">Connects clusters on another provider to the control cluster.</p>
          </div>
          @if (network(); as n) {
            <div class="flex items-center gap-2">
              <span class="rounded-md px-2 py-0.5 text-xs font-semibold" [class]="n.enabled ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'" data-testid="flui-network-state">
                {{ n.enabled ? 'On' : 'Off' }}
              </span>
              @if (!confirming()) {
                <button type="button" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  [disabled]="!n.enabled && !!n.unavailable" (click)="confirming.set(true)" data-testid="flui-network-toggle">
                  {{ n.enabled ? 'Switch off' : 'Switch on' }}
                </button>
              } @else {
                <span class="inline-flex items-center gap-2 text-xs" data-testid="flui-network-confirm">
                  {{ n.enabled ? 'No new cluster joins it; other-provider clusters cannot be created.' : 'Other-provider clusters will be managed over it.' }}
                  <button type="button" class="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground disabled:opacity-50" [disabled]="saving()" (click)="toggle()">
                    {{ saving() ? 'Saving…' : 'Confirm' }}
                  </button>
                  <button type="button" class="text-muted-foreground" [disabled]="saving()" (click)="confirming.set(false)">Cancel</button>
                </span>
              }
            </div>
          }
        </div>

        @if (failed()) {
          <p class="m-0 text-sm text-sub">{{ failed() }}</p>
        } @else if (network(); as n) {
          @if (n.unavailable) {
            <p class="m-0 text-sm text-amber-700 dark:text-amber-300" data-testid="flui-network-unavailable">{{ n.unavailable }}</p>
          }
          @if (n.hubs?.length) {
            <p class="m-0 text-sm text-sub" data-testid="flui-network-hubs">
              Control ends:
              @for (h of n.hubs; track h.address; let last = $last) {
                <span [class]="h.status === 'stale' ? 'text-red-600 dark:text-red-400' : 'text-foreground'" [title]="hubTitle(h)">{{ hubLabel(h) }}</span>@if (!last) {<span>, </span>}
              }
            </p>
          } @else if (n.hub) {
            <p class="m-0 text-sm text-sub">
              Control end <span class="font-mono text-foreground">{{ n.hub.address }}</span>
              @if (!n.hub.keyed) { · not up yet }
            </p>
          }
          @if (n.hubProblem) {
            <p class="m-0 text-sm text-red-600 dark:text-red-400" data-testid="flui-network-hub-problem">
              The control's end is not set up, so members stay pending: {{ n.hubProblem }}
            </p>
          }
          @if (n.members.length) {
            <div class="divide-y divide-border/50 text-sm" data-testid="flui-network-members">
              @for (c of clusters(); track c.clusterId) {
                <div class="space-y-1 py-2" data-testid="flui-network-cluster">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="flex flex-wrap items-center gap-2">
                      <span class="font-medium text-foreground">{{ c.clusterName }}</span>
                      @if (c.held) {
                        <span class="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" data-testid="flui-network-held">held on its public address</span>
                      }
                    </span>
                    @if (canManage()) {
                      @if (c.held) {
                        <button type="button" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                          [disabled]="busy() === c.clusterId" (click)="release(c)" data-testid="flui-network-release">
                          {{ busy() === c.clusterId ? 'Releasing…' : 'Release' }}
                        </button>
                      } @else {
                        <button type="button" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
                          [disabled]="busy() === c.clusterId" (click)="askDemote(c)" data-testid="flui-network-demote">
                          Use public address
                        </button>
                      }
                    }
                  </div>
                  @for (m of c.members; track m.address) {
                    <div class="flex flex-wrap gap-x-3 text-xs text-sub">
                      <span>{{ m.nodeName ?? '—' }}</span>
                      <span class="font-mono">{{ m.address }}</span>
                      <span [class.text-red-600]="m.status === 'stale'">{{ handshake(m) }}</span>
                      @if (m.unreachedFrom?.length) {
                        <span class="text-amber-700 dark:text-amber-300" data-testid="flui-network-unreached">not reached from {{ m.unreachedFrom!.join(', ') }}</span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <p class="m-0 text-sm text-sub">No cluster is on it yet.</p>
          }
        }
      </section>

      <app-confirmation-dialog
        variant="warning"
        [title]="'Use the public address of ' + (pendingDemote()?.clusterName ?? 'this cluster') + '?'"
        message="Flui will manage this cluster over its public address until you release it."
        confirmText="Use public address"
        processingText="Moving…"
        (confirmed)="demote()"
        (cancelled)="pendingDemote.set(null)"
      />
    }
  `,
})
export class ManagementNetworkCardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);
  private readonly confirmDialog = viewChild(ConfirmationDialogComponent);

  readonly compact = input(false);

  protected readonly network = signal<ManagementNetwork | null>(null);
  protected readonly failed = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly saving = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly pendingDemote = signal<MemberCluster | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('cluster:manage'));

  protected readonly clusters = computed<MemberCluster[]>(() => {
    const groups = new Map<string, MemberCluster>();
    for (const m of this.network()?.members ?? []) {
      const group = groups.get(m.clusterId) ?? { clusterId: m.clusterId, clusterName: m.clusterName, held: false, members: [] };
      group.held ||= !!m.heldOffOverlay;
      group.members.push(m);
      groups.set(m.clusterId, group);
    }
    return [...groups.values()];
  });

  private get url(): string {
    return `${this.config.apiBaseUrl}/api/v1/infrastructure/management-network`;
  }

  protected readonly line = computed(() => {
    const n = this.network();
    if (this.failed()) return 'could not be read';
    if (!n) return '…';
    if (!n.enabled) return n.unavailable ? `off — ${n.unavailable}` : 'off';
    const stale = n.members.filter((m) => m.status === 'stale').length;
    const held = this.clusters().filter((c) => c.held).length;
    const members = `${n.members.length} ${n.members.length === 1 ? 'member' : 'members'}`;
    const extra = `${stale ? ` · ${stale} quiet` : ''}${held ? ` · ${held} held on public address` : ''}`;
    if (n.hubProblem) return `on · control end not set up · ${members}${extra}`;
    if (n.hubs?.length) return `on · control ends: ${n.hubs.map((h) => this.hubLabel(h)).join(', ')} · ${members}${extra}`;
    return `on · control end ${n.hub?.address ?? 'not up yet'} · ${members}${extra}`;
  });

  ngOnInit(): void {
    void this.load();
  }

  protected handshake(m: ManagementNetworkMember): string {
    if (!m.lastHandshakeAt) return 'none yet';
    const at = m.lastHandshakeAt.replace('T', ' ').slice(0, 16);
    return m.status === 'stale' ? `${at} UTC — quiet` : `${at} UTC`;
  }

  protected hubLabel(h: ManagementNetworkHubNode): string {
    const missed = h.membersNotReached ? ` (${h.membersNotReached} not reached)` : '';
    return `${h.nodeName ?? h.address} ${HUB_MARK[h.status]}${missed}`;
  }

  protected hubTitle(h: ManagementNetworkHubNode): string {
    const role = h.primary ? ' · primary' : '';
    const up = h.keyed ? '' : ' · not up yet';
    return `${h.address}${role}${up} · ${h.status} · ${h.membersReached} member(s) reached, ${h.membersNotReached} not`;
  }

  protected askDemote(c: MemberCluster): void {
    this.pendingDemote.set(c);
    this.confirmDialog()?.open();
  }

  protected async demote(): Promise<void> {
    const c = this.pendingDemote();
    if (!c) return;
    const dialog = this.confirmDialog();
    dialog?.setProcessing(true);
    this.busy.set(c.clusterId);
    try {
      const r = await firstValueFrom(this.http.post<OverlayDemotion>(this.demoteUrl(c.clusterId), {}));
      const moved = r.changed ? `API address moved from ${r.from} to ${r.to}.` : `Already on ${r.to}.`;
      this.toast.showSuccess({ title: `${r.clusterName} held off the Flui network`, message: moved });
      await this.load();
    } catch (err: unknown) {
      this.toast.showError({ title: 'Not moved', message: this.messageOf(err) });
    } finally {
      this.busy.set(null);
      dialog?.close();
      this.pendingDemote.set(null);
    }
  }

  protected async release(c: MemberCluster): Promise<void> {
    this.busy.set(c.clusterId);
    try {
      await firstValueFrom(this.http.delete<OverlayDemotion>(this.demoteUrl(c.clusterId)));
      this.toast.showSuccess({
        title: `${c.clusterName} released`,
        message: 'It moves back to the Flui network once every control node reaches it there.',
      });
      await this.load();
    } catch (err: unknown) {
      this.toast.showError({ title: 'Not released', message: this.messageOf(err) });
    } finally {
      this.busy.set(null);
    }
  }

  private demoteUrl(clusterId: string): string {
    return `${this.url}/clusters/${encodeURIComponent(clusterId)}/demote`;
  }

  private messageOf(err: unknown): string {
    const e = err as { error?: { message?: string | string[] }; message?: string };
    const raw = e?.error?.message ?? e?.message ?? '';
    return Array.isArray(raw) ? raw.join(' ') : raw;
  }

  private async load(): Promise<void> {
    try {
      this.network.set(await firstValueFrom(this.http.get<ManagementNetwork>(this.url)));
      this.failed.set(null);
    } catch {
      this.failed.set('The Flui network could not be read.');
    }
  }

  protected async toggle(): Promise<void> {
    const n = this.network();
    if (!n) return;
    this.saving.set(true);
    try {
      this.network.set(await firstValueFrom(this.http.put<ManagementNetwork>(this.url, { enabled: !n.enabled })));
      this.toast.showSuccess({ title: n.enabled ? 'Flui network switched off' : 'Flui network switched on', message: '' });
    } catch (err: unknown) {
      this.toast.showError({ title: 'Not switched', message: this.messageOf(err) });
    } finally {
      this.saving.set(false);
      this.confirming.set(false);
    }
  }
}
