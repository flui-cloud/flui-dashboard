import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { BackupService } from '../../../service/backup.service';
import { NeedsDecisionItem } from '../../../model/backup-protection.models';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';

/**
 * Volumes no backup can take consistently while their application runs, each
 * with the choice that settles it.
 */
@Component({
  selector: 'app-needs-decision-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReadOnlySectionDirective],
  template: `
    @if (items().length) {
      <div
        class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2"
        data-testid="needs-decision"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-amber-800 dark:text-amber-300">
            {{ items().length === 1 ? '1 volume needs a decision' : items().length + ' volumes need a decision' }}
          </span>
          <button
            type="button"
            class="text-xs text-muted-foreground hover:underline"
            (click)="showHelp.set(!showHelp())"
          >
            {{ showHelp() ? 'Less' : 'Why?' }}
          </button>
        </div>
        @if (showHelp()) {
          <p class="text-xs text-muted-foreground">
            A copy taken while a database writes to its volume may not open
            again. Stop the app for the length of each copy, or leave the volume
            out and protect that data another way.
          </p>
        }
        <ul class="space-y-2">
          @for (item of items(); track key(item)) {
            <li class="text-sm">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span class="font-medium">{{ item.name || item.slug }}</span>
                  @if (item.volume) {
                    <span class="font-mono text-xs text-muted-foreground"> / {{ item.volume }}</span>
                  }
                </span>
                <span class="inline-flex gap-1.5" appReadOnlySection="backup">
                  <button
                    type="button"
                    class="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    [disabled]="busy() === key(item) || (!item.policyId && !destinationId())"
                    [title]="!item.policyId && !destinationId() ? 'Add backup storage first' : ''"
                    (click)="stopDuringCopy(item)"
                  >
                    Stop the app during each copy
                  </button>
                  @if (item.policyId && item.volume) {
                    <button
                      type="button"
                      class="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      [disabled]="busy() === key(item)"
                      (click)="leaveOut(item)"
                    >
                      Leave it out
                    </button>
                  }
                </span>
              </div>
              <div class="text-xs text-muted-foreground mt-0.5">{{ item.reason }}</div>
            </li>
          }
        </ul>
        @if (failure()) {
          <p class="text-xs text-red-600">{{ failure() }}</p>
        }
      </div>
    }
  `,
})
export class NeedsDecisionListComponent {
  private readonly backup = inject(BackupService);

  readonly items = input<NeedsDecisionItem[]>([]);
  /** Where a new policy writes, for an app that has none yet. */
  readonly destinationId = input<string | null>(null);
  readonly decided = output<void>();

  protected readonly busy = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly showHelp = signal(false);

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
      const destinationId = this.destinationId();
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

  private async run(
    item: NeedsDecisionItem,
    action: () => Promise<void>,
  ): Promise<void> {
    this.busy.set(this.key(item));
    this.failure.set(null);
    try {
      await action();
      this.decided.emit();
    } catch (err: any) {
      this.failure.set(
        err?.error?.message ?? err?.message ?? 'Could not save the decision',
      );
    } finally {
      this.busy.set(null);
    }
  }
}
