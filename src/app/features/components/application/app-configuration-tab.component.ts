import { Component, OnInit, inject, signal } from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { ApplicationService } from '../../service/application.service';
import { AppVariablesService } from '../../service/app-variables.service';
import {
  AppVariablesEditorComponent,
  VariablesSavePayload,
} from './app-variables-editor.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-configuration-tab',
  standalone: true,
  imports: [AppVariablesEditorComponent, FlAlert, FlCopyId, FlSpinner],
  host: { class: 'fl-stack' },
  template: `
    @if (app(); as app) {
      @if (focusVar(); as name) {
        <fl-alert tone="info" title="Suggested by the diagnosis">
          Add the variable <fl-copy-id [value]="name" label="variable name" /> under Variables.
        </fl-alert>
      } @else if (missingName(); as name) {
        <fl-alert tone="info" title="Suggested by the diagnosis">
          The {{ missingKind() ?? 'resource' }} <span class="fl-mono">{{ name }}</span> is missing.
          Create it or add the reference below.
        </fl-alert>
      }

      @if (variablesService.loading()) {
        <div class="flex items-center gap-2 text-fl-body-sm text-fl-ink-muted">
          <fl-spinner label="Loading variables" />
          Loading variables
        </div>
      }

      @if (variablesService.error(); as error) {
        <fl-alert tone="error" title="Variables request failed">{{ error }}</fl-alert>
      }

      <app-variables-editor
        title="Variables"
        [data]="variablesService.plainData()"
        [sensitiveKeys]="[]"
        [saving]="variablesService.saving()"
        (save)="onSavePlain($event)"
      />

      <app-variables-editor
        title="Secrets"
        [data]="variablesService.sensitiveData()"
        [sensitiveKeys]="variablesService.sensitiveKeys()"
        [pendingKeys]="variablesService.pendingKeys()"
        [saving]="variablesService.saving()"
        (save)="onSaveSensitive($event)"
      />
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

  protected async onSavePlain(payload: VariablesSavePayload): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.variablesService.upsertPlain(app.id, payload.data, payload.deleteKeys);
    }
  }

  protected async onSaveSensitive(payload: VariablesSavePayload): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.variablesService.upsertSensitive(app.id, payload.data, payload.deleteKeys);
    }
  }
}
