import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GroupDraft } from './group-draft';
import { GroupDraftStore } from './group-draft.store';
import { GroupSettingsTableComponent } from './group-settings-table.component';

@Component({
  selector: 'app-scaling-group-tab',
  standalone: true,
  imports: [RouterLink, GroupSettingsTableComponent],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft(); as d) {
      <section class="space-y-3" data-testid="group-tab">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 class="text-label m-0">Configuration</h2>
          <p class="m-0 text-[12px] text-muted-foreground" data-testid="mock-notice">
            Read from the API; editing changes this page only. Nothing is written
            back — a change to what a cluster may spend goes through the action
            cycle, and that door is not on this screen yet.
          </p>
        </div>

        <app-group-settings-table [draft]="d" />
      </section>
    } @else {
      <section class="card-surface p-6" data-testid="group-tab-unknown">
        <h2 class="m-0 text-base font-medium text-foreground">No such scaling group</h2>
        <p class="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Nothing is configured under
          <span class="font-mono text-foreground">{{ groupId() ?? 'no id' }}</span
          >. A group that was removed, or a link that outlived it.
        </p>
        <a routerLink="/scaling" class="card-link" data-testid="back-to-scaling">
          Back to every cluster
        </a>
      </section>
    }
  `,
})
export class ScalingGroupTabComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly drafts = inject(GroupDraftStore);

  private readonly params = this.route.parent?.paramMap ?? this.route.paramMap;

  protected readonly groupId = toSignal(this.params.pipe(map((p) => p.get('groupId'))), {
    initialValue:
      this.route.parent?.snapshot.paramMap.get('groupId') ??
      this.route.snapshot.paramMap.get('groupId') ??
      null,
  });

  protected readonly draft = computed<GroupDraft | null>(() =>
    this.drafts.draft(this.groupId()),
  );
}
