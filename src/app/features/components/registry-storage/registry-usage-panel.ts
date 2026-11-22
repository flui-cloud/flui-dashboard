import { Component, computed, input } from '@angular/core';
import {
  RegistryStorageStatus,
  RegistryUsage,
  UsageGauge,
  formatRegistrySize,
} from '../../model/registry-storage.models';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus } from '../../../ui/primitives/status';
import { usageThresholds } from './registry-storage-view';

@Component({
  selector: 'app-registry-usage-panel',
  imports: [FlKeyValue, FlKvItem, FlPanel, FlUsageBar, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Storage" data-testid="registry-usage">
      @if (usage().alerting) {
        <fl-status
          panelActions
          tone="warning"
          label="Space alert"
          data-testid="registry-alerting"
        />
      }
      <div class="flex flex-col gap-4">
        <fl-key-value>
          <fl-kv-item key="Kept on">
            <span data-testid="registry-location">{{ location() }}</span>
          </fl-kv-item>
          <fl-kv-item key="Backend">{{
            status().backend === 's3' ? 'Object storage' : 'Volume'
          }}</fl-kv-item>
          <fl-kv-item key="In use">
            <span class="fl-num" data-testid="registry-used">{{ size(usage().totalBytes) }}</span>
          </fl-kv-item>
          <fl-kv-item key="Measured against">
            <span data-testid="registry-limit">{{ limitLine() }}</span>
          </fl-kv-item>
        </fl-key-value>
        @if (bar(); as b) {
          <fl-usage-bar
            data-testid="registry-bar"
            label="Registry space in use"
            [percent]="b.percent"
            [aside]="size(usage().totalBytes) + ' ' + limitLine()"
            [warnAt]="b.warnAt"
            [criticalAt]="b.criticalAt"
          />
        }
        @if (usage().unreadable > 0) {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            {{ usage().unreadable }}
            {{ usage().unreadable === 1 ? 'application' : 'applications' }} could not be read on
            this pass.
          </p>
        }
      </div>
    </fl-panel>
  `,
})
export class RegistryUsagePanel {
  readonly status = input.required<RegistryStorageStatus>();
  readonly usage = input.required<RegistryUsage>();
  readonly gauge = input.required<UsageGauge | null>();
  readonly location = input.required<string>();
  readonly limitLine = input.required<string>();

  protected readonly bar = computed(() => {
    const gauge = this.gauge();
    if (!gauge || gauge.kind === 'none') return null;
    return { percent: gauge.percent, ...usageThresholds(gauge) };
  });

  protected size(bytes: number | null | undefined): string {
    return formatRegistrySize(bytes);
  }
}

@Component({
  selector: 'app-registry-apps-panel',
  imports: [FlPanel, FlEmptyState, FlTable],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel
      title="Largest applications"
      [count]="usage().applications.length"
      [flush]="true"
      data-testid="registry-apps"
    >
      <p class="m-0 border-b border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted">
        A layer shared by several applications counts in each of them.
      </p>
      @if (usage().applications.length === 0) {
        <fl-empty-state [compact]="true" title="No application images yet" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Application</th>
                <th scope="col" class="is-num">Size</th>
              </tr>
            </thead>
            <tbody>
              @for (app of usage().applications; track app.applicationId) {
                <tr>
                  <td class="fl-cell-name">{{ app.name }}</td>
                  <td class="is-num fl-mono">{{ size(app.bytes) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class RegistryAppsPanel {
  readonly usage = input.required<RegistryUsage>();

  protected size(bytes: number | null | undefined): string {
    return formatRegistrySize(bytes);
  }
}
