import { Component, computed, input, output, signal } from '@angular/core';
import { FlTable } from '../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import type { MigrationRow } from '../../service/migration.service';
import {
  bridgeLine,
  canAbort,
  canCutover,
  canDestroySource,
  cutoverLabel,
} from './migration-bridge';
import { kindLabel, measuresLine, nextStepsOf, poolerLine } from './migration-measures';
import {
  durationOf,
  formatWhen,
  sourceLabel,
  statusText,
  statusTone,
  typeLabel,
} from './migration-row-view';

export type MigrationRowAction = 'abort' | 'destroy';

export function migrationKey(row: MigrationRow): string {
  return `${row.type}:${row.id}`;
}

function menuFor(row: MigrationRow, busy: boolean): MenuAction[] {
  const items: MenuAction[] = [];
  if (canAbort(row)) items.push({ id: 'abort', label: 'Abort', danger: true, disabled: busy });
  if (canDestroySource(row)) {
    items.push({ id: 'destroy', label: 'Destroy source', danger: true, disabled: busy });
  }
  return items;
}

@Component({
  selector: 'app-migrations-table',
  imports: [FlTable, FlActionsMenu, FlButton, FlSpinner, FlStatus],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap" data-testid="migrations-table">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">What moves</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Status</th>
            <th scope="col">Cutover</th>
            <th scope="col">Created</th>
            <th scope="col" class="is-num">Duration</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track key(row)) {
            <tr>
              <td>
                <span class="font-medium">{{ typeLabel(row.type) }}</span>
                @if (kindLabel(row); as kind) {
                  <span class="text-fl-ink-muted"> · {{ kind }}</span>
                }
              </td>
              <td class="fl-mono">{{ sourceLabel(row) }}</td>
              <td class="fl-mono is-wrap break-all">{{ targetLabel()(row) }}</td>
              <td class="is-wrap">
                <div class="flex min-w-56 max-w-sm flex-col gap-1">
                  <fl-status [tone]="statusTone(row.status)" [label]="statusText(row.status)" />
                  @if (row.errorMessage) {
                    <span class="text-fl-caption text-fl-ink-secondary">{{
                      row.errorMessage
                    }}</span>
                  }
                  @if (bridgeLine(row); as line) {
                    <span class="text-fl-caption text-fl-ink-muted">{{ line }}</span>
                  }
                  @if (measuresLine(row); as measures) {
                    <span class="text-fl-caption text-fl-ink-muted">{{ measures }}</span>
                  }
                  @if (poolerLine(row); as pooler) {
                    <span class="text-fl-caption text-fl-ink-muted">{{ pooler }}</span>
                  }
                  @if (nextStepsOf(row).length) {
                    <button
                      type="button"
                      class="fl-link self-start text-fl-caption"
                      [attr.aria-expanded]="stepsOpen() === key(row)"
                      [attr.aria-label]="
                        'Next steps (' +
                        nextStepsOf(row).length +
                        '), ' +
                        typeLabel(row.type) +
                        ' from ' +
                        sourceLabel(row)
                      "
                      (click)="toggleSteps(row)"
                    >
                      Next steps ({{ nextStepsOf(row).length }})
                    </button>
                    @if (stepsOpen() === key(row)) {
                      <ul class="m-0 list-disc pl-4 text-fl-caption text-fl-ink-muted">
                        @for (step of nextStepsOf(row); track step.key) {
                          <li>{{ step.text }}</li>
                        }
                      </ul>
                    }
                  }
                </div>
              </td>
              <td class="capitalize">{{ row.cutoverMode }}</td>
              <td class="text-fl-ink-muted">{{ formatWhen(row.createdAt) }}</td>
              <td class="is-num fl-mono">{{ durationOf(row) }}</td>
              <td class="is-fit">
                <div class="flex items-center justify-end gap-2">
                  @if (canCutover(row)) {
                    <button
                      flButton
                      size="sm"
                      type="button"
                      [disabled]="busyId() === row.id"
                      (click)="cutover.emit(row)"
                    >
                      @if (busyId() === row.id) {
                        <fl-spinner label="Working" />
                      }
                      {{ cutoverLabel(row) }}
                    </button>
                  }
                  @if (menus().get(key(row)); as items) {
                    <fl-actions-menu
                      [compact]="true"
                      label="Migration actions"
                      [items]="items"
                      (action)="act(row, $event)"
                    />
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MigrationsTableComponent {
  readonly rows = input.required<MigrationRow[]>();
  readonly busyId = input<string | null>(null);
  readonly targetLabel = input.required<(row: MigrationRow) => string>();
  readonly cutover = output<MigrationRow>();
  readonly action = output<{ kind: MigrationRowAction; row: MigrationRow }>();

  protected readonly stepsOpen = signal<string | null>(null);

  protected readonly menus = computed(() => {
    const busy = this.busyId();
    const map = new Map<string, MenuAction[]>();
    for (const row of this.rows()) {
      const items = menuFor(row, busy === row.id);
      if (items.length) map.set(migrationKey(row), items);
    }
    return map;
  });

  protected readonly key = migrationKey;
  protected readonly typeLabel = typeLabel;
  protected readonly kindLabel = kindLabel;
  protected readonly sourceLabel = sourceLabel;
  protected readonly statusTone = statusTone;
  protected readonly statusText = statusText;
  protected readonly bridgeLine = bridgeLine;
  protected readonly measuresLine = measuresLine;
  protected readonly poolerLine = poolerLine;
  protected readonly nextStepsOf = nextStepsOf;
  protected readonly formatWhen = formatWhen;
  protected readonly durationOf = durationOf;
  protected readonly canCutover = canCutover;
  protected readonly cutoverLabel = cutoverLabel;

  protected toggleSteps(row: MigrationRow): void {
    const key = migrationKey(row);
    this.stepsOpen.set(this.stepsOpen() === key ? null : key);
  }

  protected act(row: MigrationRow, id: string): void {
    if (id === 'abort' || id === 'destroy') this.action.emit({ kind: id, row });
  }
}
