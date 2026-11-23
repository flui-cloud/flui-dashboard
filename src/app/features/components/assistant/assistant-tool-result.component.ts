import { Component, computed, input, output } from '@angular/core';
import { FlButton } from '../../../ui/primitives/button';
import { AgentToolStep, LogSourcesResult } from '../../service/assistant.service';
import { AppLogsResult, AssistantLogViewerComponent } from './assistant-log-viewer.component';
import { AssistantDataTableComponent, DataTableConfig } from './assistant-data-table.component';

@Component({
  selector: 'app-assistant-tool-result',
  imports: [FlButton, AssistantLogViewerComponent, AssistantDataTableComponent],
  host: { class: 'block py-1 empty:hidden' },
  template: `
    @if (isSources()) {
      <div class="flex flex-col gap-2 rounded-fl-lg border border-fl-border bg-fl-surface p-3">
        <span class="text-fl-caption font-semibold text-fl-ink-secondary">Log sources</span>
        @if (sourcesResult().apps.length) {
          <div class="fl-row">
            @for (app of sourcesResult().apps; track app) {
              <button
                flButton
                size="sm"
                type="button"
                class="font-mono"
                (click)="sendMessage.emit('Show recent logs for ' + app)"
              >
                {{ app }}
              </button>
            }
          </div>
        }
        @if (sourcesResult().namespaces.length) {
          <div class="fl-row">
            <span class="text-fl-caption text-fl-ink-muted">Namespaces</span>
            @for (ns of sourcesResult().namespaces; track ns) {
              <span class="fl-tag font-mono">{{ ns }}</span>
            }
          </div>
        }
      </div>
    } @else if (isLogs()) {
      <app-assistant-log-viewer
        [result]="logsResult()"
        [logSources]="logSources()"
        (sendMessage)="sendMessage.emit($event)"
      />
    } @else if (isAppList()) {
      <app-assistant-data-table title="Applications" [data]="appListData()" />
    } @else if (isCatalog()) {
      <app-assistant-data-table title="Catalog" [data]="catalogData()" />
    }
  `,
})
export class AssistantToolResultComponent {
  readonly step = input.required<AgentToolStep>();
  readonly logSources = input<LogSourcesResult | null>(null);
  readonly sendMessage = output<string>();

  private readonly hasResult = computed(() => this.step().result != null);
  protected readonly isSources = computed(
    () => this.step().name === 'log_sources' && this.hasResult(),
  );
  protected readonly isLogs = computed(() => this.step().name === 'app_logs' && this.hasResult());
  protected readonly isAppList = computed(
    () => this.step().name === 'app_list' && this.hasResult(),
  );
  protected readonly isCatalog = computed(() => {
    const name = this.step().name;
    return (name === 'catalog_search' || name === 'catalog_get_app') && this.hasResult();
  });

  protected readonly sourcesResult = computed(() => this.step().result as LogSourcesResult);
  protected readonly logsResult = computed(() => this.step().result as AppLogsResult);

  protected readonly appListData = computed((): DataTableConfig => {
    const res = this.step().result as Record<string, unknown>;
    const raw = (res?.['apps'] ?? res?.['items'] ?? res) as unknown[];
    const apps = Array.isArray(raw) ? raw : [];
    return {
      columns: ['Name', 'Status', 'Kind', 'Cluster'],
      rows: apps.map((a) => {
        const app = a as Record<string, unknown>;
        return {
          Name: this.cell(app['name'], app['id']),
          Status: this.cell(app['status']),
          Kind: this.cell(app['kind'], app['type']),
          Cluster: this.cell(app['cluster'], app['cluster_id']),
        };
      }),
    };
  });

  protected readonly catalogData = computed((): DataTableConfig => {
    const res = this.step().result as Record<string, unknown>;
    const raw = (res?.['items'] ?? res?.['results'] ?? res) as unknown[];
    const items = Array.isArray(raw) ? raw : [];
    return {
      columns: ['Name', 'Category', 'Description'],
      rows: items.map((i) => {
        const item = i as Record<string, unknown>;
        return {
          Name: this.cell(item['name']),
          Category: this.cell(item['category']),
          Description: this.cell(item['description']),
        };
      }),
    };
  });

  private cell(...values: unknown[]): string {
    for (const v of values) {
      if (v == null || v === '') continue;
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return JSON.stringify(v);
    }
    return '';
  }
}
