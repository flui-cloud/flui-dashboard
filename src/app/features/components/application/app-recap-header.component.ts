import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowUpRight, lucideFileText, lucideSettings2 } from '@ng-icons/lucide';
import { AppGroupView } from '../../model/application.models';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { statusToneOf } from '../dashboard/home-state';
import { statusOf } from './app-recap-bundle';
import { HeaderPart } from './app-recap-header';

@Component({
  selector: 'app-recap-header',
  imports: [RouterLink, FlPageHeader, FlButton, FlIcon, FlStatus, FlTag],
  providers: [provideIcons({ lucideArrowUpRight, lucideFileText, lucideSettings2 })],
  host: { class: 'block' },
  template: `
    @let g = group();
    @let s = status();
    <fl-page-header [title]="g.name" [breadcrumb]="breadcrumb()" data-testid="recap-header">
      <fl-status headerStatus [tone]="tone()" [label]="s.label" data-testid="recap-status" />
      <fl-tag headerStatus>{{ kindChip() }}</fl-tag>
      <span headerMeta class="fl-row text-fl-body-sm text-fl-ink-muted" data-testid="recap-meta">
        @for (part of meta(); track $index) {
          @if ($index > 0) {
            <span aria-hidden="true">·</span>
          }
          <span class="truncate" [class.fl-mono]="part.mono" [title]="part.text">{{
            part.text
          }}</span>
        }
      </span>
      <ng-container headerActions>
        @if (openUrl()) {
          <a
            flButton
            [href]="openUrl()"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="recap-open"
          >
            Open
            <fl-icon name="lucideArrowUpRight" />
          </a>
        }
        @if (logsAppId(); as logsId) {
          <a
            flButton
            [routerLink]="['/apps/applications', logsId, 'logs']"
            [queryParams]="{ returnTo: recapPath() }"
          >
            <fl-icon name="lucideFileText" />
            Logs
          </a>
        }
        @if (manageAppId(); as manageId) {
          <a
            flButton="primary"
            [routerLink]="['/apps/applications', manageId]"
            [queryParams]="{ returnTo: recapPath() }"
            data-testid="recap-manage"
          >
            <fl-icon name="lucideSettings2" />
            Manage
          </a>
        }
      </ng-container>
    </fl-page-header>
  `,
})
export class AppRecapHeaderComponent {
  readonly group = input.required<AppGroupView>();
  readonly kindChip = input.required<string>();
  readonly meta = input.required<HeaderPart[]>();
  readonly backLink = input.required<string>();
  readonly backLabel = input.required<string>();
  readonly listLabel = input('');
  readonly logsAppId = input<string | null>(null);
  /** The application the full panel opens on; null when a bundle has several, each linked from its card. */
  readonly manageAppId = input<string | null>(null);
  readonly recapPath = input.required<string>();
  readonly openUrl = input('');

  protected readonly status = computed(() => statusOf(this.group().status));
  protected readonly tone = computed<StatusTone>(() => statusToneOf(this.status().tone));
  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: this.listLabel() || this.backLabel(), link: this.backLink() },
    { label: this.group().name },
  ]);
}
