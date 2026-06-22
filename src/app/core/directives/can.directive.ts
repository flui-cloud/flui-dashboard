import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { PermissionService } from '../services/permission.service';

@Directive({
  selector: '[fluiCan]',
  standalone: true,
})
export class CanDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly perms = inject(PermissionService);

  readonly fluiCan = input.required<string>();

  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.perms.can(this.fluiCan());
      if (allowed && !this.rendered) {
        this.vcr.createEmbeddedView(this.tpl);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.vcr.clear();
        this.rendered = false;
      }
    });
  }
}
