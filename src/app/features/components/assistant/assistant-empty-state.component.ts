import { Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBot } from '@ng-icons/lucide';
import { RecommendedProviderDto } from '../../../core/api/model/recommendedProviderDto';

@Component({
  selector: 'app-assistant-empty-state',
  standalone: true,
  imports: [NgIcon, NgTemplateOutlet],
  providers: [provideIcons({ lucideBot })],
  styles: [':host { display: contents; }'],
  template: `
    <ng-template #ctas>
      <div class="flex w-full max-w-[280px] flex-col gap-2">
        @if (recommended(); as rec) {
          <p class="text-xs text-muted-foreground">
            Recommended: <span class="font-medium text-foreground">{{ rec.label }}</span> — {{ rec.reason }}
          </p>
        }
        <button type="button" (click)="connect.emit()"
          class="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/40 transition-all">
          Connect a model
        </button>
        @if (isAdmin()) {
          <button type="button" (click)="configure.emit()"
            class="rounded-xl border border-input bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Configure a provider
          </button>
        }
      </div>
    </ng-template>

    @if (fullscreen()) {
      <div class="mb-8 flex flex-col items-center gap-4 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
          @if (imgOk()) {
            <img src="icons/assistant.png" class="h-10 w-10 object-contain" alt="" (error)="imgError.emit()" />
          } @else {
            <ng-icon name="lucideBot" class="h-8 w-8 text-blue-500" />
          }
        </div>
        <div class="space-y-1">
          <h2 class="text-2xl font-semibold text-foreground">{{ title() }}</h2>
          @if (hint()) {
            <p class="text-sm text-muted-foreground">{{ hint() }}</p>
          }
        </div>
      </div>
      @if (noInference()) {
        <ng-container [ngTemplateOutlet]="ctas"></ng-container>
      }
    } @else {
      <div class="flex flex-col items-center justify-center h-full py-10 gap-4 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
          @if (imgOk()) {
            <img src="icons/assistant.png" class="h-9 w-9 object-contain" alt="" (error)="imgError.emit()" />
          } @else {
            <ng-icon name="lucideBot" class="h-7 w-7 text-blue-500" />
          }
        </div>
        <div class="space-y-3">
          <div>
            <p class="text-sm font-medium text-foreground">{{ title() }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ hint() }}</p>
          </div>
          @if (noInference()) {
            <div class="flex justify-center">
              <ng-container [ngTemplateOutlet]="ctas"></ng-container>
            </div>
          } @else {
            @if (recommended(); as rec) {
              <button type="button" (click)="connect.emit()"
                class="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                Add {{ rec.label }} — {{ rec.reason }}
              </button>
            }
          }
        </div>
      </div>
    }
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
