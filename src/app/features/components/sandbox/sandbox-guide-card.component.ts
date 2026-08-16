import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideSparkles } from '@ng-icons/lucide';
import { SandboxService } from '../../../core/services/sandbox.service';

@Component({
  selector: 'app-sandbox-guide-card',
  standalone: true,
  imports: [NgIcon, RouterLink],
  providers: [provideIcons({ lucideArrowRight, lucideSparkles })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sandbox.inSandbox()) {
      <section
        class="rounded-lg border border-border bg-card p-5 flex flex-col gap-3"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"
          >
            <ng-icon name="lucideSparkles" class="h-4 w-4" />
          </span>
          <div>
            <h2 class="text-sm font-semibold">Try the thing that matters</h2>
            <p class="text-xs text-muted-foreground">
              Install an app from the catalogue and open it on your phone.
            </p>
          </div>
        </div>

        <p class="text-sm text-muted-foreground leading-relaxed">
          The app already running here was seeded by us, so you would not start
          from an empty screen. The one worth watching is the one you choose:
          it lands on a public URL with a real certificate, usually inside a
          minute.
        </p>

        <a
          routerLink="/apps/catalog"
          class="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Open the catalogue
          <ng-icon name="lucideArrowRight" class="h-4 w-4" />
        </a>
      </section>
    }
  `,
})
export class SandboxGuideCardComponent {
  protected readonly sandbox = inject(SandboxService);
}
