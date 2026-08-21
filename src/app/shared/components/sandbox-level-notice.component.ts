import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideInfo, lucideLock } from '@ng-icons/lucide';
import {
  SANDBOX_LEVEL_LABEL,
  SandboxLevel,
  SandboxService,
} from '../../core/services/sandbox.service';

@Component({
  selector: 'app-sandbox-level-notice',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideEye, lucideInfo, lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        role="note"
        class="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40
               px-3.5 py-2.5 text-sm text-muted-foreground"
      >
        <ng-icon [name]="icon()" class="mt-0.5 h-4 w-4 flex-shrink-0 opacity-70" />
        <p class="leading-relaxed">
          <span class="font-medium text-foreground">{{ label() }}.</span>
          {{ why() }}
        </p>
      </div>
    }
  `,
})
export class SandboxLevelNoticeComponent {
  readonly area = input.required<string>();

  private readonly sandbox = inject(SandboxService);

  protected readonly level = computed<SandboxLevel>(() =>
    this.sandbox.levelOf(this.area()),
  );
  protected readonly visible = computed(() => this.level() !== 'full');
  protected readonly label = computed(() => SANDBOX_LEVEL_LABEL[this.level()]);
  protected readonly why = computed(() => this.sandbox.whyFor(this.area()));

  protected readonly icon = computed(() => {
    switch (this.level()) {
      case 'read-only':
        return 'lucideEye';
      case 'closed':
        return 'lucideLock';
      default:
        return 'lucideInfo';
    }
  });
}
