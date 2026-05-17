import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideKey,
  lucideLock,
  lucideLoader,
  lucideAlertCircle,
  lucideChevronDown,
  lucideChevronRight,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterVariablesService } from '../../service/cluster-variables.service';
import { AppVariablesEditorComponent } from '../application/app-variables-editor.component';
import { VariableSetSummaryDto } from '../../../core/api/model/variableSetSummaryDto';

@Component({
  selector: 'app-cluster-variables-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, AppVariablesEditorComponent],
  providers: [
    provideIcons({ lucideKey, lucideLock, lucideLoader, lucideAlertCircle, lucideChevronDown, lucideChevronRight, lucideRefreshCw }),
  ],
  template: `
    <div class="card-surface p-6 space-y-5">

      <!-- Namespace selector -->
      <div class="flex items-center gap-3">
        <label class="text-xs font-medium text-muted-foreground whitespace-nowrap">Namespace</label>
        <div class="flex items-center gap-2">
          <input
            type="text"
            [(ngModel)]="namespace"
            placeholder="default"
            class="font-mono text-xs px-2.5 py-1.5 bg-muted border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500 w-48"
          />
          <button
            type="button"
            (click)="reload()"
            [disabled]="variablesService.loading()"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="variablesService.loading()" />
            Load
          </button>
        </div>
      </div>

      @if (variablesService.loading() && variablesService.sets().length === 0) {
        <div class="animate-pulse space-y-3">
          @for (i of [1,2,3]; track i) {
            <div class="border border-border rounded-lg overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3 card-inner">
                <div class="flex items-center gap-3">
                  <div class="skeleton h-4 w-4"></div>
                  <div class="space-y-1.5">
                    <div class="skeleton h-4 w-32"></div>
                    <div class="skeleton h-3 w-24"></div>
                  </div>
                </div>
                <div class="skeleton h-4 w-4"></div>
              </div>
            </div>
          }
        </div>
      } @else {

        <!-- Error banner -->
        @if (variablesService.error()) {
          <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{{ variablesService.error() }}</span>
          </div>
        }

        <!-- Variable sets list -->
        @if (variablesService.sets().length > 0) {
          <div class="space-y-3">
            @for (set of variablesService.sets(); track set.name) {
              <div class="border border-border rounded-lg overflow-hidden">

                <!-- Set header -->
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                  (click)="toggleSet(set)"
                >
                  <div class="flex items-center gap-3">
                    <ng-icon
                      [name]="set.type === 'sensitive' ? 'lucideLock' : 'lucideKey'"
                      class="h-4 w-4"
                      [class]="set.type === 'sensitive' ? 'text-amber-500' : 'text-blue-500'"
                    />
                    <div>
                      <p class="text-sm font-semibold text-foreground font-mono">{{ set.name }}</p>
                      <p class="text-sub text-xs">
                        {{ set.keys.length }} {{ set.keys.length === 1 ? 'key' : 'keys' }} &middot;
                        <span class="uppercase">{{ set.scope }}</span> &middot;
                        <span [class]="set.type === 'sensitive' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'">
                          {{ set.type }}
                        </span>
                      </p>
                    </div>
                  </div>
                  <ng-icon
                    [name]="isExpanded(set.name) ? 'lucideChevronDown' : 'lucideChevronRight'"
                    class="h-4 w-4 text-muted-foreground"
                  />
                </button>

                <!-- Expanded detail -->
                @if (isExpanded(set.name)) {
                  <div class="p-4 border-t border-border">
                    @if (variablesService.loading()) {
                      <div class="animate-pulse space-y-2 py-1">
                        @for (i of [1,2,3]; track i) {
                          <div class="skeleton h-8"></div>
                        }
                      </div>
                    } @else if (set.type === 'sensitive') {
                      <app-variables-editor
                        [title]="set.name + ' — Secrets'"
                        [data]="buildSensitiveDisplayData(set)"
                        [sensitiveKeys]="set.keys"
                        [saving]="variablesService.saving()"
                        (save)="onSaveSet(set, $event, 'sensitive')"
                      />
                    } @else {
                      <app-variables-editor
                        [title]="set.name + ' — Variables'"
                        [data]="set.data ?? {}"
                        [sensitiveKeys]="[]"
                        [saving]="variablesService.saving()"
                        (save)="onSaveSet(set, $event, 'plain')"
                      />
                    }
                  </div>
                }
              </div>
            }
          </div>
        } @else if (!variablesService.loading()) {
          <div class="text-center py-12">
            <ng-icon name="lucideKey" class="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p class="text-sm text-sub">No variable sets found in namespace <span class="font-mono font-semibold text-foreground">{{ namespace }}</span></p>
            <p class="text-xs text-muted-foreground mt-1">Variables are created when applications are deployed</p>
          </div>
        }
      }
    </div>
  `,
})
export class ClusterVariablesTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  protected variablesService = inject(ClusterVariablesService);

  protected namespace = 'default';
  private readonly expandedSet = signal<string | null>(null);
  protected clusterId = computed(() => this.clusterService.cluster()?.id ?? '');

  ngOnInit(): void {
    void (async () => {
      await this.reload();
    })();
  }

  protected async reload(): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    this.expandedSet.set(null);
    await this.variablesService.loadSets(id, this.namespace);
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
      if (id) await this.variablesService.loadSet(id, this.namespace, set.name, 'plain');
    }
  }

  protected buildSensitiveDisplayData(set: VariableSetSummaryDto): Record<string, string> {
    return Object.fromEntries(set.keys.map(k => [k, '****']));
  }

  protected async onSaveSet(
    set: VariableSetSummaryDto,
    data: Record<string, string>,
    type: 'plain' | 'sensitive'
  ): Promise<void> {
    const id = this.clusterId();
    if (!id) return;
    await this.variablesService.upsertSet(id, this.namespace, set.name, data, type);
  }
}
