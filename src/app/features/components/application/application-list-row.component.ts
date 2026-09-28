import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { Tone } from '../dashboard/home-state';
import { ListRow } from './applications-list-rows';
import { ProjectBadgeComponent } from '../projects/project-badge.component';

export const LIST_COLUMNS = 'minmax(0,2.4fr) 1.3fr 0.6fr 0.7fr 1fr 0.9fr 0.8fr';

const DOT: Record<Tone, string> = {
  ok: 'bg-green-500',
  info: 'bg-primary',
  warn: 'bg-amber-500',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
};

const TEXT: Record<Tone, string> = {
  ok: 'text-green-700 dark:text-green-400',
  info: 'text-primary',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};

@Component({
  selector: 'app-application-list-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectBadgeComponent],
  host: { class: 'contents' },
  template: `
    @let r = row();
    <div
      role="link"
      tabindex="0"
      (click)="open.emit(r.id)"
      (keydown.enter)="open.emit(r.id)"
      class="flex flex-wrap md:grid gap-x-3.5 gap-y-2 items-center px-5 py-3.5 border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
      [class]="r.tone === 'danger' ? 'bg-destructive/5' : ''"
      [style.grid-template-columns]="columns"
      [attr.data-testid]="'app-row-' + r.id"
    >
      <div class="flex items-start gap-3 min-w-0 w-full md:w-auto">
        <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" [class]="dot(r.tone)" [title]="r.statusLabel"></span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex min-w-0 flex-wrap items-center gap-1.5">
            <span class="truncate text-sm font-semibold text-foreground">{{ r.name }}</span>
            @if (r.bundle) {
              <span class="rounded px-1.5 py-0.5 text-[11px] font-medium chip-purple">{{ r.bundle }}</span>
            }
            @if (r.project) {
              <app-project-badge [project]="r.project" />
            }
          </div>
          @if (r.subtitle.href) {
            <a
              [href]="r.subtitle.href"
              target="_blank"
              rel="noopener noreferrer"
              (click)="$event.stopPropagation()"
              class="truncate font-mono text-xs text-primary hover:underline"
              data-testid="app-row-endpoint"
            >{{ r.subtitle.text }}</a>
          } @else {
            <span class="truncate font-mono text-xs" [class]="text(r.subtitle.tone)" [title]="r.subtitle.text" data-testid="app-row-subtitle">{{ r.subtitle.text }}</span>
          }
        </div>
      </div>

      <div class="flex min-w-0 items-center gap-2" [title]="r.cluster.provider">
        <span class="icon-chip icon-chip-sm chip-brand text-[10px] font-bold">{{ r.cluster.chip }}</span>
        <span class="truncate text-sm text-foreground">{{ r.cluster.name }}</span>
      </div>

      <span class="text-sm font-semibold tabular-nums" [class]="text(r.ready.tone)" [title]="r.ready.title" data-testid="app-row-ready">{{ r.ready.text }}</span>

      <span class="text-xs text-muted-foreground" data-testid="app-row-origin">{{ r.origin }}</span>

      <div class="flex min-w-[6rem] flex-col gap-1.5" [title]="r.usageTitle" data-testid="app-row-usage">
        @if (r.cpu === null && r.memory === null) {
          <span class="text-xs text-muted-foreground">—</span>
        } @else {
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full" [style.background]="cpuColor" [style.width.%]="bar(r.cpu)"></div>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full" [style.background]="memoryColor" [style.width.%]="bar(r.memory)"></div>
          </div>
        }
      </div>

      <span class="text-xs font-semibold" [class]="text(r.backup.tone)" [title]="r.backup.title" data-testid="app-row-backup">{{ r.backup.label }}</span>

      <span class="text-xs text-muted-foreground md:text-right" [title]="r.released.title">{{ r.released.text }}</span>
    </div>
  `,
})
export class ApplicationListRowComponent {
  readonly row = input.required<ListRow>();
  readonly open = output<string>();

  protected readonly columns = LIST_COLUMNS;
  protected readonly cpuColor = NODE_SERIES_COLORS[0];
  protected readonly memoryColor = NODE_SERIES_COLORS[1];

  protected dot(tone: Tone): string {
    return DOT[tone];
  }

  protected text(tone: Tone): string {
    return TEXT[tone];
  }

  protected bar(v: number | null): number {
    if (v == null) return 0;
    return Math.max(2, Math.min(100, v));
  }
}
