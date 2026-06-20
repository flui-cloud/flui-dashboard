import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCode,
  lucideCopy,
  lucideEye,
  lucideEyeOff,
  lucideKeyRound,
  lucideLoader,
  lucidePlus,
  lucideSave,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { SecretsConsoleStateService } from './secrets-console-state.service';
import { SecretsVersionHistoryComponent } from './secrets-version-history.component';
import {
  joinPath,
  parseBulk,
  rowsToData,
  toEnv,
  toJson,
} from './secrets-format';

@Component({
  selector: 'app-secrets-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    FormsModule,
    ConfirmationDialogComponent,
    SecretsVersionHistoryComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCode,
      lucideCopy,
      lucideEye,
      lucideEyeOff,
      lucideKeyRound,
      lucideLoader,
      lucidePlus,
      lucideSave,
      lucideTrash2,
      lucideX,
    }),
  ],
  template: `
    <div class="min-w-0 flex-1 rounded-xl border border-border bg-card">
      @if (!s.editing()) {
        <div
          class="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <ng-icon name="lucideKeyRound" class="h-8 w-8 opacity-30" />
          Select a secret, or create one with “New”.
        </div>
      } @else {
        <div
          class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
        >
          <ng-icon name="lucideKeyRound" class="h-4 w-4 text-primary" />
          @if (s.isNew()) {
            <span class="shrink-0 font-mono text-sm text-muted-foreground"
              >{{ s.server()?.mount || 'secret' }}/{{
                s.prefix() ? s.prefix() + '/' : ''
              }}</span
            >
            <input
              type="text"
              [(ngModel)]="newLeaf"
              placeholder="name (e.g. db)"
              class="h-9 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground"
            />
            <p class="w-full text-[11px] text-muted-foreground">
              Creates the secret
              <span class="font-mono text-foreground">{{ previewPath() }}</span
              >. Use <span class="font-mono">/</span> in the name to nest into
              sub-folders.
            </p>
          } @else {
            <span class="truncate font-mono text-sm font-medium text-foreground">{{
              s.selectedPath()
            }}</span>
            <button
              type="button"
              (click)="s.copy(s.selectedPath(), 'path')"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              title="Copy path"
            >
              <ng-icon
                [name]="s.copied() === 'path' ? 'lucideCheck' : 'lucideCopy'"
                class="h-3.5 w-3.5"
                [class.text-emerald-500]="s.copied() === 'path'"
              />
            </button>
            @if (s.selected(); as sec) {
              <select
                [ngModel]="s.viewVersion()"
                (ngModelChange)="s.changeVersion($event)"
                class="ml-auto h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              >
                @for (v of sec.versions; track v.version) {
                  <option [value]="v.version">
                    v{{ v.version
                    }}{{
                      v.destroyed
                        ? ' · destroyed'
                        : v.deleted
                          ? ' · deleted'
                          : ''
                    }}
                  </option>
                }
              </select>
            }
          }
        </div>

        @if (s.loadingSecret()) {
          <div class="space-y-3 p-4">
            <div class="h-8 w-48 animate-pulse rounded-lg bg-muted/60"></div>
            @for (i of skel; track i) {
              <div class="h-9 animate-pulse rounded-lg bg-muted/60"></div>
            }
          </div>
        } @else {
          <div
            class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"
          >
            <div class="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                (click)="setBulk(false)"
                class="rounded-md px-2.5 py-1 text-xs font-medium"
                [class.bg-muted]="!s.bulk()"
                [class.text-foreground]="!s.bulk()"
                [class.text-muted-foreground]="s.bulk()"
              >
                Fields
              </button>
              <button
                type="button"
                (click)="setBulk(true)"
                class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium"
                [class.bg-muted]="s.bulk()"
                [class.text-foreground]="s.bulk()"
                [class.text-muted-foreground]="!s.bulk()"
              >
                <ng-icon name="lucideCode" class="h-3.5 w-3.5" /> JSON / .env
              </button>
            </div>

            @if (!s.bulk()) {
              <button
                type="button"
                (click)="s.revealAll.set(!s.revealAll())"
                class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
              >
                <ng-icon
                  [name]="s.revealAll() ? 'lucideEyeOff' : 'lucideEye'"
                  class="h-3.5 w-3.5"
                />
                {{ s.revealAll() ? 'Hide values' : 'Reveal values' }}
              </button>
            }

            <div class="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                (click)="s.copy(toEnv(), 'env')"
                title="Copy as .env"
                class="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
              >
                <ng-icon
                  [name]="s.copied() === 'env' ? 'lucideCheck' : 'lucideCopy'"
                  class="h-3.5 w-3.5"
                  [class.text-emerald-500]="s.copied() === 'env'"
                />
                .env
              </button>
              <button
                type="button"
                (click)="s.copy(toJson(), 'json')"
                title="Copy as JSON"
                class="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
              >
                <ng-icon
                  [name]="s.copied() === 'json' ? 'lucideCheck' : 'lucideCopy'"
                  class="h-3.5 w-3.5"
                  [class.text-emerald-500]="s.copied() === 'json'"
                />
                JSON
              </button>
            </div>
          </div>

          <div class="p-4">
            @if (s.bulk()) {
              <textarea
                [(ngModel)]="bulkText"
                rows="10"
                [disabled]="s.readOnly()"
                placeholder='Paste JSON ({"KEY":"value"}) or .env (KEY=value) and Apply'
                class="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground disabled:opacity-70"
              ></textarea>
              <button
                type="button"
                (click)="applyBulk()"
                [disabled]="s.readOnly()"
                class="mt-2 inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
              >
                Apply to fields
              </button>
              @if (bulkError()) {
                <span class="ml-2 text-xs text-destructive">{{ bulkError() }}</span>
              }
            } @else {
              <div class="space-y-2">
                @for (row of s.rows(); track $index) {
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      [(ngModel)]="row.key"
                      [disabled]="s.readOnly()"
                      placeholder="key"
                      class="h-9 w-44 rounded-lg border border-border bg-background px-2.5 font-mono text-xs text-foreground disabled:opacity-70"
                    />
                    <div class="relative flex-1">
                      <input
                        [type]="s.isRevealed($index) ? 'text' : 'password'"
                        [(ngModel)]="row.value"
                        [disabled]="s.readOnly()"
                        placeholder="value"
                        class="h-9 w-full rounded-lg border border-border bg-background pl-2.5 pr-16 font-mono text-xs text-foreground disabled:opacity-70"
                      />
                      <div
                        class="absolute right-1 top-1/2 flex -translate-y-1/2 items-center"
                      >
                        <button
                          type="button"
                          (click)="s.toggleReveal($index)"
                          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                          [title]="s.isRevealed($index) ? 'Hide' : 'Reveal'"
                        >
                          <ng-icon
                            [name]="
                              s.isRevealed($index) ? 'lucideEyeOff' : 'lucideEye'
                            "
                            class="h-3.5 w-3.5"
                          />
                        </button>
                        <button
                          type="button"
                          (click)="s.copy(row.value, 'row' + $index)"
                          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                          title="Copy value"
                        >
                          <ng-icon
                            [name]="
                              s.copied() === 'row' + $index
                                ? 'lucideCheck'
                                : 'lucideCopy'
                            "
                            class="h-3.5 w-3.5"
                            [class.text-emerald-500]="s.copied() === 'row' + $index"
                          />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      (click)="s.removeRow($index)"
                      [disabled]="s.readOnly()"
                      class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <ng-icon name="lucideX" class="h-4 w-4" />
                    </button>
                  </div>
                }
              </div>
              <button
                type="button"
                (click)="s.addRow()"
                [disabled]="s.readOnly()"
                class="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ng-icon name="lucidePlus" class="h-3.5 w-3.5" /> Add field
              </button>
            }

            <div
              class="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4"
            >
              <button
                type="button"
                (click)="save()"
                [disabled]="
                  s.saving() || s.readOnly() || (s.isNew() && !newLeaf.trim())
                "
                class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                @if (s.saving()) {
                  <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                } @else {
                  <ng-icon name="lucideSave" class="h-4 w-4" />
                }
                {{ saveLabel() }}
              </button>
              @if (!s.isNew()) {
                <button
                  type="button"
                  (click)="askSoftDelete()"
                  [disabled]="s.readOnly() || s.saving()"
                  class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <ng-icon name="lucideTrash2" class="h-4 w-4" /> Delete latest
                </button>
                <button
                  type="button"
                  (click)="askDestroy()"
                  [disabled]="s.readOnly() || s.saving()"
                  class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-40"
                >
                  <ng-icon name="lucideTrash2" class="h-4 w-4" /> Destroy
                </button>
              }
              @if (s.readOnly()) {
                <span class="text-xs text-muted-foreground"
                  >Turn off read-only to change.</span
                >
              }
              @if (s.saveOk()) {
                <span
                  class="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                  ><ng-icon name="lucideCheck" class="h-3.5 w-3.5" /> Saved</span
                >
              }
              @if (s.editError()) {
                <span class="text-xs text-destructive">{{ s.editError() }}</span>
              }
            </div>
          </div>

          <app-secrets-version-history />
        }
      }
    </div>

    <app-confirmation-dialog
      #destroyDialog
      title="Destroy secret"
      [message]="
        'Permanently destroy “' +
        s.selectedPath() +
        '” and all its versions? This cannot be undone.'
      "
      confirmText="Destroy"
      variant="danger"
      (confirmed)="confirmDestroy()"
    />

    <app-confirmation-dialog
      #deleteDialog
      title="Delete latest version"
      [message]="
        'Delete the latest version of “' +
        s.selectedPath() +
        '”? You can restore it later from the version history.'
      "
      confirmText="Delete latest"
      variant="warning"
      (confirmed)="confirmSoftDelete()"
    />
  `,
})
export class SecretsEditorComponent {
  protected readonly s = inject(SecretsConsoleStateService);

  readonly skel = [0, 1, 2, 3, 4];
  newLeaf = '';
  bulkText = '';
  readonly bulkError = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.s.newSeq();
      this.newLeaf = '';
    });
  }

  @ViewChild('destroyDialog')
  private readonly destroyDialog?: ConfirmationDialogComponent;
  @ViewChild('deleteDialog')
  private readonly deleteDialog?: ConfirmationDialogComponent;

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
      this.bulkError.set('Could not parse as JSON object or .env (KEY=value).');
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

  askSoftDelete(): void {
    this.deleteDialog?.open();
  }
  confirmSoftDelete(): void {
    this.s.removeSecret(false, this.deleteDialog);
  }
  askDestroy(): void {
    this.destroyDialog?.open();
  }
  confirmDestroy(): void {
    this.s.removeSecret(true, this.destroyDialog);
  }
}
