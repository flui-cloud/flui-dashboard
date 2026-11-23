import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideEye,
  lucideEyeOff,
  lucideKeyRound,
  lucideSave,
} from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { SecretsConsoleStateService } from './secrets-console-state.service';
import { SecretsFields } from './secrets-fields';
import { SecretsVersionHistoryComponent } from './secrets-version-history.component';
import { joinPath, parseBulk, rowsToData, toEnv, toJson } from './secrets-format';

@Component({
  selector: 'app-secrets-editor',
  imports: [
    FormsModule,
    FlAlert,
    FlButton,
    FlCopyId,
    FlEmptyState,
    FlField,
    FlIcon,
    FlLoadingState,
    FlPanel,
    FlSpinner,
    FlStatus,
    SecretsFields,
    SecretsVersionHistoryComponent,
  ],
  providers: [
    provideIcons({ lucideCheck, lucideCopy, lucideEye, lucideEyeOff, lucideKeyRound, lucideSave }),
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (!s.editing()) {
      <fl-panel>
        <fl-empty-state
          icon="lucideKeyRound"
          title="No secret open"
          body="Select a secret on the left, or create one with New."
        />
      </fl-panel>
    } @else {
      <fl-panel [title]="s.isNew() ? 'New secret' : 'Secret'" [flush]="true">
        @if (!s.isNew() && s.selected(); as sec) {
          <span panelActions class="fl-select-wrap">
            <select
              class="fl-select fl-select--sm"
              aria-label="Version"
              [ngModel]="s.viewVersion()"
              (ngModelChange)="s.changeVersion($event)"
            >
              @for (v of sec.versions; track v.version) {
                <option [value]="v.version">
                  Version {{ v.version
                  }}{{ v.destroyed ? ', destroyed' : v.deleted ? ', deleted' : '' }}
                </option>
              }
            </select>
          </span>
        }

        <div class="border-b border-fl-border p-4">
          @if (s.isNew()) {
            <fl-field
              label="Name"
              for="secret-new-leaf"
              [hint]="'Creates ' + previewPath() + '. Use / in the name to nest into folders.'"
            >
              <div class="fl-input fl-input--lg font-mono">
                <span class="text-fl-ink-muted"
                  >{{ s.server()?.mount || 'secret' }}/{{
                    s.prefix() ? s.prefix() + '/' : ''
                  }}</span
                >
                <input id="secret-new-leaf" type="text" placeholder="db" [(ngModel)]="newLeaf" />
              </div>
            </fl-field>
          } @else {
            <fl-copy-id [value]="s.selectedPath()" label="path" />
          }
        </div>

        @if (s.loadingSecret()) {
          <fl-loading-state [rows]="5" />
        } @else {
          <div class="fl-toolbar">
            <div class="fl-toolbar__group">
              <div class="fl-segmented" role="group" aria-label="Editor">
                <button type="button" [attr.aria-pressed]="!s.bulk()" (click)="setBulk(false)">
                  Fields
                </button>
                <button type="button" [attr.aria-pressed]="s.bulk()" (click)="setBulk(true)">
                  JSON or .env
                </button>
              </div>
              @if (!s.bulk()) {
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [disabled]="s.maskModeOn()"
                  [attr.aria-pressed]="s.revealAll()"
                  [title]="s.maskModeOn() ? 'Turn off mask mode to reveal' : ''"
                  (click)="s.revealAll.set(!s.revealAll())"
                >
                  <fl-icon [name]="s.revealAll() ? 'lucideEyeOff' : 'lucideEye'" [size]="14" />
                  {{ s.revealAll() ? 'Hide values' : 'Reveal values' }}
                </button>
              }
            </div>
            <div class="fl-toolbar__group">
              <button
                flButton="ghost"
                size="sm"
                type="button"
                title="Copy as .env"
                (click)="s.copy(toEnv(), 'env')"
              >
                <fl-icon [name]="s.copied() === 'env' ? 'lucideCheck' : 'lucideCopy'" [size]="14" />
                .env
              </button>
              <button
                flButton="ghost"
                size="sm"
                type="button"
                title="Copy as JSON"
                (click)="s.copy(toJson(), 'json')"
              >
                <fl-icon
                  [name]="s.copied() === 'json' ? 'lucideCheck' : 'lucideCopy'"
                  [size]="14"
                />
                JSON
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-4 p-4">
            @if (s.bulk()) {
              <fl-field
                label="Paste values"
                for="secret-bulk"
                hint="A JSON object or .env lines (KEY=value), then apply them to the fields."
                [error]="bulkError()"
              >
                <textarea
                  id="secret-bulk"
                  class="fl-textarea font-mono"
                  rows="10"
                  [disabled]="s.readOnly()"
                  [(ngModel)]="bulkText"
                ></textarea>
              </fl-field>
              <div>
                <button
                  flButton
                  size="sm"
                  type="button"
                  [disabled]="s.readOnly()"
                  (click)="applyBulk()"
                >
                  Apply to fields
                </button>
              </div>
            } @else {
              <app-secrets-fields />
            }

            @if (s.editError()) {
              <fl-alert tone="error" title="Request failed">{{ s.editError() }}</fl-alert>
            }

            <div class="fl-row border-t border-fl-border pt-4">
              <button
                flButton="primary"
                type="button"
                [disabled]="s.saving() || s.readOnly() || (s.isNew() && !newLeaf.trim())"
                (click)="save()"
              >
                @if (s.saving()) {
                  <fl-spinner label="Saving" />
                } @else {
                  <fl-icon name="lucideSave" [size]="14" />
                }
                {{ saveLabel() }}
              </button>
              @if (!s.isNew()) {
                <button
                  flButton
                  type="button"
                  [disabled]="s.readOnly() || s.saving()"
                  (click)="askSoftDelete()"
                >
                  Delete latest
                </button>
                <button
                  flButton="danger"
                  type="button"
                  [disabled]="s.readOnly() || s.saving()"
                  (click)="askDestroy()"
                >
                  Destroy
                </button>
              }
              @if (s.readOnly()) {
                <span class="text-fl-caption text-fl-ink-muted"
                  >Allow writes to change this secret.</span
                >
              }
              @if (s.saveOk()) {
                <fl-status tone="success" label="Saved" />
              }
            </div>
          </div>
        }
      </fl-panel>

      @if (!s.loadingSecret()) {
        <app-secrets-version-history />
      }
    }
  `,
})
export class SecretsEditorComponent {
  protected readonly s = inject(SecretsConsoleStateService);
  private readonly confirm = inject(ConfirmService);

  newLeaf = '';
  bulkText = '';
  readonly bulkError = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.s.newSeq();
      this.newLeaf = '';
    });
  }

  previewPath(): string {
    return joinPath(this.s.prefix(), this.newLeaf.trim()) || '…';
  }

  toEnv(): string {
    return toEnv(rowsToData(this.s.rows()));
  }
  toJson(): string {
    return toJson(rowsToData(this.s.rows()));
  }

  setBulk(on: boolean): void {
    this.bulkError.set(null);
    if (on) this.bulkText = this.toJson();
    this.s.bulk.set(on);
  }
  applyBulk(): void {
    this.bulkError.set(null);
    const parsed = parseBulk(this.bulkText);
    if (!parsed) {
      this.bulkError.set('Could not read this as a JSON object or as .env lines (KEY=value).');
      return;
    }
    this.s.setRows(parsed);
    this.s.bulk.set(false);
  }

  saveLabel(): string {
    if (this.s.isNew()) return 'Create';
    const sec = this.s.selected();
    const v = this.s.viewVersion();
    if (sec && v !== null && v !== sec.version) {
      return 'Restore as new version';
    }
    return 'Save new version';
  }

  save(): void {
    this.s.save(rowsToData(this.s.rows()), this.newLeaf);
  }

  async askSoftDelete(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete latest version',
      body: `Delete the latest version of ${this.s.selectedPath()}? You can restore it later from the version history.`,
      confirmLabel: 'Delete latest',
      destructive: true,
    });
    if (ok) this.s.removeSecret(false);
  }

  async askDestroy(): Promise<void> {
    const path = this.s.selectedPath();
    const ok = await this.confirm.confirm({
      title: `Destroy ${path}`,
      body: 'This permanently destroys the secret and all its versions. It cannot be undone.',
      confirmLabel: 'Destroy secret',
      destructive: true,
      typeToConfirm: path,
    });
    if (ok) this.s.removeSecret(true);
  }
}
