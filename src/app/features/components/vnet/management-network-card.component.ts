import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { AppConfigService } from '../../../core/services/app-config.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../shared/services/toast.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

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
  /** The primary end only, what older APIs send instead of `hubs`. */
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

const PEER_STATUS: Record<PeerStatus, { tone: StatusTone; label: string }> = {
  active: { tone: 'success', label: 'Connected' },
  pending: { tone: 'progress', label: 'Pending' },
  stale: { tone: 'warning', label: 'Quiet' },
};

/**
 * The Flui network: the tunnel that lets clusters on another provider than the
 * control be reached. `compact` is the one line "How it is run" shows.
 */
@Component({
  selector: 'app-management-network-card',
  imports: [
    FlPanel,
    FlAlert,
    FlTable,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlStatus,
    FlTag,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideX })],
  host: { class: 'fl-stack' },
  templateUrl: './management-network-card.component.html',
})
export class ManagementNetworkCardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);

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
      const group = groups.get(m.clusterId) ?? {
        clusterId: m.clusterId,
        clusterName: m.clusterName,
        held: false,
        members: [],
      };
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
    const quiet = stale ? ` · ${stale} quiet` : '';
    const onPublic = held ? ` · ${held} held on public address` : '';
    const extra = quiet + onPublic;
    if (n.hubProblem) return `on · control end not set up · ${members}${extra}`;
    if (n.hubs?.length)
      return `on · control ends: ${n.hubs.map((h) => this.hubLabel(h)).join(', ')} · ${members}${extra}`;
    return `on · control end ${n.hub?.address ?? 'not up yet'} · ${members}${extra}`;
  });

  ngOnInit(): void {
    void this.load();
  }

  protected handshake(m: ManagementNetworkMember): string {
    if (!m.lastHandshakeAt) return 'None yet';
    return `${m.lastHandshakeAt.replace('T', ' ').slice(0, 16)} UTC`;
  }

  protected peerStatus(status: PeerStatus): { tone: StatusTone; label: string } {
    return PEER_STATUS[status];
  }

  protected hubStatus(h: ManagementNetworkHubNode): { tone: StatusTone; label: string } {
    if (!h.keyed) return { tone: 'progress', label: 'Not up yet' };
    return PEER_STATUS[h.status];
  }

  protected hubLabel(h: ManagementNetworkHubNode): string {
    const missed = h.membersNotReached ? ` (${h.membersNotReached} not reached)` : '';
    return `${h.nodeName ?? h.address} ${HUB_MARK[h.status]}${missed}`;
  }

  protected askDemote(c: MemberCluster): void {
    this.pendingDemote.set(c);
  }

  protected closeDemote(): void {
    if (!this.busy()) this.pendingDemote.set(null);
  }

  protected async demote(): Promise<void> {
    const c = this.pendingDemote();
    if (!c) return;
    this.busy.set(c.clusterId);
    try {
      const r = await firstValueFrom(
        this.http.post<OverlayDemotion>(this.demoteUrl(c.clusterId), {}),
      );
      const moved = r.changed
        ? `API address moved from ${r.from} to ${r.to}.`
        : `Already on ${r.to}.`;
      this.toast.showSuccess({
        title: `${r.clusterName} held off the Flui network`,
        message: moved,
      });
      await this.load();
    } catch (err: unknown) {
      this.toast.showError({ title: 'Not moved', message: this.messageOf(err) });
    } finally {
      this.busy.set(null);
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
      this.network.set(
        await firstValueFrom(this.http.put<ManagementNetwork>(this.url, { enabled: !n.enabled })),
      );
      this.toast.showSuccess({
        title: n.enabled ? 'Flui network switched off' : 'Flui network switched on',
        message: '',
      });
    } catch (err: unknown) {
      this.toast.showError({ title: 'Not switched', message: this.messageOf(err) });
    } finally {
      this.saving.set(false);
      this.confirming.set(false);
    }
  }
}
