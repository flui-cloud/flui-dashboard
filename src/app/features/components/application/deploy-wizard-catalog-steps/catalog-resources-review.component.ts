import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronUp,
  lucideCircleAlert,
  lucideCircleCheck,
  lucideCircleX,
  lucideCpu,
  lucideLoader,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import {
  isValidCpuString,
  isValidMemoryString,
} from '../../../model/k8s-quantities';

@Component({
  selector: 'app-catalog-resources-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronUp,
      lucideCircleAlert,
      lucideCircleCheck,
      lucideCircleX,
      lucideCpu,
      lucideLoader,
      lucideTriangleAlert,
    }),
  ],
  template: `
    @let detail = state.catalogDetail();
    @let av = state.catalogAvailability();
    @let loading = state.catalogAvailabilityLoading();
    @let err = state.catalogAvailabilityError();
    @let overrides = state.catalogResourceOverrides();
    @let canDeploy = av?.canDeploy ?? true;

    <div class="border border-border rounded-lg p-4 space-y-4">
      <h4 class="font-medium flex items-center">
        <ng-icon name="lucideCpu" class="h-4 w-4 mr-2" />
        App resources
      </h4>

      @if (detail?.resources; as res) {
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-xs text-muted-foreground">Requests</div>
            <div class="mt-0.5 font-mono">
              {{ effectiveCpuRequest() }} CPU · {{ effectiveMemoryRequest() }} RAM
              @if (state.catalogResourcesCustomized()) {
                <span class="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Customized
                </span>
              }
            </div>
            <div class="mt-0.5 text-[11px] text-muted-foreground">
              × {{ state.effectiveCatalogResources().replicas }} replica{{ state.effectiveCatalogResources().replicas === 1 ? '' : 's' }}
            </div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Limits (can use up to)</div>
            <div class="mt-0.5 font-mono">
              {{ effectiveCpuLimit() }} CPU · {{ effectiveMemoryLimit() }} RAM
            </div>
          </div>
        </div>
      }

      @if (loading) {
        <div class="flex items-center gap-2 p-3 rounded-md border border-border text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin shrink-0" />
          Checking cluster capacity…
        </div>
      } @else if (err) {
        <div class="flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/5 text-sm text-destructive">
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
          <span>{{ err }}</span>
        </div>
      } @else if (av) {
        @if (canDeploy && !av.reason) {
          <div class="flex items-start gap-2 p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-sm">
            <ng-icon name="lucideCircleCheck" class="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400" />
            <div class="flex-1 text-green-700 dark:text-green-300">
              Cluster has enough free capacity.
              <div class="mt-1 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4">
                <span>Required:</span><span class="text-right font-mono">{{ av.required.cpu }} · {{ av.required.memory }}</span>
                <span>Available:</span><span class="text-right font-mono">{{ av.available.cpu }} · {{ av.available.memory }}</span>
              </div>
            </div>
          </div>
        } @else if (av.reason === 'autoscaling_pending') {
          <div class="flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-sm">
            <ng-icon name="lucideTriangleAlert" class="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div class="flex-1">
              <p class="font-medium text-amber-800 dark:text-amber-200">
                Cluster will autoscale to fit
              </p>
              <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Current capacity is tight, but cluster autoscaling is enabled and will add a node when the install starts.
              </p>
            </div>
          </div>
        } @else {
          <div class="flex items-start gap-2 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 text-sm">
            <ng-icon name="lucideCircleX" class="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400" />
            <div class="flex-1">
              <p class="font-medium text-red-700 dark:text-red-300">Insufficient cluster capacity</p>
              <div class="mt-1 text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4">
                <span>Required:</span><span class="text-right font-mono">{{ av.required.cpu }} · {{ av.required.memory }}</span>
                <span>Available (after 10% reserve):</span><span class="text-right font-mono">{{ av.available.cpu }} · {{ av.available.memory }}</span>
                <span>Currently used:</span><span class="text-right font-mono">{{ av.used.cpu }} · {{ av.used.memory }}</span>
                <span>Cluster total:</span><span class="text-right font-mono">{{ av.total.cpu }} · {{ av.total.memory }}</span>
              </div>
              <p class="text-xs text-red-700 dark:text-red-300 mt-2">
                Shrink the override below, pick another cluster, or check the "install anyway" box to proceed at your own risk.
              </p>
            </div>
          </div>
        }
      }

      <!-- Advanced override panel -->
      <div class="pt-2 border-t border-border">
        <button
          type="button"
          (click)="toggleAdvanced()"
          class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ng-icon [name]="advancedOpen() ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3.5 w-3.5" />
          Advanced — override resources
        </button>

        @if (advancedOpen()) {
          <div class="mt-3 space-y-3">
            <p class="text-xs text-muted-foreground">
              Override the manifest defaults. Leave a field empty to keep the manifest value.
              Lowering request below the app's real usage may cause OOM-kill or CPU throttling.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium mb-1">CPU request</label>
                <input
                  type="text"
                  [ngModel]="overrides.cpuRequest"
                  (ngModelChange)="onOverrideChange('cpuRequest', $event)"
                  [placeholder]="detail?.resources?.requests?.cpu ?? '250m'"
                  [class]="inputClass(overrides.cpuRequest && !cpuReqValid())"
                />
                @if (overrides.cpuRequest && !cpuReqValid()) {
                  <p class="mt-1 text-[11px] text-destructive">Format: "250m" or "1" or "2.5"</p>
                }
              </div>
              <div>
                <label class="block text-xs font-medium mb-1">CPU limit</label>
                <input
                  type="text"
                  [ngModel]="overrides.cpuLimit"
                  (ngModelChange)="onOverrideChange('cpuLimit', $event)"
                  [placeholder]="detail?.resources?.limits?.cpu ?? '500m'"
                  [class]="inputClass(overrides.cpuLimit && !cpuLimitValid())"
                />
                @if (overrides.cpuLimit && !cpuLimitValid()) {
                  <p class="mt-1 text-[11px] text-destructive">Format: "250m" or "1" or "2.5"</p>
                }
              </div>
              <div>
                <label class="block text-xs font-medium mb-1">Memory request</label>
                <input
                  type="text"
                  [ngModel]="overrides.memoryRequest"
                  (ngModelChange)="onOverrideChange('memoryRequest', $event)"
                  [placeholder]="detail?.resources?.requests?.memory ?? '512Mi'"
                  [class]="inputClass(overrides.memoryRequest && !memReqValid())"
                />
                @if (overrides.memoryRequest && !memReqValid()) {
                  <p class="mt-1 text-[11px] text-destructive">Format: "512Mi", "2Gi", "1.5Gi"</p>
                }
              </div>
              <div>
                <label class="block text-xs font-medium mb-1">Memory limit</label>
                <input
                  type="text"
                  [ngModel]="overrides.memoryLimit"
                  (ngModelChange)="onOverrideChange('memoryLimit', $event)"
                  [placeholder]="detail?.resources?.limits?.memory ?? '1Gi'"
                  [class]="inputClass(overrides.memoryLimit && !memLimitValid())"
                />
                @if (overrides.memoryLimit && !memLimitValid()) {
                  <p class="mt-1 text-[11px] text-destructive">Format: "512Mi", "2Gi", "1.5Gi"</p>
                }
              </div>
              <div>
                <label class="block text-xs font-medium mb-1">Replicas</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  [ngModel]="overrides.replicas"
                  (ngModelChange)="onOverrideChange('replicas', $event)"
                  [placeholder]="(detail?.replicas ?? 1).toString()"
                  [class]="inputClass(overrides.replicas && !replicasValid())"
                />
                @if (overrides.replicas && !replicasValid()) {
                  <p class="mt-1 text-[11px] text-destructive">Must be between 1 and 20</p>
                }
              </div>
            </div>

            @if (state.catalogResourcesCustomized()) {
              <button
                type="button"
                (click)="resetToManifest()"
                class="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset to manifest defaults
              </button>
            }
          </div>
        }
      </div>

      @if (av && !canDeploy) {
        <label
          class="flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer"
        >
          <input
            type="checkbox"
            [checked]="state.forceInstallDespiteCapacity()"
            (change)="onForceToggle($event)"
            class="mt-0.5"
          />
          <span class="text-xs text-amber-800 dark:text-amber-200">
            <strong>Install anyway</strong> — I understand the cluster is short on capacity and the app may be OOM-killed or throttled at runtime.
          </span>
        </label>
      }
    </div>
  `,
})
export class CatalogResourcesReviewComponent implements OnDestroy {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly advancedOpen = signal<boolean>(false);

