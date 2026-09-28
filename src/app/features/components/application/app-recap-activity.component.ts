import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecentEvent } from './app-recap-bundle';
import { TONE_DOT, shortDate } from './app-recap-view';

@Component({
  selector: 'app-recap-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <section class="card-surface p-5" data-testid="recap-activity">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-foreground">Recent activity</h2>
        <a
          [routerLink]="['/apps/applications', appId(), 'revisions']"
          [queryParams]="{ returnTo: recapPath() }"
          class="text-xs font-medium text-primary hover:underline"
        >All events</a>
      </div>
      @if (events().length === 0) {
        <p class="mt-3 text-sm text-muted-foreground">{{ loaded() ? 'No events recorded yet.' : 'Loading…' }}</p>
      } @else {
        <ul class="mt-3 space-y-2.5">
          @for (e of events(); track e.id) {
            <li class="flex items-start gap-2.5 text-sm">
              <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" [class]="dot[e.tone]"></span>
              <span class="w-20 shrink-0 font-mono text-xs text-muted-foreground">{{ shortDate(e.at) }}</span>
              <span class="min-w-0 text-foreground">{{ e.text }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class AppRecapActivityComponent {
  readonly events = input.required<RecentEvent[]>();
  readonly loaded = input.required<boolean>();
  readonly appId = input.required<string>();
  readonly recapPath = input.required<string>();

  protected readonly dot = TONE_DOT;
  protected readonly shortDate = shortDate;
}
