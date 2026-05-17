import { Component, inject, signal, computed, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShieldCheck, lucideLoader, lucideAlertCircle, lucideCheckCircle,
  lucideCircle, lucideAlertTriangle,
} from '@ng-icons/lucide';
import { AuthzInstallService } from '../../service/authz-install.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { ClusterService } from '../../service/cluster.service';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

@Component({
  selector: 'app-cluster-security-tab',
  standalone: true,
  imports: [NgIconComponent, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideShieldCheck, lucideLoader, lucideAlertCircle, lucideCheckCircle,
      lucideCircle, lucideAlertTriangle,
    }),
  ],
  template: `
    <div class="space-y-6 max-w-2xl">

      <!-- OIDC gate -->
      @if (!isOidc) {
        <div class="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <ng-icon name="lucideAlertTriangle" class="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-medium text-amber-900 dark:text-amber-100">OIDC mode required</p>
            <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
              flui-authz requires OIDC auth mode. Configure your Identity Provider in Settings → Authentication first.
            </p>
          </div>
        </div>
      }

      <!-- Main panel -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideShieldCheck" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Internal app protection (flui-authz)</h3>
          </div>
          <!-- Status badge -->
          @if (statusLabel(); as label) {
            <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              [class]="statusBadgeClass()">
              <span class="w-1.5 h-1.5 rounded-full inline-block" [class]="statusDotClass()"></span>
              {{ label }}
            </span>
          }
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-400">
          Protects apps with <span class="font-mono text-xs">exposure: internal</span> via an
          in-cluster JWT validator. Zero dependency on the Flui API for each auth request —
          ~1 ms latency vs ~100 ms external roundtrip.
        </p>

        <!-- Installed date -->
        @if (authzService.install()?.installedAt) {
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Installed {{ formatDate(authzService.install()!.installedAt!) }}
          </p>
        }

        <!-- Progress bar during install/uninstall -->
        @if (authzService.installing()) {
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{{ authzService.progressStep() || 'Working...' }}</span>
              <span>{{ authzService.progress() }}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                class="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                [style.width.%]="authzService.progress()"
              ></div>
            </div>
          </div>
        }

        <!-- Error message -->
        @if (authzService.error()) {
          <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{{ authzService.error() }}</span>
          </div>
        }

        <!-- FAILED error message from DTO -->
        @if (authzService.install()?.status === 'FAILED' && authzService.install()?.errorMessage) {
          <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{{ authzService.install()!.errorMessage }}</span>
          </div>
        }

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-1">
          @if (showInstallButton()) {
            <button
              (click)="onInstall()"
              [disabled]="authzService.installing() || authzService.loading() || !isOidc"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              @if (authzService.installing()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Installing...
              } @else {
                Install
              }
            </button>
          }
          @if (showRetryButton()) {
            <button
              (click)="onInstall()"
              [disabled]="authzService.installing() || !isOidc"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              @if (authzService.installing()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Retrying...
              } @else {
                Retry
              }
            </button>
          }
          @if (showUninstallButton()) {
            <button
              (click)="uninstallDialog.open()"
              [disabled]="authzService.installing()"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Uninstall
            </button>
          }
        </div>
      </div>

    </div>

    <app-confirmation-dialog
      #uninstallDialog
      title="Remove flui-authz"
      message="Remove flui-authz from this cluster? Internal apps will fall back to the legacy external ForwardAuth proxy. No data is lost."
      confirmText="Remove"
      variant="danger"
      (confirmed)="onUninstall()"
    />
  `,
})
export class ClusterSecurityTabComponent implements OnInit {
  protected authzService = inject(AuthzInstallService);
  private readonly route = inject(ActivatedRoute);
  private readonly clusterService = inject(ClusterService);
  private readonly cfg = inject(AppConfigService);

  @ViewChild('uninstallDialog') uninstallDialog!: ConfirmationDialogComponent;

  protected isOidc = this.cfg.get().authMode === 'oidc';
  private readonly clusterId = signal('');

  private readonly Status = AuthzInstallResponseDto.StatusEnum;

  protected statusLabel = computed(() => {
    const s = this.authzService.install()?.status;
    if (!s || s === this.Status.Uninstalled) return 'Not installed';
    if (s === this.Status.Pending || s === this.Status.Installing) return 'Installing...';
    if (s === this.Status.Running) return 'Active';
    if (s === this.Status.Failed) return 'Failed';
    return null;
  });

  protected statusBadgeClass = computed(() => {
    const s = this.authzService.install()?.status;
    if (s === this.Status.Running) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (s === this.Status.Failed) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    if (s === this.Status.Pending || s === this.Status.Installing)
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  });

  protected statusDotClass = computed(() => {
    const s = this.authzService.install()?.status;
    if (s === this.Status.Running) return 'bg-green-500';
    if (s === this.Status.Failed) return 'bg-red-500';
    if (s === this.Status.Pending || s === this.Status.Installing) return 'bg-amber-500';
    return 'bg-gray-400';
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

  protected async onUninstall(): Promise<void> {
    const install = this.authzService.install();
    if (!install) return;
    this.uninstallDialog.setProcessing(true);
    await this.authzService.uninstallAuthz(install.id);
    this.uninstallDialog.close();
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
