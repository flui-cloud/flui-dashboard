import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';

@Component({
  selector: 'app-backup-back-link',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowLeft })],
  template: `
    <a
      [routerLink]="link()"
      class="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
    >
      <ng-icon name="lucideArrowLeft" class="h-3.5 w-3.5" />
      <span>{{ label() }}</span>
    </a>
  `,
})
export class BackupBackLinkComponent {
  readonly link = input.required<string>();
  readonly label = input<string>('Back');
}
