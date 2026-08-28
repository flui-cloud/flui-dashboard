import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRotateCw, lucideUnplug } from '@ng-icons/lucide';

@Component({
  selector: 'app-section-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @switch (variant()) {
      @case ('cards') {
        <dl
          class="m-0 grid grid-cols-2 gap-3 xl:grid-cols-4"
          [attr.data-testid]="'skeleton-' + testid()"
          aria-hidden="true"
        >
          @for (card of slots(); track card) {
            <div class="rounded-lg border border-border bg-card px-4 py-3">
              <div class="skeleton h-3 w-16"></div>
              <div class="skeleton mt-2 h-7 w-12"></div>
              <div class="skeleton mt-2 h-3 w-28"></div>
            </div>
          }
        </dl>
      }
      @case ('table') {
        <div
          class="card-surface px-4 py-3"
          [attr.data-testid]="'skeleton-' + testid()"
          aria-hidden="true"
        >
          <div class="flex gap-4 border-b border-border pb-2">
            @for (head of [1, 2, 3, 4]; track head) {
              <div class="skeleton h-3 flex-1"></div>
            }
          </div>
          @for (row of slots(); track row) {
            <div class="flex gap-4 border-b border-border/50 py-3 last:border-0">
              @for (cell of [1, 2, 3, 4]; track cell) {
                <div class="skeleton h-4 flex-1"></div>
              }
            </div>
          }
        </div>
      }
      @default {
        <div
          class="space-y-2"
          [attr.data-testid]="'skeleton-' + testid()"
          aria-hidden="true"
        >
          @for (line of slots(); track line) {
            <div class="skeleton h-4" [class]="line === 1 ? 'w-2/3' : 'w-full'"></div>
          }
        </div>
      }
    }
    <span class="sr-only">Loading {{ label() }}</span>
  `,
})
export class SectionSkeletonComponent {
  readonly variant = input<'cards' | 'table' | 'lines'>('lines');
  readonly count = input(3);
  readonly label = input('');
  readonly testid = input('block');

  protected readonly slots = computed(() =>
    Array.from({ length: this.count() }, (_, index) => index + 1),
  );
}

@Component({
  selector: 'app-section-failure',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideRotateCw, lucideUnplug })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="card-surface flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3"
      role="alert"
      [attr.data-testid]="'failure-' + testid()"
    >
      <ng-icon
        name="lucideUnplug"
        class="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground"
      />
      <p class="m-0 min-w-0 flex-1 max-w-prose text-sm text-foreground">
        {{ message() }}
        <span class="mt-0.5 block text-[13px] text-muted-foreground">
          Nothing on the cluster changed because this did not load — what is
          missing here is the reading, not the fleet.
        </span>
      </p>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        [attr.data-testid]="'retry-' + testid()"
        (click)="retry.emit()"
      >
        <ng-icon name="lucideRotateCw" class="h-4 w-4" />
        Try again
      </button>
    </div>
  `,
})
export class SectionFailureComponent {
  readonly message = input.required<string>();
  readonly testid = input('block');
  readonly retry = output<void>();
}
