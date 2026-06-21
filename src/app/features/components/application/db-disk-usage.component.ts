import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHardDrive, lucideTriangleAlert } from '@ng-icons/lucide';
import { DbDiskInfo, DbDiskService } from '../../service/db-disk.service';

/**
 * Disk usage + near-full alert for a database app. Interim `df`-based reading (the disk hosting
 * the volume — the real boundary at which the DB runs out of space). Renders only when the app
 * has a volume; hidden otherwise (non-DB apps, stateless components). Native per-volume metrics
 * are tracked in the shared backlog.
 */
@Component({
  selector: 'app-db-disk-usage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideHardDrive, lucideTriangleAlert })],
  template: `
    @if (info(); as d) {
      @if (d.available) {
        <div
          class="rounded-lg border p-4"
          [class]="
            d.alert_level === 'critical'
              ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
              : d.alert_level === 'warning'
                ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10'
                : 'border-border bg-card'
          "
        >
          <div class="flex items-center gap-2">
            <ng-icon name="lucideHardDrive" class="h-5 w-5 text-muted-foreground" />
            <h3 class="text-base font-semibold">Disk</h3>
            <span class="text-xs text-muted-foreground">
              · hosting filesystem{{ d.engine ? ' · ' + d.engine : '' }}
            </span>
            <span class="ml-auto font-mono text-sm" [class]="pctClass()">
              {{ d.utilization_percent !== null ? d.utilization_percent.toFixed(1) + '%' : 'n/a' }}
            </span>
          </div>

          <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full"
              [class]="barClass()"
              [style.width.%]="d.utilization_percent ?? 0"
            ></div>
          </div>

          <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>{{ human(d.used_bytes) }} used / {{ human(d.size_bytes) }}</span>
            <span>{{ human(d.available_bytes) }} free</span>
            @if (d.mountPath) { <span class="font-mono">{{ d.mountPath }}</span> }
          </div>

          @if (d.alert_level !== 'none') {
            <div
              class="mt-3 flex items-start gap-2 text-sm"
              [class]="d.alert_level === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'"
            >
              <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The disk hosting this database is
                {{ d.alert_level === 'critical' ? 'almost full' : 'getting full' }} — free space
                or grow the node disk soon. (Per-volume quota/metrics: see roadmap.)
              </span>
            </div>
          }
        </div>
      }
    }
  `,
})
export class DbDiskUsageComponent {
  private readonly svc = inject(DbDiskService);

  readonly appId = input<string | null>(null);
  readonly info = signal<DbDiskInfo | null>(null);

  readonly pctClass = computed(() => {
    const a = this.info()?.alert_level;
    if (a === 'critical') return 'text-red-600 dark:text-red-400';
    if (a === 'warning') return 'text-amber-600 dark:text-amber-400';
    return 'text-foreground';
  });

  readonly barClass = computed(() => {
    const a = this.info()?.alert_level;
    if (a === 'critical') return 'bg-red-500';
    if (a === 'warning') return 'bg-amber-500';
    return 'bg-emerald-500';
  });

  constructor() {
    effect(() => {
      const id = this.appId();
      this.info.set(null);
      if (!id) return;
      // 4xx (non-DB / no pod) → leave hidden.
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
