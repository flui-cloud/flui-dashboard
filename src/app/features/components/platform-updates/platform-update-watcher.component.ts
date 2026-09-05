import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader } from '@ng-icons/lucide';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformUpdateService } from '../../service/platform-update.service';

// Mounted once by the shell: the only thing that checks for a release, and the only thing shown while the API is being replaced.
@Component({
  selector: 'app-platform-update-watcher',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideLoader })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (restarting()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
        <div class="w-full max-w-md card-surface p-6 shadow-2xl">
          <div class="flex items-center gap-3">
            <div class="step-icon bg-primary/10 text-primary">
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            </div>
            <div>
              <h3 class="text-sm font-semibold">Control plane restarting</h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                flui-api is starting on {{ updates.operation()?.targetVersion }}
                @if (migrations() > 0) {
                  and applying {{ migrations() }} database migration{{ migrations() === 1 ? '' : 's' }}
                }.
              </p>
            </div>
          </div>
          <div class="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div class="h-full w-1/3 rounded-full bg-primary animate-indeterminate"></div>
          </div>
          <p class="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            Your applications keep running. This page reloads by itself as soon as the API answers
            on the new version.
          </p>
        </div>
      </div>
    }
  `,
})
export class PlatformUpdateWatcherComponent implements OnInit {
  protected readonly updates = inject(PlatformUpdateService);
  private readonly notifications = inject(NotificationService);

  private announced: string | null = null;

  constructor() {
    effect(() => {
      const version = this.updates.availableVersion();
      if (!version || this.announced === version) return;
      this.announced = version;
      const status = this.updates.status();
      const changed = status?.components.filter((c) => c.changed).length ?? 0;
      this.notifications.add({
        title: `Flui ${version} is available`,
        body:
          `${changed} component${changed === 1 ? '' : 's'} change` +
          (status?.migrations ? ` · ${status.migrations} migrations` : ''),
        category: 'platform-update',
        type: 'info',
        source: 'system',
        link: { label: 'Open Updates', route: '/management/updates' },
      });
    });
  }

  // True either the API told us it's restarting, or it stopped answering mid-update.
  protected restarting(): boolean {
    return (
      this.updates.controlPlaneRestarting() ||
      (this.updates.running() && this.updates.apiUnreachable())
    );
  }

  protected migrations(): number {
    return this.updates.operation()?.migrations ?? 0;
  }

  async ngOnInit(): Promise<void> {
    await this.updates.ensureLoaded();
  }
}
