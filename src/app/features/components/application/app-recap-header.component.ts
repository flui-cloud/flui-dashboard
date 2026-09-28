import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowUpRight, lucideFileText } from '@ng-icons/lucide';
import { AppGroupView } from '../../model/application.models';
import { statusOf } from './app-recap-bundle';
import { HeaderPart } from './app-recap-header';
import { TONE_DOT, TONE_PILL } from './app-recap-view';

@Component({
  selector: 'app-recap-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowLeft, lucideArrowUpRight, lucideFileText })],
  host: { class: 'block' },
  template: `
    @let g = group();
    @let s = status();
    <div class="flex flex-wrap items-start justify-between gap-4" data-testid="recap-header">
      <div class="flex min-w-0 items-start gap-3">
        <a
          [routerLink]="backLink()"
          [attr.aria-label]="backLabel()"
          [title]="backLabel()"
          class="mt-1 rounded-lg border border-border p-2 transition-colors hover:bg-muted"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </a>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="text-3xl font-bold tracking-tight text-foreground">{{ g.name }}</h1>
            <span class="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{{ kindChip() }}</span>
            <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" [class]="pill[s.tone]" data-testid="recap-status">
              <span class="h-1.5 w-1.5 rounded-full" [class]="dot[s.tone]"></span>
              {{ s.label }}
            </span>
          </div>
          <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" data-testid="recap-meta">
            @for (part of meta(); track $index) {
              @if ($index > 0) {
                <span aria-hidden="true">·</span>
              }
              <span [class.font-mono]="part.mono" [class.text-xs]="part.mono" class="truncate" [title]="part.text">{{ part.text }}</span>
            }
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        @if (logsAppId(); as logsId) {
          <a
            [routerLink]="['/apps/applications', logsId, 'logs']"
            [queryParams]="{ returnTo: recapPath() }"
            class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ng-icon name="lucideFileText" class="h-4 w-4" />
            Logs
          </a>
        }
        @if (openUrl()) {
          <a
            [href]="openUrl()"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            data-testid="recap-open"
          >
            Open app
            <ng-icon name="lucideArrowUpRight" class="h-4 w-4" />
          </a>
        }
      </div>
    </div>
  `,
})
export class AppRecapHeaderComponent {
  readonly group = input.required<AppGroupView>();
  readonly kindChip = input.required<string>();
  readonly meta = input.required<HeaderPart[]>();
  readonly backLink = input.required<string>();
  readonly backLabel = input.required<string>();
  readonly logsAppId = input<string | null>(null);
  readonly recapPath = input.required<string>();
  readonly openUrl = input('');

  protected readonly status = computed(() => statusOf(this.group().status));
  protected readonly dot = TONE_DOT;
  protected readonly pill = TONE_PILL;
}
