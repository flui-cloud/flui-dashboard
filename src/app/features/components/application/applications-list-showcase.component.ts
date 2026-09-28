import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ApplicationListRowComponent } from './application-list-row.component';
import { ListRow } from './applications-list-rows';

@Component({
  selector: 'app-applications-list-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApplicationListRowComponent],
  host: { class: 'block' },
  template: `
    <div class="space-y-2">
      <div class="flex items-baseline gap-2">
        <h2 class="text-sm font-semibold text-foreground">In the showcase</h2>
        @if (readOnly()) {
          <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            read-only
          </span>
        }
      </div>
      @if (why()) {
        <p class="text-xs text-muted-foreground">{{ why() }}</p>
      }
      <section class="card-surface overflow-hidden">
        @for (row of rows(); track row.id) {
          <app-application-list-row [row]="row" (open)="open.emit($event)" />
        }
      </section>
    </div>
  `,
})
export class ApplicationsListShowcaseComponent {
  readonly rows = input.required<ListRow[]>();
  readonly readOnly = input(false);
  readonly why = input<string | null>(null);
  readonly open = output<string>();
}
