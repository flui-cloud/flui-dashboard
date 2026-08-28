import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucidePlus, lucideX } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { ListMove } from './group-draft';

@Component({
  selector: 'app-settings-list-editor',
  standalone: true,
  imports: [FormsModule, NgIcon, HlmButtonDirective],
  providers: [provideIcons({ lucideArrowDown, lucideArrowUp, lucidePlus, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="flex flex-col gap-2">
      @if (ordered()) {
        @for (item of items(); track item; let i = $index) {
          <span class="flex items-center gap-2" [attr.data-testid]="kind() + '-' + item">
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums text-muted-foreground"
            >
              {{ i + 1 }}
            </span>
            <span class="w-16 font-mono text-[13px] text-foreground">{{ item }}</span>
            <button
              type="button"
              (click)="move.emit({ index: i, by: -1 })"
              [disabled]="i === 0"
              [class]="iconBtn"
              [attr.aria-label]="'Prefer ' + item + ' sooner'"
              [attr.data-testid]="kind() + '-up-' + item"
            >
              <ng-icon name="lucideArrowUp" class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              (click)="move.emit({ index: i, by: 1 })"
              [disabled]="i === items().length - 1"
              [class]="iconBtn"
              [attr.aria-label]="'Prefer ' + item + ' later'"
              [attr.data-testid]="kind() + '-down-' + item"
            >
              <ng-icon name="lucideArrowDown" class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              (click)="remove.emit(item)"
              [class]="iconBtn"
              [attr.aria-label]="'Remove ' + item"
              [attr.data-testid]="kind() + '-remove-' + item"
            >
              <ng-icon name="lucideX" class="h-3.5 w-3.5" />
            </button>
          </span>
        } @empty {
          <span class="text-muted-foreground" [attr.data-testid]="'no-' + kind() + 's'">
            {{ emptyNote() }}
          </span>
        }
      } @else {
        <span class="flex flex-wrap gap-1">
          @for (item of items(); track item) {
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[12px]"
              [attr.data-testid]="kind() + '-' + item"
            >
              <span class="font-mono text-foreground">{{ item }}</span>
              <button
                type="button"
                (click)="remove.emit(item)"
                class="text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [attr.aria-label]="'Remove ' + item"
                [attr.data-testid]="kind() + '-remove-' + item"
              >
                <ng-icon name="lucideX" class="h-3 w-3" />
              </button>
            </span>
          } @empty {
            <span class="text-muted-foreground" [attr.data-testid]="'no-' + kind() + 's'">
              {{ emptyNote() }}
            </span>
          }
        </span>
      }

      <span class="flex items-center gap-2">
        <input
          [class]="field"
          [placeholder]="kind()"
          [ngModel]="draft()"
          (ngModelChange)="draft.set($event)"
          (keydown.enter)="submit()"
          [attr.aria-label]="'Add a ' + kind()"
          [attr.data-testid]="kind() + '-add-input'"
        />
        <button
          hlmBtn
          size="sm"
          variant="outline"
          type="button"
          (click)="submit()"
          [attr.data-testid]="kind() + '-add'"
        >
          <ng-icon name="lucidePlus" class="mr-1.5 h-3.5 w-3.5" />
          Add
        </button>
      </span>
    </span>
  `,
})
export class SettingsListEditorComponent {
  readonly items = input.required<readonly string[]>();

  readonly kind = input.required<string>();

  readonly ordered = input(false);

  readonly emptyNote = input('nothing here');

  readonly add = output<string>();
  readonly remove = output<string>();
  readonly move = output<ListMove>();

  protected readonly draft = signal('');

  protected readonly field =
    'w-32 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  protected readonly iconBtn =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  protected submit(): void {
    const value = this.draft().trim();
    if (!value) return;
    this.draft.set('');
    this.add.emit(value);
  }
}
