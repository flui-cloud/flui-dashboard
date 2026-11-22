import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash } from '@ng-icons/lucide';
import { DetectedEnvVarDto } from '../../../core/api/model/detectedEnvVarDto';
import { EnvironmentVariable } from '../../model/application.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';

export type EnvEditorMode = 'key-value' | 'json';

export interface EnvRowEdit {
  readonly index: number;
  readonly value: string;
}

@Component({
  selector: 'app-deploy-env-vars',
  imports: [FlAlert, FlField, FlTable, FlButton, FlIcon, FlStatus, FlTag],
  providers: [provideIcons({ lucidePlus, lucideTrash })],
  host: { class: 'flex flex-col gap-4 border-t border-fl-border pt-4 first:border-t-0 first:pt-0' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="m-0 text-fl-body-sm font-semibold">Environment variables</h3>
      <div class="fl-row" role="group" aria-label="Editor">
        <button
          [flButton]="mode() === 'key-value' ? 'secondary' : 'ghost'"
          size="sm"
          type="button"
          [attr.aria-pressed]="mode() === 'key-value'"
          (click)="modeChange.emit('key-value')"
        >
          Key-value
        </button>
        <button
          [flButton]="mode() === 'json' ? 'secondary' : 'ghost'"
          size="sm"
          type="button"
          [attr.aria-pressed]="mode() === 'json'"
          (click)="modeChange.emit('json')"
        >
          Raw JSON
        </button>
      </div>
    </div>

    @if (unreviewedDefaults()) {
      <fl-alert tone="warning" title="Review the auto-filled values">
        Some values come from a file in the repository. They may be placeholders or development
        defaults.
      </fl-alert>
    }

    @if (mode() === 'key-value') {
      @if (vars().length > 0) {
        <div class="fl-table-wrap rounded-fl-lg border border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Value</th>
                <th scope="col"><span class="fl-sr">Origin</span></th>
                <th scope="col" class="is-fit">Secret</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              @for (envVar of vars(); track $index; let i = $index) {
                @let meta = metaFor(envVar.key);
                <tr>
                  <td>
                    <div class="fl-input">
                      <input
                        type="text"
                        class="fl-mono"
                        placeholder="KEY_NAME"
                        [attr.aria-label]="'Name of variable ' + (i + 1)"
                        [value]="envVar.key"
                        (input)="keyChange.emit({ index: i, value: $any($event.target).value })"
                      />
                    </div>
                  </td>
                  <td class="is-wrap">
                    <div class="fl-input">
                      <input
                        class="fl-mono"
                        [type]="envVar.isSecret ? 'password' : 'text'"
                        [attr.aria-label]="'Value of ' + (envVar.key || 'variable ' + (i + 1))"
                        [value]="envVar.value"
                        [placeholder]="meta?.description ?? 'value'"
                        [title]="meta?.description ?? ''"
                        (input)="valueChange.emit({ index: i, value: $any($event.target).value })"
                      />
                    </div>
                    @if (meta?.description) {
                      <span class="mt-1 block text-fl-caption text-fl-ink-muted">{{
                        meta?.description
                      }}</span>
                    }
                  </td>
                  <td>
                    @if (isDefault(envVar)) {
                      <fl-status tone="warning" label="Default" />
                    } @else if (meta?.optional === false) {
                      <fl-tag>Required</fl-tag>
                    } @else if (meta?.optional === true) {
                      <fl-tag>Optional</fl-tag>
                    }
                  </td>
                  <td class="is-fit">
                    <label class="fl-check">
                      <input
                        type="checkbox"
                        [checked]="envVar.isSecret"
                        (change)="toggleSecret.emit(i)"
                      />
                      <span class="fl-sr">Secret</span>
                    </label>
                  </td>
                  <td class="is-fit">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      title="Remove"
                      [attr.aria-label]="'Remove ' + (envVar.key || 'variable ' + (i + 1))"
                      (click)="remove.emit(i)"
                    >
                      <fl-icon name="lucideTrash" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div>
        <button flButton="ghost" size="sm" type="button" (click)="add.emit()">
          <fl-icon name="lucidePlus" />
          Add variable
        </button>
      </div>
    } @else {
      <fl-field label="JSON" for="deploy-env-json" [error]="jsonError()">
        <textarea
          id="deploy-env-json"
          class="fl-textarea fl-mono"
          rows="10"
          [placeholder]="jsonPlaceholder"
          [value]="rawJson()"
          (input)="rawJsonChange.emit($any($event.target).value)"
        ></textarea>
      </fl-field>
    }

    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      Variables are optional. You can add them now or later.
    </p>
  `,
})
export class DeployEnvVars {
  readonly mode = input<EnvEditorMode>('key-value');
  readonly vars = input<readonly EnvironmentVariable[]>([]);
  readonly rawJson = input('{}');
  readonly jsonError = input<string | null>(null);
  readonly meta = input<ReadonlyMap<string, DetectedEnvVarDto>>(new Map());
  readonly unreviewedDefaults = input(false);
  readonly modeChange = output<EnvEditorMode>();
  readonly add = output<void>();
  readonly remove = output<number>();
  readonly keyChange = output<EnvRowEdit>();
  readonly valueChange = output<EnvRowEdit>();
  readonly toggleSecret = output<number>();
  readonly rawJsonChange = output<string>();

  protected readonly jsonPlaceholder =
    '{\n  "API_URL": "https://api.example.com",\n  "NODE_ENV": "production"\n}';

  protected metaFor(key: string): DetectedEnvVarDto | undefined {
    return this.meta().get(key);
  }

  protected isDefault(envVar: EnvironmentVariable): boolean {
    const meta = this.meta().get(envVar.key);
    return !!meta?.defaultValue && envVar.value === meta.defaultValue;
  }
}
