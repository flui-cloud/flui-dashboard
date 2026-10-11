import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideInfo, lucideLock } from '@ng-icons/lucide';
import { ExplainComponent } from './explain.component';
import {
  SANDBOX_LEVEL_LABEL,
  SandboxLevel,
  SandboxService,
} from '../../core/services/sandbox.service';

@Component({
  selector: 'app-sandbox-level-notice',
  standalone: true,
  imports: [NgIcon, ExplainComponent],
  providers: [provideIcons({ lucideEye, lucideInfo, lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        role="note"
        class="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card
               px-3 py-1.5 text-sm text-muted-foreground"
      >
        @if (icon(); as name) {
          <ng-icon [name]="name" class="h-4 w-4 flex-shrink-0 opacity-70" />
        }
        <app-explain [label]="label()" labelClass="text-[13px] font-medium text-foreground" floating>{{ why() }}</app-explain>
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
        return null;
    }
  });
}
