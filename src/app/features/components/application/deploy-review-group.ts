import { Component, computed, input, output } from '@angular/core';
import { FlButton } from '../../../ui/primitives/button';

@Component({
  selector: 'app-deploy-review-group',
  imports: [FlButton],
  host: {
    class: 'flex flex-col gap-3 border-t border-fl-border pt-4 first:border-t-0 first:pt-0',
    role: 'group',
    '[attr.aria-label]': 'title()',
  },
  template: `
    <div class="flex items-center justify-between gap-3">
      <h3 class="m-0 text-fl-body-sm font-semibold">{{ title() }}</h3>
      @if (canEdit()) {
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [attr.aria-label]="'Edit ' + title()"
          (click)="edit.emit(step()!)"
        >
          Edit
        </button>
      }
    </div>
    <ng-content />
  `,
})
export class DeployReviewGroup {
  readonly title = input.required<string>();
  readonly step = input<string | null>(null);
  readonly editable = input<readonly string[]>([]);
  readonly edit = output<string>();

  protected readonly canEdit = computed(() => {
    const step = this.step();
    return !!step && this.editable().includes(step);
  });
}
