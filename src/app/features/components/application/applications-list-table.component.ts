import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { ApplicationListRowComponent, LIST_COLUMNS } from './application-list-row.component';
import { ListRow } from './applications-list-rows';

@Component({
  selector: 'app-applications-list-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApplicationListRowComponent],
  host: { class: 'block space-y-5' },
  template: `
    <section class="card-surface overflow-hidden" data-testid="apps-table">
      <div
        class="hidden md:grid gap-x-3.5 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        [style.grid-template-columns]="columns"
      >
        <span>Application</span>
        <span>Cluster</span>
        <span>Ready</span>
        <span>Source</span>
        <span>CPU · Memory</span>
        <span>Backup</span>
        <span class="text-right">Released</span>
      </div>
      @for (row of rows(); track row.id) {
        <app-application-list-row [row]="row" (open)="open.emit($event)" />
      }
    </section>
    <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-1.5 w-4 rounded-full" [style.background]="cpuColor"></span>CPU of the limit
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-1.5 w-4 rounded-full" [style.background]="memoryColor"></span>Memory of the limit
      </span>
      <span>Apps that need attention are listed first.</span>
    </div>
  `,
})
export class ApplicationsListTableComponent {
  readonly rows = input.required<ListRow[]>();
  readonly open = output<string>();

  protected readonly columns = LIST_COLUMNS;
  protected readonly cpuColor = NODE_SERIES_COLORS[0];
  protected readonly memoryColor = NODE_SERIES_COLORS[1];
}
