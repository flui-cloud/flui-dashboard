import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock } from '@ng-icons/lucide';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import {
  AREA_LABEL,
  DEPTH_WORD,
  areasOf,
  heldGroups,
  scopesAfter,
} from './agent-key-scopes-edit';

/** What a key may do, area by area, for a key that already exists. */
@Component({
  selector: 'app-agent-key-permissions-editor',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2">
      @for (area of areas(); track area.key) {
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-2.5" [attr.data-testid]="'perm-area-' + area.key">
          <span class="text-sm text-foreground">{{ area.label }}</span>
          <div class="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="radiogroup" [attr.aria-label]="area.label">
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="!chosenIn(area.groups)"
              [disabled]="saving()"
              (click)="choose(area.groups, null)"
              class="rounded px-3 py-1 text-xs font-medium transition-colors"
              [class]="!chosenIn(area.groups) ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            >None</button>
            @for (g of area.groups; track g.key) {
              <button
                type="button"
                role="radio"
                [attr.data-testid]="'perm-' + g.key"
                [attr.aria-checked]="picked().has(g.key)"
                [disabled]="!g.grantable || saving()"
                [title]="g.grantable ? g.summary : 'Not yours to grant'"
                (click)="choose(area.groups, g.key)"
                class="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                [class]="picked().has(g.key) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              >
                @if (!g.grantable) {
                  <ng-icon name="lucideLock" class="h-3 w-3" />
                }
                {{ depthWord(g.depth) }}
              </button>
            }
          </div>
        </div>
      }
      @if (error(); as e) {
        <p class="text-xs text-destructive" data-testid="perm-error">{{ e }}</p>
      }
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="perm-save"
          (click)="save.emit(next())"
          [disabled]="saving() || !changed()"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          (click)="cancel.emit()"
          class="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Cancel
        </button>
        <p class="text-xs text-muted-foreground">
          The same key, changed in place. An agent holding it reconnects to see new tools.
        </p>
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
  readonly cancel = output<void>();

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

  protected depthWord(depth: string): string {
    return DEPTH_WORD[depth] ?? depth;
  }

  protected chosenIn(groups: PermissionGroupDto[]): PermissionGroupDto | undefined {
    const picked = this.picked();
    return groups.find((g) => picked.has(g.key));
  }

  protected choose(groups: PermissionGroupDto[], key: string | null): void {
    const next = new Set(this.picked());
    for (const g of groups) next.delete(g.key);
    if (key) next.add(key);
    this.picked.set(next);
  }
}
