import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlButton } from '../../../../ui/primitives/button';
import { AREA_LABEL, areasOf, heldGroups, scopesAfter } from './agent-key-scopes-edit';
import { AgentKeyDepthChoice } from './agent-key-depth-choice';

/** What a key may do, area by area, for a key that already exists. */
@Component({
  selector: 'app-agent-key-permissions-editor',
  imports: [FlAlert, FlButton, AgentKeyDepthChoice],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="flex flex-col gap-2">
      @for (area of areas(); track area.key) {
        <div
          class="flex flex-wrap items-center justify-between gap-3"
          [attr.data-testid]="'perm-area-' + area.key"
        >
          <span class="text-fl-body-sm">{{ area.label }}</span>
          <app-agent-key-depth-choice
            [label]="area.label"
            [groups]="area.groups"
            [picked]="picked()"
            [disabled]="saving()"
            testIdPrefix="perm-"
            hint="summary"
            (choose)="choose(area.groups, $event)"
          />
        </div>
      }
    </div>
    @if (error(); as e) {
      <fl-alert tone="error" title="Not saved" data-testid="perm-error">{{ e }}</fl-alert>
    }
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="m-0 text-fl-caption text-fl-ink-muted">
        The same key, changed in place. An agent holding it reconnects to see new tools.
      </p>
      <div class="flex gap-2">
        <button flButton="ghost" size="sm" type="button" (click)="cancelled.emit()">Cancel</button>
        <button
          flButton="primary"
          size="sm"
          type="button"
          data-testid="perm-save"
          (click)="save.emit(next())"
          [disabled]="saving() || !changed()"
        >
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  `,
})
export class AgentKeyPermissionsEditorComponent {
  readonly catalogue = input.required<PermissionGroupDto[]>();
  readonly scopes = input.required<string[]>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<string[]>();
  readonly cancelled = output<void>();

  protected readonly areas = computed(() =>
    areasOf(this.catalogue()).map((a) => ({ ...a, label: AREA_LABEL[a.key] ?? a.key })),
  );

  protected readonly picked = linkedSignal<ReadonlySet<string>>(() =>
    heldGroups(this.catalogue(), this.scopes()),
  );

  protected readonly next = computed(() =>
    scopesAfter(this.catalogue(), this.scopes(), this.picked()),
  );

  protected readonly changed = computed(() => {
    const before = new Set(this.scopes());
    const after = this.next();
    return after.length !== before.size || after.some((s) => !before.has(s));
  });

  protected choose(groups: PermissionGroupDto[], key: string | null): void {
    const next = new Set(this.picked());
    for (const g of groups) next.delete(g.key);
    if (key) next.add(key);
    this.picked.set(next);
  }
}
