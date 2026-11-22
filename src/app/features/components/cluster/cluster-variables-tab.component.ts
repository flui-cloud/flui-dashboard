import { Component, OnInit, inject, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideKey,
  lucideLock,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterVariablesService } from '../../service/cluster-variables.service';
import {
  AppVariablesEditorComponent,
  VariablesSavePayload,
} from '../application/app-variables-editor.component';
import { VariableSetSummaryDto } from '../../../core/api/model/variableSetSummaryDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-cluster-variables-tab',
  imports: [
    FormsModule,
    AppVariablesEditorComponent,
    FlPanel,
    FlTable,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
  ],
  providers: [
    provideIcons({ lucideChevronDown, lucideChevronRight, lucideKey, lucideLock, lucideRefreshCw }),
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel
      title="Variable sets"
      [count]="variablesService.loading() ? null : variablesService.sets().length"
      [flush]="true"
    >
      <div panelToolbar class="fl-toolbar">
        <div class="fl-toolbar__group">
          <label class="text-fl-body-sm text-fl-ink-secondary" for="cluster-variables-namespace">
            Namespace
          </label>
          <div class="fl-input">
            <input
              id="cluster-variables-namespace"
              type="text"
              class="fl-mono"
              placeholder="default"
              [(ngModel)]="namespace"
            />
          </div>
          <button
            flButton
            size="sm"
            type="button"
            [disabled]="variablesService.loading()"
            (click)="reload()"
          >
            <fl-icon name="lucideRefreshCw" [size]="14" />
            Load
          </button>
        </div>
      </div>

      @if (variablesService.error()) {
        <div class="p-4">
          <fl-alert tone="error" title="Could not load variables">
            {{ variablesService.error() }}
          </fl-alert>
        </div>
      }

      @if (variablesService.loading() && variablesService.sets().length === 0) {
        <fl-loading-state [rows]="3" />
      } @else if (variablesService.sets().length > 0) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Scope</th>
                <th scope="col" class="is-num">Keys</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (set of variablesService.sets(); track set.name) {
                @let open = isExpanded(set.name);
                <tr class="cursor-pointer" [class.is-selected]="open" (click)="toggleSet(set)">
                  <td class="fl-mono">{{ set.name }}</td>
                  <td>
                    <span class="fl-row">
                      <fl-icon
                        class="text-fl-ink-muted"
                        [name]="set.type === 'sensitive' ? 'lucideLock' : 'lucideKey'"
                        [size]="14"
                      />
                      {{ set.type === 'sensitive' ? 'Sensitive' : 'Plain' }}
                    </span>
                  </td>
                  <td>{{ set.scope }}</td>
                  <td class="is-num">{{ set.keys.length }}</td>
                  <td class="is-fit">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [attr.aria-expanded]="open"
                      (click)="$event.stopPropagation(); toggleSet(set)"
                    >
                      <fl-icon [name]="open ? 'lucideChevronDown' : 'lucideChevronRight'" />
                      {{ open ? 'Close' : 'Open' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!variablesService.loading()) {
        <fl-empty-state
          icon="lucideKey"
          [title]="'No variable sets in ' + namespace()"
          body="Variables are created when applications are deployed."
        />
      }
    </fl-panel>

    @if (expandedSummary(); as set) {
      @if (variablesService.loading()) {
        <fl-panel [title]="set.name">
          <fl-loading-state [rows]="3" />
        </fl-panel>
      } @else if (set.type === 'sensitive') {
        <app-variables-editor
          [title]="set.name + ' secrets'"
          [data]="buildSensitiveDisplayData(set)"
          [sensitiveKeys]="set.keys"
          [saving]="variablesService.saving()"
          (save)="onSaveSet(set, $event, 'sensitive')"
        />
      } @else {
        <app-variables-editor
          [title]="set.name + ' variables'"
          [data]="set.data ?? {}"
          [sensitiveKeys]="[]"
          [saving]="variablesService.saving()"
          (save)="onSaveSet(set, $event, 'plain')"
        />
      }
    }
  `,
})
export class ClusterVariablesTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  protected variablesService = inject(ClusterVariablesService);

  protected namespace = signal('default');
  private readonly expandedSet = signal<string | null>(null);
  protected clusterId = computed(() => this.clusterService.cluster()?.id ?? '');
  protected expandedSummary = computed(() => {
    const name = this.expandedSet();
    return name ? (this.variablesService.sets().find((s) => s.name === name) ?? null) : null;
  });

  ngOnInit(): void {
    void (async () => {
      await this.reload();
    })();
  }

  protected async reload(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.expandedSet.set(null);
    await this.variablesService.loadSets(id, this.namespace());
  }

  protected isExpanded(name: string): boolean {
    return this.expandedSet() === name;
  }

  protected async toggleSet(set: VariableSetSummaryDto): Promise<void> {
    if (this.expandedSet() === set.name) {
      this.expandedSet.set(null);
      return;
    }
    this.expandedSet.set(set.name);
    if (set.type === 'plain' && !set.data) {
      const id = this.clusterId();
      if (id) await this.variablesService.loadSet(id, this.namespace(), set.name, 'plain');
    }
  }

  protected buildSensitiveDisplayData(set: VariableSetSummaryDto): Record<string, string> {
    return Object.fromEntries(set.keys.map((k) => [k, '****']));
  }

  protected async onSaveSet(
    set: VariableSetSummaryDto,
    payload: VariablesSavePayload,
    type: 'plain' | 'sensitive',
  ): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    await this.variablesService.upsertSet(id, this.namespace(), set.name, payload.data, type);
  }
}
