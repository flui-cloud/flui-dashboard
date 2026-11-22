import { Component, computed, input, model, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRocket } from '@ng-icons/lucide';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

export interface StandaloneWizardState {
  clusterId: string;
  projectId?: string | null;
  gitUrl: string;
  branch: string;
  port: number | null;
  replicas: number;
  resourceProfile: string;
  envVars: Array<{ name: string; value: string; secret: boolean }>;
  autoDeploy: boolean;
}

const PROFILE_META: Record<string, { label: string; description: string }> = {
  nano: { label: 'Nano', description: 'Static sites, lightweight proxies' },
  small: { label: 'Small', description: 'REST microservices, simple apps' },
  medium: { label: 'Medium', description: 'Node.js, PHP, CMS apps' },
  large: { label: 'Large', description: 'Java, databases, heavier workloads' },
  xlarge: { label: 'XLarge', description: 'Elasticsearch, Kafka, MongoDB' },
};

function amountOf(value: unknown, key: string): string {
  if (typeof value === 'string') return value;
  const v = (value ?? {}) as Record<string, string | undefined>;
  return v[key] ?? v['requests'] ?? v['limit'] ?? v['value'] ?? '—';
}

@Component({
  selector: 'app-standalone-build-confirm',
  imports: [FlPanel, FlField, FlKeyValue, FlKvItem, FlLoadingState, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideRocket })],
  template: `
    <fl-panel title="Create application">
      <div class="flex flex-col gap-5">
        <fl-field
          label="Application name"
          for="standalone-app-name"
          [error]="nameValid() ? null : 'Enter a name'"
        >
          <div class="fl-input fl-input--lg">
            <input
              id="standalone-app-name"
              type="text"
              placeholder="my-application"
              [value]="appName()"
              (input)="appName.set($any($event.target).value)"
            />
          </div>
        </fl-field>

        <fl-field
          label="Port"
          for="standalone-app-port"
          [hint]="portDetected() ? 'Detected from the build' : undefined"
          [error]="port() ? null : 'Enter the port the application listens on'"
        >
          <div class="fl-input fl-input--lg">
            <input
              id="standalone-app-port"
              class="fl-mono"
              type="number"
              min="1"
              max="65535"
              placeholder="3000"
              [value]="port() ?? ''"
              (input)="portInput.emit($any($event.target).value)"
            />
          </div>
        </fl-field>

        <fieldset class="fl-fieldset">
          <legend>Resource profile</legend>
          @if (loadingProfiles()) {
            <fl-loading-state [rows]="2" />
          } @else if (profiles().length > 0) {
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
              @for (profile of profiles(); track profile.name) {
                <label class="fl-radiocard">
                  <input
                    type="radio"
                    name="standalone-profile"
                    [checked]="selectedProfile() === profile.name"
                    (change)="selectedProfile.set(profile.name)"
                  />
                  <span class="fl-radiocard__text">
                    <span class="fl-radiocard__title">{{ labelOf(profile.name) }}</span>
                    <span class="fl-radiocard__desc fl-num">
                      {{ cpuOf(profile) }} CPU · {{ memoryOf(profile) }} RAM
                    </span>
                  </span>
                </label>
              }
            </div>
            @if (selectedDescription()) {
              <p class="m-0 text-fl-caption text-fl-ink-muted">{{ selectedDescription() }}</p>
            }
          }
        </fieldset>

        <section class="flex flex-col gap-3" aria-label="Deploy configuration">
          <h3 class="m-0 text-fl-body-sm font-semibold">Deploy configuration</h3>
          <fl-key-value class="fl-kv--compact">
            @if (framework()) {
              <fl-kv-item key="Runtime">{{ framework() }}</fl-kv-item>
            }
            <fl-kv-item key="Branch" [mono]="true">{{ wizard()?.branch }}</fl-kv-item>
            <fl-kv-item key="Replicas"
              ><span class="fl-num">{{ wizard()?.replicas ?? 1 }}</span></fl-kv-item
            >
            @if (wizard()?.resourceProfile) {
              <fl-kv-item key="Resources">{{ wizard()?.resourceProfile }}</fl-kv-item>
            }
            @if (envCount() > 0) {
              <fl-kv-item key="Variables"
                ><span class="fl-num">{{ envCount() }}</span></fl-kv-item
              >
            }
          </fl-key-value>
        </section>

        @if (detectedStartCommand() || startCommandExpanded()) {
          <section class="flex flex-col gap-2" aria-label="Start command">
            <div class="flex items-center justify-between gap-3">
              <div class="fl-row">
                <h3 class="m-0 text-fl-body-sm font-semibold">Start command</h3>
                <span class="text-fl-caption text-fl-ink-muted">{{ commandSource() }}</span>
              </div>
              @if (!startCommandExpanded()) {
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  (click)="startCommandExpanded.set(true)"
                >
                  Edit
                </button>
              } @else if (startCommandOverride()) {
                <button flButton="ghost" size="sm" type="button" (click)="resetCommand()">
                  Use detected command
                </button>
              }
            </div>
            @if (!startCommandExpanded()) {
              <code
                class="fl-mono block break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-2 text-fl-ink"
                >{{ detectedStartCommand() }}</code
              >
            } @else {
              <textarea
                class="fl-textarea fl-mono"
                rows="2"
                aria-label="Start command"
                [value]="startCommandOverride()"
                [placeholder]="detectedStartCommand() ?? 'java -jar app.jar'"
                (input)="startCommandOverride.set($any($event.target).value)"
              ></textarea>
              <p class="m-0 text-fl-caption text-fl-ink-muted">
                Leave empty to use the detected command.
              </p>
            }
          </section>
        }

        <div class="flex justify-end">
          <button
            flButton="primary"
            type="button"
            [disabled]="creating() || !nameValid() || !port()"
            (click)="create.emit()"
          >
            @if (creating()) {
              <fl-spinner label="Creating application" />
              Creating application…
            } @else {
              <fl-icon name="lucideRocket" />
              Create and deploy
            }
          </button>
        </div>
      </div>
    </fl-panel>
  `,
})
export class StandaloneBuildConfirm {
  readonly appName = model.required<string>();
  readonly selectedProfile = model.required<string>();
  readonly startCommandOverride = model.required<string>();
  readonly startCommandExpanded = model.required<boolean>();
  readonly port = input<number | null>(null);
  readonly portDetected = input(false);
  readonly profiles = input<readonly ResourceProfileDto[]>([]);
  readonly loadingProfiles = input(false);
  readonly framework = input<string | null>(null);
  readonly wizard = input<StandaloneWizardState | null>(null);
  readonly detectedStartCommand = input<string | null>(null);
  readonly startCommandAutoCorrected = input(false);
  readonly creating = input(false);
  readonly portInput = output<string>();
  readonly create = output<void>();

  protected readonly nameValid = computed(() => this.appName().trim().length > 0);
  protected readonly envCount = computed(() => this.wizard()?.envVars?.length ?? 0);
  protected readonly selectedDescription = computed(() => {
    const name = this.selectedProfile();
    const exists = this.profiles().some((p) => p.name === name);
    return exists ? (PROFILE_META[name]?.description ?? '') : '';
  });
  protected readonly commandSource = computed(() => {
    if (this.startCommandOverride()) return 'Custom';
    return this.startCommandAutoCorrected() ? 'Auto-corrected' : 'Detected';
  });

  protected labelOf(name: string): string {
    return PROFILE_META[name]?.label ?? name;
  }

  protected cpuOf(profile: ResourceProfileDto): string {
    return amountOf(profile.cpu, 'cpu');
  }

  protected memoryOf(profile: ResourceProfileDto): string {
    return amountOf(profile.memory, 'memory');
  }

  protected resetCommand(): void {
    this.startCommandOverride.set('');
    this.startCommandExpanded.set(false);
  }
}
