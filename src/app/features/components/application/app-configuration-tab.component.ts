import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideLoader,
  lucideAlertCircle,
  lucideInfo,
  lucideCopy,
  lucideCheck,
} from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { AppVariablesService } from '../../service/app-variables.service';
import { AppVariablesEditorComponent } from './app-variables-editor.component';

@Component({
  selector: 'app-configuration-tab',
  standalone: true,
  imports: [CommonModule, NgIconComponent, AppVariablesEditorComponent],
  providers: [
    provideIcons({ lucideLoader, lucideAlertCircle, lucideInfo, lucideCopy, lucideCheck }),
  ],
  template: `
    @if (app(); as app) {
      <div class="space-y-6">

        @if (focusVar() || missingName()) {
          <div class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
            <ng-icon name="lucideInfo" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div class="flex-1 space-y-1 min-w-0">
              @if (focusVar()) {
                <p>
                  Suggested by the diagnosis: add the variable
                  <button
                    type="button"
                    (click)="copy(focusVar()!)"
                    class="font-mono font-semibold inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline"
                  >
                    {{ focusVar() }}
                    @if (copiedKey() === focusVar()) {
                      <ng-icon name="lucideCheck" class="h-3 w-3" />
                    } @else {
                      <ng-icon name="lucideCopy" class="h-3 w-3" />
                    }
                  </button>
                  in the section below.
                </p>
              } @else if (missingName()) {
                <p>
                  Suggested by the diagnosis:
                  {{ missingKind() ?? 'resource' }}
                  <span class="font-mono font-semibold">{{ missingName() }}</span>
                  is missing. Create or add the reference in the section below.
                </p>
              }
            </div>
          </div>
        }

        @if (variablesService.loading()) {
          <div class="flex items-center gap-2 py-4">
            <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin text-blue-600" />
            <span class="text-sm text-gray-600 dark:text-gray-400">Loading variables...</span>
          </div>
        }

        @if (variablesService.error()) {
          <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{{ variablesService.error() }}</span>
          </div>
        }

        <!-- Plain Variables (ConfigMap) -->
        <app-variables-editor
          title="Plain Variables (ConfigMap)"
          [data]="variablesService.plainData()"
          [sensitiveKeys]="[]"
          [saving]="variablesService.saving()"
          (save)="onSavePlain($event)"
        />

        <!-- Sensitive Variables (Secrets) -->
        <app-variables-editor
          title="Sensitive Variables (Secrets)"
          [data]="variablesService.sensitiveData()"
          [sensitiveKeys]="variablesService.sensitiveKeys()"
          [saving]="variablesService.saving()"
          (save)="onSaveSensitive($event)"
        />

      </div>
    }
  `,
})
export class AppConfigurationTabComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  private readonly route = inject(ActivatedRoute);
  protected variablesService = inject(AppVariablesService);

  readonly app = this.appService.selectedApplication;

  focusVar = signal<string | null>(null);
  missingKind = signal<string | null>(null);
  missingName = signal<string | null>(null);
  copiedKey = signal<string | null>(null);

  ngOnInit(): void {
    void (async () => {
      const params = this.route.snapshot.queryParamMap;
      this.focusVar.set(params.get('focusVar'));
      this.missingKind.set(params.get('missingKind'));
      this.missingName.set(params.get('missingName'));
  
      const app = this.app();
      if (!app?.id) return;
      await this.variablesService.loadVariables(app.id);
    })();
  }

  copy(value: string): void {
    navigator.clipboard?.writeText(value).then(() => {
      this.copiedKey.set(value);
      setTimeout(() => this.copiedKey.set(null), 1500);
    });
  }

  protected async onSavePlain(data: Record<string, string>): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.variablesService.upsertPlain(app.id, data);
    }
  }

  protected async onSaveSensitive(data: Record<string, string>): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.variablesService.upsertSensitive(app.id, data);
    }
  }
}
