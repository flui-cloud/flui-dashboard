import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCopy, lucideLock } from '@ng-icons/lucide';

export type InternalServiceMode = 'building-block' | 'internal-app';

@Component({
  selector: 'app-internal-service-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCircleCheck, lucideCopy, lucideLock })],
  template: `
    <div class="rounded-xl border border-border bg-card p-5">
      <div class="flex items-center gap-2">
        <ng-icon name="lucideLock" class="h-4 w-4 text-muted-foreground" />
        <h3 class="text-sm font-semibold text-foreground">
          {{ title() }}
        </h3>
      </div>

      <p class="mt-2 text-xs text-muted-foreground">
        {{ description() }}
      </p>

      <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt class="font-medium text-muted-foreground">Host</dt>
        <dd class="flex items-center gap-2 font-mono text-xs text-foreground">
          <span class="truncate">{{ host() }}</span>
          <button
            type="button"
            (click)="copy(host())"
            class="p-1 text-muted-foreground transition hover:text-foreground"
            title="Copy host"
          >
            <ng-icon name="lucideCopy" class="h-3.5 w-3.5" />
          </button>
        </dd>

        @if (port()) {
          <dt class="font-medium text-muted-foreground">Port</dt>
          <dd class="font-mono text-xs text-foreground">{{ port() }}</dd>
        }

        <dt class="font-medium text-muted-foreground">Protocol</dt>
        <dd class="font-mono text-xs text-foreground">TCP</dd>
      </dl>

      @if (lastCopied()) {
        <p class="mt-3 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <ng-icon name="lucideCircleCheck" class="h-3.5 w-3.5" />
          Copied to clipboard
        </p>
      }
    </div>
  `,
})
export class InternalServiceInfoComponent {
  readonly applicationSlug = input.required<string>();
  readonly namespace = input.required<string>();
  readonly port = input<number | undefined>(undefined);
  readonly mode = input<InternalServiceMode>('building-block');

  protected readonly lastCopied = signal(false);

  readonly host = computed(
    () => `${this.applicationSlug()}-svc.${this.namespace()}.svc.cluster.local`,
  );

  protected readonly title = computed(() =>
    this.mode() === 'internal-app'
      ? 'Internal App — Flui-authenticated access'
      : 'Internal Service — cluster-local only',
  );

  protected readonly description = computed(() =>
    this.mode() === 'internal-app'
      ? 'Gets a private URL on your cluster\'s internal domain, protected by Flui authentication. Accessible from the internet — Flui login required to open.'
      : 'This service is reachable only from other apps on the same cluster. Credentials are managed inside the cluster — Flui never exposes them via the API.',
  );

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.lastCopied.set(true);
      setTimeout(() => this.lastCopied.set(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }
}
