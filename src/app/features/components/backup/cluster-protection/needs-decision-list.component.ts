import { Component, inject, input, output, signal } from '@angular/core';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { BackupService } from '../../../service/backup.service';
import { NeedsDecisionItem } from '../../../model/backup-protection.models';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';

/**
 * Volumes no backup can take consistently while their application runs, each
 * with the choice that settles it.
 */
@Component({
  selector: 'app-needs-decision-list',
  imports: [ReadOnlySectionDirective, FlPanel, FlTable, FlAlert, FlButton],
  host: { class: 'fl-stack' },
  template: `
    @if (items().length) {
      <fl-panel
        title="Needs a decision"
        [count]="items().length"
        [flush]="true"
        data-testid="needs-decision"
      >
        <button
          panelActions
          flButton="ghost"
          size="sm"
          type="button"
          [attr.aria-expanded]="showHelp()"
          (click)="showHelp.set(!showHelp())"
        >
          {{ showHelp() ? 'Less' : 'Why?' }}
        </button>
        @if (showHelp()) {
          <p class="border-b border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted">
            A copy taken while a database writes to its volume may not open again. Stop the app for
            the length of each copy, or leave the volume out and protect that data another way.
          </p>
        }
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Application</th>
                <th scope="col">Volume</th>
                @if (showCluster()) {
                  <th scope="col">Cluster</th>
                }
                <th scope="col">Why</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Decision</span></th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track key(item)) {
                <tr>
                  <td class="fl-cell-name font-medium">{{ item.name || item.slug }}</td>
                  <td>
                    @if (item.volume) {
                      <span class="fl-mono">{{ item.volume }}</span>
                    } @else {
                      <span class="text-fl-ink-muted">All volumes</span>
                    }
                  </td>
                  @if (showCluster()) {
                    <td class="text-fl-ink-muted">
                      {{ clusterNames()[item.clusterId] ?? item.clusterId }}
                    </td>
                  }
                  <td class="is-wrap text-fl-ink-muted">{{ item.reason }}</td>
                  <td class="is-fit">
                    <div class="fl-row justify-end" appReadOnlySection="backup">
                      <button
                        flButton
                        size="sm"
                        type="button"
                        [disabled]="
                          busy() === key(item) || (!item.policyId && !destinationOf(item))
                        "
                        [title]="
                          !item.policyId && !destinationOf(item) ? 'Add backup storage first' : ''
                        "
                        (click)="stopDuringCopy(item)"
                      >
                        Stop the app during each copy
                      </button>
                      @if (item.policyId && item.volume) {
                        <button
                          flButton="ghost"
                          size="sm"
                          type="button"
                          [disabled]="busy() === key(item)"
                          (click)="leaveOut(item)"
                        >
                          Leave it out
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (failure()) {
          <div class="border-t border-fl-border-subtle p-4">
            <fl-alert tone="error" title="Decision not saved">{{ failure() }}</fl-alert>
          </div>
        }
      </fl-panel>
    }
  `,
})
export class NeedsDecisionListComponent {
  private readonly backup = inject(BackupService);

  readonly items = input<NeedsDecisionItem[]>([]);
  /** Where a new policy writes, for an app that has none yet. */
  readonly destinationId = input<string | null>(null);
  readonly clusterDestinations = input<Readonly<Record<string, string | null>>>({});
  readonly clusterNames = input<Readonly<Record<string, string>>>({});
  readonly decided = output<void>();

  protected readonly busy = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly showHelp = signal(false);

  protected showCluster(): boolean {
    return Object.keys(this.clusterNames()).length > 0;
  }

  protected destinationOf(item: NeedsDecisionItem): string | null {
    return this.clusterDestinations()[item.clusterId] ?? this.destinationId();
  }

  protected key(item: NeedsDecisionItem): string {
    return `${item.applicationId}:${item.volume ?? ''}`;
  }

  protected async stopDuringCopy(item: NeedsDecisionItem): Promise<void> {
    await this.run(item, async () => {
      if (item.policyId) {
        await this.backup.updatePolicyOptions(item.policyId, {
          pauseDuringCopy: true,
        });
        return;
      }
      const destinationId = this.destinationOf(item);
      if (!destinationId) throw new Error('Add backup storage first');
      const created = await this.backup.createPolicy({
        name: `${item.slug}-volumes`,
        clusterId: item.clusterId,
        engineClass: 'volume_copy',
        scope: 'applications',
        scopeSelector: { applicationIds: [item.applicationId] },
        destinations: [{ destinationId, role: 'primary', priority: 0 }],
        profile: 'single',
        metadata: { pauseDuringCopy: true },
      });
      if (!created) throw new Error(this.backup.error() ?? 'Could not create the policy');
    });
  }

  protected async leaveOut(item: NeedsDecisionItem): Promise<void> {
    const policyId = item.policyId;
    const volume = item.volume;
    if (!policyId || !volume) return;
    await this.run(item, async () => {
      const policy = await this.backup.getPolicy(policyId);
      if (!policy) throw new Error(this.backup.error() ?? 'Could not read the policy');
      const current = Array.isArray(policy.metadata?.['excludeVolumes'])
        ? (policy.metadata['excludeVolumes'] as string[])
        : [];
      await this.backup.updatePolicyOptions(policyId, {
        excludeVolumes: [...new Set([...current, volume])],
      });
    });
  }

  private async run(item: NeedsDecisionItem, action: () => Promise<void>): Promise<void> {
    this.busy.set(this.key(item));
    this.failure.set(null);
    try {
      await action();
      this.decided.emit();
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? err?.message ?? 'Could not save the decision');
    } finally {
      this.busy.set(null);
    }
  }
}
