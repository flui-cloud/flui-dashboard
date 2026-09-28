import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideCircleCheck,
  lucideDownload,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { PlatformUpdateService } from '../../service/platform-update.service';
import { PlatformUpdateProgressComponent } from './platform-update-progress.component';
import { PlatformUpdateHistoryComponent } from './platform-update-history.component';
import { PlatformUpdateDetailsComponent } from './platform-update-details.component';
import { PlatformUpgradeConfirmComponent } from './platform-upgrade-confirm.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  PlatformUpdatesSurfaceInput,
  PlatformUpdatesSurfaceRevision,
  buildPlatformUpdatesSurface,
  presentedContent,
} from './platform-updates-surface';

@Component({
  selector: 'app-platform-updates',
  standalone: true,
  imports: [
    DatePipe,
    NgIcon,
    PlatformUpdateProgressComponent,
    PlatformUpdateHistoryComponent,
    PlatformUpdateDetailsComponent,
    PlatformUpgradeConfirmComponent,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideCircleCheck,
      lucideDownload,
      lucideRefreshCw,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Updates</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            The Flui release running on this installation — API, dashboard and
            authorization service.
          </p>
        </div>
        <div class="flex items-center gap-3">
          @if (updates.status(); as status) {
            <span class="text-xs text-muted-foreground"
              >Checked {{ checkedAgo(status.checkedAt) }}</span
            >
          }
          <button
            type="button"
            (click)="check()"
            [disabled]="updates.checking()"
            class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5"
              [class.animate-spin]="updates.checking()"
            />
            Check now
          </button>
        </div>
      </div>

      @if (updates.operation(); as operation) {
        <app-platform-update-progress [operation]="operation" />
      } @else if (stopped(); as operation) {
        <app-platform-update-progress [operation]="operation" />
        <div class="flex justify-end">
          <button
            type="button"
            (click)="resume(operation.id)"
            [disabled]="updates.starting()"
            class="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Resume the update
          </button>
        </div>
      }

      @if (updates.status(); as status) {
        @if (!updates.running()) {
          <div
            class="card-surface"
            [class.border-primary]="status.updateAvailable"
          >
            <div class="flex flex-wrap items-start justify-between gap-5 p-5">
              <div class="space-y-1.5">
                @if (updates.checkFailed()) {
                  <span class="badge badge-in-progress">Not checked</span>
                  <h2 class="text-lg font-semibold">
                    Could not check for updates
                  </h2>
                  <p class="text-sm text-muted-foreground">
                    This installation runs Flui
                    <span class="font-mono">{{ status.installedVersion }}</span
                    >.
                  </p>
                } @else if (status.updateAvailable) {
                  <span class="badge bg-primary/10 text-primary"
                    >Update available</span
                  >
                  @if (status.requiredCliVersion) {
                    <span
                      class="badge badge-in-progress ml-1.5"
                      title="The CLI on this release is the one that can re-run the bootstrap. Nothing here is gated on it."
                    >
                      CLI {{ status.requiredCliVersion }}
                    </span>
                  }
                  <h2 class="text-lg font-semibold">
                    Flui {{ status.availableVersion }}
                  </h2>
                  <p class="text-sm text-muted-foreground">
                    You are on
                    <span class="font-mono">{{ status.installedVersion }}</span>
                    @if (status.publishedAt) {
                      · released {{ status.publishedAt | date: 'd MMM y' }}
                    }
                  </p>
                } @else {
                  <span class="badge badge-success">Up to date</span>
                  <h2 class="text-lg font-semibold">
                    You are on the latest release
                  </h2>
                  <p class="text-sm text-muted-foreground">
                    Flui
                    <span class="font-mono">{{ status.installedVersion }}</span>
                  </p>
                }
              </div>
              @if (status.updateAvailable && !updates.checkFailed()) {
                @if (status.applicable) {
                  <button
                    type="button"
                    (click)="openConfirm()"
                    class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    <ng-icon name="lucideDownload" class="h-4 w-4" />
                    Update now
                  </button>
                } @else {
                  <div class="text-right">
                    <span class="badge badge-in-progress">Needs the CLI</span>
                    <button
                      type="button"
                      (click)="detailsOpen.set(true)"
                      class="block mt-1 text-xs text-primary hover:underline"
                    >
                      Why?
                    </button>
                  </div>
                }
              }
            </div>

            @if (status.notes.length > 0 && status.updateAvailable) {
              <ul class="space-y-1.5 border-t border-border px-5 py-4">
                @for (note of status.notes; track note) {
                  <li class="flex gap-2.5 text-sm text-foreground/90">
                    <span
                      class="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40"
                    ></span>
                    <span>{{ note }}</span>
                  </li>
                }
              </ul>
            }

            <button
              type="button"
              (click)="detailsOpen.set(!detailsOpen())"
              class="flex w-full items-center gap-1.5 border-t border-border px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ng-icon
                name="lucideChevronDown"
                class="h-3.5 w-3.5 transition-transform"
                [class.rotate-180]="detailsOpen()"
              />
              {{ detailsOpen() ? 'Hide details' : 'Details' }}
            </button>

            @if (detailsOpen()) {
              <app-platform-update-details [status]="status" />
            }
          </div>
        }
      } @else if (updates.loading()) {
        <div class="card-surface p-5">
          <div class="skeleton h-24 w-full"></div>
        </div>
      }

      <app-platform-update-history [operations]="updates.history()" />
    </div>

    @if (confirming()) {
      <app-platform-upgrade-confirm
        [(acknowledged)]="acknowledged"
        (closed)="closeConfirm()"
      />
    }
  `,
})
export class PlatformUpdatesComponent implements OnInit, OnDestroy {
  protected readonly updates = inject(PlatformUpdateService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly confirming = signal(false);
  protected readonly acknowledged = signal(false);
  protected readonly detailsOpen = signal(false);

  private readonly surfaceRevision = new PlatformUpdatesSurfaceRevision();

  protected readonly surface = computed(() => {
    const input: PlatformUpdatesSurfaceInput = {
      loading: this.updates.loading(),
      checking: this.updates.checking(),
      apiUnreachable: this.updates.apiUnreachable(),
      status: this.updates.status(),
      operation: this.updates.operation(),
      history: this.updates.history(),
      confirming: this.confirming(),
      acknowledged: this.acknowledged(),
    };
    return buildPlatformUpdatesSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    // Publish this page's own Semantic Surface snapshot into the shared registry
    // whenever it changes — same pattern as SettingsComponent.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  protected readonly stopped = computed(() => {
    if (this.updates.running()) return null;
    const last = this.updates.history()[0];
    return last?.schema === 2 && last.status === 'FAILED' ? last : null;
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.updates.refresh(), this.updates.loadHistory()]);
  }

  ngOnDestroy(): void {
    // Other surfaces keep the poll alive while an update runs; only stop a finished one.
    if (!this.updates.running()) this.updates.stopPolling();
    this.currentSurface.set(null);
  }

  protected async check(): Promise<void> {
    await this.updates.check();
  }

  protected openConfirm(): void {
    this.acknowledged.set(false);
    this.confirming.set(true);
    const version = this.updates.availableVersion();
    if (version) void this.updates.plan(version);
  }

  protected async resume(operationId: string): Promise<void> {
    await this.updates.resume(operationId);
  }

  protected closeConfirm(): void {
    this.confirming.set(false);
  }

  protected checkedAgo(iso: string): string {
    const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
  }
}
