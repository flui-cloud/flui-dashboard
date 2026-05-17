import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideLoader,
  lucideTriangleAlert,
  lucideX,
  lucideGitBranch,
  lucidePackage,
  lucideTerminal,
  lucideClock,
  lucideCopy,
  lucideRefreshCw,
  lucideHammer,
  lucideContainer,
  lucideRocket,
  lucideCpu,
} from '@ng-icons/lucide';
import { BuildsService } from '../../../core/api/api/builds.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { ImagesService } from '../../../core/api/api/images.service';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { AppBuildResponseDto } from '../../../core/api/model/appBuildResponseDto';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { CreateApplicationResponseDto } from '../../../core/api/model/createApplicationResponseDto';
import {
  AppRuntimeWebSocketService,
  BuildLogEvent,
  StandaloneBuildPlanEvent,
  StandaloneBuildCompletedEvent,
  StandaloneBuildFailedEvent,
} from '../../service/app-runtime-websocket.service';

type BuildPhase = AppBuildResponseDto['status'];

const BUILD_PHASES: Array<{ id: BuildPhase; label: string; icon: string }> = [
  { id: 'CLONING',   label: 'Cloning repository',  icon: 'lucideGitBranch' },
  { id: 'ANALYZING', label: 'Detecting framework',  icon: 'lucidePackage' },
  { id: 'BUILDING',  label: 'Building image',       icon: 'lucideHammer' },
  { id: 'PUSHING',   label: 'Pushing to registry',  icon: 'lucideContainer' },
];

const PHASE_ORDER: BuildPhase[] = ['PENDING', 'CLONING', 'ANALYZING', 'BUILDING', 'PUSHING', 'COMPLETED'];

function phaseIndex(status: BuildPhase): number {
  return PHASE_ORDER.indexOf(status);
}

interface WizardState {
  clusterId: string;
  gitUrl: string;
  branch: string;
  port: number | null;
  replicas: number;
  resourceProfile: string;
  envVars: Array<{ name: string; value: string; secret: boolean }>;
  autoDeploy: boolean;
}

