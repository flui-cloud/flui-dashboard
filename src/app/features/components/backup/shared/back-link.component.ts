import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { FlIcon } from '../../../../ui/primitives/icon';

@Component({
  selector: 'app-backup-back-link',
  imports: [RouterLink, FlIcon],
  providers: [provideIcons({ lucideArrowLeft })],
  template: `
    <a [routerLink]="link()" class="fl-link inline-flex w-fit items-center gap-1 text-fl-body-sm">
      <fl-icon name="lucideArrowLeft" [size]="14" />
      <span>{{ label() }}</span>
    </a>
  `,
})
export class BackupBackLinkComponent {
  readonly link = input.required<string>();
  readonly label = input<string>('Back');
}