  private recheckTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly cpuReqValid = computed(() =>
    isValidCpuString(this.state.catalogResourceOverrides().cpuRequest),
  );
  protected readonly cpuLimitValid = computed(() =>
    isValidCpuString(this.state.catalogResourceOverrides().cpuLimit),
  );
  protected readonly memReqValid = computed(() =>
    isValidMemoryString(this.state.catalogResourceOverrides().memoryRequest),
  );
  protected readonly memLimitValid = computed(() =>
    isValidMemoryString(this.state.catalogResourceOverrides().memoryLimit),
  );
  protected readonly replicasValid = computed(() => {
    const v = this.state.catalogResourceOverrides().replicas;
    if (!v) return true;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 1 && n <= 20;
  });

  protected readonly effectiveCpuRequest = computed(
    () =>
      this.state.catalogResourceOverrides().cpuRequest ||
      this.state.catalogDetail()?.resources?.requests?.cpu ||
      '—',
  );
  protected readonly effectiveMemoryRequest = computed(
    () =>
      this.state.catalogResourceOverrides().memoryRequest ||
      this.state.catalogDetail()?.resources?.requests?.memory ||
      '—',
  );
  protected readonly effectiveCpuLimit = computed(
    () =>
      this.state.catalogResourceOverrides().cpuLimit ||
      this.state.catalogDetail()?.resources?.limits?.cpu ||
      '—',
  );
  protected readonly effectiveMemoryLimit = computed(
    () =>
      this.state.catalogResourceOverrides().memoryLimit ||
      this.state.catalogDetail()?.resources?.limits?.memory ||
      '—',
  );

