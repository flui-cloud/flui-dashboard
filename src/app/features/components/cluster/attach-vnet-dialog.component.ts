import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { VNetService } from '../../service/vnet.service';
import { VNetInfo, VNetStatus } from '../../model/vnet.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-attach-vnet-dialog',
  imports: [
    CdkTrapFocus,
    FormsModule,
    FlAlert,
    FlField,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (click)="onBackdrop($event)"
      (keydown.escape)="!running() && close()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attach-vnet-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="attach-vnet-title">Attach network</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            [disabled]="running()"
            (click)="close()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          @if (loadingVNets()) {
            <fl-loading-state [rows]="2" />
          } @else if (availableVNets().length === 0) {
            <fl-alert tone="warning" title="No networks available">
              There is no active network for <span class="fl-mono">{{ provider() }}</span>. Create
              one first.
            </fl-alert>
          } @else {
            <fl-field label="Network" for="attach-vnet-network">
              <span class="fl-select-wrap">
                <select
                  id="attach-vnet-network"
                  class="fl-select"
                  [(ngModel)]="selectedVNetId"
                  (ngModelChange)="onVNetChange()"
                  [disabled]="running()"
                >
                  <option [ngValue]="null" disabled>Select a network</option>
                  @for (v of availableVNets(); track v.id) {
                    <option [ngValue]="v.id">{{ v.name }} ({{ v.ipRange }})</option>
                  }
                </select>
              </span>
            </fl-field>

            <fl-field label="Subnet" for="attach-vnet-subnet">
              <span class="fl-select-wrap">
                <select
                  id="attach-vnet-subnet"
                  class="fl-select"
                  [(ngModel)]="selectedSubnetId"
                  [disabled]="running() || !selectedVNetId() || subnets().length === 0"
                >
                  <option [ngValue]="null">Automatic (first available subnet)</option>
                  @for (s of subnets(); track s.id) {
                    <option [ngValue]="s.id">{{ s.ipRange }}</option>
                  }
                </select>
              </span>
            </fl-field>

            <div class="flex flex-col gap-1">
              <label class="fl-check" for="auto-assign-ip">
                <input
                  type="checkbox"
                  id="auto-assign-ip"
                  [(ngModel)]="autoAssignIp"
                  [disabled]="running()"
                />
                Assign private IPs automatically
              </label>
              <span class="text-fl-body-sm text-fl-ink-muted">
                The provider gives each node a private IP from the subnet.
              </span>
            </div>
          }

          @if (running()) {
            <div class="fl-row">
              <fl-status tone="progress" [label]="progressMessage() || 'Working'" />
              @if (totalSteps() > 0) {
                <span class="fl-num text-fl-body-sm text-fl-ink-muted">
                  Step {{ currentStep() + 1 }} of {{ totalSteps() }}
                </span>
              }
            </div>
          }

          @if (errorMessage(); as err) {
            <fl-alert tone="error" title="Could not attach the network">{{ err }}</fl-alert>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" [disabled]="running()" (click)="close()">
            Cancel
          </button>
          <button flButton="primary" type="button" [disabled]="!canSubmit()" (click)="submit()">
            @if (running()) {
              <fl-spinner label="Attaching" />
              Attaching…
            } @else {
              Attach
            }
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class AttachVNetDialogComponent implements OnInit {
  readonly clusterId = input.required<string>();
  readonly provider = input.required<string>();

  readonly closed = output<void>();
  readonly attached = output<void>();

  private readonly clusterService = inject(ClusterService);
  private readonly vnetService = inject(VNetService);

  readonly loadingVNets = signal<boolean>(false);
  readonly selectedVNetId = signal<string | null>(null);
  readonly selectedSubnetId = signal<string | null>(null);
  readonly autoAssignIp = signal<boolean>(true);

  readonly running = this.clusterService.attachVNetRunning;
  readonly progressPct = this.clusterService.attachVNetProgress;
  readonly progressMessage = this.clusterService.attachVNetMessage;
  readonly currentStep = this.clusterService.attachVNetCurrentStep;
  readonly totalSteps = this.clusterService.attachVNetTotalSteps;
  readonly errorMessage = this.clusterService.attachVNetError;

  readonly availableVNets = computed<VNetInfo[]>(() =>
    this.vnetService.vnets().filter((v) => v.status === VNetStatus.ACTIVE),
  );

  readonly subnets = computed(() => {
    const id = this.selectedVNetId();
    if (!id) return [];
    return this.availableVNets().find((v) => v.id === id)?.subnets ?? [];
  });

  readonly canSubmit = computed(
    () => !!this.selectedVNetId() && !this.running() && !this.loadingVNets(),
  );

  ngOnInit(): void {
    void (async () => {
      this.clusterService.clearAttachVNetState();
      this.loadingVNets.set(true);
      try {
        await this.vnetService.loadVNets(this.provider()).catch(() => undefined);
      } finally {
        this.loadingVNets.set(false);
      }
    })();
  }

  onVNetChange(): void {
    this.selectedSubnetId.set(null);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.running()) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  async submit(): Promise<void> {
    const vnetId = this.selectedVNetId();
    if (!vnetId) return;
    const { done } = this.clusterService.attachVNet(this.clusterId(), {
      vnetId,
      subnetId: this.selectedSubnetId() ?? undefined,
      autoAssignIp: this.autoAssignIp(),
    });

    const attached = await done.then(
      () => true,
      () => false,
    );
    if (!attached) return;
    this.attached.emit();
    this.close();
  }
}
