import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideDownload,
  lucideInfo,
  lucideLoader,
  lucideRefreshCw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import {
  PlatformComponentUpdate,
  PlatformUpdateService,
} from '../../service/platform-update.service';
import { PlatformUpdateProgressComponent } from './platform-update-progress.component';
import { PlatformUpdateHistoryComponent } from './platform-update-history.component';

@Component({
  selector: 'app-platform-updates',
  standalone: true,
  imports: [DatePipe, NgIcon, PlatformUpdateProgressComponent, PlatformUpdateHistoryComponent],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideDownload,
      lucideInfo,
      lucideLoader,
      lucideRefreshCw,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Updates</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            The Flui release running on this installation — API, dashboard and authorization service.
          </p>
        </div>
        <div class="flex items-center gap-3">
          @if (updates.status(); as status) {
            <span class="text-xs text-muted-foreground">Checked {{ checkedAgo(status.checkedAt) }}</span>
          }
          <button type="button" (click)="check()" [disabled]="updates.checking()"
                  class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60">
            <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="updates.checking()" />
            Check now
          </button>
        </div>
      </div>

      @if (updates.operation(); as operation) {
        <app-platform-update-progress [operation]="operation" />
      }

      @if (updates.status(); as status) {
        @if (!updates.running()) {
          <div class="card-surface" [class.border-primary]="status.updateAvailable">
            <div class="flex flex-wrap items-start justify-between gap-5 p-5">
              <div class="space-y-1.5">
                @if (status.updateAvailable) {
                  <span class="badge bg-primary/10 text-primary">Update available</span>
                  <h2 class="text-lg font-semibold">Flui {{ status.availableVersion }}</h2>
                  <p class="text-sm text-muted-foreground">
                    You are on <span class="font-mono">{{ status.installedVersion }}</span>
                    @if (status.publishedAt) { · released {{ status.publishedAt | date: 'd MMM y' }} }
                    · {{ changedCount() }} of {{ status.components.length }} components change
                  </p>
                } @else {
                  <span class="badge badge-success">Up to date</span>
                  <h2 class="text-lg font-semibold">You are on the latest release</h2>
                  <p class="text-sm text-muted-foreground">
                    Flui <span class="font-mono">{{ status.installedVersion }}</span> — every component is on its release version.
                  </p>
                }
              </div>
              @if (status.updateAvailable) {
                <button type="button" (click)="openConfirm()" [disabled]="!status.applicable"
                        class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <ng-icon name="lucideDownload" class="h-4 w-4" />
                  Update now
                </button>
              }
            </div>

            <div class="grid grid-cols-[180px_1fr_220px_110px] gap-3 bg-muted px-5 py-2 text-label">
              <div>Component</div><div>Role</div><div>Version</div><div>Change</div>
            </div>
            @for (component of status.components; track component.key) {
              <div class="grid grid-cols-[180px_1fr_220px_110px] items-center gap-3 border-t border-border px-5 py-3"
                   [class.opacity-60]="!component.changed">
                <div class="font-mono text-sm font-medium">{{ component.key }}</div>
                <div class="text-xs text-muted-foreground">
                  {{ component.role }}@if (component.restartsControlPlane) { · restarts once }
                </div>
                <div class="font-mono text-xs">
                  @if (component.changed) {
                    <span class="text-muted-foreground">{{ component.installedVersion }}</span>
                    <span class="mx-1.5 text-muted-foreground/50">&rarr;</span>
                  }
                  <span class="font-semibold">{{ component.targetVersion ?? component.installedVersion }}</span>
                </div>
                <div>
                  <span class="badge" [class]="component.changed ? 'bg-primary/10 text-primary' : 'badge-in-progress'">
                    {{ component.changed ? 'Will update' : 'Unchanged' }}
                  </span>
                </div>
              </div>
            }

            @if (status.advisories.length > 0) {
              <div class="grid gap-3 border-t border-border p-5 sm:grid-cols-2">
                @for (advisory of status.advisories; track advisory.title) {
                  <div class="flex items-start gap-2.5">
                    <ng-icon [name]="advisory.level === 'info' ? 'lucideInfo' : 'lucideTriangleAlert'"
                             class="mt-0.5 h-4 w-4 shrink-0"
                             [class]="advisory.level === 'blocker' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'" />
                    <div>
                      <p class="text-sm">{{ advisory.title }}</p>
                      <p class="text-xs text-muted-foreground mt-0.5">{{ advisory.detail }}</p>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (status.notes.length > 0 && status.updateAvailable) {
          <div class="card-surface p-5">
            <h3 class="text-sm font-semibold mb-3">In this release</h3>
            <ul class="space-y-2">
              @for (note of status.notes; track note) {
                <li class="flex gap-2.5 text-sm text-foreground/90">
                  <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40"></span>
                  <span>{{ note }}</span>
                </li>
              }
            </ul>
          </div>
        }
      } @else if (updates.loading()) {
        <div class="card-surface p-5"><div class="skeleton h-24 w-full"></div></div>
      }

      <app-platform-update-history [operations]="updates.history()" />
    </div>

    @if (confirming()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="closeConfirm()">
        <div class="w-full max-w-lg card-surface" (click)="$event.stopPropagation()">
          <div class="border-b border-border p-5">
            <h3 class="text-base font-semibold">Update to Flui {{ updates.availableVersion() }}</h3>
            <p class="text-sub">
              From <span class="font-mono">{{ updates.status()?.installedVersion }}</span>.
              This runs on the control cluster and cannot be paused once started.
            </p>
          </div>
          <div class="space-y-4 p-5">
            <div class="space-y-2">
              @for (component of changedComponents(); track component.key) {
                <div class="flex gap-2.5 text-sm">
                  <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40"></span>
                  <span>
                    <span class="font-mono font-semibold">{{ component.key }}</span>
                    rolls out {{ component.targetVersion }}@if (component.restartsControlPlane) {
                      — the API restarts and applies any migrations at start-up}.
                  </span>
                </div>
              }
            </div>
            @for (advisory of warnings(); track advisory.title) {
              <div class="flex items-start gap-2.5 rounded-md bg-muted p-3">
                <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p class="text-sm">{{ advisory.title }}</p>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ advisory.detail }}</p>
                </div>
              </div>
            }
            @if (migrations() > 0) {
              <label class="flex items-start gap-2.5 text-sm">
                <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-border" [checked]="acknowledged()"
                       (change)="acknowledged.set($any($event.target).checked)" />
                <span class="text-muted-foreground">
                  I understand the database migrations in this release are not reverted by a rollback.
                </span>
              </label>
            }
            @if (updates.error(); as error) {
              <p class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{{ error }}</p>
            }
          </div>
          <div class="flex justify-end gap-2 border-t border-border bg-muted/50 p-4">
            <button type="button" (click)="closeConfirm()"
                    class="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
            <button type="button" (click)="start()" [disabled]="!canStart()"
                    class="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              @if (updates.starting()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
              }
              Start update
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PlatformUpdatesComponent implements OnInit, OnDestroy {
  protected readonly updates = inject(PlatformUpdateService);

  protected readonly confirming = signal(false);
  protected readonly acknowledged = signal(false);

  protected readonly changedComponents = computed<PlatformComponentUpdate[]>(
    () => this.updates.status()?.components.filter((c) => c.changed) ?? [],
  );
  protected readonly changedCount = computed(() => this.changedComponents().length);
  protected readonly migrations = computed(() => this.updates.status()?.migrations ?? 0);
  protected readonly warnings = computed(
    () => this.updates.status()?.advisories.filter((a) => a.level !== 'info') ?? [],
  );
  protected readonly canStart = computed(
    () =>
      !this.updates.starting() &&
      (this.migrations() === 0 || this.acknowledged()) &&
      (this.updates.status()?.applicable ?? false),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([this.updates.refresh(), this.updates.loadHistory()]);
  }

  ngOnDestroy(): void {
    // Other surfaces keep the poll alive while an update runs; only stop a finished one.
    if (!this.updates.running()) this.updates.stopPolling();
  }

  protected async check(): Promise<void> {
    await this.updates.check();
  }

  protected openConfirm(): void {
    this.acknowledged.set(false);
    this.confirming.set(true);
  }

  protected closeConfirm(): void {
    this.confirming.set(false);
  }

  protected async start(): Promise<void> {
    const version = this.updates.availableVersion();
    if (!version) return;
    try {
      await this.updates.start(version);
      this.confirming.set(false);
    } catch {
      // The dialog stays open and shows the refusal.
    }
  }

  protected checkedAgo(iso: string): string {
    const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
  }
}
