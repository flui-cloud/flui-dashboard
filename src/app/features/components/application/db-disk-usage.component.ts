import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DbDiskInfo, DbDiskService } from '../../service/db-disk.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';

/**
 * Disk usage + near-full alert for a database app. Interim `df`-based reading (the disk hosting
 * the volume — the real boundary at which the DB runs out of space). Renders only when the app
 * has a volume; hidden otherwise (non-DB apps, stateless components). Native per-volume metrics
 * are tracked in the shared backlog.
 */
@Component({
  selector: 'app-db-disk-usage',
  standalone: true,
  imports: [FlPanel, FlUsageBar, FlAlert],
  host: { class: 'block' },
  template: `
    @if (info(); as d) {
      @if (d.available) {
        <fl-panel title="Disk">
          <span panelActions class="fl-toolbar__info"
            >Hosting filesystem{{ d.engine ? ' · ' + d.engine : '' }}</span
          >
          <div class="flex flex-col gap-3">
            @if (d.utilization_percent !== null) {
              <fl-usage-bar
                [percent]="d.utilization_percent"
                label="Disk"
                [aside]="human(d.used_bytes) + ' used of ' + human(d.size_bytes)"
                [warnAt]="warnAt()"
                [criticalAt]="criticalAt()"
              />
            } @else {
              <span class="fl-muted text-fl-body-sm"
                >Usage n/a · {{ human(d.used_bytes) }} used of {{ human(d.size_bytes) }}</span
              >
            }
            <div class="fl-row fl-muted text-fl-body-sm">
              <span>{{ human(d.available_bytes) }} free</span>
              @if (d.mountPath) {
                <span class="fl-mono">{{ d.mountPath }}</span>
              }
            </div>
            @if (d.alert_level !== 'none') {
              <fl-alert
                [tone]="d.alert_level === 'critical' ? 'error' : 'warning'"
                [title]="
                  'The disk hosting this database is ' +
                  (d.alert_level === 'critical' ? 'almost full' : 'getting full')
                "
              >
                Free space or grow the node disk soon. Per-volume quotas and metrics are on the
                roadmap.
              </fl-alert>
            }
          </div>
        </fl-panel>
      }
    }
  `,
})
export class DbDiskUsageComponent {
  private readonly svc = inject(DbDiskService);

  readonly appId = input<string | null>(null);
  readonly info = signal<DbDiskInfo | null>(null);

  protected readonly warnAt = computed(() => (this.info()?.alert_level === 'none' ? 101 : 0));
  protected readonly criticalAt = computed(() =>
    this.info()?.alert_level === 'critical' ? 0 : 101,
  );

  constructor() {
    effect(() => {
      const id = this.appId();
      this.info.set(null);
      if (!id) return;
      this.svc.disk(id).subscribe({
        next: (d) => this.info.set(d),
        error: () => this.info.set(null),
      });
    });
  }

  human(bytes: number | null): string {
    if (bytes === null) return 'n/a';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(1)} ${units[i]}`;
  }
}
