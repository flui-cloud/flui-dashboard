import { Component, computed, input, output } from '@angular/core';
import { AgentToolStep, LogSourcesResult } from '../../service/assistant.service';
import { AppLogsResult, AssistantLogViewerComponent } from './assistant-log-viewer.component';
import { AssistantDataTableComponent, DataTableConfig } from './assistant-data-table.component';

@Component({
  selector: 'app-assistant-tool-result',
  standalone: true,
  imports: [AssistantLogViewerComponent, AssistantDataTableComponent],
  template: `
    @if (isSources()) {
      <div class="mt-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Log sources</p>
        <div class="flex flex-wrap gap-1">
          @for (app of sourcesResult().apps; track app) {
            <button type="button" (click)="sendMessage.emit('Show recent logs for ' + app)"
              class="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
              {{ app }}
            </button>
          }
          @for (ns of sourcesResult().namespaces; track ns) {
            <span class="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {{ ns }}
            </span>
          }
        </div>
      </div>
    } @else if (isLogs()) {
      <app-assistant-log-viewer
        [result]="logsResult()"
        [logSources]="logSources()"
        (sendMessage)="sendMessage.emit($event)" />
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
  protected readonly isSources = computed(() => this.step().name === 'log_sources' && this.hasResult());
  protected readonly isLogs = computed(() => this.step().name === 'app_logs' && this.hasResult());
  protected readonly isAppList = computed(() => this.step().name === 'app_list' && this.hasResult());
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