@Component({
  selector: 'app-standalone-build-progress',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft, lucideCheck, lucideLoader, lucideTriangleAlert,
      lucideX, lucideGitBranch, lucidePackage, lucideTerminal, lucideClock,
      lucideCopy, lucideRefreshCw, lucideHammer, lucideContainer, lucideRocket,
      lucideCpu,
    }),
  ],
  template: `
    <div class="max-w-6xl mx-auto p-6">
      <!-- Back -->
      <div class="mb-6">
        <button (click)="navigateBack()"
          class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
          Back to Deploy Wizard
        </button>
      </div>

      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h1 class="text-2xl font-bold mb-1">
              {{ phase() === 'confirm' ? 'Build Complete — Create Application' : 'Building Application' }}
            </h1>
            <p class="text-sm text-muted-foreground font-mono">{{ buildId() }}</p>
          </div>
          <div class="text-right">
            <span [class]="getStatusBadgeClass()">{{ getStatusLabel() }}</span>
            <div class="text-xs text-muted-foreground mt-1 flex items-center justify-end">
              <ng-icon name="lucideClock" class="h-3 w-3 mr-1" />
              {{ formatDuration(elapsedSeconds()) }}
            </div>
          </div>
        </div>

        <!-- Build progress bar -->
        @if (phase() === 'building') {
          <div class="flex items-center gap-3 mt-4">
            <div class="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div [style.width.%]="getBuildProgressPercent()"
                class="h-full bg-blue-500 transition-all duration-500 ease-out"></div>
            </div>
            <span class="text-xs text-muted-foreground tabular-nums w-8 text-right">
              {{ getBuildProgressPercent() }}%
            </span>
          </div>
        }
      </div>

      <!-- Connection lost banner -->
      @if (connectionLost() && phase() === 'building') {
        <div class="mb-6 flex items-center gap-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 flex-shrink-0" />
          <span>Connection lost — the build is still running. Reconnecting...</span>
          <ng-icon name="lucideLoader" class="h-4 w-4 flex-shrink-0 animate-spin ml-auto" />
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: phases + logs -->
        <div class="lg:col-span-2 space-y-6">

          <!-- Build Phase Timeline -->
          <div class="bg-card border border-border rounded-lg p-6">
            <h2 class="text-lg font-semibold mb-4 flex items-center">
              <ng-icon name="lucideHammer" class="h-5 w-5 mr-2" />
              Build Pipeline
            </h2>
            <div class="space-y-4">
              @for (ph of buildPhases; track ph.id) {
                <div class="flex items-start gap-4">
                  <div [class]="getPhaseIconClass(ph.id)" class="flex-shrink-0 mt-0.5">
                    @if (getPhaseStatus(ph.id) === 'completed') {
                      <ng-icon name="lucideCheck" class="h-4 w-4" />
                    } @else if (getPhaseStatus(ph.id) === 'running') {
                      <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    } @else if (getPhaseStatus(ph.id) === 'error') {
                      <ng-icon name="lucideX" class="h-4 w-4" />
                    } @else {
                      <div class="w-2.5 h-2.5 rounded-full bg-current"></div>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span [class]="getPhaseLabelClass(ph.id)" class="text-sm font-medium">
                        {{ ph.label }}
                      </span>
                      @if (ph.id === 'ANALYZING' && detectedFramework()) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          <ng-icon name="lucidePackage" class="h-3 w-3 mr-1" />
                          {{ detectedFramework() }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
              }

              <!-- Confirm phase indicator -->
              @if (phase() === 'confirm') {
                <div class="flex items-start gap-4">
                  <div class="h-6 w-6 rounded-full flex items-center justify-center bg-green-500 text-white flex-shrink-0 mt-0.5">
                    <ng-icon name="lucideCheck" class="h-4 w-4" />
                  </div>
                  <div class="flex-1">
                    <span class="text-sm font-medium text-foreground">Image ready</span>
                    @if (imageRef()) {
                      <p class="text-xs text-muted-foreground font-mono mt-0.5 truncate">{{ imageRef() }}</p>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Live Logs (hidden in confirm phase) -->
          @if (phase() === 'building' || phase() === 'failed') {
            <div class="bg-card border border-border rounded-lg">
              <div class="p-4 border-b border-border flex items-center justify-between">
                <h2 class="text-lg font-semibold flex items-center">
                  <ng-icon name="lucideTerminal" class="h-5 w-5 mr-2" />
                  Build Logs
                </h2>
                <button (click)="copyLogs()"
                  class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ng-icon name="lucideCopy" class="h-4 w-4 mr-1" />
                  Copy
                </button>
              </div>
              <div class="p-4 bg-gray-900 dark:bg-black rounded-b-lg">
                <div #logContainer
                  class="font-mono text-xs text-green-400 space-y-0.5 h-80 overflow-y-auto">
                  @for (log of buildLogs(); track $index) {
                    <div [class]="log.startsWith('[stderr]') ? 'text-yellow-400' : ''"
                      class="whitespace-pre-wrap leading-relaxed">{{ log }}</div>
                  }
                  @if (phase() === 'building' && buildLogs().length === 0) {
                    <div class="flex items-center gap-1.5 text-gray-500 text-xs">
                      <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                      Waiting for build output...
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Confirm: Name + summary -->
          @if (phase() === 'confirm') {
            <div class="bg-card border border-border rounded-lg p-6 space-y-5">
              <h2 class="text-lg font-semibold flex items-center">
                <ng-icon name="lucideRocket" class="h-5 w-5 mr-2" />
                Create your application
              </h2>

              <div>
                <label class="block text-sm font-medium mb-1.5">Application name</label>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    [value]="appName()"
                    (input)="appName.set($any($event.target).value)"
                    class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="my-application"
                  />
                </div>
                @if (!isNameValid()) {
                  <p class="text-xs text-destructive mt-1">Name is required</p>
                }
              </div>

              <!-- Port: always show, editable, required -->
              <div>
                <label class="block text-sm font-medium mb-1.5">
                  Port
                  @if (detectedPort()) {
                    <span class="ml-1.5 text-xs font-normal text-green-600 dark:text-green-400">auto-detected</span>
                  } @else {
                    <span class="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">not detected — required</span>
                  }
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  [value]="effectivePort() ?? ''"
                  (input)="onPortInput($any($event.target).value)"
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. 3000"
                />
                @if (!effectivePort()) {
                  <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Port is required to expose the application.
                  </p>
                }
              </div>

              <!-- Resource Profile -->
              <div>
                <label class="block text-sm font-medium mb-1.5">Resource Profile</label>
                @if (loadingProfiles()) {
                  <div class="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    Loading profiles...
                  </div>
                } @else if (availableProfiles().length > 0) {
                  <div class="grid grid-cols-5 gap-2">
                    @for (profile of availableProfiles(); track profile.name) {
                      <button type="button"
                        [class]="getProfileCardClass(profile.name)"
                        (click)="selectedProfile.set(profile.name)">
                        <div class="text-xs font-semibold mb-1.5">{{ getProfileLabel(profile.name) }}</div>
                        <div class="flex items-center gap-1 text-xs text-muted-foreground">
                          <ng-icon name="lucideCpu" class="w-3 h-3 shrink-0" />
                          <span>{{ getProfileCpu(profile) }} CPU</span>
                        </div>
                        <div class="text-xs text-muted-foreground mt-0.5">
                          {{ getProfileMemory(profile) }} <span class="text-muted-foreground/60">RAM</span>
                        </div>
                      </button>
                    }
                  </div>
                  @if (selectedProfileInfo()) {
                    <p class="text-xs text-muted-foreground mt-1.5 pl-0.5">{{ getProfileDescription(selectedProfile()) }}</p>
                  }
                }
              </div>

              <div class="rounded-lg bg-muted/40 border border-border p-4 space-y-2 text-sm">
                <h3 class="font-medium mb-2 text-xs text-muted-foreground uppercase tracking-wide">Deploy config</h3>
                @if (detectedFramework()) {
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Runtime</span>
                    <span class="font-medium">{{ detectedFramework() }}</span>
                  </div>
                }
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Branch</span>
                  <span class="font-medium font-mono">{{ wizardState()?.branch }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Replicas</span>
                  <span class="font-medium">{{ wizardState()?.replicas ?? 1 }}</span>
                </div>
                @if (wizardState()?.resourceProfile) {
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Resources</span>
                    <span class="font-medium">{{ wizardState()?.resourceProfile }}</span>
                  </div>
                }
                @if ((wizardState()?.envVars?.length ?? 0) > 0) {
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Env vars</span>
                    <span class="font-medium">{{ wizardState()?.envVars?.length }}</span>
                  </div>
                }
              </div>

              <!-- Start command -->
              @if (detectedStartCommand() || startCommandOverrideExpanded()) {
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">Start command</span>
                      @if (!startCommandOverride()) {
                        <span class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {{ startCommandIsAutoCorrected() ? 'Auto-corrected' : 'Auto' }}
                        </span>
                      } @else {
                        <span class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Custom</span>
                      }
                    </div>
                    @if (!startCommandOverrideExpanded()) {
                      <button type="button" (click)="startCommandOverrideExpanded.set(true)"
                        class="text-xs text-muted-foreground hover:text-foreground transition-colors">Edit</button>
                    } @else if (startCommandOverride()) {
                      <button type="button" (click)="startCommandOverride.set(''); startCommandOverrideExpanded.set(false)"
                        class="text-xs text-muted-foreground hover:text-foreground transition-colors">Reset to auto</button>
                    }
                  </div>
                  @if (!startCommandOverrideExpanded()) {
                    <code class="block text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">{{ detectedStartCommand() }}</code>
                  } @else {
                    <textarea
                      [value]="startCommandOverride()"
                      (input)="startCommandOverride.set($any($event.target).value)"
                      rows="2"
                      [placeholder]="detectedStartCommand() ?? 'e.g. java -jar app.jar'"
                      class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
                    ></textarea>
                    <p class="text-xs text-muted-foreground">Leave empty to use the auto-detected command.</p>
                  }
                </div>
              }

              <button (click)="createAndDeploy()" [disabled]="isCreating() || !isNameValid() || !effectivePort()"
                class="inline-flex items-center justify-center w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                @if (isCreating()) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                  Creating application...
                } @else {
                  <ng-icon name="lucideRocket" class="h-4 w-4 mr-2" />
                  Create &amp; Deploy
                }
              </button>
            </div>
          }

        </div>

        <!-- Right Sidebar -->
        <div class="space-y-4">

          <!-- Failed -->
          @if (phase() === 'failed') {
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <div class="flex items-center mb-4">
                <div class="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center mr-3">
                  <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 class="font-semibold text-red-900 dark:text-red-100">Build Failed</h3>
                  <p class="text-xs text-red-700 dark:text-red-300">No application was created</p>
                </div>
              </div>
              @if (errorMessage()) {
                <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-800 dark:text-red-200 font-mono break-all">
                  {{ errorMessage() }}
                </div>
              }
              <button (click)="retryFromWizard()" [disabled]="isDeleting()"
                class="inline-flex items-center justify-center w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                @if (isDeleting()) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                } @else {
                  <ng-icon name="lucideRefreshCw" class="h-4 w-4 mr-2" />
                }
                Try again
              </button>
            </div>
          }

          <!-- In-progress -->
          @if (phase() === 'building') {
            <div class="bg-muted/40 border border-border rounded-lg p-4">
              <div class="flex items-start gap-3">
                <ng-icon name="lucideLoader" class="h-4 w-4 text-muted-foreground mt-0.5 animate-spin flex-shrink-0" />
                <div>
                  <h4 class="text-sm font-medium mb-1">Building...</h4>
                  <p class="text-xs text-muted-foreground">This may take a few minutes.</p>
                  <p class="text-xs text-muted-foreground mt-1">Your application will only be created once the build succeeds.</p>
                </div>
              </div>
            </div>
          }

          <!-- Build Info -->
          <div class="bg-card border border-border rounded-lg p-4">
            <h3 class="font-medium mb-3 text-sm">Build Info</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Build ID:</span>
                <code class="text-xs bg-muted px-2 py-0.5 rounded">{{ buildId().substring(0, 12) }}...</code>
              </div>
              @if (detectedFramework()) {
                <div class="flex justify-between items-center">
                  <span class="text-muted-foreground">Runtime:</span>
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    {{ detectedFramework() }}
                  </span>
                </div>
              }
              <div class="flex justify-between">
                <span class="text-muted-foreground">Status:</span>
                <span class="font-medium text-xs">{{ buildStatus() }}</span>
              </div>
              @if (detectedStartCommand()) {
                <div class="pt-1 border-t border-border mt-1">
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="text-muted-foreground text-xs">Start command</span>
                    @if (startCommandIsAutoCorrected()) {
                      <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Auto-corrected</span>
                    } @else {
                      <span class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Auto</span>
                    }
                  </div>
                  <code class="block text-xs bg-muted px-2 py-1 rounded font-mono break-all leading-relaxed">{{ detectedStartCommand() }}</code>
                </div>
              }
              <div class="flex justify-between">
                <span class="text-muted-foreground">Elapsed:</span>
                <span class="font-medium text-xs tabular-nums">{{ formatDuration(elapsedSeconds()) }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class StandaloneBuildProgressComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logContainer') private readonly logContainer?: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly buildsApi = inject(BuildsService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly imagesApi = inject(ImagesService);
  private readonly wsService = inject(AppRuntimeWebSocketService);

  buildId = signal('');
  buildStatus = signal<BuildPhase>('PENDING');
  buildLogs = signal<string[]>([]);
  detectedFramework = signal<string | null>(null);
  buildCommand = signal<string | null>(null);
  startCommand = signal<string | null>(null);
  detectedStartCommand = signal<string | null>(null);

  readonly startCommandIsAutoCorrected = computed(() => {
    const raw = this.startCommand();
    const detected = this.detectedStartCommand();
    return !!raw && !!detected && raw !== detected;
  });
  imageRef = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  phase = signal<'building' | 'confirm' | 'failed'>('building');
  appName = signal('');
  detectedPort = signal<number | null>(null);
  selectedProfile = signal<string>('small');
  availableProfiles = signal<ResourceProfileDto[]>([]);
  loadingProfiles = signal(false);
  elapsedSeconds = signal(0);
  isCreating = signal(false);
  startCommandOverride = signal<string>('');
  startCommandOverrideExpanded = signal(false);
  isDeleting = signal(false);
  connectionLost = signal(false);
  wizardState = signal<WizardState | null>(null);

  readonly buildPhases = BUILD_PHASES;
  readonly isNameValid = computed(() => this.appName().trim().length > 0);
  readonly effectivePort = computed(() => this.detectedPort() ?? this.wizardState()?.port ?? null);
  readonly selectedProfileInfo = computed(() =>
    this.availableProfiles().find(p => p.name === this.selectedProfile()) ?? null
  );

  private readonly profileMeta: Record<string, { label: string; description: string }> = {
    nano:   { label: 'Nano',   description: 'Static sites, lightweight proxies' },
    small:  { label: 'Small',  description: 'REST microservices, simple apps' },
    medium: { label: 'Medium', description: 'Node.js, PHP, CMS apps' },
    large:  { label: 'Large',  description: 'Java, databases, heavier workloads' },
    xlarge: { label: 'XLarge', description: 'Elasticsearch, Kafka, MongoDB' },
  };

  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private elapsedIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private shouldScrollLogs = false;

  private readonly HEARTBEAT_TIMEOUT_MS = 60_000;

  ngOnInit(): void {
    void (async () => {
      const bId = this.route.snapshot.paramMap.get('buildId') ?? '';
      if (!bId) {
        this.router.navigate(['/apps/deploy/new']);
        return;
      }
  
      const state = (this.router.getCurrentNavigation()?.extras?.state ?? history.state) as WizardState | undefined;
      if (state?.clusterId) {
        this.wizardState.set(state);
      }
  
      this.buildId.set(bId);
      await Promise.all([this.loadInitialState(bId), this.loadProfiles()]);
    })();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopElapsedTimer();
    this.stopHeartbeatWatchdog();
    this.wsService.unsubscribeFromStandaloneBuild(this.buildId());
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollLogs) {
      this.scrollLogsToBottom();
      this.shouldScrollLogs = false;
    }
  }

  private async loadInitialState(bId: string): Promise<void> {
    try {
      const build = await firstValueFrom(this.buildsApi.standaloneBuildsControllerGetBuild(bId));
      this.buildStatus.set(build.status);
      if (build.logs?.length) {
        this.buildLogs.set(build.logs);
        this.shouldScrollLogs = true;
      }
      if (build.detectedFramework && build.detectedFramework !== 'unknown') {
        this.detectedFramework.set(build.detectedFramework);
      }
      if (build.detectedPort) this.detectedPort.set(build.detectedPort);
      if (build.suggestedName && !this.appName()) {
        this.appName.set(build.suggestedName);
      }
      if (build.imageRef) this.imageRef.set(build.imageRef);
      if (build.detectedStartCommand) this.detectedStartCommand.set(build.detectedStartCommand);

      if (build.status === 'COMPLETED') {
        this.phase.set('confirm');
        return;
      }
      if (build.status === 'FAILED' || build.status === 'CANCELLED') {
        this.phase.set('failed');
        this.errorMessage.set(build.errorMessage ?? 'Build failed');
        return;
      }
    } catch {
      // proceed — WS will deliver state
    }

    this.startElapsedTimer();
    this.subscribeWebSocket(bId);
    this.startPolling(bId);
  }

  private subscribeWebSocket(bId: string): void {
    this.resetHeartbeatWatchdog();

    this.wsService.subscribeToStandaloneBuild(bId, {
      onLog: (e: BuildLogEvent) => {
        this.resetHeartbeatWatchdog();
        const prefix = e.stream === 'stderr' ? '[stderr] ' : '';
        this.buildLogs.update(logs => [...logs, prefix + e.line].slice(-500));
        this.shouldScrollLogs = true;
        this.inferPhaseFromLog(e.line);
      },
      onPlan: (e: StandaloneBuildPlanEvent) => {
        this.resetHeartbeatWatchdog();
        if (e.framework && e.framework !== 'unknown') this.detectedFramework.set(e.framework);
        if (e.port) this.detectedPort.set(e.port);
        if (e.suggestedName && !this.appName()) this.appName.set(e.suggestedName);
        if (e.buildCommand) this.buildCommand.set(e.buildCommand);
        if (e.startCommand) this.startCommand.set(e.startCommand);
        if (e.detectedStartCommand) this.detectedStartCommand.set(e.detectedStartCommand);
      },
      onCompleted: (e: StandaloneBuildCompletedEvent) => {
        this.buildStatus.set('COMPLETED');
        this.imageRef.set(e.imageRef);
        if (e.suggestedName && !this.appName()) this.appName.set(e.suggestedName);
        this.phase.set('confirm');
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      },
      onFailed: (e: StandaloneBuildFailedEvent) => {
        this.buildStatus.set('FAILED');
        this.phase.set('failed');
        this.errorMessage.set(e.error);
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      },
      onHeartbeat: () => this.resetHeartbeatWatchdog(),
      onReconnect: () => this.syncBuildState(),
    });
  }

  private inferPhaseFromLog(line: string): void {
    const current = this.buildStatus();
    if (current === 'COMPLETED' || current === 'FAILED' || current === 'CANCELLED') return;
    const l = line.toLowerCase();
    if (current === 'PENDING' || current === 'CLONING') {
      if (l.includes('railpack') || l.includes('detected ') || l.includes('deploying as')) {
        this.buildStatus.set('ANALYZING');
      }
    }
    if (current === 'PENDING' || current === 'CLONING' || current === 'ANALYZING') {
      if (l.includes('railpack build') || l.includes('buildctl') || l.includes('#1 ') || l.includes('load build definition')) {
        this.buildStatus.set('BUILDING');
      }
    }
    if (current === 'BUILDING') {
      if (l.includes('pushing') || l.includes('exporting') || l.includes('writing image')) {
        this.buildStatus.set('PUSHING');
      }
    }
  }

  private startPolling(bId: string): void {
    this.pollingIntervalId = setInterval(async () => {
      try {
        const build = await firstValueFrom(this.buildsApi.standaloneBuildsControllerGetBuild(bId));
        this.buildStatus.set(build.status);

        if (build.logs?.length && build.logs.length > this.buildLogs().length) {
          this.buildLogs.set(build.logs);
          this.shouldScrollLogs = true;
        }
        if (build.detectedFramework && build.detectedFramework !== 'unknown' && !this.detectedFramework()) {
          this.detectedFramework.set(build.detectedFramework);
        }
        if (build.detectedPort && !this.detectedPort()) this.detectedPort.set(build.detectedPort);
        if (build.suggestedName && !this.appName()) this.appName.set(build.suggestedName);
        if (build.imageRef && !this.imageRef()) this.imageRef.set(build.imageRef);
        if (build.detectedStartCommand && !this.detectedStartCommand()) this.detectedStartCommand.set(build.detectedStartCommand);

        const currentPhase = this.phase();
        if (currentPhase === 'confirm' || currentPhase === 'failed') {
          this.stopPolling();
          return;
        }
        if (build.status === 'COMPLETED') {
          this.phase.set('confirm');
          this.stopPolling();
          this.stopElapsedTimer();
        } else if (build.status === 'FAILED' || build.status === 'CANCELLED') {
          this.phase.set('failed');
          this.errorMessage.set(build.errorMessage ?? 'Build failed');
          this.stopPolling();
          this.stopElapsedTimer();
        }
      } catch { /* ignore */ }
    }, 5000);
  }

  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  private resetHeartbeatWatchdog(): void {
    if (this.heartbeatTimeoutId) clearTimeout(this.heartbeatTimeoutId);
    this.connectionLost.set(false);
    this.heartbeatTimeoutId = setTimeout(() => {
      this.connectionLost.set(true);
    }, this.HEARTBEAT_TIMEOUT_MS);
  }

  private stopHeartbeatWatchdog(): void {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  private async syncBuildState(): Promise<void> {
    try {
      const build = await firstValueFrom(this.buildsApi.standaloneBuildsControllerGetBuild(this.buildId()));
      this.buildStatus.set(build.status);
      this.connectionLost.set(false);
      if (build.detectedFramework && build.detectedFramework !== 'unknown' && !this.detectedFramework()) {
        this.detectedFramework.set(build.detectedFramework);
      }
      if (build.detectedPort && !this.detectedPort()) this.detectedPort.set(build.detectedPort);
      if (build.suggestedName && !this.appName()) this.appName.set(build.suggestedName);
      if (build.imageRef && !this.imageRef()) this.imageRef.set(build.imageRef);
      const currentPhase = this.phase();
      if (currentPhase === 'confirm' || currentPhase === 'failed') return;
      if (build.status === 'COMPLETED') {
        this.phase.set('confirm');
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      } else if (build.status === 'FAILED' || build.status === 'CANCELLED') {
        this.phase.set('failed');
        this.errorMessage.set(build.errorMessage ?? 'Build failed');
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      }
    } catch { /* ignore */ }
  }

  private startElapsedTimer(): void {
    this.elapsedIntervalId = setInterval(() => {
      this.elapsedSeconds.update(s => s + 1);
    }, 1000);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedIntervalId) {
      clearInterval(this.elapsedIntervalId);
      this.elapsedIntervalId = null;
    }
  }

  private scrollLogsToBottom(): void {
    if (this.logContainer) {
      const el = this.logContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  async createAndDeploy(): Promise<void> {
    if (!this.isNameValid() || this.isCreating()) return;
    const state = this.wizardState();
    if (!state) return;

    this.isCreating.set(true);
    try {
      const response: CreateApplicationResponseDto = await firstValueFrom(
        this.applicationsApi.applicationsControllerCreate(state.clusterId, {
          name: this.appName().trim(),
          buildId: this.buildId(),
          category: CreateApplicationDto.CategoryEnum.User,
          sourceType: CreateApplicationDto.SourceTypeEnum.GitBuild,
          sourceConfig: {},   // backend ignores this when buildId is provided
          autoDeploy: true,
          port: this.effectivePort() ?? undefined,
          replicas: state.replicas,
          resourceProfile: this.selectedProfile() as CreateApplicationDto.ResourceProfileEnum,
          env: state.envVars,
          ...(this.startCommandOverride().trim() ? { startCommand: this.startCommandOverride().trim() } : {}),
        } as any)
      );

      if (response.operation?.id) {
        this.router.navigate(['/apps/deploy', response.operation.id], {
          queryParams: { appId: response.application.id },
        });
      } else {
        this.router.navigate(['/apps/applications', response.application.id]);
      }
    } catch (err) {
      console.error('[StandaloneBuild] createAndDeploy failed', err);
    } finally {
      this.isCreating.set(false);
    }
  }

  async retryFromWizard(): Promise<void> {
    const state = this.wizardState();
    if (!state?.gitUrl) {
      this.router.navigate(['/apps/deploy/new']);
      return;
    }

    this.isDeleting.set(true);

    // Teardown current build
    const oldBuildId = this.buildId();
    this.stopPolling();
    this.stopElapsedTimer();
    this.stopHeartbeatWatchdog();
    this.wsService.unsubscribeFromStandaloneBuild(oldBuildId);
    try {
      await firstValueFrom(this.buildsApi.standaloneBuildsControllerDeleteStandaloneBuild(oldBuildId));
    } catch { /* ignore — build may already be deleted */ }

    // Trigger new build
    let buildResp;
    try {
      buildResp = await firstValueFrom(
        this.buildsApi.standaloneBuildsControllerTriggerStandaloneBuild({
          gitUrl: state.gitUrl,
          branch: state.branch,
          targetClusterId: state.clusterId,
        })
      );
    } catch {
      this.isDeleting.set(false);
      return;
    }

    // Reset all signals in-place
    this.buildId.set(buildResp.id);
    this.buildStatus.set('PENDING');
    this.buildLogs.set([]);
    this.detectedFramework.set(null);
    this.buildCommand.set(null);
    this.startCommand.set(null);
    this.imageRef.set(null);
    this.errorMessage.set(null);
    this.phase.set('building');
    this.appName.set('');
    this.detectedPort.set(null);
    this.elapsedSeconds.set(0);
    this.isDeleting.set(false);
    this.connectionLost.set(false);

    // Update URL to reflect new buildId without a full navigation
    this.location.replaceState(`/apps/deploy/standalone/${buildResp.id}`);

    // Boot the new build (WebSocket + polling + elapsed timer)
    await this.loadInitialState(buildResp.id);
  }

  private async loadProfiles(): Promise<void> {
    this.loadingProfiles.set(true);
    try {
      const res = await firstValueFrom(this.imagesApi.imagesControllerGetProfiles());
      this.availableProfiles.set(res.profiles);
      this.selectedProfile.set(res.defaultProfile);
    } catch {
      // silent — 'small' default applies
    } finally {
      this.loadingProfiles.set(false);
    }
  }

  getProfileLabel(name: string): string {
    return this.profileMeta[name]?.label ?? name;
  }

  getProfileDescription(name: string): string {
    return this.profileMeta[name]?.description ?? '';
  }

  getProfileCpu(profile: ResourceProfileDto): string {
    const v = profile.cpu as any;
    if (typeof v === 'string') return v;
    return v?.cpu ?? v?.requests ?? v?.limit ?? v?.value ?? '—';
  }

  getProfileMemory(profile: ResourceProfileDto): string {
    const v = profile.memory as any;
    if (typeof v === 'string') return v;
    return v?.memory ?? v?.requests ?? v?.limit ?? v?.value ?? '—';
  }

  getProfileCardClass(profileName: string): string {
    const base = 'flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer text-sm';
    return this.selectedProfile() === profileName
      ? `${base} border-primary bg-primary/5 ring-1 ring-primary`
      : `${base} border-border hover:border-primary/50 hover:bg-muted/40`;
  }

  onPortInput(value: string): void {
    const n = Number.parseInt(value, 10);
    this.detectedPort.set(n > 0 && n <= 65535 ? n : null);
  }

  navigateBack(): void {
    this.router.navigate(['/apps/deploy/new']);
  }

  copyLogs(): void {
    navigator.clipboard.writeText(this.buildLogs().join('\n'));
  }

  // ── Phase helpers ───────────────────────────────────────────────

  getPhaseStatus(phaseId: BuildPhase): 'pending' | 'running' | 'completed' | 'error' {
    const status = this.buildStatus();
    if (status === 'FAILED' && phaseIndex(phaseId) < phaseIndex('COMPLETED')) {
      return phaseIndex(phaseId) < phaseIndex(status) ? 'completed' : 'error';
    }
    if (phaseIndex(status) > phaseIndex(phaseId)) return 'completed';
    if (status === phaseId) return 'running';
    return 'pending';
  }

  getPhaseIconClass(phaseId: BuildPhase): string {
    const s = this.getPhaseStatus(phaseId);
    const base = 'h-6 w-6 rounded-full flex items-center justify-center text-sm';
    switch (s) {
      case 'completed': return `${base} bg-green-500 text-white`;
      case 'running':   return `${base} bg-primary text-primary-foreground`;
      case 'error':     return `${base} bg-destructive text-destructive-foreground`;
      default:          return `${base} bg-muted text-muted-foreground`;
    }
  }

  getPhaseLabelClass(phaseId: BuildPhase): string {
    const s = this.getPhaseStatus(phaseId);
    switch (s) {
      case 'completed': return 'text-foreground';
      case 'running':   return 'text-primary';
      case 'error':     return 'text-destructive';
      default:          return 'text-muted-foreground';
    }
  }

  getBuildProgressPercent(): number {
    const order = phaseIndex(this.buildStatus());
    const total = PHASE_ORDER.length - 1;
    return Math.round((order / total) * 100);
  }

  getStatusLabel(): string {
    switch (this.phase()) {
      case 'building': return this.buildStatus();
      case 'confirm':  return 'BUILD COMPLETE';
      case 'failed':   return 'FAILED';
    }
  }

  getStatusBadgeClass(): string {
    switch (this.phase()) {
      case 'confirm':  return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed':   return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:         return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
}
