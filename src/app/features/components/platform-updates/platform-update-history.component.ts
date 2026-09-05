import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PlatformUpdateOperation } from '../../service/platform-update.service';

@Component({
  selector: 'app-platform-update-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="card-surface">
      <div class="p-5">
        <h3 class="text-sm font-semibold">Update history</h3>
        <p class="text-sub">Every platform update attempted on this installation, newest first.</p>
      </div>

      @if (operations().length === 0) {
        <div class="border-t border-border px-5 py-6 text-sm text-muted-foreground">
          No platform update has been applied from here yet.
        </div>
      } @else {
        <div class="grid grid-cols-[110px_200px_1fr_110px_150px] gap-3 bg-muted px-5 py-2 text-label">
          <div>Outcome</div><div>Release</div><div>Detail</div><div>Duration</div><div>When</div>
        </div>
        @for (operation of operations(); track operation.id) {
          <div class="grid grid-cols-[110px_200px_1fr_110px_150px] items-center gap-3 border-t border-border px-5 py-3 text-xs">
            <div>
              <span class="badge" [class]="badgeClass(operation)">{{ label(operation) }}</span>
            </div>
            <div class="font-mono">
              <span class="text-muted-foreground">{{ operation.fromVersion }}</span>
              <span class="mx-1.5 text-muted-foreground/50">&rarr;</span>
              <span class="font-semibold">{{ operation.targetVersion }}</span>
            </div>
            <div class="text-muted-foreground truncate" [title]="detail(operation)">{{ detail(operation) }}</div>
            <div class="text-muted-foreground">{{ duration(operation) }}</div>
            <div class="text-muted-foreground">{{ when(operation) }}</div>
          </div>
        }
      }
    </div>
  `,
})
export class PlatformUpdateHistoryComponent {
  readonly operations = input.required<PlatformUpdateOperation[]>();

  protected label(operation: PlatformUpdateOperation): string {
    switch (operation.status) {
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return 'Running';
    }
  }

  protected badgeClass(operation: PlatformUpdateOperation): string {
    switch (operation.status) {
      case 'COMPLETED':
        return 'badge-success';
      case 'FAILED':
      case 'CANCELLED':
        return 'badge-error';
      default:
        return 'badge-in-progress';
    }
  }

  protected detail(operation: PlatformUpdateOperation): string {
    if (operation.errorMessage) return operation.errorMessage;
    const moved = operation.components.filter((c) => c.status === 'done').length;
    const migrations = operation.migrations
      ? `${operation.migrations} migration${operation.migrations === 1 ? '' : 's'}`
      : 'no migrations';
    return `${moved} component${moved === 1 ? '' : 's'} · ${migrations}`;
  }

  protected duration(operation: PlatformUpdateOperation): string {
    if (!operation.startedAt || !operation.completedAt) return '—';
    const seconds = Math.round(
      (Date.parse(operation.completedAt) - Date.parse(operation.startedAt)) / 1000,
    );
    if (seconds < 60) return `${seconds} s`;
    return `${Math.floor(seconds / 60)} m ${String(seconds % 60).padStart(2, '0')} s`;
  }

  protected when(operation: PlatformUpdateOperation): string {
    const at = operation.completedAt ?? operation.startedAt;
    return at ? new Date(at).toLocaleDateString() : '—';
  }
}
