import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideTrash2,
  lucideSave,
  lucideLock,
  lucideEye,
  lucideEyeOff,
  lucideKey,
  lucideLoader,
  lucidePencil,
  lucideX,
  lucideCode,
  lucideList,
  lucideMaximize2,
} from '@ng-icons/lucide';

interface VarRow {
  key: string;
  value: string;
  originalValue: string;
  isNew: boolean;
  isSensitive: boolean;
  editingPlain: boolean;
  newPlainValue: string;
  editingSecret: boolean;
  newSecretValue: string;
}

export interface VariablesSavePayload {
  data: Record<string, string>;
  deleteKeys: string[];
}

/** Detects if a string looks like JSON, YAML, or is long enough to need a big editor. */
function detectValueType(value: string): 'json' | 'yaml' | 'long' | 'plain' {
  const trimmed = value.trim();
  if (!trimmed) return 'plain';
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return 'json'; } catch { /* not valid JSON */ }
  }
  // YAML heuristics: contains newlines + colon-separated lines, or starts with ---
  if (trimmed.includes('\n') || trimmed.startsWith('---') ||
      /^[a-zA-Z_]\w*:\s/.test(trimmed)) {
    return 'yaml';
  }
  if (value.length > 80) return 'long';
  return 'plain';
}


@Component({
  selector: 'app-variables-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucidePlus, lucideTrash2, lucideSave, lucideLock,
      lucideEye, lucideEyeOff, lucideKey, lucideLoader,
      lucidePencil, lucideX, lucideCode, lucideList, lucideMaximize2,
    }),
  ],
  template: `
    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <ng-icon
            [name]="isSensitiveSection ? 'lucideLock' : 'lucideKey'"
            class="h-4 w-4 text-gray-500 dark:text-gray-400"
          />
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</h4>
          @if (isSensitiveSection) {
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              Write-only
            </span>
          }
        </div>
        <div class="flex items-center gap-2">
          @if (saving) {
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-blue-600" />
          }
          @if (!isSensitiveSection) {
            <button
              type="button"
              (click)="toggleJsonMode()"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors"
              [class]="jsonMode()
                ? 'border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'"
            >
              <ng-icon [name]="jsonMode() ? 'lucideList' : 'lucideCode'" class="h-3.5 w-3.5" />
              {{ jsonMode() ? 'Row view' : 'JSON' }}
            </button>
          }
          @if (isDirty()) {
            <button
              type="button"
              (click)="onSave()"
              [disabled]="saving || !canSave()"
              class="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ng-icon name="lucideSave" class="h-3.5 w-3.5" />
              Save changes
            </button>
          }
        </div>
      </div>

      <!-- ── JSON MODE ── -->
      @if (jsonMode()) {
        <div class="space-y-2">
          <textarea
            [(ngModel)]="jsonText"
            (ngModelChange)="onJsonChange($event)"
            rows="12"
            spellcheck="false"
            class="w-full font-mono text-xs px-3 py-2 bg-white dark:bg-gray-800 border rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-y"
            [class]="jsonError() ? 'border-red-400 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'"
            placeholder='{ "KEY": "value" }'
          ></textarea>
          @if (jsonError()) {
            <p class="text-xs text-red-600 dark:text-red-400">{{ jsonError() }}</p>
          }
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Edit as a flat JSON object. Keys already in the dataset will be overwritten; others will be added via upsert.
          </p>
        </div>
      } @else {

        <!-- ── ROW MODE ── -->
        @if (rows().length > 0) {
          <div class="overflow-hidden rounded border border-gray-200 dark:border-gray-600">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                  <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-2/5">KEY</th>
                  <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">VALUE</th>
                  <th class="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                @for (row of rows(); track row.key; let i = $index) {
                  <tr [class]="isDirtyRow(row) ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800/50'">

                    <!-- KEY -->
                    <td class="px-3 py-1.5 align-top">
                      <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ row.key }}</span>
                    </td>

                    <!-- VALUE -->
                    <td class="px-3 py-1.5 align-top">
                      @if (row.isSensitive) {
                        @if (row.editingSecret) {
                          <div class="flex items-center gap-1.5">
                            <input
                              [type]="showValues() ? 'text' : 'password'"
                              [(ngModel)]="row.newSecretValue"
                              placeholder="new value"
                              class="flex-1 font-mono text-xs px-2 py-1 bg-white dark:bg-gray-800 border border-blue-400 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                            />
                            <button type="button" (click)="toggleValues()" class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                              <ng-icon [name]="showValues() ? 'lucideEyeOff' : 'lucideEye'" class="h-3.5 w-3.5" />
                            </button>
                            <button type="button" (click)="openExpandModal(i, true)" class="flex-shrink-0 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400" title="Expand editor">
                              <ng-icon name="lucideMaximize2" class="h-3.5 w-3.5" />
                            </button>
                            <button type="button" (click)="confirmSecretEdit(i)" [disabled]="!row.newSecretValue.trim()" class="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">OK</button>
                            <button type="button" (click)="cancelSecretEdit(i)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                              <ng-icon name="lucideX" class="h-3.5 w-3.5" />
                            </button>
                          </div>
                        } @else {
                          <span class="font-mono text-xs text-gray-400 dark:text-gray-500 select-none">
                            {{ isDirtyRow(row) ? '(updated)' : '****' }}
                          </span>
                        }
                      } @else if (row.editingPlain) {
                        <div class="flex items-start gap-1.5">
                          <input
                            type="text"
                            [(ngModel)]="row.newPlainValue"
                            placeholder="value"
                            class="flex-1 font-mono text-xs px-2 py-1 bg-white dark:bg-gray-800 border border-blue-400 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                          />
                          <button type="button" (click)="openExpandModal(i, false)" class="flex-shrink-0 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 mt-0.5" title="Expand editor">
                            <ng-icon name="lucideMaximize2" class="h-3.5 w-3.5" />
                          </button>
                          <button type="button" (click)="confirmPlainEdit(i)" class="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 mt-0.5">OK</button>
                          <button type="button" (click)="cancelPlainEdit(i)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5">
                            <ng-icon name="lucideX" class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      } @else {
                        <!-- Read-only display — show type badge if complex -->
                        <div class="flex items-start gap-1.5 min-w-0">
                          <span
                            class="font-mono text-xs truncate max-w-xs"
                            [class]="isDirtyRow(row) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'"
                            [title]="row.value"
                          >
                            {{ row.value || '—' }}
                          </span>
                          @if (getValueTypeBadge(row.value); as badge) {
                            <span class="flex-shrink-0 inline-flex items-center px-1 py-0 rounded text-[10px] font-medium {{ badge.class }}">
                              {{ badge.label }}
                            </span>
                          }
                        </div>
                      }
                    </td>

                    <!-- ACTIONS -->
                    <td class="px-3 py-1.5 align-top">
                      <div class="flex items-center justify-end gap-1.5">
                        @if (!row.editingPlain && !row.editingSecret) {
                          <button
                            type="button"
                            (click)="row.isSensitive ? startSecretEdit(i) : startPlainEdit(i)"
                            class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                            title="Edit"
                          >
                            <ng-icon name="lucidePencil" class="h-3.5 w-3.5" />
                          </button>
                          <!-- Expand button: always shown, opens modal directly -->
                          <button
                            type="button"
                            (click)="openExpandModalFromReadOnly(i)"
                            class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                            title="Open in full editor"
                          >
                            <ng-icon name="lucideMaximize2" class="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            (click)="removeRow(i)"
                            class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-sm text-gray-500 dark:text-gray-400 italic">
            {{ isSensitiveSection ? 'No secrets configured' : 'No variables configured' }}
          </p>
        }

        <!-- Add new variable form -->
        @if (showAddForm()) {
          <div class="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <input
              type="text"
              [(ngModel)]="newKey"
              placeholder="KEY"
              class="flex-1 font-mono text-xs px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <input
              [type]="isSensitiveSection ? 'password' : 'text'"
              [(ngModel)]="newValue"
              placeholder="value"
              class="flex-1 font-mono text-xs px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button type="button" (click)="confirmAddRow()" [disabled]="!newKey.trim()" class="px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Add</button>
            <button type="button" (click)="cancelAddRow()" class="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Cancel</button>
          </div>
        }

        <!-- Footer -->
        <div class="flex items-center pt-1">
          <button
            type="button"
            (click)="startAddRow()"
            [disabled]="showAddForm()"
            class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
            Add {{ isSensitiveSection ? 'secret' : 'variable' }}
          </button>
        </div>
      }
    </div>

    <!-- ── EXPAND MODAL ── -->
    @if (expandModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" (click)="closeExpandModal()">
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]" (click)="$event.stopPropagation()">

          <!-- Modal header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-2">
              <ng-icon
                [name]="expandModal()!.isSensitive ? 'lucideLock' : 'lucideCode'"
                class="h-4 w-4 text-gray-500 dark:text-gray-400"
              />
              <span class="text-sm font-semibold text-gray-900 dark:text-white font-mono">{{ expandModal()!.key }}</span>
              @if (expandModal()!.typeLabel) {
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {{ expandModal()!.typeBadgeClass }}">
                  {{ expandModal()!.typeLabel }}
                </span>
              }
            </div>
            <button type="button" (click)="closeExpandModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ng-icon name="lucideX" class="h-5 w-5" />
            </button>
          </div>

          <!-- Modal body -->
          <div class="flex-1 overflow-auto p-5 space-y-3">
            @if (expandModal()!.isSensitive) {
              <div class="flex items-center gap-2 mb-1">
                <button type="button" (click)="toggleValues()" class="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <ng-icon [name]="showValues() ? 'lucideEyeOff' : 'lucideEye'" class="h-3.5 w-3.5" />
                  {{ showValues() ? 'Hide' : 'Show' }} value
                </button>
              </div>
              <textarea
                [(ngModel)]="expandModal()!.editValue"
                rows="12"
                spellcheck="false"
                placeholder="Enter new secret value..."
                class="w-full font-mono text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-y"
                [class.blur-sm]="!showValues()"
              ></textarea>
            } @else {
              <textarea
                [(ngModel)]="expandModal()!.editValue"
                rows="16"
                spellcheck="false"
                placeholder="Enter value..."
                class="w-full font-mono text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-y"
              ></textarea>
            }
            <p class="text-xs text-gray-400 dark:text-gray-500">
              {{ expandModal()!.isSensitive ? 'Value will be stored as a Secret. It will never be readable back.' : 'Tip: you can paste multi-line JSON, YAML, or long strings directly.' }}
            </p>
          </div>

          <!-- Modal footer -->
          <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" (click)="closeExpandModal()" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="button"
              (click)="confirmExpandModal()"
              [disabled]="!expandModal()!.editValue.trim() && expandModal()!.isSensitive"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ng-icon name="lucideSave" class="h-4 w-4" />
              Apply
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppVariablesEditorComponent implements OnChanges {
  @Input() title = 'Variables';
  @Input() data: Record<string, string> = {};
  @Input() sensitiveKeys: string[] = [];
  @Input() saving = false;

  @Output() save = new EventEmitter<VariablesSavePayload>();

  protected rows = signal<VarRow[]>([]);
  protected deletedKeys = signal<Set<string>>(new Set());
  protected showAddForm = signal(false);
  protected showValues = signal(false);
  protected newKey = '';
  protected newValue = '';

  // JSON mode
  protected jsonMode = signal(false);
  protected jsonText = '';
  protected jsonError = signal<string | null>(null);
  private readonly jsonParsed = signal<Record<string, string> | null>(null);

  // Expand modal state
  protected expandModal = signal<{
    rowIndex: number;
    key: string;
    editValue: string;
    isSensitive: boolean;
    typeLabel: string;
    typeBadgeClass: string;
  } | null>(null);

  get isSensitiveSection(): boolean {
    return this.sensitiveKeys.length > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['sensitiveKeys']) {
      this.rebuildRows();
      if (this.jsonMode()) {
        this.jsonText = this.buildJsonText();
        this.jsonParsed.set(null);
        this.jsonError.set(null);
      }
    }
  }

  private rebuildRows(): void {
    const sensitiveSet = new Set(this.sensitiveKeys);
    this.rows.set(
      Object.entries(this.data).map(([key, value]) => ({
        key,
        value: sensitiveSet.has(key) ? '****' : value,
        originalValue: sensitiveSet.has(key) ? '****' : value,
        isNew: false,
        isSensitive: sensitiveSet.has(key),
        editingPlain: false,
        newPlainValue: '',
        editingSecret: false,
        newSecretValue: '',
      }))
    );
    this.deletedKeys.set(new Set());
  }

  private buildJsonText(): string {
    const plain: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.data)) {
      if (!this.sensitiveKeys.includes(k)) plain[k] = v;
    }
    return JSON.stringify(plain, null, 2);
  }

  // ── Value type badge ──────────────────────────────────────────────────────

  protected getValueTypeBadge(value: string): { label: string; class: string } | null {
    const t = detectValueType(value);
    if (t === 'json') return { label: 'JSON', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
    if (t === 'yaml') return { label: 'YAML', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    if (t === 'long') return { label: 'long', class: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
    return null;
  }

  private getModalBadge(value: string, isSensitive: boolean): { typeLabel: string; typeBadgeClass: string } {
    if (isSensitive) return { typeLabel: 'secret', typeBadgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
    const badge = this.getValueTypeBadge(value);
    return { typeLabel: badge?.label ?? '', typeBadgeClass: badge?.class ?? '' };
  }

  // ── Expand modal ──────────────────────────────────────────────────────────

  /** Opens modal from read-only state (starts edit mode too) */
  protected openExpandModalFromReadOnly(index: number): void {
    const row = this.rows()[index];
    if (row.isSensitive) {
      this.startSecretEdit(index);
      this.openExpandModal(index, true);
    } else {
      this.startPlainEdit(index);
      this.openExpandModal(index, false);
    }
  }

  /** Opens modal while already in inline-edit state */
  protected openExpandModal(index: number, isSensitive: boolean): void {
    const row = this.rows()[index];
    const currentValue = isSensitive ? row.newSecretValue : row.newPlainValue;
    const { typeLabel, typeBadgeClass } = this.getModalBadge(row.value, isSensitive);
    this.expandModal.set({
      rowIndex: index,
      key: row.key,
      editValue: currentValue,
      isSensitive,
      typeLabel,
      typeBadgeClass,
    });
  }

  protected closeExpandModal(): void {
    this.expandModal.set(null);
  }

  protected confirmExpandModal(): void {
    const modal = this.expandModal();
    if (!modal) return;
    const { rowIndex, editValue, isSensitive } = modal;
    if (isSensitive) {
      this.rows.update(rows =>
        rows.map((r, i) =>
          i === rowIndex ? { ...r, value: editValue, newSecretValue: editValue, editingSecret: false } : r
        )
      );
    } else {
      this.rows.update(rows =>
        rows.map((r, i) =>
          i === rowIndex ? { ...r, value: editValue, newPlainValue: editValue, editingPlain: false } : r
        )
      );
    }
    this.expandModal.set(null);
  }

  // ── JSON mode ─────────────────────────────────────────────────────────────

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
    if (!text.trim()) { this.jsonError.set(null); this.jsonParsed.set(null); return; }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        this.jsonError.set('Must be a flat JSON object: { "KEY": "value" }');
        this.jsonParsed.set(null);
        return;
      }
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== 'string') {
          this.jsonError.set(`Value for "${k}" must be a string`);
          this.jsonParsed.set(null);
          return;
        }
      }
      this.jsonError.set(null);
      this.jsonParsed.set(parsed as Record<string, string>);
    } catch {
      this.jsonError.set('Invalid JSON');
      this.jsonParsed.set(null);
    }
  }

  // ── Dirty detection ───────────────────────────────────────────────────────

  protected isDirtyRow(row: VarRow): boolean {
    if (row.isNew) return true;
    if (row.isSensitive) return row.value !== '****';
    return row.value !== row.originalValue;
  }

  protected isDirty(): boolean {
    if (this.jsonMode()) return this.jsonParsed() !== null;
    return this.deletedKeys().size > 0 || this.rows().some(r => this.isDirtyRow(r));
  }

  protected canSave(): boolean {
    if (this.jsonMode()) return this.jsonParsed() !== null && !this.jsonError();
    return this.rows().filter(r => r.isNew).every(r => r.key.trim() && r.value.trim());
  }

  // ── Plain row edit ────────────────────────────────────────────────────────

  protected startPlainEdit(index: number): void {
    this.rows.update(rows =>
      rows.map((r, i) => i === index ? { ...r, editingPlain: true, newPlainValue: r.value } : r)
    );
  }

  protected cancelPlainEdit(index: number): void {
    this.rows.update(rows =>
      rows.map((r, i) => i === index ? { ...r, editingPlain: false, newPlainValue: '' } : r)
    );
  }

  protected confirmPlainEdit(index: number): void {
    this.rows.update(rows =>
      rows.map((r, i) =>
        i === index ? { ...r, value: r.newPlainValue, editingPlain: false, newPlainValue: '' } : r
      )
    );
  }

  // ── Sensitive row edit ────────────────────────────────────────────────────

  protected startSecretEdit(index: number): void {
    this.rows.update(rows =>
      rows.map((r, i) => i === index ? { ...r, editingSecret: true, newSecretValue: '' } : r)
    );
  }

  protected cancelSecretEdit(index: number): void {
    this.rows.update(rows =>
      rows.map((r, i) => i === index ? { ...r, editingSecret: false, newSecretValue: '' } : r)
    );
  }

  protected confirmSecretEdit(index: number): void {
    this.rows.update(rows =>
      rows.map((r, i) =>
        i === index ? { ...r, value: r.newSecretValue, editingSecret: false, newSecretValue: '' } : r
      )
    );
  }

  // ── Add new row ───────────────────────────────────────────────────────────

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
    this.rows.update(rows => [
      ...rows,
      {
        key: this.newKey.trim(),
        value: this.newValue,
        originalValue: '',
        isNew: true,
        isSensitive: false,
        editingPlain: false,
        newPlainValue: '',
        editingSecret: false,
        newSecretValue: '',
      },
    ]);
    this.showAddForm.set(false);
  }

  protected removeRow(index: number): void {
    const row = this.rows()[index];
    if (!row.isNew) {
      this.deletedKeys.update(s => new Set([...s, row.key]));
    }
    this.rows.update(rows => rows.filter((_, i) => i !== index));
  }

  protected toggleValues(): void {
    this.showValues.update(v => !v);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  protected onSave(): void {
    if (this.jsonMode()) {
      const parsed = this.jsonParsed();
      if (!parsed) return;
      const deleteKeys = Object.keys(this.data).filter(
        k => !this.sensitiveKeys.includes(k) && !(k in parsed),
      );
      this.save.emit({ data: parsed, deleteKeys });
      return;
    }
    const data: Record<string, string> = {};
    for (const row of this.rows()) {
      const key = row.key.trim();
      if (!key) continue;
      if (row.isSensitive && row.value === '****') continue;
      data[key] = row.value;
    }
    this.save.emit({ data, deleteKeys: [...this.deletedKeys()] });
  }
}
