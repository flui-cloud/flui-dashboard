import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { isValidCpuString, isValidMemoryString } from '../../../model/k8s-quantities';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus } from '../../../../ui/primitives/status';
import { FlTag } from '../../../../ui/primitives/tag';
import { CatalogCapacityCheck } from './catalog-capacity-check';

const CPU_FORMAT = 'Use 250m, 1 or 2.5.';
const MEMORY_FORMAT = 'Use 512Mi, 2Gi or 1.5Gi.';

@Component({
  selector: 'app-catalog-resources-review',
  imports: [
    FormsModule,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
    CatalogCapacityCheck,
  ],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp })],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @let detail = state.catalogDetail();
    @let av = state.catalogAvailability();
    @let overrides = state.catalogResourceOverrides();
    @let replicas = state.effectiveCatalogResources().replicas;

    <h3 class="m-0 flex items-center gap-2 text-fl-body-sm font-semibold">
      Resources
      @if (state.catalogResourcesCustomized()) {
        <fl-tag>Customized</fl-tag>
      }
    </h3>

    @if (detail?.resources) {
      <fl-key-value class="fl-kv--compact">
        <fl-kv-item key="Reserved per replica" [mono]="true"
          >{{ effectiveCpuRequest() }} CPU · {{ effectiveMemoryRequest() }}</fl-kv-item
        >
        <fl-kv-item key="Maximum per replica" [mono]="true"
          >{{ effectiveCpuLimit() }} CPU · {{ effectiveMemoryLimit() }}</fl-kv-item
        >
        <fl-kv-item key="Replicas"
          ><span class="fl-num">{{ replicas }}</span></fl-kv-item
        >
      </fl-key-value>
    }

    @if (state.catalogAvailabilityLoading()) {
      <fl-status tone="progress" label="Checking cluster capacity" />
    } @else if (state.catalogAvailabilityError(); as err) {
      <fl-alert tone="error" title="Could not check capacity">{{ err }}</fl-alert>
    } @else if (av) {
      <app-catalog-capacity-check
        [availability]="av"
        [overridesSupported]="!!detail?.resourceOverridesSupported"
      />
    }

    @if (detail?.resourceOverridesSupported) {
      <div class="flex flex-col gap-3">
        <div>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-expanded]="advancedOpen()"
            (click)="toggleAdvanced()"
          >
            <fl-icon [name]="advancedOpen() ? 'lucideChevronUp' : 'lucideChevronDown'" />
            Override resources
          </button>
        </div>

        @if (advancedOpen()) {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            The capacity check follows these values: whether it fits, which machine scaling would
            add, or that it would wait. Leave a field empty to keep the manifest value.
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [attr.aria-expanded]="overrideWhyOpen()"
              (click)="overrideWhyOpen.set(!overrideWhyOpen())"
            >
              {{ overrideWhyOpen() ? 'Hide' : 'Why' }}
            </button>
          </p>
          @if (overrideWhyOpen()) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              A request reserves room on a node. One larger than any node has free does not overload
              anything: the app waits, and the scaling group adds a node inside its spending ceiling
              or raises an alarm. A limit is what the app may really use. A memory limit far above
              the request is what can crowd a node; a limit below the app's real use gets it stopped
              (memory) or slowed down (CPU).
            </p>
          }

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <fl-field
              label="CPU request"
              for="catalog-cpu-request"
              [error]="overrides.cpuRequest && !cpuReqValid() ? cpuFormat : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="catalog-cpu-request"
                  type="text"
                  [ngModel]="overrides.cpuRequest"
                  (ngModelChange)="onOverrideChange('cpuRequest', $event)"
                  [placeholder]="detail?.resources?.requests?.cpu ?? '250m'"
                />
              </div>
            </fl-field>
            <fl-field
              label="CPU limit"
              for="catalog-cpu-limit"
              [error]="overrides.cpuLimit && !cpuLimitValid() ? cpuFormat : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="catalog-cpu-limit"
                  type="text"
                  [ngModel]="overrides.cpuLimit"
                  (ngModelChange)="onOverrideChange('cpuLimit', $event)"
                  [placeholder]="detail?.resources?.limits?.cpu ?? '500m'"
                />
              </div>
            </fl-field>
            <fl-field
              label="Memory request"
              for="catalog-memory-request"
              [error]="overrides.memoryRequest && !memReqValid() ? memoryFormat : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="catalog-memory-request"
                  type="text"
                  [ngModel]="overrides.memoryRequest"
                  (ngModelChange)="onOverrideChange('memoryRequest', $event)"
                  [placeholder]="detail?.resources?.requests?.memory ?? '512Mi'"
                />
              </div>
            </fl-field>
            <fl-field
              label="Memory limit"
              for="catalog-memory-limit"
              [error]="overrides.memoryLimit && !memLimitValid() ? memoryFormat : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="catalog-memory-limit"
                  type="text"
                  [ngModel]="overrides.memoryLimit"
                  (ngModelChange)="onOverrideChange('memoryLimit', $event)"
                  [placeholder]="detail?.resources?.limits?.memory ?? '1Gi'"
                />
              </div>
            </fl-field>
            <fl-field
              label="Replicas"
              for="catalog-replicas"
              [error]="overrides.replicas && !replicasValid() ? 'Use a number from 1 to 20.' : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="catalog-replicas"
                  type="number"
                  min="1"
                  max="20"
                  [ngModel]="overrides.replicas"
                  (ngModelChange)="onOverrideChange('replicas', $event)"
                  [placeholder]="(detail?.replicas ?? 1).toString()"
                />
              </div>
            </fl-field>
          </div>

          @if (state.catalogResourcesCustomized()) {
            <div>
              <button flButton="ghost" size="sm" type="button" (click)="resetToManifest()">
                Reset to manifest values
              </button>
            </div>
          }
        }
      </div>
    } @else {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        The manifest fixes these sizes, so they cannot be overridden here. To make room, pick a
        cluster with more capacity or free some up.
      </p>
    }

    @if (av && !av.canDeploy) {
      <div class="flex flex-col gap-1">
        <label class="fl-check">
          <input
            type="checkbox"
            [checked]="state.forceInstallDespiteCapacity()"
            (change)="onForceToggle($event)"
          />
          <span class="font-medium">Install anyway</span>
        </label>
        <p class="m-0 pl-6 text-fl-caption text-fl-ink-muted">
          If what it reserves does not fit, it waits for room. If only its limit does not, it runs
          and the node can run short of memory at peak.
        </p>
      </div>
    }
  `,
})
export class CatalogResourcesReviewComponent implements OnDestroy {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly advancedOpen = signal<boolean>(false);
  protected readonly overrideWhyOpen = signal<boolean>(false);
  protected readonly cpuFormat = CPU_FORMAT;
  protected readonly memoryFormat = MEMORY_FORMAT;

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

  onOverrideChange(
    field: keyof ReturnType<DeployWizardStateService['catalogResourceOverrides']>,
    value: string,
  ): void {
    this.state.catalogResourceOverrides.update((o) => ({
      ...o,
      [field]: (value ?? '').toString(),
    }));
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
