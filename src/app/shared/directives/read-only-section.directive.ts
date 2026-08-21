import {
  Directive,
  HostListener,
  computed,
  inject,
  input,
} from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';
import { SandboxService } from '../../core/services/sandbox.service';

@Directive({
  selector: '[appReadOnlySection]',
  standalone: true,
  host: {
    '[class.pointer-events-none]': 'readOnly()',
    '[class.opacity-50]': 'readOnly()',
    '[attr.aria-disabled]': 'readOnly() ? true : null',
    '[attr.tabindex]': 'readOnly() ? -1 : null',
  },
})
export class ReadOnlySectionDirective {
  readonly section = input.required<string | readonly string[]>({
    alias: 'appReadOnlySection',
  });

  private readonly perms = inject(PermissionService);
  private readonly sandbox = inject(SandboxService);

  protected readonly readOnly = computed(() => {
    const keys = this.section();
    return (Array.isArray(keys) ? keys : [keys as string]).some(
      (key) =>
        this.perms.isSectionReadOnly(key) ||
        this.sandbox.levelOf(key) !== 'full',
    );
  });

  @HostListener('click', ['$event'])
  protected onClick(event: Event): void {
    if (!this.readOnly()) return;
    event.preventDefault();
    event.stopPropagation();
  }
}
