import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { GroupDraft } from './group-draft';
import { GroupDraftStore } from './group-draft.store';
import { GroupSettingsTableComponent } from './group-settings-table.component';
import { GroupCostComponent } from './group-cost.component';
import { consequenceOf } from './scaling-consequence';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingGroupStore } from './scaling-group.store';
import { ToastService } from '../../../shared/services/toast.service';
import { RemovalPreview, SectionGroup } from '../../model/scaling-section.models';
import { RemovalPreviewNoteComponent } from './removal-preview-note.component';
import { ScalingCostDraft, WriteScalingGroup } from '../../model/scaling-group.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-scaling-group-tab',
  imports: [
    RouterLink,
    GroupSettingsTableComponent,
    GroupCostComponent,
    RemovalPreviewNoteComponent,
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlButton,
    FlSpinner,
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (draft(); as d) {
      <div class="fl-stack" data-testid="group-tab">
        <app-group-settings-table [draft]="d">
          <a
            settingsActions
            class="fl-link text-fl-body-sm"
            [routerLink]="['/cluster', d.group().clusterId, 'scaling']"
          >
            Open this cluster's scaling
          </a>
        </app-group-settings-table>

        @if (d.hasCatalogue()) {
          <app-group-cost
            [clusterId]="d.group().clusterId"
            [draft]="costDraft(d)"
            [needsCeiling]="needsCeiling(d)"
            (useCeiling)="d.setCost($event)"
          />
        }

        <fl-panel data-testid="group-save">
          <div class="flex flex-col gap-4">
            @if (problem(d); as message) {
              <fl-alert tone="error" title="Cannot save this group" data-testid="group-save-error">
                {{ message }}
              </fl-alert>
            }
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex max-w-prose flex-col gap-2">
                <p class="m-0 text-fl-body-sm">{{ consequence(d).sentence }}</p>
                @if (removalFor(d); as preview) {
                  <app-removal-preview-note [preview]="preview" />
                }
              </div>
              <div class="flex shrink-0 items-center gap-2">
                @if (removalFor(d)) {
                  <button
                    flButton="ghost"
                    type="button"
                    [disabled]="saving()"
                    (click)="removal.set(null)"
                    data-testid="group-save-cancel"
                  >
                    Cancel
                  </button>
                }
                <button
                  flButton="primary"
                  type="button"
                  (click)="save(d)"
                  [disabled]="!!problem(d) || saving() || !changed(d)"
                  data-testid="group-save-button"
                >
                  @if (saving()) {
                    <fl-spinner label="Saving" />
                  }
                  {{ saveLabel(d) }}
                </button>
              </div>
            </div>
          </div>
        </fl-panel>

        <fl-panel title="Remove this group" data-testid="group-remove">
          <div class="flex flex-wrap items-center justify-between gap-3">
            @if (!confirmRemove()) {
              <p class="m-0 max-w-prose text-fl-body-sm text-fl-ink-muted">{{ removeNote() }}</p>
              <button
                flButton="danger"
                size="sm"
                type="button"
                [disabled]="!removable()"
                [title]="removeNote()"
                data-testid="group-remove-button"
                (click)="confirmRemove.set(true)"
              >
                Remove this group
              </button>
            } @else {
              <p class="m-0 max-w-prose text-fl-body-sm">
                Remove {{ d.group().name }} and its decision log? No node is removed.
              </p>
              <span class="inline-flex items-center gap-2">
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [disabled]="removing()"
                  (click)="confirmRemove.set(false)"
                >
                  Cancel
                </button>
                <button
                  flButton="danger"
                  size="sm"
                  type="button"
                  [disabled]="removing()"
                  data-testid="group-remove-confirm"
                  (click)="remove(d)"
                >
                  {{ removing() ? 'Removing…' : 'Remove' }}
                </button>
              </span>
            }
          </div>
        </fl-panel>
      </div>
    } @else {
      <fl-panel data-testid="group-tab-unknown">
        <fl-empty-state title="No such scaling group" [body]="unknownBody()">
          <a flButton size="sm" routerLink="/scaling" data-testid="back-to-scaling">
            Back to every cluster
          </a>
        </fl-empty-state>
      </fl-panel>
    }
  `,
})
export class ScalingGroupTabComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly drafts = inject(GroupDraftStore);
  private readonly api = inject(ScalingApiService);
  private readonly store = inject(ScalingGroupStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly params = this.route.parent?.paramMap ?? this.route.paramMap;

  protected readonly saving = signal(false);
  /** The machine these limits would give back, shown before they are saved. */
  protected readonly removal = signal<{ key: string; preview: RemovalPreview } | null>(null);
  private readonly failure = signal<string | null>(null);
  protected readonly confirmRemove = signal(false);
  protected readonly removing = signal(false);

  /** The only group of a cluster Flui buys for is how its nodes change, so it stays. */
  protected readonly removable = computed(() => {
    const row = this.store.row().data;
    if (!row) return false;
    return row.groupCount > 1 || !row.capability.canProvision || !row.capability.hasCatalogue;
  });

  protected readonly removeNote = computed(() =>
    this.removable()
      ? 'Removing a group stops it deciding; no node is removed.'
      : 'This is the only group of the cluster and its nodes change through it: set it to manual to stop it adding nodes.',
  );

  protected async remove(draft: GroupDraft): Promise<void> {
    this.removing.set(true);
    try {
      await firstValueFrom(this.api.deleteGroup(draft.group().id));
      this.toast.showSuccess({ title: 'Group removed', message: draft.group().name });
      await this.router.navigate(['/cluster', draft.group().clusterId, 'scaling']);
    } catch (error: unknown) {
      const body = (error as { error?: { message?: string | string[] } })?.error?.message;
      this.toast.showError({
        title: 'Group not removed',
        message: Array.isArray(body) ? body.join(' ') : (body ?? ''),
      });
    } finally {
      this.removing.set(false);
      this.confirmRemove.set(false);
    }
  }

  protected readonly groupId = toSignal(this.params.pipe(map((p) => p.get('groupId'))), {
    initialValue:
      this.route.parent?.snapshot.paramMap.get('groupId') ??
      this.route.snapshot.paramMap.get('groupId') ??
      null,
  });

  protected readonly draft = computed<GroupDraft | null>(() => this.drafts.draft(this.groupId()));

  protected readonly unknownBody = computed(
    () =>
      `Nothing is configured under ${this.groupId() ?? 'this ID'}. A group that was removed, or a link that outlived it.`,
  );

  /**
   * What this group will do once saved, in the same words the cluster page
   * uses. A change to what a cluster may spend unattended meets no action
   * cycle when it comes from a browser, so the sentence is the consent.
   */
  protected consequence(draft: GroupDraft) {
    return consequenceOf(bodyOf(draft.group()));
  }

  /** The limits on screen, priced by the API; nothing while one is out of range. */
  protected costDraft(draft: GroupDraft): ScalingCostDraft | null {
    if (Object.keys(draft.boundProblems()).length) return null;
    const g = draft.group();
    return {
      bounds: { min: g.bounds.min, max: g.bounds.max },
      shapes: g.shapes,
      regions: g.regions,
      maxMonthlyCost: g.limits.maxMonthlyCost,
    };
  }

  protected needsCeiling(draft: GroupDraft): boolean {
    const g = draft.group();
    return g.provision === 'automatic' && !isPositiveAmount(g.limits.maxMonthlyCost);
  }

  protected problem(draft: GroupDraft): string | null {
    const saved = this.failure();
    if (saved) return saved;

    const group = draft.group();
    const bounds = draft.boundProblems();
    const first = bounds.min ?? bounds.desired ?? bounds.max;
    if (first) return first;
    if (group.provision === 'automatic' && !isPositiveAmount(group.limits.maxMonthlyCost)) {
      return 'Adding nodes automatically needs a spending ceiling, the safety net under the node limits.';
    }
    return null;
  }

  protected changed(draft: GroupDraft): boolean {
    const saved = this.store.group().data;
    return !saved || JSON.stringify(bodyOf(draft.group())) !== JSON.stringify(bodyOf(saved));
  }

  /** The preview, only while the limits on screen are still the ones it was read for. */
  protected removalFor(draft: GroupDraft): RemovalPreview | null {
    const shown = this.removal();
    return shown?.key === boundsKey(draft) ? shown.preview : null;
  }

  /** Reads what the limits on screen would give back; true when there is something to show first. */
  private async showRemoval(draft: GroupDraft): Promise<boolean> {
    const saved = this.store.group().data;
    const { min, desired } = draft.group().bounds;
    if (saved && min >= saved.bounds.min && desired >= saved.bounds.desired) return false;
    try {
      const preview = await firstValueFrom(
        this.api.removalPreview(draft.group().id, { min, desired }),
      );
      if (!preview.removes) return false;
      this.removal.set({ key: boundsKey(draft), preview });
      return true;
    } catch {
      return false;
    }
  }

  protected saveLabel(draft: GroupDraft): string {
    if (this.saving()) return 'Saving…';
    if (!this.changed(draft)) return 'Saved';
    const preview = this.removalFor(draft);
    if (!preview) return 'Save';
    return preview.proceeds ? `Save and remove ${preview.node}` : 'Save, the removal waits';
  }

  /**
   * Lower limits are saved in two steps: the first shows which machine goes
   * and what runs on it, the second saves. Limits that remove nothing save at
   * once, as before.
   */
  protected async save(draft: GroupDraft): Promise<void> {
    if (!this.removalFor(draft) && (await this.showRemoval(draft))) return;
    this.removal.set(null);
    this.failure.set(null);
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.updateGroup(draft.group().id, bodyOf(draft.group())));
      this.store.reload();
      this.toast.showSuccess({
        title: 'Group saved',
        message: this.consequence(draft).sentence,
      });
    } catch (error: unknown) {
      const body = (error as { error?: { message?: string | string[] } })?.error?.message;
      const message = Array.isArray(body)
        ? body.join('. ')
        : (body ?? 'This group could not be saved.');
      this.failure.set(message);
      this.toast.showError({ title: 'Group not saved', message });
    } finally {
      this.saving.set(false);
    }
  }
}

function boundsKey(draft: GroupDraft): string {
  const { min, desired } = draft.group().bounds;
  return `${draft.group().id}:${min}:${desired}`;
}

/** The draft holds a whole group; the API takes only what a person may set. */
function bodyOf(group: SectionGroup): WriteScalingGroup {
  return {
    name: group.name,
    bounds: group.bounds,
    regions: group.regions,
    shapes: group.shapes,
    strategy: group.strategy,
    settleSeconds: group.settleSeconds,
    limits: {
      hourlyBillingOnly: group.limits.hourlyBillingOnly,
      maxMonthlyCost: group.limits.maxMonthlyCost,
    },
    provision: group.provision,
  };
}

function isPositiveAmount(value: unknown): boolean {
  return Number(value) > 0;
}
