import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideNetwork,
  lucideRefreshCw,
  lucideCircleAlert,
  lucideCircleCheck,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { VNetService } from '../../service/vnet.service';
import { VNetInfo, VNetStatus } from '../../model/vnet.models';

@Component({
  selector: 'app-attach-vnet-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideX,
      lucideNetwork,
      lucideRefreshCw,
      lucideCircleAlert,
      lucideCircleCheck,
    }),
  ],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      (click)="onBackdrop($event)"
    >
      <div
        class="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 class="text-base font-semibold text-foreground flex items-center gap-2">
            <ng-icon name="lucideNetwork" class="h-5 w-5 text-blue-500" />
            Attach VNet
          </h3>
          <button
            type="button"
            (click)="close()"
            [disabled]="running()"
            class="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
          >
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>

        <div class="px-5 py-4 space-y-4">
          @if (loadingVNets()) {
            <div class="flex items-center gap-2 text-sm text-sub">
              <ng-icon name="lucideRefreshCw" class="h-4 w-4 animate-spin" />
              Loading VNets...
            </div>
          } @else if (availableVNets().length === 0) {
            <div class="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200">
              No VNets available for provider <strong>{{ provider() }}</strong>. Create a
              VNet first.
            </div>
          } @else {
            <div>
              <label class="text-sm font-medium block mb-1.5">VNet</label>
              <select
                [(ngModel)]="selectedVNetId"
                (ngModelChange)="onVNetChange()"
                [disabled]="running()"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option [ngValue]="null" disabled>Select a VNet…</option>
                @for (v of availableVNets(); track v.id) {
                  <option [ngValue]="v.id">{{ v.name }} ({{ v.ipRange }})</option>
                }
              </select>
            </div>

            <div>
              <label class="text-sm font-medium block mb-1.5">Subnet</label>
              <select
                [(ngModel)]="selectedSubnetId"
                [disabled]="running() || !selectedVNetId() || subnets().length === 0"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option [ngValue]="null">Auto (first available subnet)</option>
                @for (s of subnets(); track s.id) {
                  <option [ngValue]="s.id">{{ s.ipRange }}</option>
                }
              </select>
            </div>

            <div class="flex items-start gap-3">
              <input
                type="checkbox"
                id="auto-assign-ip"
                [(ngModel)]="autoAssignIp"
                [disabled]="running()"
                class="h-4 w-4 mt-1 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div class="flex-1">
                <label for="auto-assign-ip" class="text-sm font-medium text-foreground">
                  Auto-assign private IPs
                </label>
                <p class="text-xs text-sub mt-0.5">
                  Let the provider assign a private IP from the subnet to each node.
                </p>
              </div>
            </div>
          }

          @if (running()) {
            <div class="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div class="flex items-center justify-between text-xs text-sub">
                <span>{{ progressMessage() || 'Working…' }}</span>
                @if (totalSteps() > 0) {
                  <span>Step {{ currentStep() + 1 }}/{{ totalSteps() }}</span>
                }
              </div>
              <div class="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  class="h-full bg-blue-500 transition-all"
                  [style.width.%]="progressPct()"
                ></div>
              </div>
            </div>
          }

          @if (errorMessage(); as err) {
            <div class="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 flex items-start gap-2">
              <ng-icon name="lucideCircleAlert" class="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p class="text-xs text-red-900 dark:text-red-200">{{ err }}</p>
            </div>
          }
        </div>

        <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            (click)="close()"
            [disabled]="running()"
            class="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="submit()"
            [disabled]="!canSubmit()"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            @if (running()) {
              <ng-icon name="lucideRefreshCw" class="h-4 w-4 animate-spin" />
              Attaching…
            } @else {
              Attach
            }
          </button>
        </div>
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
    this.vnetService.vnets().filter(v => v.status === VNetStatus.ACTIVE),
  );

  readonly subnets = computed(() => {
    const id = this.selectedVNetId();
    if (!id) return [];
    return this.availableVNets().find(v => v.id === id)?.subnets ?? [];
  });

  readonly canSubmit = computed(
    () => !!this.selectedVNetId() && !this.running() && !this.loadingVNets(),
  );

  ngOnInit(): void {
    void (async () => {
      this.clusterService.clearAttachVNetState();
      this.loadingVNets.set(true);
      try {
        await this.vnetService.loadVNets(this.provider());
      } catch {
        // VNetService already records error; we'll show empty state.
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

    try {
      await done;
      this.attached.emit();
      this.close();
    } catch {
      // error already in attachVNetError signal
    }
  }
}
