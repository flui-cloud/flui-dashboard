import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { GroupDraft } from './group-draft';
import { GroupDraftStore } from './group-draft.store';
import { GroupSettingsTableComponent } from './group-settings-table.component';
import { consequenceOf } from './scaling-consequence';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ScalingGroupStore } from './scaling-group.store';
import { ToastService } from '../../../shared/services/toast.service';
import { SectionGroup } from '../../model/scaling-section.models';
import { WriteScalingGroup } from '../../model/scaling-group.models';

@Component({
  selector: 'app-scaling-group-tab',
  standalone: true,
  imports: [RouterLink, GroupSettingsTableComponent],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft(); as d) {
      <section class="space-y-3" data-testid="group-tab">
        <div
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
        >
          <h2 class="text-label m-0">Configuration</h2>
          <a
            [routerLink]="['/cluster', d.group().clusterId, 'scaling']"
            class="card-link"
          >
            Open this cluster's scaling →
          </a>
        </div>

        <app-group-settings-table [draft]="d" />

        <div
          class="card-surface flex flex-wrap items-start justify-between gap-4 p-4"
          data-testid="group-save"
        >
          <p
            class="m-0 max-w-prose text-[13px] leading-relaxed text-foreground"
          >
            {{ consequence(d).sentence }}
          </p>

          <div class="flex shrink-0 items-center gap-2">
            @if (problem(d); as message) {
              <span
                class="text-xs text-red-600 dark:text-red-400"
                data-testid="group-save-error"
              >
                {{ message }}
              </span>
            }
            <button
              type="button"
              (click)="save(d)"
              [disabled]="!!problem(d) || saving() || !changed(d)"
              class="min-h-11 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="group-save-button"
            >
              {{ saving() ? 'Saving…' : changed(d) ? 'Save' : 'Saved' }}
            </button>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center justify-between gap-3 px-1 text-[12px] text-sub"
          data-testid="group-remove"
        >
          <span>{{ removeNote() }}</span>
          @if (!confirmRemove()) {
            <button
              type="button"
              class="rounded-md border border-border px-2.5 py-1 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              [disabled]="!removable()"
              [title]="removeNote()"
              data-testid="group-remove-button"
              (click)="confirmRemove.set(true)"
            >
              Remove this group
            </button>
          } @else {
            <span class="inline-flex items-center gap-2">
              Remove {{ d.group().name }} and its decision log? No node is removed.
              <button
                type="button"
                class="rounded-md bg-destructive px-2.5 py-1 font-medium text-destructive-foreground disabled:opacity-50"
                [disabled]="removing()"
                data-testid="group-remove-confirm"
                (click)="remove(d)"
              >
                {{ removing() ? 'Removing…' : 'Remove' }}
              </button>
              <button type="button" class="text-muted-foreground" [disabled]="removing()" (click)="confirmRemove.set(false)">Cancel</button>
            </span>
          }
        </div>
      </section>
    } @else {
      <section class="card-surface p-6" data-testid="group-tab-unknown">
        <h2 class="m-0 text-base font-medium text-foreground">
          No such scaling group
        </h2>
        <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Nothing is configured under
          <span class="font-mono text-foreground">{{
            groupId() ?? 'no id'
          }}</span
          >. A group that was removed, or a link that outlived it.
        </p>
        <a
          routerLink="/scaling"
          class="card-link"
          data-testid="back-to-scaling"
        >
          Back to every cluster
        </a>
      </section>
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
      : 'This is the only group of the cluster and its nodes change through it: set it to manual to stop it buying.',
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

  protected readonly groupId = toSignal(
    this.params.pipe(map((p) => p.get('groupId'))),
    {
      initialValue:
        this.route.parent?.snapshot.paramMap.get('groupId') ??
        this.route.snapshot.paramMap.get('groupId') ??
        null,
    },
  );

  protected readonly draft = computed<GroupDraft | null>(() =>
    this.drafts.draft(this.groupId()),
  );

  /**
   * What this group will do once saved, in the same words the cluster page
   * uses. A change to what a cluster may spend unattended meets no action
   * cycle when it comes from a browser, so the sentence is the consent.
   */
  protected consequence(draft: GroupDraft) {
    // This page does not know how many nodes the cluster has right now, so the
    // sentence speaks in the ceiling rather than inventing a number of them.
    return consequenceOf(bodyOf(draft.group()));
  }

  protected problem(draft: GroupDraft): string | null {
    const saved = this.failure();
    if (saved) return saved;

    const group = draft.group();
    const { min, desired, max } = group.bounds;
    if (min > max) return 'The ceiling cannot be below the floor.';
    if (desired < min || desired > max)
      return 'The target sits between the floor and the ceiling.';
    if (
      group.provision === 'automatic' &&
      Number(group.limits.maxMonthlyCost) <= 0
    ) {
      return 'Set a monthly ceiling before letting Flui buy.';
    }
    return null;
  }

  protected changed(draft: GroupDraft): boolean {
    const saved = this.store.group().data;
    return (
      !saved ||
      JSON.stringify(bodyOf(draft.group())) !== JSON.stringify(bodyOf(saved))
    );
  }

  protected async save(draft: GroupDraft): Promise<void> {
    this.failure.set(null);
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.updateGroup(draft.group().id, bodyOf(draft.group())),
      );
      this.store.reload();
      this.toast.showSuccess({
        title: 'Group saved',
        message: this.consequence(draft).sentence,
      });
    } catch (error: unknown) {
      const body = (error as { error?: { message?: string | string[] } })?.error
        ?.message;
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
