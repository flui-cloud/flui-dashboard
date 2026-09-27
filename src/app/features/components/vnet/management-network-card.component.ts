import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { ToastService } from '../../../shared/services/toast.service';

export interface ManagementNetworkMember {
  clusterId: string;
  clusterName: string;
  nodeName: string | null;
  address: string;
  status: 'pending' | 'active' | 'stale';
  lastHandshakeAt: string | null;
}

export interface ManagementNetwork {
  enabled: boolean;
  source: 'setting' | 'install' | 'default';
  unavailable: string | null;
  hub: { address: string; endpoint: string | null; keyed: boolean } | null;
  members: ManagementNetworkMember[];
}

/**
 * The Flui network: the tunnel that lets clusters on another provider than the
 * control be reached. `compact` is the one line "How it is run" shows.
 */
@Component({
  selector: 'app-management-network-card',
  standalone: true,
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
          @if (n.hub) {
            <p class="m-0 text-sm text-sub">
              Control end <span class="font-mono text-foreground">{{ n.hub.address }}</span>
              @if (!n.hub.keyed) { · not up yet }
            </p>
          }
          @if (n.members.length) {
            <table class="w-full text-left text-sm" data-testid="flui-network-members">
              <thead class="text-xs text-muted-foreground">
                <tr><th class="py-1 font-normal">Cluster / node</th><th class="py-1 font-normal">Address</th><th class="py-1 font-normal">Last handshake</th></tr>
              </thead>
              <tbody>
                @for (m of n.members; track m.address) {
                  <tr class="border-t border-border/50">
                    <td class="py-1">{{ m.clusterName }} / {{ m.nodeName ?? '—' }}</td>
                    <td class="py-1 font-mono">{{ m.address }}</td>
                    <td class="py-1" [class.text-red-600]="m.status === 'stale'">{{ handshake(m) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="m-0 text-sm text-sub">No cluster is on it yet.</p>
          }
        }
      </section>
    }
  `,
})
export class ManagementNetworkCardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly toast = inject(ToastService);

  readonly compact = input(false);

  protected readonly network = signal<ManagementNetwork | null>(null);
  protected readonly failed = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly saving = signal(false);

  private get url(): string {
    return `${this.config.apiBaseUrl}/api/v1/infrastructure/management-network`;
  }

  protected readonly line = computed(() => {
    const n = this.network();
    if (this.failed()) return 'could not be read';
    if (!n) return '…';
    if (!n.enabled) return n.unavailable ? `off — ${n.unavailable}` : 'off';
    const stale = n.members.filter((m) => m.status === 'stale').length;
    const members = `${n.members.length} ${n.members.length === 1 ? 'member' : 'members'}`;
    const quiet = stale ? ` · ${stale} quiet` : '';
    return `on · control end ${n.hub?.address ?? 'not up yet'} · ${members}${quiet}`;
  });

  ngOnInit(): void {
    void this.load();
  }

  protected handshake(m: ManagementNetworkMember): string {
    if (!m.lastHandshakeAt) return 'none yet';
    const at = m.lastHandshakeAt.replace('T', ' ').slice(0, 16);
    return m.status === 'stale' ? `${at} UTC — quiet` : `${at} UTC`;
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
      const e = err as { error?: { message?: string | string[] }; message?: string };
      const raw = e?.error?.message ?? e?.message ?? '';
      this.toast.showError({ title: 'Not switched', message: Array.isArray(raw) ? raw.join(' ') : raw });
    } finally {
      this.saving.set(false);
      this.confirming.set(false);
    }
  }
}