  ngOnDestroy(): void {
    if (this.recheckTimer) clearTimeout(this.recheckTimer);
  }

  toggleAdvanced(): void {
    this.advancedOpen.update((v) => !v);
  }

  onOverrideChange(field: keyof ReturnType<DeployWizardStateService['catalogResourceOverrides']>, value: string): void {
    this.state.catalogResourceOverrides.update((o) => ({ ...o, [field]: (value ?? '').toString() }));
    this.scheduleRecheck();
  }

  resetToManifest(): void {
    this.state.catalogResourceOverrides.set({
      cpuRequest: '',
      cpuLimit: '',
      memoryRequest: '',
      memoryLimit: '',
      replicas: '',
    });
    this.scheduleRecheck();
  }

  onForceToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.state.forceInstallDespiteCapacity.set(checked);
  }

  inputClass(hasError: boolean | string): string {
    const base =
      'h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2';
    return hasError
      ? `${base} border-destructive focus:border-destructive focus:ring-destructive/30`
      : `${base} border-input focus:border-primary focus:ring-primary/30`;
  }

  private scheduleRecheck(): void {
    if (this.recheckTimer) clearTimeout(this.recheckTimer);
    this.recheckTimer = setTimeout(() => {
      if (!this.state.catalogOverridesValid()) return;
      const clusterId = this.state.clusterId();
      if (!clusterId) return;
      this.state.checkCatalogResourceAvailability(clusterId);
    }, 450);
  }
}
