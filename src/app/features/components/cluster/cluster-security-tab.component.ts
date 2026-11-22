import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthzInstallService } from '../../service/authz-install.service';
import { ClusterService } from '../../service/cluster.service';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ConfirmService } from '../../../ui/overlays/confirm';

@Component({
  selector: 'app-cluster-security-tab',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlAlert, FlStatus, FlButton, FlSpinner],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Internal app protection">
      <ng-container panelActions>
        @if (statusLabel(); as label) {
          <fl-status [tone]="statusTone()" [label]="label" />
        }
      </ng-container>

      <div class="flex flex-col gap-4">
        <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
          Checks the Flui sign-in on this cluster for internal apps and for routes that require one.
          The control cluster does not need it.
        </p>

        <fl-key-value>
          <fl-kv-item key="Component" [mono]="true">flui-authz</fl-kv-item>
          @if (authzService.install()?.installedAt; as installedAt) {
            <fl-kv-item key="Installed">{{ formatDate(installedAt) }}</fl-kv-item>
          }
        </fl-key-value>

        @if (authzService.installing()) {
          <div class="fl-row">
            <fl-status tone="progress" [label]="authzService.progressStep() || 'Working'" />
            <span class="fl-num text-fl-body-sm text-fl-ink-muted">
              {{ authzService.progress() }}%
            </span>
          </div>
        }

        @if (authzService.error()) {
          <fl-alert tone="error" title="Request failed">{{ authzService.error() }}</fl-alert>
        }

        @if (authzService.install()?.status === 'FAILED' && authzService.install()?.errorMessage) {
          <fl-alert tone="error" title="Installation failed">
            {{ authzService.install()!.errorMessage }}
          </fl-alert>
        }

        @if (showInstallButton() || showRetryButton() || showUninstallButton()) {
          <div class="fl-row">
            @if (showInstallButton()) {
              <button
                flButton="primary"
                type="button"
                [disabled]="authzService.installing() || authzService.loading()"
                (click)="onInstall()"
              >
                @if (authzService.installing()) {
                  <fl-spinner label="Installing" />
                  Installing…
                } @else {
                  Install
                }
              </button>
            }
            @if (showRetryButton()) {
              <button
                flButton="primary"
                type="button"
                [disabled]="authzService.installing()"
                (click)="onInstall()"
              >
                @if (authzService.installing()) {
                  <fl-spinner label="Retrying" />
                  Retrying…
                } @else {
                  Retry
                }
              </button>
            }
            @if (showUninstallButton()) {
              <button
                flButton
                type="button"
                [disabled]="authzService.installing()"
                (click)="confirmUninstall()"
              >
                Uninstall
              </button>
            }
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class ClusterSecurityTabComponent implements OnInit {
  protected authzService = inject(AuthzInstallService);
  private readonly route = inject(ActivatedRoute);
  private readonly clusterService = inject(ClusterService);
  private readonly confirmService = inject(ConfirmService);

  private readonly clusterId = signal('');

  private readonly Status = AuthzInstallResponseDto.StatusEnum;

  protected statusLabel = computed(() => {
    const s = this.authzService.install()?.status;
    if (!s || s === this.Status.Uninstalled) return 'Not installed';
    if (s === this.Status.Pending || s === this.Status.Installing) return 'Installing';
    if (s === this.Status.Running) return 'Active';
    if (s === this.Status.Failed) return 'Failed';
    return null;
  });

  protected statusTone = computed<StatusTone>(() => {
    const s = this.authzService.install()?.status;
    if (s === this.Status.Running) return 'success';
    if (s === this.Status.Failed) return 'error';
    if (s === this.Status.Pending || s === this.Status.Installing) return 'progress';
    return 'neutral';
  });

  protected showInstallButton = computed(() => {
    const s = this.authzService.install()?.status;
    return !s || s === this.Status.Uninstalled;
  });

  protected showRetryButton = computed(() => {
    return this.authzService.install()?.status === this.Status.Failed;
  });

  protected showUninstallButton = computed(() => {
    return this.authzService.install()?.status === this.Status.Running;
  });

  ngOnInit(): void {
    void (async () => {
      const id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
      this.clusterId.set(id);
      if (id) {
        await this.authzService.loadForCluster(id);
      }
    })();
  }

  protected async onInstall(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    await this.authzService.installAuthz(id);
  }

  protected async confirmUninstall(): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Remove flui-authz',
      body: 'Remove flui-authz from this cluster? Internal apps fall back to the legacy external ForwardAuth proxy. No data is lost.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) await this.onUninstall();
  }

  protected async onUninstall(): Promise<void> {
    const install = this.authzService.install();
    if (!install) return;
    await this.authzService.uninstallAuthz(install.id);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
