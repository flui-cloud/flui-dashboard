import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX, lucideHammer, lucideRocket, lucideArrowRight, lucideCircleCheck, lucideCircleAlert } from '@ng-icons/lucide';
import { ApplicationResponseDto } from '../../../core/api/model/applicationResponseDto';

export interface RepoDeployChoiceRepo {
  id: string;
  fullName: string;
}

@Component({
  selector: 'app-repo-deploy-choice-modal',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [provideIcons({ lucideX, lucideHammer, lucideRocket, lucideArrowRight, lucideCircleCheck, lucideCircleAlert })],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="closed.emit()">
      <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="min-w-0 pr-4">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
              This repository already has an application
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
              {{ repo?.fullName }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
              We recommend triggering a new build on the existing application instead of deploying a new one.
            </p>
          </div>
          <button (click)="closed.emit()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
            <ng-icon name="lucideX" class="h-5 w-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto max-h-[50vh] space-y-3">
          @for (app of matchedApps; track app.id) {
            <div class="flex items-center justify-between gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900 dark:text-white truncate">{{ app.name }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full" [ngClass]="app.status === 'running'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'">
                    {{ app.status }}
                  </span>
                </div>
                @if (app.lastDeployedAt) {
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Last deployed {{ formatDate(app.lastDeployedAt) }}
                  </p>
                }
              </div>
              <button
                (click)="triggerBuild.emit(app.id)"
                class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                <ng-icon name="lucideHammer" class="h-4 w-4" />
                Trigger new build
              </button>
            </div>
          }
        </div>

        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-900/40">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Need a separate environment from the same repo?
          </p>
          <button
            (click)="createNewApp.emit()"
            class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2">
            Deploy as a new application
            <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  `,
})
export class RepoDeployChoiceModalComponent {
  @Input() repo: RepoDeployChoiceRepo | null = null;
  @Input() matchedApps: ApplicationResponseDto[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() triggerBuild = new EventEmitter<string>();
  @Output() createNewApp = new EventEmitter<void>();

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
    return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
