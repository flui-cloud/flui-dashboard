import {
  Component,
  OnChanges,
  SimpleChanges,
  signal,
  input,
  output,
  inject,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideCode, lucideList, lucidePlus } from '@ng-icons/lucide';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlField } from '../../../ui/patterns/field';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlTag } from '../../../ui/primitives/tag';
import { VariableValueDialog } from './variable-value-dialog';
import { VariablesTable } from './variables-table';
import {
  HIDDEN_VALUE,
  VarRow,
  buildVarRows,
  isDirtyRow,
  parseJsonVariables,
  valueTypeLabel,
  varRow,
} from './variable-rows';

export interface VariablesSavePayload {
  data: Record<string, string>;
  deleteKeys: string[];
}

let nextId = 0;

@Component({
  selector: 'app-variables-editor',
  standalone: true,
  imports: [
    FormsModule,
    FlPanel,
    FlField,
    FlEmptyState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlTag,
    VariableValueDialog,
    VariablesTable,
  ],
  providers: [provideIcons({ lucideCode, lucideList, lucidePlus })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <fl-panel [title]="title()" [count]="rows().length" [flush]="true">
      <ng-container panelActions>
        @if (saving()) {
          <fl-spinner label="Saving" />
        }
        @if (isSensitiveSection) {
          <fl-tag>Write-only</fl-tag>
        } @else {
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-pressed]="jsonMode()"
            (click)="toggleJsonMode()"
          >
            <fl-icon [name]="jsonMode() ? 'lucideList' : 'lucideCode'" />
            {{ jsonMode() ? 'Rows' : 'JSON' }}
          </button>
        }
        @if (!jsonMode()) {
          <button
            flButton
            size="sm"
            type="button"
            [disabled]="showAddForm()"
            (click)="startAddRow()"
          >
            <fl-icon name="lucidePlus" />
            {{ isSensitiveSection ? 'Add secret' : 'Add variable' }}
          </button>
        }
      </ng-container>

      @if (jsonMode()) {
        <div class="p-4">
          <fl-field
            label="Variables as JSON"
            [for]="uid + '-json'"
            hint="A flat object of strings. Keys you remove are deleted when you save."
            [error]="jsonError()"
          >
            <textarea
              class="fl-textarea fl-mono"
              [id]="uid + '-json'"
              rows="12"
              spellcheck="false"
              placeholder='{ "KEY": "value" }'
              [(ngModel)]="jsonText"
              (ngModelChange)="onJsonChange($event)"
            ></textarea>
          </fl-field>
        </div>
      } @else {
        @if (rows().length > 0) {
          <app-variables-table
            [rows]="rows()"
            [reveal]="showValues()"
            [revealLocked]="maskMode.enabled()"
            (edit)="startEdit($event)"
            (openEditor)="openExpandModalFromReadOnly($event)"
            (expandEditing)="openExpandModal($event, rows()[$event].editingSecret)"
            (done)="finishEdit($event)"
            (cancelEdit)="cancelEdit($event)"
            (remove)="removeRow($event)"
            (toggleReveal)="toggleValues()"
          />
        } @else if (!showAddForm()) {
          <fl-empty-state
            [compact]="true"
            [title]="isSensitiveSection ? 'No secrets' : 'No variables'"
            [body]="
              isSensitiveSection
                ? 'Secrets are injected as environment variables and never shown again.'
                : 'Variables are injected as environment variables at start.'
            "
          />
        }

        @if (showAddForm()) {
          <div
            class="flex flex-col gap-3 border-fl-border p-4 sm:flex-row sm:items-end"
            [class.border-t]="rows().length > 0"
          >
            <fl-field class="flex-1" label="Key" [for]="uid + '-key'">
              <div class="fl-input fl-input--lg">
                <input
                  class="fl-mono"
                  type="text"
                  placeholder="KEY"
                  autocomplete="off"
                  [id]="uid + '-key'"
                  [(ngModel)]="newKey"
                />
              </div>
            </fl-field>
            <fl-field class="flex-1" label="Value" [for]="uid + '-value'">
              <div class="fl-input fl-input--lg">
                <input
                  class="fl-mono"
                  placeholder="value"
                  autocomplete="off"
                  [id]="uid + '-value'"
                  [type]="isSensitiveSection ? 'password' : 'text'"
                  [(ngModel)]="newValue"
                />
              </div>
            </fl-field>
            <div class="flex gap-2">
              <button flButton="ghost" type="button" (click)="cancelAddRow()">Cancel</button>
              <button flButton type="button" [disabled]="!newKey.trim()" (click)="confirmAddRow()">
                Add
              </button>
            </div>
          </div>
        }
      }

      @if (isDirty()) {
        <div
          class="flex flex-wrap items-center justify-end gap-2 border-t border-fl-border bg-fl-surface-subtle px-4 py-3"
        >
          <span class="mr-auto text-fl-body-sm text-fl-ink-muted">Unsaved changes</span>
          <button flButton="ghost" type="button" [disabled]="saving()" (click)="discard()">
            Cancel
          </button>
          <button
            flButton="primary"
            type="button"
            [disabled]="saving() || !canSave()"
            (click)="onSave()"
          >
            Save changes
          </button>
        </div>
      }
    </fl-panel>

    @if (expandModal(); as modal) {
      <app-variable-value-dialog
        [name]="modal.key"
        [value]="modal.editValue"
        [sensitive]="modal.isSensitive"
        [typeLabel]="modal.typeLabel"
        [reveal]="showValues()"
        [revealLocked]="maskMode.enabled()"
        (applied)="confirmExpandModal($event)"
        (closed)="closeExpandModal()"
        (toggleReveal)="toggleValues()"
      />
    }
  `,
})
export class AppVariablesEditorComponent implements OnChanges {
  readonly title = input('Variables');
  readonly data = input<Record<string, string>>({});
  readonly sensitiveKeys = input<string[]>([]);
  readonly pendingKeys = input<string[]>([]);
  readonly saving = input(false);

  readonly save = output<VariablesSavePayload>();

  protected readonly maskMode = inject(MaskModeService);
  protected readonly uid = `variables-${nextId++}`;

  constructor() {
    effect(() => {
      if (this.maskMode.enabled()) this.showValues.set(false);
    });
  }

  protected rows = signal<VarRow[]>([]);
  protected deletedKeys = signal<Set<string>>(new Set());
  protected showAddForm = signal(false);
  protected showValues = signal(false);
  protected newKey = '';
  protected newValue = '';

  protected jsonMode = signal(false);
  protected jsonText = '';
  protected jsonError = signal<string | null>(null);
  private readonly jsonParsed = signal<Record<string, string> | null>(null);

  protected expandModal = signal<{
    rowIndex: number;
    key: string;
    editValue: string;
    isSensitive: boolean;
    typeLabel: string;
  } | null>(null);

  get isSensitiveSection(): boolean {
    return this.sensitiveKeys().length > 0 || this.pendingKeys().length > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['sensitiveKeys'] || changes['pendingKeys']) {
      this.rebuildRows();
      if (this.jsonMode()) this.resetJson();
    }
  }

  private rebuildRows(): void {
    this.rows.set(buildVarRows(this.data(), this.sensitiveKeys(), this.pendingKeys()));
    this.deletedKeys.set(new Set());
  }

  private buildJsonText(): string {
    const plain: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.data())) {
      if (!this.sensitiveKeys().includes(k)) plain[k] = v;
    }
    return JSON.stringify(plain, null, 2);
  }

  private resetJson(): void {
    this.jsonText = this.buildJsonText();
    this.jsonParsed.set(null);
    this.jsonError.set(null);
  }

  private patch(index: number, change: (row: VarRow) => Partial<VarRow>): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, ...change(r) } : r)));
  }

  /** Opens modal from read-only state (starts edit mode too) */
  protected openExpandModalFromReadOnly(index: number): void {
    const sensitive = this.rows()[index].isSensitive;
    this.startEdit(index);
    this.openExpandModal(index, sensitive);
  }

  /** Opens modal while already in inline-edit state */
  protected openExpandModal(index: number, isSensitive: boolean): void {
    const row = this.rows()[index];
    this.expandModal.set({
      rowIndex: index,
      key: row.key,
      editValue: isSensitive ? row.newSecretValue : row.newPlainValue,
      isSensitive,
      typeLabel: isSensitive ? 'Secret' : valueTypeLabel(row.value),
    });
  }

  protected closeExpandModal(): void {
    this.expandModal.set(null);
  }

  protected confirmExpandModal(editValue: string): void {
    const modal = this.expandModal();
    if (!modal) return;
    this.patch(modal.rowIndex, () =>
      modal.isSensitive
        ? { value: editValue, newSecretValue: editValue, editingSecret: false }
        : { value: editValue, newPlainValue: editValue, editingPlain: false },
    );
    this.expandModal.set(null);
  }

  protected toggleJsonMode(): void {
    if (this.jsonMode()) {
      this.jsonMode.set(false);
      this.jsonError.set(null);
      this.jsonParsed.set(null);
    } else {
      const current: Record<string, string> = {};
      for (const row of this.rows()) {
        if (!row.isSensitive) current[row.key] = row.value;
      }
      this.jsonText = JSON.stringify(current, null, 2);
      this.jsonParsed.set(null);
      this.jsonError.set(null);
      this.jsonMode.set(true);
    }
  }

  protected onJsonChange(text: string): void {
    const result = parseJsonVariables(text);
    this.jsonError.set(result.ok ? null : result.error);
    this.jsonParsed.set(result.ok ? result.data : null);
  }

  protected isDirty(): boolean {
    if (this.jsonMode()) return this.jsonParsed() !== null;
    return this.deletedKeys().size > 0 || this.rows().some(isDirtyRow);
  }

  protected canSave(): boolean {
    if (this.jsonMode()) return this.jsonParsed() !== null && !this.jsonError();
    return this.rows()
      .filter((r) => r.isNew)
      .every((r) => r.key.trim() && r.value.trim());
  }

  protected discard(): void {
    this.rebuildRows();
    this.showAddForm.set(false);
    if (this.jsonMode()) this.resetJson();
  }

  protected startEdit(index: number): void {
    this.patch(index, (r) =>
      r.isSensitive
        ? { editingSecret: true, newSecretValue: '' }
        : { editingPlain: true, newPlainValue: r.value },
    );
  }

  protected cancelEdit(index: number): void {
    this.patch(index, (r) =>
      r.editingSecret
        ? { editingSecret: false, newSecretValue: '' }
        : { editingPlain: false, newPlainValue: '' },
    );
  }

  protected finishEdit(index: number): void {
    this.patch(index, (r) =>
      r.editingSecret
        ? { value: r.newSecretValue, editingSecret: false, newSecretValue: '' }
        : { value: r.newPlainValue, editingPlain: false, newPlainValue: '' },
    );
  }

  protected startAddRow(): void {
    this.newKey = '';
    this.newValue = '';
    this.showAddForm.set(true);
  }

  protected cancelAddRow(): void {
    this.showAddForm.set(false);
  }

  protected confirmAddRow(): void {
    if (!this.newKey.trim()) return;
    this.rows.update((rows) => [
      ...rows,
      varRow(this.newKey.trim(), this.newValue, { isNew: true }),
    ]);
    this.showAddForm.set(false);
  }

  protected removeRow(index: number): void {
    const row = this.rows()[index];
    if (!row.isNew) {
      this.deletedKeys.update((s) => new Set([...s, row.key]));
    }
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected toggleValues(): void {
    this.showValues.update((v) => !v);
  }

  protected onSave(): void {
    if (this.jsonMode()) {
      const parsed = this.jsonParsed();
      if (!parsed) return;
      const deleteKeys = Object.keys(this.data()).filter(
        (k) => !this.sensitiveKeys().includes(k) && !(k in parsed),
      );
      this.save.emit({ data: parsed, deleteKeys });
      return;
    }
    const data: Record<string, string> = {};
    for (const row of this.rows()) {
      const key = row.key.trim();
      if (!key) continue;
      if (row.isSensitive && row.value === HIDDEN_VALUE) continue;
      data[key] = row.value;
    }
    this.save.emit({ data, deleteKeys: [...this.deletedKeys()] });
  }
}
