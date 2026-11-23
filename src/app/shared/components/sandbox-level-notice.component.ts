import { Component, computed, inject, input } from '@angular/core';
import { FlAlert } from '../../ui/patterns/alert';
import {
  SANDBOX_LEVEL_LABEL,
  SandboxLevel,
  SandboxService,
} from '../../core/services/sandbox.service';

@Component({
  selector: 'app-sandbox-level-notice',
  imports: [FlAlert],
  template: `
    @if (visible()) {
      <fl-alert tone="info" role="note" [title]="label()">{{ why() }}</fl-alert>
    }
  `,
})
export class SandboxLevelNoticeComponent {
  readonly area = input.required<string>();

  private readonly sandbox = inject(SandboxService);

  protected readonly level = computed<SandboxLevel>(() => this.sandbox.levelOf(this.area()));
  protected readonly visible = computed(() => this.level() !== 'full');
  protected readonly label = computed(() => SANDBOX_LEVEL_LABEL[this.level()]);
  protected readonly why = computed(() => this.sandbox.whyFor(this.area()));
}
