import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackupPolicy } from '../../../model/backup.models';
import { BackupPolicyActivity } from '../../../model/backup-run.models';
import { policyEngineLabel } from '../../../model/backup-protection.models';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlStatus } from '../../../../ui/primitives/status';
import { replicationStatusView, retentionText, scopeLabel } from './policy-text';

@Component({
  selector: 'app-policy-detail-facts',
  imports: [RouterLink, FlKeyValue, FlKvItem, FlPanel, FlEmptyState, FlTable, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    @let p = policy();
    <fl-panel title="What it protects">
      <fl-key-value>
        <fl-kv-item key="Protects">
          @if (activity()?.targets?.applications?.length) {
            <span class="flex flex-col gap-1">
              @for (app of activity()!.targets!.applications; track app.id) {
                <span>
                  @if (app.path) {
                    <a class="fl-link" [routerLink]="app.path">{{ app.name }}</a>
                  } @else {
                    {{ app.name ?? 'An application' }}
                  }
                  @if (app.slug && app.slug !== app.name) {
                    <span class="fl-mono text-fl-ink-muted"> {{ app.slug }}</span>
                  }
                  @if (app.gone) {
                    <span class="text-fl-ink-muted">
                      ({{
                        app.goneWith === 'cluster' ? 'deleted with its cluster' : 'deleted'
                      }})</span
                    >
                  }
                </span>
              }
            </span>
          } @else {
            {{ scope(p.scope) }}
          }
        </fl-kv-item>
        @if (activity()?.targets?.cluster; as c) {
          <fl-kv-item key="Cluster">
            {{ c.name ?? 'A cluster' }}
            @if (c.gone) {
              <span class="text-fl-ink-muted"> (deleted)</span>
            }
          </fl-kv-item>
        }
        <fl-kv-item key="Protects with">{{ engine(p.engineClass, p.engine) }}</fl-kv-item>
        <fl-kv-item key="Retention">{{ retention(p) }}</fl-kv-item>
        @if (
          p.engineClass === 'volume_copy' && (p.metadata?.['pauseDuringCopy'] || excluded().length)
        ) {
          <fl-kv-item key="Options">
            <span class="flex flex-col gap-0.5">
              @if (p.metadata?.['pauseDuringCopy']) {
                <span>App stopped during each copy</span>
              }
              @if (excluded().length) {
                <span
                  >Left out: <span class="fl-mono">{{ excluded().join(', ') }}</span></span
                >
              }
            </span>
          </fl-kv-item>
        }
      </fl-key-value>
    </fl-panel>

    <fl-panel title="Destinations" [count]="p.destinations.length" [flush]="true">
      @if (p.destinations.length === 0) {
        <fl-empty-state [compact]="true" title="No destination" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Destination</th>
                <th scope="col">Role</th>
                <th scope="col">Replication</th>
              </tr>
            </thead>
            <tbody>
              @for (d of p.destinations; track d.id) {
                @let rep = replication(d.lastReplicationStatus);
                <tr>
                  <td>
                    <a
                      class="fl-link"
                      [routerLink]="['/management/backup/destinations', d.destinationId]"
                      >{{ d.destination?.name || d.destinationId.slice(0, 8) }}</a
                    >
                  </td>
                  <td>{{ d.role === 'primary' ? 'Primary' : 'Replica' }}</td>
                  <td><fl-status [tone]="rep.tone" [label]="rep.label" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class PolicyDetailFacts {
  readonly policy = input.required<BackupPolicy>();
  readonly activity = input<BackupPolicyActivity | null>(null);

  protected readonly engine = policyEngineLabel;
  protected readonly retention = retentionText;
  protected readonly scope = scopeLabel;
  protected readonly replication = replicationStatusView;

  protected excluded(): string[] {
    const list = this.policy().metadata?.['excludeVolumes'];
    return Array.isArray(list) ? (list as string[]) : [];
  }
}
