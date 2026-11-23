import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideBot } from '@ng-icons/lucide';
import { RecommendedProviderDto } from '../../../core/api/model/recommendedProviderDto';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';

@Component({
  selector: 'app-assistant-empty-state',
  imports: [FlEmptyState, FlButton],
  providers: [provideIcons({ lucideBot })],
  host: { class: 'block w-full' },
  template: `
    <fl-empty-state icon="lucideBot" [title]="title()" [body]="hint()" [compact]="!fullscreen()">
      @if (noInference()) {
        @if (recommended(); as rec) {
          <p class="w-full text-fl-caption text-fl-ink-muted">
            Recommended: <span class="font-medium text-fl-ink">{{ rec.label }}</span> ({{
              rec.reason
            }})
          </p>
        }
        <button flButton="primary" type="button" (click)="connect.emit()">Connect a model</button>
        @if (isAdmin()) {
          <button flButton type="button" (click)="configure.emit()">Configure a provider</button>
        }
      } @else if (!fullscreen()) {
        @if (recommended(); as rec) {
          <button flButton="ghost" size="sm" type="button" (click)="connect.emit()">
            Add {{ rec.label }} ({{ rec.reason }})
          </button>
        }
      }
    </fl-empty-state>
  `,
})
export class AssistantEmptyStateComponent {
  readonly fullscreen = input(false);
  readonly noInference = input(false);
  readonly hint = input('');
  readonly recommended = input<RecommendedProviderDto | null>(null);
  readonly isAdmin = input(false);
  readonly imgOk = input(true);

  readonly connect = output<void>();
  readonly configure = output<void>();
  readonly imgError = output<void>();

  protected readonly title = computed(() => {
    if (this.noInference()) return 'Connect a model to get started';
    return this.fullscreen() ? 'How can I help you?' : 'Ask anything';
  });
}
