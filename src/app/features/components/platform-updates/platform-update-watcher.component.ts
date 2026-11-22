import { Component, OnInit, effect, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformUpdateService } from '../../service/platform-update.service';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-platform-update-watcher',
  imports: [FlStatus],
  host: { class: 'contents' },
  template: `
    @if (restarting()) {
      <div class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class="fl-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="platform-restart-title"
          aria-live="polite"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="platform-restart-title">Control plane restarting</h2>
            <fl-status tone="progress" label="Restarting" />
          </header>
          <div class="fl-dialog__body">
            <p class="m-0">
              <span class="fl-mono">flui-api</span> is starting on
              <span class="fl-mono">{{ updates.operation()?.targetVersion }}</span>
              @if (migrations() > 0) {
                and applying {{ migrations() }} database migration{{
                  migrations() === 1 ? '' : 's'
                }}
              }
              .
            </p>
            <p class="m-0 text-fl-ink-muted">
              Your applications keep running. This page reloads by itself as soon as the API answers
              on the new version.
            </p>
          </div>
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

  protected restarting(): boolean {
    return (
      this.updates.controlPlaneRestarting() ||
      (this.updates.running() && this.updates.apiUnreachable())
    );
  }

  protected migrations(): number {
    return this.updates.operation()?.migrations ?? 0;
  }

  ngOnInit(): void {
    void this.updates.ensureLoaded();
  }
}
