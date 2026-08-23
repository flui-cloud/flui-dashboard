import {
  Directive,
  HostListener,
  computed,
  inject,
  input,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { PermissionService } from '../../core/services/permission.service';
import {
  SandboxService,
  sandboxAreaForUrl,
} from '../../core/services/sandbox.service';

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
  readonly section = input<string | readonly string[]>('', {
    alias: 'appReadOnlySection',
  });

  private readonly perms = inject(PermissionService);
  private readonly sandbox = inject(SandboxService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly keys = computed<readonly string[]>(() => {
    const declared = this.section();
    if (Array.isArray(declared)) return declared as readonly string[];
    if (typeof declared === 'string' && declared.length > 0) return [declared];
    const area = sandboxAreaForUrl(this.url());
    return area ? [area] : [];
  });

  protected readonly readOnly = computed(() =>
    this.keys().some(
      (key) =>
        this.perms.isSectionReadOnly(key) ||
        this.sandbox.levelOf(key) !== 'full',
    ),
  );

  @HostListener('click', ['$event'])
  protected onClick(event: Event): void {
    if (!this.readOnly()) return;
    event.preventDefault();
    event.stopPropagation();
  }
}
