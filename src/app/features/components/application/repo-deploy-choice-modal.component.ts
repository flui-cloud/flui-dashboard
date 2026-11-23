import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideHammer, lucideX } from '@ng-icons/lucide';
import { ApplicationResponseDto } from '../../../core/api/model/applicationResponseDto';
import { getStatusLabel } from '../../model/application.models';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { statusToneOf } from '../dashboard/home-state';
import { statusTone } from './applications-list-rows';
import { FlDialogFocus } from '../../../ui/overlays/dialog-focus';

export interface RepoDeployChoiceRepo {
  id: string;
  fullName: string;
}

@Component({
  selector: 'app-repo-deploy-choice-modal',
  imports: [FlDialogFocus, FlTable, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideArrowRight, lucideHammer, lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      flDialogFocus
      (dismissed)="closed.emit()"
      (click)="$event.target === $event.currentTarget && closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repo-choice-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="repo-choice-title">
            This repository already has an application
          </h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <p class="fl-mono truncate">{{ repo()?.fullName }}</p>
          <p class="text-fl-ink-secondary">
            Trigger a new build on the existing application instead of deploying a new one.
          </p>
          <div class="fl-table-wrap rounded-fl-md border border-fl-border">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Application</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last deployed</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (app of matchedApps(); track app.id) {
                  <tr>
                    <td class="fl-mono">{{ app.name }}</td>
                    <td><fl-status [tone]="tone(app.status)" [label]="label(app.status)" /></td>
                    <td class="text-fl-ink-muted">
                      {{ app.lastDeployedAt ? formatDate(app.lastDeployedAt) : 'Never' }}
                    </td>
                    <td class="is-fit">
                      <button
                        [flButton]="matchedApps().length === 1 ? 'primary' : 'secondary'"
                        size="sm"
                        type="button"
                        (click)="triggerBuild.emit(app.id)"
                      >
                        <fl-icon name="lucideHammer" />
                        Trigger new build
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <footer class="fl-dialog__footer items-center">
          <span class="mr-auto text-fl-caption text-fl-ink-muted">
            Need a separate environment from the same repository?
          </span>
          <button flButton="ghost" type="button" (click)="createNewApp.emit()">
            Deploy as a new application
            <fl-icon name="lucideArrowRight" />
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class RepoDeployChoiceModalComponent {
  readonly repo = input<RepoDeployChoiceRepo | null>(null);
  readonly matchedApps = input<ApplicationResponseDto[]>([]);
  readonly closed = output<void>();
  readonly triggerBuild = output<string>();
  readonly createNewApp = output<void>();

  protected tone(status: string): StatusTone {
    return statusToneOf(statusTone(status));
  }

  protected label(status: string): string {
    return getStatusLabel(status as Parameters<typeof getStatusLabel>[0]);
  }

  formatDate(date: string): string {
    const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(date) ? date : date + 'Z';
    const then = new Date(normalized);
    const diffMs = Date.now() - then.getTime();
    if (diffMs < 60_000) return 'just now';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffMins < 60) return rtf.format(-diffMins, 'minute');
    if (diffHours < 24) return rtf.format(-diffHours, 'hour');
    if (diffDays < 7) return rtf.format(-diffDays, 'day');
    return then.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
